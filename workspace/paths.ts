import path from 'node:path'

import { WorkspaceError } from './errors'

export interface WorkspacePaths {
  root: string
  config: string
  toc: string
  notes: string
  sidebar: string
  packageJson: string
}

export function createWorkspacePaths(rootPath: string): WorkspacePaths {
  if (!rootPath || !path.isAbsolute(rootPath)) {
    throw new WorkspaceError(
      'INVALID_PATH',
      '知识库路径必须是非空的绝对路径',
      { rootPath },
    )
  }

  const root = path.normalize(path.resolve(rootPath))
  return {
    root,
    config: path.join(root, '.tnotes.json'),
    toc: path.join(root, 'TOC.md'),
    notes: path.join(root, 'notes'),
    sidebar: path.join(root, 'sidebar.json'),
    packageJson: path.join(root, 'package.json'),
  }
}

export function assertPathInside(parent: string, target: string): void {
  const relative = path.relative(parent, target)
  if (
    relative === '' ||
    (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))
  ) {
    return
  }

  throw new WorkspaceError('INVALID_PATH', '目标路径超出允许范围', {
    parent,
    target,
  })
}

export function sanitizeFileName(fileName: string): string {
  const value = fileName.trim()
  if (
    !value ||
    value === '.' ||
    value === '..' ||
    value.includes('/') ||
    value.includes('\\') ||
    value.includes('\0')
  ) {
    throw new WorkspaceError('INVALID_PATH', '附件文件名不合法', {
      fileName,
    })
  }
  return value
}
