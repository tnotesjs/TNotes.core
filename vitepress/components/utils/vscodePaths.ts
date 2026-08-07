/**
 * vitepress/components/utils/vscodePaths.ts
 *
 * 将站点内路径解析为本地 IDE 可打开的文件路径与 URL。
 * NOTES_DIR 通常配置为仓库下的 notes 目录（如 .../TNotes.introduction/notes）。
 */

export type LocalIdeId = 'vscode' | 'cursor'

export const DEFAULT_LOCAL_IDE: LocalIdeId = 'vscode'

const IDE_SCHEMES: Record<LocalIdeId, string> = {
  vscode: 'vscode',
  cursor: 'cursor',
}

export function getRepoRootPath(notesDir: string): string {
  const normalized = notesDir.replace(/[/\\]+$/, '')
  if (/[/\\]notes$/i.test(normalized)) {
    return normalized.replace(/[/\\]notes$/i, '')
  }
  return normalized
}

export function resolveNoteReadmePath(
  notesDir: string,
  relativePath: string,
): string | null {
  if (!notesDir || !relativePath) return null

  let linkPath = relativePath.replace(/^\/+/, '')

  if (linkPath === 'README.md' || linkPath === 'README') {
    const repoRoot = getRepoRootPath(notesDir)
    const sep = repoRoot.includes('\\') ? '\\' : '/'
    return `${repoRoot}${sep}README.md`
  }

  if (linkPath.startsWith('notes/')) {
    linkPath = linkPath.slice('notes/'.length)
  }

  linkPath = linkPath
    .replace(/\/README\.md$/i, '')
    .replace(/\/README$/i, '')

  const decodedFolder = linkPath
    .split('/')
    .map((segment) => decodeURIComponent(segment))
    .join('/')

  const base = notesDir.replace(/[/\\]+$/, '')
  const sep = base.includes('\\') ? '\\' : '/'
  const folderPath = decodedFolder.split('/').join(sep)

  return `${base}${sep}${folderPath}${sep}README.md`
}

export function normalizeLocalIde(value: string | null | undefined): LocalIdeId {
  return value === 'cursor' ? 'cursor' : DEFAULT_LOCAL_IDE
}

export function toIdeFileUrl(
  filePath: string,
  ide: LocalIdeId = DEFAULT_LOCAL_IDE,
): string {
  const scheme = IDE_SCHEMES[normalizeLocalIde(ide)]
  return `${scheme}://file/${encodeURI(filePath)}`
}

/** @deprecated 使用 toIdeFileUrl(filePath, 'vscode') */
export function toVscodeFileUrl(filePath: string): string {
  return toIdeFileUrl(filePath, 'vscode')
}
