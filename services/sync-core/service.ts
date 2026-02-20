/**
 * .vitepress/tnotes/services/sync-core/service.ts
 *
 * TNotes.core 同步服务 - 批量同步兄弟知识库的 TNotes.core submodule 到最新版本
 */
import { existsSync } from 'fs'
import { join, basename } from 'path'
import { getTargetDirs, runCommand } from '../../utils'
import {
  EN_WORDS_DIR,
  ROOT_DIR_PATH,
  TNOTES_BASE_DIR,
  TNOTES_CORE_DIR,
} from '../../config/constants'
import { logger } from '../../utils'

/**
 * 同步结果接口
 */
interface SyncResult {
  dir: string
  repoName: string
  success: boolean
  updated: boolean
  beforeHash?: string
  afterHash?: string
  error?: string
}

/**
 * TNotes.core 同步服务类
 */
export class SyncCoreService {
  /**
   * 同步单个仓库的 submodule 到最新版本
   */
  private async syncSingleRepo(targetDir: string): Promise<SyncResult> {
    const repoName = basename(targetDir)
    const submodulePath = join(targetDir, '.vitepress', 'tnotes')

    try {
      // 检查是否存在 .gitmodules
      if (!existsSync(join(targetDir, '.gitmodules'))) {
        return {
          dir: targetDir,
          repoName,
          success: false,
          updated: false,
          error: '未找到 .gitmodules，该仓库未配置 submodule',
        }
      }

      // 检查 submodule 目录是否存在
      if (!existsSync(submodulePath)) {
        // 尝试初始化
        await runCommand('git submodule update --init', targetDir)
      }

      // 记录更新前的 commit hash
      const beforeHash = (
        await runCommand('git rev-parse HEAD', submodulePath)
      ).trim()

      // fetch + reset 到 origin/main
      await runCommand('git fetch origin', submodulePath)
      await runCommand('git reset --hard origin/main', submodulePath)

      // 记录更新后的 commit hash
      const afterHash = (
        await runCommand('git rev-parse HEAD', submodulePath)
      ).trim()

      const updated = beforeHash !== afterHash

      if (updated) {
        // 暂存 submodule 指针变更并提交
        await runCommand('git add .vitepress/tnotes', targetDir)
        await runCommand('git commit -m "chore: update TNotes.core"', targetDir)
      }

      return {
        dir: targetDir,
        repoName,
        success: true,
        updated,
        beforeHash: beforeHash.substring(0, 7),
        afterHash: afterHash.substring(0, 7),
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      return {
        dir: targetDir,
        repoName,
        success: false,
        updated: false,
        error: errorMessage,
      }
    }
  }

  /**
   * 同步所有兄弟仓库的 TNotes.core 到最新版本
   */
  async syncToAllRepos(): Promise<void> {
    try {
      // 获取目标目录（排除自身、TNotes.core、TNotes.en-words）
      const targetDirs = getTargetDirs(TNOTES_BASE_DIR, 'TNotes.', [
        ROOT_DIR_PATH,
        TNOTES_CORE_DIR,
        EN_WORDS_DIR,
      ])

      if (targetDirs.length === 0) {
        logger.warn('未找到符合条件的目标目录')
        return
      }

      logger.info(`正在同步 ${targetDirs.length} 个仓库的 TNotes.core...`)
      console.log()

      // 顺序同步所有仓库
      const results: SyncResult[] = []
      for (let i = 0; i < targetDirs.length; i++) {
        const dir = targetDirs[i]
        const repoName = basename(dir)
        logger.info(`[${i + 1}/${targetDirs.length}] ${repoName}`)

        const result = await this.syncSingleRepo(dir)
        results.push(result)

        if (result.success) {
          if (result.updated) {
            logger.success(
              `  ✓ 已更新 ${result.beforeHash} → ${result.afterHash}\n`,
            )
          } else {
            logger.info(`  - 已是最新 (${result.afterHash})\n`)
          }
        } else {
          logger.error(`  ✗ 失败: ${result.error}\n`)
        }
      }

      // 显示汇总
      const successCount = results.filter((r) => r.success).length
      const updatedCount = results.filter((r) => r.updated).length
      const failCount = results.length - successCount

      console.log('━'.repeat(50))
      if (failCount === 0) {
        logger.success(
          `✨ 同步完成: ${updatedCount} 个仓库已更新, ${successCount - updatedCount} 个已是最新 (共 ${results.length} 个)`,
        )
      } else {
        logger.warn(
          `⚠️  同步完成: ${successCount} 成功 (${updatedCount} 更新), ${failCount} 失败 (共 ${results.length} 个)`,
        )
        console.log('\n失败的仓库:')
        results
          .filter((r) => !r.success)
          .forEach((r, index) => {
            console.log(`  ${index + 1}. ${r.repoName}`)
            console.log(`     错误: ${r.error}`)
          })
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      logger.error(`TNotes.core 同步失败: ${errorMessage}`)
      throw error
    }
  }
}
