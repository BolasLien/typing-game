import React from 'react';
import { GameStats } from '../../types/game';
import { Trophy, Clock, CheckCircle, XCircle, ArrowLeft } from 'lucide-react';

interface StatsHeaderProps {
  stats: GameStats;
  onBackToSource: () => void;
}

export const StatsHeader: React.FC<StatsHeaderProps> = ({ stats, onBackToSource }) => {
  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = Math.floor(totalSeconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="w-full max-w-4xl mx-auto mb-4 px-2">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 rounded-xl px-4 py-2.5 shadow-lg backdrop-blur-sm">
        <button
          type="button"
          onClick={onBackToSource}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-colors border border-slate-700"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          返回編輯
        </button>

        <div className="flex items-center gap-4 sm:gap-6 text-sm">
          {/* Score */}
          <div className="flex items-center gap-1.5">
            <Trophy className="w-4 h-4 text-amber-400" />
            <span className="text-xs text-slate-400">總分</span>
            <span data-testid="stats-score" className="font-bold text-amber-300 font-mono">
              {stats.score}
            </span>
          </div>

          {/* Correct Eliminations */}
          <div className="flex items-center gap-1.5">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            <span className="text-xs text-slate-400">消除</span>
            <span data-testid="stats-correct" className="font-bold text-emerald-300 font-mono">
              {stats.correctCount}
            </span>
          </div>

          {/* Mismatches */}
          <div className="flex items-center gap-1.5">
            <XCircle className="w-4 h-4 text-rose-400" />
            <span className="text-xs text-slate-400">未匹配</span>
            <span data-testid="stats-mismatch" className="font-bold text-rose-300 font-mono">
              {stats.mismatchCount}
            </span>
          </div>

          {/* Survival Time */}
          <div className="flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-sky-400" />
            <span className="text-xs text-slate-400">存活</span>
            <span data-testid="stats-time" className="font-bold text-sky-300 font-mono">
              {formatTime(stats.survivalTimeSeconds)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
