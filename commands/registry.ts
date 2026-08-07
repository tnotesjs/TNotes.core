/**
 * commands/registry.ts
 *
 * 命令注册表 - 管理命令的注册、实例化和获取
 */

import { BuildCommand, PreviewCommand } from './build'
import { DevCommand } from './dev'
import { PushCommand, PullCommand } from './git'
import { InitSubRepoCommand } from './init-sub-repo'
import { InitTocCommand } from './init-toc'
import { HelpCommand } from './misc'
import { type Command, type CommandName } from './models'
import {
  CreateNoteCommand,
  UpdateNoteConfigCommand,
  RenameNoteCommand,
} from './note'
import { UpdateCommand } from './update'
import { UpdateCompletedCountCommand } from './update-completed-count'

/** 命令注册表（懒加载） */
const commandFactories: Record<CommandName, () => Command> = {
  'build': () => new BuildCommand(),
  'create-notes': () => new CreateNoteCommand(),
  'dev': () => new DevCommand(),
  'init-sub-repo': () => new InitSubRepoCommand(),
  'init-toc': () => new InitTocCommand(),
  'help': () => new HelpCommand(),
  'preview': () => new PreviewCommand(),
  'pull': () => new PullCommand(),
  'push': () => new PushCommand(),
  'rename-note': () => new RenameNoteCommand(),
  'update-completed-count': () => new UpdateCompletedCountCommand(),
  'update-note-config': () => new UpdateNoteConfigCommand(),
  'update': () => new UpdateCommand(),
}

/** 命令实例缓存 */
const commandCache = new Map<CommandName, Command>()

/** 获取命令（懒加载，首次调用时才实例化） */
export function getCommand(name: CommandName): Command | undefined {
  if (!commandFactories[name]) return undefined

  if (!commandCache.has(name)) commandCache.set(name, commandFactories[name]())

  return commandCache.get(name)
}
