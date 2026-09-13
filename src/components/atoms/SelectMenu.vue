<script setup>
/**
 * 轻量下拉选择（替代原生 <select>）
 *
 * 为什么不用原生 select：它的下拉面板（popup）由浏览器绘制在独立层，CSS 无法控制
 * 宽度 / 圆角 / 配色 / 层级 —— 实测（Windows Chromium）展开后是白底直角，
 * 会溢出卡片边界并盖住下方内容（选项行还有系统默认的深灰高亮）。
 *
 * 方案：trigger 留在文档流内，菜单 Teleport 到 body + position: fixed 定位 ——
 * 这样不受任何祖先 overflow:hidden / 滚动容器裁剪（.settings-card 恰好是 overflow:hidden）。
 *
 * 无障碍：补回原生 select 的语义 —— role=combobox/listbox/option、
 * aria-expanded / aria-selected / aria-activedescendant，键盘 ↑↓ Home End Enter Esc。
 */
import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue'

const props = defineProps({
  modelValue: { type: [String, Number], default: null },
  /** [{ value, label, desc? }] */
  options: { type: Array, required: true },
  ariaLabel: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  placeholder: { type: String, default: '请选择' },
  /** 尺寸：md（设置页表单，默认）/ sm（镜子页等紧凑控件） */
  size: { type: String, default: 'md' },
  /** true=撑满父容器（默认）；false=贴合内容宽度（对比选择器等并排控件） */
  block: { type: Boolean, default: true },
})
const emit = defineEmits(['update:modelValue'])

/** 每个实例一个 id 前缀（aria-controls / activedescendant 用） */
const uid = `select-menu-${Math.random().toString(36).slice(2, 9)}`

const triggerEl = ref(null)
const open = ref(false)
const activeIndex = ref(-1)
const menuStyle = ref({})

const MENU_MAX_H = 320
const GAP = 6

const selectedIndex = computed(() => props.options.findIndex(o => o.value === props.modelValue))
const selectedOption = computed(() =>
  selectedIndex.value >= 0 ? props.options[selectedIndex.value] : null)
const activeId = computed(() =>
  open.value && activeIndex.value >= 0 ? optionId(activeIndex.value) : undefined)

function optionId(i) {
  return `${uid}-opt-${i}`
}

/** 跟随 trigger 定位；下方空间不足且上方够高时向上翻转 */
function position() {
  const el = triggerEl.value
  if (!el) return
  const r = el.getBoundingClientRect()
  const menuH = Math.min(props.options.length * 52 + 8, MENU_MAX_H)
  const flip = window.innerHeight - r.bottom - GAP < menuH && r.top > menuH
  menuStyle.value = {
    left: `${Math.round(r.left)}px`,
    width: `${Math.round(r.width)}px`,
    top: flip ? `${Math.round(r.top - GAP - menuH)}px` : `${Math.round(r.bottom + GAP)}px`,
    maxHeight: `${MENU_MAX_H}px`,
  }
}

function scrollActiveIntoView() {
  if (activeIndex.value < 0) return
  document.getElementById(optionId(activeIndex.value))?.scrollIntoView({ block: 'nearest' })
}

function openMenu() {
  if (props.disabled || open.value) return
  open.value = true
  activeIndex.value = selectedIndex.value >= 0 ? selectedIndex.value : 0
  nextTick(() => {
    position()
    scrollActiveIntoView()
  })
}

function closeMenu() {
  open.value = false
}

function toggle() {
  if (open.value) closeMenu()
  else openMenu()
}

function choose(opt) {
  closeMenu()
  triggerEl.value?.focus()
  if (opt.value !== props.modelValue) emit('update:modelValue', opt.value)
}

function move(step) {
  if (!open.value) return openMenu()
  const n = props.options.length
  if (!n) return
  activeIndex.value = (activeIndex.value + step + n) % n
  nextTick(scrollActiveIntoView)
}

function onKeydown(e) {
  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault()
      move(1)
      break
    case 'ArrowUp':
      e.preventDefault()
      move(-1)
      break
    case 'Home':
      e.preventDefault()
      activeIndex.value = 0
      nextTick(scrollActiveIntoView)
      break
    case 'End':
      e.preventDefault()
      activeIndex.value = props.options.length - 1
      nextTick(scrollActiveIntoView)
      break
    case 'Enter':
    case ' ':
      e.preventDefault()
      if (!open.value) openMenu()
      else if (props.options[activeIndex.value]) choose(props.options[activeIndex.value])
      break
    case 'Escape':
      if (open.value) {
        e.preventDefault()
        closeMenu()
      }
      break
    case 'Tab':
      closeMenu()
      break
    default:
      break
  }
}

/** 点空白处关闭；菜单面板在 body 下，靠 class 判断 */
function onDocPointerDown(e) {
  if (!open.value) return
  if (triggerEl.value?.contains(e.target)) return
  if (e.target instanceof Element && e.target.closest('.select-menu-panel')) return
  closeMenu()
}

function onReposition() {
  if (open.value) position()
}

watch(open, (v) => {
  if (v) {
    document.addEventListener('pointerdown', onDocPointerDown, true)
    window.addEventListener('scroll', onReposition, true)
    window.addEventListener('resize', onReposition)
  } else {
    document.removeEventListener('pointerdown', onDocPointerDown, true)
    window.removeEventListener('scroll', onReposition, true)
    window.removeEventListener('resize', onReposition)
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocPointerDown, true)
  window.removeEventListener('scroll', onReposition, true)
  window.removeEventListener('resize', onReposition)
})
</script>

<template>
  <div :class="['select-menu', { 'is-inline': !block }]">
    <button
      ref="triggerEl"
      type="button"
      role="combobox"
      :class="['select-trigger', `size-${size}`, { 'is-open': open }]"
      :disabled="disabled"
      :aria-label="ariaLabel"
      :aria-expanded="open"
      aria-haspopup="listbox"
      :aria-controls="`${uid}-list`"
      :aria-activedescendant="activeId"
      @click="toggle"
      @keydown="onKeydown"
    >
      <span class="select-value">{{ selectedOption ? selectedOption.label : placeholder }}</span>
      <svg class="select-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
    </button>

    <Teleport to="body">
      <div
        v-if="open"
        :id="`${uid}-list`"
        class="select-menu-panel"
        role="listbox"
        :aria-label="ariaLabel"
        :style="menuStyle"
      >
        <button
          v-for="(opt, i) in options"
          :id="optionId(i)"
          :key="opt.value"
          type="button"
          role="option"
          :class="['select-option', { 'is-active': i === activeIndex, 'is-selected': opt.value === modelValue }]"
          :aria-selected="opt.value === modelValue"
          @mouseenter="activeIndex = i"
          @click="choose(opt)"
        >
          <span class="select-option-main">
            <span class="select-option-label">{{ opt.label }}</span>
            <span v-if="opt.desc" class="select-option-desc">{{ opt.desc }}</span>
          </span>
          <svg
            v-if="opt.value === modelValue"
            class="select-option-tick"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"
          ><path d="M5 13l4 4L19 7"/></svg>
        </button>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.select-menu { width: 100%; }
/* 贴合内容宽度（并排控件用）：宽度由选中项文本决定，与原生 select 的观感接近 */
.select-menu.is-inline { display: inline-block; width: auto; max-width: 100%; vertical-align: middle; }

/* ===== 触发器（与既有 .lookback-select 同视觉） ===== */
.select-trigger {
  width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 8px;
  font-size: 13px; color: var(--text-hi); text-align: left;
  padding: 8px 10px; border-radius: var(--radius-sm);
  border: 1px solid var(--line-strong); background: var(--card);
  transition: border-color .15s;
}
/* 紧凑变体（镜子页幽灵卡 / A·B 对比选择器） */
.select-trigger.size-sm { font-size: 12.5px; padding: 5px 8px; gap: 6px; }
.select-trigger.size-sm .select-caret { width: 12px; height: 12px; }
.select-trigger:hover:not(:disabled) { border-color: var(--accent); }
.select-trigger.is-open { border-color: var(--accent); }
.select-trigger:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
.select-trigger:disabled { opacity: .55; cursor: not-allowed; }
.select-value { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.select-caret {
  width: 14px; height: 14px; flex-shrink: 0; color: var(--text-low);
  transition: transform .18s ease;
}
.select-trigger.is-open .select-caret { transform: rotate(180deg); }

/* ===== 菜单面板（Teleport 到 body，fixed 定位不受祖先 overflow 裁剪） ===== */
.select-menu-panel {
  position: fixed; z-index: 60;
  overflow-y: auto; padding: 4px;
  background: var(--card);
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-sm);
  box-shadow: 0 10px 28px rgba(26, 26, 23, .16);
  animation: selectMenuIn .14s ease;
}
.select-option {
  width: 100%; display: flex; align-items: center; gap: 8px;
  padding: 8px 10px; border-radius: var(--radius-sm);
  text-align: left; color: var(--text-hi);
}
.select-option.is-active { background: var(--ink-2); }
.select-option.is-selected .select-option-label { color: var(--accent); font-weight: 600; }
.select-option-main { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 2px; }
.select-option-label { font-size: 13px; line-height: 1.4; }
.select-option-desc { font-size: 11.5px; color: var(--text-low); line-height: 1.5; }
.select-option-tick { width: 14px; height: 14px; flex-shrink: 0; color: var(--accent); }

@keyframes selectMenuIn { from { opacity: 0; transform: translateY(-3px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .select-menu-panel { animation: none; } }
</style>
