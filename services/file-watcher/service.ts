/**
 * services/file-watcher/service.ts
 *
 * 文件监听服务
 *
 * - 监听笔记文件标题的变化并自动更新 toc
 * - 监听笔记配置文件的变化并自动更新笔记的状态
 */

import { request as httpRequest } from 'http'

import { ConfigChangeHandler } from './configChangeHandler'
import { EventScheduler } from './eventScheduler'
import { FolderChangeHandler } from './folderChangeHandler'
import { FsWatcherAdapter } from './fsWatcherAdapter'
import { GlobalUpdateCoordinator } from './globalUpdateCoordinator'
import { safeExecute } from './internal'
import { WATCH_EVENT_TYPES } from './internal'
import { ReadmeChangeHandler } from './readmeChangeHandler'
import { RenameDetector } from './renameDetector'
import { WatchState } from './watchState'
import { NOTES_DIR_PATH, port, repoName } from '../../config/constants'
import { NoteIndexCache } from '../../core/NoteIndexCache'
import { logger } from '../../utils'
import { NoteService } from '../note/service'
import { ReadmeService } from '../readme/service'

import type { WatchEvent } from './internal'

const NOTES_DIR_NOT_SET_ERROR = 'NOTES_DIR_PATH 未设置，无法启动文件监听'

const UPDATE_UNLOCK_DELAY_MS = 500

/** vite 端 fileWatcherBridgePlugin 暴露的 broadcast 接口路径 */
const RENAME_BROADCAST_PATH = '/__tnotes_broadcast_rename'
const SEARCH_REINDEX_PATH = '/__tnotes_search_reindex'

export class FileWatcherService {
  private static instance: FileWatcherService | null = null

  private watchState!: WatchState
  private scheduler!: EventScheduler
  private renameDetector!: RenameDetector
  private configHandler!: ConfigChangeHandler
  private readmeHandler!: ReadmeChangeHandler
  private coordinator!: GlobalUpdateCoordinator
  private folderHandler!: FolderChangeHandler
  private adapter!: FsWatcherAdapter
  private noteService!: NoteService
  private readmeService!: ReadmeService
  private noteIndexCache!: NoteIndexCache
  private unlockTimer: NodeJS.Timeout | null = null

  constructor(private notesDir: string = NOTES_DIR_PATH) {
    if (!this.notesDir) {
      throw new Error(NOTES_DIR_NOT_SET_ERROR)
    }
    this.init()
    FileWatcherService.instance = this
  }

  static getInstance(): FileWatcherService | null {
    return FileWatcherService.instance
  }

  private init(): void {
    this.noteService = NoteService.getInstance()
    this.readmeService = ReadmeService.getInstance()
    this.noteIndexCache = NoteIndexCache.getInstance()

    this.watchState = this.initWatchState()
    this.scheduler = this.initScheduler()
    this.folderHandler = this.initFolderHandler()
    this.renameDetector = this.initRenameDetector()
    this.configHandler = this.initConfigHandler()
    this.readmeHandler = this.initReadmeHandler()
    this.coordinator = this.initCoordinator()
    this.adapter = this.initAdapter()
  }

  private initWatchState(): WatchState {
    const watchState = new WatchState({ notesDir: this.notesDir, logger })
    watchState.initializeFromDisk()
    return watchState
  }

  private initScheduler(): EventScheduler {
    return new EventScheduler({
      onFlush: (events) => this.handleFileChange(events),
      onPauseForBatch: () => logger.warn('监听服务暂停 3s 等待批量更新完成...'),
      onResumeAfterBatch: () => logger.info('恢复自动监听'),
      reinit: () => this.watchState.initializeFromDisk(),
    })
  }

  private initFolderHandler(): FolderChangeHandler {
    return new FolderChangeHandler({
      notesDir: this.notesDir,
      watchState: this.watchState,
      scheduler: this.scheduler,
      noteService: this.noteService,
      readmeService: this.readmeService,
      noteIndexCache: this.noteIndexCache,
      logger,
      onRenameSuccess: (payload) => {
        // file-watcher 进程与 Vite dev server 进程不同，无法直接调 ws.send。
        // 通过 HTTP 调 vite 子进程暴露的 broadcast 接口，由其转发为 WS 事件。
        void this.broadcastRename(payload)
      },
      onNoteStructureChanged: (reason) => {
        void this.broadcastSearchReindex(reason)
      },
    })
  }

  private async broadcastSearchReindex(reason: string): Promise<void> {
    const path = `/${repoName}${SEARCH_REINDEX_PATH}`
    const body = JSON.stringify({ reason })
    const hosts = ['127.0.0.1', '::1']

    let lastError: unknown = null
    for (const host of hosts) {
      try {
        await this.postOnce(host, path, body)
        return
      } catch (error) {
        lastError = error
      }
    }
    logger.warn(
      `广播搜索索引重建失败 (POST http://[127.0.0.1|::1]:${port}${path}): ${String(lastError)}`,
    )
  }

  private async broadcastRename(payload: {
    oldFolder: string
    newFolder: string
    noteIndex: string
  }): Promise<void> {
    // 注意：用 Node 原生 http.request，而不是 Node 18 的全局 fetch。
    // Windows 上 undici fetch 在某些 Node 18.x 版本下访问 127.0.0.1 偶发报
    // `TypeError: fetch failed` (cause 通常是 ECONNREFUSED 错误传递异常)。
    // http.request 的行为更可预期，且不依赖 Happy Eyeballs / DNS。
    //
    // 另外：Vite dev server 默认 host=`localhost`，在 Node 18 + Windows 下
    // 可能仅绑定到 IPv6 `::1` 而非 IPv4 `127.0.0.1`，所以这里依次尝试两者。
    const path = `/${repoName}${RENAME_BROADCAST_PATH}`
    const body = JSON.stringify(payload)
    const hosts = ['127.0.0.1', '::1']

    let lastError: unknown = null
    for (const host of hosts) {
      try {
        await this.postOnce(host, path, body)
        return
      } catch (error) {
        lastError = error
      }
    }
    logger.warn(
      `广播重命名事件失败 (POST http://[127.0.0.1|::1]:${port}${path}): ${String(lastError)}`,
    )
  }

  private postOnce(host: string, path: string, body: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const req = httpRequest(
        {
          host,
          port,
          path,
          method: 'POST',
          family: host.includes(':') ? 6 : 4,
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
          },
        },
        (res) => {
          // 消费响应体，确保 socket 被释放
          res.on('data', () => {})
          res.on('end', () => {
            if (res.statusCode && res.statusCode >= 400) {
              reject(new Error(`HTTP ${res.statusCode}`))
              return
            }
            resolve()
          })
        },
      )
      req.on('error', reject)
      req.write(body)
      req.end()
    })
  }

  private initRenameDetector(): RenameDetector {
    return new RenameDetector({
      notesDir: this.notesDir,
      dirCache: {
        has: (name) => this.watchState.hasNoteDir(name),
        add: (name) => this.watchState.addNoteDir(name),
        delete: (name) => this.watchState.deleteNoteDir(name),
      },
      logger,
      onDelete: (oldName) => this.folderHandler.handleFolderDeletion(oldName),
      onRename: (oldName, newName) =>
        this.folderHandler.handleFolderRenameUpdate(oldName, newName),
    })
  }

  private initConfigHandler(): ConfigChangeHandler {
    return new ConfigChangeHandler({
      state: this.watchState,
      noteService: this.noteService,
      noteIndexCache: this.noteIndexCache,
      logger,
    })
  }

  private initReadmeHandler(): ReadmeChangeHandler {
    return new ReadmeChangeHandler({ noteService: this.noteService })
  }

  private initCoordinator(): GlobalUpdateCoordinator {
    return new GlobalUpdateCoordinator({
      notesDir: this.notesDir,
      readmeService: this.readmeService,
      logger,
    })
  }

  private initAdapter(): FsWatcherAdapter {
    return new FsWatcherAdapter({
      notesDir: this.notesDir,
      isUpdating: () => this.scheduler.getUpdating(),
      onRename: (folderName) => this.renameDetector.handleFsRename(folderName),
      onNoteEvent: (event) => this.onNoteEvent(event),
      logger,
    })
  }

  start(): void {
    this.watchState.initializeFromDisk()
    this.adapter.start()
  }

  stop(): void {
    this.adapter.stop()
    this.scheduler.clearTimers()
    this.renameDetector.clearTimers()
    this.folderHandler.clearTimers()
    if (this.unlockTimer) {
      clearTimeout(this.unlockTimer)
      this.unlockTimer = null
    }
    logger.info('文件监听服务已停止')
  }

  pause(): void {
    this.scheduler.setUpdating(true)
    logger.info('文件监听已暂停')
  }

  resume(): void {
    this.watchState.initializeFromDisk()
    this.scheduler.setUpdating(false)
    logger.info('文件监听已恢复')
  }

  isWatching(): boolean {
    return this.adapter.isWatching()
  }

  /**
   * 挂起文件监听（关闭 fs.watch 句柄），用于需要操作文件夹的场景（如重命名）
   * Windows 上 fs.watch 会锁住文件夹句柄，必须先关闭才能重命名
   */
  suspend(): void {
    this.adapter.stop()
    this.scheduler.setUpdating(true)
    logger.info('文件监听已挂起（fs.watch 已关闭）')
  }

  /**
   * 恢复文件监听（重新启动 fs.watch）
   */
  unsuspend(): void {
    this.watchState.initializeFromDisk()
    this.scheduler.setUpdating(false)
    this.adapter.start()
    logger.info('文件监听已恢复（fs.watch 已重启）')
  }

  // #region - 私有实现

  private onNoteEvent(event: WatchEvent): void {
    if (!this.isNoteFile(event.path)) return
    if (!this.watchState.updateFileHash(event.path)) return
    if (this.scheduler.recordChangeAndDetectBatch()) return
    this.scheduler.enqueue(event)
  }

  private async handleFileChange(events: WatchEvent[]): Promise<void> {
    try {
      // 优先处理配置状态变更；仅当配置未变更时再处理 README 内容更新
      const configChanges = events.filter(
        (e) => e.type === WATCH_EVENT_TYPES.CONFIG,
      )
      const readmeChanges = events.filter(
        (e) => e.type === WATCH_EVENT_TYPES.README,
      )

      const changedNoteIndexes = await this.configHandler.handle(configChanges)

      if (changedNoteIndexes.length > 0) {
        await safeExecute(
          '配置变更更新',
          () => this.coordinator.applyConfigUpdates(changedNoteIndexes),
          logger,
        )
        return
      }

      await safeExecute(
        'README 变更更新',
        async () => {
          await this.readmeHandler.handle(readmeChanges)
          await this.coordinator.updateNoteReadmesOnly(events)
        },
        logger,
      )
    } finally {
      if (this.unlockTimer) clearTimeout(this.unlockTimer)
      this.unlockTimer = setTimeout(() => {
        this.unlockTimer = null
        this.scheduler.setUpdating(false)
      }, UPDATE_UNLOCK_DELAY_MS)
    }
  }

  private isNoteFile(filePath: string): boolean {
    return filePath.endsWith('README.md') || filePath.endsWith('.tnotes.json')
  }

  // #endregion - 私有实现
}
