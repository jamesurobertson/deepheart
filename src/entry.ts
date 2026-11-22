// The language is loaded before the game's modules run, so every table they build at load time is already in it.
import './i18n/fonts/base.css';
import './i18n/fonts/extras.css';
import { initI18n } from './i18n/boot.ts';

await initI18n();
await import('./main.ts');
