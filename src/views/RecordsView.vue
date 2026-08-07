<script setup>
import { computed, onMounted } from 'vue'
import { useUIStore } from '@/stores/ui'
import { useRecordsStore } from '@/stores/records'
import PageHeader from '@/components/organisms/PageHeader.vue'
import RecordCard from '@/components/molecules/RecordCard.vue'
import MEmptyState from '@/components/atoms/MEmptyState.vue'

const ui = useUIStore()
const recordsStore = useRecordsStore()

const grouped = computed(() => recordsStore.groupedRecords)
const countText = computed(() => recordsStore.totalCount > 0 ? recordsStore.totalCount + ' 条记录' : '')
const loading = computed(() => recordsStore.loading)

onMounted(() => {
  recordsStore.fetchRecords()
})

function selectRecord(id) {
  ui.selectedRecordId = id
  ui.showDetail = true
}
</script>

<template>
  <div class="page records-page">
    <PageHeader title="记录" :subtitle="countText" />
    <div class="page-content">
      <!-- 加载状态 -->
      <div v-if="loading" class="loading-state">
        <div class="loading-spinner"></div>
        <div class="loading-text">加载中...</div>
      </div>

      <!-- 空状态 -->
      <MEmptyState
        v-else-if="grouped.length === 0"
        icon="plus"
        title="还没有记录"
        description="点击写日记按钮，开始记录你的第一篇日记"
      />

      <!-- 记录列表 -->
      <template v-else>
        <div v-for="group in grouped" :key="group.date">
          <div class="date-separator">{{ group.date }}</div>
          <RecordCard
            v-for="record in group.items"
            :key="record.id"
            :record="record"
            :active="ui.selectedRecordId === record.id"
            @click="selectRecord(record.id)"
          />
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.page {
  position: absolute; top: 0; left: 0; width: 100%; height: 100%;
  background: var(--bg); overflow-y: auto; overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
}
.page-content { padding: 12px 16px 32px; }

@media (min-width: 900px) {
  .page-content { padding: 20px 36px 36px; }
}

/* 加载状态 */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 0;
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-text {
  margin-top: 12px;
  font-size: 14px;
  color: var(--text-secondary);
}

.date-separator {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  padding: 12px 0 8px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 10px;
}
</style>
