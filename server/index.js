// Express + Socket.IO real-time chess server (ESM)

import express from 'express';
import http from 'http';
import cors from 'cors';
import { Server } from 'socket.io';
import { Chess } from 'chess.js';

const PORT = process.env.PORT || 3001;

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

// room state: { chess, players:{w,b}, capturedBy:{w:[],b:[]}, createdAt }
const rooms = new Map();

function createRoom() {
  return {
    chess: new Chess(),
    players: { w: null, b: null },
    capturedBy: { w: [], b: [] },
    createdAt: Date.now()
  };
}

function buildGameState(room, lastMove = null) {
  const { chess, capturedBy } = room;
  const state = {
    fen: chess.fen(),
    turn: chess.turn(),               // 'w' | 'b'
    // chess.js v1.x API (camelCase with is*)
    in_check: chess.isCheck(),
    in_checkmate: chess.isCheckmate(),
    in_stalemate: chess.isStalemate(),
    in_draw: chess.isDraw(),
    capturedBy,
    lastMove,
    result: null
  };
  if (state.in_checkmate) {
    state.result = { status: 'checkmate', winner: state.turn === 'w' ? 'b' : 'w' };
  } else if (state.in_stalemate) {
    state.result = { status: 'stalemate', winner: null };
  } else if (state.in_draw) {
    state.result = { status: 'draw', winner: null };
  } else {
    state.result = { status: 'ongoing', winner: null };
  }
  return state;
}

function maybeCleanupRoom(roomId) {
  const room = rooms.get(roomId);
  if (!room) return;
  if (!room.players.w && !room.players.b) rooms.delete(roomId);
}

io.on('connection', (socket) => {
  socket.data.roomId = null;
  socket.data.color = null;

  socket.on('joinGame', ({ roomId }) => {
    if (!roomId || typeof roomId !== 'string') {
      socket.emit('invalidMove', { reason: '잘못된 룸 ID입니다.' });
      return;
    }
    let room = rooms.get(roomId);
    if (!room) {
      room = createRoom();
      rooms.set(roomId, room);
    }
    if (room.players.w && room.players.b) {
      socket.emit('roomFull', { roomId, message: '이 방은 이미 두 명이 플레이 중입니다.' });
      return;
    }

    const color = room.players.w ? 'b' : 'w';
    room.players[color] = socket.id;

    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.color = color;

    socket.emit('assignedColor', { roomId, color });

    if (room.players.w && room.players.b) {
      const state = buildGameState(room, null);
      io.to(roomId).emit('gameStateUpdate', state);
    }
  });

  socket.on('move', (payload) => {
    const { roomId, from, to, promotion } = payload || {};
    if (!roomId || typeof roomId !== 'string') return;

    const room = rooms.get(roomId);
    if (!room) {
      socket.emit('invalidMove', { reason: '존재하지 않는 게임 방입니다.' });
      return;
    }

    const { chess, capturedBy } = room;

    const turn = chess.turn(); // 'w' | 'b'
    if (room.players[turn] !== socket.id) {
      socket.emit('invalidMove', { reason: '당신의 차례가 아닙니다.' });
      return;
    }

    const move = chess.move({ from, to, promotion: promotion || 'q' });
    if (!move) {
      socket.emit('invalidMove', { reason: '유효하지 않은 이동입니다.' });
      return;
    }

    if (move.captured) {
      capturedBy[move.color].push(move.captured); // track captured letter
    }

    const lastMove = { from: move.from, to: move.to, san: move.san, flags: move.flags };
    const state = buildGameState(room, lastMove);
    io.to(roomId).emit('gameStateUpdate', state);
  });

  socket.on('newGame', ({ roomId }) => {
    if (!roomId || typeof roomId !== 'string') return;
    const room = rooms.get(roomId);
    if (!room) return;
    if (socket.id !== room.players.w && socket.id !== room.players.b) return;

    room.chess = new Chess();
    room.capturedBy = { w: [], b: [] };
    const state = buildGameState(room, null);
    io.to(roomId).emit('gameStateUpdate', state);
  });

  socket.on('disconnect', () => {
    const { roomId, color } = socket.data;
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room) return;

    if (color && room.players[color] === socket.id) room.players[color] = null;
    socket.to(roomId).emit('opponentDisconnected', { message: '상대방의 연결이 끊어졌습니다.' });
    maybeCleanupRoom(roomId);
  });
});

app.get('/', (_, res) => res.json({ status: 'ok', message: 'Chess server is running.' }));

server.listen(PORT, () => {
  console.log(`Chess server listening on http://0.0.0.0:${PORT}`);
});