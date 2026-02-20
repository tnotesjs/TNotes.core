/**
 * .vitepress/tnotes/services/file-watcher/folderChangeHandler.ts
 *
 * 文件夹变更处理：删除、重命名、回退
 */

import { existsSync, promises as fsPromises } from 'fs'
import { join } from 'path'
import { safeExecute } from './internal'
import type { WatchState } from './watchState'
import type { EventScheduler } from './eventScheduler'
import type { NoteService } from '../note/service'
import type { ReadmeService } from '../readme/service'
import type { NoteIndexCache } from '../../core/NoteIndexCache'
import type { Logger } from '../../utils'

const RENAME_REVERT_DELAY_MS = 2000

/**
 * 检测到笔记目录名称变更或者被删除的事件时，需要更新根目录下的 README.md 和 sidebar.json
 *
 * 暂定 1s 作为缓冲，1s 过后再恢复监听
 */
const DELETE_REINIT_DELAY_MS = 1000

const UPDATE_UNLOCK_DELAY_MS = 500

interface FolderChangeHandlerConfig {
  /** 笔记目录路径 */
  notesDir: string
  /** 监听状态管理器 */
  watchState: WatchState
  /** 事件调度器 */
  scheduler: EventScheduler
  /** 笔记服务实例 */
  noteService: NoteService
  /** README 服务实例 */
  readmeService: ReadmeService
  /** 笔记索引缓存实例 */
  noteIndexCache: NoteIndexCache
  /** 日志记录器 */
  logger: Logger
}

export class FolderChangeHandler {
  /** 活跃的定时器 ID 集合，用于统一清理 */
  private activeTimers: Set<NodeJS.Timeout> = new Set()

  constructor(private config: FolderChangeHandlerConfig) {}

  /**
   * 清理所有活跃定时器，释放资源
   *
   * 在服务停止时调用，防止定时器在服务销毁后仍然触发回调
   */
  clearTimers(): void {
    for (const timer of this.activeTimers) {
      clearTimeout(timer)
    }
    this.activeTimers.clear()
  }

  private scheduleTimer(fn: () => void, delay: number): void {
    const timer = setTimeout(() => {
      this.activeTimers.delete(timer)
      fn()
    }, delay)
    this.activeTimers.add(timer)
  }

  async handleFolderDeletion(deletedFolderName: string): Promise<void> {
    const { scheduler, watchState, noteIndexCache, readmeService, logger } =
      this.config

    if (scheduler.getUpdating()) return
    scheduler.setUpdating(true)

    try {
      const noteIndex = this.extractNoteIndexOrWarn(deletedFolderName)
      if (!noteIndex) return

      logger.info(`正在处理笔记删除: ${noteIndex} (${deletedFolderName})`)

      // 清理缓存
      watchState.deleteNoteDir(deletedFolderName)
      watchState.clearNoteCaches(deletedFolderName)
      noteIndexCache.delete(noteIndex)

      // 更新根 README.md、sidebar.json
      await safeExecute(
        `删除笔记 ${noteIndex}`,
        async () => {
          await readmeService.deleteNoteFromReadme(noteIndex)
          await readmeService.regenerateSidebar()
        },
        logger,
      )
    } finally {
      this.scheduleTimer(() => {
        scheduler.setUpdating(false)
        watchState.initializeFromDisk()
      }, DELETE_REINIT_DELAY_MS)
    }
  }

  async handleFolderRenameUpdate(
    oldName: string,
    newName: string,
  ): Promise<void> {
    const { scheduler, watchState, logger } = this.config

    if (scheduler.getUpdating()) return
    scheduler.setUpdating(true)

    try {
      const { oldNoteIndex, newNoteIndex } = this.validateRenameIndexes(
        oldName,
        newName,
      )
      if (!oldNoteIndex || !newNoteIndex) return

      logger.info(`正在处理文件夹重命名: ${oldName} → ${newName}`)

      if (oldNoteIndex === newNoteIndex) {
        await safeExecute(
          `标题重命名 ${newNoteIndex}`,
          () => this.handleTitleOnlyRename(newNoteIndex, newName),
          logger,
        )
      } else {
        await safeExecute(
          `索引变更 ${oldNoteIndex}→${newNoteIndex}`,
          () => this.handleIndexChangedRename(oldNoteIndex, newNoteIndex),
          logger,
        )
      }
    } finally {
      this.scheduleTimer(() => {
        scheduler.setUpdating(false)
        watchState.initializeFromDisk()
      }, UPDATE_UNLOCK_DELAY_MS)
    }
  }

  // #region - 私有实现

  private validateRenameIndexes(
    oldName: string,
    newName: string,
  ): { oldNoteIndex: string | null; newNoteIndex: string | null } {
    const { noteIndexCache, logger } = this.config
    const oldNoteIndex = this.extractNoteIndexOrWarn(oldName)
    const newNoteIndex = this.extractNoteIndexOrWarn(newName)

    if (!oldNoteIndex || !newNoteIndex) {
      return { oldNoteIndex: null, newNoteIndex: null }
    }

    if (!/^\d{4}$/.test(newNoteIndex)) {
      logger.error(`新笔记索引格式非法: ${newNoteIndex}，自动回退`)
      this.revertFolderRename(oldName, newName)
      return { oldNoteIndex: null, newNoteIndex: null }
    }

    if (oldNoteIndex !== newNoteIndex && noteIndexCache.has(newNoteIndex)) {
      logger.error(`新笔记索引 ${newNoteIndex} 已存在，自动回退`)
      this.revertFolderRename(oldName, newName)
      return { oldNoteIndex: null, newNoteIndex: null }
    }

    return { oldNoteIndex, newNoteIndex }
  }

  private async handleTitleOnlyRename(
    noteIndex: string,
    newName: string,
  ): Promise<void> {
    const { noteIndexCache, readmeService, logger } = this.config

    logger.info(`笔记索引未变 (${noteIndex})，只更新标题`)
    noteIndexCache.updateFolderName(noteIndex, newName)
    const item = noteIndexCache.getByNoteIndex(noteIndex)
    if (item) {
      await readmeService.updateNoteInReadme(noteIndex, item.noteConfig)
    }
    await readmeService.regenerateSidebar()
    logger.success(`标题更新完成`)
  }

  private async handleIndexChangedRename(
    oldNoteIndex: string,
    newNoteIndex: string,
  ): Promise<void> {
    const { noteService, noteIndexCache, readmeService, logger } = this.config

    logger.info(`笔记索引变更: ${oldNoteIndex} → ${newNoteIndex}`)

    await readmeService.deleteNoteFromReadme(oldNoteIndex)

    const newNote = noteService.getNoteByIndex(newNoteIndex)

    if (newNote) {
      noteIndexCache.delete(oldNoteIndex)
      noteIndexCache.add(newNote)

      await readmeService.appendNoteToReadme(newNoteIndex)
      await readmeService.regenerateSidebar()
      logger.success(`笔记索引变更处理完成`)
    } else {
      logger.error(`未找到新笔记: ${newNoteIndex}`)
    }
  }

  private async revertFolderRename(
    oldName: string,
    newName: string,
  ): Promise<void> {
    const { notesDir, scheduler, watchState, logger } = this.config

    try {
      const oldPath = join(notesDir, oldName)
      const newPath = join(notesDir, newName)

      if (existsSync(newPath)) {
        scheduler.setUpdating(true)
        await fsPromises.rename(newPath, oldPath)
        logger.warn(`文件夹已回退: ${newName} → ${oldName}`)
        this.scheduleTimer(() => {
          scheduler.setUpdating(false)
          watchState.initializeFromDisk()
        }, RENAME_REVERT_DELAY_MS)
      }
    } catch (error) {
      logger.error(`回退文件夹重命名失败: ${error}`)
    }
  }

  private extractNoteIndexOrWarn(name: string): string | null {
    const noteIndex = name.match(/^(\d{4})/)?.[1] || null
    if (!noteIndex) {
      this.config.logger.warn(`无法从文件夹名称提取笔记索引: ${name}`)
    }
    return noteIndex
  }

  // #endregion - 私有实现
}
