/**
 * .vitepress/tnotes/config/constants.ts
 *
 * 常量定义（从配置中派生的路径和URL常量）
 */
import { resolve } from 'path'

import { getConfigManager } from './ConfigManager'

const configManager = getConfigManager()
const config = configManager.getAll()

// 导出配置项（向后兼容）
export const {
  author,
  ignore_dirs,
  menuItems,
  port,
  repoName,
  sidebarShowNoteId,
  socialLinks,
  root_item,
} = config

// 目录常量 —— 从 ConfigManager.getRootPath() 派生
const rootPath = configManager.getRootPath()

/**
 * TNotes.* 当前的笔记仓库根路径
 * @example `/Users/huyouda/zm/notes/TNotes.template/`
 */
export const ROOT_DIR_PATH = rootPath
export const ROOT_README_PATH = resolve(ROOT_DIR_PATH, 'README.md')
export const ROOT_CONFIG_PATH = resolve(ROOT_DIR_PATH, '.tnotes.json')
export const NOTES_DIR_PATH = resolve(ROOT_DIR_PATH, 'notes')
export const VP_DIR_PATH = resolve(ROOT_DIR_PATH, '.vitepress')
export const PUBLIC_PATH = resolve(ROOT_DIR_PATH, 'public')
export const GITHUB_DIR_PATH = resolve(ROOT_DIR_PATH, '.github')
export const GITHUB_DEPLOY_YML_PATH = resolve(
  GITHUB_DIR_PATH,
  'workflows',
  'deploy.yml',
)
export const VP_SIDEBAR_PATH = resolve(ROOT_DIR_PATH, 'sidebar.json')
export const ROOT_PKG_PATH = resolve(ROOT_DIR_PATH, 'package.json')
export const VSCODE_SETTINGS_PATH = resolve(
  ROOT_DIR_PATH,
  '.vscode',
  'settings.json',
)
export const VSCODE_TASKS_PATH = resolve(ROOT_DIR_PATH, '.vscode', 'tasks.json')

// 文本常量
export const EOL = '\n'

/**
 * TNotes 常量配置
 */
export const CONSTANTS = {
  // 端口配置
  DEFAULT_PORT: 5173,

  // 笔记索引配置（文件夹前缀的 4 位数字）
  NOTE_INDEX_LENGTH: 4,
  NOTE_INDEX_PATTERN: /^\d{4}\./,
  NOTE_INDEX_PREFIX_PATTERN: /^\d{4}/,

  // Git 配置
  DEFAULT_BRANCH: 'main',

  // 缓存配置
  CACHE_TTL: 5000,

  // 终端输出颜色
  COLORS: {
    RESET: '\x1b[0m',
    BRIGHT: '\x1b[1m',
    DIM: '\x1b[2m',
    RED: '\x1b[31m',
    GREEN: '\x1b[32m',
    YELLOW: '\x1b[33m',
    BLUE: '\x1b[34m',
    MAGENTA: '\x1b[35m',
    CYAN: '\x1b[36m',
  } as const,

  // Emoji
  EMOJI: {
    SUCCESS: '✅',
    ERROR: '❌',
    WARNING: '⚠️',
    INFO: 'ℹ️',
    PROGRESS: '⏳',
    ROCKET: '🚀',
    STOP: '🛑',
    SPARKLES: '✨',
    LINK: '🔗',
    FILE: '📄',
    GIT: '📦',
    DEBUG: '🐛',
  } as const,
} as const

// 导出路径常量别名（向后兼容）
export const NOTES_PATH = NOTES_DIR_PATH

// GitHub URL 常量
export const REPO_NOTES_URL = `https://github.com/${author}/${repoName}/tree/main/notes`
