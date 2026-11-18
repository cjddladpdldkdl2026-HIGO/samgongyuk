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

const canvas = document.getElementById('scene');
const MOBILE = Math.min(innerWidth, innerHeight) < 600;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, MOBILE ? 1.5 : 1.75));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

const scene = new THREE.Scene();
const HAZE = new THREE.Color(0xbdd9f5);
scene.fog = new THREE.Fog(HAZE, 220, 1500);
scene.background = HAZE;
const camera = new THREE.PerspectiveCamera(52, innerWidth / innerHeight, 0.05, 4000);

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

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);
const glow = (hex, k = 2.2) => new THREE.Color(hex).multiplyScalar(k);   // 블룸으로 빛나게 (1보다 밝은 색)
const OB_X = 70;   // index.html 의 OB_X 와 같은 값
const RANGE = 2000;  // 연습장 길이(m): 표지판 · 그린 · 나무 · 선이 여기까지 있어요

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
const balloons = [];   // 열기구 (천천히 오르내려요)
const sky = new THREE.Mesh(new THREE.SphereGeometry(3000, 32, 20), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `varying vec3 vP;
    void main(){
      float h = vP.y;
      vec3 haze = vec3(0.74, 0.85, 0.96);
      vec3 low  = vec3(0.47, 0.70, 0.96);
      vec3 top  = vec3(0.12, 0.38, 0.86);
      vec3 c = mix(haze, low, smoothstep(0.0, 0.07, h));
      c = mix(c, top, smoothstep(0.12, 0.8, h));
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
  const cloudTex = canvasTex(256, 128, (g, w, h) => {
    for (let i = 0; i < 14; i++) {
      const x = w * (.18 + Math.random() * .64), y = h * (.45 + Math.random() * .25), r = h * (.18 + Math.random() * .22);
      const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(.6, 'rgba(255,255,255,.7)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
    g.globalCompositeOperation = 'source-atop'; const sh = g.createLinearGradient(0, 0, 0, h); sh.addColorStop(.4, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(170,190,215,.6)'); g.fillStyle = sh; g.fillRect(0, 0, w, h);
  });
  let s = 21; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 22; i++) {
    const ang = -Math.PI / 2 + (r() - .5) * Math.PI * 1.6, d = 1500 + r() * 900, hgt = 160 + r() * 520;
    const c = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, fog: false, depthWrite: false, transparent: true, opacity: .75 + r() * .25 }));
    const w = 380 + r() * 520; c.scale.set(w, w * .45, 1); c.position.set(Math.cos(ang) * d, hgt, Math.sin(ang) * d); far.add(c);
  }
}
// 먼 산 (파르스름하게, 눈 덮인 꼭대기)
{
  const mMat = new THREE.MeshLambertMaterial({ color: 0x8aa6c4, fog: false, flatShading: true });
  const mMat2 = new THREE.MeshLambertMaterial({ color: 0x6f9a86, fog: false, flatShading: true });
  const snow = new THREE.MeshLambertMaterial({ color: 0xffffff, fog: false, flatShading: true });
  let s = 11; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 26; i++) {
    const ang = -Math.PI / 2 + (i / 25 - .5) * Math.PI * 1.25 + (r() - .5) * .08;
    const near = i % 3 === 0, d = near ? 1450 + r() * 150 : 1750 + r() * 300, hgt = near ? 70 + r() * 90 : 120 + r() * 220, rad = 170 + r() * 220;
    const seg = 5 + Math.floor(r() * 3);
    const m = new THREE.Mesh(new THREE.ConeGeometry(rad, hgt, seg, 1), near ? mMat2 : mMat);
    m.position.set(Math.cos(ang) * d, hgt / 2 - 8, Math.sin(ang) * d); m.rotation.y = r() * 3;
    if (!near && hgt > 200) { const cap = new THREE.Mesh(new THREE.ConeGeometry(rad * .26, hgt * .26, seg, 1), snow); cap.position.y = hgt * .37; m.add(cap); }
    far.add(m);
  }
}

/* ── 조명 (한낮 햇빛) ─────────────────────────────────────────────── */
scene.add(new THREE.HemisphereLight(0xd6ebff, 0x4f7f35, 1.35));
const key = new THREE.DirectionalLight(0xfff6e6, 2.8);   // 햇빛
key.position.set(-8, 18, 14); key.castShadow = true;
key.shadow.mapSize.set(MOBILE ? 1024 : 2048, MOBILE ? 1024 : 2048);
Object.assign(key.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 1, far: 60 });
key.shadow.bias = -0.0015; key.shadow.normalBias = 0.05;
scene.add(key); scene.add(key.target);
const rim = new THREE.DirectionalLight(0xffffff, .7);   // 앞쪽에서 오는 하늘빛
rim.position.set(0, 12, -40); scene.add(rim);

/* ── 땅: 러프 · 페어웨이 · 타석 ───────────────────────────────────── */
const roughTex = canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#1d5a2c'; g.fillRect(0, 0, w, h);
  noise(g, w, h, 3000, .35, () => Math.random() < .5 ? '#2c7a3c' : '#123d1d');
}, [140, 480]);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(1400, 4800), new THREE.MeshStandardMaterial({ map: roughTex, roughness: 1 }));
ground.rotation.x = -Math.PI / 2; ground.position.z = -2200; ground.receiveShadow = true; scene.add(ground);

const fairTex = canvasTex(256, 512, (g, w, h) => {
  g.fillStyle = '#4fbf55'; g.fillRect(0, 0, w, h / 2);
  g.fillStyle = '#63d466'; g.fillRect(0, h / 2, w, h / 2);
  noise(g, w, h, 4000, .25, () => Math.random() < .5 ? '#8ae67e' : '#3a9a44');
}, [3, 230]);
const fairway = new THREE.Mesh(new THREE.PlaneGeometry(64, 2300), new THREE.MeshStandardMaterial({ map: fairTex, roughness: .95 }));
fairway.rotation.x = -Math.PI / 2; fairway.position.set(0, 0.01, -1150); fairway.receiveShadow = true; scene.add(fairway);

// 50m 마다 흰 선 · OB 선 (네온 분홍)
{
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .75 });
  for (let z = 50; z <= RANGE; z += 50) {
    const l = new THREE.Mesh(new THREE.PlaneGeometry(64, z % 100 ? .25 : .45), lineMat);
    l.rotation.x = -Math.PI / 2; l.position.set(0, .02, -z); scene.add(l);
  }
  const obMat = new THREE.MeshBasicMaterial({ color: glow(0xff2e88, 2), toneMapped: false });
  for (const sx of [-OB_X, OB_X]) {
    const l = new THREE.Mesh(new THREE.PlaneGeometry(.5, 2300), obMat);
    l.rotation.x = -Math.PI / 2; l.position.set(sx, .03, -1140); scene.add(l);
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
  // 나무
  let s = 5; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const treeGeo = new THREE.ConeGeometry(1, 1, 7); treeGeo.translate(0, .5, 0);
  const trees = new THREE.InstancedMesh(treeGeo, new THREE.MeshStandardMaterial({ color: 0x2f7a3e, roughness: .9, flatShading: true }), 640);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(); let n = 0;
  for (let z = 10; z < RANGE + 150 && n < 640; z += 9 + r() * 12) for (const side of [-1, 1]) {
    if (n >= 640 || r() < .15) continue;
    const h = 8 + r() * 10, w = h * (.28 + r() * .1);
    m4.compose(V(side * (OB_X + 7 + r() * 60), 0, -z - r() * 8), q, V(w, h, w)); trees.setMatrixAt(n++, m4);
  }
  trees.count = n; scene.add(trees);
  // 조명탑
  const headMat = new THREE.MeshStandardMaterial({ color: 0xe8eef5, roughness: .4 });   // 낮이라 조명은 꺼져 있어요
  for (let z = 60; z < RANGE + 100; z += 120) for (const side of [-1, 1]) {
    const x = side * (OB_X + 5);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(.3, .45, 24, 6), postMat); pole.position.set(x, 12, -z); scene.add(pole);
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
/* ── 멀리 있는 볼거리: 500m 마다 네온 아치 · 연못 · 열기구 ─────────────── */
{
  const gateCols = { 500: 0x2de2e6, 1000: 0xffd23f, 1500: 0xff2e88, 2000: 0xb6ff3b };
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
      c.font = '700 30px Rajdhani, Arial, sans-serif'; c.fillStyle = '#ffffff'; c.fillText(z >= 2000 ? 'LEGEND ZONE' : 'NICE SHOT!', w / 2, h - 30);
    });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(20, 6.25), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, side: THREE.DoubleSide, color: new THREE.Color(1.3, 1.3, 1.3) }));
    sign.position.set(0, 36, 0); g.add(sign);
  }
  // 연못 (모래 테두리)
  const water = new THREE.MeshStandardMaterial({ color: 0x3b8fd9, roughness: .08, metalness: .35 });
  const sand = new THREE.MeshStandardMaterial({ color: 0xe6d3a3, roughness: 1 });
  [[640, -52, 20], [980, 50, 24], [1380, -48, 22], [1750, 52, 26]].forEach(([z, x, r]) => {
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
  [[380, -60, 70], [720, 45, 95], [1100, -30, 120], [1500, 70, 85], [1900, -15, 130]].forEach(([z, x, y], i) => {
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
const CLUB_LEN = (C0.y - .035) / -D.y - R_HANDS;   // 어드레스에서 헤드 바닥이 땅에 닿는 길이
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
    const c = t < .4 ? FIRE_COL[0].clone().lerp(FIRE_COL[1], t / .4) : FIRE_COL[1].clone().lerp(FIRE_COL[2], (t - .4) / .6);
    p.s.material.color.copy(c).multiplyScalar(1.25); p.s.material.opacity = .95 * (1 - t * t);
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
function makeBoosterObj(b) {
  const g = new THREE.Group(); g.position.set(b.x, 0, -b.z); scene.add(g);
  const L = BOOST_LOOK[b.type];
  const zone = new THREE.Mesh(new THREE.CircleGeometry(b.r, 40), L.zone); zone.rotation.x = -Math.PI / 2; zone.position.y = .05; g.add(zone);
  const ring = new THREE.Mesh(new THREE.RingGeometry(b.r - .5, b.r, 48), L.ring); ring.rotation.x = -Math.PI / 2; ring.position.y = .06; g.add(ring);
  const o = { b, g, zone, ring, fx: [] };
  if (b.type === 'bomb') {
    const body = new THREE.Group(); g.add(body); o.body = body;
    const ball = new THREE.Mesh(new THREE.SphereGeometry(1.8, 24, 18), BOOST_MAT.bomb); ball.position.y = 1.8; ball.castShadow = true; body.add(ball);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(.5, .6, .5, 12), BOOST_MAT.cap); cap.position.y = 3.65; body.add(cap);
    const fuse = new THREE.Mesh(new THREE.CylinderGeometry(.09, .09, 1.1, 6), BOOST_MAT.fuse); fuse.position.set(.25, 4.3, 0); fuse.rotation.z = -.45; body.add(fuse);
    const spark = new THREE.Sprite(new THREE.SpriteMaterial({ map: fireTex, color: glow(0xffc040, 2.5), blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    spark.position.set(.5, 4.85, 0); spark.scale.setScalar(1.2); body.add(spark); o.spark = spark;
    const fb = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), BOOST_MAT.fire.clone()); fb.visible = false; fb.position.y = 2; g.add(fb); o.fireball = fb;
    const wave = new THREE.Mesh(new THREE.RingGeometry(.85, 1, 48), BOOST_MAT.fire.clone()); wave.rotation.x = -Math.PI / 2; wave.position.y = .1; wave.visible = false; g.add(wave); o.wave = wave;
    const scorch = new THREE.Mesh(new THREE.CircleGeometry(4, 24), BOOST_MAT.scorch); scorch.rotation.x = -Math.PI / 2; scorch.position.y = .07; scorch.visible = false; g.add(scorch); o.scorch = scorch;
  } else {
    const base = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.2, 4), BOOST_MAT.wood); base.position.y = 1.2; base.castShadow = true; g.add(base);
    for (const sx of [-1, 1]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.25, .45, 18), BOOST_MAT.wood); wheel.rotation.z = Math.PI / 2; wheel.position.set(sx * 1.85, 1.25, .4); wheel.castShadow = true; g.add(wheel);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(.35, .35, .5, 10), BOOST_MAT.iron); hub.rotation.z = Math.PI / 2; hub.position.set(sx * 1.9, 1.25, .4); g.add(hub);
    }
    const barrel = new THREE.Group(); barrel.position.set(0, 2.3, .6); barrel.rotation.x = -(Math.PI / 2 - 33 * Math.PI / 180); g.add(barrel); o.barrel = barrel;
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(.75, 1, 5.5, 20), BOOST_MAT.iron); tube.position.y = 2.2; tube.castShadow = true; barrel.add(tube);
    const muzzle = new THREE.Mesh(new THREE.TorusGeometry(.8, .16, 8, 24), BOOST_MAT.neonC); muzzle.position.y = 4.95; muzzle.rotation.x = Math.PI / 2; barrel.add(muzzle);
    const stripe = new THREE.Mesh(new THREE.TorusGeometry(.92, .1, 8, 24), BOOST_MAT.neonC); stripe.position.y = .6; stripe.rotation.x = Math.PI / 2; barrel.add(stripe);
    const back = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), BOOST_MAT.iron); back.position.y = -.4; barrel.add(back);
    const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: fireTex, color: glow(0xffb040, 3), blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    flash.position.y = 5.6; flash.visible = false; barrel.add(flash); o.flash = flash;
    o.smoke = [];
    for (let k = 0; k < 6; k++) { const s = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 10), BOOST_MAT.smoke.clone()); s.visible = false; g.add(s); o.smoke.push(s); }
  }
  return o;
}
function updateBoosters(now) {
  if (boosterSrc !== boosters) {   // 새 샷 → 새로 깔기
    boosterObjs.forEach(o => { scene.remove(o.g); o.g.traverse(m => { if (m.geometry) m.geometry.dispose(); }); });
    boosterObjs.length = 0; boosterSrc = boosters;
    for (const b of boosters) boosterObjs.push(makeBoosterObj(b));
  }
  for (const o of boosterObjs) {
    const b = o.b, t = b.hitAt ? (now - b.hitAt) / 1000 : -1;
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
function updateTrail() {
  const tr = trail || [], b = ball, pts = tr.map(W3);
  if (b && (phase === 'fly' || phase === 'roll')) pts.push(V(b.x, Math.max(0, b.y) + BALL_R, -b.z));
  const n = Math.min(pts.length, MAXP);
  const start = pts.length - n;
  for (let i = 0; i < n; i++) {
    const p = pts[start + i], prev = pts[start + Math.max(0, i - 1)], next = pts[start + Math.min(n - 1, i + 1)];
    const dir = V().subVectors(next, prev); if (dir.lengthSq() < 1e-6) dir.set(0, 0, -1);
    const toCam = V().subVectors(camera.position, p), dist = toCam.length();
    const side = V().crossVectors(dir, toCam).normalize().multiplyScalar(.03 + Math.max(0, dist - 18) * .0045);
    tPos.set([p.x + side.x, p.y + side.y, p.z + side.z, p.x - side.x, p.y - side.y, p.z - side.z], i * 6);
    const k = Math.pow((i + 1) / n, 1.6) * 1.8;
    tCol.set([trailCol.r * k, trailCol.g * k, trailCol.b * k, trailCol.r * k, trailCol.g * k, trailCol.b * k], i * 6);
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
function updateCamera(now, dt) {
  const ph = phase, b = ball;
  let pos = TEE_CAM.pos, look = TEE_CAM.look;
  if (b && (ph === 'fly' || ph === 'roll' || ph === 'done')) {
    const bw = V(b.x, Math.max(0, b.y), -b.z);
    const chasePos = V(bw.x * .85, bw.y + 2.4 + Math.min(4, -bw.z * .01), bw.z + 15);
    const chaseLook = V(bw.x, bw.y - 1.2, bw.z - 22);
    const k = Math.min(1, (now - hitAt) / 900), e = k * k * (3 - 2 * k);   // 친 직후 0.9초 동안 타석 카메라 → 공 따라가기
    pos = V().lerpVectors(TEE_CAM.pos, chasePos, e); look = V().lerpVectors(TEE_CAM.look, chaseLook, e);
    camPos.copy(pos); camLook.copy(look);
  } else {
    camPos.copy(pos); camLook.copy(look);
  }
  if (DBG) { camPos.copy(DBG.pos); camLook.copy(DBG.look); }
  camera.position.copy(camPos); camera.lookAt(camLook);
  // 그림자 카메라는 타석에 고정
  key.target.position.set(-.6, 0, 0); key.position.set(-8.6, 18, 14);
  far.position.set(camera.position.x, 0, camera.position.z);
}

/* ── 매 프레임 ─────────────────────────────────────────────────────── */
function frame(now, dt) {
  if (S.club !== lookClub) applyClubLook(S.club);
  if (S.ball !== lookBall) applyBallLook(S.ball);
  poseGolfer(now);
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
  balloons.forEach(g => { g.position.y += Math.sin(now / 1500 + g.userData.bob) * .01; g.rotation.y += dt * .05; });
  updateTrail();
  updateCamera(now, dt);
  composer.render(dt);
}
// 확인용: 지금 화면을 그림 파일(data URL)로 (허브 배너·썸네일 만들 때 씀)
function snapshot(type = 'image/jpeg', q = .88) { composer.render(); return renderer.domElement.toDataURL(type, q); }
window.GolfView = { frame, ready: true, snapshot, debugCam: (pos, look) => { DBG = pos ? { pos: V(...pos), look: V(...look) } : null; } };
