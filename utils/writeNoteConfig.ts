/**
 * .vitepress/tnotes/utils/writeNoteConfig.ts
 *
 * 统一的笔记配置文件写入工具
 * 确保所有写入 .tnotes.json 的操作使用一致的格式：
 * - 字段按固定顺序排列
 * - 使用 2 空格缩进
 * - 末尾包含换行符
 */

import { writeFileSync } from 'fs'
import type { NoteConfig } from '../types'

/**
 * 配置字段顺序
 */
const FIELD_ORDER: readonly string[] = [
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

/**
 * 按指定顺序排序配置对象的键
 * @param config - 原始配置对象
 * @returns 排序后的配置对象
 */
export function sortConfigKeys(config: NoteConfig): NoteConfig {
  const configRecord = config as unknown as Record<string, unknown>
  const sorted: Record<string, unknown> = {}

  // 按照定义的顺序添加字段
  for (const key of FIELD_ORDER) {
    if (key in config) {
      sorted[key] = configRecord[key]
    }
  }

  // 添加其他未在顺序列表中的字段
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
 * @param config - 笔记配置
 * @returns 格式化的 JSON 字符串（含末尾换行）
 */
export function serializeNoteConfig(config: NoteConfig): string {
  const sorted = sortConfigKeys(config)
  return JSON.stringify(sorted, null, 2) + '\n'
}

/**
 * 统一写入笔记配置文件
 * @param configPath - 配置文件路径
 * @param config - 笔记配置
 */
export function writeNoteConfig(configPath: string, config: NoteConfig): void {
  writeFileSync(configPath, serializeNoteConfig(config), 'utf-8')
}
