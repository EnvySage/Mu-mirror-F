<template>
 <main class="auth-layout">
  <section class="auth-illustration" aria-label="Mirror，记录让自己显影">
   <a href="/" class="auth-brand">MIRROR<span>记录，让自己显影</span></a>
   <div class="auth-art-type" aria-hidden="true">EVERY DAY.<br>ANOTHER<br>YOU.</div>
   <div class="auth-art-ring" aria-hidden="true" />
   <div class="auth-art-copy"><h2>写下日常，<br>回看成长。</h2><p>把那些平凡的瞬间，拼成越来越清晰的自己。</p></div>
  </section>
  <div class="auth-container"><router-view /></div>
 </main>
</template>
<style scoped>
.auth-layout { height:100dvh; overflow-y:auto; display:grid; grid-template-columns:minmax(0,1.15fr) minmax(0,1fr); background:var(--night); }
.auth-illustration { position:relative; min-height:100dvh; overflow:hidden; isolation:isolate; background:#0b3ca5 url('/art/water-surface.webp') center / cover; }
.auth-illustration::after { content:''; position:absolute; inset:0; z-index:-1; background:linear-gradient(0deg,#06123fdd,transparent 75%); }
.auth-brand { position:absolute; z-index:2; top:38px; left:42px; font:italic 800 37px/.9 var(--font-display); color:white; }.auth-brand span{display:block;font:10px var(--font);color:#beeaff;margin-top:8px;letter-spacing:.1em}
.auth-art-type { position:absolute; top:25%; left:36px; z-index:-1; font:italic 800 clamp(70px,8.5vw,140px)/.83 var(--font-display); color:#b3f4ff; letter-spacing:-.03em; }
.auth-art-ring { position:absolute; z-index:-1; width:500px;height:600px;border:55px solid #ddffff80;border-radius:50%;right:-220px;top:20px;transform:rotate(-23deg); }

.auth-art-copy { position:absolute; z-index:2; left:42px; bottom:72px; right:24px; color:white; }.auth-art-copy h2{font-size:34px;font-weight:900;line-height:1.4;letter-spacing:-.04em;text-shadow:2px 2px 0 #0a2b80}.auth-art-copy p{font-size:11px;color:#c2e4ff;margin-top:14px}

.auth-container { display:flex; align-items:center; justify-content:center; padding:48px clamp(28px,5vw,80px); width:100%; min-width:0; }
@media(max-width:899px){.auth-layout{display:block}.auth-illustration{min-height:210px;height:210px}.auth-brand{top:22px;left:24px;font-size:28px}.auth-brand span{font-size:9px}.auth-art-type{font-size:57px;top:81px;left:22px;line-height:.82}.auth-art-copy{display:none}.auth-art-ring{width:320px;height:320px;border-width:28px;top:-100px;right:-140px}.auth-container{padding:28px 24px 40px}}
</style>
