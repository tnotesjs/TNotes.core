import { describe, expect, it } from 'vitest'

import {
  normalizeMindmapMarkdown,
  parseMindmapFence,
  parseMindmapReference,
} from './markdown'

describe('parseMindmapFence', () => {
  it.each([
    ['```mindmap', {}],
    ['```mindmap [项目架构]', { title: '项目架构' }],
    ['```mindmap [项目架构] 2', { title: '项目架构', initialExpandLevel: 2 }],
    ['```mindmap 2 [项目架构]', { title: '项目架构', initialExpandLevel: 2 }],
    ['```mindmap 0', { initialExpandLevel: 1 }],
  ])('parses %s', (input, expected) => {
    expect(parseMindmapFence(input)).toEqual(expected)
  })

  it.each([
    '```markmap',
    '```markmap 2',
    '```markmap {2}',
    '```mindmap {2}',
    '```mindmap {initialExpandLevel=3}',
  ])('rejects removed syntax: %s', (input) => {
    expect(parseMindmapFence(input)).toBeNull()
  })
})

describe('parseMindmapReference', () => {
  it.each([
    ['<<< ./assets/tree.md', { path: './assets/tree.md' }],
    ['<<< ./assets/tree.md [项目架构]', { path: './assets/tree.md', title: '项目架构' }],
    ['<<< "./assets/tree with spaces.md" [项目架构]', { path: './assets/tree with spaces.md', title: '项目架构' }],
  ])('parses %s', (input, expected) => {
    expect(parseMindmapReference(input)).toEqual(expected)
  })
})

describe('normalizeMindmapMarkdown', () => {
  it('injects the default root for unordered-list input', () => {
    expect(normalizeMindmapMarkdown('- A\n  - B')).toBe('# root\n\n- A\n  - B\n')
  })

  it('does not promote an explicit root list item', () => {
    expect(normalizeMindmapMarkdown('- root\n  - item1\n  - item2')).toBe(
      '# root\n\n- root\n  - item1\n  - item2\n',
    )
  })

  it('preserves an existing H1 and lets explicit fence metadata override it', () => {
    const source = '# Existing\n\n- A\n'
    expect(normalizeMindmapMarkdown(source)).toBe(source)
    expect(normalizeMindmapMarkdown(source, { title: 'Explicit' })).toBe('# Explicit\n\n- A\n')
  })

  it('does not convert H2-H6 headings into list nodes', () => {
    const source = '# Existing\n\n## Section\n\n- A'
    expect(normalizeMindmapMarkdown(source)).toBe('# Existing\n\n## Section\n\n- A\n')
  })

  it('is stable when normalized more than once', () => {
    const once = normalizeMindmapMarkdown('- A\n  - B')
    expect(normalizeMindmapMarkdown(once)).toBe(once)
  })
})
