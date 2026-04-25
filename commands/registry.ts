/**
 * .vitepress/tnotes/commands/registry.ts
 *
 * 命令注册表 - 管理命令的注册、实例化和获取
 */

import { BuildCommand, PreviewCommand } from './build'
import { DevCommand } from './dev'
import { PushCommand, PullCommand } from './git'
import { FixTimestampsCommand } from './maintenance'
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
  dev: () => new DevCommand(),
  build: () => new BuildCommand(),
  preview: () => new PreviewCommand(),
  update: () => new UpdateCommand(),
  'update-completed-count': () => new UpdateCompletedCountCommand(),
  push: () => new PushCommand(),
  pull: () => new PullCommand(),
  'create-notes': () => new CreateNoteCommand(),
  'fix-timestamps': () => new FixTimestampsCommand(),
  'update-note-config': () => new UpdateNoteConfigCommand(),
  'rename-note': () => new RenameNoteCommand(),
  help: () => new HelpCommand(),
}

/** 命令实例缓存 */
const commandCache = new Map<CommandName, Command>()

/** 获取命令（懒加载，首次调用时才实例化） */
export function getCommand(name: CommandName): Command | undefined {
  if (!commandFactories[name]) return undefined

  if (!commandCache.has(name)) commandCache.set(name, commandFactories[name]())

  return commandCache.get(name)
}
