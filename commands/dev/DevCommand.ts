/**
 * .vitepress/tnotes/commands/dev/DevCommand.ts
 *
 * 开发服务器命令 - 使用 VitepressService 和 FileWatcherService
 */

import { ConfigManager } from '../../config/ConfigManager'
import { NoteManager, NoteIndexCache } from '../../core'
import { VitepressService, FileWatcherService } from '../../services'
import { BaseCommand } from '../BaseCommand'

export class DevCommand extends BaseCommand {
  private fileWatcherService: FileWatcherService
  private vitepressService: VitepressService
  private noteManager: NoteManager
  private noteIndexCache: NoteIndexCache
  private configManager: ConfigManager

  constructor() {
    super('dev')
    this.fileWatcherService = new FileWatcherService()
    this.vitepressService = new VitepressService()
    this.noteManager = NoteManager.getInstance()
    this.noteIndexCache = NoteIndexCache.getInstance()
    this.configManager = ConfigManager.getInstance()
  }

  protected async run(): Promise<void> {
    // 1. 扫描笔记目录并校验完整性（noteIndex 冲突 + config id 缺失/重复）
    const notes = this.noteManager.scanNotes()
    this.logger.info(`扫描到 ${notes.length} 篇笔记`)

    // 2. 初始化笔记索引缓存（在 VitePress 启动前完成，供插件使用）
    this.noteIndexCache.initialize(notes)

    // 3. 启动 VitePress 服务器（会等待服务就绪后返回）
    const result = await this.vitepressService.startServer()

    if (result) {
      const versionInfo = result.version ? `（v${result.version}）` : ''
      this.logger.success(
        `VitePress 服务${versionInfo}已就绪，耗时：${result.elapsed} ms`,
      )

      // 4. 启动文件监听服务
      const watcherStart = Date.now()
      this.fileWatcherService.start()
      const watcherElapsed = Date.now() - watcherStart
      this.logger.success(`文件监听服务已就绪，耗时：${watcherElapsed} ms`)

      // 5. 显示本地开发服务地址
      const port =
        this.configManager.get('port') || VitepressService.DEFAULT_DEV_PORT
      const repoName = this.configManager.get('repoName')
      this.logger.info(
        `本地开发服务地址：http://localhost:${port}/${repoName}/`,
      )
    } else {
      this.logger.error('启动服务器失败')
    }
  }
}
