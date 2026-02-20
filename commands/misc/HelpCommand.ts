/**
 * .vitepress/tnotes/commands/misc/HelpCommand.ts
 *
 * 帮助命令
 */
import { BaseCommand } from '../BaseCommand'
import {
  COMMAND_NAMES,
  COMMAND_OPTIONS,
  COMMAND_DESCRIPTIONS,
  type CommandOption,
} from '../models'
import { createLogger, LogLevel } from '../../utils'

/**
 * 命令分组（用于帮助信息展示）
 *
 * 注意：`update-note-config` 和 `rename-note` 是内部命令，
 * 由 VitePress dev server 通过 HTTP API 调用，不在 CLI 帮助中展示。
 */
const COMMAND_CATEGORIES = {
  开发和构建: [COMMAND_NAMES.DEV, COMMAND_NAMES.BUILD, COMMAND_NAMES.PREVIEW],
  内容管理: [
    COMMAND_NAMES.UPDATE,
    COMMAND_NAMES.UPDATE_COMPLETED_COUNT,
    COMMAND_NAMES.CREATE_NOTES,
  ],
  'Git 操作': [COMMAND_NAMES.PUSH, COMMAND_NAMES.PULL, COMMAND_NAMES.SYNC],
  其他: [
    COMMAND_NAMES.SYNC_SCRIPTS,
    COMMAND_NAMES.FIX_TIMESTAMPS,
    COMMAND_NAMES.HELP,
  ],
} as const

/** 命令选项描述（用于帮助信息展示） */
const COMMAND_OPTIONS_INFO: Record<
  CommandOption,
  { description: string; applicableTo: string }
> = {
  [COMMAND_OPTIONS.ALL]: {
    description: '批量操作所有知识库',
    applicableTo: 'update/update-completed-count/push/pull/sync',
  },
  [COMMAND_OPTIONS.QUIET]: {
    description: '静默模式',
    applicableTo: 'update',
  },
  [COMMAND_OPTIONS.FORCE]: {
    description: '强制推送',
    applicableTo: 'push',
  },
}

export class HelpCommand extends BaseCommand {
  constructor() {
    super('help')

    // 禁用时间戳输出，help 结束后其他命令不受影响
    this.logger = createLogger('help', {
      timestamp: false,
      level: process.env.DEBUG ? LogLevel.DEBUG : LogLevel.INFO,
    })
  }

  protected async run(): Promise<void> {
    this.logger.info('TNotes 命令行工具')
    this.logger.info('')
    this.logger.info('用法：pnpm tn:<command> # 推荐')
    this.logger.info('或者：npx tsx ./.vitepress/tnotes/index.ts --<command>')
    this.logger.info('')
    this.logger.info('可用命令：')
    this.logger.info('')

    for (const [category, cmdNames] of Object.entries(COMMAND_CATEGORIES)) {
      this.logger.info(`  ${category}:`)
      for (const cmdName of cmdNames) {
        const description = COMMAND_DESCRIPTIONS[cmdName]
        const paddingLength = Math.max(25 - cmdName.length, 1)
        const padding = ' '.repeat(paddingLength)
        this.logger.info(`    --${cmdName}${padding}${description}`)
      }
      this.logger.info('')
    }

    this.logger.info('示例：')
    this.logger.info('  npx tsx ./.vitepress/tnotes/index.ts --dev')
    this.logger.info('  pnpm tn:build')
    this.logger.info('  pnpm tn:create-notes     # 批量创建笔记')
    this.logger.info('  pnpm tn:update')
    this.logger.info('  pnpm tn:update --all     # 更新所有知识库')
    this.logger.info(
      '  pnpm tn:update-completed-count           # 生成当前知识库最近 12 个月的完成笔记数量统计',
    )
    this.logger.info(
      '  pnpm tn:update-completed-count --all     # 生成所有知识库最近 12 个月的完成笔记数量统计',
    )
    this.logger.info('  pnpm tn:push --all       # 推送所有知识库')
    this.logger.info('')
    this.logger.info('参数：')
    for (const [option, info] of Object.entries(COMMAND_OPTIONS_INFO)) {
      const paddingLength = Math.max(13 - option.length, 1)
      const padding = ' '.repeat(paddingLength)
      this.logger.info(
        `  --${option}${padding}${info.description} (适用于 ${info.applicableTo})`,
      )
    }
    this.logger.info('')
    this.logger.info('环境变量：')
    this.logger.info('  DEBUG=1        启用调试模式，显示详细日志')
    this.logger.info('')
    this.logger.info('更多信息请查看: .vitepress/tnotes/README.md')
  }
}
