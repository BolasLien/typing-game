import { PromptParseResult } from '../types/game';

/**
 * Parses raw text input into a prompt set according to the game specification.
 * - Trims leading and trailing whitespace per line.
 * - Ignores completely blank lines.
 * - Preserves internal whitespace (e.g. "good morning").
 * - Retains duplicates to respect weighting.
 * - Requires at least 1 valid prompt to be valid.
 */
export function parseSourceText(rawText: string): PromptParseResult {
  const lines = rawText.split(/\r?\n/);
  const totalLines = lines.length;
  const validPrompts: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length > 0) {
      validPrompts.push(trimmed);
    }
  }

  if (validPrompts.length === 0) {
    return {
      validPrompts: [],
      totalLines,
      validCount: 0,
      error: '至少需要輸入一個有效題目才能開始遊戲。',
    };
  }

  return {
    validPrompts,
    totalLines,
    validCount: validPrompts.length,
  };
}

export const DEFAULT_SAMPLE_SOURCE = `蘋果
今天天氣很好
りんご
おはようございます
apple
good morning`;
