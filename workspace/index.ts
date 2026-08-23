import { Workspace } from './workspace'

import type { CreateWorkspaceOptions, TNotesWorkspace } from './types'

export function createWorkspace(
  options: CreateWorkspaceOptions,
): TNotesWorkspace {
  return new Workspace(options)
}

export { WorkspaceError } from './errors'
export type { WorkspaceErrorCode } from './errors'
export type {
  AttachmentResult,
  ChangedFile,
  CreateNoteInput,
  CreateTocGroupInput,
  CreateWorkspaceOptions,
  DeletePreviewItem,
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
  WorkspaceDiagnostic,
  WorkspaceHealth,
  WorkspaceKnowledgeBaseConfig,
  WorkspaceLogger,
  WorkspaceNoteConfig,
  WorkspaceNoteSummary,
  WriteAttachmentInput,
} from './types'
