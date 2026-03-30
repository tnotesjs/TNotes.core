/**
 * .vitepress/tnotes/utils/logger.ts
 *
 * 统一的日志系统
 */

/**
 * 日志级别枚举
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  SILENT = 4,
}

/**
 * 日志配置接口
 */
interface LoggerConfig {
  level?: LogLevel
  prefix?: string
  timestamp?: boolean
  colors?: boolean
}

/**
 * 日志记录器类
 */
export class Logger {
  private level: LogLevel
  private prefix: string
  private timestamp: boolean
  private colors: boolean

  constructor(config: LoggerConfig = {}) {
    this.level = config.level ?? LogLevel.INFO
    this.prefix = config.prefix ?? ''
    this.timestamp = config.timestamp ?? false
    this.colors = config.colors ?? true
  }

  /**
   * 设置日志级别
   */
  setLevel(level: LogLevel): void {
    this.level = level
  }

  /**
   * 获取当前时间戳（精确到毫秒）
   */
  private getTimestamp(): string {
    if (!this.timestamp) return ''
    const now = new Date()
    const hours = String(now.getHours()).padStart(2, '0')
    const minutes = String(now.getMinutes()).padStart(2, '0')
    const seconds = String(now.getSeconds()).padStart(2, '0')
    const milliseconds = String(now.getMilliseconds()).padStart(3, '0')
    return `[${hours}:${minutes}:${seconds}.${milliseconds}] `
  }

  /**
   * 格式化日志消息
   */
  private formatMessage(message: string): string {
    const timestamp = this.getTimestamp()
    const prefix = this.prefix ? `[${this.prefix}] ` : ''
    return `${timestamp}${prefix}${message}`
  }

  /**
   * DEBUG 级别日志
   */
  debug(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.DEBUG) {
      console.log(`🐛 ${this.formatMessage(message)}`, ...args)
    }
  }

  /**
   * INFO 级别日志
   */
  info(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.INFO) {
      console.log(`ℹ️ ${this.formatMessage(message)}`, ...args)
    }
  }

  /**
   * 成功日志（特殊的 INFO 级别）
   */
  success(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.INFO) {
      console.log(`✅ ${this.formatMessage(message)}`, ...args)
    }
  }

  /**
   * 警告日志
   */
  warn(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.WARN) {
      console.warn(`⚠️  ${this.formatMessage(message)}`, ...args)
    }
  }

  /**
   * 错误日志
   */
  error(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.ERROR) {
      console.error(`❌ ${this.formatMessage(message)}`, ...args)
    }
  }

  /**
   * 进度日志
   */
  progress(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.INFO) {
      console.log(`⏳ ${this.formatMessage(message)}`, ...args)
    }
  }

  /**
   * 启动日志
   */
  start(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.INFO) {
      console.log(`🚀 ${this.formatMessage(message)}`, ...args)
    }
  }

  /**
   * 停止日志
   */
  stop(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.INFO) {
      console.log(`🛑 ${this.formatMessage(message)}`, ...args)
    }
  }

  /**
   * 完成日志
   */
  done(message: string, duration?: number, ...args: any[]): void {
    if (this.level <= LogLevel.INFO) {
      const durationStr = duration ? ` (${duration}ms)` : ''
      console.log(`✨ ${this.formatMessage(message)}${durationStr}`, ...args)
    }
  }

  /**
   * 链接日志
   */
  link(message: string, url: string, ...args: any[]): void {
    if (this.level <= LogLevel.INFO) {
      console.log(`🔗 ${this.formatMessage(message)} ${url}`, ...args)
    }
  }

  /**
   * 文件操作日志
   */
  file(action: string, path: string, ...args: any[]): void {
    if (this.level <= LogLevel.INFO) {
      console.log(`📄 ${this.formatMessage(`${action}: ${path}`)}`, ...args)
    }
  }

  /**
   * Git 操作日志
   */
  git(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.INFO) {
      console.log(`📦 ${this.formatMessage(message)}`, ...args)
    }
  }

  /**
   * 创建子 Logger
   */
  child(prefix: string): Logger {
    return new Logger({
      level: this.level,
      prefix: this.prefix ? `${this.prefix}:${prefix}` : prefix,
      timestamp: this.timestamp,
      colors: this.colors,
    })
  }

  /**
   * 执行函数并记录耗时
   */
  async time<T>(label: string, fn: () => Promise<T>): Promise<T> {
    this.progress(`${label}...`)
    const startTime = Date.now()

    try {
      const result = await fn()
      const duration = Date.now() - startTime
      this.done(label, duration)
      return result
    } catch (error) {
      const duration = Date.now() - startTime
      this.error(`${label} failed after ${duration}ms`)
      throw error
    }
  }
}

/**
 * 默认 Logger 实例
 */
export const logger = new Logger({
  level: process.env.DEBUG ? LogLevel.DEBUG : LogLevel.INFO,
  timestamp: true, // 启用时间戳（精确到毫秒）
  colors: true,
})

/**
 * 创建带前缀的 Logger
 */
export function createLogger(prefix: string, config?: LoggerConfig): Logger {
  return new Logger({
    ...config,
    prefix,
  })
}
