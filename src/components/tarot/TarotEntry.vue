<template>
  <RouterLink class="tarot-entry" :to="{ name: 'tarot' }"><span aria-hidden="true">✦</span><div><strong>给今天，翻一张牌。</strong><small>每日运势 / 问一问 / 收藏册</small></div><b aria-hidden="true">↗</b></RouterLink>
</template>
<style scoped>
.tarot-entry{display:flex;align-items:center;gap:16px;padding:18px 22px;margin:18px 0 28px;background:#0737bb;color:white;border-left:5px solid #50edfa;clip-path:polygon(0 8%,100% 0,98% 92%,0 100%)}.tarot-entry>span{font-size:44px;color:#50edfa}.tarot-entry strong{font-size:19px}.tarot-entry small{display:block;font-size:11px;color:#bed5fa;margin-top:4px}.tarot-entry>b{margin-left:auto;font-size:28px}.tarot-entry:focus-visible{outline:3px solid white;outline-offset:4px}
</style>
