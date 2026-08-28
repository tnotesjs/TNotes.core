/**
 * commands/dev/DevCommand.ts
 *
 * 开发服务器命令 - 使用 VitepressService 和 FileWatcherService
 */

import { ConfigManager } from '../../config/ConfigManager'
import { ROOT_DIR_PATH } from '../../config/constants'
import { NoteManager, NoteIndexCache } from '../../core'
import { VitepressService, FileWatcherService } from '../../services'
import { reconcileTocFromFiles } from '../../services/reconcileToc'
import { BaseCommand } from '../BaseCommand'

export class DevCommand extends BaseCommand {
  private configManager: ConfigManager
  private fileWatcherService: FileWatcherService
  private noteIndexCache: NoteIndexCache
  private noteManager: NoteManager
  private vitepressService: VitepressService

  constructor() {
    super('dev')
    
    this.configManager = ConfigManager.getInstance()
    this.fileWatcherService = new FileWatcherService()
    this.noteIndexCache = NoteIndexCache.getInstance()
    this.noteManager = NoteManager.getInstance()
    this.vitepressService = new VitepressService()
  }

  protected async run(): Promise<void> {
    // 1. 扫描笔记目录并校验完整性（noteIndex 冲突 + config id 缺失/重复）
    const notes = this.noteManager.scanNotes()
    this.logger.info(`扫描到 ${notes.length} 篇笔记`)

    // 2. 初始化笔记索引缓存（在 VitePress 启动前完成，供插件使用）
    this.noteIndexCache.initialize(notes)

    // 3. 重新生成 sidebar.json（必须在 VitePress 启动前完成，基于 TOC.md）
    //
    // sidebar.data.ts 这个 VitePress data loader 只在启动时读取磁盘上的
    // sidebar.json，运行期间靠 HMR 监听其变化做热更新。但冷启动时若 sidebar.json
    // 与当前笔记/TOC.md 不同步（例如 git pull、切分支、或上次会话外离线增删改了
    // 笔记），VitePress 就会把过期数据读进来，导致侧边栏显示错误，需要手动删除
    // .vitepress/cache 才能恢复。这里在启动前主动重建一次，消除启动时的过期窗口。
    // files→TOC 对齐（Workspace）：冷启动前从磁盘真值重建 TOC/sidebar
    await reconcileTocFromFiles(ROOT_DIR_PATH)

    // 4. 启动 VitePress 服务器（会等待服务就绪后返回）
    const result = await this.vitepressService.startServer()

    if (result) {
      const versionInfo = result.version ? `（v${result.version}）` : ''
      this.logger.success(
        `VitePress 服务${versionInfo}已就绪，耗时：${result.elapsed} ms`,
      )

      // 5. 启动文件监听服务
      const watcherStart = Date.now()
      this.fileWatcherService.start()
      const watcherElapsed = Date.now() - watcherStart
      this.logger.success(`文件监听服务已就绪，耗时：${watcherElapsed} ms`)

      // 6. 显示本地开发服务地址
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
