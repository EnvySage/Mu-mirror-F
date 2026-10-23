<script setup>
import { ref } from 'vue'
import TodoChainCard from '@/components/molecules/TodoChainCard.vue'
import { useChartMotion } from '@/motion/useChartMotion'
import { useSceneActivity } from '@/motion/useSceneActivity'
const props = defineProps({
  profile:{ type:Object, required:true }, evidence:{ type:Array, default:() => [] },
  chains:{ type:Array, default:() => [] }, loading:Boolean,
})
defineEmits(['open-record'])
const root = ref(null), learning = ref(null), tasks = ref(null), identity = ref(null)
const active = useSceneActivity(root)
useChartMotion(learning, () => JSON.stringify([props.profile.learning_analysis,props.evidence]))
useChartMotion(tasks, () => JSON.stringify([props.chains,props.loading]))
useChartMotion(identity, () => JSON.stringify([props.profile.user_tags,props.profile.rhythm_analysis]))
</script>

<template>
  <section ref="root" class="portrait-collage" :class="{ 'is-active':active }" aria-label="关于你的更多线索">
    <div class="collage-caption" aria-hidden="true"><span>FIELD NOTES / ABOUT YOU</span><i>↙</i></div>
    <article ref="learning" class="collage-learning">
      <span class="note-tape" aria-hidden="true" />
      <span class="note-ghost" aria-hidden="true">LEARN.</span>
      <header class="collage-head" data-chart-reveal><span class="collage-index">01 /</span><div><small>WORK IN PROGRESS</small><h3>学习进展</h3></div><span class="note-spark" aria-hidden="true">✳</span></header>
      <p class="note-prose" data-chart-reveal>{{ profile.learning_analysis || '还没有学习分析，写下今天学到的一点东西吧。' }}</p>
      <div v-if="evidence.length" class="note-sources">
        <div class="sources-heading" data-chart-reveal><span>来源</span> SOURCES <i aria-hidden="true">↗</i></div>
        <div v-for="(item,i) in evidence" :key="i" class="note-source" data-chart-reveal><b aria-hidden="true">{{ String(i+1).padStart(2,'0') }}</b><div><time>{{ item.date }}</time><p>{{ item.text }}</p></div></div>
      </div>
      <span class="note-footer" aria-hidden="true">ONE PAGE AT A TIME.</span>
    </article>

    <article ref="tasks" class="collage-tasks">
      <header class="collage-head" data-chart-reveal><span class="collage-index">02 /</span><div><small>TO BE CONTINUED</small><h3>未完成的事</h3></div><strong class="ticket-count">{{ loading && !chains.length ? '…' : String(chains.length).padStart(2,'0') }}</strong></header>
      <div class="ticket-list">
        <div v-for="(chain,i) in chains" :key="chain.todo_id ?? chain.todoId ?? chain.title" class="ticket-item" data-chart-reveal :style="{ '--ticket-tilt':(i % 2 ? 1.2 : -1.2) + 'deg' }">
          <span class="ticket-serial" aria-hidden="true">NEXT / {{ String(i+1).padStart(2,'0') }}</span>
          <TodoChainCard :chain="chain" @open-record="$emit('open-record',$event)" />
        </div>
        <p v-if="!chains.length && loading" class="ticket-empty" role="status">正在翻找未完成的计划…</p>
        <p v-else-if="!chains.length" class="ticket-empty"><b aria-hidden="true">ALL CLEAR ↗</b>没有挂起的待办，干得漂亮。</p>
      </div>
      <footer class="ticket-footer"><span aria-hidden="true">DON’T STOP HERE.</span><span>下一步，就从这里开始</span><i aria-hidden="true" /></footer>
    </article>

    <article ref="identity" class="collage-identity">
      <span class="identity-ghost" aria-hidden="true">I AM<br>STILL<br>BECOMING.</span>
      <header class="collage-head" data-chart-reveal><span class="collage-index">03 /</span><div><small>ME, IN A FEW WORDS</small><h3>个人标签</h3></div><span class="identity-star" aria-hidden="true">✦</span></header>
      <div v-if="profile.user_tags?.length" class="identity-tags" aria-label="个人标签">
        <span v-for="(tag,i) in profile.user_tags" :key="tag" class="identity-tag-wrap" data-chart-reveal><span class="identity-tag" :style="{ '--tag-tilt':[-5,3,-2,5][i % 4] + 'deg' }"><i aria-hidden="true">{{ ['↗','✦','//','★'][i % 4] }}</i>{{ tag }}</span></span>
      </div>
      <p v-else class="identity-empty" data-chart-reveal>标签将在画像生成后出现。</p>
      <p v-if="profile.rhythm_analysis" class="identity-prose" data-chart-reveal>{{ profile.rhythm_analysis }}</p>
      <span class="identity-stamp" aria-hidden="true">A LITTLE MORE YOU, EVERY DAY.</span>
    </article>
  </section>
</template>

<style scoped src="@/assets/styles/portrait-collage.css"></style>
