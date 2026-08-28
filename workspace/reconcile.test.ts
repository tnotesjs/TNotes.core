import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { createWorkspace } from './index'
import { planReconcile } from './reconcile'

import type { KnowledgeBaseSnapshot } from './types'
import type { TocTreeNode } from '../utils/tocHelpers'

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
  }
}

async function createFixture(input?: {
  notes?: Array<{
    index: string
    title: string
    id: string
    done?: boolean
  }>
  toc?: string
}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'tnotes-core-reconcile-'))
  temporaryDirectories.push(root)
  const notes =
    input?.notes ?? [
      { index: '0016', title: 'Alpha', id: 'note-alpha' },
      { index: '0017', title: 'Beta', id: 'note-beta' },
    ]
  await fs.mkdir(path.join(root, 'notes'))
  await fs.writeFile(
    path.join(root, '.tnotes.json'),
    JSON.stringify(knowledgeBaseConfig('kb-reconcile', 'TNotes.reconcile'), null, 2),
  )
  await fs.writeFile(path.join(root, 'README.md'), 'legacy root readme\n')
  for (const note of notes) {
    const directory = path.join(root, 'notes', `${note.index}. ${note.title}`)
    await fs.mkdir(directory)
    await fs.writeFile(
      path.join(directory, '.tnotes.json'),
      `${JSON.stringify(noteConfig(note.id, note.done), null, 2)}\n`,
    )
    await fs.writeFile(
      path.join(directory, 'README.md'),
      `# ${note.title}\n\n## Intro\n`,
    )
  }
  await fs.writeFile(
    path.join(root, 'TOC.md'),
    input?.toc ?? `${notes.map((note) => `- [ ] ${note.index}. ${note.title}`).join('\n')}\n`,
  )
  await fs.writeFile(path.join(root, 'sidebar.json'), '[]\n')
  return root
}

/** A minimal but fully-shaped snapshot for pure planner tests. */
function snapshotWith(input: {
  notes: Array<{ index: string; title: string; dirName: string; uuid: string; config: { done: boolean } }>
  toc: TocTreeNode[]
  diagnostics: KnowledgeBaseSnapshot['health']['diagnostics']
}): KnowledgeBaseSnapshot {
  return {
    id: 'kb-reconcile',
    rootPath: '/tmp/fixture',
    config: knowledgeBaseConfig('kb-reconcile', 'TNotes.reconcile'),
    health: { status: 'invalid' as const, diagnostics: input.diagnostics },
    toc: input.toc,
    sidebar: [],
    notes: input.notes.map((note) => ({
      uuid: note.uuid,
      index: note.index,
      title: note.title,
      dirName: note.dirName,
      directoryPath: `/tmp/fixture/notes/${note.dirName}`,
      readmePath: `/tmp/fixture/notes/${note.dirName}/README.md`,
      configPath: `/tmp/fixture/notes/${note.dirName}/.tnotes.json`,
      config: note.config,
      revision: 'rev',
    })),
    revision: 'rev-snapshot',
  }
}

describe('planReconcile', () => {
  it('缺 config 的目录进入 trashDirs；其余保持不变', () => {
    const plan = planReconcile(
      snapshotWith({
        notes: [],
        toc: [],
        diagnostics: [
          {
            code: 'NOTE_CONFIG_MISSING',
            message: '笔记 X 缺少 .tnotes.json',
            severity: 'error',
            path: 'notes/0005. X/.tnotes.json',
          },
          {
            code: 'NOTE_INDEX_DUPLICATE',
            message: '笔记编号 0005 重复',
            severity: 'error',
            path: 'notes/0005. X',
          },
        ],
      }),
    )
    expect(plan.trashDirs).toEqual(['0005. X'])
  })

  it('保留分组结构；丢弃无法解析的笔记行；按需追加缺失的合法笔记（根级、按索引排序）', () => {
    const plan = planReconcile(
      snapshotWith({
        notes: [
          { index: '0016', title: 'A', dirName: '0016. A', uuid: 'u1', config: { done: false } },
          { index: '0024', title: 'New', dirName: '0024. New', uuid: 'u24', config: { done: false } },
        ],
        toc: [
          {
            kind: 'folder',
            title: '组件',
            indent: 0,
            tocLineIndex: 0,
            children: [
              { kind: 'note', noteIndex: '0016', indent: 1, tocLineIndex: 1, children: [] },
              // 目录已不存在（0017 不在 notes 里）→ 应被丢弃
              { kind: 'note', noteIndex: '0017', indent: 1, tocLineIndex: 2, children: [] },
            ],
          },
        ],
        diagnostics: [],
      }),
    )
    expect(plan.trashDirs).toEqual([])
    const folder = plan.tree[0]
    expect(folder.kind).toBe('folder')
    if (folder.kind !== 'folder') return
    expect(folder.children.map((node) => (node.kind === 'note' ? node.noteIndex : null))).toEqual([
      '0016',
    ])
    // 追加到根级、按索引排序
    expect(plan.tree.at(-1)).toMatchObject({ kind: 'note', noteIndex: '0024', indent: 0 })
  })
})

describe('workspace.toc.reconcileFromFiles', () => {
  it('软删缺配置目录 + 补缺失行 + 丢弃失联行，幂等', async () => {
    const root = await createFixture({
      // 0024 合法但不在 TOC；0010 在 TOC 但目录不存在
      notes: [
        { index: '0016', title: 'Alpha', id: 'note-alpha' },
        { index: '0017', title: 'Beta', id: 'note-beta' },
        { index: '0024', title: 'Gamma', id: 'note-gamma' },
      ],
      toc: [
        '- 组件',
        '  - [ ] 0016. Alpha',
        '  - [ ] 0017. Beta',
        '- [ ] 0010. 幽灵笔记',
        '',
      ].join('\n'),
    })
    // 手动制造一个缺 config 的目录
    const brokenDir = path.join(root, 'notes', '0005. Broken')
    await fs.mkdir(brokenDir)
    await fs.writeFile(path.join(brokenDir, 'README.md'), '# Broken\n')

    const workspace = createWorkspace({ rootPath: root })
    const result = await workspace.toc.reconcileFromFiles()

    // 1) 软删：目录进了 .trash
    expect(await exists(path.join(brokenDir))).toBe(false)
    expect(await exists(path.join(root, 'notes', '.trash', '0005. Broken'))).toBe(true)
    expect(result.changedFiles.some((file) => file.kind === 'trashed')).toBe(true)

    // 2) TOC：0016/0017 保留（组内）+ 0024 追加根级 + 0010 失联行被清
    const toc = await fs.readFile(path.join(root, 'TOC.md'), 'utf-8')
    expect(toc).toContain('0016. Alpha')
    expect(toc).toContain('0017. Beta')
    expect(toc).toContain('- [ ] 0024. Gamma')
    expect(toc).not.toContain('0010')
    expect(toc).not.toContain('0005. Broken')

    // 3) sidebar 重建
    const sidebar = await fs.readFile(path.join(root, 'sidebar.json'), 'utf-8')
    expect(sidebar).not.toBe('[]\n')

    // 4) 愈合后健康恢复
    expect(result.value.health.status).toBe('ready')

    // 5) 幂等：第二次不再产生变更
    const second = await workspace.toc.reconcileFromFiles()
    expect(second.changedFiles).toEqual([])

    await workspace.dispose()
  })

  it('TOC.md 缺失时从零构建（全部合法笔记排根级）', async () => {
    const root = await createFixture({
      notes: [
        { index: '0001', title: 'Alpha', id: 'note-alpha' },
        { index: '0002', title: 'Beta', id: 'note-beta' },
      ],
    })
    await fs.rm(path.join(root, 'TOC.md'))

    const workspace = createWorkspace({ rootPath: root })
    const result = await workspace.toc.reconcileFromFiles()
    const toc = await fs.readFile(path.join(root, 'TOC.md'), 'utf-8')
    expect(toc).toContain('- [ ] 0001. Alpha')
    expect(toc).toContain('- [ ] 0002. Beta')
    expect(result.value.health.status).toBe('ready')
    await workspace.dispose()
  })

  it('根配置缺失时拒绝（WORKSPACE_INVALID），不静默改动', async () => {
    const root = await createFixture()
    await fs.rm(path.join(root, '.tnotes.json'))

    const workspace = createWorkspace({ rootPath: root })
    await expect(workspace.toc.reconcileFromFiles()).rejects.toThrow(/知识库配置异常/)
    await workspace.dispose()
  })

  it('同名笔记二次软删不报错，进入带时间戳的目标（不覆盖第一次回收内容）', async () => {
    const root = await createFixture({
      notes: [{ index: '0001', title: 'Alpha', id: 'note-alpha' }],
    })
    const workspace = createWorkspace({ rootPath: root })
    const noteDir = path.join(root, 'notes', '0001. Alpha')

    // 第一次破坏：config 丢失 → 软删为 .trash/0001. Alpha
    await fs.rm(path.join(noteDir, '.tnotes.json'))
    await workspace.toc.reconcileFromFiles()
    expect(await exists(path.join(root, 'notes', '.trash', '0001. Alpha'))).toBe(true)

    // 重建同名合法笔记，再破坏 → 不应报错，目标带时间戳
    await fs.mkdir(noteDir, { recursive: true })
    await fs.writeFile(
      path.join(noteDir, '.tnotes.json'),
      `${JSON.stringify(noteConfig('note-alpha-2'), null, 2)}\n`,
    )
    await fs.writeFile(path.join(noteDir, 'README.md'), '# Alpha\n')
    await fs.rm(path.join(noteDir, '.tnotes.json'))
    const result = await workspace.toc.reconcileFromFiles()

    const trashEntries = await fs.readdir(path.join(root, 'notes', '.trash'))
    expect(trashEntries.length).toBe(2)
    expect(trashEntries).toContain('0001. Alpha')
    expect(trashEntries.some((name) => name.startsWith('0001. Alpha-'))).toBe(true)
    expect(result.changedFiles.some((file) => file.kind === 'trashed')).toBe(true)
    await workspace.dispose()
  })
})

async function exists(target: string): Promise<boolean> {
  try {
    await fs.stat(target)
    return true
  } catch {
    return false
  }
}
