import React, { useState, useMemo } from 'react';
import { parseSourceText, DEFAULT_SAMPLE_SOURCE } from '../../domain/parser';
import { FileText, Play, AlertCircle, CheckCircle2 } from 'lucide-react';

export interface SourceEditorProps {
  initialSource?: string;
  onStartGame: (prompts: string[], sourceText: string) => void;
}

export const SourceEditor: React.FC<SourceEditorProps> = ({
  initialSource = DEFAULT_SAMPLE_SOURCE,
  onStartGame,
}) => {
  const [sourceText, setSourceText] = useState(initialSource);

  const parseResult = useMemo(() => parseSourceText(sourceText), [sourceText]);

  const handleStart = () => {
    if (parseResult.validCount > 0) {
      onStartGame(parseResult.validPrompts, sourceText);
    }
  };

  const handleLoadSample = () => {
    setSourceText(DEFAULT_SAMPLE_SOURCE);
  };

  const handleClear = () => {
    setSourceText('');
  };

  return (
    <div className="w-full max-w-2xl mx-auto bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-2xl backdrop-blur-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg border border-indigo-500/20">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">匯入自訂文字來源</h2>
            <p className="text-xs text-slate-400">貼上純文字，每一非空白行將建立一個獨立題目</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleLoadSample}
            className="text-xs px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700"
          >
            載入範例題目
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="text-xs px-2.5 py-1.5 rounded-lg bg-slate-800/60 hover:bg-slate-700/60 text-slate-400 hover:text-slate-200 transition-colors"
          >
            清空
          </button>
        </div>
      </div>

      <div className="relative mb-4">
        <textarea
          data-testid="source-textarea"
          value={sourceText}
          onChange={(e) => setSourceText(e.target.value)}
          placeholder="在此貼上多行文字...&#10;蘋果&#10;今天天氣很好&#10;りんご&#10;apple"
          rows={10}
          className="w-full bg-slate-950/80 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl p-3.5 text-sm text-slate-100 font-mono resize-y placeholder:text-slate-600 transition-all outline-none"
        />
      </div>

      {/* Status bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6 p-3 bg-slate-950/60 border border-slate-850 rounded-xl">
        <div className="flex items-center gap-2 text-xs">
          {parseResult.validCount > 0 ? (
            <>
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="text-slate-300">
                有效題目數：<strong className="text-emerald-400 font-semibold">{parseResult.validCount}</strong> 題
                <span className="text-slate-500 ml-1.5">(共 {parseResult.totalLines} 行)</span>
              </span>
            </>
          ) : (
            <>
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="text-amber-300">{parseResult.error || '無有效題目'}</span>
            </>
          )}
        </div>

        <div className="text-[11px] text-slate-500">
          支援中文、日文、英文與任何 Unicode 文字
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          data-testid="start-game-btn"
          disabled={parseResult.validCount === 0}
          onClick={handleStart}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-medium text-sm transition-all shadow-lg ${
            parseResult.validCount > 0
              ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30 hover:shadow-indigo-500/40 cursor-pointer active:scale-95'
              : 'bg-slate-800 text-slate-500 cursor-not-allowed'
          }`}
        >
          <Play className="w-4 h-4 fill-current" />
          開始挑戰
        </button>
      </div>
    </div>
  );
};
