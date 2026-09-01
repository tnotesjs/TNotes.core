#!/usr/bin/env node
/**
 * Migrate short / legacy Vue component tags in knowledge-base markdown.
 *
 * Safe replacements (attribute-anchored for single-letter tags so TS generics
 * like `Prev<N extends` are not touched):
 *   <B id=…> / <BilibiliOutsidePlayer …>  → <BilibiliVideo …>
 *   <E :words=…> / <EnWordList …>         → <WordList …>
 *   <N :ids=…>                            → <NotesTable …>
 *   <F :times=…> … </F>                   → <Footprints …> … </Footprints>
 *
 * Usage:
 *   node scripts/migrate-vue-component-tags.mjs [rootDir…]
 * Default roots: sibling TNotes.* directories under ../
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const tnotesjsRoot = path.resolve(__dirname, '../..')

const DEFAULT_ROOTS = fs
  .readdirSync(tnotesjsRoot, { withFileTypes: true })
  .filter((d) => d.isDirectory() && d.name.startsWith('TNotes.'))
  .map((d) => path.join(tnotesjsRoot, d.name))

const roots = process.argv.slice(2).map((p) => path.resolve(p))
const targets = roots.length > 0 ? roots : DEFAULT_ROOTS

/** @type {Array<{ label: string, re: RegExp, to: string | ((...args: string[]) => string) }>} */
const RULES = [
  {
    label: 'BilibiliOutsidePlayer→BilibiliVideo',
    re: /<\/?BilibiliOutsidePlayer\b/g,
    to: (m) => m.replace('BilibiliOutsidePlayer', 'BilibiliVideo')
  },
  {
    label: 'EnWordList→WordList',
    re: /<\/?EnWordList\b/g,
    to: (m) => m.replace('EnWordList', 'WordList')
  },
  {
    label: '<B id= → BilibiliVideo',
    re: /<B(\s+(?=[^>]*\bid\s*=)[^>]*)(\/?\s*>)/g,
    to: '<BilibiliVideo$1$2'
  },
  {
    label: '<E words= → WordList',
    re: /<E(\s+(?=[^>]*\b:?words\s*=)[^>]*)(\/?\s*>)/g,
    to: '<WordList$1$2'
  },
  {
    label: '<N ids= → NotesTable',
    re: /<N(\s+(?=[^>]*\b:?ids\s*=)[^>]*)(\/?\s*>)/g,
    to: '<NotesTable$1$2'
  },
  {
    label: '<F times= → Footprints',
    re: /<F(\s+(?=[^>]*\b:?times\s*=)[^>]*)(\/?\s*>)/g,
    to: '<Footprints$1$2'
  },
  {
    // Only rewrite closing F when the file also has a Footprints open tag after prior rules,
    // or when paired with :times= openers already rewritten. Bare </B>/</E>/</N> are unsafe
    // (HTML <b>, TS generics examples). Footprints always used </F> with :times=.
    label: '</F> → </Footprints> (paired)',
    re: /<\/F\s*>/g,
    to: '</Footprints>'
  }
]

function walkMdFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walkMdFiles(full, out)
    else if (entry.isFile() && entry.name.endsWith('.md')) out.push(full)
  }
  return out
}

function migrateContent(source) {
  let next = source
  const applied = []
  for (const rule of RULES) {
    const before = next
    next =
      typeof rule.to === 'function'
        ? next.replace(rule.re, (...args) => rule.to(...args))
        : next.replace(rule.re, rule.to)
    if (next !== before) applied.push(rule.label)
  }
  return { next, applied }
}

let filesChanged = 0
let filesScanned = 0

for (const root of targets) {
  const files = walkMdFiles(root)
  for (const file of files) {
    filesScanned += 1
    const source = fs.readFileSync(file, 'utf8')
    const { next, applied } = migrateContent(source)
    if (applied.length === 0) continue
    fs.writeFileSync(file, next)
    filesChanged += 1
    console.log(`${path.relative(tnotesjsRoot, file)}  (${applied.join(', ')})`)
  }
}

console.log(`\nScanned ${filesScanned} markdown files; updated ${filesChanged}.`)
