import { parseMarkdown } from '@tnotesjs/mindmap-core'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import {
  normalizeMindmapMarkdown,
  parseMarkmapFence,
  parseMindmapReference,
} from './compat'

const tnotesRoot = path.resolve(fileURLToPath(new URL('../../../../', import.meta.url)))
const noteFiles = [
  'TNotes.canvas/notes/0035. 使用 ctx.drawImage 引入图像/README.md',
  'TNotes.docs/notes/0013. Mindmap/README.md',
  'TNotes.docs/notes/0014. 分仓库模式/README.md',
  'TNotes.javascript/notes/0070. CommonJS/README.md',
  'TNotes.javascript/notes/0071. ESM/README.md',
  'TNotes.sql/notes/0001. MySQL 8 从入门到精通/README.md',
  'TNotes.vite/notes/0014. vite 思维导图/README.md',
].map((relative) => path.join(tnotesRoot, relative))

const corpusAvailable = noteFiles.every((file) => fs.existsSync(file))

describe.skipIf(!corpusAvailable)('legacy TNotes markmap corpus', () => {
  it('normalizes every historical block into valid mindmap-core Markdown', () => {
    const diagnostics: string[] = []
    let blockCount = 0

    for (const noteFile of noteFiles) {
      const note = fs.readFileSync(noteFile, 'utf8')
      const blocks = note.matchAll(/^(```(?:mindmap|markmap)[^\n]*)\n([\s\S]*?)^```\s*$/gm)
      for (const match of blocks) {
        blockCount += 1
        const options = parseMarkmapFence(match[1])
        let source = match[2]
        const reference = parseMindmapReference(
          source.split('\n').find((line) => line.trim()) ?? '',
        )
        if (reference) {
          source = fs.readFileSync(path.resolve(path.dirname(noteFile), reference.path), 'utf8')
        }
        const normalized = normalizeMindmapMarkdown(source, {
          title: options.title || reference?.title,
        })
        const result = parseMarkdown(normalized, path.basename(noteFile))
        if (!result.valid) {
          diagnostics.push(`${noteFile}\n${result.diagnostics.map((item) => item.message).join('\n')}`)
        }
      }
    }

    expect(blockCount).toBe(16)
    expect(diagnostics).toEqual([])
  })
})
