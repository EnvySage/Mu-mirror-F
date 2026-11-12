<script setup>
import { useMirrorView } from '@/composables/useMirrorView'
const { SnapshotReader, TarotEntry, ref, StatisticsDeck, PortraitCollage, SelectMenu, PageMasthead, MirrorStage, mirror, statsStore, todoStore, ui, mirrorStage, preparingGeneration, mirrorBusy, reloadMirror, mirrorName, openTodoCount, stats, justSettled, moodSegments, learningEvidence, chains, openTodoRecord, moodLegend, freqSummary, statsFirstLoad, statsUnavailable, shortDateTime, timeline, TIMELINE_RETENTION, timelineNote, onViewSnapshot, snapshotReadSource, onBackToLatest, compareMode, compareAId, compareBId, toggleCompare, compareA, compareB, compareLoading, driftDelta, driftDeltaLabel, driftDeltaTier, compareReady, compareAOptions, compareBOptions, onGenerate, ghostMonth, monthLabel, invalidationReasonText, ghostMonthOptions, confirmingMonth, cancelMonthConfirmButton, requestMonthGeneration, closeMonthConfirmation, onGenerateMonthly, confirmMonthGeneration } = useMirrorView()
</script>

<template>
  <div class="page mirror-page">
  <div class="page-content">
  <PageMasthead title="我的镜子" english="MY REFLECTION" description="回望记录，看见这段时间的自己">
  <span class="period-caption">近 30 天</span>
  <button class="p3-button" :disabled="mirrorBusy || mirror.loading" @click="onGenerate">{{ preparingGeneration || mirror.generating ? '正在显影…' : '生成新快照' }}<span aria-hidden="true">↗</span></button>
  </PageMasthead>
  <TarotEntry />
  <MirrorStage
  ref="mirrorStage" :profile="mirror.profile" :nodes="timeline" :current-id="mirror.currentSnapshotId"
  :busy="mirrorBusy || mirror.loading"
  :metrics="[
  { value: statsUnavailable ? '—' : stats[0].display, label: '次记录' },
  { value: statsUnavailable ? '—' : stats[1].display, label: '个活跃日' },
  { value: statsUnavailable ? '—' : statsStore.todo.completed, label: '件已完成' },
  ]"
  @select="onViewSnapshot" @write="ui.openWriteModal()"
  />
  <div class="reflection-status" aria-label="近期状态概览">
  <div><span>最近的情绪</span><strong>{{ statsFirstLoad ? '正在读取…' : statsUnavailable ? '暂不可用' : moodSegments[0]?.label || '等待记录' }}</strong><i :style="{ background: moodSegments[0]?.color || 'var(--cyan)' }" /></div>
  <div><span>经常关注</span><strong>{{ statsUnavailable ? '暂不可用' : statsStore.keyword_top[0]?.keyword || '从下一条记录开始' }}</strong></div>
  <div><span>仍在推进</span><strong>{{ statsUnavailable ? '—' : openTodoCount }} <small>件待办</small></strong></div>
  </div>
  <div v-if="statsStore.error" class="stats-error" role="alert"><span>近期统计暂时无法加载</span><button class="p3-link" @click="statsStore.fetchStats(30, true)">重试</button></div>
  <div v-if="mirror.error && !mirror.profile" class="mirror-error" role="alert"><p>{{ mirror.error }}</p><button class="p3-button secondary" @click="reloadMirror">重新加载快照</button></div>

  <div v-else-if="mirror.generating" class="processing-view">
  <div class="processing-ring" />
  <div class="processing-title">正在生成画像快照</div>
  <div class="processing-desc">正在整理你的经历、成长和近期状态，请稍等片刻。</div>
  </div>

  <div v-else-if="mirror.isEmpty && (mirror.loading || mirror.snapshots === null || mirror.snapshotsLoading)" class="processing-view" role="status">
  <div class="processing-ring" />
  <div class="processing-title">正在读取镜子归档</div>
  <div class="processing-desc">检查是否有可查阅的历史快照</div>
  </div>

  <div v-else-if="mirror.isEmpty && mirror.error" class="empty-state" style="padding:70px 20px">
  <div class="empty-title">暂时无法打开镜子归档</div>
  <div class="empty-desc">{{ mirror.error }}</div>
  <button class="mirror-generate" style="max-width:260px;margin:20px auto 0" @click="mirror.fetchSnapshots">
  重试读取归档
  </button>
  </div>


  <div v-else-if="mirror.isEmpty" class="empty-state" style="padding:70px 20px">
  <div class="empty-icon">
  <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 8v4l2.5 2.5"/></svg>
  </div>
  <div class="empty-title">还没有画像快照</div>
  <div class="empty-desc">写满几条记录后，让 AI 为你生成第一份画像</div>
  <button class="mirror-generate" style="max-width:260px;margin:20px auto 0" @click="onGenerate">
  <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8"><path d="M12 5v14M5 12h14"/></svg>
  生成画像快照
  </button>
  </div>

  <template v-else-if="mirror.profile">

  <div class="portrait-section card timeline-card">

  <div class="timeline-head">
  <span class="section-label">快照时间线</span>
  <span class="chart-head-note" :title="timeline.length ? TIMELINE_RETENTION : null">{{ timelineNote }}</span>
  <div v-if="timeline.length >= 2" class="timeline-actions">
  <button type="button" :class="['compare-toggle', { on: compareMode }]" @click="toggleCompare">
  <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8"><path d="M8 3v18M16 3v18M3 8h10M11 16h10"/></svg>
  {{ compareMode ? '退出对比' : '对比两份快照' }}
  </button>
  <span v-if="!compareMode" class="compare-hint">看看两个阶段的自己有什么不同</span>
  </div>
  </div>
  <div v-if="mirror.snapshotsError && !timeline.length" class="snapshot-history-error" role="alert"><span>快照历史暂时无法加载</span><button @click="mirror.fetchSnapshots()">重试快照历史</button></div>
  <div v-else-if="mirror.snapshotsLoading && !timeline.length" class="portrait-text">正在读取历史快照…</div>
  <div v-else-if="timeline.length" class="snapshot-current-note">
  <span>正在查看</span><strong>{{ timeline.find(node => node.viewing)?.label || '最新画像' }}</strong>
  <small>在上方卡组中挑选其他时刻</small>
  </div>
  <div v-else-if="mirror.snapshotsError" class="timeline-load-error" role="status">
  <span>{{ mirror.snapshotsError }}</span>
  <button type="button" @click="mirror.fetchSnapshots()">重试</button>
  </div>
  <div v-else-if="!mirror.snapshotsLoading" class="portrait-text">暂无历史快照，生成第一份画像后这里会出现时间线。</div>

  <div v-if="mirror.snapshotsHasMore || mirror.snapshotsLoadingMore || mirror.snapshotsError" class="timeline-more">
  <span v-if="mirror.snapshotsError" class="timeline-more-error" role="status">{{ mirror.snapshotsError }}</span>
  <button
  type="button"
  class="timeline-more-btn"
  :disabled="mirror.snapshotsLoadingMore"
  @click="mirror.snapshotsHasMore ? mirror.fetchMoreSnapshots() : mirror.fetchSnapshots()"
  >
  {{ mirror.snapshotsLoadingMore ? '正在载入…' : mirror.snapshotsError ? '重试加载' : '加载更早镜子' }}
  </button>
  </div>


  <div v-if="mirror.generatableMonths.length" class="ghost-card">
  <div class="ghost-head">
  <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
  为历史月份生成镜子
  </div>
  <div class="ghost-actions">
  <SelectMenu
  v-model="ghostMonth"
  class="ghost-select"
  :options="ghostMonthOptions"
  size="sm"
  :block="false"
  aria-label="选择要生成月度画像的月份"
  />
  <button type="button" class="ghost-btn" :disabled="mirrorBusy || !ghostMonth" @click="onGenerateMonthly">
  <svg v-if="!mirror.generatingMonthly" viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
  {{ mirror.generatingMonthly ? '照镜中…' : '新建版本' }}
  </button>
  </div>
  <div v-if="mirror.snapshotMonthsError" class="ghost-loading" role="status">{{ mirror.snapshotMonthsError }} <button type="button" @click="mirror.fetchSnapshotMonths()">重试</button></div>
  <div v-else-if="mirror.generatingMonthly" class="ghost-loading">正在生成新镜子…</div>
  </div>
  <div v-else-if="mirror.snapshotMonthsLoading" class="timeline-idle" role="status">正在查找可生成的历史月份…</div>
  <div v-else-if="mirror.snapshotMonthsError" class="timeline-idle" role="status">
  {{ mirror.snapshotMonthsError }} <button type="button" @click="mirror.fetchSnapshotMonths()">重试</button>
  </div>
  <p v-else-if="timeline.length" class="timeline-idle">暂无可生成的历史月份</p>
  </div>


  <div v-if="compareMode" class="portrait-section card compare-card">
  <div class="chart-head" style="margin-bottom:12px">
  <span class="section-label">阶段对比</span>
  <span v-if="driftDelta !== null" :class="['delta-chip', `tier-${driftDeltaTier}`]">
  Δ 漂移 {{ driftDelta.toFixed(3) }} · {{ driftDeltaLabel }}
  </span>
  <span v-else-if="compareReady" class="chart-head-note">两份快照均无漂移基线，Δ 不可比</span>
  </div>


  <div class="compare-pickers">
  <label class="compare-picker">
  <span class="compare-picker-label">基准 A</span>
  <SelectMenu
  v-model="compareAId"
  class="compare-select"
  :options="compareAOptions"
  size="sm"
  :block="false"
  aria-label="对比基准 A"
  />
  </label>
  <span class="compare-vs">vs</span>
  <label class="compare-picker">
  <span class="compare-picker-label">对比 B</span>
  <SelectMenu
  v-model="compareBId"
  class="compare-select"
  :options="compareBOptions"
  size="sm"
  :block="false"
  aria-label="对比对象 B"
  />
  </label>
  </div>

  <div v-if="compareLoading && !compareReady" class="compare-loading">正在加载两份快照…</div>

  <template v-else-if="compareReady">

  <div class="compare-grid compare-overall">
  <div class="compare-col">
  <div class="compare-col-head">
  <span class="compare-col-title">A · {{ shortDateTime(compareA.created_at) }}</span>
  <span :class="['snapshot-type-badge', `badge-${compareA.snapshot_type === 'monthly' ? 'monthly' : 'manual'}`]">
  {{ compareA.snapshot_type === 'monthly' ? '月度' : '手动' }}
  </span>
  </div>
  <div class="compare-text">{{ compareA.overall_summary || '暂无总体总结' }}</div>
  </div>
  <div class="compare-col">
  <div class="compare-col-head">
  <span class="compare-col-title">B · {{ shortDateTime(compareB.created_at) }}</span>
  <span :class="['snapshot-type-badge', `badge-${compareB.snapshot_type === 'monthly' ? 'monthly' : 'manual'}`]">
  {{ compareB.snapshot_type === 'monthly' ? '月度' : '手动' }}
  </span>
  </div>
  <div class="compare-text">{{ compareB.overall_summary || '暂无总体总结' }}</div>
  </div>
  </div>


  <div class="compare-grid compare-dims">
  <div v-for="dim in [
  { key: 'mood', label: '情绪维度', field: 'mood_analysis' },
  { key: 'learning', label: '学习维度', field: 'learning_analysis' },
  { key: 'todo', label: '待办维度', field: 'todo_analysis' },
  { key: 'rhythm', label: '节奏维度', field: 'rhythm_analysis' },
  ]" :key="dim.key" class="compare-dim-row">
  <div class="compare-dim-label">{{ dim.label }}</div>
  <div class="compare-dim-cells">
  <div class="compare-text dim">{{ compareA[dim.field] || '暂无分析' }}</div>
  <div class="compare-text dim">{{ compareB[dim.field] || '暂无分析' }}</div>
  </div>
  </div>
  <div class="compare-dim-row">
  <div class="compare-dim-label">个人标签</div>
  <div class="compare-dim-cells">
  <div class="compare-tags">
  <span v-for="tag in (compareA.user_tags || [])" :key="'a' + tag" class="user-tag sm">{{ tag }}</span>
  <span v-if="!(compareA.user_tags || []).length" class="compare-text dim">暂无标签</span>
  </div>
  <div class="compare-tags">
  <span v-for="tag in (compareB.user_tags || [])" :key="'b' + tag" class="user-tag sm">{{ tag }}</span>
  <span v-if="!(compareB.user_tags || []).length" class="compare-text dim">暂无标签</span>
  </div>
  </div>
  </div>
  </div>


  <div class="compare-drift-row">
  <div class="compare-drift-cell">
  <span class="compare-drift-num">{{
  compareA.drift_distance !== null && compareA.drift_distance !== undefined
  ? compareA.drift_distance.toFixed(3) : '—'
  }}</span>
  <span class="compare-drift-cap">A 漂移距离（vs 上一份月度）</span>
  </div>
  <div :class="['compare-drift-cell', 'delta-main', driftDeltaTier ? `tier-${driftDeltaTier}` : '']">
  <span class="compare-drift-num">{{
  driftDelta !== null ? `Δ ${driftDelta.toFixed(3)}` : 'Δ —'
  }}</span>
  <span class="compare-drift-cap">{{ driftDelta !== null ? driftDeltaLabel : '两份均无漂移基线' }}</span>
  </div>
  <div class="compare-drift-cell">
  <span class="compare-drift-num">{{
  compareB.drift_distance !== null && compareB.drift_distance !== undefined
  ? compareB.drift_distance.toFixed(3) : '—'
  }}</span>
  <span class="compare-drift-cap">B 漂移距离（vs 上一份月度）</span>
  </div>
  </div>
  </template>
  </div>


  <div :class="['mirror-hero', 'card', { settled: justSettled }]">
  <div class="mirror-hero-inner">
  <div class="mirror-hero-main">
  <div class="mirror-greeting">从你的记录中，看到这些变化</div>
  <div class="mirror-name">{{ mirrorName }}</div>
  <div v-if="!mirror.isEmpty" class="mirror-viewing-line">
  正在查看：{{ shortDateTime(mirror.profile.created_at) }}
  <span :class="['snapshot-type-badge', `badge-${mirror.profile.snapshot_type === 'monthly' ? 'monthly' : 'manual'}`]">
  {{ mirror.profile.snapshot_type === 'monthly' ? '月度快照' : '手动快照' }}
  </span>
  <button
  v-if="timeline.length && !timeline[0].viewing"
  type="button"
  class="back-latest-btn"
  @click="onBackToLatest"
  >回到最新</button>
  </div>
  <div v-if="mirror.profile.context_status === 'archive_only' || mirror.profile.archive_discontinuity" class="mirror-archive-note" role="status">
  <strong>{{ mirror.profile.context_status === 'archive_only' ? '仅作归档' : '历史断点' }}</strong>
  <span v-if="mirror.profile.context_status === 'archive_only'">这份镜子仍可查看，不会用于后续镜子的生成。</span>
  <span v-if="mirror.profile.archive_discontinuity">更早的部分来源已无法完整重建，累计历史从这里存在断点。</span>
  <span v-if="mirror.profile.context_status === 'archive_only'">{{ invalidationReasonText(mirror.profile.invalidated_reason) }}</span>
  <span v-if="mirror.profile.deleted_source_count > 0" class="deleted-source-note">
  原始记录已删除（{{ mirror.profile.deleted_source_count }} 条）
  </span>
  </div>
  <div v-if="mirror.drift" class="mirror-drift">
  <svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/></svg>
  较上月漂移 Δ {{ mirror.profile.drift_distance }} · {{ mirror.drift.level }}
  </div>
  <div class="mirror-overall">{{ mirror.profile.overall_summary || '还没有总体总结，先去写几条记录吧。' }}</div>
  <SnapshotReader :profile="mirror.profile" :source="snapshotReadSource" />
  <button class="mirror-generate" :disabled="mirrorBusy" @click="onGenerate">
  <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8"><path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6"/></svg>
  {{ mirror.generating ? '生成中…' : '更新这一刻的快照' }}
  </button>
  <button
  v-if="mirror.profile.snapshot_type === 'monthly' && mirror.profile.period_month && mirror.profile.context_status === 'usable' && mirror.profile.is_current"
  type="button"
  class="mirror-regenerate-month"
  :disabled="mirrorBusy"
  @click="requestMonthGeneration(mirror.profile.period_month, $event)"
  >
  为 {{ monthLabel(mirror.profile.period_month) }} 新建版本
  </button>
  </div>

  </div>
  </div>

  <StatisticsDeck
  :stats="statsStore" :loading="statsFirstLoad"
  :legend="moodLegend" :summary="freqSummary" :mood-note="mirror.profile.mood_analysis"
  />

  <PortraitCollage
  :profile="mirror.profile" :evidence="learningEvidence" :chains="chains"
  :loading="todoStore.chainsLoading" @open-record="openTodoRecord"
  />
  </template>
  </div>
  <Teleport to="body">
  <div
  v-if="confirmingMonth"
  class="month-confirm-scrim"
  @click.self="closeMonthConfirmation"
  @keydown.esc.stop.prevent="closeMonthConfirmation"
  >
  <section class="month-confirm-panel" role="dialog" aria-modal="true" aria-labelledby="month-confirm-title">
  <div class="month-confirm-mark" aria-hidden="true">↻</div>
  <div class="month-confirm-copy">
  <h2 id="month-confirm-title">为 {{ monthLabel(confirmingMonth) }} 新建镜子？</h2>
  <p>若这个月已有版本，旧版会完整保留在归档中；新结果将成为该月当前镜子。</p>
  <p>已删除或取消授权的原始内容不会重新进入这次生成。</p>
  </div>
  <div class="month-confirm-actions">
  <button ref="cancelMonthConfirmButton" type="button" class="month-confirm-cancel" @click="closeMonthConfirmation">
  再看看
  </button>
  <button type="button" class="month-confirm-accept" @click="confirmMonthGeneration">确认生成</button>
  </div>
  </section>
  </div>
  </Teleport>
  </div>
</template>

<style scoped src="@/assets/styles/mirror-view.css"></style>
<style scoped src="@/assets/styles/mirror-view-2.css"></style>
