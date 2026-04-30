<template>
  <div class="sidebar-toggle-wrapper">
    <div class="toolbar-row">
      <div class="group group-left">
        <!-- 展开/折叠全部按钮 -->
        <button
          class="toggle-btn"
          @click="$emit('toggle-expand')"
          :title="isExpanded ? '全部折叠' : '全部展开'"
        >
          <img :src="icon__fold" class="toggle-icon" alt="切换展开折叠" />
        </button>
        <a
          :class="[
            'group-label',
            'group-label-link',
            { 'is-active': isCatalogActive },
          ]"
          :href="catalogLink"
          :aria-current="isCatalogActive ? 'page' : undefined"
        >
          目录
        </a>
      </div>

      <div class="group group-right">
        <!-- 聚焦到当前笔记按钮 -->
        <button
          class="toggle-btn"
          @click="$emit('focus-current')"
          title="聚焦到当前笔记（点击切换多个位置）"
        >
          <img :src="icon__focus" class="toggle-icon" alt="聚焦当前笔记" />
        </button>

        <!-- 笔记编号显示切换按钮 -->
        <button
          class="toggle-btn"
          @click="$emit('toggle-note-id')"
          :title="showNoteId ? '隐藏笔记编号' : '显示笔记编号'"
        >
          <img
            :src="showNoteId ? icon__number_purple : icon__number_gray"
            class="toggle-icon"
            alt="切换笔记编号"
          />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useData, useRoute } from 'vitepress'
import { computed } from 'vue'

import {
  icon__fold,
  icon__number_purple,
  icon__number_gray,
  icon__focus,
} from '../../assets/icons'

defineProps<{
  isExpanded: boolean
  showNoteId: boolean
}>()

defineEmits<{
  'toggle-expand': []
  'toggle-note-id': []
  'focus-current': []
}>()

const { site } = useData()
const route = useRoute()

const base = computed(() => site.value.base || '/')
const catalogLink = computed(() => `${base.value}README`)
const catalogPath = computed(() => normalizeRoutePath(catalogLink.value))
const isCatalogActive = computed(() => {
  const currentPath = normalizeRoutePath(route.path)

  return currentPath === catalogPath.value || currentPath === '/README'
})

function normalizeRoutePath(path: string): string {
  const normalizedPath = path.split(/[?#]/)[0].replace(/\.html$/, '')

  return normalizedPath.length > 1
    ? normalizedPath.replace(/\/$/, '')
    : normalizedPath
}
</script>

<style scoped>
.sidebar-toggle-wrapper {
  position: sticky;
  top: 0;
  z-index: 2;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 8px 12px;
  /* border-bottom: 1px solid var(--vp-c-divider); */
  margin-bottom: 10px;
  background: var(--vp-sidebar-bg-color, var(--vp-c-bg));
}

.toolbar-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.group {
  display: flex;
  align-items: center;
  gap: 4px;
}

.group-label {
  font-size: 13px;
  color: var(--vp-c-text-2);
  text-decoration: none;
  user-select: none;
}

.group-label-link:hover {
  color: var(--vp-c-brand-1);
}

.group-label-link.is-active {
  color: var(--vp-c-brand-1);
  font-weight: 600;
}

.toggle-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  padding: 0;
  cursor: pointer;
  background: transparent;
  border: none;
  border-radius: 6px;
  transition: all 0.2s ease;
}

.toggle-btn:hover {
  background: var(--vp-c-bg-soft);
}

.toggle-btn:active .toggle-icon {
  transform: scale(0.95);
}

.toggle-icon {
  width: 18px;
  height: 18px;
  display: block;
  transition: transform 0.2s ease;
}

.toggle-btn:hover .toggle-icon {
  transform: scale(1.1);
}
</style>
