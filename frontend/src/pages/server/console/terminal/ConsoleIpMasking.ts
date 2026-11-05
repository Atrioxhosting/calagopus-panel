import type { IBufferCell, IDisposable, IMarker, Terminal } from '@xterm/xterm';
import { findConsoleAddresses } from './consoleAddresses.ts';
import './ConsoleIpMasking.css';

type Position = { row: number; col: number };
type Segment = { start: number; end: number; sourceStart: number; sourceEnd: number };
type Run = { start: number; end: number; classes: string; style: string; invisible: boolean };
type FlowLine = {
  row: number;
  endRow: number;
  text: string;
  positions: Position[];
  runs: Run[];
  segments: Segment[];
  element: HTMLDivElement;
  key: string;
};

/**
 * xterm owns the original buffer, ANSI parsing, search and clipboard selection.
 * The browser owns visible text flow. No source-IP cell widths are reserved.
 * DOM selection endpoints are translated back into the original buffer.
 */
export class ConsoleIpMasking implements IDisposable {
  private readonly view = document.createElement('div');
  private readonly subscriptions: IDisposable[] = [];
  private readonly reveals: { marker: IMarker; col: number; value: string }[] = [];
  private readonly addresses = new WeakMap<Element, { line: FlowLine; start: number; value: string }>();
  private lines: FlowLine[] = [];
  private anchor?: IMarker;
  private anchorRow = 0;
  private frame: number | null = null;
  private syncingSelection = false;
  private syncingScroll = false;
  private projectedSelection = '';
  private projectedNativeSelection = '';
  private sourceDirty = true;
  private pendingScroll = false;
  private weightKey = '';
  private selectionScroll = false;
  private pointerDown: { x: number; y: number } | null = null;
  private disposed = false;
  private selecting = false;

  constructor(
    private readonly term: Terminal,
    private readonly labels: () => { show: string; hide: string },
    private readonly transformCopy: (text: string) => string | null = (text) => text,
    private readonly setTouchSelecting: (value: boolean) => void = () => undefined,
  ) {
    if (!term.element?.querySelector('.xterm-rows'))
      throw new Error('Console IP masking requires the xterm.js DOM renderer');
    term.element.classList.add('console-natural-terminal');
    this.view.className = 'console-output';
    this.view.tabIndex = 0;
    this.view.setAttribute('role', 'log');
    this.view.setAttribute('aria-label', 'Console output');
    term.element.append(this.view);
    this.subscriptions.push(
      term.onWriteParsed(() => {
        this.sourceDirty = true;
        this.schedule();
      }),
      term.onRender(this.schedule),
      term.onResize(() => this.reset()),
      term.onSelectionChange(this.schedule),
      term.onScroll(this.fromTerminalScroll),
    );
    this.view.addEventListener('pointerdown', this.onPointerDown);
    document.addEventListener('pointerup', this.onPointerUp);
    this.view.addEventListener('click', this.onClick);
    this.view.addEventListener('mouseover', this.onHover);
    this.view.addEventListener('keydown', this.onKeyDown);
    this.view.addEventListener('scroll', this.onScroll);
    // Let native browser selection/scrolling act on the flowing text, not on
    // xterm's hidden fixed-cell renderer or the legacy touch-cell handler.
    for (const event of [
      'mousedown',
      'mousemove',
      'mouseup',
      'wheel',
      'touchstart',
      'touchmove',
      'touchend',
      'touchcancel',
    ]) {
      this.view.addEventListener(event, this.stopPropagation);
    }
    document.addEventListener('selectionchange', this.fromDOMSelection);
    document.addEventListener('copy', this.onCopy);
    window.addEventListener('pagehide', this.onPageHide);
    this.render();
  }

  private stopPropagation = (event: Event) => event.stopPropagation();

  private schedule = () => {
    if (this.disposed || this.frame !== null) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = null;
      this.render();
    });
  };

  reset() {
    for (const reveal of this.reveals) reveal.marker.dispose();
    this.reveals.length = 0;
    this.sourceDirty = true;
    this.render();
  }

  private cellStyle(cell: IBufferCell): { classes: string; style: string; invisible: boolean } {
    const classes: string[] = [];
    const styles: string[] = [];
    if (cell.isBold()) classes.push('xterm-bold');
    if (cell.isItalic()) classes.push('xterm-italic');
    const decorations = [
      cell.isUnderline() ? 'underline' : '',
      cell.isStrikethrough() ? 'line-through' : '',
      cell.isOverline() ? 'overline' : '',
    ].filter(Boolean);
    if (decorations.length) styles.push(`text-decoration-line:${decorations.join(' ')}`);
    styles.push(
      `font-weight:${cell.isBold() ? (this.term.options.fontWeightBold ?? 'bold') : (this.term.options.fontWeight ?? 'normal')}`,
    );
    if (cell.isDim()) styles.push('opacity:0.5');
    const inverse = !!cell.isInverse();
    for (const background of [false, true]) {
      const sourceBackground = inverse ? !background : background;
      const palette = sourceBackground ? cell.isBgPalette() : cell.isFgPalette();
      const rgb = sourceBackground ? cell.isBgRGB() : cell.isFgRGB();
      let color = sourceBackground ? cell.getBgColor() : cell.getFgColor();
      if (palette) {
        if (!background && cell.isBold() && color < 8 && this.term.options.drawBoldTextInBrightColors) color += 8;
        classes.push(`xterm-${background ? 'bg' : 'fg'}-${color}`);
      } else if (rgb)
        styles.push(`${background ? 'background-color' : 'color'}:#${color.toString(16).padStart(6, '0')}`);
      else if (inverse) classes.push(`xterm-${background ? 'bg' : 'fg'}-257`);
    }
    return { classes: classes.join(' '), style: styles.join(';'), invisible: !!cell.isInvisible() };
  }

  private snapshot(): FlowLine[] {
    const buffer = this.term.buffer.active;
    const result: FlowLine[] = [];
    let line: FlowLine | undefined;
    let lastUsed = buffer.baseY + buffer.cursorY;
    for (let row = buffer.length - 1; row > lastUsed; row--) {
      if (buffer.getLine(row)?.translateToString(true)) {
        lastUsed = row;
        break;
      }
    }
    const cell = buffer.getNullCell();
    for (let row = 0; row <= lastUsed; row++) {
      const source = buffer.getLine(row);
      if (!source) continue;
      if (!line || !source.isWrapped) {
        line = {
          row,
          endRow: row,
          text: '',
          positions: [],
          runs: [],
          segments: [],
          element: document.createElement('div'),
          key: '',
        };
        result.push(line);
      }
      line.endRow = row;
      let length = source.length;
      // Null padding from terminal allocation/resizing is not log text.
      while (length > 0 && source.getCell(length - 1, cell)?.getCode() === 0 && cell.isBgDefault()) length--;
      for (let col = 0; col < length; col++) {
        const item = source.getCell(col, cell);
        if (!item || item.getWidth() === 0) continue;
        const chars = item.getChars() || ' ';
        const start = line.text.length;
        const style = this.cellStyle(item);
        for (let i = 0; i < chars.length; i++) line.positions[start + i] = { row, col };
        line.text += chars;
        line.positions[line.text.length] = { row, col: col + item.getWidth() };
        const previous = line.runs[line.runs.length - 1];
        if (
          previous &&
          previous.classes === style.classes &&
          previous.style === style.style &&
          previous.invisible === style.invisible
        )
          previous.end = line.text.length;
        else line.runs.push({ start, end: line.text.length, ...style });
      }
      if (!line.positions.length) line.positions.push({ row, col: 0 });
    }
    return result;
  }

  private styledText(line: FlowLine, start: number, end: number, address = false): DocumentFragment {
    const fragment = document.createDocumentFragment();
    const urls = address ? [] : Array.from(line.text.matchAll(/https?:\/\/[^\s<>"']+/g));
    for (const run of line.runs) {
      const left = Math.max(start, run.start),
        right = Math.min(end, run.end);
      if (right <= left) continue;
      const text = (from: number, to: number) => {
        const span = document.createElement('span');
        span.className = run.classes;
        span.style.cssText = run.style;
        if (address) {
          span.style.color = 'inherit';
          span.className = span.className.replace(/xterm-fg-\d+/g, '');
        }
        span.textContent = run.invisible ? ' '.repeat(to - from) : line.text.slice(from, to);
        return span;
      };
      let offset = left;
      for (const url of urls) {
        const from = Math.max(offset, url.index),
          to = Math.min(right, url.index + url[0].length);
        if (to <= from) continue;
        if (from > offset) fragment.append(text(offset, from));
        const link = document.createElement('span');
        link.className = 'console-output-url';
        link.tabIndex = 0;
        link.setAttribute('role', 'link');
        // No href/title: hovering a URL must not disclose its masked IP.
        link.dataset.url = url[0];
        link.append(text(from, to));
        fragment.append(link);
        offset = to;
      }
      if (offset < right) fragment.append(text(offset, right));
    }
    return fragment;
  }

  private paint(line: FlowLine) {
    const fragment = document.createDocumentFragment();
    line.segments = [];
    let sourceOffset = 0,
      visibleOffset = 0;
    const addPlain = (end: number) => {
      if (end <= sourceOffset) return;
      fragment.append(this.styledText(line, sourceOffset, end));
      line.segments.push({
        start: visibleOffset,
        end: visibleOffset + end - sourceOffset,
        sourceStart: sourceOffset,
        sourceEnd: end,
      });
      visibleOffset += end - sourceOffset;
      sourceOffset = end;
    };
    for (const address of findConsoleAddresses(line.text)) {
      addPlain(address.start);
      const position = line.positions[address.start];
      const revealed = this.reveals.some(
        (r) =>
          !r.marker.isDisposed && r.marker.line === position.row && r.col === position.col && r.value === address.value,
      );
      const invisible = line.runs
        .filter((r) => r.start < address.end && r.end > address.start)
        .every((r) => r.invisible);
      const link = document.createElement('span');
      link.className = 'console-ip-address';
      link.style.fontWeight = 'inherit';
      link.title = revealed ? this.labels().hide : this.labels().show;
      if (invisible) link.append(this.styledText(line, address.start, address.end));
      else if (revealed) link.append(this.styledText(line, address.start, address.end, true));
      else {
        const firstRun = line.runs.find((r) => r.start <= address.start && r.end > address.start);
        if (firstRun) {
          link.className += ` ${firstRun.classes.replace(/xterm-fg-\d+/g, '')}`;
          link.style.cssText = firstRun.style;
          link.style.removeProperty('color');
          if (!link.style.textDecorationLine.includes('underline'))
            link.style.textDecorationLine = `${link.style.textDecorationLine} underline`.trim();
        }
        link.textContent = address.mask;
      }
      if (invisible) link.className = '';
      else this.addresses.set(link, { line, start: address.start, value: address.value });
      fragment.append(link);
      const visibleLength = link.textContent?.length ?? 0;
      line.segments.push({
        start: visibleOffset,
        end: visibleOffset + visibleLength,
        sourceStart: address.start,
        sourceEnd: address.end,
      });
      visibleOffset += visibleLength;
      sourceOffset = address.end;
    }
    addPlain(line.text.length);
    if (!line.text) fragment.append(document.createElement('br'));
    line.element.className = 'console-output-line';
    line.element.replaceChildren(fragment);
  }

  private render() {
    if (this.disposed) return;
    const atBottom = this.view.scrollHeight - this.view.scrollTop - this.view.clientHeight < 3;
    const nativeRows = this.term.element!.querySelector<HTMLElement>('.xterm-rows')!;
    this.view.style.fontFamily = this.term.options.fontFamily ?? 'monospace';
    this.view.style.fontSize = `${this.term.options.fontSize ?? 14}px`;
    this.view.style.lineHeight = `${this.term.options.lineHeight ?? 1}`;
    this.view.style.color = this.term.options.theme?.foreground ?? getComputedStyle(nativeRows).color;
    this.view.style.setProperty(
      '--console-selection-background',
      this.term.options.theme?.selectionBackground ?? '#80808080',
    );
    for (let i = this.reveals.length - 1; i >= 0; i--) if (this.reveals[i].marker.isDisposed) this.reveals.splice(i, 1);
    const weightKey = `${this.term.options.fontWeight}:${this.term.options.fontWeightBold}`;
    if (weightKey !== this.weightKey || this.anchor?.isDisposed) this.sourceDirty = true;
    this.weightKey = weightKey;
    if (!this.sourceDirty) {
      this.fromTerminalSelection();
      this.applyPendingScroll();
      return;
    }
    this.sourceDirty = false;
    const dropped = this.anchor && !this.anchor.isDisposed ? this.anchorRow - this.anchor.line : NaN;
    const previous = new Map(this.lines.map((line) => [line.row - dropped, line]));
    const next = this.snapshot();
    for (const line of next) {
      const revealKey = this.reveals
        .filter((r) => r.marker.line >= line.row && r.marker.line <= line.endRow)
        .map((r) => `${r.marker.line}:${r.col}:${r.value}`)
        .join('|');
      line.key = `${line.text}\0${line.runs.map((r) => `${r.start}:${r.end}:${r.classes}:${r.style}:${r.invisible}`).join('|')}\0${revealKey}`;
      const old = previous.get(line.row);
      if (old && old.key === line.key) {
        line.element = old.element;
        line.segments = old.segments;
        // Keep the line object referenced by selection/IP nodes current.
        Object.assign(old, line);
        const index = next.indexOf(line);
        next[index] = old;
      } else {
        this.paint(line);
      }
    }
    const desired = new Set(next.map((line) => line.element));
    for (const element of Array.from(this.view.children)) if (!desired.has(element as HTMLDivElement)) element.remove();
    let cursor: ChildNode | null = this.view.firstChild;
    for (const line of next) {
      if (cursor === line.element) cursor = cursor.nextSibling;
      else this.view.insertBefore(line.element, cursor);
    }
    this.lines = next;
    this.anchor?.dispose();
    const buffer = this.term.buffer.active;
    this.anchorRow = buffer.length - 1;
    this.anchor = this.term.registerMarker(this.anchorRow - buffer.baseY - buffer.cursorY);
    if (atBottom) this.view.scrollTop = this.view.scrollHeight;
    this.fromTerminalSelection();
    this.applyPendingScroll();
  }

  private positionKey(position: Position): number {
    return position.row * this.term.cols + position.col;
  }

  private sourceOffset(line: FlowLine, visible: number): number {
    const segment = line.segments.find((s) => visible <= s.end) ?? line.segments[line.segments.length - 1];
    if (!segment) return 0;
    if (visible <= segment.start) return segment.sourceStart;
    const fraction = (visible - segment.start) / Math.max(1, segment.end - segment.start);
    return segment.sourceStart + Math.round(fraction * (segment.sourceEnd - segment.sourceStart));
  }

  private endpoint(node: Node | null, offset: number): Position | undefined {
    if (!node || !this.view.contains(node)) return;
    if (node === this.view) {
      const line = this.lines[Math.min(offset, this.lines.length - 1)];
      return line?.positions[offset >= this.lines.length ? line.text.length : 0];
    }
    const element = node instanceof Element ? node : node.parentElement;
    const row = element?.closest('.console-output-line');
    const line = this.lines.find((l) => l.element === row);
    if (!line) return;
    const range = document.createRange();
    range.setStart(line.element, 0);
    range.setEnd(node, offset);
    return line.positions[this.sourceOffset(line, range.toString().length)];
  }

  private domKey(range: Range): string {
    const start = this.endpoint(range.startContainer, range.startOffset),
      end = this.endpoint(range.endContainer, range.endOffset);
    return start && end ? `${this.positionKey(start)}:${this.positionKey(end)}` : '';
  }

  private fromDOMSelection = () => {
    if (this.syncingSelection || this.selecting) return;
    const selection = document.getSelection();
    if (!selection?.rangeCount) return;
    const range = selection.getRangeAt(0);
    const start = this.endpoint(range.startContainer, range.startOffset),
      end = this.endpoint(range.endContainer, range.endOffset);
    if (!start || !end) return;
    if (this.projectedSelection && this.domKey(range) === this.projectedSelection) return;
    this.projectedSelection = '';
    const current = this.term.getSelectionPosition();
    if (
      current &&
      current.start.x === start.col &&
      current.start.y === start.row &&
      current.end.x === end.col &&
      current.end.y === end.row
    )
      return;
    this.syncingSelection = true;
    if (selection.isCollapsed) this.term.clearSelection();
    else this.term.select(start.col, start.row, this.positionKey(end) - this.positionKey(start));
    this.syncingSelection = false;
  };

  private domPoint(position: Position): { node: Node; offset: number } | undefined {
    const line = this.lines.find((l) => position.row >= l.row && position.row <= l.endRow);
    if (!line) return;
    const key = this.positionKey(position);
    let source = line.positions.findIndex((p) => this.positionKey(p) >= key);
    if (source < 0) source = line.text.length;
    const segment = line.segments.find((s) => source <= s.sourceEnd);
    let visible = segment
      ? segment.start +
        Math.round(
          ((source - segment.sourceStart) * (segment.end - segment.start)) /
            Math.max(1, segment.sourceEnd - segment.sourceStart),
        )
      : 0;
    const walker = document.createTreeWalker(line.element, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const length = node.textContent?.length ?? 0;
      if (visible <= length) return { node, offset: Math.max(0, visible) };
      visible -= length;
    }
    return { node: line.element, offset: line.element.childNodes.length };
  }

  private fromTerminalSelection = () => {
    if (this.syncingSelection || this.selecting) return;
    const selection = document.getSelection();
    const selected = this.term.getSelectionPosition();
    if (!selected) {
      if (selection?.anchorNode && this.view.contains(selection.anchorNode)) selection.removeAllRanges();
      this.projectedSelection = '';
      return;
    }
    const current = selection?.rangeCount ? this.domKey(selection.getRangeAt(0)) : '';
    const key = `${selected.start.y * this.term.cols + selected.start.x}:${selected.end.y * this.term.cols + selected.end.x}`;
    if (
      current === key ||
      (this.projectedSelection && current === this.projectedSelection && key === this.projectedNativeSelection)
    )
      return;
    const start = this.domPoint({ row: selected.start.y, col: selected.start.x }),
      end = this.domPoint({ row: selected.end.y, col: selected.end.x });
    if (!start || !end) return;
    const range = document.createRange();
    range.setStart(start.node, start.offset);
    range.setEnd(end.node, end.offset);
    this.syncingSelection = true;
    selection?.removeAllRanges();
    selection?.addRange(range);
    this.projectedSelection = this.domKey(range);
    this.projectedNativeSelection = key;
    this.selectionScroll = true;
    this.schedule();
    this.syncingSelection = false;
  };

  getSelectionRect(): DOMRect | undefined {
    const selection = document.getSelection();
    if (!selection?.rangeCount || !selection.anchorNode || !this.view.contains(selection.anchorNode)) return;
    const rects = selection.getRangeAt(0).getClientRects();
    return rects[rects.length - 1];
  }

  private onCopy = (event: ClipboardEvent) => {
    const selection = document.getSelection();
    if (!selection?.anchorNode || !this.view.contains(selection.anchorNode)) return;
    this.fromDOMSelection();
    if (!this.term.hasSelection() || !event.clipboardData) return;
    event.preventDefault();
    const text = this.transformCopy(this.term.getSelection());
    if (text !== null) event.clipboardData.setData('text/plain', text);
    setTimeout(() => this.term.clearSelection());
  };

  private onKeyDown = (event: KeyboardEvent) => {
    const url = event.target instanceof Element ? event.target.closest<HTMLElement>('.console-output-url') : null;
    if (event.key === 'Enter' && url?.dataset.url) {
      event.preventDefault();
      event.stopPropagation();
      window.open(url.dataset.url, '_blank', 'noopener');
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
      event.preventDefault();
      event.stopPropagation();
      const range = document.createRange();
      range.selectNodeContents(this.view);
      const selection = document.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      this.fromDOMSelection();
    } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c') {
      this.fromDOMSelection();
      if (!this.term.hasSelection()) return;
      // Keep the original selection ready for the browser's native copy event.
      event.stopPropagation();
    }
  };

  private onPointerUp = () => {
    this.selecting = false;
    this.fromDOMSelection();
  };

  private onPointerDown = (event: PointerEvent) => {
    this.selecting = true;
    this.pointerDown = { x: event.clientX, y: event.clientY };
    this.projectedSelection = '';
    this.setTouchSelecting(event.pointerType === 'touch');
  };

  private onHover = (event: MouseEvent) => {
    const element = event.target instanceof Element ? event.target.closest('.console-ip-address') : null;
    const item = element ? this.addresses.get(element) : undefined;
    if (!element || !item) return;
    const start = item.line.positions[item.start];
    const revealed = this.reveals.some(
      (r) => r.marker.line === start.row && r.col === start.col && r.value === item.value,
    );
    (element as HTMLElement).title = revealed ? this.labels().hide : this.labels().show;
  };

  private onClick = (event: MouseEvent) => {
    const down = this.pointerDown;
    this.pointerDown = null;
    if (
      !down ||
      event.button !== 0 ||
      Math.hypot(event.clientX - down.x, event.clientY - down.y) > 4 ||
      !document.getSelection()?.isCollapsed
    )
      return;
    this.fromDOMSelection();
    const element = event.target instanceof Element ? event.target.closest('.console-ip-address') : null;
    const item = element ? this.addresses.get(element) : undefined;
    if (!item) {
      const url = event.target instanceof Element ? event.target.closest<HTMLElement>('.console-output-url') : null;
      if (url?.dataset.url) {
        event.preventDefault();
        event.stopPropagation();
        window.open(url.dataset.url, '_blank', 'noopener');
      }
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const start = item.line.positions[item.start];
    const index = this.reveals.findIndex(
      (r) => r.marker.line === start.row && r.col === start.col && r.value === item.value,
    );
    if (index >= 0) this.reveals.splice(index, 1)[0].marker.dispose();
    else {
      const b = this.term.buffer.active,
        marker = this.term.registerMarker(start.row - b.baseY - b.cursorY);
      if (marker) this.reveals.push({ marker, col: start.col, value: item.value });
    }
    this.sourceDirty = true;
    this.render();
  };

  private onScroll = () => {
    if (this.syncingScroll) return;
    const bottom = this.view.scrollHeight - this.view.scrollTop - this.view.clientHeight < 3;
    const first = this.lines.find(
      (line) => line.element.getBoundingClientRect().bottom > this.view.getBoundingClientRect().top,
    );
    this.syncingScroll = true;
    if (bottom) this.term.scrollToBottom();
    else if (first) this.term.scrollLines(first.row - this.term.buffer.active.viewportY);
    this.syncingScroll = false;
  };

  private fromTerminalScroll = () => {
    if (this.syncingScroll) return;
    this.pendingScroll = true;
    this.schedule();
  };

  private applyPendingScroll() {
    if (this.selectionScroll) {
      this.selectionScroll = false;
      this.pendingScroll = false;
      const rect = this.getSelectionRect(),
        viewport = this.view.getBoundingClientRect();
      if (rect && rect.bottom > viewport.bottom) this.view.scrollTop += rect.bottom - viewport.bottom;
      else if (rect && rect.top < viewport.top) this.view.scrollTop += rect.top - viewport.top;
      return;
    }
    if (!this.pendingScroll) return;
    this.pendingScroll = false;
    this.syncingScroll = true;
    const buffer = this.term.buffer.active;
    if (buffer.viewportY === buffer.baseY) this.view.scrollTop = this.view.scrollHeight;
    else
      this.lines
        .find((line) => buffer.viewportY >= line.row && buffer.viewportY <= line.endRow)
        ?.element.scrollIntoView({ block: 'start' });
    this.syncingScroll = false;
  }

  private onPageHide = () => this.reset();

  dispose() {
    this.disposed = true;
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.anchor?.dispose();
    for (const reveal of this.reveals) reveal.marker.dispose();
    for (const subscription of this.subscriptions) subscription.dispose();
    document.removeEventListener('pointerup', this.onPointerUp);
    document.removeEventListener('selectionchange', this.fromDOMSelection);
    document.removeEventListener('copy', this.onCopy);
    window.removeEventListener('pagehide', this.onPageHide);
    this.view.remove();
    this.term.element?.classList.remove('console-natural-terminal');
  }
}
