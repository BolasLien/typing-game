import assert from 'node:assert/strict';
import { test } from 'node:test';
import { advance, createGame, parseSource, submit } from '../src/game.js';
import type { Block, GameState, Rng } from '../src/game.js';

const fixed = () => 0.999999;
const close = (actual: number, expected: number, tolerance = 1e-7) =>
  assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);
const block = (state: GameState, id: number): Block => {
  const found = state.blocks.find(candidate => candidate.id === id);
  assert.ok(found, `Missing block ${id}`);
  return found;
};
function seeded(seed: number): Rng {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}
// Identity column shuffle, with a scripted prompt choice for each spawn.
function scripted(indices: readonly number[], promptCount: number): Rng {
  let calls = 0;
  let prompt = 0;
  return () => calls++ % 7 < 3 ? fixed() : ((indices[prompt++] ?? 0) + 0.5) / promptCount;
}
function assertBoard(state: GameState): void {
  for (const column of [0, 1, 2, 3]) {
    const blocks = state.blocks.filter(candidate => candidate.column === column).sort((a, b) => b.y - a.y);
    let support = 8;
    let settled = true;
    for (const candidate of blocks) {
      assert.ok(candidate.y <= support - 1 + 1e-8, 'Blocks overlap or pass through support');
      if (candidate.settled) {
        assert.ok(settled, 'Settled block has no settled support');
        close(candidate.y, support - 1);
      }
      settled = candidate.settled;
      support = candidate.y;
    }
  }
}
function freezeDeep(state: GameState): void {
  for (const candidate of state.blocks) Object.freeze(candidate);
  Object.freeze(state.blocks);
  Object.freeze(state.prompts);
  Object.freeze(state.columnBag);
  Object.freeze(state);
}

test('source trims lines, drops blanks, preserves internal spaces, duplicate weight and spelling', () => {
  assert.deepEqual(parseSource(' \r\n  Hello  world \r\n\t中文\t\r重複\n重複\n e\u0301 \n'),
    ['Hello  world', '中文', '重複', '重複', 'e\u0301']);
  assert.throws(() => parseSource('\r\n \t'), RangeError);
});

test('source limits use Unicode code points, not UTF-16 units or graphemes', () => {
  assert.equal(parseSource('😀'.repeat(40))[0], '😀'.repeat(40));
  assert.throws(() => parseSource('😀'.repeat(41)), /40/);
  assert.equal(parseSource('e\u0301'.repeat(20))[0], 'e\u0301'.repeat(20));
  assert.throws(() => parseSource('e\u0301'.repeat(21)), /40/);
  assert.equal(parseSource(Array(500).fill('字').join('\n')).length, 500);
  assert.throws(() => parseSource(Array(501).fill('字').join('\n')), /500/);
  assert.throws(() => createGame([], fixed), RangeError);
  assert.throws(() => createGame(['  '], fixed), RangeError);
  assert.throws(() => createGame(['x'.repeat(41)], fixed), RangeError);
  assert.throws(() => createGame(Array(501).fill('x'), fixed), RangeError);
});

test('duplicate source entries remain weighted random choices', () => {
  const rng = scripted([0, 1, 2], 3);
  const state = advance(createGame(parseSource('a\na\nb'), rng), 7200, rng);
  assert.deepEqual(state.blocks.map(candidate => candidate.text), ['a', 'a', 'b']);
});

test('new game starts empty and first spawn occurs precisely at 2400ms', () => {
  const initial = createGame(['字'], fixed);
  assert.equal(initial.status, 'running');
  assert.equal(initial.elapsedMs, 0);
  assert.equal(initial.blocks.length, 0);
  assert.equal(advance(initial, 2399, fixed).blocks.length, 0);
  const spawned = advance(initial, 2400, fixed);
  assert.equal(spawned.blocks.length, 1);
  assert.equal(block(spawned, 1).y, 0);
  assert.equal(block(spawned, 1).createdAtMs, 2400);
  close(block(advance(spawned, 1000, fixed), 1).y, 0.75);
});

test('NFC matching works in both directions while preserving displayed spelling', () => {
  for (const [prompt, input] of [['é', 'e\u0301'], ['e\u0301', 'é']]) {
    const state = advance(createGame([prompt!], fixed), 2400, fixed);
    assert.equal(block(state, 1).text, prompt);
    const result = submit(state, input!);
    assert.equal(result.score, 100);
    assert.equal(result.clearedCount, 1);
    assert.equal(result.unmatchedCount, 0);
    assert.equal(result.blocks.length, 0);
  }
});

test('submissions are case-sensitive, untrimmed, and require all internal spaces', () => {
  let state = advance(createGame(['Hello  world'], fixed), 2400, fixed);
  for (const input of ['', 'hello  world', ' Hello  world', 'Hello  world ', 'Hello world', 'Hello']) {
    state = submit(state, input);
  }
  assert.equal(state.unmatchedCount, 6);
  assert.equal(state.score, 0);
  assert.equal(state.blocks.length, 1);
  state = submit(state, 'Hello  world');
  assert.equal(state.score, 100);
  assert.equal(state.unmatchedCount, 6);
});

test('each submission removes only one block, whether falling or settled', () => {
  let state = advance(createGame(['same'], fixed), 4800, fixed);
  assert.ok(state.blocks.every(candidate => !candidate.settled));
  state = submit(state, 'same');
  assert.deepEqual(state.blocks.map(candidate => candidate.id), [2]);
  assert.equal(state.score, 100);
  state = advance(state, 10_000, fixed);
  assert.ok(block(state, 2).settled);
  const result = submit(state, 'same');
  assert.ok(!result.blocks.some(candidate => candidate.id === 2));
  assert.equal(result.blocks.length, state.blocks.length - 1);
  assert.equal(result.score, 200);
});

test('matching prioritizes the tallest settled column ahead of lower and older matches', () => {
  const rng = scripted([0, 0, 0, 0, 0, 1, 0, 0, 1], 2);
  const state = advance(createGame(['filler', 'target'], rng), 21_600, rng);
  assert.equal(state.blocks.filter(candidate => candidate.column === 0 && candidate.settled).length, 2);
  assert.equal(state.blocks.filter(candidate => candidate.column === 1 && candidate.settled).length, 1);
  assert.ok(block(state, 6).y > block(state, 9).y);
  const result = submit(state, 'target');
  assert.ok(result.blocks.some(candidate => candidate.id === 6));
  assert.ok(!result.blocks.some(candidate => candidate.id === 9));
});

test('equal-height columns prioritize a lower match even if it was generated later', () => {
  const rng = scripted([0, 2, 0, 0, 1, 1, 0, 0, 3, 0, 0, 0], 4);
  let state = advance(createGame(['filler', 'target', 'base', 'excess'], rng), 15_000, rng);
  state = submit(state, 'base');
  state = advance(state, 16_000, rng);
  state = submit(state, 'excess');
  assert.equal(state.blocks.filter(candidate => candidate.column === 0 && candidate.settled).length, 2);
  assert.equal(state.blocks.filter(candidate => candidate.column === 1 && candidate.settled).length, 2);
  assert.equal(block(state, 5).y, 6);
  assert.equal(block(state, 6).y, 7);
  const result = submit(state, 'target');
  assert.ok(result.blocks.some(candidate => candidate.id === 5));
  assert.ok(!result.blocks.some(candidate => candidate.id === 6));
});

test('equal stack height and position use earliest generation', () => {
  const state = advance(createGame(['same'], fixed), 15_000, fixed);
  assert.equal(block(state, 1).y, 7);
  assert.equal(block(state, 2).y, 7);
  const result = submit(state, 'same');
  assert.ok(!result.blocks.some(candidate => candidate.id === 1));
  assert.ok(result.blocks.some(candidate => candidate.id === 2));
});

test('removing the bottom releases the stack and gravity fills the gap without teleporting', () => {
  const rng = scripted([1, 0, 0, 0, 2, 0, 0, 0, 3], 4);
  let state = advance(createGame(['filler', 'bottom', 'above', 'incoming'], rng), 21_600, rng);
  assert.equal(block(state, 1).y, 7);
  assert.equal(block(state, 5).y, 6);
  state = submit(state, 'bottom');
  assert.equal(block(state, 5).y, 6);
  assert.equal(block(state, 5).settled, false);
  state = advance(state, 1000, rng);
  close(block(state, 5).y, 6.85);
  assertBoard(state);
  state = advance(state, 200, rng);
  assert.equal(block(state, 5).y, 7);
  assert.equal(block(state, 5).settled, true);
  assertBoard(state);
});

test('removing a middle block releases only the stack above and preserves its order', () => {
  const rng = scripted([1, 0, 0, 0, 2, 0, 0, 0, 3], 4);
  let state = advance(createGame(['filler', 'bottom', 'middle', 'above'], rng), 31_000, rng);
  assert.equal(block(state, 9).y, 5);
  state = submit(state, 'middle');
  assert.equal(block(state, 1).y, 7);
  assert.equal(block(state, 1).settled, true);
  assert.equal(block(state, 9).settled, false);
  state = advance(state, 1200, rng);
  assert.equal(block(state, 9).y, 6);
  assert.equal(block(state, 9).settled, true);
  assertBoard(state);
});

test('every complete shuffle bag uses each of the four columns exactly once', () => {
  const rng = seeded(42);
  let state = createGame(['x'], rng);
  const columns: number[] = [];
  for (let i = 0; i < 1200; i++) {
    state = advance(state, 200, rng);
    for (const candidate of state.blocks) {
      columns.push(candidate.column);
      state = submit(state, candidate.text);
    }
  }
  assert.ok(columns.length > 100);
  for (let i = 0; i + 4 <= columns.length; i += 4) {
    assert.deepEqual(columns.slice(i, i + 4).sort(), [0, 1, 2, 3]);
  }
  assert.ok(new Set(columns.filter((_, i) => i % 4 === 0)).size > 1);
});

test('difficulty changes exactly every 20 seconds with carried spawn progress', () => {
  const initial = createGame(['x'], fixed);
  const before = advance(initial, 19_999, fixed);
  assert.equal(before.spawnIntervalMs, 2400);
  assert.equal(before.fallSpeed, 0.75);
  const boundary = advance(before, 1, fixed);
  assert.equal(boundary.spawnIntervalMs, 2200);
  close(boundary.fallSpeed, 0.85);
  assert.equal(boundary.spawnElapsedMs, 800);
  assert.equal(advance(boundary, 1399, fixed).blocks.length, 8);
  const nextSpawn = advance(boundary, 1400, fixed);
  assert.equal(block(nextSpawn, 9).createdAtMs, 21_400);
  close(block(nextSpawn, 8).y, 0.8 * 0.75 + 1.4 * 0.85);
});

test('difficulty reaches and retains both caps while successful play keeps the game alive', () => {
  let state = createGame(['x'], fixed);
  for (let ms = 200; ms <= 300_000; ms += 200) {
    state = advance(state, 200, fixed);
    for (const candidate of state.blocks) state = submit(state, candidate.text);
    assert.equal(state.status, 'running');
    if (ms % 20_000 === 0) {
      assert.equal(state.spawnIntervalMs, Math.max(600, 2400 - ms / 20_000 * 200));
      close(state.fallSpeed, Math.min(2, 0.75 + ms / 20_000 * 0.1));
    }
  }
  assert.equal(state.spawnIntervalMs, 600);
  assert.equal(state.fallSpeed, 2);
});

test('rapid consecutive column entries at high speed never overlap or tunnel', () => {
  // At 180s: interval=600ms, speed=1.65. Reverse adjacent bag boundaries
  // to force two same-column spawns only 600ms apart (travel distance <1).
  let bagNumber = 0;
  let calls = 0;
  const rng = () => {
    const phase = calls++ % 7;
    if (phase === 0) bagNumber++;
    return phase < 3 && bagNumber % 2 === 0 ? 0 : fixed();
  };
  let state = createGame(['x'], rng);
  while (state.elapsedMs < 180_000) {
    state = advance(state, 200, rng);
    while (state.blocks.length) state = submit(state, 'x');
  }
  let sawIncomingQueue = false;
  while (state.status === 'running') {
    state = advance(state, 50, rng);
    assertBoard(state);
    sawIncomingQueue ||= state.blocks.some(candidate => candidate.y < 0);
  }
  assert.equal(sawIncomingQueue, true);
  assert.ok(state.blocks.some(candidate => candidate.settled && candidate.y === 0));
});

test('Game Over occurs on the eighth settled cell and freezes time, RNG, input, and counters', () => {
  const initial = createGame(['x'], fixed);
  const ended = advance(initial, 1_000_000, fixed);
  assert.equal(ended.status, 'gameover');
  assert.ok(ended.elapsedMs < 1_000_000);
  assert.ok([0, 1, 2, 3].some(column => ended.blocks.filter(candidate => candidate.column === column && candidate.settled).length === 8));
  assertBoard(ended);
  const before = advance(initial, ended.elapsedMs - 0.01, fixed);
  assert.equal(before.status, 'running');
  assert.ok(before.blocks.every(candidate => !candidate.settled || candidate.y > 0));
  const atEnd = advance(before, 0.01, fixed);
  assert.equal(atEnd.status, 'gameover');
  close(atEnd.elapsedMs, ended.elapsedMs);
  freezeDeep(ended);
  const forbiddenRng = () => { throw new Error('RNG called after Game Over'); };
  assert.strictEqual(advance(ended, 100_000, forbiddenRng), ended);
  assert.strictEqual(submit(ended, 'x'), ended);
  assert.strictEqual(submit(ended, 'no match'), ended);
});

test('one large delta and many irregular frames produce the same observable game', () => {
  const rngA = seeded(123);
  const rngB = seeded(123);
  const big = advance(createGame(['a', 'b', 'c'], rngA), 100_000, rngA);
  let small = createGame(['a', 'b', 'c'], rngB);
  const frames = [1, 16.7, 333.33, 2700, 0.01, 5001];
  let frame = 0;
  while (small.status === 'running') small = advance(small, frames[frame++ % frames.length]!, rngB);
  assert.equal(small.status, big.status);
  close(small.elapsedMs, big.elapsedMs);
  close(small.spawnElapsedMs, big.spawnElapsedMs);
  assert.deepEqual(small.columnBag, big.columnBag);
  assert.equal(small.nextBlockId, big.nextBlockId);
  assert.equal(small.blocks.length, big.blocks.length);
  for (const candidate of big.blocks) {
    const other = block(small, candidate.id);
    assert.equal(other.text, candidate.text);
    assert.equal(other.column, candidate.column);
    assert.equal(other.settled, candidate.settled);
    close(other.y, candidate.y);
    close(other.createdAtMs, candidate.createdAtMs);
  }
});

test('public operations accept frozen snapshots and do not mutate earlier states or prompt input', () => {
  const prompts = ['x'];
  const initial = createGame(prompts, fixed);
  prompts[0] = 'changed';
  assert.deepEqual(initial.prompts, ['x']);
  freezeDeep(initial);
  const state = advance(initial, 5000, fixed);
  freezeDeep(state);
  const snapshot = JSON.stringify(state);
  advance(state, 10_000, fixed);
  submit(state, 'x');
  submit(state, 'miss');
  assert.equal(JSON.stringify(state), snapshot);
  assert.equal(initial.blocks.length, 0);
  assert.strictEqual(advance(state, 0, () => { throw new Error('Unexpected RNG'); }), state);
});

test('restarting resets all state, counters, prompts, ids, and shuffle bag', () => {
  let old = advance(createGame(['old'], fixed), 2400, fixed);
  old = submit(submit(old, 'miss'), 'old');
  old = advance(old, 100_000, fixed);
  const saved = JSON.stringify(old);
  const fresh = createGame(['new'], fixed);
  assert.equal(fresh.elapsedMs, 0);
  assert.equal(fresh.score, 0);
  assert.equal(fresh.clearedCount, 0);
  assert.equal(fresh.unmatchedCount, 0);
  assert.equal(fresh.spawnElapsedMs, 0);
  assert.equal(fresh.spawnIntervalMs, 2400);
  assert.equal(fresh.fallSpeed, 0.75);
  assert.equal(fresh.nextBlockId, 1);
  assert.equal(fresh.status, 'running');
  assert.deepEqual(fresh.blocks, []);
  assert.deepEqual(fresh.columnBag, [0, 1, 2, 3]);
  assert.deepEqual(fresh.prompts, ['new']);
  const spawned = advance(fresh, 2400, fixed);
  assert.equal(block(spawned, 1).text, 'new');
  assert.equal(block(spawned, 1).y, 0);
  assert.equal(JSON.stringify(old), saved);
});

test('invalid deltas and RNG outputs fail explicitly without changing the input state', () => {
  const state = createGame(['x'], fixed);
  const snapshot = JSON.stringify(state);
  for (const delta of [-1, NaN, Infinity, -Infinity]) assert.throws(() => advance(state, delta, fixed), RangeError);
  for (const value of [-0.1, 1, NaN, Infinity]) {
    assert.throws(() => createGame(['x'], () => value), RangeError);
    assert.throws(() => advance(state, 2400, () => value), RangeError);
  }
  assert.equal(JSON.stringify(state), snapshot);
});
