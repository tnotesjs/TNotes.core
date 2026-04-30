import { createApp, onMounted, onUnmounted } from 'vue'

import CodeBlockFullscreen from './CodeBlockFullscreen.vue'
import { icon__check, icon__clipboard, icon__fullscreen } from '../../assets/icons'

type CopyState = 'idle' | 'copied' | 'failed'

const CODE_BLOCK_SELECTOR = 'div[class*="language-"]'
const CODE_ACTIONS_CLASS = 'tn-code-actions'
const COPY_RESET_DELAY = 2000

export function useCodeBlockFullscreen() {
  let fullscreenApp: any = null
  let fullscreenContainer: HTMLElement | null = null
  const copyResetTimers = new WeakMap<HTMLElement, number>()

  function addCodeActions() {
    // 找到所有代码块
    const codeBlocks = document.querySelectorAll(CODE_BLOCK_SELECTOR)

    codeBlocks.forEach((block) => {
      if (!(block instanceof HTMLElement)) return
      if (!block.querySelector('pre code')) return
      block.querySelectorAll('.fullscreen-btn').forEach((button) => {
        button.remove()
      })
      if (block.querySelector(`.${CODE_ACTIONS_CLASS}`)) return

      const actions = document.createElement('div')
      actions.className = CODE_ACTIONS_CLASS
      actions.setAttribute('aria-label', '代码块操作')

      const fullscreenButton = createActionButton({
        className: 'tn-code-action-fullscreen',
        title: '全屏查看代码',
        icon: icon__fullscreen,
        alt: '全屏',
      })
      fullscreenButton.addEventListener('click', () => {
        openFullscreen(block)
      })

      const copyButton = createActionButton({
        className: 'tn-code-action-copy',
        title: '复制代码',
        icon: icon__clipboard,
        alt: '复制',
      })
      copyButton.addEventListener('click', () => {
        void copyCode(block, copyButton)
      })

      actions.append(fullscreenButton, copyButton)
      block.appendChild(actions)
    })
  }

  function createActionButton(options: {
    className: string
    title: string
    icon: string
    alt: string
  }) {
    const button = document.createElement('button')
    button.className = `tn-code-action ${options.className}`
    button.type = 'button'
    button.title = options.title
    button.setAttribute('aria-label', options.title)
    button.innerHTML = `<img src="${options.icon}" alt="${options.alt}" />`

    return button
  }

  async function copyCode(codeBlock: HTMLElement, button: HTMLElement) {
    const codeElement = codeBlock.querySelector('pre code')
    const text = codeElement?.textContent ?? ''
    if (!text) {
      setCopyState(button, 'failed')
      return
    }

    try {
      await navigator.clipboard.writeText(text)
      setCopyState(button, 'copied')
    } catch {
      setCopyState(button, 'failed')
    }
  }

  function setCopyState(button: HTMLElement, state: CopyState) {
    const currentTimer = copyResetTimers.get(button)
    if (currentTimer) {
      window.clearTimeout(currentTimer)
    }

    button.dataset.copyState = state
    if (button.parentElement) {
      button.parentElement.dataset.copyState = state
    }
    button.title = getCopyTitle(state)
    button.setAttribute('aria-label', getCopyTitle(state))

    const icon = button.querySelector('img')
    if (icon) {
      icon.setAttribute('src', state === 'copied' ? icon__check : icon__clipboard)
      icon.setAttribute('alt', state === 'copied' ? '已复制' : '复制')
    }

    const timer = window.setTimeout(() => {
      button.dataset.copyState = 'idle'
      if (button.parentElement) {
        button.parentElement.dataset.copyState = 'idle'
      }
      button.title = getCopyTitle('idle')
      button.setAttribute('aria-label', getCopyTitle('idle'))
      icon?.setAttribute('src', icon__clipboard)
      icon?.setAttribute('alt', '复制')
      copyResetTimers.delete(button)
    }, COPY_RESET_DELAY)

    copyResetTimers.set(button, timer)
  }

  function getCopyTitle(state: CopyState): string {
    if (state === 'copied') return '已复制'
    if (state === 'failed') return '复制失败'

    return '复制代码'
  }

  function openFullscreen(codeBlock: HTMLElement) {
    // 获取代码内容
    const pre = codeBlock.querySelector('pre')
    if (!pre) return

    const codeHtml = pre.outerHTML

    // 提取语言
    const classList = Array.from(codeBlock.classList)
    const languageClass = classList.find((c) => c.startsWith('language-'))
    const language = languageClass
      ? languageClass.replace('language-', '').toUpperCase()
      : undefined

    // 提取文件名（如果有）
    const filenameSpan = codeBlock.querySelector('.lang')
    const filename = filenameSpan?.textContent?.trim()

    // 创建全屏组件容器
    if (!fullscreenContainer) {
      fullscreenContainer = document.createElement('div')
      document.body.appendChild(fullscreenContainer)
    }

    // 创建 Vue 应用
    fullscreenApp = createApp(CodeBlockFullscreen, {
      isFullscreen: true,
      codeHtml,
      language,
      filename,
      'onUpdate:isFullscreen': (value: boolean) => {
        if (!value) {
          closeFullscreen()
        }
      },
    })

    fullscreenApp.mount(fullscreenContainer)
  }

  function closeFullscreen() {
    if (fullscreenApp) {
      fullscreenApp.unmount()
      fullscreenApp = null
    }
    if (fullscreenContainer && fullscreenContainer.parentNode) {
      fullscreenContainer.parentNode.removeChild(fullscreenContainer)
      fullscreenContainer = null
    }
  }

  function cleanup() {
    closeFullscreen()
    document.querySelectorAll(`.${CODE_ACTIONS_CLASS}`).forEach((actions) => {
      actions.remove()
    })
    document.querySelectorAll('.fullscreen-btn').forEach((button) => {
      button.remove()
    })
  }

  onMounted(() => {
    // 初始化
    setTimeout(() => {
      addCodeActions()
    }, 100)

    // 监听路由变化
    const observer = new MutationObserver(() => {
      addCodeActions()
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    })

    onUnmounted(() => {
      observer.disconnect()
      cleanup()
    })
  })
}
