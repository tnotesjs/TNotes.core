/**
 * .vitepress/tnotes/utils/runCommand.ts
 *
 * 运行命令的工具函数
 */
import { exec } from 'child_process'

/**
 * 使用 exec 执行命令
 * @param command - 要执行的命令
 * @param dir - 执行目录
 * @returns Promise<string> 命令输出
 */
export async function runCommand(
  command: string,
  dir: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    exec(command, { cwd: dir }, (error, stdout, stderr) => {
      if (error) {
        console.error(`处理 ${dir} 时出错：${stderr}`)
        reject(error)
      } else {
        resolve(stdout.trim())
      }
    })
  })
}
