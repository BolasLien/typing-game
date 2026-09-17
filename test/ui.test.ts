import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { TestContext } from 'node:test';
import { JSDOM } from 'jsdom';
import { mountGame } from '../src/app.js';

// Only the browser clock/focus boundary is controlled. All interaction and
// assertions use the rendered DOM; the real game module runs unchanged.
function browser(t: TestContext) {
  const dom = new JSDOM('<main id="app"></main>', { pretendToBeVisual: true });
  const { window } = dom;
  const { document } = window;
  let now = 0;
  let nextFrame = 0;
  const frames = new Map<number, FrameRequestCallback>();
  window.performance.now = () => now;
  window.requestAnimationFrame = callback => {
    frames.set(++nextFrame, callback);
    return nextFrame;
  };
  window.cancelAnimationFrame = id => { frames.delete(id); };
  document.hasFocus = () => true;
  const unmount = mountGame(document.querySelector<HTMLElement>('#app')!);
  t.after(() => { unmount(); window.close(); });
  function control<T extends HTMLElement>(label: string): T {
    const found = Array.from(document.querySelectorAll('label'))
      .find(item => item.textContent?.trim() === label);
    const node = found ? document.getElementById(found.htmlFor)
      : document.querySelector(`[aria-label="${label}"]`);
    assert.ok(node, `Missing control: ${label}`);
    return node as T;
  }
  function button(name: string): HTMLButtonElement {
    const result = Array.from(document.querySelectorAll('button'))
      .find(item => item.textContent?.trim() === name);
    assert.ok(result, `Missing button: ${name}`);
    return result;
  }
  function enter(options: KeyboardEventInit = {}) {
    const input = control<HTMLInputElement>('作答');
    input.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true, ...options }));
    input.dispatchEvent(new window.KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));
  }
  function fill(label: string, value: string) {
    const input = control<HTMLInputElement | HTMLTextAreaElement>(label);
    input.value = value;
    input.dispatchEvent(new window.Event('input', { bubbles: true }));
  }
  function tick(ms: number) {
    now += ms;
    const pending = Array.from(frames.values());
    frames.clear();
    pending.forEach(callback => callback(now));
  }
  return { document, window, control, button, fill, enter, tick };
}

test('source reports valid duplicate lines and Unicode limits without truncating user text', t => {
  const ui = browser(t);
  const source = ui.control<HTMLTextAreaElement>('題目來源');
  ui.fill('題目來源', ' 你好 \n\nHello  world\n你好');
  assert.match(ui.control('來源狀態').textContent!, /3 題/);
  assert.equal(ui.button('開始練習').disabled, false);
  for (const [value, error] of [
    [' \n\t', '至少需要一題'],
    [Array(501).fill('字').join('\n'), '最多 500 題'],
    ['😀'.repeat(41), '40'],
  ]) {
    ui.fill('題目來源', value!);
    assert.match(ui.control('來源狀態').textContent!, new RegExp(error!));
    assert.equal(ui.button('開始練習').disabled, true);
    assert.equal(source.getAttribute('aria-invalid'), 'true');
    assert.equal(source.value, value);
  }
  for (const value of ['😀'.repeat(40), Array(500).fill('字').join('\n')]) {
    ui.fill('題目來源', value);
    assert.equal(ui.button('開始練習').disabled, false);
    assert.equal(source.getAttribute('aria-invalid'), 'false');
  }
});

test('three-second countdown precedes simulation and focuses answers; only Enter submits exact text', t => {
  const ui = browser(t);
  ui.fill('題目來源', ' Hello  world \nHello  world');
  ui.button('開始練習').click();
  assert.match(ui.control('遊戲狀態').textContent!, /3/);
  assert.equal(ui.control<HTMLInputElement>('作答').disabled, true);
  ui.enter();
  ui.tick(2000);
  assert.match(ui.control('遊戲狀態').textContent!, /1/);
  assert.equal(ui.control('存活時間').textContent, '00:00.0');
  ui.tick(1000);
  assert.equal(ui.document.activeElement, ui.control('作答'));
  assert.equal(ui.control('棋盤').children.length, 0);
  ui.tick(2400);
  assert.equal(ui.control('棋盤').children.length, 1);
  assert.equal(ui.control('棋盤').textContent, 'Hello  world');
  ui.fill('作答', 'Hello  world');
  assert.equal(ui.control('分數').textContent, '0');
  ui.fill('作答', 'Hello world');
  ui.enter();
  assert.equal(ui.control('未匹配數').textContent, '1');
  assert.equal(ui.control('分數').textContent, '0');
  ui.fill('作答', ' Hello  world');
  ui.enter();
  assert.equal(ui.control('未匹配數').textContent, '2');
  ui.fill('作答', 'Hello  world');
  ui.enter();
  assert.equal(ui.control('分數').textContent, '100');
  assert.equal(ui.control('消除數').textContent, '1');
  assert.equal(ui.control('棋盤').children.length, 0);
  assert.equal(ui.control<HTMLInputElement>('作答').value, '');
});

test('IME confirmation in either browser ordering never scores or records a miss; the next Enter submits', t => {
  const ui = browser(t);
  ui.fill('題目來源', '你好');
  ui.button('開始練習').click();
  ui.tick(5400);
  const input = ui.control<HTMLInputElement>('作答');
  const compose = (type: string) => input.dispatchEvent(new ui.window.CompositionEvent(type, { bubbles: true }));
  const down = (options: KeyboardEventInit = {}) => input.dispatchEvent(new ui.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true, ...options }));
  const up = () => input.dispatchEvent(new ui.window.KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));

  compose('compositionstart');
  ui.fill('作答', '未選好的文字');
  down(); // compositionstart alone must be sufficient.
  assert.equal(ui.control('未匹配數').textContent, '0');
  ui.fill('作答', '你好');
  compose('compositionend');
  up();
  assert.equal(ui.control('分數').textContent, '0');
  assert.equal(input.value, '你好');
  ui.enter();
  assert.equal(ui.control('分數').textContent, '100');

  ui.tick(2400);
  compose('compositionstart');
  ui.fill('作答', '你好');
  compose('compositionend'); // Some browsers finish composition before keydown.
  down();
  up();
  assert.equal(ui.control('分數').textContent, '100');
  assert.equal(ui.control('未匹配數').textContent, '0');
  assert.equal(input.value, '你好');
  ui.enter();
  assert.equal(ui.control('分數').textContent, '200');

  ui.tick(2400);
  ui.fill('作答', '錯字');
  ui.enter({ isComposing: true });
  ui.enter({ keyCode: 229 });
  assert.equal(ui.control('未匹配數').textContent, '0');
  ui.enter();
  assert.equal(ui.control('未匹配數').textContent, '1');
  ui.fill('作答', '你好');
  ui.enter({ repeat: true });
  assert.equal(ui.control('分數').textContent, '200');
  ui.enter();
  assert.equal(ui.control('分數').textContent, '300');
});

test('window blur and hidden freeze both countdown and play; overlapping signals resume without catch-up', t => {
  const ui = browser(t);
  const visibility = (hidden: boolean) => {
    Object.defineProperty(ui.document, 'hidden', { configurable: true, value: hidden });
    ui.document.dispatchEvent(new ui.window.Event('visibilitychange'));
  };
  ui.fill('題目來源', '字');
  ui.button('開始練習').click();
  ui.tick(1000);
  ui.window.dispatchEvent(new ui.window.Event('blur'));
  ui.tick(30_000);
  assert.match(ui.control('遊戲狀態').textContent!, /暫停/);
  ui.window.dispatchEvent(new ui.window.Event('focus'));
  ui.tick(1000);
  assert.match(ui.control('遊戲狀態').textContent!, /1/);
  ui.tick(1000);
  ui.tick(2400);
  const boardBefore = ui.control('棋盤').innerHTML;
  ui.fill('作答', '字');
  visibility(true);
  ui.window.dispatchEvent(new ui.window.Event('blur'));
  ui.tick(30_000);
  ui.enter();
  assert.equal(ui.control('分數').textContent, '0');
  visibility(false); // Still blurred; visible does not imply focused.
  ui.tick(30_000);
  assert.equal(ui.control('存活時間').textContent, '00:02.4');
  assert.equal(ui.control('棋盤').innerHTML, boardBefore);
  assert.equal(ui.control<HTMLInputElement>('作答').disabled, true);
  ui.window.dispatchEvent(new ui.window.Event('focus'));
  assert.equal(ui.control('棋盤').innerHTML, boardBefore);
  assert.equal(ui.document.activeElement, ui.control('作答'));
  ui.tick(100);
  assert.equal(ui.control('存活時間').textContent, '00:02.5');
  ui.enter();
  assert.equal(ui.control('分數').textContent, '100');
  // Hidden alone must work even if the browser never sends a window blur.
  visibility(true);
  ui.tick(30_000);
  visibility(false);
  ui.tick(100);
  assert.equal(ui.control('存活時間').textContent, '00:02.6');
});

test('natural Game Over freezes results and input; three replays reset the same source, then editing replaces it', t => {
  const ui = browser(t);
  ui.fill('題目來源', ' 你好 \n你好');
  ui.button('開始練習').click();
  for (let round = 0; round < 3; round++) {
    ui.tick(5400);
    assert.equal(ui.control('棋盤').textContent, '你好');
    ui.fill('作答', '你好');
    ui.enter();
    ui.fill('作答', '錯');
    ui.enter();
    ui.tick(180_000); // Real engine reaches its terminal landing.
    assert.match(ui.control('遊戲狀態').textContent!, /本局結束/);
    assert.equal(ui.control('結算分數').textContent, '100');
    assert.equal(ui.control('結算消除數').textContent, '1');
    assert.equal(ui.control('結算未匹配數').textContent, '1');
    assert.equal(ui.control('結算存活時間').textContent, ui.control('存活時間').textContent);
    assert.match(ui.document.activeElement?.textContent ?? '', /Game Over/);
    assert.equal(ui.control<HTMLInputElement>('作答').disabled, true);
    const finalBoard = ui.control('棋盤').innerHTML;
    const finalTime = ui.control('存活時間').textContent;
    ui.fill('作答', '你好');
    ui.enter();
    ui.tick(60_000);
    ui.window.dispatchEvent(new ui.window.Event('blur'));
    ui.window.dispatchEvent(new ui.window.Event('focus'));
    assert.equal(ui.control('棋盤').innerHTML, finalBoard);
    assert.equal(ui.control('存活時間').textContent, finalTime);
    assert.equal(ui.control('分數').textContent, '100');
    assert.equal(ui.control('未匹配數').textContent, '1');
    ui.button('再玩一次').click();
    assert.equal(ui.control('棋盤').children.length, 0);
    assert.equal(ui.control('分數').textContent, '0');
    assert.equal(ui.control('消除數').textContent, '0');
    assert.equal(ui.control('未匹配數').textContent, '0');
    assert.equal(ui.control('存活時間').textContent, '00:00.0');
    assert.equal(ui.control<HTMLInputElement>('作答').value, '');
    assert.match(ui.control('遊戲狀態').textContent!, /3/);
  }
  ui.tick(180_000);
  ui.button('修改來源').click();
  assert.equal(ui.document.activeElement, ui.control('題目來源'));
  assert.equal(ui.control<HTMLTextAreaElement>('題目來源').value, ' 你好 \n你好');
  ui.fill('題目來源', 'café');
  ui.button('開始練習').click();
  ui.tick(5400);
  assert.equal(ui.control('棋盤').textContent, 'café');
  ui.fill('作答', 'cafe\u0301');
  ui.enter();
  assert.equal(ui.control('分數').textContent, '100');
});
