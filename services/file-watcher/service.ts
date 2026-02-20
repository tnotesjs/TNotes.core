/**
 * .vitepress/tnotes/services/file-watcher/service.ts
 *
 * 文件监听服务
 *
 * - 监听笔记文件标题的变化并自动更新 toc
 * - 监听笔记配置文件的变化并自动更新笔记的状态
 */

import { WATCH_EVENT_TYPES } from './internal'
import type { WatchEvent } from './internal'
import { safeExecute } from './internal'
import { WatchState } from './watchState'
import { EventScheduler } from './eventScheduler'
import { RenameDetector } from './renameDetector'
import { ConfigChangeHandler } from './configChangeHandler'
import { ReadmeChangeHandler } from './readmeChangeHandler'
import { GlobalUpdateCoordinator } from './globalUpdateCoordinator'
import { FolderChangeHandler } from './folderChangeHandler'
import { FsWatcherAdapter } from './fsWatcherAdapter'
import { logger } from '../../utils'
import { ReadmeService } from '../readme/service'
import { NoteService } from '../note/service'
import { NoteIndexCache } from '../../core/NoteIndexCache'
import { NOTES_DIR_PATH } from '../../config/constants'

const NOTES_DIR_NOT_SET_ERROR = 'NOTES_DIR_PATH 未设置，无法启动文件监听'

const UPDATE_UNLOCK_DELAY_MS = 500

export class FileWatcherService {
  private watchState: WatchState
  private scheduler: EventScheduler
  private renameDetector: RenameDetector
  private configHandler: ConfigChangeHandler
  private readmeHandler: ReadmeChangeHandler
  private coordinator: GlobalUpdateCoordinator
  private folderHandler: FolderChangeHandler
  private adapter: FsWatcherAdapter
  private noteService: NoteService
  private readmeService: ReadmeService
  private noteIndexCache: NoteIndexCache
  private unlockTimer: NodeJS.Timeout | null = null

  constructor(private notesDir: string = NOTES_DIR_PATH) {
    if (!this.notesDir) {
      throw new Error(NOTES_DIR_NOT_SET_ERROR)
    }
    this.init()
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
      readmeService: this.readmeService,
      noteIndexCache: this.noteIndexCache,
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
