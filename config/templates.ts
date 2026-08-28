/**
 * config/templates.ts
 *
 * 模板定义
 */

/**
 * 新增笔记 README.md 正文模板（不含一级标题）
 */
export const NEW_NOTES_README_MD_TEMPLATE = `
<!-- region:toc -->

- [1. 本节内容](#1-本节内容)

<!-- endregion:toc -->

## 1. 本节内容

- todo
`

/**
 * 获取新增笔记 README.md 正文
 */
export function getNewNoteReadmeBody(): string {
  return NEW_NOTES_README_MD_TEMPLATE
}

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
