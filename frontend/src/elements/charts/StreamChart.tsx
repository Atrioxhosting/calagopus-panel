import { faArrowUp } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { AreaChart, ChartTooltip } from '@mantine/charts';
import { PointerEvent, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { makeComponentHookable } from 'shared';
import { CHART_TICK, CHART_WINDOW, StreamChartProps } from '@/lib/chart.ts';
import { useChartSync } from '@/providers/contexts/chartSyncContext.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

const PLOT_INSET = 3;
const EDGE = CHART_TICK * 1.5;
const TOOLTIP_GAP = 12;
const SYNC_TOLERANCE = CHART_TICK * 0.75;

function formatOffset(at: number, end: number): string {
  const seconds = Math.round((at - end) / 1000);
  return seconds >= 0 ? 'now' : `${seconds}s`;
}

function StreamChart({ data, domain, ticks, yMax, series, format, highlighted, limit, compact }: StreamChartProps) {
  const { t } = useTranslations();
  const sync = useChartSync();
  const viewport = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const tooltip = useRef<HTMLDivElement>(null);
  const previousEnd = useRef<number | null>(null);
  const pointerRef = useRef<{ x: number; y: number } | null>(null);
  const hoverSource = useRef({ data, start: domain[0], width: 0, keys: [] as string[] });
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);
  const [hoveredAt, setHoveredAt] = useState<number | null>(null);
  const [tooltipSize, setTooltipSize] = useState({ width: 0, height: 0 });

  const [start, end] = domain;

  useEffect(() => {
    const element = viewport.current;
    if (!element) {
      return;
    }

    const observer = new ResizeObserver(([entry]) =>
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height }),
    );
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  const edgePixels = (size.width * EDGE) / CHART_WINDOW;
  const plotHeight = Math.max(size.height - PLOT_INSET * 2, 0);
  const toY = (value: number) => PLOT_INSET + (1 - value / yMax) * plotHeight;

  useLayoutEffect(() => {
    const from = previousEnd.current;
    previousEnd.current = end;

    const step = from === null ? 0 : end - from;
    if (step <= 0 || step > CHART_WINDOW || size.width === 0) {
      return;
    }

    const travel = Math.min(step, EDGE);
    const offset = (size.width * travel) / CHART_WINDOW;
    const timing = { duration: travel, easing: 'linear', fill: 'forwards' } as const;

    scroller.current?.animate([{ transform: `translateX(${offset}px)` }, { transform: 'none' }], timing);
  }, [end, size.width]);

  const chartSeries = useMemo(
    () =>
      series
        .filter((entry) => !entry.hidden)
        .map((entry) => ({
          name: entry.key,
          label: entry.label,
          color: entry.color,
          strokeDasharray: entry.dash,
        })),
    [series],
  );

  useLayoutEffect(() => {
    hoverSource.current = { data, start, width: size.width, keys: chartSeries.map((entry) => entry.name) };
  }, [data, start, size.width, chartSeries]);

  const hovering = pointer !== null;

  useEffect(() => {
    if (!hovering) {
      setHoveredAt(null);
      return;
    }

    let frame = 0;
    const update = () => {
      frame = requestAnimationFrame(update);

      const at = pointerRef.current;
      const { data, start, width, keys } = hoverSource.current;
      if (!at || !scroller.current || width === 0) {
        return;
      }

      const shift = new DOMMatrixReadOnly(getComputedStyle(scroller.current).transform).m41;
      const time = start + ((at.x - shift) * CHART_WINDOW) / width;

      let nearest: number | null = null;
      for (const row of data) {
        if (!keys.some((key) => row[key] !== null && row[key] !== undefined)) {
          continue;
        }
        if (nearest === null || Math.abs(row.t! - time) < Math.abs(nearest - time)) {
          nearest = row.t!;
        }
      }

      setHoveredAt(nearest);
    };
    update();

    return () => cancelAnimationFrame(frame);
  }, [hovering]);

  useEffect(() => {
    if (!sync || !hovering || hoveredAt === null) {
      return;
    }

    sync.setAt(hoveredAt);
    return () => sync.setAt(null);
  }, [sync?.setAt, hovering, hoveredAt]);

  const syncedAt = hovering ? null : (sync?.at ?? null);
  let syncedRow: Record<string, number | null> | undefined;
  if (syncedAt !== null) {
    for (const row of data) {
      const distance = Math.abs(row.t! - syncedAt);
      if (distance <= SYNC_TOLERANCE && (!syncedRow || distance < Math.abs(syncedRow.t! - syncedAt))) {
        syncedRow = row;
      }
    }
  }

  const hoveredRow = hovering ? (hoveredAt === null ? undefined : data.find((row) => row.t === hoveredAt)) : syncedRow;
  const payload = hoveredRow
    ? chartSeries
        .filter((entry) => hoveredRow[entry.name] !== null && hoveredRow[entry.name] !== undefined)
        .map((entry) => ({ name: entry.name, dataKey: entry.name, color: entry.color, payload: hoveredRow }))
    : [];

  useLayoutEffect(() => {
    const element = tooltip.current;
    if (!element) {
      return;
    }

    const width = element.offsetWidth;
    const height = element.offsetHeight;
    setTooltipSize((current) => (current.width === width && current.height === height ? current : { width, height }));
  });

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const next = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
    pointerRef.current = next;
    setPointer(next);
  };

  const onPointerLeave = () => {
    pointerRef.current = null;
    setPointer(null);
  };

  const labels = useMemo(() => {
    const seen = new Set<string>();

    return ticks
      .map((value) => ({ value, text: format(value) }))
      .filter((tick) => {
        if (seen.has(tick.text)) {
          return false;
        }
        seen.add(tick.text);
        return true;
      });
  }, [ticks, format]);

  const pointerY = pointer ? Math.min(Math.max(pointer.y, PLOT_INSET), PLOT_INSET + plotHeight) : 0;
  const pointerValue = plotHeight > 0 ? (1 - (pointerY - PLOT_INSET) / plotHeight) * yMax : 0;
  const hoveredX = hoveredRow ? ((hoveredRow.t! - start) * size.width) / CHART_WINDOW + edgePixels : 0;

  const tooltipLeft = pointer
    ? pointer.x + TOOLTIP_GAP + tooltipSize.width > size.width
      ? Math.max(pointer.x - TOOLTIP_GAP - tooltipSize.width, 0)
      : pointer.x + TOOLTIP_GAP
    : 0;
  const tooltipTop = pointer
    ? Math.min(Math.max(pointer.y - tooltipSize.height / 2, 0), Math.max(size.height - tooltipSize.height, 0))
    : 0;

  return (
    <div className='flex h-full w-full'>
      <div className={compact ? 'hidden' : 'relative w-18 shrink-0'}>
        {labels.map((tick) => (
          <span
            key={tick.text}
            className='absolute right-2 -translate-y-1/2 whitespace-nowrap text-xs text-(--chart-tick-color) tabular-nums'
            style={{ top: toY(tick.value) }}
          >
            {tick.text}
          </span>
        ))}
        {pointer && (
          <span
            className='absolute right-1 z-10 -translate-y-1/2 whitespace-nowrap rounded-sm bg-(--mantine-color-body) px-1 text-xs tabular-nums ring-1 ring-(--mantine-color-default-border)'
            style={{ top: pointerY }}
          >
            {format(pointerValue)}
          </span>
        )}
      </div>

      <div
        ref={viewport}
        className={compact ? 'relative min-w-0 flex-1' : 'relative min-w-0 flex-1 cursor-crosshair touch-pan-y'}
        onPointerMove={compact ? undefined : onPointerMove}
        onPointerLeave={compact ? undefined : onPointerLeave}
      >
        {!compact &&
          labels.map((tick) => (
            <div
              key={tick.text}
              className='pointer-events-none absolute inset-x-0 border-t border-(--chart-grid-color)'
              style={{ top: toY(tick.value) }}
            />
          ))}

        {limit !== null && limit !== undefined && limit > 0 && limit <= yMax && (
          <div
            className='pointer-events-none absolute inset-x-0 border-t border-dashed border-(--mantine-color-red-filled)/70'
            style={{ top: toY(limit) }}
          >
            <span
              className={`absolute right-1 whitespace-nowrap text-[10px] text-(--mantine-color-red-filled) tabular-nums ${toY(limit) < 16 ? 'top-0.5' : 'bottom-0.5'}`}
            >
              {t('common.stat.limit', { limit: format(limit) })}
            </span>
          </div>
        )}
        {limit !== null && limit !== undefined && limit > yMax && (
          <span className='pointer-events-none absolute top-0 right-1 whitespace-nowrap text-[10px] text-(--mantine-color-dimmed) tabular-nums'>
            <FontAwesomeIcon icon={faArrowUp} className='mr-1' />
            {t('common.stat.limit', { limit: format(limit) })}
          </span>
        )}

        <div className='pointer-events-none absolute inset-0' style={{ clipPath: 'inset(-100% 0px -100% 0px)' }}>
          <div
            ref={scroller}
            className='absolute inset-y-0 will-change-transform'
            style={{ left: -edgePixels, width: size.width + edgePixels * 2 }}
          >
            {size.width > 0 && (
              <AreaChart
                h={size.height}
                data={data}
                dataKey='t'
                series={chartSeries}
                curveType='monotone'
                withGradient
                fillOpacity={0.25}
                strokeWidth={2}
                withDots={false}
                withXAxis={false}
                withYAxis={false}
                withTooltip={false}
                gridAxis='none'
                connectNulls={false}
                xAxisProps={{ type: 'number', domain: [start - EDGE, end + EDGE], allowDataOverflow: true, hide: true }}
                yAxisProps={{ domain: [0, yMax], allowDataOverflow: true, hide: true }}
                areaProps={(entry) => ({
                  isAnimationActive: false,
                  fillOpacity: highlighted && highlighted !== entry.name ? 0 : 1,
                  strokeOpacity: highlighted && highlighted !== entry.name ? 0.3 : 1,
                })}
                areaChartProps={{ margin: { top: PLOT_INSET, right: 0, bottom: PLOT_INSET, left: 0 } }}
              />
            )}

            {hoveredRow && (
              <>
                <div
                  className='absolute inset-y-0 border-l border-dashed border-(--chart-tick-color)'
                  style={{ left: hoveredX }}
                />
                {payload.map((item) => (
                  <span
                    key={item.name}
                    className='absolute size-2.5 -translate-1/2 rounded-full border-2 border-(--mantine-color-body)'
                    style={{
                      left: hoveredX,
                      top: toY(Math.min(hoveredRow[item.name]!, yMax)),
                      backgroundColor: item.color,
                      opacity: highlighted && highlighted !== item.name ? 0.3 : 1,
                    }}
                  />
                ))}
                {!hovering && payload.length > 0 && (
                  <span
                    className={`absolute top-1 flex gap-2 whitespace-nowrap rounded-sm bg-(--mantine-color-body) px-1 text-[10px] tabular-nums ring-1 ring-(--mantine-color-default-border) ${hoveredX - edgePixels > size.width / 2 ? '-translate-x-[calc(100%+6px)]' : 'translate-x-1.5'}`}
                    style={{ left: hoveredX }}
                  >
                    {payload.map((item) => (
                      <span key={item.name} style={{ color: payload.length > 1 ? item.color : undefined }}>
                        {format(hoveredRow[item.name]!)}
                      </span>
                    ))}
                  </span>
                )}
              </>
            )}
          </div>
        </div>

        {pointer && (
          <div
            className='pointer-events-none absolute inset-x-0 border-t border-dashed border-(--chart-tick-color)'
            style={{ top: pointerY }}
          />
        )}

        {pointer && hoveredRow && payload.length > 0 && (
          <div
            ref={tooltip}
            className='pointer-events-none absolute z-10'
            style={{ left: tooltipLeft, top: tooltipTop }}
          >
            <ChartTooltip
              label={formatOffset(hoveredRow.t!, end)}
              payload={payload}
              series={chartSeries}
              valueFormatter={format}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default makeComponentHookable(StreamChart);
