import React, { useState, useCallback, useRef } from 'react';
import { GameState, DEFAULT_CONFIG } from './types/game';
import {
  createInitialEngineState,
  GameEngineState,
  eliminateBlock,
} from './domain/engine';
import { matchSubmission } from './domain/matching';
import { DEFAULT_SAMPLE_SOURCE } from './domain/parser';
import { useGameLoop } from './hooks/useGameLoop';
import { useImeInput } from './hooks/useImeInput';

import { SourceEditor } from './components/SourceEditor';
import { GameBoard } from './components/GameBoard';
import { InputBar } from './components/InputBar';
import { StatsHeader } from './components/StatsHeader';
import { CountdownOverlay } from './components/CountdownOverlay';
import { GameOverModal } from './components/GameOverModal';
import { Keyboard, Gamepad2 } from 'lucide-react';

export const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>('SOURCE_EDITING');
  const [sourceText, setSourceText] = useState(DEFAULT_SAMPLE_SOURCE);
  const [promptSet, setPromptSet] = useState<string[]>([]);
  const [engineState, setEngineState] = useState<GameEngineState>(createInitialEngineState());
  const [isMismatch, setIsMismatch] = useState(false);
  const mismatchTimeoutRef = useRef<number | null>(null);

  // Trigger game over
  const handleGameOver = useCallback(() => {
    setGameState('GAME_OVER');
  }, []);

  // Run the physics & spawning loop
  useGameLoop({
    gameState,
    promptSet,
    config: DEFAULT_CONFIG,
    engineState,
    setEngineState,
    onGameOver: handleGameOver,
  });

  // Handle submission from InputBar
  const handleSubmission = useCallback(
    (submission: string) => {
      if (gameState !== 'PLAYING' || engineState.isGameOver) {
        return;
      }

      const matchedBlock = matchSubmission(submission, engineState.blocks, DEFAULT_CONFIG);

      if (matchedBlock) {
        // Correct match! Eliminate target block and shift stack down
        const nextBlocks = eliminateBlock(matchedBlock.id, engineState.blocks, DEFAULT_CONFIG);
        setEngineState((prev) => ({
          ...prev,
          blocks: nextBlocks,
          stats: {
            ...prev.stats,
            score: prev.stats.score + DEFAULT_CONFIG.scorePerPrompt,
            correctCount: prev.stats.correctCount + 1,
          },
        }));

        setIsMismatch(false);
        if (mismatchTimeoutRef.current !== null) {
          clearTimeout(mismatchTimeoutRef.current);
          mismatchTimeoutRef.current = null;
        }
      } else {
        // Mismatch!
        setEngineState((prev) => ({
          ...prev,
          stats: {
            ...prev.stats,
            mismatchCount: prev.stats.mismatchCount + 1,
          },
        }));

        setIsMismatch(true);
        if (mismatchTimeoutRef.current !== null) {
          clearTimeout(mismatchTimeoutRef.current);
        }
        mismatchTimeoutRef.current = window.setTimeout(() => {
          setIsMismatch(false);
          mismatchTimeoutRef.current = null;
        }, 600);
      }
    },
    [gameState, engineState.isGameOver, engineState.blocks]
  );

  // IME input hook
  const {
    value,
    isComposing,
    inputRef,
    handleChange,
    handleKeyDown,
    handleCompositionStart,
    handleCompositionEnd,
    resetInput,
  } = useImeInput({
    onSubmit: handleSubmission,
    disabled: gameState !== 'PLAYING',
    autoFocus: gameState === 'PLAYING',
  });

  // Start game from SourceEditor
  const handleStartGame = (prompts: string[], source: string) => {
    setPromptSet(prompts);
    setSourceText(source);
    resetInput();
    const freshEngine = createInitialEngineState();
    freshEngine.lastSpawnTimeMs = Date.now();
    setEngineState(freshEngine);
    setGameState('COUNTDOWN');
  };

  // Countdown completed -> begin Playing
  const handleCountdownComplete = () => {
    setGameState('PLAYING');
    setEngineState((prev) => ({
      ...prev,
      lastSpawnTimeMs: Date.now() - DEFAULT_CONFIG.initialSpawnIntervalMs + 600, // Spawn first block shortly after start
    }));
  };

  // Restart with same prompts
  const handleRestart = () => {
    resetInput();
    const freshEngine = createInitialEngineState();
    freshEngine.lastSpawnTimeMs = Date.now();
    setEngineState(freshEngine);
    setGameState('COUNTDOWN');
  };

  // Back to source editor
  const handleBackToSource = () => {
    resetInput();
    setGameState('SOURCE_EDITING');
  };

  // Ensure input retains focus if board is clicked during play
  const handleBoardClick = () => {
    if (gameState === 'PLAYING' && inputRef.current) {
      inputRef.current.focus();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100 flex flex-col justify-between py-6 px-4 selection:bg-indigo-500 selection:text-white">
      {/* Header */}
      <header className="w-full max-w-4xl mx-auto flex items-center justify-between pb-4 border-b border-slate-800/80 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-600/30">
            <Gamepad2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
              多語言輸入練習遊戲
              <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                MVP
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              分欄下落堆疊 · 中/日/英混合練習 · 系統輸入法支援
            </p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400 bg-slate-900/80 px-3 py-1.5 rounded-xl border border-slate-800">
          <Keyboard className="w-4 h-4 text-indigo-400" />
          <span>任意語言輸入</span>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col items-center justify-center">
        {gameState === 'SOURCE_EDITING' && (
          <SourceEditor
            initialSource={sourceText}
            onStartGame={handleStartGame}
          />
        )}

        {(gameState === 'PLAYING' || gameState === 'COUNTDOWN' || gameState === 'GAME_OVER') && (
          <div className="w-full flex flex-col items-center">
            <StatsHeader
              stats={engineState.stats}
              onBackToSource={handleBackToSource}
            />

            <GameBoard
              blocks={engineState.blocks}
              config={DEFAULT_CONFIG}
              onBoardClick={handleBoardClick}
            />

            <InputBar
              value={value}
              isComposing={isComposing}
              isMismatch={isMismatch}
              disabled={gameState !== 'PLAYING'}
              inputRef={inputRef}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onCompositionStart={handleCompositionStart}
              onCompositionEnd={handleCompositionEnd}
            />
          </div>
        )}
      </main>

      {/* Countdown Overlay */}
      {gameState === 'COUNTDOWN' && (
        <CountdownOverlay onComplete={handleCountdownComplete} />
      )}

      {/* Game Over Modal */}
      {gameState === 'GAME_OVER' && (
        <GameOverModal
          stats={engineState.stats}
          onRestart={handleRestart}
          onBackToSource={handleBackToSource}
        />
      )}

      {/* Footer */}
      <footer className="w-full max-w-4xl mx-auto pt-6 border-t border-slate-800/80 text-center text-xs text-slate-500 flex flex-wrap items-center justify-between gap-2">
        <span>多語言輸入練習遊戲 MVP · 規格唯一來源 Linear Project</span>
        <span>無盡生存模式 · 任一欄堆滿即結束</span>
      </footer>
    </div>
  );
};

export default App;
