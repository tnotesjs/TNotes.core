/**
 * .vitepress/tnotes/commands/git/PullCommand.ts
 *
 * Git Pull 命令 - 使用 GitService
 */
import { BaseCommand } from '../BaseCommand'
import { GitService } from '../../services'

export class PullCommand extends BaseCommand {
  private gitService: GitService

  constructor() {
    super('pull')
    this.gitService = new GitService()
  }

  protected async run(): Promise<void> {
    this.logger.info('正在从远程仓库拉取...')

    await this.gitService.pull()

    this.logger.success('拉取完成')
  }
}
