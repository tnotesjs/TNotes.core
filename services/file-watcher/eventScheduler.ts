/**
 * .vitepress/tnotes/services/file-watcher/eventScheduler.ts
 *
 * 事件调度：防抖 + 批量检测 + 队列
 */

import type { WatchEvent } from './internal'

/** 默认防抖延迟（毫秒） */
const DEFAULT_DEBOUNCE_MS = 1000

/**
 * 默认批量更新检测窗口（毫秒）
 *
 * - 如果在窗口时间内检测到超过阈值个文件变更，则判定为批量更新
 * - 暂定是 1s 内 3 个文件变更的阈值，正常编写笔记的情况下，1s 内不会超过 3 个文件同时变更，通常不会误判
 * - 当批量更新的行为被检测到之后，会暂停监听服务（窗口 + 缓冲时间）后再恢复
 */
const DEFAULT_BATCH_WINDOW_MS = 1000

/** 默认批量更新阈值（文件数） */
const DEFAULT_BATCH_THRESHOLD = 3

/** 默认批量更新安全缓冲（毫秒） */
const DEFAULT_BATCH_BUFFER_MS = 2000

interface EventSchedulerConfig {
  /** 防抖延迟（毫秒），默认 1000 */
  debounceMs?: number
  /** 批量更新检测窗口（毫秒），默认 1000 */
  batchWindowMs?: number
  /** 批量更新阈值（文件数），默认 3 */
  batchThreshold?: number
  /** 批量更新安全缓冲（毫秒），默认 2000 */
  batchBufferMs?: number
  /** 当事件队列需要刷新处理时的回调函数 */
  onFlush: (events: WatchEvent[]) => void
  /** 检测到批量更新时暂停监听服务的回调函数 */
  onPauseForBatch: () => void
  /** 批量更新结束后恢复监听服务的回调函数 */
  onResumeAfterBatch: () => void
  /** 重新初始化调度器的回调函数 */
  reinit: () => void
}

export class EventScheduler {
  /** 待处理的文件变更事件队列 */
  private pendingEvents: Map<string, WatchEvent> = new Map()

  /** 防抖定时器 */
  private updateTimer: NodeJS.Timeout | null = null

  /** 批量更新恢复定时器 */
  private batchResumeTimer: NodeJS.Timeout | null = null

  /** 记录最近的变更时间戳 */
  private recentChanges: number[] = []

  /** 标记是否正在更新，避免循环触发 - 类似一把更新行为锁 */
  private isUpdating = false

  private readonly debounceMs: number
  private readonly batchWindowMs: number
  private readonly batchThreshold: number
  private readonly batchBufferMs: number

  constructor(private config: EventSchedulerConfig) {
    this.debounceMs = config.debounceMs ?? DEFAULT_DEBOUNCE_MS
    this.batchWindowMs = config.batchWindowMs ?? DEFAULT_BATCH_WINDOW_MS
    this.batchThreshold = config.batchThreshold ?? DEFAULT_BATCH_THRESHOLD
    this.batchBufferMs = config.batchBufferMs ?? DEFAULT_BATCH_BUFFER_MS
  }

  /**
   * 设置更新状态锁，用于防止在执行耗时更新操作时被新的文件变更事件打断
   *
   * @param flag - true 表示正在更新（锁定），false 表示更新完成（解锁）
   */
  setUpdating(flag: boolean) {
    this.isUpdating = flag
  }

  /**
   * 获取当前是否处于更新锁定状态
   *
   * @returns true 表示正在执行更新操作（事件处理被暂停），false 表示空闲可处理新事件
   */
  getUpdating() {
    return this.isUpdating
  }

  /**
   * 将文件变更事件加入待处理队列，并启动防抖定时器
   *
   * - 若同一文件路径的事件已存在，则忽略重复事件（去重）
   * - 每次新事件都会重置防抖计时器，确保在变更停止后才触发处理
   *
   * @param event 文件变更事件
   */
  enqueue(event: WatchEvent) {
    // 事件去重：同一路径的变更只保留一次，降低抖动
    if (this.pendingEvents.has(event.path)) return
    this.pendingEvents.set(event.path, event)
    if (this.updateTimer) clearTimeout(this.updateTimer)
    this.updateTimer = setTimeout(() => this.flush(), this.debounceMs)
  }

  /**
   * 立即触发事件队列的处理（防抖到期或手动调用）
   *
   * - 若当前正在更新（isUpdating 为 true），则跳过以避免重复处理
   * - 清空待处理事件队列，并通过 onFlush 回调交由上层服务处理
   * - 处理开始后会锁定更新状态，防止处理过程中被新事件打断
   */
  flush() {
    if (this.isUpdating) return
    if (this.pendingEvents.size === 0) return
    const events = Array.from(this.pendingEvents.values())
    this.pendingEvents.clear()
    this.isUpdating = true
    this.config.onFlush(events)
  }

  /**
   * 记录当前变更时间并检测是否触发批量更新模式
   *
   * - 维护一个滑动时间窗口（BATCH_UPDATE_WINDOW_MS）内的变更记录
   * - 若短时间内（1秒内）变更次数达到阈值（BATCH_UPDATE_THRESHOLD = 3），则判定为批量操作
   * - 触发批量模式后：
   *   1. 清空当前待处理事件队列，避免重复处理
   *   2. 锁定更新状态（isUpdating = true）
   *   3. 暂停监听服务，并在延迟（窗口 + 缓冲时间）后自动恢复
   *
   * @param now 当前时间戳（默认使用 Date.now()）
   * @returns true 表示已触发批量更新模式，false 表示仍处于普通监听模式
   */
  recordChangeAndDetectBatch(now: number = Date.now()): boolean {
    // 记录近期变更时间戳，用于检测“短时间高频”场景并切换到批量模式
    this.recentChanges.push(now)
    this.recentChanges = this.recentChanges.filter(
      (t) => now - t < this.batchWindowMs,
    )

    if (this.recentChanges.length < this.batchThreshold) return false

    this.pendingEvents.clear()
    this.recentChanges = []
    this.isUpdating = true
    this.config.onPauseForBatch()

    this.batchResumeTimer = setTimeout(() => {
      // 批量结束后重建状态并恢复监听
      this.batchResumeTimer = null
      this.isUpdating = false
      this.config.reinit()
      this.config.onResumeAfterBatch()
    }, this.batchWindowMs + this.batchBufferMs)

    return true
  }

  /**
   * 清理所有定时器，释放资源
   *
   * 在服务停止时调用，防止定时器在服务销毁后仍然触发回调
   */
  clearTimers(): void {
    if (this.updateTimer) {
      clearTimeout(this.updateTimer)
      this.updateTimer = null
    }
    if (this.batchResumeTimer) {
      clearTimeout(this.batchResumeTimer)
      this.batchResumeTimer = null
    }
    this.pendingEvents.clear()
    this.recentChanges = []
  }
}
