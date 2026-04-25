<script setup>
import { useData } from 'vitepress'
import { useRouter } from 'vitepress'
import { ref, computed, watch } from 'vue'

import { NOTES_DIR_KEY, REPO_NAME, AUTHOR, ROOT_ITEM } from '../constants.ts'
import { data as sidebarConfig } from '../sidebar.data'
import { formatDate } from '../utils.ts'
// @ts-expect-error - VitePress Data Loader
import MindMapView from './MindMapView.vue'
import NotesTrendChart from './NotesTrendChart.vue'
import {
  icon__fold,
  icon__github,
  icon__vscode,
  icon__folder,
  icon__search,
  icon__mindmap,
  icon__number_gray,
  icon__number_purple,
} from '../../assets/icons'

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

// #region data
const viewMode = ref('folder')
const expandedGroupsFolder = ref(new Set())
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
  return articles.filter((article) => {
    const fullTitle = `${article.realNumber}. ${article.text}`.toLowerCase()
    return fullTitle.includes(query)
  })
})

const folderViewData = computed(() => {
  const result = {}

  // 按完整分组路径构建层级结构（平铺模式）
  articles.forEach((article) => {
    // 将所有层级铺出来，路径信息作为分组名
    // eg. 1. 第一层级/第一个第二层级
    //          article 1
    //          article 2
    //          ……
    //     1. 第一层级/第二个第二层级
    //          article 1
    //          article 2
    //          ……
    //     1. 第一层级/第三个第二层级
    //          article 1
    //          article 2
    //          ……
    // const group = article.group
    // if (!result[group]) {
    //   result[group] = {
    //     name: group,
    //     articles: [],
    //     fullPath: group,
    //   }
    // }
    // result[group].articles.push(article)

    // 只铺出第一层级
    const firstLevelCategory = article.firstLevelCategory
    if (!result[firstLevelCategory]) {
      result[firstLevelCategory] = {
        name: firstLevelCategory,
        articles: [],
        fullPath: firstLevelCategory,
      }
    }
    result[firstLevelCategory].articles.push(article)
  })

  return result
})
// #endregion

const router = useRouter()
const { site } = useData()
const baseUrl = site.value.base.replace(/\/$/, '')

// 使用 VitePress Data Loader 读取的 sidebar 数据
const sidebarData = computed(() => {
  return sidebarConfig && sidebarConfig['/notes/']
    ? sidebarConfig['/notes/']
    : []
})

const { articles, groups } = extractArticlesWithGroups(
  sidebarData.value,
  props.pending,
  props.done,
)

// 根据笔记数量动态计算防抖时间
// ≤100: 无需防抖，过滤几乎无开销
// ≤500: 100ms，轻量防抖避免频繁 DOM 更新
// ≤2000: 150ms
// ≤5000: 200ms，3k+ 笔记场景（如 LeetCode 知识库）
// >5000: 300ms，接近万篇上限时适当增加
const searchDebounceDelay = (() => {
  const count = articles.length
  if (count <= 100) return 0
  if (count <= 500) return 100
  if (count <= 2000) return 150
  if (count <= 5000) return 200
  return 300
})()

watch(searchQuery, (val) => {
  if (debounceTimer) clearTimeout(debounceTimer)
  if (searchDebounceDelay === 0) {
    debouncedQuery.value = val
    return
  }
  debounceTimer = setTimeout(() => {
    debouncedQuery.value = val
  }, searchDebounceDelay)
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

// 从 link 中提取真实编号
function extractRealNumberFromLink(link) {
  if (!link) return '0000'

  const match = link.match(/\/notes\/(\d{4})/)
  return match ? match[1] : '0000'
}

// 从文本中提取标题（去除开头的编号部分）
function extractTitleFromText(text) {
  if (!text) return ''

  return text.replace(/^\d{4}\.?\s/, '')
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

// 在文件夹视图中切换分组展开状态
function toggleGroupFolder(groupName) {
  if (expandedGroupsFolder.value.has(groupName)) {
    expandedGroupsFolder.value.delete(groupName)
  } else {
    expandedGroupsFolder.value.add(groupName)
  }
}

// 切换所有折叠状态
function toggleAllFold() {
  const isAllExpanded =
    expandedGroupsFolder.value.size === Object.keys(folderViewData.value).length

  if (isAllExpanded) {
    expandedGroupsFolder.value.clear()
  } else {
    Object.keys(folderViewData.value).forEach((folderName) => {
      expandedGroupsFolder.value.add(folderViewData.value[folderName].fullPath)
    })
  }
}

// 打开 GitHub 仓库
function openGithubRepo() {
  window.open(`https://github.com/${AUTHOR}/${REPO_NAME}`, '_blank')
}

// 打开 VS Code 知识库
function openVSCodeRepo() {
  const notesDir = localStorage.getItem(NOTES_DIR_KEY)

  if (!notesDir) {
    const shouldRedirect = confirm(
      '请先配置本地知识库所在位置，点击确定跳转到设置页面',
    )
    if (shouldRedirect) {
      router.go(`${REPO_NAME}/Settings`)
    }
    return
  }

  window.open('vscode://file/' + notesDir, '_blank')
}

// 打开 VS Code 中的笔记目录
function openVSCodeArticle(article) {
  const notesDir = localStorage.getItem(NOTES_DIR_KEY)

  if (!notesDir) {
    const shouldRedirect = confirm(
      '请先配置本地知识库所在位置，点击确定跳转到设置页面',
    )
    if (shouldRedirect) {
      router.go(`${REPO_NAME}/Settings`)
    }
    return
  }

  // 构建笔记目录路径
  const notePath = `${notesDir}/${article.relativePath.replace('/README', '')}`
  // console.log(notePath, encodeURI(notePath))
  window.open('vscode://file/' + encodeURI(notePath), '_blank')
}
</script>

<template>
  <div class="sidebar-view-container">
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
        <button
          :class="{ active: viewMode === 'mindmap' }"
          @click="viewMode = 'mindmap'"
        >
          <img :src="icon__mindmap" alt="思维导图" />
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

        <!-- VS Code 按钮 -->
        <button class="vscode-open" @click="openVSCodeRepo">
          <img :src="icon__vscode" alt="使用 VS Code 打开本地知识库" />
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
          <div class="about-item">
            <span class="about-label">📅 创建时间</span>
            <span class="about-value">{{
              formatDate(ROOT_ITEM.created_at)
            }}</span>
          </div>
          <div class="about-item">
            <span class="about-label">♻️ 最近更新</span>
            <span class="about-value">{{
              formatDate(ROOT_ITEM.updated_at)
            }}</span>
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
            title="在 VS Code 中打开笔记目录"
          >
            <img :src="icon__vscode" alt="打开笔记目录" />
          </button>
        </div>
      </div>
    </div>
    <!-- 思维导图视图 -->
    <MindMapView v-if="viewMode === 'mindmap'" :sidebarData="sidebarData" />
    <!-- 文件夹视图 -->
    <div class="folder-view" v-if="viewMode === 'folder'">
      <NotesTrendChart
        v-if="ROOT_ITEM.completed_notes_count"
        :completedNotesCount="ROOT_ITEM.completed_notes_count"
      />
      <div class="folder-tree">
        <div
          v-for="(folder, folderName) in folderViewData"
          :key="folderName"
          class="folder-group"
        >
          <!-- 文件夹组 -->
          <div
            class="folder-header"
            @click="toggleGroupFolder(folder.fullPath)"
          >
            <span class="folder-icon">
              {{ expandedGroupsFolder.has(folder.fullPath) ? '📂' : '📁' }}
            </span>
            <span class="folder-name">{{ folderName }}</span>
            <span class="folder-count">{{ folder.articles.length }}</span>
          </div>

          <!-- 展开的文章 -->
          <div
            class="folder-content"
            v-if="expandedGroupsFolder.has(folder.fullPath)"
          >
            <!-- 当前文件夹中的文章 -->
            <div
              v-for="article in folder.articles"
              :key="article.link"
              class="folder-article"
            >
              <div class="article-info" @click="handleCardClick(article.link)">
                <span
                  class="article-status"
                  :class="`status-${article.status}`"
                >
                  {{
                    article.status === 'done'
                      ? '✅'
                      : article.status === 'pending'
                        ? '⏰'
                        : '📄'
                  }}
                </span>
                <!-- <span class="article-number">{{ article.realNumber }}</span> -->
                <span class="article-title">{{
                  showNumber
                    ? `${article.realNumber}. ${article.text}`
                    : article.text
                }}</span>
              </div>

              <button
                class="vscode-article"
                @click.stop="openVSCodeArticle(article)"
                title="在 VS Code 中打开笔记目录"
              >
                <img :src="icon__vscode" alt="打开笔记目录" />
              </button>
            </div>
          </div>
        </div>
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
    // background-color: var(--vp-c-bg-soft);
    border-radius: 8px;
    padding: 1rem;

    .folder-group {
      margin-bottom: 1rem;
      border: 1px solid var(--vp-c-divider);
      border-radius: 8px;
      overflow: hidden;

      .folder-header {
        display: flex;
        align-items: center;
        padding: 0.75rem 1rem;
        // background-color: var(--vp-c-bg-soft);
        cursor: pointer;
        transition: background-color 0.3s;

        // &:hover {
        //   background-color: var(--vp-c-bg-elv);
        // }

        .folder-icon {
          margin-right: 0.75rem;
          font-size: 1.1rem;
        }

        .folder-name {
          flex: 1;
          font-weight: 500;
          font-size: 0.95rem;
        }

        .folder-count {
          background-color: var(--vp-c-default-soft);
          color: var(--vp-c-text-2);
          font-size: 0.8rem;
          padding: 0.2rem 0.5rem;
          border-radius: 4px;
        }
      }

      .folder-content {
        padding: 0.5rem 1rem;
        background-color: var(--vp-c-bg);

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

            .article-number {
              background-color: var(--vp-c-default-soft);
              color: var(--vp-c-text-2);
              font-size: 0.75rem;
              padding: 0.2rem 0.5rem;
              border-radius: 4px;
              font-family: var(--vp-font-family-mono);
              flex-shrink: 0;
              margin-right: 0.8rem;
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
    }
  }

  /* 响应式调整 */
  @media (max-width: 768px) {
    .folder-content {
      padding-left: 1rem !important;
      padding-right: 1rem !important;
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
