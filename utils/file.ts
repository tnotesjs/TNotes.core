/**
 * .vitepress/tnotes/utils/file.ts
 *
 * 文件操作工具函数
 */
import fs from 'fs'

/**
 * 删除整个目录
 * @param dir - 要删除的目录路径
 */
export function deleteDirectory(dir: string): void {
  try {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true })
      console.log(`✅ 已删除目录：${dir}`)
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error(`❌ 删除目录失败：${dir}: ${errorMessage}`)
  }
}

/**
 * 确保目录存在
 * @param dir - 目录路径
 */
export async function ensureDirectory(dir: string): Promise<void> {
  if (!fs.existsSync(dir)) {
    await fs.promises.mkdir(dir, { recursive: true })
  }
}
