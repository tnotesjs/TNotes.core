/**
 * .vitepress/tnotes/services/VitepressService.ts
 *
 * VitePress 服务 - 封装 VitePress 开发服务器相关的业务逻辑
 */
import { spawn } from 'child_process'
import { ProcessManager, NoteManager } from '../../core'
import { ConfigManager } from '../../config/ConfigManager'
import { logger, isPortInUse, killPortProcess, waitForPort } from '../../utils'
import { ROOT_DIR_PATH } from '../../config/constants'

/** VitePress 开发服务器默认端口 */
const VITEPRESS_DEV_PORT = 5173

/** VitePress 预览服务器默认端口 */
const VITEPRESS_PREVIEW_PORT = 4173

/** 开发服务器进程 ID 后缀 */
const PROCESS_ID_DEV_SUFFIX = 'vitepress-dev'

/** 预览服务器进程 ID 后缀 */
const PROCESS_ID_PREVIEW_SUFFIX = 'vitepress-preview'

/** 服务启动超时时间（毫秒） */
const SERVER_STARTUP_TIMEOUT = 60000

/** 端口释放等待超时时间（毫秒） */
const PORT_RELEASE_TIMEOUT = 3000

/** 进程清理等待时间（毫秒） */
const PROCESS_CLEANUP_DELAY = 3000

/** 显示启动服务状态行间隔（毫秒） */
const SERVER_STATUS_LINE_INTERVAL = 1000

/** 默认包管理器 */
const DEFAULT_PACKAGE_MANAGER = 'pnpm'

export class VitepressService {
  private processManager: ProcessManager
  private configManager: ConfigManager
  private noteManager: NoteManager

  constructor() {
    this.processManager = ProcessManager.getInstance()
    this.configManager = ConfigManager.getInstance()
    this.noteManager = NoteManager.getInstance()
  }

  /**
   * 启动 VitePress 开发服务器
   * @returns 进程 ID（服务就绪后返回）
   */
  async startServer(): Promise<number | undefined> {
    const port = this.configManager.get('port') || VITEPRESS_DEV_PORT
    const repoName = this.configManager.get('repoName')
    const processId = `${repoName}-${PROCESS_ID_DEV_SUFFIX}`

    // 检查内存中的进程管理器（清理残留）
    if (
      this.processManager.has(processId) &&
      this.processManager.isRunning(processId)
    ) {
      this.processManager.kill(processId)
      await new Promise((resolve) => setTimeout(resolve, PROCESS_CLEANUP_DELAY))
    }

    // 检查目标端口是否被占用，如果是则强制清理
    if (isPortInUse(port)) {
      logger.warn(`端口 ${port} 被占用，正在清理...`)
      killPortProcess(port)
      const available = await waitForPort(port, PORT_RELEASE_TIMEOUT)

      if (available) {
        logger.info(`端口 ${port} 已释放，继续启动服务`)
      } else {
        logger.warn(
          `端口 ${port} 未确认释放，仍将尝试启动；如启动失败，请手动清理该端口`,
        )
      }
    }

    // 启动 VitePress 开发服务器
    const pm =
      this.configManager.get('packageManager') || DEFAULT_PACKAGE_MANAGER
    const args = ['vitepress', 'dev', '--port', port.toString()]

    // 预扫描笔记数量，并在启动 VitePress 之前检测冲突
    const noteCountResult = this.noteManager.countNotes()

    if (noteCountResult.conflicts.length > 0) {
      logger.error('⚠️  检测到重复的笔记编号，服务启动已终止！')
      for (const { index, dirNames } of noteCountResult.conflicts) {
        logger.error(`   编号 ${index} 被以下笔记重复使用：`)
        dirNames.forEach((dirName) => {
          logger.error(`      - ${dirName}`)
        })
      }
      logger.error(
        '\n请检查并删除/重命名重复的笔记文件夹，确保每个笔记编号唯一！\n',
      )
      process.exit(1)
    }

    const processInfo = this.processManager.spawn(processId, pm, args, {
      cwd: ROOT_DIR_PATH,
      stdio: ['inherit', 'pipe', 'pipe'], // stdin 继承，stdout/stderr 管道捕获
    })

    // 等待服务就绪，显示启动状态
    await this.waitForServerReady(processInfo.process, noteCountResult.unique)

    return processInfo.pid
  }

  /**
   * 等待服务就绪，显示启动状态
   * @param childProcess - 子进程
   * @param noteCount - 笔记数量
   */
  private waitForServerReady(
    childProcess: import('child_process').ChildProcess,
    noteCount: number,
  ): Promise<void> {
    return new Promise((resolve) => {
      const startTime = Date.now()
      let serverReady = false

      // 定时器：显示启动状态（真实的已用时间）
      const statusTimer = setInterval(() => {
        if (serverReady) {
          clearInterval(statusTimer)
          return
        }

        const elapsed = Date.now() - startTime
        const seconds = (elapsed / 1000).toFixed(0)
        // 使用 stderr 输出，避免与 VitePress 输出混在一起
        process.stderr.clearLine?.(0)
        process.stderr.cursorTo?.(0)
        process.stderr.write(
          `⏳ 启动中: 共 ${noteCount} 篇笔记，已用 ${seconds}s...`,
        )
      }, SERVER_STATUS_LINE_INTERVAL)

      // 处理输出
      const handleOutput = (data: string) => {
        const text = data.toString()

        // 检测服务就绪
        if (
          !serverReady &&
          (text.includes('Local:') ||
            text.includes('http://localhost') ||
            (text.includes('➜') && text.includes('Local')))
        ) {
          serverReady = true
          clearInterval(statusTimer)

          // 清除状态行，显示完成信息
          process.stderr.clearLine?.(0)
          process.stderr.cursorTo?.(0)
          const elapsed = Date.now() - startTime
          const seconds = (elapsed / 1000).toFixed(1)
          console.log(
            `✅ 服务已就绪 - 共 ${noteCount} 篇笔记，启动耗时 ${seconds}s\n`,
          )

          // 显示 VitePress 输出
          process.stdout.write(data)

          // 延迟 resolve，让后续输出完成
          setTimeout(resolve, 200)
          return
        }

        // 服务就绪前隐藏大部分输出，只显示关键信息
        if (!serverReady) {
          if (
            text.includes('vitepress v') ||
            text.includes('error') ||
            text.includes('Error') ||
            (text.includes('Port') && text.includes('is in use'))
          ) {
            process.stderr.clearLine?.(0)
            process.stderr.cursorTo?.(0)
            process.stdout.write(data)
          }
        } else {
          // 服务就绪后直接输出
          process.stdout.write(data)
        }
      }

      // 监听输出
      if (childProcess.stdout) {
        childProcess.stdout.setEncoding('utf8')
        childProcess.stdout.on('data', handleOutput)
      }

      if (childProcess.stderr) {
        childProcess.stderr.setEncoding('utf8')
        childProcess.stderr.on('data', handleOutput)
      }

      // 超时处理
      setTimeout(() => {
        if (!serverReady) {
          serverReady = true
          clearInterval(statusTimer)
          process.stderr.clearLine?.(0)
          process.stderr.cursorTo?.(0)
          console.log('⚠️  启动超时，请检查 VitePress 输出')
          resolve()
        }
      }, SERVER_STARTUP_TIMEOUT)
    })
  }

  /**
   * 构建生产版本
   */
  async build(): Promise<void> {
    logger.info('正在构建 VitePress 站点...\n')

    try {
      await this.runBuildWithProgress()
      logger.info('构建完成')
    } catch (error) {
      logger.error('构建失败', error)
      throw error
    }
  }

  /**
   * 运行构建命令并过滤输出
   */
  private runBuildWithProgress(): Promise<void> {
    return new Promise((resolve, reject) => {
      const pm =
        this.configManager.get('packageManager') || DEFAULT_PACKAGE_MANAGER
      const child = spawn(pm, ['vitepress', 'build'], {
        cwd: ROOT_DIR_PATH,
        shell: true,
        stdio: ['inherit', 'pipe', 'pipe'],
      })

      // 过滤 VitePress 的 spinner 和状态输出，但保留我们的进度条
      const filterOutput = (data: Buffer) => {
        const str = data.toString()

        // 允许我们的进度条和结果输出
        if (
          str.includes('🔨') ||
          str.includes('✅ 构建成功') ||
          str.includes('❌ 构建失败') ||
          str.includes('📁') ||
          str.includes('📊') ||
          str.includes('📦') ||
          str.includes('⏱️') ||
          str.includes('Building [') ||
          str.includes('error') ||
          str.includes('Error')
        ) {
          process.stdout.write(data)
          return
        }

        // 过滤掉 VitePress 的 spinner 和状态输出
        // 包括: ⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏ spinner 字符, ✓ 完成标记, vitepress 版本信息等
        if (
          /^[\s⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏✓\r\n]*$/.test(str) ||
          str.includes('building client + server') ||
          str.includes('rendering pages') ||
          str.includes('generating sitemap') ||
          str.includes('build complete in') ||
          str.includes('vitepress v')
        ) {
          return // 静默这些输出
        }

        // 其他输出也静默（插件已经在内部拦截了）
      }

      child.stdout?.on('data', filterOutput)
      child.stderr?.on('data', filterOutput)

      child.on('error', (err: Error) => {
        reject(err)
      })

      child.on('close', (code: number) => {
        if (code === 0) {
          resolve()
        } else {
          reject(new Error(`Command failed with code ${code}`))
        }
      })
    })
  }

  /**
   * 预览构建后的站点
   */
  async preview(): Promise<number | undefined> {
    const repoName = this.configManager.get('repoName')
    const processId = `${repoName}-${PROCESS_ID_PREVIEW_SUFFIX}`
    const pm =
      this.configManager.get('packageManager') || DEFAULT_PACKAGE_MANAGER
    const args = ['vitepress', 'preview']
    const previewPort = VITEPRESS_PREVIEW_PORT

    // 检查端口是否被占用
    if (isPortInUse(previewPort)) {
      logger.warn(`端口 ${previewPort} 已被占用，正在尝试清理...`)
      const killed = killPortProcess(previewPort)

      if (killed) {
        // 等待端口释放
        const available = await waitForPort(previewPort, PORT_RELEASE_TIMEOUT)
        if (!available) {
          logger.error(`端口 ${previewPort} 释放超时，请手动清理`)
          return undefined
        }
        logger.info(`端口 ${previewPort} 已释放`)
      } else {
        logger.error(
          `无法清理端口 ${previewPort}，请手动执行: taskkill /F /PID <PID>`,
        )
        return undefined
      }
    }

    logger.info(`执行命令：${pm} ${args.join(' ')}`)
    logger.info('正在启动预览服务...')

    const processInfo = this.processManager.spawn(processId, pm, args, {
      cwd: ROOT_DIR_PATH,
      stdio: 'inherit',
    })

    logger.info(`预览服务已启动 (PID: ${processInfo.pid})`)
    return processInfo.pid
  }
}
