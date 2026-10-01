// Oyun verileri: ligler, takımlar, isimler. Hepsi kurgusal.

export const LEAGUES = [
  {
    id: 0, name: '1. Lig', tier: 1,
    teams: [
      { name: 'Kuzey Kartalları', short: 'KKR', c1: '#1f4fbf', c2: '#ffffff', str: 58 },
      { name: 'Ege Rüzgarı', short: 'EGR', c1: '#18a3a8', c2: '#0d2d40', str: 61 },
      { name: 'Bozkır Spor', short: 'BZK', c1: '#c8902a', c2: '#3b2410', str: 55 },
      { name: 'Liman FK', short: 'LMN', c1: '#0c2f6b', c2: '#f2c230', str: 60 },
      { name: 'Toros Gücü', short: 'TRS', c1: '#7a1c1c', c2: '#ffffff', str: 63 },
      { name: 'Çınar SK', short: 'ÇNR', c1: '#2f8a3a', c2: '#ffffff', str: 57 },
      { name: 'Kapadokya FK', short: 'KPD', c1: '#d26a2e', c2: '#2a1a12', str: 54 },
      { name: 'Yeşilvadi', short: 'YŞV', c1: '#5fb84a', c2: '#103010', str: 59 },
      { name: 'Demirspor', short: 'DMR', c1: '#3c3c46', c2: '#e04040', str: 62 },
      { name: 'Sahil United', short: 'SHL', c1: '#e6e6e6', c2: '#1d5fa8', str: 56 },
    ],
  },
  {
    id: 1, name: 'Süper Lig', tier: 2,
    teams: [
      { name: 'Boğaziçi SK', short: 'BGZ', c1: '#f2c230', c2: '#7a1020', str: 74 },
      { name: 'Başkent Yıldızları', short: 'BŞK', c1: '#e8e8e8', c2: '#101010', str: 72 },
      { name: 'Anadolu Aslanları', short: 'AND', c1: '#c41e2a', c2: '#f2c230', str: 76 },
      { name: 'Karadeniz FK', short: 'KRD', c1: '#6b1a3a', c2: '#3aa0d8', str: 70 },
      { name: 'Marmara Kulübü', short: 'MRM', c1: '#1a64c4', c2: '#ffffff', str: 71 },
      { name: 'Ege Yıldızı', short: 'EGY', c1: '#1aa088', c2: '#ffffff', str: 67 },
      { name: 'Akdeniz Gençlik', short: 'AKD', c1: '#ff7a1a', c2: '#14304a', str: 66 },
      { name: 'Fırat Spor', short: 'FRT', c1: '#2b2b2b', c2: '#f2f2f2', str: 65 },
      { name: 'Kartal Gücü', short: 'KRT', c1: '#101010', c2: '#ffffff', str: 73 },
      { name: 'Trakya FK', short: 'TRK', c1: '#4a2a8a', c2: '#ffffff', str: 64 },
    ],
  },
  {
    id: 2, name: 'Avrupa Elit Ligi', tier: 3,
    teams: [
      { name: 'Real Monarca', short: 'RMN', c1: '#ffffff', c2: '#c8a83a', str: 86 },
      { name: 'Atlético Sol', short: 'ATS', c1: '#d4202a', c2: '#ffffff', str: 82 },
      { name: 'FC Rheinland', short: 'RHN', c1: '#c0102a', c2: '#101010', str: 85 },
      { name: 'Lion City', short: 'LNC', c1: '#7ab8e8', c2: '#ffffff', str: 84 },
      { name: 'Milano Nera', short: 'MLN', c1: '#101010', c2: '#1a3ac4', str: 80 },
      { name: 'Paris Étoile', short: 'PRS', c1: '#0c1f4a', c2: '#e02030', str: 83 },
      { name: 'Ajaxis', short: 'AJX', c1: '#ffffff', c2: '#c01828', str: 77 },
      { name: 'Porto Azul', short: 'PRT', c1: '#1a4ab8', c2: '#ffffff', str: 76 },
      { name: 'Celtic Green', short: 'CLT', c1: '#1a8a3a', c2: '#ffffff', str: 75 },
      { name: 'Torino Rosso', short: 'TRN', c1: '#8a1a1a', c2: '#ffffff', str: 78 },
    ],
  },
];

// Her takıma global id ver.
export const TEAMS = [];
for (const lg of LEAGUES) {
  lg.teamIds = [];
  for (const t of lg.teams) {
    t.id = TEAMS.length;
    t.league = lg.id;
    TEAMS.push(t);
    lg.teamIds.push(t.id);
  }
}

export const POSITIONS = {
  ST: { name: 'Santrfor', desc: 'Golcü. Bitiricilik ve kafa vuruşları.', w: { hiz: .2, sut: .35, pas: .1, dribling: .2, fizik: .15 } },
  KOO: { name: 'Ofansif Orta Saha', desc: 'Oyun kurucu. Pas ve vizyon.', w: { hiz: .1, sut: .2, pas: .35, dribling: .25, fizik: .1 } },
  KNT: { name: 'Kanat', desc: 'Hızlı, çalımcı, orta açan.', w: { hiz: .3, sut: .15, pas: .15, dribling: .3, fizik: .1 } },
};

export const ATTRS = [
  { key: 'hiz', name: 'Hız', icon: '⚡' },
  { key: 'sut', name: 'Şut', icon: '🎯' },
  { key: 'pas', name: 'Pas', icon: '🔁' },
  { key: 'dribling', name: 'Dribling', icon: '🌀' },
  { key: 'fizik', name: 'Fizik', icon: '💪' },
];

export const SKIN_TONES = ['#f1c9a5', '#e0ac82', '#c68b5e', '#a26a42', '#7a4a2a', '#4f3020'];
export const HAIR_COLORS = ['#1a1410', '#3b2414', '#6b4423', '#b07a3a', '#e0c070', '#8a8a8a'];

export const FIRST_NAMES = ['Emre', 'Can', 'Burak', 'Mert', 'Arda', 'Kerem', 'Yusuf', 'Ozan', 'Baran', 'Efe', 'Kaan', 'Deniz', 'Umut', 'Selim', 'Tolga', 'Onur'];
export const LAST_NAMES = ['Yılmaz', 'Kaya', 'Demir', 'Şahin', 'Çelik', 'Aydın', 'Öztürk', 'Arslan', 'Doğan', 'Koç', 'Kurt', 'Polat', 'Aksoy', 'Tekin', 'Erdem', 'Güler'];
