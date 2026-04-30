<template>
  <div
    class="sidebar-resize-handle"
    :class="{
      'is-hidden': hidden,
      'is-dragging': isDragging,
      'is-fullscreen': isContentFullscreen,
    }"
  >
    <div
      v-if="!hidden"
      class="resize-hotspot"
      :aria-label="`拖动调整侧边栏宽度，当前 ${width}px`"
      role="separator"
      aria-orientation="vertical"
      :aria-valuemin="minWidth"
      :aria-valuemax="maxWidth"
      :aria-valuenow="width"
      @mousedown.prevent="startResize"
    ></div>

    <div v-if="!hidden" class="resize-indicator" aria-hidden="true"></div>

    <button
      class="sidebar-edge-toggle"
      type="button"
      :aria-label="toggleTitle"
      :aria-pressed="hidden"
      @click.stop="toggleSidebar"
    >
      <img :src="toggleIcon" alt="" />
      <span class="sidebar-edge-tooltip" role="tooltip">
        <span>{{ toggleActionText }}</span>
        <kbd>{{ shortcutText }}</kbd>
      </span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import { useSidebarLayout } from './composables/useSidebarLayout'
import { icon__next, icon__prev } from '../../assets/icons'

const {
  hidden,
  width,
  minWidth,
  maxWidth,
  initSidebarLayout,
  toggleSidebar,
  setSidebarWidth,
  saveSidebarWidth,
} = useSidebarLayout()

const isDragging = ref(false)
const isContentFullscreen = ref(false)
const shortcutText = ref('Ctrl + Alt + ,')
let fullscreenObserver: MutationObserver | null = null

const toggleIcon = computed(() => (hidden.value ? icon__next : icon__prev))
const toggleActionText = computed(() =>
  hidden.value ? '展开侧边栏' : '收起侧边栏',
)
const toggleTitle = computed(
  () => `${toggleActionText.value}\n${shortcutText.value}`,
)

onMounted(() => {
  initSidebarLayout()
  shortcutText.value = getShortcutText()
  updateContentFullscreen()
  fullscreenObserver = new MutationObserver(updateContentFullscreen)
  fullscreenObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  })
  window.addEventListener('keydown', handleShortcut)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleShortcut)
  fullscreenObserver?.disconnect()
  fullscreenObserver = null
  stopResize()
})

function startResize(event: MouseEvent) {
  if (hidden.value || event.button !== 0) return

  isDragging.value = true
  document.body.classList.add('is-sidebar-resizing')
  window.addEventListener('mousemove', resize)
  window.addEventListener('mouseup', stopResize)
  setSidebarWidth(event.clientX)
}

function resize(event: MouseEvent) {
  if (!isDragging.value) return

  setSidebarWidth(event.clientX)
}

function stopResize() {
  if (!isDragging.value) return

  isDragging.value = false
  document.body.classList.remove('is-sidebar-resizing')
  window.removeEventListener('mousemove', resize)
  window.removeEventListener('mouseup', stopResize)
  saveSidebarWidth()
}

function handleShortcut(event: KeyboardEvent) {
  if (!isToggleShortcut(event) || isEditableTarget(event.target)) return

  event.preventDefault()
  toggleSidebar()
}

function updateContentFullscreen() {
  isContentFullscreen.value =
    document.documentElement.classList.contains('content-fullscreen')
}

function isToggleShortcut(event: KeyboardEvent): boolean {
  return (
    (event.ctrlKey || event.metaKey) && event.altKey && event.code === 'Comma'
  )
}

function getShortcutText(): string {
  return isMacPlatform() ? 'Cmd + Option + ,' : 'Ctrl + Alt + ,'
}

function isMacPlatform(): boolean {
  if (typeof navigator === 'undefined') return false

  return /Mac|iPhone|iPad|iPod/i.test(navigator.platform)
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false

  const tagName = target.tagName.toLowerCase()
  if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
    return true
  }

  return target.isContentEditable || !!target.closest('[contenteditable="true"]')
}
</script>

<style scoped>
.sidebar-resize-handle {
  position: fixed;
  top: 0;
  bottom: 0;
  left: calc(var(--tn-sidebar-width, 260px) - 5px);
  z-index: 30;
  width: 10px;
  cursor: col-resize;
}

.sidebar-resize-handle::before {
  position: absolute;
  top: var(--vp-nav-height);
  bottom: 0;
  left: 4px;
  width: 2px;
  background: var(--vp-c-brand-1);
  border-radius: 999px;
  box-shadow: 0 0 0 1px var(--vp-c-brand-soft);
  content: '';
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.18s ease;
}

.resize-hotspot {
  position: absolute;
  top: var(--vp-nav-height);
  right: 0;
  bottom: 0;
  left: 0;
}

.resize-indicator {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 4px;
  height: 28px;
  border-right: 1px solid var(--vp-c-brand-1);
  border-left: 1px solid var(--vp-c-brand-1);
  opacity: 0;
  pointer-events: none;
  transform: translate(-50%, -50%);
  transition: opacity 0.18s ease;
}

.sidebar-edge-toggle {
  position: absolute;
  top: 220px;
  left: -2px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 44px;
  padding: 0;
  color: var(--vp-c-text-2);
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  border-radius: 7px;
  box-shadow: var(--vp-shadow-2);
  cursor: pointer;
  opacity: 0;
  pointer-events: none;
  transition:
    opacity 0.18s ease,
    border-color 0.18s ease,
    background-color 0.18s ease;
}

.sidebar-edge-toggle img {
  width: 10px;
  height: 10px;
}

.sidebar-edge-tooltip {
  position: absolute;
  top: 50%;
  left: calc(100% + 8px);
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 128px;
  padding: 7px 9px;
  color: var(--vp-c-text-1);
  background: var(--vp-c-bg-elv);
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  box-shadow: var(--vp-shadow-2);
  font-size: 12px;
  line-height: 18px;
  opacity: 0;
  pointer-events: none;
  text-align: left;
  transform: translate(2px, -50%);
  transition:
    opacity 0.16s ease,
    transform 0.16s ease;
  white-space: nowrap;
}

.sidebar-edge-tooltip kbd {
  color: var(--vp-c-text-2);
  font-family: var(--vp-font-family-mono);
  font-size: 11px;
}

.sidebar-edge-toggle:hover .sidebar-edge-tooltip,
.sidebar-edge-toggle:focus-visible .sidebar-edge-tooltip {
  opacity: 1;
  transform: translate(0, -50%);
}

.sidebar-resize-handle:hover::before,
.sidebar-resize-handle.is-dragging::before,
.sidebar-resize-handle:hover .resize-indicator,
.sidebar-resize-handle.is-dragging .resize-indicator,
.sidebar-resize-handle:hover .sidebar-edge-toggle,
.sidebar-resize-handle.is-dragging .sidebar-edge-toggle,
.sidebar-resize-handle.is-hidden .sidebar-edge-toggle {
  opacity: 1;
  pointer-events: auto;
}

.sidebar-edge-toggle:hover {
  color: var(--vp-c-brand-1);
  background: var(--vp-c-bg-soft);
  border-color: var(--vp-c-brand-1);
}

.sidebar-resize-handle.is-hidden {
  left: 0;
  width: 14px;
  cursor: default;
}

.sidebar-resize-handle.is-hidden::before,
.sidebar-resize-handle.is-hidden .resize-indicator {
  display: none;
}

.sidebar-resize-handle.is-hidden .sidebar-edge-toggle {
  left: 0;
  border-left-color: var(--vp-c-divider);
  border-radius: 0 7px 7px 0;
}

:global(body.is-sidebar-resizing),
:global(body.is-sidebar-resizing *) {
  cursor: col-resize !important;
  user-select: none !important;
}

.sidebar-resize-handle.is-fullscreen {
  display: none;
}

@media (max-width: 959px) {
  .sidebar-resize-handle {
    display: none;
  }
}
</style>
