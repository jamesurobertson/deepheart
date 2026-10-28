import { GAME_VERSION } from './version.ts';

/** On an uncaught error, covers the game with a screen that offers a reload and the details to send in. The save is left as it was. */
export function installCrashScreen() {
  let shown = false;
  const show = (error: unknown) => {
    if (shown) return;
    shown = true;
    const details = [`Deepheart ${GAME_VERSION}`, navigator.userAgent, error instanceof Error ? (error.stack ?? error.message) : String(error)].join('\n');
    const screen = document.createElement('div');
    screen.className = 'crash';
    const title = document.createElement('h1');
    title.textContent = 'Something broke';
    const note = document.createElement('p');
    note.textContent = 'Your save is safe.';
    const reload = document.createElement('button');
    reload.textContent = 'Reload';
    reload.onclick = () => location.reload();
    const copy = document.createElement('button');
    copy.textContent = 'Copy details';
    copy.onclick = () => {
      navigator.clipboard?.writeText(details).then(() => (copy.textContent = 'Copied'), () => {});
    };
    screen.append(title, note, reload, copy);
    document.body.append(screen);
  };
  window.addEventListener('error', (e) => e.error && show(e.error));
  window.addEventListener('unhandledrejection', (e) => show(e.reason));
}
