import { mountGame } from './app.js';
import './style.css';

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('找不到應用程式容器');
mountGame(root);
