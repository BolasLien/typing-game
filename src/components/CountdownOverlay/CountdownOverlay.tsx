import React, { useEffect, useState } from 'react';

interface CountdownOverlayProps {
  onComplete: () => void;
}

export const CountdownOverlay: React.FC<CountdownOverlayProps> = ({ onComplete }) => {
  const [count, setCount] = useState<number | 'GO'>(3);

  useEffect(() => {
    if (count === 'GO') {
      const timeout = setTimeout(() => {
        onComplete();
      }, 500);
      return () => clearTimeout(timeout);
    }

    const timer = setTimeout(() => {
      setCount((prev) => {
        if (prev === 3) return 2;
        if (prev === 2) return 1;
        return 'GO';
      });
    }, 700);

    return () => clearTimeout(timer);
  }, [count, onComplete]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-md">
      <div className="text-center animate-bounce">
        <div
          data-testid="countdown-number"
          className="text-8xl sm:text-9xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-indigo-400 via-sky-300 to-emerald-400 drop-shadow-2xl"
        >
          {count}
        </div>
        <p className="text-sm font-medium text-slate-400 mt-4 tracking-widest uppercase">
          準備輸入...
        </p>
      </div>
    </div>
  );
};
