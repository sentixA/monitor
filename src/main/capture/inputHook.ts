import { EventEmitter } from 'node:events';
import type {
  InputHook,
  InputHandler,
  KeyEvent,
  MouseClickEvent,
  MouseMoveEvent,
} from './types';

/**
 * uiohook-napi-based implementation with a no-op fallback.
 *
 * Verification notes:
 *   - `uiohook-napi` v1.5.5 ships prebuilds for darwin/linux/win32 on x64
 *     and arm64. BUT the linux-arm64 prebuild is mislabeled — the .node file
 *     inside is actually an x86-64 ELF, so it fails to load on real ARM64
 *     hosts with `cannot open shared object file: No such file or directory`.
 *     File upstream if we hit this on Windows-arm64 or macOS-arm64 too.
 *   - On a headless Linux box (no X session), even the correct prebuild
 *     would fail because the library links against libuiohook → libX11.
 *   - require()ing the module throws synchronously at load time when the
 *     binding cannot be opened, so the try/catch around require() is what
 *     drives the fallback. Don't move this to a top-level static import.
 *   - The library exposes a single global `uIOhook` singleton, NOT a class.
 *     `start()` more than once is harmless; `stop()` after never starting
 *     throws on some Linux builds, so we guard with a flag.
 *   - Mouse-move events fire at very high frequency. Throttle in the
 *     Aggregator (next stage) — do NOT throttle here, the hook should be a
 *     dumb passthrough.
 */
export function createInputHook(): InputHook {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('uiohook-napi') as typeof import('uiohook-napi');
    return new UiohookInputHook(mod);
  } catch (err) {
    // Don't crash the app — log once and hand back a no-op so the rest of
    // the pipeline (RepeatInputDetector etc.) can degrade gracefully.
    console.warn(
      '[capture] uiohook-napi unavailable, input hook disabled:',
      (err as Error).message,
    );
    return new NoopInputHook();
  }
}

class UiohookInputHook implements InputHook {
  readonly isAvailable = true;
  private readonly emitter = new EventEmitter();
  private started = false;

  constructor(private readonly mod: typeof import('uiohook-napi')) {
    const { uIOhook, UiohookKey } = mod;

    uIOhook.on('keydown', (e) => {
      const event: KeyEvent = {
        type: 'key',
        ts: Date.now(),
        key: keyName(e.keycode, UiohookKey),
        rawcode: e.keycode,
      };
      this.emitter.emit('key', event);
    });

    uIOhook.on('mousedown', (e) => {
      const event: MouseClickEvent = {
        type: 'click',
        ts: Date.now(),
        x: e.x,
        y: e.y,
        // uiohook-napi types `button` as `unknown`; on real events it's a
        // number (1=left, 2=right, 3=middle on Windows). Coerce defensively.
        button: typeof e.button === 'number' ? e.button : 0,
      };
      this.emitter.emit('click', event);
    });

    uIOhook.on('mousemove', (e) => {
      const event: MouseMoveEvent = {
        type: 'move',
        ts: Date.now(),
        x: e.x,
        y: e.y,
      };
      this.emitter.emit('move', event);
    });
  }

  on(event: 'key', handler: InputHandler<KeyEvent>): void;
  on(event: 'click', handler: InputHandler<MouseClickEvent>): void;
  on(event: 'move', handler: InputHandler<MouseMoveEvent>): void;
  on(event: string, handler: (...args: never[]) => void): void {
    this.emitter.on(event, handler as (...args: unknown[]) => void);
  }

  start(): void {
    if (this.started) return;
    this.mod.uIOhook.start();
    this.started = true;
  }

  stop(): void {
    if (!this.started) return;
    this.mod.uIOhook.stop();
    this.started = false;
  }
}

class NoopInputHook implements InputHook {
  readonly isAvailable = false;
  on(): void {
    /* noop */
  }
  start(): void {
    /* noop */
  }
  stop(): void {
    /* noop */
  }
}

/**
 * Reverse-lookup a keycode in UiohookKey. Falls back to `code:NN` for
 * keycodes not present in the table (e.g. browser-specific media keys).
 */
function keyName(
  rawcode: number,
  table: typeof import('uiohook-napi').UiohookKey,
): string {
  for (const [name, code] of Object.entries(table)) {
    if (code === rawcode) return name.toLowerCase();
  }
  return `code:${rawcode}`;
}
