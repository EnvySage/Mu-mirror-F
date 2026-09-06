<script setup>
/**
 * 对话内文件卡（任务 1 · 设计稿 4.1 用户点名的重点）
 *
 * 三档引用：
 *  - strong 强引用：完整卡——类型图标 + display_name + 大小/日期/消化状态行 +
 *    AI 引用摘录（quote 引用条）+ [预览][下载]
 *  - weak / vague 弱引用与模糊提及：行内小芯片，点击展开完整卡（vague 展开时
 *    顶部提示"你指的是这个吗"，用户点开确认）
 *
 * 边界态（设计稿 4.1 边界）：
 *  - deleted → 置灰"文件已删除"不可点（芯片与卡都不可交互）
 *  - digesting（pending）→ "索引中…"可下载不可预览问答
 *  - 同 vault_item_id 多引用同气泡单卡 → 由父级 ChatView 按 vault_item_id 去重
 *
 * 预览/下载：USE_MOCK 态按钮置灰提示"B 接口就绪后可用"（mockGate 注入），
 * 交互态（真接口）走 /preview 与 /download。
 */
import { ref, computed } from 'vue'
import { useToastStore } from '@/stores/toast'
import FileTypeIcon from '@/components/atoms/FileTypeIcon.vue'
import { formatBytes } from '@/constants/fileTypes'

const props = defineProps({
  /**
   * vault_refs 单条引用（chat store normalizeVaultRefs 归一化输出，camelCase）：
   * @property {string} id
   * @property {number|string|null} vaultItemId
   * @property {string} displayName
   * @property {'document'|'image'|'audio'|null} category
   * @property {string} fileType
   * @property {number|null} sizeBytes
   * @property {'pending'|'done'|'failed'|'skipped'} digestStatus
   * @property {string} quote          AI 引用摘录（强引用才有）
   * @property {string} createdAt      存入日期
   * @property {boolean} deleted       文件已删（边界态）
   * @property {boolean} vague         模糊提及档
   * @property {'strong'|'weak'|'vague'} strength
   */
  refItem: { type: Object, required: true },
  /** mock 态置灰预览/下载（B 接口就绪后由 store source 驱动置 false） */
  mockGate: { type: Boolean, default: true },
})

const toast = useToastStore()

// 兼容两种字段口径：归一化 camelCase（chat store）与原始 SSE snake_case（vault_refs 直传）
const f = computed(() => ({
  displayName: props.refItem.displayName ?? props.refItem.display_name ?? '未命名文件',
  category: props.refItem.category ?? null,
  sizeBytes: props.refItem.sizeBytes ?? props.refItem.size_bytes ?? null,
  digestStatus: props.refItem.digestStatus ?? props.refItem.digest_status ?? 'done',
  quote: props.refItem.quote ?? '',
  createdAt: props.refItem.createdAt ?? props.refItem.created_at ?? '',
  deleted: !!(props.refItem.deleted),
  vague: !!(props.refItem.vague),
  strength: props.refItem.strength || (props.refItem.quote ? 'strong' : (props.refItem.vague ? 'vague' : 'weak')),
}))

/** 档位：strong=完整卡直接渲染；weak/vague=芯片点击展开 */
const strength = computed(() => f.value.strength)
const expanded = ref(false)
const showFull = computed(() => strength.value === 'strong' || expanded.value)

/** 消化状态行（设计稿：2.1MB · 9月1日存入 · 已可检索） */
const metaLine = computed(() => {
  const parts = []
  if (f.value.sizeBytes) parts.push(formatBytes(f.value.sizeBytes))
  if (f.value.createdAt) {
    const m = String(f.value.createdAt).match(/(\d{4})-(\d{2})-(\d{2})/)
    if (m) parts.push(`${Number(m[2])}月${Number(m[3])}日存入`)
  }
  parts.push(digestLabel.value)
  return parts.join(' · ')
})

/** 消化状态段（五态 · fix-batch B7：extracted=待确认检索不到，confirmed=已可检索） */
const digestLabel = computed(() => {
  if (f.value.deleted) return '已删除'
  const s = f.value.digestStatus
  if (s === 'pending') return '排队中'
  if (s === 'extracted') return '待确认 · 检索不到'
  if (s === 'confirmed') return props.refItem.chunk_count ? `已可检索 · ${props.refItem.chunk_count} 段` : '已可检索'
  if (s === 'failed') return '读取失败 · 按文件名可找'
  if (s === 'skipped') return '仅保管'
  if (s === 'done') return '已可检索'
  return '已可检索'
})

/** 状态色点：confirmed=绿 extracted=蓝 pending=灰 failed=红 skipped=灰 */
const digestDotClass = computed(() => {
  const s = f.value.digestStatus
  if (s === 'confirmed' || s === 'done') return 'dot-done'
  if (s === 'extracted') return 'dot-extracted'
  if (s === 'failed') return 'dot-failed'
  return 'dot-skipped'
})

const isDeleted = computed(() => f.value.deleted)
const isDigesting = computed(() => f.value.digestStatus === 'pending' && !isDeleted.value)
/** extracted 未确认：可下载预览（保管完整），对话引用标注检索不到 */
const isUnconfirmed = computed(() => f.value.digestStatus === 'extracted' && !isDeleted.value)

/** mock 门：预览/下载按钮置灰（交互态由父级传 mockGate=false） */
const actionsDisabled = computed(() => props.mockGate || isDeleted.value)
const previewDisabled = computed(() => actionsDisabled.value || isDigesting.value)

function toggleExpand() {
  if (isDeleted.value) return
  expanded.value = !expanded.value
}

function onPreview() {
  if (previewDisabled.value) {
    if (!isDeleted.value) toast.info(props.mockGate ? '预览将在 B 接口就绪后可用' : '索引中…稍后再试')
    return
  }
  toast.info('预览将在 B 接口就绪后可用')
}

function onDownload() {
  if (actionsDisabled.value) {
    toast.info(props.mockGate ? '下载将在 B 接口就绪后可用' : '文件已删除')
    return
  }
  toast.info('下载将在 B 接口就绪后可用')
}
</script>

<template>
  <div class="vault-ref">
    <!-- 档 1：强引用完整卡（或弱/模糊芯片展开后的完整卡） -->
    <div v-if="showFull" :class="['vref-card', { 'vref-deleted': isDeleted, 'vref-vague-origin': f.vague }]">
      <!-- 模糊提及确认提示（点开芯片后） -->
      <div v-if="f.vague && !isDeleted" class="vref-vague-hint">
        你指的是这个吗？
      </div>

      <div class="vref-head">
        <span :class="['vref-icon', { 'vref-icon-deleted': isDeleted }]">
          <FileTypeIcon :kind="f.category || 'file'" />
        </span>
        <div class="vref-title-wrap">
          <div :class="['vref-name', { 'vref-name-deleted': isDeleted }]">{{ f.displayName }}</div>
          <div class="vref-meta">
            <span :class="['vref-dot', digestDotClass]" />
            {{ metaLine }}
          </div>
        </div>
      </div>

      <!-- AI 引用摘录（强引用核心：回答基于文件内容的原文） -->
      <div v-if="f.quote && !isDeleted" class="vref-quote">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21c3-1 5-3.5 5-7V8a4 4 0 0 1 4-4h1"/><path d="M13 21c3-1 5-3.5 5-7V8a4 4 0 0 1 4-4h-1" opacity=".45"/></svg>
        <p>{{ f.quote }}</p>
      </div>

      <!-- 边界态：已删除 -->
      <div v-if="isDeleted" class="vref-boundary vref-boundary-danger">文件已删除 · 无法预览或下载</div>
      <!-- 边界态：排队消化 -->
      <div v-else-if="isDigesting" class="vref-boundary">排队消化中…可下载，稍后可检索</div>
      <!-- 边界态：未确认（确认门禁） -->
      <div v-else-if="isUnconfirmed" class="vref-boundary">未确认 · 检索不到（可在资产页确认让它可被找到）</div>

      <div class="vref-actions">
        <button class="vref-btn" :disabled="previewDisabled" @click="onPreview">预览</button>
        <button class="vref-btn" :disabled="actionsDisabled" @click="onDownload">下载</button>
        <!-- 弱/模糊芯片展开后可收起 -->
        <button v-if="strength !== 'strong'" class="vref-btn vref-btn-collapse" @click="expanded = false">收起</button>
      </div>
    </div>

    <!-- 档 2/3：弱引用 / 模糊提及行内芯片 -->
    <button
      v-else
      :class="['vref-chip', { 'vref-chip-deleted': isDeleted, 'vref-chip-vague': f.vague }]"
      :disabled="isDeleted"
      @click="toggleExpand"
    >
      <FileTypeIcon :kind="f.category || 'file'" />
      <span class="vref-chip-name">{{ f.displayName }}</span>
      <span v-if="isDeleted" class="vref-chip-tag">文件已删除</span>
      <span v-else-if="isDigesting" class="vref-chip-tag">排队中</span>
      <span v-else-if="isUnconfirmed" class="vref-chip-tag">待确认 · 检索不到</span>
      <span v-else-if="f.vague" class="vref-chip-tag">可能指的是它</span>
      <svg v-if="!isDeleted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="vref-chip-caret"><path d="M9 18l6-6-6-6"/></svg>
    </button>
  </div>
</template>

<style scoped>
.vault-ref { margin-top: 10px; }

/* ===== 完整卡 ===== */
.vref-card {
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  background: var(--ink-2);
  padding: 11px 12px;
  animation: cardIn .25s ease;
  max-width: 100%;
}
.vref-card.vref-vague-origin { border-style: dashed; }

.vref-vague-hint {
  font-size: 11px; color: var(--warn); margin-bottom: 7px;
  font-family: var(--font-mono); letter-spacing: .08em;
}

.vref-head { display: flex; gap: 10px; align-items: flex-start; min-width: 0; }
.vref-icon {
  width: 34px; height: 34px; border-radius: 9px; flex-shrink: 0;
  background: #FFFFFF; border: 1px solid var(--line);
  display: grid; place-items: center; color: var(--text-mid);
}
.vref-icon svg { width: 17px; height: 17px; }
.vref-icon-deleted { opacity: .45; }
.vref-title-wrap { min-width: 0; flex: 1; }
.vref-name {
  font-size: 13.5px; font-weight: 600; color: var(--text-hi);
  overflow-wrap: anywhere; line-height: 1.45;
}
.vref-name-deleted { color: var(--text-low); text-decoration: line-through; text-decoration-color: var(--line-strong); }
.vref-meta {
  display: flex; align-items: center; gap: 5px; flex-wrap: wrap;
  font-family: var(--font-mono); font-size: 10.5px; color: var(--text-low); margin-top: 3px;
}
.vref-dot { width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0; }
.dot-done { background: var(--success); }
.dot-extracted { background: var(--accent); }
.dot-pending { background: var(--text-low); }
.dot-failed { background: var(--danger); }
.dot-skipped { background: var(--text-low); }

/* AI 引用摘录条 */
.vref-quote {
  display: flex; gap: 7px; margin-top: 9px;
  padding: 7px 10px; border-left: 2px solid var(--accent);
  background: #FFFFFF; border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
}
.vref-quote svg { width: 13px; height: 13px; color: var(--accent); flex-shrink: 0; margin-top: 3px; opacity: .7; }
.vref-quote p {
  font-size: 12px; line-height: 1.7; color: var(--text-mid);
  font-style: italic; overflow-wrap: anywhere;
}

/* 边界态提示 */
.vref-boundary {
  margin-top: 8px; font-size: 11.5px; color: var(--text-low);
  padding: 6px 10px; border-radius: var(--radius-sm);
  background: var(--ink); border: 1px dashed var(--line);
}
.vref-boundary-danger { color: var(--danger); border-color: var(--danger-bg); }

.vref-actions { display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap; }
.vref-btn {
  font-size: 12px; padding: 4px 13px; border-radius: var(--radius-full);
  color: var(--accent); box-shadow: inset 0 0 0 1px var(--accent);
  background: #FFFFFF; transition: background .15s;
}
.vref-btn:hover:not(:disabled) { background: var(--accent-soft); }
.vref-btn:disabled { opacity: .45; cursor: not-allowed; color: var(--text-mid); box-shadow: inset 0 0 0 1px var(--line-strong); }
.vref-btn-collapse { color: var(--text-mid); box-shadow: inset 0 0 0 1px var(--line-strong); }

/* ===== 行内芯片（弱引用 / 模糊提及） ===== */
.vref-chip {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 11.5px; color: var(--text-mid);
  padding: 3.5px 10px; border-radius: var(--radius-full);
  background: #FFFFFF; border: 1px solid var(--line);
  max-width: 100%; transition: border-color .15s, color .15s;
}
.vref-chip svg { width: 12px; height: 12px; flex-shrink: 0; color: var(--text-low); }
.vref-chip-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.vref-chip-tag { font-size: 10px; color: var(--text-low); flex-shrink: 0; }
.vref-chip-vague { border-style: dashed; }
.vref-chip-caret { width: 10px !important; height: 10px !important; }
.vref-chip:hover:not(:disabled) { border-color: var(--accent); color: var(--accent); }
.vref-chip:disabled { cursor: not-allowed; opacity: .6; }
.vref-chip-deleted { background: var(--ink-2); border-style: dashed; }
</style>
