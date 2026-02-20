/**
 * .vitepress/tnotes/vitepress/plugins/buildProgressPlugin.ts
 *
 * 构建进度插件 - 仅在 build 模式下显示真实进度
 *
 * 基于 vite-plugin-progress 源码简化实现
 * https://github.com/jeddygong/vite-plugin-progress
 */
import type { Plugin } from 'vite'
import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
} from 'fs'
import { join } from 'path'

/** 缓存目录和文件路径 */
const CACHE_DIR = join(process.cwd(), 'node_modules', '.tnotes-progress')
const CACHE_FILE = join(CACHE_DIR, 'build-cache.json')

/** 缓存数据结构 */
interface CacheData {
  transformCount: number
  chunkCount: number
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

/**
 * 扫描源目录文件数量
 */
function countSourceFiles(srcDir: string): number {
  let count = 0
  const extensions = /\.(vue|ts|js|jsx|tsx|css|scss|sass|styl|less|md)$/i

  const scan = (dir: string) => {
    try {
      const entries = readdirSync(dir, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = join(dir, entry.name)
        if (
          entry.isDirectory() &&
          !entry.name.startsWith('.') &&
          entry.name !== 'node_modules'
        ) {
          scan(fullPath)
        } else if (entry.isFile() && extensions.test(entry.name)) {
          count++
        }
      }
    } catch {
      // 忽略错误
    }
  }

  scan(srcDir)
  return count
}

// ============ 全局状态 ============
let globalStartTime = 0
let globalTransformCount = 0
let globalChunkCount = 0
let globalHasError = false
let globalIsBuilding = false
let globalOutDir = ''
let globalLastPercent = 0
let globalFileCount = 0
let globalLastLoggedPercent = -1 // 非 TTY 环境下上次输出的百分比区间，初始为 -1 以便第一次输出

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
    encodingOrCallback?: BufferEncoding | ((err?: Error) => void),
    callback?: (err?: Error) => void
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
    encodingOrCallback?: BufferEncoding | ((err?: Error) => void),
    callback?: (err?: Error) => void
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
  isFinal: boolean = false
) {
  if (!originalStderrWrite) return

  // 非单行模式下，只在 10% 间隔输出进度，避免日志过多
  if (!useSingleLineMode && !isFinal) {
    const currentPercent = Math.floor(percent * 100)
    const currentBucket = Math.floor(currentPercent / 10) * 10
    if (currentBucket <= globalLastLoggedPercent) {
      return
    }
    globalLastLoggedPercent = currentBucket
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
  options: BuildProgressOptions = {}
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
          globalOutDir = config.build?.outDir || 'dist'

          if (!hasCache) {
            globalFileCount = countSourceFiles(process.cwd())
          }

          interceptOutput()
        }
      }
    },

    transform(_code, id) {
      globalTransformCount++

      if (hasCache) {
        const total = cache.transformCount * 2 + cache.chunkCount * 2
        globalLastPercent = Math.min(0.9, globalTransformCount / total)
      } else {
        if (!id.includes('node_modules') && globalLastPercent < 0.7) {
          globalLastPercent = Math.min(
            0.7,
            globalTransformCount / (globalFileCount * 4)
          )
        }
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
        incomplete
      )

      return null
    },

    renderChunk() {
      globalChunkCount++

      if (hasCache) {
        const total = cache.transformCount * 2 + cache.chunkCount * 2
        globalLastPercent = Math.min(
          0.98,
          (globalTransformCount + globalChunkCount) / total
        )
      } else {
        if (globalLastPercent < 0.98) {
          globalLastPercent = Math.min(0.98, globalLastPercent + 0.003)
        }
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
        incomplete
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
          true
        )

        restoreOutput()

        if (!globalHasError) {
          setCacheData({
            transformCount: Math.floor(globalTransformCount / 2),
            chunkCount: Math.floor(globalChunkCount / 2),
          })

          console.log(`\n✅ 构建成功！`)
          console.log(`   📁 输出目录: ${globalOutDir}`)
          console.log(`   ⏱️  耗时: ${elapsed}s`)
        } else {
          console.log(`\n❌ 构建失败，请检查错误信息`)
        }

        globalIsBuilding = false
      }, 500)
    },
  }
}
