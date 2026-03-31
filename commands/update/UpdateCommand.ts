/**
 * .vitepress/tnotes/commands/update/UpdateCommand.ts
 *
 * 更新命令 - 使用 ReadmeService
 */
import { BaseCommand } from '../BaseCommand'
import { ReadmeService, NoteService } from '../../services'
import { logger, LogLevel, parseReadmeCompletedNotes } from '../../utils'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import { ROOT_DIR_PATH, ROOT_CONFIG_PATH } from '../../config'
import type { TNotesConfig } from '../../types'

export class UpdateCommand extends BaseCommand {
  private readmeService: ReadmeService
  private noteService: NoteService
  private quiet: boolean = false

  constructor() {
    super('update')
    this.readmeService = ReadmeService.getInstance()
    this.noteService = NoteService.getInstance()
  }

  /**
   * 设置 quiet 模式
   *
   * 在 quiet 模式下，只显示 WARN 级别以上的日志
   */
  setQuiet(quiet: boolean): void {
    this.quiet = quiet
    if (quiet) {
      logger.setLevel(LogLevel.WARN)
    } else {
      logger.setLevel(LogLevel.INFO)
    }
  }

  protected async run(): Promise<void> {
    await this.updateCurrentRepo()
  }

  /**
   * 更新当前知识库
   */
  private async updateCurrentRepo(): Promise<void> {
    const startTime = Date.now()

    // 扫描一次笔记，复用于后续步骤
    const notes = this.noteService.getAllNotes()

    // 修正所有笔记的标题
    if (!this.quiet) {
      this.logger.info('正在修正笔记标题...')
    }
    const fixedCount = await this.noteService.fixAllNoteTitles(notes)
    if (!this.quiet && fixedCount > 0) {
      this.logger.success(`修正了 ${fixedCount} 个笔记标题`)
    }

    // 更新知识库（传入已扫描的笔记列表，避免重复扫描）
    await this.readmeService.updateAllReadmes({ notes })

    // 更新 root_item 配置
    await this.updateRootItem()

    const duration = Date.now() - startTime

    if (this.quiet) {
      // quiet 模式：只显示简洁的完成信息
      this.logger.success(`知识库更新完成 (${duration}ms)`)
    } else {
      this.logger.success('知识库更新完成')
    }
  }

  /**
   * 更新 root_item 配置
   * 只更新当前月份的完成笔记数量
   */
  private async updateRootItem(): Promise<void> {
    try {
      // 读取当前配置
      const configContent = readFileSync(ROOT_CONFIG_PATH, 'utf-8')
      const config: TNotesConfig = JSON.parse(configContent)

      // 1. 读取根目录 README.md
      const readmePath = resolve(ROOT_DIR_PATH, 'README.md')
      if (!existsSync(readmePath)) {
        throw new Error('根目录 README.md 不存在')
      }

      const readmeContent = readFileSync(readmePath, 'utf-8')

      // 2. 解析完成笔记数量

      const { completedCount } = parseReadmeCompletedNotes(readmeContent)

      // 3. 生成当前月份的键名（如 '25.12'）
      const now = new Date()
      const yearShort = String(now.getFullYear()).slice(-2)
      const monthStr = String(now.getMonth() + 1).padStart(2, '0')
      const currentKey = `${yearShort}.${monthStr}`

      // 4. 更新当前月份的完成数量
      const completedNotesCount = {
        ...(config.root_item.completed_notes_count || {}),
        [currentKey]: completedCount,
      }

      // 5. 获取当前时间作为更新时间
      const updatedAt = Date.now()

      // 更新 root_item（不更新 created_at，由 timestamp-fix 命令统一管理）
      config.root_item = {
        ...config.root_item,
        completed_notes_count: completedNotesCount,
        updated_at: updatedAt,
      }

      // 删除旧字段（向后兼容）
      delete (config.root_item as any).completed_notes_count_last_month

      // 写入配置文件
      writeFileSync(ROOT_CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8')

      if (!this.quiet) {
        this.logger.success(
          `root_item 配置已更新: ${currentKey} 月完成 ${completedCount} 篇笔记`,
        )
      }
    } catch (error) {
      if (!this.quiet) {
        this.logger.error(
          `更新 root_item 失败: ${
            error instanceof Error ? error.message : String(error)
          }`,
        )
      }
      throw error
    }
  }
}
