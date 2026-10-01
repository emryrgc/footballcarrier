// Maç içi HUD yardımcıları.
const $ = id => document.getElementById(id);

let bannerTimer = null;
export const hud = {
  show(on) {
    $('hud').classList.toggle('hidden', !on);
    $('controls').classList.toggle('hidden', !on);
  },
  showControls(on) { $('controls').classList.toggle('hidden', !on); },
  score(left, right, minute) {
    $('hudScore').innerHTML = `<b>${left.name}</b><span class="sc">${left.goals} - ${right.goals}</span><b>${right.name}</b>`;
    $('hudMin').textContent = minute != null ? `${minute}'` : '';
  },
  label(text) { $('hudLabel').textContent = text || ''; $('hudLabel').classList.toggle('hidden', !text); },
  banner(text, cls = '', dur = 1.6) {
    const b = $('banner');
    b.textContent = text;
    b.className = 'banner show ' + cls;
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => { b.className = 'banner'; }, dur * 1000);
  },
  popup(text, cls = '') {
    const p = document.createElement('div');
    p.className = 'popup ' + cls;
    p.textContent = text;
    $('hud').appendChild(p);
    setTimeout(() => p.remove(), 1200);
  },
  power(v) {
    const el = $('powerBar');
    if (v == null) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    el.firstElementChild.style.width = Math.round(v * 100) + '%';
    el.classList.toggle('over', v > 0.88);
  },
  stamina(v) { $('stamBar').firstElementChild.style.width = Math.round(v * 100) + '%'; },
  timer(f) { $('timeBar').firstElementChild.style.width = Math.round(Math.max(0, f) * 100) + '%'; },
};
