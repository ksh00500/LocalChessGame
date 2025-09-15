<script setup>
import { computed, reactive, ref, watch } from 'vue';
import { useGameStore } from '../stores/game';
import { Chess } from 'chess.js';

const store = useGameStore();

// Local UI state
const selected = ref(null);
const legalTargets = ref([]);
const showingPromotion = ref(false);
const pendingMove = reactive({ from: null, to: null });

// Variation Selector-15 to force TEXT presentation (avoid color emoji rendering)
const VS15 = '\uFE0E';

// Unicode symbols with VS15 appended for consistent monochrome rendering
const pieceSymbols = {
  w: { k: '♔' + VS15, q: '♕' + VS15, r: '♖' + VS15, b: '♗' + VS15, n: '♘' + VS15, p: '♙' + VS15 },
  b: { k: '♚' + VS15, q: '♛' + VS15, r: '♜' + VS15, b: '♝' + VS15, n: '♞' + VS15, p: '♟' + VS15 }
};

function algebraic(fileIdx, rankIdx, flipped) {
  const files = ['a','b','c','d','e','f','g','h'];
  const f = flipped ? 7 - fileIdx : fileIdx;
  const r = flipped ? rankIdx : 7 - rankIdx;
  return `${files[f]}${r + 1}`;
}

const flipped = computed(() => store.color === 'b');

const board = computed(() => {
  const c = new Chess();
  if (store.fen) c.load(store.fen);
  const grid = [];
  for (let r = 0; r < 8; r++) {
    const row = [];
    for (let f = 0; f < 8; f++) {
      const square = algebraic(f, r, flipped.value);
      const piece = c.get(square);
      row.push({ square, piece });
    }
    grid.push(row);
  }
  return grid;
});

const lastMoveSquares = computed(() => {
  if (!store.lastMove) return new Set();
  return new Set([store.lastMove.from, store.lastMove.to]);
});

const checkSquare = computed(() => {
  if (!store.in_check) return null;
  const c = new Chess();
  if (store.fen) c.load(store.fen);
  const side = store.turn;
  return findKingSquare(c, side);
});

function findKingSquare(c, side) {
  const b = c.board();
  const files = ['a','b','c','d','e','f','g','h'];
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const p = b[r][f];
      if (p && p.type === 'k' && p.color === side) {
        return `${files[f]}${8 - r}`;
      }
    }
  }
  return null;
}

function onSquareClick(sq, piece) {
  if (!store.fen || !store.color) return;
  if (!store.isMyTurn) return;

  const c = new Chess();
  c.load(store.fen);

  if (piece && piece.color === store.color) {
    selected.value = sq;
    const moves = c.moves({ square: sq, verbose: true });
    legalTargets.value = moves.map(m => ({ to: m.to, capture: !!m.captured }));
    return;
  }

  if (selected.value) {
    const target = legalTargets.value.find(t => t.to === sq);
    if (target) {
      const movingPiece = c.get(selected.value);
      const targetRank = parseInt(sq[1], 10);
      const isPromotion =
        movingPiece &&
        movingPiece.type === 'p' &&
        ((store.color === 'w' && targetRank === 8) || (store.color === 'b' && targetRank === 1));

      if (isPromotion) {
        pendingMove.from = selected.value;
        pendingMove.to = sq;
        showingPromotion.value = true;
      } else {
        store.sendMove({ from: selected.value, to: sq });
      }
      selected.value = null;
      legalTargets.value = [];
      return;
    }
  }

  selected.value = null;
  legalTargets.value = [];
}

function choosePromotion(piece) {
  if (pendingMove.from && pendingMove.to) {
    store.sendMove({ from: pendingMove.from, to: pendingMove.to, promotion: piece });
  }
  showingPromotion.value = false;
  pendingMove.from = null;
  pendingMove.to = null;
}

watch(() => store.fen, () => {
  selected.value = null;
  legalTargets.value = [];
});
</script>

<template>
  <div class="board-wrap">
    <div class="board">
      <template v-for="(row, rIdx) in board" :key="rIdx">
        <template v-for="(cell, fIdx) in row" :key="cell.square">
          <div
            class="square"
            :class="[
              ((rIdx + fIdx) % 2 === 0) ? 'light' : 'dark',
              selected === cell.square ? 'selectable' : '',
              (legalTargets.find(t => t.to === cell.square) ? 'target' : ''),
              (legalTargets.find(t => t.to === cell.square && t.capture) ? 'capture' : ''),
              (lastMoveSquares.has(cell.square) ? 'lastmove' : ''),
              (checkSquare === cell.square ? 'check' : '')
            ]"
            @click="onSquareClick(cell.square, cell.piece)"
          >
            <span v-if="fIdx === 0" class="square coord rank">{{ cell.square[1] }}</span>
            <span v-if="rIdx === 7" class="square coord file">{{ cell.square[0] }}</span>

            <span v-if="cell.piece" class="piece">
              {{ pieceSymbols[cell.piece.color][cell.piece.type] }}
            </span>
          </div>
        </template>
      </template>

      <div v-if="showingPromotion" class="overlay">
        <div class="modal">
          <div>프로모션 기물을 선택하세요</div>
          <div class="promo-choices">
            <button class="btn" @click="choosePromotion('q')">퀸</button>
            <button class="btn" @click="choosePromotion('r')">룩</button>
            <button class="btn" @click="choosePromotion('b')">비숍</button>
            <button class="btn" @click="choosePromotion('n')">나이트</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
</style>