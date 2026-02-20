/**
 * .vitepress/tnotes/services/file-watcher/watchState.ts
 *
 * 监听状态存储：哈希缓存、配置缓存、目录缓存
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'fs'
import { createHash } from 'crypto'
import { join } from 'path'
import type { ConfigSnapshot } from './internal'
import type { Logger } from '../../utils'
import type { NoteConfig } from '../../types'

interface WatchStateConfig {
  /** 笔记目录路径 */
  notesDir: string
  /** 日志记录器 */
  logger: Logger
}

export class WatchState {
  /** 文件哈希缓存 */
  private fileHashes = new Map<string, string>()

  /** 笔记目录缓存 */
  private noteDirCache = new Set<string>()

  /** 笔记配置缓存 */
  private configCache = new Map<string, ConfigSnapshot>()

  constructor(private config: WatchStateConfig) {}

  /**
   * 获取指定文件的 MD5 哈希值，若文件不存在或读取失败返回 null
   *
   * @param filePath 文件路径
   * @returns 文件哈希
   */
  private getFileHash(filePath: string): string | null {
    try {
      if (!existsSync(filePath)) return null
      const content = readFileSync(filePath, 'utf-8')
      return createHash('md5').update(content).digest('hex')
    } catch {
      return null
    }
  }

  /**
   * 更新文件哈希缓存，只有当文件内容发生变化时才更新并返回 true
   *
   * @param filePath 文件路径
   * @returns 是否发生变化
   */
  updateFileHash(filePath: string): boolean {
    const current = this.getFileHash(filePath)
    if (!current) return false
    const prev = this.fileHashes.get(filePath)
    if (prev === current) return false
    this.fileHashes.set(filePath, current)
    return true
  }

  /**
   * 检查指定名称的笔记目录是否已存在于缓存中
   *
   * @param name 笔记目录名称
   * @returns 若存在则返回 true，否则返回 false
   */
  hasNoteDir(name: string) {
    return this.noteDirCache.has(name)
  }

  /**
   * 将指定名称的笔记目录添加到缓存中
   *
   * @param name 笔记目录名称
   */
  addNoteDir(name: string) {
    this.noteDirCache.add(name)
  }
  /**
   * 从缓存中移除指定名称的笔记目录
   *
   * @param name 笔记目录名称
   */
  deleteNoteDir(name: string) {
    this.noteDirCache.delete(name)
  }

  /**
   * 清空所有缓存数据，包括文件哈希、笔记目录和配置快照
   */
  clearAll(): void {
    this.fileHashes.clear()
    this.noteDirCache.clear()
    this.configCache.clear()
  }

  /**
   * 清除指定笔记目录相关的缓存数据，包括 README.md 和 .tnotes.json 的文件哈希及配置快照
   *
   * @param noteDirName 笔记目录名称
   */
  clearNoteCaches(noteDirName: string): void {
    const readmePath = join(this.config.notesDir, noteDirName, 'README.md')
    const configPath = join(this.config.notesDir, noteDirName, '.tnotes.json')
    this.fileHashes.delete(readmePath)
    this.fileHashes.delete(configPath)
    this.configCache.delete(configPath)
  }

  /**
   * 获取指定配置文件路径对应的配置快照
   *
   * @param configPath 配置文件路径（通常为 .tnotes.json 的绝对路径）
   * @returns 配置快照，若不存在则返回 undefined
   */
  getConfigSnapshot(configPath: string): ConfigSnapshot | undefined {
    return this.configCache.get(configPath)
  }

  /**
   * 设置指定配置文件路径的配置快照到缓存中
   *
   * @param configPath 配置文件路径（通常为 .tnotes.json 的绝对路径）
   * @param snapshot 配置快照对象
   */
  setConfigSnapshot(configPath: string, snapshot: ConfigSnapshot): void {
    this.configCache.set(configPath, snapshot)
  }

  /**
   * 读取指定配置文件的快照
   *
   * 解析 .tnotes.json 配置文件，提取 done、enableDiscussions、description 字段。
   *
   * @param configPath 配置文件路径（通常为 .tnotes.json 的绝对路径）
   * @returns 配置快照，若文件不存在或解析失败则返回 null
   */
  readConfigSnapshot(configPath: string): ConfigSnapshot | null {
    try {
      if (!existsSync(configPath)) return null
      const content = readFileSync(configPath, 'utf-8')
      const config = JSON.parse(content) as Partial<NoteConfig>
      return {
        done: Boolean(config.done),
        enableDiscussions: Boolean(config.enableDiscussions),
        description: config.description || '',
      }
    } catch (error) {
      this.config.logger.error(`[读取配置快照] ${error}`)
      return null
    }
  }

  /**
   * 从磁盘初始化监听状态缓存：
   * 遍历笔记根目录下的所有子目录，将每个笔记目录的 README.md 和 .tnotes.json
   * 的哈希值及配置快照加载到缓存中。
   */
  initializeFromDisk(): void {
    try {
      const noteDirs = readdirSync(this.config.notesDir)
      this.clearAll()

      for (const noteDir of noteDirs) {
        const noteDirPath = join(this.config.notesDir, noteDir)
        if (!statSync(noteDirPath).isDirectory()) continue

        this.noteDirCache.add(noteDir)

        const readmePath = join(noteDirPath, 'README.md')
        const readmeHash = this.getFileHash(readmePath)
        if (readmeHash) this.fileHashes.set(readmePath, readmeHash)

        const configPath = join(noteDirPath, '.tnotes.json')
        const configHash = this.getFileHash(configPath)
        if (configHash) {
          this.fileHashes.set(configPath, configHash)
          const snapshot = this.readConfigSnapshot(configPath)
          if (snapshot) this.configCache.set(configPath, snapshot)
        }
      }
    } catch (error) {
      this.config.logger.warn(
        `[initializeFromDisk] 初始化监听状态失败: ${error}`,
      )
    }
  }
}
