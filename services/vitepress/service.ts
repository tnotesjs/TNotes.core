/**
 * .vitepress/tnotes/services/VitepressService.ts
 *
 * VitePress 服务 - 封装 VitePress 开发服务器相关的业务逻辑
 */
import { spawn } from 'child_process'

import { ConfigManager } from '../../config/ConfigManager'
import { ROOT_DIR_PATH } from '../../config/constants'
import { ProcessManager } from '../../core'
import { logger, isPortInUse, killPortProcess, waitForPort } from '../../utils'

/** VitePress 服务启动结果 */
export interface VitepressStartResult {
  pid: number
  version: string
  /** 启动耗时（毫秒） */
  elapsed: number
}

export class VitepressService {
  /** VitePress 开发服务器默认端口 */
  static readonly DEFAULT_DEV_PORT = 5173

  /** VitePress 预览服务器默认端口 */
  static readonly DEFAULT_PREVIEW_PORT = 4173

  /** 开发服务器进程 ID 后缀 */
  private static readonly PROCESS_ID_DEV_SUFFIX = 'vitepress-dev'

  /** 预览服务器进程 ID 后缀 */
  private static readonly PROCESS_ID_PREVIEW_SUFFIX = 'vitepress-preview'

  /** 服务启动超时时间（毫秒） */
  private static readonly SERVER_STARTUP_TIMEOUT = 60000

  /** 端口释放等待超时时间（毫秒） */
  private static readonly PORT_RELEASE_TIMEOUT = 3000

  /** 进程清理等待时间（毫秒） */
  private static readonly PROCESS_CLEANUP_DELAY = 3000

  /** 显示启动服务状态行间隔（毫秒） */
  private static readonly SERVER_STATUS_LINE_INTERVAL = 1000

  /** 默认包管理器 */
  private static readonly DEFAULT_PACKAGE_MANAGER = 'pnpm'

  private processManager: ProcessManager
  private configManager: ConfigManager

  constructor() {
    this.processManager = new ProcessManager()
    this.configManager = ConfigManager.getInstance()
  }

  /**
   * 启动 VitePress 开发服务器
   * @returns 启动结果（服务就绪后返回），失败时返回 undefined
   */
  async startServer(): Promise<VitepressStartResult | undefined> {
    const port =
      this.configManager.get('port') || VitepressService.DEFAULT_DEV_PORT
    const repoName = this.configManager.get('repoName')
    const processId = `${repoName}-${VitepressService.PROCESS_ID_DEV_SUFFIX}`

    // 检查内存中的进程管理器（清理残留）
    if (
      this.processManager.has(processId) &&
      this.processManager.isRunning(processId)
    ) {
      this.processManager.kill(processId)
      await new Promise((resolve) =>
        setTimeout(resolve, VitepressService.PROCESS_CLEANUP_DELAY),
      )
    }

    // 检查目标端口是否被占用，如果是则强制清理
    if (isPortInUse(port)) {
      logger.warn(`端口 ${port} 被占用，正在清理...`)
      killPortProcess(port)
      const available = await waitForPort(
        port,
        VitepressService.PORT_RELEASE_TIMEOUT,
      )

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
      this.configManager.get('packageManager') ||
      VitepressService.DEFAULT_PACKAGE_MANAGER
    const args = ['vitepress', 'dev', '--port', port.toString()]

    const processInfo = this.processManager.spawn(processId, pm, args, {
      cwd: ROOT_DIR_PATH,
      stdio: ['inherit', 'pipe', 'pipe'], // stdin 继承，stdout/stderr 管道捕获
    })

    // 等待服务就绪，显示启动状态
    const serverInfo = await this.waitForServerReady(processInfo.process)

    if (!processInfo.pid) return undefined

    return {
      pid: processInfo.pid,
      version: serverInfo.version,
      elapsed: serverInfo.elapsed,
    }
  }

  /**
   * 等待服务就绪，显示启动状态
   * @param childProcess - 子进程
   */
  private waitForServerReady(
    childProcess: import('child_process').ChildProcess,
  ): Promise<{ version: string; elapsed: number }> {
    return new Promise((resolve) => {
      const startTime = Date.now()
      let serverReady = false
      let version = ''

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
        process.stderr.write(`⏳ 启动中: 已用 ${seconds}s...`)
      }, VitepressService.SERVER_STATUS_LINE_INTERVAL)

      // 处理输出
      const handleOutput = (data: string) => {
        const text = data.toString()

        // 提取版本号
        const versionMatch = text.match(/vitepress v([\d.]+)/)
        if (versionMatch) {
          version = versionMatch[1]
        }

        // 检测服务就绪
        if (
          !serverReady &&
          (text.includes('Local:') ||
            text.includes('http://localhost') ||
            (text.includes('➜') && text.includes('Local')))
        ) {
          serverReady = true
          clearInterval(statusTimer)

          // 清除状态行
          process.stderr.clearLine?.(0)
          process.stderr.cursorTo?.(0)

          const elapsed = Date.now() - startTime

          // 延迟 resolve，让后续输出完成
          setTimeout(() => resolve({ version, elapsed }), 200)
          return
        }

        // 服务就绪前只显示错误信息
        if (!serverReady) {
          if (
            text.includes('error') ||
            text.includes('Error') ||
            (text.includes('Port') && text.includes('is in use'))
          ) {
            process.stderr.clearLine?.(0)
            process.stderr.cursorTo?.(0)
            process.stdout.write(data)
          }
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
          logger.warn('启动超时，请检查 VitePress 输出')
          resolve({ version, elapsed: VitepressService.SERVER_STARTUP_TIMEOUT })
        }
      }, VitepressService.SERVER_STARTUP_TIMEOUT)
    })
  }

  /**
   * 构建生产版本
   */
  build(): Promise<void> {
    return new Promise((resolve, reject) => {
      const pm =
        this.configManager.get('packageManager') ||
        VitepressService.DEFAULT_PACKAGE_MANAGER
      const child = spawn(pm, ['vitepress', 'build'], {
        cwd: ROOT_DIR_PATH,
        shell: true,
        stdio: ['inherit', 'pipe', 'pipe'],
        env: {
          ...process.env,
          NODE_OPTIONS: (process.env.NODE_OPTIONS || '').includes(
            '--max-old-space-size',
          )
            ? process.env.NODE_OPTIONS
            : [process.env.NODE_OPTIONS, '--max-old-space-size=4096']
                .filter(Boolean)
                .join(' '),
        },
      })

      // 过滤 VitePress 的 spinner 和状态输出，但保留我们的进度条
      const filterOutput = (data: Buffer) => {
        const str = data.toString()

        // 允许我们的进度条和结果输出
        if (
          str.includes('🔨') ||
          str.includes('✅') ||
          str.includes('❌ 构建失败') ||
          str.includes('📁') ||
          str.includes('📊') ||
          str.includes('📦') ||
          str.includes('⏱️') ||
          str.includes('⏳') ||
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
    const processId = `${repoName}-${VitepressService.PROCESS_ID_PREVIEW_SUFFIX}`
    const pm =
      this.configManager.get('packageManager') ||
      VitepressService.DEFAULT_PACKAGE_MANAGER
    const args = ['vitepress', 'preview']
    const previewPort = VitepressService.DEFAULT_PREVIEW_PORT

    // 检查端口是否被占用
    if (isPortInUse(previewPort)) {
      logger.warn(`端口 ${previewPort} 已被占用，正在尝试清理...`)
      const killed = killPortProcess(previewPort)

      if (killed) {
        // 等待端口释放
        const available = await waitForPort(
          previewPort,
          VitepressService.PORT_RELEASE_TIMEOUT,
        )
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

    const processInfo = this.processManager.spawn(processId, pm, args, {
      cwd: ROOT_DIR_PATH,
      stdio: 'inherit',
    })

    return processInfo.pid
  }
}
