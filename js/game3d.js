// 3D dünya: renderer, stadyum, saha, kaleler, top görseli, kamera döngüsü.
import * as THREE from 'three';

export const FIELD = { HW: 34, HL: 52.5, GOAL_HW: 3.66, GOAL_H: 2.44, GOAL_D: 2.0 };
const PX = 14; // saha dokusu: metre başına piksel

function pitchTexture() {
  const W = Math.round((FIELD.HW * 2 + 8) * PX), H = Math.round((FIELD.HL * 2 + 8) * PX);
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const ox = 4 * PX, oy = 4 * PX;
  // Çim şeritleri
  const stripes = 20;
  for (let i = 0; i < stripes; i++) {
    g.fillStyle = i % 2 ? '#3f8f3a' : '#479c40';
    const y0 = (H / stripes) * i;
    g.fillRect(0, y0, W, H / stripes + 1);
  }
  // Hafif doku gürültüsü
  for (let i = 0; i < 9000; i++) {
    g.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.04)';
    g.fillRect(Math.random() * W, Math.random() * H, 2, 2);
  }
  g.strokeStyle = 'rgba(255,255,255,0.92)';
  g.lineWidth = 0.13 * PX;
  const m = v => v * PX;
  const X = x => ox + m(x + FIELD.HW);
  const Y = z => oy + m(FIELD.HL - z); // +z yukarı (doku üstü)
  g.strokeRect(X(-FIELD.HW), Y(FIELD.HL), m(FIELD.HW * 2), m(FIELD.HL * 2));
  g.beginPath(); g.moveTo(X(-FIELD.HW), Y(0)); g.lineTo(X(FIELD.HW), Y(0)); g.stroke();
  g.beginPath(); g.arc(X(0), Y(0), m(9.15), 0, Math.PI * 2); g.stroke();
  g.fillStyle = '#fff';
  g.beginPath(); g.arc(X(0), Y(0), m(0.3), 0, Math.PI * 2); g.fill();
  for (const s of [1, -1]) {
    const gz = s * FIELD.HL;
    // Ceza sahası
    g.strokeRect(X(-20.16), s > 0 ? Y(gz) : Y(gz + 16.5), m(40.32), m(16.5));
    g.strokeRect(X(-9.16), s > 0 ? Y(gz) : Y(gz + 5.5), m(18.32), m(5.5));
    const pz = gz - s * 11;
    g.beginPath(); g.arc(X(0), Y(pz), m(0.3), 0, Math.PI * 2); g.fill();
    // Ceza yayı
    g.beginPath();
    const a0 = Math.acos(5.5 / 9.15);
    if (s > 0) g.arc(X(0), Y(pz), m(9.15), a0, Math.PI - a0);
    else g.arc(X(0), Y(pz), m(9.15), Math.PI + a0, Math.PI * 2 - a0);
    g.stroke();
  }
  // Korner yayları
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    g.beginPath();
    g.arc(X(sx * FIELD.HW), Y(sz * FIELD.HL), m(1), 0, Math.PI * 2);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function crowdTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#2a2d36';
  g.fillRect(0, 0, 512, 256);
  const cols = ['#d33', '#fc3', '#fff', '#36c', '#222', '#e83', '#9c3', '#c3c', '#3cc', '#888'];
  for (let row = 0; row < 16; row++) {
    for (let i = 0; i < 64; i++) {
      const x = i * 8 + (row % 2) * 4 + Math.random() * 2;
      const y = row * 16 + 4;
      g.fillStyle = cols[(Math.random() * cols.length) | 0];
      g.fillRect(x, y + 5, 6, 7);
      g.fillStyle = ['#f1c9a5', '#c68b5e', '#7a4a2a', '#e0ac82'][(Math.random() * 4) | 0];
      g.beginPath(); g.arc(x + 3, y + 3, 2.6, 0, Math.PI * 2); g.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function adTexture() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 64;
  const g = c.getContext('2d');
  const ads = [['#c41e2a', 'FUTBOL KARİYERİ'], ['#1a64c4', 'YILDIZ OL'], ['#111', 'GOOOL TV'], ['#f2c230', 'ENERJİ+'], ['#1a8a3a', 'ÇİM SPOR']];
  const w = 1024 / ads.length;
  ads.forEach(([col, txt], i) => {
    g.fillStyle = col; g.fillRect(i * w, 0, w, 64);
    g.fillStyle = col === '#f2c230' ? '#111' : '#fff';
    g.font = 'bold 30px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(txt, i * w + w / 2, 34);
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

function ballTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#f4f4f4';
  g.fillRect(0, 0, 256, 128);
  g.fillStyle = '#161616';
  const spots = [[32, 20], [96, 20], [160, 20], [224, 20], [0, 64], [64, 64], [128, 64], [192, 64], [256, 64], [32, 108], [96, 108], [160, 108], [224, 108]];
  for (const [x, y] of spots) {
    g.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
      const px = x + Math.cos(a) * 14, py = y + Math.sin(a) * 12;
      i ? g.lineTo(px, py) : g.moveTo(px, py);
    }
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function buildGoal(scene, s) {
  const { GOAL_HW: hw, GOAL_H: h, GOAL_D: d, HL } = FIELD;
  const z = s * HL;
  const white = new THREE.MeshLambertMaterial({ color: '#ffffff' });
  const r = 0.06;
  const post = new THREE.CylinderGeometry(r, r, h, 10);
  for (const sx of [-1, 1]) {
    const p = new THREE.Mesh(post, white);
    p.position.set(sx * hw, h / 2, z);
    scene.add(p);
  }
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(r, r, hw * 2 + r * 2, 10), white);
  bar.rotation.z = Math.PI / 2;
  bar.position.set(0, h, z);
  scene.add(bar);
  // File (çizgi ızgarası)
  const pts = [];
  const zb = z + s * d;
  const step = 0.25;
  for (let x = -hw; x <= hw + 1e-3; x += step) {
    pts.push(x, 0, zb, x, h * 0.8, zb); // arka
    pts.push(x, h, z, x, h * 0.8, zb); // üst
  }
  for (let y = 0; y <= h * 0.8 + 1e-3; y += step) pts.push(-hw, y, zb, hw, y, zb);
  for (let k = 0; k <= 1.0001; k += step / d) {
    const zz = z + s * d * k, yy = h - (h * 0.2) * k;
    pts.push(-hw, yy, zz, hw, yy, zz);
    for (const sx of [-1, 1]) pts.push(sx * hw, 0, zz, sx * hw, yy, zz);
  }
  for (const sx of [-1, 1]) for (let y = 0; y <= h; y += step) {
    pts.push(sx * hw, y, z, sx * hw, Math.min(y, h * 0.8), zb);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const net = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: '#e8e8e8', transparent: true, opacity: 0.45 }));
  scene.add(net);
}

export class Game3D {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#0d1626');
    this.scene.fog = new THREE.Fog('#0d1626', 90, 220);
    this.camera = new THREE.PerspectiveCamera(55, 9 / 16, 0.1, 400);
    this.camera.position.set(0, 30, -40);
    this.lookAt = new THREE.Vector3(0, 0, 0);

    const hemi = new THREE.HemisphereLight('#cfe2ff', '#2f4a22', 1.6);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight('#fff6e8', 2.2);
    sun.position.set(-30, 60, -20);
    this.scene.add(sun);

    this.buildStadium();
    this.buildBall();

    this.mode = null;
    this.idleT = 0;
    this.clock = new THREE.Clock();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    if (window.ResizeObserver) new ResizeObserver(() => this.resize()).observe(canvas.parentElement);
    this.renderer.setAnimationLoop(() => this.frame());
  }

  resize() {
    const el = this.canvas.parentElement;
    const w = el.clientWidth, h = el.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  buildStadium() {
    const s = this.scene;
    // Saha
    const pitch = new THREE.Mesh(
      new THREE.PlaneGeometry(FIELD.HW * 2 + 8, FIELD.HL * 2 + 8),
      new THREE.MeshLambertMaterial({ map: pitchTexture() }),
    );
    pitch.rotation.x = -Math.PI / 2;
    s.add(pitch);
    // Dış çim
    const outer = new THREE.Mesh(new THREE.PlaneGeometry(130, 170), new THREE.MeshLambertMaterial({ color: '#2f6e2c' }));
    outer.rotation.x = -Math.PI / 2;
    outer.position.y = -0.02;
    s.add(outer);

    buildGoal(s, 1);
    buildGoal(s, -1);

    // Reklam panoları
    const adTex = adTexture();
    const addBoard = (len, x, z, ry) => {
      const t = adTex.clone(); t.needsUpdate = true; t.repeat.set(len / 40, 1);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.9), new THREE.MeshBasicMaterial({ map: t }));
      m.position.set(x, 0.45, z); m.rotation.y = ry; s.add(m);
    };
    addBoard(FIELD.HL * 2 + 6, FIELD.HW + 4.5, 0, -Math.PI / 2);
    addBoard(FIELD.HL * 2 + 6, -FIELD.HW - 4.5, 0, Math.PI / 2);
    addBoard(FIELD.HW * 2 + 6, 0, FIELD.HL + 5, Math.PI);
    addBoard(FIELD.HW * 2 + 6, 0, -FIELD.HL - 5, 0);

    // Tribünler: eğimli düzlemler + seyirci dokusu
    const crowd = crowdTexture();
    const stand = (len, depth, cx, cz, ry) => {
      const t = crowd.clone(); t.needsUpdate = true; t.repeat.set(len / 36, depth / 16);
      const g = new THREE.Group();
      const slope = new THREE.Mesh(new THREE.PlaneGeometry(len, depth), new THREE.MeshLambertMaterial({ map: t, side: THREE.DoubleSide }));
      slope.rotation.x = -(Math.PI / 2 + 0.6);
      slope.position.set(0, Math.sin(0.6) * depth / 2 + 1.2, depth * Math.cos(0.6) / 2);
      g.add(slope);
      const wall = new THREE.Mesh(new THREE.PlaneGeometry(len, 1.2), new THREE.MeshLambertMaterial({ color: '#222831', side: THREE.DoubleSide }));
      wall.position.set(0, 0.6, 0);
      g.add(wall);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(len, 0.4, depth * 0.7), new THREE.MeshLambertMaterial({ color: '#3a3f4a' }));
      roof.position.set(0, Math.sin(0.6) * depth + 6, depth * Math.cos(0.6) * 0.65);
      g.add(roof);
      g.position.set(cx, 0, cz);
      g.rotation.y = ry;
      s.add(g);
    };
    stand(FIELD.HL * 2 + 14, 26, FIELD.HW + 6.5, 0, Math.PI / 2);
    stand(FIELD.HL * 2 + 14, 26, -FIELD.HW - 6.5, 0, -Math.PI / 2);
    stand(FIELD.HW * 2 + 14, 22, 0, FIELD.HL + 7, 0);
    stand(FIELD.HW * 2 + 14, 22, 0, -FIELD.HL - 7, Math.PI);

    // Işık direkleri
    const poleMat = new THREE.MeshLambertMaterial({ color: '#555' });
    const lampMat = new THREE.MeshBasicMaterial({ color: '#fffbe0' });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 40, 6), poleMat);
      pole.position.set(sx * 58, 20, sz * 74);
      s.add(pole);
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(8, 4, 1), lampMat);
      lamp.position.set(sx * 58, 41, sz * 74);
      lamp.lookAt(0, 0, 0);
      s.add(lamp);
    }
  }

  buildBall() {
    const g = new THREE.Group();
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.12, 18, 14), new THREE.MeshLambertMaterial({ map: ballTexture() }));
    g.add(m);
    this.ballSpin = m;
    const c = document.createElement('canvas');
    c.width = c.height = 32;
    const cg = c.getContext('2d');
    const grd = cg.createRadialGradient(16, 16, 1, 16, 16, 16);
    grd.addColorStop(0, 'rgba(0,0,0,0.6)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
    cg.fillStyle = grd; cg.fillRect(0, 0, 32, 32);
    const sh = new THREE.Mesh(new THREE.CircleGeometry(0.2, 12), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
    sh.rotation.x = -Math.PI / 2;
    this.scene.add(sh);
    this.ballShadow = sh;
    this.ballMesh = g;
    this.scene.add(g);
  }

  setBall(pos, vel, dt) {
    this.ballMesh.position.copy(pos);
    this.ballShadow.position.set(pos.x, 0.02, pos.z);
    const s = Math.max(0.3, 1 - pos.y * 0.08);
    this.ballShadow.scale.set(s, s, s);
    if (vel && dt) {
      const sp = Math.hypot(vel.x, vel.z);
      if (sp > 0.05) {
        const axis = new THREE.Vector3(vel.z, 0, -vel.x).normalize();
        this.ballSpin.rotateOnWorldAxis(axis, (sp * dt) / 0.12);
      }
    }
  }

  setMode(mode) { this.mode = mode; }

  frame() {
    let dt = Math.min(this.clock.getDelta(), 1 / 20);
    if (this.mode && this.mode.update) {
      this.mode.update(dt);
    } else {
      // Boşta: stadyum etrafında yavaş tur
      this.idleT += dt * 0.08;
      const r = 62;
      this.camera.position.set(Math.sin(this.idleT) * r * 0.6, 26, Math.cos(this.idleT) * r);
      this.lookAt.set(0, 0, 0);
      this.camera.lookAt(this.lookAt);
      this.setBall(new THREE.Vector3(0, 0.11, 0));
    }
    this.renderer.render(this.scene, this.camera);
  }
}
