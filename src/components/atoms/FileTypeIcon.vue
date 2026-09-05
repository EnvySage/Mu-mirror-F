<script setup>
/**
 * 文件类型图标（任务书主题约束：自造 4 个，mono 色细线风格，无 emoji）
 *
 * document=折角纸+文本行 / image=山与日框 / audio=波形 / file=通用兜底。
 * 细线 1.6 描边、currentColor，尺寸由父级 CSS 控制。
 */
import { computed } from 'vue'

const props = defineProps({
  /** document | image | audio | file */
  kind: { type: String, default: 'file' },
})

const kind = computed(() => (['document', 'image', 'audio', 'file'].includes(props.kind) ? props.kind : 'file'))
</script>

<template>
  <svg class="ftype-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"
       stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <!-- document：折角纸 + 三行文本 -->
    <template v-if="kind === 'document'">
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
      <path d="M9 13h6M9 16.5h4" />
    </template>
    <!-- image：相框 + 山 + 日 -->
    <template v-else-if="kind === 'image'">
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <circle cx="9" cy="9.5" r="1.6" />
      <path d="M3.5 16.5l4.6-4.2a1.4 1.4 0 0 1 1.9 0l3.2 3" />
      <path d="M13.5 13l2.2-2a1.4 1.4 0 0 1 1.9 0l2.9 2.6" />
    </template>
    <!-- audio：声波三柱 + 外弧 -->
    <template v-else-if="kind === 'audio'">
      <path d="M4 9.5v5" />
      <path d="M8 6.5v11" />
      <path d="M12 4v16" />
      <path d="M16 6.5v11" />
      <path d="M20 9.5v5" />
    </template>
    <!-- file：通用折角纸 -->
    <template v-else>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
    </template>
  </svg>
</template>

<style scoped>
.ftype-icon { display: block; }
</style>
