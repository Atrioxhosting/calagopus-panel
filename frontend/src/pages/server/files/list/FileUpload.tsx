import { useShallow } from 'zustand/react/shallow';
import UploadDropOverlay from '@/elements/UploadDropOverlay.tsx';
import { bandwidthUploadError, isBandwidthBlocked } from '@/lib/files/bandwidthUpload.ts';
import { useFileDragAndDrop } from '@/pages/server/files/hooks/useFileDragAndDrop.ts';
import { useServerCan } from '@/plugins/usePermissions.ts';
import { useFileManager } from '@/providers/contexts/fileManagerContext.ts';
import { useToast } from '@/providers/ToastProvider.tsx';
import { useTranslations } from '@/providers/TranslationProvider.tsx';
import { useServerStore } from '@/stores/server.ts';

export default function FileUpload({ showOverlay = true }: { showOverlay?: boolean }) {
  const { t } = useTranslations();
  const { addToast } = useToast();
  const bandwidthBlocked = useServerStore((state) => isBandwidthBlocked(state.stats?.bandwidth.state));
  const { uploadFiles, handleFileSelect, handleFolderSelect, browsingWritableDirectory, fileInputRef, folderInputRef } =
    useFileManager(
      useShallow((state) => ({
        uploadFiles: state.fileUploader.uploadFiles,
        handleFileSelect: state.fileUploader.handleFileSelect,
        handleFolderSelect: state.fileUploader.handleFolderSelect,
        browsingWritableDirectory: state.browsingWritableDirectory,
        fileInputRef: state.fileInputRef,
        folderInputRef: state.folderInputRef,
      })),
    );

  const canCreate = useServerCan('files.create');

  const blockUpload = () => {
    if (!bandwidthBlocked) return false;
    addToast(bandwidthUploadError, 'error');
    return true;
  };

  const { isDragging } = useFileDragAndDrop({
    onDrop: (files) => (blockUpload() ? Promise.resolve() : uploadFiles(files)),
    enabled: browsingWritableDirectory && canCreate,
  });

  return (
    <>
      <input
        ref={fileInputRef}
        type='file'
        multiple
        style={{ display: 'none' }}
        onClick={(e) => {
          if (blockUpload()) e.preventDefault();
        }}
        onChange={(e) => {
          if (blockUpload()) {
            e.currentTarget.value = '';
          } else {
            handleFileSelect(e, fileInputRef);
          }
        }}
      />
      <input
        ref={folderInputRef}
        type='file'
        multiple
        style={{ display: 'none' }}
        onClick={(e) => {
          if (blockUpload()) e.preventDefault();
        }}
        onChange={(e) => {
          if (blockUpload()) {
            e.currentTarget.value = '';
          } else {
            handleFolderSelect(e, folderInputRef);
          }
        }}
        {...{ webkitdirectory: '', directory: '' }}
      />

      <UploadDropOverlay
        visible={showOverlay && isDragging && browsingWritableDirectory && canCreate}
        title={t('pages.server.files.dropzone.title', {})}
        subtitle={t('pages.server.files.dropzone.subtitle', {})}
      />
    </>
  );
}
