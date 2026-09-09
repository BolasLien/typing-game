export type GameState = 'SOURCE_EDITING' | 'COUNTDOWN' | 'PLAYING' | 'GAME_OVER';

export interface Block {
  id: string;
  text: string;
  column: number; // 0-indexed column
  status: 'falling' | 'landed';
  y: number; // vertical pixel position from top
  targetRow: number; // 0-indexed row it will land on (0 is top, ROWS-1 is bottom)
  row?: number; // row index when landed
  createdAt: number;
}

export interface GameStats {
  score: number;
  correctCount: number;
  mismatchCount: number;
  survivalTimeSeconds: number;
}

export interface GameConfig {
  columns: number;
  rows: number;
  cellHeight: number;
  initialSpawnIntervalMs: number;
  minSpawnIntervalMs: number;
  initialFallSpeedPxPerSec: number;
  maxFallSpeedPxPerSec: number;
  scorePerPrompt: number;
}

export const DEFAULT_CONFIG: GameConfig = {
  columns: 4,
  rows: 8,
  cellHeight: 64,
  initialSpawnIntervalMs: 3200,
  minSpawnIntervalMs: 1200,
  initialFallSpeedPxPerSec: 55,
  maxFallSpeedPxPerSec: 150,
  scorePerPrompt: 100,
};

export interface PromptParseResult {
  validPrompts: string[];
  totalLines: number;
  validCount: number;
  error?: string;
}
