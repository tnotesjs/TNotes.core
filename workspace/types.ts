import type { TNotesConfig } from '../types/config'
import type { NoteConfig } from '../types/note'
import type { TocTreeNode, TocSidebarItem } from '../utils/tocHelpers'

export type WorkspaceDiagnosticSeverity = 'error' | 'warning' | 'info'

export interface WorkspaceDiagnostic {
  code: string
  message: string
  severity: WorkspaceDiagnosticSeverity
  path?: string
}

export type WorkspaceHealth =
  | { status: 'ready'; diagnostics: WorkspaceDiagnostic[] }
  | { status: 'invalid'; diagnostics: WorkspaceDiagnostic[] }
  | { status: 'future-schema'; diagnostics: WorkspaceDiagnostic[] }

/**
 * Core only edits known fields, but it must retain fields introduced by a
 * knowledge base or by a newer Core release.
 */
export type WorkspaceNoteConfig = NoteConfig & Record<string, unknown>
export type WorkspaceKnowledgeBaseConfig = TNotesConfig &
  Record<string, unknown>

export interface WorkspaceNoteSummary {
  uuid: string
  index: string
  title: string
  dirName: string
  directoryPath: string
  readmePath: string
  configPath: string
  config: WorkspaceNoteConfig
  revision: string
}

export interface KnowledgeBaseSnapshot {
  id: string
  rootPath: string
  config: WorkspaceKnowledgeBaseConfig | null
  health: WorkspaceHealth
  toc: TocTreeNode[]
  sidebar: TocSidebarItem[]
  notes: WorkspaceNoteSummary[]
  revision: string
}

export interface NoteDocument extends WorkspaceNoteSummary {
  content: string
}

export interface ChangedFile {
  path: string
  kind: 'created' | 'updated' | 'deleted' | 'renamed' | 'trashed'
  previousPath?: string
}

export interface MutationResult<T> {
  value: T
  changedFiles: ChangedFile[]
  snapshotRevision: string
}

export interface WorkspaceLogger {
  debug?(message: string, details?: unknown): void
  info?(message: string, details?: unknown): void
  warn?(message: string, details?: unknown): void
  error?(message: string, details?: unknown): void
}

export interface CreateWorkspaceOptions {
  rootPath: string
  logger?: WorkspaceLogger
  format?: {
    prettier?: boolean
  }
}

export interface SaveNoteInput {
  noteUuid: string
  content: string
  expectedRevision: string
  prettier?: boolean
}

export type NotePlacement =
  | { type: 'root'; placement?: 'start' | 'end' }
  | {
      type: 'note'
      targetNoteUuid: string
      placement: 'before' | 'after' | 'inside'
    }
  | {
      type: 'folder'
      folderPath: string[]
      placement: 'before' | 'after' | 'inside'
    }

export interface CreateNoteInput {
  title: string
  placement?: NotePlacement
  config?: Partial<Pick<WorkspaceNoteConfig, 'description' | 'enableDiscussions'>>
  expectedSnapshotRevision?: string
}

export interface RenameNoteInput {
  noteUuid: string
  title: string
  expectedRevision: string
}

export interface UpdateNoteConfigInput {
  noteUuid: string
  updates: Partial<
    Pick<
      WorkspaceNoteConfig,
      'done' | 'description' | 'enableDiscussions'
    >
  >
  expectedRevision: string
}

export type TocEntryRef =
  | { type: 'note'; noteUuid: string }
  | { type: 'folder'; folderPath: string[] }
  | { type: 'line'; tocLineIndex: number }

export interface MoveTocEntryInput {
  source: TocEntryRef
  target: TocEntryRef
  placement: 'before' | 'after' | 'inside'
  expectedSnapshotRevision: string
}

export interface CreateTocGroupInput {
  title: string
  placement?: NotePlacement
  expectedSnapshotRevision: string
}

export interface RenameTocGroupInput {
  folderPath: string[]
  title: string
  expectedSnapshotRevision: string
}

export interface DeletePreviewItem {
  noteUuid: string
  index: string
  title: string
  directoryPath: string
}

export interface DeleteTocEntryPreview {
  entry: TocEntryRef
  notes: DeletePreviewItem[]
  filePaths: string[]
  directoryPaths: string[]
  snapshotRevision: string
}

export interface DeleteTocEntryInput {
  entry: TocEntryRef
  expectedSnapshotRevision: string
}

export interface WriteAttachmentInput {
  noteUuid: string
  fileName: string
  data: Uint8Array
}

export interface AttachmentResult {
  absolutePath: string
  markdownPath: string
}

export interface TNotesWorkspace {
  inspect(): Promise<KnowledgeBaseSnapshot>
  refresh(): Promise<KnowledgeBaseSnapshot>
  reconcileTocCompletion(): Promise<MutationResult<KnowledgeBaseSnapshot>>

  notes: {
    read(noteUuid: string): Promise<NoteDocument>
    save(input: SaveNoteInput): Promise<MutationResult<NoteDocument>>
    create(input: CreateNoteInput): Promise<MutationResult<NoteDocument>>
    rename(input: RenameNoteInput): Promise<MutationResult<NoteDocument>>
    updateConfig(
      input: UpdateNoteConfigInput,
    ): Promise<MutationResult<NoteDocument>>
  }

  toc: {
    move(input: MoveTocEntryInput): Promise<MutationResult<KnowledgeBaseSnapshot>>
    createGroup(
      input: CreateTocGroupInput,
    ): Promise<MutationResult<KnowledgeBaseSnapshot>>
    renameGroup(
      input: RenameTocGroupInput,
    ): Promise<MutationResult<KnowledgeBaseSnapshot>>
    previewDelete(entry: TocEntryRef): Promise<DeleteTocEntryPreview>
    deleteEntry(
      input: DeleteTocEntryInput,
    ): Promise<MutationResult<KnowledgeBaseSnapshot>>
    setDone(input: UpdateNoteConfigInput): Promise<MutationResult<NoteDocument>>
    /**
     * Align TOC.md + sidebar.json with the filesystem truth (files-first).
     * Valid notes missing from the TOC are appended (root level, by index);
     * note dirs with a missing/invalid config are soft-deleted to
     * notes/.trash/. Idempotent: no changes -> changedFiles = [].
     */
    reconcileFromFiles(): Promise<MutationResult<KnowledgeBaseSnapshot>>
  }

  attachments: {
    writeLocal(
      input: WriteAttachmentInput,
    ): Promise<MutationResult<AttachmentResult>>
  }

  dispose(): Promise<void>
}
