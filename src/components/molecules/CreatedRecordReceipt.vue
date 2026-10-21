<script setup>
const props = defineProps({
  record: { type: Object, required: true },
})

const emit = defineEmits(['open'])

function openRecord() {
  if (props.record?.recordId) emit('open', props.record)
}
</script>

<template>
  <section class="created-record-receipt" aria-label="日记保存回执">
    <div class="receipt-mark" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M5 3.75h9.5L19 8.25v12A1.75 1.75 0 0 1 17.25 22h-11.5A1.75 1.75 0 0 1 4 20.25V5.5A1.75 1.75 0 0 1 5.75 3.75Z" />
        <path d="M14 4v5h5M8 13h8M8 17h8" />
      </svg>
    </div>
    <div class="receipt-copy">
      <strong>已保存 · 仅记录</strong>
      <p>这条内容按原文保存；没有授权 AI 整理或写入长期记忆。</p>
    </div>
    <button type="button" :disabled="!record?.recordId" @click="openRecord">查看日记</button>
  </section>
</template>

<style scoped>
.created-record-receipt {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 11px;
  padding: 11px 12px;
  border: 1px solid var(--line);
  border-left: 3px solid var(--accent);
  border-radius: var(--radius-sm);
  background: var(--ink-2);
}
.receipt-mark {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  flex: 0 0 30px;
  border-radius: var(--radius-full);
  background: var(--accent-soft);
  color: var(--accent);
}
.receipt-mark svg { width: 17px; height: 17px; }
.receipt-copy { flex: 1; min-width: 0; }
.receipt-copy strong { display: block; color: var(--text-hi); font-size: 12.5px; }
.receipt-copy p { margin: 2px 0 0; color: var(--text-mid); font-size: 11.5px; line-height: 1.5; }
.created-record-receipt button {
  flex: 0 0 auto;
  padding: 6px 10px;
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  background: #FFFFFF;
  color: var(--accent);
  font-size: 11.5px;
  cursor: pointer;
}
.created-record-receipt button:hover:not(:disabled) { border-color: var(--accent); }
.created-record-receipt button:disabled { opacity: .5; cursor: not-allowed; }
@media (max-width: 520px) {
  .created-record-receipt { align-items: flex-start; flex-wrap: wrap; }
  .receipt-copy { flex: 1 1 calc(100% - 42px); }
  .created-record-receipt button { margin-left: 40px; }
}
</style>
