import type { WindowInfo, WindowWatcher } from './types';

/**
 * get-windows-based implementation.
 *
 * Verification notes:
 *   - `get-windows` is ESM-only since v9. From a CommonJS main process we
 *     have to use `await import('get-windows')` rather than `require`.
 *   - Returns `undefined` (NOT null) when no foreground window is detected,
 *     e.g. when the desktop has focus. We normalise to `null`.
 *   - On Windows the field shape is `{ owner: { name, processId }, title }`.
 *     The plan called for `{app, title, pid}`, so we map here.
 */
export class GetWindowsWatcher implements WindowWatcher {
  async current(): Promise<WindowInfo | null> {
    const mod = await import('get-windows');
    const active = await mod.activeWindow();
    if (!active) return null;

    return {
      app: active.owner?.name ?? 'unknown',
      title: active.title ?? '',
      pid: active.owner?.processId ?? -1,
    };
  }
}
