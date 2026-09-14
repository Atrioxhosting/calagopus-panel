import {
  faAnglesUp,
  faClone,
  faCopy,
  faEnvelopesBulk,
  faFileArrowDown,
  faFilePen,
  faFileShield,
  faFileZipper,
  faFingerprint,
  faInfoCircle,
  faLink,
  faListDots,
  faPause,
  faPlay,
  faTrash,
  faWindowRestore,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { join } from 'pathe';
import { createSearchParams, MemoryRouter } from 'react-router';
import { FileOpenMode } from 'shared/src/registries/pages/server/files';
import { z } from 'zod';
import downloadFiles from '@/api/server/files/downloadFiles.ts';
import ContextMenu, { ContextMenuItem } from '@/elements/overlays/ContextMenu.tsx';
import { isArchiveType } from '@/lib/files/files.ts';
import {
  cancelFileUpload,
  canResumeInSession,
  pauseUpload,
  resumeDetachedUpload,
  resumeUpload,
} from '@/lib/files/uploadManager.ts';
import { streamingArchiveFormat } from '@/lib/schemas/generic.ts';
import { serverDirectoryEntrySchema } from '@/lib/schemas/server/files.ts';
import { FileUploadState } from '@/pages/server/files/hooks/useFileUpload.ts';
import { buildDownloadAsMenuItems, downloadFilesWithToast } from '@/pages/server/files/list/downloadFilesWithToast.ts';
import { useServerCan } from '@/plugins/usePermissions.ts';
import { useToast } from '@/providers/contexts/toastContext.ts';
import { useWindows } from '@/providers/contexts/windowContext.ts';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import RouterRoutes from '@/RouterRoutes.tsx';
import { useFileManagerApi, useFileManagerStore } from '@/stores/fileManager.ts';
import { useServerStore } from '@/stores/server.ts';

const finePointer = matchMedia('(pointer: fine)');

function pickFileToResume(key: string): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.addEventListener(
    'change',
    () => {
      const file = input.files?.[0];
      if (file) resumeDetachedUpload(key, file);
    },
    { once: true },
  );
  input.click();
}

interface FileRowContextMenuProps {
  file: z.infer<typeof serverDirectoryEntrySchema>;
  openMode: FileOpenMode;
  directory?: string;
  writableDirectory?: boolean;
  upload?: FileUploadState;
  surface?: 'table' | 'tree';
  children: (props: { items: ContextMenuItem[]; openMenu: (x: number, y: number) => void }) => React.ReactNode;
}

export default function FileRowContextMenu({
  file,
  openMode,
  directory,
  writableDirectory,
  upload,
  surface = 'table',
  children,
}: FileRowContextMenuProps) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const { addWindow } = useWindows();
  const server = useServerStore((state) => state.server);
  const store = useFileManagerApi();
  const browsingDirectory = useFileManagerStore((state) => state.browsingDirectory);
  const browsingWritableDirectory = useFileManagerStore((state) => state.browsingWritableDirectory);
  const canReadContent = useServerCan('files.read-content');
  const canCreate = useServerCan('files.create');
  const canUpdate = useServerCan('files.update');
  const canArchive = useServerCan('files.archive');
  const canDelete = useServerCan('files.delete');
  const activeDirectory = directory ?? browsingDirectory;
  const activeWritableDirectory = writableDirectory ?? browsingWritableDirectory;
  const local = upload?.local ?? null;

  const prepareFileManager = () => {
    store.getState().setBrowsingContext({ directory: activeDirectory, writable: activeWritableDirectory });
  };

  const openModal = (modal: Parameters<ReturnType<typeof store.getState>['doOpenModal']>[0]) => {
    prepareFileManager();
    store.getState().doOpenModal(modal, [file]);
  };

  const doDownload = (archiveFormat: z.infer<typeof streamingArchiveFormat>) => {
    prepareFileManager();
    downloadFilesWithToast(downloadFiles(server.uuid, activeDirectory, [file.name], file.directory, archiveFormat), {
      addToast,
      t,
    });
  };

  return (
    <ContextMenu
      items={[
        {
          type: 'action',
          icon: faPause,
          label: t('elements.fileUpload.pause', {}),
          hidden: !local || !local.resumable || local.status !== 'uploading',
          onClick: () => local && pauseUpload(local.key),
          color: 'gray',
          canAccess: canCreate,
        },
        {
          type: 'action',
          icon: faPlay,
          label: t('elements.fileUpload.resume', {}),
          hidden: !local || local.status !== 'paused' || !canResumeInSession(local.key),
          onClick: () => local && resumeUpload(local.key),
          color: 'gray',
          canAccess: canCreate,
        },
        {
          type: 'action',
          icon: faPlay,
          label: t('elements.fileUpload.reselect', {}),
          hidden: !local || local.status !== 'paused' || canResumeInSession(local.key),
          onClick: () => local && pickFileToResume(local.key),
          color: 'gray',
          canAccess: canCreate,
        },
        {
          type: 'action',
          icon: faXmark,
          label: t('elements.fileUpload.cancel', {}),
          hidden: !local,
          onClick: () => local && cancelFileUpload(local.key),
          color: 'red',
          canAccess: canCreate,
        },
        {
          type: 'divider',
          hidden: !local,
        },
        {
          type: 'action',
          icon: faWindowRestore,
          label: t('pages.server.files.button.openInNewWindow', {}),
          hidden: !finePointer.matches || !openMode.openable || !!upload,
          onClick: () => {
            if (!openMode.openable) return;

            prepareFileManager();
            const fileManagerContext = {
              ...store.getState(),
              browsingDirectory: activeDirectory,
              browsingWritableDirectory: activeWritableDirectory,
            };

            let url = new URL(window.location.href);
            openMode.handleOpen({
              fileManagerContext,
              server,
              setSearchParams(params) {
                url.search = createSearchParams(
                  typeof params === 'function' ? params(new URLSearchParams(url.search)) : params,
                ).toString();
              },
              navigate(path) {
                if (typeof path !== 'string') return;

                url = new URL(path, url);
              },
              handleDirectoryOpen(path) {
                url.search = createSearchParams({
                  directory: join(fileManagerContext.browsingDirectory, path),
                }).toString();
              },
              handleFileOpen(file, action, params) {
                const searchParams = createSearchParams({
                  directory: activeDirectory,
                  file,
                  ...params,
                });

                url = new URL(`/server/${server.uuidShort}/files/${action}?${searchParams}`, window.location.origin);
              },
            });

            addWindow(
              file.name,
              <MemoryRouter initialEntries={[url.pathname + url.search]}>
                <RouterRoutes isNormal={false} />
              </MemoryRouter>,
            );
          },
          canAccess: canReadContent,
        },
        {
          type: 'action',
          icon: faFilePen,
          label: t('pages.server.files.button.rename', {}),
          hidden: !activeWritableDirectory || !!upload,
          onClick: () => openModal('rename'),
          canAccess: canUpdate,
        },
        {
          type: 'action',
          icon: faCopy,
          label: t('pages.server.files.button.copy', {}),
          hidden: (!file.file && !file.directory) || !!upload,
          onClick: () => openModal('copy'),
          color: 'gray',
          canAccess: canCreate,
        },
        {
          type: 'action',
          icon: faLink,
          label: t('pages.server.files.button.symlink', {}),
          hidden: !activeWritableDirectory || !!upload,
          onClick: () => openModal('nameSymlink'),
          color: 'gray',
          canAccess: canCreate,
        },
        {
          type: 'action',
          icon: faClone,
          label: t('pages.server.files.button.remoteCopy', {}),
          hidden: (!file.file && !file.directory) || !!upload,
          onClick: () => openModal('copy-remote'),
          color: 'gray',
          canAccess: canReadContent,
        },
        {
          type: 'action',
          icon: faAnglesUp,
          label: t('common.button.move', {}),
          hidden: !activeWritableDirectory || !!upload,
          onClick: () => {
            prepareFileManager();
            store.getState().doActFiles('move', [file]);
          },
          color: 'gray',
          canAccess: canUpdate,
        },
        isArchiveType(file)
          ? {
              type: 'action',
              icon: faEnvelopesBulk,
              label: t('pages.server.files.button.extract', {}),
              hidden: !activeWritableDirectory || !!upload,
              onClick: () => openModal('extract'),
              color: 'gray',
              canAccess: canArchive,
            }
          : {
              type: 'action',
              icon: faFileZipper,
              label: t('pages.server.files.button.archive', {}),
              hidden: !activeWritableDirectory || !!upload,
              onClick: () => openModal('archive'),
              color: 'gray',
              canAccess: canArchive,
            },
        {
          type: 'divider',
          hidden: !!upload,
        },
        {
          type: 'action',
          icon: faFileArrowDown,
          label: t('common.button.download', {}),
          hidden: !!upload,
          onClick: file.file ? () => doDownload('tar_gz') : undefined,
          color: 'gray',
          items: file.directory ? buildDownloadAsMenuItems(t, doDownload) : [],
          canAccess: canReadContent,
        },
        {
          type: 'action',
          icon: faListDots,
          label: t('pages.server.files.button.more', {}),
          color: 'gray',
          items: [
            {
              type: 'action',
              icon: faInfoCircle,
              label: t('common.button.details', {}),
              onClick: () => openModal('details'),
              color: 'gray',
            },
            {
              type: 'action',
              icon: faFingerprint,
              label: t('pages.server.files.button.fingerprint', {}),
              hidden: !file.file || !!upload,
              onClick: () => openModal('fingerprint'),
              color: 'gray',
              canAccess: canReadContent,
            },
            {
              type: 'action',
              icon: faFileShield,
              label: t('pages.server.files.button.permissions', {}),
              hidden: !!upload,
              onClick: () => openModal('permissions'),
              color: 'gray',
              canAccess: canUpdate,
            },
          ],
        },
        {
          type: 'action',
          icon: faTrash,
          label: t('common.button.delete', {}),
          hidden: !activeWritableDirectory || !!local,
          onClick: () => openModal('delete'),
          color: 'red',
          canAccess: canDelete,
        },
      ]}
      registry={window.extensionContext.extensionRegistry.pages.server.files.fileContextMenu}
      registryProps={{ file, directory: activeDirectory, surface }}
    >
      {children}
    </ContextMenu>
  );
}
