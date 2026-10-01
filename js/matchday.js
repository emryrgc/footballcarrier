// Maç günü: dakika akışı simülasyonu + araya giren oynanabilir pozisyonlar.
// Ayrıca antrenman seansları.
import { TEAMS } from './data.js';
import { currentFixture, expectedGoals } from './career.js';
import { Moment, matchKits } from './moment.js';
import { hud } from './hud.js';
import { sfx } from './audio.js';
import { resetInput } from './input.js';

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function poisson(l) { const L = Math.exp(-l); let k = 0, p = 1; do { k++; p *= Math.random(); } while (p > L); return k - 1; }

const TYPE_WEIGHTS = {
  ST: { kontra: 2, kurulum: 3, birebir: 3, kanat: 1, kenar: 3 },
  KOO: { kontra: 3, kurulum: 3, birebir: 1, kanat: 1, kenar: 3 },
  KNT: { kontra: 3, kurulum: 2, birebir: 2, kanat: 4, kenar: 1 },
};
const TYPE_TEXT = {
  kontra: 'Kontra atak fırsatı!', kurulum: 'Takımın hücum kuruyor', birebir: 'Savunma arkasına koşu!',
  kanat: 'Kanatta topla buluştun', kenar: 'Ceza sahası önünde fırsat',
};

function weighted(w) {
  const tot = Object.values(w).reduce((a, b) => a + b, 0);
  let r = Math.random() * tot;
  for (const k in w) { r -= w[k]; if (r <= 0) return k; }
  return Object.keys(w)[0];
}

export function computeRating(s, resultSign, moments) {
  let r = 6.0 + s.goals * 1.1 + s.assists * 0.75 + s.onTarget * 0.15 - (s.shots - s.onTarget) * 0.06
    + s.dribbles * 0.15 + s.passesOk * 0.08 - (s.passes - s.passesOk) * 0.12 - s.lost * 0.22 + s.tackles * 0.2
    + resultSign * 0.3 - moments.timeouts * 0.12 + rand(-0.15, 0.15);
  return Math.round(clamp(r, 3.5, 10) * 10) / 10;
}

export class MatchDay {
  constructor(world, st, onFinish) {
    this.world = world;
    this.st = st;
    this.onFinish = onFinish;
    const fx = currentFixture(st);
    this.fx = fx;
    this.my = TEAMS[st.clubId];
    this.opp = TEAMS[fx.opponent];
    this.kits = matchKits(this.my, this.opp);
    this.minute = 0;
    this.myGoals = 0; this.oppGoals = 0;
    this.stats = { shots: 0, onTarget: 0, goals: 0, assists: 0, passes: 0, passesOk: 0, dribbles: 0, lost: 0, tackles: 0 };
    this.momentInfo = { played: 0, timeouts: 0 };

    // Olay listesi
    const ev = [];
    const myL = expectedGoals(this.my.str, this.opp.str, fx.isHome) * 0.55;
    const opL = expectedGoals(this.opp.str, this.my.str, !fx.isHome) * 0.95;
    for (let i = poisson(myL); i > 0; i--) ev.push({ min: Math.floor(rand(2, 90)), type: 'myGoal' });
    for (let i = poisson(opL); i > 0; i--) ev.push({ min: Math.floor(rand(2, 90)), type: 'oppGoal' });
    const p = st.player;
    let n = 3 + (p.trust > 60 ? 1 : 0) + (Math.random() < 0.5 ? 1 : 0) - (p.trust < 25 ? 1 : 0);
    const slots = [];
    for (let i = 0; i < n; i++) slots.push(Math.floor(5 + (85 / n) * i + rand(0, 85 / n - 4)));
    for (const m of slots) ev.push({ min: m, type: 'moment', kind: weighted(TYPE_WEIGHTS[p.pos]) });
    ev.push({ min: 45, type: 'half' });
    ev.sort((a, b) => a.min - b.min || (a.type === 'half' ? -1 : 1));
    this.events = ev;
    this.evIdx = 0;
    this.tickAcc = 0;
    this.pause = 1.8;
    this.state = 'ticker';
    this.feed = [];
  }

  leftRight() {
    const h = this.fx.isHome;
    const myS = { name: this.my.short, goals: this.myGoals };
    const opS = { name: this.opp.short, goals: this.oppGoals };
    return h ? [myS, opS] : [opS, myS];
  }

  start() {
    this.world.setMode(this);
    hud.show(true);
    hud.showControls(false);
    document.getElementById('ticker').classList.remove('hidden');
    document.getElementById('momentHud').classList.add('hidden');
    this.updateScore();
    this.log(`${this.fx.isHome ? this.my.name : this.opp.name} – ${this.fx.isHome ? this.opp.name : this.my.name}`, 'head');
    this.log('Hakem başlama düdüğünü çaldı!', '');
    sfx.whistle(true);
    sfx.crowdOn();
    this.camT = 0;
  }

  updateScore() {
    const [l, r] = this.leftRight();
    hud.score(l, r, this.state === 'ticker' || this.state === 'moment' ? this.minute : null);
  }

  log(text, cls) {
    const el = document.getElementById('feed');
    const d = document.createElement('div');
    d.className = 'feed-item ' + (cls || '');
    d.innerHTML = (cls === 'head' ? '' : `<span class="fm">${this.minute}'</span>`) + text;
    el.prepend(d);
    while (el.children.length > 7) el.lastChild.remove();
  }

  update(dt) {
    if (this.state === 'moment') { this.moment.update(dt); return; }
    // Yayın kamerası: sahanın üstünde yavaş gezinti
    this.camT += dt;
    const cam = this.world.camera;
    const z = Math.sin(this.camT * 0.15) * 30;
    cam.position.set(Math.sin(this.camT * 0.1) * 8, 34, z - 32);
    cam.lookAt(0, 0, z + 8);
    this.world.setBall({ x: 0, y: 0.11, z: 0 });
    if (this.state !== 'ticker') return;
    if (this.pause > 0) { this.pause -= dt; return; }
    this.tickAcc += dt;
    while (this.tickAcc > 0.09 && this.state === 'ticker') {
      this.tickAcc -= 0.09;
      this.minute++;
      this.updateScore();
      while (this.evIdx < this.events.length && this.events[this.evIdx].min <= this.minute) {
        const e = this.events[this.evIdx++];
        this.handleEvent(e);
        if (this.state !== 'ticker' || this.pause > 0) return;
      }
      if (this.minute >= 90 + Math.floor(rand(1, 4))) { this.fullTime(); return; }
    }
  }

  handleEvent(e) {
    if (e.type === 'myGoal') {
      this.myGoals++;
      this.log(`⚽ GOL! ${this.my.name} golü buldu.`, 'good');
      sfx.cheer(false);
      this.pause = 1.0;
    } else if (e.type === 'oppGoal') {
      this.oppGoals++;
      this.log(`⚽ ${this.opp.name} golü attı.`, 'bad');
      sfx.groan();
      this.pause = 1.0;
    } else if (e.type === 'half') {
      this.log('İlk yarı sona erdi.', '');
      sfx.whistle(false);
      this.pause = 1.4;
    } else if (e.type === 'moment') {
      this.log(`⭐ ${TYPE_TEXT[e.kind]}`, 'star');
      this.pause = 0;
      this.state = 'pre';
      hud.banner(TYPE_TEXT[e.kind], 'info', 1.4);
      setTimeout(() => this.startMoment(e.kind), 1300);
    }
    this.updateScore();
  }

  startMoment(kind) {
    const p = this.st.player;
    document.getElementById('ticker').classList.add('hidden');
    document.getElementById('momentHud').classList.remove('hidden');
    hud.showControls(true);
    resetInput();
    this.moment = new Moment(this.world, {
      type: kind, mode: 'match',
      user: { attrs: p.attrs, skin: p.skin, hair: p.hair, number: p.number },
      energy: p.energy,
      myStr: this.my.str, oppStr: this.opp.str,
      ...this.kits,
      onEnd: r => this.endMoment(r),
    });
    this.state = 'moment';
  }

  endMoment(r) {
    for (const k in this.stats) this.stats[k] += r.stats[k];
    this.momentInfo.played++;
    if (r.outcome === 'timeout') this.momentInfo.timeouts++;
    if (r.teamGoal) {
      this.myGoals++;
      this.log(r.userGoal ? `⚽ GOOOL! ${this.st.player.name} ağları sarstı!` : r.userAssist ? `⚽ GOL! Asist ${this.st.player.name}'den!` : `⚽ GOL! ${this.my.name} atağı golle bitirdi.`, 'good');
    } else {
      const t = { saved: 'Kaleci pozisyonu kurtardı.', miss: 'Şut az farkla dışarıda.', out: 'Atak sonuçsuz kaldı.', lost: 'Rakip topu kaptı.', timeout: 'Atak söndü.' }[r.outcome];
      this.log(t, '');
    }
    this.moment.dispose();
    this.moment = null;
    hud.showControls(false);
    document.getElementById('momentHud').classList.add('hidden');
    document.getElementById('ticker').classList.remove('hidden');
    this.state = 'ticker';
    this.pause = 0.8;
    this.updateScore();
  }

  fullTime() {
    this.state = 'done';
    sfx.whistle(true);
    this.log('Maç sona erdi!', 'head');
    const sign = Math.sign(this.myGoals - this.oppGoals);
    const rating = computeRating(this.stats, sign, this.momentInfo);
    setTimeout(() => {
      sfx.crowdOff();
      hud.show(false);
      document.getElementById('ticker').classList.add('hidden');
      this.world.setMode(null);
      const h = this.fx.isHome;
      this.onFinish({
        homeGoals: h ? this.myGoals : this.oppGoals,
        awayGoals: h ? this.oppGoals : this.myGoals,
        stats: this.stats,
        rating,
      });
    }, 1600);
  }
}

export const DRILLS = {
  sut: { key: 't_sut', attr: 'sut', name: 'Şut Antrenmanı', desc: 'Kaleciye karşı 5 şut. Köşeleri bul!', attempts: 5 },
  calim: { key: 't_calim', attr: 'dribling', name: 'Çalım Antrenmanı', desc: 'İki savunmacıyı geç ve gol at. 3 deneme.', attempts: 3 },
  pas: { key: 't_pas', attr: 'pas', name: 'Pas & Bitiricilik', desc: 'Takım arkadaşlarınla paslaş, golü bul. 3 deneme.', attempts: 3 },
};

export class TrainingSession {
  constructor(world, st, drillId, onFinish) {
    this.world = world;
    this.st = st;
    this.drill = DRILLS[drillId];
    this.onFinish = onFinish;
    this.n = 0;
    this.score = 0;
    const club = TEAMS[st.clubId];
    this.kits = {
      myKit: { shirt: club.c1, shorts: club.c2, socks: club.c1, numberColor: club.c2 },
      oppKit: { shirt: '#ff7a1a', shorts: '#222222', socks: '#ff7a1a', numberColor: '#111111' },
      gkKit: { shirt: '#2bd46a', shorts: '#1a1a1a', socks: '#1a1a1a', numberColor: '#111111' },
    };
    this.str = club.str;
  }

  start() {
    this.world.setMode(this);
    hud.show(true);
    document.getElementById('ticker').classList.add('hidden');
    document.getElementById('momentHud').classList.remove('hidden');
    this.next();
  }

  updateScore() {
    hud.score({ name: 'GOL', goals: this.score }, { name: `/ ${this.drill.attempts}`, goals: this.n }, null);
  }

  next() {
    this.updateScore();
    if (this.n >= this.drill.attempts) {
      this.world.setMode(null);
      hud.show(false);
      this.onFinish(this.score, this.drill.attempts);
      return;
    }
    const p = this.st.player;
    resetInput();
    hud.showControls(true);
    this.moment = new Moment(this.world, {
      type: this.drill.key, mode: 'training', timeLimit: 14,
      user: { attrs: p.attrs, skin: p.skin, hair: p.hair, number: p.number },
      energy: 100,
      myStr: this.str, oppStr: this.str - 4,
      ...this.kits,
      onEnd: r => {
        this.n++;
        if (r.teamGoal) this.score++;
        this.moment.dispose();
        this.moment = null;
        this.next();
      },
    });
  }

  update(dt) { if (this.moment) this.moment.update(dt); }
}
