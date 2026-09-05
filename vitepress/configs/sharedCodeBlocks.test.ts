import {
  prepareCodeHighlighter,
  parseCodeMeta,
  SHARED_CODE_GROUP_CONTRACT,
} from '@tnotesjs/ui/code'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createMarkdownRenderer } from 'vitepress'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { getMarkdownConfig } from './markdown.config'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tnotes-shared-code-'))

beforeAll(async () => {
  await prepareCodeHighlighter(['js', 'ts'])
})

afterAll(() => fs.rmSync(root, { recursive: true, force: true }))

describe('shared code block renderer', () => {
  it('keeps VitePress parsing but replaces its code block and group DOM', async () => {
    const markdown = await createMarkdownRenderer(
      root,
      getMarkdownConfig(),
      '/',
    )
    const html = await markdown.render(
      [
        '```ts:line-numbers=4 {2} [single.ts]',
        'const first = 1',
        'const second = 2',
        '```',
        '',
        '::: code-group',
        '```js [one.js]',
        'console.log(1)',
        '```',
        '```ts [two.ts]',
        'console.log(2)',
        '```',
        ':::',
      ].join('\n'),
      { path: path.join(root, 'fixture.md'), relativePath: 'fixture.md' },
    )

    expect(html).toContain('<CodeBlock')
    expect(html).toContain('<CodeGroup')
    expect(html.match(/<CodeBlock/g)).toHaveLength(3)
    expect(html.match(/class="tn-code-group__panel"/g)).toHaveLength(2)
    expect(html).toContain('data-line%3D%5C%224%5C%22')
    expect(html).not.toContain('vp-code-group')
    expect(html).not.toContain('class="language-')
  })

  it('matches the shared Core/Desk code-group contract', async () => {
    const markdown = await createMarkdownRenderer(
      root,
      getMarkdownConfig(),
      '/',
    )
    const html = await markdown.render(SHARED_CODE_GROUP_CONTRACT.source, {
      path: path.join(root, 'contract.md'),
      relativePath: 'contract.md',
    })
    const encodedBlocks = [
      ...html.matchAll(
        /<CodeBlock :code="JSON\.parse\(decodeURIComponent\('([^']+)'\)\)" :info="JSON\.parse\(decodeURIComponent\('([^']+)'\)\)"/g,
      ),
    ]
    const blocks = encodedBlocks.map((match) => {
      const code = JSON.parse(decodeURIComponent(match[1]!)) as string
      const info = JSON.parse(decodeURIComponent(match[2]!)) as string
      return {
        code: code.replace(/\n$/, ''),
        info,
        ...parseCodeMeta(info),
      }
    })
    expect(blocks).toEqual(SHARED_CODE_GROUP_CONTRACT.items)
    expect(html).not.toContain('vp-code-group')
  })
})
