# 字落｜多語言輸入練習遊戲

以 Vite + TypeScript 製作的繁體中文桌面打字遊戲。BOL-70 介面使用 BOL-68 的公開遊戲 API；所有生成、下落、消除、計分與結束判定都交由核心。無後端、帳號、分析或持久儲存，題目與答案只留在目前頁面。

## 安裝與驗證

需要 Node.js 22.12 以上（Vite 7 的要求）。

```sh
npm install
npm run dev
```

開啟終端機顯示的本機網址（預設 `http://127.0.0.1:5173`）。正式靜態檔案及本機預覽：

```sh
npm run build
npm run preview
```

產物在 `dist/`，預覽預設使用 `http://127.0.0.1:4173`。兩個伺服器皆只監聽本機；停止時按 Ctrl+C。已有 lockfile 的乾淨安裝也可使用 `npm ci`。

```sh
npm run typecheck
npm test
npm run build
```

`npm run typecheck` 檢查核心、DOM 介面與測試。`npm test` 使用 Node test runner、tsx 與 jsdom：保留原有 21 項核心測試，新增 5 項 DOM 操作測試，涵蓋來源邊界、倒數與明確提交、IME 事件順序、失焦／hidden 暫停、結算及連續重玩。UI 測試只控制外部時鐘與瀏覽器焦點／可見性，透過表單、按鍵事件和畫面文字驗證；不模擬內部模組或直接修改遊戲 state。

## 操作

1. 在「題目來源」一行輸入一題，也可直接使用範例。顯示有效題數；空來源、超過 500 題或單題超過 40 個 Unicode 碼點時顯示錯誤，修正後才能開始。保留重複行與內部空格。
2. 按「開始練習」，等待三秒倒數；焦點會移至「作答」。輸入場上任一完整題目，再按 Enter。答案採 NFC 完整比對、區分大小寫，提交不 trim。命中消除一塊、加 100 分並清空輸入；未匹配會保留文字供修改，不扣分。
3. 中文／日文 IME 先確認選字，再按下一次 Enter 提交。組字期间、`isComposing`、`keyCode 229` 及 `compositionend` 先於確認 Enter 的事件順序都有防護；長按 Enter 不連續提交。確認按鍵放開後才解除同一次組字確認的保護。
4. 棋盤為四欄八格，每 20 秒加速。題目完整換行、保留空格；格高依題庫的實際排版調整。窄視窗或放大時可捲動棋盤，作答區停靠在視窗底部。Tab／Shift+Tab 可切換控制項，焦點可見；尊重 reduced-motion，沒有額外裝飾動畫。
5. 視窗失焦或分頁隱藏時，倒數與模擬時鐘凍結。返回後接續，不補算離開的時間。
6. 任一欄落定堆滿八格後停止遊戲，顯示分數、消除數、未匹配數與存活時間。「再玩一次」沿用題庫並重設；「修改來源」返回原始文字。重新整理不保存題庫或成績。

完整規則見 [玩家操作說明](docs/player-guide.md)。

## 驗證範圍與交接

主機已獨立執行 26 項核心與 DOM 測試、型別檢查及正式建置，並在真實 Chrome 驗證來源、輸入、分頁凍結、長題顯示、結算與重玩。詳細結果與環境限制見 [驗證紀錄](docs/verification.md)。每個新增 UI 行為切片先執行失敗測試，再完成實作。**真實中文／日文 OS IME、200% 縮放及部分系統相容性檢查尚未驗證**，已另開 [BOL-71](https://linear.app/bolas-dev/issue/BOL-71) 接續；合成 composition／KeyboardEvent 測試不等於真實 OS IME 通過。

`docs/player-guide.md` 與 `docs/acceptance.md` 保持原樣，後者是完整人工驗收清單，不是自動通過報告。交付分支為 `symphony/rebuild-mvp`，不覆蓋原本的 `main`。核心不依賴 DOM、計時器或系統時鐘；以下為其公開契約。

## 公開介面

由 `src/game.ts` 匯出：

```ts
parseSource(source: string): string[]
createGame(prompts: readonly string[], rng?: Rng): GameState
advance(state: GameState, deltaMs: number, rng?: Rng): GameState
submit(state: GameState, text: string): GameState
```

同時匯出 `Rng`、`Column`、`GameStatus`、`Block`、`GameState` 型別。每次操作都必須保留回傳值；不會修改傳入的 state 或來源陣列。

```ts
import { parseSource, createGame, advance, submit } from './src/game.js';

const prompts = parseSource('你好\nHello  world\nこんにちは');
let state = createGame(prompts);
// UI 完成 3 秒倒數後才開始供應有效遊戲時間。
state = advance(state, 2400); // 第一塊出現
state = submit(state, '你好'); // 完整、未經 trim 的提交內容
```

- `parseSource` 支援 LF、CRLF、CR，每行 trim 後去掉空白行，保留內部空格、原始字形與重複行。至少一題、最多 500 題，每題最多 40 個 Unicode code points；超限丟出 `RangeError`，不截斷。長度以 trim 後、NFC 前的 code points 計算，並非 UTF-16 長度或可見字素數。
- `createGame` 接受已解析的題目，也會檢查空來源、空白題目及長度限制；複製題庫並重設所有狀態。初始棋盤為空，第一塊在有效遊戲時間 2400ms 生成。
- `advance` 接受非負、有限的毫秒數，可為小數。運行中收到非法 delta 會丟出 `RangeError`。零 delta 不做任何事。
- `submit` 對題目及提交做 NFC 正規化後完整比對，區分大小寫，提交不 trim。命中只消除一塊並加 100 分；未命中（含空字串）增加一次 `unmatchedCount`。
- `rng` 是回傳 `[0, 1)` 有限數值的函式，預設 `Math.random`；非法回傳值丟出 `RangeError`。需要重現時，請在 `createGame` 與每次 `advance` 傳入同一個有種子的 RNG。核心不保存 RNG；state 本身可 JSON 序列化。重播也須使用相同 RNG 序列。

## UI 使用的 state

| 欄位 | 意義 |
| --- | --- |
| `status` | `'running'` 或 `'gameover'`；不包含 UI 的來源、倒數、暫停或結算畫面狀態 |
| `prompts` | 原始題庫；保留重複項作為抽題權重 |
| `blocks` | 目前方塊，按生成順序保存；同時包含下落與落定塊 |
| `score` | 累計分數，每消除一塊加 100 |
| `clearedCount` | 消除數 |
| `unmatchedCount` | 未命中的提交次數 |
| `elapsedMs` | 有效遊戲時間／結算存活時間，Game Over 後凍結 |
| `spawnIntervalMs` | 當前生成間隔（毫秒） |
| `fallSpeed` | 當前落速（格／秒） |
| `spawnElapsedMs` | 上次生成後累積的時間；加速時保留累積進度 |
| `columnBag` | 目前 shuffle bag 尚未使用的欄位，由陣列前端依序取出 |
| `nextBlockId` | 下一塊的 id；新局從 1 開始 |

每個 `Block` 包含：

| 欄位 | 意義 |
| --- | --- |
| `id` | 單局內穩定、遞增的識別碼，適合 UI key |
| `text` | 完整的原始題目，供顯示；請不要截字 |
| `column` | `0 \| 1 \| 2 \| 3`，由左至右 |
| `y` | 方塊上緣的格數座標，向下增加；頂列 0、底列 7，可為小數 |
| `settled` | 是否由底部或連續落定堆疊支撐 |
| `createdAtMs` | 生成時的有效遊戲時間 |

所有欄位與陣列皆為唯讀契約；請使用公開函式取得下一個 state，不要自行修改。棋盤固定 4 欄 × 8 格，每塊高 1 格。若欄位入口尚未騰出一格，新塊會緊接在前一塊上方，`y` 可暫時為負數；UI 以棋盤邊界裁切，核心仍計算其下落與匹配，避免生成時重疊。

## 時間、重力與匹配規則

每滿 20 秒有效遊戲時間，生成間隔由 2400ms 減少 200ms，最低 600ms；落速由 0.75 格／秒增加 0.1，最高 2。每次生成從題庫等機率抽取一個項目。欄位用 Fisher–Yates shuffle bag，每連續四次生成（每袋）恰好涵蓋四欄；跨袋可能連續選到同欄。

`advance` 依生成、加速與落定事件切分 delta，從底部往上處理碰撞。大段 delta 也不會穿透方塊或越過終局時間。同時發生的事件先處理落定與結束判定，再更新難度，最後生成。

同文字的優先順序是：所在欄的**落定塊數最多**、`y` 最大（位置較低）、`id` 最小（較早生成）。下落塊與落定塊皆可命中。消除後，失去支撐的上方塊立即標為下落，位置先不變；後續 `advance` 以當前落速補位，直到重新落定，不瞬移、不重疊、不改變上下順序。

任一欄達到八個落定塊時立即 Game Over。剩餘 delta 不再消耗；之後 `advance` 與 `submit` 原樣回傳同一個 state，分數、未命中數、存活時間、生成及位置均不變，也不呼叫 RNG。

UI 負責 3 秒倒數、Enter／IME 組字安全、輸入焦點與失焦凍結。失焦時停止呼叫 `advance`；恢復時重設 UI 的上一幀時間基準，不能把失焦期間補算進 delta。結算可直接讀取 `score`、`clearedCount`、`unmatchedCount`、`elapsedMs`。再玩呼叫 `createGame(state.prompts)`；修改來源後重新 `parseSource` 與 `createGame`，不沿用舊 state。
