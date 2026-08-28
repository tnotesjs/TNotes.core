/**
 * services/file-watcher/globalUpdateCoordinator.ts
 *
 * 全局更新协调：应用配置更新、更新 README 列表。
 * TOC/sidebar 的写入统一走 Workspace 的 `toc.reconcileFromFiles()`
 * （0004 方案 B），不再直接操作 TocService。
 */

import { dirname } from 'path'

import { safeExecute } from './internal'
import { reconcileTocFromFiles } from '../reconcileToc'

import type { WatchEvent } from './internal'
import type { Logger } from '../../utils'
import type { ReadmeService } from '../readme/service'


interface GlobalUpdateCoordinatorConfig {
  /** 笔记目录路径 */
  notesDir: string
  /** README 服务实例，用于更新笔记 README */
  readmeService: ReadmeService
  /** 日志记录器 */
  logger: Logger
}

export class GlobalUpdateCoordinator {
  constructor(private config: GlobalUpdateCoordinatorConfig) {}

  async applyConfigUpdates(changedNoteIndexes: string[]): Promise<void> {
    if (changedNoteIndexes.length === 0) return

    const { logger, notesDir } = this.config

    logger.info('检测到笔记状态变化，同步全局文件...')

    // files→TOC 对齐（Workspace）：config.done 等以文件为真值，
    // 同步到 TOC 行标记与 sidebar。
    await safeExecute(
      '配置变更同步目录',
      () => reconcileTocFromFiles(dirname(notesDir)),
      logger,
    )

    logger.info(`已同步配置变更的笔记: ${changedNoteIndexes.join(', ')}`)
  }

  async updateNoteReadmesOnly(events: WatchEvent[]): Promise<void> {
    const noteIndexesToUpdate = [...new Set(events.map((c) => c.noteIndex))]
    if (noteIndexesToUpdate.length === 0) return
    await this.config.readmeService.updateNoteReadmesOnly(noteIndexesToUpdate)
  }
}
