/**
 * .vitepress/tnotes/services/git-service/service.ts
 *
 * Git 服务 - 封装 Git 操作相关的业务逻辑
 */
import { ROOT_DIR_PATH } from '../../config/constants'
import { GitManager } from '../../core'
import { logger } from '../../utils'

/**
 * Git 推送选项
 */
interface PushOptions {
  message?: string
  branch?: string
  force?: boolean
}

/**
 * Git 拉取选项
 */
interface PullOptions {
  branch?: string
  rebase?: boolean
}

/**
 * Git 服务类
 */
export class GitService {
  private gitManager: GitManager

  constructor() {
    this.gitManager = new GitManager(ROOT_DIR_PATH)
  }

  /**
   * 推送到远程仓库
   * @param options - 推送选项
   */
  async push(options: PushOptions = {}): Promise<void> {
    const { message, branch, force = false } = options

    logger.info('Pushing to remote repository...')

    if (message) {
      await this.gitManager.pushWithCommit(message, { force })
    } else {
      await this.gitManager.push({ setUpstream: !!branch, force })
    }

    logger.info('Push completed successfully')
  }

  /**
   * 从远程仓库拉取
   * @param options - 拉取选项
   */
  async pull(options: PullOptions = {}): Promise<void> {
    const { rebase = false } = options

    logger.info('Pulling from remote repository...')

    await this.gitManager.pull({ rebase })

    logger.info('Pull completed successfully')
  }

  /**
   * 同步本地和远程仓库（先拉取后推送）
   * @param commitMessage - 可选的提交信息
   */
  async sync(commitMessage?: string): Promise<void> {
    logger.info('Syncing with remote repository...')

    await this.gitManager.sync({ commitMessage })

    logger.info('Sync completed successfully')
  }

  /**
   * 获取 Git 状态
   * @returns Git 状态信息
   */
  async getStatus() {
    return await this.gitManager.getStatus()
  }

  /**
   * 检查是否有未提交的更改
   * @returns 是否有未提交的更改
   */
  async hasChanges(): Promise<boolean> {
    const status = await this.getStatus()
    return status.hasChanges
  }

  /**
   * 生成自动提交信息
   * @returns 自动生成的提交信息
   */
  generateCommitMessage(): string {
    const date = new Date().toISOString().split('T')[0]
    const time = new Date().toTimeString().split(' ')[0]
    return `📝 Update notes - ${date} ${time}`
  }

  /**
   * 快速提交并推送（使用自动生成的提交信息）
   * @param options - 推送选项
   */
  async quickPush(options: { force?: boolean; skipCheck?: boolean } = {}): Promise<void> {
    if (!options.skipCheck && !(await this.hasChanges())) {
      logger.info('No changes to commit')
      return
    }

    const message = this.generateCommitMessage()
    await this.push({ message, force: options.force })
  }
}
