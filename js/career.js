// Kariyer mantığı: oyuncu, lig, fikstür, simülasyon, gelişim, transfer, kayıt.
import { LEAGUES, TEAMS, POSITIONS, ATTRS } from './data.js';

const SAVE_KEY = 'futbolcu-kariyeri-v1';
export const WEEKS_PER_SEASON = 18;
export const RETIRE_AGE = 36;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = (a, b) => a + Math.random() * (b - a);
const rndi = (a, b) => Math.floor(rnd(a, b + 1));

export function overall(p) {
  const w = POSITIONS[p.pos].w;
  let s = 0;
  for (const k in w) s += p.attrs[k] * w[k];
  return Math.round(s);
}

export function upgradeCost(v) {
  if (v < 60) return 1;
  if (v < 70) return 2;
  if (v < 80) return 3;
  if (v < 90) return 4;
  return 5;
}

export function marketValue(p) {
  const o = overall(p);
  const ageF = p.age <= 21 ? 1.6 : p.age <= 25 ? 1.3 : p.age <= 29 ? 1 : p.age <= 32 ? 0.6 : 0.3;
  const v = Math.pow(Math.max(0, o - 40), 2.3) * 120 * ageF; // €
  return Math.round(v / 1000) * 1000;
}

export function formatMoney(v) {
  if (v >= 1e6) return '€' + (v / 1e6).toFixed(1) + 'M';
  if (v >= 1e3) return '€' + Math.round(v / 1e3) + 'K';
  return '€' + v;
}

export function newCareer({ name, pos, skin, hair, number }) {
  const base = { hiz: 52, sut: 52, pas: 52, dribling: 52, fizik: 50 };
  // Mevkiye göre başlangıç profili
  const bonus = {
    ST: { sut: 8, fizik: 4, hiz: 2 },
    KOO: { pas: 8, dribling: 4, sut: 2 },
    KNT: { hiz: 8, dribling: 6 },
  }[pos];
  const attrs = {};
  for (const a of ATTRS) attrs[a.key] = base[a.key] + (bonus[a.key] || 0) + rndi(-2, 2);

  const lg = LEAGUES[0];
  // En zayıf takımlardan birine başla
  const sorted = [...lg.teamIds].sort((a, b) => TEAMS[a].str - TEAMS[b].str);
  const clubId = sorted[rndi(0, 3)];

  const st = {
    v: 1,
    player: {
      name, pos, skin, hair, number,
      age: 17,
      attrs,
      potential: rndi(84, 93),
      points: 3,
      energy: 100,
      morale: 70,
      trust: 50, // teknik direktör güveni
    },
    clubId,
    leagueId: lg.id,
    season: 1,
    year: 2026,
    week: 0,
    fixtures: [],
    table: {},
    results: [], // kullanıcının maç sonuçları (bu sezon)
    trainedThisWeek: false,
    seasonStats: emptyStats(),
    careerStats: emptyStats(),
    history: [],
    trophies: [],
    news: [],
    offers: [],
    contract: { years: 2, wage: 2000 },
    leagueTopScorer: 0,
  };
  startSeason(st);
  addNews(st, `${name}, ${TEAMS[clubId].name} ile ilk profesyonel sözleşmesini imzaladı!`);
  return st;
}

function emptyStats() {
  return { apps: 0, goals: 0, assists: 0, ratingSum: 0, motm: 0 };
}

export function addNews(st, text) {
  st.news.unshift({ text, season: st.season, week: st.week });
  if (st.news.length > 30) st.news.length = 30;
}

// Çift devreli fikstür (circle method)
function makeFixtures(teamIds) {
  const n = teamIds.length;
  const arr = [...teamIds].sort(() => Math.random() - 0.5);
  const rounds = [];
  for (let r = 0; r < n - 1; r++) {
    const round = [];
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i], b = arr[n - 1 - i];
      round.push(r % 2 === 0 ? { home: a, away: b } : { home: b, away: a });
    }
    rounds.push(round);
    arr.splice(1, 0, arr.pop());
  }
  const second = rounds.map(r => r.map(m => ({ home: m.away, away: m.home })));
  return [...rounds, ...second];
}

export function startSeason(st) {
  const lg = LEAGUES[st.leagueId];
  st.fixtures = makeFixtures(lg.teamIds);
  st.table = {};
  for (const id of lg.teamIds) st.table[id] = { p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 };
  st.week = 0;
  st.results = [];
  st.seasonStats = emptyStats();
  st.trainedThisWeek = false;
  st.offers = [];
  st.leagueTopScorer = 0;
}

export function currentFixture(st) {
  if (st.week >= st.fixtures.length) return null;
  const m = st.fixtures[st.week].find(f => f.home === st.clubId || f.away === st.clubId);
  const isHome = m.home === st.clubId;
  return { ...m, isHome, opponent: isHome ? m.away : m.home };
}

function poisson(lambda) {
  const L = Math.exp(-lambda);
  let k = 0, p = 1;
  do { k++; p *= Math.random(); } while (p > L);
  return k - 1;
}

export function expectedGoals(strFor, strAgainst, home) {
  return clamp(1.25 * Math.exp((strFor - strAgainst) / 16) + (home ? 0.2 : 0), 0.2, 3.5);
}

export function simulateMatch(homeId, awayId) {
  const h = TEAMS[homeId], a = TEAMS[awayId];
  return {
    hg: poisson(expectedGoals(h.str, a.str, true)),
    ag: poisson(expectedGoals(a.str, h.str, false)),
  };
}

function applyResult(table, home, away, hg, ag) {
  const H = table[home], A = table[away];
  H.p++; A.p++;
  H.gf += hg; H.ga += ag; A.gf += ag; A.ga += hg;
  if (hg > ag) { H.w++; H.pts += 3; A.l++; }
  else if (hg < ag) { A.w++; A.pts += 3; H.l++; }
  else { H.d++; A.d++; H.pts++; A.pts++; }
}

export function sortedTable(st) {
  return Object.entries(st.table)
    .map(([id, r]) => ({ id: +id, ...r, gd: r.gf - r.ga }))
    .sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);
}

export function leaguePosition(st) {
  return sortedTable(st).findIndex(r => r.id === st.clubId) + 1;
}

// Maç bittikten sonra çağrılır.
export function finishUserMatch(st, { homeGoals, awayGoals, stats, rating }) {
  const fx = currentFixture(st);
  applyResult(st.table, fx.home, fx.away, homeGoals, awayGoals);
  // Haftanın diğer maçları
  for (const m of st.fixtures[st.week]) {
    if (m === undefined || (m.home === fx.home && m.away === fx.away)) continue;
    const r = simulateMatch(m.home, m.away);
    applyResult(st.table, m.home, m.away, r.hg, r.ag);
  }
  const my = fx.isHome ? homeGoals : awayGoals;
  const their = fx.isHome ? awayGoals : homeGoals;
  const res = my > their ? 'G' : my < their ? 'M' : 'B';
  st.results.push({ week: st.week, opp: fx.opponent, home: fx.isHome, my, their, res, rating, goals: stats.goals, assists: stats.assists });

  const p = st.player;
  for (const S of [st.seasonStats, st.careerStats]) {
    S.apps++; S.goals += stats.goals; S.assists += stats.assists; S.ratingSum += rating;
  }
  const motm = rating >= 8.3;
  if (motm) { st.seasonStats.motm++; st.careerStats.motm++; }

  // Gelişim puanı
  const gained = Math.max(1, Math.round((rating - 5) * 1.1)) + (motm ? 1 : 0);
  p.points += gained;
  p.energy = clamp(p.energy - rndi(18, 26), 0, 100);
  p.morale = clamp(p.morale + (res === 'G' ? 6 : res === 'M' ? -6 : 0) + Math.round((rating - 6.5) * 4), 5, 100);
  p.trust = clamp(p.trust + Math.round((rating - 6.4) * 6), 0, 100);

  // Lig gol krallığı simülasyonu (en iyi rakip golcünün gol sayısı)
  st.leagueTopScorer += Math.random() < 0.55 ? 1 : 0;
  if (Math.random() < 0.12) st.leagueTopScorer++;

  // Haberler
  if (stats.goals >= 3) addNews(st, `HAT-TRICK! ${p.name}, ${TEAMS[fx.opponent].name} karşısında ${stats.goals} gol attı!`);
  else if (stats.goals > 0) addNews(st, `${p.name} gol sevinci yaşadı: ${TEAMS[st.clubId].short} ${my}-${their} ${TEAMS[fx.opponent].short}`);
  else if (motm) addNews(st, `${p.name} maçın oyuncusu seçildi (${rating.toFixed(1)}).`);

  st.week++;
  st.trainedThisWeek = false;
  return { res, gained, motm, my, their };
}

export function rest(st) {
  const p = st.player;
  p.energy = clamp(p.energy + 35, 0, 100);
  p.morale = clamp(p.morale + 2, 0, 100);
  st.trainedThisWeek = true;
}

export function applyTraining(st, attrKey, score, maxScore) {
  const p = st.player;
  const ratio = score / maxScore;
  const pts = Math.round(1 + ratio * 3);
  p.points += pts;
  let attrGain = 0;
  if (ratio >= 0.6 && p.attrs[attrKey] < p.potential) {
    p.attrs[attrKey] = Math.min(99, p.attrs[attrKey] + 1);
    attrGain = 1;
  }
  p.energy = clamp(p.energy - 12, 0, 100);
  st.trainedThisWeek = true;
  return { pts, attrGain };
}

export function upgradeAttr(st, key) {
  const p = st.player;
  const v = p.attrs[key];
  const cost = upgradeCost(v);
  if (v >= 99 || p.points < cost) return false;
  if (v >= p.potential) return false;
  p.points -= cost;
  p.attrs[key]++;
  return true;
}

export function isSeasonOver(st) {
  return st.week >= st.fixtures.length;
}

// Sezon sonu: ödüller, yaşlanma, teklifler.
export function endSeason(st) {
  const p = st.player;
  const pos = leaguePosition(st);
  const S = st.seasonStats;
  const avg = S.apps ? S.ratingSum / S.apps : 0;
  const lg = LEAGUES[st.leagueId];
  const awards = [];
  if (pos === 1) { awards.push(`${lg.name} Şampiyonluğu`); st.trophies.push({ name: `${lg.name} Şampiyonu`, year: st.year }); }
  if (S.goals > st.leagueTopScorer) { awards.push('Gol Kralı'); st.trophies.push({ name: `${lg.name} Gol Kralı`, year: st.year }); }
  if (avg >= 7.6 && S.apps >= 10) { awards.push('Sezonun Oyuncusu'); st.trophies.push({ name: `${lg.name} Sezonun Oyuncusu`, year: st.year }); }

  st.history.push({
    season: st.season, year: st.year, club: st.clubId, league: st.leagueId,
    apps: S.apps, goals: S.goals, assists: S.assists, avg: +avg.toFixed(2), pos,
  });

  // Yaşlanma ve doğal gelişim / düşüş
  p.age++;
  const changes = {};
  for (const k in p.attrs) {
    let d = 0;
    if (p.age <= 23) d = rndi(1, 3);
    else if (p.age <= 28) d = rndi(0, 1);
    else if (p.age <= 31) d = rndi(-1, 0);
    else d = rndi(-3, -1) - (k === 'hiz' ? 1 : 0);
    const nv = clamp(p.attrs[k] + d, 30, Math.max(p.attrs[k], p.potential));
    changes[k] = nv - p.attrs[k];
    p.attrs[k] = nv;
  }
  p.energy = 100;

  st.contract.years--;
  // Teklifler
  const offers = generateOffers(st, avg);
  return { pos, avg, awards, changes, offers, retired: p.age >= RETIRE_AGE };
}

function generateOffers(st, avg) {
  const p = st.player;
  const o = overall(p);
  const offers = [];
  const myLeague = st.leagueId;
  for (const t of TEAMS) {
    if (t.id === st.clubId) continue;
    // Oyuncunun seviyesine uygun takımlar
    const fit = o + (avg - 6.8) * 6 - t.str;
    if (fit < -6 || (t.league < myLeague && fit < 6)) continue;
    let chance = 0.08 + clamp(fit + 6, 0, 14) * 0.02;
    if (t.league > myLeague) chance += 0.1;
    if (Math.random() < chance) {
      offers.push({
        club: t.id,
        wage: Math.round((t.str * t.str * (1 + t.league) * 1.4) / 10) * 10 + o * 40,
        years: rndi(2, 4),
        fee: Math.round(marketValue(p) * rnd(0.9, 1.4) / 1000) * 1000,
      });
    }
  }
  offers.sort((a, b) => TEAMS[b.club].str - TEAMS[a.club].str);
  st.offers = offers.slice(0, 3);
  return st.offers;
}

export function acceptOffer(st, offer) {
  const t = TEAMS[offer.club];
  addNews(st, `TRANSFER: ${st.player.name}, ${formatMoney(offer.fee)} bonservisle ${t.name} takımına imza attı!`);
  st.clubId = t.id;
  st.leagueId = t.league;
  st.contract = { years: offer.years, wage: offer.wage };
  st.player.trust = 45;
}

export function newSeason(st) {
  st.pendingSummary = null;
  st.season++;
  st.year++;
  if (st.contract.years <= 0) {
    st.contract.years = 2;
    st.contract.wage = Math.round(st.contract.wage * 1.2);
    addNews(st, `${st.player.name} sözleşmesini 2 yıl uzattı.`);
  }
  startSeason(st);
}

export function save(st) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(st)); } catch (e) { /* kayıt opsiyonel */ }
}
export function load() {
  try {
    const s = localStorage.getItem(SAVE_KEY);
    return s ? JSON.parse(s) : null;
  } catch (e) { return null; }
}
export function deleteSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* yok say */ }
}
