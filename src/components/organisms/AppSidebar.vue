<script setup>
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useUIStore } from '@/stores/ui'
import { useAuthStore } from '@/stores/auth'
import { useGlossaryStore } from '@/stores/glossary'
import { usePresentationMode } from '@/composables/usePresentationMode'
const router = useRouter(), route = useRoute(), ui = useUIStore(), auth = useAuthStore(), glossary = useGlossaryStore()
const presentation = usePresentationMode()
const activePage = computed(() => route.name)
const today = new Date()
const dateLabel = new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit' }).format(today)
const weekday = new Intl.DateTimeFormat('en', { timeZone: 'Asia/Shanghai', weekday: 'short' }).format(today)
const nav = [
 { page:'records', label:'日常记录', en:'RECORDS', path:'M4 5h16M4 12h16M4 19h10' },
 { page:'calendar', label:'时间日历', en:'CALENDAR', path:'M8 2v5M16 2v5M3 10h18M4 5h16v16H4z' },
 { page:'mirror', label:'我的镜子', en:'MIRROR', path:'M12 3a8 8 0 1 0 0 16 8 8 0 0 0 0-16ZM12 19v3M8 22h8M8 10l3-3' },
 { page:'chat', label:'与我对话', en:'DIALOGUE', path:'M4 4h16v13H9l-5 4V4zM8 9h8M8 13h5' },
 { page:'vault', label:'记忆资产', en:'ARCHIVE', path:'M3 4h18v5H3zM5 9v12h14V9M9 13h6' },
]
const projects = [{ label:'MU聊',url:'http://112.74.94.42:90/' },{ label:'XS Blog',url:'https://envysage.github.io/XS-Blog/' },{ label:'暮云音乐',url:'http://112.74.94.42/' }]
function switchPage(page) {
 if (!ui.confirmNavigationDrafts()) return
 ui.approveNavigation(router.resolve({ name: page }).fullPath)
 if (page === 'records') ui.sidebarSelectedDate = null
 ui.switchPage(page, true)
 router.push({ name: page })
}
</script>
<template>
 <aside class="sidebar" aria-label="主导航">
  <a class="brand" href="/records" @click.prevent="switchPage('records')"><span class="brand-mark">M<span> / </span></span><span class="brand-name">MIRROR<small>记录，让自己显影</small></span></a>
  <div class="sidebar-date"><strong>{{ dateLabel.replace('/', '.') }}</strong><span>{{ weekday }}<i>今天也值得被记住</i></span></div>
  <nav class="sidebar-nav" :style="{ '--nav-index': Math.max(0, nav.findIndex(item => item.page === activePage)) }">
   <div class="nav-track" :class="{ hidden: !nav.some(item => item.page === activePage) }" aria-hidden="true" />
   <button v-for="item in nav" :key="item.page" :class="['nav-row',{active:activePage===item.page}]" :aria-current="activePage===item.page?'page':undefined" @click="switchPage(item.page)">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path :d="item.path" /></svg>
    <span><b>{{ item.en }}</b><small>{{ item.label }}</small></span><span v-if="activePage===item.page" class="nav-arrow" aria-hidden="true">◀</span>
   </button>
  </nav>
  <button class="sidebar-write" @click="ui.openWriteModal()"><span aria-hidden="true">＋</span> 写下此刻 <small>NEW RECORD</small></button>
  <div class="sidebar-bottom">
   <button :class="['settings-row',{active:activePage==='settings'}]" @click="switchPage('settings')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 7h16M4 17h16M9 4v6M15 14v6"/></svg>设置<span v-if="glossary.pendingCount" class="pending">{{ glossary.pendingCount }}</span></button>
   <button class="presentation-mode-button" @click="presentation.requestMode('mobile')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="7" y="2" width="10" height="20" rx="1.5"/><path d="M10 5h4M11 19h2"/></svg>手机布局</button>
   <div class="user-row"><div class="user-avatar">{{ (auth.user?.username || 'M').slice(0,1).toUpperCase() }}</div><div><strong>{{ auth.user?.username || 'Mirror' }}</strong><span>属于你的生活存档</span></div><span class="online-dot" title="已登录" /></div>
   <a class="author" href="https://github.com/EnvySage" target="_blank" rel="noopener noreferrer">Made by EnvySage <span>↗</span></a>
   <div class="projects"><a v-for="p in projects" :key="p.label" :href="p.url" target="_blank" rel="noopener noreferrer">{{ p.label }}</a></div>
  </div>
 </aside>
</template>
<style scoped>
.sidebar { display:none; flex:0 0 var(--sidebar-width); width:var(--sidebar-width); min-height:0; flex-direction:column; padding:30px 18px 18px; background:#040d30f2; border-right:1px solid #5580cf38; color:white; overflow-y:auto; }
@media(min-width:900px){.sidebar{display:flex}}
.brand{display:flex;gap:9px;align-items:center;padding:0 6px;color:white}.brand-mark{font:italic 900 48px/.8 var(--font-display);letter-spacing:-8px;color:var(--cyan)}.brand-mark span{color:white;font-size:39px}.brand-name{font:italic 900 31px/.85 var(--font-display);letter-spacing:-.04em}.brand-name small{display:block;font:10px/1.5 var(--font);letter-spacing:.08em;color:#9db7e5;margin-top:7px}
.sidebar-date{margin:36px 6px 28px;display:flex;gap:12px;align-items:center}.sidebar-date strong{font:italic 700 43px/1 var(--font-display);letter-spacing:-.04em}.sidebar-date>span{font:700 17px/1.3 var(--font-display);color:var(--cyan);text-transform:uppercase}.sidebar-date i{display:block;font:normal 9px/1.8 var(--font);color:#8ba5cf}
.sidebar-nav{display:flex;flex-direction:column;gap:9px}.nav-row{position:relative;display:flex;align-items:center;gap:13px;width:100%;min-height:64px;padding:10px 15px;text-align:left;color:#91b0e2;isolation:isolate;transition:color .18s,transform .18s}.nav-row::before{content:'';position:absolute;inset:0;z-index:-1;background:transparent;transform:skewY(-3deg);border-left:3px solid transparent}.nav-row svg{width:20px;height:20px;flex-shrink:0}.nav-row b{display:block;font:italic 800 24px/.95 var(--font-display);letter-spacing:.015em}.nav-row small{display:block;font-size:10px;margin-top:5px}.nav-row:hover{color:white;transform:translateX(3px)}.nav-row.active{color:var(--night)}.nav-row.active::before{background:var(--cyan);border-left-color:white;box-shadow:4px 4px 0 var(--electric)}.nav-arrow{margin-left:auto;font-size:11px}
.sidebar-write{margin:28px 6px 16px;padding:11px 10px;background:white;color:var(--night);font-size:13px;font-weight:800;transform:skew(-7deg);box-shadow:4px 4px 0 var(--pink)}.sidebar-write>span{font-size:18px;margin-right:5px}.sidebar-write small{display:block;font:italic 700 11px var(--font-display);letter-spacing:.08em;margin-left:15px}
.sidebar-bottom{margin-top:auto;padding:22px 6px 0}.settings-row{display:flex;align-items:center;gap:10px;color:#a7bfe7;font-size:12px;width:100%;padding:8px 0 18px}.settings-row svg{width:19px;height:19px}.settings-row.active{color:var(--cyan)}.pending{margin-left:auto;background:var(--pink);color:white;padding:0 5px}
.presentation-mode-button { display:flex; align-items:center; gap:10px; width:100%; padding:8px 0 14px; color:#a7bfe7; font-size:12px; }
.presentation-mode-button svg { width:19px; height:19px; }
.user-row{border-top:1px solid #5275b43d;padding:19px 0 16px;display:flex;gap:9px;align-items:center}.user-avatar{width:32px;height:35px;display:grid;place-items:center;background:#143570;color:var(--cyan);font:italic 800 23px var(--font-display);clip-path:polygon(0 0,100% 0,100% 83%,75% 100%,0 100%)}.user-row strong{display:block;font-size:12px}.user-row span{display:block;color:#809cc7;font-size:9px}.user-row .online-dot{margin-left:auto;width:5px;height:5px;background:var(--cyan);border-radius:50%}.author{display:flex;justify-content:space-between;color:#91aad3;font:12px var(--font-display)}.projects{display:flex;gap:12px;margin-top:11px}.projects a{color:#7794c1;font-size:9px}
@media(max-height:820px){.sidebar{padding-top:24px}.sidebar-date{margin:28px 6px 18px}.nav-row{min-height:56px}.sidebar-write{margin-top:22px}.sidebar-bottom{padding-top:8px}}
.sidebar-nav { position:relative; --nav-row-height:64px; }
.nav-row { height:var(--nav-row-height); min-height:var(--nav-row-height); z-index:1; }
.nav-track { position:absolute; left:0; right:0; top:0; height:var(--nav-row-height); background:var(--cyan); border-left:3px solid white; box-shadow:4px 4px 0 var(--electric); transform:translateY(calc(var(--nav-index) * (var(--nav-row-height) + 9px))) skewY(-3deg); transition:transform .32s cubic-bezier(.2,.85,.2,1.12),opacity .18s; pointer-events:none; }
.nav-track.hidden { opacity:0; }
.nav-row.active::before { background:none; border-color:transparent; box-shadow:none; }
.nav-row.active b { animation:nav-type-cut .32s cubic-bezier(.16,1,.3,1); }
@keyframes nav-type-cut { from { transform:translateX(14px); clip-path:inset(0 100% 0 0); } to { transform:none; clip-path:inset(0); } }
@media(max-height:820px){.sidebar-nav{--nav-row-height:56px}}
</style>
