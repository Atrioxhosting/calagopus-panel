import { CSSProperties, Fragment, ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import Select from '@/elements/input/Select.tsx';
import {
  acceptsFileTreeEditorDrop,
  clearActiveFileTreeEditorTabDrag,
  FILE_TREE_EDITOR_TAB_DRAG_TYPE,
  getActiveFileTreeEditorTabDrag,
} from '@/pages/server/files/tree/fileTreeEditor.ts';
import { FileTreeEditorPaneState, FileTreePaneDropTarget } from '@/pages/server/files/tree/fileTreeWorkspaceState.ts';
import { usePageBreakpoint } from '@/plugins/viewport/usePageBreakpoint.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';

interface FileTreeEditorSplitProps {
  panes: FileTreeEditorPaneState[];
  activePaneId: string;
  resizeLabel: string;
  onActivatePane: (paneId: string) => void;
  onDrop: (target: FileTreePaneDropTarget, dataTransfer: DataTransfer) => void;
  onResize: (leftPaneId: string, rightPaneId: string, leftSize: number, rightSize: number) => void;
  onEqualize: () => void;
  renderPane: (pane: FileTreeEditorPaneState, index: number) => ReactNode;
}

interface ResizeSession {
  leftPaneId: string;
  rightPaneId: string;
  leftElement: HTMLDivElement;
  rightElement: HTMLDivElement;
  startX: number;
  leftWidth: number;
  rightWidth: number;
  minimumWidth: number;
  combinedSize: number;
  nextLeftWidth: number;
  frame: number | null;
}

type DropZone = 'left' | 'right' | 'center';

const MINIMUM_PANE_WIDTH = 200;
const MINIMUM_SPLIT_PANE_WIDTH = 280;
const EDGE_ZONE_RATIO = 0.3;
const EDGE_ZONE_HYSTERESIS = 16;

const dropZoneInsets: Record<DropZone, CSSProperties> = {
  left: { left: '0.25rem', right: '50%' },
  right: { left: '50%', right: '0.25rem' },
  center: { left: '0.25rem', right: '0.25rem' },
};

const isOverTabStrip = (event: React.DragEvent) =>
  !!(event.target as Element).closest('[data-file-manager-editor-tabs]');

export default function FileTreeEditorSplit({
  panes,
  activePaneId,
  resizeLabel,
  onActivatePane,
  onDrop,
  onResize,
  onEqualize,
  renderPane,
}: FileTreeEditorSplitProps) {
  const { t } = useTranslations();
  const wide = usePageBreakpoint('md');
  const splitRef = useRef<HTMLDivElement>(null);
  const paneElements = useRef(new Map<string, HTMLDivElement>());
  const resizeSession = useRef<ResizeSession | null>(null);
  const [dropTarget, setDropTarget] = useState<{ paneId: string; zone: DropZone } | null>(null);
  const [resizing, setResizing] = useState(false);

  useEffect(() => {
    if (!resizing) return;

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [resizing]);

  useEffect(() => {
    const clear = () => setDropTarget(null);
    const endDrag = () => {
      clear();
      setTimeout(clearActiveFileTreeEditorTabDrag);
    };
    const clearOutsidePanes = (event: DragEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest('[data-file-manager-editor-pane]')) clear();
    };
    const clearOnWindowLeave = (event: DragEvent) => {
      if (!event.relatedTarget) clear();
    };

    window.addEventListener('dragover', clearOutsidePanes, true);
    window.addEventListener('dragleave', clearOnWindowLeave, true);
    window.addEventListener('dragend', endDrag, true);
    window.addEventListener('drop', endDrag, true);
    window.addEventListener('blur', clear);
    return () => {
      window.removeEventListener('dragover', clearOutsidePanes, true);
      window.removeEventListener('dragleave', clearOnWindowLeave, true);
      window.removeEventListener('dragend', endDrag, true);
      window.removeEventListener('drop', endDrag, true);
      window.removeEventListener('blur', clear);
    };
  }, []);

  const finishResize = useCallback(() => {
    const session = resizeSession.current;
    if (!session) return;

    if (session.frame !== null) cancelAnimationFrame(session.frame);
    const combinedWidth = session.leftWidth + session.rightWidth;
    const leftRatio = session.nextLeftWidth / combinedWidth;
    onResize(
      session.leftPaneId,
      session.rightPaneId,
      session.combinedSize * leftRatio,
      session.combinedSize * (1 - leftRatio),
    );
    session.leftElement.style.removeProperty('flex');
    session.leftElement.style.removeProperty('width');
    session.rightElement.style.removeProperty('flex');
    session.rightElement.style.removeProperty('width');
    resizeSession.current = null;
    setResizing(false);
  }, [onResize]);

  useEffect(() => finishResize, [finishResize]);

  const resize = (event: React.PointerEvent) => {
    const session = resizeSession.current;
    if (!session) return;

    const combinedWidth = session.leftWidth + session.rightWidth;
    session.nextLeftWidth = Math.min(
      combinedWidth - session.minimumWidth,
      Math.max(session.minimumWidth, session.leftWidth + event.clientX - session.startX),
    );
    if (session.frame !== null) return;

    session.frame = requestAnimationFrame(() => {
      session.frame = null;
      const rightWidth = combinedWidth - session.nextLeftWidth;
      session.leftElement.style.flex = `0 0 ${session.nextLeftWidth}px`;
      session.leftElement.style.width = `${session.nextLeftWidth}px`;
      session.rightElement.style.flex = `0 0 ${rightWidth}px`;
      session.rightElement.style.width = `${rightWidth}px`;
    });
  };

  const startResize = (
    event: React.PointerEvent,
    leftPane: FileTreeEditorPaneState,
    rightPane: FileTreeEditorPaneState,
  ) => {
    const leftElement = paneElements.current.get(leftPane.id);
    const rightElement = paneElements.current.get(rightPane.id);
    if (!leftElement || !rightElement) return;

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const leftWidth = leftElement.getBoundingClientRect().width;
    const rightWidth = rightElement.getBoundingClientRect().width;

    resizeSession.current = {
      leftPaneId: leftPane.id,
      rightPaneId: rightPane.id,
      leftElement,
      rightElement,
      startX: event.clientX,
      leftWidth,
      rightWidth,
      minimumWidth: Math.min(MINIMUM_PANE_WIDTH, (leftWidth + rightWidth) / 2),
      combinedSize: leftPane.size + rightPane.size,
      nextLeftWidth: leftWidth,
      frame: null,
    };
    setResizing(true);
  };

  const resizeWithKeyboard = (
    event: React.KeyboardEvent,
    leftPane: FileTreeEditorPaneState,
    rightPane: FileTreeEditorPaneState,
  ) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home'].includes(event.key)) return;

    event.preventDefault();
    const combined = leftPane.size + rightPane.size;
    const step = combined * 0.05;
    const minimum = combined * 0.15;
    const leftSize =
      event.key === 'Home'
        ? combined / 2
        : Math.min(combined - minimum, Math.max(minimum, leftPane.size + (event.key === 'ArrowLeft' ? -step : step)));
    onResize(leftPane.id, rightPane.id, leftSize, combined - leftSize);
  };

  const getDropZone = (event: React.DragEvent<HTMLDivElement>, pane: FileTreeEditorPaneState): DropZone | null => {
    const tabDrag = event.dataTransfer.types.includes(FILE_TREE_EDITOR_TAB_DRAG_TYPE)
      ? getActiveFileTreeEditorTabDrag()
      : null;
    const fromThisPane = tabDrag?.paneId === pane.id;
    const sourcePane = tabDrag ? panes.find((candidate) => candidate.id === tabDrag.paneId) : undefined;
    const paneCountAfterSplit = panes.length + (sourcePane?.tabIds.length === 1 ? 0 : 1);
    const bounds = event.currentTarget.getBoundingClientRect();
    const canSplit =
      wide &&
      pane.tabIds.length > 0 &&
      (!fromThisPane || pane.tabIds.length > 1) &&
      (splitRef.current?.clientWidth ?? 0) / paneCountAfterSplit >= MINIMUM_SPLIT_PANE_WIDTH;

    if (canSplit) {
      const current = dropTarget?.paneId === pane.id ? dropTarget.zone : null;
      const edge = bounds.width * EDGE_ZONE_RATIO;
      const x = event.clientX - bounds.left;
      if (x < edge + (current === 'left' ? EDGE_ZONE_HYSTERESIS : 0)) return 'left';
      if (x > bounds.width - edge - (current === 'right' ? EDGE_ZONE_HYSTERESIS : 0)) return 'right';
    }

    return fromThisPane ? null : 'center';
  };

  const trackDrop = (event: React.DragEvent<HTMLDivElement>, pane: FileTreeEditorPaneState) => {
    if (!acceptsFileTreeEditorDrop(event.dataTransfer)) return;
    if (isOverTabStrip(event)) {
      setDropTarget(null);
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const zone = getDropZone(event, pane);
    event.dataTransfer.dropEffect = !zone
      ? 'none'
      : event.dataTransfer.types.includes(FILE_TREE_EDITOR_TAB_DRAG_TYPE)
        ? 'move'
        : 'copy';
    setDropTarget((current) =>
      !zone ? null : current?.paneId === pane.id && current.zone === zone ? current : { paneId: pane.id, zone },
    );
  };

  const drop = (event: React.DragEvent<HTMLDivElement>, pane: FileTreeEditorPaneState) => {
    if (!acceptsFileTreeEditorDrop(event.dataTransfer) || isOverTabStrip(event)) return;

    event.preventDefault();
    event.stopPropagation();
    const zone = getDropZone(event, pane);
    setDropTarget(null);
    if (!zone) return;

    onDrop(
      zone === 'center' ? { paneId: pane.id, position: null } : { paneId: pane.id, split: zone },
      event.dataTransfer,
    );
  };

  return (
    <div
      data-file-manager-editor-group
      className='flex h-(--file-manager-workspace-height) min-h-(--file-manager-workspace-min-height) min-w-0 flex-col'
    >
      {panes.length > 1 && (
        <Select
          className='mb-2 shrink-0 md:hidden'
          aria-label={t('pages.server.files.tree.selectPane', {})}
          value={activePaneId}
          allowDeselect={false}
          onChange={(paneId) => {
            if (paneId) onActivatePane(paneId);
          }}
          data={panes.map((pane, index) => ({
            value: pane.id,
            label: t('pages.server.files.tree.editorPane', { number: index + 1 }),
          }))}
        />
      )}
      <div
        ref={splitRef}
        data-file-manager-editor-split
        data-pane-count={panes.length}
        className='flex min-h-0 w-full min-w-0 flex-1 overflow-hidden'
      >
        {panes.map((pane, index) => {
          const nextPane = panes[index + 1];
          const zone = dropTarget?.paneId === pane.id ? dropTarget.zone : null;

          return (
            <Fragment key={pane.id}>
              <div
                ref={(element) => {
                  if (element) paneElements.current.set(pane.id, element);
                  else paneElements.current.delete(pane.id);
                }}
                data-file-manager-editor-pane
                data-active={pane.id === activePaneId || undefined}
                data-drop-zone={zone ?? undefined}
                className='relative flex h-full min-w-0 overflow-hidden'
                style={panes.length === 1 ? { flex: '1 0 100%', width: '100%' } : { flex: `${pane.size} 1 0` }}
                onPointerDownCapture={() => onActivatePane(pane.id)}
                onFocusCapture={() => onActivatePane(pane.id)}
                onDragEnterCapture={(event) => trackDrop(event, pane)}
                onDragOverCapture={(event) => trackDrop(event, pane)}
                onDropCapture={(event) => drop(event, pane)}
              >
                {renderPane(pane, index)}
                {zone && (
                  <div
                    data-file-manager-editor-drop-indicator
                    className='pointer-events-none absolute inset-y-1 z-50 rounded-md border-2 border-(--mantine-primary-color-filled) bg-(--mantine-primary-color-light) transition-[left,right] duration-150 ease-out motion-reduce:transition-none'
                    style={dropZoneInsets[zone]}
                  />
                )}
              </div>

              {nextPane && (
                <div
                  role='separator'
                  tabIndex={0}
                  aria-orientation='vertical'
                  aria-label={resizeLabel}
                  data-file-manager-editor-resize-handle
                  className='file-manager-editor-resize-handle relative w-3 shrink-0 cursor-col-resize focus-visible:outline-none'
                  onPointerDown={(event) => startResize(event, pane, nextPane)}
                  onPointerMove={resize}
                  onPointerUp={finishResize}
                  onPointerCancel={finishResize}
                  onDoubleClick={onEqualize}
                  onKeyDown={(event) => resizeWithKeyboard(event, pane, nextPane)}
                />
              )}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
