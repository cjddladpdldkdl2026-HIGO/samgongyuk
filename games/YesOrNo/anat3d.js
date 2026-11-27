/* 말해 YES OR NO — 3D 해부학 문제 화면 (2026-11-27)
 *
 *  모델: BodyParts3D 4.0 (© DBCLS, CC BY 4.0) — 딴딴/딴 · 너에게 닿기를과 같은 파일(../DdanDdan/anat/*)을 같이 써요.
 *  index.html 의 보통 스크립트에서 window.YN3D 로 써요:
 *    await YN3D.init(div)        뼈 · 근육 장면을 불러와요 (실패하면 false → 3D 문제 없이 원래 사진 문제로)
 *    YN3D.names('muscle')        3D 모델의 부위 이름 목록 (근육 100개와 짝 맞추기용)
 *    YN3D.bones([정규식…], ask)  뼈 여러 개에 ①②③④ 번호 과녁 (ask = 노란 과녁, -1 이면 모두 흰색)
 *    YN3D.muscle(정규식)         그 근육만 빛나고 나머지는 반투명 + 과녁
 *  화면은 끌어서 돌려 볼 수 있어요. 3D 를 못 그리는 기기(WebGL 없음)면 init 이 false.
 */
const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
const ANAT = new URL('../DdanDdan/anat/', import.meta.url);
let T, atlas, R, scene, cam, box, ready = null;
const meshes = { skeleton: [], muscle: [] };
const M = {};
let center, dist = 1, want, wantDist = 1, theta = 0, theta0 = 0, swing = 0.4, running = false;
let pts = [], marks = [], drag = null, spin = true, t0 = 0, last = 0;

async function load(name) {
  const sc = atlas.scenes[name];
  const buf = await (await fetch(new URL(sc.file, ANAT))).arrayBuffer();
  const q = new Uint16Array(buf, 0, sc.posBytes / 2), ix = new Uint16Array(buf, sc.posBytes);
  for (const p of sc.parts) {
    if (name === 'skeleton' && /disk|cartilage/i.test(p.name)) continue;                                // 원판 · 연골은 빼요
    if (name === 'muscle' && /(inferior|superior|lateral|medial) (rectus|oblique)$|palpebrae/i.test(p.name)) continue;  // 눈 근육
    const pos = new Float32Array(p.v * 3);
    for (let j = 0; j < p.v * 3; j++) { const a = j % 3; pos[j] = sc.lo[a] + q[p.vo * 3 + j] / 65535 * sc.span[a]; }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(pos, 3));
    g.setIndex(new T.BufferAttribute(ix.slice(p.io, p.io + p.i), 1));
    g.computeVertexNormals(); g.computeBoundingBox();
    const m = new T.Mesh(g, name === 'skeleton' ? M.bone : M.musc);
    m.name = p.name; m.visible = false; scene.add(m); meshes[name].push(m);
  }
}

const View = {
  init(el) {
    if (ready) return ready;
    box = el;
    ready = (async () => {
      const c = document.createElement('canvas');
      if (!(c.getContext('webgl2') || c.getContext('webgl'))) return false;
      T = await import(THREE_URL);
      atlas = await (await fetch(new URL('anat.json', ANAT))).json();
      R = new T.WebGLRenderer({ antialias: true, alpha: true });
      R.setPixelRatio(Math.min(2, devicePixelRatio || 1)); R.outputColorSpace = T.SRGBColorSpace;
      box.prepend(R.domElement);
      scene = new T.Scene(); cam = new T.PerspectiveCamera(30, 1, 0.005, 20);
      scene.add(new T.HemisphereLight(0xf2f6ff, 0x221a44, 1.2));
      const key = new T.DirectionalLight(0xffffff, 1.7); key.position.set(0.7, 1, 1.3); cam.add(key);
      const rim = new T.DirectionalLight(0xa58bff, 1.0); rim.position.set(-1, 0.3, -1.2); cam.add(rim);
      scene.add(cam);
      M.bone = new T.MeshStandardMaterial({ color: 0xf1e6cc, roughness: 0.55 });
      M.dimBone = new T.MeshStandardMaterial({ color: 0xcfc4ad, roughness: 0.8, transparent: true, opacity: 0.22, depthWrite: false });
      M.musc = new T.MeshStandardMaterial({ color: 0x8c4a44, roughness: 0.7, transparent: true, opacity: 0.28, depthWrite: false });
      M.hi = new T.MeshStandardMaterial({ color: 0xffe27a, roughness: 0.4, emissive: 0xffb21a, emissiveIntensity: 0.8 });
      center = new T.Vector3(0, 1.2, 0); want = center.clone();
      await Promise.all([load('skeleton'), load('muscle')]);
      box.addEventListener('pointerdown', e => { drag = { x: e.clientX, th: theta }; spin = false; box.setPointerCapture(e.pointerId); });
      box.addEventListener('pointermove', e => { if (drag) theta = drag.th - (e.clientX - drag.x) * 0.01; });
      box.addEventListener('pointerup', () => { drag = null; });
      running = true; requestAnimationFrame(loop);
      return true;
    })().catch(e => { console.warn('[YN3D] 3D 를 쓸 수 없어요 → 사진 문제로', e); return false; });
    return ready;
  },
  names(scene) { return atlas ? atlas.scenes[scene].parts.map(p => p.name) : []; },
  // 뼈 문제: 고른 뼈만 진하게, 나머지 뼈는 흐리게 · ①②③④ 과녁
  bones(res, ask) {
    const pick = res.map(re => meshes.skeleton.find(m => re.test(m.name)));
    meshes.muscle.forEach(m => { m.visible = false; });
    meshes.skeleton.forEach(m => { m.visible = true; m.material = pick.includes(m) ? M.bone : M.dimBone; m.renderOrder = pick.includes(m) ? 1 : 0; });
    const bb = new T.Box3(); pick.forEach(m => m && bb.union(m.geometry.boundingBox));
    const p = pick.map(m => { if (!m) return new T.Vector3(); const b = m.geometry.boundingBox, c = b.getCenter(new T.Vector3()); c.z = b.max.z; return c; });
    frame(bb, 0, 0.35);
    setMarks(p, res.map((_, i) => '①②③④⑤⑥'[i]), ask);
  },
  // 근육 문제: 그 근육만 빛나고 나머지 근육 · 뼈는 반투명 (깊은 근육도 보여요)
  muscle(re) {
    const hit = meshes.muscle.filter(m => re.test(m.name));
    meshes.skeleton.forEach(m => { m.visible = true; m.material = M.dimBone; m.renderOrder = 0; });
    meshes.muscle.forEach(m => { m.visible = true; m.material = hit.includes(m) ? M.hi : M.musc; m.renderOrder = hit.includes(m) ? 2 : 1; });
    const bb = new T.Box3(); hit.forEach(m => bb.union(m.geometry.boundingBox));
    const c = bb.getCenter(new T.Vector3());
    const back = c.z < -0.015;                 // 뒤쪽 근육이면 등 쪽에서 봐요
    frame(bb, back ? Math.PI + 0.45 : -0.45, 0.3);
    const p = c.clone(); p.z = back ? bb.min.z : bb.max.z;
    setMarks([p], ['?'], 0);
  },
};
window.YN3D = View;

function frame(bb, th, sw) {
  const size = bb.getSize(new T.Vector3());
  want = bb.getCenter(new T.Vector3());
  wantDist = Math.max(0.18, size.length() * 1.4);
  theta0 = th; swing = sw; spin = true; t0 = performance.now(); theta = th;
}
function setMarks(p, labels, ask) {
  marks.forEach(m => m.remove());
  pts = p;
  marks = p.map((_, i) => {
    const d = document.createElement('div'); d.className = 'mark' + (i === ask ? ' ask' : '');
    d.innerHTML = `<i class="ring"></i><i class="ring r2"></i><b>${labels[i]}</b>`;
    box.appendChild(d); return d;
  });
}
function loop(now) {
  if (!running) return;
  requestAnimationFrame(loop);
  const w = box.clientWidth, h = box.clientHeight; if (!w || !h) return;   // 화면에 안 보이면 쉬어요
  if (R.domElement.width !== Math.round(w * R.getPixelRatio())) { R.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
  const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now;
  const k = 1 - Math.pow(0.002, dt);
  center.lerp(want, k); dist += (wantDist - dist) * k;
  if (spin) theta = theta0 + Math.sin((now - t0) / 1000 * 0.6) * swing;
  cam.position.set(center.x + Math.sin(theta) * dist, center.y + dist * 0.12, center.z + Math.cos(theta) * dist);
  cam.lookAt(center);
  M.hi.emissiveIntensity = 0.7 + 0.35 * Math.sin(now / 260);
  R.render(scene, cam);
  const v = new T.Vector3();
  pts.forEach((p, i) => { v.copy(p).project(cam); marks[i].style.transform = `translate(${(v.x * 0.5 + 0.5) * w}px, ${(-v.y * 0.5 + 0.5) * h}px)`; });
}
