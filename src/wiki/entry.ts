import { initI18n } from '../i18n/boot.ts';

await initI18n();
await import('./main.ts');
