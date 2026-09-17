let penaltyCpuZone = 0;
let penaltyShotLocked = false;
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

function cancelElementAnimations(el) {
    if (!el) return;
    el.getAnimations().forEach((anim) => anim.cancel());
    el.style.removeProperty("transform");
    el.style.removeProperty("opacity");
    el.style.removeProperty("filter");
}

function resetPenaltyTestRound() {
    clearPenaltyTimers();
    penaltyShotLocked = false;
    penaltyCpuZone = randomPenaltyZone();

    const pitch = qs(".penalty-pitch");
    const goal = $("penaltyGoal");
    const net = qs(".penalty-goal-net");
    const ball = $("penaltyBall");
    const keeper = $("penaltyGoalkeeper");
    const kicker = $("penaltyKicker");
    const ballShadow = $("penaltyBallShadow");
    const keeperShadow = $("penaltyKeeperShadow");
    const kickerShadow = $("penaltyKickerShadow");
    const result = $("penaltyResult");
    const instruction = $("penaltyInstruction");
    const again = $("penaltyAgainButton");

    pitch.classList.remove("is-shooting", "impact-goal", "impact-save");
    goal.classList.remove("net-hit");
    net.classList.remove("net-hit");

    [ball, keeper, kicker, ballShadow, keeperShadow, kickerShadow].forEach(cancelElementAnimations);

    result.className = "penalty-result";
    result.textContent = "";
    instruction.hidden = false;
    instruction.textContent = "A CPU já escolheu o canto do goleiro. Toque em uma das 6 zonas do gol.";
    again.hidden = true;
    updatePenaltyTestScore();
}

function getPenaltyTargetDelta(element, zoneElement) {
    const a = element.getBoundingClientRect();
    const z = zoneElement.getBoundingClientRect();
    return {
        x: (z.left + z.width / 2) - (a.left + a.width / 2),
        y: (z.top + z.height / 2) - (a.top + a.height / 2)
    };
}

function animatePenaltyKicker() {
    const kicker = $("penaltyKicker");
    const shadow = $("penaltyKickerShadow");

    shadow.animate([
        { transform: "translateX(-50%) scale(1)", opacity: .34 },
        { transform: "translateX(-50%) translateX(-18px) scale(.94)", opacity: .30, offset: .45 },
        { transform: "translateX(-50%) translateX(-52px) scale(.86)", opacity: .24, offset: .76 },
        { transform: "translateX(-50%) translateX(-68px) scale(.92)", opacity: .27 }
    ], { duration: 900, easing: "cubic-bezier(.22,.65,.24,1)", fill: "forwards" });

    return kicker.animate([
        { transform: "translateX(-50%) translate(0,0) rotate(0deg) scale(1)" },
        { transform: "translateX(-50%) translate(5px,1px) rotate(1deg) scale(.997)", offset: .12 },
        { transform: "translateX(-50%) translate(-16px,-7px) rotate(-2deg) scale(1.006)", offset: .34 },
        { transform: "translateX(-50%) translate(-46px,-25px) rotate(-5deg) scale(1.012)", offset: .58 },
        { transform: "translateX(-50%) translate(-67px,-38px) rotate(5deg) scale(1.016)", offset: .70 },
        { transform: "translateX(-50%) translate(-78px,-43px) rotate(8deg) scale(1.012)", offset: .80 },
        { transform: "translateX(-50%) translate(-72px,-39px) rotate(4deg) scale(1.005)" }
    ], { duration: 900, easing: "cubic-bezier(.20,.62,.24,1)", fill: "forwards" });
}

function animatePenaltyBall(zoneIndex, saved) {
    const ball = $("penaltyBall");
    const shadow = $("penaltyBallShadow");
    const zone = qs(`.penalty-zone[data-zone="${zoneIndex}"]`);
    const {x, y} = getPenaltyTargetDelta(ball, zone);
    const column = zoneIndex % 3;
    const highShot = zoneIndex < 3;
    const side = column === 0 ? -1 : column === 2 ? 1 : 0;
    const curve = side * 18;

    shadow.animate([
        { transform: "translate(-50%,50%) scale(1)", opacity: .34 },
        { transform: `translate(-50%,50%) translate(${x * .24}px, ${Math.max(8, y * .10)}px) scale(.72)`, opacity: .18, offset: .34 },
        { transform: `translate(-50%,50%) translate(${x * .50}px, ${Math.max(14, y * .14)}px) scale(.42)`, opacity: .07, offset: .68 },
        { transform: `translate(-50%,50%) translate(${x * .62}px, ${Math.max(18, y * .16)}px) scale(.28)`, opacity: 0 }
    ], { duration: 790, easing: "ease-out", fill: "forwards" });

    const lift1 = highShot ? -32 : -14;
    const lift2 = highShot ? -22 : -8;

    const frames = [
        { transform: "translate(-50%,50%) translate(0,0) scale(1) rotate(0deg)", filter: "drop-shadow(0 7px 5px rgba(0,0,0,.35))" },
        { transform: `translate(-50%,50%) translate(${x * .22 - curve * .35}px, ${y * .22 + lift1}px) scale(.82) rotate(${side * 70 + 135}deg)`, offset: .25 },
        { transform: `translate(-50%,50%) translate(${x * .56 - curve}px, ${y * .55 + lift2}px) scale(.57) rotate(${side * 120 + 310}deg)`, offset: .58 },
        { transform: `translate(-50%,50%) translate(${x * .90}px, ${y * .90}px) scale(.36) rotate(${side * 180 + 505}deg)`, offset: .88 }
    ];

    if (saved) {
        const deflectX = side === 0 ? 34 : -side * 38;
        frames.push({
            transform: `translate(-50%,50%) translate(${x * .82 + deflectX}px, ${y * .82 + 38}px) scale(.44) rotate(${side * 210 + 610}deg)`,
            opacity: .92
        });
    } else {
        frames.push({
            transform: `translate(-50%,50%) translate(${x}px, ${y + (highShot ? 6 : 10)}px) scale(.31) rotate(${side * 220 + 625}deg)`,
            filter: "drop-shadow(0 2px 2px rgba(0,0,0,.18))"
        });
    }

    return ball.animate(frames, {
        duration: saved ? 830 : 790,
        easing: "cubic-bezier(.13,.69,.18,1)",
        fill: "forwards"
    });
}

function animatePenaltyKeeper(zoneIndex) {
    const keeper = $("penaltyGoalkeeper");
    const shadow = $("penaltyKeeperShadow");
    const zone = qs(`.penalty-zone[data-zone="${zoneIndex}"]`);
    const {x, y} = getPenaltyTargetDelta(keeper, zone);
    const column = zoneIndex % 3;
    const highDive = zoneIndex < 3;
    const side = column === 0 ? -1 : column === 2 ? 1 : 0;
    const angle = side === 0 ? 0 : side * 26;
    const diveX = side === 0 ? x * .36 : x * .82;
    const diveY = highDive ? y * .78 - 7 : y * .58 + 7;

    shadow.animate([
        { transform: "translateX(-50%) scale(1)", opacity: .34 },
        { transform: "translateX(-50%) scale(1.05,.82)", opacity: .38, offset: .18 },
        { transform: `translateX(-50%) translateX(${diveX * .58}px) scale(.70,.48)`, opacity: .19, offset: .64 },
        { transform: `translateX(-50%) translateX(${diveX * .76}px) scale(.62,.42)`, opacity: .13 }
    ], { duration: 735, easing: "cubic-bezier(.18,.70,.22,1)", fill: "forwards" });

    return keeper.animate([
        { transform: "translateX(-50%) translate(0,0) rotate(0deg) scale(1)" },
        { transform: `translateX(-50%) translate(${side * -5}px, 5px) rotate(${side * -2}deg) scale(1.02,.96)`, offset: .17 },
        { transform: `translateX(-50%) translate(${diveX * .20}px, ${highDive ? -10 : 0}px) rotate(${angle * .20}deg) scale(1.01)`, offset: .34 },
        { transform: `translateX(-50%) translate(${diveX * .62}px, ${diveY * .56}px) rotate(${angle * .70}deg) scale(1.035,.96)`, offset: .66 },
        { transform: `translateX(-50%) translate(${diveX}px, ${diveY}px) rotate(${angle}deg) scale(1.04,.94)`, offset: .88 },
        { transform: `translateX(-50%) translate(${diveX * .98}px, ${diveY + (highDive ? 4 : 8)}px) rotate(${angle * .92}deg) scale(1.02,.96)` }
    ], { duration: 735, easing: "cubic-bezier(.17,.76,.20,1)", fill: "forwards" });
}

function triggerPenaltyImpact(saved, zoneIndex) {
    const pitch = qs(".penalty-pitch");
    pitch.classList.remove("impact-goal", "impact-save");
    void pitch.offsetWidth;
    pitch.classList.add(saved ? "impact-save" : "impact-goal");

    if (!saved) {
        const goal = $("penaltyGoal");
        const net = qs(".penalty-goal-net");
        goal.style.setProperty("--hit-x", `${((zoneIndex % 3) - 1) * 7}px`);
        goal.style.setProperty("--hit-y", `${zoneIndex < 3 ? -4 : 4}px`);
        net.classList.remove("net-hit");
        void net.offsetWidth;
        net.classList.add("net-hit");
    }
}

function finishPenaltyTestRound(saved) {
    if(saved) penaltySaves += 1;
    else penaltyGoals += 1;
    updatePenaltyTestScore();

    const result = $("penaltyResult");
    result.className = `penalty-result show ${saved ? "save" : "goal"}`;
    result.textContent = saved ? "DEFENDEU!" : "GOOOOL!";
    $("penaltyInstruction").hidden = true;
    $("penaltyAgainButton").hidden = false;
}

function takePenaltyShot(zoneIndex) {
    if(penaltyShotLocked || zoneIndex < 0 || zoneIndex > 5) return;

    penaltyShotLocked = true;
    const saved = zoneIndex === penaltyCpuZone;
    const pitch = qs(".penalty-pitch");
    const instruction = $("penaltyInstruction");

    pitch.classList.add("is-shooting");
    instruction.textContent = "CORREU PARA A BOLA...";

    animatePenaltyKicker();

    schedulePenalty(() => {
        instruction.textContent = "CHUTOU!";
        animatePenaltyBall(zoneIndex, saved);
    }, 565);

    schedulePenalty(() => animatePenaltyKeeper(penaltyCpuZone), 610);
    schedulePenalty(() => triggerPenaltyImpact(saved, zoneIndex), 1280);
    schedulePenalty(() => finishPenaltyTestRound(saved), 1580);
}

document.querySelectorAll(".penalty-zone").forEach((button) => {
    button.addEventListener("click", () => takePenaltyShot(Number(button.dataset.zone)));
});

$("penaltyAgainButton").addEventListener("click", resetPenaltyTestRound);
$("penaltyBackButton").addEventListener("click", () => {
    window.location.href = "../";
});

resetPenaltyTestRound();
