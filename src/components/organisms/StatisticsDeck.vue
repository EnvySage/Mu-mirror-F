<script setup>
import { ref } from 'vue'
import ActivityBand from '@/components/charts/ActivityBand.vue'
import RhythmDist from '@/components/charts/RhythmDist.vue'
import KeywordBars from '@/components/charts/KeywordBars.vue'
import TodoRing from '@/components/charts/TodoRing.vue'
import MoodMix from '@/components/charts/MoodMix.vue'
const props = defineProps({
  stats: { type:Object, required:true }, loading:Boolean,
  legend: { type:Array, default:() => [] }, summary:String, moodNote:String,
})
const activity = ref(null), rhythm = ref(null), todo = ref(null), keywords = ref(null), mood = ref(null)
function replay() { [activity, rhythm, todo, keywords, mood].forEach(chart => chart.value?.replay()) }
</script>

<template>
  <section class="statistics-deck" aria-labelledby="stats-mix-title">
    <header class="deck-heading">
      <div><span class="deck-kicker">SIDE B / YOUR LIFE IN MOTION</span><h2 id="stats-mix-title">生活<span>信号</span><i aria-hidden="true">✳</i></h2></div>
      <button type="button" class="deck-replay" aria-label="重播统计图动效" :disabled="loading" @click="replay"><span aria-hidden="true">↻</span> REPLAY THE MIX</button>
      <span class="deck-heading-rule" aria-hidden="true" />
    </header>

    <article class="deck-panel deck-activity">
      <header class="deck-panel-head"><span class="deck-number">01</span><div><small>DAILY TRACK</small><h3>生活留下的轨迹</h3></div><span class="deck-period">近 30 天</span></header>
      <ActivityBand v-if="!loading" ref="activity" :daily="stats.record_daily" :moods="stats.mood_daily" />
      <div v-else class="deck-loading loading-track" role="status" aria-label="活动统计加载中"><span>READING YOUR TRACK…</span></div>
      <div class="deck-legend"><span v-for="item in legend" :key="item.key"><i :style="{ background:item.color }" />{{ item.label }}</span><b v-if="summary">{{ summary }}</b></div>
      <p class="deck-caption">柱高 = 当日记录数 · 柱内按情绪占比分色 · 底线表示零记录</p>
    </article>

    <div class="deck-row deck-row-first">
      <article class="deck-panel deck-rhythm">
        <header class="deck-panel-head"><span class="deck-number">02</span><div><small>FIND YOUR TEMPO</small><h3>你的生活节奏</h3></div></header>
        <RhythmDist v-if="!loading" ref="rhythm" :hours="stats.hour_dist" :weekdays="stats.weekday_dist" />
        <div v-else class="deck-loading loading-rhythm" role="status" aria-label="节奏统计加载中"><span>TUNING IN…</span></div>
      </article>
      <article class="deck-panel deck-todo">
        <header class="deck-panel-head"><span class="deck-number">03</span><div><small>MISSION / PROGRESS</small><h3>那些完成的事</h3></div></header>
        <TodoRing v-if="!loading" ref="todo" :todo="stats.todo" />
        <div v-else class="deck-loading loading-ring" role="status" aria-label="待办统计加载中"><span>LOADING PROGRESS…</span></div>
        <span class="deck-corner" aria-hidden="true">STEP BY STEP.</span>
      </article>
    </div>

    <div class="deck-row deck-row-second">
      <article class="deck-panel deck-keywords">
        <header class="deck-panel-head"><span class="deck-number">04</span><div><small>HEAVY ROTATION / TOP 10</small><h3>反复出现的关注</h3></div></header>
        <KeywordBars v-if="!loading" ref="keywords" :data="stats.keyword_top" />
        <div v-else class="deck-loading loading-words" role="status" aria-label="关键词统计加载中"><span>FINDING YOUR WORDS…</span></div>
        <p class="deck-caption">条长 = 出现次数 · 最多展示 10 个关键词</p>
      </article>
      <article class="deck-panel deck-mood">
        <header class="deck-panel-head"><span class="deck-number">05</span><div><small>EMOTIONAL FREQUENCY</small><h3>最近的情绪底色</h3></div></header>
        <MoodMix v-if="!loading" ref="mood" :daily="stats.mood_daily" />
        <div v-else class="deck-loading loading-ring" role="status" aria-label="情绪统计加载中"><span>READING THE MOOD…</span></div>
        <p class="deck-caption">近 30 天 · 按情绪出现次数</p>
        <p v-if="moodNote" class="deck-mood-note">{{ moodNote }}</p>
      </article>
    </div>
    <div class="deck-outro" aria-hidden="true"><span>EVERY LITTLE THING COUNTS.</span><b>↗</b></div>
  </section>
</template>

<style scoped src="@/assets/styles/statistics-deck.css"></style>
