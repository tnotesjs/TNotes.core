/**
 * .vitepress/tnotes/services/file-watcher/fsWatcherAdapter.ts
 *
 *  fs.watch 适配器：仅负责监听和事件分发
 */

import type { FSWatcher } from 'fs'
import { watch } from 'fs'
import { basename, dirname, join, sep } from 'path'
import type { WatchEvent, WatchEventType } from './internal'
import { WATCH_EVENT_TYPES } from './internal'
import { extractNoteIndex, warnInvalidNoteIndex } from '../../utils'

import type { Logger } from '../../utils'

interface FsWatcherAdapterConfig {
  /** 笔记目录路径 */
  notesDir: string
  /** 检查是否正在更新的方法 */
  isUpdating: () => boolean
  /** 文件夹重命名事件回调 */
  onRename: (folderName: string) => void
  /** 笔记事件处理回调 */
  onNoteEvent: (event: WatchEvent) => void
  /** 日志记录器 */
  logger: Logger
}

export class FsWatcherAdapter {
  /** 文件系统监听器实例 */
  private watcher: FSWatcher | null = null

  constructor(private config: FsWatcherAdapterConfig) {}

  start(): void {
    const { logger } = this.config

    if (this.watcher) {
      logger.warn('文件监听服务已启动')
      return
    }

    this.watcher = watch(
      this.config.notesDir,
      { recursive: true },
      (eventType, filename) => this.handleFsEvent(eventType, filename),
    )

    logger.success(`文件监听服务已启动`)
    logger.success(`监听目录 - ${this.config.notesDir}`)
  }

  stop(): void {
    if (!this.watcher) return
    this.watcher.close()
    this.watcher = null
  }

  isWatching(): boolean {
    return this.watcher !== null
  }

  private handleFsEvent(eventType: string, filename: string | undefined): void {
    const { isUpdating, onRename, onNoteEvent } = this.config

    // 过滤无效事件
    // 处理需要跳过监听的场景
    if (
      !filename || // 忽略无文件变更
      isUpdating() // 如果正在更新，忽略所有变更
    ) {
      return
    }

    // 文件夹级事件
    // 处理笔记名称（笔记所属的直接父级文件夹名称）发生变化的场景
    // 根层 rename：文件夹创建/删除/重命名，交给 RenameDetector
    if (
      eventType === 'rename' && // 检测文件夹 rename 事件
      !filename.includes(sep) // 顶层文件夹名称发生变更
    ) {
      onRename(filename)
      return
    }

    // 文件级事件
    // 处理笔记文件内容（笔记 README.md 文件、笔记配置 .tnotes.json 文件）发生变化的场景
    // 只处理 README.md 和 .tnotes.json 文件的变更
    const baseFilename = basename(filename)
    if (baseFilename !== 'README.md' && baseFilename !== '.tnotes.json') {
      // 忽略非目标文件的变更事件（如 assets 文件夹、其他文件等）
      return
    }

    const fullPath = join(this.config.notesDir, filename)
    const event = this.buildWatchEvent(fullPath, filename)
    if (!event) {
      // 无法构建变更事件 - 通常是笔记格式错误导致，比如笔记名的索引不是 0001-9999
      return
    }

    onNoteEvent(event)
  }

  private buildWatchEvent(
    fullPath: string,
    filename: string,
  ): WatchEvent | null {
    const noteDirName = basename(dirname(fullPath))
    const noteIndex = extractNoteIndex(noteDirName)
    if (!noteIndex) {
      warnInvalidNoteIndex(noteDirName)
      return null
    }

    const fileType: WatchEventType = filename.endsWith('README.md')
      ? WATCH_EVENT_TYPES.README
      : WATCH_EVENT_TYPES.CONFIG

    return {
      path: fullPath,
      type: fileType,
      noteIndex,
      noteDirName,
      noteDirPath: dirname(fullPath),
    }
  }
}
