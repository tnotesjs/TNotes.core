/**
 * .vitepress/tnotes/core/ProcessManager.ts
 *
 * 进程管理器 - 管理子进程的生命周期（单例模式）
 */
import { spawn, ChildProcess } from 'child_process'
import type { SpawnOptions } from 'child_process'
import { Logger } from '../utils'

/** 进程信息接口 */
interface ProcessInfo {
  id: string
  pid?: number
  command: string
  args: string[]
  startTime: number
  process: ChildProcess
}

/**
 * 进程管理器类（单例）
 */
export class ProcessManager {
  private static instance: ProcessManager | null = null
  private processes: Map<string, ProcessInfo> = new Map()
  private logger: Logger

  private constructor() {
    this.logger = new Logger({ prefix: 'process' })

    // 清理进程在程序退出时
    process.on('exit', () => {
      this.killAll()
    })

    process.on('SIGINT', () => {
      this.killAll()
      process.exit(0)
    })

    process.on('SIGTERM', () => {
      this.killAll()
      process.exit(0)
    })
  }

  /**
   * 获取单例实例
   */
  static getInstance(): ProcessManager {
    if (!ProcessManager.instance) {
      ProcessManager.instance = new ProcessManager()
    }
    return ProcessManager.instance
  }

  /**
   * 启动进程
   * @param id - 进程ID
   * @param command - 命令
   * @param args - 参数列表
   * @param options - spawn 选项
   * @returns ProcessInfo
   */
  spawn(
    id: string,
    command: string,
    args: string[] = [],
    options?: SpawnOptions,
  ): ProcessInfo {
    // 如果进程已存在，先停止
    if (this.processes.has(id)) {
      this.logger.warn(`进程 ${id} 已存在，先停止旧进程`)
      this.kill(id)
    }

    /**
     * 不在这里输出命令日志，由调用方输出更合适，可以看到服务执行过程中的一些实时 log，比如 hmr
     */
    const proc = spawn(command, args, {
      stdio: 'inherit',
      shell: true,
      ...options,
    })

    const processInfo: ProcessInfo = {
      id,
      pid: proc.pid,
      command,
      args,
      startTime: Date.now(),
      process: proc,
    }

    this.processes.set(id, processInfo)

    // 监听进程退出
    proc.on('exit', (code, signal) => {
      this.logger.info(`进程 ${id} 已退出 (code: ${code}, signal: ${signal})`)
      this.processes.delete(id)
    })

    proc.on('error', (err) => {
      this.logger.error(`进程 ${id} 出错: ${err.message}`)
      this.processes.delete(id)
    })

    return processInfo
  }

  /**
   * 停止进程
   * @param id - 进程ID
   * @param signal - 信号（默认为 SIGTERM）
   * @returns 是否成功停止
   */
  kill(id: string, signal: NodeJS.Signals = 'SIGTERM'): boolean {
    const processInfo = this.processes.get(id)
    if (!processInfo) {
      this.logger.warn(`进程 ${id} 不存在`)
      return false
    }

    this.logger.info(`停止进程: ${id} (PID: ${processInfo.pid})`)

    try {
      const killed = processInfo.process.kill(signal)
      if (killed) {
        this.processes.delete(id)
        return true
      }
      return false
    } catch (error) {
      this.logger.error(`停止进程 ${id} 失败: ${error}`)
      return false
    }
  }

  /**
   * 检查进程是否存在
   * @param id - 进程ID
   * @returns 是否存在
   */
  has(id: string): boolean {
    return this.processes.has(id)
  }

  /**
   * 检查进程是否在运行
   * @param id - 进程 ID
   * @returns 是否在运行
   */
  isRunning(id: string): boolean {
    const processInfo = this.processes.get(id)
    if (!processInfo) return false

    // 检查进程是否还活着
    try {
      // 发送信号 0 不会真正发送信号，只是检查进程是否存在
      return process.kill(processInfo.pid!, 0)
    } catch {
      return false
    }
  }

  /**
   * 停止所有进程
   * @param signal - 信号（默认为 SIGTERM）
   */
  killAll(signal: NodeJS.Signals = 'SIGTERM'): void {
    if (this.processes.size === 0) {
      return
    }

    this.logger.info(`停止所有进程 (${this.processes.size} 个)`)

    for (const [id, processInfo] of this.processes) {
      try {
        processInfo.process.kill(signal)
        this.logger.info(`已停止进程: ${id}`)
      } catch (error) {
        this.logger.error(`停止进程 ${id} 失败: ${error}`)
      }
    }

    this.processes.clear()
  }
}
