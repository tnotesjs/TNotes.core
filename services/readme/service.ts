/**
 * .vitepress/tnotes/services/ReadmeService.ts
 *
 * README 服务 - 封装 README 更新相关的业务逻辑
 */
import {
  existsSync,
  readFileSync,
  writeFileSync,
  promises as fsPromises,
} from 'fs'

import { ConfigManager } from '../../config/ConfigManager'
import { ROOT_README_PATH, VP_SIDEBAR_PATH } from '../../config/constants'
import { NoteIndexCache } from '../../core/NoteIndexCache'
import { NoteManager } from '../../core/NoteManager'
import { ReadmeGenerator } from '../../core/ReadmeGenerator'
import {
  parseNoteLine,
  buildNoteLineMarkdown,
  logger,
  getChangedIds,
  genHierarchicalSidebar,
  processEmptyLines,
} from '../../utils'

import type { NoteInfo, NoteConfig } from '../../types'

/**
 * README 更新选项
 */
interface UpdateReadmeOptions {
  updateSidebar?: boolean
  updateHome?: boolean
  notes?: NoteInfo[]
}

interface GroupBlock {
  headingIndex: number
  endIndex: number
  level: number
}

type NoteInsertPlacement = 'before' | 'after'

interface MoveNoteOptions {
  targetGroupPath?: string[]
  targetNoteIndex?: string
  placement?: NoteInsertPlacement
}

/**
 * README 服务类（单例）
 */
export class ReadmeService {
  private static instance: ReadmeService
  private noteManager: NoteManager
  private readmeGenerator: ReadmeGenerator
  private configManager: ConfigManager
  private noteIndexCache: NoteIndexCache

  private constructor() {
    this.noteManager = NoteManager.getInstance()
    this.readmeGenerator = new ReadmeGenerator()
    this.configManager = ConfigManager.getInstance()
    this.noteIndexCache = NoteIndexCache.getInstance()
  }

  static getInstance(): ReadmeService {
    if (!ReadmeService.instance) {
      ReadmeService.instance = new ReadmeService()
    }
    return ReadmeService.instance
  }

  /**
   * 更新所有笔记的 README
   * @param options - 更新选项
   */
  async updateAllReadmes(options: UpdateReadmeOptions = {}): Promise<void> {
    const {
      updateSidebar = true,
      updateHome = true,
      notes: providedNotes,
    } = options

    logger.info('开始更新知识库...')

    // 使用传入的笔记列表或重新扫描
    const notes = providedNotes ?? this.noteManager.scanNotes()
    logger.info(`扫描到 ${notes.length} 篇笔记`)

    // 检测变更的笔记（增量更新优化）
    const changedIndexes = await this.getChangedNoteIndexes()
    const shouldIncrementalUpdate =
      changedIndexes.size > 0 && changedIndexes.size < notes.length * 0.3 // 少于30%变更才增量更新

    let notesToUpdate = notes
    if (shouldIncrementalUpdate) {
      notesToUpdate = notes.filter((note) => changedIndexes.has(note.index))
      logger.info(
        `检测到 ${changedIndexes.size} 篇笔记有变更，使用增量更新模式`,
      )
    } else {
      logger.info('使用全量更新模式')
    }

    // 并行更新笔记的 README
    const startTime = Date.now()
    await this.updateNoteReadmesInParallel(notesToUpdate)
    const updateTime = Date.now() - startTime

    logger.info(`更新了 ${notesToUpdate.length} 篇笔记 (耗时 ${updateTime}ms)`)

    // 更新首页 README（必须先更新，因为侧边目录 sidebar.json 数据是通过解析 README 中的内容来生成的）
    if (updateHome) {
      await this.updateHomeReadme(notes)
    }

    // 更新侧边栏配置（必须在 README 更新后执行）
    if (updateSidebar) {
      await this.updateSidebar(notes)
    }

    logger.info('知识库更新完成！')
  }

  /**
   * 只更新指定笔记的 README（不更新 sidebar、home）
   * @param noteIndexes - 笔记索引数组，例如 ['0001', '0002']
   */
  async updateNoteReadmesOnly(noteIndexes: string[]): Promise<void> {
    if (noteIndexes.length === 0) return

    // 直接根据 ID 获取笔记信息，避免扫描所有笔记
    const notesToUpdate: NoteInfo[] = []

    for (const noteIndex of noteIndexes) {
      const note = this.noteManager.getNoteByIndex(noteIndex)
      if (note) {
        notesToUpdate.push(note)
      } else {
        logger.warn(`笔记未找到: ${noteIndex}`)
      }
    }

    if (notesToUpdate.length === 0) {
      logger.warn('没有找到需要更新的笔记')
      return
    }

    // 只更新笔记的 README 内容（TOC 等）
    for (const note of notesToUpdate) {
      try {
        this.readmeGenerator.updateNoteReadme(note)
      } catch (error) {
        logger.error(`更新笔记 ${note.dirName} 失败`, error)
      }
    }
  }

  /**
   * 获取变更的笔记索引集合
   * @returns 变更的笔记索引集合
   */
  private async getChangedNoteIndexes(): Promise<Set<string>> {
    try {
      return getChangedIds()
    } catch (error) {
      // 如果获取失败（比如不在 Git 仓库中），返回空集合，触发全量更新
      return new Set()
    }
  }

  /**
   * 并行更新多个笔记的 README
   * @param notes - 笔记信息数组
   */
  private async updateNoteReadmesInParallel(notes: NoteInfo[]): Promise<void> {
    const batchSize = 10 // 每批处理 10 个，避免过多并发
    const batches: NoteInfo[][] = []

    for (let i = 0; i < notes.length; i += batchSize) {
      batches.push(notes.slice(i, i + batchSize))
    }

    let successCount = 0
    let failCount = 0

    for (const batch of batches) {
      const results = await Promise.allSettled(
        batch.map((note) =>
          Promise.resolve().then(() => {
            this.readmeGenerator.updateNoteReadme(note)
          }),
        ),
      )

      for (const result of results) {
        if (result.status === 'fulfilled') {
          successCount++
        } else {
          failCount++
          logger.error('更新笔记失败', result.reason)
        }
      }
    }

    if (failCount > 0) {
      logger.warn(`更新完成：成功 ${successCount} 篇，失败 ${failCount} 篇`)
    }
  }

  /**
   * 更新侧边栏配置
   * @param notes - 笔记信息数组
   */
  private async updateSidebar(notes: NoteInfo[]): Promise<void> {
    // 读取 README.md 解析层次结构
    if (!existsSync(ROOT_README_PATH)) {
      logger.error('未找到首页 README，无法生成侧边栏')
      return
    }

    const content = readFileSync(ROOT_README_PATH, 'utf-8')
    const lines = content.split('\n')

    // 解析 README.md 的层次结构

    const itemList: Array<{ text: string; link: string }> = []
    const titles: string[] = []
    const titlesNotesCount: number[] = []

    let currentNoteCount = 0
    let inTocRegion = false

    for (const line of lines) {
      // 跳过 toc region
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

      // 匹配笔记链接: - [x] [0001. xxx](https://github.com/...)
      const parsed = parseNoteLine(line)
      if (parsed.isMatch && parsed.noteIndex) {
        // 通过笔记索引查找对应的笔记信息
        const note = notes.find((n) => n.index === parsed.noteIndex)
        if (!note) {
          logger.warn(`未找到笔记索引: ${parsed.noteIndex}`)
          continue
        }

        // 获取笔记配置，添加状态 emoji
        let statusEmoji = '⏰ ' // 默认未完成
        if (note?.config) {
          if (note.config.done) {
            statusEmoji = '✅ '
          }
        }

        // 处理笔记 ID 显示
        const sidebarShowNoteId = this.configManager.get('sidebarShowNoteId')
        let displayText = note.dirName
        if (!sidebarShowNoteId) {
          // 移除笔记 ID (0001. )
          displayText = note.dirName.replace(/^\d{4}\.\s/, '')
        }

        itemList.push({
          text: statusEmoji + displayText,
          link: `/notes/${note.dirName}/README`,
        })
        currentNoteCount++
        continue
      }

      // 匹配标题: ## xxx
      const titleMatch = line.match(/^(#{2,})\s+(.+)$/)
      if (titleMatch) {
        // 保存上一个标题的笔记数量
        if (titles.length > 0) {
          titlesNotesCount.push(currentNoteCount)
        }

        titles.push(line)
        currentNoteCount = 0
      }
    }

    // 保存最后一个标题的笔记数量
    if (titles.length > 0) {
      titlesNotesCount.push(currentNoteCount)
    }

    // Sidebar 默认全部折叠
    const sidebarIsCollapsed = true
    const hierarchicalSidebar = genHierarchicalSidebar(
      itemList,
      titles,
      titlesNotesCount,
      sidebarIsCollapsed,
    )

    // 写入 sidebar.json
    writeFileSync(
      VP_SIDEBAR_PATH,
      JSON.stringify(hierarchicalSidebar, null, 2),
      'utf-8',
    )

    logger.info('已更新侧边栏配置')
  }

  /**
   * 更新首页 README
   * @param notes - 笔记信息数组
   */
  private async updateHomeReadme(notes: NoteInfo[]): Promise<void> {
    this.readmeGenerator.updateHomeReadme(notes, ROOT_README_PATH)
  }

  /**
   * 增量更新首页 README 中的单个笔记
   * @param noteIndex - 笔记索引
   * @param updates - 需要更新的配置字段
   */
  async updateNoteInReadme(
    noteIndex: string,
    updates: Partial<NoteConfig>,
  ): Promise<void> {
    const item = this.noteIndexCache.getByNoteIndex(noteIndex)
    if (!item) {
      logger.warn(`尝试更新不存在的笔记: ${noteIndex}`)
      return
    }

    // 读取 README.md
    const content = await fsPromises.readFile(ROOT_README_PATH, 'utf-8')
    const lines = content.split('\n')
    const repoOwner = this.configManager.get('author')
    const repoName = this.configManager.get('repoName')

    // 合并缓存配置和传入的更新
    const mergedConfig = { ...item.noteConfig, ...updates }

    // 构建一个临时的 NoteInfo 对象用于生成 markdown
    const tempNoteInfo: NoteInfo = {
      index: noteIndex,
      dirName: item.folderName,
      path: '',
      readmePath: '',
      configPath: '',
      config: mergedConfig,
    }

    let updated = false

    // 遍历所有行，更新所有引用该笔记的地方
    for (let i = 0; i < lines.length; i++) {
      const parsed = parseNoteLine(lines[i])
      if (parsed.noteIndex === noteIndex) {
        lines[i] = buildNoteLineMarkdown(tempNoteInfo, repoOwner, repoName)
        updated = true
      }
    }

    if (updated) {
      await fsPromises.writeFile(ROOT_README_PATH, lines.join('\n'), 'utf-8')
      logger.info(`增量更新 README.md 中的笔记: ${noteIndex}`)
    } else {
      logger.warn(`README.md 中未找到笔记: ${noteIndex}`)
    }
  }

  /**
   * 从首页 README 中删除笔记
   * @param noteIndex - 笔记索引
   */
  async deleteNoteFromReadme(noteIndex: string): Promise<void> {
    const content = await fsPromises.readFile(ROOT_README_PATH, 'utf-8')
    const lines = content.split('\n')
    const linesToRemove: number[] = []

    // 查找所有引用该笔记的行
    for (let i = 0; i < lines.length; i++) {
      const parsed = parseNoteLine(lines[i])
      if (parsed.noteIndex === noteIndex) {
        linesToRemove.push(i)
      }
    }

    if (linesToRemove.length > 0) {
      // 从后往前删除，避免索引问题
      for (let i = linesToRemove.length - 1; i >= 0; i--) {
        lines.splice(linesToRemove[i], 1)
      }

      await fsPromises.writeFile(ROOT_README_PATH, lines.join('\n'), 'utf-8')
      logger.info(
        `从 README.md 中删除笔记: ${noteIndex} (${linesToRemove.length} 处引用)`,
      )
    } else {
      logger.warn(`README.md 中未找到笔记: ${noteIndex}`)
    }
  }

  /**
   * 在首页 README 末尾添加新笔记
   * @param noteIndex - 笔记索引
   */
  async appendNoteToReadme(noteIndex: string): Promise<void> {
    const item = this.noteIndexCache.getByNoteIndex(noteIndex)
    if (!item) {
      logger.warn(`尝试添加不存在的笔记: ${noteIndex}`)
      return
    }

    const content = await fsPromises.readFile(ROOT_README_PATH, 'utf-8')
    const lines = content.split('\n')
    const repoOwner = this.configManager.get('author')
    const repoName = this.configManager.get('repoName')

    // 构建临时 NoteInfo
    const tempNoteInfo: NoteInfo = {
      index: noteIndex,
      dirName: item.folderName,
      path: '',
      readmePath: '',
      configPath: '',
      config: item.noteConfig,
    }

    // 在末尾添加笔记行
    const noteLine = buildNoteLineMarkdown(tempNoteInfo, repoOwner, repoName)
    lines.push(noteLine)

    await fsPromises.writeFile(ROOT_README_PATH, lines.join('\n'), 'utf-8')
    logger.info(`在 README.md 末尾添加笔记: ${noteIndex}`)
  }

  /**
   * 重命名根 README 中的目录标题
   */
  async renameGroupInReadme(
    groupPath: string[],
    newTitle: string,
  ): Promise<void> {
    this.assertGroupPath(groupPath)
    const cleanTitle = this.cleanHeadingTitle(newTitle)

    const lines = await this.readHomeReadmeLines()
    const block = this.findGroupBlock(lines, groupPath)
    const headingMark = '#'.repeat(block.level)
    lines[block.headingIndex] = `${headingMark} ${cleanTitle}`

    await this.writeHomeReadmeLines(lines)
    logger.info(`重命名目录: ${groupPath.join(' / ')} -> ${cleanTitle}`)
  }

  /**
   * 删除根 README 中的目录块，返回块内所有笔记编号
   */
  async deleteGroupFromReadme(groupPath: string[]): Promise<string[]> {
    this.assertGroupPath(groupPath)

    const lines = await this.readHomeReadmeLines()
    const block = this.findGroupBlock(lines, groupPath)
    const noteIndexes = this.collectNoteIndexes(
      lines,
      block.headingIndex,
      block.endIndex,
    )

    lines.splice(block.headingIndex, block.endIndex - block.headingIndex)
    await this.writeHomeReadmeLines(lines)

    logger.info(
      `删除目录: ${groupPath.join(' / ')} (${noteIndexes.length} 篇笔记)`,
    )

    return noteIndexes
  }

  /**
   * 在目录开头插入笔记链接
   */
  async insertNotesAtGroupStart(
    groupPath: string[],
    notes: NoteInfo[],
  ): Promise<void> {
    this.assertGroupPath(groupPath)
    if (notes.length === 0) return

    const lines = await this.readHomeReadmeLines()
    const block = this.findGroupBlock(lines, groupPath)
    const noteLines = this.buildNoteLines(notes)
    let insertIndex = block.headingIndex + 1

    while (insertIndex < block.endIndex && lines[insertIndex].trim() === '') {
      insertIndex++
    }

    lines.splice(insertIndex, 0, ...noteLines)
    await this.writeHomeReadmeLines(lines)

    logger.info(
      `在目录开头插入笔记: ${groupPath.join(' / ')} (${notes.length} 篇)`,
    )
  }

  /**
   * 在指定笔记上方或下方插入笔记链接
   */
  async insertNotesAroundNote(
    targetNoteIndex: string,
    notes: NoteInfo[],
    placement: NoteInsertPlacement,
  ): Promise<void> {
    if (notes.length === 0) return

    const lines = await this.readHomeReadmeLines()
    const noteLineIndex = this.findNoteLineIndex(lines, targetNoteIndex)
    const insertIndex =
      placement === 'before' ? noteLineIndex : noteLineIndex + 1
    const noteLines = this.buildNoteLines(notes)

    lines.splice(insertIndex, 0, ...noteLines)
    await this.writeHomeReadmeLines(lines)

    logger.info(
      `在笔记 ${targetNoteIndex} ${placement === 'before' ? '上方' : '下方'}插入 ${notes.length} 篇笔记`,
    )
  }

  /**
   * 移动笔记引用到目录开头，或移动到另一篇笔记前后
   */
  async moveNoteInReadme(
    noteIndex: string,
    options: MoveNoteOptions,
  ): Promise<void> {
    const lines = await this.readHomeReadmeLines()
    const sourceIndex = this.findNoteLineIndex(lines, noteIndex)
    const [noteLine] = lines.splice(sourceIndex, 1)

    if (options.targetGroupPath) {
      const block = this.findGroupBlock(lines, options.targetGroupPath)
      let insertIndex = block.headingIndex + 1

      while (insertIndex < block.endIndex && lines[insertIndex].trim() === '') {
        insertIndex++
      }

      lines.splice(insertIndex, 0, noteLine)
      await this.writeHomeReadmeLines(lines)
      return
    }

    if (!options.targetNoteIndex) {
      throw new Error('缺少目标笔记或目标目录')
    }
    if (options.targetNoteIndex === noteIndex) {
      throw new Error('不能把笔记移动到自身附近')
    }

    const targetIndex = this.findNoteLineIndex(lines, options.targetNoteIndex)
    const insertIndex =
      options.placement === 'after' ? targetIndex + 1 : targetIndex
    lines.splice(insertIndex, 0, noteLine)
    await this.writeHomeReadmeLines(lines)
  }

  /**
   * 移动目录块到同级目录前后
   */
  async moveGroupInReadme(
    groupPath: string[],
    targetGroupPath: string[],
    placement: NoteInsertPlacement = 'before',
  ): Promise<void> {
    this.assertGroupPath(groupPath)
    this.assertGroupPath(targetGroupPath)

    if (this.isSamePath(groupPath, targetGroupPath)) {
      throw new Error('不能把目录移动到自身附近')
    }
    if (groupPath.length !== targetGroupPath.length) {
      throw new Error('第一版拖拽仅支持同级目录排序')
    }

    const lines = await this.readHomeReadmeLines()
    const sourceBlock = this.findGroupBlock(lines, groupPath)
    const movingLines = lines.splice(
      sourceBlock.headingIndex,
      sourceBlock.endIndex - sourceBlock.headingIndex,
    )
    const targetBlock = this.findGroupBlock(lines, targetGroupPath)
    const insertIndex =
      placement === 'after' ? targetBlock.endIndex : targetBlock.headingIndex

    lines.splice(insertIndex, 0, ...movingLines)
    await this.writeHomeReadmeLines(lines)
  }

  /**
   * 更新根 README 和 sidebar，不重写每篇笔记 README
   */
  async refreshHomeReadmeAndSidebar(notes?: NoteInfo[]): Promise<void> {
    const allNotes =
      notes ??
      (this.noteIndexCache.isInitialized()
        ? this.noteIndexCache.toNoteInfoList()
        : this.noteManager.scanNotes())

    await this.updateHomeReadme(allNotes)
    await this.updateSidebar(allNotes)
  }

  /**
   * 重新生成 sidebar.json（基于当前 README.md）
   * @param notes - 可选的笔记列表，不传则内部扫描
   */
  async regenerateSidebar(notes?: NoteInfo[]): Promise<void> {
    const allNotes =
      notes ??
      (this.noteIndexCache.isInitialized()
        ? this.noteIndexCache.toNoteInfoList()
        : this.noteManager.scanNotes())
    await this.updateSidebar(allNotes)
    logger.info('重新生成 sidebar.json')
  }

  private async readHomeReadmeLines(): Promise<string[]> {
    const content = await fsPromises.readFile(ROOT_README_PATH, 'utf-8')
    return content.split('\n')
  }

  private async writeHomeReadmeLines(lines: string[]): Promise<void> {
    const content = processEmptyLines(lines).join('\n')
    await fsPromises.writeFile(ROOT_README_PATH, content, 'utf-8')
  }

  private assertGroupPath(groupPath: string[]): void {
    if (!Array.isArray(groupPath) || groupPath.length === 0) {
      throw new Error('目录路径不能为空')
    }
  }

  private cleanHeadingTitle(title: string): string {
    const cleanTitle = title.trim().replace(/^#+\s*/, '')
    if (!cleanTitle) {
      throw new Error('目录名称不能为空')
    }
    if (/\r|\n/.test(cleanTitle)) {
      throw new Error('目录名称不能包含换行')
    }
    return cleanTitle
  }

  private getHeadingInfo(line: string): { level: number; text: string } | null {
    const match = line.match(/^(#{2,})\s+(.+)$/)
    if (!match) return null

    return {
      level: match[1].length,
      text: match[2].trim(),
    }
  }

  private findGroupBlock(lines: string[], groupPath: string[]): GroupBlock {
    const stack: Array<{ level: number; text: string }> = []

    for (let i = 0; i < lines.length; i++) {
      const heading = this.getHeadingInfo(lines[i])
      if (!heading) continue

      while (
        stack.length > 0 &&
        stack[stack.length - 1].level >= heading.level
      ) {
        stack.pop()
      }

      stack.push(heading)

      const currentPath = stack.map((item) => item.text)
      if (this.isSamePath(currentPath, groupPath)) {
        return {
          headingIndex: i,
          endIndex: this.findGroupEndIndex(lines, i, heading.level),
          level: heading.level,
        }
      }
    }

    throw new Error(`未找到目录: ${groupPath.join(' / ')}`)
  }

  private findGroupEndIndex(
    lines: string[],
    headingIndex: number,
    level: number,
  ): number {
    for (let i = headingIndex + 1; i < lines.length; i++) {
      const heading = this.getHeadingInfo(lines[i])
      if (heading && heading.level <= level) {
        return i
      }
    }

    return lines.length
  }

  private isSamePath(left: string[], right: string[]): boolean {
    if (left.length !== right.length) return false

    return left.every((item, index) => item === right[index])
  }

  private collectNoteIndexes(
    lines: string[],
    startIndex: number,
    endIndex: number,
  ): string[] {
    const noteIndexes: string[] = []

    for (let i = startIndex; i < endIndex; i++) {
      const parsed = parseNoteLine(lines[i])
      if (parsed.noteIndex) {
        noteIndexes.push(parsed.noteIndex)
      }
    }

    return [...new Set(noteIndexes)]
  }

  private findNoteLineIndex(lines: string[], noteIndex: string): number {
    for (let i = 0; i < lines.length; i++) {
      const parsed = parseNoteLine(lines[i])
      if (parsed.noteIndex === noteIndex) {
        return i
      }
    }

    throw new Error(`README.md 中未找到笔记: ${noteIndex}`)
  }

  private buildNoteLines(notes: NoteInfo[]): string[] {
    const repoOwner = this.configManager.get('author')
    const repoName = this.configManager.get('repoName')
    return notes.map((note) => buildNoteLineMarkdown(note, repoOwner, repoName))
  }
}
