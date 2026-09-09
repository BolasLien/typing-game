import React from 'react';
import { Block, GameConfig } from '../../types/game';
import { BlockView } from './BlockView';

interface ColumnViewProps {
  columnIndex: number;
  blocks: Block[];
  config: GameConfig;
}

export const ColumnView: React.FC<ColumnViewProps> = ({ columnIndex, blocks, config }) => {
  const columnHeight = config.rows * config.cellHeight;

  // Calculate danger: how many landed blocks exist in this column
  const landedCount = blocks.filter((b) => b.status === 'landed').length;
  const isHighDanger = landedCount >= config.rows - 2;
  const isCritical = landedCount >= config.rows - 1;

  return (
    <div
      data-testid={`column-${columnIndex}`}
      style={{ height: `${columnHeight}px` }}
      className={`relative flex-1 min-w-[130px] max-w-[240px] rounded-xl overflow-hidden border transition-all duration-300 ${
        isCritical
          ? 'border-rose-500 bg-rose-950/20 shadow-lg shadow-rose-900/20'
          : isHighDanger
          ? 'border-amber-500/80 bg-amber-950/10'
          : 'border-slate-800 bg-slate-900/40'
      }`}
    >
      {/* Top Danger warning line (Row 0) */}
      <div
        style={{ height: `${config.cellHeight}px` }}
        className={`absolute top-0 inset-x-0 border-b border-dashed flex items-center justify-center pointer-events-none transition-colors ${
          isHighDanger
            ? 'border-rose-500/60 bg-rose-500/10 text-rose-400 font-bold text-[10px] tracking-wider uppercase'
            : 'border-slate-800/40 text-slate-700 text-[10px]'
        }`}
      >
        {isHighDanger ? '危險警戒線' : `欄 ${columnIndex + 1}`}
      </div>

      {/* Grid cell guide lines */}
      {Array.from({ length: config.rows - 1 }).map((_, i) => (
        <div
          key={i}
          style={{ top: `${(i + 1) * config.cellHeight}px` }}
          className="absolute inset-x-0 border-t border-slate-800/30 pointer-events-none"
        />
      ))}

      {/* Column stack blocks */}
      {blocks.map((block) => (
        <BlockView
          key={block.id}
          block={block}
          config={config}
          isHighDanger={isHighDanger}
        />
      ))}
    </div>
  );
};
