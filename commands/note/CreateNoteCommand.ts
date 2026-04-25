/**
 * .vitepress/tnotes/commands/note/CreateNoteCommand.ts
 *
 * 新建笔记命令 - 使用 NoteService（支持批量创建，生成全局唯一 ID）
 */

import { createInterface } from 'readline'
import { v4 as uuidv4 } from 'uuid'

import { NoteService, ReadmeService } from '../../services'
import { BaseCommand } from '../BaseCommand'

export class CreateNoteCommand extends BaseCommand {
  private noteService: NoteService
  private readmeService: ReadmeService

  constructor() {
    super('create-notes')
    this.noteService = NoteService.getInstance()
    this.readmeService = ReadmeService.getInstance()
  }

  protected async run(): Promise<void> {
    this.logger.info('创建新笔记...')

    // 提示用户输入要创建的笔记数量
    const count = await this.promptForCount()

    // 批量创建笔记
    let successCount = 0
    let failCount = 0
    const createdNotes: string[] = []

    // 预先扫描一次，构建已使用编号集合，避免循环内重复扫描
    const existingNotes = this.noteService.getAllNotes()
    const usedIndexes = new Set<number>()
    for (const note of existingNotes) {
      const index = parseInt(note.index, 10)
      if (!isNaN(index) && index >= 1 && index <= 9999) {
        usedIndexes.add(index)
      }
    }

    for (let i = 1; i <= count; i++) {
      try {
        // 为每篇笔记提示标题（如果是批量创建，使用默认标题）
        let title: string
        if (count === 1) {
          title = await this.promptForTitle()
        } else {
          title = `new`
          this.logger.info(`[${i}/${count}] 创建笔记: ${title}`)
        }

        // 生成全局唯一的 UUID 作为配置文件中的 id
        const configId = uuidv4()

        const note = await this.noteService.createNote({
          title: title || `new`,
          enableDiscussions: false,
          configId, // 传递 UUID 作为配置 ID（跨知识库唯一）
          usedIndexes, // 传入已使用编号集合，避免重复扫描
        })

        // 将新创建的笔记编号加入集合，确保后续创建不会冲突
        const newIndex = parseInt(note.index, 10)
        if (!isNaN(newIndex)) {
          usedIndexes.add(newIndex)
        }

        createdNotes.push(note.dirName)
        successCount++

        if (count === 1) {
          this.logger.success(`笔记创建成功: ${note.dirName}`)
          this.logger.info(`笔记路径: ${note.path}`)
          this.logger.info(`笔记编号: ${note.index}`)
          this.logger.info(`配置ID: ${configId}`)
        } else {
          this.logger.success(`[${i}/${count}] 创建成功: ${note.dirName}`)
        }
      } catch (error) {
        failCount++
        this.logger.error(`[${i}/${count}] 创建失败`, error)
      }
    }

    // 显示统计信息
    if (count > 1) {
      console.log('')
      this.logger.info(
        `📊 创建完成: 成功 ${successCount} 篇, 失败 ${failCount} 篇`,
      )
    }

    // 自动更新索引文件（home README、sidebar.json、TOC.md）
    if (successCount > 0) {
      this.logger.info('正在更新知识库索引...')
      await this.readmeService.updateAllReadmes()
      this.logger.success('知识库索引更新完成')
    }
  }

  /**
   * 提示用户输入要创建的笔记数量
   */
  private async promptForCount(): Promise<number> {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    })

    return new Promise((resolve) => {
      rl.question('\n📝 请输入要创建的笔记数量（默认为 1）: ', (answer) => {
        rl.close()

        // 解析输入
        const trimmed = answer.trim()

        // 如果输入为空，默认为 1
        if (!trimmed) {
          this.logger.info('使用默认数量: 1')
          resolve(1)
          return
        }

        // 尝试解析为数字
        const num = parseInt(trimmed, 10)

        // 如果不是正整数，视为 1
        if (isNaN(num) || num < 1 || !Number.isInteger(num)) {
          this.logger.warn(`输入 "${trimmed}" 不是有效的正整数，使用默认值: 1`)
          resolve(1)
          return
        }

        this.logger.info(`将创建 ${num} 篇笔记`)
        resolve(num)
      })
    })
  }

  /**
   * 提示用户输入笔记标题
   */
  private async promptForTitle(): Promise<string> {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    })

    return new Promise((resolve) => {
      rl.question('请输入笔记标题: ', (answer) => {
        rl.close()
        resolve(answer.trim())
      })
    })
  }
}
