// Uygulama girişi: ekranlar (menü, oyuncu oluşturma, kariyer merkezi...) ve akış.
import * as THREE from 'three';
import { Game3D } from './game3d.js';
import { Humanoid } from './humanoid.js';
import { setupInput } from './input.js';
import { initAudio, sfx } from './audio.js';
import { LEAGUES, TEAMS, POSITIONS, ATTRS, SKIN_TONES, HAIR_COLORS } from './data.js';
import * as C from './career.js';
import { MatchDay, TrainingSession, DRILLS } from './matchday.js';

const $ = id => document.getElementById(id);
const screen = $('screen');
const world = new Game3D($('c'));
setupInput();

let st = C.load();

// ---------------- 3D vitrin (oyuncu önizleme) ----------------
class Showroom {
  constructor(look, opts = {}) {
    this.h = new Humanoid(look);
    this.h.root.position.set(0, 0, 0);
    this.h.root.rotation.y = Math.PI;
    world.scene.add(this.h.root);
    this.t = 0;
    this.nextAnim = 2.5;
    this.yOffset = opts.yOffset ?? 0.9;
    this.dist = opts.dist ?? 4.2;
    this.spin = 0;
    this.drag = null;
    world.setBall({ x: 0.35, y: 0.11, z: -0.55 });
  }
  update(dt) {
    this.t += dt;
    this.nextAnim -= dt;
    if (this.nextAnim <= 0) {
      this.nextAnim = 4 + Math.random() * 3;
      const r = Math.random();
      if (r < 0.3) this.h.play('skill', { side: Math.random() < 0.5 ? 1 : -1 });
      else if (r < 0.55) this.h.play('celebrate', { variant: Math.random() < 0.5 ? 0 : 1, dur: 2.2 });
      else if (r < 0.75) this.h.play('kick', { power: 0.6 });
      else this.h.play('call');
    }
    this.h.update(dt, 0);
    if (!this.drag) this.spin += dt * 0.25;
    const a = Math.PI + Math.sin(this.spin) * 0.6;
    this.h.root.rotation.y = a;
    const cam = world.camera;
    cam.fov = 40; cam.updateProjectionMatrix();
    cam.position.set(0, 1.35, -this.dist);
    cam.lookAt(0, this.yOffset, 0);
  }
  dispose() { this.h.dispose(); }
}

let showroom = null;
function setShowroom(look, opts) {
  if (showroom) showroom.dispose();
  showroom = look ? new Showroom(look, opts) : null;
  world.setMode(showroom);
}

function playerLook(p, club) {
  const t = TEAMS[club];
  return { skin: p.skin, hair: p.hair, shirt: t.c1, shorts: t.c2, socks: t.c1, number: p.number, numberColor: t.c2 };
}

// ---------------- Yardımcılar ----------------
function html(s) { screen.innerHTML = s; screen.scrollTop = 0; }
function bar(v, cls = '') { return `<div class="bar ${cls}"><i style="width:${Math.round(v)}%"></i></div>`; }
function badge(t) { return `<span class="badge" style="background:${t.c1};color:${t.c2};border-color:${t.c2}">${t.short}</span>`; }
function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function on(id, fn) { const el = $(id); if (el) el.addEventListener('click', e => { initAudio(); sfx.click(); fn(e); }); }
function ovrColor(o) { return o >= 80 ? '#ffd43b' : o >= 70 ? '#69db7c' : o >= 60 ? '#74c0fc' : '#ced4da'; }

// ---------------- Ana menü ----------------
function showMenu() {
  setShowroom(null);
  screen.className = 'page menu';
  html(`
    <div class="logo">
      <div class="logo-ball">⚽</div>
      <h1>FUTBOLCU<br><span>KARİYERİ</span></h1>
      <p class="sub">17 yaşında bir gençsin. Efsane olmaya hazır mısın?</p>
    </div>
    <div class="menu-btns">
      ${st ? `<button class="btn primary" id="bCont">▶ Devam Et<small>${esc(st.player.name)} · ${TEAMS[st.clubId].name} · Sezon ${st.season}</small></button>` : ''}
      <button class="btn ${st ? '' : 'primary'}" id="bNew">＋ Yeni Kariyer</button>
      <button class="btn ghost" id="bHow">❔ Nasıl Oynanır</button>
    </div>
    <p class="ver">Prototip v0.1</p>
  `);
  on('bCont', showHub);
  on('bNew', () => {
    if (st && !confirm('Mevcut kariyerin silinecek. Emin misin?')) return;
    showCreate();
  });
  on('bHow', showHow);
}

function showHow() {
  screen.className = 'page';
  html(`
    <div class="topbar"><button class="back" id="bBack">‹</button><h2>Nasıl Oynanır</h2></div>
    <div class="card">
      <h3>Kariyer</h3>
      <p>Her hafta bir maç oynarsın. Hafta içinde bir kez <b>antrenman</b> yapabilir ya da <b>dinlenebilirsin</b>. Maçlarda ve antrenmanda kazandığın <b>gelişim puanlarıyla</b> özelliklerini yükselt. İyi performans; transfer teklifleri, kupalar ve ödüller getirir.</p>
    </div>
    <div class="card">
      <h3>Maç</h3>
      <p>Maç dakika dakika akar. Senin oyuncunun dahil olduğu kritik anlarda oyun 3D'ye geçer ve <b>kontrol sende</b>. Gol, asist, çalım ve başarılı paslar reytingini yükseltir.</p>
    </div>
    <div class="card">
      <h3>Kontroller (dokunmatik)</h3>
      <ul>
        <li><b>Sol taraf:</b> Ekrana dokunup sürükle → joystick</li>
        <li><b>ŞUT:</b> Basılı tut = güç, bırak = vur. Joystick sağ/sol ile köşe seç. Fazla güç topu auta yollar!</li>
        <li><b>PAS:</b> Mavi halkalı arkadaşa pas. Joystick yönü hedefi seçer. Önü kapalıysa otomatik havadan atar.</li>
        <li><b>ÇALIM:</b> Makas hareketi — kısa süre müdahalelerden korur ve hızlandırır.</li>
        <li><b>KOŞ:</b> Basılı tut = depar (kondisyon harcar).</li>
        <li>Topsuzken: <b>TOP İSTE</b> ile pas iste, <b>MÜDAHALE</b> ile topu geri kap.</li>
      </ul>
      <h3>Klavye</h3>
      <p>WASD/Yön tuşları · Space: şut · J/E: pas · K/Q: çalım · Shift: depar</p>
    </div>
  `);
  on('bBack', showMenu);
}

// ---------------- Oyuncu oluşturma ----------------
function showCreate() {
  const draft = { name: '', pos: 'ST', skin: SKIN_TONES[1], hair: HAIR_COLORS[0], number: 9 };
  screen.className = 'page create';
  const preview = () => setShowroom({ skin: draft.skin, hair: draft.hair, shirt: '#e9ecef', shorts: '#1c2a44', socks: '#e9ecef', number: draft.number, numberColor: '#1c2a44' }, { yOffset: -0.3, dist: 6.8 });
  preview();
  const render = () => {
    html(`
      <div class="topbar"><button class="back" id="bBack">‹</button><h2>Oyuncunu Yarat</h2></div>
      <div class="spacer-3d"></div>
      <div class="card">
        <label>İsim</label>
        <input id="iName" maxlength="18" placeholder="Örn: Emre Yıldız" value="${esc(draft.name)}">
        <label>Mevki</label>
        <div class="pos-grid">
          ${Object.entries(POSITIONS).map(([k, v]) => `<button class="pos ${draft.pos === k ? 'sel' : ''}" data-pos="${k}"><b>${k}</b><span>${v.name}</span><small>${v.desc}</small></button>`).join('')}
        </div>
        <label>Ten rengi</label>
        <div class="swatches">${SKIN_TONES.map(c => `<button class="sw ${draft.skin === c ? 'sel' : ''}" data-skin="${c}" style="background:${c}"></button>`).join('')}</div>
        <label>Saç rengi</label>
        <div class="swatches">${HAIR_COLORS.map(c => `<button class="sw ${draft.hair === c ? 'sel' : ''}" data-hair="${c}" style="background:${c}"></button>`).join('')}</div>
        <label>Forma numarası</label>
        <div class="swatches nums">${[7, 9, 10, 11, 17, 19, 21, 99].map(n => `<button class="num ${draft.number === n ? 'sel' : ''}" data-num="${n}">${n}</button>`).join('')}</div>
      </div>
      <button class="btn primary big" id="bStart">Kariyere Başla ⚽</button>
    `);
    $('iName').addEventListener('input', e => { draft.name = e.target.value; });
    screen.querySelectorAll('[data-pos]').forEach(b => b.onclick = () => { draft.pos = b.dataset.pos; draft.number = { ST: 9, KOO: 10, KNT: 11 }[draft.pos]; preview(); render(); });
    screen.querySelectorAll('[data-skin]').forEach(b => b.onclick = () => { draft.skin = b.dataset.skin; preview(); render(); });
    screen.querySelectorAll('[data-hair]').forEach(b => b.onclick = () => { draft.hair = b.dataset.hair; preview(); render(); });
    screen.querySelectorAll('[data-num]').forEach(b => b.onclick = () => { draft.number = +b.dataset.num; preview(); render(); });
    on('bBack', showMenu);
    on('bStart', () => {
      const name = draft.name.trim() || 'Genç Yıldız';
      st = C.newCareer({ ...draft, name });
      C.save(st);
      showHub();
    });
  };
  render();
}

// ---------------- Kariyer merkezi ----------------
function showHub() {
  if (!st) return showMenu();
  if (C.isSeasonOver(st)) return showSeasonEnd();
  const p = st.player;
  const club = TEAMS[st.clubId];
  const lg = LEAGUES[st.leagueId];
  const fx = C.currentFixture(st);
  const opp = TEAMS[fx.opponent];
  const ovr = C.overall(p);
  const S = st.seasonStats;
  const avg = S.apps ? (S.ratingSum / S.apps).toFixed(2) : '-';
  const pos = C.leaguePosition(st);
  setShowroom(playerLook(p, st.clubId), { yOffset: -0.3, dist: 8.4 });
  screen.className = 'page hub';
  const form = st.results.slice(-5).map(r => `<span class="f ${r.res}">${r.res}</span>`).join('');
  html(`
    <div class="pcard">
      <div class="ovr" style="color:${ovrColor(ovr)}">${ovr}<small>${p.pos}</small></div>
      <div class="pinfo">
        <div class="pname">${esc(p.name)}</div>
        <div class="pmeta">${badge(club)} ${club.name} · ${p.age} yaş</div>
        <div class="pmeta">${lg.name} · ${pos}. sıra · ${C.formatMoney(C.marketValue(p))}</div>
      </div>
    </div>
    <div class="spacer-3d small"></div>
    <div class="card stats3">
      <div><label>Enerji</label>${bar(p.energy, p.energy < 30 ? 'red' : 'green')}</div>
      <div><label>Moral</label>${bar(p.morale, 'blue')}</div>
      <div><label>Hoca Güveni</label>${bar(p.trust, 'gold')}</div>
    </div>
    <div class="card next">
      <div class="nhead">Sezon ${st.season} · Hafta ${st.week + 1}/${st.fixtures.length}</div>
      <div class="vs">
        <div class="team">${badge(fx.isHome ? club : opp)}<span>${(fx.isHome ? club : opp).name}</span></div>
        <div class="vsx">VS</div>
        <div class="team">${badge(fx.isHome ? opp : club)}<span>${(fx.isHome ? opp : club).name}</span></div>
      </div>
      <div class="nsub">${fx.isHome ? 'İç saha' : 'Deplasman'} · Rakip gücü ${opp.str} · Form ${form || '—'}</div>
      ${p.energy < 30 ? '<div class="warn">⚠ Çok yorgunsun! Kondisyonun düşük olacak. Dinlenmeyi düşün.</div>' : ''}
      <button class="btn primary big" id="bPlay">⚽ Maça Çık</button>
    </div>
    <div class="grid2">
      <button class="btn tile" id="bTrain" ${st.trainedThisWeek ? 'disabled' : ''}>🏋️<span>Antrenman</span><small>${st.trainedThisWeek ? 'Bu hafta yapıldı' : '+puan, −enerji'}</small></button>
      <button class="btn tile" id="bRest" ${st.trainedThisWeek ? 'disabled' : ''}>😴<span>Dinlen</span><small>+35 enerji</small></button>
      <button class="btn tile ${p.points > 0 ? 'glow' : ''}" id="bDev">📈<span>Gelişim</span><small>${p.points} puan</small></button>
      <button class="btn tile" id="bTable">📊<span>Lig Tablosu</span><small>${pos}. sıradasın</small></button>
      <button class="btn tile" id="bCareer">🏆<span>Kariyer</span><small>${st.careerStats.goals} gol · ${st.trophies.length} kupa</small></button>
      <button class="btn tile" id="bNews">📰<span>Haberler</span><small>${st.news.length ? 'Yeni' : '—'}</small></button>
    </div>
    <div class="card season-line">Bu sezon: <b>${S.apps}</b> maç · <b>${S.goals}</b> gol · <b>${S.assists}</b> asist · Ort. <b>${avg}</b></div>
    <button class="btn ghost small" id="bMenu">Ana Menü</button>
  `);
  on('bPlay', startMatch);
  on('bTrain', showTrainingSelect);
  on('bRest', () => { C.rest(st); C.save(st); toast('Dinlendin. Enerji +35'); showHub(); });
  on('bDev', showDev);
  on('bTable', showTable);
  on('bCareer', showCareer);
  on('bNews', showNews);
  on('bMenu', showMenu);
}

function toast(t) {
  const el = $('toast');
  el.textContent = t;
  el.classList.add('show');
  clearTimeout(toast.tm);
  toast.tm = setTimeout(() => el.classList.remove('show'), 2200);
}

// ---------------- Gelişim ----------------
function showDev() {
  const p = st.player;
  setShowroom(playerLook(p, st.clubId), { yOffset: -0.9, dist: 8.7 });
  screen.className = 'page';
  const stars = Math.round((p.potential - 75) / 4);
  html(`
    <div class="topbar"><button class="back" id="bBack">‹</button><h2>Gelişim</h2></div>
    <div class="spacer-3d small"></div>
    <div class="card">
      <div class="dev-head"><div class="ovr" style="color:${ovrColor(C.overall(p))}">${C.overall(p)}<small>GENEL</small></div>
      <div><div class="pts">${p.points} <small>gelişim puanı</small></div><div class="pot">Potansiyel: ${'★'.repeat(Math.max(1, stars))}${'☆'.repeat(Math.max(0, 5 - stars))}</div></div></div>
      ${ATTRS.map(a => {
        const v = p.attrs[a.key];
        const cost = C.upgradeCost(v);
        const can = p.points >= cost && v < p.potential && v < 99;
        const w = POSITIONS[p.pos].w[a.key];
        return `<div class="attr">
          <span class="an">${a.icon} ${a.name}${w >= 0.3 ? ' <em>★</em>' : ''}</span>
          <span class="av">${v}</span>
          ${bar(v, v >= 80 ? 'gold' : v >= 65 ? 'green' : 'blue')}
          <button class="plus" data-up="${a.key}" ${can ? '' : 'disabled'}>+<small>${cost}</small></button>
        </div>`;
      }).join('')}
      <p class="hint">★ = mevkin için en önemli özellik. Yükseltme maliyeti özellik arttıkça artar. Potansiyelini aşamazsın.</p>
    </div>
  `);
  screen.querySelectorAll('[data-up]').forEach(b => b.onclick = () => {
    if (C.upgradeAttr(st, b.dataset.up)) { sfx.click(); C.save(st); showDev(); }
  });
  on('bBack', showHub);
}

// ---------------- Lig tablosu ----------------
function showTable() {
  setShowroom(null);
  screen.className = 'page';
  const rows = C.sortedTable(st);
  html(`
    <div class="topbar"><button class="back" id="bBack">‹</button><h2>${LEAGUES[st.leagueId].name}</h2></div>
    <div class="card tbl">
      <table>
        <tr><th>#</th><th class="l">Takım</th><th>O</th><th>G</th><th>B</th><th>M</th><th>AV</th><th>P</th></tr>
        ${rows.map((r, i) => `<tr class="${r.id === st.clubId ? 'me' : ''}"><td>${i + 1}</td><td class="l">${badge(TEAMS[r.id])} ${TEAMS[r.id].name}</td><td>${r.p}</td><td>${r.w}</td><td>${r.d}</td><td>${r.l}</td><td>${r.gd > 0 ? '+' : ''}${r.gd}</td><td><b>${r.pts}</b></td></tr>`).join('')}
      </table>
    </div>
    <div class="card">
      <h3>Son maçların</h3>
      ${st.results.length ? st.results.slice().reverse().map(r => `<div class="res"><span class="f ${r.res}">${r.res}</span> ${r.home ? 'vs' : '@'} ${TEAMS[r.opp].name} <b>${r.my}-${r.their}</b> <span class="rt">${r.rating.toFixed(1)}</span>${r.goals ? ` ⚽${r.goals}` : ''}${r.assists ? ` 🅰${r.assists}` : ''}</div>`).join('') : '<p class="hint">Henüz maç oynanmadı.</p>'}
    </div>
  `);
  on('bBack', showHub);
}

// ---------------- Kariyer ----------------
function showCareer() {
  setShowroom(null);
  screen.className = 'page';
  const p = st.player, CS = st.careerStats;
  html(`
    <div class="topbar"><button class="back" id="bBack">‹</button><h2>Kariyer</h2></div>
    <div class="card">
      <div class="kv"><span>Maç</span><b>${CS.apps}</b></div>
      <div class="kv"><span>Gol</span><b>${CS.goals}</b></div>
      <div class="kv"><span>Asist</span><b>${CS.assists}</b></div>
      <div class="kv"><span>Ortalama reyting</span><b>${CS.apps ? (CS.ratingSum / CS.apps).toFixed(2) : '-'}</b></div>
      <div class="kv"><span>Maçın oyuncusu</span><b>${CS.motm}</b></div>
      <div class="kv"><span>Piyasa değeri</span><b>${C.formatMoney(C.marketValue(p))}</b></div>
      <div class="kv"><span>Sözleşme</span><b>${st.contract.years} yıl · ${C.formatMoney(st.contract.wage)}/hafta</b></div>
    </div>
    <div class="card">
      <h3>Kupalar & Ödüller</h3>
      ${st.trophies.length ? st.trophies.map(t => `<div class="trophy">🏆 ${t.name} <small>${t.year}</small></div>`).join('') : '<p class="hint">Henüz kupa yok. Çalışmaya devam!</p>'}
    </div>
    <div class="card tbl">
      <h3>Sezonlar</h3>
      ${st.history.length ? `<table><tr><th>Sezon</th><th class="l">Kulüp</th><th>M</th><th>G</th><th>A</th><th>Ort</th></tr>
      ${st.history.map(h => `<tr><td>${h.year}</td><td class="l">${badge(TEAMS[h.club])} ${TEAMS[h.club].short}</td><td>${h.apps}</td><td>${h.goals}</td><td>${h.assists}</td><td>${h.avg.toFixed(1)}</td></tr>`).join('')}</table>` : '<p class="hint">İlk sezonun devam ediyor.</p>'}
    </div>
  `);
  on('bBack', showHub);
}

function showNews() {
  setShowroom(null);
  screen.className = 'page';
  html(`
    <div class="topbar"><button class="back" id="bBack">‹</button><h2>Haberler</h2></div>
    <div class="card">${st.news.map(n => `<div class="news"><small>Sezon ${n.season} · Hafta ${n.week + 1}</small>${esc(n.text)}</div>`).join('') || '<p class="hint">Haber yok.</p>'}</div>
  `);
  on('bBack', showHub);
}

// ---------------- Antrenman ----------------
function showTrainingSelect() {
  setShowroom(null);
  screen.className = 'page';
  html(`
    <div class="topbar"><button class="back" id="bBack">‹</button><h2>Antrenman</h2></div>
    <p class="hint pad">Bir antrenman seç. Başarı oranın %60'ı geçerse ilgili özelliğin +1 artar ve gelişim puanı kazanırsın. (−12 enerji)</p>
    ${Object.entries(DRILLS).map(([id, d]) => `
      <button class="btn drill" data-drill="${id}">
        <b>${d.name}</b><span>${d.desc}</span><small>Geliştirir: ${ATTRS.find(a => a.key === d.attr).name}</small>
      </button>`).join('')}
  `);
  screen.querySelectorAll('[data-drill]').forEach(b => b.onclick = () => { initAudio(); startTraining(b.dataset.drill); });
  on('bBack', showHub);
}

function startTraining(id) {
  setShowroom(null);
  screen.className = 'page hidden';
  html('');
  const sess = new TrainingSession(world, st, id, (score, max) => {
    const r = C.applyTraining(st, DRILLS[id].attr, score, max);
    C.save(st);
    screen.className = 'page';
    setShowroom(playerLook(st.player, st.clubId), { yOffset: -0.3, dist: 8.4 });
    html(`
      <div class="spacer-3d"></div>
      <div class="card center">
        <h2>Antrenman Bitti</h2>
        <div class="big-num">${score}/${max}</div>
        <p>+${r.pts} gelişim puanı${r.attrGain ? ` · <b>${ATTRS.find(a => a.key === DRILLS[id].attr).name} +1</b>` : ''}</p>
        <button class="btn primary" id="bOk">Devam</button>
      </div>
    `);
    on('bOk', showHub);
  });
  sess.start();
}

// ---------------- Maç ----------------
function startMatch() {
  initAudio();
  setShowroom(null);
  screen.className = 'page hidden';
  html('');
  const md = new MatchDay(world, st, result => {
    const r = C.finishUserMatch(st, result);
    C.save(st);
    showPostMatch(result, r, md);
  });
  md.start();
}

function showPostMatch(result, r, md) {
  screen.className = 'page';
  const s = result.stats;
  setShowroom(playerLook(st.player, st.clubId), { yOffset: -0.3, dist: 8.4 });
  if (showroom && r.res === 'G') showroom.h.play('celebrate', { variant: 0, dur: 2.5 });
  const fx = md.fx;
  const home = TEAMS[fx.home], away = TEAMS[fx.away];
  const rc = result.rating >= 8 ? 'gold' : result.rating >= 7 ? 'green' : result.rating >= 6 ? 'blue' : 'red';
  html(`
    <div class="card result">
      <div class="res-title">${r.res === 'G' ? 'GALİBİYET' : r.res === 'M' ? 'MAĞLUBİYET' : 'BERABERLİK'}</div>
      <div class="score-line">${badge(home)} <span>${result.homeGoals} - ${result.awayGoals}</span> ${badge(away)}</div>
    </div>
    <div class="spacer-3d small"></div>
    <div class="card">
      <div class="rating-big ${rc}">${result.rating.toFixed(1)}<small>REYTİNG</small></div>
      ${r.motm ? '<div class="motm">⭐ MAÇIN OYUNCUSU</div>' : ''}
      <div class="grid-stats">
        <div><b>${s.goals}</b><span>Gol</span></div>
        <div><b>${s.assists}</b><span>Asist</span></div>
        <div><b>${s.onTarget}/${s.shots}</b><span>İsabetli şut</span></div>
        <div><b>${s.passesOk}/${s.passes}</b><span>Başarılı pas</span></div>
        <div><b>${s.dribbles}</b><span>Çalım</span></div>
        <div><b>${s.lost}</b><span>Top kaybı</span></div>
      </div>
      <p class="center">+${r.gained} gelişim puanı kazandın</p>
      <button class="btn primary big" id="bOk">Devam</button>
    </div>
  `);
  on('bOk', showHub);
}

// ---------------- Sezon sonu ----------------
function showSeasonEnd() {
  setShowroom(null);
  if (!st.pendingSummary) { st.pendingSummary = C.endSeason(st); C.save(st); }
  const sum = st.pendingSummary;
  screen.className = 'page';
  const lg = LEAGUES[st.leagueId];
  const changes = Object.entries(sum.changes).filter(([, d]) => d !== 0)
    .map(([k, d]) => `<span class="chg ${d > 0 ? 'up' : 'down'}">${ATTRS.find(a => a.key === k).name} ${d > 0 ? '+' : ''}${d}</span>`).join(' ');
  if (sum.retired) {
    html(`
      <div class="card center">
        <h2>Jübile 👋</h2>
        <p>${esc(st.player.name)} ${st.player.age} yaşında futbolu bıraktı.</p>
        <div class="kv"><span>Toplam maç</span><b>${st.careerStats.apps}</b></div>
        <div class="kv"><span>Toplam gol</span><b>${st.careerStats.goals}</b></div>
        <div class="kv"><span>Toplam asist</span><b>${st.careerStats.assists}</b></div>
        <div class="kv"><span>Kupa</span><b>${st.trophies.length}</b></div>
        <button class="btn primary big" id="bNew">Yeni Kariyer</button>
      </div>
    `);
    on('bNew', () => { C.deleteSave(); st = null; showCreate(); });
    return;
  }
  html(`
    <div class="topbar"><h2>Sezon ${st.season} Bitti</h2></div>
    <div class="card">
      <div class="kv"><span>${lg.name} sıralaması</span><b>${sum.pos}.</b></div>
      <div class="kv"><span>Ortalama reyting</span><b>${sum.avg.toFixed(2)}</b></div>
      <div class="kv"><span>Gol / Asist</span><b>${st.seasonStats.goals} / ${st.seasonStats.assists}</b></div>
      ${sum.awards.length ? `<div class="awards">${sum.awards.map(a => `<div class="trophy">🏆 ${a}</div>`).join('')}</div>` : ''}
      <p class="hint">Yaş ${st.player.age}. Sezon arası değişim: ${changes || 'yok'}</p>
    </div>
    <div class="card">
      <h3>Transfer Teklifleri</h3>
      ${sum.offers.length ? sum.offers.map((o, i) => {
        const t = TEAMS[o.club];
        return `<div class="offer">
          <div>${badge(t)} <b>${t.name}</b><small>${LEAGUES[t.league].name} · Güç ${t.str}</small><small>${o.years} yıl · ${C.formatMoney(o.wage)}/hafta · Bonservis ${C.formatMoney(o.fee)}</small></div>
          <button class="btn small primary" data-offer="${i}">Kabul</button>
        </div>`;
      }).join('') : '<p class="hint">Bu yaz teklif gelmedi. Daha iyi performans göster!</p>'}
      <button class="btn big" id="bStay">${TEAMS[st.clubId].name} ile devam et</button>
    </div>
  `);
  screen.querySelectorAll('[data-offer]').forEach(b => b.onclick = () => {
    C.acceptOffer(st, st.offers[+b.dataset.offer]);
    C.newSeason(st); C.save(st);
    toast('Transfer tamamlandı! Yeni sezon başlıyor.');
    showHub();
  });
  on('bStay', () => { C.newSeason(st); C.save(st); showHub(); });
}

// Başlat
showMenu();
document.addEventListener('pointerdown', () => initAudio(), { once: true });
window.__game = { world, get st() { return st; }, THREE };
