import { useCallback, useEffect, useRef } from 'react';
import { getShortcutOverrides } from '@/lib/quickActions/shortcutOverrides.ts';
import { matchesShortcut } from '@/plugins/quick-actions/useKeyboardShortcuts.ts';

export type FontSizeZoomStep = -1 | 0 | 1;

interface FontSizeZoomShortcuts {
  increase: string;
  decrease: string;
  reset: string;
}

const WHEEL_STEP_PX = 25;
const WHEEL_NOTCH_PX = 50;
const WHEEL_GESTURE_IDLE_MS = 150;
const MAX_STEPS_PER_EVENT = 2;

export function stepFontSize(size: number, step: FontSizeZoomStep, min: number, max: number, defaultSize: number) {
  if (step === 0) return defaultSize;
  return Math.min(max, Math.max(min, size + step));
}

function isDefaultBinding(id: string) {
  return !Object.hasOwn(getShortcutOverrides(), id);
}

// Browsers zoom on Ctrl+=, Ctrl+Shift+= (US "+"), unshifted "+" (e.g. German) and the numpad keys,
// which no single binding covers because shift is matched exactly.
function matchesBrowserZoomKey(event: KeyboardEvent, direction: 1 | -1) {
  if (!(event.ctrlKey || event.metaKey) || event.altKey) return false;

  return direction === 1
    ? event.code === 'Equal' || event.code === 'NumpadAdd' || event.key === '+'
    : event.code === 'Minus' || event.code === 'NumpadSubtract' || event.key === '-';
}

function keyboardStep(event: KeyboardEvent, shortcuts: FontSizeZoomShortcuts): FontSizeZoomStep | null {
  if (matchesShortcut(event, shortcuts.reset)) return 0;
  if (matchesShortcut(event, shortcuts.increase)) return 1;
  if (matchesShortcut(event, shortcuts.decrease)) return -1;
  if (isDefaultBinding(shortcuts.increase) && matchesBrowserZoomKey(event, 1)) return 1;
  if (isDefaultBinding(shortcuts.decrease) && matchesBrowserZoomKey(event, -1)) return -1;
  return null;
}

/**
 * Ctrl+wheel (and trackpad pinch, which browsers report as Ctrl+wheel) plus the zoom shortcuts,
 * scoped to the element given the returned ref so browser zoom keeps working everywhere else on the page.
 */
export function useFontSizeZoom(shortcuts: FontSizeZoomShortcuts, zoom: (step: FontSizeZoomStep) => void) {
  const zoomRef = useRef(zoom);
  const shortcutsRef = useRef(shortcuts);

  useEffect(() => {
    zoomRef.current = zoom;
    shortcutsRef.current = shortcuts;
  });

  return useCallback((element: HTMLElement | null) => {
    if (!element) return;

    let accumulated = 0;
    let lastWheelAt = 0;

    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return;

      event.preventDefault();
      event.stopPropagation();

      const deltaPx =
        event.deltaMode === WheelEvent.DOM_DELTA_LINE
          ? event.deltaY * 16
          : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
            ? event.deltaY * element.clientHeight
            : event.deltaY;
      if (deltaPx === 0) return;

      if (event.deltaMode !== WheelEvent.DOM_DELTA_PIXEL || Math.abs(deltaPx) >= WHEEL_NOTCH_PX) {
        accumulated = 0;
        zoomRef.current(deltaPx < 0 ? 1 : -1);
        return;
      }

      if (event.timeStamp - lastWheelAt > WHEEL_GESTURE_IDLE_MS || Math.sign(accumulated) !== Math.sign(deltaPx)) {
        accumulated = 0;
      }
      lastWheelAt = event.timeStamp;
      accumulated += deltaPx;

      let steps = 0;
      while (Math.abs(accumulated) >= WHEEL_STEP_PX && steps < MAX_STEPS_PER_EVENT) {
        const direction = Math.sign(accumulated);
        accumulated -= direction * WHEEL_STEP_PX;
        zoomRef.current(direction < 0 ? 1 : -1);
        steps++;
      }
      if (steps === MAX_STEPS_PER_EVENT) accumulated = 0;
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const step = keyboardStep(event, shortcutsRef.current);
      if (step === null) return;

      event.preventDefault();
      event.stopPropagation();
      zoomRef.current(step);
    };

    element.addEventListener('wheel', onWheel, { capture: true, passive: false });
    element.addEventListener('keydown', onKeyDown, { capture: true });

    return () => {
      element.removeEventListener('wheel', onWheel, { capture: true });
      element.removeEventListener('keydown', onKeyDown, { capture: true });
    };
  }, []);
}
