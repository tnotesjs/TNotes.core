/**
 * .vitepress/tnotes/services/file-watcher/internal.ts
 *
 * 文件监听层内部模型：仅供 file-watcher 层使用
 */

import type { Logger } from '../../utils'

/**
 * 监听事件类型常量
 */
export const WATCH_EVENT_TYPES = {
  README: 'readme',
  CONFIG: 'config',
} as const

export type WatchEventType =
  (typeof WATCH_EVENT_TYPES)[keyof typeof WATCH_EVENT_TYPES]

/**
 * 监听到的文件变更事件
 *
 * 示例：
 *
 * ```js
 * {
 *   path: 'C:\\tnotesjs\\TNotes.introduction\\notes\\0001. TNotes 简介\\README.md',
 *   type: 'readme',
 *   noteIndex: '0001',
 *   noteDirName: '0001. TNotes 简介',
 *   noteDirPath: 'C:\\tnotesjs\\TNotes.introduction\\notes\\0001. TNotes 简介'
 * }
 * ```
 */
export interface WatchEvent {
  /**
   * 笔记文件（README.md、.tnotes.json）的绝对路径
   */
  path: string
  type: WatchEventType
  noteIndex: string
  noteDirName: string
  noteDirPath: string
  /**
   * 文件夹重命名时的旧名称
   */
  oldNoteDirName?: string
}

export type ConfigSnapshot = {
  done: boolean
  enableDiscussions: boolean
  description: string
}

/**
 * 统一的异步错误处理辅助函数
 *
 * 用于包装可能抛出异常的异步操作，将错误统一通过 logger.error 输出，
 * 避免各模块错误处理方式不一致（静默吞掉、格式各异等）。
 *
 * @param label 操作标签，用于错误日志前缀
 * @param fn 需要执行的异步函数
 * @param logger 日志记录器
 * @returns true 表示执行成功，false 表示捕获到异常
 */
export async function safeExecute(
  label: string,
  fn: () => Promise<void>,
  logger: Logger,
): Promise<boolean> {
  try {
    await fn()
    return true
  } catch (error) {
    logger.error(`[${label}] ${error}`)
    return false
  }
}
