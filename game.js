/* ================================================================
   Adventure Quest: The Lost Kingdom
   A Mario-style 2D platformer — fully self-contained in one file.
   Desktop: Arrow keys / WASD + Space (jump) + X (attack) + Esc (pause)
   Mobile : On-screen buttons rendered below the canvas.
   ================================================================ */

// ════════════════════════════════════════════════════════════════
// LANDSCAPE ORIENTATION LOCK
// Shows a "rotate your device" overlay whenever a touch device
// is detected in portrait mode.
// ════════════════════════════════════════════════════════════════
function checkOrientation() {
  if (!isTouchDevice()) return;
  const isPortrait = window.innerHeight > window.innerWidth;
  document.documentElement.classList.toggle('portrait', isPortrait);
}

// Try the Screen Orientation API (Chrome/Android/modern Safari)
if (screen.orientation && screen.orientation.lock) {
  screen.orientation.lock('landscape').catch(() => {/* silently ignore if denied */});
}

window.addEventListener('resize',         checkOrientation);
window.addEventListener('orientationchange', checkOrientation);
checkOrientation();

// ════════════════════════════════════════════════════════════════
// WEB AUDIO SOUND ENGINE
// All sounds generated procedurally — no audio files required.
// ════════════════════════════════════════════════════════════════
let audioCtx = null;
let isMuted  = false;
let masterGain = null;
let musicGain  = null;

function getAudioCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  // Resume if suspended (autoplay policy)
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function getMasterGain() {
  const ac = getAudioCtx();
  if (!masterGain) {
    masterGain = ac.createGain();
    masterGain.gain.value = 1;
    masterGain.connect(ac.destination);
  }
  return masterGain;
}

function getMusicGain() {
  const ac = getAudioCtx();
  if (!musicGain) {
    musicGain = ac.createGain();
    musicGain.gain.value = isMuted ? 0 : 0.13;
    musicGain.connect(getMasterGain());
  }
  return musicGain;
}

function setMuted(muted) {
  isMuted = muted;
  if (musicGain) musicGain.gain.setTargetAtTime(muted ? 0 : 0.13, getAudioCtx().currentTime, 0.02);
  const muteBtn = document.getElementById('mute-btn');
  if (muteBtn) muteBtn.textContent = isMuted ? '🔇' : '🔊';
}

// Generic tone player
function playTone({ type='square', freq=440, freq2=null, duration=0.12,
                    volume=0.18, attack=0.005, decay=0.05, sustain=0.4,
                    release=0.06, detune=0, startDelay=0 } = {}) {
  if (isMuted) return;
  try {
    const ac  = getAudioCtx();
    const osc = ac.createOscillator();
    const env = ac.createGain();
    osc.connect(env);
    env.connect(getMasterGain());

    osc.type    = type;
    osc.frequency.setValueAtTime(freq, ac.currentTime + startDelay);
    if (freq2 !== null) {
      osc.frequency.linearRampToValueAtTime(freq2, ac.currentTime + startDelay + duration * 0.7);
    }
    if (detune) osc.detune.setValueAtTime(detune, ac.currentTime);

    const t0 = ac.currentTime + startDelay;
    env.gain.setValueAtTime(0, t0);
    env.gain.linearRampToValueAtTime(volume, t0 + attack);
    env.gain.linearRampToValueAtTime(volume * sustain, t0 + attack + decay);
    env.gain.setValueAtTime(volume * sustain, t0 + duration - release);
    env.gain.linearRampToValueAtTime(0, t0 + duration);

    osc.start(t0);
    osc.stop(t0 + duration + 0.01);
  } catch(e) { /* ignore */ }
}

// Noise burst (for explosions / land thuds)
function playNoise({ duration=0.08, volume=0.15, lowFreq=80, hiFreq=400, startDelay=0 } = {}) {
  if (isMuted) return;
  try {
    const ac = getAudioCtx();
    const bufLen = ac.sampleRate * (duration + 0.02);
    const buf  = ac.createBuffer(1, bufLen, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i=0; i<bufLen; i++) data[i] = Math.random()*2-1;

    const src    = ac.createBufferSource();
    const filter = ac.createBiquadFilter();
    const env    = ac.createGain();

    src.buffer = buf;
    filter.type = 'bandpass';
    filter.frequency.value = (lowFreq+hiFreq)/2;
    filter.Q.value = 0.5;

    src.connect(filter); filter.connect(env); env.connect(getMasterGain());

    const t0 = ac.currentTime + startDelay;
    env.gain.setValueAtTime(volume, t0);
    env.gain.exponentialRampToValueAtTime(0.001, t0 + duration);

    src.start(t0);
    src.stop(t0 + duration + 0.02);
  } catch(e) { /* ignore */ }
}

// ── Named sound effects ──────────────────────────────────────────
const SFX = {
  jump() {
    playTone({ type:'square', freq:300, freq2:600, duration:0.18,
               volume:0.20, attack:0.005, decay:0.04, sustain:0.5, release:0.07 });
  },
  land() {
    playNoise({ duration:0.07, volume:0.12, lowFreq:60, hiFreq:200 });
    playTone({ type:'sine', freq:120, freq2:60, duration:0.10,
               volume:0.14, attack:0.002, decay:0.03, sustain:0.2, release:0.05 });
  },
  coin() {
    playTone({ type:'sine', freq:880,  duration:0.06, volume:0.22, attack:0.003, decay:0.02, sustain:0.6, release:0.04 });
    playTone({ type:'sine', freq:1320, duration:0.10, volume:0.20, attack:0.003, decay:0.02, sustain:0.6, release:0.05, startDelay:0.06 });
  },
  stomp() {
    playNoise({ duration:0.06, volume:0.18, lowFreq:100, hiFreq:500 });
    playTone({ type:'square', freq:200, freq2:80, duration:0.12,
               volume:0.16, attack:0.002, decay:0.05, sustain:0.1, release:0.05 });
  },
  enemyDie() {
    playTone({ type:'sawtooth', freq:400, freq2:80, duration:0.22,
               volume:0.18, attack:0.004, decay:0.06, sustain:0.3, release:0.10 });
    playNoise({ duration:0.10, volume:0.12, lowFreq:150, hiFreq:600, startDelay:0.04 });
  },
  playerHit() {
    playTone({ type:'square', freq:160, freq2:60,  duration:0.14, volume:0.22, attack:0.002, decay:0.04, sustain:0.3, release:0.08 });
    playNoise({ duration:0.10, volume:0.16, lowFreq:60, hiFreq:300, startDelay:0.03 });
  },
  powerUp() {
    [523,659,784,1047].forEach((f,i) =>
      playTone({ type:'sine', freq:f, duration:0.12, volume:0.20,
                 attack:0.005, decay:0.03, sustain:0.5, release:0.05, startDelay: i*0.10 })
    );
  },
  shield() {
    playTone({ type:'sine', freq:600, freq2:900, duration:0.30,
               volume:0.18, attack:0.01, decay:0.08, sustain:0.6, release:0.12 });
    playTone({ type:'triangle', freq:1200, duration:0.20, volume:0.12,
               attack:0.01, decay:0.05, sustain:0.5, release:0.08, startDelay:0.10 });
  },
  fireball() {
    playTone({ type:'sawtooth', freq:500, freq2:250, duration:0.12,
               volume:0.14, attack:0.003, decay:0.04, sustain:0.3, release:0.06 });
  },
  bossHit() {
    playNoise({ duration:0.12, volume:0.22, lowFreq:80, hiFreq:600 });
    playTone({ type:'sawtooth', freq:300, freq2:100, duration:0.18,
               volume:0.18, attack:0.002, decay:0.06, sustain:0.2, release:0.08 });
  },
  bossDie() {
    [400,300,200,150,100].forEach((f,i) =>
      playTone({ type:'sawtooth', freq:f, duration:0.20, volume:0.22,
                 attack:0.002, decay:0.05, sustain:0.3, release:0.08, startDelay: i*0.14 })
    );
    playNoise({ duration:0.40, volume:0.25, lowFreq:60, hiFreq:800, startDelay:0.10 });
  },
  levelComplete() {
    // Fanfare: C-E-G-C
    [[523,0],[659,0.14],[784,0.28],[1047,0.44]].forEach(([f,d]) =>
      playTone({ type:'square', freq:f, duration:0.22, volume:0.20,
                 attack:0.005, decay:0.04, sustain:0.6, release:0.08, startDelay:d })
    );
  },
  checkpoint() {
    [660,880].forEach((f,i) =>
      playTone({ type:'sine', freq:f, duration:0.14, volume:0.18,
                 attack:0.005, decay:0.03, sustain:0.5, release:0.06, startDelay: i*0.12 })
    );
  },
  gameOver() {
    [440,330,220,110].forEach((f,i) =>
      playTone({ type:'sawtooth', freq:f, duration:0.24, volume:0.20,
                 attack:0.005, decay:0.06, sustain:0.4, release:0.10, startDelay: i*0.20 })
    );
  },
  menuSelect() {
    playTone({ type:'sine', freq:700, duration:0.08, volume:0.14,
               attack:0.003, decay:0.02, sustain:0.5, release:0.03 });
  },
  menuConfirm() {
    [500,700].forEach((f,i) =>
      playTone({ type:'sine', freq:f, duration:0.10, volume:0.16,
                 attack:0.003, decay:0.02, sustain:0.5, release:0.04, startDelay: i*0.08 })
    );
  },
  win() {
    [523,659,784,880,1047,1175,1319].forEach((f,i) =>
      playTone({ type:'square', freq:f, duration:0.18, volume:0.18,
                 attack:0.005, decay:0.04, sustain:0.55, release:0.07, startDelay: i*0.12 })
    );
  },
};

// ── Background music (procedural chiptune loops) ───────────────────
const N = {
  C3:130.81, D3:146.83, E3:164.81, F3:174.61, G3:196, A3:220, B3:246.94,
  C4:261.63, D4:293.66, E4:329.63, F4:349.23, G4:392, A4:440, B4:493.88,
  C5:523.25, D5:587.33, E5:659.25, G5:783.99, A5:880,
  A2:110, E2:82.41, G2:98,
};

const BGM_TRACKS = {
  menu: {
    bpm: 92,
    bass:  [N.A2,null,N.E2,null, N.A2,null,N.E2,null, N.F3,null,N.E2,null, N.D3,null,N.C3,null],
    lead:  [null,null,N.E4,null, null,null,N.G4,null, null,N.A4,null,N.G4, null,null,N.E4,null],
    pad:   [N.A3,null,null,N.C4, null,N.E4,null,null, N.F4,null,null,N.E4, null,null,N.A3,null],
  },
  adventure: {
    bpm: 128,
    bass:  [N.C3,N.C3,N.G2,N.G2, N.A2,N.A2,N.F2,N.F2, N.C3,N.C3,N.G2,N.G2, N.F2,N.G2,N.A2,N.C3],
    lead:  [N.E4,null,N.G4,N.C5, N.G4,null,N.E4,null, N.F4,null,N.A4,N.C5, N.A4,null,N.G4,null],
    pad:   [null,N.C4,null,null, null,N.G4,null,null, null,N.F4,null,null, null,N.E4,null,null],
  },
  forest: {
    bpm: 118,
    bass:  [N.A2,null,N.E2,N.A2, null,N.C3,null,N.E2, N.A2,null,N.G2,null, N.F2,null,N.E2,null],
    lead:  [null,N.C4,null,N.E4, null,N.G4,null,N.E4, null,N.D4,null,N.C4, null,null,N.A3,null],
    pad:   [N.A3,null,N.C4,null, null,N.E4,null,null, N.D4,null,null,N.C4, null,null,null,null],
  },
  ice: {
    bpm: 100,
    bass:  [N.C3,null,null,N.G2, null,N.C3,null,null, N.A2,null,null,N.E2, null,null,N.C3,null],
    lead:  [N.G5,null,N.E5,null, N.C5,null,N.G4,null, N.A4,null,null,N.G4, null,N.E5,null,null],
    pad:   [null,N.C4,null,null, null,N.G4,null,null, null,N.A4,null,null, null,N.E4,null,null],
  },
  lava: {
    bpm: 108,
    bass:  [N.E2,N.E2,null,N.G2, N.E2,null,N.A2,null, N.E2,null,N.E2,null, N.D3,null,N.C3,null],
    lead:  [null,null,N.G4,N.F4, null,null,N.E4,null, null,N.D4,null,null, null,N.C4,null,null],
    pad:   [null,N.E3,null,null, null,null,N.A3,null, null,N.G3,null,null, null,null,N.E3,null],
  },
  castle: {
    bpm: 120,
    bass:  [N.A2,N.A2,N.E2,N.E2, N.A2,null,N.G2,null, N.F2,N.F2,N.E2,N.E2, N.D3,null,N.C3,null],
    lead:  [null,N.E4,N.A4,null, null,N.G4,null,N.E4, null,N.D4,N.C4,null, null,null,N.A3,null],
    pad:   [N.A3,null,null,null, N.C4,null,null,null, N.E4,null,null,null, null,null,N.A3,null],
  },
};

let bgmTrackId   = null;
let bgmStep        = 0;
let bgmNextStepAt  = 0;

function playMusicNote(freq, duration, { type='triangle', volume=0.2, when=0 } = {}) {
  if (isMuted || !freq) return;
  try {
    const ac  = getAudioCtx();
    const osc = ac.createOscillator();
    const env = ac.createGain();
    osc.connect(env);
    env.connect(getMusicGain());

    osc.type = type;
    osc.frequency.setValueAtTime(freq, when);

    const t0 = when;
    env.gain.setValueAtTime(0, t0);
    env.gain.linearRampToValueAtTime(volume, t0 + 0.008);
    env.gain.linearRampToValueAtTime(volume * 0.55, t0 + duration * 0.35);
    env.gain.linearRampToValueAtTime(0.001, t0 + duration);

    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  } catch (e) { /* ignore */ }
}

function bgmTrackForState() {
  if (state === 'gameOver') return null;
  if (state === 'menu' || state === 'levelSelect' || state === 'settings') return 'menu';
  if (state === 'win' || state === 'levelComplete') return 'menu';
  if (state === 'playing' || state === 'paused') {
    const theme = LEVELS[currentLevelIndex]?.theme;
    if (theme === 'forest') return 'forest';
    if (theme === 'ice') return 'ice';
    if (theme === 'lava') return 'lava';
    if (theme === 'castle') return 'castle';
    return 'adventure';
  }
  return 'menu';
}

function updateBackgroundMusic() {
  const want = bgmTrackForState();
  if (want !== bgmTrackId) {
    bgmTrackId = want;
    bgmStep = 0;
    bgmNextStepAt = getAudioCtx().currentTime + 0.05;
  }
  if (!bgmTrackId || isMuted) return;

  const track = BGM_TRACKS[bgmTrackId];
  if (!track) return;

  const ac = getAudioCtx();
  const stepDur = (60 / track.bpm) / 2;
  const lookahead = 0.2;

  while (bgmNextStepAt < ac.currentTime + lookahead) {
    const i = bgmStep % track.bass.length;
    const bass = track.bass[i];
    const lead = track.lead?.[i];
    const pad  = track.pad?.[i];

    if (bass) playMusicNote(bass, stepDur * 0.92, { type:'triangle', volume:0.28, when:bgmNextStepAt });
    if (pad)  playMusicNote(pad,  stepDur * 0.95, { type:'sine',     volume:0.07, when:bgmNextStepAt });
    if (lead) playMusicNote(lead, stepDur * 0.82, { type:'square',   volume:0.11, when:bgmNextStepAt });

    bgmStep++;
    bgmNextStepAt += stepDur;
  }
}

// ── Mute button wiring ───────────────────────────────────────────
const muteBtn = document.getElementById('mute-btn');
if (muteBtn) {
  const toggleMute = e => {
    e.preventDefault();
    setMuted(!isMuted);
  };
  muteBtn.addEventListener('click', toggleMute);
}

// Unlock AudioContext on first user gesture (iOS / Chrome autoplay policy)
['pointerdown','keydown','touchstart'].forEach(ev => {
  document.addEventListener(ev, () => {
    getAudioCtx();
    getMusicGain();
    if (!bgmNextStepAt) bgmNextStepAt = getAudioCtx().currentTime + 0.05;
  }, { once:true });
});

// ── Canvas setup ────────────────────────────────────────────────
const canvas  = document.getElementById('gameCanvas');
const ctx     = canvas.getContext('2d');

const BASE_W  = 800;
const BASE_H  = 450;

function resizeCanvas() {
  const vv = window.visualViewport;
  const ww = vv ? vv.width  : window.innerWidth;
  const wh = vv ? vv.height : window.innerHeight;
  const ratio = BASE_W / BASE_H;

  // Fill the viewport. On-screen buttons overlay the canvas instead of
  // reserving a strip of height (that made the game tiny on phones).
  let w = ww, h = ww / ratio;
  if (h > wh) { h = wh; w = wh * ratio; }

  canvas.style.width  = Math.floor(w) + 'px';
  canvas.style.height = Math.floor(h) + 'px';
  canvas.width  = BASE_W;
  canvas.height = BASE_H;
}

function isTouchDevice() {
  return ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
}

window.addEventListener('resize', resizeCanvas);
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', resizeCanvas);
}
resizeCanvas();

if (isTouchDevice()) {
  document.getElementById('mobile-controls').style.display = 'flex';
}

// ── Input ────────────────────────────────────────────────────────
const keys = { left:false, right:false, up:false, attack:false };

document.addEventListener('keydown', e => {
  if (e.key==='ArrowLeft'  || e.key==='a') keys.left   = true;
  if (e.key==='ArrowRight' || e.key==='d') keys.right  = true;
  if (e.key==='ArrowUp'    || e.key==='w' || e.key===' ') keys.up = true;
  if (e.key==='x' || e.key==='X') keys.attack = true;
  if (e.key==='Escape') togglePause();
});
document.addEventListener('keyup', e => {
  if (e.key==='ArrowLeft'  || e.key==='a') keys.left   = false;
  if (e.key==='ArrowRight' || e.key==='d') keys.right  = false;
  if (e.key==='ArrowUp'    || e.key==='w' || e.key===' ') keys.up = false;
  if (e.key==='x' || e.key==='X') keys.attack = false;
});

// Mobile button bindings
function bindBtn(id, key) {
  const btn = document.getElementById(id);
  if (!btn) return;
  const press   = e => { e.preventDefault(); keys[key] = true;  };
  const release = e => { e.preventDefault(); keys[key] = false; };
  btn.addEventListener('pointerdown',  press,   { passive:false });
  btn.addEventListener('pointerup',    release, { passive:false });
  btn.addEventListener('pointerleave', release, { passive:false });
  btn.addEventListener('pointercancel',release, { passive:false });
}
bindBtn('btn-left',   'left');
bindBtn('btn-right',  'right');
bindBtn('btn-jump',   'up');
bindBtn('btn-attack', 'attack');

// ── Utility helpers ──────────────────────────────────────────────
const rand  = (min, max) => min + Math.random() * (max - min);
const randI = (min, max) => Math.floor(rand(min, max));

function rectOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x &&
         a.y < b.y + b.h && a.y + a.h > b.y;
}

// ── Particle system ─────────────────────────────────────────────
const particles = [];
function spawnParticles(x, y, color, n=8, speed=3) {
  for (let i=0; i<n; i++) {
    const angle = (Math.PI*2/n)*i + rand(-0.3,0.3);
    particles.push({
      x, y,
      vx: Math.cos(angle)*rand(1, speed),
      vy: Math.sin(angle)*rand(1, speed),
      life: 1, decay: rand(0.03,0.07), r: rand(3,7), color
    });
  }
}
function updateParticles() {
  for (let i = particles.length-1; i>=0; i--) {
    const p = particles[i];
    p.x += p.vx; p.y += p.vy; p.vy += 0.15; p.life -= p.decay;
    if (p.life <= 0) particles.splice(i, 1);
  }
}
function drawParticles() {
  particles.forEach(p => {
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r*p.life, 0, Math.PI*2); ctx.fill();
  });
  ctx.globalAlpha = 1;
}

// ── Floating text (score popups) ─────────────────────────────────
const floaters = [];
function spawnFloater(x, y, text, color='#FFD700') {
  floaters.push({ x, y, text, color, life:1, vy:-1.5 });
}
function updateFloaters() {
  for (let i=floaters.length-1; i>=0; i--) {
    const f = floaters[i];
    f.y += f.vy; f.life -= 0.02;
    if (f.life<=0) floaters.splice(i,1);
  }
}
function drawFloaters() {
  floaters.forEach(f => {
    ctx.globalAlpha = Math.max(0, f.life);
    ctx.fillStyle = f.color;
    ctx.font = 'bold 16px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText(f.text, f.x, f.y);
  });
  ctx.globalAlpha = 1;
}

// ═══════════════════════════════════════════════════════════════════
// LEVEL DEFINITIONS
// Each level: { name, bgColors[], theme, platforms[], enemies[], coins[], powerUps[], checkpoints[], flagX }
// ═══════════════════════════════════════════════════════════════════

function makeLevels() {
  return [
    // ── Level 1: Green Hills ─────────────────────────────────────
    {
      name: 'Level 1 — Green Hills',
      theme: 'green',
      bgColors: ['#87CEEB','#b0e0a8'],
      worldWidth: 3200,
      platforms: [
        // Ground
        {x:0,   y:390, w:600,  h:60, color:'#4a7c2f'},
        {x:650, y:390, w:600,  h:60, color:'#4a7c2f'},
        {x:1310,y:390, w:700,  h:60, color:'#4a7c2f'},
        {x:2060,y:390, w:800,  h:60, color:'#4a7c2f'},
        {x:2920,y:390, w:280,  h:60, color:'#4a7c2f'},
        // Floating
        {x:200, y:300, w:120,  h:20, color:'#6ab04c'},
        {x:380, y:260, w:100,  h:20, color:'#6ab04c'},
        {x:700, y:300, w:120,  h:20, color:'#6ab04c'},
        {x:900, y:250, w:100,  h:20, color:'#6ab04c'},
        {x:1100,y:310, w:100,  h:20, color:'#6ab04c'},
        {x:1350,y:280, w:140,  h:20, color:'#6ab04c'},
        {x:1550,y:230, w:100,  h:20, color:'#6ab04c'},
        {x:1750,y:300, w:120,  h:20, color:'#6ab04c'},
        {x:1950,y:250, w:100,  h:20, color:'#6ab04c'},
        {x:2200,y:310, w:140,  h:20, color:'#6ab04c'},
        {x:2400,y:260, w:100,  h:20, color:'#6ab04c'},
        {x:2600,y:300, w:120,  h:20, color:'#6ab04c'},
        {x:2800,y:240, w:100,  h:20, color:'#6ab04c'},
      ],
      enemies: [
        {x:300, type:'goomba'}, {x:750, type:'goomba'}, {x:1200,type:'goomba'},
        {x:1600,type:'goomba'}, {x:2000,type:'goomba'}, {x:2300,type:'goomba'},
        {x:2650,type:'goomba'},
      ],
      coins: coinLine(100,370,8).concat(coinLine(780,370,6)).concat(coinLine(1400,370,8))
             .concat(coinLine(2100,370,6)).concat([{x:200,y:275},{x:380,y:235},{x:700,y:275}]),
      powerUps: [{x:900, y:220, type:'heart'},{x:1550,y:200,type:'star'},{x:2400,y:230,type:'shield'}],
      checkpoints: [1400, 2100],
      flagX: 3050,
    },

    // ── Level 2: Dark Forest ─────────────────────────────────────
    {
      name: 'Level 2 — Dark Forest',
      theme: 'forest',
      bgColors: ['#1a2a1a','#2d4a2d'],
      worldWidth: 3400,
      platforms: [
        {x:0,   y:390, w:550,  h:60, color:'#2d4a1e'},
        {x:600, y:390, w:400,  h:60, color:'#2d4a1e'},
        {x:1050,y:390, w:500,  h:60, color:'#2d4a1e'},
        {x:1610,y:390, w:600,  h:60, color:'#2d4a1e'},
        {x:2260,y:390, w:700,  h:60, color:'#2d4a1e'},
        {x:3010,y:390, w:390,  h:60, color:'#2d4a1e'},
        // Floating & moving hints
        {x:150, y:310, w:120,  h:20, color:'#4a7a3a', moving:true, moveRange:60, moveSpeed:1},
        {x:400, y:270, w:100,  h:20, color:'#4a7a3a'},
        {x:680, y:300, w:130,  h:20, color:'#4a7a3a', moving:true, moveRange:50, moveSpeed:1.2},
        {x:900, y:250, w:100,  h:20, color:'#4a7a3a'},
        {x:1120,y:310, w:120,  h:20, color:'#4a7a3a', moving:true, moveRange:70, moveSpeed:0.8},
        {x:1350,y:260, w:100,  h:20, color:'#4a7a3a'},
        {x:1650,y:300, w:130,  h:20, color:'#4a7a3a'},
        {x:1850,y:240, w:100,  h:20, color:'#4a7a3a', moving:true, moveRange:60, moveSpeed:1},
        {x:2100,y:310, w:120,  h:20, color:'#4a7a3a'},
        {x:2350,y:260, w:140,  h:20, color:'#4a7a3a', moving:true, moveRange:80, moveSpeed:1.1},
        {x:2600,y:310, w:120,  h:20, color:'#4a7a3a'},
        {x:2800,y:250, w:100,  h:20, color:'#4a7a3a'},
        {x:2960,y:300, w:100,  h:20, color:'#4a7a3a'},
      ],
      enemies: [
        {x:300,  type:'bat'},{x:650, type:'goomba'},{x:850, type:'bat'},
        {x:1200, type:'goomba'},{x:1500,type:'bat'},{x:1800,type:'goomba'},
        {x:2100, type:'bat'},{x:2400,type:'goomba'},{x:2700,type:'bat'},
        {x:3050, type:'goomba'},
      ],
      coins: coinLine(100,370,6).concat(coinLine(650,370,5)).concat(coinLine(1100,370,6))
             .concat(coinLine(1700,370,5)).concat(coinLine(2300,370,7)),
      powerUps: [{x:400,y:240,type:'heart'},{x:1350,y:230,type:'fire'},{x:2350,y:230,type:'star'}],
      checkpoints: [1500, 2400],
      flagX: 3280,
    },

    // ── Level 3: Frozen Mountain ─────────────────────────────────
    {
      name: 'Level 3 — Frozen Mountain',
      theme: 'ice',
      bgColors: ['#c8e8f8','#e8f4ff'],
      worldWidth: 3600,
      platforms: [
        {x:0,   y:390, w:500,  h:60, color:'#8ec6e6', ice:true},
        {x:560, y:390, w:400,  h:60, color:'#8ec6e6', ice:true},
        {x:1020,y:390, w:450,  h:60, color:'#8ec6e6', ice:true},
        {x:1530,y:390, w:500,  h:60, color:'#8ec6e6', ice:true},
        {x:2090,y:390, w:600,  h:60, color:'#8ec6e6', ice:true},
        {x:2750,y:390, w:500,  h:60, color:'#8ec6e6', ice:true},
        {x:3310,y:390, w:290,  h:60, color:'#8ec6e6', ice:true},
        // Steps up the mountain
        {x:200, y:330, w:100, h:20, color:'#a0d8ef', ice:true},
        {x:360, y:280, w:100, h:20, color:'#a0d8ef', ice:true},
        {x:620, y:300, w:120, h:20, color:'#a0d8ef', ice:true},
        {x:800, y:250, w:100, h:20, color:'#a0d8ef', ice:true},
        {x:1080,y:310, w:120, h:20, color:'#a0d8ef', ice:true},
        {x:1280,y:260, w:100, h:20, color:'#a0d8ef', ice:true},
        {x:1600,y:300, w:120, h:20, color:'#a0d8ef', ice:true},
        {x:1800,y:240, w:120, h:20, color:'#a0d8ef', ice:true},
        {x:2000,y:190, w:100, h:20, color:'#a0d8ef', ice:true},
        {x:2200,y:300, w:120, h:20, color:'#a0d8ef', ice:true},
        {x:2400,y:250, w:100, h:20, color:'#a0d8ef', ice:true},
        {x:2600,y:310, w:120, h:20, color:'#a0d8ef', ice:true},
        {x:2850,y:260, w:120, h:20, color:'#a0d8ef', ice:true},
        {x:3060,y:300, w:100, h:20, color:'#a0d8ef', ice:true},
        {x:3200,y:240, w:100, h:20, color:'#a0d8ef', ice:true},
      ],
      enemies: [
        {x:250,  type:'snowman'},{x:700, type:'snowman'},{x:1100, type:'snowman'},
        {x:1450, type:'bat'},   {x:1700,type:'snowman'},{x:2050, type:'snowman'},
        {x:2350, type:'bat'},   {x:2700,type:'snowman'},{x:3000, type:'snowman'},
      ],
      coins: coinLine(80,370,5).concat(coinLine(620,370,5)).concat(coinLine(1100,370,6))
             .concat(coinLine(1600,370,5)).concat(coinLine(2200,370,7)).concat(coinLine(2850,370,5)),
      powerUps: [{x:360,y:250,type:'heart'},{x:1280,y:230,type:'shield'},{x:2400,y:220,type:'star'},{x:3060,y:270,type:'fire'}],
      checkpoints: [1600, 2600],
      flagX: 3480,
    },

    // ── Level 4: Lava Cave ───────────────────────────────────────
    {
      name: 'Level 4 — Lava Cave',
      theme: 'lava',
      bgColors: ['#1a0a00','#3a1500'],
      worldWidth: 3800,
      platforms: [
        {x:0,   y:390, w:500,  h:60, color:'#5a2a00'},
        {x:560, y:390, w:400,  h:60, color:'#5a2a00'},
        {x:1020,y:390, w:400,  h:60, color:'#5a2a00'},
        {x:1490,y:390, w:500,  h:60, color:'#5a2a00'},
        {x:2050,y:390, w:500,  h:60, color:'#5a2a00'},
        {x:2620,y:390, w:600,  h:60, color:'#5a2a00'},
        {x:3290,y:390, w:510,  h:60, color:'#5a2a00'},
        // Floating
        {x:150, y:320, w:100, h:20, color:'#8b3a00'},
        {x:350, y:270, w:100, h:20, color:'#8b3a00'},
        {x:620, y:300, w:120, h:20, color:'#8b3a00'},
        {x:850, y:250, w:100, h:20, color:'#8b3a00'},
        {x:1100,y:300, w:120, h:20, color:'#8b3a00'},
        {x:1350,y:260, w:100, h:20, color:'#8b3a00'},
        {x:1560,y:310, w:120, h:20, color:'#8b3a00'},
        {x:1800,y:250, w:100, h:20, color:'#8b3a00'},
        {x:2000,y:200, w:100, h:20, color:'#8b3a00'},
        {x:2160,y:300, w:120, h:20, color:'#8b3a00'},
        {x:2380,y:250, w:100, h:20, color:'#8b3a00'},
        {x:2680,y:310, w:120, h:20, color:'#8b3a00'},
        {x:2900,y:260, w:100, h:20, color:'#8b3a00'},
        {x:3100,y:300, w:120, h:20, color:'#8b3a00'},
        {x:3350,y:250, w:100, h:20, color:'#8b3a00'},
      ],
      enemies: [
        {x:200,  type:'lavaSlime'},{x:600, type:'lavaSlime'},{x:900, type:'bat'},
        {x:1150, type:'lavaSlime'},{x:1400,type:'bat'},     {x:1650,type:'lavaSlime'},
        {x:1900, type:'bat'},     {x:2200,type:'lavaSlime'},{x:2500,type:'bat'},
        {x:2700, type:'lavaSlime'},{x:3000,type:'lavaSlime'},{x:3300,type:'bat'},
      ],
      hazards: lavaHazards(),
      coins: coinLine(100,370,5).concat(coinLine(620,370,4)).concat(coinLine(1100,370,5))
             .concat(coinLine(1600,370,4)).concat(coinLine(2200,370,5)).concat(coinLine(2800,370,5)),
      powerUps: [{x:350,y:240,type:'heart'},{x:1350,y:230,type:'fire'},{x:2380,y:220,type:'heart'},{x:3100,y:270,type:'shield'}],
      checkpoints: [1700, 2700],
      flagX: 3700,
    },

    // ── Level 5: Shadow Castle ───────────────────────────────────
    {
      name: 'Level 5 — Shadow Castle',
      theme: 'castle',
      bgColors: ['#0d0020','#1a003a'],
      worldWidth: 3600,
      platforms: [
        {x:0,   y:390, w:450,  h:60, color:'#333'},
        {x:510, y:390, w:400,  h:60, color:'#333'},
        {x:970, y:390, w:450,  h:60, color:'#333'},
        {x:1480,y:390, w:500,  h:60, color:'#333'},
        {x:2040,y:390, w:500,  h:60, color:'#333'},
        {x:2600,y:390, w:600,  h:60, color:'#333'},
        {x:3260,y:390, w:340,  h:60, color:'#333'},
        // Battlements
        {x:150, y:310, w:100, h:20, color:'#555'},
        {x:350, y:260, w:100, h:20, color:'#555'},
        {x:580, y:290, w:120, h:20, color:'#555'},
        {x:800, y:250, w:100, h:20, color:'#555'},
        {x:1050,y:300, w:120, h:20, color:'#555'},
        {x:1260,y:250, w:100, h:20, color:'#555'},
        {x:1550,y:300, w:120, h:20, color:'#555'},
        {x:1760,y:240, w:120, h:20, color:'#555'},
        {x:1960,y:180, w:100, h:20, color:'#555'},
        {x:2150,y:300, w:120, h:20, color:'#555'},
        {x:2360,y:250, w:100, h:20, color:'#555'},
        {x:2660,y:310, w:120, h:20, color:'#555'},
        {x:2880,y:260, w:100, h:20, color:'#555'},
        {x:3080,y:300, w:120, h:20, color:'#555'},
        {x:3280,y:240, w:100, h:20, color:'#555'},
      ],
      enemies: [
        {x:200,  type:'shadowKnight'},{x:600, type:'shadowKnight'},{x:900, type:'bat'},
        {x:1150, type:'shadowKnight'},{x:1400,type:'bat'},         {x:1700,type:'shadowKnight'},
        {x:2000, type:'bat'},         {x:2250,type:'shadowKnight'},{x:2550,type:'bat'},
        {x:2800, type:'shadowKnight'},{x:3100,type:'shadowKnight'},
      ],
      boss: { x:3420, hp:8, maxHp:8 },
      coins: coinLine(80,370,5).concat(coinLine(560,370,4)).concat(coinLine(1050,370,5))
             .concat(coinLine(1550,370,4)).concat(coinLine(2100,370,5)).concat(coinLine(2700,370,5)),
      powerUps: [{x:350,y:230,type:'heart'},{x:1260,y:220,type:'fire'},{x:2360,y:220,type:'heart'},{x:3080,y:270,type:'shield'}],
      checkpoints: [1700, 2700],
      flagX: null,   // no flag — boss instead
    },
  ];
}

function coinLine(startX, y, count) {
  const arr = [];
  for (let i=0; i<count; i++) arr.push({x: startX + i*38, y});
  return arr;
}

function lavaHazards() {
  const h = [];
  for (const lx of [510,990,1430,1990,2560]) {
    h.push({x:lx, y:400, w:50, h:10, color:'#ff4500', type:'lava'});
  }
  return h;
}

// ═══════════════════════════════════════════════════════════════════
// GAME STATE
// ═══════════════════════════════════════════════════════════════════
let state     = 'menu';   // menu | playing | paused | levelComplete | gameOver | win
let score     = 0;
let lives     = 3;
let totalCoins= 0;
let currentLevelIndex = 0;
let unlockedLevels    = 1;
let menuSelection     = 0;  // 0=Start 1=LevelSelect 2=Settings
let levelSelectIndex  = 0;

const LEVELS = makeLevels();

// ── Player ───────────────────────────────────────────────────────
const player = {
  x:80, y:300, w:32, h:40,
  vx:0, vy:0,
  onGround:false,
  facing:1,        // 1=right, -1=left
  hp:3, maxHp:3,
  coins:0,
  invincible:0,     // frames of invincibility
  powerUp:null,     // 'fire'|'star'|'shield'|'speed'
  powerTimer:0,
  attackCooldown:0,
  jumpBuf:0,        // coyote time / jump buffer
  dead:false,
  checkpointX:80,
  anim:0, animTimer:0,
};

// ── Level runtime objects ────────────────────────────────────────
let platforms  = [];
let enemies    = [];
let coins      = [];
let powerUps   = [];
let hazards    = [];
let projectiles= [];
let boss       = null;
let flagX      = 0;
let worldWidth = 3200;
let camera     = { x:0 };
let checkpoints= [];

// ── Camera shaking ───────────────────────────────────────────────
let shakeFrames = 0, shakeAmp = 0;
function shakeCamera(frames=10, amp=5) { shakeFrames=frames; shakeAmp=amp; }

// ── Screen flash ─────────────────────────────────────────────────
let flashColor='', flashAlpha=0;
function flashScreen(color='#fff', alpha=0.4) { flashColor=color; flashAlpha=alpha; }

// ── Stars background (menu & castle) ────────────────────────────
const stars = Array.from({length:80}, ()=>({
  x:rand(0,BASE_W), y:rand(0,BASE_H), r:rand(0.5,2), blink:rand(0,Math.PI*2)
}));

// ─────────────────────────────────────────────────────────────────
// LEVEL LOADING
// ─────────────────────────────────────────────────────────────────
function loadLevel(idx) {
  const def = LEVELS[idx];
  worldWidth = def.worldWidth;
  flagX      = def.flagX ?? 0;
  checkpoints= def.checkpoints ?? [];

  // Reset player
  player.x=80; player.y=300; player.vx=0; player.vy=0;
  player.onGround=false; player.dead=false; player.facing=1;
  player.powerUp=null; player.powerTimer=0; player.attackCooldown=0;
  player.checkpointX=80;
  if (lives > 0 && state!=='gameOver') { /* keep hp */ } else { player.hp = player.maxHp; }

  particles.length=0; floaters.length=0; projectiles.length=0;
  camera.x=0;

  // Platforms
  platforms = def.platforms.map(p => ({
    ...p,
    ox: p.x,          // original x for moving
    dir: 1,
  }));

  // Enemies
  enemies = def.enemies.map(e => ({
    x: e.x, y: 0,     // y set on first tick
    w: 36, h: 36,
    vx: e.type==='bat'?0:-1.2, vy:0,
    type: e.type,
    hp: e.type==='shadowKnight' ? 3 : e.type==='lavaSlime' ? 2 : 1,
    maxHp: e.type==='shadowKnight' ? 3 : e.type==='lavaSlime' ? 2 : 1,
    onGround: false,
    facing: -1,
    anim:0, animTimer:0,
    batAmplitude: rand(20,50), batSpeed: rand(0.04, 0.08),
    batBaseY: rand(150, 300),
    stunTimer: 0,
    dead: false,
  }));

  // Coins
  coins = def.coins.map(c => ({
    x:c.x, y:c.y, w:18, h:18, collected:false, anim:0
  }));

  // Power-ups
  powerUps = (def.powerUps||[]).map(p => ({
    x:p.x, y:p.y, w:24, h:24, type:p.type, collected:false, anim:0
  }));

  // Hazards (lava, etc.)
  hazards = (def.hazards||[]).map(h => ({...h, anim:0}));

  // Boss
  boss = null;
  if (def.boss) {
    boss = {
      x: def.boss.x, y: 200,
      w:80, h:90,
      vx:-2, vy:0,
      hp: def.boss.hp, maxHp: def.boss.maxHp,
      phase:1, attackTimer:0, anim:0,
      onGround:false, stunTimer:0, dead:false, deathAnim:0,
    };
  }
}

// ─────────────────────────────────────────────────────────────────
// PHYSICS & COLLISION
// ─────────────────────────────────────────────────────────────────
const GRAVITY  = 0.55;
const JUMP_VEL = -13;
const SPEED    = 4.2;
const ICE_FRIC = 0.97;
const NRM_FRIC = 0.80;

function applyPhysicsToEntity(ent, isPlayer=false) {
  ent.vy += GRAVITY;
  ent.vy  = Math.min(ent.vy, 18);

  ent.x  += ent.vx;
  ent.y  += ent.vy;
  ent.onGround = false;

  const level = LEVELS[currentLevelIndex];

  for (const plat of platforms) {
    const pw = plat.w, ph = plat.h;
    const ew = ent.w,  eh = ent.h;

    if (ent.x + ew > plat.x && ent.x < plat.x+pw) {
      // Vertical
      if (ent.vy > 0 && ent.y + eh <= plat.y + 10 && ent.y + eh + ent.vy >= plat.y) {
        ent.y = plat.y - eh;
        ent.vy = 0;
        ent.onGround = true;
        if (plat.ice) {
          ent.vx *= ICE_FRIC;
        }
      } else if (ent.vy < 0 && ent.y >= plat.y + ph - 10 && ent.y + ent.vy <= plat.y+ph) {
        ent.y = plat.y + ph;
        ent.vy = 0;
      }
    }
    if (ent.y + eh > plat.y && ent.y < plat.y+ph) {
      // Horizontal wall
      if (ent.vx > 0 && ent.x + ew <= plat.x + 10 && ent.x + ew + ent.vx >= plat.x) {
        ent.x = plat.x - ew; ent.vx = 0;
      } else if (ent.vx < 0 && ent.x >= plat.x+pw-10 && ent.x+ent.vx <= plat.x+pw) {
        ent.x = plat.x+pw; ent.vx = 0;
      }
    }
  }

  // World bounds
  if (ent.x < 0) { ent.x=0; ent.vx=0; }
  if (ent.x + ent.w > worldWidth) { ent.x=worldWidth-ent.w; ent.vx=0; }
}

// ─────────────────────────────────────────────────────────────────
// PLAYER UPDATE
// ─────────────────────────────────────────────────────────────────
let jumpPressed = false;

function updatePlayer(dt) {
  if (player.dead) return;

  const lvl     = LEVELS[currentLevelIndex];
  const isSpeed = player.powerUp === 'speed';
  const spd     = SPEED * (isSpeed ? 1.6 : 1);

  // Horizontal input
  if (keys.left)  { player.vx = -spd; player.facing = -1; }
  else if (keys.right) { player.vx = spd; player.facing = 1; }
  else {
    if (!lvl.platforms.find(p=>p.ice && rectOverlap(player, {x:p.x,y:p.y,w:p.w,h:p.h})))
      player.vx *= NRM_FRIC;
  }

  // Jump buffer
  if (keys.up && !jumpPressed) {
    player.jumpBuf = 8;
    jumpPressed = true;
  }
  if (!keys.up) jumpPressed = false;

  // Track ground state to play land sound exactly once
  const wasOnGround = player.onGround;

  if (player.jumpBuf > 0) {
    if (player.onGround) {
      player.vy = JUMP_VEL;
      player.onGround = false;
      player.jumpBuf = 0;
      SFX.jump();
      spawnParticles(player.x+player.w/2, player.y+player.h, '#fff', 6, 2);
    } else {
      player.jumpBuf--;
    }
  }

  // Attack
  if (keys.attack && player.attackCooldown===0) {
    player.attackCooldown = 20;
    if (player.powerUp==='fire') {
      projectiles.push({
        x: player.x + (player.facing===1 ? player.w : -10),
        y: player.y + player.h/2 - 5,
        w:12, h:12, vx: player.facing * 8, vy:-1,
        type:'fireball', life:80, owner:'player'
      });
      SFX.fireball();
    }
  }
  if (player.attackCooldown>0) player.attackCooldown--;

  // Physics
  applyPhysicsToEntity(player, true);

  // Land sound — fires once on touchdown
  if (!wasOnGround && player.onGround) {
    SFX.land();
  }

  // Invincibility
  if (player.invincible>0) player.invincible--;

  // Power-up timer
  if (player.powerTimer>0) {
    player.powerTimer--;
    if (player.powerTimer===0) player.powerUp=null;
  }

  // Animation
  player.animTimer++;
  if (player.animTimer > 6) { player.anim = (player.anim+1)%4; player.animTimer=0; }

  // Fall into pit
  if (player.y > BASE_H + 100) {
    playerDie(true);
  }

  // Checkpoint
  checkpoints.forEach(cpX => {
    if (player.x > cpX - 20 && player.checkpointX < cpX - 20) {
      player.checkpointX = cpX;
      SFX.checkpoint();
      spawnFloater(player.x+16, player.y-20, 'CHECKPOINT!', '#00ff88');
      spawnParticles(cpX, 360, '#00ff88', 12, 4);
    }
  });

  // Reach flag
  if (flagX && player.x + player.w >= flagX) {
    levelComplete();
  }

  // Camera
  let targetX = player.x - BASE_W/2 + player.w/2;
  targetX = Math.max(0, Math.min(targetX, worldWidth - BASE_W));
  camera.x += (targetX - camera.x) * 0.1;
}

function playerDie(pitFall=false) {
  if (player.invincible > 0 && !pitFall) return;
  if (player.powerUp==='shield') {
    player.powerUp = null;
    player.invincible = 90;
    SFX.shield();
    flashScreen('#88ccff', 0.5);
    spawnParticles(player.x+16, player.y+20, '#88ccff', 10, 4);
    return;
  }
  player.hp--;
  player.invincible = 90;
  SFX.playerHit();
  flashScreen('#ff4444', 0.5);
  shakeCamera(15, 6);
  spawnParticles(player.x+16, player.y+20, '#ff4444', 12, 4);

  if (player.hp <= 0) {
    player.dead = true;
    player.hp = 0;
    lives--;
    spawnParticles(player.x+16, player.y+20, '#ff0000', 20, 6);
    setTimeout(() => {
      if (lives <= 0) {
        SFX.gameOver();
        state = 'gameOver';
      } else {
        // Respawn at checkpoint
        player.hp = player.maxHp;
        player.x = player.checkpointX;
        player.y = 300; player.vx=0; player.vy=0;
        player.dead=false; player.invincible=90;
        flashScreen('#fff', 0.6);
      }
    }, 800);
  }
}

// ─────────────────────────────────────────────────────────────────
// ENEMIES UPDATE
// ─────────────────────────────────────────────────────────────────
function updateEnemies() {
  const lvl = LEVELS[currentLevelIndex];

  for (let i=enemies.length-1; i>=0; i--) {
    const e = enemies[i];
    if (e.dead) {
      e.deathAnim = (e.deathAnim||0) + 1;
      if (e.deathAnim > 30) enemies.splice(i,1);
      continue;
    }

    e.animTimer = (e.animTimer||0)+1;
    if (e.animTimer>8) { e.anim=(e.anim+1)%2; e.animTimer=0; }

    if (e.stunTimer>0) { e.stunTimer--; continue; }

    // Movement per type
    if (e.type==='bat') {
      e.x += Math.cos(e.anim * 0.4 + Date.now()*e.batSpeed*0.01) * 1.5;
      e.y = e.batBaseY + Math.sin(Date.now()*e.batSpeed*0.01)*e.batAmplitude;
      // Adjust batBaseY if not set yet
      if (!e._batInit) { e.batBaseY=e.y; e._batInit=true; }
    } else {
      // Walk AI
      e.vx = (e.facing || -1) * (e.type==='shadowKnight' ? 1.8 : e.type==='lavaSlime' ? 1.0 : 1.3);
      applyPhysicsToEntity(e);
      // Reverse at edges or walls
      if (e.onGround) {
        // Check ledge
        const aheadX = e.vx>0 ? e.x+e.w+2 : e.x-2;
        let overLedge = true;
        for (const p of platforms) {
          if (aheadX > p.x && aheadX < p.x+p.w && e.y+e.h+2 > p.y && e.y+e.h+2 < p.y+p.h+10) {
            overLedge = false; break;
          }
        }
        if (overLedge || e.vx===0) e.facing *= -1;
      }
    }

    // Hit player
    if (!player.dead && player.invincible===0 && rectOverlap(player, e)) {
      // Stomp?
      if (player.vy > 0.5 && player.y+player.h < e.y+e.h*0.6) {
        // Stomp enemy
        e.hp--;
        player.vy = -8;
        SFX.stomp();
        spawnParticles(e.x+e.w/2, e.y, '#ffcc00', 8, 3);
        score += 100;
        spawnFloater(e.x+e.w/2, e.y-10, '+100');
        if (e.hp<=0) killEnemy(e, i);
      } else if (e.type==='shadowKnight' && player.powerUp==='fire') {
        e.hp--;
        player.vy = -4;
        spawnParticles(e.x+e.w/2, e.y, '#ff6600', 8, 3);
        if (e.hp<=0) killEnemy(e, i);
      } else {
        playerDie();
      }
    }
  }
}

function killEnemy(e, i) {
  e.dead = true;
  e.deathAnim=0;
  score += e.type==='shadowKnight' ? 300 : 150;
  spawnFloater(e.x+e.w/2, e.y-10, '+' + (e.type==='shadowKnight'?300:150));
  spawnParticles(e.x+e.w/2, e.y+e.h/2, '#ff8800', 10, 4);
  SFX.enemyDie();
}

// ─────────────────────────────────────────────────────────────────
// BOSS UPDATE
// ─────────────────────────────────────────────────────────────────
function updateBoss() {
  if (!boss || boss.dead) return;

  boss.anim++;
  boss.vy += GRAVITY;
  boss.y  += boss.vy;
  boss.x  += boss.vx;
  boss.onGround=false;

  // Platform collision
  for (const p of platforms) {
    if (boss.x+boss.w>p.x && boss.x<p.x+p.w) {
      if (boss.vy>0 && boss.y+boss.h<=p.y+10 && boss.y+boss.h+boss.vy>=p.y) {
        boss.y=p.y-boss.h; boss.vy=0; boss.onGround=true;
      }
    }
  }

  // World bounds bounce
  if (boss.x < camera.x + 50) { boss.vx = Math.abs(boss.vx); }
  if (boss.x + boss.w > camera.x + BASE_W - 50) { boss.vx = -Math.abs(boss.vx); }

  // Attack: shoot projectile
  boss.attackTimer++;
  const attackInterval = boss.phase===2 ? 60 : 100;
  if (boss.attackTimer >= attackInterval) {
    boss.attackTimer=0;
    // Shoot toward player
    const dx = (player.x+16) - (boss.x+boss.w/2);
    const dy = (player.y+20) - (boss.y+boss.h/2);
    const len = Math.sqrt(dx*dx+dy*dy)||1;
    const spd = boss.phase===2 ? 5 : 3.5;
    projectiles.push({
      x: boss.x+boss.w/2-8, y: boss.y+boss.h/2-8,
      w:16, h:16,
      vx: (dx/len)*spd, vy: (dy/len)*spd,
      type:'shadowBolt', life:150, owner:'boss'
    });
    if (boss.phase===2 && boss.hp<=2) {
      // Triple shot
      projectiles.push({ x:boss.x+boss.w/2-8, y:boss.y+boss.h/2-8,
        w:16,h:16,vx:(dx/len)*spd+2,vy:(dy/len)*spd,type:'shadowBolt',life:150,owner:'boss'});
      projectiles.push({ x:boss.x+boss.w/2-8, y:boss.y+boss.h/2-8,
        w:16,h:16,vx:(dx/len)*spd-2,vy:(dy/len)*spd,type:'shadowBolt',life:150,owner:'boss'});
    }
  }

  // Phase 2 at half HP
  if (boss.hp <= Math.ceil(boss.maxHp/2)) boss.phase=2;

  // Hit player
  if (!player.dead && player.invincible===0 && rectOverlap(player, boss)) {
    // Player stomps boss?
    if (player.vy>0.5 && player.y+player.h < boss.y+boss.h*0.4) {
      damageBoss(2);
      player.vy=-10;
    } else {
      playerDie();
    }
  }

  // Boss death
  if (boss.hp<=0 && !boss.dead) {
    boss.dead=true;
    SFX.bossDie();
    shakeCamera(40, 10);
    flashScreen('#ffffff',0.8);
    spawnParticles(boss.x+boss.w/2, boss.y+boss.h/2, '#aa00ff', 30, 8);
    score += 2000;
    setTimeout(() => { state='win'; SFX.win(); }, 2000);
  }
}

function damageBoss(dmg=1) {
  if (!boss || boss.dead) return;
  boss.hp -= dmg;
  boss.hp = Math.max(0, boss.hp);
  shakeCamera(8, 4);
  flashScreen('#ff00ff', 0.3);
  spawnParticles(boss.x+boss.w/2, boss.y+boss.h/2, '#ff00ff', 10, 4);
  spawnFloater(boss.x+boss.w/2, boss.y-10, '-'+dmg+' HP', '#ff00ff');
  SFX.bossHit();
}

// ─────────────────────────────────────────────────────────────────
// PROJECTILES UPDATE
// ─────────────────────────────────────────────────────────────────
function updateProjectiles() {
  for (let i=projectiles.length-1; i>=0; i--) {
    const p = projectiles[i];
    p.x += p.vx; p.y += p.vy;
    if (p.type==='fireball') p.vy += 0.1;
    p.life--;

    // Hit platform
    let hitPlat = false;
    for (const plat of platforms) {
      if (rectOverlap(p, {x:plat.x,y:plat.y,w:plat.w,h:plat.h})) { hitPlat=true; break; }
    }
    if (hitPlat || p.life<=0) { spawnParticles(p.x,p.y,'#ff8800',5,2); projectiles.splice(i,1); continue; }

    // Fireball hits enemy
    if (p.owner==='player' && p.type==='fireball') {
      for (let j=enemies.length-1; j>=0; j--) {
        const e=enemies[j];
        if (!e.dead && rectOverlap(p,e)) {
          e.hp--; spawnParticles(e.x+e.w/2,e.y,'#ff6600',6,3);
          if (e.hp<=0) killEnemy(e,j);
          spawnParticles(p.x,p.y,'#ff8800',5,2); projectiles.splice(i,1); break;
        }
      }
      // Fireball hits boss
      if (i < projectiles.length && boss && !boss.dead && rectOverlap(p,boss)) {
        damageBoss(1); spawnParticles(p.x,p.y,'#ff8800',5,2); projectiles.splice(i,1); continue;
      }
    }

    // Shadow bolt hits player
    if (p.owner==='boss' && !player.dead && player.invincible===0 && rectOverlap(p,player)) {
      playerDie();
      spawnParticles(p.x,p.y,'#aa00ff',6,2); projectiles.splice(i,1);
    }
  }
}

// ─────────────────────────────────────────────────────────────────
// COINS & POWER-UPS
// ─────────────────────────────────────────────────────────────────
function updateCollectibles() {
  coins.forEach(c => {
    if (c.collected) return;
    c.anim = (c.anim||0)+0.1;
    if (rectOverlap(player, {x:c.x,y:c.y,w:c.w,h:c.h})) {
      c.collected=true;
      score+=10; totalCoins++; player.coins++;
      spawnParticles(c.x+9,c.y+9,'#FFD700',6,2);
      spawnFloater(c.x+9,c.y-5,'+10');
      SFX.coin();
    }
  });

  powerUps.forEach(p => {
    if (p.collected) return;
    p.anim=(p.anim||0)+0.05;
    if (rectOverlap(player,{x:p.x,y:p.y,w:p.w,h:p.h})) {
      p.collected=true;
      applyPowerUp(p.type);
    }
  });
}

function applyPowerUp(type) {
  flashScreen('#ffff44',0.3);
  spawnParticles(player.x+16,player.y+20,'#ffff00',12,4);
  SFX.powerUp();
  switch(type) {
    case 'heart':
      player.hp = Math.min(player.hp+1, player.maxHp);
      spawnFloater(player.x+16,player.y-10,'❤ +1 HP','#ff6688');
      break;
    case 'star':
      player.powerUp='speed'; player.powerTimer=300;
      spawnFloater(player.x+16,player.y-10,'⭐ SPEED!','#ffe000');
      break;
    case 'fire':
      player.powerUp='fire'; player.powerTimer=600;
      spawnFloater(player.x+16,player.y-10,'🔥 FIRE!','#ff8800');
      break;
    case 'shield':
      player.powerUp='shield'; player.powerTimer=400;
      spawnFloater(player.x+16,player.y-10,'🛡 SHIELD!','#88ccff');
      break;
  }
}

// ─────────────────────────────────────────────────────────────────
// HAZARDS (lava)
// ─────────────────────────────────────────────────────────────────
function updateHazards() {
  hazards.forEach(h => {
    h.anim=(h.anim||0)+0.1;
    if (!player.dead && player.invincible===0 && rectOverlap(player,{x:h.x,y:h.y,w:h.w,h:h.h})) {
      playerDie();
    }
  });
}

// ─────────────────────────────────────────────────────────────────
// MOVING PLATFORMS
// ─────────────────────────────────────────────────────────────────
function updateMovingPlatforms() {
  platforms.forEach(p => {
    if (!p.moving) return;
    p.x += p.dir * (p.moveSpeed||1);
    if (p.x > p.ox + p.moveRange) p.dir=-1;
    if (p.x < p.ox - p.moveRange) p.dir= 1;
    // Carry player
    if (player.onGround && player.y+player.h > p.y-2 && player.y+player.h < p.y+4
        && player.x+player.w > p.x && player.x < p.x+p.w) {
      player.x += p.dir * (p.moveSpeed||1);
    }
  });
}

// ─────────────────────────────────────────────────────────────────
// GAME FLOW
// ─────────────────────────────────────────────────────────────────
function levelComplete() {
  state='levelComplete';
  score += 500 + player.coins*5;
  spawnParticles(player.x+16,player.y,'#FFD700',20,6);
  flashScreen('#FFD700',0.5);
  SFX.levelComplete();
  if (currentLevelIndex+1 >= unlockedLevels && currentLevelIndex+1 < LEVELS.length) {
    unlockedLevels = currentLevelIndex+2;
  }
}

function startLevel(idx) {
  currentLevelIndex = idx;
  loadLevel(idx);
  player.hp = player.maxHp;
  state='playing';
}

function togglePause() {
  if (state==='playing') state='paused';
  else if (state==='paused') state='playing';
}

// ─────────────────────────────────────────────────────────────────
// DRAWING — BACKGROUNDS
// ─────────────────────────────────────────────────────────────────
function drawBackground() {
  const lvl = LEVELS[currentLevelIndex];
  const colors = lvl.bgColors;
  const grad = ctx.createLinearGradient(0,0,0,BASE_H);
  grad.addColorStop(0, colors[0]);
  grad.addColorStop(1, colors[1]);
  ctx.fillStyle = grad;
  ctx.fillRect(0,0,BASE_W,BASE_H);

  // Theme-specific decorations
  switch(lvl.theme) {
    case 'green':  drawGreenHills(); break;
    case 'forest': drawForest();     break;
    case 'ice':    drawIce();        break;
    case 'lava':   drawLavaCave();   break;
    case 'castle': drawCastle();     break;
  }
}

function drawGreenHills() {
  ctx.fillStyle='#5ab536';
  // Scrolling hills
  [0,400,800,1200].forEach(ox => {
    const bx = ((ox - camera.x*0.3) % (BASE_W+200)) - 100;
    ctx.beginPath(); ctx.arc(bx,390,120,Math.PI,0); ctx.fill();
    ctx.beginPath(); ctx.arc(bx+200,400,90,Math.PI,0); ctx.fill();
  });
  // Clouds
  ctx.fillStyle='rgba(255,255,255,0.85)';
  [[100,60],[300,40],[550,70],[750,45],[1000,60]].forEach(([ox,oy])=>{
    const cx=((ox-camera.x*0.15)%BASE_W+BASE_W)%BASE_W;
    ctx.beginPath(); ctx.arc(cx,oy,30,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx+28,oy+5,22,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx-20,oy+5,18,0,Math.PI*2); ctx.fill();
  });
}

function drawForest() {
  // Dark trees
  ctx.fillStyle='#1a3a1a';
  [50,200,380,520,700,850,1000].forEach(ox=>{
    const tx=((ox-camera.x*0.2)%(BASE_W+100)+BASE_W+100)%BASE_W-50;
    // Trunk
    ctx.fillStyle='#3a2010'; ctx.fillRect(tx+18,300,14,120);
    // Canopy
    ctx.fillStyle='#1a3a1a';
    ctx.beginPath(); ctx.moveTo(tx,350); ctx.lineTo(tx+25,200); ctx.lineTo(tx+50,350); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(tx+5,310); ctx.lineTo(tx+25,180); ctx.lineTo(tx+45,310); ctx.closePath(); ctx.fill();
    // Glowing eyes effect
    ctx.fillStyle='rgba(0,255,0,0.2)';
    ctx.beginPath(); ctx.arc(tx+14,290,4,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(tx+36,295,4,0,Math.PI*2); ctx.fill();
  });
}

function drawIce() {
  // Snow-capped mountains
  ctx.fillStyle='rgba(200,230,255,0.4)';
  [80,280,520,760,980].forEach(ox=>{
    const mx=((ox-camera.x*0.2)%(BASE_W+200)+BASE_W+200)%BASE_W-100;
    ctx.beginPath(); ctx.moveTo(mx,390); ctx.lineTo(mx+80,200); ctx.lineTo(mx+160,390); ctx.closePath(); ctx.fill();
  });
  // Snow particles
  ctx.fillStyle='rgba(255,255,255,0.6)';
  stars.forEach(s=>{
    const sx=((s.x-camera.x*0.05+Date.now()*0.02)%BASE_W+BASE_W)%BASE_W;
    const sy=(s.y+Date.now()*0.03)%BASE_H;
    ctx.beginPath(); ctx.arc(sx,sy,s.r,0,Math.PI*2); ctx.fill();
  });
}

function drawLavaCave() {
  // Cave stalactites
  ctx.fillStyle='#3a1500';
  [80,200,380,520,700,850].forEach(ox=>{
    const cx=((ox-camera.x*0.1)%(BASE_W+100)+BASE_W+100)%BASE_W-50;
    ctx.beginPath(); ctx.moveTo(cx,0); ctx.lineTo(cx+20,60+Math.sin(ox)*20); ctx.lineTo(cx+40,0); ctx.closePath(); ctx.fill();
  });
  // Lava glow at bottom
  const lavaGrad=ctx.createLinearGradient(0,380,0,BASE_H);
  lavaGrad.addColorStop(0,'rgba(255,80,0,0)');
  lavaGrad.addColorStop(1,'rgba(255,80,0,0.4)');
  ctx.fillStyle=lavaGrad; ctx.fillRect(0,380,BASE_W,BASE_H-380);
  // Lava bubbles
  const t=Date.now()*0.001;
  ctx.fillStyle='rgba(255,120,0,0.7)';
  [100,250,400,600,750].forEach((bx,i)=>{
    const by=BASE_H-10+Math.sin(t*2+i)*5;
    ctx.beginPath(); ctx.arc(bx,by,6,0,Math.PI*2); ctx.fill();
  });
}

function drawCastle() {
  // Stars in background
  const t=Date.now()*0.001;
  ctx.fillStyle='rgba(200,150,255,0.6)';
  stars.forEach((s,i)=>{
    const blink=0.5+0.5*Math.sin(t*2+s.blink);
    ctx.globalAlpha=blink*0.6;
    ctx.beginPath(); ctx.arc(s.x,s.y,s.r,0,Math.PI*2); ctx.fill();
  });
  ctx.globalAlpha=1;
  // Castle silhouette in distance
  ctx.fillStyle='rgba(30,0,60,0.6)';
  const castleX=((2000-camera.x*0.15)%BASE_W+BASE_W)%BASE_W-100;
  // Main tower
  ctx.fillRect(castleX+50,150,60,250);
  ctx.fillRect(castleX,200,160,200);
  // Battlements
  [castleX,castleX+20,castleX+40,castleX+80,castleX+100,castleX+120,castleX+140].forEach(bx=>{
    ctx.fillRect(bx,190,15,20);
  });
  // Side towers
  ctx.fillRect(castleX-20,170,40,230);
  ctx.fillRect(castleX+140,170,40,230);
}

// ─────────────────────────────────────────────────────────────────
// DRAWING — PLATFORMS
// ─────────────────────────────────────────────────────────────────
function drawPlatforms() {
  const lvl=LEVELS[currentLevelIndex];
  platforms.forEach(p => {
    const sx=p.x-camera.x, sy=p.y;
    if (sx+p.w<0||sx>BASE_W) return;

    // Base fill
    ctx.fillStyle=p.color;
    ctx.fillRect(sx,sy,p.w,p.h);

    // Top edge highlight
    if (p.ice) {
      ctx.fillStyle='rgba(200,240,255,0.7)';
      ctx.fillRect(sx,sy,p.w,5);
      // Ice shine
      ctx.fillStyle='rgba(255,255,255,0.3)';
      ctx.fillRect(sx+p.w*0.1,sy+2,p.w*0.2,3);
    } else {
      // Grass top or stone top
      ctx.fillStyle= lvl.theme==='castle' ? '#666' :
                     lvl.theme==='lava'   ? '#aa5500' :
                     lvl.theme==='forest' ? '#4a7a3a' :
                     '#5ab536';
      ctx.fillRect(sx,sy,p.w, Math.min(8, p.h));
    }

    // Moving platform glow
    if (p.moving) {
      ctx.strokeStyle='rgba(100,255,100,0.4)';
      ctx.lineWidth=2;
      ctx.strokeRect(sx,sy,p.w,p.h);
    }
  });
}

// ─────────────────────────────────────────────────────────────────
// DRAWING — FLAG
// ─────────────────────────────────────────────────────────────────
function drawFlag() {
  if (!flagX) return;
  const fx=flagX-camera.x;
  if (fx<-20||fx>BASE_W+20) return;
  ctx.fillStyle='#888';
  ctx.fillRect(fx,280,6,120);
  // Waving flag
  ctx.fillStyle='#ff4444';
  const wave=Math.sin(Date.now()*0.006)*6;
  ctx.beginPath();
  ctx.moveTo(fx+6,280);
  ctx.lineTo(fx+6+40+wave,290);
  ctx.lineTo(fx+6+38+wave,320);
  ctx.lineTo(fx+6,330);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle='#cc0000';
  ctx.fillText('🏁', fx-6, 278);
}

// ─────────────────────────────────────────────────────────────────
// DRAWING — HAZARDS
// ─────────────────────────────────────────────────────────────────
function drawHazards() {
  hazards.forEach(h => {
    const sx=h.x-camera.x;
    if (sx+h.w<0||sx>BASE_W) return;
    const t=Date.now()*0.003;
    // Animated lava
    ctx.fillStyle=`hsl(${15+Math.sin(t+h.x)*10}, 100%, ${40+Math.sin(t+h.x*0.1)*10}%)`;
    ctx.fillRect(sx,h.y,h.w,h.h);
    ctx.fillStyle='rgba(255,200,0,0.5)';
    ctx.fillRect(sx,h.y,h.w,3);
  });
}

// ─────────────────────────────────────────────────────────────────
// DRAWING — COINS
// ─────────────────────────────────────────────────────────────────
function drawCoins() {
  coins.forEach(c => {
    if (c.collected) return;
    const sx=c.x-camera.x, sy=c.y;
    if (sx+c.w<0||sx>BASE_W) return;
    const scale=0.8+0.2*Math.sin((c.anim||0));
    const cx=sx+c.w/2, cy=sy+c.h/2;
    ctx.save(); ctx.translate(cx,cy); ctx.scale(scale,1);
    ctx.fillStyle='#FFD700';
    ctx.strokeStyle='#B8860B'; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.arc(0,0,c.h/2,0,Math.PI*2);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle='#FFF8DC';
    ctx.beginPath(); ctx.arc(-2,-2,3,0,Math.PI*2); ctx.fill();
    ctx.restore();
  });
}

// ─────────────────────────────────────────────────────────────────
// DRAWING — POWER-UPS
// ─────────────────────────────────────────────────────────────────
const POWERUP_COLORS = { heart:'#ff6688', star:'#ffe000', fire:'#ff6600', shield:'#88ccff' };
const POWERUP_EMOJI  = { heart:'❤', star:'⭐', fire:'🔥', shield:'🛡' };

function drawPowerUps() {
  powerUps.forEach(p => {
    if (p.collected) return;
    const sx=p.x-camera.x, sy=p.y;
    if (sx+p.w<0||sx>BASE_W) return;
    const bob=Math.sin((p.anim||0)*2)*5;
    ctx.save();
    ctx.shadowColor=POWERUP_COLORS[p.type]||'#fff';
    ctx.shadowBlur=12;
    ctx.fillStyle=POWERUP_COLORS[p.type]||'#fff';
    roundRect(ctx, sx, sy+bob, p.w, p.h, 6);
    ctx.fill();
    ctx.shadowBlur=0;
    ctx.font='14px serif';
    ctx.textAlign='center';
    ctx.fillText(POWERUP_EMOJI[p.type]||'?', sx+p.w/2, sy+p.h-3+bob);
    ctx.restore();
  });
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y);
  ctx.arcTo(x+w,y,x+w,y+r,r); ctx.lineTo(x+w,y+h-r);
  ctx.arcTo(x+w,y+h,x+w-r,y+h,r); ctx.lineTo(x+r,y+h);
  ctx.arcTo(x,y+h,x,y+h-r,r); ctx.lineTo(x,y+r);
  ctx.arcTo(x,y,x+r,y,r); ctx.closePath();
}

// ─────────────────────────────────────────────────────────────────
// DRAWING — ENEMIES
// ─────────────────────────────────────────────────────────────────
function drawEnemies() {
  enemies.forEach(e => {
    const sx=e.x-camera.x;
    if (sx+e.w<0||sx>BASE_W) return;
    if (e.dead) {
      ctx.globalAlpha=Math.max(0,1-(e.deathAnim||0)/30);
      ctx.fillStyle='#ff4400';
      ctx.beginPath(); ctx.arc(sx+e.w/2,e.y+e.h/2,e.w/2*(1-(e.deathAnim||0)/30),0,Math.PI*2); ctx.fill();
      ctx.globalAlpha=1;
      return;
    }
    switch(e.type) {
      case 'goomba':   drawGoomba(sx,e.y,e.anim,e.facing); break;
      case 'bat':      drawBat(sx,e.y,e.anim);             break;
      case 'snowman':  drawSnowman(sx,e.y,e.anim,e.facing);break;
      case 'lavaSlime':drawLavaSlime(sx,e.y,e.anim);       break;
      case 'shadowKnight':drawShadowKnight(sx,e.y,e.anim,e.facing,e.hp,e.maxHp); break;
    }
    // HP bar for tough enemies
    if (e.maxHp>1&&!e.dead) {
      ctx.fillStyle='#333'; ctx.fillRect(sx,e.y-10,e.w,5);
      ctx.fillStyle='#f00'; ctx.fillRect(sx,e.y-10,e.w*(e.hp/e.maxHp),5);
    }
  });
}

function drawGoomba(x,y,anim,facing) {
  ctx.save(); if(facing>0){ctx.scale(-1,1);x=-x-36;}
  // Body
  ctx.fillStyle='#8B4513'; roundRect(ctx,x,y+12,36,24,8); ctx.fill();
  // Head
  ctx.fillStyle='#a0522d'; ctx.beginPath(); ctx.arc(x+18,y+12,15,0,Math.PI*2); ctx.fill();
  // Eyes
  ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(x+11,y+8,5,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(x+25,y+8,5,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#000'; ctx.beginPath(); ctx.arc(x+13,y+9,2.5,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(x+27,y+9,2.5,0,Math.PI*2); ctx.fill();
  // Feet
  const legOff=anim===0?2:-2;
  ctx.fillStyle='#5a2d0c';
  ctx.fillRect(x+5,y+34,12,8+legOff);
  ctx.fillRect(x+19,y+34,12,8-legOff);
  ctx.restore();
}

function drawBat(x,y,anim) {
  const wingFlap=anim===0?8:-8;
  ctx.fillStyle='#3a0060';
  // Left wing
  ctx.beginPath(); ctx.moveTo(x+18,y+14); ctx.quadraticCurveTo(x-10,y+wingFlap,x-2,y+24); ctx.closePath(); ctx.fill();
  // Right wing
  ctx.beginPath(); ctx.moveTo(x+18,y+14); ctx.quadraticCurveTo(x+46,y+wingFlap,x+38,y+24); ctx.closePath(); ctx.fill();
  // Body
  ctx.fillStyle='#5a0090'; ctx.beginPath(); ctx.arc(x+18,y+14,10,0,Math.PI*2); ctx.fill();
  // Eyes
  ctx.fillStyle='#ff0000'; ctx.beginPath(); ctx.arc(x+13,y+12,3,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(x+23,y+12,3,0,Math.PI*2); ctx.fill();
  // Fangs
  ctx.fillStyle='#fff'; ctx.fillRect(x+14,y+20,3,6); ctx.fillRect(x+19,y+20,3,6);
}

function drawSnowman(x,y,anim,facing) {
  ctx.save(); if(facing>0){ctx.scale(-1,1);x=-x-36;}
  // Bottom ball
  ctx.fillStyle='#e0f0ff'; ctx.beginPath(); ctx.arc(x+18,y+28,12,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle='#aad0ee'; ctx.lineWidth=1; ctx.stroke();
  // Top ball (head)
  ctx.fillStyle='#e8f8ff'; ctx.beginPath(); ctx.arc(x+18,y+12,10,0,Math.PI*2); ctx.fill();
  // Eyes
  ctx.fillStyle='#002244'; ctx.beginPath(); ctx.arc(x+14,y+10,2,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(x+22,y+10,2,0,Math.PI*2); ctx.fill();
  // Carrot nose
  ctx.fillStyle='#ff6600'; ctx.beginPath(); ctx.moveTo(x+9,y+13); ctx.lineTo(x+18,y+11); ctx.lineTo(x+9,y+15); ctx.closePath(); ctx.fill();
  // Buttons
  ctx.fillStyle='#001133'; [2,5,8].forEach(d=>{ ctx.beginPath(); ctx.arc(x+18,y+22+d*1.5,1.5,0,Math.PI*2); ctx.fill(); });
  // Arms
  const arm=anim===0?2:-2;
  ctx.strokeStyle='#664422'; ctx.lineWidth=2;
  ctx.beginPath(); ctx.moveTo(x+6,y+20+arm); ctx.lineTo(x-4,y+14); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x+30,y+20-arm); ctx.lineTo(x+40,y+14); ctx.stroke();
  ctx.restore();
}

function drawLavaSlime(x,y,anim) {
  const bounce=anim===0?3:0;
  ctx.fillStyle='#cc2200';
  ctx.beginPath();
  ctx.arc(x+18,y+18-bounce,16,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#ff4400';
  ctx.beginPath(); ctx.arc(x+12,y+10-bounce,7,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(x+24,y+10-bounce,7,0,Math.PI*2); ctx.fill();
  // Eyes
  ctx.fillStyle='#ff0'; ctx.beginPath(); ctx.arc(x+14,y+14-bounce,3,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(x+22,y+14-bounce,3,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#000'; ctx.beginPath(); ctx.arc(x+14,y+14-bounce,1.5,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(x+22,y+14-bounce,1.5,0,Math.PI*2); ctx.fill();
  // Drip
  ctx.fillStyle='#aa1100';
  ctx.beginPath(); ctx.arc(x+18,y+34+bounce,5,0,Math.PI*2); ctx.fill();
}

function drawShadowKnight(x,y,anim,facing,hp,maxHp) {
  ctx.save(); if(facing>0){ctx.scale(-1,1);x=-x-36;}
  const t=anim*0.3;
  // Cloak
  ctx.fillStyle='#1a004a';
  ctx.beginPath(); ctx.moveTo(x+4,y); ctx.lineTo(x+32,y); ctx.lineTo(x+38,y+36+Math.sin(t)*3); ctx.lineTo(x-2,y+36+Math.sin(t)*3); ctx.closePath(); ctx.fill();
  // Armour chest
  ctx.fillStyle='#2a0060'; roundRect(ctx,x+8,y+10,20,18,4); ctx.fill();
  ctx.strokeStyle='#6600aa'; ctx.lineWidth=1; ctx.stroke();
  // Head / helmet
  ctx.fillStyle='#1a004a'; ctx.beginPath(); ctx.arc(x+18,y+6,12,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#330066'; ctx.fillRect(x+6,y+3,24,8);  // visor bar
  // Glowing eyes
  ctx.fillStyle=hp<=1?'#ff0000':'#ff00ff';
  ctx.shadowColor=hp<=1?'#ff0000':'#aa00ff'; ctx.shadowBlur=6;
  ctx.beginPath(); ctx.arc(x+12,y+6,2.5,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(x+24,y+6,2.5,0,Math.PI*2); ctx.fill();
  ctx.shadowBlur=0;
  // Sword
  ctx.fillStyle='#888'; ctx.fillRect(x-6+Math.sin(t)*4,y+14,4,22);
  ctx.fillStyle='#aaa'; ctx.fillRect(x-12,y+18,16,4);
  ctx.restore();
}

// ─────────────────────────────────────────────────────────────────
// DRAWING — BOSS (Shadow King)
// ─────────────────────────────────────────────────────────────────
function drawBoss() {
  if (!boss) return;
  const sx=boss.x-camera.x;
  if (sx+boss.w<0||sx>BASE_W) return;
  if (boss.dead) {
    ctx.globalAlpha=Math.max(0,1-boss.deathAnim/60);
    boss.deathAnim=(boss.deathAnim||0)+1;
  }
  const t=boss.anim*0.04;
  const scale=boss.phase===2?1.15:1;
  ctx.save(); ctx.translate(sx+boss.w/2,boss.y+boss.h/2); ctx.scale(scale,scale);
  const bx=-boss.w/2, by=-boss.h/2;

  // Shadow aura
  ctx.shadowColor='#8800ff'; ctx.shadowBlur=30;
  // Robe
  ctx.fillStyle='#0d0030';
  ctx.beginPath();
  ctx.moveTo(bx,by+20); ctx.lineTo(bx+boss.w,by+20);
  ctx.lineTo(bx+boss.w+10,by+boss.h+15+Math.sin(t)*5);
  ctx.lineTo(bx-10,by+boss.h+15+Math.cos(t)*5);
  ctx.closePath(); ctx.fill();
  // Crown
  ctx.fillStyle='#660099';
  ctx.fillRect(bx+15,by-5,boss.w-30,12);
  [bx+15,bx+25,bx+35,bx+45,bx+55].forEach(px=>{ ctx.fillRect(px,by-20,8,18); });
  // Gemstone
  ctx.fillStyle=boss.phase===2?'#ff0088':'#aa00ff';
  ctx.shadowColor=ctx.fillStyle; ctx.shadowBlur=15;
  ctx.beginPath(); ctx.arc(bx+boss.w/2,by,8,0,Math.PI*2); ctx.fill();
  // Face
  ctx.shadowBlur=0;
  ctx.fillStyle='#1a0040'; ctx.beginPath(); ctx.arc(bx+boss.w/2,by+25,28,0,Math.PI*2); ctx.fill();
  // Eyes
  ctx.fillStyle=boss.phase===2?'#ff0000':'#ff00ff';
  ctx.shadowColor=ctx.fillStyle; ctx.shadowBlur=10;
  ctx.beginPath(); ctx.arc(bx+25,by+22,6,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(bx+55,by+22,6,0,Math.PI*2); ctx.fill();
  ctx.shadowBlur=0;
  // Mouth (sneer)
  ctx.strokeStyle='#aa00ff'; ctx.lineWidth=3;
  ctx.beginPath(); ctx.arc(bx+boss.w/2,by+38,12,0.2,Math.PI-0.2); ctx.stroke();
  // Arms
  ctx.fillStyle='#1a0040';
  ctx.beginPath();
  ctx.moveTo(bx,by+30); ctx.lineTo(bx-20+Math.sin(t)*8,by+60); ctx.lineTo(bx-10,by+65); ctx.lineTo(bx+5,by+35); ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(bx+boss.w,by+30); ctx.lineTo(bx+boss.w+20+Math.sin(t+1)*8,by+60); ctx.lineTo(bx+boss.w+10,by+65); ctx.lineTo(bx+boss.w-5,by+35); ctx.closePath(); ctx.fill();
  // Staff
  ctx.fillStyle='#440088';
  ctx.fillRect(bx+boss.w+8+Math.sin(t)*5,by-10,6,80);
  ctx.fillStyle='#aa00ff'; ctx.shadowColor='#aa00ff'; ctx.shadowBlur=10;
  ctx.beginPath(); ctx.arc(bx+boss.w+11+Math.sin(t)*5,by-15,8,0,Math.PI*2); ctx.fill();
  ctx.shadowBlur=0;

  ctx.restore();
  ctx.globalAlpha=1;

  // Boss HP bar
  const barW=200, barH=16;
  const barX=(BASE_W-barW)/2, barY=20;
  ctx.fillStyle='rgba(0,0,0,0.7)'; roundRect(ctx,barX-4,barY-4,barW+8,barH+8,6); ctx.fill();
  ctx.fillStyle='#330044'; roundRect(ctx,barX,barY,barW,barH,4); ctx.fill();
  ctx.fillStyle='#aa00ff'; roundRect(ctx,barX,barY,barW*(boss.hp/boss.maxHp),barH,4); ctx.fill();
  ctx.strokeStyle='#ff00ff'; ctx.lineWidth=1.5; roundRect(ctx,barX,barY,barW,barH,4); ctx.stroke();
  ctx.fillStyle='#fff'; ctx.font='bold 11px Courier New'; ctx.textAlign='center';
  ctx.fillText(`👑 SHADOW KING  ${boss.hp}/${boss.maxHp}`, BASE_W/2, barY+barH-3);
}

// ─────────────────────────────────────────────────────────────────
// DRAWING — PROJECTILES
// ─────────────────────────────────────────────────────────────────
function drawProjectiles() {
  projectiles.forEach(p => {
    const sx=p.x-camera.x;
    if (p.type==='fireball') {
      ctx.fillStyle='#ff6600'; ctx.shadowColor='#ff6600'; ctx.shadowBlur=8;
      ctx.beginPath(); ctx.arc(sx+p.w/2,p.y+p.h/2,p.w/2,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#ffcc00'; ctx.beginPath(); ctx.arc(sx+p.w/2-2,p.y+p.h/2-2,p.w/3,0,Math.PI*2); ctx.fill();
      ctx.shadowBlur=0;
    } else if (p.type==='shadowBolt') {
      ctx.fillStyle='#aa00ff'; ctx.shadowColor='#ff00ff'; ctx.shadowBlur=10;
      ctx.beginPath(); ctx.arc(sx+p.w/2,p.y+p.h/2,p.w/2,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='rgba(255,0,255,0.4)';
      ctx.beginPath(); ctx.arc(sx+p.w/2,p.y+p.h/2,p.w,0,Math.PI*2); ctx.fill();
      ctx.shadowBlur=0;
    }
  });
}

// ─────────────────────────────────────────────────────────────────
// DRAWING — PLAYER
// ─────────────────────────────────────────────────────────────────
function drawPlayer() {
  if (player.dead) return;
  const sx=player.x-camera.x, sy=player.y;

  // Invincibility flicker
  if (player.invincible>0 && Math.floor(player.invincible/4)%2===0) return;

  ctx.save();
  if (player.facing===-1) { ctx.scale(-1,1); ctx.translate(-BASE_W,0); }

  const px = player.facing===1 ? sx : BASE_W - sx - player.w;
  const py = sy;

  // Power-up aura
  if (player.powerUp) {
    const auraColor=POWERUP_COLORS[player.powerUp]||'#fff';
    ctx.shadowColor=auraColor; ctx.shadowBlur=player.powerUp==='star'?18:10;
  }

  // Legs
  const legAnim=(player.onGround && (keys.left||keys.right)) ? player.anim : 0;
  ctx.fillStyle='#0044aa';
  ctx.fillRect(px+4, py+26, 10, 14+(legAnim%2===0?0:2));
  ctx.fillRect(px+18, py+26, 10, 14+(legAnim%2===0?2:0));
  // Shoes
  ctx.fillStyle='#cc4400';
  ctx.fillRect(px+2,  py+38+(legAnim%2===0?0:2), 12, 6);
  ctx.fillRect(px+18, py+38+(legAnim%2===0?2:0), 12, 6);
  // Body
  ctx.fillStyle='#cc2200';
  roundRect(ctx, px+2, py+14, 28, 16, 5); ctx.fill();
  // Overalls buckle
  ctx.fillStyle='#aa1100';
  ctx.fillRect(px+8, py+14, 6, 6); ctx.fillRect(px+18, py+14, 6, 6);
  // Head
  ctx.fillStyle='#ffcc88';
  ctx.beginPath(); ctx.arc(px+16, py+10, 12, 0, Math.PI*2); ctx.fill();
  // Hat
  ctx.fillStyle='#cc2200';
  ctx.fillRect(px+4, py-2, 24, 6);
  ctx.fillRect(px+8, py-10, 16, 10);
  // Eye
  ctx.fillStyle='#000'; ctx.beginPath(); ctx.arc(px+20, py+9, 2.5, 0, Math.PI*2); ctx.fill();
  // Moustache
  ctx.fillStyle='#5a2d0c';
  ctx.fillRect(px+11, py+15, 12, 3);
  // Attack effect
  if (player.attackCooldown>15 && player.powerUp==='fire') {
    ctx.fillStyle='rgba(255,100,0,0.6)';
    ctx.beginPath(); ctx.arc(px+28,py+16,8,0,Math.PI*2); ctx.fill();
  }
  // Shield bubble
  if (player.powerUp==='shield') {
    ctx.strokeStyle='rgba(136,204,255,0.7)'; ctx.lineWidth=3;
    ctx.beginPath(); ctx.arc(px+16,py+16,24,0,Math.PI*2); ctx.stroke();
  }

  ctx.shadowBlur=0;
  ctx.restore();
}

// ─────────────────────────────────────────────────────────────────
// DRAWING — HUD
// ─────────────────────────────────────────────────────────────────
function drawHUD() {
  // Semi-transparent bar
  ctx.fillStyle='rgba(0,0,0,0.45)';
  ctx.fillRect(0,0,BASE_W,40);

  // Lives
  ctx.font='16px serif';
  ctx.textAlign='left';
  for (let i=0;i<lives;i++) {
    ctx.fillStyle='#ff4466';
    ctx.font='18px serif';
    ctx.fillText('❤', 10+i*24, 26);
  }

  // HP
  ctx.fillStyle='#fff'; ctx.font='bold 13px Courier New'; ctx.textAlign='left';
  ctx.fillText('HP:', 90, 26);
  for (let i=0;i<player.maxHp;i++) {
    ctx.fillStyle= i<player.hp ? '#ff4466' : '#444';
    roundRect(ctx,114+i*20,10,14,18,3); ctx.fill();
  }

  // Level name
  ctx.fillStyle='#fff'; ctx.font='bold 13px Courier New'; ctx.textAlign='center';
  ctx.fillText(LEVELS[currentLevelIndex].name, BASE_W/2, 26);

  // Coins & Score
  ctx.textAlign='right';
  ctx.fillStyle='#FFD700'; ctx.font='16px serif';
  ctx.fillText('🪙', BASE_W-120, 27);
  ctx.fillStyle='#fff'; ctx.font='bold 13px Courier New';
  ctx.fillText(totalCoins, BASE_W-98, 26);
  ctx.fillText(`Score: ${score}`, BASE_W-10, 26);

  // Power-up indicator
  if (player.powerUp) {
    const pEmoji=POWERUP_EMOJI[player.powerUp]||'?';
    const pColor=POWERUP_COLORS[player.powerUp]||'#fff';
    const pPct=player.powerTimer/600;
    ctx.fillStyle=pColor; ctx.font='bold 12px Courier New'; ctx.textAlign='left';
    ctx.fillText(`${pEmoji} ${player.powerUp.toUpperCase()}`, 10, 55);
    ctx.fillStyle='rgba(0,0,0,0.4)'; ctx.fillRect(10,58,80,6);
    ctx.fillStyle=pColor; ctx.fillRect(10,58,80*Math.min(1,pPct),6);
  }

  // Pause hint
  ctx.fillStyle='rgba(255,255,255,0.3)'; ctx.font='10px Courier New'; ctx.textAlign='right';
  ctx.fillText('ESC=Pause', BASE_W-8, BASE_H-6);
}

// ─────────────────────────────────────────────────────────────────
// DRAWING — MENU SCREENS
// ─────────────────────────────────────────────────────────────────
function drawMenu() {
  // Starfield
  ctx.fillStyle='#0d0020';
  ctx.fillRect(0,0,BASE_W,BASE_H);
  const t=Date.now()*0.001;
  stars.forEach(s=>{
    ctx.globalAlpha=0.5+0.5*Math.sin(t+s.blink);
    ctx.fillStyle='#fff';
    ctx.beginPath(); ctx.arc(s.x,s.y,s.r,0,Math.PI*2); ctx.fill();
  });
  ctx.globalAlpha=1;

  // Title glow
  ctx.shadowColor='#aa00ff'; ctx.shadowBlur=30;
  ctx.fillStyle='#fff'; ctx.font='bold 40px Courier New'; ctx.textAlign='center';
  ctx.fillText('ADVENTURE QUEST', BASE_W/2, 110);
  ctx.fillStyle='#ff88ff'; ctx.font='bold 22px Courier New';
  ctx.fillText('The Lost Kingdom', BASE_W/2, 145);
  ctx.shadowBlur=0;

  // Animated hero
  drawMenuHero(BASE_W/2-18, 175);

  // Menu items
  const items=['▶  Start Game','📋  Level Select','⚙  Settings','✖  Exit'];
  items.forEach((item,i)=>{
    const selected=menuSelection===i;
    ctx.fillStyle=selected?'#aa00ff':'rgba(0,0,0,0.4)';
    roundRect(ctx, BASE_W/2-130, 270+i*46, 260, 36, 8);
    ctx.fill();
    if (selected) { ctx.strokeStyle='#ff00ff'; ctx.lineWidth=2; roundRect(ctx,BASE_W/2-130,270+i*46,260,36,8); ctx.stroke(); }
    ctx.fillStyle=selected?'#fff':'#aaa';
    ctx.font=`bold ${selected?16:14}px Courier New`; ctx.textAlign='center';
    ctx.fillText(item, BASE_W/2, 270+i*46+23);
  });

  ctx.fillStyle='rgba(255,255,255,0.4)'; ctx.font='11px Courier New'; ctx.textAlign='center';
  ctx.fillText('Arrow Keys / WASD to navigate  |  Enter / Space to select', BASE_W/2, BASE_H-12);
}

function drawMenuHero(x,y) {
  const bob=Math.sin(Date.now()*0.003)*4;
  ctx.save();
  ctx.shadowColor='#ffcc00'; ctx.shadowBlur=20;
  // Simple hero silhouette
  ctx.fillStyle='#cc2200'; ctx.fillRect(x+2,y+bob-10,28,8);ctx.fillRect(x+8,y+bob-18,16,10);
  ctx.fillStyle='#ffcc88'; ctx.beginPath();ctx.arc(x+16,y+bob-5,10,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#cc2200'; roundRect(ctx,x+3,y+bob+4,26,16,4);ctx.fill();
  ctx.fillStyle='#0044aa'; ctx.fillRect(x+5,y+bob+18,10,14);ctx.fillRect(x+18,y+bob+18,10,14);
  ctx.shadowBlur=0;
  ctx.restore();
}

function drawLevelSelect() {
  ctx.fillStyle='#0d0020'; ctx.fillRect(0,0,BASE_W,BASE_H);
  stars.forEach(s=>{
    ctx.globalAlpha=0.3;ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,Math.PI*2);ctx.fill();
  });
  ctx.globalAlpha=1;

  ctx.fillStyle='#fff'; ctx.font='bold 28px Courier New'; ctx.textAlign='center';
  ctx.shadowColor='#aa00ff'; ctx.shadowBlur=15;
  ctx.fillText('SELECT LEVEL', BASE_W/2, 60);
  ctx.shadowBlur=0;

  const cols=3, rows=2;
  const btnW=200, btnH=100, gapX=30, gapY=20;
  const totalW=(btnW+gapX)*Math.min(LEVELS.length,cols)-gapX;
  const startX=(BASE_W-totalW)/2;

  LEVELS.forEach((lvl,i)=>{
    const col=i%cols, row=Math.floor(i/cols);
    const bx=startX+col*(btnW+gapX), by=90+row*(btnH+gapY);
    const locked=i>=unlockedLevels;
    const selected=levelSelectIndex===i;

    ctx.fillStyle=locked?'rgba(40,20,60,0.7)':selected?'rgba(120,0,180,0.8)':'rgba(30,0,60,0.7)';
    roundRect(ctx,bx,by,btnW,btnH,10); ctx.fill();
    if (selected&&!locked) { ctx.strokeStyle='#ff00ff';ctx.lineWidth=2;roundRect(ctx,bx,by,btnW,btnH,10);ctx.stroke(); }

    const themeEmoji=['🌿','🌲','❄','🌋','🏰'];
    ctx.font='bold 26px serif'; ctx.textAlign='center';
    ctx.fillStyle=locked?'#555':'#fff';
    ctx.fillText(locked?'🔒':themeEmoji[i], bx+btnW/2, by+36);
    ctx.font=`bold 11px Courier New`; ctx.fillStyle=locked?'#555':'#ccc';
    ctx.fillText(`Level ${i+1}`, bx+btnW/2, by+58);
    ctx.font='10px Courier New'; ctx.fillStyle=locked?'#444':'#aaa';
    const shortName=lvl.name.split('—')[1]?.trim()||'';
    ctx.fillText(shortName, bx+btnW/2, by+76);
    if (!locked) {
      ctx.fillStyle='#FFD700'; ctx.font='10px Courier New';
      ctx.fillText(`Best: ${i+1<=unlockedLevels?'✓':'—'}`, bx+btnW/2, by+92);
    }
  });

  ctx.fillStyle='rgba(255,255,255,0.4)'; ctx.font='11px Courier New'; ctx.textAlign='center';
  ctx.fillText('↑↓←→ Navigate  |  Enter to Play  |  Esc to go back', BASE_W/2, BASE_H-12);
}

function drawPauseScreen() {
  ctx.fillStyle='rgba(0,0,0,0.6)'; ctx.fillRect(0,0,BASE_W,BASE_H);
  ctx.fillStyle='#fff'; ctx.font='bold 36px Courier New'; ctx.textAlign='center';
  ctx.shadowColor='#aa00ff'; ctx.shadowBlur=20;
  ctx.fillText('⏸ PAUSED', BASE_W/2, BASE_H/2-40);
  ctx.shadowBlur=0;
  ctx.fillStyle='rgba(255,255,255,0.6)'; ctx.font='16px Courier New';
  ctx.fillText('Press ESC to Resume', BASE_W/2, BASE_H/2+10);
  ctx.fillText('Press M for Main Menu', BASE_W/2, BASE_H/2+40);
}

function drawLevelComplete() {
  ctx.fillStyle='rgba(0,0,0,0.65)'; ctx.fillRect(0,0,BASE_W,BASE_H);
  ctx.shadowColor='#FFD700'; ctx.shadowBlur=30;
  ctx.fillStyle='#FFD700'; ctx.font='bold 40px Courier New'; ctx.textAlign='center';
  ctx.fillText('LEVEL COMPLETE!', BASE_W/2, BASE_H/2-60);
  ctx.shadowBlur=0;
  ctx.fillStyle='#fff'; ctx.font='bold 20px Courier New';
  ctx.fillText(`Score: ${score}`, BASE_W/2, BASE_H/2-10);
  ctx.fillText(`Coins: ${totalCoins} 🪙`, BASE_W/2, BASE_H/2+25);
  ctx.fillStyle='#aaa'; ctx.font='16px Courier New';
  const hasNext=currentLevelIndex+1<LEVELS.length;
  ctx.fillText(hasNext?'Press ENTER for next level':'Press ENTER for Main Menu', BASE_W/2, BASE_H/2+70);
}

function drawGameOver() {
  ctx.fillStyle='rgba(0,0,0,0.8)'; ctx.fillRect(0,0,BASE_W,BASE_H);
  ctx.shadowColor='#ff0000'; ctx.shadowBlur=25;
  ctx.fillStyle='#ff4444'; ctx.font='bold 48px Courier New'; ctx.textAlign='center';
  ctx.fillText('GAME OVER', BASE_W/2, BASE_H/2-50);
  ctx.shadowBlur=0;
  ctx.fillStyle='#fff'; ctx.font='bold 20px Courier New';
  ctx.fillText(`Final Score: ${score}`, BASE_W/2, BASE_H/2+10);
  ctx.fillText(`Coins: ${totalCoins} 🪙`, BASE_W/2, BASE_H/2+45);
  ctx.fillStyle='#aaa'; ctx.font='16px Courier New';
  ctx.fillText('Press ENTER to Retry  |  M for Main Menu', BASE_W/2, BASE_H/2+90);
}

function drawWinScreen() {
  ctx.fillStyle='#0d0020'; ctx.fillRect(0,0,BASE_W,BASE_H);
  const t=Date.now()*0.001;
  stars.forEach(s=>{
    ctx.globalAlpha=0.5+0.5*Math.sin(t+s.blink);
    ctx.fillStyle='#fff'; ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,Math.PI*2);ctx.fill();
  });
  ctx.globalAlpha=1;
  // Rainbow victory text
  ['#ff0','#0f0','#0ff','#f0f','#ff0'].forEach((c,i)=>{
    ctx.fillStyle=c; ctx.font='bold 46px Courier New'; ctx.textAlign='center';
    ctx.shadowColor=c; ctx.shadowBlur=15;
    if(i===2) ctx.fillText('YOU WIN!', BASE_W/2, 120);
  });
  ctx.shadowBlur=0;
  ctx.fillStyle='#fff'; ctx.font='bold 20px Courier New'; ctx.textAlign='center';
  ctx.fillText('The Shadow King is defeated!', BASE_W/2, 170);
  ctx.fillText('The Lost Kingdom is saved! 🏆', BASE_W/2, 205);
  ctx.fillStyle='#FFD700'; ctx.font='bold 22px Courier New';
  ctx.fillText(`Final Score: ${score}`, BASE_W/2, 260);
  ctx.fillText(`Total Coins: ${totalCoins} 🪙`, BASE_W/2, 295);
  ctx.fillStyle='#aaa'; ctx.font='16px Courier New';
  ctx.fillText('Press ENTER to play again  |  M for Main Menu', BASE_W/2, 360);
  // Fireworks
  spawnParticles(rand(50,BASE_W-50),rand(80,200),`hsl(${Math.random()*360},100%,60%)`,3,5);
}

function drawSettings() {
  ctx.fillStyle='rgba(0,0,0,0.9)'; ctx.fillRect(0,0,BASE_W,BASE_H);
  ctx.fillStyle='#fff'; ctx.font='bold 28px Courier New'; ctx.textAlign='center';
  ctx.fillText('⚙ SETTINGS', BASE_W/2, 80);
  ctx.fillStyle='#aaa'; ctx.font='16px Courier New';
  ctx.fillText('Desktop Controls:', BASE_W/2, 140);
  ctx.font='14px Courier New';
  [
    '← / A  —  Move Left',
    '→ / D  —  Move Right',
    '↑ / W / Space  —  Jump',
    'X  —  Attack / Shoot fireball',
    'Esc  —  Pause',
  ].forEach((line,i)=>{ ctx.fillStyle='#ddd'; ctx.fillText(line, BASE_W/2, 170+i*28); });
  ctx.fillStyle='#ddd'; ctx.font='14px Courier New';
  ctx.fillText('🔊 (top-right)  —  Mute music and sound effects', BASE_W/2, 298);
  ctx.fillStyle='#aaa'; ctx.font='16px Courier New';
  ctx.fillText('Mobile Controls:', BASE_W/2, 320);
  ctx.font='14px Courier New';
  ctx.fillStyle='#ddd';
  ctx.fillText('Use the on-screen buttons at the bottom of the screen.', BASE_W/2, 348);
  ctx.fillStyle='rgba(255,255,255,0.4)'; ctx.font='11px Courier New';
  ctx.fillText('Press Esc or M to return to menu', BASE_W/2, BASE_H-15);
}

// ─────────────────────────────────────────────────────────────────
// MENU INPUT HANDLING
// ─────────────────────────────────────────────────────────────────
let menuKeyPressed = false;
document.addEventListener('keydown', e => {
  if (state==='menu') handleMenuKey(e.key);
  else if (state==='levelSelect') handleLevelSelectKey(e.key);
  else if (state==='levelComplete') handleLevelCompleteKey(e.key);
  else if (state==='gameOver') handleGameOverKey(e.key);
  else if (state==='win') handleWinKey(e.key);
  else if (state==='paused') {
    if (e.key==='m'||e.key==='M') { state='menu'; menuSelection=0; }
  }
  else if (state==='settings') {
    if (e.key==='Escape'||e.key==='m'||e.key==='M') state='menu';
  }
});

function handleMenuKey(key) {
  const prev = menuSelection;
  if (key==='ArrowDown'||key==='s') menuSelection=(menuSelection+1)%4;
  if (key==='ArrowUp'||key==='w')   menuSelection=(menuSelection+3)%4;
  if (menuSelection !== prev && (key==='ArrowDown'||key==='ArrowUp'||key==='s'||key==='w')) {
    SFX.menuSelect();
  }
  if (key==='Enter'||key===' ') {
    SFX.menuConfirm();
    switch(menuSelection) {
      case 0: score=0;totalCoins=0;lives=3;player.hp=player.maxHp;startLevel(0); break;
      case 1: state='levelSelect'; levelSelectIndex=0; break;
      case 2: state='settings'; break;
      case 3: /* exit — can't exit browser, just reset */ score=0;totalCoins=0;lives=3;player.hp=player.maxHp;startLevel(0); break;
    }
  }
}

function handleLevelSelectKey(key) {
  const cols=3;
  const prev = levelSelectIndex;
  if (key==='ArrowRight'||key==='d') levelSelectIndex=Math.min(levelSelectIndex+1,LEVELS.length-1);
  if (key==='ArrowLeft' ||key==='a') levelSelectIndex=Math.max(levelSelectIndex-1,0);
  if (key==='ArrowDown' ||key==='s') levelSelectIndex=Math.min(levelSelectIndex+cols,LEVELS.length-1);
  if (key==='ArrowUp'   ||key==='w') levelSelectIndex=Math.max(levelSelectIndex-cols,0);
  if (levelSelectIndex !== prev) SFX.menuSelect();
  if (key==='Enter'||key===' ') {
    if (levelSelectIndex<unlockedLevels) {
      SFX.menuConfirm();
      score=0; totalCoins=0; lives=3; player.hp=player.maxHp;
      startLevel(levelSelectIndex);
    }
  }
  if (key==='Escape') state='menu';
}

function handleLevelCompleteKey(key) {
  if (key==='Enter'||key===' ') {
    const next=currentLevelIndex+1;
    if (next<LEVELS.length) { startLevel(next); }
    else { state='menu'; menuSelection=0; }
  }
}

function handleGameOverKey(key) {
  if (key==='Enter'||key===' ') {
    lives=3; player.hp=player.maxHp;
    score=0; totalCoins=0;
    startLevel(currentLevelIndex);
  }
  if (key==='m'||key==='M') { state='menu'; menuSelection=0; }
}

function handleWinKey(key) {
  if (key==='Enter'||key===' ') {
    score=0; totalCoins=0; lives=3; player.hp=player.maxHp;
    startLevel(0);
  }
  if (key==='m'||key==='M') { state='menu'; menuSelection=0; }
}

// Touch menu navigation
let touchStartX=0, touchStartY=0;
canvas.addEventListener('touchstart', e=>{
  touchStartX=e.touches[0].clientX;
  touchStartY=e.touches[0].clientY;
});
canvas.addEventListener('touchend', e=>{
  const dx=e.changedTouches[0].clientX-touchStartX;
  const dy=e.changedTouches[0].clientY-touchStartY;
  if (Math.abs(dx)<10&&Math.abs(dy)<10) {
    // Tap — simulate Enter
    if (state==='menu') handleMenuKey('Enter');
    else if (state==='levelSelect') handleLevelSelectKey('Enter');
    else if (state==='levelComplete') handleLevelCompleteKey('Enter');
    else if (state==='gameOver') handleGameOverKey('Enter');
    else if (state==='win') handleWinKey('Enter');
  }
  if (state==='menu') {
    if (dy>30) handleMenuKey('ArrowDown');
    if (dy<-30) handleMenuKey('ArrowUp');
  }
  if (state==='levelSelect') {
    if (dx>30) handleLevelSelectKey('ArrowRight');
    if (dx<-30) handleLevelSelectKey('ArrowLeft');
    if (dy>30) handleLevelSelectKey('ArrowDown');
    if (dy<-30) handleLevelSelectKey('ArrowUp');
  }
});

// ─────────────────────────────────────────────────────────────────
// MAIN GAME LOOP
// ─────────────────────────────────────────────────────────────────
let lastTime=0;

function gameLoop(ts) {
  const dt=Math.min((ts-lastTime)/16.67,3);
  lastTime=ts;

  ctx.clearRect(0,0,BASE_W,BASE_H);

  // Camera shake
  let shakeX=0,shakeY=0;
  if (shakeFrames>0) {
    shakeX=rand(-shakeAmp,shakeAmp);
    shakeY=rand(-shakeAmp,shakeAmp);
    shakeFrames--;
  }
  ctx.save();
  ctx.translate(shakeX,shakeY);

  switch(state) {
    case 'menu':
      drawMenu();
      updateParticles(); drawParticles();
      break;

    case 'settings':
      drawSettings();
      break;

    case 'levelSelect':
      drawLevelSelect();
      updateParticles(); drawParticles();
      break;

    case 'playing':
      updateMovingPlatforms();
      updatePlayer(dt);
      updateEnemies();
      updateBoss();
      updateProjectiles();
      updateCollectibles();
      updateHazards();
      updateParticles();
      updateFloaters();

      drawBackground();
      drawPlatforms();
      drawHazards();
      drawFlag();
      drawCoins();
      drawPowerUps();
      drawEnemies();
      drawBoss();
      drawProjectiles();
      drawPlayer();
      drawParticles();
      drawFloaters();
      drawHUD();
      break;

    case 'paused':
      drawBackground();
      drawPlatforms();
      drawHazards();
      drawFlag();
      drawCoins();
      drawPowerUps();
      drawEnemies();
      drawBoss();
      drawPlayer();
      drawHUD();
      drawPauseScreen();
      break;

    case 'levelComplete':
      drawBackground();
      drawPlatforms();
      drawPlayer();
      updateParticles(); drawParticles();
      drawHUD();
      drawLevelComplete();
      break;

    case 'gameOver':
      drawBackground();
      drawGameOver();
      break;

    case 'win':
      drawWinScreen();
      updateParticles(); drawParticles();
      break;
  }

  // Screen flash
  if (flashAlpha>0) {
    ctx.fillStyle=flashColor;
    ctx.globalAlpha=flashAlpha;
    ctx.fillRect(0,0,BASE_W,BASE_H);
    ctx.globalAlpha=1;
    flashAlpha=Math.max(0,flashAlpha-0.05);
  }

  ctx.restore();
  updateBackgroundMusic();
  requestAnimationFrame(gameLoop);
}

// ─────────────────────────────────────────────────────────────────
// BOOT
// ─────────────────────────────────────────────────────────────────
state='menu';
requestAnimationFrame(gameLoop);
