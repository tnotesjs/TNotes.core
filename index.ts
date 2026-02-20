/**
 * .vitepress/tnotes/index.ts
 *
 * TNotes 内置命令入口模块
 */

import { getCommand, COMMAND_NAMES } from './commands'
import type { CommandArgs } from './commands'
import { handleError, parseArgs, createLogger } from './utils'
import type {
  UpdateCommand,
  UpdateCompletedCountCommand,
  PushCommand,
  PullCommand,
  SyncCommand,
} from './commands'

/**
 * TNotes 内置命令入口函数
 */
;(async (): Promise<void> => {
  try {
    // 解析命令行参数
    const args = parseArgs(process.argv.slice(2)) as CommandArgs

    // 查找第一个为 true 的参数作为命令名
    const commandName = Object.keys(args).find(
      (key) => key !== '_' && args[key] === true,
    )

    // #region - 非法命令处理

    // 若没有检测到命令名，则显示帮助信息
    // 测试命令：npx tsx ./.vitepress/tnotes/index.ts 123
    // 若命令名无效，则显示帮助信息
    // 测试命令：npx tsx ./.vitepress/tnotes/index.ts --123
    const command = commandName ? getCommand(commandName as any) : null
    if (!command) {
      const logger = createLogger('command-not-found', {
        timestamp: false,
      })
      console.log(
        `\n------------------------------------------------------------------\n`,
      )
      if (commandName) {
        logger.warn(`未找到命令：${commandName}`)
        logger.info(`请检查命令名是否正确！`)
      } else {
        logger.warn(`未检测到命令名，请检查命令输入是否正确`)
        logger.info(`示例：`)
        logger.info(`pnpm tn:<命令名>`)
        logger.info(`npx tsx ./.vitepress/tnotes/index.ts --<命令名>`)
      }
      console.log(
        `\n------------------------------------------------------------------\n`,
      )

      const helpCommand = getCommand(COMMAND_NAMES.HELP)
      if (helpCommand) {
        console.log('\n正在执行 pnpm tn:help 打印帮助信息...\n')
        await helpCommand.execute()
      }
      return
    }

    // #endregion - 非法命令处理

    // #region - 处理合法命令选项

    if (commandName === COMMAND_NAMES.UPDATE) {
      const cmd = command as UpdateCommand
      if (args.quiet) cmd.setQuiet(true)
      if (args.all) cmd.setUpdateAll(true)
    } else if (commandName === COMMAND_NAMES.UPDATE_COMPLETED_COUNT) {
      const cmd = command as UpdateCompletedCountCommand
      if (args.all) cmd.setUpdateAll(true)
    } else if (commandName === COMMAND_NAMES.PUSH) {
      const cmd = command as PushCommand
      if (args.force) cmd.setOptions({ force: true })
      if (args.all) cmd.setPushAll(true)
    } else if (commandName === COMMAND_NAMES.PULL) {
      const cmd = command as PullCommand
      if (args.all) cmd.setPullAll(true)
    } else if (commandName === COMMAND_NAMES.SYNC) {
      const cmd = command as SyncCommand
      if (args.all) cmd.setSyncAll(true)
    }

    // #endregion - 处理合法命令选项

    // 执行命令
    await command.execute()
  } catch (error) {
    handleError(error, true)
  }
})()
