let penaltyCpuZone = 0;
let penaltyShotLocked = false;
let penaltyGoals = 0;
let penaltySaves = 0;

const $ = (id) => document.getElementById(id);

function randomPenaltyZone() {
    return Math.floor(Math.random() * 6);
}

function updatePenaltyTestScore() {
    $("penaltyTestScore").textContent = `GOLS ${penaltyGoals} • DEFESAS ${penaltySaves}`;
}

function resetPenaltyTestRound() {
    penaltyShotLocked = false;
    penaltyCpuZone = randomPenaltyZone();

    const pitch = document.querySelector(".penalty-pitch");
    const ball = $("penaltyBall");
    const keeper = $("penaltyGoalkeeper");
    const kicker = $("penaltyKicker");
    const result = $("penaltyResult");
    const instruction = $("penaltyInstruction");
    const again = $("penaltyAgainButton");

    pitch.classList.remove("is-shooting");
    [ball, keeper, kicker].forEach((el) => {
        el.getAnimations().forEach((anim) => anim.cancel());
        el.style.removeProperty("transform");
        el.style.removeProperty("opacity");
    });

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
    return $("penaltyKicker").animate([
        { transform: "translateX(-50%) translate(0,0) rotate(0deg)" },
        { transform: "translateX(-50%) translate(-14px,-4px) rotate(-1deg)", offset: .25 },
        { transform: "translateX(-50%) translate(-58px,-36px) rotate(-7deg)", offset: .72 },
        { transform: "translateX(-50%) translate(-72px,-42px) rotate(5deg)" }
    ], { duration: 520, easing: "cubic-bezier(.36,.05,.22,1)", fill: "forwards" });
}

function animatePenaltyBall(zoneIndex) {
    const ball = $("penaltyBall");
    const zone = document.querySelector(`.penalty-zone[data-zone="${zoneIndex}"]`);
    const {x, y} = getPenaltyTargetDelta(ball, zone);

    return ball.animate([
        { transform: "translate(-50%,50%) translate(0,0) scale(1) rotate(0deg)" },
        { transform: `translate(-50%,50%) translate(${x * .48}px, ${y * .48 - 16}px) scale(.68) rotate(190deg)`, offset: .48 },
        { transform: `translate(-50%,50%) translate(${x}px, ${y}px) scale(.38) rotate(420deg)` }
    ], { duration: 620, easing: "cubic-bezier(.20,.72,.22,1)", fill: "forwards" });
}

function animatePenaltyKeeper(zoneIndex) {
    const keeper = $("penaltyGoalkeeper");
    const zone = document.querySelector(`.penalty-zone[data-zone="${zoneIndex}"]`);
    const {x, y} = getPenaltyTargetDelta(keeper, zone);
    const angle = Math.max(-24, Math.min(24, x / 7));

    return keeper.animate([
        { transform: "translateX(-50%) translate(0,0) rotate(0deg) scale(1)" },
        { transform: "translateX(-50%) translate(0,-6px) rotate(0deg) scale(.98)", offset: .18 },
        { transform: `translateX(-50%) translate(${x * .72}px, ${y * .48}px) rotate(${angle}deg) scale(.93)` }
    ], { duration: 520, easing: "cubic-bezier(.18,.75,.22,1)", fill: "forwards" });
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
    document.querySelector(".penalty-pitch").classList.add("is-shooting");
    $("penaltyInstruction").textContent = "CHUTOU!";

    animatePenaltyKicker();
    setTimeout(() => animatePenaltyBall(zoneIndex), 285);
    setTimeout(() => animatePenaltyKeeper(penaltyCpuZone), 330);
    setTimeout(() => finishPenaltyTestRound(saved), 980);
}

document.querySelectorAll(".penalty-zone").forEach((button) => {
    button.addEventListener("click", () => takePenaltyShot(Number(button.dataset.zone)));
});

$("penaltyAgainButton").addEventListener("click", resetPenaltyTestRound);
$("penaltyBackButton").addEventListener("click", () => {
    window.location.href = "../";
});

resetPenaltyTestRound();
