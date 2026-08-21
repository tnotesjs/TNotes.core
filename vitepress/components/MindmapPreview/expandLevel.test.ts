import { MindmapSession } from '@tnotesjs/mindmap-core'
import { describe, expect, it } from 'vitest'

import { applyInitialExpandLevel, normalizeExpandLevel } from './expandLevel'

function createSession(): MindmapSession {
  return new MindmapSession({
    markdown: '# root\n\n- 一级\n  - 二级\n    - 三级\n',
    fileName: 'expand-level.tn-mindmap.md',
  })
}

function visibleLabels(session: MindmapSession): string[] {
  const result: string[] = []
  const visit = (node: typeof session.document.root) => {
    result.push(node.content.text)
    if (!node.collapsed) node.children.forEach(visit)
  }
  visit(session.document.root)
  return result
}

describe('applyInitialExpandLevel', () => {
  it('clamps the minimum level to one', () => {
    expect(normalizeExpandLevel(0)).toBe(1)
    expect(normalizeExpandLevel(-2)).toBe(1)
  })

  it('shows only root and first-level children for level one', () => {
    const session = createSession()
    applyInitialExpandLevel(session, 1)
    expect(visibleLabels(session)).toEqual(['root', '一级'])
  })

  it('shows root, first-level and second-level children for level two', () => {
    const session = createSession()
    applyInitialExpandLevel(session, 2)
    expect(visibleLabels(session)).toEqual(['root', '一级', '二级'])
  })
})
