/**
 * .vitepress/tnotes/core/ReadmeGenerator.ts
 *
 * README 生成器 - 负责生成各种 README 内容
 */
import { readFileSync, writeFileSync, existsSync } from 'fs'
import type { NoteInfo } from '../types'
import { TocGenerator } from './TocGenerator'
import { ConfigManager } from '../config/ConfigManager'
import {
  logger,
  parseNoteLine,
  buildNoteLineMarkdown,
  processEmptyLines,
} from '../utils'
import { createAddNumberToTitle } from '../utils'
import { EOL } from '../config/constants'

/**
 * README 生成器类
 */
export class ReadmeGenerator {
  private tocGenerator: TocGenerator
  private configManager: ConfigManager

  constructor() {
    this.tocGenerator = new TocGenerator()
    this.configManager = ConfigManager.getInstance()
  }

  /**
   * 更新笔记 README
   * @param noteInfo - 笔记信息
   */
  updateNoteReadme(noteInfo: NoteInfo): void {
    if (!noteInfo.config) {
      logger.warn(`笔记 ${noteInfo.dirName} 缺少配置文件`)
      return
    }

    const content = readFileSync(noteInfo.readmePath, 'utf-8')
    const lines = content.split(EOL)

    const repoName = this.configManager.get('repoName')
    this.tocGenerator.updateNoteToc(
      noteInfo.index,
      lines,
      noteInfo.config,
      repoName,
    )

    const updatedContent = lines.join(EOL)
    writeFileSync(noteInfo.readmePath, updatedContent, 'utf-8')
  }

  /**
   * 更新首页 README
   * 更新笔记链接的状态标记（[x] 或 [ ]），同时更新 TOC 区域
   * @param notes - 笔记信息数组
   * @param homeReadmePath - 首页 README 路径
   */
  updateHomeReadme(notes: NoteInfo[], homeReadmePath: string): void {
    if (!existsSync(homeReadmePath)) {
      logger.error(`根目录下的 README.md 文件未找到：${homeReadmePath}`)
      return
    }

    const content = readFileSync(homeReadmePath, 'utf-8')
    const lines = content.split(EOL)

    // 创建笔记配置映射，以笔记索引为键
    const noteByIndexMap = new Map<string, NoteInfo>()
    for (const note of notes) {
      noteByIndexMap.set(note.index, note)
    }

    // 获取仓库信息
    const repoOwner = this.configManager.get('author')
    const repoName = this.configManager.get('repoName')

    // 跟踪已存在的笔记索引和要移除的行
    const existingNoteIndexes = new Set<string>()
    const linesToRemove = new Set<number>()

    // 更新笔记链接的状态标记
    const titles: string[] = []
    const titlesNotesCount: number[] = []
    let inTocRegion = false
    let currentNoteCount = 0

    // 标题编号器（用于自动更新二级和三级标题前边儿的编号）
    const addNumberToTitle = createAddNumberToTitle()
    const numberedHeaders = ['## ', '### ']

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      // 跳过 TOC region (后面会重新生成)
      if (line.includes('<!-- region:toc -->')) {
        inTocRegion = true
        continue
      }
      if (line.includes('<!-- endregion:toc -->')) {
        inTocRegion = false
        continue
      }
      if (inTocRegion) {
        continue
      }

      // 使用公共方法解析笔记链接
      const parsed = parseNoteLine(line)
      if (parsed.isMatch && parsed.noteIndex) {
        const note = noteByIndexMap.get(parsed.noteIndex)

        if (!note) {
          // 笔记不存在，标记为移除
          linesToRemove.add(i)
          logger.warn(`移除不存在的笔记: ${parsed.noteIndex}`)
          continue
        }

        existingNoteIndexes.add(parsed.noteIndex)
        lines[i] = buildNoteLineMarkdown(note, repoOwner, repoName)
        currentNoteCount++
        continue
      }

      // 匹配标题: ## xxx 或 ### xxx
      const titleMatch = line.match(/^(#{2,})\s+(.+)$/)
      if (titleMatch) {
        // 检查是否是需要编号的标题（2~3 级）
        const isNumberedHeader = numberedHeaders.some((header) =>
          line.startsWith(header),
        )

        if (isNumberedHeader) {
          // 自动添加编号
          const [numberedTitle] = addNumberToTitle(line)
          lines[i] = numberedTitle

          // 保存上一个标题的笔记数量
          if (titles.length > 0) {
            titlesNotesCount.push(currentNoteCount)
          }

          titles.push(numberedTitle)
          currentNoteCount = 0
        } else {
          // 其他级别的标题，不添加编号
          // 保存上一个标题的笔记数量
          if (titles.length > 0) {
            titlesNotesCount.push(currentNoteCount)
          }

          titles.push(line)
          currentNoteCount = 0
        }
      }
    }

    // 移除不存在的笔记（从后往前删除，避免索引问题）
    const sortedLinesToRemove = Array.from(linesToRemove).sort((a, b) => b - a)
    for (const lineIndex of sortedLinesToRemove) {
      lines.splice(lineIndex, 1)
      if (currentNoteCount > 0) {
        currentNoteCount--
      }
    }

    // 查找缺失的笔记（在真实目录中存在但 README 中不存在）
    const missingNotes: NoteInfo[] = []
    for (const note of notes) {
      if (!existingNoteIndexes.has(note.index)) {
        missingNotes.push(note)
      }
    }

    // 将缺失的笔记添加到结尾
    if (missingNotes.length > 0) {
      logger.info(`添加 ${missingNotes.length} 篇缺失的笔记到 README`)

      // 按笔记索引排序
      missingNotes.sort((a, b) => a.index.localeCompare(b.index))

      for (const note of missingNotes) {
        const noteLine = buildNoteLineMarkdown(note, repoOwner, repoName)
        lines.push(noteLine)
        currentNoteCount++
      }
    }

    // 保存最后一个标题的笔记数量
    if (titles.length > 0) {
      titlesNotesCount.push(currentNoteCount)
    }

    // 更新 TOC 区域
    this.tocGenerator.updateHomeToc(lines, titles, titlesNotesCount)

    const processedLines = processEmptyLines(lines)

    const updatedContent = processedLines.join(EOL)
    writeFileSync(homeReadmePath, updatedContent, 'utf-8')

    logger.info('已更新首页 README')
  }
}
