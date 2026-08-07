/**
 * config/index.ts
 *
 * 配置层统一导出
 */

export {
  ConfigManager,
  getConfigManager,
} from './ConfigManager'
export {
  getDefaultConfig,
  mergeConfig,
  validateAndCompleteConfig,
  stripDeprecatedRootItemFields,
} from './defaultConfig'
export {
  ROOT_DIR_PATH,
  ROOT_README_PATH,
  ROOT_TOC_PATH,
  ROOT_CONFIG_PATH,
  NOTES_DIR_PATH,
  VP_SIDEBAR_PATH,
  EOL,
  CONSTANTS,
  NOTES_PATH,
  REPO_NOTES_URL,
  port,
  repoName,
} from './constants'
export * from './templates'
