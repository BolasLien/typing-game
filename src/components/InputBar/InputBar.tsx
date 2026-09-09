import React, { RefObject } from 'react';
import { CornerDownLeft, Sparkles, AlertTriangle } from 'lucide-react';

interface InputBarProps {
  value: string;
  isComposing: boolean;
  isMismatch: boolean;
  disabled: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onCompositionStart: () => void;
  onCompositionEnd: (e: React.CompositionEvent<HTMLInputElement>) => void;
}

export const InputBar: React.FC<InputBarProps> = ({
  value,
  isComposing,
  isMismatch,
  disabled,
  inputRef,
  onChange,
  onKeyDown,
  onCompositionStart,
  onCompositionEnd,
}) => {
  return (
    <div className="w-full max-w-xl mx-auto px-4 mt-4">
      <div
        className={`relative flex items-center bg-slate-900 border-2 rounded-2xl transition-all shadow-xl ${
          isMismatch
            ? 'border-rose-500 ring-4 ring-rose-500/20 animate-shake bg-rose-950/20'
            : isComposing
            ? 'border-amber-400 ring-2 ring-amber-400/20'
            : 'border-indigo-500/70 focus-within:border-indigo-400 focus-within:ring-4 focus-within:ring-indigo-500/20'
        }`}
      >
        <input
          ref={inputRef}
          data-testid="game-input"
          type="text"
          value={value}
          disabled={disabled}
          onChange={onChange}
          onKeyDown={onKeyDown}
          onCompositionStart={onCompositionStart}
          onCompositionEnd={onCompositionEnd}
          placeholder={disabled ? '遊戲已結束' : '輸入題目並按 Enter 消除...'}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          className="w-full bg-transparent px-4 py-3.5 text-base sm:text-lg text-white placeholder:text-slate-500 font-medium outline-none"
        />

        {/* Status indicator badges */}
        <div className="flex items-center gap-2 pr-3 shrink-0">
          {isComposing && (
            <span
              data-testid="ime-composing-badge"
              className="flex items-center gap-1 text-[11px] font-semibold bg-amber-500/20 border border-amber-500/40 text-amber-300 px-2 py-1 rounded-md animate-pulse"
            >
              <Sparkles className="w-3 h-3" />
              組字中
            </span>
          )}

          {isMismatch && (
            <span
              data-testid="mismatch-badge"
              className="flex items-center gap-1 text-[11px] font-semibold bg-rose-500/20 border border-rose-500/40 text-rose-300 px-2 py-1 rounded-md"
            >
              <AlertTriangle className="w-3 h-3" />
              無匹配題目
            </span>
          )}

          <div className="hidden sm:flex items-center gap-1 text-xs text-slate-400 bg-slate-800/80 px-2 py-1 rounded-lg border border-slate-700">
            <span>Enter</span>
            <CornerDownLeft className="w-3 h-3" />
          </div>
        </div>
      </div>

      <p className="text-center text-[11px] text-slate-500 mt-2">
        使用目前系統輸入法完整輸入目標題目後，按 Enter 消除相符方塊
      </p>
    </div>
  );
};
