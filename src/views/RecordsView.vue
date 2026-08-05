<script setup>
import { computed } from 'vue'
import { useUIStore } from '@/stores/ui'
import { useRecordsStore } from '@/stores/records'
import PageHeader from '@/components/organisms/PageHeader.vue'
import RecordCard from '@/components/molecules/RecordCard.vue'
import MEmptyState from '@/components/atoms/MEmptyState.vue'

const ui = useUIStore()
const recordsStore = useRecordsStore()

const grouped = computed(() => recordsStore.groupedRecords)
const countText = computed(() => recordsStore.totalCount > 0 ? recordsStore.totalCount + ' 条记录' : '')

function selectRecord(id) {
  ui.selectedRecordId = id
  ui.showDetail = true
}
</script>

<template>
  <div class="page records-page">
    <PageHeader title="记录" :subtitle="countText" />
    <div class="page-content">
      <template v-if="grouped.length === 0">
        <MEmptyState
          icon="plus"
          title="还没有记录"
          description="点击写日记按钮，开始记录你的第一篇日记"
        />
      </template>
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
</style>
