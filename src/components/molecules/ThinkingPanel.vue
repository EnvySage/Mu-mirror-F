<script setup>
/**
 * 思考过程面板（SSE thinking 事件 · 与 delta 同构流式累积）
 *
 * 折叠条形态：SVG 大脑/火花线条图标 + 「思考过程」mono 眉标 + 状态点
 *   - streaming=true：状态点 accent 色呼吸动画（思考进行中）
 *   - streaming=false：状态点静止灰（思考结束）
 * 展开态：thinking 全文，--ink-2 灰字 + --accent 左侧 2px 竖线 + 等宽小字号 +
 * max-height 限高内部滚动。
 *
 * 折叠策略（用户体验：答完收起，点开可回看）：
 *   - streaming 中默认展开（新增增量自动跟随）
 *   - streaming 由 true → false（done 事件翻转 typing）时自动折叠
 *   - 用户可随时点击折叠条切换；流式中手动收起后不强制弹开（userTouched 锁定）
 *
 * 历史消息永远没有 thinking 字段（不落 conversation_history），本组件不渲染。
 */
import { ref, watch } from 'vue'

const props = defineProps({
  /** 思考过程累积文本（chat store msg.thinking） */
  thinking: { type: String, default: '' },
  /** 思考流式进行中（chat store msg.typing 为 true 且有 thinking 时） */
  streaming: { type: Boolean, default: false },
})

/** 展开态；初值跟随 streaming（思考中默认展开） */
const expanded = ref(props.streaming)
/** 用户手动点过折叠条后，自动展开/收起不再干预（尊重用户意图） */
const userTouched = ref(false)

watch(() => props.streaming, (now, prev) => {
  if (userTouched.value) return
  // 思考开始 → 自动展开；思考结束（done）→ 自动折叠（可点开回看）
  if (now && !prev) expanded.value = true
  if (!now && prev) expanded.value = false
})

function toggle() {
  userTouched.value = true
  expanded.value = !expanded.value
}
</script>

<template>
  <div class="think-panel">
    <button
      :class="['think-bar', { 'think-bar-open': expanded }]"
      :aria-expanded="expanded"
      aria-label="思考过程"
      @click="toggle"
    >
      <!-- 大脑/火花线条图标（自画 SVG，无 emoji） -->
      <svg class="think-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 4.5a3 3 0 0 0-3 3 3 3 0 0 0-2.6 4.5A3 3 0 0 0 7 17.2 2.8 2.8 0 0 0 9.8 20c.9 0 1.7-.4 2.2-1V4.5z" />
        <path d="M12 4.5a3 3 0 0 1 3 3 3 3 0 0 1 2.6 4.5 3 3 0 0 1 .6 5.2 2.8 2.8 0 0 1-2.8 2.8c-.9 0-1.7-.4-2.2-1" />
        <path d="M12 19V9.5" />
        <path d="M5.5 5 4 3.5M18.5 5 20 3.5" opacity=".55" />
      </svg>
      <span class="think-label">思考过程</span>
      <span :class="['think-dot', { 'think-dot-live': streaming }]" />
      <svg :class="['think-caret', { 'think-caret-open': expanded }]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
    </button>

    <!-- 展开态：thinking 全文（限高滚动；--accent 左竖线 + 等宽小字） -->
    <div v-if="expanded" class="think-body">
      <div class="think-text">{{ thinking }}</div>
    </div>
  </div>
</template>

<style scoped>
.think-panel { margin-bottom: 8px; }

/* 折叠条（白卡细边，晨纸 mono 眉标风格） */
.think-bar {
  display: inline-flex; align-items: center; gap: 6px;
  max-width: 100%;
  font-family: var(--font-mono); font-size: 10px; letter-spacing: .1em;
  color: var(--text-low);
  padding: 3px 9px; border-radius: var(--radius-full);
  background: var(--ink-2); border: 1px solid var(--line);
  transition: border-color .15s, color .15s;
}
.think-bar:hover { border-color: var(--accent); color: var(--text-mid); }
.think-bar-open { color: var(--text-mid); }

.think-icon { width: 12px; height: 12px; flex-shrink: 0; color: var(--text-mid); }
.think-bar:hover .think-icon { color: var(--accent); }

.think-dot {
  width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0;
  background: var(--text-low); opacity: .55;
}
/* 流式思考中：accent 呼吸动画 */
.think-dot-live {
  background: var(--accent); opacity: 1;
  animation: thinkBreathe 1.4s ease-in-out infinite;
}
@keyframes thinkBreathe {
  0%, 100% { opacity: 1; }
  50% { opacity: .35; }
}

.think-caret { width: 10px; height: 10px; flex-shrink: 0; opacity: .7; transition: transform .18s ease; }
.think-caret-open { transform: rotate(180deg); }

/* 展开正文：--accent 左竖线 + 等宽小字 + 限高滚动 */
.think-body {
  margin-top: 6px;
  padding: 7px 11px;
  border-left: 2px solid var(--accent);
  background: var(--ink-2);
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
  animation: thinkIn .2s ease;
}
.think-text {
  font-family: var(--font-mono);
  font-size: 11px; line-height: 1.75;
  color: var(--text-mid);
  white-space: pre-wrap; word-break: break-word;
  max-height: 200px; overflow-y: auto;
}
@keyframes thinkIn { from { opacity: 0; transform: translateY(-3px); } to { opacity: 1; transform: none; } }

@media (prefers-reduced-motion: reduce) {
  .think-dot-live { animation: none; }
}
</style>
