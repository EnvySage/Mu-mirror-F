<script setup>
defineProps({
  message: { type: Object, required: true },
})
</script>

<template>
  <div :class="['chat-msg', message.role === 'user' ? 'chat-msg-user' : 'chat-msg-ai']">
    <div class="chat-msg-bubble">
      {{ message.content }}
      <div v-if="message.sources" class="chat-msg-sources">
        <span class="chat-source-link">{{ message.sources }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chat-msg { margin-bottom: 10px; animation: msgIn 0.25s ease; }
@keyframes msgIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
.chat-msg-user { display: flex; justify-content: flex-end; }
.chat-msg-bubble { max-width: 75%; padding: 10px 14px; font-size: 13px; line-height: 1.5; }
.chat-msg-user .chat-msg-bubble { background: var(--accent); color: #fff; border-radius: 16px 16px 4px 16px; }
.chat-msg-ai .chat-msg-bubble { background: var(--surface); color: var(--text-primary); border: 0.5px solid var(--border); border-radius: 16px 16px 16px 4px; }
.chat-msg-sources { margin-top: 6px; padding-top: 6px; border-top: 0.5px solid var(--border); font-size: 10px; color: var(--text-tertiary); }
.chat-source-link { color: var(--accent); cursor: pointer; }

@media (min-width: 900px) {
  .chat-msg-bubble { font-size: 14px; padding: 12px 16px; max-width: 70%; }
}
</style>
