/**
 * .vitepress/tnotes/commands/build/BuildCommand.ts
 *
 * 构建命令 - 使用 VitepressService
 */
import { BaseCommand } from '../BaseCommand'
import { VitepressService } from '../../services'

export class BuildCommand extends BaseCommand {
  private vitepressService: VitepressService

  constructor() {
    super('build')
    this.vitepressService = new VitepressService()
  }

  protected async run(): Promise<void> {
    this.logger.info('开始构建知识库...')

    await this.vitepressService.build()

    this.logger.success('知识库构建完成')
  }
}
