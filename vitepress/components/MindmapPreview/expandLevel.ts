import type { MindmapNode, MindmapSession } from '@tnotesjs/mindmap-core'

export function normalizeExpandLevel(value: number): number {
  return Math.max(1, Math.trunc(Number(value) || 1))
}

function childLevel(node: MindmapNode, root: MindmapNode): number {
  let level = 0
  let current: MindmapNode | null = node
  while (current && current !== root) {
    level += 1
    current = current.parent
  }
  return level
}

/**
 * Level 1 renders root + direct children; level 2 additionally renders
 * grandchildren. Nodes at the last visible level are collapsed.
 */
export function applyInitialExpandLevel(session: MindmapSession, value: number): void {
  const visibleLevel = normalizeExpandLevel(value)
  const root = session.document.root
  session.document.traverse((node) => {
    if (node === root || node.children.length === 0) return
    session.setCollapsed(node.id, childLevel(node, root) >= visibleLevel)
  })
}
