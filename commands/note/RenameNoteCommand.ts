/**
 * .vitepress/tnotes/commands/note/RenameNoteCommand.ts
 *
 * 重命名笔记命令 - 用于在开发环境中重命名笔记文件夹
 */
import { existsSync, renameSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { BaseCommand } from '../BaseCommand'
import { ReadmeService, NoteService } from '../../services'
import { validateNoteTitle } from '../../utils'
import { NOTES_PATH, REPO_NOTES_URL } from '../../config/constants'
import { generateNoteTitle } from '../../config/templates'

interface RenameNoteParams {
  noteIndex: string
  newTitle: string
}

export class RenameNoteCommand extends BaseCommand {
  private noteService: NoteService
  private readmeService: ReadmeService

  constructor() {
    super('rename-note')
    this.noteService = NoteService.getInstance()
    this.readmeService = ReadmeService.getInstance()
  }

  protected async run(): Promise<void> {
    // 从命令行参数读取
    const noteIndex = process.env.NOTE_ID
    const newTitle = process.env.NOTE_TITLE

    if (!noteIndex || !newTitle) {
      throw new Error('缺少 NOTE_ID 或 NOTE_TITLE 参数')
    }

    try {
      await this.renameNote({ noteIndex, newTitle })
      this.logger.success(`笔记 ${noteIndex} 已重命名为: ${newTitle}`)
    } catch (error) {
      this.logger.error('重命名失败', error)
      throw error
    }
  }

  /**
   * 重命名笔记（可被外部调用）
   */
  async renameNote(params: RenameNoteParams): Promise<void> {
    const { noteIndex, newTitle } = params

    // 验证笔记是否存在
    const note = this.noteService.getNoteByIndex(noteIndex)
    if (!note) {
      throw new Error(`笔记未找到: ${noteIndex}`)
    }

    // 验证新标题
    const validation = validateNoteTitle(newTitle)
    if (!validation.valid) {
      throw new Error(validation.error || '标题格式无效')
    }

    // 构建新的文件夹名称
    const newDirName = `${noteIndex}. ${newTitle.trim()}`
    const newPath = join(NOTES_PATH, newDirName)

    // 检查新路径是否已存在
    if (existsSync(newPath)) {
      throw new Error(`目标文件夹已存在: ${newDirName}`)
    }

    // 重命名文件夹
    try {
      renameSync(note.path, newPath)
      this.logger.info(`✅ 文件夹已重命名:`)
      this.logger.info(`  原名称: ${note.dirName}`)
      this.logger.info(`  新名称: ${newDirName}`)
    } catch (error) {
      throw new Error(
        `重命名文件夹失败: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    }

    // 更新笔记内部的标题（README.md 第一行）
    try {
      this.logger.info('正在更新笔记内部标题...')
      const readmePath = join(newPath, 'README.md')

      if (existsSync(readmePath)) {
        const content = readFileSync(readmePath, 'utf-8')
        const lines = content.split('\n')

        // 查找第一个一级标题
        let h1Index = -1
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].trim().startsWith('# ')) {
            h1Index = i
            break
          }
        }

        if (h1Index !== -1) {
          // 生成新的标题
          const newH1 = generateNoteTitle(
            noteIndex,
            newTitle.trim(),
            REPO_NOTES_URL,
          )
          lines[h1Index] = newH1

          // 写回文件
          writeFileSync(readmePath, lines.join('\n'), 'utf-8')
          this.logger.success('✅ 笔记标题已更新')
        } else {
          this.logger.warn(
            `⚠️  笔记标题格式不符合规范，未找到一级标题，请手动检查修正: ${readmePath}`,
          )
        }
      }
    } catch (error) {
      this.logger.warn('⚠️  更新笔记标题时出错:', error)
    }

    // 重命名成功后,更新全局 README.md 和 sidebar.json
    try {
      this.logger.info('正在更新全局 README.md 和 sidebar.json...')

      // 更新 README.md 和 sidebar.json
      await this.readmeService.updateAllReadmes()

      this.logger.success('✅ 全局文件已更新')
    } catch (error) {
      this.logger.warn('⚠️  文件夹重命名成功,但更新全局文件时出错:', error)
      // 不抛出错误,因为主要任务(重命名)已完成
    }
  }
}
