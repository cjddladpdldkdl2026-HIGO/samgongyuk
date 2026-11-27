/* 사랑하는 그대에게 기대세요 — 3D 화면 (three.js)
 *
 *  index.html 의 게임 규칙(공 물리·스윙 게이지·상점·랭킹)은 그대로 두고, 그리는 것만 여기서 해요.
 *  index.html 의 전역 변수(let/const — window.xxx 가 아니라 이름 그대로)(phase, meterPos, setPower, downAt, hitAt, ball, trail, lastShot, S, CLUBS, BALLS)을 읽어요.
 *
 *  좌표: 게임 물리는 x = 오른쪽, y = 위, z = 앞(날아가는 쪽).  3D 화면은 앞 = -z 라서 z 만 뒤집어요.
 *  캐릭터: 과잠(학과 점퍼) 입은 대학생, 오른손잡이. 공 왼쪽에 서서 공을 보고, 뒤쪽 비스듬한 카메라에서 보여요.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const canvas = document.getElementById('scene');
const MOBILE = Math.min(innerWidth, innerHeight) < 600;
// logarithmicDepthBuffer: 멀리서 · 높은 데서 봐도 잔디 겹(러프 · 페어웨이 · 선)이 깨지지 않게 (깊이 계산을 거리에 맞게 정밀하게)
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', logarithmicDepthBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, MOBILE ? 1.5 : 1.75));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

const scene = new THREE.Scene();
const HAZE = new THREE.Color(0xbdd9f5);
scene.fog = new THREE.Fog(HAZE, 220, 1500);
scene.background = HAZE;
const camera = new THREE.PerspectiveCamera(52, innerWidth / innerHeight, 0.1, 6000);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.35, 0.4, 0.92);
composer.addPass(bloom);
composer.addPass(new OutputPass());

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false); composer.setSize(w, h);
  bloom.resolution.set(w / 2, h / 2);
  camera.aspect = w / h;
  camera.fov = w / h < 0.8 ? 64 : 52;   // 세로 화면(폰)에서는 조금 넓게
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();
// 부드럽게 (2026-11-27): 화면이 버벅이면(1초에 45장 못 그리면) 그림 해상도를 한 단계씩 낮춰요.
// 오래 여유가 있으면 다시 올려요. 가장 낮은 단계에서는 빛 번짐(블룸)도 꺼요.
const PR_MAX = Math.min(devicePixelRatio || 1, MOBILE ? 1.5 : 1.75);
const PR_STEPS = [...new Set([PR_MAX, Math.min(PR_MAX, 1.25), Math.min(PR_MAX, 1), .8])].sort((a, b) => b - a);
const Q = { i: 0, t: 0, n: 0, good: 0, since: performance.now() };
function adaptQuality(dt) {
  if (document.hidden || performance.now() - Q.since < 4000) { Q.t = Q.n = 0; return; }   // 켠 직후 · 바꾼 직후는 재지 않아요
  Q.t += dt; Q.n++; if (Q.t < 1.5) return;
  const avg = Q.t / Q.n; Q.t = Q.n = 0;
  if (avg > 1 / 45 && Q.i < PR_STEPS.length - 1) { Q.want = Q.i + 1; Q.good = 0; }
  else if (avg < 1 / 57 && Q.i > 0) { if (++Q.good >= 6) { Q.want = Q.i - 1; Q.good = 0; } }
  else Q.good = 0;
}
// 해상도 바꾸는 순간 한 번 멈칫해서, 공을 치거나 날아가는 중이 아닐 때만 바꿔요
function applyQuality() {
  if (Q.want === undefined || Q.want === Q.i || !(phase === 'ready' || phase === 'done' || phase === 'idle')) return;
  Q.i = Q.want; Q.want = undefined;
  renderer.setPixelRatio(PR_STEPS[Q.i]); bloom.enabled = Q.i < PR_STEPS.length - 1; resize(); Q.since = performance.now();
}
// 그림자는 타석 근처에서만 새로 그려요 (공을 따라 멀리 가면 타석 그림자는 안 보여서)
renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = true;

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);
const glow = (hex, k = 2.2) => new THREE.Color(hex).multiplyScalar(k);   // 블룸으로 빛나게 (1보다 밝은 색)
const OB_X = 70;   // index.html 의 OB_X 와 같은 값
const RANGE = 5000;  // 연습장 길이(m): 표지판 · 선 · 아치가 여기까지 있어요 (부스터는 index.html BOOST_TO)
const SEA_AT = 500, SKY_AT = 1000, SPACE_AT = 1500, NEON_AT = 3000;   // 바깥 풍경: 0~500m 숲 · 500~1000m 바다 · 1000~1500m 하늘(구름 위) · 1500~3000m 우주 · 3000m~ 네온 차원
// 🎄 크리스마스 꾸미기 (눈 덮인 숲 · 눈 오는 바다 · 산타 썰매). 끝나면 false 로 바꾸면 원래 풍경으로 돌아가요
const XMAS = true;

/* ── 캔버스로 만드는 무늬 ─────────────────────────────────────────── */
function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
function noise(g, w, h, n, a, colorFn) {
  for (let i = 0; i < n; i++) { g.fillStyle = colorFn(); g.globalAlpha = a * Math.random(); g.fillRect(Math.random() * w, Math.random() * h, 2, 2 + Math.random() * 3); }
  g.globalAlpha = 1;
}

/* ── 낮 하늘 · 해 · 구름 · 산 (카메라를 따라다녀서 아주 멀리 있는 것처럼) ── */
const far = new THREE.Group(); scene.add(far);
const farHills = [];   // 먼 산줄기 (바다 · 하늘 구역에서는 숨겨요)
const farClouds = [];  // 하늘의 뭉게구름 (우주에서는 숨겨요)
const balloons = [];   // 열기구 (천천히 오르내려요)
const sky = new THREE.Mesh(new THREE.SphereGeometry(3000, 32, 20), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  uniforms: { uSun: { value: V(-.45, .55, -.7).normalize() } },
  fragmentShader: `uniform vec3 uSun; varying vec3 vP;
    void main(){
      float h = vP.y;
      vec3 haze = vec3(0.78, 0.87, 0.96);
      vec3 low  = vec3(0.50, 0.72, 0.97);
      vec3 top  = vec3(0.10, 0.34, 0.82);
      vec3 c = mix(haze, low, smoothstep(0.0, 0.08, h));
      c = mix(c, top, smoothstep(0.10, 0.78, h));
      float s = max(dot(normalize(vP), uSun), 0.0);
      c += vec3(1.0, 0.95, 0.85) * (pow(s, 6.0) * 0.22 + pow(s, 48.0) * 0.45);   // 해 주변 빛무리
      if (h < 0.0) c = haze;
      gl_FragColor = vec4(c, 1.0);
    }`,
}));
sky.renderOrder = -10; far.add(sky);
const SUN_DIR = V(-.45, .55, -.7).normalize();
const sunTex = canvasTex(256, 256, (g, w, h) => {
  const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  gr.addColorStop(0, 'rgba(255,255,250,1)'); gr.addColorStop(.18, 'rgba(255,252,230,1)'); gr.addColorStop(.3, 'rgba(255,240,190,.45)'); gr.addColorStop(1, 'rgba(255,240,200,0)');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
});
const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTex, fog: false, depthWrite: false, toneMapped: false, color: new THREE.Color(1.4, 1.4, 1.3) }));
sun.scale.set(700, 700, 1); sun.position.copy(SUN_DIR).multiplyScalar(2600); far.add(sun);
// 뭉게구름
{
  const cloudTexs = [0, 1, 2].map(() => canvasTex(512, 256, (g, w, h) => {
    const puffs = 26 + Math.floor(Math.random() * 14);
    for (let i = 0; i < puffs; i++) {   // 가운데가 높게 쌓인 뭉게구름
      const t = Math.random(), x = w * (.12 + t * .76), top = Math.sin(t * Math.PI);
      const y = h * (.72 - top * (.18 + Math.random() * .22)), r = h * (.1 + top * .16 + Math.random() * .1);
      const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.55, 'rgba(255,255,255,.85)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
    g.globalCompositeOperation = 'source-atop';
    const sh = g.createLinearGradient(0, 0, 0, h); sh.addColorStop(0, 'rgba(255,255,255,0)'); sh.addColorStop(.55, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(150,170,200,.7)');
    g.fillStyle = sh; g.fillRect(0, 0, w, h);
  }));
  let s = 21; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 22; i++) {
    const ang = -Math.PI / 2 + (r() - .5) * Math.PI * 1.6, d = 1500 + r() * 900, hgt = 160 + r() * 520;
    const c = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTexs[i % 3], fog: false, depthWrite: false, transparent: true, opacity: .8 + r() * .2 }));
    const w = 380 + r() * 520; c.scale.set(w, w * .45, 1); c.position.set(Math.cos(ang) * d, hgt, Math.sin(ang) * d); far.add(c); farClouds.push(c);
  }
}
// 먼 산: 카메라를 둘러싼 산줄기 3겹 (멀수록 파랗고 흐리게, 제일 먼 줄은 눈 덮인 봉우리)
{
  const ridge = (a, k) => {   // 0..1 높이 (각도 a 에 대해 한 바퀴 이어지게 정수배 주파수)
    let v = .5 * Math.sin(a * 3 + k) + .28 * Math.sin(a * 7 + k * 1.7) + .16 * Math.sin(a * 13 + k * .3) + .09 * Math.sin(a * 29 + k * 2.3) + .05 * Math.sin(a * 53 + k * 1.1);
    v = (v + 1.08) / 2.16; return Math.pow(Math.max(0, Math.min(1, v)), 1.6);
  };
  const LAYERS = [
    { d: 1350, h: 110, lo: 0x6c937f, hi: 0x86ab95, snow: 0, k: 2.1 },
    { d: 1680, h: 220, lo: 0x87a3c0, hi: 0xa2b9d6, snow: .74, k: 5.3 },
    { d: 2080, h: 360, lo: 0x93abc9, hi: 0xb3c6de, snow: .62, k: 8.9 },
  ];
  if (XMAS) { LAYERS[0].snow = .4; LAYERS[0].lo = 0x5f8574; LAYERS[1].snow = .32; LAYERS[2].snow = .22; }   // 🎄 산에 눈이 많이
  for (const L of LAYERS) {
    const geo = new THREE.CylinderGeometry(1, 1, 1, 260, 5, true);
    const pos = geo.attributes.position, cols = [], lo = new THREE.Color(L.lo), hi = new THREE.Color(L.hi), white = new THREE.Color(0xf4f8ff), c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i), t = pos.getY(i) + .5, a = Math.atan2(x, z);
      const R = L.h * (.25 + .75 * ridge(a, L.k)), y = -12 + t * R, rr = L.d - t * R * 1.4;   // 위로 갈수록 안쪽(보는 쪽)으로 기울어요
      pos.setXYZ(i, Math.sin(a) * rr, y, Math.cos(a) * rr);
      c.copy(lo).lerp(hi, t);
      if (L.snow && y > L.h * L.snow) c.lerp(white, Math.min(1, (y - L.h * L.snow) / (L.h * .12)));
      cols.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    const flat = geo.toNonIndexed(); flat.computeVertexNormals();   // 면마다 명암: 왼쪽 비탈은 밝게, 오른쪽은 어둡게 (해가 왼쪽 앞)
    const fc = flat.attributes.color, fn = flat.attributes.normal, fp = flat.attributes.position;
    for (let i = 0; i < fc.count; i++) {
      const ang = Math.atan2(fp.getX(i), fp.getZ(i)), side = -Math.cos(ang) * fn.getX(i) + Math.sin(ang) * fn.getZ(i);   // 보는 쪽 기준 가로 기울기
      const k = .9 - side * .14; fc.setXYZ(i, fc.getX(i) * k, fc.getY(i) * k, fc.getZ(i) * k);
    }
    const hill = new THREE.Mesh(flat, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, side: THREE.DoubleSide })); far.add(hill); farHills.push(hill);
  }
}

/* ── 조명 (한낮 햇빛) ─────────────────────────────────────────────── */
scene.add(new THREE.HemisphereLight(0xd6ebff, 0x4f7f35, 1.35));
let ENV_TEX = null;
{   // 하늘(위) · 잔디(아래) 색으로 만든 환경광
  const envScene = new THREE.Scene();
  const envSky = sky.material.clone(); envSky.fragmentShader = envSky.fragmentShader.replace('gl_FragColor = vec4(c, 1.0);', 'gl_FragColor = vec4(c * 0.38, 1.0);');   // 은은하게만
  envScene.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), envSky));
  const g = new THREE.Mesh(new THREE.CircleGeometry(49, 32), new THREE.MeshBasicMaterial({ color: 0x1b3a1a })); g.rotation.x = -Math.PI / 2; g.position.y = -1; envScene.add(g);
  const pm = new THREE.PMREMGenerator(renderer); ENV_TEX = pm.fromScene(envScene, .04).texture; pm.dispose();   // 캐릭터에만 써요 (잔디에 쓰면 허옇게 돼요)
}
const key = new THREE.DirectionalLight(0xfff6e6, 2.8);   // 햇빛
key.position.set(-8, 18, 14); key.castShadow = true;
key.shadow.mapSize.set(MOBILE ? 1024 : 2048, MOBILE ? 1024 : 2048);
Object.assign(key.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 1, far: 60 });
key.shadow.bias = -0.0015; key.shadow.normalBias = 0.05;
scene.add(key); scene.add(key.target);
const rim = new THREE.DirectionalLight(0xffffff, .7);   // 앞쪽에서 오는 하늘빛
rim.position.set(0, 12, -40); scene.add(rim);

/* ── 땅: 러프 · 페어웨이 · 타석 ───────────────────────────────────── */
function grayTex(size, draw) {   // 밝기만 쓰는 무늬 (0.5 = 그대로)
  const t = canvasTex(size, size, (g, w, h) => { g.fillStyle = '#808080'; g.fillRect(0, 0, w, h); draw(g, w, h); });
  t.colorSpace = THREE.NoColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
const bladeTex = grayTex(512, (g, w, h) => {   // 풀잎 (짧은 선 수천 개)
  for (let i = 0; i < 7000; i++) {
    const x = Math.random() * w, y = Math.random() * h, l = 10 + Math.random() * 22, a = (Math.random() - .5) * .8, v = 40 + Math.random() * 175 | 0;
    g.strokeStyle = `rgba(${v},${v},${v},.7)`; g.lineWidth = 1.5 + Math.random() * 2;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.sin(a) * l, y - Math.cos(a) * l); g.stroke();
  }
});
const patchTex = grayTex(256, (g, w, h) => {   // 큰 얼룩 (가장자리도 이어지게 9칸에 그려요)
  for (let i = 0; i < 70; i++) {
    const x = Math.random() * w, y = Math.random() * h, r = 12 + Math.random() * 40, v = Math.random() < .5 ? 40 : 215;
    for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) {
      const gr = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r); gr.addColorStop(0, `rgba(${v},${v},${v},.35)`); gr.addColorStop(1, `rgba(${v},${v},${v},0)`);
      g.fillStyle = gr; g.fillRect(x + dx - r, y + dy - r, r * 2, r * 2);
    }
  }
});
function grassify(m, bladeScale, bladeAmt, patchScale, patchAmt) {
  const f = (n) => n.toFixed(5);
  m.envMapIntensity = 0;   // 하늘 환경광은 캐릭터 · 물체에만 (잔디가 허옇게 안 되게)
  m.onBeforeCompile = (sh) => {
    sh.uniforms.tBlade = { value: bladeTex }; sh.uniforms.tPatch = { value: patchTex };
    sh.vertexShader = 'varying vec3 vGW;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n  vGW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = 'uniform sampler2D tBlade; uniform sampler2D tPatch; varying vec3 vGW;\n' + sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      float gb = texture2D(tBlade, vGW.xz * ${f(bladeScale)}).r, gp = texture2D(tPatch, vGW.xz * ${f(patchScale)}).r;
      diffuseColor.rgb *= (1.0 + (gb - 0.5) * ${f(bladeAmt)}) * (1.0 + (gp - 0.5) * ${f(patchAmt)});`);
  };
  return m;
}
const roughTex = canvasTex(64, 64, (g, w, h) => { g.fillStyle = XMAS ? '#c3ceda' : '#2b6a31'; g.fillRect(0, 0, w, h); }, [1, 1]);   // 🎄 눈밭
const ground = new THREE.Mesh(new THREE.PlaneGeometry(1400, 200 + SEA_AT), XMAS ? grassify(new THREE.MeshStandardMaterial({ map: roughTex, roughness: 1 }), 1 / 6, .18, 1 / 60, .45) : grassify(new THREE.MeshStandardMaterial({ map: roughTex, roughness: 1 }), 1 / 3, 1.2, 1 / 90, 1.3));
ground.rotation.x = -Math.PI / 2; ground.position.z = 100 - (200 + SEA_AT) / 2; ground.receiveShadow = true; scene.add(ground);

const fairTex = canvasTex(64, 512, (g, w, h) => {   // 잔디 깎은 줄무늬 (밝은 줄 · 어두운 줄)
  g.fillStyle = '#4ea94f'; g.fillRect(0, 0, w, h / 2);
  g.fillStyle = '#64c15f'; g.fillRect(0, h / 2, w, h / 2);
}, [1, 230]);
const fairway = new THREE.Mesh(new THREE.PlaneGeometry(64, RANGE + 300), grassify(new THREE.MeshStandardMaterial({ map: fairTex, roughness: .95, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }), 1 / 2.6, .8, 1 / 70, .6));
fairway.rotation.x = -Math.PI / 2; fairway.position.set(0, 0.01, -(RANGE + 300) / 2); fairway.receiveShadow = true; scene.add(fairway);

// 러프의 긴 풀 (페어웨이 양옆, 바람에 살랑살랑 · 폰에서는 적게)
const WIND = { value: 0 };
{
  const tex = canvasTex(128, 128, (g, w, h) => {
    for (let i = 0; i < 16; i++) {
      const x = 10 + Math.random() * (w - 20), bend = (Math.random() - .5) * 30, top = h * (.05 + Math.random() * .35), bw = 3 + Math.random() * 4;
      const gr = g.createLinearGradient(0, h, 0, top); gr.addColorStop(0, '#1f5a26'); gr.addColorStop(1, Math.random() < .5 ? '#7fc95a' : '#5fae47');
      g.fillStyle = gr; g.beginPath(); g.moveTo(x - bw, h); g.quadraticCurveTo(x + bend * .3, (h + top) / 2, x + bend, top); g.quadraticCurveTo(x + bend * .3 + 1, (h + top) / 2, x + bw, h); g.fill();
    }
  });
  const a = new THREE.PlaneGeometry(1, 1), b = new THREE.PlaneGeometry(1, 1); b.rotateY(Math.PI / 2);
  const geo = mergeGeometries([a, b]); geo.translate(0, .5, 0);
  const nrm = geo.attributes.normal; for (let i = 0; i < nrm.count; i++) nrm.setXYZ(i, 0, 1, 0);   // 위를 보는 빛 → 앞뒤 밝기가 같아요
  const m = new THREE.MeshStandardMaterial({ map: tex, alphaTest: .45, side: THREE.DoubleSide, roughness: 1, envMapIntensity: 0 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = WIND;
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      float sway = sin(uTime * 1.7 + instanceMatrix[3].x * .35 + instanceMatrix[3].z * .27) * .14 * uv.y;
      transformed.x += sway; transformed.z += sway * .5;`);
  };
  const N = MOBILE ? 1800 : 5200, tufts = new THREE.InstancedMesh(geo, m, N), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color();
  let s = 77; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < N; i++) {
    const side = r() < .5 ? -1 : 1, x = side * (32.3 + Math.pow(r(), 1.7) * 44), z = 4 - Math.pow(r(), 1.3) * 300, hgt = .35 + r() * .45, w = hgt * (1.1 + r() * .6);
    q.setFromAxisAngle(UP, r() * Math.PI); m4.compose(V(x, 0, z), q, V(w, hgt, w)); tufts.setMatrixAt(i, m4);
    tufts.setColorAt(i, col.setHSL(.27 + r() * .06, .45 + r() * .2, .42 + r() * .16));
  }
  tufts.frustumCulled = false; if (!XMAS) scene.add(tufts);   // 🎄 눈 덮여서 안 보여요
}

// 50m 마다 흰 선 · OB 선 (네온 분홍)
{
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .75 });
  for (let z = 50; z <= RANGE; z += 50) {
    const l = new THREE.Mesh(new THREE.PlaneGeometry(64, z % 100 ? .25 : .45), lineMat);
    l.rotation.x = -Math.PI / 2; l.position.set(0, .02, -z); scene.add(l);
  }
  const obMat = new THREE.MeshBasicMaterial({ color: glow(0xff2e88, 2), toneMapped: false });
  for (const sx of [-OB_X, OB_X]) {
    const l = new THREE.Mesh(new THREE.PlaneGeometry(.5, RANGE + 300), obMat);
    l.rotation.x = -Math.PI / 2; l.position.set(sx, .03, -(RANGE + 300) / 2 + 10); scene.add(l);
    for (let z = 20; z < RANGE + 100; z += 40) {   // OB 말뚝
      const p = new THREE.Mesh(new THREE.CylinderGeometry(.12, .12, 1.4, 6), obMat); p.position.set(sx, .7, -z); scene.add(p);
    }
  }
}

// 타석 (데크 · 매트 · 칸막이)
const deck = new THREE.Mesh(new THREE.BoxGeometry(14, .3, 9), new THREE.MeshStandardMaterial({ color: 0x9aa0ad, roughness: .9 }));
deck.position.set(0, -.14, 3.6); scene.add(deck);
const matTex = canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#1f6b37'; g.fillRect(0, 0, w, h);
  noise(g, w, h, 5000, .4, () => Math.random() < .5 ? '#2f8a48' : '#165229');
  g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 5; g.strokeRect(8, 8, w - 16, h - 16);
  g.beginPath(); g.moveTo(w / 2, 20); g.lineTo(w / 2, h - 20); g.stroke();
});
const mat = new THREE.Mesh(new THREE.BoxGeometry(2.2, .03, 1.8), new THREE.MeshStandardMaterial({ map: matTex, roughness: 1 }));
mat.position.set(-.45, .015, .1); mat.receiveShadow = true; scene.add(mat);
{
  const glass = new THREE.MeshStandardMaterial({ color: 0x9fdcff, transparent: true, opacity: .14, roughness: .1, metalness: .2, depthWrite: false });
  const frame = new THREE.MeshStandardMaterial({ color: 0x18122a, roughness: .6 });
  const neon = new THREE.MeshBasicMaterial({ color: glow(0x2de2e6, 2.2), toneMapped: false });
  for (const sx of [-3.6, 3.0]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(.04, 2.4, 4.5), glass); p.position.set(sx, 1.2, 2.4); scene.add(p);
    const post = new THREE.Mesh(new THREE.BoxGeometry(.12, 2.6, .12), frame); post.position.set(sx, 1.3, .15); post.castShadow = true; scene.add(post);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(.05, .05, 4.5), neon); strip.position.set(sx, 2.42, 2.4); scene.add(strip);
  }
  const tee = new THREE.Mesh(new THREE.CylinderGeometry(.009, .005, .045, 8), new THREE.MeshStandardMaterial({ color: 0xff2e88, emissive: 0xff2e88, emissiveIntensity: .4 }));
  tee.position.set(0, .05, 0); scene.add(tee);
}

/* ═══════════════════════════════════════════════════════════════
 *  🎄 크리스마스 꾸미기 (맨 위 XMAS = false 로 끄면 원래 풍경)
 *  숲: 눈 덮인 트리 + 전구 · 장식 공 · 별, 눈사람, 선물 상자, 큰 트리
 *  바다: 눈 덮인 해변 · 야자수 전구 · 빙산 · 펭귄 · 하늘을 나는 산타 썰매
 *  둘 다: 하늘에서 눈이 내려요
 * ═══════════════════════════════════════════════════════════════ */
const xmasAnim = [];   // 매 프레임 움직이는 것들 (눈 · 썰매 · 전구)
let xs = 2024; const xr = () => (xs = (xs * 16807) % 2147483647) / 2147483647;
const XM = (c, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: .75 }, o));
const BULB_COLS = [0xff2e4d, 0xffd23f, 0x2de2e6, 0x6bff8b, 0xff7ad9, 0xffffff];
const ORN_COLS = [0xd8142e, 0xe8b522, 0x1f5fd6, 0xc9ccd6, 0x9b1fd6];
function candyTex() {   // 사탕 지팡이 줄무늬
  const t = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h); g.fillStyle = '#e0142f';
    for (let k = -2; k < 4; k++) { g.beginPath(); g.moveTo(k * w / 2, h); g.lineTo(k * w / 2 + w / 4, h); g.lineTo(k * w / 2 + w / 4 + w, 0); g.lineTo(k * w / 2 + w, 0); g.fill(); }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 8); return t;
}
function starGeo(R) {   // 다섯 꼭지 별 (두께 있음)
  const pts = []; for (let k = 0; k < 10; k++) { const a = Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? R * .45 : R; pts.push(new THREE.Vector2(Math.cos(a) * rr, Math.sin(a) * rr)); }
  const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: R * .25, bevelEnabled: false }); g.translate(0, 0, -R * .125); return g;
}
// 트리 목록에 전구 · 장식 공 · 별 달기 (InstancedMesh 로 한 번에 그려서 가벼워요)
const TREE_LAYERS = [[.40, .44, .16], [.32, .40, .38], [.22, .36, .62]];   // (반지름, 높이, 바닥 높이) — 숲의 소나무와 같은 모양
function decorate(trees) {
  const per = MOBILE ? 9 : 14, orn = MOBILE ? 5 : 8;
  const nb = trees.reduce((a, t) => a + (t.big ? 140 : per), 0), no = trees.reduce((a, t) => a + (t.big ? 46 : orn), 0);
  const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshBasicMaterial({ toneMapped: false }), nb);
  const balls = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 14, 10), new THREE.MeshStandardMaterial({ metalness: .65, roughness: .22, envMap: ENV_TEX }), no);
  const stars = new THREE.InstancedMesh(starGeo(1), new THREE.MeshBasicMaterial({ color: glow(0xffd23f, 2.6), toneMapped: false }), trees.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color(); let ib = 0, io = 0;
  const onTree = (t, inset) => {   // 트리 겉면 위 아무 점
    const [rad, h, y] = TREE_LAYERS[Math.floor(xr() * 3)], k = .12 + xr() * .7, a = xr() * 6.28, rr = rad * (1 - k) * t.w * inset;
    return V(t.x + Math.cos(a) * rr, (y + k * h) * t.h, t.z + Math.sin(a) * rr);
  };
  trees.forEach((t, i) => {
    const sz = t.h / 15;
    for (let k = 0; k < (t.big ? 140 : per); k++) { m4.compose(onTree(t, 1.03), q.identity(), V(1, 1, 1).multiplyScalar(.17 * sz)); bulbs.setMatrixAt(ib, m4); bulbs.setColorAt(ib++, col.set(BULB_COLS[Math.floor(xr() * BULB_COLS.length)]).multiplyScalar(2.4)); }
    for (let k = 0; k < (t.big ? 46 : orn); k++) { m4.compose(onTree(t, 1.0), q.identity(), V(1, 1, 1).multiplyScalar(.36 * sz)); balls.setMatrixAt(io, m4); balls.setColorAt(io++, col.set(ORN_COLS[Math.floor(xr() * ORN_COLS.length)])); }
    m4.compose(V(t.x, t.h + .55 * sz, t.z), q.identity(), V(1, 1, 1).multiplyScalar(.75 * sz)); stars.setMatrixAt(i, m4);
  });
  bulbs.count = ib; balls.count = io; scene.add(bulbs, balls, stars);
  // 전구가 반짝반짝 (몇 개씩 번갈아 어두워져요)
  const base = Float32Array.from(bulbs.instanceColor.array); let last = -1;
  xmasAnim.push((now) => {
    const ph = Math.floor(now / 450); if (ph === last) return; last = ph;
    const a = bulbs.instanceColor.array;
    for (let i = 0; i < ib; i++) { const on = ((i * 7 + ph) % 5) !== 0 ? 1 : .25; a[i * 3] = base[i * 3] * on; a[i * 3 + 1] = base[i * 3 + 1] * on; a[i * 3 + 2] = base[i * 3 + 2] * on; }
    bulbs.instanceColor.needsUpdate = true;
  });
}
// 숲: 소나무마다 눈 모자 + 장식, 큰 트리 · 눈사람 · 선물
function xmasTrees(pines, n) {
  const capGeo = mergeGeometries(TREE_LAYERS.map(([rad, h, y]) => { const g = new THREE.ConeGeometry(rad * .62, h * .62, 9); g.translate(0, y + h * .42 + h * .31, 0); return g; }));
  const capMat = new THREE.MeshStandardMaterial({ color: 0xdfe8f2, roughness: 1, flatShading: true, envMapIntensity: 0 });
  const caps = new THREE.InstancedMesh(capGeo, capMat, n);
  const m4 = new THREE.Matrix4(), p = V(), q = new THREE.Quaternion(), sc = V(), trees = [];
  for (let i = 0; i < n; i++) {
    pines.getMatrixAt(i, m4); caps.setMatrixAt(i, m4);
    m4.decompose(p, q, sc); if (p.z > -330 || xr() < .5) trees.push({ x: p.x, z: p.z, w: sc.x, h: sc.y });   // 가까운 트리는 전부, 먼 트리는 절반만 꾸며요
  }
  scene.add(caps);
  // 큰 크리스마스 트리 (타석 앞 왼쪽)
  const BIG = { x: -52, z: -72, w: 15, h: 26, big: true };
  const bigTree = new THREE.Mesh(mergeGeometries(TREE_LAYERS.map(([rad, h, y]) => { const g = new THREE.ConeGeometry(rad, h, 16); g.translate(0, y + h / 2, 0); return g; })), new THREE.MeshStandardMaterial({ color: 0x1f6b3a, roughness: .85, flatShading: true, envMapIntensity: 0 }));
  bigTree.scale.set(BIG.w, BIG.h, BIG.w); bigTree.position.set(BIG.x, 0, BIG.z); bigTree.castShadow = true; scene.add(bigTree);
  const bigCap = new THREE.Mesh(capGeo, capMat); bigCap.scale.copy(bigTree.scale); bigCap.position.copy(bigTree.position); scene.add(bigCap);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.7, .9, 4.5, 8), XM(0x5a4030, { roughness: 1 })); trunk.position.set(BIG.x, 2.2, BIG.z); scene.add(trunk);
  trees.push(BIG);
  decorate(trees);
  // 눈사람 (페어웨이 옆 눈밭)
  const snow = new THREE.MeshStandardMaterial({ color: 0xf2f6fb, roughness: .9, envMapIntensity: .3 }), coal = XM(0x15151a, { roughness: .6 }), carrot = XM(0xff7a1a, { roughness: .6 }), scarfM = XM(0xe0142f, { roughness: .8 }), hatM = XM(0x18181f, { roughness: .5 }), stick = XM(0x5a4030);
  [[-44, 38, 1.3], [47, 92, 1.5], [-50, 168, 1.6], [43, 262, 1.7], [-42, 352, 1.8], [52, 445, 2]].forEach(([x, z, k]) => {
    const g = new THREE.Group(); g.position.set(x, 0, -z); g.scale.setScalar(k); g.rotation.y = -Math.sign(x) * .5; scene.add(g);
    const ball = (r, y) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), snow); m.position.y = y; m.castShadow = true; g.add(m); return m; };
    ball(.9, .8); ball(.65, 2.0); ball(.45, 2.95);
    for (const ex of [-.16, .16]) { const e = new THREE.Mesh(new THREE.SphereGeometry(.06, 8, 6), coal); e.position.set(ex, 3.07, .39); g.add(e); }
    for (const by of [1.75, 2.05, 2.35]) { const b = new THREE.Mesh(new THREE.SphereGeometry(.07, 8, 6), coal); b.position.set(0, by, .62 - Math.abs(by - 2.0) * .3); g.add(b); }
    const nose = new THREE.Mesh(new THREE.ConeGeometry(.08, .45, 8), carrot); nose.rotation.x = Math.PI / 2; nose.position.set(0, 2.93, .62); g.add(nose);
    const sc2 = new THREE.Mesh(new THREE.TorusGeometry(.48, .11, 8, 20), scarfM); sc2.rotation.x = Math.PI / 2; sc2.position.y = 2.55; g.add(sc2);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(.5, .5, .06, 18), hatM); brim.position.y = 3.33; g.add(brim);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(.32, .32, .55, 18), hatM); top.position.y = 3.62; g.add(top);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(.335, .335, .1, 18), scarfM); band.position.y = 3.42; g.add(band);
    for (const sx of [-1, 1]) { const arm = new THREE.Mesh(new THREE.CylinderGeometry(.03, .045, 1.1, 5), stick); arm.position.set(sx * .95, 2.2, 0); arm.rotation.z = sx * -1.0; g.add(arm); }
  });
  // 선물 상자 (타석 양옆)
  const giftCols = [[0xe0142f, 0xffd23f], [0x1f9e4a, 0xffffff], [0x2a5fd6, 0xff7ad9], [0xffd23f, 0xe0142f], [0x9b1fd6, 0x6bff8b], [0xffffff, 0xe0142f]];
  [[-8.6, -2.4, .9, .5], [-9.7, -3.6, .6, .3], [-8.1, -4.4, .5, .9], [8.7, -2.8, .8, .2], [9.8, -1.6, .55, .7], [9.2, -4.6, .65, .4]].forEach(([x, z, s, ry], i) => {
    const [c1, c2] = giftCols[i % giftCols.length], g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; g.scale.setScalar(s); scene.add(g);
    const box = new THREE.Mesh(new RoundedBoxGeometry(1, .9, 1, 2, .04), XM(c1, { roughness: .5 })); box.position.y = .45; box.castShadow = true; g.add(box);
    const rb = XM(c2, { roughness: .35 });
    const r1 = new THREE.Mesh(new THREE.BoxGeometry(1.02, .92, .16), rb); r1.position.y = .45; g.add(r1);
    const r2 = new THREE.Mesh(new THREE.BoxGeometry(.16, .92, 1.02), rb); r2.position.y = .45; g.add(r2);
    for (const a of [-.7, .7]) { const bow = new THREE.Mesh(new THREE.TorusGeometry(.17, .05, 8, 16), rb); bow.position.set(Math.sin(a) * .14, 1.0, 0); bow.rotation.set(0, Math.PI / 2, a); g.add(bow); }
  });
}
// 바다: 야자수 전구 · 빙산 · 펭귄 · 산타 썰매
function xmasSea(tr, N, L) {
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color(), per = MOBILE ? 10 : 16, lean = .18;
  const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshBasicMaterial({ toneMapped: false }), N * per); let ib = 0;
  for (let i = 0; i < N; i++) {
    tr.getMatrixAt(i, m4);
    for (let k = 0; k < per; k++) {   // 줄기를 빙빙 감은 전구
      const t = .08 + k / per * .86, a = k * 1.9, rr = .1 - .04 * t;
      const p = V(Math.cos(a) * rr - Math.sin(lean) * t, Math.cos(lean) * t, Math.sin(a) * rr).applyMatrix4(m4);
      bulbs.setMatrixAt(ib, new THREE.Matrix4().compose(p, q, V(.17, .17, .17))); bulbs.setColorAt(ib++, col.set(BULB_COLS[k % BULB_COLS.length]).multiplyScalar(2.4));
    }
  }
  bulbs.count = ib; scene.add(bulbs);
  // 빙산 (OB 바깥 바다)
  const ice = new THREE.MeshStandardMaterial({ color: 0xdff3ff, roughness: .35, flatShading: true, envMap: ENV_TEX, envMapIntensity: .8 });
  for (let i = 0; i < 30; i++) {
    const side = i % 2 ? 1 : -1, g = new THREE.IcosahedronGeometry(1, 1), p = g.attributes.position;
    for (let k = 0; k < p.count; k++) { const j = .75 + xr() * .5; p.setXYZ(k, p.getX(k) * j, Math.max(-.2, p.getY(k)) * j, p.getZ(k) * j); }
    g.computeVertexNormals();
    const w = 6 + xr() * 16, m = new THREE.Mesh(g, ice); m.scale.set(w, w * (.45 + xr() * .5), w * (.7 + xr() * .5));
    m.position.set(side * (90 + xr() * 300), -.5, -(SEA_AT + 20 + xr() * (L - 40))); m.rotation.y = xr() * 6.28; scene.add(m);
  }
  // 펭귄 (눈 덮인 해변에 3마리씩 · 산타 모자)
  const black = XM(0x1a1c24, { roughness: .5 }), white = XM(0xf4f6fa, { roughness: .6 }), beak = XM(0xffa31a, { roughness: .5 }), hatRed = XM(0xe0142f);
  [[-46, 560], [50, 640], [-52, 730], [45, 820], [-48, 905], [54, 965]].forEach(([cx, cz]) => {
    for (let k = 0; k < 3; k++) {
      const g = new THREE.Group(); g.position.set(cx + (xr() - .5) * 6, 0, -(cz + (xr() - .5) * 6)); g.rotation.y = (xr() - .5) * 1.5 - Math.sign(cx) * .4; g.scale.setScalar(.9 + xr() * .6); scene.add(g);
      const body = new THREE.Mesh(new THREE.SphereGeometry(.45, 16, 12), black); body.scale.set(1, 1.5, .9); body.position.y = .68; body.castShadow = true; g.add(body);
      const belly = new THREE.Mesh(new THREE.SphereGeometry(.36, 16, 12), white); belly.scale.set(1, 1.45, .8); belly.position.set(0, .62, .14); g.add(belly);
      const head = new THREE.Mesh(new THREE.SphereGeometry(.3, 16, 12), black); head.position.y = 1.45; g.add(head);
      for (const ex of [-.11, .11]) { const e = new THREE.Mesh(new THREE.SphereGeometry(.06, 8, 6), white); e.position.set(ex, 1.52, .25); g.add(e); }
      const bk = new THREE.Mesh(new THREE.ConeGeometry(.07, .22, 8), beak); bk.rotation.x = Math.PI / 2; bk.position.set(0, 1.42, .33); g.add(bk);
      for (const fx of [-.15, .15]) { const f = new THREE.Mesh(new THREE.BoxGeometry(.16, .05, .26), beak); f.position.set(fx, .03, .1); g.add(f); }
      for (const sx of [-1, 1]) { const w = new THREE.Mesh(new THREE.SphereGeometry(.12, 8, 6), black); w.scale.set(.4, 2.2, 1); w.position.set(sx * .45, .78, 0); w.rotation.z = sx * .35; g.add(w); }
      const santaHat = new THREE.Mesh(new THREE.ConeGeometry(.22, .4, 12), hatRed); santaHat.position.y = 1.85; santaHat.rotation.z = .3; g.add(santaHat);
      const pom = new THREE.Mesh(new THREE.SphereGeometry(.07, 8, 6), white); pom.position.set(-.1, 2.03, 0); g.add(pom);
    }
  });
  // 산타 썰매 (루돌프 4마리 · 바다 위 하늘을 빙글빙글)
  const sleigh = new THREE.Group(); scene.add(sleigh);
  const red = XM(0xd0142c, { roughness: .45 }), gold = XM(0xffc83a, { metalness: .8, roughness: .3 }), brown = XM(0x7a4a26, { roughness: .8 }), fur = XM(0xffffff, { roughness: .9 });
  const S2 = new THREE.Group(); S2.scale.setScalar(3); sleigh.add(S2);
  const seat = new THREE.Mesh(new RoundedBoxGeometry(1.6, .8, 2.4, 2, .15), red); seat.position.y = .9; S2.add(seat);
  const back = new THREE.Mesh(new RoundedBoxGeometry(1.6, 1.2, .3, 2, .1), red); back.position.set(0, 1.4, -1.1); S2.add(back);
  for (const sx of [-.7, .7]) { const run = new THREE.Mesh(new THREE.BoxGeometry(.1, .1, 3.2), gold); run.position.set(sx, .3, .1); S2.add(run); const tip = new THREE.Mesh(new THREE.TorusGeometry(.3, .05, 6, 12, Math.PI), gold); tip.rotation.y = Math.PI / 2; tip.position.set(sx, .6, 1.7); S2.add(tip); for (const lz of [-.8, .6]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(.08, .5, .08), gold); leg.position.set(sx, .55, lz); S2.add(leg); } }
  const santa = new THREE.Mesh(new THREE.SphereGeometry(.5, 16, 12), red); santa.position.set(0, 1.7, -.3); santa.scale.set(1, 1.1, 1); S2.add(santa);
  const face = new THREE.Mesh(new THREE.SphereGeometry(.3, 14, 10), XM(0xffc9a8)); face.position.set(0, 2.35, -.25); S2.add(face);
  const beard = new THREE.Mesh(new THREE.SphereGeometry(.3, 14, 10), fur); beard.scale.set(1, 1.1, .7); beard.position.set(0, 2.1, -.05); S2.add(beard);
  const hat = new THREE.Mesh(new THREE.ConeGeometry(.3, .6, 12), red); hat.position.set(0, 2.75, -.3); hat.rotation.x = -.3; S2.add(hat);
  const sack = new THREE.Mesh(new THREE.SphereGeometry(.55, 12, 10), XM(0x8a5a2b)); sack.position.set(0, 1.6, -1.6); S2.add(sack);
  const noseMat = new THREE.MeshBasicMaterial({ color: glow(0xff2020, 3), toneMapped: false }), antM = XM(0xd9c09a);
  for (let k = 0; k < 4; k++) {
    const d = new THREE.Group(); d.position.set((k % 2 ? .6 : -.6), 1.2, 2.6 + Math.floor(k / 2) * 2); S2.add(d);
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(.3, .9, 4, 8), brown); body.rotation.x = Math.PI / 2; d.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(.22, 10, 8), brown); head.position.set(0, .45, .65); d.add(head);
    for (const lx of [-.15, .15]) for (const lz of [-.35, .35]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, .6, 5), brown); leg.position.set(lx, -.4, lz); leg.rotation.x = lz > 0 ? -.6 : .6; d.add(leg); }
    for (const ax of [-.12, .12]) { const ant = new THREE.Mesh(new THREE.CylinderGeometry(.025, .03, .45, 4), antM); ant.position.set(ax, .75, .55); ant.rotation.z = ax * 4; d.add(ant); }
    if (k >= 2) { const nose = new THREE.Mesh(new THREE.SphereGeometry(.08, 8, 6), noseMat); nose.position.set(0, .45, .88); d.add(nose); }   // 맨 앞 루돌프는 빨간 코
  }
  xmasAnim.push((now) => {
    const a = now / 9000, cz = -(SEA_AT + L * .45), R = 170;
    sleigh.position.set(Math.cos(a) * R, 55 + Math.sin(now / 1300) * 4, cz + Math.sin(a) * R * .6);
    const dx = -Math.sin(a) * R, dz = Math.cos(a) * R * .6; sleigh.rotation.y = Math.atan2(dx, dz);   // 가는 쪽을 봐요
  });
}
// 눈 내리기 (카메라 주변 상자 안에서 계속 돌아요 · 숲 · 바다에서만)
if (XMAS) {
  const NF = MOBILE ? 900 : 2200, B = V(50, 22, 70), pos = new Float32Array(NF * 3), raw = new Float32Array(NF * 3), spd = new Float32Array(NF);
  for (let i = 0; i < NF; i++) { raw[i * 3] = (xr() * 2 - 1) * B.x; raw[i * 3 + 1] = (xr() * 2 - 1) * B.y; raw[i * 3 + 2] = (xr() * 2 - 1) * B.z; spd[i] = 1.2 + xr() * 1.6; }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const flakeTex = canvasTex(32, 32, (g, w, h) => { const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.5, 'rgba(255,255,255,.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
  const flakes = new THREE.Points(geo, new THREE.PointsMaterial({ size: .22, map: flakeTex, transparent: true, depthWrite: false, color: 0xffffff }));
  flakes.frustumCulled = false; scene.add(flakes);
  const wrap = (v, b) => ((v + b) % (2 * b) + 2 * b) % (2 * b) - b;
  xmasAnim.push((now, dt) => {
    const cam = camera.position, on = cam.z > -(SKY_AT - 40); flakes.visible = on; if (!on) return;
    const t = now / 1000;
    for (let i = 0; i < NF; i++) {
      raw[i * 3 + 1] -= spd[i] * dt; raw[i * 3] += Math.sin(t + i) * .35 * dt;
      pos[i * 3] = cam.x + wrap(raw[i * 3] - cam.x, B.x);
      pos[i * 3 + 1] = cam.y + 4 + wrap(raw[i * 3 + 1] - cam.y - 4, B.y);
      pos[i * 3 + 2] = cam.z + wrap(raw[i * 3 + 2] - cam.z, B.z);
    }
    geo.attributes.position.needsUpdate = true;
  });
}

/* ── 거리 표지판 · 나무 · 조명탑 ─────────────────────── */
{
  const postMat = new THREE.MeshStandardMaterial({ color: 0x241c38, roughness: .7 });
  for (let z = 50; z <= RANGE; z += 50) {
    const big = z % 100 === 0, col = big ? '#ffd23f' : '#2de2e6';
    const tex = canvasTex(256, 112, (g, w, h) => {
      g.fillStyle = '#0a021e'; g.fillRect(0, 0, w, h);
      g.strokeStyle = col; g.lineWidth = 8; g.strokeRect(6, 6, w - 12, h - 12);
      g.fillStyle = col; g.font = '700 70px Rajdhani, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(z + 'm', w / 2, h / 2 + 4);
    });
    for (const side of big ? [-1, 1] : [-1]) {
      const w = big ? 9 : 7, hh = w * 112 / 256, top = big ? 7 : 5.5;
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(w, hh), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, color: new THREE.Color(1.5, 1.5, 1.5) }));
      sign.position.set(side * 38, top, -z); sign.rotation.y = side * -0.25; scene.add(sign);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(.18, .18, top, 6), postMat); post.position.set(side * 38, top / 2 - hh / 2, -z); scene.add(post);
    }
  }
  // 나무: 소나무(3단 잎 + 줄기)와 둥근 활엽수, 그루마다 색이 조금씩 달라요 (키 1 기준 모양)
  let s = 5; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const layer = (rad, h, y) => { const g = new THREE.ConeGeometry(rad, h, 9); g.translate(0, y + h / 2, 0); return g; };
  const pineGeo = mergeGeometries([layer(.40, .44, .16), layer(.32, .40, .38), layer(.22, .36, .62)]);
  const blobGeo = new THREE.IcosahedronGeometry(.36, 1); { const p = blobGeo.attributes.position; for (let i = 0; i < p.count; i++) { const k = 1 + (r() - .5) * .22; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * .9 + .62, p.getZ(i) * k); } blobGeo.computeVertexNormals(); }
  const trunkGeo = new THREE.CylinderGeometry(.03, .05, .5, 6); trunkGeo.translate(0, .25, 0);
  const leafMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .9, flatShading: true, envMapIntensity: 0 });
  const MAXT = 700, pines = new THREE.InstancedMesh(pineGeo, leafMat, MAXT), blobs = new THREE.InstancedMesh(blobGeo, leafMat, MAXT);
  const trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshStandardMaterial({ color: 0x5a4030, roughness: 1 }), MAXT * 2);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color(); let np = 0, nb = 0, nt = 0;
  for (let z = 10; z < SEA_AT - 10; z += 8 + r() * 11) for (const side of [-1, 1]) {
    if (r() < .12) continue;
    const pine = XMAS || r() < .62, h = pine ? 9 + r() * 11 : 7 + r() * 6, w = h * (pine ? .75 + r() * .2 : .95 + r() * .25);
    if (pine ? np >= MAXT : nb >= MAXT) continue;
    q.setFromAxisAngle(UP, r() * 6.28); m4.compose(V(side * (OB_X + 7 + r() * 60), 0, -z - r() * 8), q, V(w, h, w));
    if (pine) { pines.setMatrixAt(np, m4); pines.setColorAt(np++, col.setHSL(.33 + r() * .05, .42 + r() * .15, .22 + r() * .08)); }
    else { blobs.setMatrixAt(nb, m4); blobs.setColorAt(nb++, col.setHSL(.22 + r() * .08, .45 + r() * .15, .3 + r() * .1)); }
    trunks.setMatrixAt(nt++, m4);
  }
  pines.count = np; blobs.count = nb; trunks.count = nt; scene.add(pines, blobs, trunks);
  if (XMAS) xmasTrees(pines, np);
  // 조명탑 (🎄 빨강·하양 사탕 지팡이 줄무늬)
  const candyMat = XMAS ? new THREE.MeshStandardMaterial({ map: candyTex(), roughness: .4 }) : null;
  const headMat = new THREE.MeshStandardMaterial({ color: 0xe8eef5, roughness: .4 });   // 낮이라 조명은 꺼져 있어요
  for (let z = 60; z < SEA_AT; z += 120) for (const side of [-1, 1]) {
    const x = side * (OB_X + 5);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(.3, .45, 24, XMAS ? 12 : 6), XMAS ? candyMat : postMat); pole.position.set(x, 12, -z); scene.add(pole);
    const head = new THREE.Mesh(new THREE.BoxGeometry(4, 1.6, .6), headMat); head.position.set(x, 24, -z); head.rotation.y = side * .3; scene.add(head);
  }
}

/* ── 스폰서 광고: 청암대학교 광고판 2개 (페어웨이 양옆 높이) · 티 옆 "물리치료과" 바닥 간판 ── */
{
  const logo = new THREE.TextureLoader().load('img/cheongam-logo.png');   // 청암대학교 로고 (흰 바탕)
  logo.colorSpace = THREE.SRGBColorSpace; logo.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x0d3b66, roughness: .5, metalness: .3 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x3fb54a, emissive: 0x3fb54a, emissiveIntensity: .35, roughness: .4 });
  const legMat = new THREE.MeshStandardMaterial({ color: 0x3a3f4a, roughness: .6, metalness: .5 });
  const W = 24, H = W * 183 / 502, BOTTOM = 9;
  for (const side of [-1, 1]) {
    const g = new THREE.Group(); g.position.set(side * 31, 0, -115); g.rotation.y = side * -.25; scene.add(g);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(W + 1.2, H + 1.2, .6), frameMat); frame.position.y = BOTTOM + H / 2; frame.castShadow = true; g.add(frame);
    const trim = new THREE.Mesh(new THREE.BoxGeometry(W + 1.4, .35, .7), trimMat); trim.position.y = BOTTOM - .45; g.add(trim);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ map: logo, color: new THREE.Color(.84, .84, .84) /* 블룸(빛 번짐) 기준보다 살짝 어둡게 → 로고가 또렷 */ }));
    face.position.set(0, BOTTOM + H / 2, .31); g.add(face);
    for (const lx of [-W * .25, W * .25]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(.6, BOTTOM, .6), legMat); leg.position.set(lx, BOTTOM / 2, -.1); leg.castShadow = true; g.add(leg); }
  }
  // 티 옆 바닥 간판 (뒤로 비스듬히 누운 세모 간판)
  // 글꼴(Pretendard)을 다 받은 뒤에 다시 그려요 — 안 그러면 일부 글자만 다른 글꼴로 나와요
  const signCv = document.createElement('canvas'); signCv.width = 1024; signCv.height = 400;
  const F1 = '800 188px "Pretendard Variable", Pretendard, sans-serif', F2 = '600 38px "Pretendard Variable", Pretendard, sans-serif';
  const drawSign = () => {
    const c = signCv.getContext('2d'), w = signCv.width, h = signCv.height;
    const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#1b2f6b'); gr.addColorStop(1, '#0f1d47');
    c.fillStyle = gr; c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 4; c.strokeRect(18, 18, w - 36, h - 36);
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = '#ffffff'; c.font = F1; c.fillText('물리치료과', w / 2, h / 2 - 18);
    c.fillStyle = '#c9d3ea'; c.font = F2; c.fillText('CHEONGAM UNIV.  PHYSICAL THERAPY', w / 2, h - 66);
  };
  drawSign();
  const tex = new THREE.CanvasTexture(signCv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  Promise.all([document.fonts.load(F1, '물리치료과'), document.fonts.load(F2, 'CHEONGAM UNIV. PHYSICAL THERAPY')])
    .then(() => { drawSign(); tex.needsUpdate = true; }).catch(() => {});
  const sg = new THREE.Group(); sg.position.set(-3.6, 0, -14); sg.rotation.y = .22; scene.add(sg);   // 타석 앞 왼쪽 잔디
  const SW = 3.2, SH = 1.25, tilt = .55;   // 폭 · 경사면 길이 · 뒤로 누운 각도
  const d = Math.sin(tilt) * SH, h = Math.cos(tilt) * SH;   // 옆에서 본 세모: 앞 아래 (0,0) · 뒤 아래 (-d,0) · 뒤 위 (-d,h)
  const wedge = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(-d, 0), new THREE.Vector2(-d, h)]);
  const body = new THREE.Mesh(new THREE.ExtrudeGeometry(wedge, { depth: SW, bevelEnabled: false }), new THREE.MeshStandardMaterial({ color: 0x0b1638, roughness: .6 }));
  body.rotation.y = -Math.PI / 2; body.position.x = SW / 2; body.castShadow = true; sg.add(body);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(SW, SH), new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(.88, .88, .88) /* 형광 빛 번짐 없이 */ }));
  face.rotation.x = -tilt; face.position.set(0, h / 2 + Math.sin(tilt) * .012, -d / 2 + Math.cos(tilt) * .012); sg.add(face);
}
/* ── 바깥 풍경 2: 500m~ 바다 (모래사장 · 야자수 · 파도) ───────────────────── */
let water = null;
{
  const L = SKY_AT - SEA_AT, zc = -(SEA_AT + L / 2);
  // 모래사장 (페어웨이 옆 32m ~ OB 70m)
  const sandTex = canvasTex(64, 64, (g, w, h) => { g.fillStyle = XMAS ? '#c8d3df' : '#e9d6a6'; g.fillRect(0, 0, w, h); }, [1, 1]);   // 🎄 눈 덮인 모래
  const sandMat = grassify(new THREE.MeshStandardMaterial({ map: sandTex, roughness: 1 }), 1 / 4, .35, 1 / 40, .5);
  for (const side of [-1, 1]) {
    const sd = new THREE.Mesh(new THREE.PlaneGeometry(OB_X - 32 + 6, L), sandMat); sd.rotation.x = -Math.PI / 2; sd.position.set(side * (32 + (OB_X - 32 + 6) / 2), .005, zc); sd.receiveShadow = true; scene.add(sd);
  }
  // 바다 (OB 바깥) · 반짝이는 물결
  const waveTex = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = XMAS ? '#16619e' : '#1f7fc4'; g.fillRect(0, 0, w, h);   // 🎄 차가운 겨울 바다
    for (let i = 0; i < 260; i++) {
      const x = Math.random() * w, y = Math.random() * h, l = 6 + Math.random() * 22, a = .25 + Math.random() * .5;
      g.strokeStyle = Math.random() < .3 ? `rgba(255,255,255,${a})` : `rgba(120,200,255,${a})`; g.lineWidth = 1 + Math.random() * 1.5;
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + l / 2, y - 2, x + l, y); g.stroke();
    }
  }, [60, 30]);
  water = new THREE.Mesh(new THREE.PlaneGeometry(2400, L + 40), new THREE.MeshStandardMaterial({ map: waveTex, roughness: .2, metalness: .1, envMap: ENV_TEX, envMapIntensity: 1.4 }));
  water.rotation.x = -Math.PI / 2; water.position.set(0, -.35, zc); scene.add(water);
  // 하얀 파도 (모래사장 끝)
  const foam = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .75 });
  for (const side of [-1, 1]) { const f = new THREE.Mesh(new THREE.PlaneGeometry(1.6, L), foam); f.rotation.x = -Math.PI / 2; f.position.set(side * (OB_X + 6.6), -.3, zc); scene.add(f); }
  // 야자수 (모래사장 바깥쪽)
  let s = 31; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const trunkG = new THREE.CylinderGeometry(.05, .09, 1, 6); trunkG.translate(0, .5, 0); trunkG.rotateZ(.18);
  const leaves = []; for (let k = 0; k < 7; k++) { const g = new THREE.ConeGeometry(.09, .62, 4); g.rotateZ(Math.PI / 2 + .5); g.translate(.3, -.1, 0); g.rotateY(k / 7 * Math.PI * 2); g.translate(-.18, 1.02, 0); leaves.push(g); }
  const leafG = mergeGeometries(leaves); leafG.scale(1, .55, 1).translate(0, .45, 0);
  const N = 60, tr = new THREE.InstancedMesh(trunkG, new THREE.MeshStandardMaterial({ color: 0x8a6a45, roughness: 1, flatShading: true }), N), lf = new THREE.InstancedMesh(leafG, new THREE.MeshStandardMaterial({ color: 0x3f9a3a, roughness: .9, flatShading: true }), N);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
  for (let i = 0; i < N; i++) {
    const side = i % 2 ? 1 : -1, z = -(SEA_AT + 10 + r() * (L - 20)), h = 7 + r() * 5;
    q.setFromAxisAngle(UP, r() * 6.28); m4.compose(V(side * (56 + r() * 14), 0, z), q, V(h, h, h)); tr.setMatrixAt(i, m4); lf.setMatrixAt(i, m4);
  }
  scene.add(tr, lf);
  if (XMAS) xmasSea(tr, N, L);
}
/* ── 바깥 풍경 3: 1000m~ 하늘 (페어웨이가 구름 위에 떠 있어요) ───────────────── */
const skyZone = new THREE.Group(); scene.add(skyZone);
const cloudLayer = new THREE.Group(); scene.add(cloudLayer);   // 구름 바다 (우주 구역에서는 숨겨요)
{
  const L = RANGE + 300 - SKY_AT, zc = -(SKY_AT + L / 2);
  const puffTex = (n, sz, base, big = 1) => canvasTex(sz, sz, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let i = 0; i < n; i++) {
      const x = Math.random() * w, y = Math.random() * h, rr = w * (.04 + Math.random() * .09) * big;
      for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) {
        const gr = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, rr); gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(.6, 'rgba(240,246,255,.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr; g.fillRect(x + dx - rr, y + dy - rr, rr * 2, rr * 2);
      }
    }
  });
  // 페어웨이 옆 잔디 (32m ~ OB): 구름 위에 떠 있는 잔디 섬
  for (const side of [-1, 1]) {
    const c = new THREE.Mesh(new THREE.PlaneGeometry(OB_X - 32 + 6, L), ground.material); c.rotation.x = -Math.PI / 2; c.position.set(side * (32 + (OB_X - 32 + 6) / 2), .005, zc); c.receiveShadow = true; skyZone.add(c);
  }
  // 페어웨이 아래 두께 (떠 있는 섬처럼)
  const slab = new THREE.Mesh(new THREE.BoxGeometry(OB_X * 2 + 12, 6, L), new THREE.MeshStandardMaterial({ color: 0x6b5340, roughness: 1 })); slab.position.set(0, -3.02, zc); skyZone.add(slab);
  const rim = new THREE.Mesh(new THREE.BoxGeometry(OB_X * 2 + 12.4, .6, L), new THREE.MeshStandardMaterial({ color: 0x2f7a35, roughness: 1 })); rim.position.set(0, -.31, zc); skyZone.add(rim);
  // 아래로 펼쳐진 구름 바다
  const seaTex = puffTex(30, 512, '#4f8ad3', 1.5); seaTex.repeat.set(6, 7);
  const cloudSea = new THREE.Mesh(new THREE.PlaneGeometry(5000, L + 2400), new THREE.MeshBasicMaterial({ map: seaTex, color: new THREE.Color(.9, .92, .96) }));
  cloudSea.rotation.x = -Math.PI / 2; cloudSea.position.set(0, -90, zc - 600); cloudLayer.add(cloudSea);
  // 길 옆 둥실 구름
  const ct = canvasTex(256, 128, (g, w, h) => { for (let i = 0; i < 16; i++) { const x = w * (.15 + Math.random() * .7), y = h * (.5 + Math.random() * .2), rr = h * (.15 + Math.random() * .2); const gr = g.createRadialGradient(x, y, 0, x, y, rr); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, rr, 0, 7); g.fill(); } });
  let s = 47; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 30; i++) {
    const side = i % 2 ? 1 : -1, sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: ct, depthWrite: false, transparent: true, opacity: .8 }));
    const w = 40 + r() * 70; sp.scale.set(w, w * .45, 1); const below = i % 3 !== 2; sp.position.set(side * (below ? 85 + r() * 120 : 200 + r() * 260), below ? -38 + r() * 22 : -70 + r() * 40, -(SKY_AT + r() * (SPACE_AT - SKY_AT))); cloudLayer.add(sp);
  }
}
/* ── 바깥 풍경 4: 1500m~ 우주 (별 · 지구 · 고리 행성 · 달 · 소행성) ───────────────── */
const spaceZone = new THREE.Group(); scene.add(spaceZone); spaceZone.visible = false;
const spaceSky = new THREE.Group(); far.add(spaceSky); spaceSky.visible = false;   // 카메라를 따라다니는 우주 하늘
{
  spaceSky.add(new THREE.Mesh(new THREE.SphereGeometry(2900, 32, 20), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `varying vec3 vP;
      void main(){
        float band = exp(-pow((vP.y * .9 + vP.x * .45) * 3.2, 2.0));   // 은하수 띠
        vec3 c = mix(vec3(.006, .008, .03), vec3(.05, .025, .11), band);
        c += vec3(.02, .05, .09) * band * (.5 + .5 * sin(vP.z * 9.0 + vP.x * 5.0));
        gl_FragColor = vec4(c, 1.0);
      }`,
  })));
  spaceSky.children[0].renderOrder = -10;
  let s = 101; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const N = MOBILE ? 1800 : 3500, pos = new Float32Array(N * 3), col = new Float32Array(N * 3), c = new THREE.Color();
  for (let i = 0; i < N; i++) {
    const u = r() * 2 - 1, a = r() * Math.PI * 2, rr = Math.sqrt(1 - u * u);
    pos.set([Math.cos(a) * rr * 2500, u * 2500, Math.sin(a) * rr * 2500], i * 3);
    c.setHSL(.55 + r() * .2, .5, .7 + r() * .3).multiplyScalar(.5 + r() * .9); col.set([c.r, c.g, c.b], i * 3);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  spaceSky.add(new THREE.Points(g, new THREE.PointsMaterial({ size: 2.2, sizeAttenuation: false, vertexColors: true, fog: false, depthWrite: false, toneMapped: false })));

  // 지구 (아래 왼쪽에 크게)
  const earthTex = canvasTex(1024, 512, (g, w, h) => {
    g.fillStyle = '#1c5fb8'; g.fillRect(0, 0, w, h);
    const blob = (n, col, rmin, rmax) => { for (let i = 0; i < n; i++) { const x = r() * w, y = h * (.15 + r() * .7), rr = rmin + r() * (rmax - rmin); g.fillStyle = col; g.beginPath(); g.ellipse(x, y, rr * 1.6, rr, r() * 3, 0, 7); g.fill(); } };
    blob(26, '#3f8f3a', 20, 70); blob(18, '#8a7a45', 10, 34); blob(14, '#2f7a33', 12, 40);
    g.fillStyle = '#f2f6ff'; g.fillRect(0, 0, w, h * .07); g.fillRect(0, h * .93, w, h * .07);
    g.globalAlpha = .55; for (let i = 0; i < 90; i++) { g.strokeStyle = '#ffffff'; g.lineWidth = 3 + r() * 9; const x = r() * w, y = r() * h; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 40, y - 12, x + 60 + r() * 90, y + (r() - .5) * 20); g.stroke(); }
    g.globalAlpha = 1;
  });
  const earth = new THREE.Mesh(new THREE.SphereGeometry(650, 48, 32), new THREE.MeshStandardMaterial({ map: earthTex, roughness: .8, fog: false }));
  earth.position.set(-1250, -420, -3000); earth.rotation.z = .35; spaceZone.add(earth);
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(690, 48, 32), new THREE.MeshBasicMaterial({ color: glow(0x6fb7ff, 1.2), transparent: true, opacity: .22, side: THREE.BackSide, fog: false, depthWrite: false, toneMapped: false }));
  atmo.position.copy(earth.position); spaceZone.add(atmo);
  spaceZone.userData.earth = earth;
  // 고리 행성 (멀리 오른쪽 위)
  const bandTex = canvasTex(64, 256, (g, w, h) => { for (let y = 0; y < h; y += 4) { g.fillStyle = `hsl(${28 + r() * 16},${55 + r() * 20}%,${48 + r() * 18}%)`; g.fillRect(0, y, w, 4); } });
  const ringed = new THREE.Mesh(new THREE.SphereGeometry(190, 40, 28), new THREE.MeshStandardMaterial({ map: bandTex, roughness: .9, fog: false }));
  ringed.position.set(950, 380, -3500); ringed.rotation.z = .4; spaceZone.add(ringed);
  const ringTex = canvasTex(256, 8, (g, w, h) => { for (let x = 0; x < w; x++) { g.fillStyle = `rgba(230,200,150,${(.25 + r() * .6) * (x > 18 && x < w - 6 ? 1 : 0)})`; g.fillRect(x, 0, 1, h); } });
  const ringGeo = new THREE.RingGeometry(250, 430, 96, 1); { const uv = ringGeo.attributes.uv, p = ringGeo.attributes.position; for (let i = 0; i < uv.count; i++) { const d = Math.hypot(p.getX(i), p.getY(i)); uv.setXY(i, (d - 250) / 180, .5); } }
  const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ map: ringTex, transparent: true, side: THREE.DoubleSide, fog: false, depthWrite: false }));
  ring.position.copy(ringed.position); ring.rotation.set(-1.2, .25, .4); spaceZone.add(ring);
  // 달
  const moonTex = canvasTex(256, 128, (g, w, h) => { g.fillStyle = '#b9b9c2'; g.fillRect(0, 0, w, h); for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(90,90,105,${.2 + r() * .35})`; g.beginPath(); g.arc(r() * w, r() * h, 2 + r() * 10, 0, 7); g.fill(); } });
  const moon = new THREE.Mesh(new THREE.SphereGeometry(70, 32, 20), new THREE.MeshStandardMaterial({ map: moonTex, roughness: 1, fog: false }));
  moon.position.set(-520, 260, -2050); spaceZone.add(moon);
  // 소행성 (길 옆에 둥둥)
  const rockGeo = new THREE.IcosahedronGeometry(1, 0); { const p = rockGeo.attributes.position; for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) * (.8 + r() * .4), p.getY(i) * (.7 + r() * .4), p.getZ(i) * (.8 + r() * .4)); rockGeo.computeVertexNormals(); }
  const NR = MOBILE ? 45 : 90, rocks = new THREE.InstancedMesh(rockGeo, new THREE.MeshStandardMaterial({ color: 0x8d8170, roughness: 1, flatShading: true }), NR);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  for (let i = 0; i < NR; i++) {
    const side = i % 2 ? 1 : -1, sc = 2 + Math.pow(r(), 2) * 16;
    q.setFromEuler(e.set(r() * 6, r() * 6, r() * 6)); m4.compose(V(side * (95 + r() * 420), -140 + r() * 260, -(SPACE_AT + r() * (RANGE + 300 - SPACE_AT))), q, V(sc, sc, sc)); rocks.setMatrixAt(i, m4);
  }
  spaceZone.add(rocks);
}
/* ── 바깥 풍경 5: 3000m~ 네온 차원 (우주의 워프 게이트를 지나면 나오는 신스웨이브 세계) ─────────
 *  보라·핑크 하늘 · 줄무늬 레트로 해 · 아래로 끝없는 네온 격자 · 와이어 산 · 빙글빙글 도는 네온 도형 */
const neonZone = new THREE.Group(); scene.add(neonZone); neonZone.visible = false;
const neonSky = new THREE.Group(); far.add(neonSky); neonSky.visible = false;   // 카메라를 따라다니는 하늘 · 해
const neonSpin = [];   // 빙글빙글 도는 도형
{
  let s = 303; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const L = RANGE + 300 - NEON_AT, zc = -(NEON_AT + L / 2);
  // 하늘: 위는 깊은 남색 → 지평선은 핫핑크
  const skyM = new THREE.Mesh(new THREE.SphereGeometry(2900, 32, 20), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `varying vec3 vP;
      void main(){
        float y = vP.y;
        vec3 top = vec3(.02, .01, .07), mid = vec3(.22, .03, .32), hor = vec3(1.0, .18, .55);
        vec3 c = y > .05 ? mix(mid, top, smoothstep(.05, .6, y)) : mix(hor, mid, smoothstep(-.12, .05, y));
        if (y < -.12) c = mix(hor * .6, vec3(.05, .0, .1), smoothstep(-.12, -.45, y));
        gl_FragColor = vec4(c, 1.0);
      }`,
  }));
  skyM.renderOrder = -10; neonSky.add(skyM);
  // 별 (작게)
  const N = MOBILE ? 600 : 1200, pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { const u = .1 + r() * .9, a = r() * Math.PI * 2, rr = Math.sqrt(1 - u * u); pos.set([Math.cos(a) * rr * 2500, u * 2500, Math.sin(a) * rr * 2500], i * 3); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  neonSky.add(new THREE.Points(sg, new THREE.PointsMaterial({ size: 1.8, sizeAttenuation: false, color: 0xffd6f5, fog: false, depthWrite: false })));
  // 레트로 해 (노랑 → 핑크, 아래쪽은 가로 줄무늬로 잘려 있어요)
  const sunT = canvasTex(512, 512, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#fff36b'); gr.addColorStop(.5, '#ff9f1c'); gr.addColorStop(1, '#ff2e88');
    g.fillStyle = gr; g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 4, 0, 7); g.fill();
    g.globalCompositeOperation = 'destination-out';
    for (let k = 0; k < 8; k++) { const y = h * (.52 + k * .06), t = 4 + k * 3.2; g.fillRect(0, y, w, t); }
  });
  const nsun = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunT, fog: false, depthWrite: false, toneMapped: false, color: new THREE.Color(1.5, 1.5, 1.5) }));
  nsun.scale.set(1100, 1100, 1); nsun.position.set(0, 260, -2400); neonSky.add(nsun);
  // 아래로 끝없는 네온 격자 바닥
  const gridT = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#0d0220'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#ff2e88'; g.lineWidth = 6; g.strokeRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255,120,200,.35)'; g.lineWidth = 14; g.strokeRect(0, 0, w, h);
  });
  gridT.wrapS = gridT.wrapT = THREE.RepeatWrapping; gridT.repeat.set(4000 / 40, (L + 2000) / 40); gridT.anisotropy = 8;
  const grid = new THREE.Mesh(new THREE.PlaneGeometry(4000, L + 2000), new THREE.MeshBasicMaterial({ map: gridT, color: new THREE.Color(1.6, 1.6, 1.6), toneMapped: false }));
  grid.rotation.x = -Math.PI / 2; grid.position.set(0, -60, zc - 600); neonZone.add(grid);
  // 페어웨이 옆 땅도 네온 바닥으로 (어두운 보라 + 청록 격자)
  const sideT = canvasTex(64, 64, (g, w, h) => { g.fillStyle = '#1a0638'; g.fillRect(0, 0, w, h); g.strokeStyle = '#2de2e6'; g.lineWidth = 3; g.strokeRect(0, 0, w, h); });
  sideT.wrapS = sideT.wrapT = THREE.RepeatWrapping; sideT.repeat.set((OB_X - 32 + 6) / 8, L / 8); sideT.anisotropy = 8;
  for (const sx of [-1, 1]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(OB_X - 32 + 6, L), new THREE.MeshBasicMaterial({ map: sideT })); p.rotation.x = -Math.PI / 2; p.position.set(sx * (32 + (OB_X - 32 + 6) / 2), .008, zc); neonZone.add(p); }
  // 페어웨이 섬 가장자리 네온 줄 (청록)
  const edgeM = new THREE.MeshBasicMaterial({ color: glow(0x2de2e6, 2.4), toneMapped: false });
  for (const sx of [-1, 1]) {
    const e1 = new THREE.Mesh(new THREE.BoxGeometry(.5, .5, L), edgeM); e1.position.set(sx * (OB_X + 6.2), -.3, zc); neonZone.add(e1);
    const e2 = new THREE.Mesh(new THREE.BoxGeometry(.4, .4, L), edgeM); e2.position.set(sx * (OB_X + 6.2), -6, zc); neonZone.add(e2);
  }
  // 와이어 산 (양옆 멀리, 핑크 · 보라 · 청록 선)
  const mCols = [0xff2e88, 0x9b5cff, 0x2de2e6];
  for (let i = 0; i < 36; i++) {
    const side = i % 2 ? 1 : -1, hgt = 120 + r() * 320, rad = hgt * (1 + r() * .6);
    const geo = new THREE.ConeGeometry(rad, hgt, 4 + Math.floor(r() * 3), 3);
    const col = mCols[i % 3], g = new THREE.Group();
    g.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x14042a })));
    g.add(new THREE.LineSegments(new THREE.WireframeGeometry(geo), new THREE.LineBasicMaterial({ color: glow(col, 2.2), toneMapped: false })));
    g.position.set(side * (380 + r() * 700), -60 + hgt / 2, -(NEON_AT + r() * (L + 800))); g.rotation.y = r() * 6.28; neonZone.add(g);
  }
  // 길 옆에 떠서 빙글빙글 도는 네온 도형 (팔면체 · 도넛 · 정이십면체)
  const shapes = [new THREE.OctahedronGeometry(1), new THREE.TorusGeometry(1, .28, 10, 28), new THREE.IcosahedronGeometry(1), new THREE.TorusKnotGeometry(.8, .22, 64, 8)];
  const sCols = [0xff2e88, 0x2de2e6, 0xffd23f, 0xb6ff3b, 0x9b5cff, 0xff9f1c];
  for (let i = 0; i < 40; i++) {
    const side = i % 2 ? 1 : -1, sc = 4 + r() * 12, col = sCols[i % sCols.length], geo = shapes[i % shapes.length];
    const g = new THREE.Group(); g.scale.setScalar(sc);
    g.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: .18, depthWrite: false })));
    g.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 20), new THREE.LineBasicMaterial({ color: glow(col, 2.6), toneMapped: false })));
    g.position.set(side * (95 + r() * 260), 10 + r() * 90, -(NEON_AT + 40 + r() * (L - 60)));
    g.userData.spin = V((r() - .5) * .8, .3 + r() * .6, (r() - .5) * .5); g.userData.bob = r() * 6;
    neonZone.add(g); neonSpin.push(g);
  }
}
// 우주 → 네온 차원 워프 게이트 (3000m 아치 위에 서 있는 빛나는 고리, 우주 구역에서 보여요)
{
  const gate = new THREE.Group(); gate.position.set(0, 30, -NEON_AT); spaceZone.add(gate);
  const ringM = (c, k) => new THREE.MeshBasicMaterial({ color: glow(c, k), toneMapped: false });
  gate.add(new THREE.Mesh(new THREE.TorusGeometry(62, 2.2, 12, 96), ringM(0xff2e88, 2.6)));
  gate.add(new THREE.Mesh(new THREE.TorusGeometry(56, 1.2, 10, 96), ringM(0x2de2e6, 2.4)));
  const swirlT = canvasTex(512, 512, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(.25, 'rgba(255,90,200,.55)'); gr.addColorStop(.7, 'rgba(120,60,255,.35)'); gr.addColorStop(1, 'rgba(40,0,80,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.translate(w / 2, h / 2); g.strokeStyle = 'rgba(255,255,255,.35)';
    for (let k = 0; k < 6; k++) { g.rotate(Math.PI / 3); g.lineWidth = 6; g.beginPath(); for (let t = 0; t < 1; t += .02) { const a = t * 5, rr = t * w * .48; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } g.stroke(); }
  });
  const swirl = new THREE.Mesh(new THREE.CircleGeometry(56, 64), new THREE.MeshBasicMaterial({ map: swirlT, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
  gate.add(swirl); neonSpin.push(Object.assign(swirl, { userData: { spin: V(0, 0, -1.2), bob: 0, flat: true } }));
}

/* ── 멀리 있는 볼거리: 500m 마다 네온 아치 · 연못 · 열기구 ─────────────── */
{
  const gateCols = { 500: 0x2de2e6, 1000: 0xffd23f, 1500: 0xff2e88, 2000: 0xb6ff3b, 2500: 0x9b5cff, 3000: 0xff9f1c, 3500: 0x2de2e6, 4000: 0xff2e88, 4500: 0xffd23f, 5000: 0xb6ff3b };
  for (const [z, col] of Object.entries(gateCols)) {
    const g = new THREE.Group(); g.position.set(0, 0, -z); scene.add(g);
    const mat = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: .9, roughness: .4 });
    const arch = new THREE.Mesh(new THREE.TorusGeometry(36, .9, 10, 48, Math.PI), mat); g.add(arch);
    for (const sx of [-1, 1]) { const base = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2, 3, 8), new THREE.MeshStandardMaterial({ color: 0x3b3f4a })); base.position.set(sx * 36, 1.5, 0); g.add(base); }
    const tex = canvasTex(512, 160, (c, w, h) => {
      c.fillStyle = '#0a021e'; c.fillRect(0, 0, w, h);
      const hex = '#' + new THREE.Color(col).getHexString();
      c.strokeStyle = hex; c.lineWidth = 10; c.strokeRect(8, 8, w - 16, h - 16);
      c.fillStyle = hex; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.font = '700 92px Rajdhani, Arial, sans-serif'; c.fillText(z + 'm', w / 2, h / 2 - 8);
      c.font = '700 30px Rajdhani, Arial, sans-serif'; c.fillStyle = '#ffffff'; c.fillText(+z === SEA_AT ? 'OCEAN ZONE' : +z === SKY_AT ? 'SKY ZONE' : +z === SPACE_AT ? 'SPACE ZONE' : +z === NEON_AT ? 'NEON ZONE' : +z === RANGE ? 'THE END?!' : z >= 2000 ? 'LEGEND ZONE' : 'NICE SHOT!', w / 2, h - 30);
    });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(20, 6.25), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, side: THREE.DoubleSide, color: new THREE.Color(1.3, 1.3, 1.3) }));
    sign.position.set(0, 36, 0); g.add(sign);
  }
  // 연못 (모래 테두리)
  const water = new THREE.MeshStandardMaterial({ color: 0x3b8fd9, roughness: .08, metalness: .35 });
  const sand = new THREE.MeshStandardMaterial({ color: 0xe6d3a3, roughness: 1 });
  [].forEach(([z, x, r]) => {   // 연못 자리는 바다 · 하늘 구역이 됐어요
    const s1 = new THREE.Mesh(new THREE.CircleGeometry(r + 3, 36), sand); s1.rotation.x = -Math.PI / 2; s1.position.set(x, .02, -z); s1.scale.set(1.5, 1, 1); scene.add(s1);
    const w1 = new THREE.Mesh(new THREE.CircleGeometry(r, 36), water); w1.rotation.x = -Math.PI / 2; w1.position.set(x, .04, -z); w1.scale.set(1.5, 1, 1); scene.add(w1);
  });
  // 모래 벙커 (페어웨이 옆)
  [[300, 26], [520, -27], [720, 25], [1080, -26], [1250, 27], [1700, -25]].forEach(([z, x]) => {
    const b = new THREE.Mesh(new THREE.CircleGeometry(7, 28), sand); b.rotation.x = -Math.PI / 2; b.position.set(x, .03, -z); b.scale.set(1, 1.8, 1); scene.add(b);
  });
  // 열기구
  const stripes = (a, b) => canvasTex(256, 128, (c, w, h) => { for (let k = 0; k < 8; k++) { c.fillStyle = k % 2 ? a : b; c.fillRect(k * w / 8, 0, w / 8 + 1, h); } });
  const looks = [['#ff2e88', '#ffd23f'], ['#2de2e6', '#ffffff'], ['#b6ff3b', '#9b5cff'], ['#ff9f1c', '#ffffff']];
  [[380, -60, 70], [720, 45, 95], [1100, -30, 120], [1380, 70, 85]].forEach(([z, x, y], i) => {
    const [a, b] = looks[i % looks.length];
    const g = new THREE.Group(); g.position.set(x, y, -z); scene.add(g);
    const env = new THREE.Mesh(new THREE.SphereGeometry(9, 24, 18), new THREE.MeshStandardMaterial({ map: stripes(a, b), roughness: .6 })); env.scale.set(1, 1.2, 1); g.add(env);
    const basket = new THREE.Mesh(new THREE.BoxGeometry(3, 2.2, 3), new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: .9 })); basket.position.y = -15; g.add(basket);
    g.userData.bob = i;
    balloons.push(g);
  });
}
/* ═══════════════════════════════════════════════════════════════
 *  학생 골퍼 (과잠 입은 대학생)
 *  캐릭터 자체 좌표: 앞 = +z, 캐릭터의 왼쪽 = +x (= 목표 방향), 발바닥 y = 0
 * ═══════════════════════════════════════════════════════════════ */
const M = (c, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: .75 }, o));
const MAT = {
  skin: M(0xf2c7a5, { roughness: .6 }), hair: M(0x16100d, { roughness: .5 }), jacket: M(0x1f2c72),
  sleeve: M(0xf1e8d4), rib: M(0xff2e88, { emissive: 0xff2e88, emissiveIntensity: .25 }), jeans: M(0x34558f, { roughness: .9 }),
  shoe: M(0xf7f7f7, { roughness: .5 }), sole: M(0xff2e88, { emissive: 0xff2e88, emissiveIntensity: .3 }), glove: M(0xffffff, { roughness: .6 }),
  eye: M(0x111111, { roughness: .3 }), cap: M(0x111111, { roughness: .6 }),
};
const golfer = new THREE.Group(); scene.add(golfer);
const hipsN = new THREE.Group(); golfer.add(hipsN);
const spineN = new THREE.Group(); hipsN.add(spineN);
const chestN = new THREE.Group(); spineN.add(chestN);
const headN = new THREE.Group(); spineN.add(headN);
const SPINE_TILT = .5;
hipsN.position.set(0, .93, -.06); spineN.rotation.x = SPINE_TILT;

function add(parent, geo, mat, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; }
// 골반 · 몸통
add(hipsN, new RoundedBoxGeometry(.36, .22, .25, 3, .07), MAT.jeans, 0, 0, 0);
add(chestN, new RoundedBoxGeometry(.44, .54, .26, 4, .09), MAT.jacket, 0, .3, 0);
add(chestN, new RoundedBoxGeometry(.45, .06, .27, 2, .02), MAT.rib, 0, .05, 0);           // 밑단 고무줄 (분홍)
add(chestN, new RoundedBoxGeometry(.24, .07, .2, 2, .03), MAT.sleeve, 0, .57, .01);        // 칼라
// 등판 글씨: 청암대 물리치료과 과잠
{
  const tex = canvasTex(256, 300, (g, w, h) => {
    g.fillStyle = '#1f2c72'; g.fillRect(0, 0, w, h);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#f1e8d4'; g.font = '700 34px Rajdhani, Arial, sans-serif'; g.fillText('CHEONGAM', w / 2, 46);
    g.font = '900 150px "Black Han Sans", Impact, sans-serif'; g.lineWidth = 10; g.strokeStyle = '#ff2e88'; g.strokeText('PT', w / 2, 150); g.fillText('PT', w / 2, 150);
    g.fillStyle = '#ffd23f'; g.font = '700 30px Rajdhani, Arial, sans-serif'; g.fillText('PHYSICAL THERAPY', w / 2, 240);
    g.fillStyle = '#f1e8d4'; g.font = '700 26px Rajdhani, Arial, sans-serif'; g.fillText('PTX+AI  26', w / 2, 274);
  });
  const back = new THREE.Mesh(new THREE.PlaneGeometry(.36, .42), new THREE.MeshStandardMaterial({ map: tex, roughness: .8 }));
  back.position.set(0, .32, -.132); back.rotation.y = Math.PI; chestN.add(back);
  const name = canvasTex(128, 64, (g, w, h) => { g.fillStyle = '#1f2c72'; g.fillRect(0, 0, w, h); g.fillStyle = '#ffd23f'; g.font = '700 40px Rajdhani, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('PT', w / 2, h / 2); });
  const chestLogo = new THREE.Mesh(new THREE.PlaneGeometry(.1, .05), new THREE.MeshStandardMaterial({ map: name })); chestLogo.position.set(.11, .45, .132); chestN.add(chestLogo);
}
// 목 · 머리
add(spineN, new THREE.CylinderGeometry(.05, .055, .12, 12), MAT.skin, 0, .63, 0);
headN.position.set(0, .7, 0); headN.rotation.x = .3;
const headMesh = add(headN, new THREE.SphereGeometry(.112, 28, 20), MAT.skin, 0, .1, .005); headMesh.scale.set(1, 1.1, 1.02);
const hair = add(headN, new THREE.SphereGeometry(.121, 28, 20), MAT.hair, 0, .125, -.018); hair.scale.set(1.02, 1.0, 1.02);
add(headN, new RoundedBoxGeometry(.18, .045, .06, 2, .02), MAT.hair, 0, .2, .08).rotation.x = .5;   // 앞머리
for (const sx of [-1, 1]) {
  add(headN, new THREE.SphereGeometry(.025, 10, 8), MAT.skin, sx * .112, .1, .0);                     // 귀
  add(headN, new THREE.SphereGeometry(.013, 10, 8), MAT.eye, sx * .04, .11, .105);                    // 눈
}
// 팔다리 (매 프레임 두 점 사이에 놓는 원기둥)
function limb(r1, r2, mat) { const g = new THREE.CylinderGeometry(r2, r1, 1, 14); g.translate(0, .5, 0); const m = new THREE.Mesh(g, mat); m.castShadow = true; golfer.add(m); return m; }
const tmp = V(), tmp2 = V();
function place(mesh, a, b) { const d = tmp.subVectors(b, a), L = d.length() || 1e-4; mesh.position.copy(a); mesh.quaternion.setFromUnitVectors(UP, d.multiplyScalar(1 / L)); mesh.scale.set(1, L, 1); }
function joint(r, mat) { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), mat); m.castShadow = true; golfer.add(m); return m; }
const ARM = { up: .34, fore: .31 }, LEG = { up: .45, low: .45 };
const parts = {
  uArmL: limb(.058, .05, MAT.sleeve), fArmL: limb(.048, .04, MAT.sleeve), uArmR: limb(.058, .05, MAT.sleeve), fArmR: limb(.048, .04, MAT.sleeve),
  shL: joint(.07, MAT.sleeve), shR: joint(.07, MAT.sleeve), elL: joint(.05, MAT.sleeve), elR: joint(.05, MAT.sleeve),
  cuffL: joint(.045, MAT.rib), cuffR: joint(.045, MAT.rib),
  handL: joint(.042, MAT.glove), handR: joint(.04, MAT.skin),
  thL: limb(.085, .07, MAT.jeans), shinL: limb(.068, .055, MAT.jeans), thR: limb(.085, .07, MAT.jeans), shinR: limb(.068, .055, MAT.jeans),
  knL: joint(.07, MAT.jeans), knR: joint(.07, MAT.jeans),
};
function shoe() {
  const g = new THREE.Group();
  const top = new THREE.Mesh(new RoundedBoxGeometry(.11, .08, .27, 3, .035), MAT.shoe); top.position.set(0, .05, .05); top.castShadow = true;
  const sole = new THREE.Mesh(new RoundedBoxGeometry(.115, .025, .28, 2, .01), MAT.sole); sole.position.set(0, .012, .05);
  g.add(top, sole); golfer.add(g); return g;
}
parts.footL = shoe(); parts.footR = shoe();
/* ═══════════════════════════════════════════════════════════════
 *  뼈 골프채 4개 (index.html CLUBS 와 같은 순서)
 *    0 어깨뼈 드라이버   위팔뼈를 잡고 어깨뼈로 쳐요
 *    1 손뼈 드라이버     위팔뼈 · 노뼈 · 자뼈 샤프트, 손이 헤드
 *    2 다리뼈 드라이버   넙다리뼈 · 정강뼈 · 종아리뼈 샤프트, 발이 헤드
 *    3 척추 드라이버     목뼈 쪽을 잡고 엉치뼈 · 꼬리뼈로 쳐요 (빛나요)
 *  채 좌표: 원점 = 헤드, +Y = 손잡이→헤드 방향(샤프트는 -Y 쪽), +Z = 공을 치는 면, +X = 헤드 끝(토우)
 *  헤드 좌표(head 그룹): 어드레스 때 x = 땅과 나란히 바깥쪽, y = 아래(땅 쪽), z = 치는 면
 * ═══════════════════════════════════════════════════════════════ */
const BONE = M(0xefe4c9, { roughness: .55 });
const CART = M(0xa9cfe6, { roughness: .35 });                                   // 연골 (파르스름)
const BONE_LEG = M(0xf2a65a, { roughness: .45, emissive: 0xff7a1a, emissiveIntensity: .45 });   // 척추 채: 주황빛
const DISC = new THREE.MeshStandardMaterial({ color: 0x7fe9ff, emissive: 0x2de2e6, emissiveIntensity: 1.4, roughness: .3 });
const clubGroups = [];
let lookClub = -1;
function bone(g, a, b, r1, r2 = r1, mat = BONE) {   // 두 점 사이 원기둥 뼈
  const d = V().subVectors(b, a), L = d.length();
  const geo = new THREE.CylinderGeometry(r2, r1, L, 10); geo.translate(0, L / 2, 0);
  const m = new THREE.Mesh(geo, mat); m.position.copy(a); m.quaternion.setFromUnitVectors(UP, d.normalize()); m.castShadow = true; g.add(m); return m;
}
function knob(g, p, r, mat = BONE, s) { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), mat); m.position.copy(p); if (s) m.scale.set(...s); m.castShadow = true; g.add(m); return m; }
function condyles(g, p, r, axis = V(0, 0, 1), mat = BONE) { knob(g, p.clone().addScaledVector(axis, r * .8), r, mat); knob(g, p.clone().addScaledVector(axis, -r * .8), r, mat); }
function flat(g, pts, depth, mat = BONE) {   // (x, 위) 점들로 만든 납작한 뼈 판 (y 는 아래가 + 라서 뒤집어 넣어요)
  const sh = new THREE.Shape(pts.map(([x, u]) => new THREE.Vector2(x, -u)));
  const geo = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelThickness: depth * .4, bevelSize: depth * .5, bevelSegments: 2, curveSegments: 6 });
  geo.translate(0, 0, -depth / 2);
  const m = new THREE.Mesh(geo, mat); m.castShadow = true; g.add(m); return m;
}
const P = (x, up, z = 0) => V(x, -up, z);   // 헤드 좌표에서 "위"는 -y
function buildBasicClub() {   // 0번: 기본 드라이버 (검은 그립 · 은색 샤프트 · 까만 헤드)
  const g = new THREE.Group(), head = new THREE.Group();
  head.rotation.z = Math.atan2(.47, .88); g.add(head);
  const L = CLUB_LEN + .08;
  bone(g, V(0, -L, 0), V(0, -L + .28, 0), .016, .014, M(0x111111, { roughness: .9 }));
  bone(g, V(0, -L + .28, 0), V(0, -.01, 0), .007, .006, M(0xc9ccd6, { metalness: .9, roughness: .25 }));
  const h = new THREE.Mesh(new RoundedBoxGeometry(.12, .05, .09, 3, .02), M(0x1b1b1f, { metalness: .6, roughness: .3 }));
  h.position.set(.055, -.008, -.008); h.castShadow = true; head.add(h);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(.1, .04), M(0x9aa0aa, { metalness: .8, roughness: .35 }));
  face.position.set(.055, -.008, .038); head.add(face);
  golfer.add(g); return g;
}
function buildClub(i) {
  if (i === 0) return buildBasicClub();
  i -= 1;   // 1~4번: 뼈 골프채 (아래 0~3)
  const g = new THREE.Group(), head = new THREE.Group();
  head.rotation.z = Math.atan2(.47, .88);   // 샤프트가 기울어져도 헤드 바닥은 땅과 나란히
  g.add(head);
  const L = CLUB_LEN + .08, Y = (t) => V(0, -L * t, 0);   // t = 0 헤드, 1 손잡이 끝
  if (i === 0) {
    // 위팔뼈: 손잡이 = 아래쪽 끝(관절융기), 헤드 쪽 = 위팔뼈머리 → 어깨뼈 관절오목에 붙어요
    bone(g, Y(.06), Y(.97), .014, .011); condyles(g, Y(.98), .018, V(1, 0, 0));
    knob(g, Y(.035), .028, CART);
    flat(head, [[0, .035], [.03, .075], [.2, .135], [.17, .02], [.13, -.035], [.03, -.005]], .012);   // 어깨뼈 몸통
    bone(head, P(.17, .105, -.016), P(.025, .095, -.016), .007, .011);                              // 어깨뼈가시 (뒤쪽 능선)
    knob(head, P(.012, .093, -.012), .02, BONE, [1.4, .7, 1]);                                       // 봉우리
    bone(head, P(.03, .07, .012), P(.0, .08, .03), .006, .008);                                      // 부리돌기 (앞쪽)
    knob(head, P(.004, .03, 0), .022, CART, [.6, 1.2, 1.1]);                                         // 관절오목
  } else if (i === 1) {
    // 위팔뼈 (손잡이 = 위팔뼈머리) → 팔꿈치 → 노뼈 · 자뼈 → 손목 → 손 (손바닥이 치는 면)
    knob(g, Y(.99), .026); bone(g, Y(.55), Y(.97), .012, .011); condyles(g, Y(.53), .018, V(0, 0, 1));
    knob(g, Y(.52).add(V(-.012, 0, -.008)), .014);                                                   // 팔꿈치머리
    bone(g, Y(.05), Y(.51).add(V(0, 0, .012)), .009, .007);                                          // 노뼈
    bone(g, Y(.05).add(V(0, 0, -.012)), Y(.51).add(V(0, 0, -.012)), .007, .009);                     // 자뼈
    for (let k = 0; k < 8; k++) knob(head, P(-.005 + (k % 4) * .012, .045 - Math.floor(k / 4) * .016 + (k % 2) * .004, 0), .009, CART);   // 손목뼈
    for (let f = 0; f < 4; f++) {   // 손허리뼈 + 손가락뼈
      const u0 = .062 - f * .021, u1 = .068 - f * .026;
      const pts = [P(.03, u0), P(.1, u1), P(.142, u1 - .002 * f), P(.168 - f * .006, u1 - .004 * f), P(.186 - f * .01, u1 - .005 * f)];
      for (let k = 0; k < 4; k++) { bone(head, pts[k], pts[k + 1], .0065 - k * .0008); knob(head, pts[k + 1], .007 - k * .0009); }
    }
    const th = [P(.02, .072), P(.05, .1), P(.08, .125), P(.1, .14)];   // 엄지
    for (let k = 0; k < 3; k++) { bone(head, th[k], th[k + 1], .007 - k * .001); knob(head, th[k + 1], .0075 - k * .001); }
  } else if (i === 2) {
    // 넙다리뼈 (손잡이 = 넙다리뼈머리) → 무릎 → 정강뼈 · 종아리뼈 → 발목 → 발 (발가락이 토우 쪽)
    knob(g, Y(.99).add(V(.018, 0, 0)), .027); bone(g, Y(.99).add(V(.016, 0, 0)), Y(.95), .011);     // 머리 · 목
    knob(g, Y(.95).add(V(-.012, 0, 0)), .016);                                                         // 큰돌기
    bone(g, Y(.53), Y(.95), .015, .014); condyles(g, Y(.51), .02, V(0, 0, 1));
    knob(g, Y(.51).add(V(.022, 0, 0)), .014, BONE, [.6, 1.2, 1]);                                       // 무릎뼈
    bone(g, Y(.06), Y(.49), .011, .015);                                                                // 정강뼈
    bone(g, Y(.07).add(V(-.012, 0, -.016)), Y(.47).add(V(-.012, 0, -.016)), .005);                     // 종아리뼈
    head.position.z = -.012;
    knob(head, P(.0, .045), .022);                                                                      // 목말뼈
    knob(head, P(-.035, .02), .03, BONE, [1.4, 1, .9]);                                                 // 발꿈치뼈
    knob(head, P(.03, .035), .02, CART, [1.2, .8, 1.4]);                                                // 발목뼈들
    for (let f = 0; f < 5; f++) {
      const z = (f - 2) * .013, u = .035 - Math.abs(f - 2) * .002;
      const pts = [P(.045, u, z * .8), P(.115, .014, z), P(.14, .011, z * 1.1), P(.158 - f * .004, .009, z * 1.15)];
      for (let k = 0; k < 3; k++) { bone(head, pts[k], pts[k + 1], (f === 0 ? .009 : .0065) - k * .001); knob(head, pts[k + 1], (f === 0 ? .009 : .007) - k * .001); }
    }
  } else {
    // 척추: 손잡이 = 목뼈(위), 아래로 등뼈 · 허리뼈, 헤드 = 엉치뼈 + 꼬리뼈. 원반(사이원반)이 빛나요
    const n = 24;
    for (let k = 0; k < n; k++) {
      const t = 1 - (k + .5) / n * .92, y = -L * t;
      const curve = .018 * Math.sin((1 - t) * Math.PI * 2.2);    // 목·허리는 앞으로, 등은 뒤로 굽은 S자
      const r = .011 + .013 * (k / n), hh = L * .92 / n;
      const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r, hh * .68, 12), BONE_LEG); body.position.set(curve, y, 0); body.castShadow = true; g.add(body);
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(r * .92, r * .92, hh * .26, 12), DISC); disc.position.set(curve, y + hh * .5, 0); g.add(disc);
      const sp = new THREE.Mesh(new THREE.BoxGeometry(.006, .006, .02 + r), BONE_LEG); sp.position.set(curve - r * .4, y + hh * .15, -r - .008); sp.rotation.x = -.5; g.add(sp);   // 가시돌기
      if (k > 6) for (const sx of [-1, 1]) { const tp = new THREE.Mesh(new THREE.BoxGeometry(.006, .005, .014), BONE_LEG); tp.position.set(curve + sx * (r + .006), y, -r * .3); tp.rotation.y = sx * .9; g.add(tp); }   // 가로돌기
    }
    flat(head, [[-.015, .075], [.15, .075], [.12, .045], [.075, -.005], [.045, .0], [.0, .03]], .02, BONE_LEG);   // 엉치뼈
    for (let k = 0; k < 4; k++) for (const z of [-.006, .006]) knob(head, P(.035 + k * .025, .052 - k * .008, .016 * Math.sign(z) + z), .005, DISC);   // 엉치뼈구멍(빛)
    const cx = [P(.082, -.008), P(.102, -.016), P(.12, -.02), P(.135, -.018)];
    cx.forEach((p, k) => knob(head, p, .011 - k * .0018, BONE_LEG));                                   // 꼬리뼈
  }
  head.scale.setScalar([1.15, 1.25, 1.45, 1.3][i]);   // 헤드는 잘 보이게 조금 크게
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  golfer.add(g); return g;
}
function applyClubLook(i) {
  i = Math.max(0, Math.min(4, i | 0));
  if (!clubGroups[i]) clubGroups[i] = buildClub(i);
  clubGroups.forEach((g, k) => { if (g) g.visible = k === i; });
  lookClub = i;
}

/* 2관절 IK: 어깨→손, 엉덩이→발목 사이의 팔꿈치·무릎 위치 (모자라면 살짝 늘려요) */
function ik(a, c, l1, l2, pole) {
  const d = V().subVectors(c, a); let L = d.length();
  if (L > l1 + l2 - 1e-4) { const k = L / (l1 + l2 - 1e-4); l1 *= k; l2 *= k; }
  const x = (l1 * l1 - l2 * l2 + L * L) / (2 * L), h = Math.sqrt(Math.max(0, l1 * l1 - x * x));
  const dir = d.normalize(), p = pole.clone().addScaledVector(dir, -pole.dot(dir)).normalize();
  return a.clone().addScaledVector(dir, x).addScaledVector(p, h);
}
const toLocal = (node, x, y, z) => golfer.worldToLocal(node.localToWorld(V(x, y, z)));

/* 스윙 평면: 어깨 가운데(C)를 중심으로, 어드레스 때 손 방향(D)과 목표 반대쪽(T)으로 이루어진 면 */
golfer.updateMatrixWorld(true);
const C0 = toLocal(chestN, 0, .5, 0);
const D = V(0, -.88, .47).normalize(), T = V(-1, 0, 0), N = V().crossVectors(D, T).normalize();
const R_HANDS = .64;
let CLUB_LEN = (C0.y - .035) / -D.y - R_HANDS;   // 어드레스에서 헤드 바닥이 땅에 닿는 길이
const toeAt = (dir) => V().addScaledVector(dir, .47).addScaledVector(N, -.88).normalize();
const BALL_LOCAL = C0.clone().addScaledVector(D, R_HANDS + CLUB_LEN).addScaledVector(toeAt(D), .1).add(V(.05, 0, 0));   // 공은 헤드 가운데쯤
// 공(월드 0, y, 0)이 클럽 페이스 앞에 오도록 캐릭터를 세워요. 캐릭터는 +x(화면 오른쪽 = 공 쪽)를 봐요.
golfer.rotation.y = Math.PI / 2;
golfer.position.set(-BALL_LOCAL.z, .03, BALL_LOCAL.x);

const ANK = { L: V(.25, .085, .02), R: V(-.25, .085, .02) };
const PHI_TOP = 2.35, H_TOP = 2.0;   // 백스윙 꼭대기에서 채가 목표 쪽으로 눕도록 손목을 꺾어요
function swingPose(now) {
  const ph = phase;
  let phi = 0, h = 0, follow = 0;
  if (ph === 'power') { const p = meterPos; phi = p * PHI_TOP; h = H_TOP * p * p; }
  else if (ph === 'accuracy') { const p = setPower; phi = p * PHI_TOP; h = H_TOP * p * p; }
  else if (ph === 'down') {
    const top = setPower * PHI_TOP, t = Math.min(1, (now - downAt) / DOWN_MS);
    phi = top * (1 - t * t);
    h = H_TOP * setPower * setPower * Math.pow(top > 1e-3 ? phi / top : 0, 2.2);
  } else if (ph === 'fly' || ph === 'roll' || ph === 'done') {
    const t = Math.min(1, (now - hitAt) / 600), e = 1 - Math.pow(1 - t, 3);
    phi = -2.75 * e; h = -1.65 * e * e; follow = e;   // 피니시: 채가 목 뒤로 감겨요
  } else { phi = .035 * Math.sin(now / 520); }
  return { phi, h, follow };
}
/* ═══════════════════════════════════════════════════════════════
 *  3D 캐릭터 (Mixamo 캐릭터 + "Golf Drive" 스윙, models/chars/*.glb)
 *  S.char 번호의 캐릭터를 불러와서 직접 만든 학생 대신 스윙해요 (못 불러오면 학생 그대로).
 *  손 높이로 어드레스 · 백스윙 꼭대기 · 임팩트 · 피니시 순간을 찾아서,
 *  파워 게이지 → 백스윙, 임팩트 → 다운스윙, 공이 날아갈 때 → 피니시로 재생해요.
 *  캐릭터 목록 · 잠금은 index.html 의 CHARS 에 있어요 (파일 이름이 같아야 해요).
 * ═══════════════════════════════════════════════════════════════ */
const CHAR_FILES = ['man', 'woman', 'mouse', 'rider'];
golfer.visible = false;   // 캐릭터 파일을 받는 동안 옛 학생이 잠깐 보이지 않게
const CLUB_LEN0 = CLUB_LEN;   // 학생 기준 채 길이 (공 자리 계산용)
const FBX = { model: null, mixer: null, act: null, lead: null, trail: null, armL: null, armR: null, hips: null, t: { addr: 0, top: 0, imp: 0, fin: 0 } };
let charWant = -1, charToken = 0;
function fbxAt(t) { FBX.act.time = t; FBX.mixer.update(0); golfer.updateMatrixWorld(true); }
// 채를 잡는 자리 = 두 손 가운뎃손가락 첫마디의 가운데 (손목 뼈에 붙이면 백스윙 꼭대기에서 채가 손 밖으로 떠 보였어요)
function fbxGrip() {
  if (!FBX.gripL || !FBX.gripR) return golfer.worldToLocal(FBX.lead.getWorldPosition(V()));
  return golfer.worldToLocal(FBX.gripL.getWorldPosition(V()).add(FBX.gripR.getWorldPosition(V())).multiplyScalar(.5));
}
function fbxHands() { return [fbxGrip(), golfer.worldToLocal(FBX.trail.getWorldPosition(V()))]; }
/* 채 방향 = 스윙 평면 위에서 '어깨 → 왼손' 팔 각도 + 손목 꺾임(h, 학생 스윙과 같은 값) */
function fbxClubDir(L, h) {
  const sh = golfer.worldToLocal(FBX.armL.getWorldPosition(V())).add(golfer.worldToLocal(FBX.armR.getWorldPosition(V()))).multiplyScalar(.5);
  const a = V().subVectors(L, sh), phiArm = Math.atan2(a.dot(T), a.dot(D)), ang = phiArm + h;
  return V().addScaledVector(D, Math.cos(ang)).addScaledVector(T, Math.sin(ang)).normalize();
}
function loadChar(i) {
  charWant = i; const token = ++charToken;
  new GLTFLoader().load('models/chars/' + (CHAR_FILES[i] || CHAR_FILES[0]) + '.glb', (gl) => {
    if (token !== charToken) return;   // 그 사이 다른 캐릭터를 골랐어요
    const o = gl.scene, clip = gl.animations.find(a => a.duration > .1); if (!clip) return;
    o.scale.setScalar(.01);   // cm → m
    const F = { lead: null, trail: null, armL: null, armR: null, hips: null, gripL: null, gripR: null };
    o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.frustumCulled = false; [].concat(m.material).forEach(x => { x.envMap = ENV_TEX; x.envMapIntensity = 1; }); } });
    o.traverse(b => { if (/LeftHand$/.test(b.name)) F.lead = b; if (/RightHand$/.test(b.name)) F.trail = b; if (/LeftArm$/.test(b.name)) F.armL = b; if (/RightArm$/.test(b.name)) F.armR = b; if (/Hips$/.test(b.name)) F.hips = b; if (/LeftHandMiddle1$/.test(b.name)) F.gripL = b; if (/RightHandMiddle1$/.test(b.name)) F.gripR = b; });
    if (!F.lead || !F.trail || !F.armL || !F.armR || !F.hips) return;
    if (FBX.model) golfer.remove(FBX.model);
    golfer.visible = true;
    Object.assign(FBX, F, { model: null });
    golfer.add(o);
    FBX.mixer = new THREE.AnimationMixer(o); FBX.act = FBX.mixer.clipAction(clip); FBX.act.play();
    // 손 높이 곡선으로 중요한 순간 찾기
    const step = .02, ys = [];
    for (let t = 0; t <= clip.duration; t += step) { fbxAt(t); ys.push(fbxHands()[0].y); }
    const at = i => i * step, argmax = (a, b) => { let k = a; for (let i = a; i < b; i++) if (ys[i] > ys[k]) k = i; return k; }, argmin = (a, b) => { let k = a; for (let i = a; i < b; i++) if (ys[i] < ys[k]) k = i; return k; };
    // 백스윙 꼭대기 = 손이 처음으로 높이 올라갔다가 다시 내려가기 시작하는 순간 (피니시가 더 높아서 '가장 높은 곳'은 안 돼요)
    const n = ys.length, y0 = Math.min(...ys.slice(0, Math.round(.6 / step)));
    let iTop = 1;
    const yMax = Math.max(...ys), thr = y0 + (yMax - y0) * .45;   // 키가 작은 캐릭터도 맞게 (손이 오르는 높이의 45%)
    for (let i = 1; i < n - 1; i++) { if (ys[i] > thr && ys[i] >= ys[i - 1] && ys[i] >= ys[i + 1]) { iTop = i; break; } }
    const iImp = argmin(iTop, Math.min(n, iTop + Math.round(.7 / step)));
    const iFin = argmax(iImp, Math.min(n, iImp + Math.round(1 / step)));
    const iAddr = argmin(0, iTop);
    FBX.t = { addr: at(iAddr), top: at(iTop), imp: at(iImp), fin: at(iFin) };
    // 캐릭터가 공(앞 = 캐릭터 기준 +z) 쪽을 보게 돌리기: 어드레스 때 골반 → 손 방향이 정면
    fbxAt(FBX.t.addr);
    { const hip = golfer.worldToLocal(FBX.hips.getWorldPosition(V())), Lh = fbxHands()[0]; o.rotation.y -= Math.atan2(Lh.x - hip.x, Lh.z - hip.z); }
    // 어드레스(기다리는 자세) 때 채 끝이 공 자리에 오도록 캐릭터 위치 · 채 길이 맞추기 (키가 달라도 채 길이로 맞춰요)
    fbxAt(FBX.t.addr);
    const [L] = fbxHands(), c = fbxClubDir(L, 0), E0 = C0.clone().addScaledVector(D, R_HANDS + CLUB_LEN0);
    // 제리처럼 작은 캐릭터는 채가 짧아야 해요 (예전 최소 .6 이면 채가 땅속에 묻혀 안 보였어요)
    CLUB_LEN = Math.max(.3, Math.min(1.3, (L.y - E0.y) / Math.max(.2, -c.y)));
    const end = L.clone().addScaledVector(c, CLUB_LEN);
    o.position.x += E0.x - end.x; o.position.z += E0.z - end.z;
    // 임팩트 때 손 자리가 어드레스와 조금 달라요 → 내려칠 때만 살짝 밀어서 채가 공에 닿게
    fbxAt(FBX.t.addr); golfer.updateMatrixWorld(true); const La = fbxHands()[0];
    fbxAt(FBX.t.imp); const Li = fbxHands()[0];
    FBX.pos0 = o.position.clone(); FBX.shift = V(La.x - Li.x, 0, La.z - Li.z);
    // 직접 만든 학생은 숨기고, 채는 새 길이로 다시 만들기
    golfer.children.forEach(ch => { if (ch !== o && !clubGroups.includes(ch)) ch.visible = false; });
    clubGroups.forEach(g => g && golfer.remove(g)); clubGroups.length = 0; lookClub = -1;
    FBX.model = o;
    window.GolfView && (window.GolfView.fbx = FBX);
  }, undefined, () => { golfer.visible = true; /* 못 불러오면 직접 만든 학생으로 */ });
}
function fbxTime(now) {
  const T = FBX.t, ph = phase, back = (k) => T.addr + (T.top - T.addr) * k;
  if (ph === 'power') return back(meterPos);
  if (ph === 'accuracy') return back(setPower);
  if (ph === 'down') { const k = Math.min(1, (now - downAt) / DOWN_MS), from = back(setPower); return from + (T.imp - from) * k * k; }
  if (ph === 'fly' || ph === 'roll' || ph === 'done') { const k = Math.min(1, (now - hitAt) / 700); return T.imp + (T.fin - T.imp) * (1 - (1 - k) * (1 - k)); }
  return T.addr;
}
function poseFBX(now) {
  let w = 0;
  if (phase === 'down') { const k = Math.min(1, (now - downAt) / DOWN_MS); w = k * k; }
  else if (phase === 'fly' || phase === 'roll' || phase === 'done') w = 1 - Math.min(1, (now - hitAt) / 350);
  if (FBX.pos0) FBX.model.position.copy(FBX.pos0).addScaledVector(FBX.shift, w);
  fbxAt(fbxTime(now));
  const g = clubGroups[lookClub];
  if (!g) return;
  const [L] = fbxHands(), c = fbxClubDir(L, swingPose(now).h);
  const Np = N.clone().addScaledVector(c, -N.dot(c)).normalize();
  g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(Np.clone().negate(), c, V().crossVectors(c, Np)));
  g.position.copy(L).addScaledVector(c, CLUB_LEN);
}
function poseGolfer(now) {
  const { phi, h, follow } = swingPose(now);
  // 몸통 회전: 백스윙은 오른쪽(-), 피니시는 목표 쪽(+)으로 돌아요
  hipsN.rotation.y = -phi * (phi > 0 ? .22 : .32);
  chestN.rotation.y = -phi * (phi > 0 ? .5 : .28) - hipsN.rotation.y * .2;
  headN.rotation.y = follow * 1.05 + hipsN.rotation.y * -.9 * (1 - follow);   // 머리는 공을 보다가 친 뒤 공을 따라가요
  headN.rotation.x = .3 - follow * .35;
  spineN.rotation.x = SPINE_TILT - follow * .3;
  spineN.rotation.z = follow * -.12;
  golfer.updateMatrixWorld(true);

  const hands = C0.clone().addScaledVector(D, R_HANDS * Math.cos(phi)).addScaledVector(T, R_HANDS * Math.sin(phi));
  const a = phi + h, cdir = V().addScaledVector(D, Math.cos(a)).addScaledVector(T, Math.sin(a)).normalize();
  const leadHand = hands.clone().addScaledVector(cdir, -.01), trailHand = hands.clone().addScaledVector(cdir, .085);
  const shL = toLocal(chestN, .2, .5, 0), shR = toLocal(chestN, -.2, .5, 0);
  const poleL = V(.6, -1, .1), poleR = V(-.6, -1, .1);
  const elL = ik(shL, leadHand, ARM.up, ARM.fore, poleL), elR = ik(shR, trailHand, ARM.up, ARM.fore, poleR);
  place(parts.uArmL, shL, elL); place(parts.fArmL, elL, leadHand); place(parts.uArmR, shR, elR); place(parts.fArmR, elR, trailHand);
  parts.shL.position.copy(shL); parts.shR.position.copy(shR); parts.elL.position.copy(elL); parts.elR.position.copy(elR);
  parts.handL.position.copy(leadHand); parts.handR.position.copy(trailHand);
  parts.cuffL.position.lerpVectors(elL, leadHand, .86); parts.cuffR.position.lerpVectors(elR, trailHand, .86);

  // 다리: 피니시 때 오른발 뒤꿈치가 들려요
  const hipL = toLocal(hipsN, .1, -.06, 0), hipR = toLocal(hipsN, -.1, -.06, 0);
  const ankR = ANK.R.clone().add(V(.1 * follow, .07 * follow, 0));
  const knL = ik(hipL, ANK.L, LEG.up, LEG.low, V(.15, 0, 1)), knR = ik(hipR, ankR, LEG.up, LEG.low, V(-.15 + follow * .5, 0, 1));
  place(parts.thL, hipL, knL); place(parts.shinL, knL, ANK.L); place(parts.thR, hipR, knR); place(parts.shinR, knR, ankR);
  parts.knL.position.copy(knL); parts.knR.position.copy(knR);
  parts.footL.position.set(ANK.L.x, 0, ANK.L.z - .04); parts.footL.rotation.y = .25;
  parts.footR.position.set(ankR.x, ankR.y - .085, ankR.z - .04); parts.footR.rotation.set(follow * .7, -.15 + follow * .5, 0);

  // 골프채
  const g = clubGroups[lookClub];
  if (g) {
    const end = hands.clone().addScaledVector(cdir, CLUB_LEN);
    const face = V().crossVectors(cdir, N).normalize(), xAxis = N.clone().negate();
    g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAxis, cdir, face));
    g.position.copy(end);
  }
}

/* ── 공 · 꼬리 · 그림자 · 떨어진 자리 ─────────────────────────────── */
const BALL_R = .032, TEE_Y = .03 + .045 + BALL_R;
/* ═══════════════════════════════════════════════════════════════
 *  공 4개 (index.html BALLS 와 같은 순서, 약한 → 강한)
 *    0 무릎뼈 공   무릎뼈만 떼어 만든 세모난 공, 뒤쪽은 파르스름한 연골
 *    1 머리뼈 공   해골 — 데굴데굴 굴러가며 날아가요
 *    2 눈알 공     파란 홍채 · 실핏줄, 날아가는 쪽을 쳐다봐요
 *    3 파이어볼    활활 타는 불덩어리, 뒤로 불꽃이 따라와요
 * ═══════════════════════════════════════════════════════════════ */
const ballMesh = new THREE.Group(); scene.add(ballMesh);        // 위치 · 크기
const ballSpin = new THREE.Group(); ballMesh.add(ballSpin);     // 회전 (구르기 · 쳐다보기)
const blob = new THREE.Mesh(new THREE.CircleGeometry(1, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: .35, depthWrite: false }));
blob.rotation.x = -Math.PI / 2; scene.add(blob);
/* 불꽃 조각 그림 (파이어볼 빛 · 꼬리) */
const fireTex = canvasTex(64, 64, (c, w, h) => {
  const gr = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.35, 'rgba(255,255,255,.65)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = gr; c.fillRect(0, 0, w, h);
});
const ballModels = [];
const BALL_TRAIL = [0x2de2e6, 0xbfe9ff, 0xd9ff9a, 0x6aa8ff, 0xff7a1a];   // 공마다 꼬리 색
let lookBall = -1, trailCol = new THREE.Color(BALL_TRAIL[0]);
function buildBall(i) {
  const g = new THREE.Group(), R = BALL_R;
  const add = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };
  if (i === 0) {   // 0번: 기본 하얀 골프공 (딤플 무늬)
    const dimples = canvasTex(256, 128, (c, w, h) => {
      c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h); c.fillStyle = 'rgba(0,0,0,.09)';
      for (let y = 6; y < h; y += 9) for (let x = (y / 9 % 2) * 5; x < w; x += 10) { c.beginPath(); c.arc(x, y, 2.6, 0, Math.PI * 2); c.fill(); }
    });
    add(new THREE.SphereGeometry(R * .85, 28, 20), new THREE.MeshStandardMaterial({ map: dimples, roughness: .35, emissive: 0xffffff, emissiveIntensity: .12 }));
    ballSpin.add(g); return g;
  }
  i -= 1;   // 1~4번: 해부학 공 (아래 0~3)
  if (i === 0) {
    // 무릎뼈: 위는 둥글고 아래(무릎뼈끝)는 뾰족, 앞뒤로 납작
    const geo = new THREE.SphereGeometry(R, 28, 20), p = geo.attributes.position;
    for (let k = 0; k < p.count; k++) {
      let x = p.getX(k), y = p.getY(k) * 1.12, z = p.getZ(k) * .62;
      if (y < 0) x *= 1 + (y / R) * .5;
      p.setXYZ(k, x, y, z);
    }
    geo.computeVertexNormals();
    add(geo, new THREE.MeshStandardMaterial({ color: 0xf1e7cf, roughness: .45 }));
    const back = add(geo, new THREE.MeshStandardMaterial({ color: 0xa9cfe6, roughness: .3 }), 0, 0, -R * .1); back.scale.set(.86, .86, .8);   // 뒤쪽 관절면 연골
  } else if (i === 1) {
    const boneM = new THREE.MeshStandardMaterial({ color: 0xf4f0e6, roughness: .5 }), dark = new THREE.MeshStandardMaterial({ color: 0x1b1b22, roughness: .8 });
    add(new THREE.SphereGeometry(R, 28, 20), boneM, 0, R * .12, -R * .05).scale.set(.95, 1, 1.05);   // 머리덮개
    add(new RoundedBoxGeometry(R * 1.25, R * .75, R * 1.1, 3, R * .25), boneM, 0, -R * .45, R * .12); // 얼굴 · 위턱
    add(new RoundedBoxGeometry(R * 1.0, R * .32, R * .9, 3, R * .14), boneM, 0, -R * .9, R * .15);   // 아래턱
    for (const sx of [-1, 1]) add(new THREE.SphereGeometry(R * .26, 16, 12), dark, sx * R * .33, -R * .05, R * .78).scale.set(1, 1.1, .6);   // 눈확
    add(new THREE.ConeGeometry(R * .12, R * .22, 3), dark, 0, -R * .38, R * .86).rotation.x = Math.PI;   // 코안
    const teeth = canvasTex(64, 16, (c, w, h) => { c.fillStyle = '#f4f0e6'; c.fillRect(0, 0, w, h); c.fillStyle = '#3a3a40'; for (let k = 1; k < 8; k++) c.fillRect(k * 8 - 1, 0, 2, h); c.fillRect(0, h / 2 - 1, w, 2); });
    add(new THREE.PlaneGeometry(R * .9, R * .26), new THREE.MeshStandardMaterial({ map: teeth, roughness: .5 }), 0, -R * .72, R * .69);   // 이
  } else if (i === 2) {
    const veins = canvasTex(512, 256, (c, w, h) => {
      c.fillStyle = '#fbf8f4'; c.fillRect(0, 0, w, h);
      c.strokeStyle = 'rgba(200,40,40,.55)'; c.lineCap = 'round';
      for (let k = 0; k < 40; k++) {   // 실핏줄
        let x = Math.random() * w, y = h * (.5 + (Math.random() - .5) * .9); c.lineWidth = 1 + Math.random() * 1.6; c.beginPath(); c.moveTo(x, y);
        for (let s = 0; s < 8; s++) { x += (Math.random() - .5) * 26; y += (Math.random() - .5) * 18; c.lineTo(x, y); }
        c.stroke();
      }
    });
    add(new THREE.SphereGeometry(R, 32, 24), new THREE.MeshStandardMaterial({ map: veins, roughness: .2 }));
    const iris = canvasTex(256, 256, (c, w, h) => {
      const cx = w / 2, cy = h / 2;
      c.fillStyle = '#fbf8f4'; c.fillRect(0, 0, w, h);
      const gr = c.createRadialGradient(cx, cy, 20, cx, cy, 124); gr.addColorStop(0, '#0d2a55'); gr.addColorStop(.35, '#2f7fd6'); gr.addColorStop(.8, '#5fb2ff'); gr.addColorStop(.93, '#1a3f7a'); gr.addColorStop(1, 'rgba(20,50,100,0)');
      c.fillStyle = gr; c.beginPath(); c.arc(cx, cy, 124, 0, Math.PI * 2); c.fill();
      c.strokeStyle = 'rgba(220,240,255,.45)'; c.lineWidth = 1.5;
      for (let k = 0; k < 90; k++) { const a = k / 90 * Math.PI * 2 + Math.random() * .05; c.beginPath(); c.moveTo(cx + Math.cos(a) * 46, cy + Math.sin(a) * 46); c.lineTo(cx + Math.cos(a) * (80 + Math.random() * 34), cy + Math.sin(a) * (80 + Math.random() * 34)); c.stroke(); }
      c.fillStyle = '#05070c'; c.beginPath(); c.arc(cx, cy, 44, 0, Math.PI * 2); c.fill();
      c.fillStyle = 'rgba(255,255,255,.9)'; c.beginPath(); c.ellipse(cx + 34, cy - 40, 20, 13, -.6, 0, Math.PI * 2); c.fill();
    });
    // 앞쪽 둥근 뚜껑에 홍채 그림 (+Z = 쳐다보는 방향)
    const th = .62, cap = new THREE.SphereGeometry(R * 1.004, 40, 12, 0, Math.PI * 2, 0, th), cp = cap.attributes.position, uv = cap.attributes.uv, rs = R * 1.004 * Math.sin(th);
    for (let k = 0; k < cp.count; k++) uv.setXY(k, .5 + cp.getX(k) / (2 * rs), .5 - cp.getZ(k) / (2 * rs));
    const capM = add(cap, new THREE.MeshStandardMaterial({ map: iris, roughness: .08, metalness: .1 }));
    capM.rotation.x = Math.PI / 2;
  } else {
    add(new THREE.SphereGeometry(R, 24, 16), new THREE.MeshBasicMaterial({ color: glow(0xffa53a, 2.0), toneMapped: false }));
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: fireTex, color: glow(0xff5a12, 1.8), blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, transparent: true }));
    halo.scale.setScalar(R * 5); g.add(halo); g.userData.halo = halo;
  }
  ballSpin.add(g); return g;
}
function applyBallLook(i) {
  i = Math.max(0, Math.min(4, i | 0));
  if (!ballModels[i]) ballModels[i] = buildBall(i);
  ballModels.forEach((m, k) => { if (m) m.visible = k === i; });
  ballSpin.rotation.set(0, 0, 0);
  trailCol = new THREE.Color(BALL_TRAIL[i]); lookBall = i;
}
/* 불꽃 (파이어볼 꼬리): 빛 조각을 계속 뿌리고, 커지면서 노랑 → 주황 → 빨강으로 사라져요 */
const FIRE_N = MOBILE ? 110 : 180, fire = [];
for (let k = 0; k < FIRE_N; k++) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: fireTex, depthWrite: false, toneMapped: false, transparent: true, fog: false }));   // 낮에도 잘 보이게 보통 섞기
  s.visible = false; scene.add(s); fire.push({ s, life: 0, max: 1, v: V(), size: 0 });
}
let fireNext = 0, fireAcc = 0;
const FIRE_COL = [new THREE.Color(1, .9, .35), new THREE.Color(1, .42, .05), new THREE.Color(.7, .08, .02)];
function updateFire(dt, pos, vel, sc, rate) {
  fireAcc += rate * dt;
  while (fireAcc >= 1) {
    fireAcc -= 1; const p = fire[fireNext]; fireNext = (fireNext + 1) % FIRE_N;
    p.life = 0; p.max = .35 + Math.random() * .35; p.s.visible = true;
    p.s.position.copy(pos).add(V(Math.random() - .5, Math.random() - .5, Math.random() - .5).multiplyScalar(BALL_R * sc * 1.2));
    p.v.copy(vel).multiplyScalar(.8).add(   // 공보다 조금 느리게 따라와서 꼬리가 길게 늘어나요
      V((Math.random() - .5) * .6, .4 + Math.random() * .8, (Math.random() - .5) * .6).multiplyScalar(sc * .3));
    p.size = BALL_R * sc * (2.6 + Math.random() * 1.8);
  }
  for (const p of fire) {
    if (!p.s.visible) continue;
    p.life += dt; const t = p.life / p.max;
    if (t >= 1) { p.s.visible = false; continue; }
    p.s.position.addScaledVector(p.v, dt);
    p.s.scale.setScalar(p.size * (1 + t * 1.6));
    if (t < .4) p.s.material.color.copy(FIRE_COL[0]).lerp(FIRE_COL[1], t / .4); else p.s.material.color.copy(FIRE_COL[1]).lerp(FIRE_COL[2], (t - .4) / .6);
    p.s.material.color.multiplyScalar(1.25); p.s.material.opacity = .95 * (1 - t * t);
  }
}
const prevBall = V(), ballVel = V();
/* ═══════════════════════════════════════════════════════════════
 *  부스터 (index.html 의 boosters 배열을 그대로 그려요)
 *    폭탄 💣: 빨간 동그라미 + 까만 폭탄(불붙은 심지). 닿으면 펑! 불덩이 · 충격파 · 그을린 자국
 *    대포 💥: 하늘색 동그라미 + 앞을 향한 대포. 닿으면 쾅! 포구 불꽃 · 연기 · 뒤로 밀림
 * ═══════════════════════════════════════════════════════════════ */
const BOOST_MAT = {
  bomb: new THREE.MeshStandardMaterial({ color: 0x15151a, roughness: .25, metalness: .4 }),
  fuse: new THREE.MeshStandardMaterial({ color: 0xc9a46a, roughness: .9 }),
  cap: new THREE.MeshStandardMaterial({ color: 0x6b6f7a, roughness: .4, metalness: .7 }),
  wood: new THREE.MeshStandardMaterial({ color: 0x7a4b25, roughness: .85 }),
  iron: new THREE.MeshStandardMaterial({ color: 0x2b2e36, roughness: .35, metalness: .8 }),
  neonC: new THREE.MeshStandardMaterial({ color: 0x2de2e6, emissive: 0x2de2e6, emissiveIntensity: 1.2 }),
  fire: new THREE.MeshBasicMaterial({ color: glow(0xff8a1a, 2), toneMapped: false, transparent: true, depthWrite: false }),
  smoke: new THREE.MeshStandardMaterial({ color: 0x9a9aa2, roughness: 1, transparent: true, depthWrite: false }),
  scorch: new THREE.MeshBasicMaterial({ color: 0x1a140f, transparent: true, opacity: .55, depthWrite: false }),
};
const zoneMat = (hex) => new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: .22, depthWrite: false });
const ringMatOf = (hex) => new THREE.MeshBasicMaterial({ color: glow(hex, 1.6), toneMapped: false, transparent: true, opacity: .9, depthWrite: false });
const BOOST_LOOK = { bomb: { zone: zoneMat(0xff3b3b), ring: ringMatOf(0xff3b3b) }, cannon: { zone: zoneMat(0x2de2e6), ring: ringMatOf(0x2de2e6) } };
let boosterSrc = null; const boosterObjs = [];
// 부스터 모양(구 · 고리 · 원통…)은 같은 크기끼리 하나를 같이 써요.
// 예전엔 새 샷마다 130개쯤의 폭탄 · 대포 모양을 전부 새로 만들어 그래픽 카드에 다시 올려서 멈칫했어요.
const SG_CACHE = new Map();
function SG(kind, ...args) {
  const k = kind + ':' + args.join(',');
  let g = SG_CACHE.get(k);
  if (!g) { g = new THREE[kind + 'Geometry'](...args); g.userData.shared = true; SG_CACHE.set(k, g); }
  return g;
}
function makeBoosterObj(b) {
  const g = new THREE.Group(); g.position.set(b.x, 0, -b.z); scene.add(g);
  const L = BOOST_LOOK[b.type];
  const zone = new THREE.Mesh(SG('Circle', b.r, 40), L.zone); zone.rotation.x = -Math.PI / 2; zone.position.y = .05; g.add(zone);
  const ring = new THREE.Mesh(SG('Ring', b.r - .5, b.r, 48), L.ring); ring.rotation.x = -Math.PI / 2; ring.position.y = .06; g.add(ring);
  const o = { b, g, zone, ring, fx: [] };
  if (b.type === 'bomb') {
    const body = new THREE.Group(); g.add(body); o.body = body;
    const ball = new THREE.Mesh(SG('Sphere', 1.8, 24, 18), BOOST_MAT.bomb); ball.position.y = 1.8; ball.castShadow = true; body.add(ball);
    const cap = new THREE.Mesh(SG('Cylinder', .5, .6, .5, 12), BOOST_MAT.cap); cap.position.y = 3.65; body.add(cap);
    const fuse = new THREE.Mesh(SG('Cylinder', .09, .09, 1.1, 6), BOOST_MAT.fuse); fuse.position.set(.25, 4.3, 0); fuse.rotation.z = -.45; body.add(fuse);
    const spark = new THREE.Sprite(new THREE.SpriteMaterial({ map: fireTex, color: glow(0xffc040, 2.5), blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    spark.position.set(.5, 4.85, 0); spark.scale.setScalar(1.2); body.add(spark); o.spark = spark;
  } else {
    const base = new THREE.Mesh(SG('Box', 3.2, 1.2, 4), BOOST_MAT.wood); base.position.y = 1.2; base.castShadow = true; g.add(base);
    for (const sx of [-1, 1]) {
      const wheel = new THREE.Mesh(SG('Cylinder', 1.25, 1.25, .45, 18), BOOST_MAT.wood); wheel.rotation.z = Math.PI / 2; wheel.position.set(sx * 1.85, 1.25, .4); wheel.castShadow = true; g.add(wheel);
      const hub = new THREE.Mesh(SG('Cylinder', .35, .35, .5, 10), BOOST_MAT.iron); hub.rotation.z = Math.PI / 2; hub.position.set(sx * 1.9, 1.25, .4); g.add(hub);
    }
    const barrel = new THREE.Group(); barrel.position.set(0, 2.3, .6); barrel.rotation.x = -(Math.PI / 2 - 33 * Math.PI / 180); g.add(barrel); o.barrel = barrel;
    const tube = new THREE.Mesh(SG('Cylinder', .75, 1, 5.5, 20), BOOST_MAT.iron); tube.position.y = 2.2; tube.castShadow = true; barrel.add(tube);
    const muzzle = new THREE.Mesh(SG('Torus', .8, .16, 8, 24), BOOST_MAT.neonC); muzzle.position.y = 4.95; muzzle.rotation.x = Math.PI / 2; barrel.add(muzzle);
    const stripe = new THREE.Mesh(SG('Torus', .92, .1, 8, 24), BOOST_MAT.neonC); stripe.position.y = .6; stripe.rotation.x = Math.PI / 2; barrel.add(stripe);
    const back = new THREE.Mesh(SG('Sphere', 1, 16, 12), BOOST_MAT.iron); back.position.y = -.4; barrel.add(back);
  }
  return o;
}
// 터질 때 쓰는 불꽃 · 연기는 닿은 부스터에만 그때 만들어요 (예전엔 새 샷마다 130개 전부에 미리 만들어서 멈칫했어요)
function makeFx(o) {
  o.fxOn = true; const g = o.g;
  if (o.b.type === 'bomb') {
    const fb = new THREE.Mesh(SG('Sphere', 1, 20, 14), BOOST_MAT.fire.clone()); fb.visible = false; fb.position.y = 2; g.add(fb); o.fireball = fb;
    const wave = new THREE.Mesh(SG('Ring', .85, 1, 48), BOOST_MAT.fire.clone()); wave.rotation.x = -Math.PI / 2; wave.position.y = .1; wave.visible = false; g.add(wave); o.wave = wave;
    const scorch = new THREE.Mesh(SG('Circle', 4, 24), BOOST_MAT.scorch); scorch.rotation.x = -Math.PI / 2; scorch.position.y = .07; scorch.visible = false; g.add(scorch); o.scorch = scorch;
  } else {
    const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: fireTex, color: glow(0xffb040, 3), blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    flash.position.y = 5.6; flash.visible = false; o.barrel.add(flash); o.flash = flash;
    o.smoke = [];
    for (let k = 0; k < 6; k++) { const sm = new THREE.Mesh(SG('Sphere', 1, 12, 10), BOOST_MAT.smoke.clone()); sm.visible = false; g.add(sm); o.smoke.push(sm); }
  }
}
// 미리 그려 두기(prewarm)에 불꽃 · 연기 모양도 들어가게, 안 보이는 견본을 하나씩 둬요
{ const sample = { b: { type: 'bomb' }, g: new THREE.Group() }; makeFx(sample); const s2 = { b: { type: 'cannon' }, g: new THREE.Group(), barrel: new THREE.Group() }; s2.g.add(s2.barrel); makeFx(s2);
  for (const x of [sample, s2]) { x.g.visible = false; x.g.position.set(0, -50, 0); scene.add(x.g); } }
function updateBoosters(now) {
  if (boosterSrc !== boosters) {   // 새 샷 → 새로 깔기
    boosterObjs.forEach(o => { scene.remove(o.g); o.g.traverse(m => { if (m.geometry && !m.geometry.userData.shared) m.geometry.dispose(); }); });
    boosterObjs.length = 0; boosterSrc = boosters;
    for (const b of boosters) boosterObjs.push(makeBoosterObj(b));
  }
  const cz = camera.position.z;
  for (const o of boosterObjs) {
    // 카메라에서 900m 넘게 먼 부스터는 그리지 않아요 (안개 속이라 거의 안 보이는데 그리는 양만 많았어요)
    const near = Math.abs(o.g.position.z - cz) < 900; if (o.g.visible !== near) o.g.visible = near;
    if (!near) continue;
    const b = o.b, t = b.hitAt ? (now - b.hitAt) / 1000 : -1;
    if (t >= 0 && !o.fxOn) makeFx(o);
    o.ring.material.opacity = b.used ? .15 : .7 + .25 * Math.sin(now / 250 + b.id);
    if (b.type === 'bomb') {
      if (t < 0) { o.spark.scale.setScalar(1 + .4 * Math.sin(now / 45 + b.id)); o.body.position.y = .1 * Math.sin(now / 400 + b.id); continue; }
      o.body.visible = false; o.zone.visible = false; o.scorch.visible = true;
      const k = Math.min(1, t / .7);
      o.fireball.visible = k < 1; o.fireball.scale.setScalar(2 + k * 12); o.fireball.material.opacity = 1 - k;
      o.fireball.material.color.copy(glow(0xffd060, 2.4)).lerp(glow(0xff3a10, 1.6), k);
      const w = Math.min(1, t / .9); o.wave.visible = w < 1; o.wave.scale.setScalar(2 + w * 26); o.wave.material.opacity = (1 - w) * .9;
    } else {
      if (t < 0) { o.barrel.rotation.y = .12 * Math.sin(now / 900 + b.id); continue; }
      o.zone.visible = false;
      const k = Math.min(1, t / .25);
      o.barrel.position.z = .6 + Math.sin(k * Math.PI) * .9;   // 뒤로 밀렸다가 제자리
      o.flash.visible = t < .3; o.flash.scale.setScalar(4 + t * 30); o.flash.material.opacity = 1 - t / .3;
      o.smoke.forEach((s, i) => {
        const st = t - i * .05; if (st < 0 || st > 2.2) { s.visible = false; return; }
        s.visible = true; const q = st / 2.2;
        s.position.set(Math.sin(i * 2.1) * 1.2, 6 + st * 4 + i * .4, -4 - st * 3 - i * .6);
        s.scale.setScalar(1 + q * 4); s.material.opacity = .7 * (1 - q);
      });
    }
  }
}
const MAXP = 260;
const tPos = new Float32Array(MAXP * 2 * 3), tCol = new Float32Array(MAXP * 2 * 3);
const trailGeo = new THREE.BufferGeometry();
trailGeo.setAttribute('position', new THREE.BufferAttribute(tPos, 3));
trailGeo.setAttribute('color', new THREE.BufferAttribute(tCol, 3));
{ const idx = []; for (let i = 0; i < MAXP - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } trailGeo.setIndex(idx); }
const trailMesh = new THREE.Mesh(trailGeo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, fog: false }));
trailMesh.frustumCulled = false; scene.add(trailMesh);
const W3 = (p) => V(p[0], Math.max(0, p[1]) + BALL_R, -p[2]);
// 매 프레임 새 물건을 만들지 않게 (예전엔 꼬리 점 260개 × 벡터 여러 개를 새로 만들어서, 가끔 메모리 정리로 멈칫했어요)
const _tp = V(), _ta = V(), _tb = V(), _td = V(), _tc = V();
function updateTrail() {
  const tr = trail || [], b = ball, extra = !!(b && (phase === 'fly' || phase === 'roll'));
  const L = tr.length + (extra ? 1 : 0), n = Math.min(L, MAXP), start = L - n;
  const get = (j, out) => j < tr.length ? out.set(tr[j][0], Math.max(0, tr[j][1]) + BALL_R, -tr[j][2]) : out.set(b.x, Math.max(0, b.y) + BALL_R, -b.z);
  for (let i = 0; i < n; i++) {
    get(start + i, _tp); get(start + Math.max(0, i - 1), _ta); get(start + Math.min(n - 1, i + 1), _tb);
    _td.subVectors(_tb, _ta); if (_td.lengthSq() < 1e-6) _td.set(0, 0, -1);
    _tc.subVectors(camera.position, _tp); const dist = _tc.length();
    _td.cross(_tc).normalize().multiplyScalar(.03 + Math.max(0, dist - 18) * .0045);
    const o = i * 6, k = Math.pow((i + 1) / n, 1.6) * 1.8;
    tPos[o] = _tp.x + _td.x; tPos[o + 1] = _tp.y + _td.y; tPos[o + 2] = _tp.z + _td.z;
    tPos[o + 3] = _tp.x - _td.x; tPos[o + 4] = _tp.y - _td.y; tPos[o + 5] = _tp.z - _td.z;
    tCol[o] = tCol[o + 3] = trailCol.r * k; tCol[o + 1] = tCol[o + 4] = trailCol.g * k; tCol[o + 2] = tCol[o + 5] = trailCol.b * k;
  }
  trailGeo.attributes.position.needsUpdate = true; trailGeo.attributes.color.needsUpdate = true;
  trailGeo.setDrawRange(0, Math.max(0, n - 1) * 6);
}
const ringMat = new THREE.MeshBasicMaterial({ color: glow(0xb6ff3b, 2), transparent: true, toneMapped: false, depthWrite: false, side: THREE.DoubleSide });
const landRing = new THREE.Mesh(new THREE.RingGeometry(.8, 1, 48), ringMat); landRing.rotation.x = -Math.PI / 2; landRing.visible = false; scene.add(landRing);
let landAt = 0, landPos = V();

/* ── 카메라 ───────────────────────────────────────────────────────── */
const TEE_WIDE = { pos: V(-2.6, 1.75, 4.4), look: V(-.1, .85, -7) };
const TEE_TALL = { pos: V(-1.75, 1.9, 5.4), look: V(.35, .8, -6) };   // 세로 화면(폰): 조금 뒤에서, 캐릭터와 공이 다 보이게
const TEE_CAM = { pos: V(), look: V() };
function pickTeeCam() { const t = innerWidth / innerHeight < .8 ? TEE_TALL : TEE_WIDE; TEE_CAM.pos.copy(t.pos); TEE_CAM.look.copy(t.look); }
pickTeeCam(); addEventListener('resize', pickTeeCam);
const camPos = TEE_CAM.pos.clone(), camLook = TEE_CAM.look.clone();
camera.position.copy(camPos); camera.lookAt(camLook);
let prevPhase = '', DBG = null;   // DBG: 확인용 카메라 (GolfView.debugCam)
const _cbw = V(), _ccp = V(), _ccl = V(), _cpos = V(), _clook = V();   // 매 프레임 새로 만들지 않게
function updateCamera(now, dt) {
  const ph = phase, b = ball;
  let pos = TEE_CAM.pos, look = TEE_CAM.look;
  if (b && (ph === 'fly' || ph === 'roll' || ph === 'done')) {
    const bw = _cbw.set(b.x, Math.max(0, b.y), -b.z);
    const chasePos = _ccp.set(bw.x * .85, bw.y + 2.4 + Math.min(4, -bw.z * .01), bw.z + 15);
    const chaseLook = _ccl.set(bw.x, bw.y - 1.2, bw.z - 22);
    const k = Math.min(1, (now - hitAt) / 900), e = k * k * (3 - 2 * k);   // 친 직후 0.9초 동안 타석 카메라 → 공 따라가기
    pos = _cpos.lerpVectors(TEE_CAM.pos, chasePos, e); look = _clook.lerpVectors(TEE_CAM.look, chaseLook, e);
    camPos.copy(pos); camLook.copy(look);
  } else {
    camPos.copy(pos); camLook.copy(look);
  }
  if (DBG) { camPos.copy(DBG.pos); camLook.copy(DBG.look); }
  camera.position.copy(camPos); camera.lookAt(camLook);
  // 그림자 카메라는 타석에 고정
  key.target.position.set(-.6, 0, 0); key.position.set(-8.6, 18, 14);
  far.position.set(camera.position.x, 0, camera.position.z);
  const hillsOn = camera.position.z > -(SEA_AT - 30); if (farHills[0].visible !== hillsOn) farHills.forEach(h => h.visible = hillsOn);
  // 하늘 구역: 안개를 파란 하늘빛으로, 더 멀리까지 (아래 구름 바다가 보이게)
  const cz = camera.position.z, zone = cz > -(SKY_AT - 40) ? 0 : cz > -(SPACE_AT - 40) ? 1 : cz > -(NEON_AT - 20) ? 2 : 3;   // 0 땅·바다 · 1 하늘 · 2 우주 · 3 네온 차원
  if (zone !== updateCamera.zone) {
    updateCamera.zone = zone;
    const F = [[HAZE, 220, 1500], [0x8fbdea, 400, 2800], [0x0b1030, 900, 5000], [0x3a0a4a, 700, 4200]][zone];
    scene.fog.color.set(F[0]); scene.fog.near = F[1]; scene.fog.far = F[2];
    sky.visible = sun.visible = zone < 2; farClouds.forEach(c => c.visible = zone < 2);
    spaceSky.visible = spaceZone.visible = zone === 2; cloudLayer.visible = zone < 2;
    neonSky.visible = neonZone.visible = zone === 3;
  }
}

/* ── 매 프레임 ─────────────────────────────────────────────────────── */
function frame(now, dt) {
  if (S.club !== lookClub) applyClubLook(S.club);
  if (S.ball !== lookBall) applyBallLook(S.ball);
  if (((typeof S !== 'undefined' && S.char) | 0) !== charWant) loadChar((typeof S !== 'undefined' && S.char) | 0);
  if (FBX.model) poseFBX(now); else poseGolfer(now);
  const ph = phase, b = ball;
  if (b) {
    const onTee = !(ph === 'fly' || ph === 'roll' || ph === 'done');
    const y = onTee ? TEE_Y : Math.max(0, b.y) + BALL_R;
    ballMesh.position.set(b.x, y, -b.z);
    const dist = camera.position.distanceTo(ballMesh.position);
    const sc = Math.max(1, dist / 4.5);   // 멀어질수록 크게 그려서 잘 보이게
    ballMesh.scale.setScalar(sc);
    // 공 속도 → 구르기 · 쳐다보기 · 불꽃 방향
    if (dt > 0) ballVel.subVectors(ballMesh.position, prevBall).multiplyScalar(1 / dt);
    prevBall.copy(ballMesh.position);
    const moving = !onTee && ballVel.lengthSq() > .04;
    if (lookBall === 3) {   // 눈알: 날아가는 쪽, 타석에서는 카메라를 쳐다봐요
      const tgt = moving ? ballMesh.position.clone().add(ballVel) : onTee ? camera.position.clone() : ballMesh.position.clone().add(V(0, 0, -1));
      ballSpin.lookAt(tgt);
    } else if (lookBall === 4) {   // 파이어볼
      ballSpin.rotation.set(0, 0, 0);
      const m = ballModels[4]; if (m) m.userData.halo.scale.setScalar(BALL_R * (4.5 + Math.sin(now / 40) * .6));
    } else if (moving) {
      ballSpin.rotation.x -= Math.min(30, ballVel.length() * .5) * dt;   // 데굴데굴
    } else if (onTee) ballSpin.rotation.set(0, 0, 0);
    if (lookBall === 4) updateFire(dt, ballMesh.position, moving ? ballVel : V(), sc, moving ? (MOBILE ? 70 : 110) : 14);
    blob.position.set(b.x, .035, -b.z); const hh = Math.max(0, b.y);
    blob.scale.setScalar(BALL_R * sc * (1.3 + hh * .02)); blob.material.opacity = .35 / (1 + hh * .08);
  }
  if (lookBall !== 4 || !b) updateFire(dt, V(), V(), 1, 0);   // 남은 불꽃 정리
  if (prevPhase === 'fly' && ph === 'roll' && b) { landAt = now; landPos.set(b.x, .05, -b.z); }
  prevPhase = ph;
  // 떨어진 자리 고리: 땅에 닿을 때 한 번 퍼지고, 멈춘 뒤에는 계속 반짝
  if (now - landAt < 700) {
    const t = (now - landAt) / 700; landRing.visible = true; landRing.position.copy(landPos);
    landRing.scale.setScalar(1 + t * 5); ringMat.opacity = 1 - t;
  } else if (ph === 'done' && b && lastShot && !lastShot.ob) {
    const t = (now / 900) % 1; landRing.visible = true; landRing.position.set(b.x, .05, -b.z);
    landRing.scale.setScalar(.6 + t * 3.5); ringMat.opacity = 1 - t;
  } else landRing.visible = false;
  updateBoosters(now);
  WIND.value = now / 1000;
  if (spaceZone.visible) spaceZone.userData.earth.rotation.y = now / 60000;
  if (water) { water.material.map.offset.x = (now / 90000) % 1; water.material.map.offset.y = (now / 60000) % 1; }
  for (const f of xmasAnim) f(now, dt);   // 🎄 눈 · 썰매 · 전구
  if (neonZone.visible || spaceZone.visible) for (const g of neonSpin) { const u = g.userData; g.rotation.x += u.spin.x * dt; g.rotation.y += u.spin.y * dt; g.rotation.z += u.spin.z * dt; if (!u.flat) g.position.y += Math.sin(now / 900 + u.bob) * .02; }
  balloons.forEach(g => { g.position.y += Math.sin(now / 1500 + g.userData.bob) * .01; g.rotation.y += dt * .05; });
  updateTrail();
  updateCamera(now, dt);
  renderer.shadowMap.needsUpdate = camera.position.z > -120;
  adaptQuality(dt); applyQuality();
  composer.render(dt);
}
// 잔렉 줄이기: 처음 보는 물체(우주 · 네온 구역, 폭탄 불꽃 등)가 화면에 처음 나올 때
// 그래픽 준비(셰이더 만들기 · 그림 · 모양 올리기)를 하느라 0.5~1초 멈춰요.
// 그래서 시작 화면에서 미리 전부 한 번 작은 화면에 그려 둬요. (사람 눈에는 안 보여요)
function prewarm() {
  const hid = [], cull = [];
  scene.traverse(o => { if (!o.visible) { hid.push(o); o.visible = true; } if (o.frustumCulled) { cull.push(o); o.frustumCulled = false; } });
  const rt = new THREE.WebGLRenderTarget(64, 64);
  try { renderer.setRenderTarget(rt); renderer.render(scene, camera); } catch (e) { /* 미리 그리기 실패해도 게임은 그대로 */ }
  renderer.setRenderTarget(null); rt.dispose();
  hid.forEach(o => { o.visible = false; }); cull.forEach(o => { o.frustumCulled = true; });
}
setTimeout(prewarm, 600);
// 확인용: 지금 화면을 그림 파일(data URL)로 (허브 배너·썸네일 만들 때 씀)
function snapshot(type = 'image/jpeg', q = .88) { composer.render(); return renderer.domElement.toDataURL(type, q); }
window.GolfView = { frame, ready: true, snapshot, scene, debugCam: (pos, look) => { DBG = pos ? { pos: V(...pos), look: V(...look) } : null; } };
