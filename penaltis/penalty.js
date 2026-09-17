const SCENE_W = 1672;
const SCENE_H = 941;

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

const KEEPER_ART_SCALE = {
  idle: .88,
  happy: 1.12,
  sad: .90,
  zones: [1.00, 1.00, 1.00, .78, .78, .78]
};

let shotLocked = false;
let cpuZone = 0;
let goals = 0;
let saves = 0;
let timers = [];

const $ = (id) => document.getElementById(id);
const qs = (sel) => document.querySelector(sel);

function schedule(fn, delay) {
  const t = setTimeout(fn, delay);
  timers.push(t);
  return t;
}
function clearTimers() {
  timers.forEach(clearTimeout);
  timers = [];
}
function randZone() { return Math.floor(Math.random() * 6); }

function fitScene() {
  const viewport = $("sceneViewport");
  const scene = $("sceneCanvas");
  const vw = viewport.clientWidth;
  const vh = viewport.clientHeight;
  const portrait = vh > vw * 1.08;

  viewport.classList.toggle("portrait-fit", portrait);

  let scale;
  let w;
  let h;
  let left;
  let top;

  if (portrait) {
    // No retrato mostramos a largura inteira da arte para nunca cortar as traves.
    scale = vw / SCENE_W;
    w = SCENE_W * scale;
    h = SCENE_H * scale;
    left = 0;
    top = Math.max(66, Math.min(108, vh * .065));
  } else {
    // No desktop/paisagem mantemos o preenchimento total da tela.
    scale = Math.max(vw / SCENE_W, vh / SCENE_H);
    w = SCENE_W * scale;
    h = SCENE_H * scale;
    left = (vw - w) / 2;
    top = (vh - h) / 2;
  }

  scene.style.width = `${w}px`;
  scene.style.height = `${h}px`;
  scene.style.left = `${left}px`;
  scene.style.top = `${top}px`;
}

function preloadImages() {
  [ASSETS.idle, ASSETS.happy, ASSETS.sad, ...ASSETS.zones].forEach((src) => {
    const img = new Image();
    img.src = src;
  });
}

function updateScore() {
  $("penaltyTestScore").textContent = `GOLS ${goals} • DEFESAS ${saves}`;
}

function cancelAnimations(...elements) {
  elements.flat().forEach((el) => {
    if (!el) return;
    el.getAnimations().forEach((a) => a.cancel());
    el.style.removeProperty("transform");
    el.style.removeProperty("opacity");
    el.style.removeProperty("filter");
  });
}

function setKeeper(src, artScale = 1) {
  const keeper = $("penaltyGoalkeeper");
  keeper.src = src;
  keeper.style.setProperty("--keeper-art-scale", artScale);
}

function resetRound() {
  clearTimers();
  shotLocked = false;
  cpuZone = randZone();

  const app = $("penaltyApp");
  const keeperBox = $("keeperBox");
  const keeperShadow = $("keeperShadow");
  const ball = $("penaltyBall");
  const ballShadow = $("ballShadow");
  const result = $("penaltyResult");

  cancelAnimations(keeperBox, keeperShadow, ball, ballShadow);
  app.classList.remove("is-shooting", "impact-goal", "impact-save");

  setKeeper(ASSETS.idle, KEEPER_ART_SCALE.idle);
  keeperBox.style.transform = "translate(0,0) scale(1)";
  keeperShadow.style.transform = "translateX(-50%) scale(1)";
  keeperShadow.style.opacity = ".34";
  ball.style.transform = "translate(-50%, -50%) scale(1) rotate(0deg)";
  ball.style.opacity = "1";
  ballShadow.style.transform = "translateX(-50%) scale(1)";
  ballShadow.style.opacity = "1";

  result.className = "penalty-result";
  result.textContent = "";
  $("shotTitle").textContent = "ESCOLHA O CANTO";
  $("penaltyInstruction").textContent = "Toque em um dos 6 alvos do gol.";
  $("penaltyAgainButton").hidden = true;
  updateScore();
}

function zoneButton(index) {
  return qs(`.target-zone[data-zone="${index}"]`);
}

function centerDelta(fromEl, toEl) {
  const a = fromEl.getBoundingClientRect();
  const b = toEl.getBoundingClientRect();
  return {
    x: b.left + b.width / 2 - (a.left + a.width / 2),
    y: b.top + b.height / 2 - (a.top + a.height / 2)
  };
}

function animateBall(zoneIndex, saved) {
  const ball = $("penaltyBall");
  const shadow = $("ballShadow");
  const target = zoneButton(zoneIndex).querySelector("span");
  const { x, y } = centerDelta(ball, target);
  const col = zoneIndex % 3;
  const side = col === 0 ? -1 : col === 2 ? 1 : 0;
  const high = zoneIndex < 3;
  const curve = side * (high ? 22 : 15);

  shadow.animate([
    { transform: "translateX(-50%) scale(1)", opacity: 1 },
    { transform: `translateX(calc(-50% + ${x * .23}px)) scale(.68)`, opacity: .35, offset: .35 },
    { transform: `translateX(calc(-50% + ${x * .52}px)) scale(.40)`, opacity: .13, offset: .70 },
    { transform: `translateX(calc(-50% + ${x * .66}px)) scale(.24)`, opacity: 0 }
  ], { duration: 720, easing: "ease-out", fill: "forwards" });

  const liftA = high ? -34 : -17;
  const liftB = high ? -20 : -8;
  const frames = [
    { transform: "translate(-50%, -50%) translate(0,0) scale(1) rotate(0deg)" },
    { transform: `translate(-50%, -50%) translate(${x * .24 - curve * .30}px, ${y * .24 + liftA}px) scale(.78) rotate(${135 + side * 80}deg)`, offset: .30 },
    { transform: `translate(-50%, -50%) translate(${x * .62 - curve}px, ${y * .62 + liftB}px) scale(.50) rotate(${315 + side * 150}deg)`, offset: .72 }
  ];

  if (saved) {
    const deflectX = side === 0 ? 34 : -side * 40;
    frames.push({
      transform: `translate(-50%, -50%) translate(${x * .84 + deflectX}px, ${y * .84 + 38}px) scale(.36) rotate(${590 + side * 210}deg)`,
      opacity: .92
    });
  } else {
    frames.push({
      transform: `translate(-50%, -50%) translate(${x}px, ${y}px) scale(.27) rotate(${630 + side * 220}deg)`
    });
  }

  ball.animate(frames, {
    duration: saved ? 760 : 720,
    easing: "cubic-bezier(.16,.72,.17,1)",
    fill: "forwards"
  });
}

function keeperMoveForZone(zoneIndex) {
  const col = zoneIndex % 3;
  const high = zoneIndex < 3;
  const side = col === 0 ? -1 : col === 2 ? 1 : 0;
  const lateralBoost = 1.30; // 30% mais para os lados
  const verticalBoost = 1.30; // 30% mais para cima nas bolas altas
  return {
    x: side * (high ? 6.0 * lateralBoost : 4.2 * lateralBoost),
    y: high ? -1.8 * verticalBoost : 1.1,
    shadowX: side * 4.6 * lateralBoost,
    shadowScale: high ? .58 : .72
  };
}

function animateKeeper(zoneIndex) {
  const box = $("keeperBox");
  const shadow = $("keeperShadow");
  const move = keeperMoveForZone(zoneIndex);

  box.animate([
    { transform: "translate(0,0) scale(1)" },
    { transform: "translate(0,1.1%) scale(1,.98)", offset: .20 },
    { transform: `translate(${move.x * .35}%, ${move.y * .35}%) scale(1)`, offset: .38 }
  ], { duration: 170, easing: "ease-out", fill: "forwards" });

  schedule(() => {
    setKeeper(ASSETS.zones[zoneIndex], KEEPER_ART_SCALE.zones[zoneIndex]);
    box.animate([
      { transform: `translate(${move.x * .35}%, ${move.y * .35}%) scale(1)` },
      { transform: `translate(${move.x}%, ${move.y}%) scale(1)`, offset: .68 },
      { transform: `translate(${move.x * .94}%, ${move.y + .25}%) scale(1)` }
    ], { duration: 470, easing: "cubic-bezier(.12,.76,.20,1)", fill: "forwards" });
  }, 135);

  shadow.animate([
    { transform: "translateX(-50%) scale(1)", opacity: .34 },
    { transform: `translateX(calc(-50% + ${move.shadowX}%)) scale(${move.shadowScale}, .52)`, opacity: .16 }
  ], { duration: 590, easing: "ease-out", fill: "forwards" });
}

function impact(saved) {
  const app = $("penaltyApp");
  app.classList.remove("impact-goal", "impact-save");
  void app.offsetWidth;
  app.classList.add(saved ? "impact-save" : "impact-goal");
}

function showReaction(saved) {
  const box = $("keeperBox");
  setKeeper(saved ? ASSETS.happy : ASSETS.sad, saved ? KEEPER_ART_SCALE.happy : KEEPER_ART_SCALE.sad);
  box.animate([
    { transform: "translate(0,0)" },
    { transform: "translate(0,-.45%)", offset: .52 },
    { transform: "translate(0,0)" }
  ], { duration: 360, easing: "ease-out", fill: "forwards" });
}

function finishRound(saved) {
  if (saved) saves += 1;
  else goals += 1;
  updateScore();

  const result = $("penaltyResult");
  result.className = `penalty-result show ${saved ? "save" : "goal"}`;
  result.textContent = saved ? "DEFENDEU!" : "GOOOOL!";
  $("shotTitle").textContent = saved ? "DEFESA DA CPU" : "GOL DO JOGADOR";
  $("penaltyInstruction").textContent = saved ? "O goleiro acertou o canto." : "A bola entrou!";
  $("penaltyAgainButton").hidden = false;
  showReaction(saved);
}

function takeShot(zoneIndex) {
  if (shotLocked || zoneIndex < 0 || zoneIndex > 5) return;
  shotLocked = true;
  const saved = zoneIndex === cpuZone;
  const app = $("penaltyApp");

  app.classList.add("is-shooting");
  $("shotTitle").textContent = "CHUTOU!";
  $("penaltyInstruction").textContent = "Acompanhe a cobrança...";

  $("penaltyBall").animate([
    { transform: "translate(-50%, -50%) scale(1)" },
    { transform: "translate(-50%, -50%) scale(.94)", offset: .48 },
    { transform: "translate(-50%, -50%) scale(1.04)" }
  ], { duration: 150, easing: "ease-out" });

  schedule(() => animateBall(zoneIndex, saved), 115);
  schedule(() => animateKeeper(cpuZone), 190);
  schedule(() => impact(saved), 830);
  schedule(() => finishRound(saved), 1100);
}

document.querySelectorAll(".target-zone").forEach((btn) => {
  btn.addEventListener("click", () => takeShot(Number(btn.dataset.zone)));
});

$("penaltyAgainButton").addEventListener("click", resetRound);
$("penaltyBackButton").addEventListener("click", () => { window.location.href = "../"; });

window.addEventListener("resize", fitScene);
window.addEventListener("orientationchange", () => setTimeout(fitScene, 80));

preloadImages();
fitScene();
resetRound();
