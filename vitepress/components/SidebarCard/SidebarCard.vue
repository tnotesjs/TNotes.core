<!-- 
.vitepress/components/SidebarCard/SidebarCard.vue
-->

<script setup>
import { useData } from 'vitepress'
import { ref, computed, watch } from 'vue'

import {
  icon__fold,
  icon__github,
  icon__folder,
  icon__search,
  icon__number_gray,
  icon__number_purple,
} from '../../assets/icons'
import { NOTES_DIR_KEY, REPO_NAME, AUTHOR, ROOT_ITEM } from '../constants.ts'
import { useLocalIde } from '../composables/useLocalIde'
import FolderTreeItems from './FolderTreeItems.vue'
import NotesTrendChart from './NotesTrendChart.vue'
import { useSettingsDialog } from '../Settings/composables/useSettingsDialog'
import { data as sidebarConfig } from '../sidebar.data'
import {
  buildSidebarTree,
  collectParentKeys,
  extractRealNumberFromLink,
  extractTitleFromText,
} from '../sidebarTreeHelpers'
import {
  getRepoRootPath,
  resolveNoteReadmePath,
} from '../utils/vscodePaths'

// #region props
const props = defineProps({
  pending: {
    type: Boolean,
    default: false,
  },
  done: {
    type: Boolean,
    default: true,
  },
})
// #endregion

const {
  icon: localIdeIcon,
  openNoteTitle,
  openRepoTitle,
  openReadmeTitle,
  toFileUrl,
} = useLocalIde()

// #region data
const viewMode = ref('folder')
const expandedTreeKeys = ref(new Set())
const searchQuery = ref('')
const debouncedQuery = ref('')
const showAbout = ref(false)
const showNumber = ref(false)
let debounceTimer = null
// #endregion

// #region computed
const searchResults = computed(() => {
  const query = debouncedQuery.value.trim().toLowerCase()
  if (!query) return []
  return articles.value.filter((article) => {
    const fullTitle = `${article.realNumber}. ${article.text}`.toLowerCase()
    return fullTitle.includes(query)
  })
})

const folderTree = computed(() =>
  buildSidebarTree(sidebarData.value, {
    showPending: props.pending,
    showDone: props.done,
    base: baseUrl,
  }),
)

const readmeLink = computed(() => `${site.value.base || '/'}README`)
// #endregion

const { open: openSettings } = useSettingsDialog()
const { site } = useData()
const baseUrl = site.value.base.replace(/\/$/, '')

// 使用 VitePress Data Loader 读取的 sidebar 数据
const sidebarData = computed(() => {
  return sidebarConfig && sidebarConfig['/notes/']
    ? sidebarConfig['/notes/']
    : []
})

const articles = computed(() =>
  extractArticlesWithGroups(
    sidebarData.value,
    props.pending,
    props.done,
  ).articles,
)

// 根据笔记数量动态计算防抖时间
// ≤100: 无需防抖，过滤几乎无开销
// ≤500: 100ms，轻量防抖避免频繁 DOM 更新
// ≤2000: 150ms
// ≤5000: 200ms，3k+ 笔记场景（如 LeetCode 知识库）
// >5000: 300ms，接近万篇上限时适当增加
const searchDebounceDelay = computed(() => {
  const count = articles.value.length
  if (count <= 100) return 0
  if (count <= 500) return 100
  if (count <= 2000) return 150
  if (count <= 5000) return 200
  return 300
})

watch(searchQuery, (val) => {
  if (debounceTimer) clearTimeout(debounceTimer)
  if (searchDebounceDelay.value === 0) {
    debouncedQuery.value = val
    return
  }
  debounceTimer = setTimeout(() => {
    debouncedQuery.value = val
  }, searchDebounceDelay.value)
})

function extractArticlesWithGroups(sidebar, showPending, showDone) {
  const articles = []
  const groups = {}

  function traverse(items, groupPath = []) {
    for (let i = 0; i < items.length; i++) {
      const item = items[i]

      if (item.items && Array.isArray(item.items)) {
        const newGroupPath = [...groupPath, item.text]
        traverse(item.items, newGroupPath)
      } else if (item.text) {
        let shouldInclude = false
        let status = ''
        let cleanText = ''

        if (item.text.startsWith('✅') && showDone) {
          shouldInclude = true
          status = 'done'
          cleanText = item.text.replace('✅ ', '')
        } else if (item.text.startsWith('⏰') && showPending) {
          shouldInclude = true
          status = 'pending'
          cleanText = item.text.replace('⏰ ', '')
        }

        if (shouldInclude) {
          const group = groupPath.join(' / ')
          const firstLevelCategory = groupPath[0] || '未分类'

          const realNumber = extractRealNumberFromLink(item.link)
          const title = extractTitleFromText(cleanText)
          const fullLink = baseUrl ? baseUrl + item.link : item.link

          // 添加 relativePath 字段
          const article = {
            text: title,
            realNumber,
            link: fullLink,
            relativePath: item.link, // 存储相对路径
            group: group || '未分类',
            status,
            firstLevelCategory,
          }

          articles.push(article)

          if (!groups[firstLevelCategory]) {
            groups[firstLevelCategory] = []
          }
          groups[firstLevelCategory].push(article)
        }
      }
    }
  }

  traverse(sidebar)
  return { articles, groups }
}

function handleCardClick(link) {
  // open in new tab
  if (link) {
    window.open(link, '_blank')
  }

  // open in current tab
  // if (link) {
  //   window.location.href = link
  // }
}

function toggleTreeNode(key) {
  const next = new Set(expandedTreeKeys.value)
  if (next.has(key)) {
    next.delete(key)
  } else {
    next.add(key)
  }
  expandedTreeKeys.value = next
}

function toggleAllFold() {
  const allKeys = collectParentKeys(folderTree.value)
  const isAllExpanded =
    allKeys.length > 0 && allKeys.every((key) => expandedTreeKeys.value.has(key))

  expandedTreeKeys.value = isAllExpanded ? new Set() : new Set(allKeys)
}

// 打开 GitHub 仓库
function openGithubRepo() {
  window.open(`https://github.com/${AUTHOR}/${REPO_NAME}`, '_blank')
}

// 打开本地 IDE 知识库
function openVSCodeRepo() {
  const notesDir = localStorage.getItem(NOTES_DIR_KEY)

  if (!notesDir) {
    const shouldRedirect = confirm(
      '请先配置本地知识库所在位置，点击确定打开设置面板',
    )
    if (shouldRedirect) {
      openSettings()
    }
    return
  }

  window.open(toFileUrl(notesDir), '_blank')
}

// 在本地 IDE 中打开笔记 README.md
function openVSCodeArticle(article) {
  const notesDir = localStorage.getItem(NOTES_DIR_KEY)

  if (!notesDir) {
    const shouldRedirect = confirm(
      '请先配置本地知识库所在位置，点击确定打开设置面板',
    )
    if (shouldRedirect) {
      openSettings()
    }
    return
  }

  const notePath = resolveNoteReadmePath(notesDir, article.relativePath)
  if (!notePath) return

  window.open(toFileUrl(notePath), '_blank')
}

function openVSCodeReadme() {
  const notesDir = localStorage.getItem(NOTES_DIR_KEY)

  if (!notesDir) {
    const shouldRedirect = confirm(
      '请先配置本地知识库所在位置，点击确定打开设置面板',
    )
    if (shouldRedirect) {
      openSettings()
    }
    return
  }

  const readmePath = `${getRepoRootPath(notesDir)}/README.md`
  window.open(toFileUrl(readmePath), '_blank')
}
</script>

<template>
  <div>
    <!-- 控制栏区域 -->
    <div class="control-bar">
      <!-- 左侧视图切换按钮 -->
      <div class="view-toggle">
        <button
          :class="{ active: viewMode === 'folder' }"
          @click="viewMode = 'folder'"
        >
          <img :src="icon__folder" alt="文件夹视图" />
        </button>
        <button
          :class="{ active: viewMode === 'search' }"
          @click="viewMode = 'search'"
        >
          <img :src="icon__search" alt="搜索视图" />
        </button>
      </div>
      <!-- 右侧控制按钮 -->
      <div class="actions">
        <!-- 编号显示切换按钮 -->
        <button
          class="number-toggle"
          v-show="viewMode === 'folder'"
          @click="showNumber = !showNumber"
        >
          <img
            :src="showNumber ? icon__number_purple : icon__number_gray"
            alt="切换编号显示"
          />
        </button>
        <!-- 折叠/展开按钮 -->
        <button
          class="fold-toggle"
          v-show="viewMode === 'folder'"
          @click="toggleAllFold"
        >
          <img :src="icon__fold" alt="折叠/展开" />
        </button>

        <!-- GitHub 按钮 -->
        <button class="github-link" @click="openGithubRepo">
          <img :src="icon__github" alt="GitHub仓库" />
        </button>

        <!-- 本地 IDE 按钮 -->
        <button class="vscode-open" @click="openVSCodeRepo" :title="openRepoTitle">
          <img :src="localIdeIcon" :alt="openRepoTitle" />
        </button>

        <!-- 关于按钮 -->
        <button class="about-toggle" @click="showAbout = !showAbout">!</button>
      </div>
    </div>

    <!-- 关于弹窗 -->
    <div class="about-overlay" v-if="showAbout" @click.self="showAbout = false">
      <div class="about-dialog">
        <div class="about-header">
          <span>关于知识库</span>
          <button class="about-close" @click="showAbout = false">✕</button>
        </div>
        <div class="about-body">
          <div class="about-item">
            <span class="about-label">GitHub</span>
            <a
              class="about-value about-link"
              :href="`https://github.com/${AUTHOR}/${REPO_NAME}`"
              target="_blank"
            >
              {{ AUTHOR }}/{{ REPO_NAME }}
            </a>
          </div>
        </div>
      </div>
    </div>
    <!-- 搜索视图 -->
    <div class="search-view" v-if="viewMode === 'search'">
      <div class="search-box">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="搜索笔记标题…"
          class="search-input"
        />
      </div>
      <div class="search-summary">找到 {{ searchResults.length }} 条结果</div>
      <div class="folder-tree" v-show="searchResults.length > 0">
        <div
          v-for="article in searchResults"
          :key="article.link"
          class="folder-article"
        >
          <div class="article-info" @click="handleCardClick(article.link)">
            <span class="article-status" :class="`status-${article.status}`">
              {{
                article.status === 'done'
                  ? '✅'
                  : article.status === 'pending'
                    ? '⏰'
                    : '📄'
              }}
            </span>
            <span class="article-title">{{
              `${article.realNumber}. ${article.text}`
            }}</span>
          </div>
          <button
            class="vscode-article"
            @click.stop="openVSCodeArticle(article)"
            :title="openNoteTitle"
          >
            <img :src="localIdeIcon" :alt="openNoteTitle" />
          </button>
        </div>
      </div>
    </div>
    <!-- 文件夹视图 -->
    <div class="folder-view" v-if="viewMode === 'folder'">
      <NotesTrendChart
        v-if="ROOT_ITEM.completed_notes_count"
        :completedNotesCount="ROOT_ITEM.completed_notes_count"
      />
      <div class="folder-tree">
        <div class="tree-readme-row">
          <span class="tree-readme-spacer" aria-hidden="true" />
          <a :href="readmeLink" class="tree-readme-link">README</a>
          <button
            class="vscode-article"
            type="button"
            :title="openReadmeTitle"
            @click="openVSCodeReadme"
          >
            <img :src="localIdeIcon" :alt="openReadmeTitle" />
          </button>
        </div>
        <FolderTreeItems
          :nodes="folderTree"
          :show-number="showNumber"
          :expanded-keys="expandedTreeKeys"
          @toggle-node="toggleTreeNode"
          @open-vscode="openVSCodeArticle"
        />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
/* 关于弹窗样式 */
.about-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.about-dialog {
  background-color: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  width: 90%;
  max-width: 400px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);

  .about-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--vp-c-divider);
    font-weight: 600;
    font-size: 0.95rem;
  }

  .about-close {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--vp-c-text-2);
    font-size: 1rem;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    transition: background-color 0.2s;

    &:hover {
      background-color: var(--vp-c-bg-soft);
      color: var(--vp-c-text-1);
    }
  }

  .about-body {
    padding: 0.75rem 1rem;
  }

  .about-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 0;

    &:not(:last-child) {
      border-bottom: 1px solid var(--vp-c-divider);
    }
  }

  .about-label {
    color: var(--vp-c-text-2);
    font-size: 0.85rem;
  }

  .about-value {
    color: var(--vp-c-text-1);
    font-size: 0.85rem;
  }

  .about-link {
    color: var(--vp-c-brand-1);
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }
}

.about-toggle {
  background: none;
  border: none;
  padding: 0.5rem;
  cursor: pointer;
  border-radius: 4px;
  transition: background-color 0.3s ease;
  color: #646cff;
  font-size: 0.85rem;
  line-height: 1;

  &:hover {
    background-color: var(--vp-c-bg-soft);
  }
}

/* 文件夹视图样式 */
.folder-view {
  width: 100%;
  padding: 1rem 0;

  .folder-tree {
    border-radius: 8px;
    padding: 1rem;
  }

  .tree-readme-row {
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: 48px;
    padding: 3px 9px;
    margin-bottom: 3px;
    border-radius: 6px;
    transition: background-color 0.2s;

    &:hover {
      background-color: var(--vp-c-bg-soft);
    }
  }

  .tree-readme-spacer {
    flex: 0 0 20px;
    width: 20px;
  }

  .tree-readme-link {
    flex: 1;
    color: var(--vp-c-text-1);
    text-decoration: none;
    font-size: 0.9rem;
    font-weight: 600;

    &:hover {
      color: var(--vp-c-brand-1);
    }
  }

  .vscode-article {
    background: none;
    border: none;
    padding: 0.3rem;
    cursor: pointer;
    border-radius: 4px;
    flex-shrink: 0;
    opacity: 0.5;
    transition: opacity 0.2s ease;

    &:hover {
      opacity: 1;
      background-color: var(--vp-c-bg-soft-down);
    }

    img {
      display: block;
      height: 1rem;
      width: 1rem;
    }
  }
}

/* 搜索视图 */
.search-view {
  .search-box {
    margin-bottom: 0.75rem;

    .search-input {
      width: 100%;
      padding: 0.5rem 0.75rem;
      border: 1px solid var(--vp-c-divider);
      border-radius: 6px;
      background-color: var(--vp-c-bg);
      color: var(--vp-c-text-1);
      font-size: 0.85rem;
      outline: none;
      transition: border-color 0.3s;
      box-sizing: border-box;

      &::placeholder {
        color: var(--vp-c-text-3);
      }

      &:focus {
        border-color: var(--vp-c-brand-1);
      }
    }
  }

  width: 100%;
  padding: 1rem 0;

  .search-summary {
    font-size: 0.85rem;
    color: var(--vp-c-text-2);
    margin-bottom: 0.75rem;
  }

  .folder-tree {
    border-radius: 8px;
    padding: 0.5rem 1rem;
    border: 1px solid var(--vp-c-divider);
  }

  .folder-article {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.6rem 0.8rem;
    margin: 0.4rem 0;
    border-radius: 6px;
    transition: background-color 0.3s;

    &:hover {
      background-color: var(--vp-c-bg-soft);
    }

    .article-info {
      display: flex;
      align-items: center;
      flex: 1;
      cursor: pointer;
      overflow: hidden;

      .article-status {
        margin-right: 0.8rem;
        font-size: 0.9rem;
        width: 1.2rem;
        text-align: center;
        flex-shrink: 0;

        &.status-done {
          color: var(--vp-c-green-1);
        }

        &.status-pending {
          color: var(--vp-c-yellow-1);
        }
      }

      .article-title {
        font-size: 0.9rem;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }

    .vscode-article {
      background: none;
      border: none;
      padding: 0.3rem;
      cursor: pointer;
      border-radius: 4px;
      flex-shrink: 0;
      opacity: 0.5;
      transition: opacity 0.3s ease;

      &:hover {
        opacity: 1;
        background-color: var(--vp-c-bg-soft-down);
      }

      img {
        display: block;
        height: 1rem;
        width: 1rem;
      }
    }
  }
}

/* 控制栏样式 */
.control-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--vp-c-divider);
}

.view-toggle {
  display: flex;

  button {
    background: none;
    border: none;
    padding: 0.5rem;
    cursor: pointer;
    position: relative;
    border-radius: 4px;
    transition: background-color 0.3s ease;
    font-size: 0.85rem;
    line-height: 1;

    &.active {
      background-color: var(--vp-c-bg-soft);

      &::after {
        content: '';
        position: absolute;
        bottom: -0.5rem;
        left: 0;
        right: 0;
        height: 2px;
        background-color: var(--vp-c-brand);
      }
    }

    &:hover:not(.active) {
      background-color: var(--vp-c-bg-soft);
    }

    img {
      display: block;
      height: 1rem;
      width: 1rem;
      opacity: 0.7;
      transition: opacity 0.3s ease;

      &:hover {
        opacity: 1;
      }
    }
  }
}

.actions {
  display: flex;
  gap: 0.5rem;
}

/* 折叠/展开按钮和GitHub按钮样式 */
.fold-toggle,
.github-link,
.vscode-open,
.number-toggle {
  background: none;
  border: none;
  padding: 0.5rem;
  cursor: pointer;
  border-radius: 4px;
  transition: background-color 0.3s ease;

  &:hover {
    background-color: var(--vp-c-bg-soft);
  }

  img {
    display: block;
    height: 1rem;
    width: 1rem;
    opacity: 0.7;
    transition: opacity 0.3s ease;

    &:hover {
      opacity: 1;
    }
  }
}
</style>
