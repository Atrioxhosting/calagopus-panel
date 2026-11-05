import { basename, dirname, join } from 'pathe';
import { z } from 'zod';
import { FileRename, renameFilePath } from '@/lib/files/fileRenames.ts';
import { serverDirectoryEntrySchema } from '@/lib/schemas/server/files.ts';
import { FileTreeEditorSelection, FileTreeTabPosition, getFileTreeEditorTabId } from './fileTreeEditor.ts';

export interface FileTreeEditorPaneState {
  id: string;
  tabIds: string[];
  activeTabId: string | null;
  previewTabId?: string;
  size: number;
}

export interface FileTreeEditorWorkspaceState {
  tabs: FileTreeEditorSelection[];
  panes: FileTreeEditorPaneState[];
  activePaneId: string;
}

const selectionSchema = z.object({
  directory: z.string(),
  file: serverDirectoryEntrySchema,
  action: z.string(),
  params: z.record(z.string(), z.string()),
  primary: z.boolean().default(true),
  writable: z.boolean(),
});

const paneSchema = z.object({
  id: z.string(),
  tabIds: z.array(z.string()),
  activeTabId: z.string().nullable(),
  previewTabId: z.string().optional(),
  size: z.number().positive().default(1),
});

const workspaceSchema = z.object({
  version: z.literal(2),
  tabs: z.array(selectionSchema),
  panes: z.array(paneSchema),
  activePaneId: z.string(),
});

let paneSequence = 0;

export const createFileTreePaneId = () => {
  paneSequence += 1;
  return `pane-${Date.now().toString(36)}-${paneSequence.toString(36)}`;
};

export const createEmptyFileTreeWorkspace = (): FileTreeEditorWorkspaceState => {
  const paneId = createFileTreePaneId();
  return { tabs: [], panes: [{ id: paneId, tabIds: [], activeTabId: null, size: 1 }], activePaneId: paneId };
};

export const normalizeFileTreeWorkspace = (input: FileTreeEditorWorkspaceState): FileTreeEditorWorkspaceState => {
  const tabs = Array.from(new Map(input.tabs.map((tab) => [getFileTreeEditorTabId(tab), tab])).values());
  const validTabIds = new Set(tabs.map(getFileTreeEditorTabId));
  const assigned = new Set<string>();
  const panes = input.panes.flatMap((pane): FileTreeEditorPaneState[] => {
    const tabIds = pane.tabIds.filter((tabId) => {
      if (!validTabIds.has(tabId) || assigned.has(tabId)) return false;
      assigned.add(tabId);
      return true;
    });
    if (tabIds.length === 0 && tabs.length > 0) return [];

    return [
      {
        ...pane,
        tabIds,
        previewTabId: pane.previewTabId && tabIds.includes(pane.previewTabId) ? pane.previewTabId : undefined,
        activeTabId: pane.activeTabId && tabIds.includes(pane.activeTabId) ? pane.activeTabId : (tabIds[0] ?? null),
        size: Number.isFinite(pane.size) && pane.size > 0 ? pane.size : 1,
      },
    ];
  });

  const fallbackPane = panes[0] ?? {
    id: createFileTreePaneId(),
    tabIds: [],
    activeTabId: null,
    size: 1,
  };
  if (panes.length === 0) panes.push(fallbackPane);

  const unassigned = tabs.map(getFileTreeEditorTabId).filter((tabId) => !assigned.has(tabId));
  if (unassigned.length > 0) {
    panes[0] = {
      ...panes[0],
      tabIds: [...panes[0].tabIds, ...unassigned],
      activeTabId: panes[0].activeTabId ?? unassigned[0],
    };
  }

  const sizeScale = panes.length / panes.reduce((total, pane) => total + pane.size, 0);

  return {
    tabs,
    panes: sizeScale === 1 ? panes : panes.map((pane) => ({ ...pane, size: pane.size * sizeScale })),
    activePaneId: panes.some((pane) => pane.id === input.activePaneId) ? input.activePaneId : panes[0].id,
  };
};

const removePaneTabs = (pane: FileTreeEditorPaneState, tabIds: ReadonlySet<string>): FileTreeEditorPaneState => {
  const remaining = pane.tabIds.filter((id) => !tabIds.has(id));
  if (remaining.length === pane.tabIds.length) return pane;
  const activeIndex = pane.tabIds.indexOf(pane.activeTabId ?? '');
  return {
    ...pane,
    tabIds: remaining,
    previewTabId: pane.previewTabId && !tabIds.has(pane.previewTabId) ? pane.previewTabId : undefined,
    activeTabId:
      pane.activeTabId && !tabIds.has(pane.activeTabId)
        ? pane.activeTabId
        : (pane.tabIds.slice(activeIndex + 1).find((id) => !tabIds.has(id)) ?? remaining.at(-1) ?? null),
  };
};

export type FileTreePaneDropTarget =
  | { paneId: string; split: 'left' | 'right' }
  | { paneId: string; position: FileTreeTabPosition | null };

export const placeFileTreeTabs = (
  workspace: FileTreeEditorWorkspaceState,
  selections: FileTreeEditorSelection[],
  target: FileTreePaneDropTarget,
): FileTreeEditorWorkspaceState => {
  const tabIds = Array.from(new Set(selections.map(getFileTreeEditorTabId)));
  const targetPane = workspace.panes.find((pane) => pane.id === target.paneId);
  if (!targetPane || tabIds.length === 0) return workspace;
  const moving = new Set(tabIds);
  if ('position' in target && target.position && moving.has(target.position.tabId)) return workspace;

  const tabs = [...workspace.tabs];
  for (const selection of selections) {
    const index = tabs.findIndex((tab) => getFileTreeEditorTabId(tab) === getFileTreeEditorTabId(selection));
    if (index === -1) tabs.push(selection);
    else tabs[index] = selection;
  }

  const panes = workspace.panes.map((pane) => removePaneTabs(pane, moving));
  const targetIndex = panes.findIndex((pane) => pane.id === target.paneId);
  const remainingTarget = panes[targetIndex];

  if ('split' in target && remainingTarget.tabIds.length > 0) {
    const paneId = createFileTreePaneId();
    panes.splice(target.split === 'left' ? targetIndex : targetIndex + 1, 0, {
      id: paneId,
      tabIds,
      activeTabId: tabIds[0],
      size: 1,
    });
    return normalizeFileTreeWorkspace({
      tabs,
      panes: panes.map((pane) => ({ ...pane, size: 1 })),
      activePaneId: paneId,
    });
  }

  const position = 'position' in target ? target.position : null;
  const insertIndex =
    position && remainingTarget.tabIds.includes(position.tabId)
      ? remainingTarget.tabIds.indexOf(position.tabId) + Number(position.after)
      : remainingTarget.tabIds.length;
  panes[targetIndex] = {
    ...remainingTarget,
    tabIds: remainingTarget.tabIds.toSpliced(insertIndex, 0, ...tabIds),
    activeTabId: tabIds[0],
  };
  return normalizeFileTreeWorkspace({ tabs, panes, activePaneId: target.paneId });
};

export const closeFileTreeWorkspaceTabs = (
  workspace: FileTreeEditorWorkspaceState,
  tabIds: ReadonlySet<string>,
): FileTreeEditorWorkspaceState => {
  if (!workspace.tabs.some((tab) => tabIds.has(getFileTreeEditorTabId(tab)))) return workspace;
  const panes = workspace.panes.map((pane) => removePaneTabs(pane, tabIds));
  const activeIndex = workspace.panes.findIndex((pane) => pane.id === workspace.activePaneId);
  const remainingPanes = panes.filter((pane) => pane.tabIds.length > 0);
  const activePane =
    panes.find((pane) => pane.id === workspace.activePaneId && pane.tabIds.length > 0) ??
    panes.slice(activeIndex + 1).find((pane) => pane.tabIds.length > 0) ??
    remainingPanes.at(-1) ??
    panes[activeIndex];
  return normalizeFileTreeWorkspace({
    tabs: workspace.tabs.filter((tab) => !tabIds.has(getFileTreeEditorTabId(tab))),
    panes: remainingPanes.length > 0 ? remainingPanes : [activePane],
    activePaneId: activePane.id,
  });
};

const storageKey = (serverUuid: string) => `file_tree_editor_workspace:${serverUuid}`;

export const restoreFileTreeWorkspace = (serverUuid: string): FileTreeEditorWorkspaceState => {
  try {
    const stored = localStorage.getItem(storageKey(serverUuid));
    if (!stored) return createEmptyFileTreeWorkspace();
    const raw: unknown = JSON.parse(stored);
    const parsed = workspaceSchema.safeParse(raw);
    return parsed.success ? normalizeFileTreeWorkspace(parsed.data) : createEmptyFileTreeWorkspace();
  } catch {
    return createEmptyFileTreeWorkspace();
  }
};

export const storeFileTreeWorkspace = (serverUuid: string, workspace: FileTreeEditorWorkspaceState) => {
  try {
    localStorage.setItem(storageKey(serverUuid), JSON.stringify({ version: 2, ...workspace }));
  } catch {
    // A private or full browser store should not stop files from opening.
  }
};

export const renameFileTreeWorkspace = (workspace: FileTreeEditorWorkspaceState, files: FileRename[]) => {
  const ids = new Map<string, string>();
  const tabs = workspace.tabs.map((tab) => {
    const path = join(tab.directory, tab.file.name);
    const renamed = renameFilePath(path, files);
    if (renamed === path) return tab;
    const next = { ...tab, directory: dirname(renamed), file: { ...tab.file, name: basename(renamed) } };
    ids.set(getFileTreeEditorTabId(tab), getFileTreeEditorTabId(next));
    return next;
  });
  const remapId = (id: string) => ids.get(id) ?? id;
  return {
    ids,
    workspace: normalizeFileTreeWorkspace({
      ...workspace,
      tabs,
      panes: workspace.panes.map((pane) => ({
        ...pane,
        tabIds: pane.tabIds.map(remapId),
        previewTabId: pane.previewTabId ? remapId(pane.previewTabId) : undefined,
        activeTabId: pane.activeTabId ? remapId(pane.activeTabId) : null,
      })),
    }),
  };
};
