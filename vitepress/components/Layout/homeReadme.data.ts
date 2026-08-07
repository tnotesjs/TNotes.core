/**
 * vitepress/components/Layout/homeReadme.data.ts
 */
import fs from 'node:fs'
import path from 'node:path'

const rootPath = process.cwd()

interface ReadmeData {
  fileContent: string
  doneNotesID: string[]
  doneNotesLen: number
  totalNotesLen: number
}

export default {
  watch: [path.resolve(rootPath, 'README.md'), path.resolve(rootPath, 'notes')],
  load(watchedFiles: string[]): ReadmeData {
    let readmeData: ReadmeData = {
      fileContent: '',
      doneNotesID: [],
      doneNotesLen: 0,
      totalNotesLen: 0,
    }

    watchedFiles.forEach((file) => {
      if (file.endsWith('README.md')) {
        const fileContent = fs.readFileSync(file, 'utf-8')
        const doneNotesID = getDoneNotesID(fileContent)
        const doneNotesLen = doneNotesID.length

        // 计算总笔记数
        const notesDir = path.join(path.dirname(file), 'notes')
        const totalNotesLen = getTotalNotesCount(notesDir)

        readmeData = {
          fileContent,
          doneNotesID,
          doneNotesLen,
          totalNotesLen,
        }
      }
    })
    return readmeData
  },
}

/**
 * 获取 notes 目录下的笔记总数
 * @param notesDir notes 目录路径
 * @returns 笔记总数
 */
function getTotalNotesCount(notesDir: string): number {
  try {
    if (!fs.existsSync(notesDir)) return 0

    const dirs = fs.readdirSync(notesDir, { withFileTypes: true })
    // 统计符合格式 "0001. xxx" 的目录
    return dirs.filter(
      (dirent) => dirent.isDirectory() && /^\d{4}\./.test(dirent.name),
    ).length
  } catch (error) {
    console.error(`获取笔记总数失败:`, error)
    return 0
  }
}

/**
 * 返回已完成的笔记的 ID 列表
 * @param fileContent 文件内容
 * @returns 已完成的笔记的 ID 列表
 */
function getDoneNotesID(fileContent: string): string[] {
  const matches = fileContent.match(/- \[x\]\s\[(\d{4})\./g)
  return matches
    ? [...new Set(matches.map((match) => match.slice(-5, -1)))]
    : []
}
