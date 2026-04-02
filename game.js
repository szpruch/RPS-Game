const CHOICES = ['rock', 'paper', 'scissors'];

const ICONS = {
  rock:     '🪨',
  paper:    '📄',
  scissors: '✂️',
};

const LABELS = {
  rock:     'Rock',
  paper:    'Paper',
  scissors: 'Scissors',
};

// outcome[player][cpu] => 'win' | 'lose' | 'draw'
const OUTCOME = {
  rock:     { rock: 'draw', paper: 'lose', scissors: 'win'  },
  paper:    { rock: 'win',  paper: 'draw', scissors: 'lose' },
  scissors: { rock: 'lose', paper: 'win',  scissors: 'draw' },
};

const RESULT_MESSAGES = {
  win:  ['You win!', 'Nice one!', 'Crushed it!', 'You got em!'],
  lose: ['CPU wins!', 'So close...', 'Better luck next time!', 'CPU wins this round!'],
  draw: ["It's a draw!", 'Great minds think alike.', 'Dead even!'],
};

let scores = { player: 0, cpu: 0 };
let locked = false;

const playerScoreEl  = document.getElementById('player-score');
const cpuScoreEl     = document.getElementById('cpu-score');
const playerIconEl   = document.getElementById('player-icon');
const cpuIconEl      = document.getElementById('cpu-icon');
const playerDisplay  = document.getElementById('player-display');
const cpuDisplay     = document.getElementById('cpu-display');
const resultBanner   = document.getElementById('result-banner');
const resultText     = document.getElementById('result-text');
const choiceBtns     = document.querySelectorAll('.choice-btn');
const resetBtn       = document.getElementById('reset-btn');

function randomChoice() {
  return CHOICES[Math.floor(Math.random() * CHOICES.length)];
}

function randomMessage(outcome) {
  const msgs = RESULT_MESSAGES[outcome];
  return msgs[Math.floor(Math.random() * msgs.length)];
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

function play(playerChoice) {
  if (locked) return;
  locked = true;

  clearStates();

  // Highlight selected button
  choiceBtns.forEach(btn => {
    if (btn.dataset.choice === playerChoice) btn.classList.add('selected');
  });

  // Show player choice immediately
  playerIconEl.textContent = ICONS[playerChoice];
  playerIconEl.classList.remove('reveal');
  void playerIconEl.offsetWidth;
  playerIconEl.classList.add('reveal');

  // Suspense: spin through CPU choices then reveal
  cpuIconEl.textContent = '❓';
  let ticks = 0;
  const maxTicks = 8;
  const interval = setInterval(() => {
    cpuIconEl.textContent = ICONS[randomChoice()];
    ticks++;
    if (ticks >= maxTicks) {
      clearInterval(interval);
      revealResult(playerChoice);
    }
  }, 80);
}

function revealResult(playerChoice) {
  const cpuChoice = randomChoice();
  const outcome   = OUTCOME[playerChoice][cpuChoice];

  cpuIconEl.textContent = ICONS[cpuChoice];
  cpuIconEl.classList.remove('reveal');
  void cpuIconEl.offsetWidth;
  cpuIconEl.classList.add('reveal');

  // Apply outcome styles
  resultBanner.classList.add(outcome);
  resultText.textContent = randomMessage(outcome);

  if (outcome === 'win') {
    playerDisplay.classList.add('win', 'pulse');
    cpuDisplay.classList.add('lose', 'shake');
    scores.player++;
    playerScoreEl.textContent = scores.player;
    bumpScore(playerScoreEl);
  } else if (outcome === 'lose') {
    cpuDisplay.classList.add('win', 'pulse');
    playerDisplay.classList.add('lose', 'shake');
    scores.cpu++;
    cpuScoreEl.textContent = scores.cpu;
    bumpScore(cpuScoreEl);
  } else {
    playerDisplay.classList.add('draw');
    cpuDisplay.classList.add('draw');
  }

  locked = false;
}

// Button listeners
choiceBtns.forEach(btn => {
  btn.addEventListener('click', () => play(btn.dataset.choice));
});

// Keyboard support: R = rock, P = paper, S = scissors
document.addEventListener('keydown', e => {
  const map = { r: 'rock', p: 'paper', s: 'scissors' };
  const choice = map[e.key.toLowerCase()];
  if (choice) play(choice);
});

// Reset
resetBtn.addEventListener('click', () => {
  scores = { player: 0, cpu: 0 };
  playerScoreEl.textContent = '0';
  cpuScoreEl.textContent    = '0';
  playerIconEl.textContent  = '❓';
  cpuIconEl.textContent     = '❓';
  resultText.textContent    = 'Pick your move!';
  clearStates();
  locked = false;
});
