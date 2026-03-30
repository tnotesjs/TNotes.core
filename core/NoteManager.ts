/**
 * .vitepress/tnotes/core/NoteManager.ts
 *
 * 笔记管理器 - 负责笔记的扫描、验证和基本操作
 */

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { NoteInfo, NoteConfig } from '../types'
import { NOTES_PATH } from '../config/constants'
import { logger } from '../utils'

/**
 * 笔记管理器类（单例）
 */
export class NoteManager {
  private static instance: NoteManager

  /** 笔记索引正则：4 位数字开头，后接小数点 */
  private static readonly NOTE_INDEX_REGEX = /^(\d{4})\./

  private constructor() {}

  /**
   * 从文件夹名称或文本中提取笔记索引
   *
   * @param text - 要解析的文本（通常是文件夹名称）
   * @returns 笔记索引（4 位数字字符串）或 null
   *
   * @example
   * NoteManager.extractNoteIndex('0001. TNotes 简介') // '0001'
   * NoteManager.extractNoteIndex('invalid-folder')     // null
   */
  static extractNoteIndex(text: string): string | null {
    const match = text.match(NoteManager.NOTE_INDEX_REGEX)
    return match ? match[1] : null
  }

  /**
   * 输出无效笔记名称的警告日志
   *
   * @param name - 无效的笔记名称
   */
  static warnInvalidNoteIndex(name: string): void {
    logger.warn(`无效的笔记名: ${name}`)
    logger.warn('笔记名必须以 4 个数字开头')
    logger.warn('范围：0001-9999')
  }

  static getInstance(): NoteManager {
    if (!NoteManager.instance) {
      NoteManager.instance = new NoteManager()
    }
    return NoteManager.instance
  }

  /**
   * 获取 notes 目录下所有合法的笔记目录名（已排序）
   * 合法条件：是目录、不以 . 开头、以 4 位数字 + . 开头
   */
  private getNoteDirs(): string[] {
    if (!existsSync(NOTES_PATH)) return []

    return readdirSync(NOTES_PATH, { withFileTypes: true })
      .filter(
        (entry) =>
          entry.isDirectory() &&
          !entry.name.startsWith('.') &&
          /^\d{4}\./.test(entry.name),
      )
      .map((entry) => entry.name)
      .sort()
  }

  /**
   * 根据目录名构建单条 NoteInfo
   * @returns NoteInfo 或 undefined（README 不存在时）
   */
  private buildNoteInfo(dirName: string): NoteInfo | undefined {
    const notePath = join(NOTES_PATH, dirName)
    const readmePath = join(notePath, 'README.md')
    const configPath = join(notePath, '.tnotes.json')

    if (!existsSync(readmePath)) {
      logger.warn(`README not found in note: ${dirName}`)
      return undefined
    }

    let config: NoteConfig | undefined
    if (existsSync(configPath)) {
      config = this.validateAndFixConfig(configPath) || undefined
    }

    return {
      index: this.getNoteIndexFromDir(dirName),
      path: notePath,
      dirName,
      readmePath,
      configPath,
      config,
    }
  }

  /**
   * 扫描所有笔记并校验数据完整性
   *
   * 校验内容：noteIndex 冲突、config id 缺失、config id 重复
   * 任一检查失败则终止进程
   *
   * @returns 笔记信息数组
   */
  scanNotes(): NoteInfo[] {
    const noteDirs = this.getNoteDirs()
    if (noteDirs.length === 0) {
      logger.warn(`Notes directory not found: ${NOTES_PATH}`)
      return []
    }

    const notes: NoteInfo[] = []
    for (const dirName of noteDirs) {
      const note = this.buildNoteInfo(dirName)
      if (note) notes.push(note)
    }

    this.validateNotes(notes)

    return notes
  }

  /**
   * 校验笔记数据完整性（noteIndex 冲突 + config id 缺失/重复）
   * 任一检查失败则终止进程
   */
  private validateNotes(notes: NoteInfo[]): void {
    const errors: string[] = []

    // 检查 noteIndex 冲突
    const indexMap = this.buildNoteIndexMap(notes.map((n) => n.dirName))
    for (const [index, dirNames] of indexMap.entries()) {
      if (dirNames.length > 1) {
        errors.push(`⚠️  检测到重复的笔记编号：`)
        errors.push(`   编号 ${index} 被以下笔记重复使用：`)
        dirNames.forEach((dirName) => errors.push(`      - ${dirName}`))
      }
    }

    // 检查 config id 缺失
    const missingConfigId: string[] = []
    for (const note of notes) {
      if (!note.config || !note.config.id) {
        missingConfigId.push(note.dirName)
      }
    }
    if (missingConfigId.length > 0) {
      errors.push(`⚠️  检测到笔记配置 ID 缺失：`)
      missingConfigId.forEach((dirName) => errors.push(`      - ${dirName}`))
    }

    // 检查 config id 重复
    const configIdMap = new Map<string, string[]>()
    for (const note of notes) {
      if (note.config?.id) {
        if (!configIdMap.has(note.config.id))
          configIdMap.set(note.config.id, [])
        configIdMap.get(note.config.id)!.push(note.dirName)
      }
    }
    for (const [configId, dirNames] of configIdMap.entries()) {
      if (dirNames.length > 1) {
        errors.push(`⚠️  检测到重复的笔记配置 ID：`)
        errors.push(`   配置 ID ${configId} 被以下笔记重复使用：`)
        dirNames.forEach((dirName) => errors.push(`      - ${dirName}`))
      }
    }

    if (errors.length > 0) {
      for (const line of errors) {
        logger.error(line)
      }
      logger.error('\n请修复上述问题后重新启动服务。\n')
      process.exit(1)
    }
  }

  /**
   * 按 4 位数字编号对目录名分组
   * @param dirNames - 目录名数组
   * @returns 编号 -> 目录名数组 的映射
   */
  private buildNoteIndexMap(dirNames: string[]): Map<string, string[]> {
    const indexMap = new Map<string, string[]>()
    for (const name of dirNames) {
      const index = name.slice(0, 4)
      if (!indexMap.has(index)) indexMap.set(index, [])
      indexMap.get(index)!.push(name)
    }
    return indexMap
  }

  /**
   * 从目录名提取笔记索引
   * @param dirName - 目录名
   * @returns 笔记索引
   */
  private getNoteIndexFromDir(dirName: string): string {
    return NoteManager.extractNoteIndex(dirName) || dirName
  }

  /** 配置字段顺序 */
  private static readonly FIELD_ORDER: readonly string[] = [
    'bilibili',
    'tnotes',
    'yuque',
    'done',
    'category',
    'enableDiscussions',
    'description',
    'id',
    'created_at',
    'updated_at',
  ]

  /** 默认配置字段 */
  private static readonly DEFAULT_CONFIG_FIELDS = {
    bilibili: [],
    tnotes: [],
    yuque: [],
    done: false,
    enableDiscussions: false,
    description: '',
  } as const

  /** 必需字段（不能缺失） */
  private static readonly REQUIRED_FIELDS = ['id'] as const

  /**
   * 验证并修复配置文件
   * @param configPath - 配置文件路径
   * @returns 修复后的配置对象，失败时返回 null
   */
  private validateAndFixConfig(configPath: string): NoteConfig | null {
    const configContent = readFileSync(configPath, 'utf-8')
    let config: Partial<NoteConfig>

    try {
      config = JSON.parse(configContent)
    } catch (error) {
      logger.error(`配置文件 JSON 解析失败: ${configPath}`, error)
      return null
    }

    let needsUpdate = false

    // 1. 检查必需字段 —— 缺失时直接返回 null，由 validateNotes() 统一报告
    for (const field of NoteManager.REQUIRED_FIELDS) {
      if (!config[field]) {
        return null
      }
    }

    // 2. 补充缺失的可选字段
    for (const [key, defaultValue] of Object.entries(
      NoteManager.DEFAULT_CONFIG_FIELDS,
    )) {
      if (!(key in config)) {
        ;(config as Record<string, unknown>)[key] = defaultValue
        needsUpdate = true
        logger.info(`补充缺失字段 "${key}": ${configPath}`)
      }
    }

    // 3. 确保时间戳字段存在
    // 这里仅用 Date.now() 占位，确保字段不缺失。
    // 真实的 git 时间戳由 tn:fix-timestamps 命令统一校准。
    const now = Date.now()
    if (!config.created_at) {
      config.created_at = now
      needsUpdate = true
      logger.info(
        `检测到 ${configPath} 缺失  created_at 字段，请执行 tn:fix-timestamps 校准为笔记首次 git commit 的时间）`,
      )
    }
    if (!config.updated_at) {
      config.updated_at = now
      needsUpdate = true
      logger.info(
        `检测到 ${configPath} 缺失  updated_at 字段，请执行 tn:fix-timestamps 校准为笔记最后一次 git commit 的时间）`,
      )
    }

    // 4. 按字段顺序排序
    const sortedConfig = this.sortConfigKeys(config as NoteConfig)

    // 5. 写回文件（如果有变更）
    if (needsUpdate) {
      this.writeNoteConfig(configPath, sortedConfig)
      logger.info(`配置文件已修复: ${configPath}`)
    }

    return sortedConfig
  }

  /**
   * 按指定顺序排序配置对象的键
   */
  private sortConfigKeys(config: NoteConfig): NoteConfig {
    const configRecord = config as unknown as Record<string, unknown>
    const sorted: Record<string, unknown> = {}

    for (const key of NoteManager.FIELD_ORDER) {
      if (key in config) {
        sorted[key] = configRecord[key]
      }
    }

    for (const key of Object.keys(config)) {
      if (!(key in sorted)) {
        sorted[key] = configRecord[key]
      }
    }

    return sorted as unknown as NoteConfig
  }

  /**
   * 序列化 NoteConfig 为格式化的 JSON 字符串
   * 保持字段顺序，使用 2 空格缩进，末尾含换行符
   */
  private serializeNoteConfig(config: NoteConfig): string {
    const sorted = this.sortConfigKeys(config)
    return JSON.stringify(sorted, null, 2) + '\n'
  }

  /**
   * 统一写入笔记配置文件
   * @param configPath - 配置文件路径
   * @param config - 笔记配置
   */
  writeNoteConfig(configPath: string, config: NoteConfig): void {
    writeFileSync(configPath, this.serializeNoteConfig(config), 'utf-8')
  }

  /**
   * 验证笔记配置对象的结构合法性
   * @param config - 笔记配置
   * @returns 是否有效
   */
  private validateConfig(config: NoteConfig): boolean {
    if (!config.id) {
      logger.error('Note config missing id')
      return false
    }

    if (!Array.isArray(config.bilibili)) {
      logger.error(`Invalid bilibili config in note: ${config.id}`)
      return false
    }

    if (!Array.isArray(config.tnotes)) {
      logger.error(`Invalid tnotes config in note: ${config.id}`)
      return false
    }

    if (!Array.isArray(config.yuque)) {
      logger.error(`Invalid yuque config in note: ${config.id}`)
      return false
    }

    if (typeof config.done !== 'boolean') {
      logger.error(`Invalid done status in note: ${config.id}`)
      return false
    }

    if (typeof config.enableDiscussions !== 'boolean') {
      logger.error(`Invalid enableDiscussions status in note: ${config.id}`)
      return false
    }

    return true
  }

  /**
   * 更新笔记配置
   * @param noteInfo - 笔记信息
   * @param config - 新的配置
   */
  updateNoteConfig(noteInfo: NoteInfo, config: NoteConfig): void {
    if (!this.validateConfig(config)) {
      throw new Error(`Invalid config for note: ${noteInfo.dirName}`)
    }

    config.updated_at = Date.now()
    this.writeNoteConfig(noteInfo.configPath, config)
    logger.info(`Updated config for note: ${noteInfo.dirName}`)
  }

  /**
   * 获取笔记信息（通过索引）- 直接查找不扫描所有笔记
   * @param noteIndex - 笔记索引
   * @returns 笔记信息，未找到时返回 undefined
   */
  getNoteByIndex(noteIndex: string): NoteInfo | undefined {
    const noteDirs = this.getNoteDirs()

    for (const dirName of noteDirs) {
      if (this.getNoteIndexFromDir(dirName) === noteIndex) {
        return this.buildNoteInfo(dirName)
      }
    }

    return undefined
  }
}
