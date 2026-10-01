// Dokunmatik (sanal joystick + butonlar) ve klavye girişi.
export const input = {
  joy: { x: 0, y: 0 },
  sprint: false,
  shootHeld: false,
  shootStart: 0,
  events: [],
  enabled: false,
};

const keys = new Set();
let joyTouch = null;
let els = null;

export function consumeEvents() {
  const e = input.events;
  input.events = [];
  return e;
}

export function shootPower() {
  if (!input.shootHeld) return 0;
  return Math.min(1, (performance.now() - input.shootStart) / 900);
}

function pressShoot() {
  if (input.shootHeld) return;
  input.shootHeld = true;
  input.shootStart = performance.now();
  input.events.push({ type: 'shootStart' });
}
function releaseShoot() {
  if (!input.shootHeld) return;
  const power = shootPower();
  input.shootHeld = false;
  input.events.push({ type: 'shoot', power: Math.max(0.15, power) });
}

function updateKeyJoy() {
  if (joyTouch) return;
  let x = 0, y = 0;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
  if (keys.has('KeyW') || keys.has('ArrowUp')) y += 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) y -= 1;
  const l = Math.hypot(x, y);
  input.joy.x = l ? x / l : 0;
  input.joy.y = l ? y / l : 0;
}

export function setupInput() {
  els = {
    zone: document.getElementById('joyZone'),
    base: document.getElementById('joyBase'),
    knob: document.getElementById('joyKnob'),
    shoot: document.getElementById('btnShoot'),
    pass: document.getElementById('btnPass'),
    skill: document.getElementById('btnSkill'),
    sprint: document.getElementById('btnSprint'),
  };

  const R = 50;
  const setKnob = (dx, dy) => { els.knob.style.transform = `translate(${dx}px, ${dy}px)`; };

  els.zone.addEventListener('pointerdown', e => {
    if (joyTouch) return;
    e.preventDefault();
    const rect = els.zone.getBoundingClientRect();
    joyTouch = { id: e.pointerId, cx: e.clientX, cy: e.clientY };
    els.base.style.left = (e.clientX - rect.left) + 'px';
    els.base.style.top = (e.clientY - rect.top) + 'px';
    els.base.classList.add('active');
    els.zone.setPointerCapture(e.pointerId);
  });
  els.zone.addEventListener('pointermove', e => {
    if (!joyTouch || e.pointerId !== joyTouch.id) return;
    let dx = e.clientX - joyTouch.cx, dy = e.clientY - joyTouch.cy;
    const l = Math.hypot(dx, dy);
    if (l > R) { dx *= R / l; dy *= R / l; }
    setKnob(dx, dy);
    const m = Math.min(1, l / R);
    const n = l > 4 ? m / Math.max(1e-6, Math.min(l, R)) : 0;
    input.joy.x = dx * n;
    input.joy.y = -dy * n;
  });
  const endJoy = e => {
    if (!joyTouch || e.pointerId !== joyTouch.id) return;
    joyTouch = null;
    input.joy.x = 0; input.joy.y = 0;
    setKnob(0, 0);
    els.base.classList.remove('active');
    els.base.style.left = ''; els.base.style.top = '';
  };
  els.zone.addEventListener('pointerup', endJoy);
  els.zone.addEventListener('pointercancel', endJoy);

  const btn = (el, down, up) => {
    el.addEventListener('pointerdown', e => { e.preventDefault(); el.classList.add('down'); el.setPointerCapture(e.pointerId); down(); });
    const u = e => { el.classList.remove('down'); if (up) up(); };
    el.addEventListener('pointerup', u);
    el.addEventListener('pointercancel', u);
  };
  btn(els.shoot, pressShoot, releaseShoot);
  btn(els.pass, () => input.events.push({ type: 'pass' }));
  btn(els.skill, () => input.events.push({ type: 'skill' }));
  btn(els.sprint, () => { input.sprint = true; }, () => { input.sprint = false; });

  window.addEventListener('keydown', e => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (e.repeat) return;
    keys.add(e.code);
    if (e.code === 'Space') { e.preventDefault(); pressShoot(); }
    if (e.code === 'KeyJ' || e.code === 'KeyE') input.events.push({ type: 'pass' });
    if (e.code === 'KeyK' || e.code === 'KeyQ') input.events.push({ type: 'skill' });
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyL') input.sprint = true;
    updateKeyJoy();
  });
  window.addEventListener('keyup', e => {
    keys.delete(e.code);
    if (e.code === 'Space') releaseShoot();
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyL') input.sprint = false;
    updateKeyJoy();
  });
  window.addEventListener('blur', () => {
    keys.clear(); input.sprint = false; input.shootHeld = false; updateKeyJoy();
  });
}

export function resetInput() {
  input.events = [];
  input.shootHeld = false;
  input.sprint = false;
  if (!joyTouch) { input.joy.x = 0; input.joy.y = 0; }
}

// Bağlama göre buton etiketleri
export function setButtonMode(mode) {
  if (!els) return;
  const L = {
    attack: ['ŞUT', 'PAS', 'ÇALIM'],
    support: ['MÜDAHALE', 'TOP İSTE', 'ÇALIM'],
    defend: ['MÜDAHALE', 'TOP İSTE', 'ÇALIM'],
  }[mode] || ['ŞUT', 'PAS', 'ÇALIM'];
  els.shoot.querySelector('span').textContent = L[0];
  els.pass.querySelector('span').textContent = L[1];
  els.skill.querySelector('span').textContent = L[2];
  els.skill.classList.toggle('disabled', mode !== 'attack');
}
