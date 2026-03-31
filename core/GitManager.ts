/**
 * .vitepress/tnotes/core/GitManager.ts
 *
 * Git 仓库管理器 - 提供统一的 Git 操作接口
 */
import { resolve } from 'path'
import { Logger, runCommand, createError, handleError } from '../utils'

/**
 * Git 文件状态接口
 */
interface GitFileStatus {
  path: string
  status: 'staged' | 'unstaged' | 'untracked' | 'modified'
  statusCode: string
}

/**
 * Git 状态信息接口
 */
export interface GitStatus {
  hasChanges: boolean
  changedFiles: number
  staged: number
  unstaged: number
  untracked: number
  branch: string
  ahead: number
  behind: number
  files: GitFileStatus[]
}

/**
 * Git 远程信息接口
 */
interface GitRemoteInfo {
  url: string
  type: 'https' | 'ssh' | 'unknown'
  owner?: string
  repo?: string
}

/**
 * Git 管理器类
 */
export class GitManager {
  private logger: Logger
  private dir: string

  constructor(dir: string, logger?: Logger) {
    this.dir = dir
    this.logger = logger?.child('git') || new Logger({ prefix: 'git' })
  }

  /**
   * 检查是否为有效的 Git 仓库
   */
  async isValidRepo(): Promise<boolean> {
    try {
      const result = await runCommand(
        'git rev-parse --is-inside-work-tree',
        this.dir,
      )
      return result.trim() === 'true'
    } catch {
      return false
    }
  }

  /**
   * 确保是有效的 Git 仓库，否则抛出错误
   */
  async ensureValidRepo(): Promise<void> {
    if (!(await this.isValidRepo())) {
      throw createError.gitNotRepo(this.dir)
    }
  }

  /**
   * 获取 Git 状态
   */
  async getStatus(): Promise<GitStatus> {
    await this.ensureValidRepo()

    // 使用 -c core.quotePath=false 禁用路径转义，正确显示中文文件名
    const statusOutput = await runCommand(
      'git -c core.quotePath=false status --porcelain',
      this.dir,
    )
    const lines = statusOutput
      .trim()
      .split('\n')
      .filter((line) => line)

    // 解析文件状态
    const files: GitFileStatus[] = lines.map((line) => {
      const statusCode = line.substring(0, 2)
      let path = line.substring(3)

      // 移除 git 添加的引号（即使设置了 core.quotePath=false，某些情况下仍会加引号）
      path = path.replace(/^"(.*)"$/, '$1')

      let status: GitFileStatus['status'] = 'modified'
      if (line.startsWith('??')) {
        status = 'untracked'
      } else if (/^[MADRC]/.test(statusCode)) {
        status = 'staged'
      } else if (/^.[MD]/.test(statusCode)) {
        status = 'unstaged'
      }

      return { path, status, statusCode }
    })

    const staged = files.filter((f) => f.status === 'staged').length
    const unstaged = files.filter((f) => f.status === 'unstaged').length
    const untracked = files.filter((f) => f.status === 'untracked').length

    // 获取当前分支
    const branch = await runCommand('git branch --show-current', this.dir)

    // 获取远程同步状态
    let ahead = 0
    let behind = 0
    try {
      const aheadBehind = await runCommand(
        'git rev-list --left-right --count @{upstream}...HEAD',
        this.dir,
      )
      const [behindStr, aheadStr] = aheadBehind.trim().split('\t')
      behind = parseInt(behindStr) || 0
      ahead = parseInt(aheadStr) || 0
    } catch {
      // 可能没有上游分支
    }

    return {
      hasChanges: lines.length > 0,
      changedFiles: lines.length,
      staged,
      unstaged,
      untracked,
      branch: branch.trim(),
      ahead,
      behind,
      files,
    }
  }

  /**
   * 获取远程仓库信息
   */
  async getRemoteInfo(): Promise<GitRemoteInfo | null> {
    try {
      await this.ensureValidRepo()
      const remoteUrl = await runCommand(
        'git config --get remote.origin.url',
        this.dir,
      )
      const url = remoteUrl.trim()

      if (!url) return null

      // 解析 HTTPS URL
      const httpsMatch = url.match(
        /https:\/\/(?:www\.)?github\.com\/([^/]+)\/(.+?)(?:\.git)?$/,
      )
      if (httpsMatch) {
        return {
          url,
          type: 'https',
          owner: httpsMatch[1],
          repo: httpsMatch[2],
        }
      }

      // 解析 SSH URL
      const sshMatch = url.match(/git@github\.com:([^/]+)\/(.+?)(?:\.git)?$/)
      if (sshMatch) {
        return {
          url,
          type: 'ssh',
          owner: sshMatch[1],
          repo: sshMatch[2],
        }
      }

      return { url, type: 'unknown' }
    } catch {
      return null
    }
  }

  /**
   * 检查是否有未提交的更改
   */
  async hasUncommittedChanges(): Promise<boolean> {
    const status = await this.getStatus()
    return status.hasChanges
  }

  /**
   * Stash 当前更改
   */
  async stash(message?: string): Promise<boolean> {
    try {
      await this.ensureValidRepo()
      const cmd = message ? `git stash push -m "${message}"` : 'git stash push'
      await runCommand(cmd, this.dir)
      this.logger.info('Stashed uncommitted changes')
      return true
    } catch (error) {
      this.logger.warn('Failed to stash changes')
      return false
    }
  }

  /**
   * Pop stash
   */
  async stashPop(): Promise<boolean> {
    try {
      await this.ensureValidRepo()
      await runCommand('git stash pop', this.dir)
      this.logger.info('Restored stashed changes')
      return true
    } catch (error) {
      this.logger.warn('Failed to restore stashed changes')
      return false
    }
  }

  /**
   * 拉取远程更新
   */
  async pull(options?: {
    rebase?: boolean
    autostash?: boolean
  }): Promise<void> {
    await this.ensureValidRepo()

    const { rebase = true, autostash = true } = options || {}

    // 检查是否有未提交的更改
    const hasChanges = await this.hasUncommittedChanges()
    let didStash = false

    if (hasChanges && !autostash) {
      this.logger.warn('Repository has uncommitted changes')
      didStash = await this.stash('Auto-stash before pull')
    }

    try {
      const status = await this.getStatus()

      // 获取远程更新前记录当前提交
      const beforeCommit = await runCommand('git rev-parse HEAD', this.dir)

      this.logger.info('正在拉取远程更新...')

      const cmd = `git pull ${rebase ? '--rebase' : ''} ${
        autostash ? '--autostash' : ''
      }`.trim()
      await runCommand(cmd, this.dir)

      // 获取拉取后的提交
      const afterCommit = await runCommand('git rev-parse HEAD', this.dir)

      // 如果有更新，显示更新的文件列表
      if (beforeCommit.trim() !== afterCommit.trim()) {
        try {
          const diffOutput = await runCommand(
            `git diff --name-only ${beforeCommit.trim()}..${afterCommit.trim()}`,
            this.dir,
          )
          const changedFiles = diffOutput
            .trim()
            .split('\n')
            .filter((f) => f)

          if (changedFiles.length > 0) {
            console.log(`  更新了 ${changedFiles.length} 个文件:`)
            changedFiles.forEach((file, index) => {
              console.log(`  ${index + 1}. ${file}`)
            })
          }

          this.logger.success(`拉取成功: ${changedFiles.length} 个文件已更新`)
        } catch {
          this.logger.success('拉取成功')
        }
      } else {
        this.logger.info('已是最新，没有需要拉取的更新')
      }
    } catch (error) {
      this.logger.error('拉取失败')
      handleError(error)
      throw error
    } finally {
      // 如果之前手动 stash 了，尝试 pop
      if (didStash) {
        await this.stashPop()
      }
    }
  }

  /**
   * 提交更改
   */
  async commit(message: string): Promise<void> {
    await this.ensureValidRepo()

    try {
      await runCommand(`git commit -m "${message}"`, this.dir)
      this.logger.success(`Committed: ${message}`)
    } catch (error) {
      handleError(error)
      throw error
    }
  }

  /**
   * 添加文件到暂存区
   */
  async add(files: string | string[] = '.'): Promise<void> {
    await this.ensureValidRepo()

    const fileList = Array.isArray(files) ? files.join(' ') : files
    try {
      await runCommand(`git add ${fileList}`, this.dir)
      this.logger.info(`Staged changes: ${fileList}`)
    } catch (error) {
      handleError(error)
      throw error
    }
  }

  /**
   * 推送到远程仓库
   */
  async push(options?: {
    force?: boolean
    setUpstream?: boolean
  }): Promise<void> {
    await this.ensureValidRepo()

    const { force = false, setUpstream = false } = options || {}

    try {
      const status = await this.getStatus()
      this.logger.progress(`正在推送到远程 (${status.branch})...`)

      let cmd = 'git push'
      if (force) cmd += ' --force'
      if (setUpstream) cmd += ` --set-upstream origin ${status.branch}`

      await runCommand(cmd, this.dir)

      const remoteInfo = await this.getRemoteInfo()
      if (remoteInfo) {
        this.logger.success(`推送成功 → ${remoteInfo.owner}/${remoteInfo.repo}`)
      } else {
        this.logger.success('推送成功')
      }
    } catch (error) {
      this.logger.error('推送失败')
      handleError(error)
      throw error
    }
  }

  /**
   * 完整的推送流程：检查 -> 添加 -> 提交 -> 推送
   */
  async pushWithCommit(
    commitMessage?: string,
    options?: { force?: boolean; showFiles?: boolean },
  ): Promise<void> {
    await this.ensureValidRepo()

    const status = await this.getStatus()

    // 检查是否有更改
    if (!status.hasChanges) {
      this.logger.info('没有需要提交的更改')
      return
    }

    try {
      // 显示开始信息和文件列表
      this.logger.info(`正在推送 ${status.changedFiles} 个文件...`)

      // 显示文件列表
      status.files.forEach((file, index) => {
        console.log(`  ${index + 1}. ${file.path}`)
      })

      // 添加所有更改（静默执行）
      await runCommand('git add .', this.dir)

      // 生成提交信息
      const message =
        commitMessage || `update: ${status.changedFiles} files modified`

      // 提交（静默执行）
      await runCommand(`git commit -m "${message}"`, this.dir)

      // 推送（静默执行）
      let cmd = 'git push'
      if (options?.force) cmd += ' --force'

      await runCommand(cmd, this.dir)

      // 只在成功时显示结果
      const remoteInfo = await this.getRemoteInfo()
      if (remoteInfo) {
        this.logger.success(
          `推送成功: ${status.changedFiles} 个文件 → https://github.com/${remoteInfo.owner}/${remoteInfo.repo}`,
        )
      } else {
        this.logger.success(`推送成功: ${status.changedFiles} 个文件`)
      }
    } catch (error) {
      // 失败时显示完整错误信息
      this.logger.error(`推送失败`)
      handleError(error)
      throw error
    }
  }

  /**
   * 完整的同步流程：拉取 -> 推送
   */
  async sync(options?: {
    commitMessage?: string
    rebase?: boolean
  }): Promise<void> {
    const { commitMessage, rebase = true } = options || {}

    try {
      // 先拉取
      await this.pull({ rebase, autostash: true })

      // 再推送
      await this.pushWithCommit(commitMessage)
    } catch (error) {
      this.logger.error('Sync failed')
      handleError(error)
      throw error
    }
  }

  /**
   * 显示状态摘要
   */
  async showStatus(options?: { showFiles?: boolean }): Promise<void> {
    const { showFiles = true } = options || {}
    const status = await this.getStatus()
    const remoteInfo = await this.getRemoteInfo()

    console.log('\n📊 Git 状态:')
    console.log(`  分支: ${status.branch}`)
    if (remoteInfo) {
      console.log(
        `  远程: ${remoteInfo.owner}/${remoteInfo.repo} (${remoteInfo.type})`,
      )
    }

    if (status.hasChanges) {
      console.log(
        `  变更: ${status.changedFiles} 个文件 (已暂存 ${status.staged}, 未暂存 ${status.unstaged}, 未跟踪 ${status.untracked})`,
      )

      // 显示文件列表
      if (showFiles && status.files.length > 0) {
        console.log('  变更文件列表:')

        // 按状态分组显示
        const stagedFiles = status.files.filter((f) => f.status === 'staged')
        const unstagedFiles = status.files.filter(
          (f) => f.status === 'unstaged',
        )
        const untrackedFiles = status.files.filter(
          (f) => f.status === 'untracked',
        )

        if (stagedFiles.length > 0) {
          console.log('    已暂存:')
          stagedFiles.forEach((f) => console.log(`      ✓ ${f.path}`))
        }

        if (unstagedFiles.length > 0) {
          console.log('    未暂存:')
          unstagedFiles.forEach((f) => console.log(`      • ${f.path}`))
        }

        if (untrackedFiles.length > 0) {
          console.log('    未跟踪:')
          untrackedFiles.forEach((f) => console.log(`      ? ${f.path}`))
        }
      }
    } else {
      console.log('  状态: 工作区干净，没有变更')
    }

    if (status.ahead > 0 || status.behind > 0) {
      const syncInfo = []
      if (status.ahead > 0) syncInfo.push(`领先 ${status.ahead} 个提交`)
      if (status.behind > 0) syncInfo.push(`落后 ${status.behind} 个提交`)
      console.log(`  同步: ${syncInfo.join(', ')}`)
    }

    console.log()
  }
}
