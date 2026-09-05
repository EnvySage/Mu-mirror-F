<script setup>
/**
 * 资产文件卡（任务 4 · 「我的资产」页行卡）
 *
 * 与 VaultRefCard（对话内只读引用）不同：资产页管理卡，可编辑可删除。
 * - 编辑 = 原地展开（display_name/description/category，同回执编辑心智）
 * - 删除 = 内联二次确认（"确认删除？不可恢复"）→ 淡出
 * - digest_status 透明四态：done=绿点"可检索" / pending=黄点"索引中" /
 *   failed=红点"读取失败，仅按文件名可找" / skipped=灰点"仅保管"
 * - 低信息文件（description 空）→ 高亮提示"请描述一下，方便日后找它"，有描述后归位
 */
import { ref, computed } from 'vue'
import FileTypeIcon from '@/components/atoms/FileTypeIcon.vue'
import { formatBytes, CATEGORY_LABELS } from '@/constants/fileTypes'

const props = defineProps({
  /** vault item（snake_case，见 vault store typedef） */
  item: { type: Object, required: true },
  busy: { type: Boolean, default: false },
  /** mock 门（下载按钮置灰提示 B 接口就绪后可用） */
  mockGate: { type: Boolean, default: true },
})

const emit = defineEmits(['save', 'remove', 'download'])

const editing = ref(false)
const confirmingDelete = ref(false)
const leaving = ref(false)
const draft = ref({ display_name: '', description: '', category: 'document' })

/** digest 四态点 + 文案 */
const digest = computed(() => {
  const map = {
    done: { cls: 'dot-done', label: '可检索' },
    pending: { cls: 'dot-pending', label: '索引中' },
    failed: { cls: 'dot-failed', label: '读取失败，仅按文件名可找' },
    skipped: { cls: 'dot-skipped', label: '仅保管' },
  }
  return map[props.item.digest_status] || map.done
})

/** 低信息：无描述（failed 同样视为低信息——只按文件名可找） */
const lowInfo = computed(() => !props.item.deleted && !(props.item.description || '').trim())

const metaLine = computed(() => {
  const parts = [props.item.file_type?.toUpperCase() || 'FILE', formatBytes(props.item.size_bytes)]
  const m = String(props.item.created_at || '').match(/(\d{4})-(\d{2})-(\d{2})/)
  if (m) parts.push(`${Number(m[2])}月${Number(m[3])}日`)
  return parts.join(' · ')
})

function startEdit() {
  draft.value = {
    display_name: props.item.display_name || '',
    description: props.item.description || '',
    category: props.item.category || 'document',
  }
  editing.value = true
}

function saveEdit() {
  if (!draft.value.display_name.trim()) return
  emit('save', {
    display_name: draft.value.display_name.trim(),
    description: draft.value.description.trim(),
    category: draft.value.category,
  })
  editing.value = false
}

function askDelete() {
  confirmingDelete.value = true
}

function onConfirmDelete() {
  leaving.value = true
  setTimeout(() => emit('remove'), 220)
}

function onDownload() {
  if (props.mockGate || props.item.deleted) return
  emit('download', props.item)
}
</script>

<template>
  <div :class="['asset-card', { 'asset-leaving': leaving, 'asset-low': lowInfo && !editing && !confirmingDelete }]">
    <!-- 原地编辑 -->
    <template v-if="editing">
      <div class="as-fields">
        <label class="as-field">
          <span class="as-field-label">名称</span>
          <input v-model="draft.display_name" class="as-input" placeholder="显示名">
        </label>
        <label class="as-field">
          <span class="as-field-label">描述</span>
          <textarea v-model="draft.description" class="as-input as-textarea" rows="2" placeholder="以后想怎么找到它？" />
        </label>
        <div class="as-field">
          <span class="as-field-label">分类</span>
          <div class="as-cat-row">
            <button
              v-for="(label, key) in CATEGORY_LABELS"
              :key="key"
              :class="['as-cat', { selected: draft.category === key }]"
              @click="draft.category = key"
            >{{ label }}</button>
          </div>
        </div>
      </div>
      <div class="as-actions">
        <button class="as-btn as-btn-ghost" :disabled="busy" @click="editing = false">取消</button>
        <button class="as-btn as-btn-primary" :disabled="busy || !draft.display_name.trim()" @click="saveEdit">
          {{ busy ? '保存中…' : '保存' }}
        </button>
      </div>
    </template>

    <!-- 删除二次确认 -->
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
        确认删除？不可恢复，关联的可检索内容一并清除
      </div>
      <div class="as-actions">
        <button class="as-btn as-btn-ghost" :disabled="busy" @click="confirmingDelete = false">再想想</button>
        <button class="as-btn as-btn-danger" :disabled="busy" @click="onConfirmDelete">确认删除</button>
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

      <div v-if="item.description" class="as-desc">{{ item.description }}</div>

      <!-- 低信息文件提示（B2 认知边界透明在 vault 的应用） -->
      <div v-if="lowInfo" class="as-lowinfo">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg>
        未能识别内容 · 请描述一下，方便日后找它
      </div>

      <div class="as-actions">
        <button class="as-btn as-btn-ghost" :disabled="busy" @click="startEdit">编辑</button>
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
.dot-pending { background: var(--warn); }
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

/* 删除确认 */
.as-delete-warn {
  display: flex; align-items: flex-start; gap: 7px;
  margin-top: 9px; padding: 8px 10px;
  border-radius: var(--radius-sm); background: var(--danger-bg);
  font-size: 11.5px; line-height: 1.6; color: var(--danger);
}
.as-delete-warn svg { width: 13px; height: 13px; flex-shrink: 0; margin-top: 2px; }

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
.as-btn-danger:hover:not(:disabled) { background: var(--danger-bg); }
</style>
