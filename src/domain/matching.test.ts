import { describe, it, expect } from 'vitest';
import { matchSubmission } from './matching';
import { Block, DEFAULT_CONFIG } from '../types/game';

describe('matchSubmission', () => {
  const sampleBlocks: Block[] = [
    {
      id: '1',
      text: '蘋果',
      column: 0,
      status: 'landed',
      y: 7 * 64,
      targetRow: 7,
      row: 7,
      createdAt: 1000,
    },
    {
      id: '2',
      text: 'おはようございます',
      column: 1,
      status: 'falling',
      y: 120,
      targetRow: 7,
      createdAt: 1100,
    },
    {
      id: '3',
      text: 'good morning',
      column: 2,
      status: 'landed',
      y: 7 * 64,
      targetRow: 7,
      row: 7,
      createdAt: 1200,
    },
  ];

  it('matches Chinese prompt exactly', () => {
    const matched = matchSubmission('蘋果', sampleBlocks, DEFAULT_CONFIG);
    expect(matched?.id).toBe('1');
  });

  it('matches Japanese prompt exactly', () => {
    const matched = matchSubmission('おはようございます', sampleBlocks, DEFAULT_CONFIG);
    expect(matched?.id).toBe('2');
  });

  it('matches English prompt with spaces', () => {
    const matched = matchSubmission('good morning', sampleBlocks, DEFAULT_CONFIG);
    expect(matched?.id).toBe('3');
  });

  it('does not match partial prompts', () => {
    expect(matchSubmission('蘋', sampleBlocks, DEFAULT_CONFIG)).toBeNull();
    expect(matchSubmission('good', sampleBlocks, DEFAULT_CONFIG)).toBeNull();
    expect(matchSubmission('おはよう', sampleBlocks, DEFAULT_CONFIG)).toBeNull();
  });

  it('does not match absent prompts', () => {
    expect(matchSubmission('香蕉', sampleBlocks, DEFAULT_CONFIG)).toBeNull();
    expect(matchSubmission('hello', sampleBlocks, DEFAULT_CONFIG)).toBeNull();
  });

  it('selects the more dangerous block when duplicate prompts exist', () => {
    // Column 0 has 2 landed blocks: row 7 (bottom) and row 6 (higher, more dangerous)
    // Column 1 has 1 landed block: row 7
    const duplicateBlocks: Block[] = [
      {
        id: 'dup-col1-row7',
        text: 'apple',
        column: 1,
        status: 'landed',
        y: 7 * 64,
        targetRow: 7,
        row: 7,
        createdAt: 1000,
      },
      {
        id: 'dup-col0-row7',
        text: 'other',
        column: 0,
        status: 'landed',
        y: 7 * 64,
        targetRow: 7,
        row: 7,
        createdAt: 900,
      },
      {
        id: 'dup-col0-row6',
        text: 'apple',
        column: 0,
        status: 'landed',
        y: 6 * 64,
        targetRow: 6,
        row: 6,
        createdAt: 1100,
      },
    ];

    const matched = matchSubmission('apple', duplicateBlocks, DEFAULT_CONFIG);
    // Column 0 has 2 blocks, Column 1 has 1 block. Column 0 is taller and dup-col0-row6 is higher elevation.
    expect(matched?.id).toBe('dup-col0-row6');
  });
});
