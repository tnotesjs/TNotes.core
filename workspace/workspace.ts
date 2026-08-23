import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'


import { writeFilesAtomically } from './atomic'
import { WorkspaceError } from './errors'
import { MutationQueue } from './mutationQueue'
import {
  assertPathInside,
  createWorkspacePaths,
  sanitizeFileName,
} from './paths'
import { scanWorkspace, toNoteInfo } from './scanner'
import { getNewNoteReadmeBody } from '../config/templates'
import { formatTNotesNote } from '../markdown/noteFormatter'
import {
  adjustTocLineIndexAfterSubtreeRemoval,
  buildFolderTocLine,
  buildSidebarFromTocTree,
  buildTocLine,
  collectNoteIndexesInSubtree,
  findFolderLineIndex,
  findTocLineIndex,
  getTocEntrySubtreeRange,
  parseTocLine,
  parseTocToTree,
  processTocEmptyLines,
  renameFolderLine,
  TOC_INDENT_SPACES,
} from '../utils/tocHelpers'

import type { WorkspacePaths } from './paths'
import type {
  AttachmentResult,
  ChangedFile,
  CreateNoteInput,
  CreateTocGroupInput,
  CreateWorkspaceOptions,
  DeleteTocEntryInput,
  DeleteTocEntryPreview,
  KnowledgeBaseSnapshot,
  MoveTocEntryInput,
  MutationResult,
  NoteDocument,
  NotePlacement,
  RenameNoteInput,
  RenameTocGroupInput,
  SaveNoteInput,
  TNotesWorkspace,
  TocEntryRef,
  UpdateNoteConfigInput,
  WorkspaceKnowledgeBaseConfig,
  WorkspaceLogger,
  WorkspaceNoteConfig,
  WorkspaceNoteSummary,
  WriteAttachmentInput,
} from './types'
import type { NoteInfo } from '../types/note'

const NOTE_CONFIG_FIELD_ORDER = [
  'bilibili',
  'tnotes',
  'yuque',
  'done',
  'category',
  'enableDiscussions',
  'description',
  'id',
] as const

function validateTitle(title: string): string {
  const value = title.trim()
  if (
    !value ||
    /[\\/\0\r\n]/.test(value) ||
    /[. ]$/.test(value) ||
    /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(value)
  ) {
    throw new WorkspaceError('INVALID_TITLE', '笔记或分组标题不合法', {
      title,
    })
  }
  return value
}

function serializeNoteConfig(config: WorkspaceNoteConfig): string {
  const record = config as Record<string, unknown>
  const sorted: Record<string, unknown> = {}
  for (const field of NOTE_CONFIG_FIELD_ORDER) {
    if (field in record) sorted[field] = record[field]
  }
  for (const [key, value] of Object.entries(record)) {
    if (!(key in sorted)) sorted[key] = value
  }
  return `${JSON.stringify(sorted, null, 2)}\n`
}

function normalizeTocContent(lines: string[]): string {
  const content = processTocEmptyLines(lines).join('\n')
  return content.endsWith('\n') ? content : `${content}\n`
}

function toNoteInfos(notes: WorkspaceNoteSummary[]): NoteInfo[] {
  return notes.map(toNoteInfo)
}

function sidebarContent(
  tocLines: string[],
  notes: WorkspaceNoteSummary[],
  config: WorkspaceKnowledgeBaseConfig,
): string {
  const noteInfos = toNoteInfos(notes)
  const tree = parseTocToTree(tocLines, noteInfos)
  return JSON.stringify(
    buildSidebarFromTocTree(tree, noteInfos, {
      sidebarShowNoteId: config.sidebarShowNoteId ?? true,
      sidebarIsCollapsed: true,
    }),
    null,
    2,
  )
}

function requireConfig(
  snapshot: KnowledgeBaseSnapshot,
): WorkspaceKnowledgeBaseConfig {
  if (snapshot.health.status === 'future-schema') {
    throw new WorkspaceError(
      'WORKSPACE_READ_ONLY',
      '知识库由更新版本的 Core 创建，当前版本只允许读取',
    )
  }
  if (snapshot.health.status !== 'ready' || !snapshot.config) {
    throw new WorkspaceError('WORKSPACE_INVALID', '知识库配置异常，禁止修改', {
      diagnostics: snapshot.health.diagnostics,
    })
  }
  return snapshot.config
}

function findNote(
  snapshot: KnowledgeBaseSnapshot,
  noteUuid: string,
): WorkspaceNoteSummary {
  const note = snapshot.notes.find((item) => item.uuid === noteUuid)
  if (!note) {
    throw new WorkspaceError('NOTE_NOT_FOUND', `未找到笔记：${noteUuid}`, {
      noteUuid,
    })
  }
  return note
}

function assertRevision(actual: string, expected: string, subject: string) {
  if (actual !== expected) {
    throw new WorkspaceError(
      'REVISION_CONFLICT',
      `${subject} 已被其他程序修改，请先处理外部变更`,
      { actual, expected },
    )
  }
}

function allocateNoteIndex(notes: WorkspaceNoteSummary[]): string {
  const used = new Set(
    notes
      .map((note) => Number.parseInt(note.index, 10))
      .filter((value) => Number.isInteger(value) && value >= 1 && value <= 9999),
  )
  for (let index = 1; index <= 9999; index++) {
    if (!used.has(index)) return String(index).padStart(4, '0')
  }
  throw new WorkspaceError(
    'NOTE_INDEX_EXHAUSTED',
    '所有笔记编号（0001-9999）均已使用',
  )
}

function resolveEntryLine(
  lines: string[],
  snapshot: KnowledgeBaseSnapshot,
  entry: TocEntryRef,
): number {
  if (entry.type === 'line') {
    if (entry.tocLineIndex < 0 || entry.tocLineIndex >= lines.length) {
      throw new WorkspaceError('INVALID_TOC_ENTRY', 'TOC 行索引无效', {
        tocLineIndex: entry.tocLineIndex,
      })
    }
    return entry.tocLineIndex
  }
  if (entry.type === 'folder') {
    try {
      return findFolderLineIndex(lines, entry.folderPath)
    } catch (error) {
      throw new WorkspaceError('INVALID_TOC_ENTRY', '未找到 TOC 分组', {
        folderPath: entry.folderPath,
        cause: error instanceof Error ? error.message : String(error),
      })
    }
  }
  const note = findNote(snapshot, entry.noteUuid)
  try {
    return findTocLineIndex(lines, note.index)
  } catch (error) {
    throw new WorkspaceError('INVALID_TOC_ENTRY', '未在 TOC 中找到笔记', {
      noteUuid: entry.noteUuid,
      cause: error instanceof Error ? error.message : String(error),
    })
  }
}

function placementTargetLine(
  lines: string[],
  snapshot: KnowledgeBaseSnapshot,
  placement: Exclude<NotePlacement, { type: 'root' }>,
): number {
  if (placement.type === 'note') {
    return resolveEntryLine(lines, snapshot, {
      type: 'note',
      noteUuid: placement.targetNoteUuid,
    })
  }
  return resolveEntryLine(lines, snapshot, {
    type: 'folder',
    folderPath: placement.folderPath,
  })
}

function insertLineAtPlacement(
  lines: string[],
  snapshot: KnowledgeBaseSnapshot,
  placement: NotePlacement | undefined,
  buildLine: (indent: number) => string,
): void {
  const resolvedPlacement = placement ?? { type: 'root', placement: 'end' }
  if (resolvedPlacement.type === 'root') {
    if (resolvedPlacement.placement === 'start') {
      const firstContent = lines.findIndex((line) => parseTocLine(line).isMatch)
      lines.splice(firstContent >= 0 ? firstContent : lines.length, 0, buildLine(0))
    } else {
      let insertAt = lines.length
      while (insertAt > 0 && lines[insertAt - 1] === '') insertAt--
      lines.splice(insertAt, 0, buildLine(0))
    }
    return
  }

  const targetLine = placementTargetLine(lines, snapshot, resolvedPlacement)
  const target = parseTocLine(lines[targetLine])
  if (!target.isMatch) {
    throw new WorkspaceError('INVALID_TOC_ENTRY', '目标 TOC 条目无效')
  }
  if (resolvedPlacement.placement === 'inside') {
    const range = getTocEntrySubtreeRange(lines, targetLine)
    lines.splice(range.end, 0, buildLine(target.indentLevel + 1))
  } else if (resolvedPlacement.placement === 'before') {
    lines.splice(targetLine, 0, buildLine(target.indentLevel))
  } else {
    const range = getTocEntrySubtreeRange(lines, targetLine)
    lines.splice(range.end, 0, buildLine(target.indentLevel))
  }
}

function adjustIndent(lines: string[], delta: number): string[] {
  return lines.map((line) => {
    const parsed = parseTocLine(line)
    if (!parsed.isMatch) return line
    const indent = Math.max(0, parsed.indentLevel + delta)
    return `${' '.repeat(indent * TOC_INDENT_SPACES)}${line.trimStart()}`
  })
}

async function listFilesRecursively(directoryPath: string): Promise<string[]> {
  const result: string[] = []
  const entries = await fs.readdir(directoryPath, { withFileTypes: true })
  for (const entry of entries) {
    const entryPath = path.join(directoryPath, entry.name)
    if (entry.isDirectory()) {
      result.push(...(await listFilesRecursively(entryPath)))
    } else {
      result.push(entryPath)
    }
  }
  return result
}

export class Workspace implements TNotesWorkspace {
  readonly notes: TNotesWorkspace['notes']
  readonly toc: TNotesWorkspace['toc']
  readonly attachments: TNotesWorkspace['attachments']

  private readonly paths: WorkspacePaths
  private readonly logger: WorkspaceLogger
  private readonly queue = new MutationQueue()
  private readonly prettierByDefault: boolean
  private disposed = false

  constructor(options: CreateWorkspaceOptions) {
    this.paths = createWorkspacePaths(options.rootPath)
    this.logger = options.logger ?? {}
    this.prettierByDefault = options.format?.prettier ?? true

    this.notes = {
      read: (noteUuid) => this.readNote(noteUuid),
      save: (input) => this.saveNote(input),
      create: (input) => this.createNote(input),
      rename: (input) => this.renameNote(input),
      updateConfig: (input) => this.updateNoteConfig(input),
    }
    this.toc = {
      move: (input) => this.moveTocEntry(input),
      createGroup: (input) => this.createTocGroup(input),
      renameGroup: (input) => this.renameTocGroup(input),
      previewDelete: (entry) => this.previewDelete(entry),
      deleteEntry: (input) => this.deleteTocEntry(input),
      setDone: (input) => this.updateNoteConfig(input),
    }
    this.attachments = {
      writeLocal: (input) => this.writeLocalAttachment(input),
    }
  }

  async inspect(): Promise<KnowledgeBaseSnapshot> {
    this.assertActive()
    return (await scanWorkspace(this.paths)).snapshot
  }

  async refresh(): Promise<KnowledgeBaseSnapshot> {
    return this.inspect()
  }

  async reconcileTocCompletion(): Promise<
    MutationResult<KnowledgeBaseSnapshot>
  > {
    return this.queue.run(async () => {
      const scanned = await this.scanReady()
      const { snapshot, tocText } = scanned
      const config = requireConfig(snapshot)
      const lines = (tocText ?? '').split('\n')
      const completedByIndex = new Map<string, boolean>()
      for (const line of lines) {
        const parsed = parseTocLine(line)
        if (parsed.noteIndex && !completedByIndex.has(parsed.noteIndex)) {
          completedByIndex.set(parsed.noteIndex, parsed.completed)
        }
      }

      const changedFiles: ChangedFile[] = []
      const writes: Array<{ path: string; data: string }> = []
      const updatedNotes = snapshot.notes.map((note) => {
        const completed = completedByIndex.get(note.index)
        if (completed === undefined || completed === note.config.done) return note
        const updatedConfig = { ...note.config, done: completed }
        writes.push({ path: note.configPath, data: serializeNoteConfig(updatedConfig) })
        changedFiles.push({ path: note.configPath, kind: 'updated' })
        return { ...note, config: updatedConfig }
      })

      if (writes.length > 0) {
        writes.push({
          path: this.paths.sidebar,
          data: sidebarContent(lines, updatedNotes, config),
        })
        changedFiles.push({ path: this.paths.sidebar, kind: 'updated' })
        await writeFilesAtomically(writes)
      }
      const value = await this.inspect()
      return { value, changedFiles, snapshotRevision: value.revision }
    })
  }

  async dispose(): Promise<void> {
    if (this.disposed) return
    this.disposed = true
    await this.queue.dispose()
  }

  private assertActive(): void {
    if (this.disposed) {
      throw new WorkspaceError('WORKSPACE_DISPOSED', '工作区实例已经释放')
    }
  }

  private async scanReady() {
    this.assertActive()
    const scanned = await scanWorkspace(this.paths)
    requireConfig(scanned.snapshot)
    return scanned
  }

  private async readNote(noteUuid: string): Promise<NoteDocument> {
    const snapshot = await this.inspect()
    const note = findNote(snapshot, noteUuid)
    return { ...note, content: await fs.readFile(note.readmePath, 'utf8') }
  }

  private async saveNote(
    input: SaveNoteInput,
  ): Promise<MutationResult<NoteDocument>> {
    return this.queue.run(async () => {
      const { snapshot } = await this.scanReady()
      const config = requireConfig(snapshot)
      const note = findNote(snapshot, input.noteUuid)
      assertRevision(note.revision, input.expectedRevision, '笔记')
      const formatted = await formatTNotesNote({
        content: input.content,
        noteIndex: note.index,
        title: note.title,
        repoOwner: config.author,
        repoName: config.repoName,
        noteConfig: note.config,
        prettier: input.prettier ?? this.prettierByDefault,
      })
      const current = await fs.readFile(note.readmePath, 'utf8')
      const changedFiles: ChangedFile[] = []
      if (formatted.content !== current) {
        await writeFilesAtomically([
          { path: note.readmePath, data: formatted.content },
        ])
        changedFiles.push({ path: note.readmePath, kind: 'updated' })
      }
      const value = await this.readNote(input.noteUuid)
      const refreshed = await this.inspect()
      return { value, changedFiles, snapshotRevision: refreshed.revision }
    })
  }

  private async createNote(
    input: CreateNoteInput,
  ): Promise<MutationResult<NoteDocument>> {
    return this.queue.run(async () => {
      const { snapshot, tocText } = await this.scanReady()
      const config = requireConfig(snapshot)
      if (input.expectedSnapshotRevision) {
        assertRevision(
          snapshot.revision,
          input.expectedSnapshotRevision,
          '知识库目录',
        )
      }
      const title = validateTitle(input.title)
      const index = allocateNoteIndex(snapshot.notes)
      const dirName = `${index}. ${title}`
      const directoryPath = path.join(this.paths.notes, dirName)
      assertPathInside(this.paths.notes, directoryPath)
      try {
        await fs.mkdir(directoryPath)
      } catch (error) {
        throw new WorkspaceError('FILESYSTEM_ERROR', '无法创建笔记目录', {
          directoryPath,
          cause: error instanceof Error ? error.message : String(error),
        })
      }

      const noteConfig: WorkspaceNoteConfig = {
        bilibili: [],
        tnotes: [],
        yuque: [],
        done: false,
        enableDiscussions: input.config?.enableDiscussions ?? false,
        description: input.config?.description ?? '',
        id: randomUUID(),
      }
      const readmePath = path.join(directoryPath, 'README.md')
      const configPath = path.join(directoryPath, '.tnotes.json')
      const formatted = await formatTNotesNote({
        content: getNewNoteReadmeBody(),
        noteIndex: index,
        title,
        repoOwner: config.author,
        repoName: config.repoName,
        noteConfig,
        prettier: this.prettierByDefault,
      })
      const newNote: WorkspaceNoteSummary = {
        uuid: noteConfig.id,
        index,
        title,
        dirName,
        directoryPath,
        readmePath,
        configPath,
        config: noteConfig,
        revision: '',
      }
      const tocLines = (tocText ?? '').split('\n')
      insertLineAtPlacement(tocLines, snapshot, input.placement, (indent) =>
        buildTocLine(toNoteInfo(newNote), indent, false),
      )
      const updatedNotes = [...snapshot.notes, newNote]
      const normalizedToc = normalizeTocContent(tocLines)
      const normalizedLines = normalizedToc.split('\n')

      try {
        await writeFilesAtomically([
          { path: readmePath, data: formatted.content },
          { path: configPath, data: serializeNoteConfig(noteConfig) },
          { path: this.paths.toc, data: normalizedToc },
          {
            path: this.paths.sidebar,
            data: sidebarContent(normalizedLines, updatedNotes, config),
          },
        ])
      } catch (error) {
        await fs.rm(directoryPath, { recursive: true, force: true })
        throw error
      }

      const value = await this.readNote(noteConfig.id)
      const refreshed = await this.inspect()
      return {
        value,
        changedFiles: [
          { path: directoryPath, kind: 'created' },
          { path: readmePath, kind: 'created' },
          { path: configPath, kind: 'created' },
          { path: this.paths.toc, kind: 'updated' },
          { path: this.paths.sidebar, kind: 'updated' },
        ],
        snapshotRevision: refreshed.revision,
      }
    })
  }

  private async renameNote(
    input: RenameNoteInput,
  ): Promise<MutationResult<NoteDocument>> {
    return this.queue.run(async () => {
      const { snapshot, tocText } = await this.scanReady()
      const config = requireConfig(snapshot)
      const note = findNote(snapshot, input.noteUuid)
      assertRevision(note.revision, input.expectedRevision, '笔记')
      const title = validateTitle(input.title)
      const newDirName = `${note.index}. ${title}`
      if (newDirName === note.dirName) {
        const value = await this.readNote(note.uuid)
        return { value, changedFiles: [], snapshotRevision: snapshot.revision }
      }
      const newDirectoryPath = path.join(this.paths.notes, newDirName)
      assertPathInside(this.paths.notes, newDirectoryPath)
      try {
        await fs.access(newDirectoryPath)
        throw new WorkspaceError('INVALID_TITLE', '目标笔记目录已经存在', {
          newDirectoryPath,
        })
      } catch (error) {
        if (error instanceof WorkspaceError) throw error
      }

      const currentContent = await fs.readFile(note.readmePath, 'utf8')
      const formatted = await formatTNotesNote({
        content: currentContent,
        noteIndex: note.index,
        title,
        repoOwner: config.author,
        repoName: config.repoName,
        noteConfig: note.config,
        prettier: this.prettierByDefault,
      })
      const renamedNote: WorkspaceNoteSummary = {
        ...note,
        title,
        dirName: newDirName,
        directoryPath: newDirectoryPath,
        readmePath: path.join(newDirectoryPath, 'README.md'),
        configPath: path.join(newDirectoryPath, '.tnotes.json'),
      }
      const tocLines = (tocText ?? '').split('\n')
      for (let index = 0; index < tocLines.length; index++) {
        const parsed = parseTocLine(tocLines[index])
        if (parsed.noteIndex === note.index) {
          tocLines[index] = buildTocLine(
            toNoteInfo(renamedNote),
            parsed.indentLevel,
            parsed.completed,
          )
        }
      }
      const normalizedToc = normalizeTocContent(tocLines)
      const updatedNotes = snapshot.notes.map((item) =>
        item.uuid === note.uuid ? renamedNote : item,
      )

      await fs.rename(note.directoryPath, newDirectoryPath)
      try {
        await writeFilesAtomically([
          { path: renamedNote.readmePath, data: formatted.content },
          { path: this.paths.toc, data: normalizedToc },
          {
            path: this.paths.sidebar,
            data: sidebarContent(normalizedToc.split('\n'), updatedNotes, config),
          },
        ])
      } catch (error) {
        await fs.rename(newDirectoryPath, note.directoryPath)
        throw error
      }

      const value = await this.readNote(note.uuid)
      const refreshed = await this.inspect()
      return {
        value,
        changedFiles: [
          {
            path: newDirectoryPath,
            previousPath: note.directoryPath,
            kind: 'renamed',
          },
          { path: renamedNote.readmePath, kind: 'updated' },
          { path: this.paths.toc, kind: 'updated' },
          { path: this.paths.sidebar, kind: 'updated' },
        ],
        snapshotRevision: refreshed.revision,
      }
    })
  }

  private async updateNoteConfig(
    input: UpdateNoteConfigInput,
  ): Promise<MutationResult<NoteDocument>> {
    return this.queue.run(async () => {
      const { snapshot, tocText } = await this.scanReady()
      const config = requireConfig(snapshot)
      const note = findNote(snapshot, input.noteUuid)
      assertRevision(note.revision, input.expectedRevision, '笔记')
      const updatedConfig = { ...note.config, ...input.updates }
      const writes: Array<{ path: string; data: string }> = [
        { path: note.configPath, data: serializeNoteConfig(updatedConfig) },
      ]
      const changedFiles: ChangedFile[] = [
        { path: note.configPath, kind: 'updated' },
      ]

      if (typeof input.updates.done === 'boolean') {
        const lines = (tocText ?? '').split('\n')
        let updated = false
        const tempNote = { ...note, config: updatedConfig }
        for (let index = 0; index < lines.length; index++) {
          const parsed = parseTocLine(lines[index])
          if (parsed.noteIndex === note.index) {
            lines[index] = buildTocLine(
              toNoteInfo(tempNote),
              parsed.indentLevel,
              input.updates.done,
            )
            updated = true
          }
        }
        if (updated) {
          const normalizedToc = normalizeTocContent(lines)
          const updatedNotes = snapshot.notes.map((item) =>
            item.uuid === note.uuid ? tempNote : item,
          )
          writes.push(
            { path: this.paths.toc, data: normalizedToc },
            {
              path: this.paths.sidebar,
              data: sidebarContent(normalizedToc.split('\n'), updatedNotes, config),
            },
          )
          changedFiles.push(
            { path: this.paths.toc, kind: 'updated' },
            { path: this.paths.sidebar, kind: 'updated' },
          )
        }
      }

      await writeFilesAtomically(writes)
      const value = await this.readNote(note.uuid)
      const refreshed = await this.inspect()
      return { value, changedFiles, snapshotRevision: refreshed.revision }
    })
  }

  private async moveTocEntry(
    input: MoveTocEntryInput,
  ): Promise<MutationResult<KnowledgeBaseSnapshot>> {
    return this.queue.run(async () => {
      const { snapshot, tocText } = await this.scanReady()
      const config = requireConfig(snapshot)
      assertRevision(snapshot.revision, input.expectedSnapshotRevision, '知识库目录')
      const lines = (tocText ?? '').split('\n')
      const sourceLine = resolveEntryLine(lines, snapshot, input.source)
      const targetLine = resolveEntryLine(lines, snapshot, input.target)
      const sourceRange = getTocEntrySubtreeRange(lines, sourceLine)
      if (targetLine >= sourceRange.start && targetLine < sourceRange.end) {
        throw new WorkspaceError(
          'INVALID_TOC_ENTRY',
          '不能把目录条目移动到自身或自身子树内',
        )
      }
      const moving = lines.splice(
        sourceRange.start,
        sourceRange.end - sourceRange.start,
      )
      const adjustedTarget = adjustTocLineIndexAfterSubtreeRemoval(
        targetLine,
        sourceRange.start,
        sourceRange.end,
      )
      const target = parseTocLine(lines[adjustedTarget])
      if (!target.isMatch) {
        throw new WorkspaceError('INVALID_TOC_ENTRY', '移动目标无效')
      }
      let insertAt: number
      let indent: number
      if (input.placement === 'inside') {
        insertAt = getTocEntrySubtreeRange(lines, adjustedTarget).end
        indent = target.indentLevel + 1
      } else if (input.placement === 'before') {
        insertAt = adjustedTarget
        indent = target.indentLevel
      } else {
        insertAt = getTocEntrySubtreeRange(lines, adjustedTarget).end
        indent = target.indentLevel
      }
      const oldIndent = parseTocLine(moving[0]).indentLevel
      lines.splice(insertAt, 0, ...adjustIndent(moving, indent - oldIndent))
      const normalizedToc = normalizeTocContent(lines)
      await writeFilesAtomically([
        { path: this.paths.toc, data: normalizedToc },
        {
          path: this.paths.sidebar,
          data: sidebarContent(normalizedToc.split('\n'), snapshot.notes, config),
        },
      ])
      const value = await this.inspect()
      return {
        value,
        changedFiles: [
          { path: this.paths.toc, kind: 'updated' },
          { path: this.paths.sidebar, kind: 'updated' },
        ],
        snapshotRevision: value.revision,
      }
    })
  }

  private async createTocGroup(
    input: CreateTocGroupInput,
  ): Promise<MutationResult<KnowledgeBaseSnapshot>> {
    return this.queue.run(async () => {
      const { snapshot, tocText } = await this.scanReady()
      const config = requireConfig(snapshot)
      assertRevision(snapshot.revision, input.expectedSnapshotRevision, '知识库目录')
      const title = validateTitle(input.title)
      const lines = (tocText ?? '').split('\n')
      insertLineAtPlacement(lines, snapshot, input.placement, (indent) =>
        buildFolderTocLine(title, indent),
      )
      const normalizedToc = normalizeTocContent(lines)
      await writeFilesAtomically([
        { path: this.paths.toc, data: normalizedToc },
        {
          path: this.paths.sidebar,
          data: sidebarContent(normalizedToc.split('\n'), snapshot.notes, config),
        },
      ])
      const value = await this.inspect()
      return {
        value,
        changedFiles: [
          { path: this.paths.toc, kind: 'updated' },
          { path: this.paths.sidebar, kind: 'updated' },
        ],
        snapshotRevision: value.revision,
      }
    })
  }

  private async renameTocGroup(
    input: RenameTocGroupInput,
  ): Promise<MutationResult<KnowledgeBaseSnapshot>> {
    return this.queue.run(async () => {
      const { snapshot, tocText } = await this.scanReady()
      const config = requireConfig(snapshot)
      assertRevision(snapshot.revision, input.expectedSnapshotRevision, '知识库目录')
      const lines = (tocText ?? '').split('\n')
      const lineIndex = resolveEntryLine(lines, snapshot, {
        type: 'folder',
        folderPath: input.folderPath,
      })
      const updatedLines = renameFolderLine(lines, lineIndex, validateTitle(input.title))
      const normalizedToc = normalizeTocContent(updatedLines)
      await writeFilesAtomically([
        { path: this.paths.toc, data: normalizedToc },
        {
          path: this.paths.sidebar,
          data: sidebarContent(normalizedToc.split('\n'), snapshot.notes, config),
        },
      ])
      const value = await this.inspect()
      return {
        value,
        changedFiles: [
          { path: this.paths.toc, kind: 'updated' },
          { path: this.paths.sidebar, kind: 'updated' },
        ],
        snapshotRevision: value.revision,
      }
    })
  }

  private async previewDelete(entry: TocEntryRef): Promise<DeleteTocEntryPreview> {
    const { snapshot, tocText } = await this.scanReady()
    const lines = (tocText ?? '').split('\n')
    const lineIndex = resolveEntryLine(lines, snapshot, entry)
    const indexes = collectNoteIndexesInSubtree(lines, lineIndex)
    const notes = indexes
      .map((index) => snapshot.notes.find((note) => note.index === index))
      .filter((note): note is WorkspaceNoteSummary => Boolean(note))
    const filePaths = (
      await Promise.all(notes.map((note) => listFilesRecursively(note.directoryPath)))
    ).flat()
    return {
      entry,
      notes: notes.map((note) => ({
        noteUuid: note.uuid,
        index: note.index,
        title: note.title,
        directoryPath: note.directoryPath,
      })),
      filePaths,
      directoryPaths: notes.map((note) => note.directoryPath),
      snapshotRevision: snapshot.revision,
    }
  }

  private async deleteTocEntry(
    input: DeleteTocEntryInput,
  ): Promise<MutationResult<KnowledgeBaseSnapshot>> {
    return this.queue.run(async () => {
      const { snapshot, tocText } = await this.scanReady()
      const config = requireConfig(snapshot)
      assertRevision(snapshot.revision, input.expectedSnapshotRevision, '知识库目录')
      const lines = (tocText ?? '').split('\n')
      const lineIndex = resolveEntryLine(lines, snapshot, input.entry)
      const range = getTocEntrySubtreeRange(lines, lineIndex)
      const indexes = collectNoteIndexesInSubtree(lines, lineIndex)
      const notes = indexes
        .map((index) => snapshot.notes.find((note) => note.index === index))
        .filter((note): note is WorkspaceNoteSummary => Boolean(note))
      lines.splice(range.start, range.end - range.start)
      const remainingNotes = snapshot.notes.filter(
        (note) => !indexes.includes(note.index),
      )
      const normalizedToc = normalizeTocContent(lines)
      const movedDirectories: Array<{ original: string; temporary: string }> = []

      try {
        for (const note of notes) {
          const temporary = path.join(
            this.paths.notes,
            `.${path.basename(note.directoryPath)}.desk-delete-${randomUUID()}`,
          )
          await fs.rename(note.directoryPath, temporary)
          movedDirectories.push({ original: note.directoryPath, temporary })
        }
        await writeFilesAtomically([
          { path: this.paths.toc, data: normalizedToc },
          {
            path: this.paths.sidebar,
            data: sidebarContent(normalizedToc.split('\n'), remainingNotes, config),
          },
        ])
      } catch (error) {
        for (const moved of movedDirectories.reverse()) {
          await fs.rename(moved.temporary, moved.original)
        }
        throw error
      }

      for (const moved of movedDirectories) {
        await fs.rm(moved.temporary, { recursive: true, force: true })
      }
      const value = await this.inspect()
      return {
        value,
        changedFiles: [
          ...notes.map<ChangedFile>((note) => ({
            path: note.directoryPath,
            kind: 'deleted',
          })),
          { path: this.paths.toc, kind: 'updated' },
          { path: this.paths.sidebar, kind: 'updated' },
        ],
        snapshotRevision: value.revision,
      }
    })
  }

  private async writeLocalAttachment(
    input: WriteAttachmentInput,
  ): Promise<MutationResult<AttachmentResult>> {
    return this.queue.run(async () => {
      const { snapshot } = await this.scanReady()
      const note = findNote(snapshot, input.noteUuid)
      const assetsPath = path.join(note.directoryPath, 'assets')
      assertPathInside(note.directoryPath, assetsPath)
      const requestedName = sanitizeFileName(input.fileName)
      const extension = path.extname(requestedName)
      const base = path.basename(requestedName, extension)
      let candidate = requestedName
      let suffix = 1
      while (true) {
        try {
          await fs.access(path.join(assetsPath, candidate))
          candidate = `${base}-${suffix}${extension}`
          suffix++
        } catch {
          break
        }
      }
      const absolutePath = path.join(assetsPath, candidate)
      assertPathInside(assetsPath, absolutePath)
      await writeFilesAtomically([{ path: absolutePath, data: input.data }])
      const value = {
        absolutePath,
        markdownPath: `./assets/${candidate}`,
      }
      const refreshed = await this.inspect()
      return {
        value,
        changedFiles: [{ path: absolutePath, kind: 'created' }],
        snapshotRevision: refreshed.revision,
      }
    })
  }
}
