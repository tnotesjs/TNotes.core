/**
 * .vitepress/tnotes/utils/ConfigValidator.ts
 *
 * 配置验证和修复工具 - 确保 .tnotes.json 配置完整性
 */
import { readFileSync } from 'fs'
import type { NoteConfig } from '../types'
import { logger } from './logger'
import { writeNoteConfig, sortConfigKeys } from './writeNoteConfig'

/**
 * 默认配置字段
 */
const DEFAULT_CONFIG_FIELDS = {
  bilibili: [],
  tnotes: [],
  yuque: [],
  done: false,
  enableDiscussions: false,
  description: '',
} as const

/**
 * 必需字段（不能缺失）
 */
const REQUIRED_FIELDS = ['id'] as const

/**
 * 验证并修复配置文件
 * @param configPath - 配置文件路径
 * @returns 修复后的配置对象
 */
export function validateAndFixConfig(configPath: string): NoteConfig | null {
  try {
    // 读取配置文件
    const configContent = readFileSync(configPath, 'utf-8')
    let config: Partial<NoteConfig>

    try {
      config = JSON.parse(configContent)
    } catch (error) {
      logger.error(`配置文件 JSON 解析失败: ${configPath}`, error)
      return null
    }

    let needsUpdate = false

    // 1. 检查必需字段
    for (const field of REQUIRED_FIELDS) {
      if (!config[field]) {
        logger.error(
          `配置文件缺少必需字段 "${field}": ${configPath}\n` +
            `请手动添加该字段或删除配置文件后重新生成`,
        )
        throw new Error(`Missing required field: ${field}`)
      }
    }

    // 2. 补充缺失的可选字段
    for (const [key, defaultValue] of Object.entries(DEFAULT_CONFIG_FIELDS)) {
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
    const sortedConfig = sortConfigKeys(config as NoteConfig)

    // 5. 写回文件（如果有变更）
    if (needsUpdate) {
      writeNoteConfig(configPath, sortedConfig)
      logger.info(`配置文件已修复: ${configPath}`)
    }

    return sortedConfig
  } catch (error) {
    logger.error(`配置文件验证失败: ${configPath}`, error)
    return null
  }
}
