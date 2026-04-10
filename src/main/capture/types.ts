// Capture-layer abstractions. Implementations are platform-specific so the
// pipeline above can stay the same when we add macOS / Linux later.

export interface WindowInfo {
  app: string;
  title: string;
  pid: number;
}

export type KeyEvent = {
  type: 'key';
  ts: number;
  /** Lowercased character or key name (e.g. 'a', 'enter', 'backspace'). */
  key: string;
  /** uiohook keycode, kept for debugging / future heuristics. */
  rawcode: number;
};

export type MouseClickEvent = {
  type: 'click';
  ts: number;
  x: number;
  y: number;
  button: number;
};

export type MouseMoveEvent = {
  type: 'move';
  ts: number;
  x: number;
  y: number;
};

export type InputEvent = KeyEvent | MouseClickEvent | MouseMoveEvent;
export type InputEventName = InputEvent['type']; // 'key' | 'click' | 'move'

export type InputHandler<E extends InputEvent = InputEvent> = (event: E) => void;

export interface ScreenCapturer {
  /** Returns a PNG buffer of the primary display, downscaled to a sane size. */
  capture(): Promise<Buffer>;
}

export interface WindowWatcher {
  /** Returns the foreground window or null if it cannot be determined. */
  current(): Promise<WindowInfo | null>;
}

export interface InputHook {
  on(event: 'key', handler: InputHandler<KeyEvent>): void;
  on(event: 'click', handler: InputHandler<MouseClickEvent>): void;
  on(event: 'move', handler: InputHandler<MouseMoveEvent>): void;
  start(): void;
  stop(): void;
  /** True if a real native hook is wired up; false for the no-op fallback. */
  readonly isAvailable: boolean;
}
