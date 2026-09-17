/** Random samples must be finite and in [0, 1). Pass the RNG on every call
 * that can generate blocks; functions never retain an RNG or read a clock. */
export type Rng = () => number;
export type Column = 0 | 1 | 2 | 3;
export type GameStatus = 'running' | 'gameover';

export interface Block {
  /** Monotonically increasing within one game; also breaks generation ties. */
  readonly id: number;
  /** Original prompt for display. Matching alone uses NFC. */
  readonly text: string;
  readonly column: Column;
  /** Top edge in cells: 0 is the top row and 7 is the bottom row.
   * Negative values represent incoming blocks waiting above an occupied entry. */
  readonly y: number;
  /** True only when supported by the floor or a contiguous settled stack. */
  readonly settled: boolean;
  readonly createdAtMs: number;
}

/** Immutable, JSON-serializable snapshot. Retain the returned state after every
 * operation. Treat all fields as read-only; only createGame creates valid states.
 * UI owns countdown, input/composition, focus, and whether to advance the clock. */
export interface GameState {
  readonly status: GameStatus;
  readonly prompts: readonly string[];
  readonly blocks: readonly Block[];
  readonly score: number;
  readonly clearedCount: number;
  readonly unmatchedCount: number;
  /** Simulated survival time, frozen at the exact terminal landing. */
  readonly elapsedMs: number;
  readonly spawnIntervalMs: number;
  /** Cells per second. */
  readonly fallSpeed: number;
  /** Time accumulated since the last spawn (carried through speed changes). */
  readonly spawnElapsedMs: number;
  /** Remaining columns in the current shuffle bag, consumed from the front. */
  readonly columnBag: readonly Column[];
  readonly nextBlockId: number;
}

type MutableState = { -readonly [K in keyof GameState]: GameState[K] };
const COLUMNS: readonly Column[] = [0, 1, 2, 3];
const ROWS = 8;
const LEVEL_MS = 20_000;
// Only absorbs floating-point rounding at contact/event boundaries.
const EPSILON = 1e-9;

function validatePrompts(prompts: readonly string[]): void {
  if (prompts.length === 0) throw new RangeError('來源至少需要一題');
  if (prompts.length > 500) throw new RangeError('來源最多 500 題');
  for (const [index, text] of prompts.entries()) {
    if (text.trim().length === 0) {
      throw new RangeError(`第 ${index + 1} 題不可為空白`);
    }
    if ([...text].length > 40) {
      throw new RangeError(`第 ${index + 1} 題超過 40 個 Unicode code points`);
    }
  }
}

/** Splits LF/CRLF/CR lines, trims each, and drops blank lines. Keeps internal
 * whitespace, spelling, and duplicate entries (which weight random selection).
 * Limits count code points BEFORE NFC, not UTF-16 units or grapheme clusters.
 * Throws RangeError for empty input, >500 prompts, or any prompt >40 points. */
export function parseSource(source: string): string[] {
  const prompts = source.split(/\r\n|[\n\r]/u).map(line => line.trim()).filter(Boolean);
  validatePrompts(prompts);
  return prompts;
}

function randomIndex(length: number, rng: Rng): number {
  const value = rng();
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new RangeError('RNG 必須回傳 [0, 1) 範圍內的有限數值');
  }
  return Math.floor(value * length);
}

function shuffleColumns(rng: Rng): Column[] {
  const bag = [...COLUMNS];
  for (let index = bag.length - 1; index > 0; index--) {
    const other = randomIndex(index + 1, rng);
    [bag[index], bag[other]] = [bag[other]!, bag[index]!];
  }
  return bag;
}

/** Starts empty at t=0, first block at t=2400ms. Copies/validates prompts,
 * shuffles the first column bag, and resets all per-game state. */
export function createGame(prompts: readonly string[], rng: Rng = Math.random): GameState {
  validatePrompts(prompts);
  return {
    status: 'running', prompts: [...prompts], blocks: [],
    score: 0, clearedCount: 0, unmatchedCount: 0,
    elapsedMs: 0, spawnIntervalMs: 2400, fallSpeed: 0.75,
    spawnElapsedMs: 0, columnBag: shuffleColumns(rng), nextBlockId: 1,
  };
}

function columnBlocks(blocks: readonly Block[], column: Column): Block[] {
  return blocks.filter(block => block.column === column)
    .sort((a, b) => b.y - a.y || a.id - b.id);
}

/** Resolve bottom-up, so an upper block can never pass its current support.
 * A zero-distance pass also releases unsupported blocks after submission. */
function moveBlocks(blocks: readonly Block[], distance: number): Block[] {
  const moved = new Map<number, Block>();
  for (const column of COLUMNS) {
    let supportY = ROWS;
    let supportSettled = true;
    for (const block of columnBlocks(blocks, column)) {
      const targetY = supportY - 1;
      let y = Math.min(block.y + distance, targetY);
      if (targetY - y <= EPSILON) y = targetY;
      const settled: boolean = supportSettled && y === targetY;
      moved.set(block.id, { ...block, y, settled });
      supportY = y;
      supportSettled = settled;
    }
  }
  return blocks.map(block => moved.get(block.id)!);
}

function timeToLanding(state: GameState): number {
  let nextMs = Infinity;
  for (const column of COLUMNS) {
    const blocks = columnBlocks(state.blocks, column);
    const falling = blocks.find(block => !block.settled);
    if (!falling) continue;
    const height = blocks.filter(block => block.settled).length;
    const distance = ROWS - 1 - height - falling.y;
    nextMs = Math.min(nextMs, Math.max(0, distance * 1000 / state.fallSpeed));
  }
  return nextMs;
}

function checkGameOver(state: MutableState): boolean {
  if (COLUMNS.some(column =>
    state.blocks.filter(block => block.column === column && block.settled).length >= ROWS,
  )) state.status = 'gameover';
  return state.status === 'gameover';
}

function spawn(state: MutableState, rng: Rng): void {
  const bag = state.columnBag.length ? [...state.columnBag] : shuffleColumns(rng);
  const column = bag.shift()!;
  const text = state.prompts[randomIndex(state.prompts.length, rng)]!;
  const topY = Math.min(1, ...state.blocks.filter(block => block.column === column).map(block => block.y));
  state.blocks = [...state.blocks, {
    id: state.nextBlockId++, text, column, y: topY - 1,
    settled: false, createdAtMs: state.elapsedMs,
  }];
  state.columnBag = bag;
  state.blocks = moveBlocks(state.blocks, 0);
  checkGameOver(state);
}

/** Advances only simulated time. Splits at landings, spawns, and 20s difficulty
 * boundaries, so large deltas cannot tunnel or continue past Game Over.
 * At simultaneous events: land/check loss, update difficulty, then spawn.
 * Throws RangeError for a negative/non-finite delta on a running game.
 * Terminal states and zero delta return the same object, without calling RNG. */
export function advance(state: GameState, deltaMs: number, rng: Rng = Math.random): GameState {
  if (state.status === 'gameover') return state;
  if (!Number.isFinite(deltaMs) || deltaMs < 0) {
    throw new RangeError('deltaMs 必須是非負有限數值');
  }
  if (deltaMs === 0) return state;
  const next: MutableState = { ...state };
  let remaining = deltaMs;
  while (remaining > 0 && next.status === 'running') {
    const toDifficulty = LEVEL_MS - next.elapsedMs % LEVEL_MS;
    const toSpawn = Math.max(0, next.spawnIntervalMs - next.spawnElapsedMs);
    const step = Math.min(remaining, toDifficulty, toSpawn, timeToLanding(next));
    next.blocks = moveBlocks(next.blocks, next.fallSpeed * step / 1000);
    next.elapsedMs += step;
    next.spawnElapsedMs += step;
    remaining -= step;
    if (checkGameOver(next)) break;
    const level = Math.floor(next.elapsedMs / LEVEL_MS);
    next.spawnIntervalMs = Math.max(600, 2400 - level * 200);
    next.fallSpeed = Math.min(2, 0.75 + level * 0.1);
    if (next.spawnElapsedMs + EPSILON >= next.spawnIntervalMs) {
      next.spawnElapsedMs = Math.max(0, next.spawnElapsedMs - next.spawnIntervalMs);
      spawn(next, rng);
    }
  }
  return next;
}

/** Exact, case-sensitive NFC match WITHOUT trimming submitted text. Removes
 * one falling or settled block: highest settled column, lowest position, then
 * earliest generation. A miss increments unmatchedCount once (including empty
 * submissions). Released blocks fall into the gap on subsequent advance calls.
 * Terminal states are returned unchanged, with no input judged. */
export function submit(state: GameState, text: string): GameState {
  if (state.status === 'gameover') return state;
  const normalized = text.normalize('NFC');
  const heights = COLUMNS.map(column =>
    state.blocks.filter(block => block.column === column && block.settled).length,
  );
  const candidates = state.blocks.filter(block => block.text.normalize('NFC') === normalized)
    .sort((a, b) => heights[b.column]! - heights[a.column]! || b.y - a.y || a.id - b.id);
  const matched = candidates[0];
  if (!matched) return { ...state, unmatchedCount: state.unmatchedCount + 1 };
  return {
    ...state,
    blocks: moveBlocks(state.blocks.filter(block => block.id !== matched.id), 0),
    score: state.score + 100,
    clearedCount: state.clearedCount + 1,
  };
}
