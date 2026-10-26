<script setup>
defineProps({ preferences: Object, saving: Boolean, disabled: Boolean })
const emit = defineEmits(['save'])
function change(preferences, key, value) { emit('save', { ...preferences, [key]: value }) }
</script>
<template>
  <details v-if="preferences" class="reference-settings">
    <summary>参考我的生活 <span>{{ [preferences.diary_enabled ? `日记 ${preferences.diary_days} 天` : '', preferences.todos_enabled ? '待办' : '', preferences.mirror_enabled ? '镜子' : ''].filter(Boolean).join(' / ') || '未开启' }}</span></summary>
    <fieldset :disabled="saving || disabled">
      <label><input type="checkbox" :checked="preferences.diary_enabled" @change="change(preferences, 'diary_enabled', $event.target.checked)" />已授权的日记</label>
      <label class="days">时间范围<select aria-label="日记时间范围" :value="preferences.diary_days" :disabled="!preferences.diary_enabled" @change="change(preferences, 'diary_days', Number($event.target.value))"><option :value="7">近 7 天</option><option :value="30">近 30 天</option><option :value="90">近 90 天</option></select></label>
      <label><input type="checkbox" :checked="preferences.todos_enabled" @change="change(preferences, 'todos_enabled', $event.target.checked)" />未完成待办</label>
      <label><input type="checkbox" :checked="preferences.mirror_enabled" @change="change(preferences, 'mirror_enabled', $event.target.checked)" />已有镜子总结</label>
    </fieldset>
    <p>{{ saving ? '正在保存偏好…' : '填写问题后才会参考所选资料；不开启也能解读。' }}</p>
  </details>
</template>
<style scoped>
.reference-settings{margin:20px 0;color:#c0d5f5;border-top:1px solid #91bdf94d;border-bottom:1px solid #91bdf94d;font-size:13px}.reference-settings summary{cursor:pointer;padding:14px 0;line-height:1.8}.reference-settings summary span{float:right;font-size:12px;color:#50edfa}.reference-settings fieldset{border:0;padding:4px 0 12px;display:grid;grid-template-columns:1fr 1fr;gap:15px}.reference-settings label{display:flex;align-items:center;gap:8px}.reference-settings input{accent-color:#50edfa;width:16px;height:16px}.reference-settings select{background:#0b2b67;color:white;padding:6px;border:1px solid #5282c0}.reference-settings p{font-size:12px;line-height:1.7;margin:0 0 12px}
</style>
