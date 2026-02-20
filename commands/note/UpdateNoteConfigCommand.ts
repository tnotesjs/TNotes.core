/**
 * .vitepress/tnotes/commands/note/UpdateNoteConfigCommand.ts
 *
 * 更新笔记配置命令 - 用于在开发环境中更新笔记配置
 */
import { BaseCommand } from '../BaseCommand'
import { NoteService } from '../../services'
import type { NoteConfig } from '../../types'

interface UpdateConfigParams {
  noteIndex: string
  config: Partial<
    Pick<NoteConfig, 'done' | 'enableDiscussions' | 'description'>
  >
}

export class UpdateNoteConfigCommand extends BaseCommand {
  private noteService: NoteService

  constructor() {
    super('update-note-config')
    this.noteService = NoteService.getInstance()
  }

  protected async run(): Promise<void> {
    // 从命令行参数读取配置（用于 CLI 调用）
    const noteIndex = process.env.NOTE_ID
    const done = process.env.NOTE_DONE === 'true'
    const enableDiscussions = process.env.NOTE_DISCUSSIONS === 'true'
    const description = process.env.NOTE_DESCRIPTION || ''

    if (!noteIndex) {
      throw new Error('缺少 NOTE_ID 参数')
    }

    try {
      await this.updateConfig({
        noteIndex,
        config: {
          done,
          enableDiscussions,
          description,
        },
      })

      this.logger.success(`笔记 ${noteIndex} 配置已更新`)
    } catch (error) {
      this.logger.error('更新配置失败', error)
      throw error
    }
  }

  /**
   * 更新笔记配置（可被外部调用）
   */
  async updateConfig(params: UpdateConfigParams): Promise<void> {
    const { noteIndex, config } = params

    // 验证笔记是否存在
    const note = this.noteService.getNoteByIndex(noteIndex)
    if (!note) {
      throw new Error(`笔记未找到: ${noteIndex}`)
    }

    // 更新配置
    await this.noteService.updateNoteConfig(noteIndex, config)

    this.logger.info(`✅ 笔记 ${noteIndex} 配置已更新:`)
    if (config.done !== undefined)
      this.logger.info(`  - 完成状态: ${config.done}`)
    if (config.enableDiscussions !== undefined)
      this.logger.info(`  - 评论状态: ${config.enableDiscussions}`)
    if (config.description !== undefined)
      this.logger.info(`  - 笔记简介: ${config.description || '(空)'}`)
  }
}
