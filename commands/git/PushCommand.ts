/**
 * commands/git/PushCommand.ts
 *
 * Git Push 命令
 *
 * 流程：git add -A → git commit → git push
 */

import { ROOT_DIR_PATH } from '../../config/constants'
import { GitManager } from '../../core'
import { GitService } from '../../services'
import { runCommand } from '../../utils'
import { BaseCommand } from '../BaseCommand'

export class PushCommand extends BaseCommand {
  private gitManager: GitManager
  private gitService: GitService

  constructor() {
    super('push')

    this.gitManager = new GitManager(ROOT_DIR_PATH)
    this.gitService = new GitService()
  }

  protected async run(): Promise<void> {
    try {
      // 1. 检查是否有更改或已有未推送的提交
      this.logger.info('检查是否有更改...')
      const status = await this.gitManager.getStatus()
      const hasPendingCommits = (status.ahead ?? 0) > 0

      if (!status.hasChanges && !hasPendingCommits) {
        this.logger.info('没有更改需要推送')
        return
      }

      const force = this.options.force === true
      if (force) {
        this.logger.warn('使用强制推送模式 (--force)')
      }

      if (status.hasChanges) {
        this.logger.info(
          `检测到 ${status.files.length} 个变更文件，正在提交...`,
        )
        const commitMessage = this.gitService.generateCommitMessage()
        await runCommand('git add -A', ROOT_DIR_PATH)
        await runCommand(`git commit -m "${commitMessage}"`, ROOT_DIR_PATH)
      } else {
        this.logger.info(`检测到 ${status.ahead} 个未推送的提交，直接推送...`)
      }

      // 2. 推送到远程
      this.logger.info('正在推送到远程仓库...')
      const pushCmd = force ? 'git push --force' : 'git push'
      await runCommand(pushCmd, ROOT_DIR_PATH)
      this.logger.success('推送完成')
    } catch (error) {
      this.logger.error('推送失败:', error)
      throw error
    }
  }
}
