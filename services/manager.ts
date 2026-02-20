/**
 * .vitepress/tnotes/services/manager.ts
 *
 * 服务管理器 - 管理全局共享服务实例
 */

import { FileWatcherService } from './file-watcher'
import { NoteIndexCache } from '../core/NoteIndexCache'
import { NoteManager } from '../core/NoteManager'
import { logger } from '../utils'

/**
 * 全局服务实例管理
 */
class ServiceManager {
  /** 单例实例 */
  private static instance: ServiceManager

  /** 文件监听服务 */
  private fileWatcherService: FileWatcherService

  /** 笔记索引缓存 */
  private noteIndexCache: NoteIndexCache

  /** 笔记管理器 */
  private noteManager: NoteManager

  /** 初始化状态 */
  private initialized: boolean = false

  private constructor() {
    this.noteIndexCache = NoteIndexCache.getInstance()
    this.noteManager = NoteManager.getInstance()
    this.fileWatcherService = new FileWatcherService()
  }

  /** 获取 ServiceManager 单例 */
  static getInstance(): ServiceManager {
    if (!ServiceManager.instance) {
      ServiceManager.instance = new ServiceManager()
    }
    return ServiceManager.instance
  }

  /**
   * 初始化服务（扫描笔记并初始化索引缓存）
   *
   * @throws 如果检测到重复的笔记 ID
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      logger.warn('ServiceManager 已经初始化')
      return
    }

    try {
      // 1. 扫描所有笔记（跳过重复检测，dev 流程已在 countNotes 中完成）
      logger.info('扫描笔记目录...')
      const notes = this.noteManager.scanNotes({ skipDuplicateCheck: true })
      logger.info(`扫描到 ${notes.length} 篇笔记`)

      // 2. 初始化笔记索引缓存（如果有重复 ID 会抛出错误）
      logger.info('初始化笔记索引缓存...')
      this.noteIndexCache.initialize(notes)

      // 3. 启动文件监听服务
      this.fileWatcherService.start()

      this.initialized = true
    } catch (error) {
      logger.error('ServiceManager 初始化失败:', error)
      throw error
    }
  }

  /** 检查是否已初始化 */
  isInitialized(): boolean {
    return this.initialized
  }

  /** 获取笔记索引缓存实例 */
  getNoteIndexCache(): NoteIndexCache {
    return this.noteIndexCache
  }

  /** 获取 FileWatcherService 实例 */
  getFileWatcherService(): FileWatcherService {
    return this.fileWatcherService
  }

  /** 检查 FileWatcherService 是否存在且正在运行 */
  isFileWatcherActive(): boolean {
    return this.fileWatcherService?.isWatching() ?? false
  }
}

export const serviceManager = ServiceManager.getInstance()
