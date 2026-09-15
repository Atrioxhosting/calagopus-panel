import { useLayoutEffect, useState } from 'react';
import { useCurrentWindow } from '@/providers/CurrentWindowProvider.tsx';

/**
 * Widths in rem of the `page` container variants declared in `src/breakpoints.css`. Tailwind does
 * not expose its breakpoints as custom properties and `var()` is invalid inside a container query
 * condition, so these have to be kept in step with that file by hand.
 */
const pageBreakpoints = {
  sm: 40,
  md: 48,
  lg: 64,
  xl: 80,
  '2xl': 96,
} as const;

export type PageBreakpoint = keyof typeof pageBreakpoints;

function matchesPageBreakpoint(element: HTMLElement, breakpoint: PageBreakpoint): boolean {
  const rootFontSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;

  return element.getBoundingClientRect().width >= pageBreakpoints[breakpoint] * rootFontSize;
}

/**
 * The JavaScript counterpart to the `page` container breakpoint variants, for behaviour that CSS
 * cannot express. Measures the enclosing virtual window when there is one, so it agrees with what
 * `sm:`/`md:`/... do in the same subtree rather than with the viewport.
 */
export function usePageBreakpoint(breakpoint: PageBreakpoint): boolean {
  const { getParent } = useCurrentWindow();
  const [matches, setMatches] = useState(() => matchesPageBreakpoint(document.body, breakpoint));

  useLayoutEffect(() => {
    const element = getParent() ?? document.body;
    const update = () => setMatches(matchesPageBreakpoint(element, breakpoint));

    const observer = new ResizeObserver(update);
    observer.observe(element);
    update();

    return () => observer.disconnect();
  }, [breakpoint, getParent]);

  return matches;
}
