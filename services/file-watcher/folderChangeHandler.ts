/**
 * services/file-watcher/folderChangeHandler.ts
 *
 * 文件夹变更处理：删除、重命名、回退
 */

import { existsSync, promises as fsPromises } from 'fs'
import { dirname, join } from 'path'

import { safeExecute } from './internal'
import { REPO_NOTES_URL } from '../../config/constants'
import { generateNoteTitle } from '../../config/templates'
import { reconcileTocFromFiles } from '../reconcileToc'

import type { EventScheduler } from './eventScheduler'
import type { WatchState } from './watchState'
import type { NoteIndexCache } from '../../core/NoteIndexCache'
import type { Logger } from '../../utils'
import type { NoteService } from '../note/service'
import type { ReadmeService } from '../readme/service'

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
  /**
   * 文件夹重命名成功后回调（可选）。
   *
   * 用于在 dev server 中通过 Vite WS 通知前端跳转到新 URL，
   * 让「文件系统直接改名」与「关于面板保存」体验一致。
   */
  onRenameSuccess?: (payload: {
    oldFolder: string
    newFolder: string
    noteIndex: string
  }) => void
  /** 笔记结构变更（增删改目录）后触发 dev 搜索索引重建 */
  onNoteStructureChanged?: (reason: string) => void
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
    const { scheduler, watchState, noteIndexCache, logger, notesDir } =
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

      // files→TOC 对齐（Workspace）：TOC 行随目录消失而移除
      await safeExecute(
        `删除笔记 ${noteIndex}`,
        async () => {
          await reconcileTocFromFiles(dirname(notesDir))
          this.config.onNoteStructureChanged?.(`watcher:delete:${noteIndex}`)
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

      this.config.onRenameSuccess?.({
        oldFolder: oldName,
        newFolder: newName,
        noteIndex: newNoteIndex,
      })
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
    const { noteIndexCache, logger, notesDir } = this.config

    logger.info(`笔记索引未变 (${noteIndex})，只更新标题`)
    noteIndexCache.updateFolderName(noteIndex, newName)

    // 同步重写笔记目录内 README.md 的一级标题，与 RenameNoteCommand 行为一致
    await safeExecute(
      `更新 README 一级标题 ${noteIndex}`,
      () => this.rewriteNoteReadmeH1(notesDir, newName, noteIndex),
      logger,
    )

    // files→TOC 对齐（Workspace）：标题以目录名为准，行位置/完成标记保留
    await safeExecute(
      `标题重命名同步目录 ${noteIndex}`,
      () => reconcileTocFromFiles(dirname(notesDir)),
      logger,
    )
    this.config.onNoteStructureChanged?.(`watcher:rename-title:${noteIndex}`)
    logger.success(`标题更新完成`)
  }

  /**
   * 重写指定笔记目录下 README.md 的一级标题。
   *
   * 输入的 `folderName` 形如 `0003. 评论功能的技术实现`，
   * 据此推导出新标题文本（去掉 `${noteIndex}. ` 前缀）。
   */
  private async rewriteNoteReadmeH1(
    notesDir: string,
    folderName: string,
    noteIndex: string,
  ): Promise<void> {
    const readmePath = join(notesDir, folderName, 'README.md')
    if (!existsSync(readmePath)) return

    const newTitle = folderName.replace(/^\d{4}\.\s*/, '').trim()
    if (!newTitle) return

    const content = await fsPromises.readFile(readmePath, 'utf-8')
    const lines = content.split('\n')

    let h1Index = -1
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().startsWith('# ')) {
        h1Index = i
        break
      }
    }

    if (h1Index === -1) {
      this.config.logger.warn(
        `未在 ${readmePath} 找到一级标题，跳过 README H1 更新`,
      )
      return
    }

    const newH1 = generateNoteTitle(noteIndex, newTitle, REPO_NOTES_URL)
    if (lines[h1Index] === newH1) return

    lines[h1Index] = newH1
    await fsPromises.writeFile(readmePath, lines.join('\n'), 'utf-8')
  }

  private async handleIndexChangedRename(
    oldNoteIndex: string,
    newNoteIndex: string,
  ): Promise<void> {
    const { noteService, noteIndexCache, logger, notesDir } = this.config

    logger.info(`笔记索引变更: ${oldNoteIndex} → ${newNoteIndex}`)

    // files→TOC 对齐（Workspace）：旧索引行随目录消失移除，新索引行按编号追加
    await safeExecute(
      `索引变更同步目录 ${oldNoteIndex}→${newNoteIndex}`,
      () => reconcileTocFromFiles(dirname(notesDir)),
      logger,
    )

    const newNote = noteService.getNoteByIndex(newNoteIndex)

    if (newNote) {
      noteIndexCache.delete(oldNoteIndex)
      noteIndexCache.add(newNote)

      this.config.onNoteStructureChanged?.(
        `watcher:rename-index:${oldNoteIndex}->${newNoteIndex}`,
      )
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
