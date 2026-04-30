<template>
  <template v-for="item in items" :key="getItemKey(item)">
    <!-- 只有在不超过最大层级时才渲染组 -->
    <div
      v-if="hasChildren(item) && depth < maxDepth - 1"
      class="group"
      :class="getDensityClass()"
    >
      <div
        class="sidebar-row group-row"
        :class="[getGroupDropClass(item), getDensityClass()]"
        :style="getNodeStyle(depth)"
        :draggable="isDev"
        @dragstart="onGroupDragStart($event, item)"
        @dragend="clearDropTarget"
        @dragover.prevent.stop="onGroupDragOver($event, item)"
        @drop.stop="onGroupDrop($event, item)"
      >
        <button
          class="group-title row-main"
          :class="`group-title-level-${depth}`"
          @click="toggleItem(item)"
        >
          <span class="arrow" :class="{ collapsed: item.collapsed }">
            <img
              :src="
                item.collapsed ? icon__sidebar_collapsed : icon__sidebar_opened
              "
              alt=""
            />
          </span>

          <span class="group-title-text">{{ item.text }}</span>
        </button>

        <div
          v-if="isDev"
          class="row-actions"
          :class="{ 'menu-open': isGroupMenuOpen(item) }"
          @click.stop
        >
          <button
            class="action-btn menu-trigger"
            title="更多操作"
            type="button"
            @click="toggleMenu(getGroupMenuKey(item, 'more'))"
          >
            <span class="ellipsis">...</span>
          </button>

          <div
            v-if="isMenuOpen(getGroupMenuKey(item, 'more'))"
            class="action-menu"
          >
            <button class="menu-item" type="button" @click="renameGroup(item)">
              重命名目录
            </button>
            <button
              class="menu-item danger"
              type="button"
              @click="deleteGroup(item)"
            >
              删除目录
            </button>
          </div>

          <button
            class="action-btn menu-trigger add-trigger"
            title="新增"
            type="button"
            @click="toggleMenu(getGroupMenuKey(item, 'add'))"
          >
            +
          </button>

          <div
            v-if="isMenuOpen(getGroupMenuKey(item, 'add'))"
            class="action-menu"
          >
            <button
              class="menu-item"
              type="button"
              @click="createNoteInGroup(item)"
            >
              新增笔记
            </button>
            <button
              class="menu-item"
              type="button"
              @click="createNotesInGroup(item)"
            >
              新增多篇笔记
            </button>
          </div>
        </div>
      </div>

      <div v-show="!item.collapsed" class="group-items">
        <SidebarItems
          :items="getChildItems(item)"
          :depth="depth + 1"
          :max-depth="maxDepth"
          :show-note-id="showNoteId"
          :base="base"
          :current-path="currentPath"
          :item-depth="depth + 1"
          :group-path="getGroupPath(item)"
          :is-dev="isDev"
          :sidebar-density="sidebarDensity"
          :done-prefix="donePrefix"
          :undone-prefix="undonePrefix"
          @rename-group="$emit('rename-group', $event)"
          @delete-group="$emit('delete-group', $event)"
          @create-note-in-group="$emit('create-note-in-group', $event)"
          @create-notes-in-group="$emit('create-notes-in-group', $event)"
          @rename-note="$emit('rename-note', $event)"
          @delete-note="$emit('delete-note', $event)"
          @create-note-around="$emit('create-note-around', $event)"
          @open-note-about="$emit('open-note-about', $event)"
          @reorder-sidebar="$emit('reorder-sidebar', $event)"
        />
      </div>
    </div>

    <!-- 如果是链接项，或者是超过最大层级的组，都不渲染 -->
    <div
      v-else-if="!hasChildren(item)"
      class="sidebar-row note-row"
      :class="[getNoteDropClass(item), getDensityClass()]"
      :style="getNodeStyle(actualItemDepth)"
      :draggable="isDev"
      @dragstart="onNoteDragStart($event, item)"
      @dragend="clearDropTarget"
      @dragover.prevent.stop="onNoteDragOver($event, item)"
      @drop.stop="onNoteDrop($event, item)"
    >
      <a
        :href="getFullLink(item.link)"
        :class="[
          'nav-item',
          'row-main',
          { active: isActive(item.link) },
          `nav-item-${extractNoteIdFromLink(item.link)}`,
          `nav-item-level-${actualItemDepth + 1}`,
        ]"
        :data-note-id="extractNoteIdFromLink(item.link)"
      >
        {{ getNoteDisplayText(item.text, item.link) }}
      </a>

      <div
        v-if="isDev"
        class="row-actions"
        :class="{ 'menu-open': isNoteMenuOpen(item) }"
        @click.stop
      >
        <button
          class="action-btn menu-trigger"
          title="更多操作"
          type="button"
          @click="toggleMenu(getNoteMenuKey(item, 'more'))"
        >
          <span class="ellipsis">...</span>
        </button>

        <div
          v-if="isMenuOpen(getNoteMenuKey(item, 'more'))"
          class="action-menu"
        >
          <button class="menu-item" type="button" @click="renameNote(item)">
            重命名
          </button>
          <button
            class="menu-item danger"
            type="button"
            @click="deleteNote(item)"
          >
            删除笔记
          </button>
          <button class="menu-item" type="button" @click="openNoteAbout(item)">
            关于
          </button>
        </div>

        <button
          class="action-btn menu-trigger add-trigger"
          title="新增"
          type="button"
          @click="toggleMenu(getNoteMenuKey(item, 'add'))"
        >
          +
        </button>

        <div
          v-if="isMenuOpen(getNoteMenuKey(item, 'add'))"
          class="action-menu"
        >
          <button
            class="menu-item"
            type="button"
            @click="createNoteAround(item, 'before')"
          >
            在上方新增笔记
          </button>
          <button
            class="menu-item"
            type="button"
            @click="createNoteAround(item, 'after')"
          >
            在下方新增笔记
          </button>
        </div>
      </div>
    </div>
  </template>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'

import {
  icon__sidebar_opened,
  icon__sidebar_collapsed,
} from '../../assets/icons'

interface SidebarItem {
  text: string
  link?: string
  items?: SidebarItem[]
  collapsed?: boolean
}

interface Props {
  items: SidebarItem[]
  depth: number
  maxDepth: number
  showNoteId: boolean
  base: string
  currentPath: string
  itemDepth?: number // 用于计算链接项的缩进，默认等于 depth
  groupPath?: string[]
  isDev?: boolean
  sidebarDensity?: SidebarDensity
  donePrefix?: string
  undonePrefix?: string
}

const props = withDefaults(defineProps<Props>(), {
  depth: 0,
  maxDepth: 3,
  showNoteId: false,
  base: '/',
  currentPath: '',
  itemDepth: undefined,
  groupPath: () => [],
  isDev: false,
  sidebarDensity: 'default',
  donePrefix: '✅',
  undonePrefix: '⏰',
})

const emit = defineEmits<{
  'rename-group': [payload: GroupPayload]
  'delete-group': [payload: GroupPayload]
  'create-note-in-group': [payload: GroupPayload]
  'create-notes-in-group': [payload: GroupPayload]
  'rename-note': [payload: NotePayload]
  'delete-note': [payload: NotePayload]
  'create-note-around': [
    payload: NotePayload & { placement: 'before' | 'after' },
  ]
  'open-note-about': [payload: NotePayload]
  'reorder-sidebar': [payload: ReorderPayload]
}>()

interface GroupPayload {
  groupPath: string[]
  text: string
}

interface NotePayload {
  noteIndex: string
  text: string
  link?: string
}

interface DragPayload {
  type: 'group' | 'note'
  groupPath?: string[]
  noteIndex?: string
}

interface DropTarget {
  type: 'group' | 'note'
  key: string
  placement: 'before' | 'after' | 'inside'
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

type MenuType = 'more' | 'add'
type SidebarDensity = 'compact' | 'default' | 'loose'
type NoteStatus = 'done' | 'undone' | null

// 获取实际的 item depth（用于链接项的缩进）
const actualItemDepth = computed(() => props.itemDepth ?? props.depth)
const openMenuKey = ref<string | null>(null)
const dropTarget = ref<DropTarget | null>(null)
let ignoredToggleKey: string | null = null

const dragDataType = 'application/x-tnotes-sidebar-node'
const dragNoteType = 'application/x-tnotes-sidebar-note'
const dragGroupType = 'application/x-tnotes-sidebar-group'

if (typeof document !== 'undefined') {
  document.addEventListener('click', closeMenuOnDocumentClick, true)
  document.addEventListener('dragend', clearDropTarget, true)
  document.addEventListener('drop', clearDropTarget, true)
}

onBeforeUnmount(() => {
  if (typeof document !== 'undefined') {
    document.removeEventListener('click', closeMenuOnDocumentClick, true)
    document.removeEventListener('dragend', clearDropTarget, true)
    document.removeEventListener('drop', clearDropTarget, true)
  }
})

// 判断项是否有子项
function hasChildren(item: SidebarItem): boolean {
  return !!(item.items && item.items.length > 0)
}

function getChildItems(item: SidebarItem): SidebarItem[] {
  return item.items ?? []
}

// 获取项的唯一 key
function getItemKey(item: SidebarItem): string {
  return item.link || item.text
}

// 切换项的展开/折叠状态
function toggleItem(item: SidebarItem) {
  item.collapsed = !item.collapsed
}

function getNodeStyle(depth: number) {
  return {
    paddingLeft: `${depth * getIndentSize()}px`,
  }
}

function getDensityClass(): string {
  return `density-${props.sidebarDensity}`
}

function getIndentSize(): number {
  if (props.sidebarDensity === 'compact') return 20
  if (props.sidebarDensity === 'loose') return 28
  return 24
}

function getGroupPath(item: SidebarItem): string[] {
  return [...props.groupPath, item.text]
}

function getGroupPayload(item: SidebarItem): GroupPayload {
  return {
    groupPath: getGroupPath(item),
    text: item.text,
  }
}

function getNotePayload(item: SidebarItem): NotePayload {
  return {
    noteIndex: extractNoteIdFromLink(item.link) || '',
    text: item.text,
    link: item.link,
  }
}

function getGroupMenuKey(item: SidebarItem, menuType: MenuType): string {
  return `group:${menuType}:${getGroupPath(item).join('/')}`
}

function getGroupDropKey(item: SidebarItem): string {
  return `group:${getGroupPath(item).join('/')}`
}

function getNoteMenuKey(item: SidebarItem, menuType: MenuType): string {
  return `note:${menuType}:${extractNoteIdFromLink(item.link) || item.link || item.text}`
}

function getNoteDropKey(item: SidebarItem): string {
  return `note:${extractNoteIdFromLink(item.link) || item.link || item.text}`
}

function toggleMenu(menuKey: string) {
  if (ignoredToggleKey === menuKey) {
    ignoredToggleKey = null
    return
  }

  openMenuKey.value = openMenuKey.value === menuKey ? null : menuKey
}

function closeMenu() {
  openMenuKey.value = null
}

function isMenuOpen(menuKey: string): boolean {
  return openMenuKey.value === menuKey
}

function closeMenuOnDocumentClick() {
  if (!openMenuKey.value) return

  const closedMenuKey = openMenuKey.value
  openMenuKey.value = null
  ignoredToggleKey = closedMenuKey

  window.setTimeout(() => {
    if (ignoredToggleKey === closedMenuKey) {
      ignoredToggleKey = null
    }
  })
}

function isGroupMenuOpen(item: SidebarItem): boolean {
  return (
    isMenuOpen(getGroupMenuKey(item, 'more')) ||
    isMenuOpen(getGroupMenuKey(item, 'add'))
  )
}

function isNoteMenuOpen(item: SidebarItem): boolean {
  return (
    isMenuOpen(getNoteMenuKey(item, 'more')) ||
    isMenuOpen(getNoteMenuKey(item, 'add'))
  )
}

function renameGroup(item: SidebarItem) {
  emit('rename-group', getGroupPayload(item))
  closeMenu()
}

function deleteGroup(item: SidebarItem) {
  emit('delete-group', getGroupPayload(item))
  closeMenu()
}

function createNoteInGroup(item: SidebarItem) {
  emit('create-note-in-group', getGroupPayload(item))
  closeMenu()
}

function createNotesInGroup(item: SidebarItem) {
  emit('create-notes-in-group', getGroupPayload(item))
  closeMenu()
}

function renameNote(item: SidebarItem) {
  emit('rename-note', getNotePayload(item))
  closeMenu()
}

function deleteNote(item: SidebarItem) {
  emit('delete-note', getNotePayload(item))
  closeMenu()
}

function openNoteAbout(item: SidebarItem) {
  emit('open-note-about', getNotePayload(item))
  closeMenu()
}

function createNoteAround(item: SidebarItem, placement: 'before' | 'after') {
  emit('create-note-around', {
    ...getNotePayload(item),
    placement,
  })
  closeMenu()
}

function setDragData(event: DragEvent, payload: DragPayload) {
  if (!event.dataTransfer) return

  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData(dragDataType, JSON.stringify(payload))
  event.dataTransfer.setData(
    payload.type === 'note' ? dragNoteType : dragGroupType,
    '1',
  )
}

function getDragData(event: DragEvent): DragPayload | null {
  const raw = event.dataTransfer?.getData(dragDataType)
  if (!raw) return null

  try {
    return JSON.parse(raw) as DragPayload
  } catch {
    return null
  }
}

function getDragTypes(event: DragEvent): string[] {
  return Array.from(event.dataTransfer?.types ?? [])
}

function getDraggedType(event: DragEvent): DragPayload['type'] | null {
  const types = getDragTypes(event)

  if (types.includes(dragNoteType)) return 'note'
  if (types.includes(dragGroupType)) return 'group'

  return getDragData(event)?.type ?? null
}

function setDropEffect(event: DragEvent) {
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move'
  }
}

function clearDropTarget() {
  dropTarget.value = null
}

function isSamePath(left: string[], right: string[]): boolean {
  return (
    left.length === right.length &&
    left.every((item, index) => item === right[index])
  )
}

function getNoteDropPlacement(event: DragEvent): 'before' | 'after' {
  const row = event.currentTarget as HTMLElement | null
  if (!row) return 'before'

  const rect = row.getBoundingClientRect()
  return event.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
}

function getGroupDropClass(item: SidebarItem): Record<string, boolean> {
  const key = getGroupDropKey(item)
  return {
    'drop-before':
      dropTarget.value?.type === 'group' &&
      dropTarget.value.key === key &&
      dropTarget.value.placement === 'before',
    'drop-inside':
      dropTarget.value?.type === 'group' &&
      dropTarget.value.key === key &&
      dropTarget.value.placement === 'inside',
  }
}

function getNoteDropClass(item: SidebarItem): Record<string, boolean> {
  const key = getNoteDropKey(item)
  return {
    'drop-before':
      dropTarget.value?.type === 'note' &&
      dropTarget.value.key === key &&
      dropTarget.value.placement === 'before',
    'drop-after':
      dropTarget.value?.type === 'note' &&
      dropTarget.value.key === key &&
      dropTarget.value.placement === 'after',
  }
}

function onGroupDragStart(event: DragEvent, item: SidebarItem) {
  if (!props.isDev) return
  closeMenu()
  setDragData(event, {
    type: 'group',
    groupPath: getGroupPath(item),
  })
}

function onNoteDragStart(event: DragEvent, item: SidebarItem) {
  if (!props.isDev) return
  const noteIndex = extractNoteIdFromLink(item.link)
  if (!noteIndex) return

  closeMenu()
  setDragData(event, {
    type: 'note',
    noteIndex,
  })
}

function onGroupDragOver(event: DragEvent, item: SidebarItem) {
  if (!props.isDev) return

  const draggedType = getDraggedType(event)
  if (!draggedType) return

  setDropEffect(event)

  const targetGroupPath = getGroupPath(item)
  const payload = getDragData(event)
  if (
    draggedType === 'group' &&
    payload?.groupPath &&
    isSamePath(payload.groupPath, targetGroupPath)
  ) {
    clearDropTarget()
    return
  }

  dropTarget.value = {
    type: 'group',
    key: getGroupDropKey(item),
    placement: draggedType === 'note' ? 'inside' : 'before',
  }
}

function onGroupDrop(event: DragEvent, item: SidebarItem) {
  if (!props.isDev) return

  const payload = getDragData(event)
  if (!payload) {
    clearDropTarget()
    return
  }

  const targetGroupPath = getGroupPath(item)

  if (payload.type === 'note' && payload.noteIndex) {
    emit('reorder-sidebar', {
      dragType: 'note',
      noteIndex: payload.noteIndex,
      targetType: 'group',
      targetGroupPath,
    })
    clearDropTarget()
    return
  }

  if (payload.type === 'group' && payload.groupPath) {
    if (isSamePath(payload.groupPath, targetGroupPath)) {
      clearDropTarget()
      return
    }

    emit('reorder-sidebar', {
      dragType: 'group',
      groupPath: payload.groupPath,
      targetType: 'group',
      targetGroupPath,
      placement: 'before',
    })
  }

  clearDropTarget()
}

function onNoteDragOver(event: DragEvent, item: SidebarItem) {
  if (!props.isDev || getDraggedType(event) !== 'note') return

  const targetNoteIndex = extractNoteIdFromLink(item.link)
  const payload = getDragData(event)
  if (!targetNoteIndex || payload?.noteIndex === targetNoteIndex) {
    clearDropTarget()
    return
  }

  setDropEffect(event)
  dropTarget.value = {
    type: 'note',
    key: getNoteDropKey(item),
    placement: getNoteDropPlacement(event),
  }
}

function onNoteDrop(event: DragEvent, item: SidebarItem) {
  if (!props.isDev) return

  const payload = getDragData(event)
  const targetNoteIndex = extractNoteIdFromLink(item.link)
  if (
    !payload ||
    payload.type !== 'note' ||
    !payload.noteIndex ||
    !targetNoteIndex
  ) {
    clearDropTarget()
    return
  }

  if (payload.noteIndex === targetNoteIndex) {
    clearDropTarget()
    return
  }

  const placement = getNoteDropPlacement(event)
  emit('reorder-sidebar', {
    dragType: 'note',
    noteIndex: payload.noteIndex,
    targetType: 'note',
    targetNoteIndex,
    placement,
  })
  clearDropTarget()
}

// 获取完整链接（包含 base）
function getFullLink(link?: string) {
  if (!link) return '#'
  const cleanLink = link.startsWith('/') ? link.slice(1) : link
  return props.base + cleanLink
}

// 判断链接是否激活
function isActive(link?: string) {
  if (!link) return false
  const fullLink = getFullLink(link)
  const decodedRoutePath = decodeURIComponent(props.currentPath)
  const decodedFullLink = decodeURIComponent(fullLink)

  return (
    decodedRoutePath === decodedFullLink ||
    decodedRoutePath === decodedFullLink + '.html'
  )
}

// 从链接中提取笔记 ID
function extractNoteIdFromLink(link?: string): string | null {
  if (!link) return null
  const match = link.match(/\/notes\/(\d{4})\./)
  return match ? match[1] : null
}

// 提取文本开头的 emoji
function extractEmoji(text: string): { emoji: string; rest: string } {
  const emojiMatch = text.match(
    /^([\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}✅❌⏰]+)\s*/u
  )

  if (emojiMatch) {
    return {
      emoji: emojiMatch[1],
      rest: text.slice(emojiMatch[0].length),
    }
  }

  return { emoji: '', rest: text }
}

function getNoteStatusAndText(text: string): {
  status: NoteStatus
  rest: string
} {
  const { emoji, rest } = extractEmoji(text)

  if (emoji.includes('✅')) {
    return { status: 'done', rest }
  }

  if (emoji.includes('⏰')) {
    return { status: 'undone', rest }
  }

  return { status: null, rest: text }
}

function getStatusPrefix(status: NoteStatus): string {
  if (status === 'done') return props.donePrefix
  if (status === 'undone') return props.undonePrefix

  return ''
}

function withStatusPrefix(prefix: string, text: string): string {
  return prefix ? `${prefix} ${text}` : text
}

// 获取笔记显示文本
function getNoteDisplayText(text: string, link?: string): string {
  const { status, rest } = getNoteStatusAndText(text)
  const statusPrefix = getStatusPrefix(status)

  if (props.showNoteId) {
    if (/^\d{4}\./.test(rest)) {
      return withStatusPrefix(statusPrefix, rest)
    }

    const noteId = extractNoteIdFromLink(link)
    if (noteId) {
      return withStatusPrefix(statusPrefix, `${noteId}. ${rest}`)
    }

    return withStatusPrefix(statusPrefix, rest)
  } else {
    const cleanRest = rest.replace(/^\d{4}\.\s*/, '')
    return withStatusPrefix(statusPrefix, cleanRest)
  }
}
</script>

<style scoped>
.group {
  margin-bottom: 2px;
}

.group.density-compact {
  margin-bottom: 0;
}

.group.density-loose {
  margin-bottom: 6px;
}

.sidebar-row {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
  min-height: 30px;
  border-radius: 6px;
  transition: background-color 0.18s ease;
}

.sidebar-row.density-compact {
  min-height: 26px;
  border-radius: 4px;
}

.sidebar-row.density-loose {
  min-height: 36px;
  border-radius: 8px;
}

.sidebar-row:hover {
  background: var(--vp-c-default-soft);
}

.sidebar-row.drop-before::before,
.sidebar-row.drop-after::after {
  position: absolute;
  right: 8px;
  left: 8px;
  z-index: 4;
  height: 2px;
  background: var(--vp-c-brand-1);
  border-radius: 999px;
  content: '';
  pointer-events: none;
}

.sidebar-row.drop-before::before {
  top: -2px;
}

.sidebar-row.drop-after::after {
  bottom: -2px;
}

.sidebar-row.drop-inside {
  background: var(--vp-c-brand-soft);
  outline: 1px solid var(--vp-c-brand-1);
  outline-offset: -1px;
}

.row-main {
  min-width: 0;
  flex: 1;
}

.group-title {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 4px 6px;
  font-weight: 600;
  color: var(--vp-c-text-1);
  background: none;
  border: none;
  cursor: pointer;
  text-align: left;
  transition: color 0.25s;
}

.sidebar-row.density-compact .group-title,
.sidebar-row.density-compact .nav-item {
  min-height: 26px;
  padding: 2px 5px;
  font-size: 13px;
  line-height: 18px;
}

.sidebar-row.density-loose .group-title,
.sidebar-row.density-loose .nav-item {
  min-height: 36px;
  padding: 6px 8px;
  font-size: 14px;
  line-height: 22px;
}

.group-title:hover {
  color: var(--vp-c-brand-1);
}

.group-title-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.arrow {
  display: inline-flex;
  width: 14px;
  height: 14px;
  flex: 0 0 14px;
  transition: transform 0.25s;
}

.arrow:not(.collapsed) {
  transform: rotate(90deg);
}

.arrow img {
  width: 14px;
  height: 14px;
}

.nav-item {
  display: flex;
  align-items: center;
  min-height: 30px;
  padding: 4px 6px;
  color: var(--vp-c-text-2);
  text-decoration: none;
  border-radius: 4px;
  font-size: 14px;
  line-height: 20px;
  transition: all 0.25s;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.nav-item:hover {
  color: var(--vp-c-brand-1);
}

.nav-item.active {
  color: var(--vp-c-brand-1);
  font-weight: 600;
}

.row-actions {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0;
  flex: 0 0 auto;
  width: 0;
  padding-right: 0;
  opacity: 0;
  overflow: visible;
  pointer-events: none;
  transition:
    width 0.18s ease,
    padding-right 0.18s ease,
    gap 0.18s ease,
    opacity 0.18s ease;
}

.sidebar-row:hover .row-actions,
.row-actions:focus-within,
.row-actions.menu-open {
  gap: 4px;
  width: 52px;
  padding-right: 6px;
  opacity: 1;
  pointer-events: auto;
}

.action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  color: var(--vp-c-text-2);
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 11px;
  line-height: 1;
}

.action-btn:hover {
  color: var(--vp-c-brand-1);
  background: var(--vp-c-bg-soft);
}

.menu-trigger {
  font-weight: 600;
  font-family: var(--vp-font-family-base);
}

.ellipsis {
  display: inline-block;
  transform: rotate(90deg);
  transform-origin: center;
  letter-spacing: 1px;
}

.add-trigger {
  font-size: 15px;
}

.action-menu {
  position: absolute;
  top: calc(100% + 4px);
  right: 4px;
  z-index: 5;
  display: flex;
  flex-direction: column;
  min-width: 128px;
  padding: 4px;
  background: var(--vp-c-bg-elv);
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  box-shadow: var(--vp-shadow-2);
}

.menu-item {
  display: block;
  width: 100%;
  padding: 6px 8px;
  color: var(--vp-c-text-1);
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  line-height: 18px;
  text-align: left;
  white-space: nowrap;
}

.menu-item:hover {
  color: var(--vp-c-brand-1);
  background: var(--vp-c-default-soft);
}

.menu-item.danger:hover {
  color: var(--vp-c-danger-1, #ed3c50);
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
