import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { collectCodeLanguages } from './codeLanguages'

const temporaryDirectories: string[] = []

afterEach(() => {
  temporaryDirectories
    .splice(0)
    .forEach((directory) =>
      fs.rmSync(directory, { recursive: true, force: true }),
    )
})

describe('collectCodeLanguages', () => {
  it('collects fence and snippet languages without scanning generated folders', () => {
    const root = fs.mkdtempSync(
      path.join(os.tmpdir(), 'tnotes-code-languages-'),
    )
    temporaryDirectories.push(root)
    fs.mkdirSync(path.join(root, 'notes'), { recursive: true })
    fs.writeFileSync(
      path.join(root, 'notes', 'README.md'),
      ['```ts [demo.ts]', 'const ok = true', '```', '<<< ./demo.py{1-2}'].join(
        '\n',
      ),
    )
    fs.mkdirSync(path.join(root, 'dist'))
    fs.writeFileSync(path.join(root, 'dist', 'ignored.md'), '```rust\n```')

    expect(collectCodeLanguages(root)).toEqual(['python', 'text', 'ts'])
  })
})
