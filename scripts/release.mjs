#!/usr/bin/env node

/**
 * @tnotesjs/core 发版脚本
 *
 * 用法: node scripts/release.mjs [版本号]
 * 示例: node scripts/release.mjs 0.0.2
 *       node scripts/release.mjs patch   (自动 bump patch)
 *       node scripts/release.mjs minor   (自动 bump minor)
 *
 * 流程:
 *   1. 检查工作区是否干净（无未提交变更）
 *   2. 确认 CHANGELOG.md 已更新（[Unreleased] 区域不能为空）
 *   3. 类型检查（tsc --noEmit）
 *   4. 构建（tsup）
 *   5. 更新 package.json 版本号
 *   6. 更新 CHANGELOG.md 中的 [Unreleased] → [x.y.z] - 日期
 *   7. 提交 + 打 tag
 *   8. 确认后推送 + 发布到 npm
 */

import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { createInterface } from 'node:readline'

const run = (cmd) => execSync(cmd, { stdio: 'inherit', encoding: 'utf-8' })
const runCapture = (cmd) => execSync(cmd, { encoding: 'utf-8' }).trim()

function ask(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer.trim().toLowerCase())
    })
  })
}

function fail(msg) {
  console.error(`\n❌ ${msg}`)
  process.exit(1)
}

function info(msg) {
  console.log(`\n✅ ${msg}`)
}

// ── 1. 检查工作区 ──────────────────────────────────────────
const status = runCapture('git status --porcelain')
if (status) {
  fail('工作区有未提交的变更，请先提交或 stash：\n' + status)
}
info('工作区干净')

// ── 2. 解析版本号 ──────────────────────────────────────────
const pkg = JSON.parse(readFileSync('package.json', 'utf-8'))
const currentVersion = pkg.version
const arg = process.argv[2]

if (!arg) {
  fail('请指定版本号，例如: node scripts/release.mjs 0.1.14 或 patch/minor/major')
}

function bumpVersion(current, type) {
  const parts = current.split('.').map(Number)
  if (type === 'major') return `${parts[0] + 1}.0.0`
  if (type === 'minor') return `${parts[0]}.${parts[1] + 1}.0`
  if (type === 'patch') return `${parts[0]}.${parts[1]}.${parts[2] + 1}`
  return null
}

const newVersion = bumpVersion(currentVersion, arg) ?? arg

if (!/^\d+\.\d+\.\d+$/.test(newVersion)) {
  fail(`无效的版本号: ${newVersion}`)
}

console.log(`\n📦 ${currentVersion} → ${newVersion}`)

// ── 3. 检查 CHANGELOG ─────────────────────────────────────
const changelog = readFileSync('CHANGELOG.md', 'utf-8')
const unreleasedMatch = changelog.match(/## \[Unreleased\]\s*\n([\s\S]*?)(?=\n## \[)/)
const unreleasedContent = unreleasedMatch?.[1]?.trim() ?? ''

if (!unreleasedContent || unreleasedContent === '暂无待发布的变更。') {
  fail('CHANGELOG.md 的 [Unreleased] 区域为空，请先记录本次变更内容')
}
info('CHANGELOG.md 已包含变更记录')

// ── 4. 类型检查 ────────────────────────────────────────────
console.log('\n🔍 类型检查...')
run('pnpm build:check')
info('类型检查通过')

// ── 5. 构建 ────────────────────────────────────────────────
console.log('\n🔨 构建...')
run('pnpm build')
info('构建成功')

// ── 6. 更新 package.json ───────────────────────────────────
pkg.version = newVersion
writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n')
info(`package.json 版本号已更新为 ${newVersion}`)

// ── 7. 更新 CHANGELOG.md ──────────────────────────────────
const today = new Date().toISOString().slice(0, 10)
let updatedChangelog = changelog
  .replace(
    /## \[Unreleased\]\s*\n([\s\S]*?)(\n## \[)/,
    `## [Unreleased]\n\n暂无待发布的变更。\n\n## [${newVersion}] - ${today}\n\n${unreleasedContent}\n$2`
  )
  .replace(
    /\[Unreleased\]:.*\n/,
    `[Unreleased]: https://github.com/tnotesjs/core/compare/v${newVersion}...HEAD\n[${newVersion}]: https://github.com/tnotesjs/core/compare/v${currentVersion}...v${newVersion}\n`
  )
writeFileSync('CHANGELOG.md', updatedChangelog)
info('CHANGELOG.md 已更新')

// ── 8. 提交 + Tag ─────────────────────────────────────────
run('git add package.json CHANGELOG.md')
run(`git commit -m "release: v${newVersion}"`)
run(`git tag v${newVersion}`)
info(`已提交并创建 tag v${newVersion}`)

// ── 9. 确认推送 + 发布 ────────────────────────────────────
const answer = await ask(`\n🚀 是否推送到远端并发布到 npm？(y/n) `)
if (answer === 'y' || answer === 'yes') {
  run('git push')
  run(`git push origin v${newVersion}`)
  run('npm publish --access public')
  info(`v${newVersion} 已发布！`)
} else {
  console.log('\n⏸️  已跳过推送和发布。手动执行：')
  console.log(`   git push && git push origin v${newVersion}`)
  console.log('   npm publish --access public')
}
