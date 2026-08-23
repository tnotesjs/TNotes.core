import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'

import {
  buildSidebarFromTocTree,
  parseTocToTree,
} from '../utils/tocHelpers'

import type { WorkspacePaths } from './paths'
import type {
  KnowledgeBaseSnapshot,
  WorkspaceDiagnostic,
  WorkspaceKnowledgeBaseConfig,
  WorkspaceNoteConfig,
  WorkspaceNoteSummary,
} from './types'
import type { NoteInfo } from '../types/note'

const NOTE_DIRECTORY_PATTERN = /^(\d{4})\.\s*(.+)$/
const CURRENT_SCHEMA_VERSION = 1

function digest(...values: Array<string | Buffer>): string {
  const hash = createHash('sha256')
  for (const value of values) {
    hash.update(value)
    hash.update('\0')
  }
  return hash.digest('hex')
}

async function readText(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, 'utf8')
  } catch {
    return null
  }
}

function parseJsonObject<T extends Record<string, unknown>>(
  content: string,
): T | null {
  try {
    const value = JSON.parse(content) as unknown
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      ? (value as T)
      : null
  } catch {
    return null
  }
}

function noteInfoFromSummary(note: WorkspaceNoteSummary): NoteInfo {
  return {
    index: note.index,
    path: note.directoryPath,
    dirName: note.dirName,
    readmePath: note.readmePath,
    configPath: note.configPath,
    config: note.config,
  }
}

export interface ScannedWorkspace {
  snapshot: KnowledgeBaseSnapshot
  configText: string | null
  tocText: string | null
}

export async function scanWorkspace(
  paths: WorkspacePaths,
): Promise<ScannedWorkspace> {
  const diagnostics: WorkspaceDiagnostic[] = []
  let rootIsDirectory = false
  try {
    rootIsDirectory = (await fs.stat(paths.root)).isDirectory()
  } catch {
    // Handled as a diagnostic below.
  }
  if (!rootIsDirectory) {
    diagnostics.push({
      code: 'ROOT_NOT_DIRECTORY',
      message: '知识库根目录不存在或不是目录',
      severity: 'error',
      path: paths.root,
    })
  }

  const configText = await readText(paths.config)
  let config: WorkspaceKnowledgeBaseConfig | null = null
  if (configText === null) {
    diagnostics.push({
      code: 'CONFIG_MISSING',
      message: '缺少知识库配置 .tnotes.json',
      severity: 'error',
      path: paths.config,
    })
  } else {
    config = parseJsonObject<WorkspaceKnowledgeBaseConfig>(configText)
    if (!config) {
      diagnostics.push({
        code: 'CONFIG_INVALID_JSON',
        message: '知识库配置不是有效的 JSON 对象',
        severity: 'error',
        path: paths.config,
      })
    } else {
      if (typeof config.id !== 'string' || !config.id.trim()) {
        diagnostics.push({
          code: 'CONFIG_ID_MISSING',
          message: '知识库配置缺少稳定的 id',
          severity: 'error',
          path: paths.config,
        })
      }
      if (typeof config.repoName !== 'string' || !config.repoName.trim()) {
        diagnostics.push({
          code: 'CONFIG_REPO_NAME_MISSING',
          message: '知识库配置缺少 repoName',
          severity: 'error',
          path: paths.config,
        })
      }
    }
  }

  let notesDirectoryExists = false
  try {
    notesDirectoryExists = (await fs.stat(paths.notes)).isDirectory()
  } catch {
    // Handled below.
  }
  if (!notesDirectoryExists) {
    diagnostics.push({
      code: 'NOTES_DIRECTORY_MISSING',
      message: '缺少 notes 目录',
      severity: 'error',
      path: paths.notes,
    })
  }

  const tocText = await readText(paths.toc)
  if (tocText === null) {
    diagnostics.push({
      code: 'TOC_MISSING',
      message: '缺少目录真相源 TOC.md',
      severity: 'error',
      path: paths.toc,
    })
  }

  const notes: WorkspaceNoteSummary[] = []
  const usedIndexes = new Map<string, string>()
  const usedIds = new Map<string, string>()
  if (notesDirectoryExists) {
    const entries = await fs.readdir(paths.notes, { withFileTypes: true })
    entries.sort((left, right) => left.name.localeCompare(right.name))
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue
      const match = NOTE_DIRECTORY_PATTERN.exec(entry.name)
      if (!match) continue

      const [, index, rawTitle] = match
      const title = rawTitle.trim()
      const directoryPath = path.join(paths.notes, entry.name)
      const readmePath = path.join(directoryPath, 'README.md')
      const configPath = path.join(directoryPath, '.tnotes.json')
      const readme = await readText(readmePath)
      const noteConfigText = await readText(configPath)

      if (readme === null) {
        diagnostics.push({
          code: 'NOTE_README_MISSING',
          message: `笔记 ${entry.name} 缺少 README.md`,
          severity: 'error',
          path: readmePath,
        })
        continue
      }
      if (noteConfigText === null) {
        diagnostics.push({
          code: 'NOTE_CONFIG_MISSING',
          message: `笔记 ${entry.name} 缺少 .tnotes.json`,
          severity: 'error',
          path: configPath,
        })
        continue
      }

      const noteConfig = parseJsonObject<WorkspaceNoteConfig>(noteConfigText)
      if (!noteConfig || typeof noteConfig.id !== 'string' || !noteConfig.id) {
        diagnostics.push({
          code: 'NOTE_CONFIG_INVALID',
          message: `笔记 ${entry.name} 的配置无法解析或缺少 id`,
          severity: 'error',
          path: configPath,
        })
        continue
      }

      const existingIndex = usedIndexes.get(index)
      if (existingIndex) {
        diagnostics.push({
          code: 'NOTE_INDEX_DUPLICATE',
          message: `笔记编号 ${index} 重复：${existingIndex}、${entry.name}`,
          severity: 'error',
          path: directoryPath,
        })
      } else {
        usedIndexes.set(index, entry.name)
      }
      const existingId = usedIds.get(noteConfig.id)
      if (existingId) {
        diagnostics.push({
          code: 'NOTE_ID_DUPLICATE',
          message: `笔记 id ${noteConfig.id} 重复：${existingId}、${entry.name}`,
          severity: 'error',
          path: configPath,
        })
      } else {
        usedIds.set(noteConfig.id, entry.name)
      }

      notes.push({
        uuid: noteConfig.id,
        index,
        title,
        dirName: entry.name,
        directoryPath,
        readmePath,
        configPath,
        config: noteConfig,
        revision: digest(entry.name, readme, noteConfigText),
      })
    }
  }

  const noteInfos = notes.map(noteInfoFromSummary)
  const toc = tocText ? parseTocToTree(tocText.split('\n'), noteInfos) : []
  const sidebar = buildSidebarFromTocTree(toc, noteInfos, {
    sidebarShowNoteId: config?.sidebarShowNoteId ?? true,
    sidebarIsCollapsed: true,
  })

  const schemaVersion = config?.schemaVersion
  const futureSchema =
    typeof schemaVersion === 'number' && schemaVersion > CURRENT_SCHEMA_VERSION
  if (futureSchema) {
    diagnostics.push({
      code: 'FUTURE_SCHEMA',
      message: `知识库 schemaVersion ${schemaVersion} 高于当前支持版本 ${CURRENT_SCHEMA_VERSION}`,
      severity: 'error',
      path: paths.config,
    })
  }

  const health = futureSchema
    ? { status: 'future-schema' as const, diagnostics }
    : diagnostics.some((diagnostic) => diagnostic.severity === 'error')
      ? { status: 'invalid' as const, diagnostics }
      : { status: 'ready' as const, diagnostics }

  const id =
    config && typeof config.id === 'string' && config.id.trim()
      ? config.id
      : `path-${digest(paths.root).slice(0, 24)}`
  const revision = digest(
    paths.root,
    configText ?? '',
    tocText ?? '',
    ...notes.map((note) => `${note.uuid}:${note.revision}`),
  )

  return {
    snapshot: {
      id,
      rootPath: paths.root,
      config,
      health,
      toc,
      sidebar,
      notes,
      revision,
    },
    configText,
    tocText,
  }
}

export function toNoteInfo(note: WorkspaceNoteSummary): NoteInfo {
  return noteInfoFromSummary(note)
}
