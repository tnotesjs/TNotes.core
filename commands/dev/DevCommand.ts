/**
 * .vitepress/tnotes/commands/dev/DevCommand.ts
 *
 * 开发服务器命令 - 使用 VitepressService 和 FileWatcherService
 */

import { BaseCommand } from '../BaseCommand'
import { VitepressService, serviceManager } from '../../services'

export class DevCommand extends BaseCommand {
  private vitepressService: VitepressService

  constructor() {
    super('dev')
    this.vitepressService = new VitepressService()
  }

  protected async run(): Promise<void> {
    // 启动 VitePress 服务器（会等待服务就绪后返回）
    const pid = await this.vitepressService.startServer()

    if (pid) {
      this.logger.success(`笔记服务已启动 - PID: ${pid}`)

      await serviceManager.initialize()
    } else {
      this.logger.error('启动服务器失败')
    }
  }
}
