/**
 * .vitepress/tnotes/commands/git/PushCommand.ts
 *
 * Git Push 命令
 *
 * 流程：git add -A → git commit → fix-timestamps → git commit --amend → git push
 * fix-timestamps 的结果（.tnotes.json 变更）通过 --amend 合并到同一个 commit，
 * 保证 updated_at 精确等于 git commit 时间，且对外只产生 1 个 commit。
 */
import { ROOT_DIR_PATH } from '../../config/constants'
import { GitService, TimestampService } from '../../services'
import { runCommand } from '../../utils'
import { BaseCommand } from '../BaseCommand'

export class PushCommand extends BaseCommand {
  private gitService: GitService
  private timestampService: TimestampService

  constructor() {
    super('push')
    this.gitService = new GitService()
    this.timestampService = new TimestampService()
  }

  protected async run(): Promise<void> {
    try {
      // 1. 检查是否有更改或已有未推送的提交
      this.logger.info('检查是否有更改...')
      const status = await this.gitService.getStatus()
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
        // 2. 提交所有变更
        this.logger.info(
          `检测到 ${status.files.length} 个变更文件，正在提交...`,
        )
        const commitMessage = this.gitService.generateCommitMessage()
        await runCommand('git add -A', ROOT_DIR_PATH)
        await runCommand(`git commit -m "${commitMessage}"`, ROOT_DIR_PATH)

        // 3. 修复时间戳（基于本次刚产生的 commit 时间）
        this.logger.info('修复笔记时间戳...')
        await this.timestampService.fixAllTimestamps(false)

        // 4. 检查是否有 .tnotes.json 被修改，有则 amend 进同一个 commit
        const afterFixStatus = await runCommand(
          'git -c core.quotePath=false status --porcelain',
          ROOT_DIR_PATH,
        )
        const hasTimestampChanges = afterFixStatus
          .split(/\r?\n/)
          .filter(Boolean)
          .some((line) => line.includes('.tnotes.json'))

        if (hasTimestampChanges) {
          this.logger.info('将时间戳变更合并到 commit...')
          // git add -u 只 stage 已跟踪文件的变更（.tnotes.json 都是已跟踪文件）
          await runCommand('git add -u', ROOT_DIR_PATH)
          await runCommand('git commit --amend --no-edit', ROOT_DIR_PATH)
        }
      } else {
        this.logger.info(`检测到 ${status.ahead} 个未推送的提交，直接推送...`)
      }

      // 5. 推送到远程
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
