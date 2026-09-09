import { useEffect, useRef } from 'react';
import { GameState, GameConfig, DEFAULT_CONFIG } from '../types/game';
import {
  GameEngineState,
  tickEngine,
  spawnBlock,
  getCurrentSpawnInterval,
} from '../domain/engine';

export interface UseGameLoopProps {
  gameState: GameState;
  promptSet: string[];
  config?: GameConfig;
  engineState: GameEngineState;
  setEngineState: React.Dispatch<React.SetStateAction<GameEngineState>>;
  onGameOver: () => void;
}

export function useGameLoop({
  gameState,
  promptSet,
  config = DEFAULT_CONFIG,
  engineState,
  setEngineState,
  onGameOver,
}: UseGameLoopProps) {
  const lastTimeRef = useRef<number>(0);
  const animFrameIdRef = useRef<number | null>(null);

  // Keep refs up-to-date for RAF loop
  const engineStateRef = useRef(engineState);
  engineStateRef.current = engineState;

  const promptSetRef = useRef(promptSet);
  promptSetRef.current = promptSet;

  const onGameOverRef = useRef(onGameOver);
  onGameOverRef.current = onGameOver;

  useEffect(() => {
    if (gameState !== 'PLAYING') {
      if (animFrameIdRef.current !== null) {
        cancelAnimationFrame(animFrameIdRef.current);
        animFrameIdRef.current = null;
      }
      return;
    }

    lastTimeRef.current = performance.now();

    // Avoid time jumps when switching tabs
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        lastTimeRef.current = performance.now();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const loop = (currentTime: number) => {
      const rawDt = (currentTime - lastTimeRef.current) / 1000;
      lastTimeRef.current = currentTime;

      // Cap delta time to 100ms to prevent jumping
      const dt = Math.min(rawDt, 0.1);

      const currentState = engineStateRef.current;
      if (currentState.isGameOver) {
        onGameOverRef.current();
        return;
      }

      // Step physics
      let nextState = tickEngine(currentState, dt, config);

      if (nextState.isGameOver) {
        setEngineState(nextState);
        onGameOverRef.current();
        return;
      }

      // Handle block spawn
      const nowMs = Date.now();
      const spawnInterval = getCurrentSpawnInterval(
        nextState.stats.survivalTimeSeconds,
        config
      );

      if (nowMs - nextState.lastSpawnTimeMs >= spawnInterval) {
        const { newBlock, chosenColumn } = spawnBlock(
          promptSetRef.current,
          nextState.blocks,
          nextState.lastSpawnedColumn,
          nowMs,
          config
        );

        if (newBlock) {
          nextState = {
            ...nextState,
            blocks: [...nextState.blocks, newBlock],
            lastSpawnTimeMs: nowMs,
            lastSpawnedColumn: chosenColumn,
          };
        }
      }

      setEngineState(nextState);
      animFrameIdRef.current = requestAnimationFrame(loop);
    };

    animFrameIdRef.current = requestAnimationFrame(loop);

    return () => {
      if (animFrameIdRef.current !== null) {
        cancelAnimationFrame(animFrameIdRef.current);
        animFrameIdRef.current = null;
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [gameState, config, setEngineState]);
}
