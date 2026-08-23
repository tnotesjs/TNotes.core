import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { createWorkspace, WorkspaceError } from './index'

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      fs.rm(directory, { recursive: true, force: true }),
    ),
  )
})

function knowledgeBaseConfig(id: string, repoName: string) {
  return {
    id,
    author: 'tnotesjs',
    repoName,
    keywords: [repoName],
    sidebarShowNoteId: false,
    ignore_dirs: [],
    socialLinks: [],
    menuItems: [],
    root_item: {
      title: repoName,
      completed_notes_count: {},
      details: repoName,
      link: '/',
    },
  }
}

function noteConfig(id: string, done = false) {
  return {
    bilibili: [],
    tnotes: [],
    yuque: [],
    done,
    enableDiscussions: false,
    description: '',
    id,
    customField: 'preserved',
  }
}

async function createFixture(input?: {
  repoName?: string
  knowledgeBaseId?: string
  notes?: Array<{
    index: string
    title: string
    id: string
    done?: boolean
    content?: string
  }>
  toc?: string
}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'tnotes-core-workspace-'))
  temporaryDirectories.push(root)
  const repoName = input?.repoName ?? 'TNotes.fixture'
  const notes =
    input?.notes ??
    [
      {
        index: '0001',
        title: 'Alpha',
        id: 'note-alpha',
        done: false,
      },
    ]
  await fs.mkdir(path.join(root, 'notes'))
  await fs.writeFile(
    path.join(root, '.tnotes.json'),
    JSON.stringify(
      knowledgeBaseConfig(input?.knowledgeBaseId ?? 'kb-fixture', repoName),
      null,
      2,
    ),
  )
  await fs.writeFile(path.join(root, 'README.md'), 'legacy root readme\n')

  for (const note of notes) {
    const noteDirectory = path.join(root, 'notes', `${note.index}. ${note.title}`)
    await fs.mkdir(noteDirectory)
    await fs.writeFile(
      path.join(noteDirectory, '.tnotes.json'),
      `${JSON.stringify(noteConfig(note.id, note.done), null, 2)}\n`,
    )
    await fs.writeFile(
      path.join(noteDirectory, 'README.md'),
      note.content ??
        `# stale title\n\n<!-- region:toc -->\n\n<!-- endregion:toc -->\n\n## Intro\n`,
    )
  }

  const toc =
    input?.toc ??
    `${notes.map((note) => `- [${note.done ? 'x' : ' '}] ${note.index}. ${note.title}`).join('\n')}\n`
  await fs.writeFile(path.join(root, 'TOC.md'), toc)
  await fs.writeFile(path.join(root, 'sidebar.json'), '[]')
  return root
}

describe('path-injected workspace', () => {
  it('keeps two knowledge bases isolated in the same process', async () => {
    const firstRoot = await createFixture({
      repoName: 'TNotes.first',
      knowledgeBaseId: 'kb-first',
      notes: [{ index: '0001', title: 'First', id: 'first-note' }],
    })
    const secondRoot = await createFixture({
      repoName: 'TNotes.second',
      knowledgeBaseId: 'kb-second',
      notes: [{ index: '0001', title: 'Second', id: 'second-note' }],
    })
    const first = createWorkspace({ rootPath: firstRoot })
    const second = createWorkspace({ rootPath: secondRoot })

    const [firstSnapshot, secondSnapshot] = await Promise.all([
      first.inspect(),
      second.inspect(),
    ])
    expect(firstSnapshot.id).toBe('kb-first')
    expect(secondSnapshot.id).toBe('kb-second')
    expect(firstSnapshot.notes[0].title).toBe('First')
    expect(secondSnapshot.notes[0].title).toBe('Second')

    const firstDocument = await first.notes.read('first-note')
    const secondDocument = await second.notes.read('second-note')
    expect(firstDocument.readmePath.startsWith(firstRoot)).toBe(true)
    expect(secondDocument.readmePath.startsWith(secondRoot)).toBe(true)

    await first.dispose()
    await second.dispose()
  })

  it('reports an invalid workspace without exiting the process', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'tnotes-invalid-'))
    temporaryDirectories.push(root)
    const workspace = createWorkspace({ rootPath: root })
    const snapshot = await workspace.inspect()

    expect(snapshot.health.status).toBe('invalid')
    expect(snapshot.health.diagnostics.map((item) => item.code)).toEqual(
      expect.arrayContaining([
        'CONFIG_MISSING',
        'TOC_MISSING',
        'NOTES_DIRECTORY_MISSING',
      ]),
    )
    await expect(
      workspace.notes.create({ title: 'Blocked' }),
    ).rejects.toMatchObject({ code: 'WORKSPACE_INVALID' })
  })

  it('formats and saves a note without changing the root README', async () => {
    const root = await createFixture()
    const workspace = createWorkspace({ rootPath: root })
    const before = await workspace.notes.read('note-alpha')
    const rootReadmeBefore = await fs.readFile(path.join(root, 'README.md'), 'utf8')

    const result = await workspace.notes.save({
      noteUuid: 'note-alpha',
      expectedRevision: before.revision,
      content: `# user title\n\n## Hello\n\n### Child\n\n#### 9.8. Plain\n\n\`\`\`md\n## Not a heading\n\`\`\`\n`,
    })

    expect(result.value.content).toContain(
      '# [0001. Alpha](https://github.com/tnotesjs/TNotes.fixture/tree/main/notes/0001.%20Alpha)',
    )
    expect(result.value.content).toContain('## 1. Hello')
    expect(result.value.content).toContain('### 1.1. Child')
    expect(result.value.content).toContain('#### Plain')
    expect(result.value.content).toContain('```md\n## Not a heading\n```')
    expect(result.value.content).toContain('<!-- region:toc -->')
    expect(result.value.content).toContain('- [1. Hello](#1-hello)')
    expect(await fs.readFile(path.join(root, 'README.md'), 'utf8')).toBe(
      rootReadmeBefore,
    )

    await expect(
      workspace.notes.save({
        noteUuid: 'note-alpha',
        expectedRevision: before.revision,
        content: result.value.content,
      }),
    ).rejects.toMatchObject({ code: 'REVISION_CONFLICT' })
  })

  it('uses the smallest free index and updates only TOC/sidebar', async () => {
    const root = await createFixture({
      notes: [
        { index: '0001', title: 'One', id: 'one' },
        { index: '0003', title: 'Three', id: 'three' },
      ],
    })
    const workspace = createWorkspace({ rootPath: root })
    const rootReadmeBefore = await fs.readFile(path.join(root, 'README.md'), 'utf8')
    const created = await workspace.notes.create({
      title: 'Two',
      placement: {
        type: 'note',
        targetNoteUuid: 'three',
        placement: 'before',
      },
    })

    expect(created.value.index).toBe('0002')
    expect(created.value.config).not.toHaveProperty('category')
    const toc = await fs.readFile(path.join(root, 'TOC.md'), 'utf8')
    expect(toc.indexOf('0002. Two')).toBeLessThan(toc.indexOf('0003. Three'))
    expect(await fs.readFile(path.join(root, 'README.md'), 'utf8')).toBe(
      rootReadmeBefore,
    )
  })

  it('renames a note while preserving its UUID and unknown config fields', async () => {
    const root = await createFixture()
    const workspace = createWorkspace({ rootPath: root })
    const before = await workspace.notes.read('note-alpha')
    const rootReadmeBefore = await fs.readFile(path.join(root, 'README.md'), 'utf8')
    const renamed = await workspace.notes.rename({
      noteUuid: before.uuid,
      title: 'Renamed',
      expectedRevision: before.revision,
    })

    expect(renamed.value.uuid).toBe('note-alpha')
    expect(renamed.value.dirName).toBe('0001. Renamed')
    expect(renamed.value.config.customField).toBe('preserved')
    await expect(fs.access(path.join(root, 'notes', '0001. Alpha'))).rejects.toThrow()
    expect(await fs.readFile(path.join(root, 'TOC.md'), 'utf8')).toContain(
      '0001. Renamed',
    )
    expect(await fs.readFile(path.join(root, 'README.md'), 'utf8')).toBe(
      rootReadmeBefore,
    )
  })

  it('syncs an externally changed TOC checkbox back to note config', async () => {
    const root = await createFixture()
    const workspace = createWorkspace({ rootPath: root })
    await fs.writeFile(path.join(root, 'TOC.md'), '- [x] 0001. Alpha\n')
    const result = await workspace.reconcileTocCompletion()

    expect(result.value.notes[0].config.done).toBe(true)
    const config = JSON.parse(
      await fs.readFile(
        path.join(root, 'notes', '0001. Alpha', '.tnotes.json'),
        'utf8',
      ),
    )
    expect(config.done).toBe(true)
    expect(config.customField).toBe('preserved')
  })

  it('previews and permanently deletes a TOC subtree', async () => {
    const root = await createFixture({
      notes: [
        { index: '0001', title: 'Parent', id: 'parent' },
        { index: '0002', title: 'Child', id: 'child' },
        { index: '0003', title: 'Keep', id: 'keep' },
      ],
      toc: '- Group\n  - [ ] 0001. Parent\n    - [ ] 0002. Child\n- [ ] 0003. Keep\n',
    })
    const workspace = createWorkspace({ rootPath: root })
    const preview = await workspace.toc.previewDelete({
      type: 'folder',
      folderPath: ['Group'],
    })
    expect(preview.notes.map((note) => note.noteUuid)).toEqual([
      'parent',
      'child',
    ])
    expect(preview.filePaths).toHaveLength(4)

    const deleted = await workspace.toc.deleteEntry({
      entry: { type: 'folder', folderPath: ['Group'] },
      expectedSnapshotRevision: preview.snapshotRevision,
    })
    expect(deleted.value.notes.map((note) => note.uuid)).toEqual(['keep'])
    expect(await fs.readFile(path.join(root, 'TOC.md'), 'utf8')).toBe(
      '- [ ] 0003. Keep\n',
    )
  })

  it('writes local attachments with collision-safe names', async () => {
    const root = await createFixture()
    const workspace = createWorkspace({ rootPath: root })
    const first = await workspace.attachments.writeLocal({
      noteUuid: 'note-alpha',
      fileName: 'image.png',
      data: new Uint8Array([1, 2, 3]),
    })
    const second = await workspace.attachments.writeLocal({
      noteUuid: 'note-alpha',
      fileName: 'image.png',
      data: new Uint8Array([4, 5, 6]),
    })

    expect(first.value.markdownPath).toBe('./assets/image.png')
    expect(second.value.markdownPath).toBe('./assets/image-1.png')
  })

  it('becomes read-only for a future schema', async () => {
    const root = await createFixture()
    const configPath = path.join(root, '.tnotes.json')
    const config = JSON.parse(await fs.readFile(configPath, 'utf8'))
    config.schemaVersion = 999
    await fs.writeFile(configPath, JSON.stringify(config, null, 2))
    const workspace = createWorkspace({ rootPath: root })

    expect((await workspace.inspect()).health.status).toBe('future-schema')
    await expect(workspace.notes.read('note-alpha')).resolves.toMatchObject({
      uuid: 'note-alpha',
    })
    const document = await workspace.notes.read('note-alpha')
    await expect(
      workspace.notes.save({
        noteUuid: document.uuid,
        expectedRevision: document.revision,
        content: document.content,
      }),
    ).rejects.toMatchObject({
      code: 'WORKSPACE_READ_ONLY',
    })
    expect(WorkspaceError).toBeTypeOf('function')
  })
})
