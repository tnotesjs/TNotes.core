/**
 * .vitepress/tnotes/services/NoteService.ts
 *
 * 笔记服务 - 封装笔记相关的业务逻辑
 */
import { writeFileSync, readFileSync } from 'fs'
import { join } from 'path'
import { v4 as uuidv4 } from 'uuid'
import type { NoteInfo, NoteConfig } from '../../types'
import { NoteManager } from '../../core/NoteManager'
import { NoteIndexCache } from '../../core/NoteIndexCache'
import { generateNoteTitle } from '../../config/templates'
import { NOTES_PATH, CONSTANTS, REPO_NOTES_URL } from '../../config/constants'
import { ReadmeService } from '../readme/service'
import { ensureDirectory, logger, writeNoteConfig } from '../../utils'

/**
 * 新增笔记 README.md 模板
 *
 * 不包含一级标题（# 笔记编号. 笔记名称），由 createNote 动态生成
 */
const NEW_NOTES_README_MD_TEMPLATE = `
<!-- region:toc -->

- [1. 🎯 本节内容](#1--本节内容)
- [2. 🫧 评价](#2--评价)

<!-- endregion:toc -->

## 1. 🎯 本节内容

- todo

## 2. 🫧 评价

- todo
`

/**
 * 创建新笔记的选项
 */
interface CreateNoteOptions {
  title?: string
  category?: string
  enableDiscussions?: boolean
  configId?: string // 配置文件中的 UUID（跨所有知识库唯一）
  usedIndexes?: Set<number> // 可选的已使用编号集合，用于批量创建时避免重复扫描
}

/**
 * 笔记服务类
 */
export class NoteService {
  private static instance: NoteService

  private noteManager: NoteManager
  private noteIndexCache: NoteIndexCache
  private ignoredConfigPaths: Set<string> = new Set()

  private constructor() {
    this.noteManager = NoteManager.getInstance()
    this.noteIndexCache = NoteIndexCache.getInstance()
  }

  static getInstance(): NoteService {
    if (!NoteService.instance) {
      NoteService.instance = new NoteService()
    }
    return NoteService.instance
  }

  /**
   * 标记配置文件在下次变更时被忽略（防止 API 写入触发文件监听循环）
   * @param configPath - 配置文件路径
   */
  ignoreNextConfigChange(configPath: string): void {
    this.ignoredConfigPaths.add(configPath)
  }

  /**
   * 检查配置文件是否应该被忽略
   * @param configPath - 配置文件路径
   * @returns 是否应该忽略
   */
  shouldIgnoreConfigChange(configPath: string): boolean {
    if (this.ignoredConfigPaths.has(configPath)) {
      this.ignoredConfigPaths.delete(configPath)
      return true
    }
    return false
  }

  /**
   * 获取所有笔记
   * dev 模式下（缓存已初始化）从内存读取，其他模式回退到文件扫描
   * @returns 笔记信息数组
   */
  getAllNotes(): NoteInfo[] {
    if (this.noteIndexCache.isInitialized()) {
      return this.noteIndexCache.toNoteInfoList()
    }
    return this.noteManager.scanNotes()
  }

  /**
   * 获取笔记（通过索引）
   * @param noteIndex - 笔记索引（文件夹前 4 位数字）
   * @returns 笔记信息，未找到时返回 undefined
   */
  getNoteByIndex(noteIndex: string): NoteInfo | undefined {
    return this.noteManager.getNoteByIndex(noteIndex)
  }

  /**
   * 创建新笔记
   * @param options - 创建选项
   * @returns 新创建的笔记信息
   */
  async createNote(options: CreateNoteOptions = {}): Promise<NoteInfo> {
    const {
      title = 'new',
      category,
      enableDiscussions = false,
      configId,
      usedIndexes,
    } = options

    // 生成笔记索引（填充空缺）
    const noteIndex = this.generateNextNoteIndex(usedIndexes)
    const dirName = `${noteIndex}. ${title}`
    const notePath = join(NOTES_PATH, dirName)

    // 确保目录存在
    await ensureDirectory(notePath)

    // 创建 README.md（包含一级标题）
    const readmePath = join(notePath, 'README.md')
    const noteTitle = generateNoteTitle(noteIndex, title, REPO_NOTES_URL)
    const readmeContent = noteTitle + '\n' + NEW_NOTES_README_MD_TEMPLATE
    writeFileSync(readmePath, readmeContent, 'utf-8')

    // 创建 .tnotes.json（使用 UUID 作为配置 ID）
    const configPath = join(notePath, '.tnotes.json')
    const now = Date.now()
    const config: NoteConfig = {
      id: configId || uuidv4(), // 配置 ID 使用 UUID（跨知识库唯一）
      bilibili: [],
      tnotes: [],
      yuque: [],
      done: false,
      category,
      enableDiscussions,
      created_at: now,
      updated_at: now,
    }
    writeNoteConfig(configPath, config)

    logger.info(`Created new note: ${dirName}`)

    return {
      index: noteIndex, // 返回的 id 是笔记索引（目录前缀）
      path: notePath,
      dirName,
      readmePath,
      configPath,
      config,
    }
  }

  /**
   * 生成下一个笔记索引（填充空缺）
   * @param usedIndexes - 可选的已使用编号集合，不传则内部扫描
   * @returns 新的笔记索引（4位数字字符串，从 0001 到 9999）
   */
  private generateNextNoteIndex(usedIndexes?: Set<number>): string {
    if (!usedIndexes) {
      const notes = this.getAllNotes()
      usedIndexes = new Set<number>()
      for (const note of notes) {
        const id = parseInt(note.index, 10)
        if (!isNaN(id) && id >= 1 && id <= 9999) {
          usedIndexes.add(id)
        }
      }
    }

    if (usedIndexes.size === 0) {
      return '0001'
    }

    // 从 1 开始查找第一个未使用的编号
    for (let i = 1; i <= 9999; i++) {
      if (!usedIndexes.has(i)) {
        return i.toString().padStart(CONSTANTS.NOTE_INDEX_LENGTH, '0')
      }
    }

    // 如果所有编号都被占用（极端情况）
    throw new Error('所有笔记编号 (0001-9999) 已被占用，无法创建新笔记')
  }

  /**
   * 更新笔记配置
   * @param noteIndex - 笔记索引
   * @param updates - 配置更新
   */
  async updateNoteConfig(
    noteIndex: string,
    updates: Partial<NoteConfig>,
  ): Promise<void> {
    const note = this.getNoteByIndex(noteIndex)
    if (!note || !note.config) {
      throw new Error(`Note not found or no config: ${noteIndex}`)
    }

    const oldConfig = { ...note.config }
    const updatedConfig: NoteConfig = {
      ...note.config,
      ...updates,
      updated_at: Date.now(),
    }

    // 标记配置文件为忽略（防止文件监听触发循环更新）
    this.ignoreNextConfigChange(note.configPath)

    // 更新笔记配置文件
    this.noteManager.updateNoteConfig(note, updatedConfig)

    // 更新内存索引
    this.noteIndexCache.updateConfig(noteIndex, updatedConfig)

    // 检查是否需要更新全局文件
    const needsGlobalUpdate = this.checkNeedsGlobalUpdate(
      oldConfig,
      updatedConfig,
    )

    if (needsGlobalUpdate) {
      logger.info(`检测到全局字段变更 (${noteIndex})，正在增量更新全局文件...`)

      // 使用增量更新
      const readmeService = ReadmeService.getInstance()

      // 增量更新 README.md 中的笔记
      await readmeService.updateNoteInReadme(noteIndex, updates)

      // 重新生成 sidebar.json（基于更新后的 README.md）
      await readmeService.regenerateSidebar()

      logger.info(`全局文件增量更新完成 (${noteIndex})`)
    } else {
      logger.debug(`配置更新不影响全局文件 (${noteIndex})`)
    }
  }

  /**
   * 检查配置更新是否需要触发全局更新
   * @param oldConfig - 旧配置
   * @param newConfig - 新配置
   * @returns 是否需要全局更新
   */
  private checkNeedsGlobalUpdate(
    oldConfig: NoteConfig,
    newConfig: NoteConfig,
  ): boolean {
    // 影响全局的字段：done
    const globalFields: (keyof NoteConfig)[] = ['done']

    for (const field of globalFields) {
      if (oldConfig[field] !== newConfig[field]) {
        return true
      }
    }

    return false
  }

  /**
   * 修正笔记标题
   * @param noteInfo - 笔记信息
   * @returns 是否进行了修正
   */
  async fixNoteTitle(noteInfo: NoteInfo): Promise<boolean> {
    try {
      const readmeContent = readFileSync(noteInfo.readmePath, 'utf-8')
      const lines = readmeContent.split('\n')

      // 提取目录名中的标题（去掉编号）
      const match = noteInfo.dirName.match(/^\d{4}\.\s+(.+)$/)
      if (!match) {
        logger.warn(`检测到错误的笔记目录名称：${noteInfo.dirName}`)
        return false
      }

      const expectedTitle = match[1]
      const expectedH1 = generateNoteTitle(
        noteInfo.index,
        expectedTitle,
        REPO_NOTES_URL,
      )

      // 检查第一行是否为一级标题
      const firstLine = lines[0].trim()

      if (!firstLine.startsWith('# ')) {
        // 缺少一级标题，在第一行插入
        lines.unshift(expectedH1)
        writeFileSync(noteInfo.readmePath, lines.join('\n'), 'utf-8')
        logger.info(`Added title to: ${noteInfo.dirName}`)
        return true
      }

      // 检查标题是否正确
      if (firstLine !== expectedH1) {
        // 标题不正确，替换第一行
        lines[0] = expectedH1
        writeFileSync(noteInfo.readmePath, lines.join('\n'), 'utf-8')
        logger.info(`Fixed title for: ${noteInfo.dirName}`)
        return true
      }

      return false
    } catch (error) {
      logger.error(`Failed to fix title for: ${noteInfo.dirName}`, error)
      return false
    }
  }

  /**
   * 修正所有笔记的标题
   * @param providedNotes - 可选的笔记列表，不传则内部扫描
   * @returns 修正的笔记数量
   */
  async fixAllNoteTitles(providedNotes?: NoteInfo[]): Promise<number> {
    const notes = providedNotes ?? this.getAllNotes()
    // logger.debug('打印前 3 篇笔记信息：', notes.slice(0, 3))
    let fixedCount = 0

    for (const note of notes) {
      const fixed = await this.fixNoteTitle(note)
      if (fixed) {
        fixedCount++
      }
    }

    if (fixedCount > 0) {
      logger.info(`Fixed ${fixedCount} note titles`)
    }

    return fixedCount
  }
}
