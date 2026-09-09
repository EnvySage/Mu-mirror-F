<script setup>
/**
 * 资产文件卡（任务 3/4 · 「我的资产」页行卡，确认门禁版）
 *
 * 与 VaultRefCard（对话内只读引用）不同：资产页管理卡，可编辑可删除可补确认。
 * - 编辑 = 原地展开（display_name/description/category，同回执编辑心智）
 * - 补确认 = extracted 态直接展开确认表单（低信息置顶区入口）→ confirm 门禁动作
 * - 删除 = 后四位输入确认（Q2 资产页路径：输文件名后四位才能删；后端 confirm_name
 *   校验，前端先本地预校验减少无谓请求）+ toast 5 秒撤销窗（真删推迟 5 秒）
 * - digest_status 透明五态：pending 灰"排队中" / extracted 蓝"待确认 · 检索不到" /
 *   confirmed 绿"已可检索" / skipped 灰"仅保管" / failed 红"读取失败"
 * - 未确认文件灰标"未确认 · 检索不到"（§3.3b 资产页低信息置顶区）
 */
import { ref, computed } from 'vue'
import FileTypeIcon from '@/components/atoms/FileTypeIcon.vue'
import { formatBytes, CATEGORY_LABELS } from '@/constants/fileTypes'
import { CONTENT_TYPES } from '@/constants/tags'

const props = defineProps({
  /** vault item（snake_case，见 vault store typedef） */
  item: { type: Object, required: true },
  busy: { type: Boolean, default: false },
  /** mock 门（下载按钮置灰提示 B 接口就绪后可用） */
  mockGate: { type: Boolean, default: false },
})

const emit = defineEmits(['save', 'confirm', 'remove', 'download', 'preview'])

const editing = ref(false)
const confirmingDelete = ref(false)
const confirmInput = ref('')
const leaving = ref(false)
const draft = ref({ display_name: '', description: '', category: 'document' })

/** digest 五态点 + 文案（任务 1：四态改五态） */
const digest = computed(() => {
  const map = {
    pending: { cls: 'dot-skipped', label: '排队中' },
    extracted: { cls: 'dot-extracted', label: '待确认 · 检索不到' },
    confirmed: { cls: 'dot-done', label: '已可检索' },
    skipped: { cls: 'dot-skipped', label: '仅保管' },
    failed: { cls: 'dot-failed', label: '读取失败 · 告诉镜子这是什么' },
  }
  return map[props.item.digest_status] || map.confirmed
})

/** 未确认（extracted）：灰标"未确认 · 检索不到"，可下载预览但检索不到 */
const unconfirmed = computed(() => props.item.digest_status === 'extracted')

/** 未确认卡淡化（保管完整但未进记忆——§3.3b 未确认置灰语义） */
const dimmed = computed(() => unconfirmed.value && !editing.value && !confirmingDelete.value)

/** 低信息：未确认且无描述（低信息置顶区同口径） */
const lowInfo = computed(() =>
  !props.item.deleted
  && !(props.item.description || '').trim()
  && (props.item.digest_status === 'extracted' || props.item.digest_status === 'failed')
)

const metaLine = computed(() => {
  const parts = [props.item.file_type?.toUpperCase() || 'FILE', formatBytes(props.item.size_bytes)]
  const m = String(props.item.created_at || '').match(/(\d{4})-(\d{2})-(\d{2})/)
  if (m) parts.push(`${Number(m[2])}月${Number(m[3])}日`)
  return parts.join(' · ')
})

/** 后四位预校验（Q2：本地先拦一道，匹配才发 DELETE；后端 confirm_name 是最终防线） */
const tail4 = computed(() => {
  const name = String(props.item.original_name || props.item.display_name || '')
  return name.slice(-4)
})
const confirmTail = computed(() => {
  const name = String(props.item.original_name || props.item.display_name || '')
  return name.length <= 4 ? name : name.slice(-4)
})
const tail4Ok = computed(() => confirmTail.value && confirmInput.value.trim().toUpperCase() === confirmTail.value.toUpperCase())

const categoryOptions = CONTENT_TYPES.filter(t => ['learning', 'note', 'work', 'thought'].includes(t.key))

/** 当前 category 归一到 contentType 口径选择（display 用，选择存 contentType） */
const draftCategory = computed(() => draft.value.category)

function startEdit() {
  // 大类 → contentType 近似回填（document→learning / 其他→note）
  const fallback = props.item.category === 'document' ? 'learning' : 'note'
  const current = CONTENT_TYPES.some(t => t.key === props.item.category) ? props.item.category : fallback
  draft.value = {
    display_name: props.item.display_name || '',
    description: props.item.description || '',
    category: current,
  }
  editing.value = true
}

function saveEdit() {
  if (!draft.value.display_name.trim()) return
  emit('save', {
    display_name: draft.value.display_name.trim(),
    description: draft.value.description.trim(),
    category: draftCategory.value,
  })
  editing.value = false
}

/** 补确认（extracted/failed）：直接展开确认表单（同回执编辑心智，确认即进检索） */
function startConfirm() {
  const fallback = props.item.category === 'document' ? 'learning' : 'note'
  draft.value = {
    display_name: props.item.display_name || '',
    description: props.item.description || '',
    category: CONTENT_TYPES.some(t => t.key === props.item.category) ? props.item.category : fallback,
  }
  editing.value = true
}

/** 编辑态保存时若原状态是 extracted/failed → 走 confirm 门禁动作（key/description/category） */
function saveOrConfirm() {
  if (!draft.value.display_name.trim()) return
  const data = {
    display_name: draft.value.display_name.trim(),
    description: draft.value.description.trim(),
    category: draftCategory.value,
  }
  if (unconfirmed.value || props.item.digest_status === 'failed') {
    if (!data.description.trim()) return // 确认门禁：确认必须带一句描述（Y4 图片强制描述同口径）
    emit('confirm', { key: data.display_name, description: data.description, category: data.category })
  } else {
    emit('save', data)
  }
  editing.value = false
}

/** 编辑/确认态按钮文案与禁用逻辑 */
const saveLabel = computed(() => {
  if (props.busy) return '保存中…'
  if (unconfirmed.value || props.item.digest_status === 'failed') return '确认，让它可被检索'
  return '保存'
})
const saveDisabled = computed(() => {
  if (props.busy || !draft.value.display_name.trim()) return true
  if (unconfirmed.value || props.item.digest_status === 'failed') return !draft.value.description.trim()
  return false
})

function askDelete() {
  confirmInput.value = ''
  confirmingDelete.value = true
}

/** 后四位匹配才 emit remove（父级弹 5 秒撤销 toast，5 秒后才真删） */
function onConfirmDelete() {
  if (!tail4Ok.value) return
  confirmingDelete.value = false
  emit('remove', { confirmName: confirmTail.value })
}

function onDownload() {
  if (props.mockGate || props.item.deleted) return
  emit('download', props.item)
}

/** 文件名点击 → 预览模态（deleted 不可；digest 状态不拦——保管完整就可看） */
function onPreview() {
  if (props.item.deleted) return
  emit('preview', props.item)
}
</script>

<template>
  <div :class="['asset-card', { 'asset-leaving': leaving, 'asset-low': lowInfo && !editing && !confirmingDelete, 'asset-unconfirmed': dimmed }]">
    <!-- 原地编辑（confirmed/skipped=保存编辑；extracted/failed=确认门禁动作） -->
    <template v-if="editing">
      <div class="as-fields">
        <label class="as-field">
          <span class="as-field-label">名称</span>
          <input v-model="draft.display_name" class="as-input" placeholder="显示名">
        </label>
        <label class="as-field">
          <span class="as-field-label">描述</span>
          <textarea v-model="draft.description" class="as-input as-textarea" rows="2"
            :placeholder="unconfirmed || item.digest_status === 'failed' ? '告诉镜子这是什么，才能被找到' : '以后想怎么找到它？'" />
        </label>
        <div class="as-field">
          <span class="as-field-label">属于哪类</span>
          <div class="as-cat-row">
            <button
              v-for="t in categoryOptions"
              :key="t.key"
              :class="['as-cat', { selected: draft.category === t.key }]"
              @click="draft.category = t.key"
            >{{ t.label }}</button>
          </div>
        </div>
      </div>
      <div v-if="unconfirmed || item.digest_status === 'failed'" class="as-confirm-note">
        确认后镜子才能凭描述找到它；未确认只是保管，检索不到
      </div>
      <div class="as-actions">
        <button class="as-btn as-btn-ghost" :disabled="busy" @click="editing = false">取消</button>
        <button class="as-btn as-btn-primary" :disabled="saveDisabled" @click="saveOrConfirm">{{ saveLabel }}</button>
      </div>
    </template>

    <!-- 删除确认：输入文件名后四位（Q2 资产页路径） -->
    <template v-else-if="confirmingDelete">
      <div class="as-head">
        <span class="as-icon"><FileTypeIcon :kind="item.category || 'file'" /></span>
        <div class="as-title-wrap">
          <div class="as-name">{{ item.display_name }}</div>
          <div class="as-meta">{{ metaLine }}</div>
        </div>
      </div>
      <div class="as-delete-warn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/></svg>
        确认删除「{{ item.display_name }}」？此操作不可恢复，关联的可检索内容一并清除
      </div>
      <label class="as-tail-field">
        <span class="as-tail-label">输入文件名最后 4 位以确认（{{ confirmTail }}）</span>
        <input v-model="confirmInput" class="as-input as-tail-input" placeholder="最后 4 位" maxlength="8">
      </label>
      <div class="as-actions">
        <button class="as-btn as-btn-ghost" :disabled="busy" @click="confirmingDelete = false">再想想</button>
        <button class="as-btn as-btn-danger" :disabled="busy || !tail4Ok" @click="onConfirmDelete">确认删除</button>
      </div>
    </template>

    <!-- 展示态 -->
    <template v-else>
      <div class="as-head">
        <span class="as-icon"><FileTypeIcon :kind="item.category || 'file'" /></span>
        <div class="as-title-wrap">
          <div class="as-name">{{ item.display_name }}</div>
          <div class="as-meta">
            <span :class="['as-dot', digest.cls]" />
            {{ metaLine }} · {{ digest.label }}
          </div>
        </div>
        <button class="as-del" title="删除" :disabled="busy" @click="askDelete">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
        </button>
      </div>
      <div class="as-name-row">
        <button class="as-preview-link" :disabled="busy || item.deleted" title="预览" @click="onPreview">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>
          预览
        </button>
      </div>

      <div v-if="item.description" class="as-desc">{{ item.description }}</div>

      <!-- 未确认灰标（§3.3b：未确认文件检索不到，认知边界透明） -->
      <div v-if="unconfirmed" class="as-unconfirmed-tag">未确认 · 检索不到</div>

      <!-- 低信息文件提示 -->
      <div v-if="lowInfo" class="as-lowinfo">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg>
        未能识别内容 · 描述一下并确认，它才能被找到
      </div>

      <div class="as-actions">
        <button class="as-btn as-btn-ghost" :disabled="busy" @click="unconfirmed || item.digest_status === 'failed' ? startConfirm() : startEdit()">
          {{ unconfirmed || item.digest_status === 'failed' ? '补确认' : '编辑' }}
        </button>
        <button class="as-btn as-btn-ghost" :disabled="busy || mockGate || item.deleted" @click="onDownload">下载</button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.asset-card {
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  background: #FFFFFF;
  padding: 13px 14px;
  transition: opacity .22s ease, transform .22s ease, box-shadow .15s ease;
}
.asset-card + .asset-card { margin-top: 8px; }
.asset-leaving { opacity: 0; transform: translateY(-4px); }
.asset-low { border-color: var(--warn); box-shadow: 0 0 0 1px var(--warn-bg); }
.asset-unconfirmed { opacity: .78; }

.as-head { display: flex; gap: 10px; align-items: flex-start; min-width: 0; }
.as-icon {
  width: 36px; height: 36px; border-radius: 10px; flex-shrink: 0;
  background: var(--ink-2); border: 1px solid var(--line);
  display: grid; place-items: center; color: var(--text-mid);
}
.as-icon svg { width: 18px; height: 18px; }
.as-title-wrap { min-width: 0; flex: 1; }
.as-name { font-size: 14px; font-weight: 600; color: var(--text-hi); overflow-wrap: anywhere; line-height: 1.45; }
.as-meta {
  display: flex; align-items: center; gap: 5px; flex-wrap: wrap;
  font-family: var(--font-mono); font-size: 10.5px; color: var(--text-low); margin-top: 3px;
}
.as-dot { width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0; }
.dot-done { background: var(--success); }
.dot-extracted { background: var(--accent); }
.dot-failed { background: var(--danger); }
.dot-skipped { background: var(--text-low); }

.as-del {
  width: 28px; height: 28px; border-radius: 8px; flex-shrink: 0;
  color: var(--text-low); display: grid; place-items: center;
  transition: color .15s, background .15s;
}
.as-del:hover:not(:disabled) { color: var(--danger); background: var(--danger-bg); }
.as-del:disabled { opacity: .4; cursor: not-allowed; }
.as-del svg { width: 14px; height: 14px; }

.as-desc { font-size: 12.5px; line-height: 1.7; color: var(--text-mid); margin-top: 8px; overflow-wrap: anywhere; }

/* 预览入口（文件名下轻量文字按钮；无 emoji 全 SVG） */
.as-name-row { margin-top: 6px; }
.as-preview-link {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 11.5px; color: var(--text-mid);
  padding: 2px 8px; border-radius: var(--radius-full);
  transition: color .15s, background .15s;
}
.as-preview-link:hover:not(:disabled) { color: var(--accent); background: var(--accent-soft); }
.as-preview-link:disabled { opacity: .4; cursor: not-allowed; }
.as-preview-link svg { width: 12px; height: 12px; }

.as-unconfirmed-tag {
  display: inline-block;
  margin-top: 8px; padding: 2px 9px;
  font-family: var(--font-mono); font-size: 10px; letter-spacing: .08em;
  color: var(--text-mid); background: var(--ink-2);
  border: 1px dashed var(--line-strong); border-radius: var(--radius-full);
}

.as-lowinfo {
  display: flex; align-items: flex-start; gap: 7px;
  margin-top: 9px; padding: 8px 10px;
  border-radius: var(--radius-sm); background: var(--warn-bg);
  font-size: 11.5px; line-height: 1.6; color: var(--warn);
}
.as-lowinfo svg { width: 13px; height: 13px; flex-shrink: 0; margin-top: 2px; }

/* 编辑字段（与回执/词典编辑同款） */
.as-fields { display: flex; flex-direction: column; gap: 9px; }
.as-field { display: flex; flex-direction: column; gap: 4px; }
.as-field-label {
  font-family: var(--font-mono); font-size: 10.5px; letter-spacing: .14em; color: var(--text-low);
}
.as-input {
  width: 100%; padding: 8px 11px;
  border: 1px solid var(--line); border-radius: var(--radius-sm);
  background: var(--ink-2); font-size: 13px; color: var(--text-hi);
  resize: vertical;
}
.as-input:focus { outline: none; border-color: var(--accent); background: #FFFFFF; }
.as-textarea { line-height: 1.6; min-height: 56px; }
.as-cat-row { display: flex; gap: 6px; flex-wrap: wrap; }
.as-cat {
  font-size: 11.5px; padding: 3px 11px; border-radius: var(--radius-full);
  color: var(--text-mid); box-shadow: inset 0 0 0 1px var(--line);
  transition: all .15s;
}
.as-cat.selected { background: var(--accent); color: #FFFFFF; box-shadow: none; font-weight: 600; }

.as-confirm-note { margin-top: 9px; font-size: 11px; line-height: 1.6; color: var(--text-low); }

/* 删除确认（后四位） */
.as-delete-warn {
  display: flex; align-items: flex-start; gap: 7px;
  margin-top: 9px; padding: 8px 10px;
  border-radius: var(--radius-sm); background: var(--danger-bg);
  font-size: 11.5px; line-height: 1.6; color: var(--danger);
}
.as-delete-warn svg { width: 13px; height: 13px; flex-shrink: 0; margin-top: 2px; }
.as-tail-field { display: flex; flex-direction: column; gap: 4px; margin-top: 9px; }
.as-tail-label { font-size: 11.5px; color: var(--text-mid); }
.as-tail-input { max-width: 180px; font-family: var(--font-mono); }

.as-actions { display: flex; gap: 8px; margin-top: 11px; flex-wrap: wrap; }
.as-btn {
  font-size: 12.5px; padding: 5px 14px; border-radius: var(--radius-full);
  transition: background .15s, opacity .15s;
}
.as-btn:disabled { opacity: .5; cursor: not-allowed; }
.as-btn-primary { background: var(--accent); color: #FFFFFF; font-weight: 600; }
.as-btn-primary:hover:not(:disabled) { background: var(--accent-hover); }
.as-btn-ghost { color: var(--text-mid); box-shadow: inset 0 0 0 1px var(--line-strong); }
.as-btn-ghost:hover:not(:disabled) { background: var(--ink-2); color: var(--text-hi); }
.as-btn-danger { color: var(--danger); }
.as-btn-danger:disabled { color: var(--text-low); box-shadow: inset 0 0 0 1px var(--line); background: transparent; }
.as-btn-danger:hover:not(:disabled) { background: var(--danger-bg); }
</style>
