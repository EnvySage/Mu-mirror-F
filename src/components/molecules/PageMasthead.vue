<script setup>
defineProps({ title: String, english: String, description: String })
</script>
<template>
  <header class="masthead">
    <div class="masthead-titles"><span class="masthead-en" aria-hidden="true">{{ english }}</span><div class="masthead-copy"><h1>{{ title }}</h1><p v-if="description">{{ description }}</p></div></div>
    <div v-if="$slots.default" class="masthead-actions"><slot /></div>
  </header>
</template>
<style scoped>
.masthead { display: flex; justify-content: space-between; align-items: center; gap: 20px; padding: 24px 0 22px; color: white; }
.masthead-titles { display: flex; align-items: center; gap: 22px; min-width: 0; }
.masthead-en { font: italic 900 clamp(40px, 4.6vw, 76px)/.9 var(--font-display); letter-spacing: -.025em; white-space: nowrap; }
.masthead-copy { padding-left: 20px; border-left: 2px solid var(--cyan); }
h1 { font-size: 17px; font-weight: 800; white-space: nowrap; }
p { margin-top: 3px; font-size: 11px; color: var(--on-dark); }
.masthead-actions { display: flex; align-items: center; gap: 12px; flex-shrink: 0; }
@media (max-width: 1100px) { .masthead-copy { display: none; } }
@media (max-width: 599px) { .masthead { padding: 22px 0 18px; gap: 10px; flex-wrap: wrap; } .masthead-en { font-size: 47px; } .masthead-actions { gap: 8px; } }
</style>
