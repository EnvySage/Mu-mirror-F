<script setup>
import { provide, ref } from 'vue'
import LoginEntrance from '@/components/organisms/LoginEntrance.vue'
import { loginEntranceKey } from '@/motion/loginEntrance'

const scene = ref(null)
const entrance = ref(null)
const entering = ref(false)
provide(loginEntranceKey, navigate => entrance.value ? entrance.value.enter(navigate) : navigate())
</script>

<template>
  <div ref="scene" class="app-scene" :inert="entering"><RouterView /></div>
  <LoginEntrance ref="entrance" :scene="scene" @active="entering = $event" />
</template>

<style>
.app-scene { height:100dvh; overflow:hidden; }
</style>
