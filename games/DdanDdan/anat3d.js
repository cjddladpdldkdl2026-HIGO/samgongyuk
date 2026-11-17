/* 딴딴/딴 3D 해부학 화면 — 지금 외치는 용어의 부위가 박스 색으로 빛나요 (2026-11-17)
 *
 *  모델: BodyParts3D 4.0 (© DBCLS, CC BY 4.0) — human-atlas (MIT) 의 단순화 메시에서 골라 만듦
 *        anat/anat.json  장면별 부위 목록 + 용어(영어 소문자) → 부위 번호
 *        anat/brain.bin · skeleton.bin · skull.bin · muscle.bin  (위치 uint16 양자화 + 인덱스 uint16)
 *  쓰는 법 (index.html):
 *        Anat3D.start(div, map)   플레이 시작 — 맵에 맞는 장면을 미리 불러와요
 *        Anat3D.focus(word, '#7cc8ff')  지금 박스의 용어 { en, ko, map }
 *        Anat3D.beat()            박자마다 한 번 (빛이 두근)
 *        Anat3D.stop()            플레이 끝
 *  3D 를 못 그리는 기기(WebGL 없음 등)면 조용히 아무것도 안 해요 — 게임은 그대로.
 */
const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
const MAP_SCENE = { brain: 'brain', tract: 'brain', nuclei: 'brain', bone: 'skeleton', headbone: 'skull', muscle: 'muscle', headmuscle: 'skull', all: 'brain' };
const BASE = { brain: 0xd8b0a2, skeleton: 0xeadfc4, skull: 0xeadfc4, muscle: 0xb65a4e };

let T = null, atlas = null, renderer, scene, camera, box, label, failed = false, booting = null;
const groups = {}, loading = {};
let shown = null, focusIds = [], hlMat = null, dimMats = {}, baseMats = {};
let target = null, dist = 1, want = null, wantDist = 1, theta = 0, pulse = 0, last = 0, running = false, token = 0;

async function boot() {
  if (booting) return booting;
  booting = (async () => {
    T = await import(THREE_URL);
    atlas = await (await fetch(new URL('anat/anat.json', import.meta.url))).json();
    renderer = new T.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
    renderer.outputColorSpace = T.SRGBColorSpace;
    scene = new T.Scene();
    camera = new T.PerspectiveCamera(32, 16 / 9, 0.01, 20);
    scene.add(new T.HemisphereLight(0xeef6ff, 0x1a2140, 1.15));
    const key = new T.DirectionalLight(0xffffff, 1.6); key.position.set(0.6, 1, 1.2); camera.add(key);
    const rim = new T.DirectionalLight(0x9fd6ff, 0.8); rim.position.set(-1, 0.4, -1); camera.add(rim);
    scene.add(camera);
    target = new T.Vector3(0, 1.5, 0); want = target.clone();
    hlMat = new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.45, metalness: 0.05, emissive: 0x7cc8ff, emissiveIntensity: 0.6 });
    for (const [k, c] of Object.entries(BASE)) {
      baseMats[k] = new T.MeshStandardMaterial({ color: c, roughness: 0.62, metalness: 0.02 });
      dimMats[k] = new T.MeshStandardMaterial({ color: new T.Color(c).multiplyScalar(k === 'brain' ? 0.6 : 0.45), roughness: 0.75, metalness: 0, transparent: true, opacity: k === 'brain' ? 0.1 : 0.28, depthWrite: false });
    }
  })().catch((e) => { failed = true; console.warn('[Anat3D] 3D 를 쓸 수 없어요', e); });
  return booting;
}

async function loadScene(name) {
  if (groups[name]) return groups[name];
  if (loading[name]) return loading[name];
  loading[name] = (async () => {
    const sc = atlas.scenes[name];
    const buf = await (await fetch(new URL('anat/' + sc.file, import.meta.url))).arrayBuffer();
    const q = new Uint16Array(buf, 0, sc.posBytes / 2), ix = new Uint16Array(buf, sc.posBytes);
    const g = new T.Group(); g.visible = false; g.userData.meshes = [];
    for (const p of sc.parts) {
      const pos = new Float32Array(p.v * 3);
      for (let j = 0; j < p.v * 3; j++) { const a = j % 3; pos[j] = sc.lo[a] + q[p.vo * 3 + j] / 65535 * sc.span[a]; }
      const geo = new T.BufferGeometry();
      geo.setAttribute('position', new T.BufferAttribute(pos, 3));
      geo.setIndex(new T.BufferAttribute(ix.slice(p.io, p.io + p.i), 1));
      geo.computeVertexNormals();
      const m = new T.Mesh(geo, baseMats[name]); m.userData.b = p.b; m.userData.side = /right/i.test(p.name) ? 'R' : /left/i.test(p.name) ? 'L' : '';
      g.add(m); g.userData.meshes.push(m);
    }
    const lo = sc.lo, hi = sc.lo.map((v, a) => v + sc.span[a]);
    g.userData.box = [lo, hi];
    scene.add(g); groups[name] = g;
    return g;
  })();
  return loading[name];
}

function frameBox(lo, hi, tight, floor = 0) {
  const c = new T.Vector3((lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2);
  const r = Math.max(0.02, Math.hypot(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) / 2);
  want = c;
  wantDist = Math.max(tight ? 0.16 : 0.3, floor, r / Math.sin(T.MathUtils.degToRad(camera.fov / 2)) * (tight ? 1.25 : 1.05));
}

function show(name) {
  if (shown === name) return;
  for (const [k, g] of Object.entries(groups)) g.visible = k === name;
  shown = name;
}

function paint(name, ids, color) {
  const g = groups[name]; if (!g) return;
  const set = new Set(ids);
  hlMat.color.set(color).lerp(new T.Color(BASE[name]), 0.35);
  hlMat.emissive.set(color);
  g.userData.meshes.forEach((m, i) => { m.material = !set.size ? baseMats[name] : set.has(i) ? hlMat : dimMats[name]; m.renderOrder = set.has(i) ? 1 : 0; });
}

function setLabel(word, term) {
  if (!label) return;
  const note = !term || !term.p.length ? '3D 모델이 없어요' : term.exact ? '' : '근처 부위로 표시';
  label.innerHTML = `<b>${word.en}</b><span>${word.ko}</span>${note ? `<i>${note}</i>` : ''}`;
  label.classList.add('on');
}

function loop(now) {
  if (!running) return;
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now;
  const w = box.clientWidth, h = box.clientHeight;
  if (!w || !h) return;
  const cv = renderer.domElement;
  if (cv.width !== Math.round(w * renderer.getPixelRatio()) || cv.height !== Math.round(h * renderer.getPixelRatio())) {
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  const k = 1 - Math.pow(0.0025, dt);           // smooth glide to the new part
  target.lerp(want, k); dist += (wantDist - dist) * k;
  theta += dt * 0.32;                           // slow turn around the part
  camera.position.set(target.x + Math.sin(theta) * dist, target.y + dist * 0.18, target.z + Math.cos(theta) * dist);
  camera.lookAt(target);
  pulse = Math.max(0, pulse - dt * 3.2);
  if (hlMat) hlMat.emissiveIntensity = 0.45 + 0.9 * pulse;
  renderer.render(scene, camera);
}

window.Anat3D = {
  async start(el, map) {
    box = el; running = false; token++;
    await boot(); if (failed) return;
    if (!box.contains(renderer.domElement)) { box.innerHTML = ''; box.appendChild(renderer.domElement); label = document.createElement('div'); label.className = 'anatLabel'; box.appendChild(label);
      const cr = document.createElement('div'); cr.className = 'anatCredit'; cr.textContent = '3D: BodyParts3D © DBCLS · CC BY 4.0'; box.appendChild(cr); }
    label.classList.remove('on');
    const name = MAP_SCENE[map] || 'brain', my = token;
    await loadScene(name).catch(() => null); if (my !== token || !groups[name]) return;
    show(name); paint(name, [], 0xffffff);
    const [lo, hi] = groups[name].userData.box; frameBox(lo, hi, false);
    target.copy(want); dist = wantDist; theta = 0;
    running = true; last = 0; requestAnimationFrame(loop);
  },
  async focus(word, color) {
    if (failed || !atlas || !word) return;
    const term = atlas.terms[String(word.en).toLowerCase()];
    const name = (term && term.scene) || MAP_SCENE[word.map] || 'brain', my = ++token;
    setLabel(word, term);
    await loadScene(name).catch(() => null); if (my !== token || !groups[name]) return;
    show(name);
    const ids = term ? term.p : [];
    paint(name, ids, color || '#7cc8ff');
    if (ids.length) {
      const ms = groups[name].userData.meshes, lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
      // both sides lit (e.g. deltoid): the camera frames just one side so the part stays big
      const one = ids.some(i => ms[i].userData.side === 'L') && ids.some(i => ms[i].userData.side === 'R') ? ids.filter(i => ms[i].userData.side !== 'R') : ids;
      one.forEach(i => { const b = ms[i].userData.b; for (let a = 0; a < 3; a++) { lo[a] = Math.min(lo[a], b[0][a]); hi[a] = Math.max(hi[a], b[1][a]); } });
      // brain: deep parts sit inside the cortex, so the camera stays outside the whole brain
      const [blo, bhi] = groups[name].userData.box;
      const outside = name === 'brain' ? Math.hypot(bhi[0] - blo[0], bhi[1] - blo[1], bhi[2] - blo[2]) / 2 / Math.sin(T.MathUtils.degToRad(camera.fov / 2)) * 0.62 : 0;
      frameBox(lo, hi, true, outside);
      if (name === 'brain') want.lerp(new T.Vector3((blo[0] + bhi[0]) / 2, (blo[1] + bhi[1]) / 2, (blo[2] + bhi[2]) / 2), 0.35);   // keep the brain around the part in view
    } else { const [lo, hi] = groups[name].userData.box; frameBox(lo, hi, false); }
    pulse = 1;
  },
  beat() { pulse = 1; },
  stop() { running = false; token++; if (label) label.classList.remove('on'); },
};
