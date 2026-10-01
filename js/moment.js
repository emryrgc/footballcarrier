// Oynanabilir pozisyon ("an") motoru: kullanıcı kendi oyuncusunu yönetir,
// takım arkadaşları/rakipler/kaleci yapay zekayla oynar. Top fiziği burada.
import * as THREE from 'three';
import { Humanoid, makeRing } from './humanoid.js';
import { FIELD } from './game3d.js';
import { input, consumeEvents, shootPower, setButtonMode } from './input.js';
import { sfx } from './audio.js';
import { hud } from './hud.js';
import { SKIN_TONES, HAIR_COLORS } from './data.js';

const V = THREE.Vector3;
const GZ = FIELD.HL, GHW = FIELD.GOAL_HW, GH = FIELD.GOAL_H, GD = FIELD.GOAL_D;
const BR = 0.11, GRAV = 9.81, FRICTION = 2.6, POST_R = 0.06;

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
function gauss() {
  let u = 0, v = 0;
  while (!u) u = Math.random();
  while (!v) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

function ballistic(from, to, speed) {
  const dx = to.x - from.x, dz = to.z - from.z;
  const D = Math.max(0.5, Math.hypot(dx, dz));
  const t = D / speed;
  const vy = (to.y - from.y) / t + 0.5 * GRAV * t;
  return new V(dx / t, vy, dz / t);
}

function randomLook(kit, number, keeper) {
  return {
    skin: pick(SKIN_TONES), hair: pick(HAIR_COLORS),
    shirt: kit.shirt, shorts: kit.shorts, socks: kit.socks,
    number, numberColor: kit.numberColor, keeper, gloves: keeper ? '#e8e8e8' : null, longSleeves: keeper,
  };
}

class Actor {
  constructor(m, o) {
    this.m = m;
    this.team = o.team;
    this.isUser = !!o.isUser;
    this.isGK = !!o.isGK;
    this.skill = o.skill;
    this.attrs = o.attrs || { hiz: o.skill, sut: o.skill, pas: o.skill, dribling: o.skill, fizik: o.skill };
    this.h = new Humanoid(o.look);
    m.scene.add(this.h.root);
    this.pos = new V(o.x, 0, o.z);
    this.vel = new V();
    this.desired = new V();
    this.face = this.team === 0 ? 0 : Math.PI;
    this.home = this.pos.clone();
    this.lane = o.x;
    this.ahead = o.ahead ?? rand(5, 10);
    this.stun = 0; this.tackleCD = rand(0.4, 1.2); this.lock = 0; this.immune = 0;
    this.burst = 0; this.skillCD = 0; this.calling = 0; this.slideT = 0;
    this.pendingKick = null; this.pendingTackle = null;
    this.ballTime = 0;
    this.stamina = 1;
    this.baseSpeed = 5.5 + (this.attrs.hiz - 50) * 0.04;
    if (this.isGK) this.baseSpeed = 5;
    this.faceLock = 0;
    this.celebrate = 0;
  }
  forward() { return new V(Math.sin(this.face), 0, Math.cos(this.face)); }
  moveTo(t, mul = 1, slowR = 1.5) {
    const dx = t.x - this.pos.x, dz = t.z - this.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.15) { this.desired.set(0, 0, 0); return d; }
    const sp = this.baseSpeed * mul * Math.min(1, d / slowR);
    this.desired.set(dx / d * sp, 0, dz / d * sp);
    return d;
  }
  faceTo(p) { this.face = Math.atan2(p.x - this.pos.x, p.z - this.pos.z); }
  dispose() { this.h.dispose(); }
}

// Senaryolar: koordinatlar [x, z]. s = ayna için ±1.
const SCENARIOS = {
  kontra: s => ({ label: 'Kontra atak!', user: [2 * s, 8], owner: 'user', mates: [[-14 * s, 5, 12], [13 * s, 7, 12]], opps: [[-7 * s, 27], [6 * s, 26], [0, 34], [4 * s, 3], [-16 * s, 22]] }),
  kurulum: s => ({ label: 'Hücum organizasyonu — boşa çık, topu iste!', user: [4 * s, 29], owner: 0, mates: [[-8 * s, 22, 4], [14 * s, 31, 8], [-15 * s, 33, 8]], opps: [[2.5 * s, 33], [-4 * s, 35.5], [10 * s, 37], [-7 * s, 27], [0, 41], [-13 * s, 38]] }),
  birebir: s => ({ label: 'Arkaya sarktın, kaleciyle karşı karşıya!', user: [3 * s, 27], owner: 'user', mates: [[-11 * s, 22, 10]], opps: [[1.5 * s, 22.5], [-9 * s, 33]] }),
  kanat: s => ({ label: 'Kanattan atak — ortala ya da içeri kat!', user: [23 * s, 27], owner: 'user', mates: [[1 * s, 38, 6], [-7 * s, 34, 6], [10 * s, 21, 4]], opps: [[19 * s, 32], [4 * s, 41], [-4 * s, 40], [-11 * s, 36], [8 * s, 30]] }),
  kenar: s => ({ label: 'Ceza sahası önünde topla buluştun', user: [-1 * s, 30], owner: 'user', mates: [[13 * s, 37, 4], [-12 * s, 35, 4]], opps: [[-0.5 * s, 34.5], [4 * s, 36], [-5 * s, 37], [6 * s, 30.5], [0, 41]] }),
  t_sut: () => {
    const a = rand(-0.9, 0.9), d = rand(16, 25);
    return { label: 'Şut antrenmanı', user: [Math.sin(a) * d, GZ - Math.cos(a) * d], owner: 'user', mates: [], opps: [] };
  },
  t_calim: () => ({ label: 'Çalım antrenmanı — ikisini de geç ve golü at!', user: [rand(-4, 4), 17], owner: 'user', mates: [], opps: [[-3, 29], [3.5, 31.5]] }),
  t_pas: () => ({ label: 'Pas antrenmanı — paslaş ve bitir!', user: [0, 14], owner: 'user', mates: [[-10, 22, 8], [10, 24, 8], [0, 32, 4]], opps: [[-4, 28], [5, 30], [0, 38]] }),
};

export class Moment {
  constructor(world, cfg) {
    this.world = world;
    this.scene = world.scene;
    this.cam = world.camera;
    this.cfg = cfg;
    this.actors = []; this.mates = []; this.opps = [];
    this.time = 0;
    this.limit = cfg.timeLimit || 22;
    this.ended = false;
    this.timeScale = 1; this.slowT = 0;
    this.stats = { shots: 0, onTarget: 0, goals: 0, assists: 0, passes: 0, passesOk: 0, dribbles: 0, lost: 0, tackles: 0 };
    this.ball = {
      pos: new V(), vel: new V(), owner: null, cool: 0, coolActor: null, flight: 0,
      rolled: new Set(), target: null, targetPt: null, lastTouch: null, lastPasser: null,
      passTime: -99, shot: null, inNet: false, isPass: false, gkDone: -1, outT: 0,
    };
    this.possLostAt = null;
    this.btnMode = null;

    const side = Math.random() < 0.5 ? 1 : -1;
    const sc = SCENARIOS[cfg.type](side);
    this.label = sc.label;

    const myKit = cfg.myKit, oppKit = cfg.oppKit;
    const u = cfg.user;
    this.user = this.add(new Actor(this, {
      team: 0, isUser: true, x: sc.user[0], z: sc.user[1], skill: overallOf(u.attrs), attrs: u.attrs,
      look: { skin: u.skin, hair: u.hair, shirt: myKit.shirt, shorts: myKit.shorts, socks: myKit.socks, number: u.number, numberColor: myKit.numberColor },
    }));
    this.user.stamina = clamp(0.45 + (cfg.energy ?? 100) / 180, 0.4, 1);
    const nums = [7, 9, 10, 11, 8, 6, 14, 17, 19, 21].filter(n => n !== u.number);
    for (const [x, z, ahead] of sc.mates) {
      this.mates.push(this.add(new Actor(this, { team: 0, x, z, ahead, skill: cfg.myStr + rand(-4, 4), look: randomLook(myKit, nums.pop(), false) })));
    }
    const onums = [2, 3, 4, 5, 6, 8, 15, 16, 22, 23];
    for (const [x, z] of sc.opps) {
      this.opps.push(this.add(new Actor(this, { team: 1, x, z, skill: cfg.oppStr + rand(-4, 4), look: randomLook(oppKit, onums.pop(), false) })));
    }
    if (!cfg.noKeeper) {
      this.gk = this.add(new Actor(this, { team: 1, isGK: true, x: 0, z: GZ - 1, skill: cfg.oppStr + rand(-3, 3), look: randomLook(cfg.gkKit, 1, true) }));
      this.gk.diveSpeed = 4.6 + (this.gk.skill - 50) * 0.07;
      this.gk.reaction = 0.1 + (92 - this.gk.skill) * 0.006;
      this.gk.h.stance = 'keeper';
      this.opps.push(this.gk);
    }

    // Rakipler hemen müdahaleye girmesin
    for (const o of this.opps) o.tackleCD = rand(1.0, 1.8);

    // Top sahibi
    const b = this.ball;
    const owner = sc.owner === 'user' ? this.user : this.mates[sc.owner];
    b.owner = owner;
    b.lastTouch = owner;
    b.pos.copy(owner.pos).add(new V(0, BR, 0.45));

    // Göstergeler
    this.userRing = makeRing('#ffd43b');
    this.scene.add(this.userRing);
    this.passRing = makeRing('#4dabf7');
    this.passRing.scale.setScalar(0.8);
    this.scene.add(this.passRing);
    this.marker = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.32, 4), new THREE.MeshBasicMaterial({ color: '#ffd43b' }));
    this.marker.rotation.x = Math.PI;
    this.scene.add(this.marker);
    this.passTarget = null;
    this.passPickT = 0;

    // Kamera başlangıç
    this.camFocus = new V().copy(this.user.pos);
    this.camPos = new V();
    this.camLook = new V();
    this.cameraTargets(this.camPos, this.camLook);
    this.cam.position.copy(this.camPos);
    this.cam.lookAt(this.camLook);
    this.cam.fov = 58;
    this.cam.updateProjectionMatrix();

    hud.label(this.label);
    hud.timer(1);
    hud.power(null);
    setButtonMode(b.owner === this.user ? 'attack' : 'support');
    this.introT = 0.9; // başlamadan önce kısa bekleme
    window.__moment = this; // hata ayıklama/test için
  }

  add(a) { this.actors.push(a); return a; }

  dispose() {
    for (const a of this.actors) a.dispose();
    this.userRing.removeFromParent();
    this.passRing.removeFromParent();
    this.marker.removeFromParent();
  }

  // ---------- Ana döngü ----------
  update(rawDt) {
    if (this.slowT > 0) { this.slowT -= rawDt; if (this.slowT <= 0) this.timeScale = 1; }
    const dt = rawDt * this.timeScale;

    if (this.introT > 0) {
      this.introT -= rawDt;
      consumeEvents();
      for (const a of this.actors) { a.h.root.position.copy(a.pos); a.h.root.rotation.y = a.face; a.h.update(dt, 0); }
      this.updateBallOwned(dt);
      this.updateVisuals(dt);
      return;
    }

    this.time += dt;
    if (!this.ended) {
      this.handleUser(dt);
      this.aiMates(dt);
      this.aiOpps(dt);
      this.aiKeeper(dt);
    } else {
      this.aiCelebrate(dt);
      consumeEvents();
    }
    this.integrate(dt);
    this.updateBall(dt);
    if (!this.ended) this.checkEnd();
    else {
      this.endT -= rawDt;
      if (this.endT <= 0 && !this.done) {
        this.done = true;
        this.cfg.onEnd(this.result);
        return;
      }
    }
    this.updateVisuals(dt);
    if (!this.ended) hud.timer(1 - this.time / this.limit);
  }

  // ---------- Kullanıcı ----------
  handleUser(dt) {
    const u = this.user, b = this.ball;
    const hasBall = b.owner === u;
    const jx = input.joy.x, jy = input.joy.y;
    const jl = Math.min(1, Math.hypot(jx, jy));
    const dir = new V(-jx, 0, jy);

    const sprint = input.sprint && u.stamina > 0.03 && jl > 0.2;
    u.sprinting = sprint;
    const drain = 0.16 - (u.attrs.fizik - 50) * 0.0015;
    u.stamina = clamp(u.stamina + (sprint ? -drain : 0.07) * dt, 0, 1);
    hud.stamina(u.stamina);

    const tired = u.stamina < 0.15 ? 0.88 : 1;
    const sp = u.baseSpeed * (sprint ? 1.33 : 1) * (hasBall ? 0.92 : 1) * (u.burst > 0 ? 1.22 : 1) * tired;
    u.desired.copy(dir).multiplyScalar(sp);

    for (const e of consumeEvents()) {
      if (e.type === 'shoot') {
        if (b.owner === u) this.userShoot(e.power);
        else this.userTackle();
      } else if (e.type === 'pass') {
        if (b.owner === u) this.userPass(jl > 0.3 ? dir.clone().normalize() : u.forward());
        else this.callForBall();
      } else if (e.type === 'skill') {
        if (b.owner === u) this.userSkill(dir, jl);
      }
    }
    hud.power(input.shootHeld && b.owner === u ? shootPower() : null);

    const mode = b.owner === u ? 'attack' : 'support';
    if (mode !== this.btnMode) { setButtonMode(mode); this.btnMode = mode; }

    // Pas hedefi göstergesi
    this.passPickT -= dt;
    if (b.owner === u && this.mates.length) {
      if (this.passPickT <= 0) {
        this.passPickT = 0.12;
        this.passTarget = this.choosePassTarget(u, jl > 0.3 ? dir.clone().normalize() : u.forward());
      }
    } else this.passTarget = null;
  }

  userShoot(power) {
    const u = this.user;
    const jx = input.joy.x;
    const gk = this.gk;
    // Kaleye dön
    u.faceTo(new V(clamp(u.pos.x * 0.2, -2, 2), 0, GZ));
    u.faceLock = 0.35;
    this.kick(u, 'kick', power, () => {
      const b = this.ball.pos;
      const distG = Math.hypot(b.x, GZ - b.z);
      let ax;
      if (Math.abs(jx) > 0.25) ax = -jx * 3.3;
      else {
        const gx = gk ? gk.pos.x : 0;
        const side = gx > b.x * 0.15 ? -1 : 1;
        ax = side * 2.4;
      }
      // Fazla güç: top yükselir ve sapma artar
      let ay = 0.25 + power * 1.2 + (power > 0.85 ? (power - 0.85) * 14 : 0);
      const sut = u.attrs.sut;
      const sigma = (0.12 + (100 - sut) / 100 * 1.15) * clamp(distG / 18, 0.45, 2.4) * (0.55 + power * 0.75) * (u.sprinting ? 1.25 : 1);
      ax += gauss() * sigma;
      ay = Math.max(0.15, ay + gauss() * sigma * 0.35);
      const speed = 13 + power * 14 + (sut - 50) * 0.12;
      return ballistic(b, new V(ax, ay, GZ), speed);
    }, () => {
      this.ball.shot = { by: u, team: 0 };
      this.stats.shots++;
    });
  }

  userPass(dir) {
    const u = this.user;
    const t = this.choosePassTarget(u, dir);
    if (!t) return;
    this.passTo(u, t);
  }

  userSkill(dir, jl) {
    const u = this.user;
    if (u.skillCD > 0 || u.pendingKick) return;
    u.skillCD = 1.5;
    u.immune = 0.75;
    u.burst = 0.9;
    const side = jl > 0.3 ? (Math.sign(-dir.x * Math.cos(u.face) + dir.z * Math.sin(u.face)) || 1) : pick([-1, 1]);
    u.h.play('skill', { side });
    // Yana kısa ani hareket
    const right = new V(-Math.cos(u.face), 0, Math.sin(u.face));
    u.vel.addScaledVector(right, side * -2.5);
  }

  userTackle() {
    const u = this.user, b = this.ball;
    if (u.tackleCD > 0 || u.stun > 0) return;
    const c = b.owner;
    if (c && c.team === 1 && flat(u.pos, c.pos) < 2.6) this.attemptTackle(u, c);
    else if (!c && flat(u.pos, b.pos) < 3) {
      u.faceTo(b.pos);
      this.attemptTackle(u, null);
    } else {
      // Boşa kayma
      u.tackleCD = 1.2;
      u.h.play('tackle');
      u.slideT = 0.6; u.lock = 0.9;
    }
  }

  callForBall() {
    const u = this.user;
    if (u.calling > 0) return;
    u.calling = 1.2;
    u.h.play('call');
    hud.popup('Topu iste!', 'info');
  }

  // ---------- Vuruşlar ----------
  kick(a, type, power, computeVel, onRelease) {
    if (a.pendingKick || a.stun > 0) return false;
    const contact = a.h.play(type, { power });
    a.pendingKick = { t: contact, computeVel, onRelease, type, power };
    a.lock = contact + 0.15;
    return true;
  }

  releaseBall(a, vel, pk) {
    const b = this.ball;
    const f = a.forward();
    b.owner = null;
    b.pos.set(a.pos.x + f.x * 0.45, BR, a.pos.z + f.z * 0.45);
    b.vel.copy(vel);
    b.cool = 0.32; b.coolActor = a;
    b.flight++;
    b.rolled.clear();
    b.lastTouch = a;
    b.shot = null;
    b.target = null;
    b.isPass = false;
    if (pk.type === 'pass') sfx.pass(); else sfx.kick(pk.power ?? 0.7);
    if (pk.onRelease) pk.onRelease();
  }

  choosePassTarget(from, fwd) {
    let best = null, bs = -1e9;
    const team = from.team === 0 ? [this.user, ...this.mates] : this.opps.filter(o => !o.isGK);
    for (const m of team) {
      if (m === from || m.stun > 0) continue;
      const dx = m.pos.x - from.pos.x, dz = m.pos.z - from.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 2.5 || d > 45) continue;
      const ang = (fwd.x * dx + fwd.z * dz) / d;
      const block = this.laneBlocked(from.pos, m.pos, from.team);
      const s = ang * 2.4 - d / 35 - block * 0.6 + (m.pos.z - from.pos.z) / 70;
      if (s > bs) { bs = s; best = m; }
    }
    return best;
  }

  laneBlocked(a, b, team) {
    const others = team === 0 ? this.opps : [this.user, ...this.mates];
    const dx = b.x - a.x, dz = b.z - a.z;
    const L2 = dx * dx + dz * dz;
    let n = 0;
    for (const o of others) {
      if (o.isGK) continue;
      let t = ((o.pos.x - a.x) * dx + (o.pos.z - a.z) * dz) / L2;
      if (t < 0.08 || t > 0.95) continue;
      const px = a.x + dx * t, pz = a.z + dz * t;
      if (Math.hypot(o.pos.x - px, o.pos.z - pz) < 1.5) n++;
    }
    return n;
  }

  passTo(from, to) {
    const d = flat(from.pos, to.pos);
    const tLead = d / 15;
    const tp = to.pos.clone().addScaledVector(to.vel, tLead * 0.85);
    tp.x = clamp(tp.x, -FIELD.HW + 1, FIELD.HW - 1);
    tp.z = clamp(tp.z, -FIELD.HL + 1, GZ - 2);
    const blocked = this.laneBlocked(from.pos, tp, from.team) > 0;
    const lob = (blocked && d > 7) || d > 28;
    from.faceTo(tp);
    from.faceLock = 0.3;
    const pas = from.attrs.pas;
    this.kick(from, lob ? 'chip' : 'pass', 0.5, () => {
      const b = this.ball.pos;
      const dx = tp.x - b.x, dz = tp.z - b.z;
      const D = Math.hypot(dx, dz);
      const ang = Math.atan2(dx, dz) + gauss() * (100 - pas) / 100 * 0.12;
      if (lob) {
        const vh = clamp(D * 0.55 + 7, 10, 22);
        const t = (D * 0.95) / vh;
        return new V(Math.sin(ang) * vh, 0.5 * GRAV * t, Math.cos(ang) * vh);
      }
      const v0 = clamp(Math.sqrt(16 + 2 * FRICTION * D * 1.15), 7, 25);
      return new V(Math.sin(ang) * v0, 0, Math.cos(ang) * v0);
    }, () => {
      const b = this.ball;
      b.target = to; b.targetPt = tp; b.isPass = true;
      b.lastPasser = from; b.passTime = this.time;
      if (from.isUser) this.stats.passes++;
    });
  }

  shootAI(a) {
    const corner = pick([-1, 1]) * rand(1.6, 3.2);
    a.faceTo(new V(corner * 0.5, 0, GZ));
    a.faceLock = 0.35;
    const p = rand(0.5, 0.95);
    this.kick(a, 'kick', p, () => {
      const b = this.ball.pos;
      const distG = Math.hypot(b.x, GZ - b.z);
      const sig = (0.2 + (100 - a.skill) / 100 * 1.2) * clamp(distG / 18, 0.5, 2.2);
      const tx = corner + gauss() * sig, ty = Math.max(0.15, rand(0.2, 1.9) + gauss() * sig * 0.3);
      return ballistic(b, new V(tx, ty, GZ), 15 + p * 13 + (a.skill - 50) * 0.08);
    }, () => { this.ball.shot = { by: a, team: a.team }; });
  }

  // ---------- Müdahale ----------
  attemptTackle(def, carrier) {
    def.tackleCD = def.isUser ? 1.3 : rand(1.8, 2.6);
    const contact = def.h.play('tackle');
    def.slideT = 0.55; def.lock = 0.95;
    if (carrier) def.faceTo(carrier.pos.clone().addScaledVector(carrier.vel, 0.2));
    def.pendingTackle = { t: contact, carrier };
  }

  resolveTackle(def, carrier) {
    const b = this.ball;
    const reach = flat(def.pos, b.pos);
    if (!carrier) {
      // Serbest topa kayma
      if (!b.owner && reach < 1.8 && b.pos.y < 0.8) this.giveBall(def);
      return;
    }
    if (b.owner !== carrier || reach > 1.9) {
      def.stun = 0.7;
      if (carrier.isUser && b.owner === carrier) { this.stats.dribbles++; hud.popup('Geçti! 🌀', 'good'); }
      return;
    }
    const dr = carrier.attrs.dribling;
    const ds = def.isUser ? (def.attrs.fizik + def.attrs.hiz) / 2 : def.skill;
    let p = 0.5 + (ds - dr) * 0.013;
    if (carrier.immune > 0) p *= 0.3;
    if (carrier.vel.length() > 6.5) p -= 0.06;
    if (carrier.isUser && this.cfg.mode === 'training') p -= 0.08;
    // Odak kullanıcıda kalsın: yapay zeka takım arkadaşları topu daha zor kaybeder
    if (!carrier.isUser && carrier.team === 0) p *= 0.55;
    p = clamp(p, 0.08, 0.88);
    sfx.tackle();
    if (Math.random() < p) {
      carrier.stun = 0.55;
      carrier.h.play('stumble');
      if (def.isUser || Math.random() < 0.5) {
        this.giveBall(def);
      } else {
        b.owner = null;
        const f = def.forward();
        b.vel.set(f.x * 6 + rand(-2, 2), 1.5, f.z * 6 + rand(-2, 2));
        b.cool = 0.4; b.coolActor = carrier;
        b.flight++; b.rolled.clear(); b.lastTouch = def;
      }
      if (carrier.isUser) { this.stats.lost++; hud.popup('Top kaybı', 'bad'); }
      if (def.isUser) { this.stats.tackles++; hud.popup('Top kazanıldı! 💪', 'good'); }
    } else {
      def.stun = 0.9;
      def.h.play('fall');
      if (carrier.isUser) { this.stats.dribbles++; hud.popup('Geçti! 🌀', 'good'); }
    }
  }

  giveBall(a) {
    const b = this.ball;
    if (b.isPass && b.lastPasser && b.lastPasser.isUser && a.team === 0) this.stats.passesOk++;
    b.owner = a;
    b.vel.set(0, 0, 0);
    b.target = null; b.isPass = false; b.shot = null;
    b.lastTouch = a;
    a.ballTime = 0;
    if (a.team === 1) { if (this.possLostAt == null) this.possLostAt = this.time; }
    else this.possLostAt = null;
  }

  // ---------- Yapay zeka ----------
  aiMates(dt) {
    const b = this.ball, u = this.user;
    let chaser = null;
    if (!b.owner && !b.target) {
      let bd = 12;
      for (const m of this.mates) { const d = flat(m.pos, b.pos); if (d < bd && m.stun <= 0) { bd = d; chaser = m; } }
      if (chaser && flat(u.pos, b.pos) < bd * 0.8) chaser = null;
    }
    for (const m of this.mates) {
      if (m.stun > 0) continue;
      if (b.owner === m) { this.mateWithBall(m, dt); continue; }
      if (!b.owner && (b.target === m || chaser === m)) {
        const p = b.pos.clone().addScaledVector(b.vel, 0.3);
        m.moveTo(p, 1.15, 0.5);
        continue;
      }
      // Destek koşusu
      const bz = b.pos.z;
      const carrierIsUser = b.owner === u;
      const tz = clamp(bz + m.ahead + (carrierIsUser ? 3 : 0), -10, GZ - 9);
      const sway = Math.sin(this.time * 0.8 + m.lane) * 2.5;
      let tx = m.lane * (tz > 30 ? 0.6 : 1) + sway;
      // En yakın rakipten uzaklaş
      for (const o of this.opps) {
        const d = flat(o.pos, m.pos);
        if (d < 3 && !o.isGK) tx += (m.pos.x - o.pos.x) * 0.6;
      }
      m.moveTo(new V(tx, 0, tz), 0.95, 2);
    }
  }

  mateWithBall(m, dt) {
    const u = this.user;
    m.ballTime += dt;
    const toGoal = new V(-m.pos.x * 0.6, 0, GZ - m.pos.z).normalize();
    m.desired.copy(toGoal).multiplyScalar(m.baseSpeed * 0.85);
    if (m.pendingKick || m.ballTime < 0.35) return;
    let near = 99;
    for (const o of this.opps) if (!o.isGK) near = Math.min(near, flat(o.pos, m.pos));
    const dG = Math.hypot(m.pos.x, GZ - m.pos.z);
    const userOpen = this.laneBlocked(m.pos, u.pos, 0) === 0;
    const ud = flat(u.pos, m.pos);
    if (u.calling > 0 && ud > 3 && m.ballTime > 0.25) { this.passTo(m, u); return; }
    if (dG < 19 && m.ballTime > 0.6 && (near > 2.4 || Math.random() < dt * 1.2) && !(userOpen && u.pos.z > m.pos.z + 3 && Math.random() < 0.6)) {
      this.shootAI(m); return;
    }
    // Baskı altındaysa ya da yeterince taşıdıysa pas ver (öncelik kullanıcı)
    if ((near < 3.5 && m.ballTime > 0.45) || m.ballTime > 1.6 || (userOpen && ud > 6 && m.ballTime > 1.0)) {
      const target = (ud > 3 && ud < 40 && (userOpen || Math.random() < 0.6)) ? u : this.choosePassTarget(m, toGoal);
      if (target) this.passTo(m, target);
    }
  }

  aiOpps(dt) {
    const b = this.ball, c = b.owner;
    const field = this.opps.filter(o => !o.isGK);
    const goalC = new V(0, 0, GZ);
    const marked = new Set();
    let presser = null, cover = null;
    if (c && c.team === 0) {
      const s = [...field].filter(o => o.stun <= 0).sort((a, b2) => flat(a.pos, c.pos) - flat(b2.pos, c.pos));
      presser = s[0];
      if (s[1] && flat(s[1].pos, c.pos) < 9) cover = s[1];
    }
    let chaser = null;
    if (!c) {
      let bd = 16;
      for (const o of field) { const d = flat(o.pos, b.pos); if (d < bd && o.stun <= 0) { bd = d; chaser = o; } }
    }
    for (const o of field) {
      if (o.stun > 0) continue;
      if (c === o) {
        // Rakip topu kazandı: uzaklaştır
        o.ballTime += dt;
        o.desired.set(0, 0, -o.baseSpeed);
        if (o.ballTime > 0.5 && !o.pendingKick) {
          o.faceTo(new V(o.pos.x, 0, o.pos.z - 10));
          this.kick(o, 'kick', 0.9, () => new V(rand(-8, 8), rand(7, 11), -rand(20, 26)));
        }
        continue;
      }
      if (o === chaser) {
        o.moveTo(b.pos.clone().addScaledVector(b.vel, 0.35), 1.12, 0.3);
        continue;
      }
      if (o === presser) {
        const tgt = c.pos.clone().addScaledVector(c.vel, 0.25);
        const toG = goalC.clone().sub(c.pos).normalize();
        tgt.addScaledVector(toG, 0.9);
        o.moveTo(tgt, 1.12, 0.3);
        const d = flat(o.pos, c.pos);
        if (d < 1.7 && o.tackleCD <= 0 && !c.pendingKick && Math.random() < dt * 2.6) this.attemptTackle(o, c);
        continue;
      }
      if (o === cover) {
        const tgt = c.pos.clone().add(goalC.clone().sub(c.pos).normalize().multiplyScalar(4.5));
        o.moveTo(tgt, 1.0, 1);
        continue;
      }
      // Adam markajı
      let best = null, bd = 1e9;
      for (const a of [this.user, ...this.mates]) {
        if (a === c || marked.has(a)) continue;
        const d = flat(a.pos, o.pos);
        if (d < bd) { bd = d; best = a; }
      }
      if (best && bd < 14) {
        marked.add(best);
        const tgt = best.pos.clone().add(goalC.clone().sub(best.pos).normalize().multiplyScalar(1.8));
        tgt.lerp(b.pos, 0.08);
        // Pas araya girme
        if (b.isPass && b.target === best && !b.owner) tgt.copy(b.pos).addScaledVector(b.vel, 0.4);
        o.moveTo(tgt, 0.98, 1);
      } else {
        const tgt = o.home.clone();
        tgt.x += (b.pos.x - tgt.x) * 0.3;
        tgt.z = Math.min(GZ - 6, tgt.z + (b.pos.z - tgt.z) * 0.3);
        o.moveTo(tgt, 0.8, 2);
      }
    }
  }

  aiKeeper(dt) {
    const g = this.gk;
    if (!g) return;
    const b = this.ball;
    if (g.stun > 0) return;
    if (b.owner === g) { g.desired.set(0, 0, 0); return; }
    if (g.diveT > 0) {
      g.diveT -= dt;
      g.pos.x += g.diveVel * dt;
      g.desired.set(0, 0, 0);
      g.vel.set(0, 0, 0);
      return;
    }
    const loose = !b.owner;
    const incoming = loose && b.vel.z > 7 && b.pos.z < g.pos.z;
    if (incoming) {
      if (g.track !== b.flight) { g.track = b.flight; g.react = g.reaction; g.dove = false; }
      g.react -= dt;
      const t = (g.pos.z - b.pos.z) / b.vel.z;
      const px = b.pos.x + b.vel.x * t;
      if (Math.abs(px) < GHW + 1.5 && t < 1.6) {
        if (g.react <= 0) {
          const dx = px - g.pos.x;
          if (!g.dove && Math.abs(dx) > 0.85 && t < 0.9) {
            g.dove = true;
            const side = Math.sign(dx);
            g.h.play('dive', { side });
            g.diveVel = clamp(dx / Math.max(t, 0.2), -g.diveSpeed, g.diveSpeed);
            g.diveT = 0.5;
            g.stun = 0;
          } else if (!g.dove) {
            g.moveTo(new V(px, 0, g.pos.z), 0.9, 0.3);
          }
        } else g.desired.set(0, 0, 0);
        g.faceTo(new V(g.pos.x, 0, g.pos.z - 5));
        return;
      }
    }
    // Pozisyon alma
    const c = b.owner;
    const dToGoal = Math.hypot(b.pos.x, GZ - b.pos.z);
    if (c && c.team === 0 && dToGoal < 15 && Math.abs(b.pos.x) < 14 && b.pos.z > 33) {
      // Çıkış yap
      const tgt = c.pos.clone().add(new V(-c.pos.x, 0, GZ - c.pos.z).normalize().multiplyScalar(1.2));
      g.moveTo(tgt, 1.05, 0.3);
      if (flat(g.pos, c.pos) < 1.5 && g.tackleCD <= 0) {
        g.tackleCD = 1.4;
        const p = clamp(0.42 + (g.skill - c.attrs.dribling) * 0.012 - (c.immune > 0 ? 0.25 : 0), 0.1, 0.8);
        g.h.play('dive', { side: Math.sign(c.pos.x - g.pos.x) || 1, dur: 1.0 });
        if (Math.random() < p) {
          this.giveBall(g);
          if (c.isUser) { this.stats.lost++; hud.popup('Kaleci kaptı', 'bad'); }
        } else {
          g.stun = 1.0;
          if (c.isUser) hud.popup('Kaleciyi geçti! 🌀', 'good');
        }
      }
    } else if (loose && flat(g.pos, b.pos) < 7 && b.pos.z > GZ - 16 && b.vel.length() < 9 && Math.abs(b.pos.x) < 20) {
      g.moveTo(b.pos, 1.1, 0.2);
    } else {
      const k = clamp((GZ - b.pos.z) * 0.07, 0.4, 3);
      const tgt = new V(clamp(b.pos.x * 0.18, -2.4, 2.4), 0, GZ - 0.6 - k);
      g.moveTo(tgt, 0.8, 1);
    }
    g.faceTo(b.pos);
    // Yakındaki yavaş topu topla
    if (loose && flat(g.pos, b.pos) < 1.3 && b.pos.y < 2.2 && b.vel.length() < 14 && !(b.cool > 0 && b.coolActor === g)) {
      g.h.play('catch');
      this.giveBall(g);
      this.ball.saved = true;
    }
  }

  aiCelebrate(dt) {
    for (const a of this.actors) {
      a.desired.set(0, 0, 0);
      if (a.isGK && a.stun <= 0) continue;
    }
    if (this.result.outcome !== 'goal') return;
    const s = this.scorer;
    if (s && s.team === 0) {
      if (s.celebrate > 0) {
        s.celebrate -= dt;
        const dir = new V(Math.sign(s.pos.x || 1) * 0.6, 0, -1).normalize();
        s.desired.copy(dir).multiplyScalar(6.2);
        if (s.celebrate <= 0 && this.celebVariant !== 1) s.h.play('celebrate', { variant: this.celebVariant });
      } else if (this.celebVariant === 1 && s.h.action == null) {
        s.h.play('celebrate', { variant: 0 });
      }
      for (const m of [this.user, ...this.mates]) {
        if (m === s) continue;
        const d = flat(m.pos, s.pos);
        if (d > 1.6) m.moveTo(s.pos, 1.1, 1.5);
      }
    }
  }

  // ---------- Fizik / hareket ----------
  integrate(dt) {
    const b = this.ball;
    for (const a of this.actors) {
      a.tackleCD -= dt; a.immune -= dt; a.burst -= dt; a.skillCD -= dt; a.calling -= dt; a.faceLock -= dt;
      if (a.pendingKick) {
        a.pendingKick.t -= dt;
        if (a.pendingKick.t <= 0) {
          const pk = a.pendingKick;
          a.pendingKick = null;
          if (b.owner === a) this.releaseBall(a, pk.computeVel(), pk);
        }
      }
      if (a.pendingTackle) {
        a.pendingTackle.t -= dt;
        if (a.pendingTackle.t <= 0) {
          const pt = a.pendingTackle;
          a.pendingTackle = null;
          this.resolveTackle(a, pt.carrier);
        }
      }
      if (a.slideT > 0) {
        a.slideT -= dt;
        const f = a.forward();
        a.desired.copy(f).multiplyScalar(7.5 * clamp(a.slideT / 0.55, 0, 1));
      } else if (a.stun > 0) {
        a.stun -= dt;
        a.desired.set(0, 0, 0);
      } else if (a.lock > 0) {
        a.desired.multiplyScalar(0.25);
      }
      a.lock -= dt;
      const acc = (a.slideT > 0 ? 40 : a.isUser ? 26 : 20) * dt;
      const dvx = a.desired.x - a.vel.x, dvz = a.desired.z - a.vel.z;
      const dl = Math.hypot(dvx, dvz);
      if (dl > acc) { a.vel.x += dvx / dl * acc; a.vel.z += dvz / dl * acc; } else { a.vel.x += dvx; a.vel.z += dvz; }
      a.pos.addScaledVector(a.vel, dt);
      a.pos.x = clamp(a.pos.x, -FIELD.HW - 2, FIELD.HW + 2);
      a.pos.z = clamp(a.pos.z, -FIELD.HL - 2, GZ + (a.isGK ? 0.2 : -0.3));
      const sp = Math.hypot(a.vel.x, a.vel.z);
      if (a.faceLock <= 0 && a.slideT <= 0 && a.stun <= 0 && sp > 0.6) {
        const target = Math.atan2(a.vel.x, a.vel.z);
        let d = target - a.face;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        const rate = (a.isUser ? 13 : 9) * dt;
        a.face += clamp(d, -rate, rate);
      } else if (sp < 0.6 && !a.isGK && a.faceLock <= 0 && a.slideT <= 0 && a.stun <= 0 && b.owner !== a && !this.ended) {
        const target = Math.atan2(b.pos.x - a.pos.x, b.pos.z - a.pos.z);
        let d = Math.atan2(Math.sin(target - a.face), Math.cos(target - a.face));
        a.face += clamp(d, -4 * dt, 4 * dt);
      }
    }
    // Ayrışma (oyuncular üst üste binmesin)
    const A = this.actors;
    for (let i = 0; i < A.length; i++) for (let j = i + 1; j < A.length; j++) {
      const p = A[i].pos, q = A[j].pos;
      const dx = q.x - p.x, dz = q.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.7 && d > 1e-4) {
        const push = (0.7 - d) * 0.5;
        p.x -= dx / d * push; p.z -= dz / d * push;
        q.x += dx / d * push; q.z += dz / d * push;
      }
    }
    for (const a of A) {
      a.h.root.position.copy(a.pos);
      a.h.root.rotation.y = a.face;
      a.h.update(dt, Math.hypot(a.vel.x, a.vel.z));
    }
  }

  updateBallOwned(dt) {
    const b = this.ball, o = b.owner;
    if (!o) return;
    const f = o.forward();
    let tgt;
    if (o.isGK) {
      tgt = new V(o.pos.x + f.x * 0.35, 1.0, o.pos.z + f.z * 0.35);
    } else {
      const sp = Math.hypot(o.vel.x, o.vel.z);
      const off = 0.42 + (sp > 1 ? 0.25 * Math.abs(Math.sin(o.h.phase * 0.5)) * Math.min(1, sp / 6) : 0);
      tgt = new V(o.pos.x + f.x * off, BR, o.pos.z + f.z * off);
    }
    b.pos.lerp(tgt, Math.min(1, dt * 22));
    b.vel.set(o.vel.x, 0, o.vel.z);
  }

  updateBall(dt) {
    const b = this.ball;
    b.cool -= dt;
    if (b.owner) { this.updateBallOwned(dt); return; }
    const speed = b.vel.length();
    const steps = Math.min(12, Math.max(1, Math.ceil(speed * dt / 0.12)));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      const prevZ = b.pos.z;
      b.vel.y -= GRAV * h;
      b.pos.addScaledVector(b.vel, h);
      if (b.pos.y < BR) {
        b.pos.y = BR;
        if (b.vel.y < -1.2) { b.vel.y *= -0.5; b.vel.x *= 0.92; b.vel.z *= 0.92; } else b.vel.y = 0;
      }
      const hs = Math.hypot(b.vel.x, b.vel.z);
      if (b.pos.y <= BR + 0.01 && hs > 0) {
        const ns = Math.max(0, hs - (FRICTION + hs * 0.06) * h);
        b.vel.x *= ns / hs; b.vel.z *= ns / hs;
      } else {
        const k = 1 - 0.008 * hs * h;
        b.vel.x *= k; b.vel.z *= k;
      }
      this.collideGoal(prevZ);
      this.keeperSave();
      if (b.owner) break;
    }
    if (!b.owner) this.tryCapture();
  }

  collideGoal(prevZ) {
    const b = this.ball;
    // Direkler
    for (const sx of [-1, 1]) {
      const dx = b.pos.x - sx * GHW, dz = b.pos.z - GZ;
      const d = Math.hypot(dx, dz);
      if (d < BR + POST_R && b.pos.y < GH) {
        const nx = dx / d, nz = dz / d;
        const vn = b.vel.x * nx + b.vel.z * nz;
        if (vn < 0) {
          b.vel.x -= 1.7 * vn * nx; b.vel.z -= 1.7 * vn * nz;
          b.pos.x = sx * GHW + nx * (BR + POST_R + 0.01); b.pos.z = GZ + nz * (BR + POST_R + 0.01);
          sfx.post(); hud.popup('DİREK!', 'bad');
        }
      }
    }
    // Üst direk
    {
      const dy = b.pos.y - GH, dz = b.pos.z - GZ;
      const d = Math.hypot(dy, dz);
      if (Math.abs(b.pos.x) < GHW && d < BR + POST_R) {
        const ny = dy / d, nz = dz / d;
        const vn = b.vel.y * ny + b.vel.z * nz;
        if (vn < 0) {
          b.vel.y -= 1.7 * vn * ny; b.vel.z -= 1.7 * vn * nz;
          b.pos.y = GH + ny * (BR + POST_R + 0.01); b.pos.z = GZ + nz * (BR + POST_R + 0.01);
          sfx.post(); hud.popup('ÜST DİREK!', 'bad');
        }
      }
    }
    // Gol çizgisi
    if (!b.inNet && prevZ < GZ && b.pos.z >= GZ) {
      if (Math.abs(b.pos.x) < GHW - BR * 0.5 && b.pos.y < GH - BR * 0.5) {
        b.inNet = true;
        if (b.shot && b.shot.team === 0 && !b.shot.counted) { b.shot.counted = true; if (b.shot.by.isUser) this.stats.onTarget++; }
      }
    }
    if (b.inNet) {
      // Filenin içinde kal
      if (b.pos.z > GZ + GD - 0.2) { b.pos.z = GZ + GD - 0.2; b.vel.z = -Math.abs(b.vel.z) * 0.15; b.vel.x *= 0.5; }
      if (Math.abs(b.pos.x) > GHW - 0.15) { b.pos.x = Math.sign(b.pos.x) * (GHW - 0.15); b.vel.x *= -0.2; }
      if (b.pos.y > GH - 0.15) { b.pos.y = GH - 0.15; b.vel.y = -Math.abs(b.vel.y) * 0.2; }
      if (b.pos.z < GZ + 0.1) { b.pos.z = GZ + 0.1; b.vel.z = Math.abs(b.vel.z) * 0.2; }
    }
  }

  keeperSave() {
    const g = this.gk, b = this.ball;
    if (!g || b.owner || b.inNet || g.stun > 0) return;
    if (b.gkDone === b.flight) return;
    if (b.cool > 0 && b.coolActor === g) return;
    if (Math.abs(b.pos.z - g.pos.z) > 0.4 || b.vel.z < 2) return;
    const diving = g.h.action && g.h.action.name === 'dive';
    const lateral = Math.abs(b.pos.x - g.pos.x);
    const reach = diving ? 1.5 : 0.85;
    const hReach = diving ? 2.35 : 2.45;
    b.gkDone = b.flight;
    if (lateral > reach || b.pos.y > hReach) return;
    const speed = b.vel.length();
    const shotOn = Math.abs(b.pos.x) < GHW + 0.3 && b.pos.y < GH + 0.2;
    let p = 0.9 - Math.max(0, speed - 16) * 0.025 + (g.skill - 70) * 0.008 - (lateral / reach) * 0.35;
    if (this.cfg.mode === 'training') p -= 0.05;
    p = clamp(p, 0.15, 0.97);
    if (b.shot && b.shot.team === 0 && shotOn && !b.shot.counted) {
      b.shot.counted = true;
      if (b.shot.by.isUser) this.stats.onTarget++;
    }
    if (Math.random() < p) {
      if (speed < 21 && lateral < 0.7 && b.pos.y < 1.8) {
        if (!diving) g.h.play('catch');
        this.giveBall(g);
        b.saved = true;
      } else {
        // Çeldi
        const side = Math.sign(b.pos.x - g.pos.x) || 1;
        b.vel.set(side * rand(2, 7), rand(1.5, 4), -rand(3, 9));
        b.flight++; b.rolled.clear();
        b.cool = 0.4; b.coolActor = g; b.lastTouch = g;
        b.parried = true;
        b.parryTime = this.time;
        hud.popup('Kaleci çeldi!', 'bad');
      }
      sfx.groan();
    }
  }

  tryCapture() {
    const b = this.ball;
    if (b.inNet) return;
    const hs = Math.hypot(b.vel.x, b.vel.z);
    for (const a of this.actors) {
      if (a.isGK || a.stun > 0 || a.slideT > 0.2) continue;
      if (b.cool > 0 && b.coolActor === a) continue;
      if (b.pos.y > 1.2) continue;
      const d = flat(a.pos, b.pos);
      if (d > (a.isUser ? 0.95 : 0.85)) continue;
      let ok;
      if (a === b.target || (a.isUser && hs < 24)) ok = true;
      else if (b.rolled.has(a)) ok = false;
      else {
        b.rolled.add(a);
        const same = b.lastTouch && b.lastTouch.team === a.team;
        let p = same ? 0.9 : hs < 9 ? 0.8 : hs < 16 ? 0.5 : 0.22;
        if (b.pos.y > 0.6) p *= 0.5;
        ok = Math.random() < p;
        if (!ok && !same) { b.vel.multiplyScalar(0.75); b.vel.x += rand(-2.5, 2.5); }
      }
      if (ok) {
        // Kafa vuruşu: hava topu takım arkadaşına ise ve kaleye yakınsa
        if (b.pos.y > 0.9 && a.team === 0 && Math.hypot(a.pos.x, GZ - a.pos.z) < 14) {
          this.header(a);
          return;
        }
        this.giveBall(a);
        return;
      }
    }
  }

  header(a) {
    const b = this.ball;
    const passer = b.lastPasser;
    a.h.play('header');
    const tx = pick([-1, 1]) * rand(1, 3.2), ty = rand(0.3, 2.2);
    const sig = (0.25 + (100 - (a.isUser ? a.attrs.sut : a.skill)) / 100);
    const v = ballistic(b.pos, new V(tx + gauss() * sig, ty, GZ), 14 + rand(0, 5));
    b.vel.copy(v);
    b.flight++; b.rolled.clear(); b.cool = 0.3; b.coolActor = a; b.lastTouch = a;
    b.lastPasser = passer;
    b.shot = { by: a, team: 0 };
    if (a.isUser) this.stats.shots++;
    sfx.kick(0.4);
    hud.popup('Kafa!', 'info');
  }

  // ---------- Bitiş ----------
  checkEnd() {
    const b = this.ball;
    if (b.inNet) {
      const by = (b.shot && b.shot.by) || b.lastTouch;
      return this.finish('goal', by);
    }
    if (b.owner && b.owner === this.gk) return this.finish('saved');
    if (!b.owner) {
      const out = Math.abs(b.pos.x) > FIELD.HW + 0.3 || b.pos.z > GZ + 0.3 || b.pos.z < -FIELD.HL;
      if (out) return this.finish(b.shot || b.parried ? 'miss' : 'out');
    }
    if (!b.owner && b.parried && this.time - b.parryTime > 2.5) return this.finish('saved');
    if (b.owner && b.owner.team === 1 && this.possLostAt != null && this.time - this.possLostAt > 2.2) return this.finish('lost');
    if (!b.owner && b.lastTouch && b.lastTouch.team === 1 && b.pos.z < 0) return this.finish('lost');
    if (this.time > this.limit) return this.finish('timeout');
  }

  finish(outcome, scorer) {
    this.ended = true;
    hud.power(null);
    const res = { outcome, stats: this.stats, userGoal: false, teamGoal: false };
    this.result = res;
    this.scorer = scorer;
    if (outcome === 'goal' && scorer && scorer.team === 0) {
      res.teamGoal = true;
      if (scorer.isUser) { res.userGoal = true; this.stats.goals++; }
      else if (this.ball.lastPasser && this.ball.lastPasser.isUser && this.time - this.ball.passTime < 7) { this.stats.assists++; res.userAssist = true; }
      this.endT = 4.2;
      this.timeScale = 0.3; this.slowT = 0.9;
      this.celebVariant = Math.floor(Math.random() * 3);
      scorer.celebrate = 1.3;
      if (this.celebVariant === 1) scorer.h.play('celebrate', { variant: 1, dur: 3 });
      sfx.cheer(true);
      hud.banner(res.userGoal ? 'GOOOL!' : res.userAssist ? 'GOL! ASİST SENDEN!' : 'GOL!', 'goal', 3);
      for (const o of this.opps) if (!o.isGK) o.h.play('stumble', { dur: 0.8 });
    } else {
      this.endT = 1.7;
      const msg = {
        saved: ['Kaleci kurtardı', 'bad'], miss: ['Auta çıktı', 'bad'], out: ['Taç / aut', 'neutral'],
        lost: ['Rakip topu kaptı', 'bad'], timeout: ['Atak söndü', 'neutral'],
      }[outcome];
      if (outcome === 'miss' && this.ball.shot) msg[0] = 'Az farkla dışarı!';
      hud.banner(msg[0], msg[1], 1.6);
      if (outcome === 'saved' || outcome === 'miss') sfx.groan();
      sfx.whistle(false);
    }
  }

  // ---------- Kamera & görsel ----------
  cameraTargets(pos, look) {
    const u = this.user, b = this.ball;
    const f = this.camFocus;
    if (this.ended && this.result && this.result.outcome === 'goal' && this.scorer && this.scorer.team === 0) {
      const s = this.scorer.pos;
      f.lerp(s, 0.1);
      pos.set(f.x + 2.5, 3.2, f.z - 7.5);
      look.set(f.x, 1.1, f.z);
      return;
    }
    const tgt = new V().copy(u.pos).lerp(b.pos, b.owner === u ? 0.3 : 0.5);
    if (!b.owner && (b.shot || b.vel.length() > 12)) tgt.lerp(b.pos, 0.5);
    tgt.y = 0;
    tgt.z = Math.min(tgt.z, GZ - 8);
    f.lerp(tgt, 0.08);
    // Kale her zaman görüş alanında kalsın diye x'i merkeze doğru çek
    pos.set(f.x * 0.55, 14, f.z - 11.5);
    look.set(f.x * 0.6, 0, f.z + 10);
  }

  updateVisuals(dt) {
    const u = this.user, b = this.ball;
    this.world.setBall(b.pos, b.vel, dt);
    this.userRing.position.set(u.pos.x, 0.03, u.pos.z);
    const pulse = 1 + Math.sin(this.time * 6) * 0.05;
    this.userRing.scale.setScalar(pulse);
    this.marker.position.set(u.pos.x, 2.25 + Math.sin(this.time * 4) * 0.06, u.pos.z);
    this.marker.rotation.y += dt * 2;
    const pt = this.passTarget;
    this.passRing.visible = !!pt && !this.ended;
    if (pt) this.passRing.position.set(pt.pos.x, 0.03, pt.pos.z);

    const tp = new V(), tl = new V();
    this.cameraTargets(tp, tl);
    const k = Math.min(1, dt * (this.ended ? 2.5 : 4));
    this.camPos.lerp(tp, k);
    this.camLook.lerp(tl, k);
    this.cam.position.copy(this.camPos);
    this.cam.lookAt(this.camLook);
  }
}

function overallOf(a) {
  return (a.hiz + a.sut + a.pas + a.dribling + a.fizik) / 5;
}

export function kitFor(team, alt = false) {
  if (!alt) return { shirt: team.c1, shorts: team.c2, socks: team.c1, numberColor: team.c2 };
  return { shirt: team.c2, shorts: team.c1, socks: team.c2, numberColor: team.c1 };
}

function colorDist(a, b) {
  const p = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
  const A = p(a), B = p(b);
  return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]);
}

export function matchKits(my, opp) {
  const myKit = kitFor(my);
  let oppKit = kitFor(opp);
  if (colorDist(myKit.shirt, oppKit.shirt) < 120) oppKit = kitFor(opp, true);
  if (colorDist(myKit.shirt, oppKit.shirt) < 120) oppKit = { shirt: '#f0f0f0', shorts: '#222222', socks: '#f0f0f0', numberColor: '#222222' };
  if (colorDist(myKit.shirt, oppKit.shirt) < 120) oppKit = { shirt: '#222222', shorts: '#222222', socks: '#222222', numberColor: '#ffffff' };
  const gkKit = { shirt: colorDist(oppKit.shirt, '#2bd46a') > 150 && colorDist(myKit.shirt, '#2bd46a') > 150 ? '#2bd46a' : '#ff8c1a', shorts: '#1a1a1a', socks: '#1a1a1a', numberColor: '#111111' };
  return { myKit, oppKit, gkKit };
}
