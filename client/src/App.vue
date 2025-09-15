<script setup>
import { onMounted, ref, computed } from 'vue';
import ChessBoard from './components/ChessBoard.vue';
import { useGameStore } from './stores/game';
import { useUiStore } from './stores/ui';

const store = useGameStore();
const ui = useUiStore();
const inputRoomId = ref('');

onMounted(() => {
  ui.initTheme();
  store.connectIfNeeded();
});

// 캡처 기물 표시용
const capturedToSymbol = (color, letter) => {
  const map = {
    w: { k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' },
    b: { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' }
  };
  return map[color][letter];
};

const gameOverText = computed(() => {
  if (store.in_checkmate) {
    const winner = store.turn === 'w' ? '흑' : '백';
    return `체크메이트! ${winner} 승리`;
  }
  if (store.in_stalemate) return '스테일메이트! 무승부';
  if (store.in_draw) return '무승부';
  return null;
});

const canStartNewGame = computed(() => {
  return store.in_checkmate || store.in_stalemate || store.in_draw;
});
</script>

<template>
  <div class="app">
    <!-- Left panel: Room controls and status -->
    <div class="panel">
      <h2>게임 설정</h2>
      <div class="controls">
        <label>방 ID</label>
        <input
          v-model="inputRoomId"
          type="text"
          placeholder="예: room-1234"
          style="padding: 8px 10px; border: 1px solid var(--panel-border); background: var(--input-bg); color: var(--text); border-radius: 8px;"
        />
        <button class="btn primary" @click="store.joinGame(inputRoomId)">
          게임 참가
        </button>
        <div class="connection">
          연결 상태: {{ store.connected ? '연결됨' : '연결 안 됨' }}
        </div>
      </div>

      <div class="status" v-if="store.roomId">
        방: <strong>{{ store.roomId }}</strong>
      </div>
      <div class="status" v-if="store.color">
        당신은: <span class="badge">{{ store.myColorLabel }}</span>
      </div>
      <div class="status" v-if="store.fen">
        현재 턴: <span class="badge">{{ store.turnLabel }}</span>
      </div>

      <div v-if="store.error" class="status" style="background:var(--error-bg);color:var(--error-text);">
        오류: {{ store.error }}
      </div>
      <div v-if="store.info" class="status">
        {{ store.info }}
      </div>

      <div class="controls" style="margin-top: 12px;">
        <button class="btn" :disabled="!canStartNewGame" @click="store.newGame()">
          새 게임 시작
        </button>
      </div>

      <hr style="border:none; border-top:1px solid var(--panel-border); margin: 12px 0;" />
      <div class="controls">
        <label>테마</label>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          <button class="btn" :class="{active: ui.theme==='system'}" @click="ui.setTheme('system')">시스템</button>
          <button class="btn" :class="{active: ui.theme==='light'}" @click="ui.setTheme('light')">라이트</button>
          <button class="btn" :class="{active: ui.theme==='dark'}" @click="ui.setTheme('dark')">다크</button>
        </div>
        <div class="connection">적용됨: {{ ui.resolvedTheme === 'dark' ? '다크' : '라이트' }}</div>
      </div>
    </div>

    <!-- Center: Board -->
    <div style="position: relative;">
      <ChessBoard />
      <div v-if="gameOverText" class="overlay">
        <div class="modal">
          <h3 style="margin: 0 0 8px;">{{ gameOverText }}</h3>
          <div style="display:flex; justify-content:center; gap:8px; margin-top:8px;">
            <button class="btn primary" @click="store.newGame()">새 게임 시작</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Right panel: Captured pieces -->
    <div class="panel">
      <h2>캡처한 기물</h2>
      <div style="margin-bottom: 8px;">백이 잡은 기물</div>
      <div class="captured">
        <span v-for="(p, idx) in store.capturedBy.w" :key="'w'+idx" style="font-size: 20px;">
          {{ capturedToSymbol('b', p) }}
        </span>
      </div>

      <div style="margin: 12px 0 8px;">흑이 잡은 기물</div>
      <div class="captured">
        <span v-for="(p, idx) in store.capturedBy.b" :key="'b'+idx" style="font-size: 20px;">
          {{ capturedToSymbol('w', p) }}
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.btn.active {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}
</style>