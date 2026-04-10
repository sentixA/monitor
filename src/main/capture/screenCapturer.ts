import { desktopCapturer, screen } from 'electron';
import sharp from 'sharp';
import type { ScreenCapturer } from './types';

/**
 * desktopCapturer-based implementation. Resamples to long-edge ≤ MAX_EDGE px
 * to keep LLM vision payloads cheap.
 *
 * Notes from verification:
 *   - desktopCapturer.getSources requires the Electron app to be `ready`.
 *     Callers must `await app.whenReady()` first.
 *   - thumbnailSize is in DIPs, not raw pixels. On HiDPI displays we have to
 *     multiply by the scale factor or we get a blurry resample.
 *   - Setting thumbnailSize larger than the actual screen still works (it
 *     gets clamped), but smaller forces a downscale inside Electron — we
 *     intentionally request *full* screen size and let sharp handle the final
 *     resize, since sharp's resampling is higher quality.
 */
const MAX_EDGE = 1280;

export class DesktopScreenCapturer implements ScreenCapturer {
  async capture(): Promise<Buffer> {
    const primary = screen.getPrimaryDisplay();
    const { width, height } = primary.size;
    const scale = primary.scaleFactor || 1;

    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: {
        width: Math.round(width * scale),
        height: Math.round(height * scale),
      },
    });

    if (sources.length === 0) {
      throw new Error('desktopCapturer returned no screen sources');
    }

    // Pick the source matching the primary display id when possible; fall
    // back to the first one. On Windows display_id is a string of the
    // monitor handle, on macOS it's CGDirectDisplayID.
    const primaryId = String(primary.id);
    const source =
      sources.find((s) => s.display_id === primaryId) ?? sources[0];

    const thumb = source.thumbnail;
    if (thumb.isEmpty()) {
      throw new Error('desktopCapturer returned an empty thumbnail');
    }

    const rawPng = thumb.toPNG();

    // Final downscale via sharp for quality + cost control.
    const longEdge = Math.max(width, height);
    if (longEdge <= MAX_EDGE) {
      return rawPng;
    }

    return sharp(rawPng)
      .resize({
        width: width >= height ? MAX_EDGE : undefined,
        height: height > width ? MAX_EDGE : undefined,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .png({ compressionLevel: 6 })
      .toBuffer();
  }
}
