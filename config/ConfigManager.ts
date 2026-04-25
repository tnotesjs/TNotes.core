/**
 * .vitepress/tnotes/config/ConfigManager.ts
 *
 * 配置管理器 - 统一管理项目配置
 */
import fs from 'fs'
import path from 'path'

import { validateAndCompleteConfig } from './defaultConfig'

import type { TNotesConfig } from '../types'

/**
 * 配置管理器（单例模式）
 */
export class ConfigManager {
  private static instance: ConfigManager
  private config: TNotesConfig | null = null
  private configPath: string
  private rootPath: string

  private constructor(rootPath?: string) {
    if (rootPath) {
      // 显式传入根路径
      this.rootPath = rootPath
    } else {
      // 默认使用 process.cwd()（CLI 和 VitePress 均在项目根目录执行）
      this.rootPath = process.cwd()
    }
    this.configPath = path.normalize(
      path.resolve(this.rootPath, '.tnotes.json'),
    )
  }

  /**
   * 使用指定的根路径初始化配置管理器
   *
   * 必须在 getInstance() 之前调用（如果需要指定 rootPath）。
   * 如果已经初始化，则忽略重复调用。
   */
  static init({ rootPath }: { rootPath: string }): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager(rootPath)
    }
    return ConfigManager.instance
  }

  /**
   * 获取单例实例
   */
  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager()
    }
    return ConfigManager.instance
  }

  /**
   * 加载配置文件
   */
  loadConfig(configPath?: string): TNotesConfig {
    if (this.config) return this.config

    const path = configPath || this.configPath

    if (!fs.existsSync(path)) {
      throw new Error(`配置文件不存在: ${path}`)
    }

    const configContent = fs.readFileSync(path, 'utf-8')
    const rawConfig = JSON.parse(configContent)

    // 验证并补全配置
    const { config: validatedConfig, modified } =
      validateAndCompleteConfig(rawConfig)

    if (modified) {
      console.warn(`[ConfigManager] 检测到知识库配置缺失字段，已自动补全`)
      // 写回配置文件
      fs.writeFileSync(path, JSON.stringify(validatedConfig, null, 2), 'utf-8')
      console.log(`[ConfigManager] 知识库配置文件已更新`)
      console.log(`[ConfigManager] 知识库配置文件路径: ${path}`)
    }

    this.config = validatedConfig

    return this.config
  }

  /**
   * 获取配置项
   */
  get<K extends keyof TNotesConfig>(key: K): TNotesConfig[K] {
    if (!this.config) {
      this.loadConfig()
    }
    return this.config![key]
  }

  /**
   * 获取所有配置
   */
  getAll(): TNotesConfig {
    if (!this.config) {
      this.loadConfig()
    }
    return this.config!
  }

  /**
   * 获取项目根路径
   */
  getRootPath(): string {
    return this.rootPath
  }

  /**
   * @deprecated 使用 getRootPath() 替代
   */
  getDirname(): string {
    return path.resolve(this.rootPath, '.vitepress', 'tnotes', 'config')
  }
}

/**
 * 获取配置管理器实例（便捷函数）
 */
export function getConfigManager(): ConfigManager {
  return ConfigManager.getInstance()
}

/**
 * 获取 TNotes 配置（向后兼容）
 */
export function getTnotesConfig(): TNotesConfig {
  return ConfigManager.getInstance().getAll()
}
