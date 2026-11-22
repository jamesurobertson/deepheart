import '../i18n/fonts/base.css';
import '../i18n/fonts/extras.css';
import { initI18n } from '../i18n/boot.ts';

await initI18n();
await import('./main.ts');
