import type { KnowledgeBaseSnapshot } from './types'
import type { TocTreeNode } from '../utils/tocHelpers'

/**
 * Diagnostics that mark a note directory as invalid enough to soft-delete.
 * - NOTE_CONFIG_MISSING: notes/<dir>/.tnotes.json absent
 * - NOTE_CONFIG_INVALID: config unparsable or missing a valid `id`
 * Others (duplicate index/id, missing README) are reported but NOT auto-deleted —
 * duplicates cannot be auto-resolved, and README absence is not our rule.
 */
const NOTE_CONFIG_DIAGNOSTIC_CODES = new Set([
  'NOTE_CONFIG_MISSING',
  'NOTE_CONFIG_INVALID'
])

export interface ReconcilePlan {
  /** Note dir names to soft-delete (move to notes/.trash/), sorted. */
  trashDirs: string[]
  /**
   * Rebuilt TOC tree: keeps the existing structure/order/folders, but note rows
   * not resolvable against the live notes dir are dropped by the serializer and
   * valid notes missing from the TOC are appended at root level (by index).
   */
  tree: TocTreeNode[]
}

/** Directory name from a note-config diagnostic path (`…/notes/<dir>/.tnotes.json`). */
function dirFromConfigDiagnostic(path: string | null | undefined): string | null {
  if (!path) return null
  const match = path.replace(/\\/g, '/').match(/(?:^|\/)notes\/([^/]+)\/\.tnotes\.json$/)
  return match ? match[1] : null
}

/**
 * Pure planner: derives the reconcile outcome from one scanned snapshot.
 * The filesystem is the truth; TNotes note indexes are unique + immutable, so
 * note rows are matched to disk directories by index.
 */
export function planReconcile(snapshot: KnowledgeBaseSnapshot): ReconcilePlan {
  const seen = new Set<string>()
  const trashDirs: string[] = []
  for (const diagnostic of snapshot.health.diagnostics) {
    if (!NOTE_CONFIG_DIAGNOSTIC_CODES.has(diagnostic.code)) continue
    const dir = dirFromConfigDiagnostic(diagnostic.path)
    if (dir && !seen.has(dir)) {
      seen.add(dir)
      trashDirs.push(dir)
    }
  }
  trashDirs.sort((a, b) => a.localeCompare(b))

  const validIndexes = new Set(snapshot.notes.map((note) => note.index))

  // Clean tree: keep folders (even if emptied), drop note rows that no longer
  // resolve against the live notes dir.
  const clean = (nodes: TocTreeNode[]): TocTreeNode[] => {
    const next: TocTreeNode[] = []
    for (const node of nodes) {
      if (node.kind === 'folder') {
        next.push({ ...node, children: clean(node.children) })
        continue
      }
      if (validIndexes.has(node.noteIndex)) {
        next.push({ ...node, children: clean(node.children) })
      }
    }
    return next
  }

  const present = new Set<string>()
  const walk = (nodes: TocTreeNode[]): void => {
    for (const node of nodes) {
      if (node.kind === 'note') present.add(node.noteIndex)
      walk(node.children)
    }
  }
  walk(snapshot.toc)

  const missing = snapshot.notes
    .filter((note) => !present.has(note.index))
    .sort((left, right) => left.index.localeCompare(right.index))

  const tree: TocTreeNode[] = [
    ...clean(snapshot.toc),
    ...missing.map((note) => ({
      kind: 'note' as const,
      noteIndex: note.index,
      indent: 0,
      tocLineIndex: 0,
      children: [] as TocTreeNode[]
    }))
  ]

  return { trashDirs, tree }
}
