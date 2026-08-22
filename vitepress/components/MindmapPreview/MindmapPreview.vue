<script setup lang="ts">
import { CanvasViewer, MindmapSession } from '@tnotesjs/mindmap-core'
import { onContentUpdated, useData } from 'vitepress'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'

import { applyInitialExpandLevel } from './expandLevel'
import { normalizeMindmapMarkdown } from './markdown'
import MindmapOutlineNode from './MindmapOutlineNode.vue'
import MindmapViewIcon from './MindmapViewIcon.vue'
import { gateMindmapWheel } from './wheelInteraction'
import { icon__fullscreen, icon__fullscreen_exit, icon__zoom_fit } from '../../assets/icons'

type PreviewView = 'mindmap' | 'outline' | 'source'

const props = withDefaults(defineProps<{
  content?: string
  initialExpandLevel?: number
}>(), {
  content: '',
  initialExpandLevel: 3,
})

const { isDark } = useData()
const activeView = ref<PreviewView>('mindmap')
const previewRoot = ref<HTMLElement | null>(null)
const canvasHost = ref<HTMLElement | null>(null)
const session = shallowRef<MindmapSession | null>(null)
const renderVersion = ref(0)
const isFullscreen = ref(false)
const isCanvasActive = ref(false)
let viewer: CanvasViewer | null = null
let mounted = false

const viewOptions = [
  { value: 'mindmap', label: '脑图' },
  { value: 'outline', label: '大纲' },
  { value: 'source', label: '源码' },
] as const

function decodeContent(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

const normalizedContent = computed(() => normalizeMindmapMarkdown(decodeContent(props.content)))

function createViewer(): void {
  if (!mounted || !canvasHost.value || !session.value || viewer) return
  viewer = new CanvasViewer(canvasHost.value, session.value, {
    theme: isDark.value ? 'dark' : 'light',
  })
}

function rebuildSession(): void {
  viewer?.destroy()
  viewer = null
  const next = new MindmapSession({
    markdown: normalizedContent.value,
    fileName: 'mindmap-preview.tn-mindmap.md',
  })
  applyInitialExpandLevel(next, props.initialExpandLevel)
  const invalidate = () => { renderVersion.value += 1 }
  next.on('collapseChange', invalidate)
  next.on('focusChange', invalidate)
  next.on('change', invalidate)
  session.value = next
  renderVersion.value += 1
  void nextTick(createViewer)
}

function setView(view: PreviewView): void {
  activeView.value = view
  if (view !== 'mindmap') isCanvasActive.value = false
  if (view === 'mindmap') void nextTick(() => viewer?.zoomToFit())
}

function toggleNode(id: string): void {
  session.value?.toggleCollapse(id)
}

function exitFocusTo(index: number): void {
  session.value?.exitFocusTo(index)
}

async function toggleFullscreen(): Promise<void> {
  const root = previewRoot.value
  if (!root) return

  try {
    if (document.fullscreenElement === root) await document.exitFullscreen()
    else await root.requestFullscreen()
  } catch {
    // Fullscreen can be rejected by the browser or an embedded document policy.
  }
}

function handleFullscreenChange(): void {
  isFullscreen.value = document.fullscreenElement === previewRoot.value
  if (activeView.value === 'mindmap') void nextTick(() => viewer?.zoomToFit())
}

function activateCanvas(): void {
  isCanvasActive.value = true
}

function handleCanvasWheelCapture(event: WheelEvent): void {
  gateMindmapWheel(event, isCanvasActive.value)
}

function handleDocumentPointerDown(event: PointerEvent): void {
  if (event.target instanceof Node && !previewRoot.value?.contains(event.target)) {
    isCanvasActive.value = false
  }
}

function handleDocumentKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Escape' || !isCanvasActive.value) return
  isCanvasActive.value = false
  canvasHost.value?.blur()
}

watch([normalizedContent, () => props.initialExpandLevel], rebuildSession, { immediate: true })
watch(isDark, (dark) => viewer?.setTheme(dark ? 'dark' : 'light'))

onMounted(() => {
  mounted = true
  document.addEventListener('fullscreenchange', handleFullscreenChange)
  document.addEventListener('pointerdown', handleDocumentPointerDown, true)
  document.addEventListener('keydown', handleDocumentKeydown, true)
  createViewer()
})

onContentUpdated(() => {
  if (activeView.value === 'mindmap') void nextTick(() => viewer?.zoomToFit())
})

onBeforeUnmount(() => {
  mounted = false
  document.removeEventListener('fullscreenchange', handleFullscreenChange)
  document.removeEventListener('pointerdown', handleDocumentPointerDown, true)
  document.removeEventListener('keydown', handleDocumentKeydown, true)
  viewer?.destroy()
  viewer = null
})
</script>

<template>
  <section
    ref="previewRoot"
    class="mindmap-preview"
    :class="{ 'is-dark': isDark, 'is-fullscreen': isFullscreen }"
    :data-version="renderVersion"
  >
    <div class="mindmap-preview-actions">
      <nav class="mindmap-preview-tabs" aria-label="脑图预览视图">
        <button
          v-for="item in viewOptions"
          :key="item.value"
          type="button"
          class="mindmap-preview-action"
          :class="{ 'is-active': activeView === item.value }"
          :aria-label="item.label"
          :aria-pressed="activeView === item.value"
          :title="item.label"
          @click="setView(item.value)"
        >
          <MindmapViewIcon :view="item.value" />
        </button>
      </nav>
      <span class="mindmap-preview-action-divider" aria-hidden="true" />
      <button
        v-if="activeView === 'mindmap'"
        type="button"
        class="mindmap-preview-action"
        aria-label="适应视口"
        title="适应视口"
        @click="viewer?.zoomToFit()"
      >
        <img :src="icon__zoom_fit" alt="" />
      </button>
      <button
        type="button"
        class="mindmap-preview-action"
        :aria-label="isFullscreen ? '退出全屏' : '全屏查看'"
        :title="isFullscreen ? '退出全屏' : '全屏查看'"
        @click="toggleFullscreen"
      >
        <img :src="isFullscreen ? icon__fullscreen_exit : icon__fullscreen" alt="" />
      </button>
    </div>

    <nav v-if="session && session.focusPath.length > 0" class="mindmap-focus-path" aria-label="当前主题路径">
      <button type="button" @click="exitFocusTo(0)">全部</button>
      <template v-for="(node, index) in session.focusPath" :key="node.id">
        <span aria-hidden="true">/</span>
        <button type="button" @click="exitFocusTo(index + 1)">{{ node.content.text }}</button>
      </template>
    </nav>

    <div
      v-show="activeView === 'mindmap'"
      ref="canvasHost"
      class="mindmap-canvas-host"
      :class="{ 'is-interaction-active': isCanvasActive }"
      @pointerdown.capture="activateCanvas"
      @wheel.capture="handleCanvasWheelCapture"
    />

    <div v-if="activeView === 'outline' && session" class="mindmap-outline" :data-version="renderVersion">
      <ul class="mindmap-outline-root">
        <MindmapOutlineNode
          :node="session.focusRootNode"
          :version="renderVersion"
          root
          @toggle="toggleNode"
        />
      </ul>
    </div>

    <pre v-if="activeView === 'source'" class="mindmap-source"><code>{{ normalizedContent }}</code></pre>
  </section>
</template>

<style scoped lang="scss">
.mindmap-preview {
  --mindmap-panel: var(--vp-c-bg-soft);
  --mindmap-border: var(--vp-c-divider);
  position: relative;
  margin: 1.5rem 0;
  overflow: hidden;
  border: 1px solid var(--mindmap-border);
  border-radius: 10px;
  background: var(--vp-c-bg);
}

.mindmap-preview-actions {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px;
  border: .1px solid var(--vp-c-divider);
  border-radius: 7px;
  background-color: color-mix(in srgb, var(--vp-code-block-bg) 92%, transparent);
  box-shadow: var(--vp-shadow-1);
  opacity: 0;
  pointer-events: none;
  transition: opacity .2s;
}

.mindmap-preview-tabs {
  display: flex;
  gap: 4px;
}

.mindmap-preview:hover > .mindmap-preview-actions,
.mindmap-preview-actions:focus-within {
  opacity: 1;
  pointer-events: auto;
}

.mindmap-preview-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--vp-c-brand-1);
  cursor: pointer;
  transition: background-color .2s, transform .2s;

  svg,
  img {
    width: 18px;
    height: 18px;
  }

  &:hover,
  &.is-active {
    background-color: var(--vp-c-default-soft);
  }

  &.is-active {
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--vp-c-brand-1) 35%, transparent);
  }

  &:hover { transform: scale(1.05); }
  &:active { transform: scale(.95); }
}

.mindmap-preview-action-divider {
  width: 1px;
  height: 20px;
  margin: 0 1px;
  background: var(--vp-c-divider);
}

.mindmap-focus-path button {
  color: var(--vp-c-text-2);
  font-size: 12px;

  &:hover { color: var(--vp-c-brand-1); }
}

.mindmap-focus-path {
  display: flex;
  gap: 6px;
  align-items: center;
  padding: 6px 12px;
  overflow-x: auto;
  border-bottom: 1px solid var(--mindmap-border);
  white-space: nowrap;
  color: var(--vp-c-text-3);
}

.mindmap-canvas-host {
  position: relative;
  width: 100%;
  height: 440px;
  overflow: hidden;
  background: var(--vp-c-bg);
  touch-action: none;
  user-select: none;

  &.is-interaction-active {
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--vp-c-brand-1) 38%, transparent);
  }
}

.mindmap-canvas-host:deep(.mm-canvas),
.mindmap-canvas-host:deep(.mm-overlay) {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.mindmap-canvas-host:deep(.mm-overlay) { pointer-events: none; }
.mindmap-canvas-host:deep(.mm-editor) { outline: none; }

.mindmap-outline {
  max-height: 560px;
  padding: 18px 22px 22px;
  overflow: auto;
}

.mindmap-outline-root,
.mindmap-outline :deep(ul) {
  margin: 0;
  padding: 0;
  list-style: none;
}

.mindmap-outline :deep(.mindmap-outline-children) {
  margin-left: 10px;
  padding-left: 19px;
  border-left: 1px solid var(--vp-c-divider);
}

.mindmap-outline :deep(.mindmap-outline-row) {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  min-height: 30px;
  padding: 3px 0;
  color: var(--vp-c-text-1);
  line-height: 24px;
}

.mindmap-outline :deep(.mindmap-outline-toggle),
.mindmap-outline :deep(.mindmap-outline-leaf) {
  flex: 0 0 18px;
  width: 18px;
  color: var(--vp-c-text-3);
  text-align: center;
}

.mindmap-outline :deep(.mindmap-outline-toggle:hover) { color: var(--vp-c-brand-1); }
.mindmap-outline :deep(.mindmap-outline-checkbox) { margin-top: 5px; }
.mindmap-outline :deep(.mindmap-outline-label) { min-width: 0; overflow-wrap: anywhere; }
.mindmap-outline :deep(.mindmap-outline-node.is-root > .mindmap-outline-row) { font-size: 18px; font-weight: 700; }
.mindmap-outline :deep(.mindmap-outline-node.is-done > .mindmap-outline-row .mindmap-outline-label) { opacity: .58; text-decoration: line-through; }
.mindmap-outline :deep(.mindmap-outline-image) { display: block; max-width: min(100%, 560px); max-height: 360px; margin: 5px 0 12px 25px; border-radius: 6px; }
.mindmap-outline :deep(.is-bold) { font-weight: 700; }
.mindmap-outline :deep(.is-italic) { font-style: italic; }
.mindmap-outline :deep(.is-underline) { text-decoration: underline; }
.mindmap-outline :deep(.is-strike) { text-decoration: line-through; }
.mindmap-outline :deep(.is-highlight) { padding: 0 2px; border-radius: 2px; background: #ffe56b; color: #252525; }
.mindmap-outline :deep(.is-code) { padding: 1px 5px; border-radius: 4px; background: var(--vp-c-bg-soft); color: var(--vp-c-danger-1); font-family: var(--vp-font-family-mono); }
.mindmap-outline :deep(.is-link) { color: var(--vp-c-brand-1); text-decoration: underline; text-underline-offset: 3px; }

.mindmap-source {
  max-height: 560px;
  margin: 0;
  padding: 18px 22px;
  overflow: auto;
  border-radius: 0;
  background: var(--vp-code-block-bg);
  color: var(--vp-code-block-color);
  font-size: 13px;
  line-height: 1.65;
  white-space: pre;
}

.mindmap-preview:fullscreen {
  display: flex;
  width: 100%;
  height: 100%;
  margin: 0;
  border: 0;
  border-radius: 0;
  background: var(--vp-c-bg);
  flex-direction: column;

  .mindmap-canvas-host,
  .mindmap-outline,
  .mindmap-source {
    flex: 1 1 auto;
    max-height: none;
    min-height: 0;
  }

  .mindmap-canvas-host { height: auto; }
}

@media (max-width: 768px) {
  .mindmap-canvas-host { height: 360px; }
  .mindmap-preview-actions { top: 6px; right: 6px; }
  .mindmap-preview-action { width: 28px; height: 28px; }
  .mindmap-outline { padding-inline: 12px; }
}
</style>
