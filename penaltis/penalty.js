const SCENE_W = 1672;
const SCENE_H = 941;
const DECISION_SECONDS = 7;

const ASSETS = {
  idle: "../imagens/mini-game-penalty/1goleiro-parado.png",
  happy: "../imagens/mini-game-penalty/1goleiro-feliz-defendeu.png",
  sad: "../imagens/mini-game-penalty/1goleiro-triste-gol.png",
  zones: [
    "../imagens/mini-game-penalty/1goleiro-alto-esquerda.png",
    "../imagens/mini-game-penalty/1goleiro-alto-centro.png",
    "../imagens/mini-game-penalty/1goleiro-alto-direita.png",
    "../imagens/mini-game-penalty/1goleiro-baixo-esquerda.png",
    "../imagens/mini-game-penalty/1goleiro-baixo-centro.png",
    "../imagens/mini-game-penalty/1goleiro-baixo-direita.png"
  ]
};

const KEEPER_POSE = {
  idle: { scale: .88, imgX: 0, imgY: 0 },
  happy: { scale: 1.38, imgX: 0, imgY: -4 },
  sad: { scale: .90, imgX: 0, imgY: 0 },
  zones: [
    { scale: .98, imgX: -18, imgY: -8, moveX: -44, moveY: -34, shadowX: -18, shadowScale: .56 },
    { scale: 1.44, imgX: 0, imgY: -18, moveX: 0, moveY: -38, shadowX: 0, shadowScale: .52 },
    { scale: .98, imgX: 18, imgY: -8, moveX: 44, moveY: -34, shadowX: 18, shadowScale: .56 },
    { scale: .76, imgX: -24, imgY: 10, moveX: -36, moveY: 8, shadowX: -14, shadowScale: .68 },
    { scale: .74, imgX: 0, imgY: 12, moveX: 0, moveY: 10, shadowX: 0, shadowScale: .64 },
    { scale: .76, imgX: 24, imgY: 10, moveX: 36, moveY: 8, shadowX: 14, shadowScale: .68 }
  ]
};

const $ = id => document.getElementById(id);
const qs = sel => document.querySelector(sel);
const qsa = sel => [...document.querySelectorAll(sel)];

let timers = [];
let countdownTimer = null;
let meterRaf = null;
let meterDirection = 1;
let meterPos = 0;
let lastMeterTime = 0;

const state = {
  phase: "",
  locked: false,
  selectedZone: null,
  playerScore: 0,
  cpuScore: 0,
  playerKicks: [],
  cpuKicks: [],
  suddenDeath: false,
  nextSide: "player",
  decisionSeconds: DECISION_SECONDS,
  cpuKeeperZone: 0,
  playerDefenseZones: [],
  playerPrimaryDefense: null,
  gameOver: false
};

function schedule(fn, delay) {
  const t = setTimeout(fn, delay);
  timers.push(t);
  return t;
}
function clearTimers() {
  timers.forEach(clearTimeout);
  timers = [];
  if (countdownTimer) clearInterval(countdownTimer);
  countdownTimer = null;
  stopMeter();
}
function randZone() { return Math.floor(Math.random() * 6); }
function randomDistinctZones(primary, total = 4) {
  const set = new Set([primary]);
  while (set.size < total) set.add(randZone());
  return [...set];
}

function fitScene() {
  const viewport = $("sceneViewport");
  const scene = $("sceneCanvas");
  const vw = viewport.clientWidth;
  const vh = viewport.clientHeight;
  const portrait = vh > vw * 1.08;
  viewport.classList.toggle("portrait-fit", portrait);

  let scale, w, h, left, top;
  if (portrait) {
    const safeTop = Math.min(130, Math.max(92, vh * .09));
    const safeBottom = Math.min(185, Math.max(135, vh * .13));
    const usableH = Math.max(420, vh - safeTop - safeBottom);
    scale = Math.max(vw / SCENE_W, usableH / SCENE_H);
    w = SCENE_W * scale;
    h = SCENE_H * scale;
    left = (vw - w) / 2;
    top = safeTop + Math.max(-40, (usableH - h) / 2);
  } else {
    scale = Math.max(vw / SCENE_W, vh / SCENE_H);
    w = SCENE_W * scale;
    h = SCENE_H * scale;
    left = (vw - w) / 2;
    top = (vh - h) / 2;
  }
  Object.assign(scene.style, { width:`${w}px`, height:`${h}px`, left:`${left}px`, top:`${top}px` });
}

function preloadImages() {
  [ASSETS.idle, ASSETS.happy, ASSETS.sad, ...ASSETS.zones].forEach(src => { const i = new Image(); i.src = src; });
}

function setKeeper(src, pose = {}) {
  const keeper = $("penaltyGoalkeeper");
  keeper.src = src;
  keeper.style.setProperty("--keeper-art-scale", pose.scale ?? 1);
  keeper.style.setProperty("--keeper-img-x", `${pose.imgX ?? 0}%`);
  keeper.style.setProperty("--keeper-img-y", `${pose.imgY ?? 0}%`);
}

function cancelAnimations(...els) {
  els.flat().forEach(el => {
    if (!el) return;
    el.getAnimations().forEach(a => a.cancel());
    el.style.removeProperty("transform");
    el.style.removeProperty("opacity");
    el.style.removeProperty("filter");
  });
}

function resetVisuals() {
  const app = $("penaltyApp");
  const box = $("keeperBox");
  const shadow = $("keeperShadow");
  const ball = $("penaltyBall");
  const ballShadow = $("ballShadow");
  const result = $("penaltyResult");
  cancelAnimations(box, shadow, ball, ballShadow);
  app.classList.remove("is-shooting", "impact-goal", "impact-save", "targets-hidden");
  qsa(".target-zone").forEach(z => z.classList.remove("selected"));
  setKeeper(ASSETS.idle, KEEPER_POSE.idle);
  box.style.transform = "translate(0,0) scale(1)";
  shadow.style.transform = "translateX(-50%) scale(1)";
  shadow.style.opacity = ".34";
  ball.style.transform = "translate(-50%, -50%) scale(1) rotate(0deg)";
  ball.style.opacity = "1";
  ball.style.zIndex = "20";
  ballShadow.style.transform = "translateX(-50%) scale(1)";
  ballShadow.style.opacity = "1";
  result.className = "penalty-result";
  result.textContent = "";
}

function updateScoreUI() {
  $("playerScore").textContent = state.playerScore;
  $("cpuScore").textContent = state.cpuScore;
  renderHistory("playerHistory", state.playerKicks);
  renderHistory("cpuHistory", state.cpuKicks);

  const pairNo = Math.max(state.playerKicks.length, state.cpuKicks.length) + 1;
  $("roundLabel").textContent = state.suddenDeath ? `ALTERNADAS • ${pairNo - 5}ª` : `${Math.min(pairNo,5)}ª COBRANÇA`;
}

function renderHistory(id, arr) {
  const el = $(id);
  el.innerHTML = "";
  const baseCount = Math.max(5, arr.length);
  for (let i = 0; i < baseCount; i++) {
    const dot = document.createElement("span");
    dot.className = "kick-dot";
    if (arr[i] === "goal") { dot.classList.add("goal"); dot.textContent = "✓"; }
    if (arr[i] === "miss") { dot.classList.add("miss"); dot.textContent = "×"; }
    el.appendChild(dot);
  }
}

function setTimerVisible(visible) { $("timerBox").style.visibility = visible ? "visible" : "hidden"; }
function startCountdown(onTimeout) {
  if (countdownTimer) clearInterval(countdownTimer);
  state.decisionSeconds = DECISION_SECONDS;
  setTimerVisible(true);
  updateTimerUI();
  countdownTimer = setInterval(() => {
    state.decisionSeconds -= 1;
    updateTimerUI();
    if (state.decisionSeconds <= 0) {
      clearInterval(countdownTimer); countdownTimer = null;
      onTimeout();
    }
  }, 1000);
}
function stopCountdown() {
  if (countdownTimer) clearInterval(countdownTimer);
  countdownTimer = null;
  setTimerVisible(false);
}
function updateTimerUI() {
  const box = $("timerBox");
  $("turnTimer").textContent = Math.max(0, state.decisionSeconds);
  box.classList.toggle("warning", state.decisionSeconds <= 4 && state.decisionSeconds > 2);
  box.classList.toggle("danger", state.decisionSeconds <= 2);
}

function setTargetInteractive(enabled) {
  qsa(".target-zone").forEach(btn => { btn.disabled = !enabled; });
  $("penaltyApp").classList.toggle("targets-hidden", !enabled);
}

function startPlayerKick() {
  clearTimers(); resetVisuals();
  state.phase = "player_target"; state.locked = false; state.selectedZone = null;
  $("accuracyWrap").hidden = true;
  $("hiddenDefenseInfo").hidden = true;
  $("penaltyAgainButton").hidden = true;
  $("restartMatchButton").hidden = true;
  $("shotTitle").textContent = "SUA VEZ DE BATER";
  $("penaltyInstruction").textContent = "Escolha um dos 6 cantos do gol.";
  state.cpuKeeperZone = randZone();
  setTargetInteractive(true);
  startCountdown(() => selectPlayerTarget(randZone(), true));
}

function selectPlayerTarget(zone, timedOut = false) {
  if (state.phase !== "player_target" || state.locked) return;
  stopCountdown();
  state.selectedZone = zone;
  qsa(".target-zone").forEach(z => z.classList.toggle("selected", Number(z.dataset.zone) === zone));
  setTargetInteractive(false);
  state.phase = "player_power";
  $("accuracyWrap").hidden = false;
  $("shotTitle").textContent = timedOut ? "TEMPO! CANTO SORTEADO" : "TRAVE A PRECISÃO";
  $("penaltyInstruction").textContent = "Toque em CHUTAR quando o marcador estiver o mais perto possível do verde.";
  startMeter();
  startCountdown(() => commitPlayerShot());
}

function startMeter() {
  stopMeter();
  meterPos = 0; meterDirection = 1; lastMeterTime = performance.now();
  const marker = $("accuracyMarker");
  function tick(now) {
    const dt = Math.min(35, now - lastMeterTime); lastMeterTime = now;
    meterPos += meterDirection * dt * .095;
    if (meterPos >= 100) { meterPos = 100; meterDirection = -1; }
    if (meterPos <= 0) { meterPos = 0; meterDirection = 1; }
    marker.style.left = `${meterPos}%`;
    meterRaf = requestAnimationFrame(tick);
  }
  meterRaf = requestAnimationFrame(tick);
}
function stopMeter() { if (meterRaf) cancelAnimationFrame(meterRaf); meterRaf = null; }

function outChanceFromMeter(pos) {
  const dist = Math.abs(pos - 50);
  if (dist <= 10) return .02;
  if (dist <= 25) return .12;
  if (dist <= 38) return .28;
  return .50;
}

function commitPlayerShot() {
  if (state.phase !== "player_power" || state.locked) return;
  state.locked = true;
  stopCountdown(); stopMeter();
  $("accuracyWrap").hidden = true;
  const chanceOut = outChanceFromMeter(meterPos);
  const isOut = Math.random() < chanceOut;
  const saved = !isOut && state.selectedZone === state.cpuKeeperZone;
  playShot({ shooter:"player", zone:state.selectedZone, keeperZone:state.cpuKeeperZone, saved, isOut });
}

function startCpuKick() {
  clearTimers(); resetVisuals();
  state.phase = "player_defense"; state.locked = false; state.playerPrimaryDefense = null; state.playerDefenseZones = [];
  $("accuracyWrap").hidden = true;
  $("hiddenDefenseInfo").hidden = false;
  $("penaltyAgainButton").hidden = true;
  $("shotTitle").textContent = "AGORA VOCÊ DEFENDE";
  $("penaltyInstruction").textContent = "Escolha 1 zona. O sistema acrescentará +3 zonas secretas de defesa.";
  setTargetInteractive(true);
  startCountdown(() => choosePlayerDefense(randZone(), true));
}

function choosePlayerDefense(zone, timedOut = false) {
  if (state.phase !== "player_defense" || state.locked) return;
  state.locked = true; stopCountdown();
  state.playerPrimaryDefense = zone;
  state.playerDefenseZones = randomDistinctZones(zone, 4);
  qsa(".target-zone").forEach(z => z.classList.toggle("selected", Number(z.dataset.zone) === zone));
  setTargetInteractive(false);
  $("hiddenDefenseInfo").hidden = true;
  $("shotTitle").textContent = timedOut ? "TEMPO! DEFESA SORTEADA" : "CPU VAI BATER";
  $("penaltyInstruction").textContent = "Preparando a cobrança da CPU...";

  schedule(() => {
    const cpuZone = randZone();
    const cpuMeter = 18 + Math.random() * 64;
    const isOut = Math.random() < outChanceFromMeter(cpuMeter) * .62;
    const saved = !isOut && state.playerDefenseZones.includes(cpuZone);
    const keeperZone = saved ? cpuZone : state.playerPrimaryDefense;
    playShot({ shooter:"cpu", zone:cpuZone, keeperZone, saved, isOut });
  }, 850);
}

function zoneButton(index) { return qs(`.target-zone[data-zone="${index}"]`); }
function centerDelta(fromEl, toEl) {
  const a = fromEl.getBoundingClientRect(), b = toEl.getBoundingClientRect();
  return { x:b.left+b.width/2-(a.left+a.width/2), y:b.top+b.height/2-(a.top+a.height/2) };
}

function animateBall(zoneIndex, saved, isOut) {
  const ball = $("penaltyBall");
  const shadow = $("ballShadow");
  const target = zoneButton(zoneIndex).querySelector("span");
  const keeperBox = $("keeperBox");
  const {x,y} = centerDelta(ball,target);
  const keep = centerDelta(ball,keeperBox);
  const col = zoneIndex % 3;
  const side = col===0 ? -1 : col===2 ? 1 : 0;
  const high = zoneIndex < 3;
  const curve = side * (high ? 22 : 15);

  if (!isOut) schedule(() => { ball.style.zIndex = saved ? "22" : "17"; }, 250);

  shadow.animate([
    {transform:"translateX(-50%) scale(1)",opacity:1},
    {transform:`translateX(calc(-50% + ${x*.23}px)) scale(.68)`,opacity:.35,offset:.35},
    {transform:`translateX(calc(-50% + ${x*.52}px)) scale(.40)`,opacity:.13,offset:.70},
    {transform:`translateX(calc(-50% + ${x*.66}px)) scale(.24)`,opacity:0}
  ],{duration:720,easing:"ease-out",fill:"forwards"});

  const liftA = high ? -34 : -17, liftB = high ? -20 : -8;
  const frames = [
    {transform:"translate(-50%,-50%) translate(0,0) scale(1) rotate(0deg)"},
    {transform:`translate(-50%,-50%) translate(${x*.24-curve*.30}px,${y*.24+liftA}px) scale(.78) rotate(${135+side*80}deg)`,offset:.30},
    {transform:`translate(-50%,-50%) translate(${x*.62-curve}px,${y*.62+liftB}px) scale(.50) rotate(${315+side*150}deg)`,offset:.72}
  ];

  if (isOut) {
    const outSide = side || (Math.random()<.5?-1:1);
    frames.push({ transform:`translate(-50%,-50%) translate(${x + outSide*135}px,${y - (high?70:20)}px) scale(.26) rotate(${680+outSide*180}deg)`, opacity:.88 });
  } else if (saved) {
    const catchMap = [
      {x:keep.x-82,y:keep.y-58},{x:keep.x,y:keep.y-82},{x:keep.x+82,y:keep.y-58},
      {x:keep.x-72,y:keep.y-8},{x:keep.x,y:keep.y+8},{x:keep.x+72,y:keep.y-8}
    ][zoneIndex];
    frames.push({ transform:`translate(-50%,-50%) translate(${catchMap.x}px,${catchMap.y}px) scale(.34) rotate(${540+side*90}deg)`, opacity:1 });
  } else {
    frames.push({ transform:`translate(-50%,-50%) translate(${x}px,${y}px) scale(.27) rotate(${630+side*220}deg)` });
  }

  ball.animate(frames,{duration:saved?760:720,easing:"cubic-bezier(.16,.72,.17,1)",fill:"forwards"});
}

function animateKeeper(zoneIndex) {
  const box=$("keeperBox"), shadow=$("keeperShadow"), move=KEEPER_POSE.zones[zoneIndex];
  box.animate([
    {transform:"translate(0,0) scale(1)"},
    {transform:"translate(0,2.2%) scale(1,.98)",offset:.20},
    {transform:`translate(${move.moveX*.32}%,${move.moveY*.32}%) scale(1)`,offset:.38}
  ],{duration:170,easing:"ease-out",fill:"forwards"});
  schedule(()=>{
    setKeeper(ASSETS.zones[zoneIndex],move);
    box.animate([
      {transform:`translate(${move.moveX*.32}%,${move.moveY*.32}%) scale(1)`},
      {transform:`translate(${move.moveX}%,${move.moveY}%) scale(1)`,offset:.68},
      {transform:`translate(${move.moveX*.98}%,${move.moveY}%) scale(1)`}
    ],{duration:470,easing:"cubic-bezier(.12,.76,.20,1)",fill:"forwards"});
  },135);
  shadow.animate([
    {transform:"translateX(-50%) scale(1)",opacity:.34},
    {transform:`translateX(calc(-50% + ${move.shadowX}%)) scale(${move.shadowScale},.52)`,opacity:.16}
  ],{duration:590,easing:"ease-out",fill:"forwards"});
}

function impact(saved) {
  const app=$("penaltyApp"); app.classList.remove("impact-goal","impact-save"); void app.offsetWidth;
  app.classList.add(saved?"impact-save":"impact-goal");
}

function showReaction(saved) {
  const box=$("keeperBox");
  setKeeper(saved?ASSETS.happy:ASSETS.sad,saved?KEEPER_POSE.happy:KEEPER_POSE.sad);
  box.animate([{transform:"translate(0,0)"},{transform:"translate(0,-.45%)",offset:.52},{transform:"translate(0,0)"}],{duration:360,easing:"ease-out",fill:"forwards"});
}

function playShot({shooter,zone,keeperZone,saved,isOut}) {
  state.phase="animating";
  const app=$("penaltyApp"); app.classList.add("is-shooting","targets-hidden");
  $("shotTitle").textContent = shooter==="player" ? "CHUTOU!" : "CPU CHUTOU!";
  $("penaltyInstruction").textContent = "Acompanhe a cobrança...";

  $("penaltyBall").animate([
    {transform:"translate(-50%,-50%) scale(1)"},
    {transform:"translate(-50%,-50%) scale(.94)",offset:.48},
    {transform:"translate(-50%,-50%) scale(1.04)"}
  ],{duration:150,easing:"ease-out"});

  schedule(()=>animateBall(zone,saved,isOut),115);
  schedule(()=>animateKeeper(keeperZone),190);
  schedule(()=>impact(saved),830);
  schedule(()=>finishShot({shooter,saved,isOut}),1100);
}

function finishShot({shooter,saved,isOut}) {
  const scored = !saved && !isOut;
  if (shooter === "player") {
    if (scored) state.playerScore++;
    state.playerKicks.push(scored?"goal":"miss");
  } else {
    if (scored) state.cpuScore++;
    state.cpuKicks.push(scored?"goal":"miss");
  }
  updateScoreUI();

  const result=$("penaltyResult");
  let text, cls;
  if (isOut) { text="FORA!"; cls="out"; }
  else if (saved) { text="DEFENDEU!"; cls="save"; }
  else { text = shooter==="player" ? "GOOOOL!" : "GOL DA CPU!"; cls="goal"; }
  result.className=`penalty-result show ${cls}`;
  result.textContent=text;

  if (!isOut) showReaction(saved);
  else setKeeper(ASSETS.idle,KEEPER_POSE.idle);

  const winner = evaluateWinner();
  if (winner) {
    schedule(()=>showGameOver(winner),600);
    return;
  }

  state.nextSide = shooter === "player" ? "cpu" : "player";
  $("shotTitle").textContent = shooter==="player" ? "FIM DA SUA COBRANÇA" : "FIM DA COBRANÇA DA CPU";
  $("penaltyInstruction").textContent = state.nextSide==="player" ? "Agora você volta para o ataque." : "Agora é sua vez de defender.";
  $("penaltyAgainButton").hidden=false;
}

function evaluateWinner() {
  const pk=state.playerKicks.length, ck=state.cpuKicks.length;
  if (pk <= 5 && ck <= 5) {
    const playerRemaining = 5-pk;
    const cpuRemaining = 5-ck;
    if (state.playerScore > state.cpuScore + cpuRemaining) return "player";
    if (state.cpuScore > state.playerScore + playerRemaining) return "cpu";
    if (pk===5 && ck===5) {
      if (state.playerScore>state.cpuScore) return "player";
      if (state.cpuScore>state.playerScore) return "cpu";
      state.suddenDeath=true;
    }
    return null;
  }
  state.suddenDeath=true;
  if (pk===ck && pk>5 && state.playerScore!==state.cpuScore) return state.playerScore>state.cpuScore?"player":"cpu";
  return null;
}

function showGameOver(winner) {
  state.gameOver=true; state.phase="gameover"; clearTimers(); setTimerVisible(false); setTargetInteractive(false);
  $("penaltyAgainButton").hidden=true; $("restartMatchButton").hidden=false;
  $("shotTitle").textContent = winner==="player" ? "VOCÊ VENCEU!" : "CPU VENCEU";
  $("penaltyInstruction").textContent = state.suddenDeath ? "Decisão nas cobranças alternadas." : "Fim da disputa de pênaltis.";
  const result=$("penaltyResult"); result.className="penalty-result show champion";
  result.textContent = winner==="player" ? "CAMPEÃO! 🏆" : "FIM DE JOGO";
}

function nextKick() {
  if (state.gameOver) return;
  if (state.nextSide === "player") startPlayerKick(); else startCpuKick();
}

function restartMatch() {
  clearTimers();
  Object.assign(state,{phase:"",locked:false,selectedZone:null,playerScore:0,cpuScore:0,playerKicks:[],cpuKicks:[],suddenDeath:false,nextSide:"player",decisionSeconds:DECISION_SECONDS,cpuKeeperZone:0,playerDefenseZones:[],playerPrimaryDefense:null,gameOver:false});
  updateScoreUI();
  startPlayerKick();
}

qsa(".target-zone").forEach(btn=>{
  btn.addEventListener("click",()=>{
    const zone=Number(btn.dataset.zone);
    if (state.phase==="player_target") selectPlayerTarget(zone);
    else if (state.phase==="player_defense") choosePlayerDefense(zone);
  });
});
$("shootButton").addEventListener("click",commitPlayerShot);
$("accuracyBar").addEventListener("click",()=>{ if(state.phase==="player_power") commitPlayerShot(); });
$("penaltyAgainButton").addEventListener("click",nextKick);
$("restartMatchButton").addEventListener("click",restartMatch);
$("penaltyBackButton").addEventListener("click",()=>{window.location.href="../";});
window.addEventListener("resize",fitScene);
window.addEventListener("orientationchange",()=>setTimeout(fitScene,80));

preloadImages();
fitScene();
restartMatch();
