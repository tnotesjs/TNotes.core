<script setup>
import { scaleOrdinal, schemePastel2, schemeSet3, schemeTableau10 } from 'd3'
import { Transformer } from 'markmap-lib'
import { Toolbar } from 'markmap-toolbar'
import 'markmap-toolbar/dist/style.css'
import { Markmap } from 'markmap-view'
import { withBase, useData } from 'vitepress'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import {
  icon__fullscreen,
  icon__fullscreen_exit,
  icon__confirm,
} from '../../assets/icons'
import {
  MARKMAP_THEME_KEY,
  MARKMAP_EXPAND_LEVEL_KEY,
  REPO_NAME,
} from '../constants'

const props = defineProps({
  sidebarData: {
    type: Array,
    required: true,
  },
})

const svgRef = ref(null)
const containerRef = ref(null)
const expandLevel = ref(2)
const isFullscreen = ref(false)
const markmapTheme = ref('default')

const containerBg = computed(() =>
  markmapTheme.value === 'dark' ? '#1d1d1d' : '#ffffff',
)

let markmapInstance = null
let toolbarEl = null
let toolbarLevelInput = null
let darkClassObserver = null
const transformer = new Transformer()
const { isDark } = useData()

// 同步暗色状态到 markmap-dark 类（markmap 内部样式依赖此类）
function syncMarkmapDark(dark) {
  if (dark) {
    document.documentElement.classList.add('markmap-dark')
  } else {
    document.documentElement.classList.remove('markmap-dark')
  }
}

watch(isDark, (val) => syncMarkmapDark(val))
watch(markmapTheme, (val) => syncMarkmapDark(val === 'dark'))

// 读取 localStorage 配置
function loadSettings() {
  if (typeof window === 'undefined') return
  const savedTheme = localStorage.getItem(MARKMAP_THEME_KEY)
  if (savedTheme && ['default', 'colorful', 'dark'].includes(savedTheme)) {
    markmapTheme.value = savedTheme
  }
  const savedLevel = localStorage.getItem(MARKMAP_EXPAND_LEVEL_KEY)
  if (savedLevel) {
    const level = parseInt(savedLevel)
    if (!isNaN(level) && level >= 1 && level <= 100) {
      expandLevel.value = level
    }
  }
}

const getThemeColorFn = () => {
  const theme = markmapTheme.value
  switch (theme) {
    case 'colorful':
      return scaleOrdinal(schemeTableau10)
    case 'dark':
      return scaleOrdinal(schemeSet3)
    default:
      return scaleOrdinal(schemePastel2)
  }
}

// 将 sidebar 数据转换为 markdown
function sidebarToMarkdown(items, level = 1, isRoot = true) {
  if (level === 1 && isRoot) {
    const rootName = REPO_NAME.replace(/^TNotes\./, '')
    const rootMarkdown = `# ${rootName}\n\n`
    const childrenMarkdown = sidebarToMarkdown(items, 1, false)
    return rootMarkdown + childrenMarkdown
  }

  return items
    .map((item) => {
      const indent = '  '.repeat(level - 1)
      let text
      if (item.link) {
        const encodedLink = withBase(item.link).replace(/ /g, '%20')
        text = `[${item.text}](${encodedLink})`
      } else if (level === 1) {
        text = `**${item.text}**`
      } else {
        text = item.text
      }

      let markdown = `${indent}- ${text}\n`
      if (item.items && item.items.length > 0) {
        markdown += sidebarToMarkdown(item.items, level + 1, false)
      }
      return markdown
    })
    .join('')
}

function renderMindmap() {
  if (!props.sidebarData || !svgRef.value) return

  nextTick().then(() => {
    if (markmapInstance) {
      try {
        markmapInstance.destroy()
      } catch {}
      markmapInstance = null
    }

    if (!svgRef.value) return

    const markdown = sidebarToMarkdown(props.sidebarData)
    if (!markdown.trim()) {
      svgRef.value.innerHTML = '<text x="20" y="30" fill="#999">空内容</text>'
      return
    }

    try {
      const { root } = transformer.transform(markdown)
      const colorFn = getThemeColorFn()
      const options = {
        initialExpandLevel: expandLevel.value,
        duration: 100,
        nodeMinHeight: 24,
        spacingVertical: 10,
        spacingHorizontal: 20,
        maxWidth: 400,
        maxInitialScale: 2,
        color: (node) => colorFn(`${node.state?.path || ''}`),
      }

      markmapInstance = Markmap.create(svgRef.value, options, root)

      // 为链接添加 target="_blank"
      setTimeout(() => {
        if (svgRef.value) {
          svgRef.value.querySelectorAll('a').forEach((link) => {
            link.setAttribute('target', '_blank')
          })
        }
      }, 100)

      setTimeout(() => {
        try {
          markmapInstance?.fit()
        } catch {}
      }, 0)

      initToolbar()
    } catch (error) {
      console.error('Markmap render error:', error)
      if (svgRef.value) {
        svgRef.value.innerHTML =
          '<text x="20" y="30" fill="red">思维导图渲染错误</text>'
      }
    }
  })
}

function initToolbar() {
  if (!markmapInstance || !containerRef.value) return

  if (toolbarEl) {
    toolbarEl.remove()
    toolbarEl = null
    toolbarLevelInput = null
  }

  const { el } = Toolbar.create(markmapInstance)
  toolbarEl = el
  toolbarEl.style.position = 'absolute'
  toolbarEl.style.top = '1rem'
  toolbarEl.style.right = '0.5rem'
  toolbarEl.style.scale = '0.8'
  toolbarEl.style.zIndex = '10'

  const brand = toolbarEl.querySelector('.mm-toolbar-brand')
  if (brand) toolbarEl.removeChild(brand)

  addLevelControl(toolbarEl)
  addFullscreenButton(toolbarEl)

  containerRef.value.appendChild(toolbarEl)
}

function addLevelControl(toolbar) {
  const container = document.createElement('div')
  container.style.display = 'flex'
  container.style.alignItems = 'center'
  container.style.gap = '8px'
  container.style.marginRight = '5px'

  const levelInput = document.createElement('input')
  levelInput.type = 'number'
  levelInput.min = '1'
  levelInput.max = '100'
  levelInput.value = expandLevel.value.toString()
  levelInput.style.width = '2.4rem'
  levelInput.style.height = '1.6rem'
  levelInput.style.padding = '2px 6px'
  levelInput.style.fontSize = '12px'
  levelInput.style.lineHeight = '1.2'
  levelInput.style.textAlign = 'center'
  levelInput.style.boxSizing = 'border-box'
  levelInput.style.borderBottom = '.5px solid var(--vp-c-tip-1)'
  levelInput.style.color = 'var(--vp-c-tip-1)'
  levelInput.title = '展开层级'
  levelInput.setAttribute('aria-label', 'markmap-expand-level')

  toolbarLevelInput = levelInput

  levelInput.addEventListener('input', (e) => {
    const input = e.target
    let value = parseInt(input.value)
    if (input.value === '' || isNaN(value)) return
    if (value < 1) input.value = '1'
    else if (value > 100) input.value = '100'
  })

  levelInput.addEventListener('change', (e) => {
    const value = parseInt(e.target.value)
    if (!isNaN(value) && value >= 1 && value <= 100) {
      expandLevel.value = value
    } else {
      levelInput.value = expandLevel.value.toString()
    }
  })

  levelInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const val = parseInt(e.target.value)
      if (!isNaN(val) && val >= 1 && val <= 100) {
        expandLevel.value = val
      } else {
        levelInput.value = expandLevel.value.toString()
      }
      onUpdateClick()
    }
  })

  const updateBtn = document.createElement('button')
  updateBtn.type = 'button'
  updateBtn.className = 'mm-toolbar-item'
  updateBtn.title = '确定层级并更新'
  updateBtn.innerHTML = `<img src="${icon__confirm}" alt="确定" style="width:16px;height:16px;display:block" />`
  updateBtn.addEventListener('click', onUpdateClick)

  container.appendChild(levelInput)
  container.appendChild(updateBtn)
  toolbar.insertBefore(container, toolbar.firstChild)
}

function addFullscreenButton(toolbar) {
  const fullscreenBtn = document.createElement('div')
  fullscreenBtn.className = 'mm-toolbar-item'
  fullscreenBtn.title = isFullscreen.value ? '退出全屏' : '全屏'
  fullscreenBtn.innerHTML = isFullscreen.value
    ? `<img src="${icon__fullscreen_exit}" alt="退出全屏" style="width:18px;height:18px;display:block" />`
    : `<img src="${icon__fullscreen}" alt="全屏" style="width:18px;height:18px;display:block" />`
  fullscreenBtn.addEventListener('click', toggleFullscreen)
  toolbar.appendChild(fullscreenBtn)
}

function onUpdateClick() {
  localStorage.setItem(MARKMAP_EXPAND_LEVEL_KEY, expandLevel.value.toString())
  renderMindmap()
}

function toggleFullscreen() {
  if (!containerRef.value) return

  if (!isFullscreen.value) {
    if (containerRef.value.requestFullscreen) {
      containerRef.value.requestFullscreen().catch((err) => {
        console.error('全屏请求失败:', err)
      })
    } else if (containerRef.value.webkitRequestFullscreen) {
      containerRef.value.webkitRequestFullscreen()
    }
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen()
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen()
    }
  }
}

function handleFullscreenChange() {
  isFullscreen.value = !!(
    document.fullscreenElement || document.webkitFullscreenElement
  )

  if (toolbarEl) {
    const fullscreenBtn = Array.from(toolbarEl.children).find((child) =>
      child.querySelector('img[alt="全屏"], img[alt="退出全屏"]'),
    )
    if (fullscreenBtn) {
      fullscreenBtn.title = isFullscreen.value ? '退出全屏' : '全屏'
      fullscreenBtn.innerHTML = isFullscreen.value
        ? `<img src="${icon__fullscreen_exit}" alt="退出全屏" style="width:18px;height:18px;display:block" />`
        : `<img src="${icon__fullscreen}" alt="全屏" style="width:18px;height:18px;display:block" />`
    }
  }

  if (svgRef.value) {
    if (isFullscreen.value) {
      svgRef.value.style.height = 'calc(100vh - 100px)'
    } else {
      svgRef.value.style.height = ''
    }

    setTimeout(() => {
      try {
        markmapInstance?.fit()
      } catch {}
    }, 300)
  }
}

watch(expandLevel, (v) => {
  if (toolbarLevelInput) {
    const asStr = (v || 0).toString()
    if (toolbarLevelInput.value !== asStr) {
      toolbarLevelInput.value = asStr
    }
  }
})

watch(
  () => props.sidebarData,
  () => renderMindmap(),
  { deep: true },
)

onMounted(() => {
  loadSettings()
  syncMarkmapDark(markmapTheme.value === 'dark' || isDark.value)
  document.addEventListener('fullscreenchange', handleFullscreenChange)
  document.addEventListener('webkitfullscreenchange', handleFullscreenChange)

  // 监听 markmap 工具栏切换暗色主题（它直接 toggle markmap-dark 类，不通知 Vue）
  darkClassObserver = new MutationObserver(() => {
    const hasDark = document.documentElement.classList.contains('markmap-dark')
    markmapTheme.value = hasDark ? 'dark' : 'default'
  })
  darkClassObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  })

  renderMindmap()
})

onBeforeUnmount(() => {
  if (markmapInstance) {
    try {
      markmapInstance.destroy()
    } catch {}
    markmapInstance = null
  }
  if (toolbarEl) {
    toolbarEl.remove()
    toolbarEl = null
    toolbarLevelInput = null
  }
  document.removeEventListener('fullscreenchange', handleFullscreenChange)
  document.removeEventListener('webkitfullscreenchange', handleFullscreenChange)
  if (darkClassObserver) {
    darkClassObserver.disconnect()
    darkClassObserver = null
  }
})
</script>

<template>
  <div class="mindmap-view">
    <div
      ref="containerRef"
      class="mindmap-container"
      :style="{ backgroundColor: containerBg }"
    >
      <svg ref="svgRef"></svg>
    </div>
  </div>
</template>

<style scoped lang="scss">
.mindmap-view {
  width: 100%;
  padding: 1rem 0;
  display: flex;
  flex-direction: column;
}

.mindmap-container {
  width: 100%;
  height: 500px;
  position: relative;
  overflow: hidden;
  border-radius: 8px;
  padding: 1rem;
  transition: all 0.3s ease;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  box-sizing: border-box;

  &:hover {
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12);
  }

  svg {
    width: 100%;
    height: 100%;
    display: block;
    transition: height 0.3s ease;
  }

  /* 鼠标悬停显示 toolbar */
  &:hover :deep(.mm-toolbar) {
    opacity: 1;
    pointer-events: auto;
  }
}

/* 暗色主题 */
:global(.dark) .mindmap-container,
:global(.markmap-dark) .mindmap-container {
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.3);

  &:hover {
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
  }
}

/* 全屏样式 */
.mindmap-container:fullscreen,
.mindmap-container:-webkit-full-screen {
  width: 100%;
  height: 100%;
  padding: 20px;
  background: white;
  display: flex;
  flex-direction: column;
  justify-content: center;
  box-shadow: none;
}

:global(.dark) .mindmap-container:fullscreen,
:global(.dark) .mindmap-container:-webkit-full-screen,
:global(.markmap-dark) .mindmap-container:fullscreen,
:global(.markmap-dark) .mindmap-container:-webkit-full-screen {
  background: #1d1d1d;
}

@media (max-width: 768px) {
  .mindmap-container {
    height: 400px;
    padding: 0.75rem;
  }
}

@media (max-width: 480px) {
  .mindmap-container {
    padding: 0.5rem;
  }
}
</style>
