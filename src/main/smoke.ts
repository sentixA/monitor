// Smoke-test entry for task 02 verification.
//
// Run with `npm run build && npm run smoke` (requires a display server on
// Linux — on Windows it just works).
//
// Output is one JSON line per check so a wrapper script can parse it.

import { app } from 'electron';
import { DesktopScreenCapturer } from './capture/screenCapturer';
import { GetWindowsWatcher } from './capture/windowWatcher';
import { createInputHook } from './capture/inputHook';

type Result =
  | { check: string; ok: true; detail: Record<string, unknown> }
  | { check: string; ok: false; error: string };

function emit(r: Result): void {
  process.stdout.write(JSON.stringify(r) + '\n');
}

async function main(): Promise<void> {
  await app.whenReady();

  // 1. Screen capture
  try {
    const cap = new DesktopScreenCapturer();
    const buf = await cap.capture();
    emit({
      check: 'screenCapture',
      ok: true,
      detail: { bytes: buf.length, head: buf.slice(0, 8).toString('hex') },
    });
  } catch (err) {
    emit({
      check: 'screenCapture',
      ok: false,
      error: (err as Error).message,
    });
  }

  // 2. Foreground window
  try {
    const w = new GetWindowsWatcher();
    const info = await w.current();
    emit({
      check: 'windowWatcher',
      ok: true,
      detail: { window: info },
    });
  } catch (err) {
    emit({
      check: 'windowWatcher',
      ok: false,
      error: (err as Error).message,
    });
  }

  // 3. Input hook — only verify it loads + reports availability. We don't
  //    actually wait for keypresses in the smoke test (no human in the loop).
  try {
    const hook = createInputHook();
    emit({
      check: 'inputHook.load',
      ok: true,
      detail: { isAvailable: hook.isAvailable },
    });
    if (hook.isAvailable) {
      hook.start();
      hook.stop();
      emit({
        check: 'inputHook.startStop',
        ok: true,
        detail: {},
      });
    }
  } catch (err) {
    emit({
      check: 'inputHook',
      ok: false,
      error: (err as Error).message,
    });
  }

  app.quit();
}

main().catch((err) => {
  emit({ check: 'fatal', ok: false, error: (err as Error).stack ?? String(err) });
  app.exit(1);
});
