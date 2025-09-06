/*************************
 * Throw Throw Tomato JS *
 *************************/

/** ============================
 *  ASSETS
 *  ============================ */
const ASSETS = {
  // Main menu background (applied to #mainMenu overlay)
  menuFullBg: "https://raw.githubusercontent.com/purplebeaver0513/Throw-Throw-Tomato-Assets/refs/heads/main/1000025560.png",

  // Gameplay background (full canvas, "cover")
  gameBg: "https://raw.githubusercontent.com/purplebeaver0513/Throw-Throw-Tomato-Assets/refs/heads/main/1000025608.png",

  // Projectiles & effects
  tomato: "https://raw.githubusercontent.com/purplebeaver0513/Throw-Throw-Tomato-Assets/refs/heads/main/file_000000006e5061fd92760a84f59a4fa3__1_-removebg-preview.png",
  tomatoSplat: "https://raw.githubusercontent.com/purplebeaver0513/Throw-Throw-Tomato-Assets/refs/heads/main/file_00000000c84c6230b19da260b17746ed__1_-removebg-preview.png",

  // Farmer
  farmerAngry: "https://raw.githubusercontent.com/purplebeaver0513/Throw-Throw-Tomato-Assets/refs/heads/main/file_000000009a4c61f7b258eabae653aec9-removebg-preview.png",

  // Targets (same size across tiers)
  targetYellow: "https://raw.githubusercontent.com/purplebeaver0513/Throw-Throw-Tomato-Assets/refs/heads/main/1000025399-removebg-preview.png",
  targetOrange: "https://raw.githubusercontent.com/purplebeaver0513/Throw-Throw-Tomato-Assets/refs/heads/main/1000025398-removebg-preview.png",
  targetRed:    "https://raw.githubusercontent.com/purplebeaver0513/Throw-Throw-Tomato-Assets/refs/heads/main/1000025397-removebg-preview.png",
};

/** ============================
 *  IMAGE PRELOAD (CORS-safe)
 *  ============================ */
let IMGS = null;
function loadImages(manifest) {
  const entries = Object.entries(manifest);
  const images = {};
  let loaded = 0;
  return new Promise((resolve, reject) => {
    entries.forEach(([key, url]) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        images[key] = img;
        if (++loaded === entries.length) resolve(images);
      };
      img.onerror = () => reject(new Error('Failed to load ' + url));
      img.src = url;
    });
  });
}

/**************
 * DOM HOOKS  *
 **************/
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const timerDisplay      = document.getElementById('timer');
const scoreDisplay      = document.getElementById('score');
const pauseBtn          = document.getElementById('pauseBtn');
const countdownDiv      = document.getElementById('countdown');
const finalScoreDiv     = document.getElementById('finalScore');

const mainMenu          = document.getElementById('mainMenu');
const playBtn           = document.getElementById('playBtn');
const openScoresBtn     = document.getElementById('openScoresBtn');

const highscoresScreen  = document.getElementById('highscoresScreen');
const scoresTitle       = document.getElementById('scoresTitle');
const scoresList        = document.getElementById('scoresList');
const showAllTimeBtn    = document.getElementById('showAllTimeBtn');
const scoresToMenuBtn   = document.getElementById('scoresToMenuBtn');

const nameEntry         = document.getElementById('nameEntry');
const finalScoreValue   = document.getElementById('finalScoreValue');
const playerNameInput   = document.getElementById('playerName');
const saveScoreBtn      = document.getElementById('saveScoreBtn');
const cancelSaveBtn     = document.getElementById('cancelSaveBtn');

const toMenuOverlay     = document.getElementById('toMenuOverlay');
const toMenuBtn         = document.getElementById('toMenuBtn');
const finalScoreValue2  = document.getElementById('finalScoreValue2');

const settingsBtn       = document.getElementById('settingsBtn');
const updateLogBtn      = document.getElementById('updateLogBtn');
const settingsPanel     = document.getElementById('settingsPanel');
const updateLogPanel    = document.getElementById('updateLogPanel');
const closeSettings     = document.getElementById('closeSettings');
const closeUpdateLog    = document.getElementById('closeUpdateLog');
const musicVolumeSlider = document.getElementById('musicVolume');
const sfxVolumeSlider   = document.getElementById('sfxVolume');

// Hide any old title image if present (we use overlay bg instead)
const titleLogoImg = document.getElementById('titleLogo');
if (titleLogoImg) titleLogoImg.style.display = 'none';

/************************
 * CANVAS SIZE (exact)  *
 ************************/
const LOGICAL_W = 1800;
const LOGICAL_H = 600;
function setExactCanvasSize() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width  = Math.round(LOGICAL_W * dpr);
  canvas.height = Math.round(LOGICAL_H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = true;
}
setExactCanvasSize();
window.addEventListener('resize', setExactCanvasSize);

/**********************************
 * MENU BACKGROUND ON OVERLAY
 **********************************/
function applyMenuBackground() {
  if (!mainMenu) return;
  mainMenu.style.backgroundImage =
    `url('${ASSETS.menuFullBg}')`;
  mainMenu.style.backgroundSize = 'cover';
  mainMenu.style.backgroundRepeat = 'no-repeat';
  mainMenu.style.backgroundPosition = 'center center';
}
function clearMenuBackground() {
  if (!mainMenu) return;
  mainMenu.style.backgroundImage = '';
}

/**************
 * GAME STATE *
 **************/
let score = 0;
let timeLeft = 20;
let cooldown = false;
let isGameOver = false;
let isGameStarted = false;
let isPaused = false;

let targets = [];
let tomatoes = [];
let popups = [];
let splats = [];

let inBonusRound = false;
let bonusFarmer = null;
let showBonusPrompt = false;

let gameInterval = null;
let animId = null; // SINGLE RAF LOOP ID

let musicVolume = 1.0;
let sfxVolume = 1.0;
let pendingScore = 0;
let pendingDestinations = { today: false, alltime: false };

let comboCount = 0;
let bestStreak = 0;
let lastHitTime = 0;
const COMBO_TIMEOUT = 1750;

/********************
 * HELPERS & SPAWN  *
 ********************/
function randomInt(min, max) { return Math.floor(Math.random() * (max - min) + min); }

// Centered spawn band
const SPAWN_BAND_LEFT_RATIO  = 0.30;
const SPAWN_BAND_WIDTH_RATIO = 0.40;

const SPAWN_AREA_X = () =>
  (canvas.width / (window.devicePixelRatio || 1)) * SPAWN_BAND_LEFT_RATIO;

const SPAWN_AREA_W = () =>
  (canvas.width / (window.devicePixelRatio || 1)) * SPAWN_BAND_WIDTH_RATIO;

const SPAWN_PAD    = 40;

function buildMiddleLanes(count = 5) {
  const left = SPAWN_AREA_X() + SPAWN_PAD;
  const right = SPAWN_AREA_X() + SPAWN_AREA_W() - SPAWN_PAD;
  if (count <= 1) return [Math.floor((left + right) / 2)];
  const step = (right - left) / (count - 1);
  return Array.from({ length: count }, (_, i) => Math.floor(left + i * step));
}

/****************
 * POPUPS / FX  *
 ****************/
class Popup {
  constructor(x, y, text, color = '#111') {
    this.x = x; this.y = y;
    this.text = text; this.color = color;
    this.alpha = 1; this.dy = -1.2; this.life = 60;
    this.size = 28; this.bold = true;
  }
  update() { this.y += this.dy; this.life--; this.alpha = Math.max(0, this.life / 60); }
  draw() {
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.font = `${this.bold ? '800 ' : ''}${this.size}px Nunito, sans-serif`;
    ctx.fillStyle = this.color;
    ctx.textAlign = 'center';
    ctx.fillText(this.text, this.x, this.y);
    ctx.restore();
  }
  get dead() { return this.life <= 0; }
}

class Splat {
  constructor(x, y, imgKey = 'tomatoSplat', life = 42, scale = 1.1) {
    this.x = x; this.y = y; this.imgKey = imgKey;
    this.life = life; this.max = life; this.scale = scale;
  }
  update() { this.life--; }
  draw() {
    const alpha = Math.max(0, this.life / this.max);
    const img = IMGS && IMGS[this.imgKey];
    if (!img) return;
    const base = 90 * this.scale;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, this.x - base/2, this.y - base/2, base, base);
    ctx.restore();
  }
  get dead() { return this.life <= 0; }
}

/****************
 * PROJECTILES  *
 ****************/
class Tomato {
  constructor(targetX, targetY) {
    this.x = LOGICAL_W / 2;
    this.y = LOGICAL_H - 40;
    this.targetX = targetX; this.targetY = targetY;
    this.radius = 10; this.speed = 18;
  }
  update() {
    const dx = this.targetX - this.x, dy = this.targetY - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist > this.speed) { this.x += (dx / dist) * this.speed; this.y += (dy / dist) * this.speed; }
    else { this.hit(); }
  }
  hit() {
    let awarded = false;

    // regular targets
    for (let i = targets.length - 1; i >= 0; i--) {
      const t = targets[i];
      if (t && Math.hypot(this.x - t.x, this.y - t.y) < t.radius + this.radius) {
        const basePoints = t.points;
        const pointsWithCombo = applyComboAndReturnPoints(basePoints, t.x, t.y - 10);

        score += pointsWithCombo;
        scoreDisplay.innerText = `Score: ${score.toLocaleString()}`;

        popups.push(new Popup(t.x, t.y - 10, `+${pointsWithCombo}`, '#111'));
        splats.push(new Splat(t.x, t.y - 6, 'tomatoSplat', 44, 1.0));

        targets.splice(i, 1);
        awarded = true;
        break;
      }
    }

    // farmer
    if (!awarded && inBonusRound && bonusFarmer) {
      const hb = bonusFarmer.hitbox;
      const fb = bonusFarmer.bodyBox;
      const onHead = (this.x > hb.x && this.x < hb.x + hb.width && this.y > hb.y && this.y < hb.y + hb.height);
      const onBody = (this.x > fb.x && this.x < fb.x + fb.width && this.y > fb.y && this.y < fb.y + fb.height);

      if (onHead) {
        if (!bonusFarmer.headHits) {
          const base = 100;
          const pts = applyComboAndReturnPoints(base, hb.x + hb.width/2, hb.y - 8);
          score += pts;
          popups.push(new Popup(hb.x + hb.width/2, hb.y - 8, `+${pts}`, '#e11d48'));
        } else {
          score = Math.floor(score * 2);
          popups.push(new Popup(hb.x + hb.width/2, hb.y - 8, 'x2!', '#e11d48'));
          bumpCombo(hb.x + hb.width/2, hb.y - 26, true);
        }
        splats.push(new Splat(hb.x + hb.width/2, hb.y, 'tomatoSplat', 44, 1.2));
        bonusFarmer.headHits = (bonusFarmer.headHits || 0) + 1;
        scoreDisplay.innerText = `Score: ${score.toLocaleString()}`;
        awarded = true;
      } else if (onBody) {
        if (!bonusFarmer.bodyHits) {
          const base = 50;
          const pts = applyComboAndReturnPoints(base, fb.x + fb.width/2, fb.y + fb.height/2);
          score += pts;
          popups.push(new Popup(fb.x + fb.width/2, fb.y + fb.height/2, `+${pts}`, '#1d4ed8'));
        } else {
          score = Math.floor(score * 1.5);
          popups.push(new Popup(fb.x + fb.width/2, fb.y + fb.height/2, 'x1.5!', '#1d4ed8'));
          bumpCombo(fb.x + fb.width/2, fb.y + fb.height/2 - 18, true);
        }
        splats.push(new Splat(fb.x + fb.width/2, fb.y + fb.height/2, 'tomatoSplat', 40, 1.1));
        bonusFarmer.bodyHits = (bonusFarmer.bodyHits || 0) + 1;
        scoreDisplay.innerText = `Score: ${score.toLocaleString()}`;
        awarded = true;
      }
    }

    const idx = tomatoes.indexOf(this); if (idx !== -1) tomatoes.splice(idx, 1);
  }
  draw() {
    if (IMGS && IMGS.tomato) {
      const size = 28;
      ctx.drawImage(IMGS.tomato, this.x - size/2, this.y - size/2, size, size);
    } else {
      ctx.beginPath(); ctx.fillStyle = 'tomato';
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2); ctx.fill();
    }
  }
}

/***********
 * TARGETS *
 ***********/
class Target {
  constructor(tier = 1) {
    this.radius = 30; // same size for all tiers
    this.tier = tier;
    this.points = 10;
    this.speedX = 0;

    const leftInside  = SPAWN_AREA_X() + SPAWN_PAD + this.radius;

    if (tier === 1) {
      const lanes = buildMiddleLanes(5);
      this.x = lanes[randomInt(0, lanes.length)];
      this.y = 320; this.points = 10; this.speedX = 0;
    } else if (tier === 2) {
      this.x = leftInside; this.y = 220; this.points = 20; this.speedX = 1.2;
    } else {
      this.x = leftInside; this.y = 120; this.points = 50; this.speedX = 2.1;
    }

    this.leftBound  = SPAWN_AREA_X() + SPAWN_PAD - this.radius;
    this.rightBound = SPAWN_AREA_X() + SPAWN_AREA_W() - SPAWN_PAD + this.radius;
  }

  update() {
    if (this.speedX !== 0) {
      this.x += this.speedX;
      if (this.x > this.rightBound) this.x = this.leftBound;
      if (this.x < this.leftBound) this.x = this.rightBound;
    }
  }

  draw() {
    const size = this.radius * 2.8;
    let img = null;
    if (IMGS) {
      if (this.tier === 1) img = IMGS.targetYellow;
      else if (this.tier === 2) img = IMGS.targetOrange;
      else img = IMGS.targetRed;
    }
    if (img) {
      ctx.drawImage(img, this.x - size/2, this.y - size/2, size, size);
    } else {
      ctx.beginPath(); ctx.fillStyle = 'gray';
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2); ctx.fill();
    }
  }
}

/***********
 * FARMER  *
 ***********/
class Farmer {
  constructor() {
    const bandLeft  = SPAWN_AREA_X();
    const bandRight = SPAWN_AREA_X() + SPAWN_AREA_W();

    this.width = 140; this.height = 140;
    this.x = bandLeft - this.width - 40;
    this.y = 180;

    this.t = 0;
    this.phase = 'enter'; // 'enter' -> 'pose' -> 'exit'
    this.phaseTimer = 0;

    this.hitbox = { x: this.x + this.width * 0.33, y: this.y + 6, width: this.width * 0.34, height: 24 };
    this.bodyBox = { x: this.x + this.width * 0.08, y: this.y + 28, width: this.width * 0.84, height: this.height - 36 };

    this.bodyHits = 0; this.headHits = 0;

    const bandWidth = bandRight - bandLeft;
    const framesForTenSec = 10 * 60;
    this.enterSpeedX = bandWidth / framesForTenSec;
    this.rightEdgeX = bandRight - this.width;

    this.poseX = bandLeft + bandWidth * 0.55 - this.width / 2;
    this.poseY = this.y;

    this.active = false;
  }
  update() {
    this.hitbox.x = this.x + this.width * 0.33;
    this.hitbox.y = this.y + 6;
    this.bodyBox.x = this.x + this.width * 0.08;
    this.bodyBox.y = this.y + 28;

    if (!this.active) return;

    this.t++;
    this.phaseTimer++;

    const bob = Math.sin(this.t * 0.25) * 2;

    if (this.phase === 'enter') {
      this.x += this.enterSpeedX * 1.1;
      this.y = 180 + bob;
      if (this.x >= this.poseX) {
        this.x = this.poseX;
        this.phase = 'pose';
        this.phaseTimer = 0;
      }
    } else if (this.phase === 'pose') {
      this.y = this.poseY + Math.sin(this.t * 0.15) * 1.0;
      if (this.phaseTimer > 180) {
        this.phase = 'exit';
        this.phaseTimer = 0;
      }
    } else if (this.phase === 'exit') {
      this.y += 1.6;
      this.x += 0.4;
      if (this.y > LOGICAL_H + 40) endBonusRound();
    }
  }
  draw() {
    if (IMGS && IMGS.farmerAngry) {
      ctx.drawImage(IMGS.farmerAngry, this.x, this.y, this.width, this.height);
    } else {
      ctx.fillStyle = 'brown';
      ctx.fillRect(this.x, this.y, this.width, this.height);
    }
  }
}

/************************
 * COMBO / STREAK LOGIC *
 ************************/
function getComboMultiplier() {
  if (comboCount < 5) return 1;
  const steps = comboCount - 4;
  return 1 + 0.012 * steps;
}
function bumpCombo(px, py, showPopupIfNeeded = true) {
  const now = performance.now();
  if (now - lastHitTime <= COMBO_TIMEOUT) comboCount += 1;
  else comboCount = 1;
  lastHitTime = now;
  if (comboCount > bestStreak) bestStreak = comboCount;
  if (showPopupIfNeeded && comboCount >= 5) {
    popups.push(new Popup(px, py, `COMBO x${comboCount}`, '#7c3aed'));
  }
}
function applyComboAndReturnPoints(basePoints, px, py) {
  bumpCombo(px, py - 18, true);
  const mult = getComboMultiplier();
  return Math.floor(basePoints * mult);
}

/*********************
 * BACKGROUND & HUD  *
 *********************/
function drawBackground() {
  // fallback color while image loads
  ctx.fillStyle = '#a0e0ff';
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

  const img = IMGS && IMGS.gameBg;
  if (!img) return;

  // "cover" without stretching
  const canvasW = LOGICAL_W, canvasH = LOGICAL_H;
  const imgW = img.width, imgH = img.height;
  const canvasAR = canvasW / canvasH;
  const imgAR = imgW / imgH;

  let srcW, srcH, srcX, srcY;
  if (imgAR > canvasAR) {
    srcH = imgH;
    srcW = Math.floor(imgH * canvasAR);
    srcX = Math.floor((imgW - srcW) / 2);
    srcY = 0;
  } else {
    srcW = imgW;
    srcH = Math.floor(imgW / canvasAR);
    srcX = 0;
    srcY = Math.floor((imgH - srcH) / 2);
  }

  ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, canvasW, canvasH);
}

function drawLauncher() {
  ctx.fillStyle = '#7b3f00';
  ctx.fillRect(LOGICAL_W/2 - 12, LOGICAL_H - 30, 24, 24);
}

function drawComboBar() {
  if (comboCount <= 0) return;

  const now = performance.now();
  const elapsed = now - lastHitTime;
  const remain = Math.max(0, COMBO_TIMEOUT - elapsed);
  const pct = Math.max(0, Math.min(1, remain / COMBO_TIMEOUT));

  const barX = LOGICAL_W / 2 - 260;
  const barY = 14;
  const barW = 520;
  const barH = 18;

  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.fillRect(barX, barY, barW, barH);

  ctx.fillStyle = comboCount >= 5 ? '#f59e0b' : '#3b82f6';
  ctx.fillRect(barX, barY, barW * pct, barH);

  ctx.font = '700 16px Nunito, sans-serif';
  ctx.fillStyle = '#111827';
  ctx.textAlign = 'center';
  if (comboCount >= 5) {
    const extraPct = Math.round((getComboMultiplier() - 1) * 1000) / 10;
    ctx.fillText(`Combo x${comboCount}  (+${extraPct}%)`, barX + barW / 2, barY + barH - 3);
  } else {
    ctx.fillText(`Combo x${comboCount}`, barX + barW / 2, barY + barH - 3);
  }

  if (elapsed > COMBO_TIMEOUT) comboCount = 0;
}

/*********************
 * RENDER & GAME LOOP
 *********************/
function update() {
  if (!isGameStarted) return;

  ctx.clearRect(0, 0, LOGICAL_W, LOGICAL_H);
  drawBackground();

  // Spawn band (centered, visual guide)
  const bandX = SPAWN_AREA_X(), bandW = SPAWN_AREA_W();
  ctx.fillStyle = 'rgba(0, 255, 0, 0.10)';
  ctx.fillRect(bandX, 0, bandW, LOGICAL_H);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
  ctx.fillRect(bandX, 0, SPAWN_PAD, LOGICAL_H);
  ctx.fillRect(bandX + bandW - SPAWN_PAD, 0, SPAWN_PAD, LOGICAL_H);

  // Update (safe-guarded)
  if (!isPaused) {
    if (inBonusRound && bonusFarmer) {
      bonusFarmer.update();
    } else {
      for (let i = 0; i < targets.length; i++) {
        const t = targets[i];
        if (!t || typeof t.update !== 'function' || typeof t.draw !== 'function') {
          console.warn('[TTT] Removing non-target from targets:', { index: i, value: t });
          targets.splice(i, 1); i--; continue;
        }
        t.update();
      }
    }
    for (const tm of tomatoes) tm.update();
    for (let i = popups.length - 1; i >= 0; i--) { const p = popups[i]; p.update(); if (p.dead) popups.splice(i,1); }
    for (let i = splats.length - 1; i >= 0; i--) { const s = splats[i]; s.update(); if (s.dead) splats.splice(i,1); }
  }

  // Draw
  if (inBonusRound && bonusFarmer) {
    bonusFarmer.draw();
    if (showBonusPrompt) {
      ctx.save();
      ctx.font = '900 64px Nunito, sans-serif';
      ctx.fillStyle = '#1f2937';
      ctx.textAlign = 'center';
      ctx.fillText('SHOOT THE FARMER', LOGICAL_W / 2, LOGICAL_H / 2 - 40);
      ctx.restore();
    }
  } else {
    for (const t of targets) { if (t && typeof t.draw === 'function') t.draw(); }
  }
  for (const tm of tomatoes) tm.draw();
  for (const s of splats) s.draw();
  for (const p of popups) p.draw();

  drawComboBar();
  drawLauncher();

  if (isPaused) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    ctx.font = '900 64px Nunito, sans-serif';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', LOGICAL_W / 2, LOGICAL_H / 2 - 10);
    ctx.restore();
  }

  // SINGLE RAF CHAIN
  animId = requestAnimationFrame(update);
}

/*****************
 * GAME LIFECYCLE
 *****************/
function startGame() {
  // Close panels, ensure HUD visible
  if (settingsPanel)  settingsPanel.style.display = 'none';
  if (updateLogPanel) updateLogPanel.style.display = 'none';

  // Leaving menu → remove overlay background
  clearMenuBackground();

  // Cancel any existing RAF + interval to avoid speed up
  if (animId) { cancelAnimationFrame(animId); animId = null; }
  if (gameInterval) { clearInterval(gameInterval); gameInterval = null; }

  setExactCanvasSize();
  isPaused = false;
  pauseBtn.textContent = 'Pause';

  setScreen('game');

  isGameStarted = true; isGameOver = false; inBonusRound = false; bonusFarmer = null;
  score = 0; timeLeft = 20; targets = []; tomatoes = []; popups = []; splats = [];
  comboCount = 0; lastHitTime = 0; bestStreak = 0;

  scoreDisplay.innerText = `Score: ${score}`;
  timerDisplay.innerText = `Time: ${timeLeft}`;

  showCountdown(() => {
    beginMainTimer();
    update(); // starts exactly one RAF loop
  });
}

function beginMainTimer() {
  gameInterval = setInterval(() => {
    if (isGameOver || inBonusRound) { clearInterval(gameInterval); gameInterval = null; return; }
    if (isPaused) return;

    timeLeft -= 1;
    timerDisplay.innerText = `Time: ${timeLeft}`;

    if (timeLeft <= 0) {
      clearInterval(gameInterval);
      gameInterval = null;
      triggerBonusRound();
      return;
    }

    targets.push(new Target(1));
    if (Math.random() < 0.7) targets.push(new Target(2));
    if (Math.random() < 0.4) targets.push(new Target(3));
  }, 1000);
}

function showCountdown(callback) {
  const messages = ['Ready...', 'Set...', 'Go!'];
  let index = 0; countdownDiv.style.display = 'block'; countdownDiv.innerText = messages[index];
  const id = setInterval(() => {
    index++;
    if (index >= messages.length) { clearInterval(id); countdownDiv.style.display = 'none'; callback(); }
    else { countdownDiv.innerText = messages[index]; }
  }, 1000);
}

function triggerBonusRound() {
  inBonusRound = true; targets = []; bonusFarmer = new Farmer();
  showBonusPrompt = true;
  setTimeout(() => { showBonusPrompt = false; bonusFarmer.active = true; }, 1000);
}

function endBonusRound() {
  inBonusRound = false; bonusFarmer = null; isGameOver = true;

  const dest = highscoreDestinations(score);
  pendingScore = score;
  pendingDestinations = dest;

  if (dest.today || dest.alltime) {
    finalScoreValue.textContent = score.toLocaleString();
    playerNameInput.value = '';
    setScreen('nameEntry');
  } else {
    finalScoreValue2.textContent = score.toLocaleString();
    setScreen('toMenuOverlay');
  }
}

/*********************
 * INPUT & UI EVENTS
 *********************/
canvas.addEventListener('click', (e) => {
  if (cooldown || isGameOver || !isGameStarted) return;
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left, y = e.clientY - rect.top;
  tomatoes.push(new Tomato(x, y));
  cooldown = true; setTimeout(() => (cooldown = false), 600);
});

pauseBtn.addEventListener('click', () => {
  if (!isGameStarted) return;
  isPaused = !isPaused;
  pauseBtn.textContent = isPaused ? 'Resume' : 'Pause';
});

// Panels
settingsBtn.addEventListener('click', () => { settingsPanel.style.display = 'block'; });
closeSettings.addEventListener('click', () => { settingsPanel.style.display = 'none'; });
updateLogBtn.addEventListener('click', () => { updateLogPanel.style.display = 'block'; });
closeUpdateLog.addEventListener('click', () => { updateLogPanel.style.display = 'none'; });

// Volume sliders (hooks)
musicVolumeSlider.addEventListener('input', (e) => { musicVolume = parseFloat(e.target.value); });
sfxVolumeSlider.addEventListener('input',   (e) => { sfxVolume   = parseFloat(e.target.value); });

/*********************
 * MENU NAVIGATION UI
 *********************/
function setScreen(screen) {
  // Hide all overlays
  mainMenu.classList.remove('active');
  highscoresScreen.classList.remove('active');
  nameEntry.classList.remove('active');
  toMenuOverlay.classList.remove('active');

  // HUD
  if (screen === 'game') {
    document.getElementById('ui').classList.remove('hide');
  } else {
    document.getElementById('ui').classList.add('hide');
  }

  switch (screen) {
    case 'menu':
      mainMenu.classList.add('active');
      applyMenuBackground(); // put bg inside the overlay
      // optional: stop RAF when not in game
      if (animId) { cancelAnimationFrame(animId); animId = null; }
      isGameStarted = false;
      break;
    case 'scores':
      highscoresScreen.classList.add('active');
      clearMenuBackground();
      break;
    case 'nameEntry':
      nameEntry.classList.add('active'); clearMenuBackground(); break;
    case 'toMenuOverlay':
      toMenuOverlay.classList.add('active'); clearMenuBackground(); break;
    case 'game':
      clearMenuBackground();
      break;
  }
}

// Main menu buttons
playBtn.addEventListener('click', startGame);
openScoresBtn.addEventListener('click', () => { renderTodayScores(); setScreen('scores'); });

// Scores screen buttons
scoresToMenuBtn.addEventListener('click', () => setScreen('menu'));
showAllTimeBtn.addEventListener('click', () => { renderAllTimeScores(); setScreen('scores'); });

// Name entry buttons
saveScoreBtn.addEventListener('click', () => {
  const name = (playerNameInput.value || 'Player').trim().slice(0, 16);
  commitScoreWithDestinations(pendingScore, name, pendingDestinations);
  setScreen('menu');
});
cancelSaveBtn.addEventListener('click', () => setScreen('menu'));

// Not-on-board menu button
toMenuBtn.addEventListener('click', () => setScreen('menu'));

/*********************
 * HIGHSCORE STORAGE *
 *********************/
function todayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `tt_scores_${y}-${m}-${day}`;
}
const ALLTIME_KEY = 'tt_alltime_top10';

function loadTodayScores() {
  try { return JSON.parse(localStorage.getItem(todayKey())) || []; }
  catch { return []; }
}
function saveTodayScores(arr) { localStorage.setItem(todayKey(), JSON.stringify(arr)); }

function loadAllTimeList() {
  try { return JSON.parse(localStorage.getItem(ALLTIME_KEY)) || []; }
  catch { return []; }
}
function saveAllTimeList(arr) { localStorage.setItem(ALLTIME_KEY, JSON.stringify(arr)); }

function highscoreDestinations(sc) {
  const today = loadTodayScores().sort((a,b)=>b.score - a.score);
  const qualifiesToday = today.length < 10 || sc > (today[9]?.score ?? -Infinity);

  const all = loadAllTimeList().sort((a,b)=>b.score - a.score);
  const qualifiesAllTime = all.length < 10 || sc > (all[9]?.score ?? -Infinity);

  return { today: qualifiesToday, alltime: qualifiesAllTime };
}

function commitScoreWithDestinations(sc, name, dest) {
  const entry = { name, score: sc, date: Date.now() };

  if (dest.today) {
    const today = loadTodayScores();
    today.push(entry);
    today.sort((a,b)=>b.score - a.score);
    saveTodayScores(today.slice(0, 10));
  }

  if (dest.alltime) {
    const all = loadAllTimeList();
    all.push(entry);
    all.sort((a,b)=>b.score - a.score);
    saveAllTimeList(all.slice(0, 10));
  }
}

function renderTodayScores() {
  scoresTitle.textContent = '🏆 High Scores (Today)';
  const list = loadTodayScores().sort((a,b)=>b.score - a.score).slice(0, 10);
  scoresList.innerHTML = '';
  if (list.length === 0) {
    const li = document.createElement('li');
    li.innerHTML = `<span>—</span><span>0</span>`;
    scoresList.appendChild(li);
    return;
  }
  for (const s of list) {
    const li = document.createElement('li');
    li.innerHTML = `<span>${s.name}</span><span>${s.score.toLocaleString()}</span>`;
    scoresList.appendChild(li);
  }
}

function renderAllTimeScores() {
  scoresTitle.textContent = '🏆 Highest Scores (All Time)';
  const list = loadAllTimeList().sort((a,b)=>b.score - a.score).slice(0, 10);
  scoresList.innerHTML = '';
  if (list.length === 0) {
    const li = document.createElement('li');
    li.innerHTML = `<span>—</span><span>0</span>`;
    scoresList.appendChild(li);
    return;
  }
  for (const s of list) {
    const li = document.createElement('li');
    li.innerHTML = `<span>${s.name}</span><span>${s.score.toLocaleString()}</span>`;
    scoresList.appendChild(li);
  }
}

/*****************
 * INITIAL BOOT  *
 *****************/
setScreen('menu'); // applies menu background to overlay

// Boot images; never block Play if something fails
(async function boot(){
  try { if (playBtn) playBtn.disabled = true; IMGS = await loadImages(ASSETS); }
  catch(err){ console.warn('[TTT] Asset load issue (using shape fallbacks):', err); }
  finally { if (playBtn) playBtn.disabled = false; }
})();
