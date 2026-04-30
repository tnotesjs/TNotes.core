<template>
  <div class="custom-sidebar-wrapper">
    <nav class="nav" ref="navRef">
      <!-- 使用递归组件渲染侧边栏，支持任意层级嵌套 -->
      <SidebarItems
        :items="sidebarGroups"
        :depth="0"
        :max-depth="maxDepth"
        :show-note-id="showNoteId"
        :base="base"
        :current-path="route.path"
        :is-dev="isDev"
        :sidebar-density="sidebarDensity"
        :done-prefix="donePrefix"
        :undone-prefix="undonePrefix"
        @rename-group="renameGroup"
        @delete-group="deleteGroup"
        @create-note-in-group="createNoteInGroup"
        @create-notes-in-group="createNotesInGroup"
        @rename-note="renameNote"
        @delete-note="deleteNote"
        @create-note-around="createNoteAround"
        @open-note-about="openNoteAbout"
        @reorder-sidebar="reorderSidebar"
      />
    </nav>
  </div>
</template>

<script setup lang="ts">
import { useRoute, useData } from 'vitepress'
import { ref, onMounted, watch, computed } from 'vue'

import SidebarItems from './SidebarItems.vue'
import {
  SIDEBAR_SHOW_NOTE_ID_KEY,
  SIDEBAR_MAX_DEPTH_KEY,
  SIDEBAR_DENSITY_KEY,
  SIDEBAR_DONE_PREFIX_KEY,
  SIDEBAR_UNDONE_PREFIX_KEY,
} from '../constants'
// @ts-expect-error - VitePress Data Loader
import { data as sidebarConfig } from '../sidebar.data'
// @ts-expect-error - VitePress Data Loader
import { data as tnotesConfig } from '../tnotes-config.data'

// 支持递归的侧边栏项类型
interface SidebarItem {
  text: string
  link?: string
  items?: SidebarItem[]
  collapsed?: boolean
}

const route = useRoute()
const { site } = useData()
const sidebarGroups = ref<SidebarItem[]>([])
const navRef = ref<HTMLElement | null>(null)
const currentFocusIndex = ref(0)

const emit = defineEmits<{
  'open-note-about': [noteIndex: string]
}>()

interface GroupActionPayload {
  groupPath: string[]
  text: string
}

interface NoteActionPayload {
  noteIndex: string
  text: string
  link?: string
  placement?: 'before' | 'after'
}

interface SidebarActionResult {
  success: boolean
  message?: string
  redirectUrl?: string
  newUrl?: string
}

interface ReorderPayload {
  dragType: 'group' | 'note'
  groupPath?: string[]
  noteIndex?: string
  targetType: 'group' | 'note'
  targetGroupPath?: string[]
  targetNoteIndex?: string
  placement?: 'before' | 'after'
}

type SidebarDensity = 'compact' | 'default' | 'loose'

const DEFAULT_SIDEBAR_DENSITY: SidebarDensity = 'default'
const DEFAULT_DONE_PREFIX = '✅'
const DEFAULT_UNDONE_PREFIX = '⏰'

// 最大解析层级（默认 3 层）
const maxDepth = computed(() => {
  if (typeof window === 'undefined') {
    return tnotesConfig.sidebarMaxDepth ?? 3
  }

  const savedMaxDepth = localStorage.getItem(SIDEBAR_MAX_DEPTH_KEY)
  if (savedMaxDepth !== null) {
    return parseInt(savedMaxDepth, 10)
  }

  return tnotesConfig.sidebarMaxDepth ?? 3
})

// 获取配置：是否显示笔记 ID
const showNoteId = computed(() => {
  if (typeof window === 'undefined') {
    return tnotesConfig.sidebarShowNoteId ?? false
  }

  const savedShowNoteId = localStorage.getItem(SIDEBAR_SHOW_NOTE_ID_KEY)
  if (savedShowNoteId !== null) {
    return savedShowNoteId === 'true'
  }

  return tnotesConfig.sidebarShowNoteId ?? false
})

const sidebarDensity = computed<SidebarDensity>(() => {
  if (typeof window === 'undefined') return DEFAULT_SIDEBAR_DENSITY

  return normalizeSidebarDensity(localStorage.getItem(SIDEBAR_DENSITY_KEY))
})

const donePrefix = computed(() => {
  if (typeof window === 'undefined') return DEFAULT_DONE_PREFIX

  const savedPrefix = localStorage.getItem(SIDEBAR_DONE_PREFIX_KEY)
  return savedPrefix !== null ? savedPrefix : DEFAULT_DONE_PREFIX
})

const undonePrefix = computed(() => {
  if (typeof window === 'undefined') return DEFAULT_UNDONE_PREFIX

  const savedPrefix = localStorage.getItem(SIDEBAR_UNDONE_PREFIX_KEY)
  return savedPrefix !== null ? savedPrefix : DEFAULT_UNDONE_PREFIX
})

// 获取 base 路径
const base = computed(() => site.value.base || '/')

const isDev = computed(() => {
  if (typeof window === 'undefined') return false
  return (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
  )
})

// 加载 sidebar 数据
function loadSidebar() {
  if (sidebarConfig && sidebarConfig['/notes/']) {
    sidebarGroups.value = processItems(sidebarConfig['/notes/'])
  }
}

// 递归处理侧边栏项，添加 collapsed 状态
function processItems(items: any[]): SidebarItem[] {
  return items.map((item) => ({
    ...item,
    collapsed: item.collapsed ?? true,
    items: item.items ? processItems(item.items) : undefined,
  }))
}

function stripHeadingNumber(text: string): string {
  return text.replace(/^\d+(?:\.\d+)*\.\s*/, '')
}

function stripNoteTitlePrefix(text: string): string {
  return text
    .replace(/^[✅⏰]\s*/, '')
    .replace(/^\d{4}\.?\s*/, '')
    .trim()
}

function normalizeSidebarDensity(value: string | null): SidebarDensity {
  if (value === 'compact' || value === 'default' || value === 'loose') {
    return value
  }

  return DEFAULT_SIDEBAR_DENSITY
}

function isCurrentNote(noteIndex: string): boolean {
  const decodedRoutePath = decodeURIComponent(route.path)
  return decodedRoutePath.includes(`/notes/${noteIndex}.`)
}

function resolveUrl(path: string): string {
  const normalizedBase = base.value.endsWith('/') ? base.value : `${base.value}/`
  return normalizedBase + path.replace(/^\/+/, '')
}

async function requestSidebarAction(
  path: string,
  body: unknown,
): Promise<SidebarActionResult> {
  const response = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  const result = (await response.json().catch(() => null)) as
    | SidebarActionResult
    | null

  if (!response.ok || !result?.success) {
    throw new Error(result?.message || response.statusText || '操作失败')
  }

  setTimeout(() => {
    loadSidebar()
  }, 150)

  return result
}

async function runSidebarAction(action: () => Promise<void>) {
  if (!isDev.value) return

  try {
    await action()
  } catch (error) {
    alert(error instanceof Error ? error.message : String(error))
  }
}

function renameGroup(payload: GroupActionPayload) {
  void runSidebarAction(async () => {
    const newTitle = window.prompt('请输入新的目录名称', stripHeadingNumber(payload.text))
    if (newTitle === null) return

    await requestSidebarAction('/__tnotes_sidebar_rename_group', {
      groupPath: payload.groupPath,
      newTitle,
    })
  })
}

function deleteGroup(payload: GroupActionPayload) {
  void runSidebarAction(async () => {
    const confirmed = window.confirm(
      `确定删除目录「${payload.groupPath.join(' / ')}」及其下所有笔记吗？`,
    )
    if (!confirmed) return

    const result = await requestSidebarAction('/__tnotes_sidebar_delete_group', {
      groupPath: payload.groupPath,
    })

    if (result.redirectUrl) {
      window.location.replace(resolveUrl(result.redirectUrl))
    }
  })
}

function createNoteInGroup(payload: GroupActionPayload) {
  void runSidebarAction(async () => {
    await requestSidebarAction('/__tnotes_sidebar_create_note', {
      groupPath: payload.groupPath,
      count: 1,
    })
  })
}

function createNotesInGroup(payload: GroupActionPayload) {
  void runSidebarAction(async () => {
    const input = window.prompt('请输入新增笔记数量（1-100）', '1')
    if (input === null) return

    const count = Number(input)
    if (!Number.isInteger(count) || count < 1 || count > 100) {
      throw new Error('新增多篇笔记的数量必须是 1-100 的整数')
    }

    await requestSidebarAction('/__tnotes_sidebar_create_notes', {
      groupPath: payload.groupPath,
      count,
    })
  })
}

function renameNote(payload: NoteActionPayload) {
  void runSidebarAction(async () => {
    if (!payload.noteIndex) return

    const newTitle = window.prompt(
      '请输入新的笔记名称',
      stripNoteTitlePrefix(payload.text),
    )
    if (newTitle === null) return

    const result = await requestSidebarAction('/__tnotes_rename_note', {
      noteIndex: payload.noteIndex,
      newTitle,
    })

    if (result.newUrl && isCurrentNote(payload.noteIndex)) {
      window.location.replace(resolveUrl(result.newUrl))
    }
  })
}

function deleteNote(payload: NoteActionPayload) {
  void runSidebarAction(async () => {
    if (!payload.noteIndex) return

    const confirmed = window.confirm(
      `确定删除笔记「${stripHeadingNumber(payload.text)}」吗？`,
    )
    if (!confirmed) return

    const result = await requestSidebarAction('/__tnotes_sidebar_delete_note', {
      noteIndex: payload.noteIndex,
    })

    if (result.redirectUrl && isCurrentNote(payload.noteIndex)) {
      window.location.replace(resolveUrl(result.redirectUrl))
    }
  })
}

function createNoteAround(payload: NoteActionPayload) {
  void runSidebarAction(async () => {
    if (!payload.noteIndex || !payload.placement) return

    await requestSidebarAction('/__tnotes_sidebar_create_note', {
      targetNoteIndex: payload.noteIndex,
      placement: payload.placement,
      count: 1,
    })
  })
}

function openNoteAbout(payload: NoteActionPayload) {
  if (!payload.noteIndex) return
  emit('open-note-about', payload.noteIndex)
}

function reorderSidebar(payload: ReorderPayload) {
  void runSidebarAction(async () => {
    await requestSidebarAction('/__tnotes_sidebar_reorder', payload)
  })
}

// 判断项是否有子项
function hasChildren(item: SidebarItem): boolean {
  return !!(item.items && item.items.length > 0)
}

// 获取项的唯一 key
function getItemKey(item: SidebarItem): string {
  return item.link || item.text
}

// 切换项的展开/折叠状态（支持递归）
function toggleItem(item: SidebarItem) {
  item.collapsed = !item.collapsed
}

// 递归查找并切换项
function toggleItemRecursive(items: SidebarItem[], text: string): boolean {
  for (const item of items) {
    if (item.text === text) {
      item.collapsed = !item.collapsed
      return true
    }
    if (item.items && toggleItemRecursive(item.items, text)) {
      return true
    }
  }
  return false
}

// 切换组展开/折叠（保留兼容性）
function toggleGroup(groupText: string) {
  toggleItemRecursive(sidebarGroups.value, groupText)
}

// 递归展开/折叠所有项
function setAllCollapsed(items: SidebarItem[], collapsed: boolean) {
  items.forEach((item) => {
    if (item.items) {
      item.collapsed = collapsed
      setAllCollapsed(item.items, collapsed)
    }
  })
}

// 检查是否有任何一级章节处于展开状态
function hasAnyFirstLevelExpanded(): boolean {
  return sidebarGroups.value.some((group) => !group.collapsed)
}

// 展开全部
function expandAll() {
  setAllCollapsed(sidebarGroups.value, false)
}

// 折叠全部
function collapseAll() {
  setAllCollapsed(sidebarGroups.value, true)
}

// 智能切换：如果有展开的一级章节则折叠全部，否则展开全部
function toggleExpandCollapse() {
  if (hasAnyFirstLevelExpanded()) {
    collapseAll()
  } else {
    expandAll()
  }
}

// 获取当前笔记的所有出现位置
function getCurrentNotePositions(): HTMLElement[] {
  const elements: HTMLElement[] = []

  if (!navRef.value) {
    return elements
  }

  const activeItems = navRef.value.querySelectorAll('.nav-item.active')

  activeItems.forEach((item) => {
    elements.push(item as HTMLElement)
  })

  return elements
}

// 展开指定元素的父级分组
function expandParentGroup(element: HTMLElement) {
  // 查找所有父级 group 元素（从最近的开始）
  let currentElement: HTMLElement | null = element
  const groupsToExpand: string[] = []

  // 向上遍历，收集所有父级 group 的标题文本
  while (currentElement) {
    const groupElement: HTMLElement | null =
      currentElement.closest<HTMLElement>('.group')
    if (!groupElement) break

    const groupTitleText = groupElement.querySelector('.group-title-text')
    if (groupTitleText) {
      const groupText = groupTitleText.textContent?.trim()
      if (groupText) {
        groupsToExpand.push(groupText)
      }
    }

    // 继续向上查找
    currentElement =
      groupElement.parentElement?.closest<HTMLElement>('.group') || null
  }

  // 从最外层开始展开，逐层向内
  // 但是搜索时要确保在正确的上下文中搜索
  if (groupsToExpand.length === 0) return

  // 反转数组，从最外层开始处理
  const outerToInner = [...groupsToExpand].reverse()

  // 第一层必须从根开始搜索
  let currentContext: SidebarItem[] | null = null

  for (let i = 0; i < outerToInner.length; i++) {
    const groupText = outerToInner[i]

    if (i === 0) {
      // 第一层从根搜索
      const found = expandGroupRecursive(sidebarGroups.value, groupText)
      if (found) {
        // 找到后，获取这个分组的 items 作为下一层的搜索上下文
        const foundGroup = findGroupByText(sidebarGroups.value, groupText)
        if (foundGroup?.items) {
          currentContext = foundGroup.items
        }
      }
    } else {
      // 后续层从上一层的上下文中搜索
      if (currentContext) {
        const found = expandGroupRecursive(currentContext, groupText)
        if (found) {
          const foundGroup = findGroupByText(currentContext, groupText)
          if (foundGroup?.items) {
            currentContext = foundGroup.items
          }
        }
      }
    }
  }
}

// 查找分组（不展开，只返回引用）
function findGroupByText(
  items: SidebarItem[],
  targetText: string
): SidebarItem | null {
  for (const item of items) {
    if (item.text === targetText) {
      return item
    }
    if (item.items) {
      const found = findGroupByText(item.items, targetText)
      if (found) return found
    }
  }
  return null
}

// 递归查找并展开分组
function expandGroupRecursive(
  items: SidebarItem[],
  targetText: string,
): boolean {
  for (const item of items) {
    if (item.text === targetText) {
      item.collapsed = false
      return true
    }

    if (item.items) {
      const found = expandGroupRecursive(item.items, targetText)
      if (found) {
        // 如果在子项中找到了，也展开当前项
        item.collapsed = false
        return true
      }
    }
  }

  return false
}

// 滚动到指定元素
function scrollToElement(element: HTMLElement) {
  if (!element || !navRef.value) {
    // console.log('❌ [scrollToElement] No element or navRef')
    return
  }

  const navContainer = navRef.value.closest('.VPSidebar')
  if (!navContainer) {
    // console.log('❌ [scrollToElement] No VPSidebar container found')
    return
  }

  // console.log('📍 [scrollToElement] Scrolling to element')

  // 计算元素相对于容器的位置
  const elementRect = element.getBoundingClientRect()
  const containerRect = navContainer.getBoundingClientRect()

  // 计算需要滚动的距离（将元素放在容器中间）
  const scrollTop =
    navContainer.scrollTop +
    elementRect.top -
    containerRect.top -
    containerRect.height / 2 +
    elementRect.height / 2

  navContainer.scrollTo({
    top: scrollTop,
    behavior: 'smooth',
  })

  // 添加临时高亮动画
  element.classList.add('focus-highlight')
  setTimeout(() => {
    element.classList.remove('focus-highlight')
  }, 1000)
}

// 聚焦到当前笔记（支持多个位置切换）
function focusCurrentNote() {
  const positions = getCurrentNotePositions()

  if (positions.length === 0) {
    return
  }

  // 循环切换聚焦位置
  currentFocusIndex.value = (currentFocusIndex.value + 1) % positions.length
  const targetElement = positions[currentFocusIndex.value]

  // 展开该笔记所在的分组
  expandParentGroup(targetElement)

  // 滚动到该笔记
  setTimeout(() => {
    scrollToElement(targetElement)
  }, 100)
}

// 展开当前激活笔记的所有父级分组
function expandActiveItemParents() {
  expandActiveItemParentsRecursive(sidebarGroups.value)
}

// 递归展开包含激活项的父级
function expandActiveItemParentsRecursive(items: SidebarItem[]): boolean {
  let hasActive = false

  for (const item of items) {
    if (item.link) {
      // 检查当前项是否激活
      const fullLink = getFullLink(item.link)
      const decodedRoutePath = decodeURIComponent(route.path)
      const decodedFullLink = decodeURIComponent(fullLink)
      const itemActive =
        decodedRoutePath === decodedFullLink ||
        decodedRoutePath === decodedFullLink + '.html'

      if (itemActive) {
        hasActive = true
      }
    } else if (item.items) {
      const childHasActive = expandActiveItemParentsRecursive(item.items)
      if (childHasActive) {
        item.collapsed = false
        hasActive = true
      }
    }
  }

  return hasActive
}

// 获取完整链接（包含 base）
function getFullLink(link: string) {
  const cleanLink = link.startsWith('/') ? link.slice(1) : link
  return base.value + cleanLink
}

// 滚动到当前激活的笔记
function scrollToActiveItem() {
  // 等待 DOM 更新
  setTimeout(() => {
    const positions = getCurrentNotePositions()
    if (positions.length > 0) {
      // 展开所有包含当前笔记的分组
      expandActiveItemParents()

      // 滚动到第一个位置
      setTimeout(() => {
        scrollToElement(positions[0])
      }, 100)
    }
  }, 300)
}

// 暴露函数给父组件使用
defineExpose({
  expandAll,
  collapseAll,
  toggleExpandCollapse,
  hasAnyFirstLevelExpanded,
  focusCurrentNote,
})

onMounted(() => {
  loadSidebar()

  // 调试：打印配置信息
  // console.log('🔧 [CustomSidebar] showNoteId:', showNoteId.value)
  // if (typeof window !== 'undefined') {
  //   console.log(
  //     '🔧 [CustomSidebar] localStorage value:',
  //     localStorage.getItem(SIDEBAR_SHOW_NOTE_ID_KEY)
  //   )
  // }
  // console.log(
  //   '🔧 [CustomSidebar] tnotesConfig value:',
  //   tnotesConfig.sidebarShowNoteId
  // )

  // 自动滚动到当前激活的笔记
  scrollToActiveItem()
})

// 监听 sidebarConfig 的变化（HMR 会更新这个导入的数据）
watch(
  () => sidebarConfig,
  () => {
    // console.log('🔄 [CustomSidebar] Sidebar config changed, reloading...')
    loadSidebar()
  },
  { deep: true }
)

// 监听 tnotesConfig 的变化
watch(
  () => tnotesConfig,
  () => {
    // console.log(
    //   '🔄 [CustomSidebar] TNotes config changed, sidebarShowNoteId:',
    //   tnotesConfig.sidebarShowNoteId
    // )
  },
  { deep: true }
)

// 监听路由变化，自动展开当前激活项所在的组并滚动
watch(
  () => route.path,
  () => {
    // 重置聚焦索引
    currentFocusIndex.value = 0

    // 展开并滚动到当前笔记
    expandActiveItemParents()
    scrollToActiveItem()
  }
)
</script>

<style scoped>
/* 自定义 sidebar 容器，适配 VitePress 的 sidebar-nav-before 插槽 */
.custom-sidebar-wrapper {
  /* 不需要设置 position 和尺寸，因为它在 VitePress 的 sidebar 容器内 */
}

.nav {
  font-size: 14px;
  line-height: 2;
}

.group {
  margin-bottom: 16px;
}

.group-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  padding: 6px 0;
  font-weight: 600;
  color: var(--vp-c-text-1);
  background: none;
  border: none;
  cursor: pointer;
  text-align: left;
  transition: color 0.25s;
}

.group-title:hover {
  color: var(--vp-c-brand-1);
}

.arrow {
  font-size: 10px;
  transform: rotate(90deg);
  transition: transform 0.25s;
}

.arrow.collapsed {
  transform: rotate(0deg);
}

.nav-item {
  display: block;
  padding: 4px;
  color: var(--vp-c-text-2);
  text-decoration: none;
  border-radius: 4px;
  font-size: 14px;
  line-height: 24px;
  transition: all 0.25s;
}

.nav-item:hover {
  color: var(--vp-c-brand-1);
  background-color: var(--vp-c-default-soft);
}

.nav-item.active {
  color: var(--vp-c-brand-1);
  font-weight: 600;
}

/* 聚焦高亮动画 */
.nav-item.focus-highlight {
  animation: focusPulse 1s ease-in-out;
}

@keyframes focusPulse {
  0%,
  100% {
    background-color: transparent;
  }
  50% {
    background-color: var(--vp-c-brand-soft);
  }
}
</style>

<!-- 全局样式：隐藏 VitePress 默认的 sidebar nav -->
<style>
/* 隐藏 VitePress 默认的 sidebar 导航内容（保留容器） */
.VPSidebarNav {
  display: none !important;
}
</style>
