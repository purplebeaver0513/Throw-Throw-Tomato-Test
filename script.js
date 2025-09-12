"use strict";

/** ====== Assets (GitHub raw) ====== */
const ASSETS = {
  menuFullBg:  "https://raw.githubusercontent.com/purplebeaver0513/Throw-Throw-Tomato-Assets/main/1000025560.png",
  gameBg:      "https://raw.githubusercontent.com/purplebeaver0513/Throw-Throw-Tomato-Assets/main/1000025608.png",
  tomato:      "https://raw.githubusercontent.com/purplebeaver0513/Throw-Throw-Tomato-Assets/main/file_000000006e5061fd92760a84f59a4fa3__1_-removebg-preview.png",
  tomatoSplat: "https://raw.githubusercontent.com/purplebeaver0513/Throw-Throw-Tomato-Assets/main/file_00000000c84c6230b19da260b17746ed__1_-removebg-preview.png",
  farmerAngry: "https://raw.githubusercontent.com/purplebeaver0513/Throw-Throw-Tomato-Assets/main/file_000000009a4c61f7b258eabae653aec9-removebg-preview.png",
  targetYellow:"https://raw.githubusercontent.com/purplebeaver0513/Throw-Throw-Tomato-Assets/main/1000025399-removebg-preview.png",
  targetOrange:"https://raw.githubusercontent.com/purplebeaver0513/Throw-Throw-Tomato-Assets/main/1000025398-removebg-preview.png",
  targetRed:   "https://raw.githubusercontent.com/purplebeaver0513/Throw-Throw-Tomato-Assets/main/1000025397-removebg-preview.png",
};

/** ====== Helper DOM & safe listeners ====== */
const $ = (id) => document.getElementById(id);
const on = (el, ev, fn) => { if (el) el.addEventListener(ev, fn); };

/** ====== DOM refs ====== */
const canvas = $('gameCanvas'), ctx = canvas.getContext('2d');

const timerDisplay = $('timer');
const scoreDisplay = $('score');
const pauseBtn = $('pauseBtn');
const exitBtn = $('exitBtn');
const countdownDiv = $('countdown');

const mainMenu = $('mainMenu');
const playBtn = $('playBtn');
const openScoresBtn = $('openScoresBtn');

const highscoresScreen = $('highscoresScreen');
const scoresTitle = $('scoresTitle');
const scoresList = $('scoresList');
const showAllTimeBtn = $('showAllTimeBtn');
const scoresToMenuBtn = $('scoresToMenuBtn');

const nameEntry = $('nameEntry');
const finalScoreValue = $('finalScoreValue');
const playerNameInput = $('playerName');
const saveScoreBtn = $('saveScoreBtn');
const cancelSaveBtn = $('cancelSaveBtn');

const toMenuOverlay = $('toMenuOverlay');
const toMenuBtn = $('toMenuBtn');
const finalScoreValue2 = $('finalScoreValue2');

const settingsBtn = $('settingsBtn');
const updateLogBtn = $('updateLogBtn');
const settingsPanel = $('settingsPanel');
const updateLogPanel = $('updateLogPanel');
const closeSettings = $('closeSettings');
const closeUpdateLog = $('closeUpdateLog');
const closeSettingsX = $('closeSettingsX');
const closeUpdateLogX = $('closeUpdateLogX');
const musicVolumeSlider = $('musicVolume');
const sfxVolumeSlider = $('sfxVolume');

/** ====== Preload images (tolerant) ====== */
let IMGS = null;
function loadImages(manifest) {
  const entries = Object.entries(manifest);
  const images = {};
  let done = 0;
  return new Promise((resolve) => {
    const finish = () => { if (++done === entries.length) resolve(images); };
    for (const [key, url] of entries) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => { images[key] = img; finish(); };
      img.onerror = () => { console.warn("[TTT] Failed to load:", url); finish(); };
      img.src = url;
    }
  });
}

/** ====== Canvas sizing ====== */
const LOGICAL_W = 1800, LOGICAL_H = 600;
function setExactCanvasSize() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width  = Math.round(LOGICAL_W * dpr);
  canvas.height = Math.round(LOGICAL_H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = true;
}
setExactCanvasSize();
on(window, 'resize', setExactCanvasSize);

/** ====== Menu background ====== */
function applyMenuBackground() {
  if (!mainMenu) return;
  mainMenu.style.backgroundImage = `url('${ASSETS.menuFullBg}')`;
  mainMenu.style.backgroundSize = 'cover';
  mainMenu.style.backgroundRepeat = 'no-repeat';
  mainMenu.style.backgroundPosition = 'center center';
}
function clearMenuBackground() { if (mainMenu) mainMenu.style.backgroundImage = ''; }

/** ====== Game state ====== */
let score = 0, timeLeft = 20;
let cooldown = false, isGameOver = false, isGameStarted = false, isPaused = false;

let targets = [], tomatoes = [], popups = [], splats = [];
let inBonusRound = false, bonusFarmer = null, showBonusPrompt = false;

let animId = null, gameInterval = null;
let countdownActive = false, countdownTimerId = null;

let musicVolume = 1.0, sfxVolume = 1.0;
let pendingScore = 0, pendingDestinations = { today: false, alltime: false };

let comboCount = 0, bestStreak = 0, lastHitTime = 0;
const COMBO_TIMEOUT = 1750;

/** ====== Helpers & spawn ====== */
const randomInt = (min, max) => Math.floor(Math.random() * (max - min) + min);
const SPAWN_BAND_LEFT_RATIO = 0.30;
const SPAWN_BAND_WIDTH_RATIO = 0.40;
const SPAWN_AREA_X = () => (canvas.width / (window.devicePixelRatio || 1)) * SPAWN_BAND_LEFT_RATIO;
const SPAWN_AREA_W = () => (canvas.width / (window.devicePixelRatio || 1)) * SPAWN_BAND_WIDTH_RATIO;
const SPAWN_PAD = 40;
function buildMiddleLanes(count = 5) {
  const left = SPAWN_AREA_X() + SPAWN_PAD;
  const right = SPAWN_AREA_X() + SPAWN_AREA_W() - SPAWN_PAD;
  if (count <= 1) return [Math.floor((left + right) / 2)];
  const step = (right - left) / (count - 1);
  return Array.from({ length: count }, (_, i) => Math.floor(left + i * step));
}

/** ====== FX ====== */
class Popup {
  constructor(x, y, text, color = '#111') {
    this.x = x; this.y = y; this.text = text; this.color = color;
    this.alpha = 1; this.dy = -1.2; this.life = 60; this.size = 28;
  }
  update(){ this.y += this.dy; this.life--; this.alpha = Math.max(0, this.life/60); }
  draw(){
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.font = `800 ${this.size}px Nunito, sans-serif`;
    ctx.fillStyle = this.color; ctx.textAlign = 'center';
    ctx.fillText(this.text, this.x, this.y);
    ctx.restore();
  }
  get dead(){ return this.life <= 0; }
}
class Splat {
  constructor(x, y, imgKey='tomatoSplat', life=42, scale=1.1){
    this.x=x; this.y=y; this.imgKey=imgKey; this.life=life; this.max=life; this.scale=scale;
  }
  update(){ this.life--; }
  draw(){
    const a = Math.max(0, this.life/this.max);
    const img = IMGS && IMGS[this.imgKey]; if (!img) return;
    const s = 90 * this.scale;
    ctx.save(); ctx.globalAlpha = a;
    ctx.drawImage(img, this.x - s/2, this.y - s/2, s, s);
    ctx.restore();
  }
  get dead(){ return this.life <= 0; }
}

/** ====== Entities ====== */
class Tomato {
  constructor(tx, ty){ this.x=LOGICAL_W/2; this.y=LOGICAL_H-40; this.tx=tx; this.ty=ty; this.r=10; this.speed=18; }
  update(){
    const dx=this.tx-this.x, dy=this.ty-this.y, d=Math.hypot(dx,dy);
    if (d>this.speed){ this.x += (dx/d)*this.speed; this.y += (dy/d)*this.speed; }
    else this.hit();
  }
  hit(){
    let awarded=false;
    for (let i=targets.length-1; i>=0; i--){
      const t = targets[i];
      if (t && Math.hypot(this.x - t.x, this.y - t.y) < t.radius + this.r){
        const pts = applyComboAndReturnPoints(t.points, t.x, t.y - 10);
        score += pts; if (scoreDisplay) scoreDisplay.innerText = `Score: ${score.toLocaleString()}`;
        popups.push(new Popup(t.x, t.y - 10, `+${pts}`, '#111'));
        splats.push(new Splat(t.x, t.y - 6, 'tomatoSplat', 44, 1.0));
        targets.splice(i,1); awarded=true; break;
      }
    }
    if (!awarded && inBonusRound && bonusFarmer){
      const hb=bonusFarmer.hitbox, fb=bonusFarmer.bodyBox;
      const onHead=(this.x>hb.x && this.x<hb.x+hb.width && this.y>hb.y && this.y<hb.y+hb.height);
      const onBody=(this.x>fb.x && this.x<fb.x+fb.width && this.y>fb.y && this.y<fb.y+fb.height);
      if (onHead){
        if (!bonusFarmer.headHits){
          const pts=applyComboAndReturnPoints(100,hb.x+hb.width/2,hb.y-8);
          score+=pts; popups.push(new Popup(hb.x+hb.width/2,hb.y-8,`+${pts}`,'#e11d48'));
        } else {
          score=Math.floor(score*2);
          popups.push(new Popup(hb.x+hb.width/2,hb.y-8,'x2!','#e11d48'));
          bumpCombo(hb.x+hb.width/2,hb.y-26,true);
        }
        splats.push(new Splat(hb.x+hb.width/2,hb.y,'tomatoSplat',44,1.2));
        bonusFarmer.headHits=(bonusFarmer.headHits||0)+1;
        if (scoreDisplay) scoreDisplay.innerText=`Score: ${score.toLocaleString()}`; awarded=true;
      } else if (onBody){
        if (!bonusFarmer.bodyHits){
          const pts=applyComboAndReturnPoints(50,fb.x+fb.width/2,fb.y+fb.height/2);
          score+=pts; popups.push(new Popup(fb.x+fb.width/2,fb.y+fb.height/2,`+${pts}`,'#1d4ed8'));
        } else {
          score=Math.floor(score*1.5);
          popups.push(new Popup(fb.x+fb.width/2,fb.y+fb.height/2,'x1.5!','#1d4ed8'));
          bumpCombo(fb.x+fb.width/2,fb.y+fb.height/2-18,true);
        }
        splats.push(new Splat(fb.x+fb.width/2,fb.y+fb.height/2,'tomatoSplat',40,1.1));
        bonusFarmer.bodyHits=(bonusFarmer.bodyHits||0)+1;
        if (scoreDisplay) scoreDisplay.innerText=`Score: ${score.toLocaleString()}`; awarded=true;
      }
    }
    const idx = tomatoes.indexOf(this); if (idx !== -1) tomatoes.splice(idx,1);
  }
  draw(){
    if (IMGS && IMGS.tomato){ const s=28; ctx.drawImage(IMGS.tomato, this.x-s/2, this.y-s/2, s, s); }
    else { ctx.beginPath(); ctx.fillStyle='tomato'; ctx.arc(this.x, this.y, this.r, 0, Math.PI*2); ctx.fill(); }
  }
}
class Target {
  constructor(tier=1){
    this.radius=30; this.tier=tier; this.points= tier===1?10 : tier===2?20 : 50;
    this.speedX= tier===1?0 : (tier===2?1.2:2.1);
    const leftInside = SPAWN_AREA_X() + SPAWN_PAD + this.radius;
    if (tier===1){ const lanes=buildMiddleLanes(5); this.x=lanes[randomInt(0,lanes.length)]; this.y=320; }
    else if (tier===2){ this.x=leftInside; this.y=220; }
    else { this.x=leftInside; this.y=120; }
    this.leftBound = SPAWN_AREA_X() + SPAWN_PAD - this.radius;
    this.rightBound= SPAWN_AREA_X() + SPAWN_AREA_W() - SPAWN_PAD + this.radius;
  }
  update(){
    if (this.speedX){
      this.x += this.speedX;
      if (this.x > this.rightBound) this.x = this.leftBound;
      if (this.x < this.leftBound) this.x = this.rightBound;
    }
  }
  draw(){
    const size = this.radius*2.8;
    let img = null;
    if (IMGS) img = this.tier===1?IMGS.targetYellow : (this.tier===2?IMGS.targetOrange:IMGS.targetRed);
    if (img) ctx.drawImage(img, this.x-size/2, this.y-size/2, size, size);
    else { ctx.beginPath(); ctx.fillStyle='gray'; ctx.arc(this.x,this.y,this.radius,0,Math.PI*2); ctx.fill(); }
  }
}
class Farmer {
  constructor(){
    const bandLeft=SPAWN_AREA_X(), bandRight=SPAWN_AREA_X()+SPAWN_AREA_W();
    this.width=140; this.height=140; this.x=bandLeft-this.width-40; this.y=180;
    this.t=0; this.phase='enter'; this.phaseTimer=0; this.active=false;
    this.hitbox = { x: this.x + this.width*0.33, y: this.y + 6,  width: this.width*0.34, height: 24 };
    /* ✅ Correct property syntax (no strict-mode crash) */
    this.bodyBox = { x: this.x + this.width * 0.08, y: this.y + 28, width: this.width * 0.84, height: this.height - 36 };

    const bandWidth=bandRight-bandLeft, frames=10*60; this.enterSpeedX=bandWidth/frames;
    this.poseX = bandLeft + bandWidth*0.55 - this.width/2; this.poseY = this.y;
  }
  update(){
    this.hitbox.x=this.x+this.width*0.33; this.hitbox.y=this.y+6;
    this.bodyBox.x=this.x+this.width*0.08; this.bodyBox.y=this.y+28;

    if (!this.active) return;
    this.t++; this.phaseTimer++;
    const bob = Math.sin(this.t*0.25)*2;

    if (this.phase==='enter'){
      this.x += this.enterSpeedX*1.1;
      this.y = 180 + bob;
      if (this.x >= this.poseX){ this.x=this.poseX; this.phase='pose'; this.phaseTimer=0; }
    } else if (this.phase==='pose'){
      this.y = this.poseY + Math.sin(this.t*0.15)*1.0;
      if (this.phaseTimer > 180){ this.phase='exit'; this.phaseTimer=0; }
    } else if (this.phase==='exit'){
      this.y += 1.6; this.x += 0.4;
      if (this.y > LOGICAL_H + 40) endBonusRound();
    }
  }
  draw(){
    if (IMGS && IMGS.farmerAngry) ctx.drawImage(IMGS.farmerAngry, this.x, this.y, this.width, this.height);
    else { ctx.fillStyle='brown'; ctx.fillRect(this.x,this.y,this.width,this.height); }
  }
}

/** ====== Combo ====== */
const getComboMultiplier = () => comboCount < 5 ? 1 : 1 + 0.012 * (comboCount - 4);
function bumpCombo(px,py,show=true){
  const now = performance.now();
  comboCount = (now - lastHitTime <= COMBO_TIMEOUT) ? (comboCount+1) : 1;
  lastHitTime = now;
  if (show && comboCount >= 5) popups.push(new Popup(px, py, `COMBO x${comboCount}`, '#7c3aed'));
}
function applyComboAndReturnPoints(base,px,py){
  bumpCombo(px, py - 18, true);
  return Math.floor(base * getComboMultiplier());
}

/** ====== Background & HUD ====== */
function drawBackground(){
  ctx.fillStyle='#a0e0ff';
  ctx.fillRect(0,0,LOGICAL_W,LOGICAL_H);
  const img = IMGS && IMGS.gameBg; if (!img) return;
  const cw=LOGICAL_W, ch=LOGICAL_H, iw=img.width, ih=img.height;
  const car=cw/ch, iar=iw/ih; let sx,sy,sw,sh;
  if (iar > car){ sh = ih; sw = Math.floor(ih*car); sx = Math.floor((iw-sw)/2); sy = 0; }
  else { sw = iw; sh = Math.floor(iw/car); sx = 0; sy = Math.floor((ih-sh)/2); }
  ctx.drawImage(img, sx,sy,sw,sh, 0,0,cw,ch);
}
function drawLauncher(){ ctx.fillStyle='#7b3f00'; ctx.fillRect(LOGICAL_W/2-12, LOGICAL_H-30, 24, 24); }
function drawComboBar(){
  if (comboCount <= 0) return;
  const now=performance.now(), elapsed=now-lastHitTime, remain=Math.max(0,COMBO_TIMEOUT-elapsed), pct=Math.max(0,Math.min(1,remain/COMBO_TIMEOUT));
  const x=LOGICAL_W/2-260, y=14, w=520, h=18;
  ctx.fillStyle='rgba(0,0,0,0.15)'; ctx.fillRect(x,y,w,h);
  ctx.fillStyle= comboCount>=5 ? '#f59e0b' : '#3b82f6'; ctx.fillRect(x,y,w*pct,h);
  ctx.font='700 16px Nunito, sans-serif'; ctx.fillStyle='#111827'; ctx.textAlign='center';
  if (comboCount>=5){
    const extra=Math.round((getComboMultiplier()-1)*1000)/10;
    ctx.fillText(`Combo x${comboCount} (+${extra}%)`, x+w/2, y+h-3);
  } else ctx.fillText(`Combo x${comboCount}`, x+w/2, y+h-3);
}

/** ====== Loop ====== */
function update(){
  if (!isGameStarted) return;

  ctx.clearRect(0,0,LOGICAL_W,LOGICAL_H);
  drawBackground();

  // Spawn band visualization
  const bandX=SPAWN_AREA_X(), bandW=SPAWN_AREA_W();
  ctx.fillStyle='rgba(0,255,0,0.10)'; ctx.fillRect(bandX,0,bandW,LOGICAL_H);
  ctx.fillStyle='rgba(255,255,255,0.22)';
  ctx.fillRect(bandX,0,SPAWN_PAD,LOGICAL_H);
  ctx.fillRect(bandX+bandW-SPAWN_PAD,0,SPAWN_PAD,LOGICAL_H);

  if (!isPaused){
    if (inBonusRound && bonusFarmer) bonusFarmer.update();
    else {
      for (let i=0;i<targets.length;i++){
        const t=targets[i];
        if (!t || typeof t.update!=='function' || typeof t.draw!=='function'){ targets.splice(i,1); i--; continue; }
        t.update();
      }
    }
    for (const tm of tomatoes) tm.update();
    for (let i=popups.length-1;i>=0;i--){ popups[i].update(); if (popups[i].dead) popups.splice(i,1); }
    for (let i=splats.length-1;i>=0;i--){ splats[i].update(); if (splats[i].dead) splats.splice(i,1); }
  }

  if (inBonusRound && bonusFarmer){
    bonusFarmer.draw();
    if (showBonusPrompt){
      ctx.save();
      ctx.font='900 64px Nunito, sans-serif'; ctx.fillStyle='#1f2937'; ctx.textAlign='center';
      ctx.fillText('SHOOT THE FARMER', LOGICAL_W/2, LOGICAL_H/2-40);
      ctx.restore();
    }
  } else {
    for (const t of targets) t.draw();
  }
  for (const tm of tomatoes) tm.draw();
  for (const s of splats) s.draw();
  for (const p of popups) p.draw();

  drawComboBar();
  drawLauncher();

  if (isPaused){
    ctx.save(); ctx.fillStyle='rgba(0,0,0,0.35)'; ctx.fillRect(0,0,LOGICAL_W,LOGICAL_H);
    ctx.font='900 64px Nunito, sans-serif'; ctx.fillStyle='#fff'; ctx.textAlign='center'; ctx.fillText('PAUSED', LOGICAL_W/2, LOGICAL_H/2-10); ctx.restore();
  }

  animId = requestAnimationFrame(update);
}

/** ====== Lifecycle ====== */
function cleanupGameLoops(){
  if (animId){ cancelAnimationFrame(animId); animId=null; }
  if (gameInterval){ clearInterval(gameInterval); gameInterval=null; }
  if (countdownTimerId){ clearInterval(countdownTimerId); countdownTimerId=null; }
}
function startGame(){
  // Close panels, clear menu art
  if (settingsPanel) settingsPanel.style.display='none';
  if (updateLogPanel) updateLogPanel.style.display='none';
  clearMenuBackground();

  cleanupGameLoops();
  setExactCanvasSize();
  isPaused=false; if (pauseBtn) pauseBtn.textContent='Pause';

  setScreen('game');

  isGameStarted = true; isGameOver = false; inBonusRound = false; bonusFarmer=null;
  score = 0; timeLeft = 20; targets=[]; tomatoes=[]; popups=[]; splats=[];
  comboCount=0; lastHitTime=0; bestStreak=0;

  if (scoreDisplay) scoreDisplay.innerText = `Score: ${score}`;
  if (timerDisplay) timerDisplay.innerText = `Time: ${timeLeft}`;

  // Disable exit during countdown
  if (exitBtn) exitBtn.disabled = true;

  showCountdown(() => {
    beginMainTimer();
    if (exitBtn) exitBtn.disabled = false;
    update();
  });
}
function beginMainTimer(){
  gameInterval = setInterval(() => {
    if (isGameOver || inBonusRound){ clearInterval(gameInterval); gameInterval=null; return; }
    if (isPaused) return;

    timeLeft -= 1;
    if (timerDisplay) timerDisplay.innerText = `Time: ${timeLeft}`;

    if (timeLeft <= 0){
      clearInterval(gameInterval); gameInterval=null;
      triggerBonusRound(); return;
    }

    targets.push(new Target(1));
    if (Math.random()<0.7) targets.push(new Target(2));
    if (Math.random()<0.4) targets.push(new Target(3));
  }, 1000);
}
function showCountdown(cb){
  const messages=['Ready...','Set...','Go!'];
  let i=0; countdownActive=true;
  if (countdownDiv){ countdownDiv.style.display='block'; countdownDiv.innerText=messages[i]; }
  countdownTimerId = setInterval(() => {
    i++;
    if (i>=messages.length){
      clearInterval(countdownTimerId); countdownTimerId=null; countdownActive=false;
      if (countdownDiv) countdownDiv.style.display='none';
      cb();
    } else {
      if (countdownDiv) countdownDiv.innerText=messages[i];
    }
  }, 1000);
}
function triggerBonusRound(){
  inBonusRound=true; targets=[]; bonusFarmer=new Farmer();
  showBonusPrompt=true; setTimeout(()=>{ showBonusPrompt=false; if (bonusFarmer) bonusFarmer.active=true; }, 1000);
}
function endBonusRound(){
  inBonusRound=false; bonusFarmer=null; isGameOver=true;
  const dest=highscoreDestinations(score);
  pendingScore=score; pendingDestinations=dest;

  if (dest.today || dest.alltime){
    if (finalScoreValue) finalScoreValue.textContent = score.toLocaleString();
    if (playerNameInput) playerNameInput.value='';
    setScreen('nameEntry');
  } else {
    if (finalScoreValue2) finalScoreValue2.textContent = score.toLocaleString();
    setScreen('toMenuOverlay');
  }
}
function exitToMenu(){
  if (countdownActive) return; // ignore during countdown
  cleanupGameLoops();
  isGameOver=false; isGameStarted=false; inBonusRound=false; bonusFarmer=null;
  setScreen('menu');
}

/** ====== Input & Panels ====== */
on(canvas, 'click', (e) => {
  if (cooldown || isGameOver || !isGameStarted) return;
  const rect=canvas.getBoundingClientRect();
  const sx=LOGICAL_W/rect.width, sy=LOGICAL_H/rect.height;
  const x=(e.clientX-rect.left)*sx, y=(e.clientY-rect.top)*sy;
  tomatoes.push(new Tomato(x,y));
  cooldown=true; setTimeout(()=> cooldown=false, 600);
});
on(pauseBtn, 'click', () => {
  if (!isGameStarted || countdownActive) return;
  isPaused=!isPaused;
  pauseBtn.textContent = isPaused ? 'Resume' : 'Pause';
});
on(exitBtn, 'click', exitToMenu);

// Open panels
on(settingsBtn, 'click', () => { if (settingsPanel) settingsPanel.style.display='flex'; });
on(updateLogBtn,'click', () => { if (updateLogPanel) updateLogPanel.style.display='flex'; });
// Close panels
const closeSettingsFn = () => { if (settingsPanel) settingsPanel.style.display='none'; };
const closeUpdateLogFn = () => { if (updateLogPanel) updateLogPanel.style.display='none'; };
on(closeSettings, 'click', closeSettingsFn);
on(closeSettingsX,'click', closeSettingsFn);
on(closeUpdateLog, 'click', closeUpdateLogFn);
on(closeUpdateLogX, 'click', closeUpdateLogFn);

// ESC closes topmost panel
on(window,'keydown', (e)=>{
  if (e.key === 'Escape'){
    if (updateLogPanel && updateLogPanel.style.display==='flex') closeUpdateLogFn();
    else if (settingsPanel && settingsPanel.style.display==='flex') closeSettingsFn();
  }
});

// Volume sliders
on(musicVolumeSlider, 'input', (e)=>{ musicVolume = parseFloat(e.target.value); });
on(sfxVolumeSlider,   'input', (e)=>{ sfxVolume   = parseFloat(e.target.value); });

/** ====== Screens ====== */
function setScreen(screen){
  // Hide all overlays
  if (mainMenu) mainMenu.classList.remove('active');
  if (highscoresScreen) highscoresScreen.classList.remove('active');
  if (nameEntry) nameEntry.classList.remove('active');
  if (toMenuOverlay) toMenuOverlay.classList.remove('active');

  // HUD visibility
  const ui = $('ui');
  if (ui){
    if (screen==='game') ui.classList.remove('hide'); else ui.classList.add('hide');
  }

  switch (screen){
    case 'menu':
      if (mainMenu) mainMenu.classList.add('active');
      applyMenuBackground();              // show background art
      cleanupGameLoops();                 // just in case
      countdownActive=false;
      if (exitBtn) exitBtn.disabled=false;
      isGameStarted=false;
      break;
    case 'scores':
      if (highscoresScreen) highscoresScreen.classList.add('active');
      clearMenuBackground(); break;
    case 'nameEntry':
      if (nameEntry) nameEntry.classList.add('active');
      clearMenuBackground(); break;
    case 'toMenuOverlay':
      if (toMenuOverlay) toMenuOverlay.classList.add('active');
      clearMenuBackground(); break;
    case 'game':
      clearMenuBackground(); break;
  }
}

/** ====== Highscores (local) ====== */
function todayKey(){
  const d=new Date(); const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,'0'); const day=String(d.getDate()).padStart(2,'0');
  return `tt_scores_${y}-${m}-${day}`;
}
const ALLTIME_KEY='tt_alltime_top10';
function loadTodayScores(){ try{ return JSON.parse(localStorage.getItem(todayKey()))||[]; } catch{ return []; } }
function saveTodayScores(a){ localStorage.setItem(todayKey(), JSON.stringify(a)); }
function loadAllTimeList(){ try{ return JSON.parse(localStorage.getItem(ALLTIME_KEY))||[]; } catch{ return []; } }
function saveAllTimeList(a){ localStorage.setItem(ALLTIME_KEY, JSON.stringify(a)); }

function highscoreDestinations(sc){
  const t = loadTodayScores().sort((a,b)=>b.score-a.score);
  const qualifiesToday = t.length < 10 || sc > (t[9]?.score ?? -Infinity);
  const a = loadAllTimeList().sort((a,b)=>b.score-a.score);
  const qualifiesAll  = a.length < 10 || sc > (a[9]?.score ?? -Infinity);
  return { today: qualifiesToday, alltime: qualifiesAll };
}
function commitScoreWithDestinations(sc,name,dest){
  const entry={ name, score:sc, date:Date.now() };
  if (dest.today){ const t=loadTodayScores(); t.push(entry); t.sort((a,b)=>b.score-a.score); saveTodayScores(t.slice(0,10)); }
  if (dest.alltime){ const arr=loadAllTimeList(); arr.push(entry); arr.sort((a,b)=>b.score-a.score); saveAllTimeList(arr.slice(0,10)); }
}
function renderTodayScores(){
  if (!scoresTitle || !scoresList) return;
  scoresTitle.textContent='🏆 High Scores (Today)';
  const list=loadTodayScores().sort((a,b)=>b.score-a.score).slice(0,10);
  scoresList.innerHTML='';
  if (list.length===0){ const li=document.createElement('li'); li.innerHTML='<span>—</span><span>0</span>'; scoresList.appendChild(li); return; }
  for (const s of list){
    const li=document.createElement('li'); li.innerHTML=`<span>${s.name}</span><span>${s.score.toLocaleString()}</span>`;
    scoresList.appendChild(li);
  }
}
function renderAllTimeScores(){
  if (!scoresTitle || !scoresList) return;
  scoresTitle.textContent='🏆 Highest Scores (All Time)';
  const list=loadAllTimeList().sort((a,b)=>b.score-a.score).slice(0,10);
  scoresList.innerHTML='';
  if (list.length===0){ const li=document.createElement('li'); li.innerHTML='<span>—</span><span>0</span>'; scoresList.appendChild(li); return; }
  for (const s of list){
    const li=document.createElement('li'); li.innerHTML=`<span>${s.name}</span><span>${s.score.toLocaleString()}</span>`;
    scoresList.appendChild(li);
  }
}

/** ====== Boot & menu wiring ====== */
setScreen('menu'); // ensure background art appears immediately

(async function boot(){
  try { if (playBtn) playBtn.disabled=true; IMGS = await loadImages(ASSETS); }
  catch(err){ console.warn('[TTT] Asset load issue (falling back to shapes):', err); }
  finally { if (playBtn) playBtn.disabled=false; }
})();

// Main menu
on(playBtn, 'click', startGame);
on(openScoresBtn, 'click', ()=>{ renderTodayScores(); setScreen('scores'); });

// Scores screen
on(scoresToMenuBtn, 'click', ()=> setScreen('menu'));
on(showAllTimeBtn, 'click', ()=>{ renderAllTimeScores(); setScreen('scores'); });

// Name entry
on(saveScoreBtn, 'click', ()=>{
  const name = (playerNameInput?.value || 'Player').trim().slice(0,16);
  commitScoreWithDestinations(pendingScore, name, pendingDestinations);
  setScreen('menu');
});
on(cancelSaveBtn, 'click', ()=> setScreen('menu'));

// Round-over → Main Menu
on(toMenuBtn, 'click', ()=> setScreen('menu'));

console.log('[TTT] Game initialized');
