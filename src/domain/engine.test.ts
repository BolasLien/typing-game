import { describe, it, expect } from 'vitest';
import {
  createInitialEngineState,
  tickEngine,
  eliminateBlock,
  getColumnTargetRow,
  getCurrentFallSpeed,
  getCurrentSpawnInterval,
} from './engine';
import { Block, DEFAULT_CONFIG } from '../types/game';

describe('game engine physics and rules', () => {
  it('calculates difficulty acceleration over time', () => {
    const initialSpeed = getCurrentFallSpeed(0, DEFAULT_CONFIG);
    const laterSpeed = getCurrentFallSpeed(60, DEFAULT_CONFIG);
    expect(laterSpeed).toBeGreaterThan(initialSpeed);

    const initialInterval = getCurrentSpawnInterval(0, DEFAULT_CONFIG);
    const laterInterval = getCurrentSpawnInterval(60, DEFAULT_CONFIG);
    expect(laterInterval).toBeLessThan(initialInterval);
  });

  it('calculates column target row for empty column and stacked column', () => {
    const blocks: Block[] = [
      {
        id: '1',
        text: 'test',
        column: 0,
        status: 'landed',
        y: 7 * 64,
        targetRow: 7,
        row: 7,
        createdAt: 0,
      },
    ];

    // Column 0 has 1 landed block at row 7, target row should be 6
    expect(getColumnTargetRow(0, blocks, DEFAULT_CONFIG)).toBe(6);
    // Column 1 is empty, target row should be 7 (bottom)
    expect(getColumnTargetRow(1, blocks, DEFAULT_CONFIG)).toBe(7);
  });

  it('moves falling block and lands it at target row', () => {
    let state = createInitialEngineState();
    const fallingBlock: Block = {
      id: 'f1',
      text: 'apple',
      column: 0,
      status: 'falling',
      y: 7 * 64 - 10, // 10 pixels above landing
      targetRow: 7,
      createdAt: 0,
    };
    state.blocks = [fallingBlock];

    // Step 1 second (speed is ~55px/s, will exceed target 7 * 64)
    state = tickEngine(state, 1, DEFAULT_CONFIG);

    expect(state.blocks[0].status).toBe('landed');
    expect(state.blocks[0].row).toBe(7);
    expect(state.blocks[0].y).toBe(7 * 64);
    expect(state.isGameOver).toBe(false);
  });

  it('triggers Game Over when a block lands on row 0 (column full)', () => {
    let state = createInitialEngineState();
    const blockAtTop: Block = {
      id: 'top',
      text: 'danger',
      column: 2,
      status: 'falling',
      y: 10,
      targetRow: 0, // Top row!
      createdAt: 0,
    };
    state.blocks = [blockAtTop];

    // Tick enough to land
    state = tickEngine(state, 1, DEFAULT_CONFIG);
    expect(state.blocks[0].status).toBe('landed');
    expect(state.blocks[0].row).toBe(0);
    expect(state.isGameOver).toBe(true);
  });

  it('shifts upper landed blocks down when a lower landed block is eliminated', () => {
    // In column 0:
    // Row 7 (bottom): block A
    // Row 6: block B
    // Row 5: block C
    const blocks: Block[] = [
      {
        id: 'block-A',
        text: 'A',
        column: 0,
        status: 'landed',
        y: 7 * 64,
        targetRow: 7,
        row: 7,
        createdAt: 100,
      },
      {
        id: 'block-B',
        text: 'B',
        column: 0,
        status: 'landed',
        y: 6 * 64,
        targetRow: 6,
        row: 6,
        createdAt: 200,
      },
      {
        id: 'block-C',
        text: 'C',
        column: 0,
        status: 'landed',
        y: 5 * 64,
        targetRow: 5,
        row: 5,
        createdAt: 300,
      },
    ];

    // Eliminate middle block B (at row 6)
    const nextBlocks = eliminateBlock('block-B', blocks, DEFAULT_CONFIG);

    expect(nextBlocks.length).toBe(2);
    // Block A (at row 7) stays at row 7
    const blockA = nextBlocks.find((b) => b.id === 'block-A');
    expect(blockA?.row).toBe(7);
    expect(blockA?.y).toBe(7 * 64);

    // Block C (was at row 5, above B) shifts down to row 6!
    const blockC = nextBlocks.find((b) => b.id === 'block-C');
    expect(blockC?.row).toBe(6);
    expect(blockC?.y).toBe(6 * 64);
  });
});
