import { describe, expect, it } from 'vitest'

import {
  normalizeMindmapMarkdown,
  parseMarkmapFence,
  parseMindmapReference,
} from './compat'

describe('parseMarkmapFence', () => {
  it.each([
    ['```markmap', {}],
    ['```markmap 2', { initialExpandLevel: 2 }],
    ['```markmap {2}', { initialExpandLevel: 2 }],
    ['```markmap {initialExpandLevel=3}', { initialExpandLevel: 3 }],
    ['```markmap [ESM 模块] 2', { title: 'ESM 模块', initialExpandLevel: 2 }],
    ['```markmap 2 [ESM 模块]', { title: 'ESM 模块', initialExpandLevel: 2 }],
    ['```mindmap', {}],
    ['```mindmap [项目架构] 1', { title: '项目架构', initialExpandLevel: 1 }],
  ])('parses %s', (input, expected) => {
    expect(parseMarkmapFence(input)).toEqual(expected)
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
  it('injects the default root for historical unordered-list input', () => {
    expect(normalizeMindmapMarkdown('- A\n  - B')).toBe('# root\n\n- A\n  - B\n')
  })

  it('promotes a single legacy root item instead of rendering duplicate roots', () => {
    expect(normalizeMindmapMarkdown('- root\n  - item1\n  - item2')).toBe(
      '# root\n\n- item1\n- item2\n',
    )
    expect(normalizeMindmapMarkdown('- Custom\n  - item', { title: 'Custom' })).toBe(
      '# Custom\n\n- item\n',
    )
  })

  it('does not promote a matching root item when it has top-level siblings', () => {
    expect(normalizeMindmapMarkdown('- root\n  - nested\n- sibling')).toBe(
      '# root\n\n- root\n  - nested\n- sibling\n',
    )
  })

  it('preserves an existing H1 and lets explicit fence metadata override it', () => {
    const source = '# Existing\n\n- A\n'
    expect(normalizeMindmapMarkdown(source)).toBe(source)
    expect(normalizeMindmapMarkdown(source, { title: 'Explicit' })).toBe('# Explicit\n\n- A\n')
  })

  it('converts legacy H2/H3 sections into a nested unordered-list tree', () => {
    const source = [
      '# ESM',
      '',
      '## 基本语法',
      '',
      '### 导出方式',
      '',
      '- 命名导出',
      '  - 统一导出',
      '### 导入方式',
      '- 默认导入',
    ].join('\n')

    expect(normalizeMindmapMarkdown(source)).toBe([
      '# ESM',
      '',
      '- 基本语法',
      '',
      '  - 导出方式',
      '',
      '    - 命名导出',
      '      - 统一导出',
      '  - 导入方式',
      '    - 默认导入',
      '',
    ].join('\n'))
  })

  it('is stable when normalized more than once', () => {
    const once = normalizeMindmapMarkdown('- A\n  - B')
    expect(normalizeMindmapMarkdown(once)).toBe(once)
  })
})
