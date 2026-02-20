/**
 * .vitepress/tnotes/services/file-watcher/readmeChangeHandler.ts
 *
 * README 变更处理
 */

import type { WatchEvent } from './internal'
import type { NoteService } from '../note/service'

interface ReadmeChangeHandlerConfig {
  /** 笔记服务实例 */
  noteService: NoteService
}

export class ReadmeChangeHandler {
  constructor(private config: ReadmeChangeHandlerConfig) {}

  async handle(events: WatchEvent[]): Promise<void> {
    if (events.length === 0) return
    const indexes = [...new Set(events.map((c) => c.noteIndex))]
    for (const noteIndex of indexes) {
      const noteInfo = this.config.noteService.getNoteByIndex(noteIndex)
      if (noteInfo) {
        await this.config.noteService.fixNoteTitle(noteInfo)
      }
    }
  }
}
