/**
 * localSearchReindexLogic.ts
 *
 * 纯函数：笔记 README 路径判定（可单测）
 */

import path from 'node:path'

function slash(value: string): string {
  return value.replace(/\\/g, '/')
}

const NOTE_README_RE =
  /(?:^|[\\/])notes[\\/](\d{4}\.[^\\/]+)[\\/]README\.md$/i

export function isNoteReadmePath(
  filePath: string,
  ignoreDirNames: string[] = [],
): boolean {
  const normalized = filePath.replace(/\\/g, '/')
  const match = NOTE_README_RE.exec(normalized)
  if (!match) return false

  const folderName = match[1]
  if (!folderName) return false

  return !ignoreDirNames.some((dir) => folderName === dir)
}

export function getDocIdFromFile(input: {
  srcDir: string
  base: string
  cleanUrls: boolean
  rewrites?: Record<string, string>
  absoluteOrRelativeFile: string
}): string {
  // A knowledge base can be indexed on a different host platform in tests,
  // build workers or cached metadata. Select the path implementation from the
  // value instead of assuming the current Node.js platform.
  const pathApi = /^[a-zA-Z]:[\\/]/.test(
    input.absoluteOrRelativeFile || input.srcDir,
  )
    ? path.win32
    : path
  const absoluteFile = pathApi.isAbsolute(input.absoluteOrRelativeFile)
    ? input.absoluteOrRelativeFile
    : pathApi.join(input.srcDir, input.absoluteOrRelativeFile)

  let relFile = slash(pathApi.relative(input.srcDir, absoluteFile))
  if (input.rewrites?.[relFile]) {
    relFile = input.rewrites[relFile]
  }

  let id = slash(path.posix.join(input.base, relFile))
  id = id.replace(/(^|\/)index\.md$/, '$1')
  id = id.replace(/\.md$/, input.cleanUrls ? '' : '.html')
  return id
}
