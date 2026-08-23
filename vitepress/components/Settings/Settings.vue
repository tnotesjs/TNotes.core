<!-- 
vitepress/components/Settings/Settings.vue

设置组件，用于显示和修改应用设置
-->

<template>
  <div class="settingsWrapper">
    <section class="settingsSection">
      <div class="settingItem">
        <div class="settingMeta">
          <div class="labelLine">
            <span class="itemName">本地 IDE 打开</span>
            <span class="infoWrap">
              <span class="infoIcon">?</span>
              <span class="tooltip">
                适用于 PC 桌面环境。配置本地知识库 notes 目录路径，并选择 VS Code 或 Cursor，即可从页面快速打开知识库或笔记。
              </span>
            </span>
          </div>
          <span v-if="path" class="statusText">已配置</span>
        </div>

        <div class="fieldStack">
          <div class="controlRow">
            <span class="controlLabel">IDE</span>
            <div class="segmented segmented-two">
              <label
                v-for="option in localIdeOptions"
                :key="option.value"
                :class="[
                  'segment',
                  { activeSegment: localIde === option.value },
                ]"
              >
                <input
                  v-model="localIde"
                  type="radio"
                  name="local-ide"
                  :value="option.value"
                />
                <span>{{ option.label }}</span>
              </label>
            </div>
          </div>

          <label class="field">
            <span class="controlLabel">知识库路径</span>
            <div class="inputGroup">
              <input
                v-model="path"
                type="text"
                placeholder="/Users/username/notes"
                class="input pathInput"
              />
              <button
                v-if="path"
                @click="clearPath"
                class="clearBtn"
                title="清空"
                type="button"
              >
                ×
              </button>
            </div>
          </label>
        </div>
      </div>

      <div class="settingItem">
        <div class="settingMeta">
          <div class="labelLine">
            <span class="itemName">侧边栏目录</span>
            <span class="infoWrap">
              <span class="infoIcon">?</span>
              <span class="tooltip">
                控制侧边栏笔记编号显示，以及已完成/未完成笔记前缀。保存后会刷新页面以应用侧边栏配置。
              </span>
            </span>
          </div>
          <span v-if="showNoteId" class="statusText">显示编号</span>
        </div>

        <div class="fieldStack">
          <label class="checkRow">
            <input
              v-model="showNoteId"
              type="checkbox"
              class="checkbox"
            />
            <span>显示笔记编号</span>
          </label>

          <div class="prefixGrid">
            <label class="field">
              <span class="controlLabel">已完成笔记的前缀</span>
              <input
                v-model="donePrefix"
                type="text"
                placeholder="可留空"
                class="input prefixInput"
              />
            </label>

            <label class="field">
              <span class="controlLabel">未完成笔记前缀</span>
              <input
                v-model="undonePrefix"
                type="text"
                placeholder="可留空"
                class="input prefixInput"
              />
            </label>
          </div>
        </div>
      </div>

      <div class="settingItem">
        <div class="settingMeta">
          <div class="labelLine">
            <span class="itemName">正文区域</span>
            <span class="infoWrap">
              <span class="infoIcon">?</span>
              <span class="tooltip">
                控制笔记正文在中间栏的显示宽度。保存后会刷新页面以应用页宽变更。
              </span>
            </span>
          </div>
          <span class="statusText">{{
            contentWidthMode === 'wide' ? '超宽显示' : '标准页宽'
          }}</span>
        </div>

        <div class="fieldStack">
          <div class="controlRow">
            <span class="controlLabel">页宽模式</span>
            <div class="segmented segmented-two">
              <label
                v-for="option in contentWidthModeOptions"
                :key="option.value"
                :class="[
                  'segment',
                  { activeSegment: contentWidthMode === option.value },
                ]"
              >
                <input
                  v-model="contentWidthMode"
                  type="radio"
                  name="content-width-mode"
                  :value="option.value"
                />
                <span>{{ option.label }}</span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </section>

    <div class="actionBar">
      <button v-if="hasChanges" @click="reset" class="resetBtn">
        重置
      </button>
      <button
        @click="save"
        class="saveBtn"
        :class="{ disabled: !hasChanges }"
        :disabled="!hasChanges"
      >
        {{ saveText }}
      </button>
    </div>

    <Transition name="toast">
      <div v-if="showSuccessToast" class="toast">保存成功</div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

import { useLocalIde } from '../composables/useLocalIde'
import {
  NOTES_DIR_KEY,
  LOCAL_IDE_KEY,
  SIDEBAR_SHOW_NOTE_ID_KEY,
  SIDEBAR_DONE_PREFIX_KEY,
  SIDEBAR_UNDONE_PREFIX_KEY,
  CONTENT_WIDTH_MODE_KEY,
} from '../constants'
// @ts-expect-error - VitePress Data Loader
import { data as tnotesConfig } from '../tnotes-config.data'
import {
  DEFAULT_LOCAL_IDE,
  normalizeLocalIde,
  type LocalIdeId,
} from '../utils/vscodePaths'

type ContentWidthMode = 'wide' | 'standard'

const DEFAULT_CONTENT_WIDTH_MODE: ContentWidthMode = 'wide'
const DEFAULT_DONE_PREFIX = '✅'
const DEFAULT_UNDONE_PREFIX = '⏰'

const { setLocalIde } = useLocalIde()

const contentWidthModeOptions: Array<{
  label: string
  value: ContentWidthMode
}> = [
  { label: '超宽显示', value: 'wide' },
  { label: '标准页宽', value: 'standard' },
]

const localIdeOptions: Array<{ label: string; value: LocalIdeId }> = [
  { label: 'VS Code', value: 'vscode' },
  { label: 'Cursor', value: 'cursor' },
]

const path = ref('')
const originalPath = ref('')
const localIde = ref<LocalIdeId>(DEFAULT_LOCAL_IDE)
const originalLocalIde = ref<LocalIdeId>(DEFAULT_LOCAL_IDE)
const showNoteId = ref(false)
const originalShowNoteId = ref(false)
const donePrefix = ref(DEFAULT_DONE_PREFIX)
const originalDonePrefix = ref(DEFAULT_DONE_PREFIX)
const undonePrefix = ref(DEFAULT_UNDONE_PREFIX)
const originalUndonePrefix = ref(DEFAULT_UNDONE_PREFIX)
const contentWidthMode = ref<ContentWidthMode>(DEFAULT_CONTENT_WIDTH_MODE)
const originalContentWidthMode = ref<ContentWidthMode>(
  DEFAULT_CONTENT_WIDTH_MODE,
)
const showSuccessToast = ref(false)

const hasChanges = computed(
  () =>
    path.value !== originalPath.value ||
    localIde.value !== originalLocalIde.value ||
    showNoteId.value !== originalShowNoteId.value ||
    donePrefix.value !== originalDonePrefix.value ||
    undonePrefix.value !== originalUndonePrefix.value ||
    contentWidthMode.value !== originalContentWidthMode.value,
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

  const savedLocalIde = normalizeLocalIde(localStorage.getItem(LOCAL_IDE_KEY))
  localIde.value = savedLocalIde
  originalLocalIde.value = savedLocalIde

  const savedShowNoteId = localStorage.getItem(SIDEBAR_SHOW_NOTE_ID_KEY)
  showNoteId.value =
    savedShowNoteId !== null
      ? savedShowNoteId === 'true'
      : tnotesConfig?.sidebarShowNoteId ?? false
  originalShowNoteId.value = showNoteId.value

  const savedDonePrefix = localStorage.getItem(SIDEBAR_DONE_PREFIX_KEY)
  donePrefix.value =
    savedDonePrefix !== null ? savedDonePrefix : DEFAULT_DONE_PREFIX
  originalDonePrefix.value = donePrefix.value

  const savedUndonePrefix = localStorage.getItem(SIDEBAR_UNDONE_PREFIX_KEY)
  undonePrefix.value =
    savedUndonePrefix !== null ? savedUndonePrefix : DEFAULT_UNDONE_PREFIX
  originalUndonePrefix.value = undonePrefix.value

  const savedContentWidthMode = normalizeContentWidthMode(
    localStorage.getItem(CONTENT_WIDTH_MODE_KEY),
  )
  contentWidthMode.value = savedContentWidthMode
  originalContentWidthMode.value = savedContentWidthMode
})

function normalizeContentWidthMode(value: string | null): ContentWidthMode {
  return value === 'standard' ? 'standard' : 'wide'
}

function clearPath() {
  path.value = ''
}

function save() {
  if (!hasChanges.value) return

  try {
    const needReload =
      showNoteId.value !== originalShowNoteId.value ||
      donePrefix.value !== originalDonePrefix.value ||
      undonePrefix.value !== originalUndonePrefix.value ||
      contentWidthMode.value !== originalContentWidthMode.value

    localStorage.setItem(NOTES_DIR_KEY, path.value)
    setLocalIde(localIde.value)
    localStorage.setItem(SIDEBAR_SHOW_NOTE_ID_KEY, showNoteId.value.toString())
    localStorage.setItem(SIDEBAR_DONE_PREFIX_KEY, donePrefix.value)
    localStorage.setItem(SIDEBAR_UNDONE_PREFIX_KEY, undonePrefix.value)
    localStorage.setItem(CONTENT_WIDTH_MODE_KEY, contentWidthMode.value)

    originalPath.value = path.value
    originalLocalIde.value = localIde.value
    originalShowNoteId.value = showNoteId.value
    originalDonePrefix.value = donePrefix.value
    originalUndonePrefix.value = undonePrefix.value
    originalContentWidthMode.value = contentWidthMode.value

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
  localIde.value = originalLocalIde.value
  showNoteId.value = originalShowNoteId.value
  donePrefix.value = originalDonePrefix.value
  undonePrefix.value = originalUndonePrefix.value
  contentWidthMode.value = originalContentWidthMode.value
}
</script>

<style scoped lang="scss">
.settingsWrapper {
  max-width: 680px;
  margin: 0 auto;
  padding: 12px 4px 0;
}

.settingsSection {
  border-top: 1px solid var(--vp-c-divider);
}

.settingItem {
  display: grid;
  grid-template-columns: minmax(150px, 0.42fr) minmax(220px, 1fr);
  gap: 18px;
  padding: 18px 0;
  border-bottom: 1px solid var(--vp-c-divider);
}

.settingMeta {
  min-width: 0;
}

.labelLine {
  display: flex;
  align-items: center;
  gap: 6px;
}

.itemName {
  color: var(--vp-c-text-1);
  font-size: 14px;
  font-weight: 600;
  line-height: 22px;
}

.statusText {
  display: inline-block;
  margin-top: 4px;
  color: var(--vp-c-text-3);
  font-size: 12px;
  line-height: 18px;
}

.infoWrap {
  position: relative;
  display: inline-flex;
}

.infoIcon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  color: var(--vp-c-text-3);
  border: 1px solid var(--vp-c-divider);
  border-radius: 50%;
  cursor: help;
  font-size: 11px;
  line-height: 1;
}

.tooltip {
  position: absolute;
  left: 0;
  top: calc(100% + 8px);
  bottom: auto;
  z-index: 20;
  width: 240px;
  max-width: min(240px, calc(100vw - 48px));
  padding: 8px 10px;
  color: var(--vp-c-text-1);
  background: var(--vp-c-bg-elv);
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  box-shadow: var(--vp-shadow-2);
  font-size: 12px;
  line-height: 18px;
  opacity: 0;
  pointer-events: none;
  transform: translateY(-4px);
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}

.infoWrap:hover .tooltip,
.infoWrap:focus-within .tooltip {
  opacity: 1;
  transform: translateY(0);
}

.inputGroup {
  position: relative;
  align-self: start;
  width: 100%;
}

.input,
.select {
  width: 100%;
  height: 34px;
  box-sizing: border-box;
  color: var(--vp-c-text-1);
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  font-size: 13px;
  outline: none;
}

.input {
  padding: 0 34px 0 10px;
  font-family: var(--vp-font-family-mono);
}

.select {
  padding: 0 10px;
  cursor: pointer;
}

.input::placeholder {
  color: var(--vp-c-text-3);
}

.input:focus,
.select:focus {
  border-color: var(--vp-c-brand-1);
}

.clearBtn {
  position: absolute;
  top: 50%;
  right: 7px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  line-height: 1;
  color: var(--vp-c-text-3);
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
  transform: translateY(-50%);
}

.clearBtn:hover {
  color: var(--vp-c-danger-1);
  background: var(--vp-c-danger-soft);
}

.fieldStack {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.checkRow {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  width: max-content;
  color: var(--vp-c-text-1);
  cursor: pointer;
  font-size: 13px;
  line-height: 20px;
  user-select: none;
}

.checkbox {
  width: 16px;
  height: 16px;
  margin: 0;
  accent-color: var(--vp-c-brand-1);
  cursor: pointer;
}

.controlRow,
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.controlLabel {
  color: var(--vp-c-text-2);
  font-size: 12px;
  line-height: 18px;
}

.segmented {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  overflow: hidden;
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
}

.segmented-two {
  grid-template-columns: repeat(2, 1fr);
}

.segment {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  height: 32px;
  color: var(--vp-c-text-2);
  border-right: 1px solid var(--vp-c-divider);
  cursor: pointer;
  font-size: 13px;
  user-select: none;
}

.segment:last-child {
  border-right: none;
}

.segment input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.segment:hover,
.activeSegment {
  color: var(--vp-c-brand-1);
  background: var(--vp-c-default-soft);
}

.activeSegment {
  font-weight: 600;
}

.inlineGrid {
  display: grid;
  grid-template-columns: 1fr 120px;
  gap: 12px;
}

.prefixGrid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.prefixInput {
  padding-right: 10px;
  font-family: var(--vp-font-family-base);
}

.inputWithUnit {
  position: relative;
}

.inputWithUnit .input {
  padding-right: 34px;
}

.unit {
  position: absolute;
  top: 50%;
  right: 10px;
  color: var(--vp-c-text-3);
  font-size: 12px;
  pointer-events: none;
  transform: translateY(-50%);
}

.actionBar {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 16px;
}

.saveBtn,
.resetBtn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 72px;
  height: 34px;
  padding: 0 14px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
}

.saveBtn {
  color: #fff;
  background: var(--vp-c-brand-1);
  border: 1px solid var(--vp-c-brand-1);
}

.saveBtn:hover:not(.disabled) {
  background: var(--vp-c-brand-2);
}

.saveBtn.disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.resetBtn {
  color: var(--vp-c-text-1);
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
}

.resetBtn:hover {
  border-color: var(--vp-c-brand-1);
}

.toast {
  position: fixed;
  top: 78px;
  left: 50%;
  z-index: 1000;
  padding: 8px 12px;
  color: #fff;
  background: var(--vp-c-brand-1);
  border-radius: 6px;
  box-shadow: var(--vp-shadow-2);
  font-size: 13px;
  transform: translateX(-50%);
}

:global(.toast-enter-active),
:global(.toast-leave-active) {
  transition: all 0.2s ease;
}

:global(.toast-enter-from),
:global(.toast-leave-to) {
  opacity: 0;
  transform: translate(-50%, -8px);
}

@media (max-width: 768px) {
  .settingsWrapper {
    padding: 0;
  }

  .settingItem {
    grid-template-columns: 1fr;
    gap: 10px;
    padding: 16px 0;
  }

  .inlineGrid {
    grid-template-columns: 1fr;
  }

  .prefixGrid {
    grid-template-columns: 1fr;
  }

  .tooltip {
    width: min(260px, calc(100vw - 48px));
    max-width: min(260px, calc(100vw - 48px));
  }

  .actionBar {
    flex-direction: column-reverse;
  }

  .saveBtn,
  .resetBtn {
    width: 100%;
  }
}
</style>
