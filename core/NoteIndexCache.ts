/**
 * .vitepress/tnotes/core/NoteIndexCache.ts
 *
 * 笔记索引缓存 - 维护笔记的内存索引，避免重复扫描文件系统
 */

import type { NoteInfo, NoteConfig } from '../types'
import { join } from 'path'
import { NOTES_PATH } from '../config/constants'
import { logger } from '../utils'

/**
 * 索引项结构
 */
interface NoteIndexItem {
  /** 笔记索引（文件夹名前 4 位数字，如 "0001"） */
  noteIndex: string
  /** 完整文件夹名称（如 "0001. TNotes 简介"） */
  folderName: string
  /** 笔记配置（与 .tnotes.json 结构一致） */
  noteConfig: NoteConfig
}

/**
 * 笔记索引缓存类
 * 提供快速的笔记查询和更新能力
 */
export class NoteIndexCache {
  private static instance: NoteIndexCache | null = null

  /** noteIndex -> NoteIndexItem 的映射 */
  private byNoteIndex: Map<string, NoteIndexItem> = new Map()

  /** configId (UUID) -> noteIndex 的映射，用于快速反向查询 */
  private byConfigId: Map<string, string> = new Map()

  /** 是否已完成初始化 */
  private _initialized = false

  private constructor() {}

  /**
   * 获取单例实例
   */
  static getInstance(): NoteIndexCache {
    if (!NoteIndexCache.instance) {
      NoteIndexCache.instance = new NoteIndexCache()
    }
    return NoteIndexCache.instance
  }

  /**
   * 初始化索引缓存
   * @param notes - 扫描得到的笔记列表（已由 NoteManager.scanNotes 完成重复检测）
   */
  initialize(notes: NoteInfo[]): void {
    this.byNoteIndex.clear()
    this.byConfigId.clear()

    // 构建索引
    for (const note of notes) {
      const item: NoteIndexItem = {
        noteIndex: note.index,
        folderName: note.dirName,
        noteConfig: note.config,
      }

      this.byNoteIndex.set(note.index, item)
      this.byConfigId.set(note.config.id, note.index)
    }

    this._initialized = true
    logger.info(`笔记索引初始化完成，共 ${notes.length} 篇笔记`)
  }

  /**
   * 是否已完成初始化
   */
  isInitialized(): boolean {
    return this._initialized
  }

  /**
   * 从缓存构建 NoteInfo 列表（纯内存，零 I/O）
   * @returns 笔记信息数组
   */
  toNoteInfoList(): NoteInfo[] {
    const result: NoteInfo[] = []
    for (const item of this.byNoteIndex.values()) {
      const notePath = join(NOTES_PATH, item.folderName)
      result.push({
        index: item.noteIndex,
        path: notePath,
        dirName: item.folderName,
        readmePath: join(notePath, 'README.md'),
        configPath: join(notePath, '.tnotes.json'),
        config: item.noteConfig,
      })
    }
    return result
  }

  /**
   * 根据 noteIndex 获取索引项
   */
  getByNoteIndex(noteIndex: string): NoteIndexItem | undefined {
    return this.byNoteIndex.get(noteIndex)
  }

  /**
   * 根据 configId (UUID) 获取索引项
   */
  getByConfigId(configId: string): NoteIndexItem | undefined {
    const noteIndex = this.byConfigId.get(configId)
    return noteIndex ? this.byNoteIndex.get(noteIndex) : undefined
  }

  /**
   * 检查 noteIndex 是否存在
   */
  has(noteIndex: string): boolean {
    return this.byNoteIndex.has(noteIndex)
  }

  /**
   * 更新笔记配置
   * @param noteIndex - 笔记索引
   * @param configUpdates - 要更新的配置字段
   */
  updateConfig(noteIndex: string, configUpdates: Partial<NoteConfig>): void {
    const item = this.byNoteIndex.get(noteIndex)
    if (!item) {
      logger.warn(`尝试更新不存在的笔记: ${noteIndex}`)
      return
    }

    Object.assign(item.noteConfig, configUpdates)
    item.noteConfig.updated_at = Date.now()

    logger.debug(`更新笔记配置: ${noteIndex}`, configUpdates)
  }

  /**
   * 删除笔记
   * @param noteIndex - 笔记索引
   */
  delete(noteIndex: string): void {
    const item = this.byNoteIndex.get(noteIndex)
    if (!item) {
      logger.warn(`尝试删除不存在的笔记: ${noteIndex}`)
      return
    }

    // 同时删除两个索引
    this.byNoteIndex.delete(noteIndex)
    this.byConfigId.delete(item.noteConfig.id)

    logger.info(`删除笔记索引: ${noteIndex}`)
  }

  /**
   * 添加新笔记
   * @param note - 笔记信息
   */
  add(note: NoteInfo): void {
    const item: NoteIndexItem = {
      noteIndex: note.index,
      folderName: note.dirName,
      noteConfig: note.config,
    }

    this.byNoteIndex.set(note.index, item)
    this.byConfigId.set(note.config.id, note.index)

    logger.info(`添加笔记索引: ${note.index}`)
  }

  /**
   * 更新笔记的文件夹名称（标题变更时）
   * @param noteIndex - 笔记索引
   * @param newFolderName - 新的文件夹名称
   */
  updateFolderName(noteIndex: string, newFolderName: string): void {
    const item = this.byNoteIndex.get(noteIndex)
    if (!item) {
      logger.warn(`尝试更新不存在的笔记: ${noteIndex}`)
      return
    }

    item.folderName = newFolderName
    logger.debug(`更新笔记文件夹名称: ${noteIndex} -> ${newFolderName}`)
  }
}
