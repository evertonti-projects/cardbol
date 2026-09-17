const GOALKEEPER_ASSETS = {
    idle: "../imagens/mini-game-penalty/1goleiro-parado.png",
    happy: "../imagens/mini-game-penalty/1goleiro-feliz-defendeu.png",
    sad: "../imagens/mini-game-penalty/1goleiro-triste-gol.png",
    zones: {
        0: "../imagens/mini-game-penalty/1goleiro-alto-esquerda.png",
        1: "../imagens/mini-game-penalty/1goleiro-alto-centro.png",
        2: "../imagens/mini-game-penalty/1goleiro-alto-direita.png",
        3: "../imagens/mini-game-penalty/1goleiro-baixo-esquerda.png",
        4: "../imagens/mini-game-penalty/1goleiro-baixo-centro.png",
        5: "../imagens/mini-game-penalty/1goleiro-baixo-direita.png"
    }
};

let penaltyShotLocked = false;
let penaltyCpuZone = 0;
let penaltyGoals = 0;
let penaltySaves = 0;
let penaltyTimers = [];

const $ = (id) => document.getElementById(id);
const qs = (selector) => document.querySelector(selector);

function schedulePenalty(fn, delay) {
    const timer = setTimeout(fn, delay);
    penaltyTimers.push(timer);
    return timer;
}

function clearPenaltyTimers() {
    penaltyTimers.forEach(clearTimeout);
    penaltyTimers = [];
}

function randomPenaltyZone() {
    return Math.floor(Math.random() * 6);
}

function updatePenaltyTestScore() {
    $("penaltyTestScore").textContent = `GOLS ${penaltyGoals} • DEFESAS ${penaltySaves}`;
}

function clearAnimations(...els) {
    els.flat().forEach((el) => {
        if (!el) return;
        el.getAnimations().forEach((anim) => anim.cancel());
        el.style.removeProperty("transform");
        el.style.removeProperty("opacity");
        el.style.removeProperty("filter");
    });
}

function getZoneButton(zoneIndex) {
    return qs(`.penalty-zone[data-zone="${zoneIndex}"]`);
}

function getPenaltyTargetDelta(element, zoneElement) {
    const a = element.getBoundingClientRect();
    const z = zoneElement.getBoundingClientRect();
    return {
        x: (z.left + z.width / 2) - (a.left + a.width / 2),
        y: (z.top + z.height / 2) - (a.top + a.height / 2)
    };
}

function setKeeperState(state) {
    const keeper = $("penaltyGoalkeeper");
    keeper.src = GOALKEEPER_ASSETS[state] || GOALKEEPER_ASSETS.idle;
}

function setKeeperZonePose(zoneIndex) {
    const keeper = $("penaltyGoalkeeper");
    keeper.src = GOALKEEPER_ASSETS.zones[zoneIndex] || GOALKEEPER_ASSETS.idle;
}

function resetPenaltyRound() {
    clearPenaltyTimers();
    penaltyShotLocked = false;
    penaltyCpuZone = randomPenaltyZone();

    const stage = $("penaltyStage");
    const goalFrame = $("penaltyGoalFrame");
    const ball = $("penaltyBall");
    const ballShadow = $("penaltyBallShadow");
    const keeper = $("penaltyGoalkeeper");
    const keeperShadow = $("penaltyKeeperShadow");
    const result = $("penaltyResult");
    const again = $("penaltyAgainButton");
    const instruction = $("penaltyInstruction");

    clearAnimations(ball, ballShadow, keeper, keeperShadow);
    stage.classList.remove("is-shooting", "impact-goal", "impact-save");
    goalFrame.classList.remove("goal-hit");

    setKeeperState("idle");
    keeper.style.transform = "translateX(-50%)";
    keeperShadow.style.transform = "translateX(-50%)";
    keeperShadow.style.opacity = "0.34";
    ball.style.transform = "translateX(-50%)";
    ballShadow.style.transform = "translateX(-50%)";
    ballShadow.style.opacity = "1";

    result.className = "penalty-result";
    result.textContent = "";
    instruction.textContent = "A CPU já escolheu o canto do goleiro. Toque em um dos 6 alvos.";
    again.hidden = true;
    updatePenaltyTestScore();
}

function animateBallToZone(zoneIndex, saved) {
    const ball = $("penaltyBall");
    const shadow = $("penaltyBallShadow");
    const zoneButton = getZoneButton(zoneIndex);
    const { x, y } = getPenaltyTargetDelta(ball, zoneButton);
    const side = (zoneIndex % 3) === 0 ? -1 : (zoneIndex % 3) === 2 ? 1 : 0;
    const high = zoneIndex < 3;
    const curve = side * (high ? 20 : 14);
    const y1 = high ? -42 : -20;
    const y2 = high ? -24 : -10;

    shadow.animate([
        { transform: "translateX(-50%) scale(1)", opacity: 1 },
        { transform: `translateX(calc(-50% + ${x * .22}px)) translateY(${Math.max(6, y * .08)}px) scale(.68)`, opacity: .34, offset: .35 },
        { transform: `translateX(calc(-50% + ${x * .48}px)) translateY(${Math.max(10, y * .11)}px) scale(.42)`, opacity: .14, offset: .7 },
        { transform: `translateX(calc(-50% + ${x * .66}px)) translateY(${Math.max(14, y * .12)}px) scale(.26)`, opacity: 0 }
    ], { duration: saved ? 760 : 720, easing: "ease-out", fill: "forwards" });

    const frames = [
        { transform: "translateX(-50%) translate(0,0) scale(1) rotate(0deg)" },
        { transform: `translateX(-50%) translate(${x * .24 - curve * .34}px, ${y * .24 + y1}px) scale(.82) rotate(${side * 90 + 135}deg)`, offset: .3 },
        { transform: `translateX(-50%) translate(${x * .62 - curve}px, ${y * .62 + y2}px) scale(.53) rotate(${side * 170 + 300}deg)`, offset: .72 }
    ];

    if (saved) {
        const deflect = side === 0 ? 38 : -side * 42;
        frames.push({ transform: `translateX(-50%) translate(${x * .86 + deflect}px, ${y * .82 + 46}px) scale(.44) rotate(${side * 230 + 560}deg)` });
    } else {
        frames.push({ transform: `translateX(-50%) translate(${x}px, ${y + (high ? 8 : 12)}px) scale(.29) rotate(${side * 230 + 620}deg)` });
    }

    ball.animate(frames, {
        duration: saved ? 760 : 720,
        easing: "cubic-bezier(.18,.74,.18,1)",
        fill: "forwards"
    });
}

function animateKeeperDive(zoneIndex) {
    const keeper = $("penaltyGoalkeeper");
    const shadow = $("penaltyKeeperShadow");
    const zoneButton = getZoneButton(zoneIndex);
    const { x, y } = getPenaltyTargetDelta(keeper, zoneButton);
    const side = (zoneIndex % 3) === 0 ? -1 : (zoneIndex % 3) === 2 ? 1 : 0;
    const high = zoneIndex < 3;
    const moveX = side === 0 ? -54 : side === 1 ? 54 : 0;
    const moveY = high ? -12 : 10;

    setKeeperZonePose(zoneIndex);

    shadow.animate([
        { transform: "translateX(-50%) scale(1)", opacity: .34 },
        { transform: `translateX(calc(-50% + ${moveX * .50}px)) scale(${high ? .68 : .78}, ${high ? .40 : .52})`, opacity: .18, offset: .58 },
        { transform: `translateX(calc(-50% + ${moveX * .70}px)) scale(${high ? .54 : .66}, ${high ? .34 : .48})`, opacity: .12 }
    ], { duration: 560, easing: "cubic-bezier(.16,.76,.22,1)", fill: "forwards" });

    keeper.animate([
        { transform: "translateX(-50%) translate(0,0) scale(1)" },
        { transform: `translateX(-50%) translate(${moveX * .24}px, ${moveY * .36}px) scale(1.02)`, offset: .30 },
        { transform: `translateX(-50%) translate(${moveX}px, ${moveY}px) scale(1.03)`, offset: .72 },
        { transform: `translateX(-50%) translate(${moveX * .92}px, ${moveY + (high ? 2 : 4)}px) scale(1.01)` }
    ], { duration: 560, easing: "cubic-bezier(.16,.76,.22,1)", fill: "forwards" });
}

function triggerStageImpact(saved) {
    const stage = $("penaltyStage");
    const goalFrame = $("penaltyGoalFrame");
    stage.classList.remove("impact-goal", "impact-save");
    void stage.offsetWidth;
    stage.classList.add(saved ? "impact-save" : "impact-goal");
    if (!saved) {
        goalFrame.classList.remove("goal-hit");
        void goalFrame.offsetWidth;
        goalFrame.classList.add("goal-hit");
    }
}

function finishPenaltyRound(saved) {
    if (saved) penaltySaves += 1;
    else penaltyGoals += 1;

    if (saved) setKeeperState("happy");
    else setKeeperState("sad");

    updatePenaltyTestScore();

    const result = $("penaltyResult");
    result.className = `penalty-result show ${saved ? "save" : "goal"}`;
    result.textContent = saved ? "DEFENDEU!" : "GOOOOL!";
    $("penaltyAgainButton").hidden = false;
    $("penaltyInstruction").textContent = saved
        ? "Boa defesa da CPU. Toque abaixo para cobrar novamente."
        : "A bola entrou! Toque abaixo para cobrar novamente.";
}

function takePenaltyShot(zoneIndex) {
    if (penaltyShotLocked || zoneIndex < 0 || zoneIndex > 5) return;

    penaltyShotLocked = true;
    const saved = zoneIndex === penaltyCpuZone;
    const stage = $("penaltyStage");
    const instruction = $("penaltyInstruction");

    stage.classList.add("is-shooting");
    instruction.textContent = "CHUTE EM ANDAMENTO...";

    const ball = $("penaltyBall");
    ball.animate([
        { transform: "translateX(-50%) scale(1)" },
        { transform: "translateX(-50%) scale(.94)", offset: .4 },
        { transform: "translateX(-50%) scale(1.04)" }
    ], { duration: 180, easing: "ease-out" });

    schedulePenalty(() => animateBallToZone(zoneIndex, saved), 140);
    schedulePenalty(() => animateKeeperDive(penaltyCpuZone), 240);
    schedulePenalty(() => triggerStageImpact(saved), 920);
    schedulePenalty(() => finishPenaltyRound(saved), 1180);
}

document.querySelectorAll(".penalty-zone").forEach((button) => {
    button.addEventListener("click", () => takePenaltyShot(Number(button.dataset.zone)));
});

$("penaltyAgainButton").addEventListener("click", resetPenaltyRound);
$("penaltyBackButton").addEventListener("click", () => {
    window.location.href = "../";
});

resetPenaltyRound();
