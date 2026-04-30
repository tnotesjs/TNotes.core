<template>
  <div :class="$style.settingsWrapper">
    <section :class="$style.settingsSection">
      <div :class="$style.settingItem">
        <div :class="$style.settingMeta">
          <div :class="$style.labelLine">
            <span :class="$style.itemName">本地知识库路径</span>
            <span :class="$style.infoWrap">
              <span :class="$style.infoIcon">?</span>
              <span :class="$style.tooltip">
                适用于 PC 桌面环境，需要本地安装 VS Code。配置后可从页面快速打开本地笔记目录。
              </span>
            </span>
          </div>
          <span v-if="path" :class="$style.statusText">已配置</span>
        </div>

        <div :class="$style.inputGroup">
          <input
            v-model="path"
            type="text"
            placeholder="/Users/username/notes"
            :class="$style.input"
          />
          <button
            v-if="path"
            @click="clearPath"
            :class="$style.clearBtn"
            title="清空"
            type="button"
          >
            ×
          </button>
        </div>
      </div>

      <div :class="$style.settingItem">
        <div :class="$style.settingMeta">
          <div :class="$style.labelLine">
            <span :class="$style.itemName">侧边栏目录</span>
            <span :class="$style.infoWrap">
              <span :class="$style.infoIcon">?</span>
              <span :class="$style.tooltip">
                控制侧边栏笔记编号显示，以及目录行距密度。保存后会刷新页面以应用侧边栏配置。
              </span>
            </span>
          </div>
          <span v-if="showNoteId" :class="$style.statusText">显示编号</span>
        </div>

        <div :class="$style.fieldStack">
          <label :class="$style.checkRow">
            <input
              v-model="showNoteId"
              type="checkbox"
              :class="$style.checkbox"
            />
            <span>显示笔记编号</span>
          </label>

          <div :class="$style.controlRow">
            <span :class="$style.controlLabel">目录风格</span>
            <div :class="$style.segmented">
              <label
                v-for="option in sidebarDensityOptions"
                :key="option.value"
                :class="[
                  $style.segment,
                  { [$style.activeSegment]: sidebarDensity === option.value },
                ]"
              >
                <input
                  v-model="sidebarDensity"
                  type="radio"
                  name="sidebar-density"
                  :value="option.value"
                />
                <span>{{ option.label }}</span>
              </label>
            </div>
          </div>

          <div :class="$style.prefixGrid">
            <label :class="$style.field">
              <span :class="$style.controlLabel">已完成笔记的前缀</span>
              <input
                v-model="donePrefix"
                type="text"
                placeholder="可留空"
                :class="[$style.input, $style.prefixInput]"
              />
            </label>

            <label :class="$style.field">
              <span :class="$style.controlLabel">未完成笔记前缀</span>
              <input
                v-model="undonePrefix"
                type="text"
                placeholder="可留空"
                :class="[$style.input, $style.prefixInput]"
              />
            </label>
          </div>
        </div>
      </div>

      <div :class="$style.settingItem">
        <div :class="$style.settingMeta">
          <div :class="$style.labelLine">
            <span :class="$style.itemName">MarkMap 思维导图</span>
            <span :class="$style.infoWrap">
              <span :class="$style.infoIcon">?</span>
              <span :class="$style.tooltip">
                配置 MarkMap 的默认分支配色和初始展开层级。
              </span>
            </span>
          </div>
        </div>

        <div :class="$style.inlineGrid">
          <label :class="$style.field">
            <span :class="$style.controlLabel">分支主题</span>
            <select v-model="markmapTheme" :class="$style.select">
              <option value="default">默认</option>
              <option value="colorful">多彩</option>
              <option value="dark">深色</option>
            </select>
          </label>

          <label :class="$style.field">
            <span :class="$style.controlLabel">展开层级</span>
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
          </label>
        </div>
      </div>
    </section>

    <div :class="$style.actionBar">
      <button v-if="hasChanges" @click="reset" :class="$style.resetBtn">
        重置
      </button>
      <button
        @click="save"
        :class="[$style.saveBtn, { [$style.disabled]: !hasChanges }]"
        :disabled="!hasChanges"
      >
        {{ saveText }}
      </button>
    </div>

    <Transition name="toast">
      <div v-if="showSuccessToast" :class="$style.toast">保存成功</div>
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
  SIDEBAR_DENSITY_KEY,
  SIDEBAR_DONE_PREFIX_KEY,
  SIDEBAR_UNDONE_PREFIX_KEY,
} from '../constants'
// @ts-expect-error - VitePress Data Loader
import { data as tnotesConfig } from '../tnotes-config.data'

type SidebarDensity = 'compact' | 'default' | 'loose'

const DEFAULT_SIDEBAR_DENSITY: SidebarDensity = 'default'
const DEFAULT_DONE_PREFIX = '✅'
const DEFAULT_UNDONE_PREFIX = '⏰'
const sidebarDensityOptions: Array<{
  label: string
  value: SidebarDensity
}> = [
  { label: '紧凑', value: 'compact' },
  { label: '默认', value: 'default' },
  { label: '宽松', value: 'loose' },
]

const path = ref('')
const originalPath = ref('')
const markmapTheme = ref('default')
const originalMarkmapTheme = ref('default')
const markmapExpandLevel = ref(5)
const originalMarkmapExpandLevel = ref(5)
const showNoteId = ref(false)
const originalShowNoteId = ref(false)
const sidebarDensity = ref<SidebarDensity>(DEFAULT_SIDEBAR_DENSITY)
const originalSidebarDensity = ref<SidebarDensity>(DEFAULT_SIDEBAR_DENSITY)
const donePrefix = ref(DEFAULT_DONE_PREFIX)
const originalDonePrefix = ref(DEFAULT_DONE_PREFIX)
const undonePrefix = ref(DEFAULT_UNDONE_PREFIX)
const originalUndonePrefix = ref(DEFAULT_UNDONE_PREFIX)
const showSuccessToast = ref(false)

const hasChanges = computed(
  () =>
    path.value !== originalPath.value ||
    markmapTheme.value !== originalMarkmapTheme.value ||
    markmapExpandLevel.value !== originalMarkmapExpandLevel.value ||
    showNoteId.value !== originalShowNoteId.value ||
    sidebarDensity.value !== originalSidebarDensity.value ||
    donePrefix.value !== originalDonePrefix.value ||
    undonePrefix.value !== originalUndonePrefix.value,
)

const saveText = computed(() => {
  if (!hasChanges.value) return '无更改'
  return '保存'
})

onMounted(() => {
  if (typeof window === 'undefined') return

  const savedPath = localStorage.getItem(NOTES_DIR_KEY) || ''
  path.value = savedPath
  originalPath.value = savedPath

  const savedTheme = localStorage.getItem(MARKMAP_THEME_KEY) || 'default'
  markmapTheme.value = savedTheme
  originalMarkmapTheme.value = savedTheme

  const savedLevel = localStorage.getItem(MARKMAP_EXPAND_LEVEL_KEY) || '5'
  markmapExpandLevel.value = parseInt(savedLevel, 10)
  originalMarkmapExpandLevel.value = markmapExpandLevel.value

  const savedShowNoteId = localStorage.getItem(SIDEBAR_SHOW_NOTE_ID_KEY)
  showNoteId.value =
    savedShowNoteId !== null
      ? savedShowNoteId === 'true'
      : tnotesConfig?.sidebarShowNoteId ?? false
  originalShowNoteId.value = showNoteId.value

  const savedSidebarDensity = normalizeSidebarDensity(
    localStorage.getItem(SIDEBAR_DENSITY_KEY),
  )
  sidebarDensity.value = savedSidebarDensity
  originalSidebarDensity.value = savedSidebarDensity

  const savedDonePrefix = localStorage.getItem(SIDEBAR_DONE_PREFIX_KEY)
  donePrefix.value =
    savedDonePrefix !== null ? savedDonePrefix : DEFAULT_DONE_PREFIX
  originalDonePrefix.value = donePrefix.value

  const savedUndonePrefix = localStorage.getItem(SIDEBAR_UNDONE_PREFIX_KEY)
  undonePrefix.value =
    savedUndonePrefix !== null ? savedUndonePrefix : DEFAULT_UNDONE_PREFIX
  originalUndonePrefix.value = undonePrefix.value
})

function normalizeSidebarDensity(value: string | null): SidebarDensity {
  if (value === 'compact' || value === 'default' || value === 'loose') {
    return value
  }

  return DEFAULT_SIDEBAR_DENSITY
}

function clearPath() {
  path.value = ''
}

function save() {
  if (!hasChanges.value) return

  try {
    const needReload =
      showNoteId.value !== originalShowNoteId.value ||
      sidebarDensity.value !== originalSidebarDensity.value ||
      donePrefix.value !== originalDonePrefix.value ||
      undonePrefix.value !== originalUndonePrefix.value

    localStorage.setItem(NOTES_DIR_KEY, path.value)
    localStorage.setItem(MARKMAP_THEME_KEY, markmapTheme.value)
    localStorage.setItem(
      MARKMAP_EXPAND_LEVEL_KEY,
      markmapExpandLevel.value.toString(),
    )
    localStorage.setItem(SIDEBAR_SHOW_NOTE_ID_KEY, showNoteId.value.toString())
    localStorage.setItem(SIDEBAR_DENSITY_KEY, sidebarDensity.value)
    localStorage.setItem(SIDEBAR_DONE_PREFIX_KEY, donePrefix.value)
    localStorage.setItem(SIDEBAR_UNDONE_PREFIX_KEY, undonePrefix.value)

    originalPath.value = path.value
    originalMarkmapTheme.value = markmapTheme.value
    originalMarkmapExpandLevel.value = markmapExpandLevel.value
    originalShowNoteId.value = showNoteId.value
    originalSidebarDensity.value = sidebarDensity.value
    originalDonePrefix.value = donePrefix.value
    originalUndonePrefix.value = undonePrefix.value

    showSuccessToast.value = true
    setTimeout(() => {
      showSuccessToast.value = false
    }, 2400)

    if (needReload) {
      setTimeout(() => {
        window.location.reload()
      }, 450)
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
  sidebarDensity.value = originalSidebarDensity.value
  donePrefix.value = originalDonePrefix.value
  undonePrefix.value = originalUndonePrefix.value
}
</script>

<style module src="./Settings.module.scss"></style>
