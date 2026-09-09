import { Block, GameConfig } from '../types/game';

/**
 * Calculates a danger score for a block.
 * Higher score = more immediate threat of causing a Game Over.
 * Factors:
 * 1. Column stack fullness: columns with more landed blocks are closer to top.
 * 2. Elevation: blocks positioned higher up (smaller row index or lower y) represent higher threat.
 */
export function calculateBlockDanger(
  block: Block,
  allBlocks: Block[],
  config: GameConfig
): number {
  // Count landed blocks in this column
  const columnLandedCount = allBlocks.filter(
    (b) => b.column === block.column && b.status === 'landed'
  ).length;

  // Stack fullness factor (0 to config.rows)
  const stackFullnessWeight = columnLandedCount * 100;

  // Proximity to top (row 0 is most dangerous, row rows-1 is lowest)
  let elevationScore: number;
  if (block.status === 'landed' && block.row !== undefined) {
    // row 0 has max elevation (config.rows - 0)
    elevationScore = (config.rows - block.row) * 10;
  } else {
    // Falling block: closer to target row or higher up in high-stack column
    const progressY = block.y / config.cellHeight;
    elevationScore = progressY * 5;
    // If target row is very close to top (danger of Game Over on landing)
    if (block.targetRow <= 1) {
      elevationScore += 50;
    }
  }

  return stackFullnessWeight + elevationScore;
}

/**
 * Matches a submission against active blocks.
 * Returns the matching block with the highest danger score, or null if no match.
 */
export function matchSubmission(
  submission: string,
  blocks: Block[],
  config: GameConfig
): Block | null {
  const normalizedSubmission = submission.trim().normalize('NFC');
  if (!normalizedSubmission) {
    return null;
  }

  const matches = blocks.filter(
    (block) => block.text.normalize('NFC') === normalizedSubmission
  );

  if (matches.length === 0) {
    return null;
  }

  if (matches.length === 1) {
    return matches[0];
  }

  // Multiple matches: sort descending by danger score
  matches.sort((a, b) => {
    const dangerA = calculateBlockDanger(a, blocks, config);
    const dangerB = calculateBlockDanger(b, blocks, config);
    return dangerB - dangerA;
  });

  return matches[0];
}
