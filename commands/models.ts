/**
 * .vitepress/tnotes/commands/models.ts
 *
 * commands 层对外暴露的类型和常量
 * 注意：此文件不应导入任何命令类，以避免循环引用
 */

/**
 * TNotes 内置命令名称常量
 */
export const COMMAND_NAMES = {
  BUILD: 'build',
  CREATE_NOTES: 'create-notes',
  DEV: 'dev',
  FIX_TIMESTAMPS: 'fix-timestamps',
  HELP: 'help',
  PREVIEW: 'preview',
  PULL: 'pull',
  PUSH: 'push',
  RENAME_NOTE: 'rename-note',
  SYNC_SCRIPTS: 'sync-scripts',
  SYNC: 'sync',
  UPDATE: 'update',
  UPDATE_COMPLETED_COUNT: 'update-completed-count',
  UPDATE_NOTE_CONFIG: 'update-note-config',
} as const

/**
 * TNotes 内置命令名称类型
 */
export type CommandName = (typeof COMMAND_NAMES)[keyof typeof COMMAND_NAMES]

/**
 * 命令描述映射（静态配置，无需实例化即可读取）
 */
export const COMMAND_DESCRIPTIONS: Record<CommandName, string> = {
  [COMMAND_NAMES.DEV]: '启动知识库开发服务',
  [COMMAND_NAMES.BUILD]: '构建知识库',
  [COMMAND_NAMES.PREVIEW]: '预览构建后的知识库',
  [COMMAND_NAMES.UPDATE]: '根据笔记内容更新知识库',
  [COMMAND_NAMES.UPDATE_COMPLETED_COUNT]:
    '更新完成笔记数量历史记录（近 1 年，最近 12 个月）',
  [COMMAND_NAMES.CREATE_NOTES]: '新建笔记（支持批量创建）',
  [COMMAND_NAMES.PUSH]: '将知识库推送到 GitHub (使用 --all 推送所有知识库)',
  [COMMAND_NAMES.PULL]: '将 GitHub 的知识库拉下来 (使用 --all 拉取所有知识库)',
  [COMMAND_NAMES.SYNC]:
    '同步本地和远程的知识库状态 (使用 --all 同步所有知识库)',
  [COMMAND_NAMES.SYNC_SCRIPTS]: '同步知识库脚本到其它 TNotes.xxx 知识库中',
  [COMMAND_NAMES.FIX_TIMESTAMPS]: '修复所有笔记的时间戳（基于 git 历史）',
  [COMMAND_NAMES.UPDATE_NOTE_CONFIG]: '更新笔记配置文件',
  [COMMAND_NAMES.RENAME_NOTE]: '重命名笔记',
  [COMMAND_NAMES.HELP]: '显示帮助信息',
}

/**
 * 命令参数选项常量
 */
export const COMMAND_OPTIONS = {
  ALL: 'all',
  QUIET: 'quiet',
  FORCE: 'force',
} as const

export type CommandOption =
  (typeof COMMAND_OPTIONS)[keyof typeof COMMAND_OPTIONS]

/**
 * 命令选项类型（传递给 BaseCommand.setOptions 的参数类型）
 */
export interface CommandOptions {
  force?: boolean
  all?: boolean
  quiet?: boolean
  [key: string]: unknown
}

/**
 * 命令参数类型
 */
export type CommandArgs = {
  [K in CommandName]?: boolean
} & {
  [COMMAND_OPTIONS.ALL]?: boolean
  [COMMAND_OPTIONS.QUIET]?: boolean
  [COMMAND_OPTIONS.FORCE]?: boolean
}

/**
 * 命令接口
 */
export interface Command {
  name: CommandName
  description: string
  execute(): Promise<void>
}
