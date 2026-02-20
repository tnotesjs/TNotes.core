/**
 * .vitepress/tnotes/services/file-watcher/globalUpdateCoordinator.ts
 *
 * 全局更新协调：应用配置更新、更新 README 列表
 */
import type { WatchEvent } from './internal'
import { safeExecute } from './internal'
import type { NoteIndexCache } from '../../core/NoteIndexCache'
import type { ReadmeService } from '../readme/service'

import type { Logger } from '../../utils'

interface GlobalUpdateCoordinatorConfig {
  /** README 服务实例，用于更新 README 文件和侧边栏 */
  readmeService: ReadmeService
  /** 笔记索引缓存实例 */
  noteIndexCache: NoteIndexCache
  /** 日志记录器 */
  logger: Logger
}

export class GlobalUpdateCoordinator {
  constructor(private config: GlobalUpdateCoordinatorConfig) {}

  async applyConfigUpdates(changedNoteIndexes: string[]): Promise<void> {
    if (changedNoteIndexes.length === 0) return

    const { readmeService, noteIndexCache, logger } = this.config

    logger.info('检测到笔记状态变化，增量更新全局文件...')

    for (const noteIndex of changedNoteIndexes) {
      await safeExecute(
        `增量更新 ${noteIndex}`,
        async () => {
          const item = noteIndexCache.getByNoteIndex(noteIndex)
          await readmeService.updateNoteInReadme(
            noteIndex,
            item?.noteConfig || {},
          )
          logger.info(`增量更新 README 中的笔记: ${noteIndex}`)
        },
        logger,
      )
    }

    await readmeService.regenerateSidebar()
  }

  async updateNoteReadmesOnly(events: WatchEvent[]): Promise<void> {
    const noteIndexesToUpdate = [...new Set(events.map((c) => c.noteIndex))]
    if (noteIndexesToUpdate.length === 0) return
    await this.config.readmeService.updateNoteReadmesOnly(noteIndexesToUpdate)
  }
}
