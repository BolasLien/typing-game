import React from 'react';
import { Block, GameConfig } from '../../types/game';
import { ColumnView } from './ColumnView';

interface GameBoardProps {
  blocks: Block[];
  config: GameConfig;
  onBoardClick?: () => void;
}

export const GameBoard: React.FC<GameBoardProps> = ({ blocks, config, onBoardClick }) => {
  // Group blocks by column
  const columnsData = Array.from({ length: config.columns }).map((_, colIndex) =>
    blocks.filter((b) => b.column === colIndex)
  );

  return (
    <div
      onClick={onBoardClick}
      className="w-full max-w-4xl mx-auto px-2 select-none"
    >
      <div className="flex gap-2 sm:gap-3 justify-center items-stretch p-3 bg-slate-950/80 rounded-2xl border border-slate-800 shadow-2xl backdrop-blur-sm">
        {columnsData.map((colBlocks, colIdx) => (
          <ColumnView
            key={colIdx}
            columnIndex={colIdx}
            blocks={colBlocks}
            config={config}
          />
        ))}
      </div>
    </div>
  );
};
