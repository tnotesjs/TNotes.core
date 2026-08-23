import { randomUUID } from 'node:crypto'
import { constants as fsConstants } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'

import { WorkspaceError } from './errors'

export interface AtomicWrite {
  path: string
  data: string | Uint8Array
}

interface OriginalFile {
  path: string
  existed: boolean
  data?: Buffer
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath, fsConstants.F_OK)
    return true
  } catch {
    return false
  }
}

async function stageWrite(write: AtomicWrite): Promise<string> {
  await fs.mkdir(path.dirname(write.path), { recursive: true })
  const temporaryPath = path.join(
    path.dirname(write.path),
    `.${path.basename(write.path)}.${randomUUID()}.tmp`,
  )
  const handle = await fs.open(temporaryPath, 'wx')
  try {
    await handle.writeFile(write.data)
    await handle.sync()
  } finally {
    await handle.close()
  }
  return temporaryPath
}

async function restoreOriginals(originals: OriginalFile[]): Promise<void> {
  for (const original of originals) {
    if (original.existed && original.data) {
      const restorePath = await stageWrite({
        path: original.path,
        data: original.data,
      })
      await fs.rename(restorePath, original.path)
    } else {
      await fs.rm(original.path, { force: true })
    }
  }
}

/**
 * Stage every file before replacing any target. If a replacement fails, the
 * captured originals are restored. Directory mutations are deliberately kept
 * outside this helper and validated before they run.
 */
export async function writeFilesAtomically(
  writes: AtomicWrite[],
): Promise<void> {
  const uniqueWrites = new Map<string, AtomicWrite>()
  for (const write of writes) uniqueWrites.set(write.path, write)
  const normalizedWrites = [...uniqueWrites.values()]

  const originals: OriginalFile[] = []
  const staged: Array<{ target: string; temporary: string }> = []

  try {
    for (const write of normalizedWrites) {
      const existed = await pathExists(write.path)
      originals.push({
        path: write.path,
        existed,
        data: existed ? await fs.readFile(write.path) : undefined,
      })
      staged.push({
        target: write.path,
        temporary: await stageWrite(write),
      })
    }

    for (const item of staged) {
      await fs.rename(item.temporary, item.target)
    }
  } catch (error) {
    await Promise.allSettled(
      staged.map((item) => fs.rm(item.temporary, { force: true })),
    )
    try {
      await restoreOriginals(originals)
    } catch (restoreError) {
      throw new WorkspaceError(
        'FILESYSTEM_ERROR',
        '写入失败，并且无法完整恢复原文件',
        {
          cause: error instanceof Error ? error.message : String(error),
          restoreCause:
            restoreError instanceof Error
              ? restoreError.message
              : String(restoreError),
        },
      )
    }
    throw new WorkspaceError('FILESYSTEM_ERROR', '无法原子写入知识库文件', {
      cause: error instanceof Error ? error.message : String(error),
    })
  }
}
