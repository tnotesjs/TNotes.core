/**
 * .vitepress/tnotes/utils/noteIndex.ts
 *
 * 笔记索引相关工具函数
 *
 * 注意：这里的 "noteIndex" 指的是笔记文件夹名称前面的 4 位数字（如 "0001"），
 * 用于区分配置文件中的 UUID 类型的 id 字段。
 */
import { logger } from './logger'

/**
 * 笔记索引正则表达式
 *
 * - 匹配格式: 4 位数字开头，后接小数点
 * - 示例: "0001." 或 "9999."
 */
const NOTE_INDEX_REGEX = /^(\d{4})\./

/**
 * 从文件夹名称或文本中提取笔记索引
 *
 * @param text - 要解析的文本（通常是文件夹名称）
 * @returns 笔记索引（4 位数字字符串）或 null
 *
 * @example
 * extractNoteIndex('0001. TNotes 简介') // '0001'
 * extractNoteIndex('0023. 处理 git log') // '0023'
 * extractNoteIndex('invalid-folder')     // null
 */
export function extractNoteIndex(text: string): string | null {
  const match = text.match(NOTE_INDEX_REGEX)
  return match ? match[1] : null
}

/**
 * 输出无效笔记名称的警告日志
 *
 * @param name - 无效的笔记名称
 */
export function warnInvalidNoteIndex(name: string): void {
  logger.warn(`无效的笔记名: ${name}`)
  logger.warn('笔记名必须以 4 个数字开头')
  logger.warn('范围：0001-9999')
}
