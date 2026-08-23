export type WorkspaceErrorCode =
  | 'WORKSPACE_DISPOSED'
  | 'WORKSPACE_INVALID'
  | 'WORKSPACE_READ_ONLY'
  | 'NOTE_NOT_FOUND'
  | 'NOTE_INDEX_EXHAUSTED'
  | 'REVISION_CONFLICT'
  | 'INVALID_TITLE'
  | 'INVALID_TOC_ENTRY'
  | 'INVALID_PATH'
  | 'FILESYSTEM_ERROR'

export class WorkspaceError extends Error {
  readonly code: WorkspaceErrorCode
  readonly details?: Record<string, unknown>

  constructor(
    code: WorkspaceErrorCode,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'WorkspaceError'
    this.code = code
    this.details = details
  }
}
