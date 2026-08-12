// game_schema.tsx - KasVillage on-chain game descriptors + procedural renderer.
// A game is a small JSON published on the cfg chunk rail (k:'cfg') at the dapp
// address; the announce carries its sha256. Buyer fetches, verifies, renders.
// v1 engine: NxN grid, k-in-a-row win, 2 local players (hot-seat). Generic -
// tic-tac-toe is just { board: 3, winLength: 3 }.

import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

// ---------------------------------------------------------------------------
// SCHEMA
// ---------------------------------------------------------------------------
export interface KvGameDescriptor {
  kind: 'kv_game_v1';
  engine: 'grid';          // v1: only grid
  name: string;            // display name (<= 40 chars)
  board: number;           // N (3-8)
  winLength: number;       // k-in-a-row to win (3-board)
  players: [GamePlayer, GamePlayer];
  cellColor?: string;      // hex
  gridColor?: string;      // hex
  bgColor?: string;        // hex
}
export interface GamePlayer {
  label: string;           // 1-2 chars rendered in cell (e.g. 'X', 'O')
  color: string;           // hex
}

const HEX = /^#[0-9a-fA-F]{6}$/;

export function validateGameDescriptor(raw: any): { ok: boolean; game?: KvGameDescriptor; error?: string } {
  try {
    const g = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (g.kind !== 'kv_game_v1') return { ok: false, error: 'kind must be kv_game_v1' };
    if (g.engine !== 'grid') return { ok: false, error: 'engine must be grid (v1)' };
    if (typeof g.name !== 'string' || !g.name.trim() || g.name.length > 40) return { ok: false, error: 'name: 1-40 chars' };
    if (!Number.isInteger(g.board) || g.board < 3 || g.board > 8) return { ok: false, error: 'board: integer 3-8' };
    if (!Number.isInteger(g.winLength) || g.winLength < 3 || g.winLength > g.board) return { ok: false, error: 'winLength: 3..board' };
    if (!Array.isArray(g.players) || g.players.length !== 2) return { ok: false, error: 'players: exactly 2' };
    for (const p of g.players) {
      if (typeof p.label !== 'string' || p.label.length < 1 || p.label.length > 2) return { ok: false, error: 'player label: 1-2 chars' };
      if (!HEX.test(p.color || '')) return { ok: false, error: 'player color: #rrggbb' };
    }
    for (const k of ['cellColor', 'gridColor', 'bgColor'] as const) {
      if (g[k] !== undefined && !HEX.test(g[k])) return { ok: false, error: k + ': #rrggbb' };
    }
    const game: KvGameDescriptor = {
      kind: 'kv_game_v1', engine: 'grid', name: g.name.trim(),
      board: g.board, winLength: g.winLength,
      players: [
        { label: g.players[0].label, color: g.players[0].color },
        { label: g.players[1].label, color: g.players[1].color },
      ],
      cellColor: g.cellColor, gridColor: g.gridColor, bgColor: g.bgColor,
    };
    return { ok: true, game };
  } catch (e: any) {
    return { ok: false, error: 'invalid JSON: ' + String(e?.message || e) };
  }
}

export const TIC_TAC_TOE_JSON = JSON.stringify({
  kind: 'kv_game_v1', engine: 'grid', name: 'Tic-Tac-Toe',
  board: 3, winLength: 3,
  players: [{ label: 'X', color: '#d97706' }, { label: 'O', color: '#4f46e5' }],
  cellColor: '#FFF8F0', gridColor: '#78716c', bgColor: '#fafaf9',
}, null, 2);

// ---------------------------------------------------------------------------
// ENGINE - hot-seat 2 player, k-in-a-row on NxN
// ---------------------------------------------------------------------------
function winner(cells: number[], n: number, k: number): number {
  const at = (r: number, c: number) => (r < 0 || c < 0 || r >= n || c >= n) ? 0 : cells[r * n + c];
  const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    const v = at(r, c);
    if (!v) continue;
    for (const [dr, dc] of dirs) {
      let run = 1;
      while (run < k && at(r + dr * run, c + dc * run) === v) run++;
      if (run >= k) return v;
    }
  }
  return 0;
}

export const GridGameEngine: React.FC<{ game: KvGameDescriptor; cellSize?: number }> = ({ game, cellSize = 72 }) => {
  const n = game.board;
  const [cells, setCells] = useState<number[]>(() => new Array(n * n).fill(0));
  const [turn, setTurn] = useState(1); // 1 or 2
  const win = useMemo(() => winner(cells, n, game.winLength), [cells, n, game.winLength]);
  const full = cells.every(c => c !== 0);
  const done = win !== 0 || full;

  const tap = (i: number) => {
    if (done || cells[i] !== 0) return;
    const next = cells.slice();
    next[i] = turn;
    setCells(next);
    setTurn(turn === 1 ? 2 : 1);
  };
  const reset = () => { setCells(new Array(n * n).fill(0)); setTurn(1); };

  const p = (v: number) => game.players[v - 1];
  const size = Math.min(cellSize, Math.floor(320 / n));

  return (
    <View style={[gs.wrap, { backgroundColor: game.bgColor || '#fafaf9' }]}>
      <Text style={gs.title}>{game.name}</Text>
      <Text style={gs.status}>
        {win ? p(win).label + ' wins!' : full ? 'Draw' : p(turn).label + "'s turn"}
      </Text>
      <View style={{ width: size * n, height: size * n }}>
        {Array.from({ length: n }).map((_, r) => (
          <View key={r} style={{ flexDirection: 'row' }}>
            {Array.from({ length: n }).map((_, c) => {
              const i = r * n + c;
              const v = cells[i];
              return (
                <TouchableOpacity key={c} onPress={() => tap(i)} activeOpacity={0.6}
                  style={{ width: size, height: size, backgroundColor: game.cellColor || '#fff', borderWidth: 1, borderColor: game.gridColor || '#78716c', justifyContent: 'center', alignItems: 'center' }}>
                  {v !== 0 && (
                    <Text style={{ fontSize: size * 0.55, fontWeight: '900', color: p(v).color }}>{p(v).label}</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>
      {done && (
        <TouchableOpacity onPress={reset} style={gs.resetBtn}>
          <Text style={gs.resetText}>Play Again</Text>
        </TouchableOpacity>
      )}
      <Text style={gs.footer}>Rendered from on-chain descriptor - hash verified</Text>
    </View>
  );
};

const gs = StyleSheet.create({
  wrap: { alignItems: 'center', padding: 16, borderRadius: 16 },
  title: { fontSize: 20, fontWeight: '900', color: '#1c1917', marginBottom: 4 },
  status: { fontSize: 14, fontWeight: 'bold', color: '#57534e', marginBottom: 12 },
  resetBtn: { marginTop: 14, backgroundColor: '#d97706', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 28 },
  resetText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  footer: { fontSize: 9, color: '#a8a29e', marginTop: 10 },
});

export default GridGameEngine;
