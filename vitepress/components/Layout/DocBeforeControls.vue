<!-- 
vitepress/components/Layout/DocBeforeControls.vue 
-->

<template>
  <div class="docBeforeContainer">
    <div class="leftArea">
      <div
        class="toggleSidebarBox pcOnly"
        v-show="!isFullContentMode"
      >
        <ToggleSidebar />
      </div>
      <div class="vscodeBox pcOnly" v-show="vscodeNotesDir">
        <a
          :href="vscodeNotesDir"
          :title="openCurrentTitle"
          target="_blank"
        >
          <img :src="localIdeIcon" :alt="openCurrentTitle" />
        </a>
      </div>
      <div class="contentToggleBox pcOnly">
        <ToggleFullContent />
      </div>
      <!-- 知识库的 GitHub 链接（仅首页显示，PC 端） -->
      <div class="githubRepoBox pcOnly" v-show="isHomeReadme">
        <a
          :href="`https://github.com/tnotesjs/${vpData.page.value.title.toLowerCase()}/blob/main/README.md`"
          :title="`tnotesjs github - ${vpData.page.value.title.toLowerCase()} 笔记仓库链接`"
          target="_blank"
          rel="noopener"
        >
          <img :src="icon__github" alt="github icon" />
        </a>
      </div>
    </div>
    <div class="rightArea">
      <!-- 一键复制笔记内容按钮 -->
      <div class="collapseAllBtn" v-show="currentNoteId">
        <button
          class="collapseAllButton"
          @click="copyNoteContent"
          title="复制笔记原始内容"
          type="button"
        >
          <img :src="icon__clipboard" alt="copy note content" />
        </button>
      </div>
      <Transition name="toast">
        <div v-if="showCopyToast" class="toast">✓ 复制成功</div>
      </Transition>
      <!-- 全局折叠/展开按钮 -->
      <div
        class="collapseAllBtn"
        v-show="currentNoteId || isHomeReadme"
      >
        <button
          class="collapseAllButton"
          @click="toggleAllCollapse"
          :title="allCollapsed ? '展开所有区域' : '折叠所有区域'"
          type="button"
        >
          <img :src="icon__fold" alt="collapse all" />
        </button>
      </div>
      <!-- 单个图标，点击打开 modal，只在有笔记数据的页面显示 -->
      <div class="aboutBtn" v-show="currentNoteId || isHomeReadme">
        <button
          class="aboutIconButton"
          @click="$emit('open-time-modal')"
          :title="isHomeReadme ? '关于这个知识库' : '关于这篇笔记'"
          type="button"
        >
          !
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useData } from 'vitepress'
import { ref } from 'vue'

import ToggleFullContent from './ToggleFullContent.vue'
import ToggleSidebar from './ToggleSidebar.vue'
import {
  icon__github,
  icon__fold,
  icon__clipboard,
} from '../../assets/icons'
import { useLocalIde } from '../composables/useLocalIde'

const props = defineProps<{
  isFullContentMode: boolean
  vscodeNotesDir: string
  isHomeReadme: boolean
  currentNoteId: string | null
  timeModalOpen: boolean
  allCollapsed: boolean
}>()

const { icon: localIdeIcon, openCurrentTitle } = useLocalIde()

const showCopyToast = ref(false)
let copyToastTimer: ReturnType<typeof setTimeout> | null = null

async function copyNoteContent() {
  const encoded = vpData.frontmatter.value.rawContent
  if (!encoded) return
  try {
    // rawContent 为 base64(UTF-8) —— 在构建期编码以规避 VitePress 把
    // `<script>` 字面量注入 SFC 时的多重正则误匹配。
    const bin = atob(encoded)
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
    const raw = new TextDecoder('utf-8').decode(bytes)
    await navigator.clipboard.writeText(raw)
    if (copyToastTimer) clearTimeout(copyToastTimer)
    showCopyToast.value = true
    copyToastTimer = setTimeout(() => {
      showCopyToast.value = false
    }, 2000)
  } catch (e) {
    console.error('复制失败', e)
  }
}

const emit = defineEmits<{
  (e: 'open-time-modal'): void
  (e: 'toggle-all-collapse'): void
}>()

const vpData = useData()

function toggleAllCollapse() {
  emit('toggle-all-collapse')
}
</script>

<style scoped lang="scss">
/* doc-before-container 主容器 */
.docBeforeContainer {
  display: flex;
  margin-bottom: 1rem;
  align-items: center;
  justify-content: space-between;
  animation: slideDown 0.3s ease-out;

  .leftArea {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .rightArea {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-style: italic;
    font-size: 0.7rem;
    position: relative;
  }

  /* 默认隐藏，当屏幕宽度 >= 960px 时显示，因为当宽度小于 960px 时，侧边栏会自动隐藏 */
  .toggleSidebarBox,
  .contentToggleBox {
    display: none;
  }

  .vscodeBox,
  .githubRepoBox {
    width: 1.5rem;
    height: 1.5rem;
    padding: 3px;
    transition: all 0.2s ease;
    border-radius: 4px;

    &:hover {
      background: var(--vp-c-bg-alt);
      transform: scale(1.05);
    }

    a {
      display: block;
      width: 100%;
      height: 100%;
    }

    img {
      width: 100%;
      height: 100%;
      display: block;
    }
  }

  /* collapse all button */
  .collapseAllBtn {
    display: inline-block;
    margin-right: 8px;
  }

  .collapseAllButton {
    background: none;
    border: none;
    cursor: pointer;
    padding: 4px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: all 0.2s ease;

    &:hover {
      background: var(--vp-c-bg-soft);
    }

    img {
      width: 16px;
      height: 16px;
      opacity: 0.6;
      transition: opacity 0.2s ease;
    }

    &:hover img {
      opacity: 1;
    }
  }

  /* about icon button */
  .aboutBtn {
    display: inline-block;
  }

  .aboutIconButton {
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 0.15rem;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    color: var(--vp-c-brand-1);
    font-weight: 700;
    font-size: 1rem;
    border-radius: 50%;
    width: 1.5rem;
    height: 1.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;

    &::before {
      content: '';
      position: absolute;
      inset: -2px;
      border-radius: 50%;
      border: 2px solid var(--vp-c-brand-1);
      opacity: 0;
      transition: opacity 0.3s ease;
    }

    &:hover {
      font-size: 1.3rem;
      background: var(--vp-c-brand-soft);
      transform: rotate(180deg);

      &::before {
        opacity: 0.3;
        animation: pulse 1s ease-in-out infinite;
      }
    }

    &:active {
      transform: rotate(180deg) scale(0.95);
    }
  }

  .toast {
    position: fixed;
    bottom: 2rem;
    right: 2rem;
    padding: 0.75rem 1.5rem;
    background: var(--vp-c-brand-1);
    color: white;
    border-radius: 8px;
    font-size: 0.9rem;
    font-weight: 500;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 9999;
  }
}

/* PC 端专用按钮（移动端隐藏） */
.pcOnly {
  display: block;
}

@media (max-width: 768px) {
  .pcOnly {
    display: none !important;
  }
}

@media (min-width: 960px) {
  .docBeforeContainer {
    .toggleSidebarBox,
    .contentToggleBox {
      display: block;
    }
  }
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes pulse {
  0%,
  100% {
    transform: scale(1);
    opacity: 0.3;
  }
  50% {
    transform: scale(1.1);
    opacity: 0.5;
  }
}

/* Toast 过渡动画 */
:global(.toast-enter-active),
:global(.toast-leave-active) {
  transition: all 0.3s ease;
}

:global(.toast-enter-from),
:global(.toast-leave-to) {
  opacity: 0;
  transform: translateY(20px);
}
</style>
