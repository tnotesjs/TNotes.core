/**
 * .vitepress/tnotes/commands/BaseCommand.ts
 *
 * 命令基类
 */

import type { Command, CommandName, CommandOptions } from './models'
import { COMMAND_DESCRIPTIONS } from './models'
import type { Logger } from '../utils'
import { handleError, logger } from '../utils'

/**
 * 命令基类
 */
export abstract class BaseCommand implements Command {
  protected logger: Logger
  protected options: CommandOptions = {}

  /** 命令描述（从静态配置读取） */
  get description(): string {
    return COMMAND_DESCRIPTIONS[this.name]
  }

  constructor(public name: CommandName) {
    this.logger = logger.child(name)
  }

  /**
   * 设置命令选项
   */
  setOptions(options: CommandOptions): void {
    this.options = { ...this.options, ...options }
  }

  /**
   * 执行命令（带错误处理）
   */
  async execute(): Promise<void> {
    const startTime = Date.now()

    try {
      this.logger.start(this.description)
      await this.run()
      const duration = Date.now() - startTime
      this.logger.done(`命令执行耗时：${duration} ms`)
    } catch (error) {
      handleError(error)
      throw error
    }
  }

  /**
   * 子类需要实现的运行逻辑
   */
  protected abstract run(): Promise<void>
}
