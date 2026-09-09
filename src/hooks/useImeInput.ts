import { useState, useRef, useCallback, useEffect } from 'react';

export interface UseImeInputOptions {
  onSubmit: (value: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
}

export function useImeInput({ onSubmit, disabled = false, autoFocus = true }: UseImeInputOptions) {
  const [value, setValue] = useState('');
  const [isComposing, setIsComposing] = useState(false);
  const isComposingRef = useRef(false);
  const lastCompositionEndTimeRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Maintain focus on the input while active
  useEffect(() => {
    if (autoFocus && !disabled && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus, disabled]);

  const handleCompositionStart = useCallback(() => {
    isComposingRef.current = true;
    setIsComposing(true);
  }, []);

  const handleCompositionEnd = useCallback((e: React.CompositionEvent<HTMLInputElement>) => {
    isComposingRef.current = false;
    setIsComposing(false);
    lastCompositionEndTimeRef.current = Date.now();
    // Update value to final committed text
    setValue(e.currentTarget.value);
  }, []);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
    // Never trigger match evaluation on raw change (especially during IME composition)
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (disabled) return;

      if (e.key === 'Enter') {
        // Guard against IME composition Enter
        if (isComposingRef.current || e.nativeEvent.isComposing || e.keyCode === 229) {
          return;
        }

        // Guard against trailing Enter immediately following compositionend
        if (Date.now() - lastCompositionEndTimeRef.current < 60) {
          return;
        }

        e.preventDefault();
        const textToSubmit = value;
        if (textToSubmit.length > 0) {
          onSubmit(textToSubmit);
          setValue('');
        }
      }
    },
    [disabled, value, onSubmit]
  );

  const resetInput = useCallback(() => {
    setValue('');
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  }, []);

  return {
    value,
    setValue,
    isComposing,
    inputRef,
    handleCompositionStart,
    handleCompositionEnd,
    handleChange,
    handleKeyDown,
    resetInput,
  };
}
