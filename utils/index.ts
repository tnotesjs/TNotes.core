/**
 * utils/index.ts
 *
 * util 统一入口
 */

export { handleError, createError } from './errorHandler'
export { ensureDirectory } from './file'
export { generateAnchor } from './generateAnchor'
export { genHierarchicalSidebar } from './genHierarchicalSidebar'
export { getChangedIds } from './getChangedIds'
export { LogLevel, Logger, logger, createLogger } from './logger'
export { createAddNumberToTitle, generateToc } from './markdown'
export { parseArgs } from './parseArgs'
export { parseReadmeCompletedNotes } from './parseReadmeCompletedNotes'
export {
  parseTocLine,
  buildTocLine,
  buildFolderTocLine,
  parseTocToTree,
  parseTocToMutableTree,
  migrateLegacyNoteParents,
  serializeTocTree,
  buildTreeFromFlatNodes,
  parseTocLinesToFlatNodes,
  getSubtreeLineRange,
  getFolderSubtreeRange,
  getTocEntrySubtreeRange,
  collectNoteIndexesInSubtree,
  renameFolderLine,
  getPreviousNoteIndexOutsideSubtree,
  isNoteIndexInSubtree,
  findTocLineIndex,
  findFolderLineIndex,
  findTocEntryLineIndex,
  getPreviousTocNoteIndex,
  processTocEmptyLines,
  parseTocCompletedNotes,
  buildSidebarFromTocTree,
  resolveNoteFromIndex,
  getTocLineCompleted,
  folderTitleFromNoteDirName,
  isTocContentLine,
  TOC_INDENT_SPACES,
} from './tocHelpers'
export type {
  ParsedTocLine,
  TocNode,
  TocTreeNode,
  TocFolderNode,
  TocNoteNode,
  TocSidebarItem,
  TocLineKind,
} from './tocHelpers'
export { isPortInUse, killPortProcess, waitForPort } from './portUtils'
export {
  parseNoteLine,
  buildNoteLineMarkdown,
  processEmptyLines,
} from './readmeHelpers'
export { runCommand } from './runCommand'
export { validateNoteTitle } from './validators'
