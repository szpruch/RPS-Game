const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

// { code: { players: [socketId, socketId], moves: { socketId: choice } } }
const rooms = {};

// ── helpers ────────────────────────────────────────────────────────────────

function generateCode() {
  let code;
  do {
    code = String(Math.floor(1000 + Math.random() * 9000));
  } while (rooms[code]);
  return code;
}

// outcome from the perspective of playerChoice vs opponentChoice
function calcOutcome(playerChoice, opponentChoice) {
  if (playerChoice === opponentChoice) return 'draw';
  const wins = { rock: 'scissors', paper: 'rock', scissors: 'paper' };
  return wins[playerChoice] === opponentChoice ? 'win' : 'lose';
}

function findRoomBySocket(socketId) {
  return Object.entries(rooms).find(([, room]) =>
    room.players.includes(socketId)
  );
}

// ── socket events ──────────────────────────────────────────────────────────

io.on('connection', (socket) => {
  console.log('connect:', socket.id);

  // ── create_room ──────────────────────────────────────────────────────────
  socket.on('create_room', () => {
    // Clean up any existing room this socket owns
    const existing = findRoomBySocket(socket.id);
    if (existing) {
      const [oldCode, oldRoom] = existing;
      const other = oldRoom.players.find(id => id !== socket.id);
      if (other) io.to(other).emit('opponent_left');
      delete rooms[oldCode];
      socket.leave(oldCode);
    }

    const code = generateCode();
    rooms[code] = { players: [socket.id], moves: {} };
    socket.join(code);
    socket.emit('room_created', code);
    console.log(`room created: ${code} by ${socket.id}`);
  });

  // ── join_room ─────────────────────────────────────────────────────────────
  socket.on('join_room', (code) => {
    const room = rooms[code];

    if (!room) {
      socket.emit('error', 'Room not found. Check the code and try again.');
      return;
    }
    if (room.players.length >= 2) {
      socket.emit('error', 'Room is already full.');
      return;
    }
    if (room.players.includes(socket.id)) {
      socket.emit('error', 'You are already in this room.');
      return;
    }

    room.players.push(socket.id);
    socket.join(code);
    console.log(`room joined: ${code} by ${socket.id}`);

    // Notify both players
    io.to(code).emit('game_start');
  });

  // ── make_move ─────────────────────────────────────────────────────────────
  socket.on('make_move', (choice) => {
    const entry = findRoomBySocket(socket.id);
    if (!entry) return;
    const [code, room] = entry;

    const validChoices = ['rock', 'paper', 'scissors'];
    if (!validChoices.includes(choice)) return;

    // Ignore duplicate move
    if (room.moves[socket.id]) return;

    room.moves[socket.id] = choice;

    const [p1, p2] = room.players;
    const bothMoved = room.moves[p1] && room.moves[p2];

    if (!bothMoved) {
      // Tell the other player their opponent has picked (but not what)
      const otherId = socket.id === p1 ? p2 : p1;
      io.to(otherId).emit('opponent_moved');
      return;
    }

    // Both moved — resolve round
    const p1Choice = room.moves[p1];
    const p2Choice = room.moves[p2];

    io.to(p1).emit('round_result', {
      yourChoice: p1Choice,
      opponentChoice: p2Choice,
      outcome: calcOutcome(p1Choice, p2Choice)
    });
    io.to(p2).emit('round_result', {
      yourChoice: p2Choice,
      opponentChoice: p1Choice,
      outcome: calcOutcome(p2Choice, p1Choice)
    });

    // Reset moves for next round
    room.moves = {};
  });

  // ── disconnect ────────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    console.log('disconnect:', socket.id);
    const entry = findRoomBySocket(socket.id);
    if (!entry) return;
    const [code, room] = entry;
    const other = room.players.find(id => id !== socket.id);
    if (other) io.to(other).emit('opponent_left');
    delete rooms[code];
  });
});

// ── start ──────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`RPS server listening on port ${PORT}`));
