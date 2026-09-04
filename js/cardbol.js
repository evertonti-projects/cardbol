// ============================================================
// CONFIGURAÇÕES
// ============================================================

const COLS = 11;

const ROWS = 18;

const MAX_MOVES = 6;

const WINNING_SCORE = 5;

// Catálogo de clubes disponíveis no seletor.
// Para adicionar um novo clube, cadastre apenas seus dados e crie a pasta:
// imagens/clubes/<folder>/
//
// player 1 = lado vermelho/esquerdo | player 0 = lado azul/direito
const CLUBS = {
    barcelona: {
        key: "barcelona",
        name: "BARCELONA",
        shortName: "Barcelona",
        folder: "barcelona",
        cardClass: "barcelona-card"
    },
    "real-madrid": {
        key: "real-madrid",
        name: "REAL MADRID",
        shortName: "Real Madrid",
        folder: "real-madrid",
        cardClass: "real-card"
    },
    arsenal: {
        key: "arsenal",
        name: "ARSENAL",
        shortName: "Arsenal",
        folder: "arsenal",
        cardClass: "arsenal-card"
    },
    chelsea: {
        key: "chelsea",
        name: "CHELSEA",
        shortName: "Chelsea",
        folder: "chelsea",
        cardClass: "chelsea-card"
    },
    "bayern-munique": {
        key: "bayern-munique",
        name: "BAYERN DE MUNIQUE",
        shortName: "Bayern de Munique",
        folder: "bayern-munique",
        cardClass: "bayern-card"
    },
    "borussia-dortmund": {
        key: "borussia-dortmund",
        name: "BORUSSIA DORTMUND",
        shortName: "Borussia Dortmund",
        folder: "borussia-dortmund",
        cardClass: "dortmund-card"
    },
    vasco: {
        key: "vasco",
        name: "VASCO",
        shortName: "Vasco",
        folder: "vasco",
        cardClass: "vasco-card"
    }
};

const AVAILABLE_TEAM_KEYS = [
    "barcelona",
    "real-madrid",
    "arsenal",
    "chelsea",
    "bayern-munique",
    "borussia-dortmund",
    "vasco"
];

// O seletor agora possui duas etapas:
// 1º clube = lado vermelho/jogador humano.
// 2º clube = lado azul/adversário ou CPU.
let teamAssignments = {
    1: "barcelona",
    0: "real-madrid"
};

// Etapa 1: escolhe o lado vermelho. Etapa 0: escolhe o lado azul.
let teamSelectionPlayer = 1;

const MAX_CARDS = 3;
const MAX_TEAM_PIECES = 10;

// DISTRIBUIÇÃO OFICIAL ATUAL DAS CARTAS BÔNUS. Total = 100%.
const CARD_1_CHANCE  = 0.10; // TÁ NA RUA!
const CARD_2_CHANCE  = 0.17; // SANGUE NOVO!
const CARD_3_CHANCE  = 0.10; // ARRANCADA FULMINANTE!
const CARD_4_CHANCE  = 0.17; // PASSE EM PROFUNDIDADE!
const CARD_7_CHANCE  = 0.10; // JOGADA ENSAIADA!
const CARD_8_CHANCE  = 0.16; // BLOQUEIO
const CARD_9_CHANCE  = 0.10; // RECUO TÁTICO
const CARD_10_CHANCE = 0.10; // CATIMBA!
const CARD_3_DISTANCE = 3;
const CARD_4_DISTANCE = 2;
const CARD_7_DISTANCE = 3;
const CARD_7_MOVES = 3;
const CARD_9_RETREAT_DISTANCE = 5;

// Reservas disponíveis para cada equipe no início da partida.
const RESERVE_ROLES = ["ATK", "ME", "MD", "LE", "LD", "ZG"];

// Identificação fixa dos 7 jogadores titulares.
const PLAYER_ROLES = ["GO", "ZG", "LE", "LD", "ME", "MD", "ATK"];

// ============================================================
// CAMINHOS VISUAIS DOS CLUBES
// ============================================================
// Estrutura padronizada de cada clube:
//
// imagens/clubes/<folder>/
// ├── logo.png
// ├── go.png
// ├── atk-1.png
// ├── atk-2.png
// ├── ld-1.png
// ├── ld-2.png
// ├── le-1.png
// ├── le-2.png
// ├── md-1.png
// ├── md-2.png
// ├── me-1.png
// ├── me-2.png
// ├── zg-1.png
// └── zg-2.png
//
// Titular = arquivo "-1" | Reserva = arquivo "-2".
// GO possui imagem única.

function getTeamKeyForPlayer(player) {
    return teamAssignments[player] || (player === 1 ? "barcelona" : "real-madrid");
}

function getTeamConfig(player) {
    return CLUBS[getTeamKeyForPlayer(player)] || CLUBS.barcelona;
}

function playerName(player) {
    return getTeamConfig(player).name;
}

function teamShortName(player) {
    return getTeamConfig(player).shortName;
}

function getTeamAssetsBase(player) {
    return `imagens/clubes/${getTeamConfig(player).folder}`;
}

function getTeamLogo(player) {
    return `${getTeamAssetsBase(player)}/logo.png`;
}

function getScoreLineText() {
    return `${playerName(1)} ${scoreRed} × ${scoreBlue} ${playerName(0)}`;
}

function getPlayerImagePath(player, role, isReserve = false) {
    const normalizedRole = String(role || "").toLowerCase();

    if(!normalizedRole) return "";

    if(normalizedRole === "go") {
        return `${getTeamAssetsBase(player)}/go.png`;
    }

    const variation = isReserve ? 2 : 1;
    return `${getTeamAssetsBase(player)}/${normalizedRole}-${variation}.png`;
}

const GOALKEEPER_ID = 0;

// O GO só pode ocupar as 3 linhas mais próximas do próprio gol.
// Barcelona: linhas lógicas 0, 1 e 2.
// Real Madrid: linhas lógicas 15, 16 e 17.
const GOALKEEPER_ZONE_DEPTH = 3;


// Faixas permitidas para a FORMAÇÃO INICIAL, contando a partir do próprio gol.
// GO: 1ª-3ª | ZG/LE/LD: 4ª-5ª | ME/MD: 6ª-7ª | ATK: 8ª-9ª.
const FORMATION_LINES_BY_ROLE = {
    GO:  [1,2,3],
    ZG:  [4,5],
    LE:  [4,5],
    LD:  [4,5],
    ME:  [6,7],
    MD:  [6,7],
    ATK: [8,9]
};


// ============================================================
// ESTADO DO JOGO
// ============================================================

let currentPlayer = 0;

// Modo: "pvp" mantém o jogo local tradicional; "cpu" controla o time do lado azul.
let gameMode = null;
const CPU_PLAYER = 0;
const HUMAN_PLAYER = 1;
let cpuThinking = false;
let cpuActionTimer = null;
let cpuFormationTimer = null;

let selectedPiece = null;

let winner = null;

// Motivo do fim: "goals", "minimumPlayers", "time" ou "pieces".
let matchEndReason = null;

let scoreBlue = 0;

let scoreRed = 0;

// Snapshot visual da peça responsável pelo último gol.
let lastGoalScorer = null;

let goalPause = false;

// ============================================================
// TEMPO DE PARTIDA
// 2 tempos de 10min + prorrogações de 5min.
// Cada turno possui 45s.
// ============================================================
const REGULATION_PERIOD_MS = 10 * 60 * 1000;
const EXTRA_PERIOD_MS = 5 * 60 * 1000;
const TURN_LIMIT_MS = 45 * 1000;

let matchPeriod = 1;            // 1 = 1º tempo, 2 = 2º tempo, 3+ = prorrogações
let extraPeriodNumber = 0;
let matchTimeRemainingMs = REGULATION_PERIOD_MS;
let turnTimeRemainingMs = TURN_LIMIT_MS;
let matchClockRunning = false;
let periodBreakActive = false;
let periodBreakType = null;
let initialKickoffPlayer = null;
let matchClockInterval = null;
let lastClockTickAt = Date.now();
let turnTimeoutHandling = false;
let matchEndDetail = "";

let diceValue = null;

let diceRolled = false;

let pieces = [];

// Referências fixas do tabuleiro para evitar milhares de buscas no DOM.
let boardCellsCache = [];
let redGoalCellsCache = [];
let blueGoalCellsCache = [];


// Modo de preparação tática antes do primeiro dado.
// Barcelona (1) monta primeiro; depois Real Madrid (0).
let formationSetupActive = true;
let formationSetupPlayer = 1;
let formationSetupReason = "initial"; // "initial" ou "halftime"

// Sorteio do pontapé inicial: só acontece após as duas formações.
let kickoffDrawPending = false;
let kickoffRouletteSpinning = false;
let kickoffResolved = false;
let formationSelectedPiece = null;

// Formação fixa escolhida no início da partida para os titulares.
// Índices: 0 = Real Madrid, 1 = Barcelona. Chave = id do titular (0..6).
let startingFormation = [{}, {}];

// Animação visual de deslocamento. Enquanto uma peça desliza, novas ações ficam bloqueadas.
let moveAnimationActive = false;
let activeMoveAnimation = null;

// Temporizadores da comemoração de gol.
let goalCelebrationTimers = [];

// Barreiras da Carta 8. Permanecem até o próximo gol e bloqueiam os DOIS times.
let blocks = [];
let nextBlockId = 1;

// Mãos: índice 0 = Real Madrid, índice 1 = Barcelona.
// IDs: 1 = TÁ NA RUA! | 2 = SANGUE NOVO! | 3 = ARRANCADA FULMINANTE! | 4 = PASSE EM PROFUNDIDADE! | 7 = JOGADA ENSAIADA! | 8 = BLOQUEIO | 9 = RECUO TÁTICO | 10 = CATIMBA!
let hands = [[], []];

// Carta 10 — CATIMBA: efeito pendente para o próximo turno do jogador-alvo.
let catimbaPending = [false, false];

// Reservas ainda disponíveis e reservas que já entraram em campo.
let reserveAvailable = [new Set(RESERVE_ROLES), new Set(RESERVE_ROLES)];
let reserveInPlay = [[], []];

// Jogadores expulsos ficam fora até serem reintegrados pela Carta 2 ou até o fim da partida.
// Map: id único da peça -> { role, reserve }.
let expelledPlayers = [new Map(), new Map()];

// Ação de carta em andamento.
// Carta 1: { cardId:1, player, slotIndex, phase:"target" }
// Carta 7: { cardId:7, player, slotIndex, phase:"choosePiece"|"movePiece", selectedPieceId, movedPieceIds, movesDone }
// Carta 8: { cardId:8, player, slotIndex, phase:"placeBlock" }
// Carta 10 é instantânea: aplica CATIMBA ao próximo turno do adversário.
// Carta 2: escolhe um reserva novo OU um expulso e depois uma casa até a 3ª linha defensiva.
// Carta 3: escolhe uma peça própria e faz um movimento bônus de até +3 casas.
// Carta 4: escolhe uma peça própria e faz um movimento bônus de até +2 casas.
let cardTargetMode = null;
let cardVideoActive = false;

const card1VideoPaths = [
    "videos/carta-1-video-a.mp4",
    "videos/carta-1-video-b.mp4"
];
const card2VideoPaths = [
    "videos/carta-2-video-a.mp4",
    "videos/carta-2-video-b.mp4"
];
const card3VideoPaths = [
    "videos/carta-3-video-a.mp4",
    "videos/carta-3-video-b.mp4"
];
const card4VideoPaths = [
    "videos/carta-4-video-a.mp4"
];
const card7VideoPaths = [
    "videos/carta-7-video-a.mp4",
    "videos/carta-7-video-b.mp4"
];
const card8VideoPaths = [
    "videos/carta-8-video-a.mp4"
];
const card9VideoPaths = [
    "videos/carta-9-video-a.mp4"
];
const card10VideoPaths = [
    "videos/carta-10-video-a.mp4",
    "videos/carta-10-video-b.mp4"
];
const card1ExpulsionAudio = new Audio("audios/audio-carta1-apito-expulso.mp3");
card1ExpulsionAudio.preload = "auto";
const card2SubstitutionAudio = new Audio("audios/audio-carta2-subs+1peca.mp3");
card2SubstitutionAudio.preload = "auto";

const card8BlockAudio = new Audio("audios/audio-carta8.mp3");
card8BlockAudio.preload = "auto";

const card10CatimbaAudio = new Audio("audios/audio-carta10.mp3");
card10CatimbaAudio.preload = "auto";

const kickoffRouletteAudio = new Audio("audios/audio-roleta-gira.mp3");
kickoffRouletteAudio.preload = "auto";
kickoffRouletteAudio.loop = true;

const goalCelebrationAudios = [
    new Audio("audios/audio-goal-1.mp3"),
    new Audio("audios/audio-goal-2.mp3")
];
goalCelebrationAudios.forEach(audio => {
    audio.preload = "auto";
});

const finalVictoryAudio = new Audio("audios/audio-goal-5final.mp3");
finalVictoryAudio.preload = "auto";

let nextGoalCelebrationAudioIndex = 0;

let nextCard1VideoIndex = 0;
let nextCard2VideoIndex = 0;
let nextCard3VideoIndex = 0;
let nextCard4VideoIndex = 0;
let nextCard7VideoIndex = 0;
let nextCard8VideoIndex = 0;
let nextCard9VideoIndex = 0;
let nextCard10VideoIndex = 0;
let cardVideoTimeoutId = null;

// Peças que continuam com fogo por 3 segundos após concluir a Carta 7.
// Chaves no formato "player:id" para impedir que o efeito passe ao adversário.
let card7LingeringFireIds = new Set();
let card7LingeringFireTimer = null;

// Carrosséis compactos do banco e dos expulsos.
const BENCH_CAROUSEL_INTERVAL = 2400;
let benchCarouselTimer = null;
let benchCarouselRenderSignatures = {};
let benchCarouselIndexes = {
    redReserves: 0,
    redExpelled: 0,
    blueReserves: 0,
    blueExpelled: 0
};


// ============================================================
// DIREÇÕES
// ============================================================

const orthogonalDirections = [

    [-1,0], // TRÁS / FRENTE no eixo de avanço
    [1,0],

    [0,-1], // ESQUERDA / DIREITA no eixo lateral
    [0,1]

];

const diagonalDirections = [
    [-1,-1],
    [-1,1],
    [1,-1],
    [1,1]
];

function isOwnDefenseHalf(player, row) {
    if(!inside(row, 0)) return false;

    // Barcelona defende a metade esquerda (rows 0..8).
    // Real Madrid defende a metade direita (rows 9..17).
    return player === 1
        ? row < ROWS / 2
        : row >= ROWS / 2;
}

function pieceInFinalAttackZone(piece) {
    if(!piece) return false;

    // Últimas 3 linhas antes do gol adversário.
    // A regra vale para QUALQUER jogador do time que já esteja nessa zona.
    // Barcelona (player 1) ataca as rows 15,16,17.
    // Real Madrid (player 2) ataca as rows 0,1,2.
    return piece.player === 1
        ? piece.row >= ROWS - 3
        : piece.row <= 2;
}

function pieceHasDiagonalAbility(piece) {
    return piece && ["ATK", "GO", "ZG"].includes(piece.role);
}

function diagonalSegmentAllowed(piece, startRow, startCol, targetRow, targetCol) {
    if(!pieceHasDiagonalAbility(piece)) return false;

    const dr = targetRow - startRow;
    const dc = targetCol - startCol;

    // Precisa ser uma diagonal perfeita.
    if(dr === 0 || dc === 0 || Math.abs(dr) !== Math.abs(dc)) return false;

    // ATK pode usar diagonais em qualquer parte do campo.
    if(piece.role === "ATK") return true;

    // GO e ZG só podem usar diagonal quando TODO o trecho permanece
    // dentro da própria metade defensiva. Como o deslocamento é linear,
    // manter origem e destino na defesa garante os pontos intermediários.
    return (
        isOwnDefenseHalf(piece.player, startRow) &&
        isOwnDefenseHalf(piece.player, targetRow)
    );
}

function getDirectionsForPiece(piece) {
    return pieceHasDiagonalAbility(piece)
        ? orthogonalDirections.concat(diagonalDirections)
        : orthogonalDirections;
}


// ============================================================
// COLUNAS DA ÁREA DE GOL
//
// As 3 células ficam centralizadas:
// colunas 4 até 6.
// ============================================================

const goalColumns = [
    4,5,6
];


// ============================================================
// MODO VS CPU — V2
// Inteligência posicional + defesa + uso estratégico de cartas
// ============================================================
function isCpuMode() { return gameMode === "cpu"; }
function isCpuTurn() { return isCpuMode() && currentPlayer === CPU_PLAYER; }

let cpuCardUsedThisTurn = false;

// Usado para dar ao ATK um comportamento mais agressivo nas primeiras jogadas.
let cpuTurnsCompleted = 0;

function clearCpuTimers() {
    if(cpuActionTimer) { clearTimeout(cpuActionTimer); cpuActionTimer = null; }
    if(cpuFormationTimer) { clearTimeout(cpuFormationTimer); cpuFormationTimer = null; }
    cpuThinking = false;
    cpuCardUsedThisTurn = false;
}

function showGameModeOverlay() {
    const overlay = document.getElementById("gameModeOverlay");
    if(!overlay) return;
    overlay.classList.add("show");
    overlay.setAttribute("aria-hidden","false");
}

function hideGameModeOverlay() {
    const overlay = document.getElementById("gameModeOverlay");
    if(!overlay) return;
    overlay.classList.remove("show");
    overlay.setAttribute("aria-hidden","true");
}

// ============================================================
// IDENTIFICAÇÃO DO JOGADOR — SUPABASE
// O navegador envia nome + PIN apenas para a função segura RPC.
// O PIN nunca é mantido no estado do jogo após a autenticação.
// ============================================================
const SUPABASE_URL = "https://rgknhgiufrfkjftugvfp.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_HIZ6Vcyuk4ySpak8Y9jEMQ_T7SV5M21";

let currentUserIdentity = {
    playerId: null,
    username: "",
    loginStatus: "",
    sessionToken: ""
};

let playerIdentitySubmitting = false;

function showPlayerIdentityOverlay() {
    const overlay = document.getElementById("playerIdentityOverlay");
    const usernameInput = document.getElementById("playerUsernameInput");
    const pinInput = document.getElementById("playerPinInput");
    const error = document.getElementById("playerIdentityError");
    const submitButton = document.getElementById("playerIdentitySubmit");

    if(!overlay) {
        showRulesOverlay();
        return;
    }

    playerIdentitySubmitting = false;
    if(error) error.textContent = "";
    if(pinInput) pinInput.value = "";
    if(submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = "⚽ ENTRAR NO CARDBOL";
    }

    overlay.classList.add("show");
    overlay.setAttribute("aria-hidden", "false");

    window.setTimeout(() => {
        if(usernameInput) usernameInput.focus();
    }, 60);
}

function hidePlayerIdentityOverlay() {
    const overlay = document.getElementById("playerIdentityOverlay");
    if(!overlay) return;

    overlay.classList.remove("show");
    overlay.setAttribute("aria-hidden", "true");
}

function normalizePinInput(input) {
    if(!input) return;
    input.value = input.value.replace(/\D/g, "").slice(0, 4);
}

async function requestCardBolLogin(username, pin) {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/cardbol_login`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "apikey": SUPABASE_PUBLISHABLE_KEY
        },
        body: JSON.stringify({
            p_username: username,
            p_pin: pin
        })
    });

    if(!response.ok) {
        let detail = "";
        try {
            const errorPayload = await response.json();
            const parts = [
                errorPayload?.message,
                errorPayload?.details,
                errorPayload?.hint,
                errorPayload?.code ? `código ${errorPayload.code}` : ""
            ].filter(Boolean);
            detail = parts.join(" • ");
        } catch(error) {
            // Mantém o status HTTP abaixo se não houver JSON de erro.
        }
        throw new Error(detail || `HTTP ${response.status}`);
    }

    const payload = await response.json();
    return Array.isArray(payload) ? payload[0] : payload;
}



let rankingOverlayOpen = false;
let rankingRequestSequence = 0;

function getRankingPositionLabel(position) {
    const number = Number(position) || 0;

    if(number === 1) return "🥇 1";
    if(number === 2) return "🥈 2";
    if(number === 3) return "🥉 3";

    return String(number);
}

function escapeRankingText(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

async function requestCardBolRanking(limit = 100) {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/cardbol_ranking`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "apikey": SUPABASE_PUBLISHABLE_KEY
        },
        body: JSON.stringify({
            p_limit: Math.max(1, Math.min(Number(limit) || 100, 500))
        })
    });

    if(!response.ok) {
        let detail = "";

        try {
            const errorPayload = await response.json();
            const parts = [
                errorPayload?.message,
                errorPayload?.details,
                errorPayload?.hint,
                errorPayload?.code ? `código ${errorPayload.code}` : ""
            ].filter(Boolean);

            detail = parts.join(" • ");
        } catch(error) {
            // Usa status HTTP abaixo.
        }

        throw new Error(detail || `HTTP ${response.status}`);
    }

    const payload = await response.json();
    return Array.isArray(payload) ? payload : [];
}

function renderRankingRows(rows) {
    const body = document.getElementById("rankingTableBody");
    const tableWrap = document.getElementById("rankingTableWrap");
    const empty = document.getElementById("rankingEmpty");

    if(!body || !tableWrap || !empty) return;

    body.innerHTML = "";

    if(!rows.length) {
        tableWrap.style.display = "none";
        empty.style.display = "block";
        return;
    }

    empty.style.display = "none";
    tableWrap.style.display = "block";

    const loggedUsername = String(currentUserIdentity.username || "").trim().toLowerCase();

    rows.forEach(row => {
        const position = Number(row.ranking_position ?? 0);
        const playerNameValue = String(row.player_name ?? "");
        const points = Number(row.ranking_points ?? row.points ?? 0);
        const wins = Number(row.ranking_wins ?? row.wins ?? 0);
        const goals = Number(row.goals_scored ?? 0);

        const tr = document.createElement("tr");

        if(
            loggedUsername &&
            playerNameValue.trim().toLowerCase() === loggedUsername
        ) {
            tr.classList.add("ranking-current-user");
        }

        if(position >= 1 && position <= 3) {
            tr.classList.add(`ranking-top-${position}`);
        }

        tr.innerHTML = `
            <td class="ranking-position-cell">${escapeRankingText(getRankingPositionLabel(position))}</td>
            <td class="ranking-player-cell">${escapeRankingText(playerNameValue)}</td>
            <td>${points}</td>
            <td>${wins}</td>
            <td>${goals}</td>
        `;

        body.appendChild(tr);
    });
}

async function loadRankingData() {
    const loading = document.getElementById("rankingLoading");
    const error = document.getElementById("rankingError");
    const empty = document.getElementById("rankingEmpty");
    const tableWrap = document.getElementById("rankingTableWrap");
    const updatedAt = document.getElementById("rankingUpdatedAt");

    const requestId = ++rankingRequestSequence;

    if(loading) loading.style.display = "block";
    if(error) {
        error.style.display = "none";
        error.textContent = "";
    }
    if(empty) empty.style.display = "none";
    if(tableWrap) tableWrap.style.display = "none";

    try {
        const rows = await requestCardBolRanking(100);

        if(requestId !== rankingRequestSequence) return;

        renderRankingRows(rows);

        if(updatedAt) {
            updatedAt.textContent =
                `Atualizado às ${new Date().toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit"
                })}`;
        }
    } catch(fetchError) {
        console.error("CardBol ranking list:", fetchError);

        if(requestId !== rankingRequestSequence) return;

        if(error) {
            error.textContent =
                `⚠ Não foi possível carregar o ranking: ${String(fetchError?.message || "erro desconhecido")}`;
            error.style.display = "block";
        }
    } finally {
        if(requestId === rankingRequestSequence && loading) {
            loading.style.display = "none";
        }
    }
}

function openRankingOverlay() {
    const overlay = document.getElementById("rankingOverlay");
    if(!overlay) return;

    rankingOverlayOpen = true;
    overlay.classList.add("show");
    overlay.setAttribute("aria-hidden", "false");

    loadRankingData();
}

function closeRankingOverlay() {
    const overlay = document.getElementById("rankingOverlay");
    if(!overlay) return;

    rankingOverlayOpen = false;
    rankingRequestSequence += 1;

    overlay.classList.remove("show");
    overlay.setAttribute("aria-hidden", "true");
}

function handleRankingBackdrop(event) {
    if(event?.target === event?.currentTarget) {
        closeRankingOverlay();
    }
}

document.addEventListener("keydown", event => {
    if(event.key === "Escape" && rankingOverlayOpen) {
        closeRankingOverlay();
    }
});


function createCardBolMatchKey() {
    if(window.crypto && typeof window.crypto.randomUUID === "function") {
        return window.crypto.randomUUID();
    }

    // Fallback UUID v4 para navegadores antigos.
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, char => {
        const random = Math.floor(Math.random() * 16);
        const value = char === "x" ? random : ((random & 0x3) | 0x8);
        return value.toString(16);
    });
}

let currentMatchKey = createCardBolMatchKey();
let matchRankingSubmissionStarted = false;

function setRankingSaveStatus(message = "", state = "") {
    const element = document.getElementById("rankingSaveStatus");
    if(!element) return;

    element.textContent = message;
    element.classList.remove("pending", "success", "error");

    if(state) {
        element.classList.add(state);
    }

    element.style.display = message ? "block" : "none";
}

function getRankingOpponentName() {
    return isCpuMode() ? "CPU" : "JOGADOR 2";
}

async function requestCardBolRecordMatch(payload) {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/cardbol_record_match`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "apikey": SUPABASE_PUBLISHABLE_KEY
        },
        body: JSON.stringify(payload)
    });

    if(!response.ok) {
        let detail = "";

        try {
            const errorPayload = await response.json();
            const parts = [
                errorPayload?.message,
                errorPayload?.details,
                errorPayload?.hint,
                errorPayload?.code ? `código ${errorPayload.code}` : ""
            ].filter(Boolean);

            detail = parts.join(" • ");
        } catch(error) {
            // Usa o status HTTP abaixo.
        }

        throw new Error(detail || `HTTP ${response.status}`);
    }

    const data = await response.json();
    return Array.isArray(data) ? data[0] : data;
}

async function registerOfficialMatchToRanking(winningPlayer) {
    if(matchRankingSubmissionStarted) return;

    // O usuário autenticado controla sempre o lado vermelho / player 1.
    if(
        !currentUserIdentity.playerId ||
        !currentUserIdentity.sessionToken
    ) {
        setRankingSaveStatus(
            "⚠ Resultado não registrado: sessão do ranking indisponível.",
            "error"
        );
        return;
    }

    matchRankingSubmissionStarted = true;

    const submittedMatchKey = currentMatchKey;
    const userWon = winningPlayer === 1;
    const pointsDelta = userWon ? 3 : -1;

    setRankingSaveStatus("⏳ Registrando resultado no ranking...", "pending");

    try {
        const result = await requestCardBolRecordMatch({
            p_match_key: submittedMatchKey,
            p_player_id: currentUserIdentity.playerId,
            p_session_token: currentUserIdentity.sessionToken,

            p_mode: gameMode || "pvp",

            p_player_club: getTeamKeyForPlayer(1),
            p_opponent_club: getTeamKeyForPlayer(0),
            p_opponent_name: getRankingOpponentName(),

            p_player_goals: scoreRed,
            p_opponent_goals: scoreBlue,

            p_result: userWon ? "win" : "loss",
            p_victory_type: matchEndReason || "unknown"
        });

        if(!result || result.success !== true) {
            const status = result?.status || "UNKNOWN";

            if(status === "INVALID_SESSION") {
                throw new Error("Sessão expirada. Faça login novamente.");
            }

            throw new Error(`Falha ao registrar partida (${status}).`);
        }

        if(currentMatchKey !== submittedMatchKey) return;

        if(result.status === "DUPLICATE") {
            setRankingSaveStatus(
                "✓ Esta partida já estava registrada no ranking.",
                "success"
            );

            setTimeout(() => {
                if(currentMatchKey === submittedMatchKey && winner !== null) {
                    openRankingOverlay();
                }
            }, 900);

            return;
        }

        const pointsLabel = pointsDelta > 0 ? `+${pointsDelta}` : `${pointsDelta}`;

        setRankingSaveStatus(
            `✓ Resultado registrado no ranking • ${pointsLabel} pt${Math.abs(pointsDelta) === 1 ? "" : "s"}`,
            "success"
        );

        // No fim da partida, mostra automaticamente a classificação
        // já com o resultado recém-gravado.
        setTimeout(() => {
            if(currentMatchKey === submittedMatchKey && winner !== null) {
                openRankingOverlay();
            }
        }, 900);

    } catch(error) {
        console.error("CardBol ranking:", error);

        if(currentMatchKey !== submittedMatchKey) return;

        const detail = String(error?.message || "").trim();

        setRankingSaveStatus(
            detail
                ? `⚠ Ranking: ${detail}`
                : "⚠ Não foi possível registrar o resultado.",
            "error"
        );
    }
}

async function submitPlayerIdentity(event) {
    if(event) event.preventDefault();
    if(playerIdentitySubmitting) return;

    const usernameInput = document.getElementById("playerUsernameInput");
    const pinInput = document.getElementById("playerPinInput");
    const error = document.getElementById("playerIdentityError");
    const submitButton = document.getElementById("playerIdentitySubmit");

    const username = usernameInput ? usernameInput.value.trim() : "";
    const pin = pinInput ? pinInput.value.replace(/\D/g, "") : "";

    if(username.length < 3 || username.length > 20) {
        if(error) error.textContent = "O nome de usuário precisa ter entre 3 e 20 caracteres.";
        if(usernameInput) usernameInput.focus();
        return;
    }

    if(!/^\d{4}$/.test(pin)) {
        if(error) error.textContent = "O PIN precisa ter exatamente 4 números.";
        if(pinInput) {
            pinInput.value = pin.slice(0, 4);
            pinInput.focus();
        }
        return;
    }

    playerIdentitySubmitting = true;
    if(error) error.textContent = "Conectando ao ranking...";
    if(submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = "⏳ CONECTANDO...";
    }

    try {
        const result = await requestCardBolLogin(username, pin);

        if(!result || result.success !== true) {
            const status = result?.status || "UNKNOWN";
            const messages = {
                INVALID_USERNAME: "Nome de usuário inválido. Use entre 3 e 20 caracteres.",
                INVALID_PIN: "O PIN precisa ter exatamente 4 números.",
                WRONG_PIN: "PIN incorreto para este nome de usuário.",
                LOCKED: "Muitas tentativas incorretas. Este usuário está temporariamente bloqueado."
            };

            if(error) error.textContent = messages[status] || "Não foi possível entrar. Tente novamente.";
            if(pinInput) {
                pinInput.value = "";
                pinInput.focus();
            }
            return;
        }

        currentUserIdentity = {
            playerId: result.player_id || null,
            username: result.username || username,
            loginStatus: result.status || "LOGIN",
            sessionToken: result.session_token || ""
        };

        // O PIN deixa de existir no formulário assim que o servidor confirma.
        if(pinInput) pinInput.value = "";

        if(error) {
            error.textContent = result.status === "CREATED"
                ? `✓ Bem-vindo, ${currentUserIdentity.username}! Cadastro criado.`
                : `✓ Bem-vindo de volta, ${currentUserIdentity.username}!`;
        }

        window.setTimeout(() => {
            hidePlayerIdentityOverlay();
            showRulesOverlay();
        }, 450);

    } catch(connectionError) {
        console.error("CardBol login:", connectionError);

        const detail = String(connectionError?.message || "").trim();
        if(error) {
            error.textContent = detail
                ? `Erro no ranking: ${detail}`
                : "Não foi possível conectar ao ranking. Tente novamente.";
        }
    } finally {
        playerIdentitySubmitting = false;
        if(submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = "⚽ ENTRAR NO CARDBOL";
        }
    }
}

const RULES_PAGE_COUNT = 5;
let currentRulesPage = 0;

function showRulesOverlay() {
    const overlay = document.getElementById("rulesOverlay");
    if(!overlay) {
        showGameModeOverlay();
        return;
    }

    currentRulesPage = 0;
    renderRulesPage();
    overlay.classList.add("show");
    overlay.setAttribute("aria-hidden", "false");
}

function hideRulesOverlay() {
    const overlay = document.getElementById("rulesOverlay");
    if(!overlay) return;

    overlay.classList.remove("show");
    overlay.setAttribute("aria-hidden", "true");
}

function renderRulesPage() {
    const pages = [...document.querySelectorAll(".rules-page")];
    const dots = [...document.querySelectorAll(".rules-dot")];
    const current = document.getElementById("rulesPageCurrent");
    const total = document.getElementById("rulesPageTotal");
    const prevButton = document.getElementById("rulesPrevButton");
    const nextButton = document.getElementById("rulesNextButton");

    if(total) total.textContent = String(RULES_PAGE_COUNT);
    if(current) current.textContent = String(currentRulesPage + 1);

    pages.forEach((page, index) => {
        page.classList.toggle("active", index === currentRulesPage);
    });

    dots.forEach((dot, index) => {
        dot.classList.toggle("active", index === currentRulesPage);
    });

    if(prevButton) {
        prevButton.disabled = currentRulesPage === 0;
    }

    if(nextButton) {
        nextButton.textContent = currentRulesPage >= RULES_PAGE_COUNT - 1
            ? "✓ IR PARA O JOGO"
            : "PRÓXIMA TELA ▶";
    }
}

function previousRulesPage() {
    if(currentRulesPage <= 0) return;
    currentRulesPage -= 1;
    renderRulesPage();
}

function nextRulesPage() {
    if(currentRulesPage >= RULES_PAGE_COUNT - 1) {
        finishRulesFlow();
        return;
    }

    currentRulesPage += 1;
    renderRulesPage();
}

function skipRulesScreens() {
    finishRulesFlow();
}

function finishRulesFlow() {
    hideRulesOverlay();
    showGameModeOverlay();
}


function showTeamSelectOverlay() {
    const overlay = document.getElementById("teamSelectOverlay");
    if(!overlay) return;

    teamSelectionPlayer = 1;
    populateTeamSelectGrid();
    overlay.classList.add("show");
    overlay.setAttribute("aria-hidden","false");
}

function hideTeamSelectOverlay() {
    const overlay = document.getElementById("teamSelectOverlay");
    if(!overlay) return;
    overlay.classList.remove("show");
    overlay.setAttribute("aria-hidden","true");
}

function buildTeamSelectCard(teamKey, labelRole, disabled = false) {
    const club = CLUBS[teamKey];
    const cssClass = club.cardClass || "";
    const disabledClass = disabled ? " team-card-disabled" : "";
    const disabledAttr = disabled ? " disabled aria-disabled=\"true\"" : "";

    return `
        <button
            type="button"
            class="team-card ${cssClass}${disabledClass}"
            data-team="${teamKey}"
            onclick="selectSideTeam('${teamKey}')"
            ${disabledAttr}
        >
            <img class="team-card-logo" src="imagens/clubes/${club.folder}/logo.png" alt="Escudo do ${club.shortName}">
            <div class="team-card-label">${club.name}</div>
            <div class="team-card-role">${disabled ? "JÁ SELECIONADO" : labelRole}</div>
        </button>
    `;
}

function populateTeamSelectGrid() {
    const grid = document.getElementById("teamSelectGrid");
    const subtitle = document.getElementById("teamSelectSubtitle");
    if(!grid) return;

    const choosingRed = teamSelectionPlayer === 1;
    const roleText = choosingRed
        ? (isCpuMode() ? "SEU TIME" : "TIME VERMELHO")
        : (isCpuMode() ? "TIME DA CPU" : "TIME AZUL");

    let html = "";

    AVAILABLE_TEAM_KEYS.forEach(teamKey => {
        const disabled = !choosingRed && teamKey === teamAssignments[1];
        html += buildTeamSelectCard(teamKey, roleText, disabled);
    });

    const lockedSlots = Math.max(0, 12 - AVAILABLE_TEAM_KEYS.length);
    for(let i = 0; i < lockedSlots; i++) {
        html += `<div class="team-card-locked">EM BREVE</div>`;
    }

    grid.innerHTML = html;

    grid.querySelectorAll(".team-card").forEach(card => {
        if(card.dataset.team === teamAssignments[teamSelectionPlayer]) {
            card.classList.add("active-team-card");
        }
    });

    if(subtitle) {
        if(choosingRed) {
            subtitle.textContent = isCpuMode()
                ? "1 de 2 — Escolha o seu clube. Depois você escolherá o time da CPU."
                : "1 de 2 — Escolha o clube do lado vermelho. Depois escolha o lado azul.";
        } else {
            subtitle.textContent = isCpuMode()
                ? `2 de 2 — Você escolheu ${teamShortName(1)}. Agora escolha o time da CPU.`
                : `2 de 2 — ${teamShortName(1)} ficou no lado vermelho. Agora escolha o clube do lado azul.`;
        }
    }
}

function applyTeamBranding() {
    const redName = playerName(1);
    const blueName = playerName(0);

    const redPlayer = document.getElementById("redPlayer");
    const bluePlayer = document.getElementById("bluePlayer");
    const redSideTitle = document.getElementById("redSideTitle");
    const blueSideTitle = document.getElementById("blueSideTitle");
    const redScoreLogo = document.getElementById("redScoreLogo");
    const blueScoreLogo = document.getElementById("blueScoreLogo");

    if(redPlayer) {
        redPlayer.textContent = `🔴 ${redName}${catimbaPending[1] ? " 🐢" : ""}`;
        redPlayer.title = catimbaPending[1]
            ? `${redName} está sob CATIMBA para o próximo turno`
            : redName;
    }

    if(bluePlayer) {
        bluePlayer.textContent = `🔵 ${blueName}${isCpuMode() ? " 🤖" : ""}${catimbaPending[0] ? " 🐢" : ""}`;
        bluePlayer.title = catimbaPending[0]
            ? `${blueName} está sob CATIMBA para o próximo turno`
            : blueName;
    }

    if(redSideTitle) redSideTitle.textContent = `🔴 ${redName}`;
    if(blueSideTitle) blueSideTitle.textContent = `🔵 ${blueName}`;

    if(redScoreLogo) {
        redScoreLogo.src = getTeamLogo(1);
        redScoreLogo.alt = `Escudo do ${teamShortName(1)}`;
        redScoreLogo.closest(".score-team")?.setAttribute("title", teamShortName(1));
    }

    if(blueScoreLogo) {
        blueScoreLogo.src = getTeamLogo(0);
        blueScoreLogo.alt = `Escudo do ${teamShortName(0)}`;
        blueScoreLogo.closest(".score-team")?.setAttribute("title", teamShortName(0));
    }

    const wheelLabels = document.querySelectorAll("#kickoffWheel .kickoff-sector-label");
    wheelLabels.forEach((label, idx) => {
        label.textContent = idx % 2 === 0 ? playerName(0) : playerName(1);
    });

    const modeButtons = document.querySelectorAll(".game-mode-button small");
    if(modeButtons[0]) {
        modeButtons[0].textContent = "Escolha os dois clubes desta partida";
    }
    if(modeButtons[1]) {
        modeButtons[1].textContent = "Escolha seu clube e o time da CPU";
    }
}

function selectSideTeam(teamKey) {
    if(!AVAILABLE_TEAM_KEYS.includes(teamKey)) return;

    // 1ª etapa: lado vermelho / jogador humano.
    if(teamSelectionPlayer === 1) {
        teamAssignments[1] = teamKey;

        // Mantém um adversário provisório diferente até a escolha definitiva.
        if(teamAssignments[0] === teamKey) {
            teamAssignments[0] = AVAILABLE_TEAM_KEYS.find(key => key !== teamKey) || "real-madrid";
        }

        teamSelectionPlayer = 0;
        populateTeamSelectGrid();
        applyTeamBranding();

        setMessage(
            isCpuMode()
                ? `✅ ${playerName(1)} escolhido. Agora selecione o clube da CPU.`
                : `✅ ${playerName(1)} ficou no lado vermelho. Agora selecione o lado azul.`,
            0
        );
        return;
    }

    // 2ª etapa: não permite o mesmo clube nos dois lados.
    if(teamKey === teamAssignments[1]) return;

    teamAssignments[0] = teamKey;

    hideTeamSelectOverlay();
    applyTeamBranding();

    setMessage(
        isCpuMode()
            ? `🤖 MODO VS CPU! Você joga com ${playerName(1)} no lado vermelho. A CPU joga com ${playerName(0)} no lado azul.`
            : `👥 MODO 2 JOGADORES! ${playerName(1)} enfrenta ${playerName(0)}. ${playerName(1)} começa definindo a formação.`,
        0
    );

    render();
}
function selectGameMode(mode) {
    if(mode !== "pvp" && mode !== "cpu") return;

    clearCpuTimers();
    gameMode = mode;
    hideGameModeOverlay();
    applyTeamBranding();
    showTeamSelectOverlay();

    setMessage("⚽ Selecione o time do lado vermelho para iniciar esta partida.", 0);
    render();
}

// ------------------------------------------------------------
// FORMAÇÃO INICIAL — CPU V4
// Primeiro fecha os três corredores do próprio gol.
// Depois escolhe o lado ofensivo observando a formação vermelha.
// ------------------------------------------------------------
function cpuHumanOpeningCorridorProtection(col) {
    let protection = 0;

    for(const piece of pieces.filter(piece => piece.player === HUMAN_PLAYER)) {
        // O Barcelona defende perto do row 0.
        const depth = Math.max(0, 6 - piece.row);
        if(depth <= 0) continue;

        const lateralDistance = Math.abs(piece.col - col);

        if(lateralDistance === 0) protection += depth * 5;
        else if(lateralDistance === 1) protection += depth * 2.5;
        else if(lateralDistance === 2) protection += depth * 0.8;

        if(["GO","ZG","LE","LD"].includes(piece.role)) {
            protection += Math.max(0, 4 - lateralDistance) * 2;
        }
    }

    return protection;
}

function cpuPickOpeningAttackLane() {
    const lanes = goalColumns.map(col => ({
        col,
        protection: cpuHumanOpeningCorridorProtection(col)
    }));

    lanes.sort((a,b) => a.protection - b.protection);

    // Em empate, evita sempre escolher exatamente o mesmo corredor.
    const bestProtection = lanes[0]?.protection ?? 0;
    const tied = lanes.filter(lane => Math.abs(lane.protection - bestProtection) < 0.01);

    return tied[Math.floor(Math.random() * tied.length)]?.col ?? 5;
}

function cpuBuildFormationPlan() {
    const attackLane = cpuPickOpeningAttackLane();

    // Estrutura defensiva fixa: ZG/LE/LD cobrem os três corredores do gol.
    const plan = {
        GO:  [16,5],
        ZG:  [14,5],
        LE:  [13,4],
        LD:  [13,6],
        ME:  [11,3],
        MD:  [11,7],
        ATK: [9,5]
    };

    if(attackLane === 4) {
        plan.ATK = [9,4];
        plan.ME  = [11,3];
        plan.MD  = [11,6];
    } else if(attackLane === 6) {
        plan.ATK = [9,6];
        plan.ME  = [11,4];
        plan.MD  = [11,7];
    } else {
        plan.ATK = [9,5];
        plan.ME  = [11,3];
        plan.MD  = [11,7];
    }

    return {
        name: `CORREDORES + ATAQUE PELO ${attackLane === 4 ? "LADO ESQUERDO" : attackLane === 6 ? "LADO DIREITO" : "CENTRO"}`,
        attackLane,
        positions: plan
    };
}

function autoBuildCpuFormation() {
    if(!isCpuMode() || !formationSetupActive || formationSetupPlayer !== CPU_PLAYER) return;

    const formation = cpuBuildFormationPlan();
    const cpuPieces = pieces
        .filter(piece => piece.player === CPU_PLAYER)
        .sort((a,b) => {
            if(!!a.reserve !== !!b.reserve) return a.reserve ? 1 : -1;
            return String(a.id).localeCompare(String(b.id));
        });

    cpuPieces.forEach(piece => {
        piece.row = -110;
        piece.col = -110;
    });

    for(const piece of cpuPieces) {
        const preferred = formation.positions[piece.role];
        const rows = getFormationRows(piece.player,piece.role);
        const candidates = [];

        for(const row of rows) {
            for(let col=0; col<COLS; col++) {
                if(!getPieceAt(row,col,piece) && !isBlockedCell(row,col)) {
                    candidates.push({row,col});
                }
            }
        }

        candidates.sort((a,b) => {
            if(preferred) {
                const da = Math.abs(a.row-preferred[0]) + Math.abs(a.col-preferred[1]);
                const db = Math.abs(b.row-preferred[0]) + Math.abs(b.col-preferred[1]);
                if(da !== db) return da-db;
            }
            return Math.abs(a.col-5) - Math.abs(b.col-5);
        });

        const chosen = candidates[0];
        if(chosen) {
            piece.row = chosen.row;
            piece.col = chosen.col;
        }
    }

    formationSelectedPiece = null;
    selectedPiece = null;
    saveFormationForPlayer(CPU_PLAYER);

    setMessage(
        formationSetupReason === "halftime"
            ? `🤖 CPU REAL MADRID reorganizou o time para o 2º tempo: ${formation.name}.`
            : `🤖 CPU REAL MADRID montou ${formation.name}: fechou os corredores do próprio gol e preparou ATK + meias para atacar.`,
        0
    );

    render();

    cpuFormationTimer = setTimeout(() => {
        cpuFormationTimer = null;
        completeFormationSetup();
    }, 900);
}

// ------------------------------------------------------------
// LEITURA TÁTICA DO TABULEIRO
// ------------------------------------------------------------
function cpuGoalDistance(player,row) {
    if(row < 0 || row >= ROWS) return 0;
    return player === 0 ? row + 1 : ROWS - row;
}

function cpuMoveDistance(piece,target) {
    return Math.max(
        Math.abs(target.row - piece.row),
        Math.abs(target.col - piece.col)
    );
}

function cpuIsGoalTarget(player,target) {
    return (
        (player === 0 && target.row === -1 && goalColumns.includes(target.col)) ||
        (player === 1 && target.row === ROWS && goalColumns.includes(target.col))
    );
}

function cpuHumanGoalThreatWays() {
    let ways = 0;

    const dangerousHumanPieces = pieces.filter(piece => {
        return piece.player === HUMAN_PLAYER && piece.row >= ROWS - 7;
    });

    for(const piece of dangerousHumanPieces) {
        for(let die = 1; die <= 6; die++) {
            const moves = getPossibleMovesForDistance(piece, die);

            if(moves.some(target => cpuIsGoalTarget(HUMAN_PLAYER, target))) {
                ways += 1;
            }
        }
    }

    return ways;
}

function cpuHumanDangerScore() {
    let danger = 0;

    for(const enemy of pieces.filter(piece => piece.player === HUMAN_PLAYER)) {
        const attackProgress = Math.max(0, enemy.row - 7);
        const centerDistance = Math.abs(enemy.col - 5);

        let pieceDanger = attackProgress * 4;

        if(goalColumns.includes(enemy.col)) pieceDanger += 18;
        else if(centerDistance <= 2) pieceDanger += 8;

        if(enemy.role === "ATK") pieceDanger += 15;
        if(["ME","MD"].includes(enemy.role)) pieceDanger += 6;

        if(enemy.row >= 13) pieceDanger += 28;
        if(enemy.row >= 15) pieceDanger += 48;

        let nearestCpu = 99;

        for(const defender of pieces.filter(piece => piece.player === CPU_PLAYER)) {
            const distance =
                Math.abs(defender.row - enemy.row) +
                Math.abs(defender.col - enemy.col);

            nearestCpu = Math.min(nearestCpu, distance);
        }

        if(nearestCpu >= 5) pieceDanger += 20;
        else if(nearestCpu >= 3) pieceDanger += 10;
        else pieceDanger -= 7;

        danger += pieceDanger;
    }

    return danger;
}

function cpuDefensiveCoverageScore() {
    const cpuPieces = pieces.filter(piece => piece.player === CPU_PLAYER);
    let coverage = 0;

    // Proteção das três colunas de gol.
    for(const goalCol of goalColumns) {
        let bestDistance = 99;

        for(const piece of cpuPieces) {
            const anchorRow = piece.role === "GO" ? 17 : 15;
            const distance =
                Math.abs(piece.row - anchorRow) +
                Math.abs(piece.col - goalCol);

            bestDistance = Math.min(bestDistance, distance);
        }

        coverage += Math.max(0, 9 - bestDistance) * 5;
    }

    // Marcação dos adversários que já avançaram.
    const threats = pieces.filter(piece =>
        piece.player === HUMAN_PLAYER && piece.row >= 10
    );

    for(const threat of threats) {
        let nearest = 99;

        for(const defender of cpuPieces) {
            const distance =
                Math.abs(defender.row - threat.row) +
                Math.abs(defender.col - threat.col);

            nearest = Math.min(nearest, distance);
        }

        coverage += Math.max(0, 7 - nearest) * 5;
    }

    // Pequeno prêmio por não deixar defensores completamente isolados.
    const defensivePieces = cpuPieces.filter(piece =>
        ["GO","ZG","LE","LD","ME","MD"].includes(piece.role) &&
        piece.row >= 9
    );

    for(const piece of defensivePieces) {
        const hasSupport = defensivePieces.some(other => {
            if(other === piece) return false;

            return (
                Math.abs(other.row - piece.row) <= 3 &&
                Math.abs(other.col - piece.col) <= 3
            );
        });

        if(hasSupport) coverage += 5;
    }

    return coverage;
}

function cpuAttackShapeScore() {
    let score = 0;

    for(const piece of pieces.filter(piece => piece.player === CPU_PLAYER)) {
        const progress = Math.max(0, 17 - piece.row);
        const centerDistance = Math.abs(piece.col - 5);

        if(piece.role === "ATK") {
            score += progress * 3.4;
            score += Math.max(0, 5 - centerDistance) * 1.5;
        } else if(["ME","MD"].includes(piece.role)) {
            score += progress * 2.35;
            score += cpuMidfieldSupportScore(piece) * 0.45;
        } else {
            score += progress * 0.38;
        }
    }

    score += cpuAdvancedThreatShapeScore() * 0.8;

    return score;
}

function cpuBoardStateScore() {
    const goalThreatWays = cpuHumanGoalThreatWays();
    const danger = cpuHumanDangerScore();
    const coverage = cpuDefensiveCoverageScore();
    const attackShape = cpuAttackShapeScore();

    // Ameaça real de gol pesa muito mais do que simplesmente avançar.
    return (
        coverage * 2.4 +
        attackShape * 0.85 -
        danger * 1.65 -
        goalThreatWays * 340
    );
}

function cpuWithTemporaryMove(piece,target,callback) {
    const oldRow = piece.row;
    const oldCol = piece.col;

    piece.row = target.row;
    piece.col = target.col;

    try {
        return callback();
    } finally {
        piece.row = oldRow;
        piece.col = oldCol;
    }
}

function cpuIsDiagonalStep(piece,target) {
    const dr = Math.abs(target.row - piece.row);
    const dc = Math.abs(target.col - piece.col);
    return dr > 0 && dr === dc;
}

function cpuFutureGoalProfileForPiece(piece) {
    const dice = new Set();
    const corridors = new Set();

    // Só vale a pena fazer a busca completa quando a peça já está
    // relativamente próxima do gol adversário.
    if(piece.player === CPU_PLAYER && piece.row > 8) {
        return { dice, corridors, ways:0 };
    }

    for(let die = 1; die <= 6; die++) {
        const moves = getPossibleMovesForDistance(piece,die);

        for(const target of moves) {
            if(cpuIsGoalTarget(piece.player,target)) {
                dice.add(die);
                corridors.add(target.col);
            }
        }
    }

    return {
        dice,
        corridors,
        ways: dice.size
    };
}

function cpuPositionQualityScore(piece) {
    if(!piece || piece.player !== CPU_PLAYER) return 0;

    let score = 0;
    const centerDistance = Math.abs(piece.col - 5);
    const isAttackingRole = ["ATK","ME","MD"].includes(piece.role);

    if(isAttackingRole) {
        // Alinhamento com as três entradas do gol é valioso mesmo
        // quando a peça ainda não está perto o suficiente para finalizar.
        if(goalColumns.includes(piece.col)) score += 24;
        else if(centerDistance <= 2) score += 10;

        if(piece.row <= 9) score += 12;
        if(piece.row <= 7) score += 18;
        if(piece.row <= 5) score += 24;
    }

    const future = cpuFutureGoalProfileForPiece(piece);

    // Quanto mais resultados diferentes do próximo dado produzem gol,
    // melhor é a casa — aprendizado direto do vídeo.
    score += future.ways * 42;
    score += future.corridors.size * 18;

    if(piece.role === "ATK") score *= 1.18;
    if(["ME","MD"].includes(piece.role)) score *= 1.08;

    return score;
}

function cpuMidfieldSupportScore(piece) {
    if(!piece || !["ME","MD"].includes(piece.role)) return 0;

    const attackers = pieces.filter(other =>
        other.player === CPU_PLAYER &&
        other.role === "ATK"
    );

    if(!attackers.length) return 0;

    let best = 0;

    for(const atk of attackers) {
        const longitudinalGap = piece.row - atk.row;
        const lateralGap = Math.abs(piece.col - atk.col);

        // Meia chegando de trás, perto o bastante para criar uma segunda ameaça.
        if(longitudinalGap >= -1 && longitudinalGap <= 5) {
            best = Math.max(best, 30 - lateralGap * 4);
        }

        // Evita amontoar tudo na mesma coluna.
        if(piece.row <= 8 && lateralGap >= 1 && lateralGap <= 4) {
            best = Math.max(best, 38 - Math.abs(2 - lateralGap) * 5);
        }
    }

    return Math.max(0,best);
}

function cpuAdvancedThreatShapeScore() {
    const attacking = pieces.filter(piece =>
        piece.player === CPU_PLAYER &&
        ["ATK","ME","MD"].includes(piece.role) &&
        piece.row <= 8
    );

    if(!attacking.length) return 0;

    const occupiedBands = new Set(
        attacking.map(piece => {
            if(piece.col <= 3) return "L";
            if(piece.col >= 7) return "R";
            return `G${piece.col}`;
        })
    );

    let score = attacking.length * 15 + occupiedBands.size * 16;

    if(attacking.some(piece => piece.role === "ATK") &&
       attacking.some(piece => ["ME","MD"].includes(piece.role))) {
        score += 32;
    }

    if(occupiedBands.size >= 2 && attacking.length >= 2) {
        score += 30;
    }

    return score;
}

function cpuMoveScoreV4(piece,target,beforeBoardScore = null) {
    if(cpuIsGoalTarget(piece.player,target)) {
        return 100000 + Math.random() * 50;
    }

    const baseScore = beforeBoardScore ?? cpuBoardStateScore();
    const beforeGoalDistance = cpuGoalDistance(piece.player,piece.row);
    const afterGoalDistance = cpuGoalDistance(piece.player,target.row);
    const progress = beforeGoalDistance - afterGoalDistance;
    const movementDistance = cpuMoveDistance(piece,target);

    const beforeThreatWays = cpuHumanGoalThreatWays();
    const beforeDanger = cpuHumanDangerScore();
    const beforePositionQuality = cpuPositionQualityScore(piece);
    const beforeAttackShape = cpuAdvancedThreatShapeScore();

    const simulation = cpuWithTemporaryMove(piece,target,() => {
        return {
            board: cpuBoardStateScore(),
            threatWays: cpuHumanGoalThreatWays(),
            danger: cpuHumanDangerScore(),
            positionQuality: cpuPositionQualityScore(piece),
            midfieldSupport: cpuMidfieldSupportScore(piece),
            attackShape: cpuAdvancedThreatShapeScore()
        };
    });

    let score = (simulation.board - baseScore) * 1.05;

    // A casa escolhida agora pesa mais que "andar o máximo".
    score += (simulation.positionQuality - beforePositionQuality) * 1.35;
    score += (simulation.attackShape - beforeAttackShape) * 0.95;

    // Avançar ainda é bom, mas deixou de ser a métrica dominante.
    score += progress * 5.5;

    // Se duas casas produzem resultado semelhante, prefere a distância necessária,
    // e não automaticamente todo o valor do dado.
    score -= movementDistance * 0.45;

    // Defesa continua existindo, mas não apaga uma grande oportunidade ofensiva.
    score += (beforeThreatWays - simulation.threatWays) * 220;

    if(simulation.threatWays > beforeThreatWays) {
        score -= (simulation.threatWays - beforeThreatWays) * 330;
    }

    score += (beforeDanger - simulation.danger) * 1.25;

    const centerDistance = Math.abs(target.col - 5);

    if(piece.role === "ATK") {
        score += progress * 7;
        score += Math.max(0, 5 - centerDistance) * 1.6;

        const diagonal = cpuIsDiagonalStep(piece,target);

        // Dica do jogador: ATK deve explorar bastante as diagonais,
        // principalmente logo no começo da partida.
        if(diagonal && progress > 0) {
            score += 26 + progress * 4;

            if(cpuTurnsCompleted < 5) {
                score += 38;
            }
        }

        if(target.row <= 7) score += 22;
        if(target.row <= 5) score += 28;

        if(pieceInFinalAttackZone({...piece,row:target.row,col:target.col})) {
            score += 58;
        }
    }

    if(["ME","MD"].includes(piece.role)) {
        // Dica do jogador: sempre que possível, levar um meia junto ao ataque.
        score += progress * 5.2;
        score += simulation.midfieldSupport;

        if(target.row <= 9) score += 18;
        if(target.row <= 7) score += 25;

        // Meia em um corredor diferente do ATK cria ameaça dupla.
        const atk = pieces.find(other =>
            other.player === CPU_PLAYER && other.role === "ATK"
        );

        if(atk && target.row <= 8) {
            const lateralGap = Math.abs(target.col - atk.col);
            if(lateralGap >= 1 && lateralGap <= 4) score += 24;
        }
    }

    if(["ZG","LE","LD"].includes(piece.role)) {
        if(beforeDanger > 100 || beforeThreatWays > 0) {
            if(target.row < piece.row) score -= 32;
            if(target.row >= 12) score += 16;
        }

        score += Math.max(0, 5 - centerDistance) * 1.8;
    }

    if(piece.role === "GO") {
        score += Math.max(0, 5 - centerDistance) * 6;
        score -= Math.abs(target.row - 17) * 8;
    }

    // Pequena variação evita partidas idênticas sem destruir a estratégia.
    score += Math.random() * 5;

    return score;
}

function getCpuBestMoveForDistance(distance, excludedPieceIds = []) {
    const excluded = new Set(excludedPieceIds.map(id => String(id)));
    const options = [];
    const beforeBoardScore = cpuBoardStateScore();

    for(const piece of pieces.filter(piece =>
        piece.player === CPU_PLAYER &&
        !excluded.has(String(piece.id))
    )) {
        const moves = getPossibleMovesForDistance(piece,distance);

        for(const target of moves) {
            options.push({
                piece,
                target,
                score: cpuMoveScoreV4(piece,target,beforeBoardScore)
            });
        }
    }

    if(!options.length) return null;

    options.sort((a,b) => b.score - a.score);

    // Se as melhores opções forem muito parecidas, permite uma pequena variação.
    const bestScore = options[0].score;
    const competitive = options
        .filter(option => bestScore - option.score <= 8)
        .slice(0,4);

    if(competitive.length > 1 && Math.random() < 0.28) {
        return competitive[Math.floor(Math.random() * competitive.length)];
    }

    return options[0];
}

function getCpuBestMove() {
    if(diceValue === null) return null;
    return getCpuBestMoveForDistance(diceValue);
}

// ------------------------------------------------------------
// VISÃO DE JOGADA EM DUAS ETAPAS — CPU V3
// A CPU usa somente o dado que já foi sorteado e as cartas que possui.
// Não há previsão de dado futuro nem informação escondida.
// ------------------------------------------------------------
function cpuFindImmediateNormalGoal() {
    if(!diceRolled || diceValue === null) return null;

    const scoringMoves = [];

    for(const piece of pieces.filter(piece => piece.player === CPU_PLAYER)) {
        const moves = getPossibleMovesForDistance(piece,diceValue);

        for(const target of moves) {
            if(cpuIsGoalTarget(CPU_PLAYER,target)) {
                scoringMoves.push({
                    piece,
                    target,
                    score: 200000 + Math.random() * 20
                });
            }
        }
    }

    if(!scoringMoves.length) return null;

    // Se houver mais de um gol legal, prefere atacante/meia e depois menor deslocamento.
    const rolePriority = { ATK:50, ME:35, MD:35, LE:20, LD:20, ZG:10, GO:0 };

    scoringMoves.sort((a,b) => {
        const roleDiff = (rolePriority[b.piece.role] || 0) - (rolePriority[a.piece.role] || 0);
        if(roleDiff !== 0) return roleDiff;
        return cpuMoveDistance(a.piece,a.target) - cpuMoveDistance(b.piece,b.target);
    });

    return scoringMoves[0];
}

function cpuFindCardThenNormalGoal(cardDistance) {
    if(!diceRolled || diceValue === null) return null;

    const candidates = [];
    const beforeBoardScore = cpuBoardStateScore();

    for(const cardPiece of pieces.filter(piece => piece.player === CPU_PLAYER)) {
        const cardMoves = getPossibleMovesForDistance(cardPiece,cardDistance);

        for(const cardTarget of cardMoves) {
            // Se a própria carta já faz gol, isso é tratado como gol direto da carta.
            if(cpuIsGoalTarget(CPU_PLAYER,cardTarget)) continue;
            if(!inside(cardTarget.row,cardTarget.col)) continue;

            const oldRow = cardPiece.row;
            const oldCol = cardPiece.col;

            cardPiece.row = cardTarget.row;
            cardPiece.col = cardTarget.col;

            try {
                const afterCardBoardScore = cpuBoardStateScore();

                for(const followPiece of pieces.filter(piece => piece.player === CPU_PLAYER)) {
                    const normalMoves = getPossibleMovesForDistance(followPiece,diceValue);

                    for(const normalTarget of normalMoves) {
                        if(!cpuIsGoalTarget(CPU_PLAYER,normalTarget)) continue;

                        let score = 100000;

                        // A carta deve preferir uma preparação que não destrua a própria defesa.
                        score += (afterCardBoardScore - beforeBoardScore) * 2;

                        // Pequena preferência por usar a menor distância necessária na preparação.
                        score -= cpuMoveDistance(
                            {row:oldRow,col:oldCol},
                            cardTarget
                        ) * 2;

                        // Valoriza naturalmente ATK/ME/MD chegando ao gol.
                        if(followPiece.role === 'ATK') score += 80;
                        if(['ME','MD'].includes(followPiece.role)) score += 45;

                        candidates.push({
                            piece: cardPiece,
                            target: {row:cardTarget.row,col:cardTarget.col},
                            score,
                            comboGoal: true,
                            followUpPieceId: followPiece.id,
                            followUpTarget: {row:normalTarget.row,col:normalTarget.col},
                            followUpRole: followPiece.role
                        });
                    }
                }
            } finally {
                cardPiece.row = oldRow;
                cardPiece.col = oldCol;
            }
        }
    }

    if(!candidates.length) return null;
    candidates.sort((a,b) => b.score - a.score);
    return candidates[0];
}

function cpuFindBestCardThenNormalSequence(cardDistance) {
    if(!diceRolled || diceValue === null) return null;

    const beforeBoardScore = cpuBoardStateScore();
    let best = null;

    for(const cardPiece of pieces.filter(piece => piece.player === CPU_PLAYER)) {
        const cardMoves = getPossibleMovesForDistance(cardPiece,cardDistance);

        for(const cardTarget of cardMoves) {
            if(cpuIsGoalTarget(CPU_PLAYER,cardTarget)) continue;
            if(!inside(cardTarget.row,cardTarget.col)) continue;

            const oldRow = cardPiece.row;
            const oldCol = cardPiece.col;
            cardPiece.row = cardTarget.row;
            cardPiece.col = cardTarget.col;

            try {
                const follow = getCpuBestMoveForDistance(diceValue);
                if(!follow) continue;

                const afterCardScore = cpuBoardStateScore();
                const cardPositionQuality = cpuPositionQualityScore(cardPiece);
                const attackShape = cpuAdvancedThreatShapeScore();
                let score = 0;

                // V4: carta e dado são avaliados como uma jogada composta.
                score += (afterCardScore - beforeBoardScore) * 1.10;
                score += follow.score * 0.38;
                score += cardPositionQuality * 0.45;
                score += attackShape * 0.18;

                // Evita gastar carta só para fazer um reposicionamento irrelevante.
                score -= cpuMoveDistance(
                    {row:oldRow,col:oldCol},
                    cardTarget
                ) * 0.8;

                // Se a jogada seguinte aproxima muito do gol, reconhece a construção ofensiva.
                const beforeGoalDistance = cpuGoalDistance(follow.piece.player,follow.piece.row);
                const afterGoalDistance = cpuGoalDistance(follow.piece.player,follow.target.row);
                score += Math.max(0,beforeGoalDistance - afterGoalDistance) * 10;

                if(!best || score > best.score) {
                    best = {
                        piece: cardPiece,
                        target: {row:cardTarget.row,col:cardTarget.col},
                        score,
                        comboGoal: false,
                        followUpPieceId: follow.piece.id,
                        followUpTarget: {row:follow.target.row,col:follow.target.col},
                        followUpRole: follow.piece.role
                    };
                }
            } finally {
                cardPiece.row = oldRow;
                cardPiece.col = oldCol;
            }
        }
    }

    return best;
}

// ------------------------------------------------------------
// INTELIGÊNCIA DAS CARTAS
// ------------------------------------------------------------
function cpuEnemyPieceDanger(piece) {
    if(!piece || piece.player !== HUMAN_PLAYER) return -9999;

    let score = piece.row * 4;

    if(piece.role === "ATK") score += 35;
    if(["ME","MD"].includes(piece.role)) score += 14;
    if(goalColumns.includes(piece.col)) score += 24;
    if(piece.row >= 13) score += 55;
    if(piece.row >= 15) score += 90;

    return score;
}

function cpuBestExpulsionTarget() {
    const candidates = pieces.filter(piece =>
        piece.player === HUMAN_PLAYER && piece.role !== "GO"
    );

    if(!candidates.length) return null;

    return candidates
        .map(piece => ({piece,score:cpuEnemyPieceDanger(piece)}))
        .sort((a,b) => b.score - a.score)[0];
}

function cpuBestReservePlan() {
    if(!teamCanReceiveReserve(CPU_PLAYER)) return null;

    const placementCells = getReservePlacementCells(CPU_PLAYER);
    if(!placementCells.length) return null;

    let source = null;
    let role = null;
    let pieceId = null;

    const expelled = [...expelledPlayers[CPU_PLAYER].entries()];

    if(expelled.length) {
        const roleValue = { ATK:9, ZG:8, ME:7, MD:7, LE:6, LD:6, GO:1 };

        expelled.sort((a,b) =>
            (roleValue[b[1].role] || 0) - (roleValue[a[1].role] || 0)
        );

        source = "expelled";
        pieceId = expelled[0][0];
        role = expelled[0][1].role;
    } else {
        const availableRoles = [...reserveAvailable[CPU_PLAYER]];
        if(!availableRoles.length) return null;

        const danger = cpuHumanDangerScore();

        const hasAdvancedAtk = pieces.some(piece =>
            piece.player === CPU_PLAYER &&
            piece.role === "ATK" &&
            piece.row <= 8
        );

        const preference = danger > 125
            ? ["ZG","LE","LD","MD","ME","ATK"]
            : hasAdvancedAtk
                ? ["ATK","MD","ME","ZG","LE","LD"]
                : ["ATK","MD","ME","ZG","LE","LD"];

        role = preference.find(candidate => availableRoles.includes(candidate)) || availableRoles[0];
        source = "reserve";
    }

    const mainThreat = pieces
        .filter(piece => piece.player === HUMAN_PLAYER)
        .sort((a,b) => cpuEnemyPieceDanger(b) - cpuEnemyPieceDanger(a))[0];

    const targetCol = mainThreat ? mainThreat.col : 5;

    const cell = placementCells
        .map(candidate => {
            let score = 0;

            // Para o Real Madrid, row 15 é a linha defensiva mais próxima do meio-campo.
            score += (17 - candidate.row) * 8;
            score -= Math.abs(candidate.col - targetCol) * 4;
            score -= Math.abs(candidate.col - 5) * 1.5;

            return {candidate,score};
        })
        .sort((a,b) => b.score - a.score)[0].candidate;

    return { source, role, pieceId, cell };
}

function cpuBestBlockPlan() {
    const cells = getBlockPlacementCells(CPU_PLAYER);
    if(!cells.length) return null;

    const before = cpuBoardStateScore();
    const beforeThreatWays = cpuHumanGoalThreatWays();
    let best = null;

    for(const cell of cells) {
        const temporaryBlock = {
            id: "__cpu_test_block__",
            player: CPU_PLAYER,
            row: cell.row,
            col: cell.col
        };

        blocks.push(temporaryBlock);

        const after = cpuBoardStateScore();
        const afterThreatWays = cpuHumanGoalThreatWays();

        blocks.pop();

        let score = (after - before) * 1.2;
        score += (beforeThreatWays - afterThreatWays) * 300;

        // BLOCK mais perto da zona ameaçada tende a ser mais útil.
        score += Math.max(0, cell.row - 10) * 2;
        score += Math.max(0, 4 - Math.abs(cell.col - 5)) * 4;

        if(!best || score > best.score) {
            best = { cell, score };
        }
    }

    return best;
}

function cpuBestRetreatPlan() {
    const candidates = pieces.filter(piece => piece.player === HUMAN_PLAYER);
    let best = null;
    const before = cpuBoardStateScore();

    for(const piece of candidates) {
        const result = calculateCard9Retreat(piece);
        if(result.moved <= 0) continue;

        const score = cpuWithTemporaryMove(
            piece,
            {row:result.row,col:result.col},
            () => {
                return (
                    (cpuBoardStateScore() - before) * 1.3 +
                    result.moved * 18 +
                    cpuEnemyPieceDanger(piece) * 0.3
                );
            }
        );

        if(!best || score > best.score) {
            best = { piece, result, score };
        }
    }

    return best;
}

function cpuBestCardMove(distance, excludedPieceIds = []) {
    return getCpuBestMoveForDistance(distance, excludedPieceIds);
}

function cpuEvaluateCardOption(cardId, slotIndex, forcedByFullHand = false) {
    const threatWays = cpuHumanGoalThreatWays();
    const danger = cpuHumanDangerScore();
    let priority = -9999;
    let plan = null;

    if(cardId === 1) {
        plan = cpuBestExpulsionTarget();
        if(plan) {
            priority =
                28 +
                plan.score * 0.5 +
                threatWays * 28;

            if(plan.piece.row >= 13) priority += 28;
        }
    }

    else if(cardId === 2) {
        plan = cpuBestReservePlan();

        if(plan) {
            const activeCount = getActiveTeamPieceCount(CPU_PLAYER);
            priority =
                25 +
                (MAX_TEAM_PIECES - activeCount) * 13 +
                danger * 0.15;

            if(plan.source === "expelled") priority += 22;

            const advancedAttackers = pieces.filter(piece =>
                piece.player === CPU_PLAYER &&
                ["ATK","ME","MD"].includes(piece.role) &&
                piece.row <= 8
            ).length;

            if(plan.role === "ATK" && advancedAttackers >= 1) priority += 20;
            if(["ME","MD"].includes(plan.role) && advancedAttackers >= 1) priority += 12;
        }
    }

    else if(cardId === 3) {
        const directPlan = cpuBestCardMove(CARD_3_DISTANCE);
        const comboGoalPlan = diceRolled ? cpuFindCardThenNormalGoal(CARD_3_DISTANCE) : null;
        const sequencePlan = diceRolled ? cpuFindBestCardThenNormalSequence(CARD_3_DISTANCE) : null;

        if(directPlan && cpuIsGoalTarget(CPU_PLAYER,directPlan.target)) {
            plan = directPlan;
            priority = 50000;
        } else if(comboGoalPlan) {
            plan = comboGoalPlan;
            priority = 40000 + comboGoalPlan.score * 0.01;
        } else {
            plan = sequencePlan || directPlan;

            if(plan) {
                priority = 22 + Math.max(0,plan.score) * 0.18;

                if(sequencePlan && sequencePlan === plan) {
                    priority += 24;
                }
            }
        }
    }

    else if(cardId === 4) {
        const directPlan = cpuBestCardMove(CARD_4_DISTANCE);
        const comboGoalPlan = diceRolled ? cpuFindCardThenNormalGoal(CARD_4_DISTANCE) : null;
        const sequencePlan = diceRolled ? cpuFindBestCardThenNormalSequence(CARD_4_DISTANCE) : null;

        if(directPlan && cpuIsGoalTarget(CPU_PLAYER,directPlan.target)) {
            plan = directPlan;
            priority = 50000;
        } else if(comboGoalPlan) {
            plan = comboGoalPlan;
            priority = 40000 + comboGoalPlan.score * 0.01;
        } else {
            plan = sequencePlan || directPlan;

            if(plan) {
                priority = 18 + Math.max(0,plan.score) * 0.16;

                if(sequencePlan && sequencePlan === plan) {
                    priority += 28;
                }
            }
        }
    }

    else if(cardId === 7) {
        plan = cpuBestCardMove(CARD_7_DISTANCE);

        if(plan && getEligibleCard7Pieces(CPU_PLAYER).length > 0) {
            priority =
                38 +
                Math.max(0,plan.score) * 0.13 +
                threatWays * 12;

            if(cpuIsGoalTarget(CPU_PLAYER,plan.target)) priority = 50000;
        }
    }

    // Cartas de movimento valem mais depois de conhecer o dado. Sem obrigação
    // de liberar slot, a CPU conserva 3/4/7 para procurar combinações no turno.
    if(
        [3,4,7].includes(cardId) &&
        !diceRolled &&
        !forcedByFullHand &&
        plan &&
        !cpuIsGoalTarget(CPU_PLAYER,plan.target)
    ) {
        priority = Math.min(priority,24);
    }

    if(cardId === 8) {
        plan = cpuBestBlockPlan();

        if(plan) {
            priority =
                20 +
                Math.max(0,plan.score) * 0.3 +
                threatWays * 70 +
                danger * 0.12;
        }
    }

    else if(cardId === 9) {
        plan = cpuBestRetreatPlan();

        if(plan) {
            priority =
                22 +
                Math.max(0,plan.score) * 0.25 +
                threatWays * 35;
        }
    }

    else if(cardId === 10) {
        const opponent = HUMAN_PLAYER;

        if(!catimbaPending[opponent]) {
            plan = { opponent };

            priority =
                24 +
                threatWays * 45 +
                danger * 0.13;

            // Nem sempre gasta CATIMBA cedo sem pressão.
            if(threatWays === 0 && danger < 75) priority -= 14;
        }
    }

    if(plan && forcedByFullHand) {
        priority += 60;
    }

    if(plan) {
        priority += Math.random() * 8;
    }

    return { cardId, slotIndex, priority, plan };
}

function cpuChooseCardDecision() {
    if(cpuCardUsedThisTurn) return null;

    const hand = hands[CPU_PLAYER] || [];
    if(!hand.length) return null;

    const forcedByFullHand = hand.length >= MAX_CARDS;
    const options = hand.map((cardId,slotIndex) =>
        cpuEvaluateCardOption(cardId,slotIndex,forcedByFullHand)
    );

    const usable = options
        .filter(option => option.plan && option.priority > -1000)
        .sort((a,b) => b.priority - a.priority);

    if(!usable.length) return null;

    const best = usable[0];

    // Com os três slots cheios, tenta liberar um slot.
    if(forcedByFullHand) return best;

    // Fora disso, só usa quando existe uma razão tática razoável.
    if(best.priority < 48) return null;

    return best;
}

function cpuWaitForCardResolution() {
    if(
        !isCpuTurn() ||
        winner !== null ||
        goalPause
    ) {
        cpuThinking = false;
        return;
    }

    if(
        moveAnimationActive ||
        cardVideoActive ||
        cardTargetMode
    ) {
        if(cpuActionTimer) clearTimeout(cpuActionTimer);

        cpuActionTimer = setTimeout(() => {
            cpuActionTimer = null;
            cpuWaitForCardResolution();
        }, 260);

        return;
    }

    cpuThinking = false;
    render();

    if(diceRolled) {
        scheduleCpuAfterDice(500);
    } else {
        scheduleCpuIfNeeded(500);
    }
}

function cpuContinueCard7Sequence() {
    cpuActionTimer = null;

    if(
        !isCpuTurn() ||
        winner !== null ||
        goalPause
    ) {
        cpuThinking = false;
        return;
    }

    if(moveAnimationActive || cardVideoActive) {
        cpuActionTimer = setTimeout(cpuContinueCard7Sequence,260);
        return;
    }

    if(!cardTargetMode || cardTargetMode.cardId !== 7) {
        cpuWaitForCardResolution();
        return;
    }

    if(cardTargetMode.phase !== "choosePiece") {
        cpuActionTimer = setTimeout(cpuContinueCard7Sequence,220);
        return;
    }

    const excludedIds = cardTargetMode.movedPieceIds || [];
    const choice = cpuBestCardMove(CARD_7_DISTANCE,excludedIds);

    if(!choice) {
        finishCard7Sequence(CPU_PLAYER,cardTargetMode.slotIndex);
        cpuActionTimer = setTimeout(cpuWaitForCardResolution,350);
        return;
    }

    selectedPiece = choice.piece;
    selectPieceForCard7(choice.piece);

    cpuActionTimer = setTimeout(() => {
        cpuActionTimer = null;

        if(
            !cardTargetMode ||
            cardTargetMode.cardId !== 7 ||
            winner !== null ||
            goalPause
        ) return;

        movePieceWithCard7(choice.target.row,choice.target.col);
        cpuActionTimer = setTimeout(cpuContinueCard7Sequence,420);
    },420);
}

function cpuExecuteCardDecision(decision) {
    if(!decision || !isCpuTurn()) return false;

    const {cardId,slotIndex,plan} = decision;
    cpuCardUsedThisTurn = true;
    cpuThinking = true;

    if(plan && plan.comboGoal) {
        setMessage(
            `🤖 CPU enxergou uma combinação: ${cardName(cardId)} para preparar ${plan.followUpRole} e depois usar o dado ${diceValue} buscando o gol.`
        );
    } else {
        setMessage(`🤖 CPU decidiu usar a Carta ${cardId} — ${cardName(cardId)}.`);
    }
    render();

    activateCard(CPU_PLAYER,slotIndex,true);

    if(cardId === 1) {
        cpuActionTimer = setTimeout(() => {
            cpuActionTimer = null;
            expelWithCard(plan.piece);
            cpuWaitForCardResolution();
        },450);
        return true;
    }

    if(cardId === 2) {
        cpuActionTimer = setTimeout(() => {
            cpuActionTimer = null;

            if(plan.source === "expelled") {
                chooseExpelledPlayer(CPU_PLAYER,plan.pieceId);
            } else {
                chooseReserveRole(CPU_PLAYER,plan.role);
            }

            setTimeout(() => {
                placeReserveWithCard(plan.cell.row,plan.cell.col);
                cpuWaitForCardResolution();
            },320);
        },420);

        return true;
    }

    if(cardId === 3) {
        cpuActionTimer = setTimeout(() => {
            cpuActionTimer = null;
            selectPieceForCard3(plan.piece);

            setTimeout(() => {
                movePieceWithCard3(plan.target.row,plan.target.col);
                cpuWaitForCardResolution();
            },350);
        },420);

        return true;
    }

    if(cardId === 4) {
        cpuActionTimer = setTimeout(() => {
            cpuActionTimer = null;
            selectPieceForCard4(plan.piece);

            setTimeout(() => {
                movePieceWithCard4(plan.target.row,plan.target.col);
                cpuWaitForCardResolution();
            },350);
        },420);

        return true;
    }

    if(cardId === 7) {
        cpuActionTimer = setTimeout(() => {
            cpuActionTimer = null;
            cpuContinueCard7Sequence();
        },480);

        return true;
    }

    if(cardId === 8) {
        cpuActionTimer = setTimeout(() => {
            cpuActionTimer = null;
            placeBlockWithCard(plan.cell.row,plan.cell.col);
            cpuWaitForCardResolution();
        },470);

        return true;
    }

    if(cardId === 9) {
        cpuActionTimer = setTimeout(() => {
            cpuActionTimer = null;
            retreatWithCard9(plan.piece);
            cpuWaitForCardResolution();
        },470);

        return true;
    }

    if(cardId === 10) {
        // CATIMBA é aplicada instantaneamente pela própria activateCard().
        cpuActionTimer = setTimeout(() => {
            cpuActionTimer = null;
            cpuWaitForCardResolution();
        },300);

        return true;
    }

    cpuCardUsedThisTurn = false;
    return false;
}

function cpuTryUseStrategicCard() {
    if(
        !isCpuTurn() ||
        cpuCardUsedThisTurn ||
        moveAnimationActive ||
        cardVideoActive ||
        cardTargetMode ||
        winner !== null ||
        goalPause
    ) return false;

    const decision = cpuChooseCardDecision();
    if(!decision) return false;

    return cpuExecuteCardDecision(decision);
}

// ------------------------------------------------------------
// TURNO AUTOMÁTICO
// ------------------------------------------------------------
function cpuChooseAndMove() {
    cpuActionTimer = null;

    if(
        !isCpuTurn() ||
        !diceRolled ||
        winner !== null ||
        goalPause ||
        moveAnimationActive ||
        cardVideoActive ||
        formationSetupActive ||
        kickoffDrawPending ||
        kickoffRouletteSpinning
    ) {
        cpuThinking = false;
        return;
    }

    // Prioridade absoluta: se o dado atual já permite um gol legal,
    // a CPU finaliza a jogada em vez de gastar carta ou recuar para defender.
    const immediateGoal = cpuFindImmediateNormalGoal();

    if(immediateGoal) {
        const {piece,target} = immediateGoal;
        selectedPiece = piece;
        cpuThinking = true;

        setMessage(`🤖 CPU encontrou gol direto com o dado ${diceValue}. ${piece.role} vai finalizar!`);
        render();

        cpuActionTimer = setTimeout(() => {
            cpuActionTimer = null;

            if(!isCpuTurn() || winner !== null || goalPause) {
                cpuThinking = false;
                return;
            }

            const path = getAnimationPathForDistance(piece,target.row,target.col,diceValue);

            animatePieceAlongPath(
                piece,
                path.length ? path : [target],
                () => {
                    piece.row = target.row;
                    piece.col = target.col;
                    selectedPiece = null;
                    cpuThinking = false;

                    if(checkGoal(piece)) {
                        registerGoal(CPU_PLAYER, piece);
                        return;
                    }

                    passTurn();
                }
            );
        },520);

        return;
    }

    // Sem gol direto, agora sim procura combinações com cartas e outras decisões táticas.
    if(cpuTryUseStrategicCard()) return;

    const choice = getCpuBestMove();

    if(!choice) {
        cpuThinking = false;
        setMessage("🤖 CPU não encontrou movimento válido. Passando a vez...");
        setTimeout(passTurn,700);
        return;
    }

    const {piece,target} = choice;
    const distance = cpuMoveDistance(piece,target);

    selectedPiece = piece;
    cpuThinking = true;

    const futureProfile = cpuWithTemporaryMove(piece,target,() =>
        cpuFutureGoalProfileForPiece(piece)
    );

    let tacticalLabel = "melhorando a posição";

    if(cpuIsDiagonalStep(piece,target) && piece.role === "ATK") {
        tacticalLabel = "abrindo diagonal de ataque";
    } else if(["ME","MD"].includes(piece.role) && target.row < piece.row) {
        tacticalLabel = "levando o meio-campo para apoiar o ataque";
    } else if(futureProfile.ways > 0) {
        tacticalLabel = `criando ameaça de gol para ${futureProfile.ways} resultado${futureProfile.ways > 1 ? "s" : ""} do dado`;
    } else if(cpuHumanGoalThreatWays() > 0 || cpuHumanDangerScore() > 115) {
        tacticalLabel = "reorganizando a defesa sem abandonar o ataque";
    }

    setMessage(
        `🤖 CPU escolheu ${piece.role}: ${distance} casa${distance !== 1 ? "s" : ""}, ${tacticalLabel}.`
    );

    render();

    cpuActionTimer = setTimeout(() => {
        cpuActionTimer = null;

        if(!isCpuTurn() || winner !== null || goalPause) {
            cpuThinking = false;
            return;
        }

        const path = getAnimationPathForDistance(
            piece,
            target.row,
            target.col,
            diceValue
        );

        animatePieceAlongPath(
            piece,
            path.length ? path : [target],
            () => {
                piece.row = target.row;
                piece.col = target.col;

                selectedPiece = null;
                cpuThinking = false;

                if(checkGoal(piece)) {
                    registerGoal(CPU_PLAYER, piece);
                    return;
                }

                passTurn();
            }
        );
    },650);
}

function scheduleCpuAfterDice(delay=700) {
    if(!isCpuTurn() || !diceRolled || winner !== null || goalPause) return;

    if(cpuActionTimer) clearTimeout(cpuActionTimer);

    cpuThinking = true;
    render();

    cpuActionTimer = setTimeout(cpuChooseAndMove,delay);
}

function runCpuTurn() {
    cpuActionTimer = null;

    if(
        !isCpuTurn() ||
        winner !== null ||
        goalPause ||
        formationSetupActive ||
        kickoffDrawPending ||
        kickoffRouletteSpinning ||
        periodBreakActive ||
        moveAnimationActive ||
        cardVideoActive
    ) {
        cpuThinking = false;
        return;
    }

    if(diceRolled) {
        scheduleCpuAfterDice(450);
        return;
    }

    cpuThinking = true;
    setMessage("🤖 CPU V4 está lendo corredores, diagonais, apoio dos meias, cartas e oportunidades de gol...");
    render();

    // Antes do dado a CPU pode usar uma carta — especialmente se os slots
    // estiverem cheios ou existir uma ameaça clara.
    if(cpuTryUseStrategicCard()) return;

    cpuActionTimer = setTimeout(() => {
        cpuActionTimer = null;

        if(!isCpuTurn() || winner !== null || goalPause) {
            cpuThinking = false;
            return;
        }

        cpuThinking = false;
        rollDice();
    },700);
}

function scheduleCpuIfNeeded(delay=850) {
    if(!isCpuTurn()) return;

    if(
        winner !== null ||
        goalPause ||
        formationSetupActive ||
        kickoffDrawPending ||
        kickoffRouletteSpinning ||
        periodBreakActive
    ) return;

    if(cpuActionTimer) clearTimeout(cpuActionTimer);

    cpuThinking = true;
    render();

    cpuActionTimer = setTimeout(runCpuTurn,delay);
}

// ============================================================
// FORMAÇÃO INICIAL + REINÍCIO DAS PEÇAS
// ============================================================

function getFormationRows(player, role) {
    const lines = FORMATION_LINES_BY_ROLE[role] || [];

    // Barcelona defende a esquerda: 1ª linha = row 0.
    // Real Madrid defende a direita: 1ª linha = row 17.
    return lines.map(line => player === 1 ? line - 1 : ROWS - line);
}

function getFormationRangeText(role) {
    if(role === "GO") return "1ª, 2ª ou 3ª linha";
    if(["ZG","LE","LD"].includes(role)) return "4ª ou 5ª linha";
    if(["ME","MD"].includes(role)) return "6ª ou 7ª linha";
    return "8ª ou 9ª linha";
}

function getSuggestedFormation(player) {
    if(player === 1) {
        return [
            [1,5], // GO
            [3,5], // ZG
            [4,2], // LE
            [4,8], // LD
            [5,3], // ME
            [5,7], // MD
            [7,5]  // ATK
        ];
    }

    return [
        [16,5], // GO
        [14,5], // ZG
        [13,8], // LE
        [13,2], // LD
        [12,7], // ME
        [12,3], // MD
        [10,5]  // ATK
    ];
}

function createFormationSetupPieces() {
    pieces = [];

    [0,1].forEach(player => {
        const positions = getSuggestedFormation(player);

        positions.forEach((position, index) => {
            pieces.push({
                player,
                id: index,
                role: PLAYER_ROLES[index],
                row: position[0],
                col: position[1],
                reserve: false
            });
        });
    });
}

function isFormationCellAllowed(piece, row, col) {
    if(!inside(row,col)) return false;
    if(!getFormationRows(piece.player, piece.role).includes(row)) return false;
    if(isBlockedCell(row,col)) return false;

    const occupant = getPieceAt(row, col, piece);
    return !occupant;
}

function getFormationPlacementCells(piece) {
    const cells = [];

    getFormationRows(piece.player, piece.role).forEach(row => {
        for(let col = 0; col < COLS; col++) {
            if(isFormationCellAllowed(piece,row,col)) {
                cells.push({row,col});
            }
        }
    });

    return cells;
}

function saveFormationForPlayer(player) {
    const formation = {};

    pieces
        .filter(piece => piece.player === player && !piece.reserve && Number.isInteger(piece.id))
        .forEach(piece => {
            formation[piece.id] = {
                row: piece.row,
                col: piece.col,
                role: piece.role
            };
        });

    startingFormation[player] = formation;
}

function selectFormationPiece(piece) {
    if(!formationSetupActive) return false;
    if(isCpuMode() && formationSetupPlayer === CPU_PLAYER) {
        setMessage("🤖 A CPU REAL MADRID está escolhendo a própria formação.",0);
        return true;
    }

    if(piece.player !== formationSetupPlayer) {
        setMessage(
            formationSetupPlayer === 1
                ? "🔴 Formação do BARCELONA: escolha apenas uma peça vermelha."
                : "🔵 Formação do REAL MADRID: escolha apenas uma peça azul.",
            0
        );
        return true;
    }

    formationSelectedPiece = piece;
    selectedPiece = null;

    setMessage(
        `${piece.player === 1 ? "🔴" : "🔵"} ${piece.role} selecionado — escolha uma casa dourada na ${getFormationRangeText(piece.role)} do próprio campo.`,
        0
    );

    render();
    return true;
}

function handleFormationCellClick(row, col) {
    if(!formationSetupActive) return false;
    if(isCpuMode() && formationSetupPlayer === CPU_PLAYER) {
        setMessage(`🤖 Aguarde a CPU ${playerName(CPU_PLAYER)} concluir a formação.`,0);
        return true;
    }

    if(!formationSelectedPiece) {
        setMessage(
            `${formationSetupPlayer === 1 ? "🔴" : "🔵"} ${playerName(formationSetupPlayer)}: clique primeiro em uma peça para definir sua posição inicial.`,
            0
        );
        return true;
    }

    const piece = formationSelectedPiece;

    if(!isFormationCellAllowed(piece,row,col)) {
        setMessage(
            `${piece.role} só pode começar na ${getFormationRangeText(piece.role)} do próprio campo, em uma casa vazia.`,
            0
        );
        return true;
    }

    piece.row = row;
    piece.col = col;
    formationSelectedPiece = null;

    setMessage(
        `${piece.player === 1 ? "🔴" : "🔵"} ${piece.role} posicionado. Escolha outra peça ou confirme a formação.`,
        0
    );

    render();
    return true;
}

function getHalftimeFormationFallbackCell(piece) {
    const rows = getFormationRows(piece.player,piece.role);
    const centerCol = Math.floor(COLS / 2);

    const orderedRows = [...rows].sort((a,b) => {
        return piece.player === 1 ? b - a : a - b;
    });

    const orderedCols = Array.from({length:COLS},(_,col) => col)
        .sort((a,b) => {
            const da = Math.abs(a-centerCol);
            const db = Math.abs(b-centerCol);
            if(da !== db) return da-db;
            return a-b;
        });

    for(const row of orderedRows) {
        for(const col of orderedCols) {
            if(!getPieceAt(row,col,piece) && !isBlockedCell(row,col)) {
                return {row,col};
            }
        }
    }

    return null;
}

function prepareHalftimeFormationPieces() {
    const activePieces = [...pieces];

    // Mantém os mesmos jogadores ativos, apenas retirando-os temporariamente
    // para redistribuir todos nas faixas de formação sem colisões.
    activePieces.forEach(piece => {
        piece.row = -100;
        piece.col = -100;
    });

    const ordered = [...activePieces].sort((a,b) => {
        if(a.player !== b.player) return b.player - a.player;
        if(!!a.reserve !== !!b.reserve) return a.reserve ? 1 : -1;
        return String(a.id).localeCompare(String(b.id));
    });

    for(const piece of ordered) {
        let chosen = null;

        if(!piece.reserve && Number.isInteger(piece.id)) {
            const saved = startingFormation[piece.player]?.[piece.id];

            if(
                saved &&
                getFormationRows(piece.player,piece.role).includes(saved.row) &&
                !getPieceAt(saved.row,saved.col,piece) &&
                !isBlockedCell(saved.row,saved.col)
            ) {
                chosen = {row:saved.row,col:saved.col};
            }
        }

        if(!chosen) chosen = getHalftimeFormationFallbackCell(piece);

        if(chosen) {
            piece.row = chosen.row;
            piece.col = chosen.col;
        }
    }
}

function beginHalftimeFormationSetup() {
    formationSetupReason = "halftime";
    formationSetupActive = true;
    formationSetupPlayer = 1;
    formationSelectedPiece = null;
    selectedPiece = null;
    cardTargetMode = null;
    diceValue = null;
    diceRolled = false;

    prepareHalftimeFormationPieces();
    resetDiceDisplay();
    resetTurnClock();

    setMessage(
        "🔴 INTERVALO: reorganize a formação VERMELHA para o 2º tempo. Expulsos permanecem fora e reservas que já entraram continuam em campo.",
        0
    );

    render();
}

function completeFormationSetup() {
    formationSetupActive = false;
    formationSetupPlayer = null;
    selectedPiece = null;
    formationSelectedPiece = null;
    diceValue = null;
    diceRolled = false;
    resetDiceDisplay();

    if(formationSetupReason === "halftime") {
        formationSetupReason = "initial";
        kickoffDrawPending = false;
        kickoffResolved = true;
        kickoffRouletteSpinning = false;
        periodBreakActive = false;
        periodBreakType = null;

        currentPlayer = getPeriodKickoffPlayer(2);
        cpuCardUsedThisTurn = false;

        setMessage(
            `▶ 2º TEMPO! Formações ajustadas. ${playerName(currentPlayer)} dará a saída.`,
            0
        );

        startMatchClock();
        render();
        scheduleCpuIfNeeded(750);
        return;
    }

    kickoffDrawPending = true;
    kickoffResolved = false;
    kickoffRouletteSpinning = false;
    setMessage("🎯 Formações confirmadas! Agora será sorteado quem dará o pontapé inicial.", 0);
    render();
    showKickoffRoulette();
}

function confirmFormation() {
    if(!formationSetupActive) return;
    if(isCpuMode() && formationSetupPlayer === CPU_PLAYER) {
        setMessage("🤖 A CPU define a formação REAL MADRID automaticamente.",0);
        return;
    }
    saveFormationForPlayer(formationSetupPlayer);
    formationSelectedPiece = null;
    if(formationSetupPlayer === 1) {
        formationSetupPlayer = 0;
        if(isCpuMode()) {
            setMessage(
                formationSetupReason === "halftime"
                    ? "🤖 Intervalo: CPU REAL MADRID está reorganizando a formação para o 2º tempo..."
                    : "🤖 CPU REAL MADRID está montando sua formação...",
                0
            );
            render();
            cpuFormationTimer=setTimeout(autoBuildCpuFormation,700);
            return;
        }
        setMessage(
            formationSetupReason === "halftime"
                ? "🔵 INTERVALO: agora o REAL MADRID reorganiza suas peças para o 2º tempo."
                : "🔵 Agora o REAL MADRID define sua formação: GO 1ª-3ª • ZG/LE/LD 4ª-5ª • ME/MD 6ª-7ª • ATK 8ª-9ª.",
            0
        );
        render();
        return;
    }
    completeFormationSetup();
}

function findSectorRestartCell(player, role) {
    const rows = getFormationRows(player, role);

    // Primeiro procura lateralmente do centro para as pontas.
    const centerCol = Math.floor(COLS / 2);
    const preferredCols = Array.from({length: COLS}, (_, col) => col)
        .sort((a,b) => {
            const distanceA = Math.abs(a - centerCol);
            const distanceB = Math.abs(b - centerCol);
            if(distanceA !== distanceB) return distanceA - distanceB;
            return a - b;
        });

    // Dentro da faixa da posição, prioriza a linha mais próxima do meio-campo:
    // Barcelona = maior row; Real Madrid = menor row.
    const orderedRows = [...rows].sort((a,b) => {
        return player === 1 ? b - a : a - b;
    });

    for(const row of orderedRows) {
        for(const col of preferredCols) {
            if(!getPieceAt(row,col) && !isBlockedCell(row,col)) {
                return {row,col};
            }
        }
    }

    return null;
}

function createPieces() {
    pieces = [];

    // Titulares sobreviventes sempre retornam à formação escolhida no início.
    [0,1].forEach(player => {
        for(let index = 0; index < PLAYER_ROLES.length; index++) {
            if(expelledPlayers[player].has(index)) continue;

            const saved = startingFormation[player][index];
            const fallback = getSuggestedFormation(player)[index];
            const position = saved || {
                row: fallback[0],
                col: fallback[1],
                role: PLAYER_ROLES[index]
            };

            pieces.push({
                player,
                id: index,
                role: PLAYER_ROLES[index],
                row: position.row,
                col: position.col,
                reserve: false
            });
        }
    });

    // Reservas que entraram com SANGUE NOVO continuam no time.
    // Após cada gol, retornam para a faixa tática correspondente à própria posição.
    [0,1].forEach(player => {
        reserveInPlay[player].forEach(reserve => {
            if(expelledPlayers[player].has(reserve.id)) return;

            const position = findSectorRestartCell(player, reserve.role);
            if(!position) return;

            pieces.push({
                player,
                id: reserve.id,
                role: reserve.role,
                row: position.row,
                col: position.col,
                reserve: true
            });
        });
    });
}

// ============================================================
// VERIFICAR CAMPO
// ============================================================

function inside(
    row,
    col
) {

    return (

        row >= 0 &&
        row < ROWS &&
        col >= 0 &&
        col < COLS

    );

}


// ============================================================
// ZONA DE MOVIMENTO DO GOLEIRO
// ============================================================

function goalkeeperPositionAllowed(
    piece,
    row,
    col
) {

    if(piece.role !== "GO") {
        return true;
    }

    // O goleiro nunca pode sair do campo para entrar no gol adversário.
    if(!inside(row,col)) {
        return false;
    }

    // Real Madrid defende o gol da direita e pode ocupar somente
    // as três linhas mais próximas dele: 15, 16 e 17.
    if(piece.player === 0) {
        return row >= ROWS - GOALKEEPER_ZONE_DEPTH;
    }

    // Barcelona defende o gol da esquerda e pode ocupar somente
    // as três linhas mais próximas dele: 0, 1 e 2.
    return row < GOALKEEPER_ZONE_DEPTH;
}


// ============================================================
// VERIFICAR ÁREA DE GOL
//
// Real Madrid vence entrando na linha acima do campo.
// Barcelona vence entrando na linha abaixo.
// ============================================================

function isGoalCell(
    row,
    col,
    player
) {

    if(
        !goalColumns.includes(col)
    ) {

        return false;

    }


    // Real Madrid ataca o gol vermelho

    if(
        player === 0 &&
        row === -1
    ) {

        return true;

    }


    // Barcelona ataca o gol azul

    if(
        player === 1 &&
        row === ROWS
    ) {

        return true;

    }


    return false;

}


// ============================================================
// VERIFICAR SE POSIÇÃO É VÁLIDA
// ============================================================

function validPosition(
    row,
    col,
    player
) {

    return (

        inside(row,col) ||

        isGoalCell(
            row,
            col,
            player
        )

    );

}


// ============================================================
// ENCONTRAR PEÇA
// ============================================================

function getPieceAt(
    row,
    col,
    ignoredPiece=null
) {

    return pieces.find(
        piece => {

            return (

                piece !== ignoredPiece &&

                piece.row === row &&

                piece.col === col

            );

        }
    );

}


// ============================================================
// BLOQUEIOS DA CARTA 8
// ============================================================

function getBlockAt(row, col) {
    return blocks.find(block => block.row === row && block.col === col);
}

function isBlockedCell(row, col) {
    return !!getBlockAt(row, col);
}

function isDefenseHalf(player, row) {
    // Barcelona defende as linhas 0 a 8; Real Madrid defende as linhas 9 a 17.
    return player === 1
        ? row >= 0 && row < ROWS / 2
        : row >= ROWS / 2 && row < ROWS;
}

function isForbiddenBlockGoalFront(player, row, col) {
    // As três casas imediatamente à frente do próprio gol são protegidas:
    // Barcelona: row 0 | Real Madrid: row 17 | sempre nas 3 colunas do gol.
    const frontRow = player === 1 ? 0 : ROWS - 1;
    return row === frontRow && goalColumns.includes(col);
}

function getBlockPlacementCells(player) {
    const available = [];

    for(let row = 0; row < ROWS; row++) {
        if(!isDefenseHalf(player, row)) continue;

        for(let col = 0; col < COLS; col++) {
            if(isForbiddenBlockGoalFront(player, row, col)) continue;

            if(!getPieceAt(row, col) && !isBlockedCell(row, col)) {
                available.push({ row, col });
            }
        }
    }

    return available;
}

function clearBlocksAfterGoal() {
    const removed = blocks.length;
    blocks = [];
    return removed;
}


// ============================================================
// SINAL
// ============================================================

function sign(
    number
) {

    if(number > 0)
        return 1;

    if(number < 0)
        return -1;

    return 0;

}


// ============================================================
// VERIFICAR CAMINHO
// ============================================================

function pathClear(
    piece,
    targetRow,
    targetCol
) {

    const dr =
        targetRow -
        piece.row;

    const dc =
        targetCol -
        piece.col;


    const distance =
        Math.max(
            Math.abs(dr),
            Math.abs(dc)
        );


    const stepRow =
        sign(dr);

    const stepCol =
        sign(dc);


    for(
        let i=1;
        i<=distance;
        i++
    ) {

        const row =
            piece.row +
            stepRow*i;


        const col =
            piece.col +
            stepCol*i;


        // Se for a posição final,
        // ela pode ser uma área de gol.

        if(
            i === distance
        ) {

            if(
                isGoalCell(
                    row,
                    col,
                    piece.player
                )
            ) {

                return true;

            }

        }


        // Dentro do campo:

        if(
            inside(row,col) &&
            (
                getPieceAt(
                    row,
                    col,
                    piece
                ) ||
                isBlockedCell(row,col)
            )
        ) {

            return false;

        }

    }


    return true;

}


// ============================================================
// MOVIMENTO — ATK COM DIAGONAL LIVRE; GO/ZG COM DIAGONAL SÓ NA DEFESA
// ============================================================

function straightMoveValid(
    piece,
    targetRow,
    targetCol
) {

    const dr =
        targetRow -
        piece.row;


    const dc =
        targetCol -
        piece.col;


    // Movimento diagonal:
    // ATK pode em qualquer área; GO e ZG somente na própria defesa.
    if(
        dr !== 0 &&
        dc !== 0
    ) {

        if(
            !diagonalSegmentAllowed(
                piece,
                piece.row,
                piece.col,
                targetRow,
                targetCol
            )
        ) {
            return false;
        }

    }


    const distance =
        Math.max(
            Math.abs(dr),
            Math.abs(dc)
        );


    // Em regra, dado/carta define o LIMITE MÁXIMO do movimento.
    // Exceção: QUALQUER peça que JÁ ESTIVER nas últimas 3 linhas
    // do campo de ataque deve cumprir a distância completa.
    if(
        distance < 1 ||
        distance > diceValue
    ) {

        return false;

    }

    if(
        pieceInFinalAttackZone(piece) &&
        distance !== diceValue
    ) {
        return false;
    }


    if(
        !validPosition(
            targetRow,
            targetCol,
            piece.player
        )
    ) {

        return false;

    }


    // Não pode terminar em uma peça

    if(
        inside(targetRow,targetCol) &&
        getPieceAt(
            targetRow,
            targetCol,
            piece
        )
    ) {

        return false;

    }


    return pathClear(
        piece,
        targetRow,
        targetCol
    );

}


// ============================================================
// MOVIMENTO COM DUAS DIREÇÕES — LEGADO / DESATIVADO NA REGRA ATUAL
// ============================================================

function twoDirectionMoveValid(
    piece,
    targetRow,
    targetCol
) {

    for(
        let firstDistance=1;
        firstDistance<diceValue;
        firstDistance++
    ) {


        for(
            const direction
            of getDirectionsForPiece(piece)
        ) {

            const dr =
                direction[0];

            const dc =
                direction[1];


            const middleRow =
                piece.row +
                dr*firstDistance;


            const middleCol =
                piece.col +
                dc*firstDistance;


            if(
                !inside(
                    middleRow,
                    middleCol
                )
            ) {

                continue;

            }

            // Se o primeiro trecho for diagonal, aplica a regra especial:
            // ATK livre; GO/ZG apenas na própria metade defensiva.
            if(
                dr !== 0 &&
                dc !== 0 &&
                !diagonalSegmentAllowed(
                    piece,
                    piece.row,
                    piece.col,
                    middleRow,
                    middleCol
                )
            ) {
                continue;
            }

            // O GO também precisa permanecer dentro da sua zona
            // durante a mudança de direção, não apenas no destino final.
            if(
                !goalkeeperPositionAllowed(
                    piece,
                    middleRow,
                    middleCol
                )
            ) {

                continue;

            }


            // Verificar primeiro trecho

            let blocked=false;


            for(
                let i=1;
                i<=firstDistance;
                i++
            ) {

                const row =
                    piece.row +
                    dr*i;


                const col =
                    piece.col +
                    dc*i;


                if(
                    getPieceAt(
                        row,
                        col,
                        piece
                    ) ||
                    isBlockedCell(row,col)
                ) {

                    blocked=true;

                    break;

                }

            }


            if(blocked)
                continue;


            // Segundo trecho

            const secondDr =
                targetRow -
                middleRow;


            const secondDc =
                targetCol -
                middleCol;


            const secondDistance =
                Math.max(
                    Math.abs(secondDr),
                    Math.abs(secondDc)
                );


            if(
                firstDistance +
                secondDistance !==
                diceValue
            ) {

                continue;

            }


            // O segundo trecho também segue a regra especial de diagonal.
            if(
                secondDr !== 0 &&
                secondDc !== 0
            ) {

                if(
                    !diagonalSegmentAllowed(
                        piece,
                        middleRow,
                        middleCol,
                        targetRow,
                        targetCol
                    )
                ) {
                    continue;
                }

            }


            if(
                !validPosition(
                    targetRow,
                    targetCol,
                    piece.player
                )
            ) {

                continue;

            }


            if(
                inside(
                    targetRow,
                    targetCol
                ) &&
                (
                    getPieceAt(
                        targetRow,
                        targetCol,
                        piece
                    ) ||
                    isBlockedCell(targetRow,targetCol)
                )
            ) {

                continue;

            }


            // Verificar segundo caminho

            let secondBlocked=false;


            const stepRow =
                sign(secondDr);


            const stepCol =
                sign(secondDc);


            // REGRA: se houver mudança de direção, a segunda direção
            // nunca pode ser exatamente oposta à primeira.
            // Ex.: avançar para a direita e depois voltar para a esquerda.
            if(
                stepRow === -dr &&
                stepCol === -dc
            ) {

                continue;

            }


            for(
                let i=1;
                i<=secondDistance;
                i++
            ) {

                const row =
                    middleRow +
                    stepRow*i;


                const col =
                    middleCol +
                    stepCol*i;


                // Não pode atravessar peças

                if(
                    inside(row,col) &&
                    (
                        getPieceAt(
                            row,
                            col,
                            piece
                        ) ||
                        isBlockedCell(row,col)
                    )
                ) {

                    secondBlocked=true;

                    break;

                }

            }


            if(
                !secondBlocked
            ) {

                return true;

            }

        }

    }


    return false;

}


// ============================================================
// MOVIMENTO VÁLIDO
// ============================================================

function isValidMove(
    piece,
    targetRow,
    targetCol
) {

    if(
        diceValue === null
    ) {

        return false;

    }


    if(
        targetRow === piece.row &&
        targetCol === piece.col
    ) {

        return false;

    }


    // Regra especial do GO: ele pode se deslocar livremente para os lados,
    // mas nunca pode ultrapassar a 3ª linha a partir do próprio gol.
    if(
        !goalkeeperPositionAllowed(
            piece,
            targetRow,
            targetCol
        )
    ) {

        return false;

    }


    // Nova regra: toda jogada acontece em UMA ÚNICA DIREÇÃO.
    // Não há curva, drible ou mudança de direção no meio do movimento.
    return straightMoveValid(
        piece,
        targetRow,
        targetCol
    );

}


// ============================================================
// POSSÍVEIS MOVIMENTOS
// ============================================================

function getPossibleMoves(piece) {

    const moves = [];

    if(diceValue === null || !piece) {
        return moves;
    }

    const directions = getDirectionsForPiece(piece);
    const exactDistance = pieceInFinalAttackZone(piece);
    const minDistance = exactDistance ? diceValue : 1;
    const maxDistance = diceValue;

    if(maxDistance < 1) return moves;

    const seen = new Set();

    for(const direction of directions) {
        const dr = direction[0];
        const dc = direction[1];

        for(let distance = minDistance; distance <= maxDistance; distance++) {
            const row = piece.row + dr * distance;
            const col = piece.col + dc * distance;

            if(col < 0 || col >= COLS) break;
            if(row < -1 || row > ROWS) break;

            const key = `${row}:${col}`;
            if(seen.has(key)) continue;

            // Mantém a regra oficial em um único ponto:
            // esta função apenas reduz drasticamente a quantidade
            // de destinos que precisam ser testados.
            if(isValidMove(piece, row, col)) {
                seen.add(key);
                moves.push({ row, col });
            }
        }
    }

    return moves;
}


// ============================================================
// MOVIMENTO FIXO DE CARTA (CARTA 3)
// ============================================================

function getPossibleMovesForDistance(piece, distance) {
    const previousDiceValue = diceValue;
    diceValue = distance;

    try {
        return getPossibleMoves(piece);
    } finally {
        diceValue = previousDiceValue;
    }
}

function isValidMoveForDistance(piece, targetRow, targetCol, distance) {
    const previousDiceValue = diceValue;
    diceValue = distance;

    try {
        return isValidMove(piece, targetRow, targetCol);
    } finally {
        diceValue = previousDiceValue;
    }
}



// ============================================================
// ANIMAÇÃO DE MOVIMENTO DAS PEÇAS
// ============================================================

function getVisualCenterForPosition(row, col) {
    let target = null;

    if(inside(row,col)) {
        target = boardCellsCache[row * COLS + col] || null;
    } else if(row === -1) {
        target = document.querySelector(`#redGoal .goal-cell[data-col="${col}"]`);
    } else if(row === ROWS) {
        target = document.querySelector(`#blueGoal .goal-cell[data-col="${col}"]`);
    }

    if(!target) return null;

    const rect = target.getBoundingClientRect();
    return {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
    };
}

function getPieceElement(piece) {
    if(!inside(piece.row, piece.col)) return null;
    const sourceCell = boardCellsCache[piece.row * COLS + piece.col];
    return sourceCell ? sourceCell.querySelector(".piece") : null;
}

// Recupera um dos caminhos que a própria regra do jogo considera válido.
// Assim, movimentos com mudança de direção também fazem a curva visualmente.
function getAnimationPathForDistance(piece, targetRow, targetCol, distance) {
    const previousDiceValue = diceValue;
    diceValue = distance;

    try {
        if(!goalkeeperPositionAllowed(piece, targetRow, targetCol)) return [];

        if(straightMoveValid(piece, targetRow, targetCol)) {
            const dr = targetRow - piece.row;
            const dc = targetCol - piece.col;
            const steps = Math.max(Math.abs(dr), Math.abs(dc));
            const stepRow = sign(dr);
            const stepCol = sign(dc);
            const path = [];

            for(let i = 1; i <= steps; i++) {
                path.push({
                    row: piece.row + stepRow * i,
                    col: piece.col + stepCol * i
                });
            }

            return path;
        }

        for(let firstDistance = 1; firstDistance < distance; firstDistance++) {
            for(const direction of getDirectionsForPiece(piece)) {
                const dr = direction[0];
                const dc = direction[1];
                const middleRow = piece.row + dr * firstDistance;
                const middleCol = piece.col + dc * firstDistance;

                if(!inside(middleRow, middleCol)) continue;
                if(!goalkeeperPositionAllowed(piece, middleRow, middleCol)) continue;

                if(
                    dr !== 0 &&
                    dc !== 0 &&
                    !diagonalSegmentAllowed(
                        piece,
                        piece.row,
                        piece.col,
                        middleRow,
                        middleCol
                    )
                ) continue;

                const firstPath = [];
                let blocked = false;

                for(let i = 1; i <= firstDistance; i++) {
                    const row = piece.row + dr * i;
                    const col = piece.col + dc * i;

                    if(getPieceAt(row, col, piece) || isBlockedCell(row, col)) {
                        blocked = true;
                        break;
                    }

                    firstPath.push({ row, col });
                }

                if(blocked) continue;

                const secondDr = targetRow - middleRow;
                const secondDc = targetCol - middleCol;
                const secondDistance = Math.max(Math.abs(secondDr), Math.abs(secondDc));

                if(firstDistance + secondDistance !== distance) continue;

                // A animação segue exatamente a mesma regra de diagonal.
                if(
                    secondDr !== 0 &&
                    secondDc !== 0
                ) {
                    if(
                        !diagonalSegmentAllowed(
                            piece,
                            middleRow,
                            middleCol,
                            targetRow,
                            targetCol
                        )
                    ) continue;
                }

                if(!validPosition(targetRow, targetCol, piece.player)) continue;

                if(
                    inside(targetRow, targetCol) &&
                    (getPieceAt(targetRow, targetCol, piece) || isBlockedCell(targetRow, targetCol))
                ) continue;

                const secondPath = [];
                const stepRow = sign(secondDr);
                const stepCol = sign(secondDc);

                // A animação deve usar exatamente a mesma regra:
                // o segundo trecho não pode inverter 180° em relação ao primeiro.
                if(
                    stepRow === -dr &&
                    stepCol === -dc
                ) continue;

                let secondBlocked = false;

                for(let i = 1; i <= secondDistance; i++) {
                    const row = middleRow + stepRow * i;
                    const col = middleCol + stepCol * i;

                    if(
                        inside(row,col) &&
                        (getPieceAt(row, col, piece) || isBlockedCell(row,col))
                    ) {
                        secondBlocked = true;
                        break;
                    }

                    secondPath.push({ row, col });
                }

                if(!secondBlocked) {
                    return [...firstPath, ...secondPath];
                }
            }
        }

        return [];
    } finally {
        diceValue = previousDiceValue;
    }
}

// ============================================================
// EFEITOS VISUAIS TEMPORÁRIOS DAS CARTAS
// ============================================================

function getCardSpecialFxLayer() {
    let layer = document.getElementById("cardSpecialFxLayer");

    if(!layer) {
        layer = document.createElement("div");
        layer.id = "cardSpecialFxLayer";
        layer.className = "card-special-fx-layer";
        document.body.appendChild(layer);
    }

    return layer;
}

function removeFxElementLater(element, duration = 3000) {
    if(!element) return;
    setTimeout(() => element.remove(), duration + 120);
}

function createTacticalArrow(start, end, className) {
    if(!start || !end) return null;

    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const distance = Math.hypot(dx, dy);

    if(distance < 3) return null;

    const angle = Math.atan2(dy, dx) * 180 / Math.PI;
    const arrow = document.createElement("div");
    arrow.className = className;
    arrow.style.left = `${start.x}px`;
    arrow.style.top = `${start.y}px`;
    arrow.style.width = `${distance}px`;
    arrow.style.transform = `rotate(${angle}deg)`;

    getCardSpecialFxLayer().appendChild(arrow);
    removeFxElementLater(arrow, 3000);

    return { element: arrow, dx, dy, distance };
}

function showCard3Trail(piece, path) {
    if(!piece) return;

    const points = [
        { row: piece.row, col: piece.col },
        ...(Array.isArray(path) ? path : [])
    ];

    const centers = points
        .map(point => getVisualCenterForPosition(point.row, point.col))
        .filter(Boolean);

    if(centers.length < 2) return;

    const layer = getCardSpecialFxLayer();
    const samples = [];

    for(let index = 0; index < centers.length - 1; index++) {
        const a = centers[index];
        const b = centers[index + 1];

        // Três "fantasmas" por trecho para formar um rastro contínuo.
        for(const t of [0, .34, .67]) {
            samples.push({
                x: a.x + (b.x - a.x) * t,
                y: a.y + (b.y - a.y) * t
            });
        }
    }

    samples.push(centers[centers.length - 1]);

    samples.forEach((point, index) => {
        const ghost = document.createElement("div");
        ghost.className = `card3-trail-ghost ${piece.player === 0 ? "blue" : "red"}`;
        ghost.textContent = piece.role;
        ghost.style.left = `${point.x}px`;
        ghost.style.top = `${point.y}px`;
        ghost.style.animationDelay = `${Math.min(index * 35, 220)}ms`;
        layer.appendChild(ghost);
        removeFxElementLater(ghost, 3250);
    });
}

function showCard4PassArrow(piece, targetRow, targetCol) {
    if(!piece) return;

    const start = getVisualCenterForPosition(piece.row, piece.col);
    const end = getVisualCenterForPosition(targetRow, targetCol);

    createTacticalArrow(start, end, "card4-pass-arrow");
}

function showCard9RetreatFx(piece, targetRow, targetCol) {
    if(!piece) return;

    const start = getVisualCenterForPosition(piece.row, piece.col);
    const end = getVisualCenterForPosition(targetRow, targetCol);

    const arrowData = createTacticalArrow(start, end, "card9-retreat-arrow");
    if(!arrowData || !start || !end) return;

    const { dx, dy, distance } = arrowData;
    const ux = dx / distance;
    const uy = dy / distance;

    // O emoji começa logo atrás da peça, simulando o empurrão.
    const pusher = document.createElement("div");
    pusher.className = "card9-pusher";
    pusher.textContent = "🏃";
    pusher.style.left = `${start.x - ux * 28}px`;
    pusher.style.top = `${start.y - uy * 28}px`;

    getCardSpecialFxLayer().appendChild(pusher);

    if(typeof pusher.animate === "function") {
        const flip = dx < 0 ? -1 : 1;

        pusher.animate(
            [
                {
                    transform: `translate3d(0,0,0) scaleX(${flip}) scale(.86)`,
                    opacity: 0
                },
                {
                    transform: `translate3d(${dx * .12}px,${dy * .12}px,0) scaleX(${flip}) scale(1)`,
                    opacity: 1,
                    offset: .12
                },
                {
                    transform: `translate3d(${dx * .82}px,${dy * .82}px,0) scaleX(${flip}) scale(1)`,
                    opacity: 1,
                    offset: .72
                },
                {
                    transform: `translate3d(${dx * .92}px,${dy * .92}px,0) scaleX(${flip}) scale(.9)`,
                    opacity: 0
                }
            ],
            {
                duration: 1250,
                easing: "cubic-bezier(.24,.68,.25,1)",
                fill: "forwards"
            }
        );
    }

    setTimeout(() => pusher.remove(), 1400);
}

function card7FireKey(player, pieceId) {
    return `${player}:${String(pieceId)}`;
}

function clearCard7LingeringFire(shouldRender = true) {
    if(card7LingeringFireTimer) {
        clearTimeout(card7LingeringFireTimer);
        card7LingeringFireTimer = null;
    }

    card7LingeringFireIds.clear();

    if(shouldRender) {
        render();
    }
}

function keepCard7FireForThreeSeconds(pieceIds, owner) {
    if(card7LingeringFireTimer) {
        clearTimeout(card7LingeringFireTimer);
        card7LingeringFireTimer = null;
    }

    // IMPORTANTE: o ID numérico se repete entre Real Madrid e Barcelona.
    // Por isso o efeito persistente é identificado por TIME + ID.
    card7LingeringFireIds = new Set(
        (pieceIds || []).map(id => card7FireKey(owner, id))
    );

    render();

    card7LingeringFireTimer = setTimeout(() => {
        card7LingeringFireIds.clear();
        card7LingeringFireTimer = null;
        render();
    }, 3000);
}

// ============================================================
// ÁUDIO DE DESLIZAMENTO DAS PEÇAS
// Arquivo esperado: audios/audio-desliza-peca.mp3
// ============================================================

const pieceSlideAudio = new Audio("audios/audio-desliza-peca.mp3");
pieceSlideAudio.preload = "auto";

function playPieceSlideAudio() {
    try {
        pieceSlideAudio.pause();
        pieceSlideAudio.currentTime = 0;
        const playPromise = pieceSlideAudio.play();
        if(playPromise && typeof playPromise.catch === "function") {
            playPromise.catch(() => {});
        }
    } catch(error) {
        // Ignora falhas silenciosamente (ex.: restrição temporária do navegador).
    }
}

function animatePieceAlongPath(piece, path, onComplete) {
    if(moveAnimationActive) return false;

    const element = getPieceElement(piece);

    if(!element || !Array.isArray(path) || path.length === 0 || typeof element.animate !== "function") {
        onComplete();
        return true;
    }

    const sourceRect = element.getBoundingClientRect();
    const sourceCenter = {
        x: sourceRect.left + sourceRect.width / 2,
        y: sourceRect.top + sourceRect.height / 2
    };

    const centers = path.map(point => getVisualCenterForPosition(point.row, point.col));

    if(centers.some(center => !center)) {
        onComplete();
        return true;
    }

    moveAnimationActive = true;
    document.querySelector(".game-container")?.classList.add("move-in-progress");
    document.querySelectorAll(".cell.possible, .goal-cell.possible").forEach(target => {
        target.classList.remove("possible");
    });

    element.classList.add("moving");
    playPieceSlideAudio();

    const scale = element.classList.contains("selected") ? " scale(1.08)" : "";
    const keyframes = [
        { transform: `translate3d(0px, 0px, 0)${scale}`, offset: 0 }
    ];

    centers.forEach((center, index) => {
        keyframes.push({
            transform: `translate3d(${center.x - sourceCenter.x}px, ${center.y - sourceCenter.y}px, 0)${scale}`,
            offset: (index + 1) / centers.length
        });
    });

    const duration = Math.min(720, Math.max(240, path.length * 95 + 90));

    const animation = element.animate(keyframes, {
        duration,
        easing: "cubic-bezier(.42, 0, .20, 1)",
        fill: "forwards"
    });

    activeMoveAnimation = animation;

    animation.onfinish = () => {
        activeMoveAnimation = null;
        moveAnimationActive = false;
        document.querySelector(".game-container")?.classList.remove("move-in-progress");
        onComplete();
    };

    animation.oncancel = () => {
        activeMoveAnimation = null;
        moveAnimationActive = false;
        document.querySelector(".game-container")?.classList.remove("move-in-progress");
    };

    return true;
}

// ============================================================
// CRIAR TABULEIRO
// ============================================================

function createBoard() {

    const board =
        document.getElementById(
            "board"
        );


    board.innerHTML="";
    boardCellsCache = [];


    for(
        let row=0;
        row<ROWS;
        row++
    ) {

        for(
            let col=0;
            col<COLS;
            col++
        ) {

            const cell =
                document.createElement(
                    "div"
                );


            cell.classList.add(
                "cell"
            );

            cell.classList.add(
                (row + col) % 2 === 0
                    ? "check-dark"
                    : "check-light"
            );


            // ORIENTAÇÃO HORIZONTAL:
            // a coordenada lógica ROW vira coluna visual
            // e a coordenada lógica COL vira linha visual.
            // Assim preservamos toda a lógica 11x18 do jogo.
            cell.style.gridColumn = String(row + 1);
            cell.style.gridRow = String(col + 1);


            if(
                row===0
            ) {

                cell.classList.add(
                    "red-start"
                );

            }


            if(
                row===ROWS-1
            ) {

                cell.classList.add(
                    "blue-start"
                );

            }


            cell.addEventListener(
                "click",
                () => {

                    handleCellClick(
                        row,
                        col
                    );

                }
            );


            board.appendChild(
                cell
            );

            boardCellsCache.push(cell);

        }

    }

    redGoalCellsCache = Array.from(document.querySelectorAll("#redGoal .goal-cell"));
    blueGoalCellsCache = Array.from(document.querySelectorAll("#blueGoal .goal-cell"));

}


// ============================================================
// ATIVAR CÉLULAS DOS GOLS
// ============================================================

function createGoalHandlers() {

    document
        .querySelectorAll("#redGoal .goal-cell")
        .forEach(cell => {

            const col = Number(cell.dataset.col);

            cell.addEventListener("click", () => {
                handleGoalClick(-1, col, 0);
            });

        });

    document
        .querySelectorAll("#blueGoal .goal-cell")
        .forEach(cell => {

            const col = Number(cell.dataset.col);

            cell.addEventListener("click", () => {
                handleGoalClick(ROWS, col, 1);
            });

        });
}


// ============================================================
// CLICAR EM UMA CÉLULA DO GOL
// ============================================================

function handleGoalClick(row, col, attackingPlayer) {

    if(formationSetupActive) {
        setMessage("⚙️ Durante a formação, escolha somente casas dentro do campo.", 0);
        return;
    }

    if(moveAnimationActive) return;

    if(cardTargetMode && cardTargetMode.cardId === 3) {
        if(cardTargetMode.phase === "movePiece") {
            movePieceWithCard3(row, col);
        } else {
            setMessage('⚡ ARRANCADA FULMINANTE! Primeiro escolha uma peça sua.');
        }
        return;
    }

    if(cardTargetMode && cardTargetMode.cardId === 4) {
        if(cardTargetMode.phase === "movePiece") {
            movePieceWithCard4(row, col);
        } else {
            setMessage('🤝 PASSE EM PROFUNDIDADE! Primeiro escolha uma peça sua.');
        }
        return;
    }

    if(cardTargetMode && cardTargetMode.cardId === 7) {
        if(cardTargetMode.phase === "movePiece") {
            movePieceWithCard7(row, col);
        } else {
            setMessage('🎯 JOGADA ENSAIADA! Primeiro escolha uma peça sua.');
        }
        return;
    }

    if(cardTargetMode && cardTargetMode.cardId === 8) {
        setMessage('🚧 O BLOCK deve ser colocado dentro do campo, em uma casa laranja vazia da sua metade defensiva.');
        return;
    }

    if(cardTargetMode && cardTargetMode.cardId === 9) {
        setMessage('↩️ RECUO TÁTICO ativo: clique diretamente em uma peça adversária.');
        return;
    }

    if(!selectedPiece) {
        setMessage("🎲 Jogue o dado e escolha uma peça.");
        return;
    }

    if(selectedPiece.player !== attackingPlayer) return;

    if(!isValidMove(selectedPiece, row, col)) {
        setMessage("Movimento inválido para este resultado.");
        return;
    }

    const piece = selectedPiece;
    const scoringPlayer = currentPlayer;
    const path = getAnimationPathForDistance(piece, row, col, diceValue);

    animatePieceAlongPath(piece, path.length ? path : [{ row, col }], () => {
        piece.row = row;
        piece.col = col;
        registerGoal(scoringPlayer, piece);
    });
}


// ============================================================
// SISTEMA DE CARTAS + BANCO
// ============================================================



function cardName(cardId) {
    if(cardId === 1) return 'TÁ NA RUA!';
    if(cardId === 2) return 'SANGUE NOVO!';
    if(cardId === 3) return 'ARRANCADA FULMINANTE!';
    if(cardId === 4) return 'PASSE EM PROFUNDIDADE!';
    if(cardId === 7) return 'JOGADA ENSAIADA!';
    if(cardId === 8) return 'BLOQUEIO';
    if(cardId === 9) return 'RECUO TÁTICO';
    return 'CATIMBA!';
}

function drawBonusCard(player) {

    if(hands[player].length >= MAX_CARDS) {
        return null;
    }

    const roll = Math.random();
    let cardId;

    let cumulative = CARD_1_CHANCE;

    if(roll < cumulative) {
        cardId = 1;
    } else if(roll < (cumulative += CARD_2_CHANCE)) {
        cardId = 2;
    } else if(roll < (cumulative += CARD_3_CHANCE)) {
        cardId = 3;
    } else if(roll < (cumulative += CARD_4_CHANCE)) {
        cardId = 4;
    } else if(roll < (cumulative += CARD_7_CHANCE)) {
        cardId = 7;
    } else if(roll < (cumulative += CARD_8_CHANCE)) {
        cardId = 8;
    } else if(roll < (cumulative += CARD_9_CHANCE)) {
        cardId = 9;
    } else {
        cardId = 10;
    }

    hands[player].push(cardId);
    renderCards();
    return cardId;

}

let lastCardsRenderSignature = "";

function getCardsRenderSignature() {
    const mode = cardTargetMode
        ? [
            cardTargetMode.cardId,
            cardTargetMode.player,
            cardTargetMode.slotIndex,
            cardTargetMode.phase
          ].join(":")
        : "none";

    return [
        hands[0].join(","),
        hands[1].join(","),
        currentPlayer,
        winner === null ? 0 : 1,
        goalPause ? 1 : 0,
        mode
    ].join("|");
}

function renderCards() {

    const signature = getCardsRenderSignature();

    if(signature === lastCardsRenderSignature) {
        renderBench();
        return;
    }

    lastCardsRenderSignature = signature;

    const configs = [
        { player: 1, slotsId: "redCardSlots", handId: "redHand" },
        { player: 0, slotsId: "blueCardSlots", handId: "blueHand" }
    ];

    configs.forEach(config => {

        const slots = document.getElementById(config.slotsId);
        const handElement = document.getElementById(config.handId);
        if(!slots || !handElement) return;

        handElement.classList.toggle(
            "active",
            config.player === currentPlayer && winner === null && !goalPause
        );

        slots.innerHTML = "";

        for(let slotIndex = 0; slotIndex < MAX_CARDS; slotIndex++) {

            const slot = document.createElement("div");
            slot.className = "card-slot";
            const cardId = hands[config.player][slotIndex];

            if(cardId === undefined) {
                slot.classList.add("empty");
                slots.appendChild(slot);
                continue;
            }

            const card = document.createElement("button");
            card.type = "button";
            card.className = "tactical-card";

            if(cardId === 1) {
                card.title = 'Carta 1 — "TÁ NA RUA!": expulsar 1 jogador adversário, exceto o Goleiro (GO).';
                card.innerHTML = `
                    <span class="card-number">CARTA 1 • 10%</span>
                    <span class="card-name">🟥 TÁ NA RUA!</span>
                    <span class="card-effect">EXPULSA 1 • EXCETO GO</span>
                `;
            } else if(cardId === 2) {
                card.classList.add("card-2");
                card.title = 'Carta 2 — "SANGUE NOVO!": adicionar +1 reserva ou reintegrar 1 expulso em uma casa vazia até a 3ª linha da sua defesa.';
                card.innerHTML = `
                    <span class="card-number">CARTA 2 • 20%</span>
                    <span class="card-name">🎽 SANGUE NOVO!</span>
                    <span class="card-effect">+1 RESERVA • ATÉ 3ª LINHA</span>
                `;
            } else if(cardId === 3) {
                card.classList.add("card-3");
                card.title = 'Carta 3 — "ARRANCADA FULMINANTE!": mover qualquer peça sua +3 casas em um movimento bônus.';
                card.innerHTML = `
                    <span class="card-number">CARTA 3 • 10%</span>
                    <span class="card-name">⚡ ARRANCADA!</span>
                    <span class="card-effect">MOVIMENTO BÔNUS • +3</span>
                `;
            } else if(cardId === 4) {
                card.classList.add("card-4");
                card.title = 'Carta 4 — "PASSE EM PROFUNDIDADE!": mover qualquer peça sua +2 casas em um movimento bônus.';
                card.innerHTML = `
                    <span class="card-number">CARTA 4 • 25%</span>
                    <span class="card-name">🤝 PASSE!</span>
                    <span class="card-effect">MOVIMENTO BÔNUS • +2</span>
                `;
            } else if(cardId === 7) {
                card.classList.add("card-7");
                card.title = 'Carta 7 — "JOGADA ENSAIADA!": mover 3 jogadores seus, um por vez, +3 casas cada, na mesma jogada.';
                card.innerHTML = `
                    <span class="card-number">CARTA 7 • 9%</span>
                    <span class="card-name">🎯 ENSAIADA!</span>
                    <span class="card-effect">3 JOGADORES • +3 CADA</span>
                `;
            } else if(cardId === 8) {
                card.classList.add("card-8");
                card.title = 'Carta 8 — "BLOQUEIO": coloque um BLOCK em uma casa vazia da sua metade defensiva, exceto nas 3 casas imediatamente à frente do seu gol. Ninguém pode ocupar ou atravessar a casa até o próximo gol.';
                card.innerHTML = `
                    <span class="card-number">CARTA 8 • 10%</span>
                    <span class="card-name">🚧 BLOQUEIO</span>
                    <span class="card-effect">BLOCK • ATÉ O PRÓXIMO GOL</span>
                `;
            } else if(cardId === 9) {
                card.classList.add("card-9");
                card.title = 'Carta 9 — "RECUO TÁTICO": escolha 1 adversário em campo; ele recua até 5 casas em linha reta na direção da própria defesa.';
                card.innerHTML = `
                    <span class="card-number">CARTA 9 • 8%</span>
                    <span class="card-name">↩️ RECUO TÁTICO</span>
                    <span class="card-effect">ADVERSÁRIO • RECUA ATÉ 5</span>
                `;
            } else {
                card.classList.add("card-10");
                card.title = 'Carta 10 — "CATIMBA!": no próximo turno do adversário, o dado vale 1→0, 2/3→1, 4/5→2 e 6→3; se sair 6, não recebe Carta Bônus.';
                card.innerHTML = `
                    <span class="card-number">CARTA 10 • 8%</span>
                    <span class="card-name">🐢 CATIMBA!</span>
                    <span class="card-effect">PRÓXIMO TURNO • DADO REDUZIDO</span>
                `;
            }

            if(
                cardTargetMode &&
                cardTargetMode.player === config.player &&
                cardTargetMode.slotIndex === slotIndex
            ) {
                card.classList.add("active-card");
            }

            card.addEventListener("click", event => {
                event.stopPropagation();
                activateCard(config.player, slotIndex);
            });

            slot.appendChild(card);
            slots.appendChild(slot);
        }
    });

    renderBench();
}

function getBenchCarouselItems(player, type) {
    if(type === "reserves") {
        return RESERVE_ROLES
            .filter(role => reserveAvailable[player].has(role))
            .map(role => ({
                key: `reserve:${role}`,
                role,
                image: getPlayerImagePath(player, role, true),
                source: "reserve",
                pieceId: null,
                isReserve: true
            }));
    }

    return [...expelledPlayers[player].entries()].map(([pieceId, record]) => ({
        key: `expelled:${String(pieceId)}`,
        role: record.role,
        image: getPlayerImagePath(player, record.role, !!record.reserve),
        source: "expelled",
        pieceId,
        isReserve: !!record.reserve
    }));
}

function getBenchCarouselSelectedKey(player, type) {
    if(
        !cardTargetMode ||
        cardTargetMode.cardId !== 2 ||
        cardTargetMode.player !== player ||
        cardTargetMode.phase !== "placeReserve"
    ) return null;

    if(type === "reserves" && cardTargetMode.selectedSource === "reserve") {
        return `reserve:${cardTargetMode.selectedRole}`;
    }

    if(type === "expelled" && cardTargetMode.selectedSource === "expelled") {
        return `expelled:${String(cardTargetMode.selectedPieceId)}`;
    }

    return null;
}

function isBenchCarouselLocked(player, type) {
    return !!getBenchCarouselSelectedKey(player, type);
}

function moveBenchCarousel(containerId, direction = 1) {
    const config = {
        redReserves:  { player:1, type:"reserves" },
        redExpelled:  { player:1, type:"expelled" },
        blueReserves: { player:0, type:"reserves" },
        blueExpelled: { player:0, type:"expelled" }
    }[containerId];

    if(!config) return;

    const items = getBenchCarouselItems(config.player, config.type);
    if(items.length <= 1) return;

    const current = benchCarouselIndexes[containerId] || 0;
    benchCarouselIndexes[containerId] =
        (current + direction + items.length) % items.length;

    renderBench();
}

function advanceBenchCarousels() {
    const configs = [
        { id:"redReserves",  player:1, type:"reserves" },
        { id:"redExpelled",  player:1, type:"expelled" },
        { id:"blueReserves", player:0, type:"reserves" },
        { id:"blueExpelled", player:0, type:"expelled" }
    ];

    configs.forEach(config => {
        if(isBenchCarouselLocked(config.player, config.type)) return;

        const items = getBenchCarouselItems(config.player, config.type);
        if(items.length <= 1) {
            benchCarouselIndexes[config.id] = 0;
            return;
        }

        benchCarouselIndexes[config.id] =
            ((benchCarouselIndexes[config.id] || 0) + 1) % items.length;
    });

    renderBench();
}

function startBenchCarousels() {
    if(benchCarouselTimer) return;

    benchCarouselTimer = setInterval(
        advanceBenchCarousels,
        BENCH_CAROUSEL_INTERVAL
    );
}

function renderBenchCarousel(containerId, player, type) {
    const container = document.getElementById(containerId);
    if(!container) return;

    const items = getBenchCarouselItems(player, type);

    if(items.length === 0) {
        benchCarouselIndexes[containerId] = 0;

        if(benchCarouselRenderSignatures[containerId] === "empty") return;
        benchCarouselRenderSignatures[containerId] = "empty";

        container.innerHTML = "";

        const empty = document.createElement("span");
        empty.className = "bench-carousel-empty";
        empty.textContent = type === "reserves" ? "SEM RESERVAS" : "NENHUM";
        container.appendChild(empty);
        return;
    }

    const selectedKey = getBenchCarouselSelectedKey(player, type);

    if(selectedKey) {
        const selectedIndex = items.findIndex(item => item.key === selectedKey);
        if(selectedIndex >= 0) {
            benchCarouselIndexes[containerId] = selectedIndex;
        }
    }

    let index = benchCarouselIndexes[containerId] || 0;
    index = ((index % items.length) + items.length) % items.length;
    benchCarouselIndexes[containerId] = index;

    const item = items[index];

    const card2Choosing =
        cardTargetMode &&
        cardTargetMode.cardId === 2 &&
        cardTargetMode.player === player &&
        cardTargetMode.phase === "chooseReserve";

    const isSelected = selectedKey === item.key;
    const interactive = card2Choosing || isSelected;

    const signature = [
        item.key,
        index,
        items.length,
        card2Choosing ? 1 : 0,
        isSelected ? 1 : 0,
        getTeamKeyForPlayer(player)
    ].join("|");

    if(benchCarouselRenderSignatures[containerId] === signature) return;
    benchCarouselRenderSignatures[containerId] = signature;

    container.innerHTML = "";

    const carousel = document.createElement("div");
    carousel.className = "bench-carousel";

    if(items.length > 1 && !isSelected) {
        const prev = document.createElement("button");
        prev.type = "button";
        prev.className = "bench-carousel-arrow prev";
        prev.setAttribute("aria-label", "Jogador anterior");
        prev.textContent = "‹";
        prev.addEventListener("click", event => {
            event.stopPropagation();
            moveBenchCarousel(containerId, -1);
        });

        const next = document.createElement("button");
        next.type = "button";
        next.className = "bench-carousel-arrow next";
        next.setAttribute("aria-label", "Próximo jogador");
        next.textContent = "›";
        next.addEventListener("click", event => {
            event.stopPropagation();
            moveBenchCarousel(containerId, 1);
        });

        carousel.appendChild(prev);
        carousel.appendChild(next);
    }

    const itemEl = document.createElement(interactive ? "button" : "div");
    if(itemEl.tagName === "BUTTON") itemEl.type = "button";

    itemEl.className = "bench-carousel-item";
    if(type === "expelled") itemEl.classList.add("expelled-player");
    if(card2Choosing) itemEl.classList.add("reserve-selectable");
    if(isSelected) itemEl.classList.add("reserve-selected");

    itemEl.title =
        type === "reserves"
            ? `${item.role} reserva — jogador ${index + 1} de ${items.length}`
            : `${item.role} expulso — jogador ${index + 1} de ${items.length}`;

    const img = document.createElement("img");
    img.className = "bench-carousel-image";
    img.src = item.image;
    img.alt =
        type === "reserves"
            ? `${item.role} reserva do ${playerName(player)}`
            : `${item.role} expulso do ${playerName(player)}`;
    img.draggable = false;
    img.decoding = "async";

    img.addEventListener("error", () => {
        img.style.display = "none";
        itemEl.textContent = item.role;
        itemEl.style.color = "#fff";
        itemEl.style.fontWeight = "1000";
        itemEl.style.fontSize = "9px";
    });

    itemEl.appendChild(img);

    const counter = document.createElement("span");
    counter.className = "bench-carousel-counter";
    counter.textContent = `${index + 1}/${items.length}`;
    itemEl.appendChild(counter);

    if(card2Choosing) {
        itemEl.addEventListener("click", event => {
            event.stopPropagation();

            if(item.source === "reserve") {
                chooseReserveRole(player, item.role);
            } else {
                chooseExpelledPlayer(player, item.pieceId);
            }
        });
    }

    carousel.appendChild(itemEl);
    container.appendChild(carousel);
}

function renderBench() {
    renderBenchCarousel("redReserves",  1, "reserves");
    renderBenchCarousel("redExpelled",  1, "expelled");
    renderBenchCarousel("blueReserves", 0, "reserves");
    renderBenchCarousel("blueExpelled", 0, "expelled");
}

function getActiveTeamPieceCount(player) {
    return pieces.filter(piece => piece.player === player).length;
}

function teamCanReceiveReserve(player) {
    return getActiveTeamPieceCount(player) < MAX_TEAM_PIECES;
}

function activateCard(player, slotIndex, cpuInitiated = false) {

    if(periodBreakActive) return;
    if(moveAnimationActive) return;
    if(isCpuMode() && player === CPU_PLAYER && !cpuInitiated) {
        setMessage("🤖 Aguarde: a CPU decide quando utilizar as próprias cartas.");
        return;
    }
    if(winner !== null || goalPause) return;

    if(player !== currentPlayer) {
        setMessage(`🃏 É a vez do ${playerName(currentPlayer)}. Você não pode usar a carta do adversário.`);
        return;
    }

    const cardId = hands[player][slotIndex];
    if(cardId === undefined) return;

    // Clicar novamente na mesma carta cancela a ação.
    if(
        cardTargetMode &&
        cardTargetMode.player === player &&
        cardTargetMode.slotIndex === slotIndex
    ) {
        cancelCardMode();
        return;
    }

    selectedPiece = null;

    if(cardId === 1) {
        cardTargetMode = { cardId:1, player, slotIndex, phase:"target" };
        setMessage('🟥 “TÁ NA RUA!” — clique em qualquer jogador adversário para expulsá-lo. O GO é protegido. Clique novamente na carta para cancelar.');
    } else if(cardId === 2) {
        const hasFreshReserve = reserveAvailable[player].size > 0;
        const hasExpelledPlayer = expelledPlayers[player].size > 0;

        if(!hasFreshReserve && !hasExpelledPlayer) {
            setMessage('🎽 “SANGUE NOVO!” — não há reservas nem expulsos disponíveis para entrar. A carta permanece no slot.');
            return;
        }
        if(!teamCanReceiveReserve(player)) {
            setMessage(`🎽 “SANGUE NOVO!” — o ${playerName(player)} já está com o limite máximo de ${MAX_TEAM_PIECES} jogadores em campo. A carta permanece no slot.`);
            return;
        }
        cardTargetMode = {
            cardId:2,
            player,
            slotIndex,
            phase:"chooseReserve",
            selectedRole:null,
            selectedSource:null,
            selectedPieceId:null
        };
        setMessage(`🎽 “SANGUE NOVO!” — escolha um RESERVA ou um jogador em EXPULSOS. Máximo de ${MAX_TEAM_PIECES} jogadores por time.`);
    } else if(cardId === 3) {
        cardTargetMode = {
            cardId:3,
            player,
            slotIndex,
            phase:"choosePiece",
            selectedPieceId:null
        };
        setMessage(`⚡ “ARRANCADA FULMINANTE!” — escolha qualquer peça sua para fazer um movimento bônus de até ${CARD_3_DISTANCE} casas.`);
    } else if(cardId === 4) {
        cardTargetMode = {
            cardId:4,
            player,
            slotIndex,
            phase:"choosePiece",
            selectedPieceId:null
        };
        setMessage(`🤝 “PASSE EM PROFUNDIDADE!” — escolha qualquer peça sua para fazer um movimento bônus de até ${CARD_4_DISTANCE} casas.`);
    } else if(cardId === 7) {
        cardTargetMode = {
            cardId:7,
            player,
            slotIndex,
            phase:"choosePiece",
            selectedPieceId:null,
            movedPieceIds:[],
            movesDone:0
        };
        setMessage(`🎯 “JOGADA ENSAIADA!” — mova ${CARD_7_MOVES} jogadores seus, um por vez, até ${CARD_7_DISTANCE} casas cada.`);
    } else if(cardId === 8) {
        const availableCells = getBlockPlacementCells(player);

        if(availableCells.length === 0) {
            setMessage('🚧 “BLOQUEIO” — não há casa livre disponível na sua metade defensiva. A carta permanece no slot.');
            return;
        }

        cardTargetMode = {
            cardId:8,
            player,
            slotIndex,
            phase:"placeBlock"
        };
        setMessage('🚧 “BLOQUEIO” — escolha uma casa LARANJA vazia da sua metade defensiva. As 3 casas imediatamente à frente do seu gol não podem receber BLOCK.');
    } else if(cardId === 9) {
        cardTargetMode = {
            cardId:9,
            player,
            slotIndex,
            phase:"target"
        };
        setMessage(`↩️ “RECUO TÁTICO” — escolha 1 peça adversária. Ela recuará até ${CARD_9_RETREAT_DISTANCE} casas em linha reta rumo à própria defesa.`);
    } else {
        const opponent = player === 0 ? 1 : 0;

        if(catimbaPending[opponent]) {
            setMessage(`🐢 “CATIMBA!” — o ${playerName(opponent)} já está sob efeito para o próximo turno. A carta permanece no slot.`);
            return;
        }

        catimbaPending[opponent] = true;
        hands[player].splice(slotIndex, 1);
        cardTargetMode = null;
        selectedPiece = null;

        setMessage(
            `🐢 CATIMBA! No próximo turno do ${playerName(opponent)}, o dado será reduzido: ` +
            `1→0 • 2/3→1 • 4/5→2 • 6→3, e o 6 não dará Carta Bônus.`
        );

        render();
        showCard10CatimbaVideo();
        return;
    }

    render();
}

function cancelCardMode() {
    if(cardTargetMode && cardTargetMode.cardId === 7 && cardTargetMode.movesDone > 0) {
        const owner = cardTargetMode.player;
        const slotIndex = cardTargetMode.slotIndex;
        const movesDone = cardTargetMode.movesDone;
        hands[owner].splice(slotIndex, 1);
        cardTargetMode = null;
        selectedPiece = null;
        setMessage(
            `🎯 JOGADA ENSAIADA encerrada após ${movesDone} movimento(s). ` +
            (diceRolled ? `Agora faça seu movimento normal de até ${diceValue} casas.` : 'Agora jogue o dado normalmente.')
        );
        render();
        return;
    }

    cardTargetMode = null;
    setMessage(
        diceRolled
        ? `🃏 Carta cancelada. Escolha uma peça para andar ${diceValue} casas.`
        : `🃏 Carta cancelada. ${playerName(currentPlayer)}: jogue o dado.`
    );
    render();
}

function chooseReserveRole(player, role) {
    if(
        !cardTargetMode ||
        cardTargetMode.cardId !== 2 ||
        cardTargetMode.player !== player ||
        cardTargetMode.phase !== "chooseReserve" ||
        !reserveAvailable[player].has(role)
    ) return;

    cardTargetMode.phase = "placeReserve";
    cardTargetMode.selectedRole = role;
    cardTargetMode.selectedSource = "reserve";
    cardTargetMode.selectedPieceId = null;
    setMessage(`🎽 ${role} selecionado. Clique em uma casa DOURADA vazia até a 3ª linha de defesa do ${playerName(player)}.`);
    render();
}

function chooseExpelledPlayer(player, pieceId) {
    if(
        !cardTargetMode ||
        cardTargetMode.cardId !== 2 ||
        cardTargetMode.player !== player ||
        cardTargetMode.phase !== "chooseReserve" ||
        !expelledPlayers[player].has(pieceId)
    ) return;

    const record = expelledPlayers[player].get(pieceId);

    cardTargetMode.phase = "placeReserve";
    cardTargetMode.selectedRole = record.role;
    cardTargetMode.selectedSource = "expelled";
    cardTargetMode.selectedPieceId = pieceId;

    setMessage(`🎽 ${record.role} será reintegrado. Clique em uma casa DOURADA vazia até a 3ª linha de defesa do ${playerName(player)}.`);
    render();
}

function isDefensiveCell(player, row) {
    // CARTA 2 — SANGUE NOVO:
    // o reserva só pode ENTRAR em uma das 3 linhas mais próximas do próprio gol.
    // Barcelona: linhas lógicas 0, 1 e 2.
    // Real Madrid: linhas lógicas 15, 16 e 17.
    return player === 1
        ? row >= 0 && row < GOALKEEPER_ZONE_DEPTH
        : row >= ROWS - GOALKEEPER_ZONE_DEPTH && row < ROWS;
}

function getReservePlacementCells(player) {
    const cells = [];
    for(let row=0; row<ROWS; row++) {
        if(!isDefensiveCell(player,row)) continue;
        for(let col=0; col<COLS; col++) {
            if(!getPieceAt(row,col) && !isBlockedCell(row,col)) cells.push({row,col});
        }
    }
    return cells;
}

function placeReserveWithCard(row, col) {
    if(
        !cardTargetMode ||
        cardTargetMode.cardId !== 2 ||
        cardTargetMode.phase !== "placeReserve"
    ) return false;

    const owner = cardTargetMode.player;
    const role = cardTargetMode.selectedRole;
    const slotIndex = cardTargetMode.slotIndex;
    const selectedSource = cardTargetMode.selectedSource || "reserve";
    const selectedPieceId = cardTargetMode.selectedPieceId;

    if(owner !== currentPlayer) return true;

    if(!teamCanReceiveReserve(owner)) {
        setMessage(`🎽 Limite atingido: o ${playerName(owner)} já está com ${MAX_TEAM_PIECES} jogadores em campo.`);
        cardTargetMode = null;
        selectedPiece = null;
        render();
        return true;
    }

    if(!isDefensiveCell(owner,row)) {
        setMessage(`🎽 O reserva só pode entrar até a 3ª linha de defesa do ${playerName(owner)}.`);
        return true;
    }

    if(getPieceAt(row,col) || isBlockedCell(row,col)) {
        setMessage('🎽 Essa casa está ocupada ou bloqueada. Escolha outra casa dourada.');
        return true;
    }

    let enteringId;
    let enteringReserve = false;
    let actionText = "entrou";

    if(selectedSource === "expelled") {
        if(!expelledPlayers[owner].has(selectedPieceId)) {
            setMessage('🎽 Esse jogador não está mais na lista de expulsos. Escolha outro.');
            cardTargetMode.phase = "chooseReserve";
            cardTargetMode.selectedRole = null;
            cardTargetMode.selectedSource = null;
            cardTargetMode.selectedPieceId = null;
            render();
            return true;
        }

        const expelledRecord = expelledPlayers[owner].get(selectedPieceId);
        enteringId = selectedPieceId;
        enteringReserve = !!expelledRecord.reserve;
        actionText = "voltou ao campo";
        expelledPlayers[owner].delete(selectedPieceId);

    } else {
        if(!reserveAvailable[owner].has(role)) {
            setMessage('🎽 Esse reserva não está mais disponível. Escolha outro.');
            cardTargetMode.phase = "chooseReserve";
            cardTargetMode.selectedRole = null;
            cardTargetMode.selectedSource = null;
            render();
            return true;
        }

        enteringId = `R-${role}`;
        enteringReserve = true;
        reserveAvailable[owner].delete(role);
        reserveInPlay[owner].push({ id: enteringId, role });
    }

    pieces.push({
        player: owner,
        id: enteringId,
        role,
        row,
        col,
        reserve: enteringReserve
    });

    hands[owner].splice(slotIndex,1);
    cardTargetMode = null;
    selectedPiece = null;

    setMessage(
        `🎽 SANGUE NOVO! ${role} ${actionText} no ${playerName(owner)}. ` +
        (diceRolled ? `Agora faça seu movimento de ${diceValue} casas.` : 'Agora jogue o dado.')
    );

    render();
    showCard2BloodNewVideo();
    return true;
}

function checkMinimumPlayersDefeat(losingPlayer) {
    const activeCount = getActiveTeamPieceCount(losingPlayer);

    if(activeCount > 2)
        return false;

    const winningPlayer = losingPlayer === 0 ? 1 : 0;
    const losingName = playerName(losingPlayer);
    const winningName = playerName(winningPlayer);

    winner = winningPlayer;
    matchEndReason = "minimumPlayers";
    matchClockRunning = false;
    goalPause = true;
    selectedPiece = null;
    cardTargetMode = null;
    diceValue = null;
    diceRolled = false;

    resetDiceDisplay();

    setMessage(
        `🏆 ${winningName} venceu! ${losingName} ficou reduzido a GO + 1 jogador.`
    );

    render();
    showVictory(true, winningPlayer);
    return true;
}

function selectPieceForCard3(piece) {
    if(!cardTargetMode || cardTargetMode.cardId !== 3) return false;

    const owner = cardTargetMode.player;

    if(piece.player !== owner) {
        setMessage('⚡ ARRANCADA FULMINANTE! Escolha uma peça do seu próprio time.');
        return true;
    }

    const moves = getPossibleMovesForDistance(piece, CARD_3_DISTANCE);

    if(moves.length === 0) {
        setMessage(`⚡ ${piece.role} não possui movimento disponível de até ${CARD_3_DISTANCE} casas. Escolha outra peça.`);
        return true;
    }

    selectedPiece = piece;
    cardTargetMode.phase = "movePiece";
    cardTargetMode.selectedPieceId = piece.id;

    setMessage(`⚡ ${piece.role} selecionado. Escolha uma casa verde a até ${CARD_3_DISTANCE} casas para a ARRANCADA.`);
    render();
    return true;
}

function movePieceWithCard3(row, col) {
    if(
        !cardTargetMode ||
        cardTargetMode.cardId !== 3 ||
        cardTargetMode.phase !== "movePiece" ||
        !selectedPiece ||
        moveAnimationActive
    ) return false;

    const owner = cardTargetMode.player;
    const slotIndex = cardTargetMode.slotIndex;
    const piece = selectedPiece;
    const movedDistance = Math.max(Math.abs(row - piece.row), Math.abs(col - piece.col));

    if(owner !== currentPlayer || piece.player !== owner) return true;

    if(!isValidMoveForDistance(piece, row, col, CARD_3_DISTANCE)) {
        setMessage(`⚡ Movimento inválido. A ARRANCADA permite mover de 1 até ${CARD_3_DISTANCE} casas em uma única direção.`);
        return true;
    }

    const path = getAnimationPathForDistance(piece, row, col, CARD_3_DISTANCE);
    const visualPath = path.length ? path : [{ row, col }];

    // CARTA 3: cria um rastro visual assim que a casa de destino é definida.
    showCard3Trail(piece, visualPath);

    animatePieceAlongPath(piece, visualPath, () => {
        piece.row = row;
        piece.col = col;

        hands[owner].splice(slotIndex, 1);
        cardTargetMode = null;
        selectedPiece = null;

        if(checkGoal(piece)) {
            setMessage(`⚡⚽ ARRANCADA FULMINANTE! ${piece.role} chegou ao gol!`);
            render();
            showCard3SprintVideo(() => {
                registerGoal(owner, piece);
            });
            return;
        }

        setMessage(
            `⚡ ARRANCADA FULMINANTE! ${piece.role} avançou ${movedDistance} casa(s). ` +
            (diceRolled ? `Agora faça seu movimento normal de até ${diceValue} casas.` : 'Agora jogue o dado normalmente.')
        );

        render();
        showCard3SprintVideo();
    });

    return true;
}

function selectPieceForCard4(piece) {
    if(!cardTargetMode || cardTargetMode.cardId !== 4) return false;

    const owner = cardTargetMode.player;

    if(piece.player !== owner) {
        setMessage('🤝 PASSE EM PROFUNDIDADE! Escolha uma peça do seu próprio time.');
        return true;
    }

    const moves = getPossibleMovesForDistance(piece, CARD_4_DISTANCE);

    if(moves.length === 0) {
        setMessage(`🤝 ${piece.role} não possui movimento disponível de até ${CARD_4_DISTANCE} casas. Escolha outra peça.`);
        return true;
    }

    selectedPiece = piece;
    cardTargetMode.phase = "movePiece";
    cardTargetMode.selectedPieceId = piece.id;

    setMessage(`🤝 ${piece.role} selecionado. Escolha uma casa verde a até ${CARD_4_DISTANCE} casas para o PASSE EM PROFUNDIDADE.`);
    render();
    return true;
}

function movePieceWithCard4(row, col) {
    if(
        !cardTargetMode ||
        cardTargetMode.cardId !== 4 ||
        cardTargetMode.phase !== "movePiece" ||
        !selectedPiece ||
        moveAnimationActive
    ) return false;

    const owner = cardTargetMode.player;
    const slotIndex = cardTargetMode.slotIndex;
    const piece = selectedPiece;
    const movedDistance = Math.max(Math.abs(row - piece.row), Math.abs(col - piece.col));

    if(owner !== currentPlayer || piece.player !== owner) return true;

    if(!isValidMoveForDistance(piece, row, col, CARD_4_DISTANCE)) {
        setMessage(`🤝 Movimento inválido. O PASSE EM PROFUNDIDADE permite mover de 1 até ${CARD_4_DISTANCE} casas em uma única direção.`);
        return true;
    }

    const path = getAnimationPathForDistance(piece, row, col, CARD_4_DISTANCE);
    const visualPath = path.length ? path : [{ row, col }];

    // CARTA 4: mostra a direção do passe por aproximadamente 3 segundos.
    showCard4PassArrow(piece, row, col);

    animatePieceAlongPath(piece, visualPath, () => {
        piece.row = row;
        piece.col = col;

        hands[owner].splice(slotIndex, 1);
        cardTargetMode = null;
        selectedPiece = null;

        if(checkGoal(piece)) {
            setMessage(`🤝⚽ PASSE EM PROFUNDIDADE! ${piece.role} chegou ao gol!`);
            render();
            showCard4PassVideo(() => {
                registerGoal(owner, piece);
            });
            return;
        }

        setMessage(
            `🤝 PASSE EM PROFUNDIDADE! ${piece.role} avançou ${movedDistance} casa(s). ` +
            (diceRolled ? `Agora faça seu movimento normal de até ${diceValue} casas.` : 'Agora jogue o dado normalmente.')
        );

        render();
        showCard4PassVideo();
    });

    return true;
}

function getEligibleCard7Pieces(owner) {
    const movedPieceIds = cardTargetMode && cardTargetMode.cardId === 7
        ? cardTargetMode.movedPieceIds.map(id => String(id))
        : [];

    return pieces.filter(piece => {
        return (
            piece.player === owner &&
            !movedPieceIds.includes(String(piece.id)) &&
            getPossibleMovesForDistance(piece, CARD_7_DISTANCE).length > 0
        );
    });
}

function selectPieceForCard7(piece) {
    if(!cardTargetMode || cardTargetMode.cardId !== 7) return false;

    const owner = cardTargetMode.player;

    if(piece.player !== owner) {
        setMessage('🎯 JOGADA ENSAIADA! Escolha uma peça do seu próprio time.');
        return true;
    }

    if(cardTargetMode.movedPieceIds.map(id => String(id)).includes(String(piece.id))) {
        setMessage('🎯 Esse jogador já participou da JOGADA ENSAIADA! Escolha outro.');
        return true;
    }

    const moves = getPossibleMovesForDistance(piece, CARD_7_DISTANCE);

    if(moves.length === 0) {
        setMessage(`🎯 ${piece.role} não possui movimento disponível de até ${CARD_7_DISTANCE} casas. Escolha outra peça.`);
        return true;
    }

    selectedPiece = piece;
    cardTargetMode.phase = "movePiece";
    cardTargetMode.selectedPieceId = piece.id;

    const currentNumber = cardTargetMode.movesDone + 1;
    setMessage(`🎯 ${piece.role} selecionado. Escolha uma casa verde para o movimento ${currentNumber}/${CARD_7_MOVES} da JOGADA ENSAIADA.`);
    render();
    return true;
}

function finishCard7Sequence(owner, slotIndex) {
    hands[owner].splice(slotIndex, 1);
    const movedCount = cardTargetMode ? cardTargetMode.movesDone : 0;
    const movedIds = cardTargetMode ? [...cardTargetMode.movedPieceIds] : [];
    cardTargetMode = null;
    selectedPiece = null;

    // As peças utilizadas continuam "pegando fogo" por mais 3 segundos,
    // mas somente as peças DESTE time.
    keepCard7FireForThreeSeconds(movedIds, owner);

    setMessage(
        `🎯 JOGADA ENSAIADA concluída! ${movedCount} jogador(es) realizaram seus movimentos de até ${CARD_7_DISTANCE} casas. ` +
        (diceRolled ? `Agora faça seu movimento normal de até ${diceValue} casas.` : 'Agora jogue o dado normalmente.')
    );

    render();
    showCard7PlannedPlayVideo();
    return true;
}

function movePieceWithCard7(row, col) {
    if(
        !cardTargetMode ||
        cardTargetMode.cardId !== 7 ||
        cardTargetMode.phase !== "movePiece" ||
        !selectedPiece ||
        moveAnimationActive
    ) return false;

    const owner = cardTargetMode.player;
    const slotIndex = cardTargetMode.slotIndex;
    const piece = selectedPiece;
    const movedDistance = Math.max(Math.abs(row - piece.row), Math.abs(col - piece.col));

    if(owner !== currentPlayer || piece.player !== owner) return true;

    if(!isValidMoveForDistance(piece, row, col, CARD_7_DISTANCE)) {
        setMessage(`🎯 Movimento inválido. A JOGADA ENSAIADA permite mover de 1 até ${CARD_7_DISTANCE} casas em uma única direção.`);
        return true;
    }

    const path = getAnimationPathForDistance(piece, row, col, CARD_7_DISTANCE);

    animatePieceAlongPath(piece, path.length ? path : [{ row, col }], () => {
        piece.row = row;
        piece.col = col;

        cardTargetMode.movedPieceIds.push(piece.id);
        cardTargetMode.movesDone += 1;
        selectedPiece = null;

        if(checkGoal(piece)) {
            hands[owner].splice(slotIndex, 1);
            const usedIds = [...cardTargetMode.movedPieceIds];
            keepCard7FireForThreeSeconds(usedIds, owner);
            cardTargetMode = null;
            setMessage(`🎯⚽ JOGADA ENSAIADA! ${piece.role} chegou ao gol!`);
            render();
            showCard7PlannedPlayVideo(() => {
                registerGoal(owner, piece);
            });
            return;
        }

        const remainingMoves = CARD_7_MOVES - cardTargetMode.movesDone;
        const eligiblePieces = getEligibleCard7Pieces(owner);

        if(remainingMoves <= 0 || eligiblePieces.length === 0) {
            finishCard7Sequence(owner, slotIndex);
            return;
        }

        cardTargetMode.phase = "choosePiece";
        cardTargetMode.selectedPieceId = null;

        setMessage(
            `🎯 JOGADA ENSAIADA: ${piece.role} avançou ${movedDistance} casa(s). ` +
            `Escolha o próximo jogador (${cardTargetMode.movesDone + 1}/${CARD_7_MOVES}).`
        );

        render();
    });

    return true;
}

function placeBlockWithCard(row, col) {
    if(
        !cardTargetMode ||
        cardTargetMode.cardId !== 8 ||
        cardTargetMode.phase !== "placeBlock"
    ) return false;

    const owner = cardTargetMode.player;
    const slotIndex = cardTargetMode.slotIndex;

    if(owner !== currentPlayer) return true;

    if(!inside(row,col) || !isDefenseHalf(owner,row)) {
        setMessage(`🚧 O BLOCK só pode ser colocado em uma casa vazia da metade defensiva do ${playerName(owner)}.`);
        return true;
    }

    if(isForbiddenBlockGoalFront(owner,row,col)) {
        setMessage('🚧 BLOCK proibido: as 3 casas imediatamente à frente do próprio gol devem permanecer livres de BLOCK.');
        return true;
    }

    if(getPieceAt(row,col) || isBlockedCell(row,col)) {
        setMessage('🚧 Essa casa já está ocupada. Escolha outra casa laranja.');
        return true;
    }

    blocks.push({
        id: nextBlockId++,
        player: owner,
        row,
        col
    });

    hands[owner].splice(slotIndex, 1);
    cardTargetMode = null;
    selectedPiece = null;

    setMessage(
        `🚧 BLOCK colocado pelo ${playerName(owner)}! Essa casa não pode ser ocupada nem atravessada por nenhum time até o próximo gol. ` +
        (diceRolled ? `Agora faça seu movimento normal de até ${diceValue} casas.` : 'Agora jogue o dado normalmente.')
    );

    render();
    showCard8BlockVideo();
    return true;
}

function calculateCard9Retreat(piece) {
    // Barcelona (player 1) defende o topo lógico: recua diminuindo row.
    // Real Madrid (player 0) defende a base lógica: recua aumentando row.
    const stepRow = piece.player === 1 ? -1 : 1;
    let finalRow = piece.row;
    let moved = 0;

    for(let step = 1; step <= CARD_9_RETREAT_DISTANCE; step++) {
        const nextRow = piece.row + stepRow * step;
        const nextCol = piece.col;

        if(!inside(nextRow, nextCol)) break;
        if(isBlockedCell(nextRow, nextCol)) break;
        if(getPieceAt(nextRow, nextCol, piece)) break;

        // O GO continua obedecendo sua zona de até 3 linhas defensivas.
        if(piece.role === "GO" && !goalkeeperPositionAllowed(piece, nextRow, nextCol)) break;

        finalRow = nextRow;
        moved = step;
    }

    return { row: finalRow, col: piece.col, moved };
}

function retreatWithCard9(piece) {
    if(!cardTargetMode || cardTargetMode.cardId !== 9 || moveAnimationActive) return false;

    const startRow = piece.row;
    const startCol = piece.col;

    const owner = cardTargetMode.player;
    const slotIndex = cardTargetMode.slotIndex;

    if(owner !== currentPlayer) {
        cardTargetMode = null;
        render();
        return true;
    }

    if(piece.player === owner) {
        setMessage('↩️ RECUO TÁTICO deve ser usado em uma peça adversária.');
        return true;
    }

    const result = calculateCard9Retreat(piece);
    const targetRole = piece.role;
    const targetTeam = playerName(piece.player);

    const finishRetreat = () => {
        piece.row = result.row;
        piece.col = result.col;

        hands[owner].splice(slotIndex, 1);
        cardTargetMode = null;
        selectedPiece = null;

        if(result.moved > 0) {
            setMessage(
                `↩️ RECUO TÁTICO! ${targetRole} do ${targetTeam} recuou ${result.moved} casa${result.moved > 1 ? 's' : ''} rumo à própria defesa. ` +
                (diceRolled ? `Agora faça seu movimento normal de até ${diceValue} casas.` : 'Agora jogue o dado normalmente.')
            );
        } else {
            setMessage(
                `↩️ RECUO TÁTICO! ${targetRole} do ${targetTeam} já estava sem espaço para recuar. A carta foi utilizada. ` +
                (diceRolled ? `Agora faça seu movimento normal de até ${diceValue} casas.` : 'Agora jogue o dado normalmente.')
            );
        }

        render();

        showCard9RetreatVideo(() => {
            if(result.moved > 0) {
                showCard9RetreatFx({ row: startRow, col: startCol }, result.row, result.col);
            } else {
                const start = getVisualCenterForPosition(startRow, startCol);
                if(start) {
                    const pusher = document.createElement("div");
                    pusher.className = "card9-pusher";
                    pusher.textContent = "🏃";
                    pusher.style.left = `${start.x - 28}px`;
                    pusher.style.top = `${start.y}px`;
                    getCardSpecialFxLayer().appendChild(pusher);

                    if(typeof pusher.animate === "function") {
                        pusher.animate(
                            [
                                { transform: "translateX(0) scale(.85)", opacity: 0 },
                                { transform: "translateX(12px) scale(1)", opacity: 1, offset: .25 },
                                { transform: "translateX(20px) scale(.92)", opacity: 0 }
                            ],
                            { duration: 900, easing: "ease-out", fill: "forwards" }
                        );
                    }

                    setTimeout(() => pusher.remove(), 1000);
                }
            }
        });
    };

    if(result.moved <= 0) {
        finishRetreat();
        return true;
    }

    const stepRow = piece.player === 1 ? -1 : 1;
    const path = [];
    for(let step = 1; step <= result.moved; step++) {
        path.push({ row: piece.row + stepRow * step, col: piece.col });
    }

    animatePieceAlongPath(piece, path, finishRetreat);
    return true;
}

function showCard1ExpulsionVideo(onFinish = null) {

    const overlay = document.getElementById("cardVideoOverlay");
    const video = document.getElementById("cardVideoPlayer");

    if(!overlay || !video) {
        if(typeof onFinish === "function") onFinish();
        return;
    }

    const src = card1VideoPaths[nextCard1VideoIndex];
    nextCard1VideoIndex = (nextCard1VideoIndex + 1) % card1VideoPaths.length;

    cardVideoActive = true;
    overlay.classList.add("show");
    overlay.setAttribute("aria-hidden", "false");

    try {
        card1ExpulsionAudio.pause();
        card1ExpulsionAudio.currentTime = 0;
        const audioPromise = card1ExpulsionAudio.play();
        if(audioPromise && typeof audioPromise.catch === "function") {
            audioPromise.catch(() => {});
        }
    } catch(error) {
        // Ignora falhas de reprodução silenciosamente.
    }

    let finished = false;

    const cleanup = () => {
        if(finished) return;
        finished = true;

        if(cardVideoTimeoutId) {
            clearTimeout(cardVideoTimeoutId);
            cardVideoTimeoutId = null;
        }

        video.pause();
        video.onended = null;
        video.removeAttribute("src");
        video.load();

        card1ExpulsionAudio.pause();
        card1ExpulsionAudio.currentTime = 0;

        overlay.classList.remove("show");
        overlay.setAttribute("aria-hidden", "true");
        cardVideoActive = false;

        if(typeof onFinish === "function") {
            onFinish();
        }
    };

    video.src = src;
    video.currentTime = 0;
    video.onended = cleanup;

    const playPromise = video.play();
    if(playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {});
    }

    cardVideoTimeoutId = setTimeout(cleanup, 3000);
}

function showCard2BloodNewVideo(onFinish = null) {

    const overlay = document.getElementById("card2VideoOverlay");
    const video = document.getElementById("card2VideoPlayer");

    if(!overlay || !video) {
        if(typeof onFinish === "function") onFinish();
        return;
    }

    const src = card2VideoPaths[nextCard2VideoIndex];
    nextCard2VideoIndex = (nextCard2VideoIndex + 1) % card2VideoPaths.length;

    cardVideoActive = true;
    overlay.classList.add("show");
    overlay.setAttribute("aria-hidden", "false");

    try {
        card2SubstitutionAudio.pause();
        card2SubstitutionAudio.currentTime = 0;
        const audioPromise = card2SubstitutionAudio.play();
        if(audioPromise && typeof audioPromise.catch === "function") {
            audioPromise.catch(() => {});
        }
    } catch(error) {
        // Ignora falhas de reprodução silenciosamente.
    }

    let finished = false;

    const cleanup = () => {
        if(finished) return;
        finished = true;

        if(cardVideoTimeoutId) {
            clearTimeout(cardVideoTimeoutId);
            cardVideoTimeoutId = null;
        }

        video.pause();
        video.onended = null;
        video.removeAttribute("src");
        video.load();

        card2SubstitutionAudio.pause();
        card2SubstitutionAudio.currentTime = 0;

        overlay.classList.remove("show");
        overlay.setAttribute("aria-hidden", "true");
        cardVideoActive = false;

        if(typeof onFinish === "function") {
            onFinish();
        }
    };

    video.src = src;
    video.currentTime = 0;
    video.onended = cleanup;

    const playPromise = video.play();
    if(playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {});
    }

    cardVideoTimeoutId = setTimeout(cleanup, 3000);
}

function showCard3SprintVideo(onFinish = null) {

    const overlay = document.getElementById("card3VideoOverlay");
    const video = document.getElementById("card3VideoPlayer");

    if(!overlay || !video) {
        if(typeof onFinish === "function") onFinish();
        return;
    }

    const src = card3VideoPaths[nextCard3VideoIndex];
    nextCard3VideoIndex = (nextCard3VideoIndex + 1) % card3VideoPaths.length;

    cardVideoActive = true;
    overlay.classList.add("show");
    overlay.setAttribute("aria-hidden", "false");

    let finished = false;

    const cleanup = () => {
        if(finished) return;
        finished = true;

        if(cardVideoTimeoutId) {
            clearTimeout(cardVideoTimeoutId);
            cardVideoTimeoutId = null;
        }

        video.pause();
        video.onended = null;
        video.removeAttribute("src");
        video.load();
        overlay.classList.remove("show");
        overlay.setAttribute("aria-hidden", "true");
        cardVideoActive = false;

        if(typeof onFinish === "function") {
            onFinish();
        }
    };

    video.src = src;
    video.currentTime = 0;
    video.onended = cleanup;

    const playPromise = video.play();
    if(playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {});
    }

    cardVideoTimeoutId = setTimeout(cleanup, 3000);
}

function showCard4PassVideo(onFinish = null) {

    const overlay = document.getElementById("card4VideoOverlay");
    const video = document.getElementById("card4VideoPlayer");

    if(!overlay || !video) {
        if(typeof onFinish === "function") onFinish();
        return;
    }

    const src = card4VideoPaths[nextCard4VideoIndex];
    nextCard4VideoIndex = (nextCard4VideoIndex + 1) % card4VideoPaths.length;

    cardVideoActive = true;
    overlay.classList.add("show");
    overlay.setAttribute("aria-hidden", "false");

    let finished = false;

    const cleanup = () => {
        if(finished) return;
        finished = true;

        if(cardVideoTimeoutId) {
            clearTimeout(cardVideoTimeoutId);
            cardVideoTimeoutId = null;
        }

        video.pause();
        video.onended = null;
        video.removeAttribute("src");
        video.load();
        overlay.classList.remove("show");
        overlay.setAttribute("aria-hidden", "true");
        cardVideoActive = false;

        if(typeof onFinish === "function") onFinish();
    };

    video.src = src;
    video.currentTime = 0;
    video.onended = cleanup;

    const playPromise = video.play();
    if(playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {});
    }

    cardVideoTimeoutId = setTimeout(cleanup, 3000);
}

function showCard7PlannedPlayVideo(onFinish = null) {

    const overlay = document.getElementById("card7VideoOverlay");
    const video = document.getElementById("card7VideoPlayer");

    if(!overlay || !video) {
        if(typeof onFinish === "function") onFinish();
        return;
    }

    const src = card7VideoPaths[nextCard7VideoIndex];
    nextCard7VideoIndex = (nextCard7VideoIndex + 1) % card7VideoPaths.length;

    cardVideoActive = true;
    overlay.classList.add("show");
    overlay.setAttribute("aria-hidden", "false");

    let finished = false;

    const cleanup = () => {
        if(finished) return;
        finished = true;

        if(cardVideoTimeoutId) {
            clearTimeout(cardVideoTimeoutId);
            cardVideoTimeoutId = null;
        }

        video.pause();
        video.onended = null;
        video.removeAttribute("src");
        video.load();
        overlay.classList.remove("show");
        overlay.setAttribute("aria-hidden", "true");
        cardVideoActive = false;

        if(typeof onFinish === "function") onFinish();
    };

    video.src = src;
    video.currentTime = 0;
    video.onended = cleanup;

    const playPromise = video.play();
    if(playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {});
    }

    cardVideoTimeoutId = setTimeout(cleanup, 3000);
}

function showCard8BlockVideo(onFinish = null) {

    const overlay = document.getElementById("card8VideoOverlay");
    const video = document.getElementById("card8VideoPlayer");

    if(!overlay || !video) {
        if(typeof onFinish === "function") onFinish();
        return;
    }

    const src = card8VideoPaths[nextCard8VideoIndex];
    nextCard8VideoIndex = (nextCard8VideoIndex + 1) % card8VideoPaths.length;

    cardVideoActive = true;
    overlay.classList.add("show");
    overlay.setAttribute("aria-hidden", "false");

    try {
        card8BlockAudio.pause();
        card8BlockAudio.currentTime = 0;
        const audioPromise = card8BlockAudio.play();
        if(audioPromise && typeof audioPromise.catch === "function") {
            audioPromise.catch(() => {});
        }
    } catch(error) {
        // Ignora falhas de reprodução silenciosamente.
    }

    let finished = false;

    const cleanup = () => {
        if(finished) return;
        finished = true;

        if(cardVideoTimeoutId) {
            clearTimeout(cardVideoTimeoutId);
            cardVideoTimeoutId = null;
        }

        video.pause();
        video.onended = null;
        video.removeAttribute("src");
        video.load();

        card8BlockAudio.pause();
        card8BlockAudio.currentTime = 0;

        overlay.classList.remove("show");
        overlay.setAttribute("aria-hidden", "true");
        cardVideoActive = false;

        if(typeof onFinish === "function") onFinish();
    };

    video.src = src;
    video.currentTime = 0;
    video.onended = cleanup;

    const playPromise = video.play();
    if(playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {});
    }

    cardVideoTimeoutId = setTimeout(cleanup, 3000);
}

function showCard9RetreatVideo(onFinish = null) {

    const overlay = document.getElementById("card9VideoOverlay");
    const video = document.getElementById("card9VideoPlayer");

    if(!overlay || !video) {
        if(typeof onFinish === "function") onFinish();
        return;
    }

    const src = card9VideoPaths[nextCard9VideoIndex];
    nextCard9VideoIndex = (nextCard9VideoIndex + 1) % card9VideoPaths.length;

    cardVideoActive = true;
    overlay.classList.add("show");
    overlay.setAttribute("aria-hidden", "false");

    let finished = false;

    const cleanup = () => {
        if(finished) return;
        finished = true;

        if(cardVideoTimeoutId) {
            clearTimeout(cardVideoTimeoutId);
            cardVideoTimeoutId = null;
        }

        video.pause();
        video.onended = null;
        video.removeAttribute("src");
        video.load();
        overlay.classList.remove("show");
        overlay.setAttribute("aria-hidden", "true");
        cardVideoActive = false;

        if(typeof onFinish === "function") onFinish();
    };

    video.src = src;
    video.currentTime = 0;
    video.onended = cleanup;

    const playPromise = video.play();
    if(playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {});
    }

    cardVideoTimeoutId = setTimeout(cleanup, 3000);
}

function showCard10CatimbaVideo(onFinish = null) {

    const overlay = document.getElementById("card10VideoOverlay");
    const video = document.getElementById("card10VideoPlayer");

    if(!overlay || !video) {
        if(typeof onFinish === "function") onFinish();
        return;
    }

    const src = card10VideoPaths[nextCard10VideoIndex];
    nextCard10VideoIndex = (nextCard10VideoIndex + 1) % card10VideoPaths.length;

    cardVideoActive = true;
    overlay.classList.add("show");
    overlay.setAttribute("aria-hidden", "false");

    try {
        card10CatimbaAudio.pause();
        card10CatimbaAudio.currentTime = 0;
        const audioPromise = card10CatimbaAudio.play();
        if(audioPromise && typeof audioPromise.catch === "function") {
            audioPromise.catch(() => {});
        }
    } catch(error) {
        // Ignora falhas de reprodução silenciosamente.
    }

    let finished = false;

    const cleanup = () => {
        if(finished) return;
        finished = true;

        if(cardVideoTimeoutId) {
            clearTimeout(cardVideoTimeoutId);
            cardVideoTimeoutId = null;
        }

        video.pause();
        video.onended = null;
        video.removeAttribute("src");
        video.load();

        card10CatimbaAudio.pause();
        card10CatimbaAudio.currentTime = 0;

        overlay.classList.remove("show");
        overlay.setAttribute("aria-hidden", "true");
        cardVideoActive = false;

        if(typeof onFinish === "function") onFinish();
    };

    video.src = src;
    video.currentTime = 0;
    video.onended = cleanup;

    const playPromise = video.play();
    if(playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {});
    }

    cardVideoTimeoutId = setTimeout(cleanup, 3000);
}

function expelWithCard(piece) {

    if(!cardTargetMode || cardTargetMode.cardId !== 1) return false;

    const owner = cardTargetMode.player;
    const slotIndex = cardTargetMode.slotIndex;

    if(owner !== currentPlayer) {
        cardTargetMode = null;
        render();
        return true;
    }

    if(piece.player === owner) {
        setMessage('🟥 “TÁ NA RUA!” deve ser usada em um jogador adversário.');
        return true;
    }

    if(piece.role === "GO") {
        setMessage('🧤 O Goleiro (GO) não pode ser expulso por esta carta. Escolha outro adversário.');
        return true;
    }

    const expelledLabel = piece.role;
    const expelledTeam = playerName(piece.player);

    expelledPlayers[piece.player].set(piece.id, {
        role: piece.role,
        reserve: !!piece.reserve
    });
    pieces = pieces.filter(p => p !== piece);

    hands[owner].splice(slotIndex, 1);
    cardTargetMode = null;
    selectedPiece = null;

    setMessage(
        `🟥 TÁ NA RUA! ${expelledLabel} do ${expelledTeam} foi expulso. Ele poderá voltar com SANGUE NOVO! ` +
        (diceRolled ? `Agora escolha sua peça para andar ${diceValue} casas.` : `Agora jogue o dado.`)
    );

    render();

    showCard1ExpulsionVideo(() => {
        checkMinimumPlayersDefeat(piece.player);
    });

    return true;
}

// ============================================================
// RENDERIZAR
// ============================================================

function render() {

    const cells = boardCellsCache.length
        ? boardCellsCache
        : Array.from(document.querySelectorAll(".cell"));

    const redGoalCells = redGoalCellsCache.length
        ? redGoalCellsCache
        : Array.from(document.querySelectorAll("#redGoal .goal-cell"));

    const blueGoalCells = blueGoalCellsCache.length
        ? blueGoalCellsCache
        : Array.from(document.querySelectorAll("#blueGoal .goal-cell"));


    redGoalCells.forEach(cell =>
        cell.classList.remove("possible")
    );

    blueGoalCells.forEach(cell =>
        cell.classList.remove("possible")
    );


    cells.forEach(
        cell => {

            cell.classList.remove(
                "possible",
                "reserve-target",
                "block-target",
                "formation-target"
            );

            cell.innerHTML="";

        }
    );


    // Casas permitidas durante a escolha da FORMAÇÃO INICIAL.
    if(
        formationSetupActive &&
        formationSelectedPiece &&
        formationSelectedPiece.player === formationSetupPlayer
    ) {
        getFormationPlacementCells(formationSelectedPiece).forEach(move => {
            const index = move.row * COLS + move.col;
            if(cells[index]) cells[index].classList.add("formation-target");
        });
    }

    // Casas disponíveis para a Carta 8 — BLOQUEIO
    if(
        cardTargetMode &&
        cardTargetMode.cardId === 8 &&
        cardTargetMode.phase === "placeBlock" &&
        winner === null &&
        !goalPause
    ) {
        getBlockPlacementCells(cardTargetMode.player).forEach(move => {
            const index = move.row * COLS + move.col;
            if(cells[index]) cells[index].classList.add("block-target");
        });
    }

    // BLOCKS já colocados no campo
    blocks.forEach(block => {
        const index = block.row * COLS + block.col;
        const cell = cells[index];
        if(!cell) return;

        const element = document.createElement("div");
        element.className = `block-object ${block.player === 0 ? "block-blue" : "block-red"}`;
        element.title = `BLOCK do ${playerName(block.player)} — bloqueia os dois times até o próximo gol.`;
        element.innerHTML = '<span class="block-icon">🚧</span><span>BLOCK</span>';
        cell.appendChild(element);
    });

    // Casas disponíveis para a Carta 2 — SANGUE NOVO!
    if(
        cardTargetMode &&
        cardTargetMode.cardId === 2 &&
        cardTargetMode.phase === "placeReserve" &&
        winner === null &&
        !goalPause
    ) {
        getReservePlacementCells(cardTargetMode.player).forEach(move => {
            const index = move.row * COLS + move.col;
            if(cells[index]) cells[index].classList.add("reserve-target");
        });
    }

    // Casas possíveis da Carta 3 — ARRANCADA FULMINANTE!
    if(
        cardTargetMode &&
        cardTargetMode.cardId === 3 &&
        cardTargetMode.phase === "movePiece" &&
        selectedPiece &&
        winner === null &&
        !goalPause
    ) {
        const sprintMoves = getPossibleMovesForDistance(selectedPiece, CARD_3_DISTANCE);

        sprintMoves.forEach(move => {
            if(move.row === -1) {
                const goalCell = document.querySelector(`#redGoal .goal-cell[data-col="${move.col}"]`);
                if(goalCell) goalCell.classList.add("possible");
                return;
            }

            if(move.row === ROWS) {
                const goalCell = document.querySelector(`#blueGoal .goal-cell[data-col="${move.col}"]`);
                if(goalCell) goalCell.classList.add("possible");
                return;
            }

            const index = move.row * COLS + move.col;
            if(cells[index]) cells[index].classList.add("possible");
        });
    }

    // Casas possíveis da Carta 4 — PASSE EM PROFUNDIDADE!
    if(
        cardTargetMode &&
        cardTargetMode.cardId === 4 &&
        cardTargetMode.phase === "movePiece" &&
        selectedPiece &&
        winner === null &&
        !goalPause
    ) {
        const passMoves = getPossibleMovesForDistance(selectedPiece, CARD_4_DISTANCE);

        passMoves.forEach(move => {
            if(move.row === -1) {
                const goalCell = document.querySelector(`#redGoal .goal-cell[data-col="${move.col}"]`);
                if(goalCell) goalCell.classList.add("possible");
                return;
            }

            if(move.row === ROWS) {
                const goalCell = document.querySelector(`#blueGoal .goal-cell[data-col="${move.col}"]`);
                if(goalCell) goalCell.classList.add("possible");
                return;
            }

            const index = move.row * COLS + move.col;
            if(cells[index]) cells[index].classList.add("possible");
        });
    }


    // Casas possíveis da Carta 7 — JOGADA ENSAIADA!
    if(
        cardTargetMode &&
        cardTargetMode.cardId === 7 &&
        cardTargetMode.phase === "movePiece" &&
        selectedPiece &&
        winner === null &&
        !goalPause
    ) {
        const plannedMoves = getPossibleMovesForDistance(selectedPiece, CARD_7_DISTANCE);

        plannedMoves.forEach(move => {
            if(move.row === -1) {
                const goalCell = document.querySelector(`#redGoal .goal-cell[data-col="${move.col}"]`);
                if(goalCell) goalCell.classList.add("possible");
                return;
            }

            if(move.row === ROWS) {
                const goalCell = document.querySelector(`#blueGoal .goal-cell[data-col="${move.col}"]`);
                if(goalCell) goalCell.classList.add("possible");
                return;
            }

            const index = move.row * COLS + move.col;
            if(cells[index]) cells[index].classList.add("possible");
        });
    }

    // Casas possíveis

    if(
        selectedPiece &&
        diceRolled &&
        winner === null &&
        !goalPause &&
        !cardTargetMode
    ) {

        const moves =
            getPossibleMoves(
                selectedPiece
            );


        moves.forEach(
            move => {

                // Destino no gol vermelho (ataque do Real Madrid)
                if(move.row === -1) {

                    const goalCell =
                        document.querySelector(
                            `#redGoal .goal-cell[data-col="${move.col}"]`
                        );

                    if(goalCell) {
                        goalCell.classList.add("possible");
                    }

                    return;
                }


                // Destino no gol azul (ataque do Barcelona)
                if(move.row === ROWS) {

                    const goalCell =
                        document.querySelector(
                            `#blueGoal .goal-cell[data-col="${move.col}"]`
                        );

                    if(goalCell) {
                        goalCell.classList.add("possible");
                    }

                    return;
                }


                const index =
                    move.row*COLS+
                    move.col;


                if(
                    cells[index]
                ) {

                    cells[index]
                        .classList
                        .add(
                            "possible"
                        );

                }

            }
        );

    }


    // Peças

    pieces.forEach(
        piece => {

            const index =
                piece.row*COLS+
                piece.col;


            const cell =
                cells[index];


            if(!cell)
                return;


            const element =
                document.createElement(
                    "div"
                );


            element.classList.add(
                "piece"
            );


            element.classList.add(
                piece.player === 0
                ? "blue"
                : "red"
            );


            if(formationSetupActive) {
                if(piece.player === formationSetupPlayer) {
                    element.classList.add("formation-selectable");
                } else {
                    element.classList.add("formation-muted");
                }

                if(piece === formationSelectedPiece) {
                    element.classList.add("formation-selected");
                }
            }

            if(piece.role === "GO") {
                element.classList.add("goalkeeper");
                element.title = "Goleiro (GO) — limitado às 3 linhas defensivas e protegido da Carta 1";
            } else {
                element.title = `Posição: ${piece.role}`;
            }

            if(cardTargetMode && cardTargetMode.cardId === 1 && piece.player !== currentPlayer) {
                if(piece.role === "GO") {
                    element.classList.add("goalkeeper-protected");
                } else {
                    element.classList.add("card-target");
                }
            }

            if(cardTargetMode && cardTargetMode.cardId === 9 && piece.player !== currentPlayer) {
                element.classList.add("card9-target");
            }

            if(cardTargetMode && cardTargetMode.cardId === 3 && piece.player === currentPlayer) {
                element.classList.add("card3-target");
            }

            if(cardTargetMode && cardTargetMode.cardId === 4 && piece.player === currentPlayer) {
                element.classList.add("card4-target");
            }

            if(
                cardTargetMode &&
                cardTargetMode.cardId === 7 &&
                piece.player === currentPlayer
            ) {
                const movedIds = cardTargetMode.movedPieceIds.map(id => String(id));
                const alreadyMoved = movedIds.includes(String(piece.id));
                const isSelectedForMove = piece === selectedPiece;
                const stillEligible =
                    !alreadyMoved &&
                    getPossibleMovesForDistance(piece, CARD_7_DISTANCE).length > 0;

                // Antes da escolha, TODAS as peças realmente disponíveis queimam.
                // As já escolhidas/movidas permanecem com fogo durante a sequência.
                if(stillEligible) {
                    element.classList.add("card7-target", "card7-fire");
                } else if(alreadyMoved || isSelectedForMove) {
                    element.classList.add("card7-fire");
                }
            }

            if(card7LingeringFireIds.has(card7FireKey(piece.player, piece.id))) {
                element.classList.add("card7-fire", "card7-fire-lingering");
            }


            if(
                piece === selectedPiece
            ) {

                element.classList.add(
                    "selected"
                );

            }


            const playerImage = document.createElement("img");
            playerImage.className = "piece-player-image";
            playerImage.src = getPlayerImagePath(piece.player, piece.role, !!piece.reserve);
            playerImage.alt = `${piece.role} do ${playerName(piece.player)}`;
            playerImage.draggable = false;
            playerImage.decoding = "async";

            playerImage.addEventListener("error", () => {
                element.classList.add("image-error");
            });

            const imageFallback = document.createElement("span");
            imageFallback.className = "piece-image-fallback";
            imageFallback.textContent = piece.role;

            element.appendChild(playerImage);
            element.appendChild(imageFallback);


            element.addEventListener(
                "click",
                event => {

                    event.stopPropagation();

                    selectPiece(
                        piece
                    );

                }
            );


            cell.appendChild(
                element
            );

        }
    );


    renderCards();
    updateInterface();

}


// ============================================================
// SELECIONAR PEÇA
// ============================================================

function selectPiece(
    piece
) {

    if(moveAnimationActive) return;
    if(isCpuTurn() && !formationSetupActive) {
        setMessage("🤖 Aguarde: a CPU REAL MADRID está jogando.");
        return;
    }

    if(formationSetupActive) {
        selectFormationPiece(piece);
        return;
    }

    if(cardTargetMode) {
        if(cardTargetMode.cardId === 1) {
            expelWithCard(piece);
        } else if(cardTargetMode.cardId === 2) {
            setMessage(
                cardTargetMode.phase === "chooseReserve"
                ? '🎽 Primeiro escolha um reserva no BANCO.'
                : '🎽 Agora clique em uma casa dourada vazia do seu campo de defesa.'
            );
        } else if(cardTargetMode.cardId === 3) {
            selectPieceForCard3(piece);
        } else if(cardTargetMode.cardId === 4) {
            selectPieceForCard4(piece);
        } else if(cardTargetMode.cardId === 7) {
            selectPieceForCard7(piece);
        } else if(cardTargetMode.cardId === 8) {
            setMessage('🚧 BLOQUEIO ativo: clique em uma casa LARANJA vazia da sua metade defensiva, exceto nas 3 casas à frente do seu gol.');
        } else if(cardTargetMode.cardId === 9) {
            retreatWithCard9(piece);
        }
        return;
    }

    if(
        winner !== null ||
        goalPause
    ) {

        return;

    }


    if(
        !diceRolled
    ) {

        setMessage(
            "🎲 Primeiro jogue o dado!"
        );

        return;

    }


    if(
        piece.player !== currentPlayer
    ) {

        setMessage(
            "Essa peça pertence ao adversário."
        );

        return;

    }


    selectedPiece =
        piece;


    const moves =
        getPossibleMoves(
            piece
        );


    if(
        moves.length === 0
    ) {

        setMessage(

            "Essa peça não consegue "
            +
            "andar "
            +
            diceValue
            +
            " casas."

        );

    } else {

        setMessage(

            "Escolha uma casa verde. "
            +
            "Movimento: "
            +
            diceValue
            +
            " casas."

        );

    }


    render();

}


// ============================================================
// CLICAR NO CAMPO
// ============================================================

function handleCellClick(
    row,
    col
) {

    if(cardVideoActive) return;
    if(isCpuTurn() && !formationSetupActive) {
        setMessage("🤖 Aguarde: a CPU REAL MADRID está jogando.");
        return;
    }

    if(moveAnimationActive) return;

    if(formationSetupActive) {
        handleFormationCellClick(row,col);
        return;
    }

    if(cardTargetMode && cardTargetMode.cardId === 3) {
        if(cardTargetMode.phase === "movePiece") {
            movePieceWithCard3(row,col);
        } else {
            setMessage('⚡ Primeiro escolha uma peça sua para usar a ARRANCADA FULMINANTE!');
        }
        return;
    }

    if(cardTargetMode && cardTargetMode.cardId === 4) {
        if(cardTargetMode.phase === "movePiece") {
            movePieceWithCard4(row,col);
        } else {
            setMessage('🤝 Primeiro escolha uma peça sua para usar o PASSE EM PROFUNDIDADE!');
        }
        return;
    }

    if(cardTargetMode && cardTargetMode.cardId === 7) {
        if(cardTargetMode.phase === "movePiece") {
            movePieceWithCard7(row,col);
        } else {
            setMessage('🎯 Primeiro escolha uma peça sua para usar a JOGADA ENSAIADA!');
        }
        return;
    }

    if(cardTargetMode && cardTargetMode.cardId === 8) {
        placeBlockWithCard(row,col);
        return;
    }

    if(cardTargetMode && cardTargetMode.cardId === 9) {
        setMessage('↩️ RECUO TÁTICO ativo: clique diretamente em uma peça adversária.');
        return;
    }

    if(cardTargetMode && cardTargetMode.cardId === 2) {
        if(cardTargetMode.phase === "placeReserve") {
            placeReserveWithCard(row,col);
        } else {
            setMessage('🎽 Primeiro escolha um jogador em RESERVAS ou EXPULSOS para entrar em campo.');
        }
        return;
    }

    if(!selectedPiece) {
        setMessage("🎲 Jogue o dado e escolha uma peça.");
        return;
    }

    if(!isValidMove(selectedPiece, row, col)) {
        setMessage("Movimento inválido para este resultado.");
        return;
    }

    const piece = selectedPiece;
    const movement = diceValue;
    const path = getAnimationPathForDistance(piece, row, col, movement);

    animatePieceAlongPath(piece, path.length ? path : [{ row, col }], () => {
        piece.row = row;
        piece.col = col;

        if(checkGoal(piece)) {
            registerGoal(currentPlayer, piece);
            return;
        }

        // Usa a troca de turno centralizada: ela reinicia o relógio
        // individual em 45 segundos antes de liberar o adversário.
        passTurn();
    });
}


// ============================================================
// VERIFICAR GOL
// ============================================================

function checkGoal(
    piece
) {

    // Real Madrid entrou no gol vermelho

    if(
        piece.player === 0 &&
        piece.row === -1 &&
        goalColumns.includes(
            piece.col
        )
    ) {

        return true;

    }


    // Barcelona entrou no gol azul

    if(
        piece.player === 1 &&
        piece.row === ROWS &&
        goalColumns.includes(
            piece.col
        )
    ) {

        return true;

    }


    return false;

}


// ============================================================
// CARTA 10 — CATIMBA
// ============================================================

function getCatimbaMovement(rawDice) {
    if(rawDice === 1) return 0;
    if(rawDice === 2 || rawDice === 3) return 1;
    if(rawDice === 4 || rawDice === 5) return 2;
    return 3;
}


// ============================================================
// DADO VISUAL
// ============================================================

const DICE_FACE_MAP = {
    1: [5],
    2: [1, 9],
    3: [1, 5, 9],
    4: [1, 3, 7, 9],
    5: [1, 3, 5, 7, 9],
    6: [1, 3, 4, 6, 7, 9]
};

function renderDiceFace(target, value = null) {

    const element = typeof target === "string"
        ? document.getElementById(target)
        : target;

    if(!element) return;

    const activePips = DICE_FACE_MAP[value] || [];

    element.classList.toggle("empty", !value);
    element.setAttribute("data-value", value || "");

    element.querySelectorAll(".pip").forEach((pip, index) => {
        const pipNumber = index + 1;
        pip.classList.toggle("active", activePips.includes(pipNumber));
    });

}

function showDiceValue(value) {
    renderDiceFace("diceTop", value);
    renderDiceFace("diceBottom", value);
}

function triggerDiceImpact() {
    ["diceTop", "diceBottom"].forEach(id => {
        const element = document.getElementById(id);
        if(!element) return;
        element.classList.remove("impact");
        void element.offsetWidth;
        element.classList.add("impact");
        setTimeout(() => element.classList.remove("impact"), 300);
    });
}

// ============================================================
// ÁUDIO DO DADO
// Arquivos esperados:
// audios/audio-dado-1.mp3
// audios/audio-dado-2.mp3
// ============================================================

const diceRollAudios = [
    new Audio("audios/audio-dado-1.mp3"),
    new Audio("audios/audio-dado-2.mp3")
];

let nextDiceRollAudioIndex = 0;

diceRollAudios.forEach(audio => {
    audio.preload = "auto";
});

function playNextDiceRollAudio() {
    const audio = diceRollAudios[nextDiceRollAudioIndex];
    nextDiceRollAudioIndex = (nextDiceRollAudioIndex + 1) % diceRollAudios.length;

    if(!audio) return;

    try {
        audio.pause();
        audio.currentTime = 0;
        const playPromise = audio.play();
        if(playPromise && typeof playPromise.catch === "function") {
            playPromise.catch(() => {});
        }
    } catch(error) {
        // Ignora falhas silenciosamente (ex.: bloqueio de autoplay do navegador).
    }
}

// ============================================================
// JOGAR DADO
// ============================================================

function rollDice() {

    if(periodBreakActive) {
        setMessage("⏱ Aguarde o início do próximo tempo.", 0);
        return;
    }

    if(kickoffDrawPending || kickoffRouletteSpinning) {
        setMessage("🎯 Primeiro defina o pontapé inicial na roleta.", 0);
        return;
    }

    if(cardVideoActive) return;

    if(moveAnimationActive) return;

    if(formationSetupActive) {
        setMessage(
            `${formationSetupPlayer === 1 ? "🔴" : "🔵"} ${playerName(formationSetupPlayer)}: confirme a formação antes de jogar o dado.`,
            0
        );
        return;
    }

    if(cardTargetMode) {
        setMessage(`🃏 Termine ou cancele a Carta “${cardName(cardTargetMode.cardId)}” antes de jogar o dado.`);
        return;
    }

    if(
        diceRolled ||
        winner !== null ||
        goalPause
    ) {

        return;

    }


    const top =
        document.getElementById(
            "diceTop"
        );


    const bottom =
        document.getElementById(
            "diceBottom"
        );


    const buttons =
        document.querySelectorAll(
            ".dice-button"
        );


    buttons.forEach(
        button => {

            button.disabled=true;

        }
    );


    top.classList.add(
        "rolling"
    );


    bottom.classList.add(
        "rolling"
    );


    playNextDiceRollAudio();


    let count=0;


    const animation =
        setInterval(
            () => {

                const value =
                    Math.floor(
                        Math.random()*6
                    )+1;


                showDiceValue(value);


                count++;


                if(
                    count>=8
                ) {

                    clearInterval(
                        animation
                    );


                    const rawDiceValue =
                        Math.floor(
                            Math.random()*6
                        )+1;

                    const catimbaApplied = catimbaPending[currentPlayer];

                    if(catimbaApplied) {
                        diceValue = getCatimbaMovement(rawDiceValue);
                        catimbaPending[currentPlayer] = false;
                        updateCatimbaTeamIndicators();
                    } else {
                        diceValue = rawDiceValue;
                    }


                    // O dado mostra o valor bruto; MOVIMENTO mostra o valor efetivo.
                    showDiceValue(rawDiceValue);


                    document.getElementById(
                        "diceValueTop"
                    ).textContent = diceValue;


                    top.classList.remove(
                        "rolling"
                    );


                    bottom.classList.remove(
                        "rolling"
                    );

                    triggerDiceImpact();


                    diceRolled=true;


                    if(catimbaApplied) {

                        const noBonusText = rawDiceValue === 6
                            ? ' O 6 NÃO gera Carta Bônus.'
                            : '';

                        setMessage(
                            `🐢 CATIMBA! Dado ${rawDiceValue} → movimento ${diceValue}.${noBonusText}`
                        );

                    } else if(rawDiceValue === 6) {

                        const cardDrawn = drawBonusCard(currentPlayer);

                        if(cardDrawn) {
                            if(cardDrawn === 1) {
                                setMessage(
                                    `🎲 Saiu 6! 🟥 TÁ NA RUA! — Expulse 1 adversário; o GO é protegido. Escolha uma peça ou use a carta.`
                                );
                            } else if(cardDrawn === 2) {
                                setMessage(
                                    `🎲 Saiu 6! 🎽 SANGUE NOVO! — Entre com 1 reserva ou reintegre 1 expulso até a 3ª linha defensiva. Escolha uma peça ou use a carta.`
                                );
                            } else if(cardDrawn === 3) {
                                setMessage(
                                    `🎲 Saiu 6! ⚡ ARRANCADA FULMINANTE! — Faça um movimento bônus de até ${CARD_3_DISTANCE} casas com qualquer peça sua.`
                                );
                            } else if(cardDrawn === 4) {
                                setMessage(
                                    `🎲 Saiu 6! 🤝 PASSE EM PROFUNDIDADE! — Faça um movimento bônus de até ${CARD_4_DISTANCE} casas com qualquer peça sua.`
                                );
                            } else if(cardDrawn === 7) {
                                setMessage(
                                    `🎲 Saiu 6! 🎯 JOGADA ENSAIADA! — Mova ${CARD_7_MOVES} jogadores seus, um por vez, até ${CARD_7_DISTANCE} casas cada.`
                                );
                            } else if(cardDrawn === 8) {
                                setMessage(
                                    `🎲 Saiu 6! 🚧 BLOQUEIO! — Coloque um BLOCK na sua metade defensiva, exceto nas 3 casas à frente do seu gol. Ele bloqueia os dois times até o próximo gol.`
                                );
                            } else if(cardDrawn === 9) {
                                setMessage(
                                    `🎲 Saiu 6! ↩️ RECUO TÁTICO! — Escolha 1 adversário; ele recua até ${CARD_9_RETREAT_DISTANCE} casas rumo à própria defesa.`
                                );
                            } else {
                                setMessage(
                                    `🎲 Saiu 6! 🐢 CATIMBA! — No próximo turno do rival, o dado será reduzido e o 6 não dará Carta Bônus.`
                                );
                            }
                        } else {
                            setMessage(
                                `🎲 Saiu 6! 🃏 Os 3 slots do ${playerName(currentPlayer)} já estão cheios. Escolha uma peça.`
                            );
                        }

                    } else {

                        setMessage(
                            "🎲 Saiu " + diceValue + "! Escolha uma peça."
                        );

                    }


                    if(catimbaApplied && diceValue === 0) {
                        setMessage(
                            `🐢 CATIMBA! Saiu 1 → anda 0 casas. ${playerName(currentPlayer)} perde esta vez.`
                        );

                        setTimeout(passTurn, 1400);
                        return;
                    }


                    // Verificar se existe
                    // alguma peça que possa andar

                    const movablePieces =
                        pieces.filter(
                            piece => {

                                return (

                                    piece.player ===
                                    currentPlayer &&

                                    getPossibleMoves(
                                        piece
                                    ).length > 0

                                );

                            }
                        );


                    if(
                        movablePieces.length === 0
                    ) {

                        setMessage(

                            "Nenhuma peça pode "
                            +
                            "andar "
                            +
                            diceValue
                            +
                            " casas. Passando a vez..."

                        );


                        setTimeout(
                            passTurn,
                            1400
                        );

                    } else if(isCpuTurn()) {
                        scheduleCpuAfterDice(720);
                    }

                }

            },
            70
        );

}


// ============================================================
// CRONÔMETROS — PARTIDA E TURNO
// ============================================================

function formatClock(ms) {
    const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2,"0")}:${String(seconds).padStart(2,"0")}`;
}

function getMatchPhaseText() {
    if(!matchClockRunning && formationSetupActive && formationSetupReason === "halftime") {
        return "INTERVALO • FORMAÇÃO";
    }
    if(
        !matchClockRunning &&
        (formationSetupActive || kickoffDrawPending || kickoffRouletteSpinning || initialKickoffPlayer === null)
    ) return "PRÉ-JOGO";
    if(matchPeriod === 1) return "1º TEMPO";
    if(matchPeriod === 2) return "2º TEMPO";
    return `${extraPeriodNumber}ª PRORR.`;
}

function isClockPlayActive() {
    return (
        matchClockRunning &&
        !periodBreakActive &&
        !formationSetupActive &&
        !kickoffDrawPending &&
        !kickoffRouletteSpinning &&
        !goalPause &&
        winner === null &&
        !cardVideoActive &&
        !moveAnimationActive &&
        !rankingOverlayOpen
    );
}

let lastClockUiState = {
    phase: null,
    matchText: null,
    matchClass: null,
    turnText: null,
    turnClass: null
};

function updateClockDisplays() {
    const matchClock = document.getElementById("matchClock");
    const phaseLabel = document.getElementById("matchPhaseLabel");
    const turnClock = document.getElementById("turnClock");

    const phase = getMatchPhaseText();
    const matchText = formatClock(matchTimeRemainingMs);
    const matchClass =
        matchTimeRemainingMs <= 20_000
            ? "danger"
            : matchTimeRemainingMs <= 60_000
                ? "warning"
                : "";

    const turnSeconds = Math.max(0, Math.ceil(turnTimeRemainingMs / 1000));
    const turnText = `⏱ ${turnSeconds}s`;
    const turnClass =
        turnSeconds <= 7
            ? "danger"
            : turnSeconds <= 15
                ? "warning"
                : "";

    if(phaseLabel && lastClockUiState.phase !== phase) {
        phaseLabel.textContent = phase;
        lastClockUiState.phase = phase;
    }

    if(matchClock) {
        if(lastClockUiState.matchText !== matchText) {
            matchClock.textContent = matchText;
            lastClockUiState.matchText = matchText;
        }

        if(lastClockUiState.matchClass !== matchClass) {
            matchClock.classList.toggle("warning", matchClass === "warning");
            matchClock.classList.toggle("danger", matchClass === "danger");
            lastClockUiState.matchClass = matchClass;
        }
    }

    if(turnClock) {
        if(lastClockUiState.turnText !== turnText) {
            turnClock.textContent = turnText;
            lastClockUiState.turnText = turnText;
        }

        if(lastClockUiState.turnClass !== turnClass) {
            turnClock.classList.toggle("warning", turnClass === "warning");
            turnClock.classList.toggle("danger", turnClass === "danger");
            lastClockUiState.turnClass = turnClass;
        }
    }
}

function resetTurnClock() {
    turnTimeRemainingMs = TURN_LIMIT_MS;
    turnTimeoutHandling = false;
    lastClockTickAt = Date.now();
    updateClockDisplays();
}

function startMatchClock() {
    matchClockRunning = true;
    periodBreakActive = false;
    lastClockTickAt = Date.now();
    resetTurnClock();

    if(!matchClockInterval) {
        matchClockInterval = setInterval(tickGameClocks, 200);
    }

    updateClockDisplays();
}

function stopMatchClock() {
    matchClockRunning = false;
    lastClockTickAt = Date.now();
    updateClockDisplays();
}

function cleanupInterruptedCardByClock() {
    if(
        cardTargetMode &&
        cardTargetMode.cardId === 7 &&
        cardTargetMode.movesDone > 0
    ) {
        const owner = cardTargetMode.player;
        const slotIndex = cardTargetMode.slotIndex;

        if(hands[owner] && hands[owner][slotIndex] === 7) {
            hands[owner].splice(slotIndex,1);
        }
    }

    cardTargetMode = null;
    selectedPiece = null;
}

function handleTurnTimeout() {
    if(turnTimeoutHandling || !isClockPlayActive()) return;

    turnTimeoutHandling = true;

    const expiredPlayer = currentPlayer;
    const expiredName = playerName(expiredPlayer);

    cleanupInterruptedCardByClock();

    setMessage(`⏱ Tempo do ${expiredName} esgotado! A vez passa automaticamente.`);

    setTimeout(() => {
        if(
            winner === null &&
            !goalPause &&
            !periodBreakActive &&
            currentPlayer === expiredPlayer
        ) {
            passTurn("timeout");
        }

        turnTimeoutHandling = false;
    }, 180);
}

function getPeriodKickoffPlayer(periodNumber) {
    if(initialKickoffPlayer === null) return currentPlayer;

    // Alterna quem começa cada período:
    // 1º = sorteado, 2º = rival, prorr.1 = sorteado, prorr.2 = rival...
    return periodNumber % 2 === 1
        ? initialKickoffPlayer
        : (initialKickoffPlayer === 0 ? 1 : 0);
}

function showPeriodOverlay(title, detail, buttonText, breakType) {
    periodBreakActive = true;
    periodBreakType = breakType;
    matchClockRunning = false;

    clearCpuTimers();
    cleanupInterruptedCardByClock();

    diceValue = null;
    diceRolled = false;
    resetDiceDisplay();

    const overlay = document.getElementById("periodOverlay");
    const titleEl = document.getElementById("periodTitle");
    const scoreEl = document.getElementById("periodScore");
    const detailEl = document.getElementById("periodDetail");
    const buttonEl = document.getElementById("periodButton");

    if(titleEl) titleEl.textContent = title;
    if(scoreEl) scoreEl.textContent = `${scoreRed} × ${scoreBlue}`;
    if(detailEl) detailEl.textContent = detail;
    if(buttonEl) buttonEl.textContent = buttonText;

    if(overlay) {
        overlay.classList.add("show");
        overlay.setAttribute("aria-hidden","false");
    }

    updateClockDisplays();
    render();
}

function hidePeriodOverlay() {
    const overlay = document.getElementById("periodOverlay");

    if(overlay) {
        overlay.classList.remove("show");
        overlay.setAttribute("aria-hidden","true");
    }
}

function getPiecesOnField(player) {
    return getActiveTeamPieceCount(player);
}

function finishTimedMatch(winningPlayer, reason, detail) {
    winner = winningPlayer;
    matchEndReason = reason;
    matchEndDetail = detail;
    goalPause = true;
    matchClockRunning = false;
    periodBreakActive = false;

    clearCpuTimers();
    cleanupInterruptedCardByClock();

    diceValue = null;
    diceRolled = false;
    resetDiceDisplay();

    setMessage(`🏆 ${playerName(winningPlayer)} venceu! ${detail}`);
    render();
    showVictory(true, winningPlayer);
}

function handleMatchPeriodEnd() {
    if(periodBreakActive || winner !== null) return;

    matchTimeRemainingMs = 0;
    matchClockRunning = false;
    updateClockDisplays();

    if(matchPeriod === 1) {
        showPeriodOverlay(
            "⏱ FIM DO 1º TEMPO",
            `Intervalo. Placar: ${getScoreLineText()}. Antes do 2º tempo, os dois times poderão reorganizar as peças que continuam em campo.`,
            "⚙ AJUSTAR FORMAÇÕES DO 2º TEMPO",
            "secondHalf"
        );
        return;
    }

    if(matchPeriod === 2) {
        if(scoreRed !== scoreBlue) {
            const winningPlayer = scoreBlue > scoreRed ? 0 : 1;

            finishTimedMatch(
                winningPlayer,
                "time",
                `Fim dos 20 minutos. Placar final: ${getScoreLineText()}.`
            );
            return;
        }

        showPeriodOverlay(
            "⚽ EMPATE • PRORROGAÇÃO",
            `Os 20 minutos terminaram empatados em ${scoreRed} × ${scoreBlue}. Será jogado um tempo extra de 5 minutos.`,
            "▶ INICIAR PRORROGAÇÃO • 5:00",
            "extra"
        );
        return;
    }

    // Fim de uma prorrogação.
    if(scoreRed !== scoreBlue) {
        const winningPlayer = scoreBlue > scoreRed ? 0 : 1;

        finishTimedMatch(
            winningPlayer,
            "time",
            `Fim da ${extraPeriodNumber}ª prorrogação. Placar: ${getScoreLineText()}.`
        );
        return;
    }

    const redPieces = getPiecesOnField(1);
    const bluePieces = getPiecesOnField(0);

    if(redPieces !== bluePieces) {
        const winningPlayer = bluePieces > redPieces ? 0 : 1;

        finishTimedMatch(
            winningPlayer,
            "pieces",
            `Placar empatado em ${scoreRed} × ${scoreBlue} após a ${extraPeriodNumber}ª prorrogação. Desempate por peças em campo: ${playerName(1)} ${redPieces} × ${bluePieces} ${playerName(0)}.`
        );
        return;
    }

    showPeriodOverlay(
        "⚖️ EMPATE TOTAL",
        `Placar ${scoreRed} × ${scoreBlue} e também ${redPieces} × ${bluePieces} peças em campo. Será jogada outra prorrogação de 5 minutos.`,
        "▶ MAIS 5 MINUTOS",
        "extra"
    );
}

function continueMatchPeriod() {
    if(!periodBreakActive || winner !== null) return;

    const requestedBreakType = periodBreakType;
    hidePeriodOverlay();

    if(requestedBreakType === "secondHalf") {
        matchPeriod = 2;
        extraPeriodNumber = 0;
        matchTimeRemainingMs = REGULATION_PERIOD_MS;
        beginHalftimeFormationSetup();
        return;
    }

    matchPeriod += 1;
    extraPeriodNumber += 1;
    matchTimeRemainingMs = EXTRA_PERIOD_MS;

    periodBreakActive = false;
    periodBreakType = null;

    currentPlayer = getPeriodKickoffPlayer(matchPeriod);
    cpuCardUsedThisTurn = false;
    selectedPiece = null;
    cardTargetMode = null;
    diceValue = null;
    diceRolled = false;
    resetDiceDisplay();

    setMessage(
        `▶ ${extraPeriodNumber}ª PRORROGAÇÃO! ${playerName(currentPlayer)} dará a saída.`,
        0
    );

    startMatchClock();
    render();
    scheduleCpuIfNeeded(750);
}

function tickGameClocks() {
    const now = Date.now();
    const elapsed = Math.max(0, Math.min(2000, now - lastClockTickAt));
    lastClockTickAt = now;

    if(!isClockPlayActive()) {
        updateClockDisplays();
        return;
    }

    matchTimeRemainingMs = Math.max(0, matchTimeRemainingMs - elapsed);
    turnTimeRemainingMs = Math.max(0, turnTimeRemainingMs - elapsed);

    updateClockDisplays();

    // Fim do tempo de jogo tem prioridade sobre o limite do turno.
    if(matchTimeRemainingMs <= 0) {
        handleMatchPeriodEnd();
        return;
    }

    if(turnTimeRemainingMs <= 0) {
        handleTurnTimeout();
    }
}

// ============================================================
// PASSAR A VEZ
// ============================================================

function passTurn(reason = "normal") {

    const outgoingPlayer = currentPlayer;

    if(isCpuMode() && currentPlayer === CPU_PLAYER) {
        cpuTurnsCompleted++;
    }

    cpuCardUsedThisTurn = false;

    currentPlayer =
        currentPlayer === 0
        ? 1
        : 0;

    diceValue = null;
    diceRolled = false;
    selectedPiece = null;
    cardTargetMode = null;

    resetDiceDisplay();
    resetTurnClock();

    if(reason === "timeout") {
        setMessage(
            `⏱ Tempo do ${playerName(outgoingPlayer)} esgotado! ${playerName(currentPlayer)} assume a vez.`
        );
    } else if(currentPlayer === 0) {
        setMessage(`🔵 ${playerName(0)}: jogue o dado.`);
    } else {
        setMessage(`🔴 ${playerName(1)}: jogue o dado.`);
    }

    render();
    scheduleCpuIfNeeded(850);
}


// ============================================================
// RESETAR DADO
// ============================================================

function resetDiceDisplay() {

    renderDiceFace("diceTop", null);


    renderDiceFace("diceBottom", null);


    document.getElementById(
        "diceValueTop"
    ).textContent="-";


    document.querySelectorAll(
        ".dice-button"
    ).forEach(
        button => {

            button.disabled=false;

        }
    );

}


// ============================================================
// PLACAR ELETRÔNICO
// ============================================================

function updateScoreboard() {

    document.getElementById("redScore").textContent = scoreRed;
    document.getElementById("blueScore").textContent = scoreBlue;

}


function animateScore(scoringPlayer) {

    const element = document.getElementById(
        scoringPlayer === 0 ? "blueScore" : "redScore"
    );

    element.classList.remove("flash");
    void element.offsetWidth;
    element.classList.add("flash");

    setTimeout(() => {
        element.classList.remove("flash");
    }, 1200);

}


function clearGoalCelebrationTimers() {
    goalCelebrationTimers.forEach(timer => clearTimeout(timer));
    goalCelebrationTimers = [];
}

function scheduleGoalCelebration(callback, delay) {
    const timer = setTimeout(() => {
        goalCelebrationTimers = goalCelebrationTimers.filter(item => item !== timer);
        callback();
    }, delay);

    goalCelebrationTimers.push(timer);
    return timer;
}

function clearGoalCelebrationVisuals(hideOverlay = false) {
    clearGoalCelebrationTimers();

    document.querySelector(".pitch-shell")?.classList.remove("goal-celebration");

    document.querySelectorAll(".goal-line").forEach(goal => {
        goal.classList.remove("goal-flash", "goal-flash-blue", "goal-flash-red");
    });

    document.getElementById("goalFxLayer")?.remove();
    document.getElementById("championConfettiLayer")?.remove();

    const overlay = document.getElementById("victoryOverlay");
    if(overlay) {
        overlay.classList.remove("goal-mode", "goal-blue", "goal-red", "goal-ready", "match-mode", "champion-mode");
        if(hideOverlay) overlay.classList.remove("show");
    }

    const championImage = document.getElementById("championImage");
    if(championImage) {
        championImage.removeAttribute("src");
    }
}

function launchGoalConfetti(scoringPlayer) {
    document.getElementById("goalFxLayer")?.remove();

    const layer = document.createElement("div");
    layer.id = "goalFxLayer";
    layer.className = "goal-fx-layer";

    const colors = scoringPlayer === 0
        ? ["#60a5fa", "#2563eb", "#93c5fd"]
        : ["#f87171", "#dc2626", "#fecaca"];

    for(let i = 0; i < 38; i++) {
        const particle = document.createElement("span");
        particle.className = "goal-confetti";
        particle.style.setProperty("--x", `${6 + Math.random() * 88}%`);
        particle.style.setProperty("--size", `${5 + Math.random() * 6}px`);
        particle.style.setProperty("--delay", `${Math.random() * 320}ms`);
        particle.style.setProperty("--duration", `${1650 + Math.random() * 850}ms`);
        particle.style.setProperty("--drift", `${-150 + Math.random() * 300}px`);
        particle.style.setProperty("--spin", `${360 + Math.random() * 760}deg`);
        particle.style.setProperty("--confetti-color", colors[Math.floor(Math.random() * colors.length)]);
        layer.appendChild(particle);
    }

    document.body.appendChild(layer);
}

function launchChampionConfetti(scoringPlayer) {
    document.getElementById("championConfettiLayer")?.remove();

    const layer = document.createElement("div");
    layer.id = "championConfettiLayer";
    layer.className = "champion-confetti-layer";

    const colors = scoringPlayer === 0
        ? ["#60a5fa", "#2563eb", "#1d4ed8", "#93c5fd"]
        : ["#f87171", "#dc2626", "#b91c1c", "#fecaca"];

    // Explosão inicial ao redor do troféu.
    for(let i = 0; i < 34; i++) {
        const particle = document.createElement("span");
        const angle = (Math.PI * 2 * i / 34) + (Math.random() * .24 - .12);
        const distance = 120 + Math.random() * 240;

        particle.className = "champion-confetti-burst";
        particle.style.setProperty("--size", `${6 + Math.random() * 7}px`);
        particle.style.setProperty("--delay", `${Math.random() * 120}ms`);
        particle.style.setProperty("--duration", `${900 + Math.random() * 520}ms`);
        particle.style.setProperty("--burst-x", `${Math.cos(angle) * distance}px`);
        particle.style.setProperty("--burst-y", `${Math.sin(angle) * distance}px`);
        particle.style.setProperty("--spin", `${540 + Math.random() * 900}deg`);
        particle.style.setProperty("--confetti-color", colors[Math.floor(Math.random() * colors.length)]);
        layer.appendChild(particle);
    }

    // Chuva de confetes após a explosão.
    for(let i = 0; i < 76; i++) {
        const particle = document.createElement("span");
        particle.className = "champion-confetti-rain";
        particle.style.setProperty("--x", `${2 + Math.random() * 96}%`);
        particle.style.setProperty("--size", `${5 + Math.random() * 7}px`);
        particle.style.setProperty("--delay", `${180 + Math.random() * 1750}ms`);
        particle.style.setProperty("--duration", `${2400 + Math.random() * 1800}ms`);
        particle.style.setProperty("--drift", `${-190 + Math.random() * 380}px`);
        particle.style.setProperty("--spin", `${540 + Math.random() * 1100}deg`);
        particle.style.setProperty("--confetti-color", colors[Math.floor(Math.random() * colors.length)]);
        layer.appendChild(particle);
    }

    document.body.appendChild(layer);
}


function startGoalFieldEffects(scoringPlayer) {
    const pitch = document.querySelector(".pitch-shell");
    const goal = document.getElementById(scoringPlayer === 0 ? "redGoal" : "blueGoal");

    pitch?.classList.add("goal-celebration");

    if(goal) {
        goal.classList.add("goal-flash");
        goal.classList.add(scoringPlayer === 0 ? "goal-flash-blue" : "goal-flash-red");
    }

    launchGoalConfetti(scoringPlayer);
}


// ============================================================
// REGISTRAR GOL / RECOMEÇAR A PARTIDA
// ============================================================

function registerGoal(scoringPlayer, scoringPiece = null) {

    if(goalPause || winner !== null) {
        return;
    }

    if(scoringPiece) {
        lastGoalScorer = {
            player: scoringPlayer,
            id: scoringPiece.id,
            role: scoringPiece.role,
            reserve: !!scoringPiece.reserve,
            image: getPlayerImagePath(
                scoringPlayer,
                scoringPiece.role,
                !!scoringPiece.reserve
            )
        };
    } else {
        lastGoalScorer = {
            player: scoringPlayer,
            id: null,
            role: "",
            reserve: false,
            image: ""
        };
    }

    // Um gol encerra qualquer efeito residual da Carta 7.
    // Evita que o fogo atravesse a recriação das peças após a saída de bola.
    clearCard7LingeringFire(false);

    if(scoringPlayer === 0) {
        scoreBlue++;
    } else {
        scoreRed++;
    }

    goalPause = true;
    selectedPiece = null;
    cardTargetMode = null;
    diceValue = null;
    diceRolled = false;

    // A Carta 8 dura exatamente até o PRÓXIMO GOL.
    const removedBlocks = clearBlocksAfterGoal();

    resetDiceDisplay();
    updateScoreboard();
    animateScore(scoringPlayer);

    const scoringName = playerName(scoringPlayer);
    const scoringEmoji = scoringPlayer === 0 ? "⚪" : "🔵🔴";
    const concedingName = playerName(scoringPlayer === 0 ? 1 : 0);

    const reachedFive =
        (scoringPlayer === 0 && scoreBlue >= WINNING_SCORE) ||
        (scoringPlayer === 1 && scoreRed >= WINNING_SCORE);

    if(reachedFive) {

        winner = scoringPlayer;
        matchEndReason = "goals";
        matchClockRunning = false;

        setMessage(
            `🏆 ${scoringName} venceu a partida por ${scoreRed} × ${scoreBlue}!` +
            (removedBlocks > 0 ? ` 🚧 ${removedBlocks} BLOCK${removedBlocks > 1 ? 'S foram removidos' : ' foi removido'} no gol final.` : '')
        );

        showVictory(true, scoringPlayer);
        return;

    }

    // Quem sofreu o gol começa a nova saída. A formação retorna depois
    // do primeiro impacto visual da comemoração.
    currentPlayer = scoringPlayer === 0 ? 1 : 0;

    setMessage(
        `${scoringEmoji} ⚽ GOL DO ${scoringName}! Placar: ${scoreRed} × ${scoreBlue}. ` +
        (removedBlocks > 0 ? `🚧 ${removedBlocks} BLOCK${removedBlocks > 1 ? 'S foram removidos' : ' foi removido'} com o gol. ` : '') +
        `${concedingName} dará a saída.`
    );

    showVictory(false, scoringPlayer);

    scheduleGoalCelebration(() => {
        createPieces();
        render();
    }, 850);

}


function continueAfterGoal() {

    if(winner !== null) {
        return;
    }

    // A saída após um gol é um novo turno para fins da inteligência da CPU.
    cpuCardUsedThisTurn = false;
    goalPause = false;
    resetTurnClock();

    clearGoalCelebrationVisuals(true);

    if(currentPlayer === 0) {
        setMessage(`🔵 ${teamShortName(0)}: jogue o dado. Placar ${getScoreLineText()}.`);
    } else {
        setMessage(`🔴 ${teamShortName(1)}: jogue o dado. Placar ${getScoreLineText()}.`);
    }

    render();
    scheduleCpuIfNeeded(950);

}


function handleOverlayButton() {

    if(winner !== null) {
        newGame();
    } else {
        continueAfterGoal();
    }

}


// ============================================================
// INTERFACE
// ============================================================

function updateCatimbaTeamIndicators() {
    applyTeamBranding();
}

function setTurnDisplay(label) {
    const turn = document.getElementById("turnText");
    if(!turn) return;

    turn.innerHTML = `${label} <span id="turnClock" class="turn-clock">⏱ ${Math.max(0,Math.ceil(turnTimeRemainingMs/1000))}s</span>`;
    updateClockDisplays();
}

function updateInterface() {

    updateScoreboard();
    updateCatimbaTeamIndicators();
    updateClockDisplays();

    const turn = document.getElementById("turnText");
    const blue = document.getElementById("bluePlayer");
    const red = document.getElementById("redPlayer");
    const confirmButton = document.getElementById("formationConfirmButton");

    blue.classList.remove("active");
    red.classList.remove("active");

    if(formationSetupActive) {
        const isRed = formationSetupPlayer === 1;

        setTurnDisplay(isRed ? `FORMAÇÃO ${playerName(1)}` : (isCpuMode() ? `CPU MONTANDO ${playerName(0)}` : `FORMAÇÃO ${playerName(0)}`));
        (isRed ? red : blue).classList.add("active");

        document.querySelectorAll(".dice-button").forEach(button => {
            button.disabled = true;
        });

        if(confirmButton) {
            confirmButton.classList.remove("hidden", "red-formation", "blue-formation");
            confirmButton.classList.add(isRed ? "red-formation" : "blue-formation");
            confirmButton.textContent = formationSetupReason === "halftime"
                ? (isRed ? `✓ CONFIRMAR ${playerName(1)} • 2º TEMPO` : `✓ CONFIRMAR ${playerName(0)} • 2º TEMPO`)
                : (isRed ? `✓ CONFIRMAR ${playerName(1)}` : `✓ CONFIRMAR ${playerName(0)}`);
            if(isCpuMode() && !isRed) confirmButton.classList.add("hidden");
        }

        return;
    }

    if(confirmButton) {
        confirmButton.classList.add("hidden");
    }

    if(kickoffDrawPending || kickoffRouletteSpinning) {
        setTurnDisplay("SORTEIO DO PONTAPÉ INICIAL");

        document.querySelectorAll(".dice-button").forEach(button => {
            button.disabled = true;
        });

        return;
    }

    if(currentPlayer === 0) {
        setTurnDisplay(isCpuMode() ? (cpuThinking ? `🤖 CPU ${playerName(0)} PENSANDO...` : `VEZ DA CPU • ${playerName(0)} 🤖`) : `VEZ DO ${playerName(0)}`);
        blue.classList.add("active");
    } else {
        setTurnDisplay(`VEZ DO ${playerName(1)}`);
        red.classList.add("active");
    }

    document.querySelectorAll(".dice-button").forEach(button => {
        button.disabled = isCpuTurn();
    });

}


// ============================================================
// MENSAGEM ROTATIVA + AÇÕES IMEDIATAS
// ============================================================

const INFO_ROTATION_INTERVAL = 4000;
const ACTION_MESSAGE_DURATION = 4000;

let messageRotationTimer = null;
let messageResumeTimer = null;
let messageAnimationTimer = null;
let manualMessageActive = false;
let lastRotatingInfo = "";

function getRotatingInfoMessages() {

    return [
        `🎲 Tire 6 para receber 1 Carta Bônus.`,
        `🃏 Probabilidades: C1 10% • C2 20% • C3 10% • C4 25% • C7 9% • C8 10% • C9 8% • C10 8%.`,
        `🟥 TÁ NA RUA! — Expulse 1 adversário. GO protegido.`,
        `🎽 SANGUE NOVO! — Entre com um reserva ou reintegre um expulso até a 3ª linha.`,
        `⚡ ARRANCADA FULMINANTE! — Movimento bônus de até 3 casas com qualquer peça sua.`,
        `🤝 PASSE EM PROFUNDIDADE! — Movimento bônus de até 2 casas com qualquer peça sua.`,
        `🎯 JOGADA ENSAIADA! — Mova 3 jogadores seus, um por vez, +3 casas cada.`,
        `🚧 BLOQUEIO — Coloque um BLOCK na sua metade defensiva, exceto nas 3 casas à frente do gol; ninguém atravessa até o próximo gol.`,
        `↩️ RECUO TÁTICO — Force 1 adversário a recuar até 5 casas rumo à própria defesa.`,
        `🐢 CATIMBA! — Próximo turno do rival: 1→0 • 2/3→1 • 4/5→2 • 6→3 e sem bônus no 6.`,
        catimbaPending[0] ? `🐢 ${playerName(0)} sofrerá CATIMBA no próximo dado.` : null,
        catimbaPending[1] ? `🐢 ${playerName(1)} sofrerá CATIMBA no próximo dado.` : null,
        `🚧 BLOCKS ativos no campo: ${blocks.length}.`,
        `⚽ Cada entrada no gol vale 1. Primeiro a 5 vence a partida.`,
        `🧤 GO só pode ficar nas 3 linhas defensivas do próprio lado.`,
        `📊 Placar atual: ${getScoreLineText()}.`,
        `🃏 Cartas na mão: ${playerName(1)} ${hands[1].length}/3 • ${playerName(0)} ${hands[0].length}/3.`,
        `🚨 Se um time ficar apenas com GO + 1 jogador, o adversário vence a partida.`
    ].filter(Boolean);

}

function animateMessageText(text) {

    const message = document.getElementById("message");

    if(!message)
        return;

    clearTimeout(messageAnimationTimer);

    message.classList.add("message-fade-out");

    messageAnimationTimer = setTimeout(
        () => {

            message.textContent = text;
            message.classList.remove("message-fade-out");
            message.classList.add("message-fade-in");

            messageAnimationTimer = setTimeout(
                () => {
                    message.classList.remove("message-fade-in");
                },
                460
            );

        },
        220
    );

}

function getNextRotatingInfo() {

    const messages = getRotatingInfoMessages();

    if(messages.length === 0)
        return "";

    const pool = messages.filter(
        info => info !== lastRotatingInfo
    );

    const options = pool.length ? pool : messages;

    const chosen = options[
        Math.floor(Math.random() * options.length)
    ];

    lastRotatingInfo = chosen;

    return chosen;

}

function scheduleInfoRotation() {

    clearTimeout(messageRotationTimer);

    if(
        manualMessageActive ||
        winner !== null
    ) {
        return;
    }

    messageRotationTimer = setTimeout(
        showRotatingInfo,
        INFO_ROTATION_INTERVAL
    );

}

function showRotatingInfo() {

    if(manualMessageActive)
        return;

    animateMessageText(
        getNextRotatingInfo()
    );

    scheduleInfoRotation();

}

function resumeInfoRotation() {

    manualMessageActive = false;
    showRotatingInfo();

}

function setMessage(
    text,
    holdMs = ACTION_MESSAGE_DURATION
) {

    clearTimeout(messageRotationTimer);
    clearTimeout(messageResumeTimer);

    manualMessageActive = true;

    animateMessageText(text);

    if(holdMs > 0) {

        messageResumeTimer = setTimeout(
            resumeInfoRotation,
            holdMs
        );

    }

}


// ============================================================
// TELA DE GOL / VITÓRIA DA PARTIDA
// ============================================================

function playNextGoalCelebrationAudio() {
    const audio = goalCelebrationAudios[nextGoalCelebrationAudioIndex];
    nextGoalCelebrationAudioIndex =
        (nextGoalCelebrationAudioIndex + 1) % goalCelebrationAudios.length;

    if(!audio) return;

    try {
        goalCelebrationAudios.forEach(item => {
            if(item !== audio) {
                item.pause();
                item.currentTime = 0;
            }
        });

        audio.pause();
        audio.currentTime = 0;
        const playPromise = audio.play();
        if(playPromise && typeof playPromise.catch === "function") {
            playPromise.catch(() => {});
        }
    } catch(error) {
        // Ignora falhas de reprodução silenciosamente.
    }
}

function playFinalVictoryAudio() {
    try {
        goalCelebrationAudios.forEach(item => {
            item.pause();
            item.currentTime = 0;
        });

        finalVictoryAudio.pause();
        finalVictoryAudio.currentTime = 0;
        const playPromise = finalVictoryAudio.play();
        if(playPromise && typeof playPromise.catch === "function") {
            playPromise.catch(() => {});
        }
    } catch(error) {
        // Ignora falhas de reprodução silenciosamente.
    }
}

function showVictory(matchEnded = false, scoringPlayer = currentPlayer) {

    if(matchEnded) {
        registerOfficialMatchToRanking(scoringPlayer);
    } else {
        setRankingSaveStatus("", "");
    }

    const overlay = document.getElementById("victoryOverlay");
    const title = document.getElementById("victoryTitle");
    const text = document.getElementById("victoryText");
    const button = document.getElementById("victoryButton");
    const rankingButton = document.getElementById("victoryRankingButton");

    if(rankingButton) {
        rankingButton.style.display = matchEnded ? "inline-flex" : "none";
    }

    const isBlue = scoringPlayer === 0;
    const name = playerName(scoringPlayer);
    const color = isBlue ? "#60a5fa" : "#f87171";
    const emoji = isBlue ? "⚪" : "🔵🔴";

    const goalIdentity = document.getElementById("goalIdentity");
    const goalClubLogo = document.getElementById("goalClubLogo");
    const goalScorerImage = document.getElementById("goalScorerImage");

    clearGoalCelebrationVisuals(false);
    title.style.color = color;

    if(goalIdentity) {
        goalIdentity.setAttribute("aria-hidden", "true");
    }

    if(goalClubLogo) {
        goalClubLogo.src = getTeamLogo(scoringPlayer) || "";
        goalClubLogo.alt = `Escudo do ${name}`;
    }

    if(goalScorerImage) {
        const scorerImage =
            lastGoalScorer && lastGoalScorer.player === scoringPlayer
                ? lastGoalScorer.image
                : "";

        goalScorerImage.src = scorerImage || "";
        goalScorerImage.alt =
            lastGoalScorer && lastGoalScorer.role
                ? `${lastGoalScorer.role} do ${name}, autor do gol`
                : `Jogador do ${name}, autor do gol`;

        goalScorerImage.style.display = scorerImage ? "block" : "none";
    }

    // Vitória por tempo ou desempate por peças:
    // usa a mesma apresentação visual de CAMPEÃO da vitória por 5 gols.
    if(matchEnded && (matchEndReason === "time" || matchEndReason === "pieces")) {
        playFinalVictoryAudio();

        const championImage = document.getElementById("championImage");

        overlay.classList.remove(
            "goal-blue","goal-red"
        );

        overlay.classList.add(
            "show",
            "goal-mode",
            "match-mode",
            "champion-mode",
            "goal-ready",
            isBlue ? "goal-blue" : "goal-red"
        );

        if(championImage) {
            championImage.src = isBlue
                ? "imagens/geral/img-champion-blue.png"
                : "imagens/geral/img-champion-red.png";

            championImage.alt = `Imagem do ${name}, campeão do CardBol`;
        }

        if(goalIdentity) {
            goalIdentity.setAttribute("aria-hidden", "true");
        }

        title.textContent = `${emoji} 🏆 ${name} CAMPEÃO!`;
        text.textContent =
            matchEndDetail ||
            `Fim de jogo. ${name} venceu por tempo. Placar: ${getScoreLineText()}.`;

        button.textContent = "NOVA PARTIDA • 0 × 0";

        launchChampionConfetti(scoringPlayer);
        return;
    }

    // Vitória por redução do elenco não é um gol, então mantém a tela tradicional.
    if(matchEnded && matchEndReason === "minimumPlayers") {
        playFinalVictoryAudio();
        overlay.classList.add("show");
        title.textContent = `${emoji} 🏆 ${name} VENCEU!`;
        const defeatedName = playerName(scoringPlayer === 0 ? 1 : 0);
        text.textContent =
            `Fim de jogo! ${defeatedName} ficou reduzido a GO + 1 jogador. Placar: ${getScoreLineText()}.`;
        button.textContent = "NOVA PARTIDA • 0 × 0";
        return;
    }

    if(matchEnded) {
        playFinalVictoryAudio();
    } else {
        playNextGoalCelebrationAudio();
    }

    overlay.classList.add("show", "goal-mode", isBlue ? "goal-blue" : "goal-red");

    if(goalIdentity) {
        goalIdentity.setAttribute("aria-hidden", "false");
    }

    startGoalFieldEffects(scoringPlayer);

    title.textContent = `${emoji} ⚽ GOOOOOOL DO ${name}!`;
    text.textContent =
        `${lastGoalScorer?.role ? `${lastGoalScorer.role} marcou para o ${name}! ` : `${name} marcou! `}` +
        `Placar: ${getScoreLineText()}.`;
    button.textContent = matchEnded ? "NOVA PARTIDA • 0 × 0" : "CONTINUAR PARTIDA";

    if(matchEnded) {
        scheduleGoalCelebration(() => {
            const championImage = document.getElementById("championImage");

            // Remove os confetes discretos do gol e inicia a celebração do título.
            document.getElementById("goalFxLayer")?.remove();

            overlay.classList.add("match-mode", "champion-mode", "goal-ready");

            if(championImage) {
                championImage.src = isBlue
                    ? "imagens/geral/img-champion-blue.png"
                    : "imagens/geral/img-champion-red.png";
                championImage.alt = `Troféu do ${name}, campeão do CardBol`;
            }

            title.textContent = `${emoji} 🏆 CAMPEÃO!`;
            text.textContent =
                `${name} chegou a ${WINNING_SCORE} gols e venceu a partida por ${scoreRed} × ${scoreBlue}.`;

            launchChampionConfetti(scoringPlayer);
        }, 1350);
    } else {
        scheduleGoalCelebration(() => {
            overlay.classList.add("goal-ready");
        }, 1150);
    }

}



// ============================================================
// MODO TELA CHEIA
// ============================================================

function getFullscreenElement() {
    return document.fullscreenElement || document.webkitFullscreenElement || null;
}

function updateFullscreenButton() {
    const button = document.getElementById("fullscreenButton");
    if(!button) return;

    const active = !!getFullscreenElement();
    button.textContent = active ? "⛶ SAIR DA TELA CHEIA" : "⛶ TELA CHEIA";
    button.classList.toggle("is-fullscreen", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
}

async function toggleFullscreen() {
    // A página inteira entra em fullscreen, e não apenas #gameRoot.
    // Assim os overlays de GOL e CAMPEÃO, que ficam fora do gameRoot,
    // continuam visíveis e clicáveis durante a tela cheia.
    const root = document.documentElement;

    try {
        if(!getFullscreenElement()) {
            if(root.requestFullscreen) {
                await root.requestFullscreen();
            } else if(root.webkitRequestFullscreen) {
                root.webkitRequestFullscreen();
            } else {
                setMessage("⛶ Este navegador não oferece suporte ao modo tela cheia.");
                return;
            }
        } else {
            if(document.exitFullscreen) {
                await document.exitFullscreen();
            } else if(document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            }
        }
    } catch(error) {
        setMessage("⛶ Não foi possível ativar a tela cheia. Tente novamente pelo botão.");
    }
}

document.addEventListener("fullscreenchange", updateFullscreenButton);
document.addEventListener("webkitfullscreenchange", updateFullscreenButton);


// ============================================================
// NOVO JOGO
// ============================================================

function newGame() {

    // Cada partida oficial recebe uma chave única.
    // Isso impede duplicidade no Supabase.
    currentMatchKey = createCardBolMatchKey();
    matchRankingSubmissionStarted = false;
    setRankingSaveStatus("", "");
    closeRankingOverlay();

    lastCardsRenderSignature = "";
    benchCarouselRenderSignatures = {};

    stopKickoffRouletteAudio();

    card8BlockAudio.pause();
    card8BlockAudio.currentTime = 0;

    card10CatimbaAudio.pause();
    card10CatimbaAudio.currentTime = 0;
    clearCpuTimers();
    cpuTurnsCompleted = 0;

    if(card7LingeringFireTimer) {
        clearTimeout(card7LingeringFireTimer);
        card7LingeringFireTimer = null;
    }
    card7LingeringFireIds.clear();

    document.getElementById("cardSpecialFxLayer")?.remove();

    finalVictoryAudio.pause();
    finalVictoryAudio.currentTime = 0;

    clearGoalCelebrationVisuals(true);

    if(activeMoveAnimation) {
        activeMoveAnimation.cancel();
        activeMoveAnimation = null;
    }
    moveAnimationActive = false;
    document.querySelector(".game-container")?.classList.remove("move-in-progress");

    currentPlayer = 0;
    selectedPiece = null;

    matchPeriod = 1;
    extraPeriodNumber = 0;
    matchTimeRemainingMs = REGULATION_PERIOD_MS;
    turnTimeRemainingMs = TURN_LIMIT_MS;
    matchClockRunning = false;
    periodBreakActive = false;
    periodBreakType = null;
    initialKickoffPlayer = null;
    turnTimeoutHandling = false;
    matchEndDetail = "";
    lastClockTickAt = Date.now();

    const periodOverlay = document.getElementById("periodOverlay");
    if(periodOverlay) {
        periodOverlay.classList.remove("show");
        periodOverlay.setAttribute("aria-hidden","true");
    }

    kickoffDrawPending = false;
    kickoffRouletteSpinning = false;
    kickoffResolved = false;

    const kickoffOverlay = document.getElementById("kickoffOverlay");
    if(kickoffOverlay) {
        kickoffOverlay.classList.remove("show", "finishing");
        kickoffOverlay.setAttribute("aria-hidden", "true");
    }

    formationSetupActive = true;
    formationSetupPlayer = 1;
    formationSelectedPiece = null;
    formationSetupReason = "initial";
    startingFormation = [{}, {}];
    winner = null;
    matchEndReason = null;
    scoreBlue = 0;
    scoreRed = 0;
    lastGoalScorer = null;
    goalPause = false;
    diceValue = null;
    diceRolled = false;
    cardTargetMode = null;
    hands = [[], []];
    catimbaPending = [false, false];
    reserveAvailable = [new Set(RESERVE_ROLES), new Set(RESERVE_ROLES)];
    reserveInPlay = [[], []];
    expelledPlayers = [new Map(), new Map()];
    benchCarouselIndexes = {
        redReserves: 0,
        redExpelled: 0,
        blueReserves: 0,
        blueExpelled: 0
    };
    blocks = [];
    nextBlockId = 1;

    createFormationSetupPieces();
    resetDiceDisplay();
    updateScoreboard();

    document
        .getElementById("victoryOverlay")
        .classList
        .remove("show");

    setMessage(
        `🔴 ${playerName(1)} define a formação: GO 1ª-3ª • ZG/LE/LD 4ª-5ª • ME/MD 6ª-7ª • ATK 8ª-9ª.`,
        0
    );

    render();

}


// ============================================================
// ROLETA DO PONTAPÉ INICIAL
// ============================================================

function getKickoffSectors() {
    return [
        { player: 0, name: playerName(0), emoji: "🔵" },
        { player: 1, name: playerName(1), emoji: "🔴" },
        { player: 0, name: playerName(0), emoji: "🔵" },
        { player: 1, name: playerName(1), emoji: "🔴" },
        { player: 0, name: playerName(0), emoji: "🔵" },
        { player: 1, name: playerName(1), emoji: "🔴" },
        { player: 0, name: playerName(0), emoji: "🔵" },
        { player: 1, name: playerName(1), emoji: "🔴" }
    ];
}

function showKickoffRoulette() {
    const overlay = document.getElementById("kickoffOverlay");
    const wheel = document.getElementById("kickoffWheel");
    const button = document.getElementById("kickoffButton");
    const result = document.getElementById("kickoffResult");

    if(!overlay || !wheel) return;

    kickoffDrawPending = true;
    kickoffResolved = false;
    kickoffRouletteSpinning = false;

    overlay.classList.remove("finishing");
    overlay.classList.add("show");
    overlay.setAttribute("aria-hidden", "false");

    wheel.style.transition = "none";
    wheel.style.transform = "rotate(0deg)";

    if(result) {
        result.className = "kickoff-result";
        result.textContent = "Quem dará o primeiro toque?";
    }

    if(button) {
        button.disabled = false;
        button.textContent = "🎯 Definir Pontapé Inicial";
    }

    document.querySelectorAll(".dice-button").forEach(diceButton => {
        diceButton.disabled = true;
    });
}

function closeKickoffRoulette() {
    const overlay = document.getElementById("kickoffOverlay");
    if(!overlay) return;

    overlay.classList.add("finishing");

    setTimeout(() => {
        overlay.classList.remove("show", "finishing");
        overlay.setAttribute("aria-hidden", "true");
    }, 390);
}

function playKickoffRouletteAudio() {
    try {
        kickoffRouletteAudio.pause();
        kickoffRouletteAudio.currentTime = 0;
        kickoffRouletteAudio.volume = 1;
        kickoffRouletteAudio.loop = true;

        const playPromise = kickoffRouletteAudio.play();
        if(playPromise && typeof playPromise.catch === "function") {
            playPromise.catch(() => {});
        }
    } catch(error) {
        // Falha de áudio não interfere no sorteio.
    }
}

function stopKickoffRouletteAudio() {
    try {
        kickoffRouletteAudio.pause();
        kickoffRouletteAudio.currentTime = 0;
    } catch(error) {
        // Ignora falhas de mídia.
    }
}

function spinKickoffRoulette() {
    if(!kickoffDrawPending || kickoffRouletteSpinning || kickoffResolved) return;

    const overlay = document.getElementById("kickoffOverlay");
    const wheel = document.getElementById("kickoffWheel");
    const button = document.getElementById("kickoffButton");
    const result = document.getElementById("kickoffResult");

    if(!overlay || !wheel) return;

    kickoffRouletteSpinning = true;
    playKickoffRouletteAudio();

    if(button) {
        button.disabled = true;
        button.textContent = "🎯 SORTEANDO...";
    }

    if(result) {
        result.className = "kickoff-result";
        result.textContent = "A bola vai rolar...";
    }

    // 8 setores iguais: 4 do lado azul + 4 do lado vermelho.
    const sectors = getKickoffSectors();
    const sectorIndex = Math.floor(Math.random() * sectors.length);
    const sector = sectors[sectorIndex];

    // Centro do setor escolhido. O ponteiro fica no topo (0°).
    const sectorCenter = sectorIndex * 45 + 22.5;

    // Múltiplas voltas completas + alinhamento final.
    // ease-in-out: começa devagar, ganha velocidade e desacelera no fim.
    const fullTurns = 7 + Math.floor(Math.random() * 3);
    const finalRotation = fullTurns * 360 - sectorCenter;

    wheel.style.transition = "none";
    wheel.style.transform = "rotate(0deg)";
    void wheel.offsetWidth;

    wheel.style.transition = "transform 5s cubic-bezier(.42, 0, .58, 1)";
    wheel.style.transform = `rotate(${finalRotation}deg)`;

    setTimeout(() => {
        stopKickoffRouletteAudio();
        kickoffRouletteSpinning = false;
        kickoffResolved = true;
        kickoffDrawPending = false;

        currentPlayer = sector.player;
        initialKickoffPlayer = sector.player;
        matchPeriod = 1;
        extraPeriodNumber = 0;
        matchTimeRemainingMs = REGULATION_PERIOD_MS;
        diceValue = null;
        diceRolled = false;

        if(result) {
            result.className = `kickoff-result ${sector.player === 0 ? "blue-result" : "red-result"}`;
            result.textContent = `${sector.emoji} ${sector.name} COMEÇA!`;
        }

        if(button) {
            button.textContent = `${sector.emoji} ${sector.name} DÁ A SAÍDA`;
        }

        setMessage(
            `${sector.emoji} ${sector.name} venceu o sorteio e dará o pontapé inicial! Jogue o dado.`,
            0
        );

        render();

        // Deixa o resultado à vista por um instante antes de liberar o campo.
        setTimeout(() => {
            closeKickoffRoulette();
            startMatchClock();

            if(isCpuTurn()) {
                document.querySelectorAll(".dice-button").forEach(diceButton => { diceButton.disabled = true; });
                scheduleCpuIfNeeded(650);
            } else {
                document.querySelectorAll(".dice-button").forEach(diceButton => { diceButton.disabled = false; });
            }
        }, 1150);
    }, 5000);
}

// ============================================================
// TELA DE ABERTURA
// ============================================================

let openingAudioFadeTimer = null;
let openingPresentationStarted = false;
let openingPresentationFinished = false;

function revealOpeningPlayButton(label = "⚽ BATER UMA PELADA") {
    const button = document.getElementById("openingPlayButton");
    if(!button) return;

    button.textContent = label;
    button.disabled = false;
    button.style.pointerEvents = "auto";
    button.classList.add("ready");
}

function hideOpeningPlayButton() {
    const button = document.getElementById("openingPlayButton");
    if(!button) return;

    button.classList.remove("ready");
    button.disabled = true;
    button.style.pointerEvents = "none";
}

function showOpeningDisplayChoices() {
    const choices = document.getElementById("openingDisplayChoices");
    if(!choices) return;

    choices.classList.remove("hidden");
    choices.setAttribute("aria-hidden", "false");
}

function hideOpeningDisplayChoices() {
    const choices = document.getElementById("openingDisplayChoices");
    if(!choices) return;

    choices.classList.add("hidden");
    choices.setAttribute("aria-hidden", "true");
}

function requestOpeningFullscreen() {
    const root = document.documentElement;

    try {
        if(getFullscreenElement()) {
            updateFullscreenButton();
            return;
        }

        if(root.requestFullscreen) {
            const promise = root.requestFullscreen();
            if(promise && typeof promise.catch === "function") {
                promise.catch(() => {
                    // Alguns navegadores móveis não permitem fullscreen
                    // em páginas comuns. A apresentação continua normalmente.
                });
            }
        } else if(root.webkitRequestFullscreen) {
            root.webkitRequestFullscreen();
        }
    } catch(error) {
        // Não interrompe a apresentação se fullscreen não for suportado.
    }
}

function chooseOpeningDisplayMode(mode) {
    if(openingPresentationStarted) return;

    hideOpeningDisplayChoices();

    // As duas ações abaixo acontecem diretamente dentro do clique do usuário.
    // Isso preserva a permissão do navegador tanto para áudio quanto para fullscreen.
    if(mode === "fullscreen") {
        requestOpeningFullscreen();
    }

    startOpeningPresentation();
}

function startOpeningPresentation() {
    if(openingPresentationStarted) return;

    const video = document.getElementById("openingVideo");
    const audio = document.getElementById("openingAudio");

    if(!video || !audio) return;

    openingPresentationStarted = true;
    openingPresentationFinished = false;
    hideOpeningDisplayChoices();
    hideOpeningPlayButton();

    video.muted = true;
    video.loop = false;
    video.currentTime = 0;

    audio.loop = true;
    audio.volume = 1;
    audio.currentTime = 0;

    // Este método é chamado diretamente por um clique do usuário.
    // Assim o navegador permite áudio com som e vídeo ao mesmo tempo.
    const audioPromise = audio.play();
    if(audioPromise && typeof audioPromise.catch === "function") {
        audioPromise.catch(() => {
            // Se ainda houver alguma restrição específica do navegador,
            // mantém o vídeo funcionando e não prende a abertura.
        });
    }

    const videoPromise = video.play();
    if(videoPromise && typeof videoPromise.catch === "function") {
        videoPromise.catch(() => {
            openingPresentationFinished = true;
            revealOpeningPlayButton();
        });
    }
}

function fadeOutOpeningAudio(duration = 1000, onFinish = null) {
    const audio = document.getElementById("openingAudio");

    if(openingAudioFadeTimer) {
        clearInterval(openingAudioFadeTimer);
        openingAudioFadeTimer = null;
    }

    if(!audio || audio.paused) {
        if(audio) {
            audio.pause();
            audio.currentTime = 0;
            audio.volume = 1;
        }
        if(typeof onFinish === "function") onFinish();
        return;
    }

    const startVolume = Math.max(0, Math.min(1, audio.volume));
    const startedAt = performance.now();

    openingAudioFadeTimer = setInterval(() => {
        const progress = Math.min(1, (performance.now() - startedAt) / duration);
        audio.volume = Math.max(0, startVolume * (1 - progress));

        if(progress >= 1) {
            clearInterval(openingAudioFadeTimer);
            openingAudioFadeTimer = null;
            audio.pause();
            audio.currentTime = 0;
            audio.volume = 1;

            if(typeof onFinish === "function") onFinish();
        }
    }, 30);
}

function initOpeningScreen() {
    const screen = document.getElementById("openingScreen");
    const video = document.getElementById("openingVideo");
    const audio = document.getElementById("openingAudio");

    if(!screen || !video || !audio) return;

    video.muted = true;
    video.loop = false;
    video.pause();

    audio.loop = true;
    audio.pause();
    audio.currentTime = 0;
    audio.volume = 1;

    openingPresentationStarted = false;
    openingPresentationFinished = false;

    // A escolha entre TELA CHEIA e MODO NORMAL é agora o primeiro clique.
    // Esse gesto já libera o áudio do navegador e, quando escolhido,
    // também solicita fullscreen.
    hideOpeningPlayButton();
    showOpeningDisplayChoices();

    // Ao terminar, o vídeo fica naturalmente parado no último frame.
    // O áudio continua em loop até BATER UMA PELADA ser clicado.
    video.addEventListener("ended", () => {
        video.pause();
        openingPresentationFinished = true;
        revealOpeningPlayButton("⚽ BATER UMA PELADA");
    });
}

function handleOpeningButton() {
    if(openingPresentationFinished) {
        enterCardBolGame();
    }
}

function enterCardBolGame() {
    const screen = document.getElementById("openingScreen");
    const video = document.getElementById("openingVideo");
    const button = document.getElementById("openingPlayButton");

    if(!screen || !openingPresentationFinished) return;

    if(button) {
        button.disabled = true;
        button.style.pointerEvents = "none";
    }

    if(video) video.pause();

    // Fade-out real de 1 segundo antes de liberar o jogo.
    screen.classList.add("closing");

    fadeOutOpeningAudio(1000, () => {
        screen.style.display = "none";
        applyTeamBranding();
        showPlayerIdentityOverlay();
    });
}

// Mantém o campo PIN estritamente numérico também em colagens.
const playerPinInput = document.getElementById("playerPinInput");
if(playerPinInput) {
    playerPinInput.addEventListener("input", () => normalizePinInput(playerPinInput));
}

// ============================================================
// INICIAR
// ============================================================

createFormationSetupPieces();

createBoard();

createGoalHandlers();

updateScoreboard();

resetDiceDisplay();

updateFullscreenButton();

applyTeamBranding();
render();

setMessage(
    "⚽ Escolha o modo de jogo após a abertura.",
    0
);

initOpeningScreen();
startBenchCarousels();


// Mantém os mostradores vivos desde o carregamento; o tempo só desconta
// quando isClockPlayActive() retorna true.
if(!matchClockInterval) {
    matchClockInterval = setInterval(tickGameClocks, 200);
}
updateClockDisplays();
