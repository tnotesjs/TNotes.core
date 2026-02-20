/**
 * .vitepress/tnotes/commands/maintenance/SyncCoreCommand.ts
 *
 * 同步 TNotes.core 命令 - 批量同步兄弟知识库的 TNotes.core submodule 到最新版本
 */
import { BaseCommand } from '../BaseCommand'
import { SyncCoreService } from '../../services'

export class SyncCoreCommand extends BaseCommand {
  private syncCoreService: SyncCoreService

  constructor() {
    super('sync-core')
    this.syncCoreService = new SyncCoreService()
  }

  protected async run(): Promise<void> {
    await this.syncCoreService.syncToAllRepos()
  }
}
