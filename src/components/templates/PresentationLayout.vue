<script setup>
defineProps({ mode: { type: String, required: true } })
</script>
<template><div :class="['presentation-layout', `presentation-layout--${mode}`]"><slot /></div></template>
<style scoped>
.presentation-layout { min-width:0; min-height:0; overflow:hidden; flex:1; display:flex; flex-direction:column; }
.presentation-layout--desktop :deep(.page) { width:100%; max-width:1440px; margin-inline:auto; }
.presentation-layout--mobile :deep(.page) { width:100%; max-width:none; margin-inline:0; }
</style>
