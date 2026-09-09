import React from 'react';
import { GameStats } from '../../types/game';
import { Trophy, CheckCircle2, XCircle, RotateCcw, Edit3 } from 'lucide-react';

interface GameOverModalProps {
  stats: GameStats;
  onRestart: () => void;
  onBackToSource: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  stats,
  onRestart,
  onBackToSource,
}) => {
  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = Math.floor(totalSeconds % 60);
    return `${mins} 分 ${secs} 秒`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl text-center">
        <div className="inline-flex p-3 bg-rose-500/10 text-rose-400 rounded-2xl border border-rose-500/20 mb-4">
          <Trophy className="w-8 h-8 text-amber-400" />
        </div>

        <h2 className="text-2xl font-black text-white tracking-tight mb-1">遊戲結束</h2>
        <p className="text-xs text-slate-400 mb-6">方塊已堆滿至頂部警戒線</p>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-slate-950/70 border border-slate-800 p-3.5 rounded-xl text-center">
            <span className="text-[11px] text-slate-400 block mb-1">總得分</span>
            <span data-testid="modal-final-score" className="text-2xl font-extrabold text-amber-300 font-mono">
              {stats.score}
            </span>
          </div>

          <div className="bg-slate-950/70 border border-slate-800 p-3.5 rounded-xl text-center">
            <span className="text-[11px] text-slate-400 block mb-1">存活時間</span>
            <span data-testid="modal-final-time" className="text-lg font-bold text-sky-300 font-mono mt-1 block">
              {formatTime(stats.survivalTimeSeconds)}
            </span>
          </div>

          <div className="bg-slate-950/70 border border-slate-800 p-3.5 rounded-xl text-center">
            <div className="flex items-center justify-center gap-1 text-[11px] text-slate-400 mb-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>正確消除</span>
            </div>
            <span data-testid="modal-final-correct" className="text-xl font-bold text-emerald-300 font-mono">
              {stats.correctCount} <span className="text-xs font-normal text-slate-500">題</span>
            </span>
          </div>

          <div className="bg-slate-950/70 border border-slate-800 p-3.5 rounded-xl text-center">
            <div className="flex items-center justify-center gap-1 text-[11px] text-slate-400 mb-1">
              <XCircle className="w-3.5 h-3.5 text-rose-400" />
              <span>未匹配提交</span>
            </div>
            <span data-testid="modal-final-mismatch" className="text-xl font-bold text-rose-300 font-mono">
              {stats.mismatchCount} <span className="text-xs font-normal text-slate-500">次</span>
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            data-testid="restart-game-btn"
            onClick={onRestart}
            className="flex items-center justify-center gap-2 w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-indigo-600/30 active:scale-98"
          >
            <RotateCcw className="w-4 h-4" />
            使用相同題目集重新開始
          </button>

          <button
            type="button"
            data-testid="edit-source-btn"
            onClick={onBackToSource}
            className="flex items-center justify-center gap-2 w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-xl transition-colors border border-slate-700"
          >
            <Edit3 className="w-4 h-4" />
            返回編輯來源
          </button>
        </div>
      </div>
    </div>
  );
};
