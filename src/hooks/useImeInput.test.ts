import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useImeInput } from './useImeInput';

describe('useImeInput hook', () => {
  it('does NOT submit during IME composition when Enter is pressed', () => {
    const onSubmit = vi.fn();
    const { result } = renderHook(() =>
      useImeInput({ onSubmit, disabled: false, autoFocus: false })
    );

    // 1. User starts IME composition (e.g. typing Zhuyin or Japanese)
    act(() => {
      result.current.handleCompositionStart();
    });
    expect(result.current.isComposing).toBe(true);

    // 2. Intermediate input changes while composing
    act(() => {
      result.current.handleChange({
        target: { value: 'ㄆㄧㄥˊ' },
      } as React.ChangeEvent<HTMLInputElement>);
    });
    expect(result.current.value).toBe('ㄆㄧㄥˊ');
    expect(onSubmit).not.toHaveBeenCalled();

    // 3. User presses Enter while still composing (candidate confirmation)
    act(() => {
      result.current.handleKeyDown({
        key: 'Enter',
        keyCode: 229,
        nativeEvent: { isComposing: true },
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent<HTMLInputElement>);
    });

    // CRITICAL: onSubmit MUST NOT have been called!
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits correctly after composition ends and Enter is pressed', async () => {
    const onSubmit = vi.fn();
    const { result } = renderHook(() =>
      useImeInput({ onSubmit, disabled: false, autoFocus: false })
    );

    // 1. Start composition
    act(() => {
      result.current.handleCompositionStart();
    });

    // 2. Composition ends with committed candidate '蘋果'
    act(() => {
      result.current.handleCompositionEnd({
        currentTarget: { value: '蘋果' },
      } as React.CompositionEvent<HTMLInputElement>);
    });
    expect(result.current.isComposing).toBe(false);
    expect(result.current.value).toBe('蘋果');

    // Wait 70ms to simulate the user pressing Enter after candidate is committed
    await new Promise((resolve) => setTimeout(resolve, 70));

    // 3. User presses Enter to submit '蘋果' to the game
    act(() => {
      result.current.handleKeyDown({
        key: 'Enter',
        keyCode: 13,
        nativeEvent: { isComposing: false },
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent<HTMLInputElement>);
    });

    // Must be submitted with exact committed text, and value cleared
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith('蘋果');
    expect(result.current.value).toBe('');
  });

  it('submits direct English input on Enter', () => {
    const onSubmit = vi.fn();
    const { result } = renderHook(() =>
      useImeInput({ onSubmit, disabled: false, autoFocus: false })
    );

    // Type 'apple'
    act(() => {
      result.current.handleChange({
        target: { value: 'apple' },
      } as React.ChangeEvent<HTMLInputElement>);
    });

    // Press Enter
    act(() => {
      result.current.handleKeyDown({
        key: 'Enter',
        keyCode: 13,
        nativeEvent: { isComposing: false },
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent<HTMLInputElement>);
    });

    expect(onSubmit).toHaveBeenCalledWith('apple');
    expect(result.current.value).toBe('');
  });

  it('ignores Enter when input is empty or disabled', () => {
    const onSubmit = vi.fn();
    const { result } = renderHook(() =>
      useImeInput({ onSubmit, disabled: true, autoFocus: false })
    );

    act(() => {
      result.current.handleChange({
        target: { value: 'test' },
      } as React.ChangeEvent<HTMLInputElement>);
    });

    act(() => {
      result.current.handleKeyDown({
        key: 'Enter',
        keyCode: 13,
        nativeEvent: { isComposing: false },
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent<HTMLInputElement>);
    });

    expect(onSubmit).not.toHaveBeenCalled();
  });
});
