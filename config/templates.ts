/**
 * .vitepress/tnotes/config/templates.ts
 *
 * 模板定义
 */
// import { v4 as uuidv4 } from 'uuid'
// import type { NoteConfig } from '../types'

/**
 * 生成笔记一级标题
 * @param noteIndex - 笔记索引
 * @param title - 笔记标题
 * @param repoUrl - 仓库URL
 * @returns 格式化的一级标题
 */
export function generateNoteTitle(
  noteIndex: string,
  title: string,
  repoUrl: string,
): string {
  const dirName = `${noteIndex}. ${title}`
  const encodedDirName = encodeURIComponent(dirName)
  return `# [${dirName}](${repoUrl}/${encodedDirName})`
}
