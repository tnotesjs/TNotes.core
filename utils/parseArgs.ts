/**
 * .vitepress/tnotes/utils/parseArgs.ts
 *
 * 轻量级命令行参数解析器
 * 替代 minimist，仅实现项目需要的功能
 */

interface ParsedArgs {
  /** 非选项参数 */
  _: string[]
  /** 选项参数 */
  [key: string]: boolean | string | string[]
}

/**
 * 解析命令行参数
 *
 * 支持的格式：
 * - `--flag`        → { flag: true }
 * - `--key=value`   → { key: 'value' }
 * - `--key value`   → { key: 'value' }（如果 value 不以 - 开头）
 * - `--no-flag`     → { flag: false }
 * - 其他参数        → 添加到 `_` 数组
 *
 * @param args 命令行参数数组（通常是 process.argv.slice(2)）
 * @returns 解析后的参数对象
 */
export function parseArgs(args: string[]): ParsedArgs {
  const result: ParsedArgs = { _: [] }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]

    // 处理 --key=value 格式
    if (arg.startsWith('--') && arg.includes('=')) {
      const eqIndex = arg.indexOf('=')
      const key = arg.slice(2, eqIndex)
      const value = arg.slice(eqIndex + 1)
      result[key] = value
      continue
    }

    // 处理 --no-flag 格式（否定形式）
    if (arg.startsWith('--no-')) {
      const key = arg.slice(5)
      result[key] = false
      continue
    }

    // 处理 --flag 或 --key value 格式
    if (arg.startsWith('--')) {
      const key = arg.slice(2)
      const next = args[i + 1]

      // 如果下一个参数存在且不是选项，则作为值
      if (next !== undefined && !next.startsWith('-')) {
        // 检查是否为布尔字符串
        if (next === 'true') {
          result[key] = true
          i++
        } else if (next === 'false') {
          result[key] = false
          i++
        } else {
          // 对于这个项目，所有选项都是布尔值
          // 所以这里保持 --flag 为 true，不消费下一个参数
          result[key] = true
        }
      } else {
        result[key] = true
      }
      continue
    }

    // 处理短选项 -x（目前项目未使用，但保留基础支持）
    if (arg.startsWith('-') && arg.length > 1 && !arg.startsWith('--')) {
      // 将 -abc 解析为 { a: true, b: true, c: true }
      const flags = arg.slice(1)
      for (const flag of flags) {
        result[flag] = true
      }
      continue
    }

    // 非选项参数
    result._.push(arg)
  }

  return result
}
