/**
 * vitepress/plugins/sidebarStructurePlugin.ts
 *
 * VitePress dev middleware - 处理语雀风格侧边栏的目录结构操作。
 * 所有 TOC 写入统一走 Core Workspace（toc.move/createGroup/renameGroup/
 * deleteEntry + notes.create；files→TOC 用 reconcileFromFiles）。
 */

import { scheduleNoteSearchReindex } from './localSearchReindexPlugin'
import { ROOT_DIR_PATH } from '../../config/constants'
import { FileWatcherService } from '../../services'
import { createWorkspace } from '../../workspace'

import type { TocTreeNode } from '../../utils'
import type { TocEntryRef, KnowledgeBaseSnapshot } from '../../workspace'
import type { IncomingMessage, ServerResponse } from 'http'
import type { PluginOption } from 'vite'

interface JsonResponse {
  success: boolean
  message?: string
  sidebarChanged?: boolean
  redirectUrl?: string
  redirectNoteIndex?: string | null
  createdNotes?: Array<{ index: string; dirName: string; link: string }>
  deletedNoteIndexes?: string[]
}

async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  let body = ''

  await new Promise<void>((resolve, reject) => {
    req.on('data', (chunk) => {
      body += chunk.toString()
    })
    req.on('end', resolve)
    req.on('error', reject)
  })

  return body ? JSON.parse(body) : {}
}

function sendJson(
  res: ServerResponse,
  statusCode: number,
  payload: JsonResponse,
): void {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(payload))
}

function normalizePathname(url?: string): string {
  return (url || '').split('?')[0]
}

function normalizeCount(value: unknown): number {
  const count = Number(value ?? 1)
  if (!Number.isInteger(count) || count < 1 || count > 100) {
    throw new Error('count must be an integer between 1 and 100')
  }
  return count
}

function buildNoteReadmeLink(dirName: string): string {
  return `/notes/${encodeURIComponent(dirName)}/README`
}

async function withSuspendedWatcher<T>(task: () => Promise<T>): Promise<T> {
  const watcher = FileWatcherService.getInstance()

  try {
    watcher?.suspend()
    return await task()
  } finally {
    watcher?.unsuspend()
  }
}

// ---------------------------------------------------------------------------
// Snapshot-based mapping helpers (pure; operate on the workspace snapshot).
// ---------------------------------------------------------------------------

type WalkedRef = {
  tocLineIndex: number
  ref: TocEntryRef
  subtreeIndexes: string[]
  orderIndex: number
}

function collectRefs(snapshot: KnowledgeBaseSnapshot): {
  byLine: Map<number, WalkedRef>
  orderedIndexes: string[]
} {
  const byLine = new Map<number, WalkedRef>()
  const orderedIndexes: string[] = []
  let order = 0

  const walk = (nodes: TocTreeNode[]): void => {
    for (const node of nodes) {
      if (node.kind === 'folder') {
        walk(node.children)
        continue
      }
      const subtree: string[] = []
      const collect = (n: TocTreeNode): void => {
        if (n.kind === 'note') subtree.push(n.noteIndex)
        for (const child of n.children) collect(child)
      }
      collect(node)
      byLine.set(node.tocLineIndex, {
        tocLineIndex: node.tocLineIndex,
        ref: { type: 'note', noteUuid: '' },
        subtreeIndexes: subtree,
        orderIndex: order,
      })
      orderedIndexes.push(...subtree)
      order += 1
    }
  }
  walk(snapshot.toc)
  return { byLine, orderedIndexes }
}

function noteUuidForIndex(snapshot: KnowledgeBaseSnapshot, index: string): string {
  const note = snapshot.notes.find((item) => item.index === index)
  if (!note) throw new Error(`未找到笔记: ${index}`)
  return note.uuid
}

/** TOC 树中位于某 entry 之前的最后一个笔记索引（用于删除后的跳转）。 */
function previousNoteIndex(
  snapshot: KnowledgeBaseSnapshot,
  entry: WalkedRef | undefined,
): string | null {
  if (!entry) return null
  const entries = [...collectRefs(snapshot).byLine.values()].sort(
    (a, b) => a.orderIndex - b.orderIndex,
  )
  let cursor = 0
  for (const item of entries) {
    if (item === entry) return cursor > 0 ? collectRefs(snapshot).orderedIndexes[cursor - 1] : null
    cursor += item.subtreeIndexes.length
  }
  return null
}

function isNoteInSubtree(
  snapshot: KnowledgeBaseSnapshot,
  lineIndex: number,
  noteIndex: string,
): boolean {
  const entry = collectRefs(snapshot).byLine.get(lineIndex)
  return entry ? entry.subtreeIndexes.includes(noteIndex) : false
}

function folderPathAtLine(snapshot: KnowledgeBaseSnapshot, lineIndex: number): string[] {
  const result: string[] = []
  const walk = (nodes: TocTreeNode[], path: string[]): boolean => {
    for (const node of nodes) {
      if (node.kind === 'folder') {
        if (node.tocLineIndex === lineIndex) {
          result.push(...[...path, node.title])
          return true
        }
        if (walk(node.children, [...path, node.title])) return true
      }
    }
    return false
  }
  walk(snapshot.toc, [])
  if (result.length === 0) throw new Error(`未找到目录行: ${lineIndex}`)
  return result
}

export function sidebarStructurePlugin(): PluginOption {
  const workspace = createWorkspace({ rootPath: ROOT_DIR_PATH })

  async function refreshTocAndSidebar(): Promise<void> {
    await workspace.toc.reconcileFromFiles()
  }

  return {
    name: 'tnotes-sidebar-structure',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const pathname = normalizePathname(req.url)
        const handledPaths = new Set([
          '/__tnotes_sidebar_create_note',
          '/__tnotes_sidebar_create_notes',
          '/__tnotes_sidebar_create_folder',
          '/__tnotes_sidebar_delete_note',
          '/__tnotes_sidebar_delete_entry',
          '/__tnotes_sidebar_rename_folder',
          '/__tnotes_sidebar_reorder',
        ])

        if (!handledPaths.has(pathname)) {
          next()
          return
        }

        if (req.method !== 'POST') {
          sendJson(res, 405, { success: false, message: 'Method Not Allowed' })
          return
        }

        try {
          const data = await readJsonBody(req)

          const result = await withSuspendedWatcher(async () => {
            const snapshot = await workspace.inspect()

            if (pathname === '/__tnotes_sidebar_delete_note') {
              const noteIndex = String(data.noteIndex || '')
              if (!noteIndex) throw new Error('Missing noteIndex')

              const refs = collectRefs(snapshot)
              const deletedRef = [...refs.byLine.values()].find((item) =>
                item.subtreeIndexes.includes(noteIndex),
              )
              const previous = previousNoteIndex(snapshot, deletedRef)

              await workspace.toc.deleteEntry({
                entry: { type: 'note', noteUuid: noteUuidForIndex(snapshot, noteIndex) },
                expectedSnapshotRevision: snapshot.revision,
              })
              await refreshTocAndSidebar()
              scheduleNoteSearchReindex('api:delete-note')

              const redirectDir = previous
                ? snapshot.notes.find((item) => item.index === previous)?.dirName
                : undefined
              return {
                success: true,
                sidebarChanged: true,
                redirectUrl: redirectDir ? buildNoteReadmeLink(redirectDir) : '/',
                redirectNoteIndex: previous,
                deletedNoteIndexes: [noteIndex],
                message: '笔记已删除',
              }
            }

            if (pathname === '/__tnotes_sidebar_delete_entry') {
              const tocLineIndex = Number(data.tocLineIndex)
              if (!Number.isInteger(tocLineIndex) || tocLineIndex < 0) {
                throw new Error('Missing tocLineIndex')
              }

              const currentNoteIndex = String(data.currentNoteIndex || '')
              const inSubtree = currentNoteIndex
                ? isNoteInSubtree(snapshot, tocLineIndex, currentNoteIndex)
                : false
              const entry = collectRefs(snapshot).byLine.get(tocLineIndex)
              const previous = previousNoteIndex(snapshot, entry)

              const preview = await workspace.toc.previewDelete({
                type: 'line',
                tocLineIndex,
              })
              await workspace.toc.deleteEntry({
                entry: { type: 'line', tocLineIndex },
                expectedSnapshotRevision: snapshot.revision,
              })
              await refreshTocAndSidebar()
              scheduleNoteSearchReindex('api:delete-entry')

              const redirectDir =
                inSubtree && previous
                  ? snapshot.notes.find((item) => item.index === previous)?.dirName
                  : undefined
              return {
                success: true,
                sidebarChanged: true,
                redirectUrl: redirectDir ? buildNoteReadmeLink(redirectDir) : undefined,
                redirectNoteIndex: inSubtree ? previous : null,
                deletedNoteIndexes: preview.notes.map((note) => note.index),
                message: '已删除',
              }
            }

            if (pathname === '/__tnotes_sidebar_rename_folder') {
              const tocLineIndex = Number(data.tocLineIndex)
              const newTitle = String(data.newTitle || '')
              if (!Number.isInteger(tocLineIndex) || tocLineIndex < 0) {
                throw new Error('Missing tocLineIndex')
              }

              await workspace.toc.renameGroup({
                folderPath: folderPathAtLine(snapshot, tocLineIndex),
                title: newTitle,
                expectedSnapshotRevision: snapshot.revision,
              })
              await refreshTocAndSidebar()

              return {
                success: true,
                sidebarChanged: true,
                message: '目录已重命名',
              }
            }

            if (pathname === '/__tnotes_sidebar_reorder') {
              const awaitMove = async (
                source: TocEntryRef,
                target: TocEntryRef,
                placement: 'before' | 'after' | 'inside',
              ): Promise<void> => {
                await workspace.toc.move({
                  source,
                  target,
                  placement,
                  expectedSnapshotRevision: snapshot.revision,
                })
              }

              if (
                typeof data.node_uuid === 'string' &&
                data.action === 'prependChild' &&
                !data.target_uuid
              ) {
                await awaitMove(
                  { type: 'note', noteUuid: data.node_uuid },
                  { type: 'line', tocLineIndex: 0 },
                  data.placement === 'after' ? 'after' : 'before',
                )
                await refreshTocAndSidebar()
                return {
                  success: true,
                  sidebarChanged: true,
                  message: '排序已更新',
                }
              }

              if (
                typeof data.node_uuid === 'string' &&
                typeof data.target_uuid === 'string' &&
                (data.action === 'moveAfter' || data.action === 'prependChild')
              ) {
                await awaitMove(
                  { type: 'note', noteUuid: data.node_uuid },
                  { type: 'note', noteUuid: data.target_uuid },
                  data.action === 'prependChild' ? 'inside' : 'after',
                )
                await refreshTocAndSidebar()
                return {
                  success: true,
                  sidebarChanged: true,
                  message: '排序已更新',
                }
              }

              const dragTocLineIndex = Number(data.dragTocLineIndex)
              if (!Number.isInteger(dragTocLineIndex) || dragTocLineIndex < 0) {
                throw new Error('Missing dragTocLineIndex')
              }

              const placement =
                data.targetType === 'group' || data.placement === 'inside'
                  ? ('inside' as const)
                  : data.placement === 'after'
                    ? ('after' as const)
                    : ('before' as const)

              const source: TocEntryRef = { type: 'line', tocLineIndex: dragTocLineIndex }

              if (
                data.targetTocLineIndex !== undefined &&
                data.targetTocLineIndex !== null
              ) {
                await awaitMove(
                  source,
                  { type: 'line', tocLineIndex: Number(data.targetTocLineIndex) },
                  placement,
                )
              } else if (
                Array.isArray(data.targetFolderPath) &&
                data.targetFolderPath.length > 0
              ) {
                await awaitMove(
                  source,
                  {
                    type: 'folder',
                    folderPath: data.targetFolderPath.map(String) as string[],
                  },
                  placement,
                )
              } else {
                const targetNoteIndex = String(
                  data.targetNoteIndex || data.targetGroupNoteIndex || '',
                )
                if (!targetNoteIndex) throw new Error('Missing targetNoteIndex')
                await awaitMove(
                  source,
                  { type: 'note', noteUuid: noteUuidForIndex(snapshot, targetNoteIndex) },
                  placement,
                )
              }

              await refreshTocAndSidebar()
              return {
                success: true,
                sidebarChanged: true,
                message: '排序已更新',
              }
            }

            if (pathname === '/__tnotes_sidebar_create_folder') {
              const parentTocLineIndex = Number(data.parentTocLineIndex)
              const title = String(data.title || '')
              if (
                !Number.isInteger(parentTocLineIndex) ||
                parentTocLineIndex < 0
              ) {
                throw new Error('Missing parentTocLineIndex')
              }

              const sibling = collectRefs(snapshot).byLine.get(parentTocLineIndex)
              if (!sibling) throw new Error('未找到目录行')

              await workspace.toc.createGroup({
                title,
                placement:
                  sibling.ref.type === 'note'
                    ? { type: 'note', targetNoteUuid: sibling.ref.noteUuid, placement: 'inside' }
                    : { type: 'root', placement: 'end' },
                expectedSnapshotRevision: snapshot.revision,
              })
              await refreshTocAndSidebar()

              return {
                success: true,
                sidebarChanged: true,
                message: '目录已创建',
              }
            }

            const count = normalizeCount(data.count)
            const targetNoteIndex = String(
              data.targetNoteIndex || data.targetGroupNoteIndex || '',
            )
            const parentLine =
              data.parentTocLineIndex !== undefined && data.parentTocLineIndex !== null
                ? Number(data.parentTocLineIndex)
                : null

            const created: Array<{ index: string; dirName: string }> = []
            for (let i = 0; i < count; i++) {
              let placement:
                | { type: 'note'; targetNoteUuid: string; placement: 'before' | 'after' | 'inside' }
                | { type: 'root'; placement?: 'start' | 'end' }
                | undefined
              if (targetNoteIndex) {
                placement = {
                  type: 'note',
                  targetNoteUuid: noteUuidForIndex(snapshot, targetNoteIndex),
                  placement: data.placement === 'after' ? 'after' : 'before',
                }
              } else if (parentLine !== null) {
                const sibling = collectRefs(snapshot).byLine.get(parentLine)
                if (sibling && sibling.ref.type === 'note') {
                  placement = {
                    type: 'note',
                    targetNoteUuid: sibling.ref.noteUuid,
                    placement: 'inside',
                  }
                }
              }
              const result = await workspace.notes.create({
                title: 'new',
                placement,
                expectedSnapshotRevision: snapshot.revision,
              })
              created.push({
                index: result.value.index,
                dirName: result.value.dirName,
              })
            }
            await refreshTocAndSidebar()
            scheduleNoteSearchReindex('api:create-notes')

            return {
              success: true,
              sidebarChanged: true,
              createdNotes: created.map((note) => ({
                ...note,
                link: buildNoteReadmeLink(note.dirName),
              })),
              message: '笔记已创建',
            }
          })

          sendJson(res, 200, result)
        } catch (error) {
          console.error('侧边栏结构操作失败:', error)
          sendJson(res, 500, {
            success: false,
            message: error instanceof Error ? error.message : String(error),
          })
        }
      })
    },
  }
}
