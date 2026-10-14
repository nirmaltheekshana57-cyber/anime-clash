/* ============================================================
   ============================================================
   ANIME CLASH - MAIN SCRIPT
   ============================================================
   HOW TO NAVIGATE THIS FILE:
   Search for "SECTION X" to jump to a specific part.
   Each section is clearly labeled. Do not delete section headers.
   ============================================================
   SECTION 1  - AUDIO SYSTEM
   SECTION 2  - GAME CONSTANTS & STATE
   SECTION 3  - MENU WIRING
   SECTION 4  - COMBAT ACTIONS
   SECTION 5  - PARTICLE HELPERS
   SECTION 6  - PHYSICS
   SECTION 7  - AI BRAIN
   SECTION 8  - MAIN UPDATE LOOP
   SECTION 9  - DRAWING: CHARACTERS
   SECTION 10 - DRAWING: EFFECTS
   SECTION 11 - DRAWING: BACKGROUND
   SECTION 12 - DRAWING: HUD & MENUS
   SECTION 13 - MAIN DRAW FUNCTION
   SECTION 14 - GAME LOOP
   ============================================================
*/

(function(){
"use strict";

/* ============================================================
   SECTION 1: AUDIO SYSTEM
   ============================================================ */
let audioCtx = null;
let audioReady = false;

function initAudio() {
  if (audioReady) return;
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    audioReady = true;
  } catch (e) {}
}

function tone(freq, dur, type, vol, sweep) {
  if (!audioReady || !audioCtx) return;
  const t = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type || 'square';
  osc.frequency.setValueAtTime(freq, t);
  if (sweep) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq * sweep), t + dur);
  gain.gain.setValueAtTime(vol || 0.1, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function noise(dur, vol, filterFreq) {
  if (!audioReady || !audioCtx) return;
  const t = audioCtx.currentTime;
  const bufferSize = audioCtx.sampleRate * dur;
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  const src = audioCtx.createBufferSource();
  src.buffer = buffer;
  const filter = audioCtx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = filterFreq || 2000;
  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(vol || 0.1, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(audioCtx.destination);
  src.start(t);
}

const SFX = {
  lightHit: () => { tone(880, 0.08, 'square', 0.07, 0.4); noise(0.05, 0.05, 3000); },
  heavyHit: () => { tone(220, 0.15, 'sawtooth', 0.12, 0.4); noise(0.1, 0.1, 1200); },
  special: () => { tone(140, 0.35, 'sine', 0.15, 0.3); noise(0.2, 0.08, 800); },
  block: () => { tone(1600, 0.06, 'square', 0.06, 0.6); noise(0.04, 0.04, 4000); },
  jump: () => { tone(440, 0.12, 'sine', 0.06, 2.5); },
  land: () => { tone(180, 0.12, 'sine', 0.09, 0.4); noise(0.08, 0.05, 600); },
  whoosh: () => { noise(0.15, 0.08, 1500); },
  blueCast: () => { tone(660, 0.4, 'sine', 0.1, 0.5); tone(330, 0.5, 'sine', 0.07, 0.4); },
  redCast: () => { tone(180, 0.3, 'sawtooth', 0.12, 2.0); noise(0.15, 0.08, 1500); },
  purpleCast: () => { tone(300, 0.6, 'sine', 0.12, 0.3); tone(450, 0.6, 'triangle', 0.08, 0.2); noise(0.4, 0.06, 1200); },
  blackFlash: () => { tone(80, 0.35, 'sawtooth', 0.18, 0.3); noise(0.25, 0.14, 800); tone(1200, 0.1, 'square', 0.08, 0.3); },
  awaken: () => { tone(660, 0.5, 'sine', 0.1, 1.8); tone(990, 0.5, 'sine', 0.06, 1.8); },
  summon: () => { tone(330, 0.4, 'triangle', 0.09, 1.6); },
  ko: () => { tone(200, 0.8, 'sawtooth', 0.15, 0.3); tone(100, 1.0, 'sine', 0.12, 0.5); },
  menu: () => { tone(660, 0.08, 'square', 0.06, 1.5); },
  select: () => { tone(880, 0.1, 'square', 0.08, 1.5); tone(1320, 0.1, 'square', 0.05, 1.5); },
  counter: () => { tone(1320, 0.15, 'square', 0.1, 1.4); noise(0.1, 0.08, 4000); }
};

/* ============================================================
   SECTION 2: GAME CONSTANTS & STATE
   ============================================================ */
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const W = canvas.width;
const H = canvas.height;

const ground = { x: 0, y: 430, width: W, height: H - 430, color: '#e6c280' };

let gameState = 'MAIN_MENU';
let gameMode = 'battle';
let playerChoice = 'tsunade';
let graphicsQuality = 'high';
let winnerText = '';
let gameOver = false;
let globalTime = 0;
let dt = 0;
let lastTime = 0;
let animTimer = 0;
let screenShake = 0;
let hitStop = 0;
let screenTint = null;

const tsunade = {
  x: 180, y: ground.y - 110, width: 48, height: 110,
  vx: 0, vy: 0, knockbackVx: 0, baseSpeed: 4.2, speed: 4.2, jumpPower: -13,
  gravity: 0.85, isGrounded: true,
  color: '#00ffcc', name: 'Tsunade Senju',
  isAttacking: false, attackTimer: 0, isSpecial: false, isSkill: false, isAwakened: false,
  hp: 200, maxHp: 200, hitTimer: 0, hitStun: 0, attackCooldown: 0,
  facing: 1, afterimages: [], blocking: false, landTimer: 0
};

const gojo = {
  x: 720, y: ground.y - 110, width: 48, height: 110,
  vx: 0, vy: 0, knockbackVx: 0, speed: 2.8, jumpPower: -13, gravity: 0.85, isGrounded: true,
  color: '#9b59b6', name: 'Satoru Gojo', facing: -1,
  hitTimer: 0, hitStun: 0, stunTimer: 0, actionCooldown: 0,
  currentMove: 'Infinity', moveTimer: 0,
  hp: 200, maxHp: 200, blocking: false,
  afterimages: [], landTimer: 0
};

const aiBrain = {
  plan: 'wait',
  planTimer: 0,
  planDuration: 30,
  lastDecision: 0,
  decisionCooldown: 0,
  aggression: 0.5,
  reactionDelay: 8,
  targetX: 0
};

let movingLeft = false;
let movingRight = false;
let shockwave = null;
let groundDebris = [];
let redBlast = null;
let blueBlast = null;
let awakenedTimer = 0;
let purpleSequence = null;
let comboSequence = null;
let heavyComboSequence = null;
let blackFlashEffect = null;
let acidProjectiles = [];
let katsuyuSummon = null;
let particles = [];
let slashes = [];
let distortionRings = [];
let waveOffset = 0;
let cloudOffset = 0;
let cloudOffset2 = 0;
let fogOffset = 0;
let hitFlashes = [];
let chakraTrails = [];
let infinityPulse = 0;

/* ============================================================
   SECTION 3: MENU WIRING
   ============================================================ */
const wireBtn = (id, fn) => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('pointerdown', (e) => { initAudio(); SFX.menu(); e.preventDefault(); fn(); });
};

wireBtn('playBtn', () => {
  gameState = 'MODE_SELECT';
  document.getElementById('mainMenuControls').style.display = 'none';
  document.getElementById('modeControls').style.display = 'block';
  document.getElementById('instructionText').textContent = 'Select your game mode!';
});
wireBtn('settingsBtn', () => {
  gameState = 'SETTINGS';
  document.getElementById('mainMenuControls').style.display = 'none';
  document.getElementById('settingsControls').style.display = 'block';
  document.getElementById('instructionText').textContent = 'Graphics Settings & Optimization';
});
wireBtn('backToMenuFromSettings', () => {
  gameState = 'MAIN_MENU';
  document.getElementById('settingsControls').style.display = 'none';
  document.getElementById('mainMenuControls').style.display = 'block';
  document.getElementById('instructionText').textContent = 'Welcome to Anime Clash!';
});
wireBtn('gfxLow', () => setGraphics('low'));
wireBtn('gfxMed', () => setGraphics('medium'));
wireBtn('gfxHigh', () => setGraphics('high'));

function setGraphics(level) {
  graphicsQuality = level;
  const ids = ['gfxLow','gfxMed','gfxHigh'];
  const labels = {gfxLow:'Low', gfxMed:'Medium', gfxHigh:'High'};
  ids.forEach(id => {
    const el = document.getElementById(id);
    const lvlName = id.replace('gfx','').toLowerCase();
    const norm = lvlName === 'med' ? 'medium' : lvlName;
    const active = norm === level;
    el.style.backgroundColor = active ? '#00ffcc' : '#444';
    el.style.color = active ? 'black' : 'white';
    el.textContent = active ? labels[id] + ' [Active]' : labels[id];
  });
}

wireBtn('backToMenuBtn', () => {
  gameState = 'MAIN_MENU';
  document.getElementById('modeControls').style.display = 'none';
  document.getElementById('mainMenuControls').style.display = 'block';
  document.getElementById('instructionText').textContent = 'Welcome to Anime Clash!';
});
wireBtn('battleModeBtn', () => { gameMode = 'battle'; goToCharacterSelect(); });
wireBtn('practiceModeBtn', () => { gameMode = 'practice'; goToCharacterSelect(); });
wireBtn('backToModeBtn', () => {
  gameState = 'MODE_SELECT';
  document.getElementById('selectControls').style.display = 'none';
  document.getElementById('modeControls').style.display = 'block';
  document.getElementById('instructionText').textContent = 'Select your game mode!';
});

function goToCharacterSelect() {
  gameState = 'SELECT';
  document.getElementById('modeControls').style.display = 'none';
  document.getElementById('selectControls').style.display = 'block';
  document.getElementById('instructionText').textContent = `Mode: ${gameMode.toUpperCase()} — Select your fighter!`;
}

wireBtn('pickTsunade', () => startMatch('tsunade'));
wireBtn('pickGojo', () => startMatch('gojo'));

function startMatch(choice) {
  playerChoice = choice;
  gameState = 'FIGHT';
  resetMatch();
  SFX.select();
  document.getElementById('selectControls').style.display = 'none';
  document.getElementById('fightControls').style.display = 'block';

  if (playerChoice === 'tsunade') {
    document.getElementById('meleeBtn').textContent = '👊 Melee';
    document.getElementById('attackBtn').textContent = '💥 Combo';
    document.getElementById('heavyComboBtn').style.display = 'none';
    document.getElementById('specialBtn').textContent = '⚡ Heaven Kick';
    document.getElementById('skillBtn').textContent = '🧬 Nerve Strike';
    document.getElementById('awakenBtn').textContent = '✨ Byakugō';
    document.getElementById('summonBtn').style.display = 'inline-block';
  } else {
    document.getElementById('meleeBtn').textContent = '👊 Hand-to-Hand';
    document.getElementById('attackBtn').textContent = '💥 Light Combo';
    document.getElementById('heavyComboBtn').style.display = 'inline-block';
    document.getElementById('heavyComboBtn').textContent = '⚡ Heavy Combo';
    document.getElementById('specialBtn').textContent = '🔵 Blue';
    document.getElementById('skillBtn').textContent = '🔴 Red';
    document.getElementById('awakenBtn').textContent = '🟣 Purple';
    document.getElementById('summonBtn').style.display = 'none';
  }
  document.getElementById('instructionText').textContent = gameMode === 'practice'
    ? '🥋 PRACTICE MODE: Infinite Health & Dummy'
    : '⚔️ BATTLE MODE: Fight to the K.O.!';
}

function bindMovementButton(id, onDown, onUp) {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('pointerdown', (e) => { initAudio(); e.preventDefault(); onDown(); });
  el.addEventListener('pointerup', (e) => { e.preventDefault(); onUp(); });
  el.addEventListener('pointercancel', (e) => { e.preventDefault(); onUp(); });
  el.addEventListener('pointerleave', () => onUp());
}

bindMovementButton('leftBtn', () => { if (gameState === 'FIGHT' && !gameOver) movingLeft = true; }, () => movingLeft = false);
bindMovementButton('rightBtn', () => { if (gameState === 'FIGHT' && !gameOver) movingRight = true; }, () => movingRight = false);
window.addEventListener('pointerup', () => { movingLeft = false; movingRight = false; });

const jumpEl = document.getElementById('jumpBtn');
if (jumpEl) {
  jumpEl.addEventListener('pointerdown', (e) => {
    initAudio();
    e.preventDefault();
    if (gameState !== 'FIGHT' || gameOver) return;
    const activeChar = (playerChoice === 'tsunade') ? tsunade : gojo;
    if (activeChar.isGrounded) {
      activeChar.vy = activeChar.jumpPower;
      activeChar.isGrounded = false;
      SFX.jump();
      if (graphicsQuality !== 'low') spawnDust(activeChar.x + activeChar.width/2, ground.y, '#ffffff');
    }
  });
}

/* ============================================================
   SECTION 4: COMBAT ACTIONS
   ============================================================ */
   function dealDamage(attacker, target, amount, knockbackX, options) {
  options = options || {};
  const isBlocked = target.blocking && !options.unblockable;
  if (isBlocked) {
    target.knockbackVx = knockbackX * 0.4;
    target.hitStun = 8;
    SFX.block();
    hitStop = 2;
    if (graphicsQuality !== 'low') spawnSparks(target.x + target.width/2, target.y + 40, '#ffffff');
    return;
  }
  target.hp -= amount;
  if (target.hp < 0) target.hp = 0;
  target.hitTimer = 10;
  target.hitStun = options.hitStun || 14;
  target.knockbackVx = knockbackX;
  hitStop = options.heavy ? 6 : 3;
  screenShake = options.heavy ? 8 : 4;
  if (options.sound === 'heavy') SFX.heavyHit();
  else if (options.sound === 'special') SFX.special();
  else SFX.lightHit();
  if (graphicsQuality !== 'low') {
    const col = attacker === tsunade ? '#00ffcc' : '#9b59b6';
    spawnSparks(target.x + target.width/2, target.y + 50, col);
    spawnSlash(target.x + 24, target.y + 50, attacker.facing);
    spawnHitFlash(target.x + 24, target.y + 50, col);
  }
}

/* ---- TSUNade: LIGHT COMBO STATE ---- */
let tsunadeLightCombo = null;   // { step, timer, fired }
/* step 1 = first punch, step 2 = second punch, step 3 = grab+ground slap */

/* ---- TSUNade: HEAVY COMBO STATE ---- */
let tsunadeHeavyCombo = null;   // { step, timer, fired }
/* step 1..3 = heavy hits, step 4 = heavenly foot of pain (leap), step 5 = heel drop */

/* ---- TSUNade: ULTIMATE STATE ---- */
let tsunadeUltimate = null;     // { stage, timer, fired, targetX }
/* stage 'charge' = wind-up, 'punch' = strike, 'launched' = opponent flying */

/* ---- Nervous System Rupture: status on whoever got hit ---- */
let scrambleTimer = 0;
let scrambleTarget = null;      // 'tsunade' | 'gojo' | null

/* ============================ MELEE ============================ */
const meleeEl = document.getElementById('meleeBtn');
if (meleeEl) {
  meleeEl.addEventListener('pointerdown', (e) => {
    initAudio();
    e.preventDefault();
    if (gameState !== 'FIGHT' || gameOver) return;
    const activeChar = (playerChoice === 'tsunade') ? tsunade : gojo;
    const targetChar = (playerChoice === 'tsunade') ? gojo : tsunade;
    if (targetChar.currentMove === 'Infinity' && playerChoice === 'tsunade') { gojo.hitTimer = 5; return; }
    if (activeChar.hitStun > 0 || activeChar.isAttacking) return;
    activeChar.isAttacking = true;
    activeChar.attackTimer = 6;
    SFX.whoosh();
    const distance = Math.abs((activeChar.x + activeChar.width/2) - (targetChar.x + targetChar.width/2));
    if (distance < 95) {
      dealDamage(activeChar, targetChar, 8, (activeChar.x < targetChar.x ? 1 : -1) * 6, { sound: 'light' });
    }
  });
}

/* ============================ LIGHT COMBO / TSUNade combo ============================ */
const attackEl = document.getElementById('attackBtn');
if (attackEl) {
  attackEl.addEventListener('pointerdown', (e) => {
    initAudio();
    e.preventDefault();
    if (gameState !== 'FIGHT' || gameOver) return;

    /* ---------- TSUNade: Light Combo (2 punches -> grab -> ground slap) ---------- */
    if (playerChoice === 'tsunade') {
      if (gojo.currentMove === 'Infinity') { gojo.hitTimer = 5; return; }
      if (tsunade.hitStun > 0) return;

      /* If already mid-combo, advance it (if attack window is open) */
      if (tsunadeLightCombo && !tsunadeLightCombo.fired) {
        tsunadeLightCombo.step++;
        tsunadeLightCombo.timer = 0;
        /* Step 2: second punch */
        if (tsunadeLightCombo.step === 2) {
          tsunade.isAttacking = true;
          tsunade.attackTimer = 10;
          SFX.whoosh();
          const distance = Math.abs((tsunade.x + tsunade.width/2) - (gojo.x + gojo.width/2));
          if (distance < 95) {
            dealDamage(tsunade, gojo, 8, (tsunade.x < gojo.x ? 1 : -1) * 4, { sound: 'light', hitStun: 12 });
          }
        }
        /* Step 3: grab + ground slap finisher */
        else if (tsunadeLightCombo.step >= 3) {
          tsunade.isAttacking = true;
          tsunade.attackTimer = 22;
          tsunadeLightCombo.fired = true;
          SFX.heavyHit();
          const distance = Math.abs((tsunade.x + tsunade.width/2) - (gojo.x + gojo.width/2));
          if (distance < 110) {
            /* Grab: snatch the opponent, small lift, then slam */
            tsunade.grabbedTarget = gojo;
            gojo.knockbackVx = 0;
            gojo.hitTimer = 60;
            gojo.hitStun = 50;
            /* Ground slap damage */
            hitStop = 8;
            screenShake = 20;
            gojo.hp -= 22;
            if (gojo.hp < 0) gojo.hp = 0;
            gojo.vy = -4;
            screenTint = { color: '0,255,204', alpha: 0.3, decay: 0.04 };
            if (graphicsQuality !== 'low') {
              spawnSparks(gojo.x + 24, ground.y - 10, '#00ffcc');
              spawnRing(gojo.x + 24, ground.y, '#00ffcc', 180);
              spawnHitFlash(gojo.x + 24, ground.y - 20, '#00ffcc');
              /* Ground crack debris */
              for (let i = 0; i < 10; i++) {
                groundDebris.push({
                  x: gojo.x + 24 + (Math.random() - 0.5) * 80,
                  y: ground.y,
                  vx: (Math.random() - 0.5) * 10,
                  vy: -Math.random() * 7 - 2,
                  size: Math.random() * 8 + 4,
                  alpha: 1.0,
                  rot: Math.random() * Math.PI,
                  vr: (Math.random() - 0.5) * 0.3
                });
              }
            }
          }
          tsunadeLightCombo = null;
        }
      } else {
        /* Start a new combo */
        tsunadeLightCombo = { step: 1, timer: 0, fired: false };
        tsunade.isAttacking = true;
        tsunade.attackTimer = 10;
        SFX.whoosh();
        const distance = Math.abs((tsunade.x + tsunade.width/2) - (gojo.x + gojo.width/2));
        if (distance < 95) {
          const dmg = tsunade.isAwakened ? 12 : 8;
          dealDamage(tsunade, gojo, dmg, (tsunade.x < gojo.x ? 1 : -1) * 5, { sound: 'light', hitStun: 12 });
        }
      }
    }
    /* ---------- GOJO: Light Combo (unchanged) ---------- */
    else {
      if (gojo.hitStun > 0 || gojo.isAttacking) return;
      gojo.isAttacking = true;
      gojo.attackTimer = 6;
      SFX.whoosh();
      if (!comboSequence) {
        comboSequence = { step: 1, punchCount: 1, timer: 0, fired: false };
        gojo.currentMove = 'Light Punch 1';
      } else {
        comboSequence.punchCount++;
        comboSequence.timer = 0;
        if (comboSequence.punchCount === 2) gojo.currentMove = 'Light Punch 2';
        else if (comboSequence.punchCount === 3) gojo.currentMove = 'Light Punch 3';
        else if (comboSequence.punchCount >= 4) { comboSequence.step = 2; gojo.currentMove = 'Light Combo Finisher Ready'; comboSequence.fired = false; }
      }
      dealDamage(gojo, tsunade, 4, (gojo.x < tsunade.x ? 1 : -1) * 3, { sound: 'light', hitStun: 10 });
    }
  });
}

/* ============================ HEAVY COMBO ============================ */
const heavyComboEl = document.getElementById('heavyComboBtn');
if (heavyComboEl) {
  heavyComboEl.addEventListener('pointerdown', (e) => {
    initAudio();
    e.preventDefault();
    if (gameState !== 'FIGHT' || gameOver) return;

    /* ---------- TSUNade: Heavy Combo (3 heavy hits -> heavenly foot of pain) ---------- */
    if (playerChoice === 'tsunade') {
      if (gojo.currentMove === 'Infinity') { gojo.hitTimer = 5; return; }
      if (tsunade.hitStun > 0) return;

      if (tsunadeHeavyCombo && !tsunadeHeavyCombo.fired) {
        tsunadeHeavyCombo.step++;
        tsunadeHeavyCombo.timer = 0;
        /* Steps 2 and 3: heavy strikes */
        if (tsunadeHeavyCombo.step === 2 || tsunadeHeavyCombo.step === 3) {
          tsunade.isAttacking = true;
          tsunade.attackTimer = 14;
          SFX.whoosh();
          const distance = Math.abs((tsunade.x + tsunade.width/2) - (gojo.x + gojo.width/2));
          if (distance < 100) {
            const dmg = tsunade.isAwakened ? 14 : 10;
            dealDamage(tsunade, gojo, dmg, (tsunade.x < gojo.x ? 1 : -1) * 5, { sound: 'light', hitStun: 16 });
            screenShake = 6;
          }
        }
        /* Step 4: leap + heavenly foot of pain */
        else if (tsunadeHeavyCombo.step >= 4) {
          tsunadeHeavyCombo.fired = true;
          tsunade.isAttacking = true;
          tsunade.attackTimer = 40;
          /* Launch her up and forward */
          tsunade.vy = -16;
          const faceDir = (gojo.x > tsunade.x) ? 1 : -1;
          tsunade.knockbackVx = faceDir * 8;
          tsunade.isSpecial = true;  /* Reuse special flag for landing detection */
          SFX.whoosh();
          screenTint = { color: '0,255,204', alpha: 0.2, decay: 0.03 };
          tsunadeHeavyCombo = null;
        }
      } else {
        tsunadeHeavyCombo = { step: 1, timer: 0, fired: false };
        tsunade.isAttacking = true;
        tsunade.attackTimer = 14;
        SFX.whoosh();
        const distance = Math.abs((tsunade.x + tsunade.width/2) - (gojo.x + gojo.width/2));
        if (distance < 100) {
          const dmg = tsunade.isAwakened ? 16 : 12;
          dealDamage(tsunade, gojo, dmg, (tsunade.x < gojo.x ? 1 : -1) * 5, { sound: 'light', hitStun: 16 });
          screenShake = 6;
        }
      }
    }
    /* ---------- GOJO: Heavy Combo (unchanged) ---------- */
    else {
      if (gojo.hitStun > 0 || gojo.isAttacking) return;
      gojo.isAttacking = true;
      gojo.attackTimer = 10;
      SFX.whoosh();
      if (!heavyComboSequence) {
        heavyComboSequence = { step: 1, hitCount: 1, timer: 0, fired: false };
        gojo.currentMove = 'Heavy Strike 1';
      } else {
        heavyComboSequence.hitCount++;
        heavyComboSequence.timer = 0;
        if (heavyComboSequence.hitCount === 2) gojo.currentMove = 'Heavy Strike 2';
        else if (heavyComboSequence.hitCount >= 3) {
          heavyComboSequence.step = 2;
          gojo.currentMove = 'Red Blast Setup';
          const faceDir = (gojo.x < tsunade.x) ? 1 : -1;
          redBlast = { x: gojo.x + (faceDir * 20), y: gojo.y + 35, vx: faceDir * 9, radius: 22 };
          SFX.redCast();
        }
      }
      dealDamage(gojo, tsunade, 6, (gojo.x < tsunade.x ? 1 : -1) * 4, { sound: 'light', hitStun: 12 });
    }
  });
}

/* ============================ BLACK FLASH ============================ */
const blackFlashEl = document.getElementById('blackFlashBtn');
if (blackFlashEl) {
  blackFlashEl.addEventListener('pointerdown', (e) => {
    initAudio();
    e.preventDefault();
    if (gameState !== 'FIGHT' || gameOver) return;
    const activeChar = (playerChoice === 'tsunade') ? tsunade : gojo;
    const targetChar = (playerChoice === 'tsunade') ? gojo : tsunade;
    const faceDir = (activeChar.x < targetChar.x) ? 1 : -1;
    if (targetChar.currentMove === 'Infinity' && playerChoice === 'tsunade') { gojo.hitTimer = 5; return; }
    const distance = Math.abs((activeChar.x + activeChar.width/2) - (targetChar.x + targetChar.width/2));
    if (distance < 110) {
      hitStop = 10;
      screenShake = 24;
      targetChar.hp -= 40;
      if (targetChar.hp < 0) targetChar.hp = 0;
      targetChar.knockbackVx = faceDir * 24;
      targetChar.vy = -10;
      targetChar.hitTimer = 45;
      targetChar.hitStun = 40;
      blackFlashEffect = { x: targetChar.x + 24, y: targetChar.y + 55, timer: 40, maxTimer: 40 };
      activeChar.currentMove = 'Black Flash!';
      setTimeout(() => { activeChar.currentMove = 'Infinity'; }, 400);
      screenTint = { color: '0,0,0', alpha: 0.55, decay: 0.05 };
      SFX.blackFlash();
      if (graphicsQuality !== 'low') spawnSparks(targetChar.x + 24, targetChar.y + 55, '#ff1a1a');
    }
  });
}

/* ============================ SPECIAL ============================ */
const specialEl = document.getElementById('specialBtn');
if (specialEl) {
  specialEl.addEventListener('pointerdown', (e) => {
    initAudio();
    e.preventDefault();
    if (gameState !== 'FIGHT' || gameOver) return;

    /* ---------- TSUNade: Nervous System Rupture ---------- */
    if (playerChoice === 'tsunade') {
      if (tsunade.isSpecial || tsunade.hitStun > 0) return;
      tsunade.isSpecial = true;
      tsunade.isAttacking = true;
      tsunade.attackTimer = 18;
      SFX.special();
      screenTint = { color: '180,255,80', alpha: 0.25, decay: 0.04 };
      /* Electric chakra arcs on her hand */
      if (graphicsQuality !== 'low') {
        for (let i = 0; i < 12; i++) {
          particles.push({
            x: tsunade.x + 24 + (tsunade.facing * 20),
            y: tsunade.y + 30 + (Math.random() - 0.5) * 20,
            vx: (Math.random() - 0.5) * 6,
            vy: (Math.random() - 0.5) * 6,
            alpha: 1.0,
            color: '#baff50',
            size: Math.random() * 4 + 2,
            life: 1
          });
        }
      }
      const distance = Math.abs((tsunade.x + tsunade.width/2) - (gojo.x + gojo.width/2));
      if (distance < 95 && tsunade.y >= gojo.y - 60) {
        if (gojo.currentMove === 'Infinity') {
          gojo.hitTimer = 5;
          tsunade.knockbackVx = (tsunade.x < gojo.x ? -1 : 1) * 10;
        } else {
          hitStop = 6;
          screenShake = 10;
          gojo.hp -= 18;
          if (gojo.hp < 0) gojo.hp = 0;
          gojo.hitStun = 30;
          gojo.hitTimer = 30;
          /* Set scramble on Gojo */
          scrambleTimer = 110;   // ~1.8 seconds
          scrambleTarget = 'gojo';
          screenTint = { color: '180,255,80', alpha: 0.4, decay: 0.03 };
          if (graphicsQuality !== 'low') {
            spawnSparks(gojo.x + 24, gojo.y + 40, '#baff50');
            for (let i = 0; i < 16; i++) {
              particles.push({
                x: gojo.x + 24 + (Math.random() - 0.5) * 40,
                y: gojo.y + 30 + (Math.random() - 0.5) * 40,
                vx: (Math.random() - 0.5) * 8,
                vy: (Math.random() - 0.5) * 8,
                alpha: 1.0,
                color: '#baff50',
                size: Math.random() * 4 + 2,
                life: 1
              });
            }
          }
        }
      }
    }
    /* ---------- GOJO: Blue (unchanged) ---------- */
    else {
      if (gojo.hitStun > 0) return;
      gojo.currentMove = 'Blue';
      gojo.moveTimer = 45;
      const faceDir = (gojo.x < tsunade.x) ? 1 : -1;
      const startX = gojo.x + (faceDir * 20);
      const targetX = (gojo.x + tsunade.x) / 2;
      const travelDist = Math.abs(targetX - startX);
      const velX = faceDir * Math.min(8, travelDist / 15);
      blueBlast = { x: startX, y: gojo.y + 35, startX, targetX, vx: velX, radius: 24, state: 'traveling', vortexTimer: 50, spinAngle: 0 };
      screenTint = { color: '0,150,255', alpha: 0.18, decay: 0.03 };
      SFX.blueCast();
    }
  });
}

/* ============================ SKILL ============================ */
const skillEl = document.getElementById('skillBtn');
if (skillEl) {
  skillEl.addEventListener('pointerdown', (e) => {
    initAudio();
    e.preventDefault();
    if (gameState !== 'FIGHT' || gameOver) return;

    /* ---------- TSUNade: reserved / placeholder (heavenly foot moved to heavy combo) ---------- */
    if (playerChoice === 'tsunade') {
      /* For now, this is her "Byakugō heal burst" - quick self heal + small pushback burst */
      if (tsunade.hitStun > 0) return;
      tsunade.hp = Math.min(tsunade.maxHp, tsunade.hp + 25);
      screenTint = { color: '0,255,204', alpha: 0.3, decay: 0.03 };
      SFX.awaken();
      if (graphicsQuality !== 'low') {
        spawnRing(tsunade.x + 24, ground.y, '#00ffcc', 160);
        spawnSparks(tsunade.x + 24, tsunade.y + 50, '#00ffcc');
        for (let i = 0; i < 20; i++) {
          particles.push({
            x: tsunade.x + 24 + (Math.random() - 0.5) * 50,
            y: tsunade.y + 30 + Math.random() * 60,
            vx: (Math.random() - 0.5) * 3,
            vy: -Math.random() * 4 - 1,
            alpha: 1.0,
            color: '#00ffcc',
            size: Math.random() * 5 + 2,
            life: 1
          });
        }
      }
    }
    /* ---------- GOJO: Red (unchanged) ---------- */
    else {
      if (gojo.hitStun > 0) return;
      gojo.currentMove = 'Red';
      gojo.moveTimer = 35;
      const faceDir = (gojo.x < tsunade.x) ? 1 : -1;
      redBlast = { x: gojo.x + (faceDir * 20), y: gojo.y + 35, vx: faceDir * 8, radius: 22 };
      screenTint = { color: '255,40,40', alpha: 0.18, decay: 0.03 };
      SFX.redCast();
    }
  });
}

/* ============================ ULTIMATE / AWAKEN ============================ */
const awakenEl = document.getElementById('awakenBtn');
if (awakenEl) {
  awakenEl.addEventListener('pointerdown', (e) => {
    initAudio();
    e.preventDefault();
    if (gameState !== 'FIGHT' || gameOver) return;

    /* ---------- TSUNade: 1000 Metre Punch ---------- */
    if (playerChoice === 'tsunade') {
      if (tsunadeUltimate || tsunade.hitStun > 0) return;
      tsunadeUltimate = { stage: 'charge', timer: 0, fired: false };
      tsunade.isAttacking = true;
      tsunade.attackTimer = 90;   /* long wind-up */
      screenTint = { color: '0,255,204', alpha: 0.35, decay: 0.015 };
      SFX.awaken();
      if (graphicsQuality !== 'low') {
        /* Charging aura around her fist */
        for (let i = 0; i < 30; i++) {
          const ang = Math.random() * Math.PI * 2;
          const dist = 30 + Math.random() * 50;
          particles.push({
            x: tsunade.x + 24 + Math.cos(ang) * dist,
            y: tsunade.y + 40 + Math.sin(ang) * dist,
            vx: -Math.cos(ang) * 3,
            vy: -Math.sin(ang) * 3,
            alpha: 1.0,
            color: '#00ffcc',
            size: Math.random() * 6 + 3,
            life: 1
          });
        }
      }
    }
    /* ---------- GOJO: Purple (unchanged) ---------- */
    else {
      if (purpleSequence) return;
      gojo.currentMove = 'Hollow Purple';
      gojo.moveTimer = 220;
      const faceDir = (gojo.x < tsunade.x) ? 1 : -1;
      const midScreenX = (gojo.x + tsunade.x) / 2;
      purpleSequence = { stage: 'blue_travel', blueX: gojo.x, redX: gojo.x, startY: gojo.y + 35, meetX: midScreenX, meetY: gojo.y + 35, facing: faceDir, timer: 0, charge: 0 };
      SFX.purpleCast();
    }
  });
}

/* ============================ SUMMON ============================ */
const summonEl = document.getElementById('summonBtn');
if (summonEl) {
  summonEl.addEventListener('pointerdown', (e) => {
    initAudio();
    e.preventDefault();
    if (gameState !== 'FIGHT' || gameOver || playerChoice !== 'tsunade') return;
    if (!katsuyuSummon) {
      const faceDir = (gojo.x > tsunade.x) ? 1 : -1;
      katsuyuSummon = { x: tsunade.x - (faceDir * 60), y: ground.y - 60, width: 100, height: 60, timer: 300, acidCooldown: 0, wobble: 0 };
      SFX.summon();
      if (graphicsQuality !== 'low') spawnSparks(tsunade.x, tsunade.y, '#2b5a84');
    }
  });
}

/* ============================ RESET ============================ */
const resetEl = document.getElementById('resetBtn');
if (resetEl) {
  resetEl.addEventListener('click', () => {
    gameState = 'MAIN_MENU';
    gameOver = false;
    movingLeft = false;
    movingRight = false;
    document.getElementById('fightControls').style.display = 'none';
    document.getElementById('mainMenuControls').style.display = 'block';
    document.getElementById('instructionText').textContent = 'Welcome to Anime Clash!';
  });
}

function resetMatch() {
  tsunade.x = 180; tsunade.y = ground.y - tsunade.height; tsunade.vx = 0; tsunade.vy = 0; tsunade.knockbackVx = 0; tsunade.hp = 200; tsunade.speed = tsunade.baseSpeed; tsunade.isSpecial = false; tsunade.isAwakened = false; tsunade.hitTimer = 0; tsunade.hitStun = 0; tsunade.attackCooldown = 0; tsunade.isGrounded = true; tsunade.afterimages = []; tsunade.facing = 1; tsunade.isAttacking = false; tsunade.attackTimer = 0; tsunade.blocking = false; tsunade.landTimer = 0;
  gojo.x = 720; gojo.y = ground.y - gojo.height; gojo.vx = 0; gojo.vy = 0; gojo.knockbackVx = 0; gojo.hp = 200; gojo.stunTimer = 0; gojo.hitTimer = 0; gojo.hitStun = 0; gojo.isGrounded = true; gojo.afterimages = []; gojo.facing = -1; gojo.isAttacking = false; gojo.attackTimer = 0; gojo.blocking = false; gojo.landTimer = 0;
  gojo.currentMove = 'Infinity'; gojo.moveTimer = 0; gojo.actionCooldown = 0;
  gameOver = false;
  movingLeft = false;
  movingRight = false;
  shockwave = null;
  groundDebris = [];
  redBlast = null;
  blueBlast = null;
  purpleSequence = null;
  comboSequence = null;
  heavyComboSequence = null;
  tsunadeLightCombo = null;
  tsunadeHeavyCombo = null;
  tsunadeUltimate = null;
  scrambleTimer = 0;
  scrambleTarget = null;
  blackFlashEffect = null;
  acidProjectiles = [];
  katsuyuSummon = null;
  awakenedTimer = 0;
  particles = [];
  slashes = [];
  distortionRings = [];
  hitFlashes = [];
  chakraTrails = [];
  screenTint = null;
  screenShake = 0;
  hitStop = 0;
  aiBrain.plan = 'wait';
  aiBrain.planTimer = 0;
  aiBrain.lastDecision = 0;
  aiBrain.decisionCooldown = 0;
}

/* ============================================================
   SECTION 7: AI BRAIN
   ============================================================ */
function updateAIBrain(targetChar, aiChar, delta) {
  aiBrain.decisionCooldown -= delta;
  aiBrain.planTimer -= delta;

  if (aiBrain.decisionCooldown <= 0 || aiBrain.planTimer <= 0) {
    const dist = Math.abs(targetChar.x - aiChar.x);
    const r = Math.random();
    let newPlan = 'wait';

    if (dist > 300) {
      if (r < 0.7) newPlan = 'approach';
      else if (r < 0.85) newPlan = 'wait';
      else newPlan = 'ranged';
    } else if (dist > 150) {
      if (r < 0.45) newPlan = 'approach';
      else if (r < 0.7) newPlan = 'ranged';
      else if (r < 0.85) newPlan = 'wait';
      else newPlan = 'retreat';
    } else if (dist > 80) {
      if (r < 0.5) newPlan = 'approach';
      else if (r < 0.7) newPlan = 'strike';
      else if (r < 0.85) newPlan = 'wait';
      else newPlan = 'retreat';
    } else {
      if (r < 0.6) newPlan = 'strike';
      else if (r < 0.85) newPlan = 'retreat';
      else newPlan = 'wait';
    }

    if (aiChar.hp < 60) {
      if (r < 0.4) newPlan = 'retreat';
      else if (r < 0.6) newPlan = 'wait';
    }

    aiBrain.plan = newPlan;
    aiBrain.planDuration = 20 + Math.floor(Math.random() * 30);
    aiBrain.planTimer = aiBrain.planDuration;
    aiBrain.decisionCooldown = 25 + Math.floor(Math.random() * 25);
    aiBrain.targetX = targetChar.x;
  }
}

/* ============================================================
   SECTION 8: MAIN UPDATE LOOP
   ============================================================ */
function update(delta) {
  if (gameState !== 'FIGHT' || gameOver) return;

  if (hitStop > 0) {
    hitStop -= delta;
    if (screenShake > 0.1) screenShake *= 0.9; else screenShake = 0;
    return;
  }

  animTimer += delta;
  globalTime += delta;
  waveOffset = (waveOffset + 0.05 * delta) % (Math.PI * 2);
  cloudOffset = (cloudOffset + 0.25 * delta) % (W + 300);
  cloudOffset2 = (cloudOffset2 + 0.15 * delta) % (W + 400);
  fogOffset = (fogOffset + 0.15 * delta) % (W * 2);
  infinityPulse = (infinityPulse + 0.03 * delta) % (Math.PI * 2);
  if (screenShake > 0.1) screenShake *= Math.pow(0.85, delta); else screenShake = 0;
  if (screenTint) { screenTint.alpha -= screenTint.decay * delta; if (screenTint.alpha <= 0) screenTint = null; }

  const activePlayer = (playerChoice === 'tsunade') ? tsunade : gojo;
  const opponent = (playerChoice === 'tsunade') ? gojo : tsunade;

  activePlayer.facing = (opponent.x > activePlayer.x) ? 1 : -1;
  opponent.facing = (activePlayer.x > opponent.x) ? 1 : -1;

  const isHoldingBack = (activePlayer.facing === 1 && movingLeft) || (activePlayer.facing === -1 && movingRight);
  activePlayer.blocking = isHoldingBack && !activePlayer.isAttacking && activePlayer.hitStun <= 0;

  if (activePlayer.hitStun > 0) activePlayer.hitStun -= delta;
  if (activePlayer.isAttacking) {
    activePlayer.attackTimer -= delta;
    if (activePlayer.attackTimer <= 0) activePlayer.isAttacking = false;
  }

  if (activePlayer.hitStun <= 0 && !activePlayer.isAttacking) {
    if (movingLeft) { activePlayer.vx = -activePlayer.speed; if (activePlayer.isGrounded && Math.random() < 0.25 * delta) spawnDust(activePlayer.x + 24, ground.y, '#ffffff'); }
    else if (movingRight) { activePlayer.vx = activePlayer.speed; if (activePlayer.isGrounded && Math.random() < 0.25 * delta) spawnDust(activePlayer.x + 24, ground.y, '#ffffff'); }
    else activePlayer.vx = 0;
  } else {
    activePlayer.vx *= 0.7;
  }

  if (Math.abs(activePlayer.vx) > 3 && graphicsQuality !== 'low') {
    activePlayer.afterimages.push({ x: activePlayer.x, y: activePlayer.y, timer: 10, maxTimer: 10, facing: activePlayer.facing });
  }
  if (activePlayer.afterimages.length > 6) activePlayer.afterimages.shift();
  activePlayer.afterimages.forEach(a => a.timer -= delta);
  activePlayer.afterimages = activePlayer.afterimages.filter(a => a.timer > 0);

  updatePhysics(activePlayer, delta);

  if (playerChoice === 'tsunade' && activePlayer.isSpecial && activePlayer.isGrounded) {
    activePlayer.isSpecial = false;
    shockwave = { x: activePlayer.x + 24, radius: 10, alpha: 1.0, isHeavy: activePlayer.isAwakened };
    screenShake = 16;
    screenTint = { color: '0,255,204', alpha: 0.22, decay: 0.035 };
    spawnRing(activePlayer.x + 24, ground.y, '#00ffcc', 200);
    SFX.heavyHit();
    for (let i = 0; i < 14; i++) {
      groundDebris.push({ x: activePlayer.x + 24 + (Math.random() - 0.5) * 140, y: ground.y, vx: (Math.random() - 0.5) * 11, vy: -Math.random() * 9 - 2, size: Math.random() * 9 + 4, alpha: 1.0, rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3 });
    }
    const blastDist = Math.abs(activePlayer.x - gojo.x);
    const specialDmg = activePlayer.isAwakened ? 60 : 40;
    if (blastDist < (activePlayer.isAwakened ? 260 : 180) && gojo.currentMove !== 'Infinity') {
      dealDamage(activePlayer, gojo, specialDmg, (activePlayer.x < gojo.x ? 1 : -1) * 20, { heavy: true, sound: 'special', hitStun: 30, unblockable: true });
    }
  }

  if (gojo.moveTimer > 0) gojo.moveTimer -= delta;
  else if (gojo.stunTimer <= 0 && !purpleSequence && !comboSequence && !heavyComboSequence) gojo.currentMove = 'Infinity';

  if (gameMode === 'battle') {
    if (playerChoice === 'tsunade') {
      gojo.facing = tsunade.x > gojo.x ? 1 : -1;
      if (gojo.hitStun > 0) gojo.hitStun -= delta;

      updateAIBrain(tsunade, gojo, delta);

      if (gojo.stunTimer > 0) { gojo.stunTimer -= delta; gojo.vx = 0; gojo.currentMove = 'Stunned'; }
      else if (gojo.hitTimer <= 0 && gojo.hitStun <= 0) {
        const dist = Math.abs(tsunade.x - gojo.x);
        const faceDir = (gojo.x < tsunade.x) ? 1 : -1;

        if (gojo.moveTimer === 0 && !purpleSequence && !comboSequence && !heavyComboSequence) {
          gojo.vx = 0;
          if (gojo.actionCooldown <= 0) {
            const rand = Math.random();
            if (aiBrain.plan === 'approach') {
              gojo.vx = gojo.facing * gojo.speed;
              if (dist < 100 && rand < 0.4) {
                gojo.currentMove = 'Red'; gojo.moveTimer = 35; gojo.actionCooldown = 95;
                redBlast = { x: gojo.x + (faceDir * 20), y: gojo.y + 35, vx: faceDir * 8, radius: 22 };
                SFX.redCast();
              }
            } else if (aiBrain.plan === 'retreat') {
              gojo.vx = -gojo.facing * gojo.speed * 0.8;
            } else if (aiBrain.plan === 'strike') {
              if (dist < 110) {
                if (rand < 0.6) {
                  gojo.currentMove = 'Red'; gojo.moveTimer = 35; gojo.actionCooldown = 95;
                  redBlast = { x: gojo.x + (faceDir * 20), y: gojo.y + 35, vx: faceDir * 8, radius: 22 };
                  SFX.redCast();
                } else {
                  gojo.currentMove = 'Heavy Strike 1'; gojo.moveTimer = 25; gojo.actionCooldown = 90;
                  const distance = Math.abs((gojo.x + gojo.width/2) - (tsunade.x + tsunade.width/2));
                  if (distance < 100) {
                    dealDamage(gojo, tsunade, 10, (gojo.x < tsunade.x ? 1 : -1) * 6, { sound: 'light', hitStun: 14 });
                  }
                }
              } else {
                gojo.vx = gojo.facing * gojo.speed;
              }
            } else if (aiBrain.plan === 'ranged') {
              if (dist > 200 && rand < 0.85) {
                gojo.currentMove = 'Blue'; gojo.moveTimer = 45; gojo.actionCooldown = 110;
                const startX = gojo.x + (faceDir * 20);
                const targetX = (gojo.x + tsunade.x) / 2;
                const travelDist = Math.abs(targetX - startX);
                const velX = faceDir * Math.min(8, travelDist / 15);
                blueBlast = { x: startX, y: gojo.y + 35, startX, targetX, vx: velX, radius: 24, state: 'traveling', vortexTimer: 50, spinAngle: 0 };
                SFX.blueCast();
              } else if (dist < 140 && rand < 0.5) {
                gojo.currentMove = 'Red'; gojo.moveTimer = 35; gojo.actionCooldown = 95;
                redBlast = { x: gojo.x + (faceDir * 20), y: gojo.y + 35, vx: faceDir * 8, radius: 22 };
                SFX.redCast();
              } else {
                gojo.vx = -gojo.facing * gojo.speed * 0.5;
              }
            } else if (aiBrain.plan === 'wait') {
              gojo.vx = Math.sin(animTimer * 0.05) * 1.5;
            }

            if (gojo.hp < 70 && rand < 0.15 && !purpleSequence) {
              gojo.currentMove = 'Hollow Purple'; gojo.moveTimer = 220; gojo.actionCooldown = 240;
              const midScreenX = (gojo.x + tsunade.x) / 2;
              purpleSequence = { stage: 'blue_travel', blueX: gojo.x, redX: gojo.x, startY: gojo.y + 35, meetX: midScreenX, meetY: gojo.y + 35, facing: faceDir, timer: 0, charge: 0 };
              SFX.purpleCast();
            }
          }
          if (gojo.actionCooldown > 0) gojo.actionCooldown -= delta;
        }
      }
      updatePhysics(gojo, delta);
    } else {
      const distToGojo = gojo.x - tsunade.x;

      updateAIBrain(gojo, tsunade, delta);

      if (tsunade.hp < 120 && !tsunade.isAwakened && Math.abs(distToGojo) > 120 && Math.random() < 0.15) {
        tsunade.isAwakened = true; tsunade.speed = tsunade.baseSpeed * 1.4; awakenedTimer = 450; screenShake = 8;
        SFX.awaken();
        spawnSparks(tsunade.x, tsunade.y, '#00ffcc');
      }
      if (tsunade.hitStun > 0) tsunade.hitStun -= delta;
      if (tsunade.hitStun <= 0) {
        if (aiBrain.plan === 'approach') {
          tsunade.vx = distToGojo > 0 ? tsunade.speed : -tsunade.speed;
        } else if (aiBrain.plan === 'retreat') {
          tsunade.vx = distToGojo > 0 ? -tsunade.speed * 0.7 : tsunade.speed * 0.7;
        } else if (aiBrain.plan === 'strike') {
          if (Math.abs(distToGojo) > 75) {
            tsunade.vx = distToGojo > 0 ? tsunade.speed : -tsunade.speed;
          } else {
            tsunade.vx = 0;
            if (tsunade.attackCooldown <= 0) {
              tsunade.attackCooldown = tsunade.isAwakened ? 40 : 70;
              if (gojo.currentMove === 'Infinity') {
                gojo.hitTimer = 5;
                tsunade.knockbackVx = (tsunade.x < gojo.x ? -1 : 1) * 10;
              } else {
                dealDamage(tsunade, gojo, (tsunade.isAwakened ? 28 : 16), (tsunade.x < gojo.x ? 1 : -1) * 8, { sound: 'light', hitStun: 14 });
              }
            }
          }
        } else if (aiBrain.plan === 'wait') {
          tsunade.vx = Math.sin(animTimer * 0.06) * 1.2;
        } else {
          tsunade.vx = 0;
        }
      }
      if (tsunade.attackCooldown > 0) tsunade.attackCooldown -= delta;
      updatePhysics(tsunade, delta);
    }
  } else {
    const aiChar = (playerChoice === 'tsunade') ? gojo : tsunade;
    if (aiChar.hitTimer <= 0) aiChar.vx = 0;
    if (aiChar.hitStun > 0) aiChar.hitStun -= delta;
    updatePhysics(aiChar, delta);
    tsunade.hp = tsunade.maxHp;
    gojo.hp = gojo.maxHp;
  }

  if (comboSequence) {
    comboSequence.timer += delta;
    if (comboSequence.step === 2 && comboSequence.timer > 15 && !comboSequence.fired) {
      comboSequence.fired = true;
      hitStop = 8;
      screenShake = 22; screenTint = { color: '0,0,0', alpha: 0.5, decay: 0.05 };
      if (gameMode === 'battle') tsunade.hp -= 25;
      tsunade.knockbackVx = (gojo.x < tsunade.x ? 1 : -1) * 18;
      tsunade.vy = -8; tsunade.hitTimer = 40; tsunade.hitStun = 40;
      if (tsunade.hp < 0) tsunade.hp = 0;
      blackFlashEffect = { x: tsunade.x + 24, y: tsunade.y + 55, timer: 35, maxTimer: 35 };
      SFX.blackFlash();
      if (graphicsQuality !== 'low') spawnSparks(tsunade.x + 24, tsunade.y + 55, '#ff1a1a');
      comboSequence = null; gojo.currentMove = 'Infinity';
    } else if (comboSequence && comboSequence.step === 1 && comboSequence.timer > 60) { comboSequence = null; gojo.currentMove = 'Infinity'; }
  }

  if (heavyComboSequence) {
    heavyComboSequence.timer += delta;
    const faceDir = (gojo.x < tsunade.x) ? 1 : -1;

    if (heavyComboSequence.step === 2 && heavyComboSequence.timer > 30) {
      heavyComboSequence.step = 3; heavyComboSequence.timer = 0;
      gojo.currentMove = 'Blue Pull';
      const halfWayX = (gojo.x + tsunade.x) / 2;
      const startX = gojo.x + (faceDir * 20);
      const travelDist = Math.abs(halfWayX - startX);
      const velX = faceDir * Math.min(9, travelDist / 12);
      blueBlast = { x: startX, y: gojo.y + 35, startX, targetX: halfWayX, vx: velX, radius: 24, state: 'traveling', vortexTimer: 40, spinAngle: 0 };
      SFX.blueCast();
    } else if (heavyComboSequence.step === 3 && heavyComboSequence.timer > 45) {
      heavyComboSequence.step = 4; heavyComboSequence.timer = 0;
      heavyComboSequence.fired = false;
      gojo.currentMove = 'Black Flash Finisher';
      const targetOffsetDir = (gojo.x < tsunade.x) ? -1 : 1;
      gojo.x = tsunade.x + (targetOffsetDir * 42);
    } else if (heavyComboSequence.step === 4) {
      if (!heavyComboSequence.fired && heavyComboSequence.timer >= 1) {
        heavyComboSequence.fired = true;
        hitStop = 10;
        screenShake = 26; screenTint = { color: '0,0,0', alpha: 0.6, decay: 0.04 };
        if (gameMode === 'battle') tsunade.hp -= 45;
        tsunade.knockbackVx = faceDir * 24; tsunade.vy = -12; tsunade.hitTimer = 60; tsunade.hitStun = 50;
        if (tsunade.hp < 0) tsunade.hp = 0;
        blackFlashEffect = { x: tsunade.x + 24, y: tsunade.y + 55, timer: 40, maxTimer: 40 };
        SFX.blackFlash();
        if (graphicsQuality !== 'low') spawnSparks(tsunade.x + 24, tsunade.y + 55, '#ff1a1a');
      }
      if (heavyComboSequence.timer > 60) { heavyComboSequence = null; gojo.currentMove = 'Infinity'; }
    } else if (heavyComboSequence.step === 1 && heavyComboSequence.timer > 70) { heavyComboSequence = null; gojo.currentMove = 'Infinity'; }
  }

  if (redBlast) {
    redBlast.x += redBlast.vx * delta;
    if (graphicsQuality !== 'low') {
      if (Math.random() < 0.6 * delta) spawnSparks(redBlast.x, redBlast.y, '#ff1a1a');
      if (Math.random() < 0.5 * delta) particles.push({ x: redBlast.x + (Math.random()-0.5)*20, y: redBlast.y + (Math.random()-0.5)*20, vx: redBlast.vx * 0.3 + (Math.random()-0.5)*3, vy: (Math.random()-0.5)*3, alpha: 1, color: '#ff6600', size: Math.random()*7+3, life: 1 });
    }
    if (Math.abs(tsunade.x + 24 - redBlast.x) < redBlast.radius + 24) {
      dealDamage(gojo, tsunade, 20, (redBlast.vx > 0 ? 1 : -1) * 16, { heavy: true, sound: 'heavy', hitStun: 25 });
      tsunade.vy = -6;
      screenTint = { color: '255,40,40', alpha: 0.3, decay: 0.04 };
      spawnRing(redBlast.x, redBlast.y, '#ff1a1a', 140);
      redBlast = null;
    } else if (redBlast.x < -50 || redBlast.x > W + 50) redBlast = null;
  }

  if (blueBlast) {
    if (blueBlast.state === 'traveling') {
      blueBlast.x += blueBlast.vx * delta;
      blueBlast.spinAngle += 0.25 * delta;
      if (graphicsQuality !== 'low') {
        if (Math.random() < 0.8 * delta) spawnSparks(blueBlast.x, blueBlast.y, '#0099ff');
        if (graphicsQuality === 'high' && Math.random() < 0.5 * delta) {
          particles.push({ x: blueBlast.x + (Math.random()-0.5)*30, y: blueBlast.y + (Math.random()-0.5)*30, vx: -blueBlast.vx * 0.2 + (Math.random()-0.5), vy: (Math.random()-0.5), alpha: 1, color: '#66ccff', size: Math.random()*5+2, life: 1 });
        }
      }
      if (Math.abs(blueBlast.x - blueBlast.targetX) < 10) {
        blueBlast.state = 'vortex';
        if (gameMode === 'battle') tsunade.hp -= 15;
        tsunade.hitTimer = 35; tsunade.hitStun = 35;
        screenShake = 8;
        screenTint = { color: '0,150,255', alpha: 0.25, decay: 0.03 };
        spawnSparks(blueBlast.x, blueBlast.y, '#0099ff');
        spawnRing(blueBlast.x, blueBlast.y, '#00aaff', 120);
        SFX.lightHit();
      }
    } else if (blueBlast.state === 'vortex') {
      blueBlast.vortexTimer -= delta;
      blueBlast.spinAngle += 0.4 * delta;
      const tsunadeCenter = tsunade.x + 24;
      const pullDir = (blueBlast.x > tsunadeCenter) ? 1 : -1;
      tsunade.knockbackVx = pullDir * 8;
      tsunade.vy = -2;
      if (graphicsQuality !== 'low') {
        for (let i = 0; i < 2; i++) {
          if (Math.random() < 0.6 * delta) {
            const ang = Math.random() * Math.PI * 2;
            const dist = 60 + Math.random() * 40;
            particles.push({
              x: blueBlast.x + Math.cos(ang) * dist,
              y: blueBlast.y + Math.sin(ang) * dist,
              vx: -Math.cos(ang) * 3,
              vy: -Math.sin(ang) * 3,
              alpha: 1, color: '#66ccff', size: Math.random()*4+2, life: 1
            });
          }
        }
      }
      if (blueBlast.vortexTimer <= 0) blueBlast = null;
    }
  }

  if (purpleSequence) {
    purpleSequence.timer += delta;
    if (purpleSequence.stage === 'blue_travel') {
      purpleSequence.blueX += purpleSequence.facing * 6 * delta;
      if (graphicsQuality !== 'low') spawnSparks(purpleSequence.blueX, purpleSequence.startY, '#0099ff');
      if (purpleSequence.timer > 45) { purpleSequence.stage = 'red_travel'; purpleSequence.redX = gojo.x; purpleSequence.timer = 0; }
    } else if (purpleSequence.stage === 'red_travel') {
      purpleSequence.redX += purpleSequence.facing * 7 * delta;
      if (graphicsQuality !== 'low') spawnSparks(purpleSequence.redX, purpleSequence.startY, '#ff1a1a');
      if (Math.abs(purpleSequence.redX - purpleSequence.meetX) < 15) { purpleSequence.stage = 'mixing'; purpleSequence.timer = 0; }
    } else if (purpleSequence.stage === 'mixing') {
      purpleSequence.charge = Math.min(1, purpleSequence.timer / 50);
      if (graphicsQuality !== 'low') {
        for (let i = 0; i < 3; i++) {
          if (Math.random() < 0.7 * delta) {
            const a = Math.random() * Math.PI * 2;
            const d = 20 + Math.random() * 40;
            particles.push({ x: purpleSequence.meetX + Math.cos(a)*d, y: purpleSequence.meetY + Math.sin(a)*d, vx: -Math.cos(a)*2.5, vy: -Math.sin(a)*2.5, alpha: 1, color: '#b060ff', size: Math.random()*6+3, life: 1 });
          }
        }
      }
      if (purpleSequence.timer > 50) { purpleSequence.stage = 'firing'; screenTint = { color: '155,0,255', alpha: 0.5, decay: 0.02 }; screenShake = 14; SFX.purpleCast(); }
    } else if (purpleSequence.stage === 'firing') {
      purpleSequence.meetX += purpleSequence.facing * 10 * delta;
      if (graphicsQuality !== 'low') {
        if (Math.random() < 0.9 * delta) spawnSparks(purpleSequence.meetX, purpleSequence.meetY, '#9900ff');
        if (Math.random() < 0.7 * delta) particles.push({ x: purpleSequence.meetX + (Math.random()-0.5)*30, y: purpleSequence.meetY + (Math.random()-0.5)*30, vx: (Math.random()-0.5)*4, vy: (Math.random()-0.5)*4, alpha: 1, color: '#da70d6', size: Math.random()*8+4, life: 1 });
      }
      if (Math.abs(tsunade.x + 24 - purpleSequence.meetX) < 48) {
        dealDamage(gojo, tsunade, 45, purpleSequence.facing * 22, { heavy: true, sound: 'special', hitStun: 40, unblockable: true });
        tsunade.vy = -9;
        screenShake = 16; screenTint = { color: '155,0,255', alpha: 0.55, decay: 0.03 };
        spawnRing(purpleSequence.meetX, purpleSequence.meetY, '#c060ff', 180);
        purpleSequence = null; gojo.currentMove = 'Infinity';
      } else if (purpleSequence.meetX < -50 || purpleSequence.meetX > W + 50) { purpleSequence = null; gojo.currentMove = 'Infinity'; }
    }
  }

  if (blackFlashEffect) { blackFlashEffect.timer -= delta; if (blackFlashEffect.timer <= 0) blackFlashEffect = null; }

  if (katsuyuSummon) {
    katsuyuSummon.timer -= delta;
    katsuyuSummon.wobble += 0.1 * delta;
    if (tsunade.hp < tsunade.maxHp) { tsunade.hp += 0.4 * delta; if (tsunade.hp > tsunade.maxHp) tsunade.hp = tsunade.maxHp; }
    if (graphicsQuality !== 'low') {
      for (let i = 0; i < 2; i++) {
        if (Math.random() < 0.5 * delta) particles.push({ x: tsunade.x + Math.random() * tsunade.width, y: tsunade.y + Math.random() * tsunade.height, vx: (Math.random()-0.5)*2, vy: -Math.random()*3-1, alpha: 1, color: '#00ff66', size: Math.random()*5+3, life: 1 });
      }
    }
    katsuyuSummon.acidCooldown += delta;
    if (katsuyuSummon.acidCooldown >= 90) {
      katsuyuSummon.acidCooldown = 0;
      const acidDir = (gojo.x > katsuyuSummon.x) ? 1 : -1;
      const mouthOffset = acidDir === 1 ? 75 : 15;
      acidProjectiles.push({ x: katsuyuSummon.x + mouthOffset, y: ground.y - 40, vx: acidDir * 8, radius: 10, wobble: 0 });
    }
    if (katsuyuSummon.timer <= 0) katsuyuSummon = null;
  }

  for (let i = acidProjectiles.length - 1; i >= 0; i--) {
    const ap = acidProjectiles[i];
    ap.x += ap.vx * delta;
    ap.wobble += 0.3 * delta;
    if (graphicsQuality !== 'low' && Math.random() < 0.4 * delta) {
      particles.push({ x: ap.x, y: ap.y + 6, vx: (Math.random()-0.5)*1, vy: 1 + Math.random()*2, alpha: 1, color: '#ffcc00', size: Math.random()*3+1, life: 1 });
    }
    if (Math.abs((gojo.x + 24) - ap.x) < ap.radius + 15) {
      gojo.hp -= 15; gojo.hitTimer = 10; gojo.hitStun = 10;
      gojo.knockbackVx = (ap.vx > 0 ? 1 : -1) * 6;
      if (gojo.hp < 0) gojo.hp = 0;
      spawnSparks(gojo.x + 24, gojo.y + 55, '#ffcc00');
      SFX.lightHit();
      acidProjectiles.splice(i, 1);
    } else if (ap.x < -30 || ap.x > W + 30) acidProjectiles.splice(i, 1);
  }

  if (gojo.hitTimer > 0) gojo.hitTimer -= delta;
  if (tsunade.hitTimer > 0) tsunade.hitTimer -= delta;

  if (tsunade.isAwakened) {
    awakenedTimer -= delta;
    if (tsunade.hp < tsunade.maxHp) { tsunade.hp += 0.3 * delta; if (tsunade.hp > tsunade.maxHp) tsunade.hp = tsunade.maxHp; }
    if (graphicsQuality !== 'low' && Math.random() < 0.4 * delta) {
      chakraTrails.push({ x: tsunade.x + 24 + (Math.random()-0.5)*30, y: tsunade.y + 55 + (Math.random()-0.5)*60, vx: (Math.random()-0.5)*1.5, vy: -1 - Math.random()*2, alpha: 1, size: Math.random()*4+2 });
    }
    if (awakenedTimer <= 0) { tsunade.isAwakened = false; tsunade.speed = tsunade.baseSpeed; }
  }

  if (shockwave) { shockwave.radius += 14 * delta; shockwave.alpha -= 0.04 * delta; if (shockwave.alpha <= 0) shockwave = null; }

  for (let i = groundDebris.length - 1; i >= 0; i--) {
    const deb = groundDebris[i];
    deb.x += deb.vx * delta; deb.y += deb.vy * delta; deb.vy += 0.6 * delta; deb.alpha -= 0.025 * delta; deb.rot += deb.vr * delta;
    if (deb.alpha <= 0) groundDebris.splice(i, 1);
  }

  if (graphicsQuality !== 'low') {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * delta; p.y += p.vy * delta; p.vy += 0.08 * delta; p.alpha -= 0.028 * delta;
      if (p.alpha <= 0) particles.splice(i, 1);
    }
  }

  for (let i = slashes.length - 1; i >= 0; i--) {
    slashes[i].timer -= delta;
    if (slashes[i].timer <= 0) slashes.splice(i, 1);
  }
  for (let i = distortionRings.length - 1; i >= 0; i--) {
    const r = distortionRings[i];
    r.r += ((r.maxR - r.r) * 0.18 + 2) * delta;
    r.alpha -= 0.045 * delta;
    if (r.alpha <= 0) distortionRings.splice(i, 1);
  }
  for (let i = hitFlashes.length - 1; i >= 0; i--) {
    hitFlashes[i].timer -= delta;
    if (hitFlashes[i].timer <= 0) hitFlashes.splice(i, 1);
  }
  for (let i = chakraTrails.length - 1; i >= 0; i--) {
    const c = chakraTrails[i];
    c.x += c.vx * delta; c.y += c.vy * delta; c.alpha -= 0.03 * delta;
    if (c.alpha <= 0) chakraTrails.splice(i, 1);
  }

  if (gameMode === 'battle') {
    if (gojo.hp <= 0) { gameOver = true; winnerText = 'K.O. — TSUNADE SENJU WINS!'; SFX.ko(); }
    else if (tsunade.hp <= 0) { gameOver = true; winnerText = 'K.O. — SATORU GOJO WINS!'; SFX.ko(); }
  }
}

/* ============================================================
   SECTION 9: DRAWING - CHARACTERS
   ============================================================ */

function drawTsunadeBody(char) {
  const breath = char.isGrounded ? Math.sin(animTimer * 0.15) * 2 : 0;
  const isMoving = Math.abs(char.vx) > 0.1 && char.isGrounded;
  const walkCycle = isMoving ? Math.sin(animTimer * 0.4) * 7 : 0;
  const cx = char.x + char.width / 2;
  const cy = char.y + breath;
  const faceDir = char.facing || 1;
  const tint = char.hitTimer > 0 ? 'rgba(255,80,80,0.55)' : null;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(faceDir, 1);

  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(0, ground.y - cy + 4, 30, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  if (char.blocking) {
    ctx.strokeStyle = 'rgba(150,220,255,0.9)';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#88ddff';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(-14, 45, 55, -Math.PI * 0.6, Math.PI * 0.6);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  if (char.isAwakened) {
    ctx.save();
    const auraPulse = 1 + Math.sin(animTimer * 0.18) * 0.12;
    const grd = ctx.createRadialGradient(0, 55, 10, 0, 55, 75 * auraPulse);
    grd.addColorStop(0, 'rgba(0,255,204,0.45)');
    grd.addColorStop(0.6, 'rgba(155,0,255,0.25)');
    grd.addColorStop(1, 'rgba(0,255,204,0)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.ellipse(0, 55, 65 * auraPulse, 90 * auraPulse, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.fillStyle = tint || '#3d3d3d';
  ctx.beginPath();
  ctx.moveTo(-14, 55); ctx.lineTo(-18 + walkCycle, 108); ctx.lineTo(-4 + walkCycle, 108); ctx.lineTo(-2, 55); ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(2, 55); ctx.lineTo(4 - walkCycle, 108); ctx.lineTo(18 - walkCycle, 108); ctx.lineTo(14, 55); ctx.closePath(); ctx.fill();

  ctx.fillStyle = tint || '#1b1b1b';
  ctx.fillRect(-19 + walkCycle, 105, 16, 5);
  ctx.fillRect(3 - walkCycle, 105, 16, 5);

  ctx.fillStyle = tint || '#0f7a5c';
  ctx.beginPath();
  ctx.moveTo(-16, 22); ctx.lineTo(-18, 60); ctx.lineTo(18, 60); ctx.lineTo(16, 22); ctx.closePath(); ctx.fill();

  ctx.fillStyle = tint || '#f4ecd8';
  ctx.beginPath();
  ctx.moveTo(-12, 22); ctx.lineTo(0, 46); ctx.lineTo(12, 22); ctx.closePath(); ctx.fill();

  ctx.fillStyle = tint || '#6a3d8f';
  ctx.fillRect(-17, 52, 34, 6);

  ctx.fillStyle = tint || '#0f7a5c';
  if (char.isAttacking || char.isSpecial || char.isSkill) {
    ctx.fillRect(10, 28, 32, 9);
    ctx.fillStyle = '#f4ecd8';
    ctx.beginPath(); ctx.arc(44, 32, 8, 0, Math.PI * 2); ctx.fill();
    ctx.save();
    ctx.fillStyle = '#00ffcc'; ctx.shadowColor = '#00ffcc'; ctx.shadowBlur = 20;
    ctx.beginPath(); ctx.arc(46, 32, 6, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.fillStyle = tint || '#0f7a5c';
    ctx.fillRect(-20, 26, 10, 26);
  } else {
    ctx.fillRect(-20, 26, 10, 30);
    ctx.fillRect(10, 26, 10, 30);
    ctx.fillStyle = '#f4ecd8';
    ctx.beginPath(); ctx.arc(-15, 58, 5, 0, Math.PI * 2); ctx.arc(15, 58, 5, 0, Math.PI * 2); ctx.fill();
  }

  ctx.fillStyle = tint || '#f4d5a4';
  ctx.fillRect(-4, 14, 8, 10);
  ctx.beginPath(); ctx.arc(0, 4, 12, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = tint || '#e8c14a';
  ctx.beginPath(); ctx.arc(0, -2, 13, Math.PI, Math.PI * 2); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-12, -2); ctx.lineTo(-14, 26); ctx.lineTo(-8, 24); ctx.lineTo(-6, -2); ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(12, -2); ctx.lineTo(14, 26); ctx.lineTo(8, 24); ctx.lineTo(6, -2); ctx.closePath(); ctx.fill();
  ctx.fillStyle = tint || '#f5d96e';
  ctx.beginPath(); ctx.arc(-4, -6, 4, 0, Math.PI * 2); ctx.arc(4, -8, 4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = tint || '#e8c14a';
  ctx.beginPath();
  ctx.moveTo(-13, 2); ctx.quadraticCurveTo(-30, 12, -28, 42); ctx.quadraticCurveTo(-22, 40, -18, 24); ctx.quadraticCurveTo(-15, 12, -13, 2); ctx.fill();

  ctx.fillStyle = '#9b00ff';
  ctx.save();
  ctx.shadowColor = '#9b00ff';
  ctx.shadowBlur = char.isAwakened ? 18 : 6;
  ctx.beginPath();
  ctx.moveTo(0, -4); ctx.lineTo(3, 0); ctx.lineTo(0, 4); ctx.lineTo(-3, 0); ctx.closePath(); ctx.fill();
  ctx.restore();

  ctx.fillStyle = '#3a1f0f';
  ctx.beginPath(); ctx.arc(-4, 4, 1.6, 0, Math.PI * 2); ctx.arc(5, 4, 1.6, 0, Math.PI * 2); ctx.fill();

  ctx.restore();
}

function drawGojoBody(char) {
  const breath = char.isGrounded ? Math.sin(animTimer * 0.15) * 2 : 0;
  const isMoving = Math.abs(char.vx) > 0.1 && char.isGrounded;
  const walkCycle = isMoving ? Math.sin(animTimer * 0.4) * 7 : 0;
  const cx = char.x + char.width / 2;
  const cy = char.y + breath;
  const faceDir = char.facing || -1;
  const tint = char.hitTimer > 0 ? 'rgba(255,80,80,0.5)' : null;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(faceDir, 1);

  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.ellipse(0, ground.y - cy + 4, 30, 7, 0, 0, Math.PI * 2); ctx.fill();

  if (char.blocking) {
    ctx.strokeStyle = 'rgba(150,220,255,0.9)';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#88ddff';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(-14, 45, 55, -Math.PI * 0.6, Math.PI * 0.6);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  ctx.fillStyle = tint || '#c9ccd2';
  ctx.beginPath();
  ctx.moveTo(-13, 55); ctx.lineTo(-17 + walkCycle, 105); ctx.lineTo(-3 + walkCycle, 105); ctx.lineTo(-2, 55); ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(2, 55); ctx.lineTo(3 - walkCycle, 105); ctx.lineTo(17 - walkCycle, 105); ctx.lineTo(13, 55); ctx.closePath(); ctx.fill();

  ctx.fillStyle = tint || 'rgba(120,130,145,0.35)';
  ctx.beginPath();
  ctx.moveTo(-13, 55); ctx.lineTo(-17 + walkCycle, 105); ctx.lineTo(-10 + walkCycle, 105); ctx.lineTo(-7, 55); ctx.closePath(); ctx.fill();

  ctx.fillStyle = tint || '#a8abb3';
  ctx.fillRect(-18 + walkCycle, 100, 16, 5);
  ctx.fillRect(2 - walkCycle, 100, 16, 5);

  ctx.fillStyle = tint || '#111111';
  ctx.beginPath(); ctx.ellipse(-10 + walkCycle, 108, 9, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(10 - walkCycle, 108, 9, 4, 0, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = tint || '#1a1a1a';
  ctx.beginPath();
  ctx.moveTo(-15, 20); ctx.lineTo(-17, 58); ctx.lineTo(17, 58); ctx.lineTo(15, 20); ctx.closePath(); ctx.fill();

  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, 28); ctx.lineTo(0, 50);
  ctx.moveTo(-6, 34); ctx.lineTo(6, 34);
  ctx.moveTo(-6, 42); ctx.lineTo(6, 42);
  ctx.stroke();

  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fillRect(-15, 22, 5, 32);

  ctx.fillStyle = tint || '#1a2b4a';
  ctx.fillRect(-17, 55, 34, 5);
  ctx.beginPath(); ctx.arc(0, 57.5, 3.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(0, 57.5); ctx.lineTo(-8, 51); ctx.lineTo(-10, 60); ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(0, 57.5); ctx.lineTo(8, 51); ctx.lineTo(10, 60); ctx.closePath(); ctx.fill();
  ctx.fillRect(-2, 60, 2, 12);
  ctx.fillRect(1, 60, 2, 14);

  if (char.isAttacking) {
    ctx.fillStyle = tint || '#1a1a1a';
    ctx.beginPath();
    ctx.moveTo(11, 24); ctx.lineTo(40, 26); ctx.lineTo(40, 34); ctx.lineTo(11, 36); ctx.closePath(); ctx.fill();
    ctx.fillStyle = tint || '#f0d5b0';
    ctx.beginPath();
    ctx.moveTo(28, 26); ctx.lineTo(46, 27); ctx.lineTo(46, 35); ctx.lineTo(28, 34); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(48, 31, 5.5, 0, Math.PI * 2); ctx.fill();
    ctx.save();
    ctx.fillStyle = 'rgba(180,100,255,0.7)';
    ctx.shadowColor = '#a855f7';
    ctx.shadowBlur = 22;
    ctx.beginPath(); ctx.arc(48, 31, 6, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.fillStyle = tint || '#1a1a1a';
    ctx.beginPath();
    ctx.moveTo(-19, 24); ctx.lineTo(-12, 24); ctx.lineTo(-12, 52); ctx.lineTo(-19, 52); ctx.closePath(); ctx.fill();
    ctx.fillStyle = tint || '#f0d5b0';
    ctx.beginPath(); ctx.arc(-15.5, 55, 5, 0, Math.PI * 2); ctx.fill();
  } else {
    ctx.fillStyle = tint || '#1a1a1a';
    ctx.beginPath();
    ctx.moveTo(-19, 22); ctx.lineTo(-11, 22); ctx.lineTo(-11, 38); ctx.lineTo(-19, 38); ctx.closePath(); ctx.fill();
    ctx.fillStyle = tint || '#f0d5b0';
    ctx.beginPath();
    ctx.moveTo(-18, 36); ctx.lineTo(-12, 36); ctx.lineTo(-12, 56); ctx.lineTo(-18, 56); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(-15, 58, 4.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = tint || '#1a1a1a';
    ctx.beginPath();
    ctx.moveTo(11, 22); ctx.lineTo(19, 22); ctx.lineTo(19, 38); ctx.lineTo(11, 38); ctx.closePath(); ctx.fill();
    ctx.fillStyle = tint || '#f0d5b0';
    ctx.beginPath();
    ctx.moveTo(12, 36); ctx.lineTo(18, 36); ctx.lineTo(18, 56); ctx.lineTo(12, 56); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(15, 58, 4.5, 0, Math.PI * 2); ctx.fill();
  }

  ctx.fillStyle = tint || '#f0d5b0';
  ctx.fillRect(-4, 12, 8, 10);
  ctx.beginPath(); ctx.arc(0, 2, 13, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = 'rgba(180,140,110,0.35)';
  ctx.beginPath(); ctx.arc(0, 6, 11, 0.2, Math.PI - 0.2); ctx.fill();

  ctx.fillStyle = tint || '#f0f4f8';
  ctx.beginPath();
  ctx.moveTo(-13, 2); ctx.lineTo(-15, -4); ctx.lineTo(-12, -9); ctx.lineTo(-8, -13); ctx.lineTo(-4, -16); ctx.lineTo(0, -18); ctx.lineTo(4, -16); ctx.lineTo(8, -13); ctx.lineTo(12, -9); ctx.lineTo(15, -4); ctx.lineTo(13, 2); ctx.closePath(); ctx.fill();

  ctx.beginPath();
  ctx.moveTo(-10, -6); ctx.lineTo(-15, -16); ctx.lineTo(-6, -8);
  ctx.moveTo(-3, -10); ctx.lineTo(-2, -22); ctx.lineTo(3, -11);
  ctx.moveTo(5, -8); ctx.lineTo(11, -18); ctx.lineTo(9, -5);
  ctx.moveTo(10, -4); ctx.lineTo(16, -12); ctx.lineTo(14, -1);
  ctx.fill();

  ctx.fillStyle = 'rgba(180,160,220,0.45)';
  ctx.beginPath();
  ctx.moveTo(-12, 0); ctx.lineTo(-14, -6); ctx.lineTo(-6, -4); ctx.lineTo(-3, -8); ctx.lineTo(2, -5); ctx.lineTo(8, -7); ctx.lineTo(13, -4); ctx.lineTo(12, 2); ctx.closePath(); ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.ellipse(-5, 4, 2.5, 2, 0, 0, Math.PI * 2); ctx.ellipse(6, 4, 2.5, 2, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#5fc8e8';
  ctx.beginPath(); ctx.arc(-5, 4.5, 1.5, 0, Math.PI * 2); ctx.arc(6, 4.5, 1.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#0a2a3a';
  ctx.beginPath(); ctx.arc(-5, 4.5, 0.7, 0, Math.PI * 2); ctx.arc(6, 4.5, 0.7, 0, Math.PI * 2); ctx.fill();

  ctx.strokeStyle = tint || '#d8dfe8';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-8, 1); ctx.lineTo(-3, 1.5);
  ctx.moveTo(3, 1.5); ctx.lineTo(8, 1);
  ctx.stroke();

  ctx.strokeStyle = '#7a4030';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(0, 8, 3, 0.1, Math.PI - 0.5); ctx.stroke();

  if (char.currentMove === 'Black Flash!') {
    ctx.save();
    ctx.fillStyle = 'rgba(255,30,30,0.6)';
    ctx.shadowColor = '#ff1a1a';
    ctx.shadowBlur = 30;
    ctx.beginPath(); ctx.arc(48, 31, 12, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  ctx.restore();
}

function drawInfinity(char) {
  const cx = char.x + 24;
  const cy = char.y + 55;
  const t = animTimer * 0.02;
  ctx.save();
  ctx.translate(cx, cy);

  ctx.strokeStyle = 'rgba(150,230,255,0.35)';
  ctx.shadowColor = '#88ddff';
  ctx.shadowBlur = 8;
  ctx.lineWidth = 1;
  ctx.rotate(t);
  for (let ring = 1; ring <= 3; ring++) {
    const r = 22 * ring;
    ctx.globalAlpha = 0.4 / ring;
    ctx.beginPath();
    for (let i = 0; i <= 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  ctx.rotate(-t * 2);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.sin(infinityPulse + i) * 0.15;
    const r1 = 30 + Math.sin(t * 3 + i) * 4;
    const r2 = r1 + 6;
    ctx.strokeStyle = 'rgba(180,240,255,0.4)';
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
    ctx.lineTo(Math.cos(a) * r2, Math.sin(a) * r2);
    ctx.stroke();
  }

  ctx.rotate(t * 0.5);
  ctx.setLineDash([4, 6]);
  ctx.strokeStyle = 'rgba(150,230,255,0.5)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(0, 0, 60, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.restore();
}

function drawAfterimages(char, drawFn) {
  if (graphicsQuality === 'low') return;
  char.afterimages.forEach(a => {
    ctx.save();
    ctx.globalAlpha = (a.timer / a.maxTimer) * 0.3;
    drawFn({ ...char, x: a.x, y: a.y, facing: a.facing, hitTimer: 0, isAwakened: false, blocking: false });
    ctx.restore();
  });
}

/* ============================================================
   SECTION 10: DRAWING - EFFECTS
   ============================================================ */

function drawBlackFlash(effect) {
  const p = effect.timer / effect.maxTimer;
  const bx = effect.x, by = effect.y;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = 'rgba(0,0,0,0.95)';
  ctx.shadowColor = '#ff1a1a';
  ctx.shadowBlur = 40;
  ctx.beginPath(); ctx.arc(bx, by, 20 * p + 8, 0, Math.PI * 2); ctx.fill();

  ctx.strokeStyle = '#ff1a1a';
  ctx.lineWidth = 3;
  ctx.shadowColor = '#ff0000';
  ctx.shadowBlur = 20;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + animTimer * 0.1;
    const len = 40 + p * 60;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    let x = bx, y = by;
    for (let s = 0; s < 4; s++) {
      x += Math.cos(a) * (len / 4) + (Math.random() - 0.5) * 15;
      y += Math.sin(a) * (len / 4) + (Math.random() - 0.5) * 15;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  ctx.strokeStyle = `rgba(255,26,26,${p})`;
  ctx.lineWidth = 5;
  ctx.beginPath(); ctx.arc(bx, by, (1 - p) * 180 + 20, 0, Math.PI * 2); ctx.stroke();

  if (effect.timer > effect.maxTimer - 4) {
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath(); ctx.arc(bx, by, 60, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function drawBlueBlast(b) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  if (b.state === 'traveling') {
    const grd = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.radius * 2.5);
    grd.addColorStop(0, 'rgba(255,255,255,0.9)');
    grd.addColorStop(0.3, 'rgba(0,180,255,0.85)');
    grd.addColorStop(0.7, 'rgba(0,100,220,0.4)');
    grd.addColorStop(1, 'rgba(0,50,150,0)');
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.radius * 2.5, 0, Math.PI * 2); ctx.fill();

    ctx.save();
    ctx.translate(b.x, b.y); ctx.rotate(b.spinAngle);
    for (let i = 0; i < 3; i++) {
      ctx.strokeStyle = `rgba(120,220,255,${0.7 - i * 0.2})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, b.radius * (0.6 + i * 0.25), i * 1.5, i * 1.5 + Math.PI * 1.5); ctx.stroke();
    }
    ctx.restore();

    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#00aaff';
    ctx.shadowBlur = 25;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.radius * 0.55, 0, Math.PI * 2); ctx.fill();
  } else if (b.state === 'vortex') {
    const pulse = 1 + Math.sin(animTimer * 0.4) * 0.15;
    const r = (b.radius + 15) * pulse;
    const grd = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, r * 2);
    grd.addColorStop(0, 'rgba(255,255,255,0.85)');
    grd.addColorStop(0.35, 'rgba(0,180,255,0.6)');
    grd.addColorStop(1, 'rgba(0,80,200,0)');
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.arc(b.x, b.y, r * 2, 0, Math.PI * 2); ctx.fill();

    ctx.save();
    ctx.translate(b.x, b.y); ctx.rotate(-animTimer * 0.08);
    for (let i = 0; i < 4; i++) {
      ctx.strokeStyle = `rgba(150,220,255,${0.6 - i * 0.12})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      const rStart = r * 1.8, rEnd = r * 0.5;
      for (let t = 0; t <= 1; t += 0.1) {
        const rr = rStart * (1 - t) + rEnd * t;
        const a = i * (Math.PI / 2) + t * Math.PI * 2;
        const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
        if (t === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();

    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#00aaff';
    ctx.shadowBlur = 30;
    ctx.beginPath(); ctx.arc(b.x, b.y, 12 * pulse, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function drawRedBlast(b) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const grd = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.radius * 2.8);
  grd.addColorStop(0, 'rgba(255,255,255,0.95)');
  grd.addColorStop(0.25, 'rgba(255,80,80,0.85)');
  grd.addColorStop(0.6, 'rgba(220,0,0,0.5)');
  grd.addColorStop(1, 'rgba(120,0,0,0)');
  ctx.fillStyle = grd;
  ctx.beginPath(); ctx.arc(b.x, b.y, b.radius * 2.8, 0, Math.PI * 2); ctx.fill();

  ctx.strokeStyle = '#ff5050';
  ctx.lineWidth = 3;
  ctx.shadowColor = '#ff0000';
  ctx.shadowBlur = 18;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const r1 = b.radius;
    const r2 = b.radius * (1.4 + Math.random() * 0.4);
    ctx.beginPath();
    ctx.moveTo(b.x + Math.cos(a) * r1, b.y + Math.sin(a) * r1);
    ctx.lineTo(b.x + Math.cos(a) * r2, b.y + Math.sin(a) * r2);
    ctx.stroke();
  }

  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(b.x, b.y, b.radius * 0.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawPurpleSequence(seq) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  if (seq.stage === 'blue_travel') {
    const grd = ctx.createRadialGradient(seq.blueX, seq.startY, 0, seq.blueX, seq.startY, 40);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.4, 'rgba(0,150,255,0.9)');
    grd.addColorStop(1, 'rgba(0,80,200,0)');
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.arc(seq.blueX, seq.startY, 40, 0, Math.PI * 2); ctx.fill();
  } else if (seq.stage === 'red_travel') {
    const grd1 = ctx.createRadialGradient(seq.blueX, seq.startY, 0, seq.blueX, seq.startY, 35);
    grd1.addColorStop(0, 'rgba(255,255,255,1)');
    grd1.addColorStop(0.4, 'rgba(0,150,255,0.9)');
    grd1.addColorStop(1, 'rgba(0,80,200,0)');
    ctx.fillStyle = grd1;
    ctx.beginPath(); ctx.arc(seq.blueX, seq.startY, 35, 0, Math.PI * 2); ctx.fill();

    const grd2 = ctx.createRadialGradient(seq.redX, seq.startY, 0, seq.redX, seq.startY, 35);
    grd2.addColorStop(0, 'rgba(255,255,255,1)');
    grd2.addColorStop(0.4, 'rgba(255,80,80,0.9)');
    grd2.addColorStop(1, 'rgba(200,0,0,0)');
    ctx.fillStyle = grd2;
    ctx.beginPath(); ctx.arc(seq.redX, seq.startY, 35, 0, Math.PI * 2); ctx.fill();
  } else if (seq.stage === 'mixing') {
    const charge = seq.charge || 0;
    const r = 30 + charge * 30;
    const grd = ctx.createRadialGradient(seq.meetX, seq.meetY, 0, seq.meetX, seq.meetY, r * 1.8);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.25, 'rgba(220,140,255,0.95)');
    grd.addColorStop(0.55, 'rgba(155,0,255,0.7)');
    grd.addColorStop(1, 'rgba(80,0,120,0)');
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.arc(seq.meetX, seq.meetY, r * 1.8, 0, Math.PI * 2); ctx.fill();

    for (let i = 0; i < 4; i++) {
      const a = animTimer * 0.15 + i * Math.PI / 2;
      const ox = seq.meetX + Math.cos(a) * r * 0.9;
      const oy = seq.meetY + Math.sin(a) * r * 0.9;
      ctx.fillStyle = i % 2 ? '#00aaff' : '#ff3030';
      ctx.shadowColor = i % 2 ? '#00aaff' : '#ff3030';
      ctx.shadowBlur = 15;
      ctx.beginPath(); ctx.arc(ox, oy, 6, 0, Math.PI * 2); ctx.fill();
    }
  } else if (seq.stage === 'firing') {
    const beamH = 60;
    const grd = ctx.createLinearGradient(0, seq.meetY - beamH, 0, seq.meetY + beamH);
    grd.addColorStop(0, 'rgba(155,0,255,0)');
    grd.addColorStop(0.35, 'rgba(180,80,255,0.85)');
    grd.addColorStop(0.5, 'rgba(255,255,255,1)');
    grd.addColorStop(0.65, 'rgba(180,80,255,0.85)');
    grd.addColorStop(1, 'rgba(155,0,255,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(seq.facing === 1 ? -W : seq.meetX - 40, seq.meetY - beamH, W, beamH * 2);

    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#c060ff';
    ctx.shadowBlur = 50;
    ctx.fillRect(seq.facing === 1 ? -W : seq.meetX - 30, seq.meetY - 12, W, 24);

    const grd2 = ctx.createRadialGradient(seq.meetX, seq.meetY, 0, seq.meetX, seq.meetY, 60);
    grd2.addColorStop(0, 'rgba(255,255,255,1)');
    grd2.addColorStop(0.3, 'rgba(220,140,255,1)');
    grd2.addColorStop(0.6, 'rgba(155,0,255,0.7)');
    grd2.addColorStop(1, 'rgba(80,0,120,0)');
    ctx.fillStyle = grd2;
    ctx.beginPath(); ctx.arc(seq.meetX, seq.meetY, 60, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function drawKatsuyu(k) {
  const kx = k.x, ky = ground.y;
  const facingGojo = (gojo.x > kx) ? 1 : -1;
  ctx.save();
  ctx.translate(kx + 50, ky);
  if (facingGojo === -1) ctx.scale(-1, 1);
  const wobble = Math.sin(k.wobble) * 3;

  ctx.fillStyle = '#e2ecf2';
  ctx.strokeStyle = '#b8ccdb';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(0, -22, 52 + wobble, 26 + wobble * 0.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

  ctx.fillStyle = '#2b5a84';
  ctx.beginPath(); ctx.ellipse(-20, -22, 14, 12, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(10, -30, 10, 8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(28, -18, 8, 7, 0, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = '#e2ecf2';
  ctx.beginPath(); ctx.arc(-28, -30, 18, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#b8ccdb'; ctx.stroke();

  ctx.strokeStyle = '#c5d8e5'; ctx.lineWidth = 4; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-36, -42); ctx.lineTo(-44, -56);
  ctx.moveTo(-20, -44); ctx.lineTo(-14, -58);
  ctx.stroke();

  ctx.fillStyle = '#2b5a84';
  ctx.beginPath(); ctx.arc(-44, -56, 4, 0, Math.PI * 2); ctx.arc(-14, -58, 4, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath(); ctx.arc(-34, -32, 3, 0, Math.PI * 2); ctx.arc(-22, -32, 3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(-33, -33, 1, 0, Math.PI * 2); ctx.arc(-21, -33, 1, 0, Math.PI * 2); ctx.fill();

  ctx.strokeStyle = '#666'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(-28, -24, 5, 0.2, Math.PI - 0.2); ctx.stroke();
  ctx.restore();
}

function drawAcid(ap) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const grd = ctx.createRadialGradient(ap.x, ap.y, 0, ap.x, ap.y, ap.radius * 2);
  grd.addColorStop(0, 'rgba(255,255,180,1)');
  grd.addColorStop(0.4, 'rgba(255,220,50,0.9)');
  grd.addColorStop(1, 'rgba(200,120,0,0)');
  ctx.fillStyle = grd;
  ctx.beginPath(); ctx.arc(ap.x, ap.y, ap.radius * 2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff580';
  ctx.beginPath(); ctx.arc(ap.x, ap.y, ap.radius * 0.6, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawSlash(s) {
  const p = s.timer / s.maxTimer;
  ctx.save();
  ctx.translate(s.x, s.y); ctx.rotate(s.angle); ctx.scale(s.dir, 1);
  ctx.globalAlpha = p;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 4;
  ctx.shadowColor = '#ffffff';
  ctx.shadowBlur = 15;
  ctx.beginPath(); ctx.moveTo(-25, -18); ctx.lineTo(25, 18); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,200,0.7)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-30, -8); ctx.lineTo(30, 8); ctx.stroke();
  ctx.restore();
}

/* ============================================================
   SECTION 11: DRAWING - BACKGROUND
   ============================================================ */

function drawCloud(x, y, scale) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.arc(0, 0, 28, 0, Math.PI * 2);
  ctx.arc(28, -8, 34, 0, Math.PI * 2);
  ctx.arc(60, 0, 26, 0, Math.PI * 2);
  ctx.arc(30, 8, 30, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(230,240,255,0.6)';
  ctx.beginPath();
  ctx.arc(28, 10, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawBackground() {
  const skyGrad = ctx.createLinearGradient(0, 0, 0, ground.y);
  skyGrad.addColorStop(0, '#4fb8e8');
  skyGrad.addColorStop(0.4, '#7fd0f0');
  skyGrad.addColorStop(0.75, '#c0e8f5');
  skyGrad.addColorStop(1, '#f0e8c8');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, W, ground.y);

  ctx.save();
  const sunX = W * 0.78;
  const sunY = 110;
  const sunR = 55;
  const sunGlow = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunR * 3);
  sunGlow.addColorStop(0, 'rgba(255,250,200,0.9)');
  sunGlow.addColorStop(0.3, 'rgba(255,240,160,0.4)');
  sunGlow.addColorStop(1, 'rgba(255,240,160,0)');
  ctx.fillStyle = sunGlow;
  ctx.beginPath(); ctx.arc(sunX, sunY, sunR * 3, 0, Math.PI * 2); ctx.fill();

  const sunGrd = ctx.createRadialGradient(sunX - 10, sunY - 10, 0, sunX, sunY, sunR);
  sunGrd.addColorStop(0, 'rgba(255,255,240,1)');
  sunGrd.addColorStop(0.6, 'rgba(255,245,180,1)');
  sunGrd.addColorStop(1, 'rgba(255,220,120,0.95)');
  ctx.fillStyle = sunGrd;
  ctx.beginPath(); ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  if (graphicsQuality !== 'low') {
    drawCloud(cloudOffset, 90, 1.0);
    drawCloud((cloudOffset * 0.7 + 300) % (W + 400) - 200, 140, 0.75);
    drawCloud((cloudOffset2 * 0.5 + 600) % (W + 500) - 250, 60, 0.6);
    drawCloud((cloudOffset2 * 0.9 + 100) % (W + 450) - 220, 170, 0.5);
  }

  ctx.fillStyle = 'rgba(120,150,180,0.55)';
  ctx.beginPath();
  ctx.moveTo(0, ground.y);
  for (let x = 0; x <= W; x += 20) {
    const y = ground.y - 150 + Math.sin(x * 0.004) * 50 + Math.sin(x * 0.011) * 25;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(W, ground.y);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = 'rgba(90,120,150,0.75)';
  ctx.beginPath();
  ctx.moveTo(0, ground.y);
  for (let x = 0; x <= W; x += 20) {
    const y = ground.y - 100 + Math.sin(x * 0.006 + 1.5) * 55 + Math.sin(x * 0.016) * 22;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(W, ground.y);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  for (let x = 0; x <= W; x += 20) {
    const y = ground.y - 100 + Math.sin(x * 0.006 + 1.5) * 55 + Math.sin(x * 0.016) * 22;
    const nextX = x + 20;
    const nextY = ground.y - 100 + Math.sin(nextX * 0.006 + 1.5) * 55 + Math.sin(nextX * 0.016) * 22;
    if (nextY < y && y < ground.y - 150) {
      ctx.fillRect(x, y, 22, 6);
    }
  }

  ctx.fillStyle = 'rgba(80,110,70,0.9)';
  ctx.beginPath();
  ctx.moveTo(0, ground.y);
  for (let x = 0; x <= W; x += 20) {
    const y = ground.y - 40 + Math.sin(x * 0.008) * 20 + Math.sin(x * 0.02) * 10;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(W, ground.y);
  ctx.closePath();
  ctx.fill();

  const groundGrad = ctx.createLinearGradient(0, ground.y, 0, ground.y + ground.height);
  groundGrad.addColorStop(0, '#e8c896');
  groundGrad.addColorStop(0.1, '#c9a068');
  groundGrad.addColorStop(1, '#6a4a28');
  ctx.fillStyle = groundGrad;
  ctx.fillRect(0, ground.y, W, ground.height);

  ctx.fillStyle = 'rgba(255,240,180,0.75)';
  ctx.fillRect(0, ground.y, W, 4);

  ctx.strokeStyle = 'rgba(90,60,30,0.3)';
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 42) {
    ctx.beginPath();
    ctx.moveTo(x, ground.y + 8);
    ctx.lineTo(x + 24, ground.y + ground.height);
    ctx.stroke();
  }

  ctx.fillStyle = 'rgba(110,140,80,0.7)';
  for (let x = 0; x < W; x += 60) {
    const gy = ground.y + 3;
    ctx.beginPath();
    ctx.moveTo(x, gy);
    ctx.lineTo(x + 3, gy - 5);
    ctx.lineTo(x + 6, gy);
    ctx.closePath();
    ctx.fill();
  }
}

/* ============================================================
   SECTION 12: DRAWING - HUD & MENUS
   ============================================================ */

function drawHUD() {
  const barW = 260, barH = 22;

  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.75)';
  ctx.fillRect(28, 18, barW + 8, barH + 8);
  ctx.fillStyle = '#111';
  ctx.fillRect(32, 22, barW, barH);
  const tHP = tsunade.hp / tsunade.maxHp;
  const tGrd = ctx.createLinearGradient(32, 22, 32 + barW * tHP, 22);
  if (tsunade.isAwakened) { tGrd.addColorStop(0, '#00ffcc'); tGrd.addColorStop(1, '#b060ff'); }
  else { tGrd.addColorStop(0, '#00cc99'); tGrd.addColorStop(1, '#00ffcc'); }
  ctx.fillStyle = tGrd;
  ctx.fillRect(32, 22, barW * tHP, barH);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.strokeRect(32, 22, barW, barH);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 12px Trebuchet MS, sans-serif';
  ctx.fillText(tsunade.isAwakened ? '⚡ TSUNADE [BYAKUGŌ]' : 'TSUNADE SENJU', 36, 38);
  if (tsunade.blocking) {
    ctx.fillStyle = '#88ddff';
    ctx.font = 'bold 11px Trebuchet MS, sans-serif';
    ctx.fillText('BLOCKING', 36, 50);
  }
  ctx.restore();

  ctx.save();
  const gx = W - 28 - barW - 8;
  ctx.fillStyle = 'rgba(0,0,0,0.75)';
  ctx.fillRect(gx, 18, barW + 8, barH + 8);
  ctx.fillStyle = '#111';
  ctx.fillRect(gx + 4, 22, barW, barH);
  const gHP = gojo.hp / gojo.maxHp;
  const gGrd = ctx.createLinearGradient(gx + 4, 22, gx + 4 + barW * gHP, 22);
  gGrd.addColorStop(0, '#6633aa');
  gGrd.addColorStop(1, '#c060ff');
  ctx.fillStyle = gGrd;
  ctx.fillRect(gx + 4, 22, barW * gHP, barH);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.strokeRect(gx + 4, 22, barW, barH);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 12px Trebuchet MS, sans-serif';
  ctx.fillText('SATORU GOJO', gx + 8, 38);
  if (gojo.blocking) {
    ctx.fillStyle = '#88ddff';
    ctx.font = 'bold 11px Trebuchet MS, sans-serif';
    ctx.fillText('BLOCKING', gx + 8, 50);
  }
  ctx.restore();
}

function drawCharacterNames() {
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = 'bold 11px Trebuchet MS, sans-serif';
  ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(0,0,0,0.9)';
  ctx.shadowBlur = 4;
  ctx.fillText(tsunade.isAwakened ? '⚡ Byakugō Active' : tsunade.name, tsunade.x + 24, tsunade.y - 12);
  ctx.fillText(`${gojo.name} [${gojo.currentMove}]`, gojo.x + 24, gojo.y - 12);
  ctx.shadowBlur = 0;
  ctx.textAlign = 'left';
}

function drawOverlayScreen(type) {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.82)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';

  if (type === 'MAIN_MENU') {
    const grd = ctx.createLinearGradient(W/2 - 200, 0, W/2 + 200, 0);
    grd.addColorStop(0, '#00ffcc');
    grd.addColorStop(0.5, '#9b59b6');
    grd.addColorStop(1, '#ffcc00');
    ctx.fillStyle = grd;
    ctx.font = 'bold 60px Trebuchet MS, sans-serif';
    ctx.shadowColor = '#00ffcc';
    ctx.shadowBlur = 30;
    ctx.fillText('ANIME CLASH', W / 2, H / 2 - 50);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff';
    ctx.font = '16px Trebuchet MS, sans-serif';
    ctx.fillText('Two legends. One stage.', W / 2, H / 2 - 10);
    ctx.fillStyle = '#ffcc00';
    ctx.font = '14px Trebuchet MS, sans-serif';
    ctx.fillText('Tap Play to begin', W / 2, H / 2 + 30);
  } else if (type === 'SETTINGS') {
    ctx.fillStyle = '#ffcc00';
    ctx.font = 'bold 36px Trebuchet MS, sans-serif';
    ctx.fillText('SETTINGS', W / 2, H / 2 - 60);
    ctx.fillStyle = '#fff';
    ctx.font = '18px Trebuchet MS, sans-serif';
    ctx.fillText(`Graphics Tier: ${graphicsQuality.toUpperCase()}`, W / 2, H / 2 - 10);
    ctx.font = '13px Trebuchet MS, sans-serif';
    ctx.fillStyle = '#aaa';
    ctx.fillText('Low: for slow devices. High: full VFX.', W / 2, H / 2 + 25);
  } else if (type === 'MODE_SELECT') {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 34px Trebuchet MS, sans-serif';
    ctx.fillText('SELECT GAME MODE', W / 2, H / 2 - 50);
    ctx.font = '16px Trebuchet MS, sans-serif';
    ctx.fillStyle = '#ff4500';
    ctx.fillText('⚔️ Battle Mode — Fight the AI to K.O.', W / 2, H / 2 - 5);
    ctx.fillStyle = '#2e8b57';
    ctx.fillText('🥋 Practice Mode — Train freely, no death', W / 2, H / 2 + 30);
  } else if (type === 'SELECT') {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 32px Trebuchet MS, sans-serif';
    ctx.fillText('SELECT YOUR FIGHTER', W / 2, H / 2 - 70);
    ctx.font = '14px Trebuchet MS, sans-serif';
    ctx.fillStyle = '#00ffcc';
    ctx.fillText('Tsunade Senju — Chakra-powered strength, Byakugō healing, Katsuyu', W / 2, H / 2 - 10);
    ctx.fillStyle = '#c060ff';
    ctx.fillText('Satoru Gojo — Infinity, Blue, Red, Hollow Purple, Black Flash', W / 2, H / 2 + 25);
    ctx.fillStyle = '#aaa';
    ctx.fillText(`Mode: ${gameMode.toUpperCase()}`, W / 2, H / 2 + 60);
  }
  ctx.textAlign = 'left';
}

function drawVignette() {
  const grd = ctx.createRadialGradient(W/2, H/2, H * 0.3, W/2, H/2, H * 0.9);
  grd.addColorStop(0, 'rgba(0,0,0,0)');
  grd.addColorStop(1, 'rgba(0,0,0,0.4)');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, W, H);
}

/* ============================================================
   SECTION 13: MAIN DRAW FUNCTION
   ============================================================ */

function draw() {
  ctx.save();
  if (screenShake > 0.1) {
    const sx = (Math.random() - 0.5) * screenShake;
    const sy = (Math.random() - 0.5) * screenShake;
    ctx.translate(sx, sy);
  }

  ctx.clearRect(-20, -20, W + 40, H + 40);
  drawBackground();

  groundDebris.forEach(deb => {
    ctx.save();
    ctx.globalAlpha = deb.alpha;
    ctx.translate(deb.x, deb.y);
    ctx.rotate(deb.rot);
    ctx.fillStyle = '#8a6a3a';
    ctx.fillRect(-deb.size/2, -deb.size/2, deb.size, deb.size);
    ctx.restore();
  });

  if (gameState === 'MAIN_MENU' || gameState === 'SETTINGS' || gameState === 'MODE_SELECT' || gameState === 'SELECT') {
    drawOverlayScreen(gameState);
    ctx.restore();
    return;
  }

  if (shockwave) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(0,255,204,${shockwave.alpha})`;
    ctx.shadowColor = '#00ffcc';
    ctx.shadowBlur = 25;
    ctx.lineWidth = 8;
    ctx.beginPath(); ctx.arc(shockwave.x, ground.y, shockwave.radius, Math.PI, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = `rgba(255,255,255,${shockwave.alpha * 0.6})`;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(shockwave.x, ground.y, shockwave.radius * 0.7, Math.PI, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  distortionRings.forEach(r => {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = r.color;
    ctx.globalAlpha = r.alpha;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  });

  if (katsuyuSummon) drawKatsuyu(katsuyuSummon);
  if (blueBlast) drawBlueBlast(blueBlast);
  if (redBlast) drawRedBlast(redBlast);
  if (purpleSequence) drawPurpleSequence(purpleSequence);

  drawAfterimages(tsunade, drawTsunadeBody);
  drawAfterimages(gojo, drawGojoBody);

  drawTsunadeBody(tsunade);
  drawGojoBody(gojo);

  if (gojo.currentMove === 'Infinity') drawInfinity(gojo);

  chakraTrails.forEach(c => {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = c.alpha;
    ctx.fillStyle = '#00ffcc';
    ctx.beginPath(); ctx.arc(c.x, c.y, c.size, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  });

  acidProjectiles.forEach(drawAcid);

  if (graphicsQuality !== 'low') {
    particles.forEach(p => {
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  slashes.forEach(drawSlash);

  hitFlashes.forEach(f => {
    const p = f.timer / f.maxTimer;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = p * 0.7;
    ctx.fillStyle = f.color;
    ctx.beginPath(); ctx.arc(f.x, f.y, 30 * (1 - p) + 10, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  });

  if (blackFlashEffect) drawBlackFlash(blackFlashEffect);

  drawCharacterNames();
  drawHUD();

  if (screenTint) {
    ctx.fillStyle = `rgba(${screenTint.color},${screenTint.alpha})`;
    ctx.fillRect(0, 0, W, H);
  }

  drawVignette();

  if (gameOver) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.88)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff2a2a';
    ctx.font = 'bold 52px Trebuchet MS, sans-serif';
    ctx.shadowColor = '#ff0000';
    ctx.shadowBlur = 30;
    ctx.fillText(winnerText, W / 2, H / 2);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff';
    ctx.font = '16px Trebuchet MS, sans-serif';
    ctx.fillText('Tap Menu to return', W / 2, H / 2 + 50);
    ctx.textAlign = 'left';
  }

  ctx.restore();
}

/* ============================================================
   SECTION 14: GAME LOOP
   ============================================================ */
function gameLoop(now) {
  if (!lastTime) lastTime = now;
  let elapsed = (now - lastTime) / 1000;
  lastTime = now;
  if (elapsed > 0.1) elapsed = 0.1;
  dt = elapsed * 60;
  update(dt);
  draw();
  requestAnimationFrame(gameLoop);
}
requestAnimationFrame(gameLoop);

})();
