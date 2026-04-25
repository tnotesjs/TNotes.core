<template>
  <div :class="$style.settingsWrapper">
    <!-- 本地路径配置 -->
    <div :class="$style.settingItem">
      <div :class="$style.itemHeader">
        <div :class="$style.itemTitle">
          <span :class="$style.itemIcon">📁</span>
          <span :class="$style.itemName">本地知识库路径</span>
        </div>
        <span :class="$style.statusBadge" v-if="path">✓</span>
      </div>

      <div :class="$style.helpText">
        适用于 PC 桌面环境，需要本地安装 VS Code
        编辑器。配置后可在侧边栏快速打开笔记。
      </div>

      <div :class="$style.inputGroup">
        <input
          v-model="path"
          type="text"
          placeholder="例如: C:\notes 或 /Users/username/notes"
          :class="$style.input"
        />
        <button
          v-if="path"
          @click="clearPath"
          :class="$style.clearBtn"
          title="清空"
        >
          ✕
        </button>
      </div>
    </div>

    <!-- 内容宽度配置 -->
    <div :class="$style.settingItem">
      <div :class="$style.itemHeader">
        <div :class="$style.itemTitle">
          <span :class="$style.itemIcon">📏</span>
          <span :class="$style.itemName">内容区宽度</span>
        </div>
        <span :class="$style.currentValue">{{ contentWidth }}</span>
      </div>

      <div :class="$style.helpText">
        调整文章内容区域的最大宽度（全屏模式下不限制宽度）。
      </div>

      <select
        v-model="contentWidth"
        @change="applyContentWidth"
        :class="$style.select"
      >
        <option value="688px">标准 (688px)</option>
        <option value="755px">较大 (755px)</option>
      </select>
    </div>

    <!-- 侧边栏配置 -->
    <div :class="$style.settingItem">
      <div :class="$style.itemHeader">
        <div :class="$style.itemTitle">
          <span :class="$style.itemIcon">📑</span>
          <span :class="$style.itemName">侧边栏配置</span>
        </div>
        <span :class="$style.statusBadge" v-if="showNoteId">显示编号</span>
      </div>

      <div :class="$style.helpText">
        控制侧边栏中是否显示笔记编号（如 "0001. "）。
      </div>

      <div :class="$style.field">
        <label :class="$style.checkboxLabel">
          <input
            v-model="showNoteId"
            type="checkbox"
            :class="$style.checkbox"
          />
          <span>显示笔记编号</span>
        </label>
        <div :class="$style.fieldHelp">
          勾选后，侧边栏将显示完整的笔记标题（包含编号），例如 "0001. TNotes
          简介"
        </div>
      </div>
    </div>

    <!-- MarkMap 配置 -->
    <div :class="$style.settingItem">
      <div :class="$style.itemHeader">
        <div :class="$style.itemTitle">
          <span :class="$style.itemIcon">💡</span>
          <span :class="$style.itemName">MarkMap 思维导图</span>
        </div>
      </div>

      <div :class="$style.helpText">配置思维导图的默认显示效果。</div>

      <div :class="$style.field">
        <div :class="$style.fieldLabel">
          <span>分支主题</span>
        </div>
        <div :class="$style.fieldHelp">选择思维导图分支的配色方案</div>
        <select v-model="markmapTheme" :class="$style.select">
          <option value="default">默认主题</option>
          <option value="colorful">多彩主题</option>
          <option value="dark">深色主题</option>
        </select>
      </div>

      <div :class="$style.field">
        <div :class="$style.fieldLabel">
          <span>展开层级</span>
        </div>
        <div :class="$style.fieldHelp">
          设置思维导图初始展开的层级深度（1-100）
        </div>
        <div :class="$style.inputWithUnit">
          <input
            v-model.number="markmapExpandLevel"
            type="number"
            min="1"
            max="100"
            :class="$style.input"
          />
          <span :class="$style.unit">层</span>
        </div>
      </div>
    </div>

    <!-- 操作栏 -->
    <div :class="$style.actionBar">
      <button
        @click="save"
        :class="[$style.saveBtn, { [$style.disabled]: !hasChanges }]"
        :disabled="!hasChanges"
      >
        {{ saveText }}
      </button>
      <button v-if="hasChanges" @click="reset" :class="$style.resetBtn">
        重置
      </button>
    </div>

    <!-- 保存成功提示 -->
    <Transition name="toast">
      <div v-if="showSuccessToast" :class="$style.toast">✓ 保存成功</div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

import {
  NOTES_DIR_KEY,
  MARKMAP_THEME_KEY,
  MARKMAP_EXPAND_LEVEL_KEY,
  SIDEBAR_SHOW_NOTE_ID_KEY,
} from '../constants'
// @ts-expect-error - VitePress Data Loader
import { data as tnotesConfig } from '../tnotes-config.data'

const CONTENT_WIDTH_KEY = 'tnotes-content-width'

// ===================================
// #region 响应式数据
// ===================================
const path = ref('')
const originalPath = ref('')
const markmapTheme = ref('default')
const originalMarkmapTheme = ref('default')
const markmapExpandLevel = ref(5)
const originalMarkmapExpandLevel = ref(5)
const contentWidth = ref('688px')
const showNoteId = ref(false)
const originalShowNoteId = ref(false)
const showSuccessToast = ref(false)
// #endregion

// ===================================
// #region 计算属性
// ===================================
const hasChanges = computed(
  () =>
    path.value !== originalPath.value ||
    markmapTheme.value !== originalMarkmapTheme.value ||
    markmapExpandLevel.value !== originalMarkmapExpandLevel.value ||
    showNoteId.value !== originalShowNoteId.value
)

const saveText = computed(() => {
  if (!hasChanges.value) return '无更改'
  return '保存配置'
})
// #endregion

// ===================================
// #region 生命周期
// ===================================
onMounted(() => {
  if (typeof window !== 'undefined') {
    const savedPath = localStorage.getItem(NOTES_DIR_KEY) || ''
    path.value = savedPath
    originalPath.value = savedPath

    const savedTheme = localStorage.getItem(MARKMAP_THEME_KEY) || 'default'
    markmapTheme.value = savedTheme
    originalMarkmapTheme.value = savedTheme

    const savedLevel = localStorage.getItem(MARKMAP_EXPAND_LEVEL_KEY) || '5'
    markmapExpandLevel.value = parseInt(savedLevel)
    originalMarkmapExpandLevel.value = parseInt(savedLevel)

    const savedWidth = localStorage.getItem(CONTENT_WIDTH_KEY) || '688px'
    contentWidth.value = savedWidth
    applyContentWidth()

    // 读取侧边栏显示笔记 ID 配置
    // 优先使用 localStorage 中的用户自定义配置，否则使用配置文件中的默认值
    const savedShowNoteId = localStorage.getItem(SIDEBAR_SHOW_NOTE_ID_KEY)
    if (savedShowNoteId !== null) {
      showNoteId.value = savedShowNoteId === 'true'
    } else {
      showNoteId.value = tnotesConfig?.sidebarShowNoteId ?? false
    }
    originalShowNoteId.value = showNoteId.value
  }
})
// #endregion

// ===================================
// #region 事件处理
// ===================================
function handlePathChange() {
  // 可以在这里添加路径格式验证
}

function clearPath() {
  path.value = ''
}

function save() {
  if (!hasChanges.value) return

  try {
    // 保存前先记录是否需要刷新页面
    const needReload = showNoteId.value !== originalShowNoteId.value

    localStorage.setItem(NOTES_DIR_KEY, path.value)
    localStorage.setItem(MARKMAP_THEME_KEY, markmapTheme.value)
    localStorage.setItem(
      MARKMAP_EXPAND_LEVEL_KEY,
      markmapExpandLevel.value.toString()
    )
    localStorage.setItem(SIDEBAR_SHOW_NOTE_ID_KEY, showNoteId.value.toString())

    console.log('💾 [Settings] Saved showNoteId:', showNoteId.value)

    originalPath.value = path.value
    originalMarkmapTheme.value = markmapTheme.value
    originalMarkmapExpandLevel.value = markmapExpandLevel.value
    originalShowNoteId.value = showNoteId.value

    // 显示成功提示
    showSuccessToast.value = true
    setTimeout(() => {
      showSuccessToast.value = false
    }, 3000)

    // 触发页面刷新以应用侧边栏配置变化
    if (needReload) {
      console.log(
        '🔄 [Settings] Reloading page to apply sidebar config change...'
      )
      setTimeout(() => {
        window.location.reload()
      }, 500)
    }
  } catch (error) {
    console.error('保存配置失败:', error)
    alert('保存失败，请检查浏览器设置')
  }
}

function reset() {
  path.value = originalPath.value
  markmapTheme.value = originalMarkmapTheme.value
  markmapExpandLevel.value = originalMarkmapExpandLevel.value
  showNoteId.value = originalShowNoteId.value
}

// 应用内容宽度（通过 CSS 变量）
function applyContentWidth() {
  if (typeof document === 'undefined') return
  document.documentElement.style.setProperty(
    '--tn-content-width',
    contentWidth.value
  )
  localStorage.setItem(CONTENT_WIDTH_KEY, contentWidth.value)
}
// #endregion
</script>

<style module src="./Settings.module.scss"></style>
