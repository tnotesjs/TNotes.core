/**
 * .vitepress/tnotes/vitepress/plugins/buildProgressPlugin.ts
 *
 * 构建进度插件 - 仅在 build 模式下显示真实进度
 *
 * 基于 vite-plugin-progress 源码简化实现
 * https://github.com/jeddygong/vite-plugin-progress
 */

import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
} from 'fs'
import { join } from 'path'

import type { Plugin } from 'vite'

/** 缓存目录和文件路径 */
const CACHE_DIR = join(process.cwd(), 'node_modules', '.tnotes-progress')
const CACHE_FILE = join(CACHE_DIR, 'build-cache.json')

/** 缓存数据结构 */
interface CacheData {
  transformCount: number
  chunkCount: number
  /** transform 阶段耗时占总构建时间的比例（0-1），用于下次按时间权重分配进度 */
  transformEndRatio?: number
}

/** 插件配置选项 */
interface BuildProgressOptions {
  width?: number
  complete?: string
  incomplete?: string
}

/**
 * 读取缓存数据
 */
function getCacheData(): CacheData {
  try {
    if (existsSync(CACHE_FILE)) {
      return JSON.parse(readFileSync(CACHE_FILE, 'utf-8'))
    }
  } catch {
    // 忽略错误
  }
  return { transformCount: 0, chunkCount: 0 }
}

/**
 * 写入缓存数据
 */
function setCacheData(data: CacheData): void {
  try {
    if (!existsSync(CACHE_DIR)) {
      mkdirSync(CACHE_DIR, { recursive: true })
    }
    writeFileSync(CACHE_FILE, JSON.stringify(data), 'utf-8')
  } catch {
    // 忽略错误
  }
}

// ============ 全局状态 ============
let globalStartTime = 0
let globalTransformCount = 0
let globalChunkCount = 0
let globalHasError = false
let globalIsBuilding = false
let globalOutDir = ''
let globalLastPercent = 0
let globalLastLoggedPercent = -1 // 非 TTY 环境下上次输出的百分比区间，初始为 -1 以便第一次输出
let globalLastOutputTime = 0 // 非 TTY 环境下上次输出时间戳，用于时间节流
let globalTransformEndTime = 0 // transform 阶段结束时间戳
let globalLastHookTime = 0 // 最后一次 Vite hook 触发时间
let globalStallTimer: ReturnType<typeof setInterval> | null = null

/** 检测是否支持单行刷新（交互式终端） */
const isTTY = !!(process.stdout.isTTY && process.stderr.isTTY)

/** 检测是否在 CI 环境中运行 */
const isCI = !!(
  process.env.CI ||
  process.env.GITHUB_ACTIONS ||
  process.env.GITLAB_CI ||
  process.env.CIRCLECI ||
  process.env.TRAVIS ||
  process.env.JENKINS_URL
)

/** 是否使用单行刷新模式（TTY 且非 CI） */
const useSingleLineMode = isTTY && !isCI

// 保存原始输出函数
let originalStdoutWrite: typeof process.stdout.write | null = null
let originalStderrWrite: typeof process.stderr.write | null = null

/**
 * 拦截输出
 */
function interceptOutput() {
  if (originalStdoutWrite) return

  originalStdoutWrite = process.stdout.write.bind(process.stdout)
  originalStderrWrite = process.stderr.write.bind(process.stderr)

  const filter = (chunk: string | Uint8Array): boolean => {
    const str = chunk.toString()
    // 只允许我们的输出
    return (
      str.includes('🔨') ||
      str.includes('✅ 构建成功') ||
      str.includes('❌ 构建失败') ||
      str.includes('📁') ||
      str.includes('📊') ||
      str.includes('📦') ||
      str.includes('⏱️') ||
      str.includes('\x1b[2K') // 允许清屏指令
    )
  }

  process.stdout.write = ((
    chunk: string | Uint8Array,
    encodingOrCallback?: BufferEncoding | ((err?: Error | null) => void),
    callback?: (err?: Error | null) => void,
  ): boolean => {
    if (filter(chunk)) {
      return originalStdoutWrite!(chunk, encodingOrCallback as any, callback)
    }
    if (typeof encodingOrCallback === 'function') encodingOrCallback()
    else if (callback) callback()
    return true
  }) as typeof process.stdout.write

  process.stderr.write = ((
    chunk: string | Uint8Array,
    encodingOrCallback?: BufferEncoding | ((err?: Error | null) => void),
    callback?: (err?: Error | null) => void,
  ): boolean => {
    const str = chunk.toString()
    // 允许进度条和真正的错误
    if (filter(chunk) || str.toLowerCase().includes('error')) {
      return originalStderrWrite!(chunk, encodingOrCallback as any, callback)
    }
    if (typeof encodingOrCallback === 'function') encodingOrCallback()
    else if (callback) callback()
    return true
  }) as typeof process.stderr.write
}

/**
 * 恢复输出
 */
function restoreOutput() {
  if (originalStdoutWrite) {
    process.stdout.write = originalStdoutWrite
    originalStdoutWrite = null
  }
  if (originalStderrWrite) {
    process.stderr.write = originalStderrWrite
    originalStderrWrite = null
  }
}

/**
 * 渲染进度条
 */
function renderProgress(
  percent: number,
  transforms: string,
  chunks: string,
  width: number,
  complete: string,
  incomplete: string,
  isFinal: boolean = false,
) {
  if (!originalStderrWrite) return

  // 非单行模式下，只在 10% 间隔输出进度，并附加时间节流避免多行显示相同耗时
  if (!useSingleLineMode && !isFinal) {
    const currentPercent = Math.floor(percent * 100)
    const currentBucket = Math.floor(currentPercent / 10) * 10
    const now = Date.now()
    if (
      currentBucket <= globalLastLoggedPercent ||
      now - globalLastOutputTime < 500
    ) {
      return
    }
    globalLastLoggedPercent = currentBucket
    globalLastOutputTime = now
  }

  const filled = Math.floor(percent * width)
  const empty = width - filled
  const bar = complete.repeat(filled) + incomplete.repeat(empty)
  const percentStr = (percent * 100).toFixed(0).padStart(3, ' ')
  const elapsed = ((Date.now() - globalStartTime) / 1000).toFixed(1)

  // 格式: Building [...] 100% | Transforms: x/y | Chunks: x/y | Time: xs
  // 单行模式使用回车覆盖，否则直接换行
  const prefix = useSingleLineMode ? '\r\x1b[2K' : ''
  const ending = isFinal || !useSingleLineMode ? '\n' : ''
  const line = `${prefix}Building [${bar}] ${percentStr}% | Transforms: ${transforms} | Chunks: ${chunks} | Time: ${elapsed}s${ending}`
  originalStderrWrite(line)
}

/**
 * 创建构建进度插件
 */
export function buildProgressPlugin(
  options: BuildProgressOptions = {},
): Plugin {
  const { width = 40, complete = '█', incomplete = '░' } = options

  const cache = getCacheData()
  const hasCache = cache.transformCount > 0

  return {
    name: 'tnotes-build-progress',
    enforce: 'pre',
    apply: 'build',

    config(config, { command }) {
      if (command === 'build') {
        config.logLevel = 'silent'

        if (!globalIsBuilding) {
          globalIsBuilding = true
          globalStartTime = Date.now()
          globalTransformCount = 0
          globalChunkCount = 0
          globalHasError = false
          globalLastPercent = 0
          globalLastLoggedPercent = -1
          globalLastOutputTime = 0
          globalTransformEndTime = 0
          globalLastHookTime = Date.now()
          globalOutDir = config.build?.outDir || 'dist'

          interceptOutput()

          // 停滞填充计时器：当 Vite hook 超过 2 秒没触发时（如 VitePress 渲染页面阶段），
          // 缓慢推进进度条，避免长时间卡住不动
          globalStallTimer = setInterval(() => {
            if (
              !globalIsBuilding ||
              globalLastPercent <= 0 ||
              globalLastPercent >= 0.98
            )
              return
            const now = Date.now()
            if (now - globalLastHookTime < 2000) return

            // 每次推进剩余距离的 2%，形成自然减速曲线
            const remaining = 0.98 - globalLastPercent
            globalLastPercent += remaining * 0.02

            const transformsStr = hasCache
              ? `${globalTransformCount}/${cache.transformCount * 2}`
              : `${globalTransformCount}`
            const chunksStr = hasCache
              ? `${globalChunkCount}/${cache.chunkCount * 2}`
              : `${globalChunkCount}`

            renderProgress(
              globalLastPercent,
              transformsStr,
              chunksStr,
              width,
              complete,
              incomplete,
            )
          }, 1000)
        }
      }
    },

    transform(_code, _id) {
      globalTransformCount++
      globalLastHookTime = Date.now()

      // 根据缓存的时间比例确定 transform 阶段在进度条中的权重
      // 例如 transform 占总时间 37% → 进度条 0-36%，chunk 占 63% → 进度条 36-98%
      const transformWeight =
        hasCache && cache.transformEndRatio != null
          ? Math.max(0.1, Math.min(0.85, cache.transformEndRatio * 0.98))
          : 0.85

      if (hasCache) {
        const totalTransforms = cache.transformCount * 2
        globalLastPercent = Math.min(
          transformWeight,
          (globalTransformCount / totalTransforms) * transformWeight,
        )
      } else {
        // 无缓存模式：渐近曲线平滑逼近上限
        const k = 500
        globalLastPercent = Math.min(
          transformWeight,
          (transformWeight * globalTransformCount) / (globalTransformCount + k),
        )
      }

      const transformsStr = hasCache
        ? `${globalTransformCount}/${cache.transformCount * 2}`
        : `${globalTransformCount}`
      const chunksStr = hasCache
        ? `${globalChunkCount}/${cache.chunkCount * 2}`
        : `${globalChunkCount}`

      renderProgress(
        globalLastPercent,
        transformsStr,
        chunksStr,
        width,
        complete,
        incomplete,
      )

      return null
    },

    renderChunk() {
      globalChunkCount++
      globalLastHookTime = Date.now()

      // 记录 transform 阶段结束时间（第一次进入 renderChunk）
      if (!globalTransformEndTime) {
        globalTransformEndTime = Date.now()
      }

      const transformWeight =
        hasCache && cache.transformEndRatio != null
          ? Math.max(0.1, Math.min(0.85, cache.transformEndRatio * 0.98))
          : 0.85
      const chunkWeight = 0.98 - transformWeight

      if (hasCache) {
        const totalChunks = cache.chunkCount * 2
        globalLastPercent = Math.min(
          0.98,
          transformWeight + (globalChunkCount / totalChunks) * chunkWeight,
        )
      } else {
        globalLastPercent = Math.max(globalLastPercent, transformWeight)
        globalLastPercent = Math.min(0.98, globalLastPercent + 0.00005)
      }

      const transformsStr = hasCache
        ? `${globalTransformCount}/${cache.transformCount * 2}`
        : `${globalTransformCount}`
      const chunksStr = hasCache
        ? `${globalChunkCount}/${cache.chunkCount * 2}`
        : `${globalChunkCount}`

      renderProgress(
        globalLastPercent,
        transformsStr,
        chunksStr,
        width,
        complete,
        incomplete,
      )

      return null
    },

    buildEnd(err) {
      if (err) {
        globalHasError = true
      }
    },

    closeBundle() {
      // 延迟检测是否是最后一次 closeBundle
      setTimeout(() => {
        if (!globalIsBuilding) return

        if (globalStallTimer) {
          clearInterval(globalStallTimer)
          globalStallTimer = null
        }

        const elapsed = ((Date.now() - globalStartTime) / 1000).toFixed(1)

        // 显示 100%，带换行
        // 100% 时应该显示总数/总数，而不是实际计数/总数
        const totalTransforms = hasCache
          ? cache.transformCount * 2
          : globalTransformCount
        const totalChunks = hasCache ? cache.chunkCount * 2 : globalChunkCount
        const transformsStr = `${totalTransforms}/${totalTransforms}`
        const chunksStr = `${totalChunks}/${totalChunks}`

        renderProgress(
          1,
          transformsStr,
          chunksStr,
          width,
          complete,
          incomplete,
          true,
        )

        restoreOutput()

        if (!globalHasError) {
          const totalTime = Date.now() - globalStartTime
          const transformTime = globalTransformEndTime
            ? globalTransformEndTime - globalStartTime
            : totalTime
          setCacheData({
            transformCount: Math.floor(globalTransformCount / 2),
            chunkCount: Math.floor(globalChunkCount / 2),
            transformEndRatio: transformTime / totalTime,
          })

          console.log(`🔨 Rollup 打包完成`)
          console.log(`   📁 输出目录: ${globalOutDir}`)
          console.log(`   ⏱️  耗时: ${elapsed}s`)
          console.log(`   ⏳ VitePress 正在渲染页面...`)
        } else {
          console.log(`\n❌ 构建失败，请检查错误信息`)
        }

        globalIsBuilding = false
      }, 500)
    },
  }
}
