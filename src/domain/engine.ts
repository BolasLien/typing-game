import { Block, GameConfig, GameStats, DEFAULT_CONFIG } from '../types/game';

export interface GameEngineState {
  blocks: Block[];
  stats: GameStats;
  isGameOver: boolean;
  lastSpawnTimeMs: number;
  lastSpawnedColumn: number | null;
}

export function createInitialEngineState(): GameEngineState {
  return {
    blocks: [],
    stats: {
      score: 0,
      correctCount: 0,
      mismatchCount: 0,
      survivalTimeSeconds: 0,
    },
    isGameOver: false,
    lastSpawnTimeMs: 0,
    lastSpawnedColumn: null,
  };
}

/**
 * Calculates current fall speed (px/s) based on survival time.
 */
export function getCurrentFallSpeed(
  survivalTimeSeconds: number,
  config: GameConfig = DEFAULT_CONFIG
): number {
  const speed = config.initialFallSpeedPxPerSec + survivalTimeSeconds * 1.6;
  return Math.min(config.maxFallSpeedPxPerSec, speed);
}

/**
 * Calculates current spawn interval (ms) based on survival time.
 */
export function getCurrentSpawnInterval(
  survivalTimeSeconds: number,
  config: GameConfig = DEFAULT_CONFIG
): number {
  const interval = config.initialSpawnIntervalMs - survivalTimeSeconds * 35;
  return Math.max(config.minSpawnIntervalMs, interval);
}

/**
 * Finds the landing target row for a column.
 * If empty: config.rows - 1.
 * If column has landed blocks: min(landed rows) - 1.
 */
export function getColumnTargetRow(
  column: number,
  blocks: Block[],
  config: GameConfig = DEFAULT_CONFIG
): number {
  const landedInCol = blocks.filter((b) => b.column === column && b.status === 'landed');
  if (landedInCol.length === 0) {
    return config.rows - 1;
  }
  const topLandedRow = Math.min(...landedInCol.map((b) => b.row ?? config.rows - 1));
  return topLandedRow - 1;
}

/**
 * Checks if a column is eligible to spawn a new block:
 * 1. Target row >= 0 (column not full)
 * 2. No block currently in the top spawn clearance zone
 */
export function isColumnAvailableForSpawn(
  column: number,
  blocks: Block[],
  config: GameConfig = DEFAULT_CONFIG
): boolean {
  const targetRow = getColumnTargetRow(column, blocks, config);
  if (targetRow < 0) {
    return false;
  }

  // Check if any falling block in this column is still near the spawn entrance
  const hasFallingNearTop = blocks.some(
    (b) => b.column === column && b.status === 'falling' && b.y < -config.cellHeight * 0.2
  );
  return !hasFallingNearTop;
}

/**
 * Picks an available column for spawning, avoiding consecutive repeats if possible.
 */
export function chooseSpawnColumn(
  blocks: Block[],
  lastSpawnedColumn: number | null,
  config: GameConfig = DEFAULT_CONFIG
): number | null {
  const availableCols: number[] = [];
  for (let c = 0; c < config.columns; c++) {
    if (isColumnAvailableForSpawn(c, blocks, config)) {
      availableCols.push(c);
    }
  }

  if (availableCols.length === 0) {
    return null;
  }

  if (availableCols.length === 1) {
    return availableCols[0];
  }

  // Avoid repeating the same column consecutively if other options exist
  const candidateCols =
    lastSpawnedColumn !== null && availableCols.includes(lastSpawnedColumn)
      ? availableCols.filter((c) => c !== lastSpawnedColumn)
      : availableCols;

  const pool = candidateCols.length > 0 ? candidateCols : availableCols;
  const randomIndex = Math.floor(Math.random() * pool.length);
  return pool[randomIndex];
}

/**
 * Spawns a new prompt block.
 */
export function spawnBlock(
  promptSet: string[],
  blocks: Block[],
  lastSpawnedColumn: number | null,
  nowMs: number,
  config: GameConfig = DEFAULT_CONFIG
): { newBlock: Block | null; chosenColumn: number | null } {
  if (promptSet.length === 0) {
    return { newBlock: null, chosenColumn: null };
  }

  const column = chooseSpawnColumn(blocks, lastSpawnedColumn, config);
  if (column === null) {
    return { newBlock: null, chosenColumn: null };
  }

  const prompt = promptSet[Math.floor(Math.random() * promptSet.length)];
  const targetRow = getColumnTargetRow(column, blocks, config);

  const block: Block = {
    id: `${nowMs}-${Math.random().toString(36).substring(2, 9)}`,
    text: prompt,
    column,
    status: 'falling',
    y: -config.cellHeight,
    targetRow,
    createdAt: nowMs,
  };

  return { newBlock: block, chosenColumn: column };
}

/**
 * Updates blocks position and handles landing/game over logic for a delta time step.
 */
export function tickEngine(
  state: GameEngineState,
  dtSeconds: number,
  config: GameConfig = DEFAULT_CONFIG
): GameEngineState {
  if (state.isGameOver) {
    return state;
  }

  const fallSpeed = getCurrentFallSpeed(state.stats.survivalTimeSeconds, config);
  let isGameOver = false;

  const nextBlocks = state.blocks.map((block) => {
    if (block.status === 'landed') {
      return block;
    }

    const targetY = block.targetRow * config.cellHeight;
    const nextY = block.y + fallSpeed * dtSeconds;

    if (nextY >= targetY) {
      const landedRow = block.targetRow;
      // If a block lands on row 0 (or beyond), the column is fully filled -> Game Over
      if (landedRow <= 0) {
        isGameOver = true;
      }
      return {
        ...block,
        y: targetY,
        status: 'landed' as const,
        row: landedRow,
      };
    }

    return {
      ...block,
      y: nextY,
    };
  });

  return {
    ...state,
    blocks: nextBlocks,
    isGameOver: isGameOver || state.isGameOver,
    stats: {
      ...state.stats,
      survivalTimeSeconds: state.stats.survivalTimeSeconds + dtSeconds,
    },
  };
}

/**
 * Eliminates a target block and shifts stacked blocks down in the same column.
 */
export function eliminateBlock(
  targetBlockId: string,
  blocks: Block[],
  config: GameConfig = DEFAULT_CONFIG
): Block[] {
  const target = blocks.find((b) => b.id === targetBlockId);
  if (!target) {
    return blocks;
  }

  const remaining = blocks.filter((b) => b.id !== targetBlockId);

  // If the eliminated block was landed:
  if (target.status === 'landed' && target.row !== undefined) {
    const col = target.column;
    const eliminatedRow = target.row;

    // All landed blocks in this column that were ABOVE the eliminated block shift down by 1
    return remaining.map((b) => {
      if (b.column === col && b.status === 'landed' && b.row !== undefined && b.row < eliminatedRow) {
        const nextRow = b.row + 1;
        return {
          ...b,
          row: nextRow,
          y: nextRow * config.cellHeight,
        };
      }
      // Falling block in this column now has its target row increase by 1
      if (b.column === col && b.status === 'falling') {
        return {
          ...b,
          targetRow: Math.min(config.rows - 1, b.targetRow + 1),
        };
      }
      return b;
    });
  }

  // If the eliminated block was falling:
  if (target.status === 'falling') {
    // If there were other falling blocks above it in the same column, update their targetRow
    return remaining.map((b) => {
      if (b.column === target.column && b.status === 'falling' && b.y < target.y) {
        const newTargetRow = getColumnTargetRow(target.column, remaining, config);
        return {
          ...b,
          targetRow: newTargetRow,
        };
      }
      return b;
    });
  }

  return remaining;
}
