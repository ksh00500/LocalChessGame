import { defineStore } from 'pinia';
import { io } from 'socket.io-client';

// 호스트 자동 감지:
// - VITE_SERVER_URL이 있으면 우선 사용
// - 개발 모드(5173 등)에서는 현재 페이지 호스트에 3001 포트로 연결
// - 프로덕션(정적 빌드가 서버에서 서빙)에서는 같은 오리진으로 연결
const DEFAULT_SERVER_URL =
  import.meta.env.VITE_SERVER_URL ||
  (import.meta.env.DEV ? `http://${window.location.hostname}:3001` : window.location.origin);

export const useGameStore = defineStore('game', {
  state: () => ({
    // Connection
    socket: null,
    connected: false,

    // Game/session
    serverUrl: DEFAULT_SERVER_URL,
    roomId: '',
    color: null, // 'w' or 'b'

    // Game state from server
    fen: null,
    turn: 'w',
    in_check: false,
    in_checkmate: false,
    in_stalemate: false,
    in_draw: false,
    capturedBy: { w: [], b: [] },
    lastMove: null, // { from, to, san, flags } | null

    // UI meta
    error: null,
    info: null,
    opponentDisconnected: false
  }),
  getters: {
    isMyTurn(state) {
      return !!state.color && state.turn === state.color;
    },
    myColorLabel(state) {
      if (!state.color) return '관전자';
      return state.color === 'w' ? '백' : '흑';
    },
    turnLabel(state) {
      return state.turn === 'w' ? '백' : '흑';
    }
  },
  actions: {
    setServerUrl(url) {
      if (!url || typeof url !== 'string') return;
      this.serverUrl = url;
      // 이미 소켓이 있으면 갈아끼우기
      if (this.socket) {
        try { this.socket.disconnect(); } catch {}
        this.socket = null;
        this.connected = false;
      }
      this.ensureSocket();
      // 기존 방이 있다면 재참가 시도
      if (this.roomId) {
        this.socket.emit('joinGame', { roomId: this.roomId });
      }
    },

    ensureSocket() {
      if (this.socket) return;

      this.socket = io(this.serverUrl, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 500,
        reconnectionDelayMax: 3000,
        timeout: 10000
      });

      this.socket.on('connect', () => {
        this.connected = true;
        this.info = '서버에 연결되었습니다.';
        // 연결이 복구되면 기존 방에 자동 재참가
        if (this.roomId) {
          this.socket.emit('joinGame', { roomId: this.roomId });
        }
      });

      this.socket.on('disconnect', () => {
        this.connected = false;
        this.info = '서버와의 연결이 끊어졌습니다.';
      });

      this.socket.on('connect_error', (err) => {
        this.error = `서버 연결 실패 (${this.serverUrl}): ${err?.message || '알 수 없는 오류'}`;
      });

      this.socket.on('assignedColor', ({ roomId, color }) => {
        this.roomId = roomId;
        this.color = color;
        this.info = `게임에 참여했습니다. 당신은 ${color === 'w' ? '백' : '흑'} 입니다.`;
      });

      this.socket.on('gameStateUpdate', (state) => {
        this.fen = state.fen;
        this.turn = state.turn;
        this.in_check = state.in_check;
        this.in_checkmate = state.in_checkmate;
        this.in_stalemate = state.in_stalemate;
        this.in_draw = state.in_draw;
        this.capturedBy = state.capturedBy || { w: [], b: [] };
        this.lastMove = state.lastMove || null;
        this.error = null;
        this.opponentDisconnected = false;
      });

      this.socket.on('invalidMove', ({ reason }) => {
        this.error = reason || '유효하지 않은 이동입니다.';
      });

      this.socket.on('roomFull', ({ message }) => {
        this.error = message || '방이 가득 찼습니다.';
      });

      this.socket.on('opponentDisconnected', ({ message }) => {
        this.info = message || '상대방이 나갔습니다.';
        this.opponentDisconnected = true;
      });
    },

    connectIfNeeded() {
      if (!this.socket) this.ensureSocket();
    },

    joinGame(roomId) {
      this.connectIfNeeded();
      if (!roomId || !roomId.trim()) {
        this.error = '유효한 방 ID를 입력해 주세요.';
        return;
      }
      this.error = null;
      this.info = null;
      this.roomId = roomId.trim();
      this.socket.emit('joinGame', { roomId: this.roomId });
    },

    sendMove({ from, to, promotion }) {
      if (!this.socket || !this.roomId) return;
      this.socket.emit('move', { roomId: this.roomId, from, to, promotion });
    },

    newGame() {
      if (!this.socket || !this.roomId) return;
      this.socket.emit('newGame', { roomId: this.roomId });
    }
  }
});