/**
 * commands/init-sub-repo/InitSubRepoCommand.ts
 *
 * 初始化 TNotes 子知识库
 */

import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { createInterface } from 'readline'
import { fileURLToPath } from 'url'
import { v4 as uuidv4 } from 'uuid'

import { getConfigManager } from '../../config/ConfigManager'
import { ROOT_DIR_PATH } from '../../config/constants'
import {
  buildInitContext,
  buildManualSteps,
  defaultDisplayName,
  DEFAULT_DESCRIPTION,
  DEFAULT_PORT,
  getInitializedConfigPath,
  isAlreadyInitialized,
  validatePort,
  validateTopic,
  InitSubRepoService,
} from '../../services/init-sub-repo'
import { reconcileTocFromFiles } from '../../services/reconcileToc'
import { BaseCommand } from '../BaseCommand'

import type { InitSubRepoInput } from '../../services/init-sub-repo'

function readCoreVersion(): string {
  const moduleDir = dirname(fileURLToPath(import.meta.url))
  let dir = moduleDir
  while (dir !== dirname(dir)) {
    const pkgPath = join(dir, 'package.json')
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as {
        name?: string
        version?: string
      }
      if (pkg.name === '@tnotesjs/core' && pkg.version) return pkg.version
    } catch {
      // continue walking up
    }
    dir = dirname(dir)
  }
  return '0.1.28'
}

export class InitSubRepoCommand extends BaseCommand {
  private rootPath: string

  constructor() {
    super('init-sub-repo')
    this.rootPath = process.cwd()
  }

  protected async run(): Promise<void> {
    if (isAlreadyInitialized(this.rootPath)) {
      const configPath = getInitializedConfigPath(this.rootPath)
      this.logger.info(
        `检测到 .tnotes.json 配置文件：${configPath}，当前仓库已经是一个 TNotes 知识库`,
      )
      return
    }

    this.logger.info('初始化 TNotes 子知识库')
    this.logger.info('')

    const input = await this.promptForInput()
    const ctx = buildInitContext(input)

    this.logger.info('')
    this.logger.info('即将创建以下知识库：')
    this.logger.info(`  仓库名：${ctx.repoName}`)
    this.logger.info(`  展示名：${ctx.displayName}`)
    this.logger.info(`  端口：${ctx.port}`)
    this.logger.info(`  描述：${ctx.description}`)
    this.logger.info('')

    const confirmed = await this.promptConfirm('确认初始化？ [Y/n] ')
    if (!confirmed) {
      this.logger.info('已取消初始化')
      return
    }

    const service = InitSubRepoService.fromModuleUrl(import.meta.url, this.rootPath)
    const result = service.writeScaffold(input)

    if (result.created.length > 0) {
      this.logger.success(`已创建 ${result.created.length} 个文件：`)
      for (const file of result.created) {
        this.logger.info(`  + ${file}`)
      }
    }

    if (result.updated.length > 0) {
      this.logger.success(`已更新 ${result.updated.length} 个文件：`)
      for (const file of result.updated) {
        this.logger.info(`  ~ ${file}`)
      }
    }

    if (result.skipped.length > 0) {
      this.logger.warn(`已跳过 ${result.skipped.length} 个已存在文件：`)
      for (const file of result.skipped) {
        this.logger.info(`  - ${file}`)
      }
    }

    getConfigManager().clearCache()

    try {
      this.logger.info('')
      this.logger.info('正在规范化 TOC.md 并生成 sidebar.json...')
      await reconcileTocFromFiles(ROOT_DIR_PATH)
      this.logger.success('sidebar.json 已生成')
    } catch (error) {
      this.logger.warn(
        `自动 update 失败（可稍后手动执行 pnpm tn:update）：${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    }

    this.logger.info('')
    this.logger.success('子知识库初始化完成！')
    this.logger.info('')
    this.logger.info('请手动完成以下步骤：')
    for (const [index, step] of buildManualSteps(ctx).entries()) {
      this.logger.info(`  ${index + 1}. ${step}`)
    }
  }

  private async promptForInput(): Promise<InitSubRepoInput> {
    const topic = await this.promptTopic()
    const displayName = await this.promptDisplayName(topic)
    const port = await this.promptPort()
    const description = await this.promptDescription()

    return {
      topic,
      displayName,
      port,
      description,
      repoUuid: uuidv4(),
      noteUuid: uuidv4(),
      coreVersion: readCoreVersion(),
    }
  }

  private async promptTopic(): Promise<string> {
    while (true) {
      const answer = await this.ask('请输入 topic（如 react，将生成 TNotes.react）: ')
      const error = validateTopic(answer)
      if (error) {
        this.logger.warn(error)
        continue
      }
      return answer.trim()
    }
  }

  private async promptDisplayName(topic: string): Promise<string> {
    const fallback = defaultDisplayName(topic)
    const answer = await this.ask(
      `请输入展示名（用于首页 hero，默认 ${fallback}）: `,
    )
    return answer.trim() || fallback
  }

  private async promptPort(): Promise<number> {
    const answer = await this.ask(`请输入 dev 端口（默认 ${DEFAULT_PORT}）: `)
    const { port, error } = validatePort(answer)
    if (error) this.logger.warn(error)
    return port
  }

  private async promptDescription(): Promise<string> {
    const answer = await this.ask(
      `请输入仓库描述（默认：${DEFAULT_DESCRIPTION}）: `,
    )
    return answer.trim() || DEFAULT_DESCRIPTION
  }

  private async promptConfirm(question: string): Promise<boolean> {
    const answer = await this.ask(question)
    const normalized = answer.trim().toLowerCase()
    return normalized === '' || normalized === 'y' || normalized === 'yes'
  }

  private ask(question: string): Promise<string> {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    })

    return new Promise((resolve) => {
      rl.question(question, (answer) => {
        rl.close()
        resolve(answer)
      })
    })
  }
}
