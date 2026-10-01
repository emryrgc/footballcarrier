// Prosedürel insan modeli + prosedürel animasyon sistemi.
// Model ilkel geometrilerden (kapsül, kutu, küre) kurulur; tüm animasyonlar
// eklem açılarının matematiksel olarak hesaplanmasıyla üretilir.
import * as THREE from 'three';

let GEO = null;
function geos() {
  if (GEO) return GEO;
  GEO = {
    pelvis: new THREE.BoxGeometry(0.36, 0.2, 0.22),
    torso: new THREE.CapsuleGeometry(0.19, 0.3, 4, 10),
    head: new THREE.SphereGeometry(0.125, 14, 12),
    hair: new THREE.SphereGeometry(0.132, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
    neck: new THREE.CylinderGeometry(0.055, 0.06, 0.1, 8),
    upperArm: new THREE.CapsuleGeometry(0.055, 0.2, 3, 8),
    sleeve: new THREE.CapsuleGeometry(0.068, 0.1, 3, 8),
    foreArm: new THREE.CapsuleGeometry(0.048, 0.18, 3, 8),
    hand: new THREE.SphereGeometry(0.052, 8, 6),
    thigh: new THREE.CapsuleGeometry(0.078, 0.28, 3, 8),
    shorts: new THREE.CapsuleGeometry(0.098, 0.14, 3, 8),
    shin: new THREE.CapsuleGeometry(0.062, 0.3, 3, 8),
    foot: new THREE.BoxGeometry(0.1, 0.07, 0.25),
    numberPlane: new THREE.PlaneGeometry(0.24, 0.24),
    shadow: new THREE.CircleGeometry(0.45, 16),
    ring: new THREE.RingGeometry(0.55, 0.72, 32),
  };
  return GEO;
}

const matCache = new Map();
function mat(color) {
  const key = String(color);
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshLambertMaterial({ color }));
  return matCache.get(key);
}

let shadowMat = null;
function getShadowMat() {
  if (shadowMat) return shadowMat;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 2, 32, 32, 32);
  grd.addColorStop(0, 'rgba(0,0,0,0.55)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  shadowMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false });
  return shadowMat;
}

const numberTexCache = new Map();
function numberMat(num, color) {
  const key = num + color;
  if (numberTexCache.has(key)) return numberTexCache.get(key);
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.font = 'bold 46px Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = 4;
  g.strokeStyle = 'rgba(0,0,0,0.35)';
  g.strokeText(String(num), 32, 35);
  g.fillStyle = color;
  g.fillText(String(num), 32, 35);
  const m = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false });
  numberTexCache.set(key, m);
  return m;
}

function mesh(geo, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  return m;
}

const JOINTS = [
  'hipLx', 'hipRx', 'hipLz', 'hipRz', 'kneeL', 'kneeR', 'ankleL', 'ankleR',
  'shLx', 'shRx', 'shLz', 'shRz', 'elL', 'elR',
  'spineX', 'spineY', 'spineZ', 'headX', 'headY',
  'bodyX', 'bodyZ', 'bodyY', 'hipsY',
];

const ease = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const easeOut = t => 1 - (1 - t) * (1 - t);
const clamp01 = t => Math.max(0, Math.min(1, t));

export class Humanoid {
  constructor(look) {
    const G = geos();
    this.look = look;
    const skin = mat(look.skin);
    const shirt = mat(look.shirt);
    const shorts = mat(look.shorts);
    const socks = mat(look.socks);
    const boots = mat(look.boots || '#151515');
    const hair = mat(look.hair);
    const gloves = look.gloves ? mat(look.gloves) : skin;

    this.root = new THREE.Group();
    this.body = new THREE.Group();
    this.root.add(this.body);

    const sh = new THREE.Mesh(G.shadow, getShadowMat());
    sh.rotation.x = -Math.PI / 2;
    sh.position.y = 0.015;
    sh.renderOrder = 1;
    this.root.add(sh);
    this.shadow = sh;

    this.hips = new THREE.Group();
    this.hips.position.y = 0.95;
    this.body.add(this.hips);
    this.hips.add(mesh(G.pelvis, shorts, 0, 0.02, 0));

    this.spine = new THREE.Group();
    this.spine.position.y = 0.08;
    this.hips.add(this.spine);
    const torso = mesh(G.torso, shirt, 0, 0.27, 0);
    torso.scale.set(1.12, 1, 0.68);
    this.spine.add(torso);
    if (look.number != null) {
      const np = new THREE.Mesh(G.numberPlane, numberMat(look.number, look.numberColor || '#ffffff'));
      np.position.set(0, 0.33, -0.135);
      np.rotation.y = Math.PI;
      this.spine.add(np);
    }

    this.neck = new THREE.Group();
    this.neck.position.y = 0.56;
    this.spine.add(this.neck);
    this.neck.add(mesh(G.neck, skin, 0, 0.03, 0));
    this.head = new THREE.Group();
    this.head.position.y = 0.08;
    this.neck.add(this.head);
    this.head.add(mesh(G.head, skin, 0, 0.1, 0));
    const hm = mesh(G.hair, hair, 0, 0.115, -0.012);
    hm.rotation.x = -0.25;
    this.head.add(hm);

    // Kollar
    const arm = (side) => {
      const s = new THREE.Group();
      s.position.set(side * 0.25, 0.46, 0);
      this.spine.add(s);
      s.add(mesh(G.sleeve, shirt, 0, -0.08, 0));
      s.add(mesh(G.upperArm, look.longSleeves ? shirt : skin, 0, -0.15, 0));
      const e = new THREE.Group();
      e.position.y = -0.3;
      s.add(e);
      e.add(mesh(G.foreArm, look.longSleeves ? shirt : skin, 0, -0.12, 0));
      e.add(mesh(G.hand, gloves, 0, -0.26, 0));
      return [s, e];
    };
    [this.shL, this.elL] = arm(1);
    [this.shR, this.elR] = arm(-1);

    // Bacaklar
    const leg = (side) => {
      const h = new THREE.Group();
      h.position.set(side * 0.1, -0.04, 0);
      this.hips.add(h);
      h.add(mesh(G.shorts, shorts, 0, -0.1, 0));
      h.add(mesh(G.thigh, skin, 0, -0.22, 0));
      const k = new THREE.Group();
      k.position.y = -0.44;
      h.add(k);
      k.add(mesh(G.shin, socks, 0, -0.2, 0));
      const a = new THREE.Group();
      a.position.y = -0.43;
      k.add(a);
      a.add(mesh(G.foot, boots, 0, -0.01, 0.06));
      return [h, k, a];
    };
    [this.hipL, this.kneeL, this.ankleL] = leg(1);
    [this.hipR, this.kneeR, this.ankleR] = leg(-1);

    this.p = {};
    this.t = {};
    for (const j of JOINTS) { this.p[j] = 0; this.t[j] = 0; }
    this.phase = Math.random() * Math.PI * 2;
    this.time = Math.random() * 10;
    this.action = null;
    this.speed = 0;
    this.stance = look.keeper ? 'keeper' : 'normal';
    this.lying = 0;
  }

  // Tek seferlik animasyon başlat. Döndürdüğü değer: temas anı (saniye).
  play(name, opts = {}) {
    const D = {
      kick: [0.46, 0.25], pass: [0.34, 0.17], chip: [0.44, 0.24], tackle: [1.0, 0.18],
      dive: [1.25, 0.3], fall: [1.5, 0], stumble: [0.55, 0], skill: [0.5, 0],
      celebrate: [3.2, 0], catch: [0.6, 0.15], header: [0.5, 0.2], call: [0.7, 0],
    }[name] || [0.5, 0];
    this.action = { name, t: 0, dur: opts.dur || D[0], side: opts.side || 1, variant: opts.variant ?? 0, power: opts.power ?? 1 };
    return D[1];
  }

  isBusy() { return !!this.action; }

  update(dt, speed) {
    this.time += dt;
    this.speed = speed;
    const t = this.t;
    for (const j of JOINTS) t[j] = 0;

    // Lokomotion
    const s = Math.min(speed / 7.5, 1.25);
    if (speed > 0.15) {
      this.phase += dt * Math.PI * 2 * (0.75 + speed * 0.12);
    }
    const ph = this.phase;
    if (this.stance === 'keeper' && speed < 2.5) {
      // Kaleci hazır duruşu
      const b = Math.sin(this.time * 3) * 0.02;
      const sh = Math.sin(ph) * 0.25 * Math.min(1, speed);
      t.hipLx = -0.45 + sh; t.hipRx = -0.45 - sh; t.kneeL = 0.75; t.kneeR = 0.75;
      t.ankleL = -0.25; t.ankleR = -0.25;
      t.hipLz = 0.12; t.hipRz = -0.12;
      t.spineX = 0.35; t.bodyY = -0.13 + b; t.headX = -0.3;
      t.shLx = -0.7; t.shRx = -0.7; t.shLz = 0.45; t.shRz = -0.45; t.elL = -0.6; t.elR = -0.6;
    } else if (speed > 0.15) {
      const swing = 0.85 * s;
      t.hipRx = -Math.sin(ph) * swing - 0.1 * s;
      t.hipLx = Math.sin(ph) * swing - 0.1 * s;
      t.kneeR = 0.15 + 1.35 * s * Math.max(0, Math.cos(ph)) + 0.25 * s;
      t.kneeL = 0.15 + 1.35 * s * Math.max(0, Math.cos(ph + Math.PI)) + 0.25 * s;
      t.ankleR = -0.2 * s * Math.sin(ph);
      t.ankleL = 0.2 * s * Math.sin(ph);
      t.shRx = Math.sin(ph) * 0.9 * s;
      t.shLx = -Math.sin(ph) * 0.9 * s;
      t.shLz = 0.12; t.shRz = -0.12;
      t.elL = -0.35 - 0.9 * s; t.elR = -0.35 - 0.9 * s;
      t.spineX = 0.08 + 0.2 * s;
      t.spineY = Math.sin(ph) * 0.15 * s;
      t.headX = -0.1 * s;
      t.bodyY = Math.abs(Math.cos(ph)) * 0.07 * s - 0.04 * s;
    } else {
      // Boşta: nefes alma
      const br = Math.sin(this.time * 2.2);
      t.spineX = 0.03 + br * 0.02;
      t.shLz = 0.1 + br * 0.02; t.shRz = -0.1 - br * 0.02;
      t.elL = -0.15; t.elR = -0.15;
      t.kneeL = 0.08; t.kneeR = 0.08; t.hipLx = -0.04; t.hipRx = -0.04;
      t.headY = Math.sin(this.time * 0.7) * 0.25;
    }

    let blend = 14;
    if (this.action) {
      const a = this.action;
      a.t += dt;
      const u = clamp01(a.t / a.dur);
      blend = this.applyAction(a, u, t) ?? 22;
      if (a.t >= a.dur) this.action = null;
    }

    const k = Math.min(1, dt * blend);
    const p = this.p;
    for (const j of JOINTS) p[j] += (t[j] - p[j]) * k;
    this.apply();
  }

  applyAction(a, u, t) {
    const side = a.side;
    switch (a.name) {
      case 'kick':
      case 'pass':
      case 'chip': {
        const amp = a.name === 'pass' ? 0.6 : a.name === 'chip' ? 0.85 : 0.75 + 0.35 * a.power;
        // Destek bacağı
        t.hipLx = -0.15; t.kneeL = 0.35; t.ankleL = -0.1;
        t.shLz = 0.7; t.shRz = -0.6; t.elL = -0.3; t.elR = -0.3;
        if (u < 0.5) {
          const k = ease(u / 0.5);
          t.hipRx = 1.0 * amp * k; t.kneeR = 1.7 * amp * k;
          t.shLx = -0.7 * k; t.shRx = 0.5 * k;
          t.spineY = 0.35 * amp * k; t.spineX = -0.05 * k;
          t.hipRz = a.name === 'pass' ? -0.25 * k : 0;
        } else if (u < 0.72) {
          const k = easeOut((u - 0.5) / 0.22);
          t.hipRx = 1.0 * amp - (2.4 * amp) * k; t.kneeR = 1.7 * amp * (1 - k) + 0.05;
          t.shLx = -0.7 + 0.9 * k; t.shRx = 0.5 - 1.0 * k;
          t.spineY = 0.35 * amp - 0.7 * amp * k; t.spineX = 0.15 * k;
          t.hipRz = a.name === 'pass' ? -0.35 : 0;
          t.bodyY = 0.04 * k * amp;
        } else {
          const k = ease((u - 0.72) / 0.28);
          t.hipRx = -1.4 * amp * (1 - k); t.kneeR = 0.05 + 0.4 * k;
          t.shLx = 0.2 * (1 - k); t.shRx = -0.5 * (1 - k);
          t.spineY = -0.35 * amp * (1 - k); t.spineX = 0.15 * (1 - k);
          t.bodyY = 0.04 * amp * (1 - k);
        }
        return 30;
      }
      case 'header': {
        const k = Math.sin(u * Math.PI);
        t.bodyY = 0.35 * k; t.spineX = -0.4 + 0.9 * clamp01((u - 0.3) * 3);
        t.headX = 0.4 * k; t.shLx = -1.2 * k; t.shRx = -1.2 * k; t.shLz = 0.6; t.shRz = -0.6;
        t.kneeL = 0.6 * k; t.kneeR = 0.6 * k;
        return 25;
      }
      case 'tackle': {
        // Kayarak müdahale
        const inK = ease(clamp01(u / 0.18));
        const outK = 1 - ease(clamp01((u - 0.68) / 0.32));
        const k = inK * outK;
        t.bodyY = -0.62 * k;
        t.bodyX = -0.15 * k;
        t.spineX = -0.55 * k;
        t.hipRx = -1.45 * k; t.kneeR = 0.05;
        t.hipLx = -0.35 * k; t.kneeL = 1.9 * k;
        t.ankleR = 0.4 * k;
        t.shLx = 0.6 * k; t.shLz = 0.9 * k; t.elL = -0.2;
        t.shRx = -0.9 * k; t.shRz = -0.8 * k; t.elR = -0.5;
        t.headX = 0.3 * k;
        return 26;
      }
      case 'dive': {
        // Kaleci plonjonu (side: +1 = +x yönü)
        const up = Math.sin(clamp01(u / 0.55) * Math.PI);
        const roll = ease(clamp01(u / 0.4));
        const getUp = ease(clamp01((u - 0.82) / 0.18));
        const r = roll * (1 - getUp);
        t.bodyZ = -side * 1.35 * r;
        t.bodyY = 0.35 * up * (1 - getUp);
        t.shLx = -2.9 * r; t.shRx = -2.9 * r;
        t.shLz = 0.25 * r; t.shRz = -0.25 * r;
        t.elL = -0.1; t.elR = -0.1;
        t.hipLx = -0.2 * r; t.hipRx = 0.1 * r;
        t.kneeL = 0.3 * r; t.kneeR = 0.4 * r;
        t.hipLz = side > 0 ? 0.3 * r : 0.05 * r;
        t.hipRz = side < 0 ? -0.3 * r : -0.05 * r;
        t.spineZ = -side * 0.2 * r;
        return 20;
      }
      case 'catch': {
        const k = Math.sin(clamp01(u * 1.2) * Math.PI * 0.5);
        t.shLx = -1.2 * k; t.shRx = -1.2 * k; t.shLz = 0.25; t.shRz = -0.25;
        t.elL = -1.3 * k; t.elR = -1.3 * k; t.spineX = 0.3 * k; t.kneeL = 0.3; t.kneeR = 0.3;
        return 25;
      }
      case 'fall': {
        const down = easeOut(clamp01(u / 0.22));
        const getUp = ease(clamp01((u - 0.75) / 0.25));
        const k = down * (1 - getUp);
        t.bodyX = 1.45 * k;
        t.bodyY = -0.05 * k;
        t.shLx = -2.6 * k; t.shRx = -2.6 * k; t.shLz = 0.4 * k; t.shRz = -0.4 * k;
        t.elL = -0.4 * k; t.elR = -0.4 * k;
        t.kneeL = 0.3 * k; t.kneeR = 0.6 * k; t.hipLx = 0.1 * k;
        t.headX = -0.6 * k;
        return u < 0.22 ? 14 : 18;
      }
      case 'stumble': {
        const k = Math.sin(u * Math.PI);
        t.spineX = 0.6 * k; t.bodyX = 0.25 * k;
        t.shLx = -1.0 * k; t.shRx = -0.6 * k; t.shLz = 0.8 * k; t.shRz = -0.9 * k;
        t.kneeL = 0.6 * k; t.headX = -0.3 * k;
        return 20;
      }
      case 'skill': {
        // Step-over (makas): sağ bayak topun etrafında döner, gövde yalpalar
        const k = Math.sin(u * Math.PI);
        const sw = Math.sin(u * Math.PI * 2);
        t.hipRz = -0.55 * k * side; t.hipRx = -0.6 * k; t.kneeR = 0.9 * k;
        t.hipLz = 0.2 * k * side; t.kneeL = 0.4;
        t.spineZ = 0.3 * sw * side; t.bodyZ = 0.12 * sw * side;
        t.spineY = 0.4 * sw * side;
        t.shLz = 0.7; t.shRz = -0.7; t.elL = -0.3; t.elR = -0.3;
        t.bodyY = -0.06 * k;
        return 28;
      }
      case 'call': {
        // Top isteme: kol kaldırma
        const k = Math.sin(clamp01(u) * Math.PI);
        t.shRx = -2.7 * k; t.shRz = -0.3 * k; t.elR = -0.2;
        return 18;
      }
      case 'celebrate': {
        const v = a.variant;
        if (v === 0) {
          // Zıplayarak yumruk sallama
          const j = Math.abs(Math.sin(a.t * 7));
          t.bodyY = 0.32 * j;
          t.kneeL = 0.9 * (1 - j); t.kneeR = 0.9 * (1 - j); t.hipLx = -0.5 * (1 - j); t.hipRx = -0.5 * (1 - j);
          t.shLx = -2.8; t.shRx = -2.8; t.shLz = 0.35; t.shRz = -0.35;
          t.elL = -0.6 - 0.5 * Math.sin(a.t * 14); t.elR = -0.6 - 0.5 * Math.sin(a.t * 14 + 1);
          t.headX = -0.4;
        } else if (v === 1) {
          // Uçak: kollar açık
          t.shLz = 1.5; t.shRz = -1.5; t.elL = 0; t.elR = 0;
          t.bodyZ = Math.sin(a.t * 3) * 0.35; t.spineX = 0.2; t.headX = -0.2;
          return 10;
        } else {
          // Diz üstü kayma
          const k = ease(clamp01(u / 0.15));
          t.bodyY = -0.5 * k; t.hipLx = 0.15 * k; t.hipRx = 0.15 * k;
          t.kneeL = 1.65 * k; t.kneeR = 1.65 * k; t.ankleL = 0.6 * k; t.ankleR = 0.6 * k;
          t.spineX = -0.45 * k; t.headX = -0.5 * k;
          t.shLx = -2.6 * k; t.shRx = -2.6 * k; t.shLz = 0.6; t.shRz = -0.6;
          t.elL = -0.2; t.elR = -0.2;
        }
        return 16;
      }
    }
    return 20;
  }

  apply() {
    const p = this.p;
    this.hipL.rotation.set(p.hipLx, 0, p.hipLz);
    this.hipR.rotation.set(p.hipRx, 0, p.hipRz);
    this.kneeL.rotation.x = p.kneeL;
    this.kneeR.rotation.x = p.kneeR;
    this.ankleL.rotation.x = p.ankleL;
    this.ankleR.rotation.x = p.ankleR;
    this.shL.rotation.set(p.shLx, 0, p.shLz);
    this.shR.rotation.set(p.shRx, 0, p.shRz);
    this.elL.rotation.x = p.elL;
    this.elR.rotation.x = p.elR;
    this.spine.rotation.set(p.spineX, p.spineY, p.spineZ);
    this.head.rotation.set(p.headX, p.headY, 0);
    this.body.rotation.set(p.bodyX, 0, p.bodyZ);
    this.body.position.y = p.bodyY;
    this.hips.position.y = 0.95 + p.hipsY;
    // Gölge vücut yatınca kayar
    this.shadow.position.x = -Math.sin(p.bodyZ) * 0.7;
    this.shadow.position.z = Math.sin(p.bodyX) * 0.7;
  }

  dispose() {
    this.root.removeFromParent();
  }
}

export function makeRing(color) {
  const m = new THREE.Mesh(geos().ring, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.03;
  m.renderOrder = 2;
  return m;
}
