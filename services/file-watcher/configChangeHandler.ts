/**
 * .vitepress/tnotes/services/file-watcher/configChangeHandler.ts
 *
 * 配置变更处理
 */

import type { WatchEvent } from './internal'
import type { WatchState } from './watchState'
import type { NoteService } from '../note/service'
import type { NoteIndexCache } from '../../core/NoteIndexCache'
import type { Logger } from '../../utils'

interface ConfigChangeHandlerConfig {
  /** 监听状态管理器 */
  state: WatchState
  /** 笔记服务实例 */
  noteService: NoteService
  /** 笔记索引缓存实例 */
  noteIndexCache: NoteIndexCache
  /** 日志记录器 */
  logger: Logger
}

export class ConfigChangeHandler {
  constructor(private config: ConfigChangeHandlerConfig) {}

  async handle(events: WatchEvent[]): Promise<string[]> {
    if (events.length === 0) return []
    const changedIndexes: string[] = []

    const { state, noteService, noteIndexCache, logger } = this.config

    for (const change of events) {
      // 忽略由 API 主动写入的更新，避免重复触发
      if (noteService.shouldIgnoreConfigChange(change.path)) {
        logger.debug(`忽略 API 写入的配置文件: ${change.path}`)
        continue
      }

      const snapshot = state.readConfigSnapshot(change.path)
      if (!snapshot) continue

      const cached = state.getConfigSnapshot(change.path)
      state.setConfigSnapshot(change.path, snapshot)
      noteIndexCache.updateConfig(change.noteIndex, snapshot)

      if (!cached) continue

      const statusChanged = cached.done !== snapshot.done
      const otherChanged =
        cached.enableDiscussions !== snapshot.enableDiscussions ||
        cached.description !== snapshot.description

      if (statusChanged) {
        changedIndexes.push(change.noteIndex)
        logger.info(`检测到配置状态变化: done(${cached.done}→${snapshot.done})`)
      } else if (otherChanged) {
        logger.info('检测到配置非状态字段变化，已刷新缓存（无需全局更新）')
      }
    }

    return changedIndexes
  }
}
