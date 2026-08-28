/**
 * services/reconcileToc.ts
 *
 * CLI / 服务侧的「files→TOC 对齐」入口（0004 方案 B）：
 * 统一的 TOC/sidebar 写入都收敛到 Core Workspace 的
 * `toc.reconcileFromFiles()`，不再直接操作 TocService。
 */
import { createWorkspace, type TNotesWorkspace } from '../workspace'

const workspaces = new Map<string, TNotesWorkspace>()

/** 知识库根目录 → 常驻 Workspace 实例（幂等，可重复调用）。 */
export async function reconcileTocFromFiles(repoRoot: string): Promise<void> {
  let workspace = workspaces.get(repoRoot)
  if (!workspace) {
    workspace = createWorkspace({ rootPath: repoRoot })
    workspaces.set(repoRoot, workspace)
  }
  await workspace.toc.reconcileFromFiles()
}
