import { describe, it, expect } from 'vitest';
import { parseSourceText } from './parser';

describe('parseSourceText', () => {
  it('parses valid multi-language lines correctly', () => {
    const input = `
      蘋果
      今天天氣很好

      りんご
      おはようございます

      apple
      good morning
    `;
    const result = parseSourceText(input);
    expect(result.validCount).toBe(6);
    expect(result.validPrompts).toEqual([
      '蘋果',
      '今天天氣很好',
      'りんご',
      'おはようございます',
      'apple',
      'good morning',
    ]);
  });

  it('preserves internal spaces while trimming outer whitespace', () => {
    const input = '   hello   world   \n  peace and love  ';
    const result = parseSourceText(input);
    expect(result.validPrompts).toEqual(['hello   world', 'peace and love']);
  });

  it('preserves duplicate lines for weighting', () => {
    const input = 'apple\napple\norange\napple';
    const result = parseSourceText(input);
    expect(result.validCount).toBe(4);
    expect(result.validPrompts).toEqual(['apple', 'apple', 'orange', 'apple']);
  });

  it('returns error when text is empty or only whitespace', () => {
    const result1 = parseSourceText('');
    expect(result1.validCount).toBe(0);
    expect(result1.error).toBeDefined();

    const result2 = parseSourceText('   \n\n\t  \n  ');
    expect(result2.validCount).toBe(0);
    expect(result2.error).toBeDefined();
  });
});
