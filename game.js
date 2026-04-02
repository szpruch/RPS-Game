// TODO: replace with Render URL after deploy
const SERVER_URL = 'http://localhost:3000';

// ── Constants ─────────────────────────────────────────────────────────────

const CHOICES = ['rock', 'paper', 'scissors'];

const ICONS = {
  rock:     '🪨',
  paper:    '📄',
  scissors: '✂️',
};

// outcome[player][opponent] => 'win' | 'lose' | 'draw'
const OUTCOME = {
  rock:     { rock: 'draw', paper: 'lose', scissors: 'win'  },
  paper:    { rock: 'win',  paper: 'draw', scissors: 'lose' },
  scissors: { rock: 'lose', paper: 'win',  scissors: 'draw' },
};

const RESULT_MESSAGES = {
  win:  ['You win!', 'Nice one!', 'Crushed it!', 'You got em!'],
  lose: ['Opponent wins!', 'So close...', 'Better luck next time!', 'They win this round!'],
  draw: ["It's a draw!", 'Great minds think alike.', 'Dead even!'],
};

const CPU_RESULT_MESSAGES = {
  win:  ['You win!', 'Nice one!', 'Crushed it!', 'You got em!'],
  lose: ['CPU wins!', 'So close...', 'Better luck next time!', 'CPU wins this round!'],
  draw: ["It's a draw!", 'Great minds think alike.', 'Dead even!'],
};

// ── State ─────────────────────────────────────────────────────────────────

const state = {
  mode: null,           // 'cpu' | 'multiplayer'
  socket: null,         // Socket.io instance (multiplayer only)
  roomCode: null,       // string (multiplayer only)
  scores: { player: 0, opponent: 0 },
  locked: false,        // prevents double-clicks / input during animation
  waitingForOpponent: false,
};

// ── DOM refs ──────────────────────────────────────────────────────────────

const screens = {
  home:    document.getElementById('screen-home'),
  lobby:   document.getElementById('screen-lobby'),
  waiting: document.getElementById('screen-waiting'),
  game:    document.getElementById('screen-game'),
};

// Home
const btnVsCpu    = document.getElementById('btn-vs-cpu');
const btnVsPlayer = document.getElementById('btn-vs-player');

// Lobby
const lobbyBack      = document.getElementById('lobby-back');
const btnCreateRoom  = document.getElementById('btn-create-room');
const joinCodeInput  = document.getElementById('join-code-input');
const btnJoinRoom    = document.getElementById('btn-join-room');
const lobbyError     = document.getElementById('lobby-error');

// Waiting
const waitingBack    = document.getElementById('waiting-back');
const waitingCode    = document.getElementById('waiting-code');

// Game
const gameBack           = document.getElementById('game-back');
const gameStatusBar      = document.getElementById('game-status-bar');
const statusModeLabel    = document.getElementById('status-mode-label');
const statusRoomCode     = document.getElementById('status-room-code');
const playerScoreEl      = document.getElementById('player-score');
const cpuScoreEl         = document.getElementById('cpu-score');
const opponentScoreLabel = document.getElementById('opponent-score-label');
const playerIconEl       = document.getElementById('player-icon');
const cpuIconEl          = document.getElementById('cpu-icon');
const cpuDisplayLabel    = document.getElementById('cpu-display-label');
const playerDisplay      = document.getElementById('player-display');
const cpuDisplay         = document.getElementById('cpu-display');
const resultBanner       = document.getElementById('result-banner');
const resultText         = document.getElementById('result-text');
const choiceBtns         = document.querySelectorAll('.choice-btn');
const resetBtn           = document.getElementById('reset-btn');
const mpWaitingMsg       = document.getElementById('mp-waiting-msg');

// ── Screen navigation ─────────────────────────────────────────────────────

function showScreen(id) {
  Object.values(screens).forEach(s => s.classList.add('hidden'));
  screens[id].classList.remove('hidden');
}

// ── Utilities ─────────────────────────────────────────────────────────────

function randomChoice() {
  return CHOICES[Math.floor(Math.random() * CHOICES.length)];
}

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function setButtonsDisabled(disabled) {
  choiceBtns.forEach(btn => { btn.disabled = disabled; });
}

function clearStates() {
  ['win', 'lose', 'draw', 'shake', 'pulse'].forEach(cls => {
    playerDisplay.classList.remove(cls);
    cpuDisplay.classList.remove(cls);
  });
  resultBanner.classList.remove('win', 'lose', 'draw');
  choiceBtns.forEach(btn => btn.classList.remove('selected'));
}

function bumpScore(el) {
  el.classList.remove('bump');
  void el.offsetWidth; // reflow to re-trigger
  el.classList.add('bump');
  el.addEventListener('transitionend', () => el.classList.remove('bump'), { once: true });
}

function showLobbyError(msg) {
  lobbyError.textContent = msg;
  lobbyError.classList.remove('hidden');
}

function hideLobbyError() {
  lobbyError.classList.add('hidden');
  lobbyError.textContent = '';
}

// ── Score helpers ─────────────────────────────────────────────────────────

function resetGameUI() {
  state.scores = { player: 0, opponent: 0 };
  playerScoreEl.textContent = '0';
  cpuScoreEl.textContent    = '0';
  playerIconEl.textContent  = '❓';
  cpuIconEl.textContent     = '❓';
  resultText.textContent    = 'Pick your move!';
  clearStates();
  state.locked = false;
  state.waitingForOpponent = false;
  mpWaitingMsg.classList.add('hidden');
  setButtonsDisabled(false);
}

// ── Reveal animation (shared by both modes) ───────────────────────────────

/**
 * Animates the result onto the board.
 * @param {string} playerChoice
 * @param {string} opponentChoice
 * @param {string} outcome  'win' | 'lose' | 'draw'
 * @param {boolean} isCpu   use CPU-flavoured messages?
 */
function revealResult(playerChoice, opponentChoice, outcome, isCpu) {
  // Opponent side reveal
  cpuIconEl.textContent = ICONS[opponentChoice];
  cpuIconEl.classList.remove('reveal');
  void cpuIconEl.offsetWidth;
  cpuIconEl.classList.add('reveal');

  // Outcome styling
  resultBanner.classList.add(outcome);
  const messages = isCpu ? CPU_RESULT_MESSAGES : RESULT_MESSAGES;
  resultText.textContent = randomFrom(messages[outcome]);

  if (outcome === 'win') {
    playerDisplay.classList.add('win', 'pulse');
    cpuDisplay.classList.add('lose', 'shake');
    state.scores.player++;
    playerScoreEl.textContent = state.scores.player;
    bumpScore(playerScoreEl);
  } else if (outcome === 'lose') {
    cpuDisplay.classList.add('win', 'pulse');
    playerDisplay.classList.add('lose', 'shake');
    state.scores.opponent++;
    cpuScoreEl.textContent = state.scores.opponent;
    bumpScore(cpuScoreEl);
  } else {
    playerDisplay.classList.add('draw');
    cpuDisplay.classList.add('draw');
  }

  state.locked = false;
}

// ── Single-player logic ───────────────────────────────────────────────────

function playCpu(playerChoice) {
  if (state.locked) return;
  state.locked = true;

  clearStates();

  choiceBtns.forEach(btn => {
    if (btn.dataset.choice === playerChoice) btn.classList.add('selected');
  });

  // Show player choice immediately
  playerIconEl.textContent = ICONS[playerChoice];
  playerIconEl.classList.remove('reveal');
  void playerIconEl.offsetWidth;
  playerIconEl.classList.add('reveal');

  // Suspense spinner for CPU
  cpuIconEl.textContent = '❓';
  let ticks = 0;
  const maxTicks = 8;
  const interval = setInterval(() => {
    cpuIconEl.textContent = ICONS[randomChoice()];
    ticks++;
    if (ticks >= maxTicks) {
      clearInterval(interval);
      const cpuChoice = randomChoice();
      const outcome   = OUTCOME[playerChoice][cpuChoice];
      revealResult(playerChoice, cpuChoice, outcome, true);
    }
  }, 80);
}

// ── Multiplayer logic ─────────────────────────────────────────────────────

function connectSocket() {
  if (state.socket && state.socket.connected) return;

  state.socket = io(SERVER_URL, { transports: ['websocket', 'polling'] });

  state.socket.on('connect_error', () => {
    showLobbyError('Cannot reach server. Is it running?');
  });

  // ── room_created ───────────────────────────────────────────────────────
  state.socket.on('room_created', (code) => {
    state.roomCode = code;
    waitingCode.textContent = code;
    showScreen('waiting');
  });

  // ── game_start ─────────────────────────────────────────────────────────
  state.socket.on('game_start', () => {
    enterGameScreen('multiplayer');
  });

  // ── opponent_moved ─────────────────────────────────────────────────────
  // The other player submitted their choice; we haven't yet
  state.socket.on('opponent_moved', () => {
    // Only show the banner if we haven't moved yet (i.e. still unlocked)
    // If we already moved, we're already showing the waiting message
    if (!state.waitingForOpponent) {
      // Opponent moved first; just update the cpu icon to signal activity
      cpuIconEl.textContent = '🤔';
    }
  });

  // ── round_result ───────────────────────────────────────────────────────
  state.socket.on('round_result', ({ yourChoice, opponentChoice, outcome }) => {
    state.waitingForOpponent = false;
    mpWaitingMsg.classList.add('hidden');
    setButtonsDisabled(false);

    // Show our choice (might already be shown, but set it cleanly)
    playerIconEl.textContent = ICONS[yourChoice];
    playerIconEl.classList.remove('reveal');
    void playerIconEl.offsetWidth;
    playerIconEl.classList.add('reveal');

    // Animate the opponent reveal with the spinner effect then reveal
    cpuIconEl.textContent = '❓';
    let ticks = 0;
    const maxTicks = 6;
    const interval = setInterval(() => {
      cpuIconEl.textContent = ICONS[randomChoice()];
      ticks++;
      if (ticks >= maxTicks) {
        clearInterval(interval);
        revealResult(yourChoice, opponentChoice, outcome, false);
      }
    }, 80);
  });

  // ── opponent_left ──────────────────────────────────────────────────────
  state.socket.on('opponent_left', () => {
    alert('Your opponent has left the game.');
    leaveToHome();
  });

  // ── error ──────────────────────────────────────────────────────────────
  state.socket.on('error', (msg) => {
    showLobbyError(msg);
    // If we're on the waiting screen, go back to lobby
    if (!screens.lobby.classList.contains('hidden') === false) {
      showScreen('lobby');
    }
  });
}

function disconnectSocket() {
  if (state.socket) {
    state.socket.disconnect();
    state.socket = null;
  }
  state.roomCode = null;
}

function playMultiplayer(playerChoice) {
  if (state.locked || state.waitingForOpponent) return;
  state.locked = true;
  state.waitingForOpponent = true;

  clearStates();

  choiceBtns.forEach(btn => {
    if (btn.dataset.choice === playerChoice) btn.classList.add('selected');
  });

  // Show player choice immediately
  playerIconEl.textContent = ICONS[playerChoice];
  playerIconEl.classList.remove('reveal');
  void playerIconEl.offsetWidth;
  playerIconEl.classList.add('reveal');

  // Disable buttons and show waiting message
  setButtonsDisabled(true);
  mpWaitingMsg.classList.remove('hidden');
  resultText.textContent = 'Move sent!';

  state.socket.emit('make_move', playerChoice);

  // Unlock state so we can receive events (but buttons stay disabled)
  state.locked = false;
}

// ── Screen setup helpers ──────────────────────────────────────────────────

function enterGameScreen(mode) {
  state.mode = mode;
  resetGameUI();

  if (mode === 'cpu') {
    opponentScoreLabel.textContent = 'CPU';
    cpuDisplayLabel.textContent    = 'CPU';
    gameStatusBar.classList.add('hidden');
    resetBtn.style.display = '';
  } else {
    opponentScoreLabel.textContent = 'Opponent';
    cpuDisplayLabel.textContent    = 'Opponent';
    statusModeLabel.textContent    = 'Online Match';
    statusRoomCode.textContent     = state.roomCode || '';
    if (state.roomCode) {
      statusRoomCode.classList.remove('hidden');
    } else {
      statusRoomCode.classList.add('hidden');
    }
    gameStatusBar.classList.remove('hidden');
    // Hide reset in multiplayer (scores are per-session, controlled by rounds)
    resetBtn.style.display = 'none';
  }

  showScreen('game');
}

function leaveToHome() {
  disconnectSocket();
  state.mode = null;
  hideLobbyError();
  resetGameUI();
  showScreen('home');
}

// ── Event listeners ───────────────────────────────────────────────────────

// Home → modes
btnVsCpu.addEventListener('click', () => {
  enterGameScreen('cpu');
});

btnVsPlayer.addEventListener('click', () => {
  hideLobbyError();
  connectSocket();
  showScreen('lobby');
});

// Lobby
lobbyBack.addEventListener('click', () => {
  disconnectSocket();
  hideLobbyError();
  showScreen('home');
});

btnCreateRoom.addEventListener('click', () => {
  hideLobbyError();
  if (!state.socket || !state.socket.connected) {
    connectSocket();
    // Wait for connection then emit
    state.socket.once('connect', () => state.socket.emit('create_room'));
  } else {
    state.socket.emit('create_room');
  }
});

btnJoinRoom.addEventListener('click', () => {
  const code = joinCodeInput.value.trim();
  if (code.length !== 4 || !/^\d{4}$/.test(code)) {
    showLobbyError('Please enter a valid 4-digit code.');
    return;
  }
  hideLobbyError();
  if (!state.socket || !state.socket.connected) {
    connectSocket();
    state.socket.once('connect', () => state.socket.emit('join_room', code));
  } else {
    state.socket.emit('join_room', code);
  }
});

// Allow pressing Enter in the code input to trigger join
joinCodeInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') btnJoinRoom.click();
});

// Only allow digits in the code input
joinCodeInput.addEventListener('input', () => {
  joinCodeInput.value = joinCodeInput.value.replace(/\D/g, '').slice(0, 4);
});

// Waiting screen back
waitingBack.addEventListener('click', () => {
  disconnectSocket();
  hideLobbyError();
  showScreen('lobby');
  // Reconnect so lobby is still usable
  connectSocket();
});

// Game back
gameBack.addEventListener('click', () => {
  leaveToHome();
});

// Choice buttons
choiceBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    if (state.mode === 'cpu') {
      playCpu(btn.dataset.choice);
    } else if (state.mode === 'multiplayer') {
      playMultiplayer(btn.dataset.choice);
    }
  });
});

// Keyboard shortcuts: R / P / S (only when game screen is visible)
document.addEventListener('keydown', e => {
  if (screens.game.classList.contains('hidden')) return;
  const map = { r: 'rock', p: 'paper', s: 'scissors' };
  const choice = map[e.key.toLowerCase()];
  if (!choice) return;
  if (state.mode === 'cpu') {
    playCpu(choice);
  } else if (state.mode === 'multiplayer') {
    playMultiplayer(choice);
  }
});

// Reset (single-player only — hidden in multiplayer)
resetBtn.addEventListener('click', () => {
  state.scores = { player: 0, opponent: 0 };
  playerScoreEl.textContent = '0';
  cpuScoreEl.textContent    = '0';
  playerIconEl.textContent  = '❓';
  cpuIconEl.textContent     = '❓';
  resultText.textContent    = 'Pick your move!';
  clearStates();
  state.locked = false;
});
