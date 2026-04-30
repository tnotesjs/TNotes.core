/**
 * .vitepress/tnotes/vitepress/plugins/sidebarStructurePlugin.ts
 *
 * VitePress dev middleware - 处理语雀风格侧边栏的目录结构操作。
 */
import { FileWatcherService, NoteService, ReadmeService } from '../../services'

import type { IncomingMessage, ServerResponse } from 'http'
import type { NoteInfo } from '../../types'
import type { PluginOption } from 'vite'

interface JsonResponse {
  success: boolean
  message?: string
  sidebarChanged?: boolean
  redirectUrl?: string
  createdNotes?: Array<{ index: string; dirName: string; link: string }>
  deletedNoteIndexes?: string[]
}

async function readJsonBody(req: IncomingMessage): Promise<any> {
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

function normalizeGroupPath(value: unknown): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error('Missing groupPath')
  }

  return value.map((item) => String(item))
}

function normalizeCount(value: unknown): number {
  const count = Number(value ?? 1)
  if (!Number.isInteger(count) || count < 1 || count > 100) {
    throw new Error('count must be an integer between 1 and 100')
  }
  return count
}

function getCreatedNotePayload(notes: NoteInfo[]) {
  return notes.map((note) => ({
    index: note.index,
    dirName: note.dirName,
    link: `/notes/${encodeURIComponent(note.dirName)}/README`,
  }))
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

export function sidebarStructurePlugin(): PluginOption {
  const noteService = NoteService.getInstance()
  const readmeService = ReadmeService.getInstance()

  async function createNotes(count: number) {
    const notes = []
    const usedIndexes = new Set<number>()

    for (const note of noteService.getAllNotes()) {
      const index = parseInt(note.index, 10)
      if (!isNaN(index)) {
        usedIndexes.add(index)
      }
    }

    for (let i = 0; i < count; i++) {
      const note = await noteService.createNote({
        title: 'new',
        usedIndexes,
      })
      const index = parseInt(note.index, 10)
      if (!isNaN(index)) {
        usedIndexes.add(index)
      }
      notes.push(note)
    }

    return notes
  }

  return {
    name: 'tnotes-sidebar-structure',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const pathname = normalizePathname(req.url)
        const handledPaths = new Set([
          '/__tnotes_sidebar_rename_group',
          '/__tnotes_sidebar_delete_group',
          '/__tnotes_sidebar_create_note',
          '/__tnotes_sidebar_create_notes',
          '/__tnotes_sidebar_delete_note',
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
            if (pathname === '/__tnotes_sidebar_rename_group') {
              const groupPath = normalizeGroupPath(data.groupPath)
              const newTitle = String(data.newTitle || '')
              await readmeService.renameGroupInReadme(groupPath, newTitle)
              await readmeService.refreshHomeReadmeAndSidebar()
              return {
                success: true,
                sidebarChanged: true,
                message: '目录已重命名',
              }
            }

            if (pathname === '/__tnotes_sidebar_delete_group') {
              const groupPath = normalizeGroupPath(data.groupPath)
              const noteIndexes = await readmeService.deleteGroupFromReadme(
                groupPath,
              )

              for (const noteIndex of noteIndexes) {
                await noteService.deleteNote(noteIndex)
              }

              await readmeService.refreshHomeReadmeAndSidebar()
              return {
                success: true,
                sidebarChanged: true,
                redirectUrl: '/',
                deletedNoteIndexes: noteIndexes,
                message: '目录已删除',
              }
            }

            if (pathname === '/__tnotes_sidebar_delete_note') {
              const noteIndex = String(data.noteIndex || '')
              if (!noteIndex) throw new Error('Missing noteIndex')

              await readmeService.deleteNoteFromReadme(noteIndex)
              await noteService.deleteNote(noteIndex)
              await readmeService.refreshHomeReadmeAndSidebar()

              return {
                success: true,
                sidebarChanged: true,
                redirectUrl: '/',
                deletedNoteIndexes: [noteIndex],
                message: '笔记已删除',
              }
            }

            if (pathname === '/__tnotes_sidebar_reorder') {
              if (data.dragType === 'note') {
                const noteIndex = String(data.noteIndex || '')
                if (!noteIndex) throw new Error('Missing noteIndex')

                if (data.targetType === 'group') {
                  await readmeService.moveNoteInReadme(noteIndex, {
                    targetGroupPath: normalizeGroupPath(data.targetGroupPath),
                  })
                } else {
                  await readmeService.moveNoteInReadme(noteIndex, {
                    targetNoteIndex: String(data.targetNoteIndex || ''),
                    placement: data.placement === 'after' ? 'after' : 'before',
                  })
                }
              } else if (data.dragType === 'group') {
                await readmeService.moveGroupInReadme(
                  normalizeGroupPath(data.groupPath),
                  normalizeGroupPath(data.targetGroupPath),
                  data.placement === 'after' ? 'after' : 'before',
                )
              } else {
                throw new Error('Missing dragType')
              }

              await readmeService.refreshHomeReadmeAndSidebar()
              return {
                success: true,
                sidebarChanged: true,
                message: '排序已更新',
              }
            }

            const count = normalizeCount(data.count)
            const notes = await createNotes(count)

            if (data.targetNoteIndex) {
              const placement = data.placement === 'after' ? 'after' : 'before'
              await readmeService.insertNotesAroundNote(
                String(data.targetNoteIndex),
                notes,
                placement,
              )
            } else {
              const groupPath = normalizeGroupPath(data.groupPath)
              await readmeService.insertNotesAtGroupStart(groupPath, notes)
            }

            await readmeService.refreshHomeReadmeAndSidebar()

            return {
              success: true,
              sidebarChanged: true,
              createdNotes: getCreatedNotePayload(notes),
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
