<script setup>
import { computed, useId } from 'vue'

const props = defineProps({ medal: { type: Object, required: true }, concealed: Boolean, eager: Boolean, preview: Boolean, finish: { type: String, default: null } })
const id = useId()
const frames = {
  gear: '104,6 140,23 157,23 191,53 191,69 201,79 201,145 178,168 163,168 104,202 45,168 30,168 7,145 7,79 17,69 17,53 51,23 68,23',
  kite: '104,6 200,93 183,121 197,147 155,162 104,202 53,162 11,147 25,121 8,93',
  cut: '76,10 138,7 194,42 187,62 201,78 197,149 164,177 133,176 104,201 57,179 50,164 14,151 9,68 31,34',
  vault: '104,8 176,30 195,60 195,143 176,169 104,200 32,169 13,143 13,60 32,30',
  shield: '104,8 153,24 181,22 197,55 186,127 176,160 104,200 32,160 22,127 11,55 27,22 55,24',
  star: '104,5 130,30 166,21 169,55 201,77 188,105 201,134 165,155 161,180 130,176 104,202 78,176 47,180 43,155 7,134 20,105 7,77 39,55 42,21 78,30',
}
const motifs = {
  signal: 'M23 11h50v55H23zM33 54l31-32M41 57l21-21M40 67l-6 10h28l-6-10M23 32H9m64 0h14M23 51H9m64 0h14',
  core: 'm48 7 34 18v34L48 79 14 59V25zM48 7v35m34-17L48 42 14 25m34 17v37M28 34l20-12 20 12v20L48 65 28 54z',
  dual: 'M14 17h28v44H14zM54 28h28v44H54zM10 39h8l6-10 7 20 6-10h22l5-9 8 20 6-11h9M24 69h20m11-52h19',
  notebook: 'M48 25Q31 15 12 20v50q19-5 36 6 17-11 36-6V20q-19-5-36 5v51M20 33l18 5m-18 6 18 5m19-8 15-4m-15 15 15-4',
  dates: 'M14 25h68v51H14zM14 39h68M29 15v19m38-19v19M26 51h2m12 0h2m12 0h2m12 0h2M26 64h2m12 0h2m12 0h2m12 0h2',
  pages: 'M27 14h49v50H27zM19 23v49h50M12 32v48h48M36 27h31M36 37h23m-23 10h28m-28 10h15',
  dialogue: 'M11 17h49v31H33L20 60V48h-9zM38 54h27V32h20v37h-8v11L63 69H38zM24 31h23',
  wave: 'M10 44h13l7-19 9 35 9-48 10 63 8-40 6 9h14M12 68h17m38-46h17',
  rewind: 'M18 31a32 32 0 1 1-1 29M15 15v20h20M48 25v21l15 8M30 72l-7 8m51-20 8 4',
  memory: 'm48 8 32 18v36L48 80 16 62V26zM30 37l18-11 18 11v14L48 62 30 51zM48 8v18m32 0L66 37m14 25L66 51M48 80V62M16 62l14-11M16 26l14 11',
  lexicon: 'M19 17h57v58H19zM27 17v58M37 59l13-29 13 29M43 48h14m19-19h8m-8 15h8m-8 15h8',
  resonance: 'M48 26v36m-18-18h36M29 25a27 27 0 0 0 0 38m38-38a27 27 0 0 1 0 38M18 15a42 42 0 0 0 0 58m60-58a42 42 0 0 1 0 58',
  plan: 'M23 19h49v59H23zM37 14h22v12H37zM34 41l4 4 7-9m7 7h11M34 58l4 4 7-9m7 7h11',
  checks: 'm11 27 6 6 11-13m10 8h45M11 47l6 6 11-13m10 8h45M11 67l6 6 11-13m10 8h45',
  launch: 'm11 45 72-27-23 55-15-19-17 13 4-20zm21 2 51-29M14 66l-7 8m28 3-6 7',
  daily: 'M20 26h56v46H20zM20 40h56M33 17v18m30-18v18M31 52h32M31 62h22',
  week: 'M12 17h72v55H12zM12 31h72M22 43h2m10 0h2m10 0h2m10 0h2m10 0h2M22 56h2m10 0h2m11 0 5 5 8-11m10 6h2',
  hourglass: 'M22 13h52M22 77h52M29 13v13c0 10 10 15 19 19-9 4-19 9-19 19v13m38-64v13c0 10-10 15-19 19 9 4 19 9 19 19v13M34 68l14-11 14 11z',
  portrait: 'M19 13h58v65H19zM38 47a10 10 0 1 1 20 0 10 10 0 1 1-20 0zm-8 21q18-19 36 0M26 22h7m30 0h7',
  layers: 'M35 18h47v44H35zM24 25v45h47M13 34v45h47M44 29h28M44 39h20M44 49h24',
  exposure: 'M12 20h45v46H12zM39 30h45v46H39zM20 52l14-16 11 14 15-12 16 19M47 50v6',
  moon: 'm28 13 43 8-10 58-43-8zM56 30a16 16 0 1 0 0 28 14 14 0 0 1 0-28zM72 30l7 6 7-6-7-6z',
  orbit: 'M21 63a38 16-34 1 1 54-35 38 16-34 1 1-54 35zm27-37 4 13 14 5-14 4-4 14-4-14-14-4 14-5zM21 25l3 6 6 3-6 3-3 6-3-6-6-3 6-3z',
  deck: 'm11 27 22-10 23 52-22 10zM38 15h27v58H38zM68 17l19 10-22 51-15-6M52 32l3 8 7 3-7 3-3 8-3-8-7-3 7-3z',
  archive: 'M12 31h72v14H12zM18 45v30h60V45M35 56h26M48 13v12m-6-6h12',
  relics: 'M12 24h72v48H12zM12 47h72M35 24v48m26-48v48M20 37h7m17 0h8m17 0h7M20 59h7m17 0h8m17 0h7',
  search: 'M17 37a21 21 0 1 1 42 0 21 21 0 1 1-42 0zm35 16 25 24M28 38h21M38 27v22',
  sprout: 'M48 76V38m0 18c0-20 13-28 31-28-2 16-10 29-31 29zm0-9c0-18-13-27-31-27 2 15 10 27 31 28zM25 76h46',
  axes: 'm48 12 36 27-14 38H26L12 39zM48 12v34m36-7-36 7 22 31M48 46 26 77m22-31-36-7m36-12 20 15-8 22H36l-8-22z',
  ruler: 'm11 56 47-39 27 30-47 39zM21 49l11 11m1-20 8 8m4-18 11 11m0-20 8 8m12 23-7-8',
  prism: 'm48 16 26 51H22zM8 44h28m30 3 22-12M70 55l18-1M74 65l14 8M48 16v51',
  facets: 'm48 10 35 25-13 40H26L13 35zM48 10l14 27 21-2M62 37l8 38M13 35l21 2 14-27M34 37l-8 38m8-38h28L48 62 26 75m22-13 22 13',
  backup: 'M19 17h45l13 13v46H19zM63 17v16h14M48 35v29m-10-9 10 10 10-10M30 71h36',
  home: 'm12 43 36-28 36 28M22 36v39h52V36M39 75V54h18v21M31 43h6m22 0h6',
}
const points = computed(() => frames[props.medal.group.frame])
const isPlated = computed(() => !props.concealed && (props.finish === 'plated' || (props.finish !== 'base' && props.medal.plated)))
const locked = computed(() => !props.concealed && !props.preview && !props.medal.earned && !isPlated.value)
const style = computed(() => ({
  '--ink': props.medal.group.ink, '--accent': props.medal.group.accent,
  '--art-source': `url("${props.medal.atlas || props.medal.image || ''}")`,
  '--art-size': props.medal.atlas ? '400% 200%' : '100% 100%',
  '--art-position': props.medal.atlas ? `${(props.medal.atlasIndex % 4) * 100 / 3}% ${Math.floor(props.medal.atlasIndex / 4) * 100}%` : 'center',
}))
</script>

<template>
  <span class="medal-surface" :class="{ plated: isPlated, locked }" :style="style" aria-hidden="true">
  <span v-if="medal.atlas && !concealed" class="medal-art medal-atlas" />
  <img v-else-if="medal.image && !concealed" class="medal-art" :src="medal.image" alt="" :loading="eager ? 'eager' : 'lazy'" decoding="async" width="208" height="208" />
  <svg v-else class="medal-art etched" :class="{ concealed }" :style="style" viewBox="0 0 208 208" aria-hidden="true">
    <defs>
      <pattern :id="id + '-hatch'" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(37)">
        <path d="M1 0v5" stroke="var(--ink)" stroke-width=".65" />
      </pattern>
      <clipPath :id="id + '-edge'"><polygon :points="points" /></clipPath>
    </defs>
    <polygon :points="points" fill="#08132d" stroke="var(--ink)" stroke-width="3" />
    <g :clip-path="`url(#${id}-edge)`">
      <path d="M5 9h95L5 128zm201 37-68 151h68zM5 153l76 52H5z" :fill="`url(#${id}-hatch)`" opacity=".38" />
      <path d="M17 71 70 24M14 153l37 25m104-151 37 33m-41 124 41-35M31 93l10-21m126 27 10-21" fill="none" stroke="var(--accent)" stroke-width="2" />
      <circle cx="104" cy="83" r="54" fill="none" stroke="var(--ink)" stroke-dasharray="1 4" opacity=".7" />
      <circle cx="104" cy="83" r="49" fill="none" stroke="var(--accent)" stroke-dasharray="34 9 13 99" opacity=".65" />
      <path d="m104 19 4 7-4 7-4-7zM35 104l4 4-4 4-4-4zm138 0 4 4-4 4-4-4z" fill="var(--accent)" />
    </g>
    <polygon :points="points" transform="translate(104 104) scale(.91) translate(-104 -104)" fill="none" stroke="var(--ink)" stroke-width="1" opacity=".8" />
    <g v-if="!concealed" transform="translate(56 39)">
      <path :d="motifs[medal.motif]" transform="translate(2 2)" fill="none" stroke="var(--accent)" stroke-width="4.5" opacity=".65" />
      <path :d="motifs[medal.motif]" fill="none" stroke="var(--ink)" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" />
    </g>
    <path v-else d="M90 74v-9a14 14 0 0 1 28 0v9M83 74h42v33H83zM104 85v10" fill="none" stroke="var(--ink)" stroke-width="3" />
    <path d="M16 133h176l9 13-12 13H19L7 146z" fill="#08132d" stroke="var(--ink)" stroke-width="2" />
    <text x="104" y="150" text-anchor="middle" fill="var(--ink)" font-size="10" font-weight="900" letter-spacing=".25">{{ concealed ? 'CLASSIFIED' : 'OPERATION: ' + medal.english }}</text>
    <path d="M78 165h52l6 8-6 8H78l-6-8z" fill="var(--ink)" />
    <text x="104" y="176" text-anchor="middle" fill="#08132d" font-size="8.5" font-weight="900" letter-spacing="1.4">{{ concealed ? '•••' : medal.code }}</text>
  </svg>
  <span v-if="isPlated" class="medal-finish"><span class="foil-spectrum" /><span class="foil-flash" /></span>
  </span>
</template>

<style scoped>
.medal-surface { display: block; position: relative; width: 100%; aspect-ratio: 1; isolation: isolate; }
.medal-art { display: block; width: 100%; height: auto; aspect-ratio: 1; object-fit: contain; }
.medal-atlas { background-image: var(--art-source); background-size: var(--art-size); background-position: var(--art-position); background-repeat: no-repeat; }
.locked > .medal-art { filter: grayscale(.94) brightness(.63) contrast(.9); opacity: .8; }
.plated > .medal-art { filter: saturate(1.65) contrast(1.08) brightness(1.16); }
.medal-finish { position: absolute; inset: 0; pointer-events: none; mask-image: var(--art-source); mask-size: var(--art-size); mask-position: var(--art-position); mask-repeat: no-repeat; overflow: hidden; }
.foil-spectrum, .foil-flash { position: absolute; inset: 0; }
.foil-spectrum { background: conic-gradient(from 25deg at 32% 42%,#69fff5aa,#8d8aff8c,#ffa9efbb,#ffe59dbb,#b8ffe37a,#60dfff99,#69fff5aa); mix-blend-mode: color-dodge; opacity: .44; }
.foil-flash { inset: -45%; background: linear-gradient(115deg,transparent 36%,#bdf8ff22 42%,#eaffffb0 47%,#fff 49%,#ffe9fe88 52%,transparent 59%); transform: translateX(-70%); mix-blend-mode: screen; animation: mirror-foil 6s ease-in-out infinite; }
@keyframes mirror-foil { 0%,18% { transform: translateX(-70%) rotate(-9deg); opacity: 0; } 28% { opacity: .85; } 52%,100% { transform: translateX(70%) rotate(-9deg); opacity: 0; } }
.etched { font-family: var(--font-display), sans-serif; }
.concealed { filter: grayscale(1); opacity: .6; }
@media (prefers-reduced-motion: reduce) { .foil-flash { animation: none; transform: none; opacity: .25; } }
</style>
