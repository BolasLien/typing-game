import React from 'react';
import { Block, GameConfig } from '../../types/game';

interface BlockViewProps {
  block: Block;
  config: GameConfig;
  isHighDanger?: boolean;
}

export const BlockView: React.FC<BlockViewProps> = ({ block, config, isHighDanger = false }) => {
  const isFalling = block.status === 'falling';

  // Dynamic font sizing based on prompt length to ensure full readability
  const getTextSizeClass = (length: number) => {
    if (length <= 5) return 'text-sm sm:text-base font-semibold';
    if (length <= 10) return 'text-xs sm:text-sm font-medium';
    if (length <= 18) return 'text-[11px] sm:text-xs leading-tight font-medium';
    return 'text-[10px] leading-3 font-normal';
  };

  return (
    <div
      data-testid={`block-${block.id}`}
      data-block-text={block.text}
      data-block-status={block.status}
      style={{
        position: 'absolute',
        left: '4px',
        right: '4px',
        top: `${block.y}px`,
        height: `${config.cellHeight - 6}px`,
        transition: isFalling ? 'none' : 'top 0.15s ease-out',
      }}
      className={`flex items-center justify-center text-center p-2 rounded-lg select-none border transition-colors shadow-md ${
        isFalling
          ? 'bg-indigo-600/90 border-indigo-400 text-white shadow-indigo-500/30 ring-2 ring-indigo-400/40 z-20 animate-pulse'
          : isHighDanger
          ? 'bg-rose-950/90 border-rose-500/80 text-rose-100 shadow-rose-950/50 z-10'
          : 'bg-slate-800/95 border-slate-650 text-slate-100 shadow-slate-950/40 z-10'
      }`}
    >
      <span
        className={`w-full max-h-full overflow-hidden break-words text-balance px-0.5 ${getTextSizeClass(
          block.text.length
        )}`}
        title={block.text}
      >
        {block.text}
      </span>
    </div>
  );
};
