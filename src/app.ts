import { advance, createGame, parseSource, submit } from './game.js';
import type { GameState } from './game.js';

const EXAMPLE_SOURCE = '你好\n慢慢來，比較快\nHello world\nこんにちは\n今天は good day\n練習讓手感更好';

/** Mount the application on a DOM element. The returned function releases it. */
export function mountGame(root: HTMLElement): () => void {
  const document = root.ownerDocument;
  const window = document.defaultView!;
  root.innerHTML = `
    <div class="shell">
      <header class="app-header">
        <a class="wordmark" href="./" aria-label="字落首頁"><span class="brand-mark" aria-hidden="true">字</span>字落<span class="brand-subtitle">多語言打字練習</span></a>
        <span class="header-note">專注輸入，一題一題消除。</span>
      </header>
      <main>
        <section class="source-screen" aria-labelledby="source-title">
          <div class="section-heading"><p class="eyebrow">準備練習</p><h1 id="source-title">從你的文字開始。</h1><p>貼上想練習的題目，讓每一次輸入都更熟悉。</p></div>
          <div class="source-layout">
            <form class="source-card">
              <div class="card-heading"><label for="source">題目來源</label><span>一行一題</span></div>
              <textarea id="source" spellcheck="false" aria-describedby="source-help source-status"></textarea>
              <p id="source-help" class="hint">最多 500 題，每題最多 40 個 Unicode 碼點。忽略空白行、移除行首尾空白，保留內部空格與重複題目。</p>
              <div class="source-actions"><p id="source-status" role="status" aria-label="來源狀態"></p><button class="primary" type="submit">開始練習</button></div>
            </form>
            <aside class="instructions" aria-label="玩法說明">
              <p class="eyebrow">玩法很簡單</p><h2>在文字堆滿前，<br>把它打出來。</h2>
              <ol><li><strong>看清完整題目</strong><p>4 欄 × 8 格。下落中或已落定的文字，都可以消除。</p></li><li><strong>輸入，再按 Enter</strong><p>大小寫、標點與空格須一致。每消除一題，獲得 100 分。</p></li><li><strong>找到自己的節奏</strong><p>每 20 秒逐漸加速；任一欄落定堆滿 8 格，本局結束。</p></li></ol>
              <div class="ime-note"><strong>使用中文或日文輸入法？</strong><p>先確認選字，再按一次 <kbd>Enter</kbd> 提交。切換分頁或視窗時，遊戲會自動暫停。</p></div>
            </aside>
          </div>
        </section>
        <section class="game-screen" hidden aria-labelledby="game-title">
          <section class="results" hidden aria-labelledby="results-title">
            <div><p class="eyebrow">本局成績</p><h2 id="results-title" tabindex="-1">Game Over · 本局結束</h2><p>一欄已堆滿。休息一下，再來一局。</p></div>
            <dl class="result-stats"><div><dt>分數</dt><dd aria-label="結算分數"></dd></div><div><dt>存活時間</dt><dd aria-label="結算存活時間"></dd></div><div><dt>消除數</dt><dd aria-label="結算消除數"></dd></div><div><dt>未匹配數</dt><dd aria-label="結算未匹配數"></dd></div></dl>
            <div class="result-actions"><button type="button" class="primary" id="replay">再玩一次</button><button type="button" id="edit-source">修改來源</button></div>
          </section>
          <div class="game-heading"><div><p class="eyebrow">保持專注</p><h1 id="game-title">讓文字落下，讓手感留下。</h1></div><p role="status" aria-label="遊戲狀態" id="game-status"></p></div>
          <div class="game-layout">
            <div class="board-scroll" tabindex="0" role="region" aria-label="棋盤捲動區" aria-describedby="board-help">
              <div class="column-labels" aria-hidden="true"><span>01</span><span>02</span><span>03</span><span>04</span></div>
              <div class="board-frame"><div class="board" role="list" aria-label="棋盤"></div><div class="board-overlay" aria-hidden="true"></div></div>
            </div>
            <aside class="game-sidebar" aria-label="本局統計">
              <dl class="stats"><div class="score-stat"><dt>本局分數</dt><dd><output aria-label="分數" aria-live="off">0</output></dd></div><div><dt>存活時間</dt><dd><output aria-label="存活時間" aria-live="off">00:00.0</output></dd></div><div><dt>已消除</dt><dd><output aria-label="消除數" aria-live="off">0</output><span> 題</span></dd></div><div><dt>未匹配</dt><dd><output aria-label="未匹配數" aria-live="off">0</output><span> 次</span></dd></div></dl>
              <p id="board-help" class="hint">4 欄 × 8 格<br>任一欄落定堆滿，本局即結束。<br>窄視窗可捲動查看完整棋盤。</p>
              <p class="hint">完整輸入，包含空格與標點。每消除一題 +100 分。</p>
            </aside>
          </div>
          <div class="answer-panel"><div class="answer-heading"><label for="answer">作答</label><span>確認選字後，再按 Enter 提交</span></div><div class="answer-field"><input id="answer" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" aria-describedby="answer-feedback" disabled placeholder="輸入場上的完整題目"><kbd aria-hidden="true">Enter ↵</kbd></div><p id="answer-feedback" role="status">準備好了嗎？</p></div>
        </section>
      </main>
      <footer class="app-footer"><span>文字留在此頁，不上傳、不儲存。</span><span>用 <kbd>Tab</kbd> 移動焦點 · <kbd>Enter</kbd> 確認</span></footer>
    </div>`;
  const source = root.querySelector<HTMLTextAreaElement>('#source')!;
  const form = root.querySelector<HTMLFormElement>('.source-card')!;
  const status = root.querySelector<HTMLElement>('#source-status')!;
  const startButton = form.querySelector<HTMLButtonElement>('button')!;
  const sourceScreen = root.querySelector<HTMLElement>('.source-screen')!;
  const gameScreen = root.querySelector<HTMLElement>('.game-screen')!;
  const gameStatus = root.querySelector<HTMLElement>('#game-status')!;
  const board = root.querySelector<HTMLElement>('.board')!;
  const boardFrame = root.querySelector<HTMLElement>('.board-frame')!;
  const overlay = root.querySelector<HTMLElement>('.board-overlay')!;
  const answer = root.querySelector<HTMLInputElement>('#answer')!;
  const feedback = root.querySelector<HTMLElement>('#answer-feedback')!;
  const results = root.querySelector<HTMLElement>('.results')!;
  const resultsTitle = root.querySelector<HTMLElement>('#results-title')!;
  let state: GameState | null = null;
  let countdown = 0;
  let frame = 0;
  let previousTime = 0;
  let composing = false;
  let confirmationPending = false;
  let focused = document.hasFocus();
  let paused = !focused || document.hidden;
  const blockNodes = new Map<number, HTMLElement>();
  source.value = EXAMPLE_SOURCE;
  function validateSource(): string[] | null {
    try {
      const prompts = parseSource(source.value);
      status.textContent = `${prompts.length} 題有效題目 · 已準備好`;
      source.setAttribute('aria-invalid', 'false');
      startButton.disabled = false;
      return prompts;
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : '請檢查題目來源';
      source.setAttribute('aria-invalid', 'true');
      startButton.disabled = true;
      return null;
    }
  }
  source.addEventListener('input', validateSource);
  function setText(node: Element, text: string): void {
    if (node.textContent !== text) node.textContent = text;
  }
  function fitPrompts(): void {
    if (!state || gameScreen.hidden) return;
    // Measure complete source text with the same width/font as a real block.
    // All eight rows share the tallest required height, including tabs, wide
    // glyphs and browser zoom. This changes display geometry, never game rules.
    const measure = document.createElement('div');
    measure.className = 'prompt-measure';
    measure.setAttribute('aria-hidden', 'true');
    for (const text of new Set(state.prompts)) {
      const node = document.createElement('div');
      node.className = 'block';
      node.textContent = text;
      measure.append(node);
    }
    boardFrame.append(measure);
    const height = Math.max(88, ...Array.from(measure.children, node => Math.ceil(node.getBoundingClientRect().height) + 4));
    boardFrame.style.setProperty('--cell-height', `${height}px`);
    measure.remove();
  }
  function render(): void {
    if (!state) return;
    for (const [label, value] of [
      ['分數', String(state.score)], ['消除數', String(state.clearedCount)],
      ['未匹配數', String(state.unmatchedCount)], ['存活時間', formatTime(state.elapsedMs)],
    ]) setText(root.querySelector(`[aria-label="${label}"]`)!, value!);
    for (const [id, node] of blockNodes) {
      if (!state.blocks.some(block => block.id === id)) {
        node.remove();
        blockNodes.delete(id);
      }
    }
    for (const block of state.blocks) {
      let node = blockNodes.get(block.id);
      if (!node) {
        node = document.createElement('div');
        node.className = 'block';
        node.setAttribute('role', 'listitem');
        node.textContent = block.text;
        board.append(node);
        blockNodes.set(block.id, node);
      }
      node.style.left = `calc(${block.column * 25}% + 4px)`;
      node.style.top = `${block.y * 12.5}%`;
      node.classList.toggle('settled', block.settled);
    }
    overlay.hidden = state.status === 'gameover' || (countdown <= 0 && !paused);
    overlay.classList.toggle('paused', paused);
    setText(overlay, paused ? '已暫停' : String(Math.ceil(countdown / 1000)));
    setText(gameStatus, state.status === 'gameover' ? '本局結束' : paused ? '已暫停 · 返回視窗後繼續' : countdown > 0 ? `準備開始 · ${Math.ceil(countdown / 1000)}` : '練習中');
    if (state.status === 'gameover' && results.hidden) {
      window.cancelAnimationFrame(frame);
      answer.disabled = true;
      composing = false;
      confirmationPending = false;
      feedback.textContent = '本局已結束，輸入不再判定。';
      for (const label of ['分數', '存活時間', '消除數', '未匹配數']) {
        setText(root.querySelector(`[aria-label="結算${label}"]`)!, root.querySelector(`[aria-label="${label}"]`)!.textContent!);
      }
      results.hidden = false;
      resultsTitle.focus();
    }
  }
  function start(prompts: readonly string[]): void {
    window.cancelAnimationFrame(frame);
    state = createGame(prompts);
    countdown = 3000;
    blockNodes.clear();
    board.replaceChildren();
    sourceScreen.hidden = true;
    gameScreen.hidden = false;
    results.hidden = true;
    fitPrompts();
    answer.value = '';
    composing = false;
    confirmationPending = false;
    answer.disabled = true;
    feedback.textContent = '倒數結束後，焦點會移至作答區。';
    previousTime = window.performance.now();
    render();
    if (!paused) frame = window.requestAnimationFrame(onFrame);
  }
  function onFrame(now: number): void {
    if (!state || paused) return;
    let delta = Math.max(0, now - previousTime);
    previousTime = now;
    if (countdown > 0) {
      const spent = Math.min(countdown, delta);
      countdown -= spent;
      delta -= spent;
      if (countdown === 0) {
        answer.disabled = false;
        answer.focus({ preventScroll: true });
        feedback.textContent = '輸入完整題目，按 Enter 提交。';
      }
    }
    if (countdown === 0) state = advance(state, delta);
    render();
    if (state.status === 'running') frame = window.requestAnimationFrame(onFrame);
  }
  form.addEventListener('submit', event => {
    event.preventDefault();
    const prompts = validateSource();
    if (prompts) start(prompts);
  });
  root.querySelector('#replay')!.addEventListener('click', () => {
    if (state?.status === 'gameover') start(state.prompts);
  });
  root.querySelector('#edit-source')!.addEventListener('click', () => {
    window.cancelAnimationFrame(frame);
    state = null;
    gameScreen.hidden = true;
    sourceScreen.hidden = false;
    source.focus();
  });
  function updateActivity(): void {
    const nextPaused = !focused || document.hidden;
    if (nextPaused === paused) return;
    paused = nextPaused;
    window.cancelAnimationFrame(frame);
    // Reset on BOTH sides of a suspension, never feed absence into advance.
    previousTime = window.performance.now();
    if (paused) {
      confirmationPending ||= composing;
      composing = false;
    }
    if (!state || state.status !== 'running') return;
    answer.disabled = paused || countdown > 0;
    if (!paused) {
      if (countdown === 0) answer.focus({ preventScroll: true });
      frame = window.requestAnimationFrame(onFrame);
    }
    render();
  }
  function onBlur(): void { focused = false; updateActivity(); }
  function onFocus(): void { focused = true; updateActivity(); }
  window.addEventListener('blur', onBlur);
  window.addEventListener('focus', onFocus);
  window.addEventListener('resize', fitPrompts);
  document.addEventListener('visibilitychange', updateActivity);
  answer.addEventListener('compositionstart', () => {
    composing = true;
    confirmationPending = false;
  });
  answer.addEventListener('compositionend', () => {
    composing = false;
    // Keep the confirmation key cycle guarded even when compositionend is
    // delivered BEFORE its Enter keydown. No timer guesses about IME latency.
    confirmationPending = true;
  });
  answer.addEventListener('keyup', event => {
    if (event.key === 'Enter' || event.keyCode === 229) confirmationPending = false;
  });
  answer.addEventListener('keydown', event => {
    // Do not prevent the default while composing: the IME owns confirmation.
    if (composing || event.isComposing || event.keyCode === 229) return;
    if (event.key !== 'Enter') {
      confirmationPending = false;
      return;
    }
    event.preventDefault();
    if (confirmationPending || event.repeat) return;
    if (!state || paused || countdown > 0 || state.status !== 'running') return;
    const before = state.score;
    state = submit(state, answer.value);
    feedback.textContent = state.score > before ? '消除成功，+100 分。' : '未匹配到題目，請檢查完整文字與空格。';
    if (state.score > before) answer.value = '';
    render();
  });
  validateSource();
  return () => {
    window.cancelAnimationFrame(frame);
    window.removeEventListener('blur', onBlur);
    window.removeEventListener('focus', onFocus);
    window.removeEventListener('resize', fitPrompts);
    document.removeEventListener('visibilitychange', updateActivity);
    root.replaceChildren();
  };
}

function formatTime(ms: number): string {
  const tenths = Math.floor(ms / 100);
  const minutes = Math.floor(tenths / 600).toString().padStart(2, '0');
  const seconds = (Math.floor(tenths / 10) % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}.${tenths % 10}`;
}
