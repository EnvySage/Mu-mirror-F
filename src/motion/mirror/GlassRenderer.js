import * as THREE from 'three'
import { createFractures, seededRandom } from './fractures'

const vertex = `
uniform float uBurst;
attribute vec3 aCenter;
attribute vec3 aVelocity;
attribute vec3 aAxis;
attribute float aSpin;
attribute float aDelay;
attribute float aFace;
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vWorld;
varying float vFace;
varying float vMotion;
vec3 rotateAxis(vec3 point, vec3 axis, float angle) {
  return point*cos(angle) + cross(axis,point)*sin(angle) + axis*dot(axis,point)*(1.-cos(angle));
}
void main() {
  float p=clamp((uBurst-aDelay)/(1.-aDelay),0.,1.);
  float movement=pow(p,1.65);
  float angle=aSpin*pow(p,1.15);
  vec3 point=rotateAxis(position-aCenter,aAxis,angle)+aCenter+aVelocity*movement;
  point.z-=sin(clamp(p/.2,0.,1.)*3.14159265)*4.;
  vNormal=rotateAxis(normal,aAxis,angle); vUv=uv; vFace=aFace; vWorld=point; vMotion=p;
  gl_Position=projectionMatrix*modelViewMatrix*vec4(point,1.);
}`
const fragment = `
uniform sampler2D uFace;
uniform sampler2D uCracks;
uniform vec2 uTexel;
uniform float uCrack;
uniform float uBurst;
uniform vec2 uImpact;
uniform float uPulse;
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vWorld;
varying float vFace;
varying float vMotion;
void main() {
  float intact=1.-smoothstep(0.,.18,uBurst);
  float crack=0.,gx=0.,gy=0.;
  if(vFace<.5 && intact>.001 && uCrack>.001) {
    crack=texture2D(uCracks,vUv).r;
    gx=texture2D(uCracks,vUv+vec2(uTexel.x,0.)).r-texture2D(uCracks,vUv-vec2(uTexel.x,0.)).r;
    gy=texture2D(uCracks,vUv+vec2(0.,uTexel.y)).r-texture2D(uCracks,vUv-vec2(0.,uTexel.y)).r;
  }
  vec3 normal=normalize(vNormal+vec3(-gx*4.,-gy*4.,0.)*uCrack*intact);
  vec2 bend=vec2(gx,gy)*uTexel*4.*uCrack*intact;
  vec3 color=texture2D(uFace,clamp(vUv+bend,.001,.999)).rgb;
  float light=dot(normal,normalize(vec3(-.65,.75,1.2)));
  float rim=pow(1.-abs(normal.z),2.5);
  float reflection=pow(max(0.,dot(reflect(normalize(vec3(.4,-.7,-1.)),normal),vec3(0.,0.,1.))),28.);
  if(vFace<.5) {
    color*=1.-smoothstep(.38,.95,crack)*uCrack*.82*intact;
    color+=vec3(.65,.84,.94)*(abs(gx)*.32+max(0.,gy)*.38)*uCrack*intact;
    color=mix(color,vec3(.1,.2,.29)+vec3(.7,.83,.9)*reflection,clamp(rim*.4+reflection*.24,0.,.62)*smoothstep(0.,.2,uBurst));
    color*=1.-max(0.,-light)*.32*smoothstep(0.,.1,uBurst);
  } else if(vFace<1.5) {
    vec3 bevel=mix(vec3(.012,.035,.055),vec3(.65,.83,.92),clamp(light*.65+.35,0.,1.));
    color=mix(color,bevel,clamp(uCrack*.58+uBurst*2.,0.,1.));
  } else if(vFace<2.5) {
    color=mix(vec3(.008,.026,.04),vec3(.29,.55,.64),clamp(light*.7+.2,0.,1.));
    color+=vec3(.5,.72,.82)*pow(max(0.,light),18.);
  } else {
    color=mix(vec3(.012,.025,.045),vec3(.3,.4,.48),clamp(light*.4+.35,0.,1.));
    color+=vec3(.5,.65,.75)*reflection*.7;
  }
  float pressure=exp(-length((vUv-uImpact)*vec2(2.3,1.))*28.);
  color+=vec3(.55,.8,.95)*pressure*uPulse*.4;
  gl_FragColor=vec4(color,1.);
  #include <colorspace_fragment>
}`

function crackTexture(pattern, width, height) {
  const canvas = document.createElement('canvas'), ratio = Math.min(1, 1500 / width)
  canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio)
  const ctx = canvas.getContext('2d'); ctx.scale(ratio, ratio)
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, width, height)
  ctx.strokeStyle = '#fff'; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  const random = seededRandom(41), edges = new Set()
  for (const plate of pattern.plates) for (let i = 0; i < plate.points.length; i++) {
    const a = plate.points[i], b = plate.points[(i + 1) % plate.points.length]
    const boundary = a[0] === b[0] && (a[0] === 0 || a[0] === width) || a[1] === b[1] && (a[1] === 0 || a[1] === height)
    if (boundary) continue
    const key = [a.map(v => v.toFixed(2)).join(','), b.map(v => v.toFixed(2)).join(',')].sort().join('|')
    if (edges.has(key)) continue
    edges.add(key)
    const dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy)
    ctx.lineWidth = .8 + random() * 1.2
    ctx.beginPath(); ctx.moveTo(...a)
    ctx.lineTo(a[0] + dx * .37 - dy / length * 1.3, a[1] + dy * .37 + dx / length * 1.3)
    ctx.lineTo(a[0] + dx * .7 + dy / length * .7, a[1] + dy * .7 - dx / length * .7)
    ctx.lineTo(...b); ctx.stroke()
    if (length > 75 && random() > .4) {
      ctx.lineWidth = .45; ctx.beginPath(); ctx.moveTo(a[0] + dx * .55, a[1] + dy * .55)
      ctx.lineTo(a[0] + dx * .64 + dy / length * 13, a[1] + dy * .64 - dx / length * 13); ctx.stroke()
    }
  }
  const [x, y] = pattern.impact
  for (let i = 0; i < 15; i++) {
    const angle = random() * Math.PI * 2, length = 5 + random() * 23
    ctx.lineWidth = .5 + random() * 1.2; ctx.beginPath(); ctx.moveTo(x, y)
    ctx.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length); ctx.stroke()
  }
  const texture = new THREE.CanvasTexture(canvas); texture.minFilter = THREE.LinearFilter; texture.generateMipmaps = false
  return { texture, texel: new THREE.Vector2(1 / canvas.width, 1 / canvas.height) }
}

function buildGeometry(pattern, width, height, cameraZ, compact) {
  const arrays = { position: [], normal: [], uv: [], aCenter: [], aVelocity: [], aAxis: [], aSpin: [], aDelay: [], aFace: [] }
  const thickness = compact ? 3.3 : 4.5
  function vertexAt(point, z, normal, plate, face) {
    arrays.position.push(point[0] - width / 2, height / 2 - point[1], z)
    arrays.normal.push(...normal); arrays.uv.push(point[0] / width, 1 - point[1] / height)
    arrays.aCenter.push(plate.x - width / 2, height / 2 - plate.y, 0)
    arrays.aVelocity.push(plate.dx, -plate.dy, cameraZ * plate.depth)
    const axis = new THREE.Vector3(...plate.axis).normalize()
    arrays.aAxis.push(axis.x, axis.y, axis.z); arrays.aSpin.push(plate.spin); arrays.aDelay.push(plate.delay); arrays.aFace.push(face)
  }
  function triangle(a, b, c, normal, plate, face) { for (const [point, z] of [a, b, c]) vertexAt(point, z, normal, plate, face) }
  for (const plate of pattern.plates) {
    const points = plate.points, inset = points.map(p => { const dx = plate.x - p[0], dy = plate.y - p[1], distance = Math.hypot(dx, dy); const scale = Math.min(1.15 / distance, .08); return [p[0] + dx * scale, p[1] + dy * scale] })
    for (let i = 1; i < points.length - 1; i++) {
      triangle([inset[0], thickness / 2], [inset[i], thickness / 2], [inset[i + 1], thickness / 2], [0, 0, 1], plate, 0)
      triangle([points[0], -thickness / 2], [points[i + 1], -thickness / 2], [points[i], -thickness / 2], [0, 0, -1], plate, 3)
    }
    for (let i = 0; i < points.length; i++) {
      const j = (i + 1) % points.length, a = points[i], b = points[j], length = Math.hypot(b[0] - a[0], b[1] - a[1])
      const normal = [(b[1] - a[1]) / length, (b[0] - a[0]) / length, 0]
      const bevel = [normal[0] * .7, normal[1] * .7, .7], front = thickness / 2 - .8, back = -thickness / 2
      triangle([a, front], [inset[i], thickness / 2], [inset[j], thickness / 2], bevel, plate, 1)
      triangle([a, front], [inset[j], thickness / 2], [b, front], bevel, plate, 1)
      triangle([a, front], [b, front], [b, back], normal, plate, 2)
      triangle([a, front], [b, back], [a, back], normal, plate, 2)
    }
  }
  const geometry = new THREE.BufferGeometry()
  for (const [key, values] of Object.entries(arrays)) geometry.setAttribute(key, new THREE.Float32BufferAttribute(values, key === 'uv' ? 2 : key.startsWith('a') && ['aSpin', 'aDelay', 'aFace'].includes(key) ? 1 : 3))
  return geometry
}

export class GlassRenderer {
  constructor() {
    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'default' })
    this.renderer.setClearColor(0x000000, 0)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.domElement.className = 'mirror-glass-canvas'
    this.renderer.domElement.setAttribute('aria-hidden', 'true')
    this.scene = new THREE.Scene()
    this.material = new THREE.ShaderMaterial({ vertexShader: vertex, fragmentShader: fragment, side: THREE.DoubleSide,
      uniforms: { uFace: { value: null }, uCracks: { value: null }, uTexel: { value: new THREE.Vector2(1, 1) }, uCrack: { value: 0 }, uBurst: { value: 0 }, uImpact: { value: new THREE.Vector2(.5, .5) }, uPulse: { value: 0 } } })
    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), this.material); this.mesh.frustumCulled = false; this.scene.add(this.mesh)
    this.cache = new Map()
  }
  async prepare(width, height, compact, viewport = { width, height }) {
    const ratio = Math.min(window.devicePixelRatio || 1, compact ? 1 : 1.25)
    const key = `${Math.round(width)}:${Math.round(height)}:${Math.round(viewport.width)}:${Math.round(viewport.height)}:${ratio}:${compact}`
    if (this.preparedKey === key) return this.entry
    if (this.preparing) { await this.preparing; return this.prepare(width, height, compact, viewport) }
    this.preparing = this.prepareScene(key, width, height, compact, viewport, ratio)
    try { const entry = await this.preparing; this.preparedKey = key; return entry }
    finally { this.preparing = null }
  }
  async prepareScene(key, width, height, compact, viewport, ratio) {
    if (!this.cache.has(key)) {
      const pattern = createFractures(width, height, { compact })
      const cameraZ = viewport.height / (2 * Math.tan(THREE.MathUtils.degToRad(40) / 2))
      const geometry = buildGeometry(pattern, width, height, cameraZ, compact), crack = crackTexture(pattern, width, height)
      this.cache.set(key, { geometry, pattern, crack, cameraZ })
      if (this.cache.size > 3) { const oldest = this.cache.keys().next().value; const old = this.cache.get(oldest); old.geometry.dispose(); old.crack.texture.dispose(); this.cache.delete(oldest) }
    }
    const entry = this.cache.get(key)
    this.width = width; this.height = height; this.mesh.geometry = entry.geometry; this.entry = entry
    this.camera = new THREE.PerspectiveCamera(40, viewport.width / viewport.height, 1, entry.cameraZ * 4)
    this.camera.position.z = entry.cameraZ
    this.renderer.setPixelRatio(ratio)
    this.renderer.setSize(viewport.width, viewport.height, false)
    this.material.uniforms.uCracks.value = entry.crack.texture; this.material.uniforms.uTexel.value = entry.crack.texel
    this.material.uniforms.uImpact.value.set(entry.pattern.impact[0] / width, 1 - entry.pattern.impact[1] / height)
    if (!this.fallbackTexture) {
      this.fallbackTexture = new THREE.DataTexture(new Uint8Array([7, 31, 77, 255]), 1, 1); this.fallbackTexture.needsUpdate = true
    }
    this.material.uniforms.uFace.value ||= this.fallbackTexture
    if (this.renderer.extensions.has('KHR_parallel_shader_compile')) await this.renderer.compileAsync(this.scene, this.camera)
    else this.renderer.compile(this.scene, this.camera)
    this.draw(0, 0, 0)
    return entry
  }
  place(bounds, viewport) {
    this.mesh.position.set(bounds.x + bounds.width / 2 - viewport.x - viewport.width / 2, viewport.y + viewport.height / 2 - bounds.y - bounds.height / 2, 0)
  }
  setFace(canvas) {
    if (!this.faceTexture) {
      this.faceTexture = new THREE.CanvasTexture(canvas); this.faceTexture.colorSpace = THREE.SRGBColorSpace
      this.faceTexture.minFilter = THREE.LinearFilter; this.faceTexture.generateMipmaps = false
    } else { this.faceTexture.image = canvas; this.faceTexture.needsUpdate = true }
    this.material.uniforms.uFace.value = this.faceTexture
    this.renderer.initTexture(this.faceTexture)
  }
  draw(crack, burst, pulse) {
    this.material.uniforms.uCrack.value = crack; this.material.uniforms.uBurst.value = burst; this.material.uniforms.uPulse.value = pulse
    this.renderer.render(this.scene, this.camera)
  }
  get canvas() { return this.renderer.domElement }
  get statistics() { return { plates: this.entry?.pattern.plates.length, drawCalls: this.renderer.info.render.calls, triangles: this.renderer.info.render.triangles, nodes: 1 } }
}
