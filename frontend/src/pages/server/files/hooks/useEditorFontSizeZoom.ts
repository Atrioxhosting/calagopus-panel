import { stepFontSize, useFontSizeZoom } from '@/plugins/quick-actions/useFontSizeZoom.ts';
import { useFileManagerApi } from '@/providers/contexts/fileManagerContext.ts';
import { EDITOR_FONT_SIZE_DEFAULT, EDITOR_FONT_SIZE_MAX, EDITOR_FONT_SIZE_MIN } from '@/stores/fileManager.ts';

export default function useEditorFontSizeZoom() {
  const fileManagerApi = useFileManagerApi();

  return useFontSizeZoom(
    {
      increase: 'files.increaseEditorFontSize',
      decrease: 'files.decreaseEditorFontSize',
      reset: 'files.resetEditorFontSize',
    },
    (step) => {
      const { editorFontSize, setEditorFontSize } = fileManagerApi.getState();
      const size = stepFontSize(
        editorFontSize,
        step,
        EDITOR_FONT_SIZE_MIN,
        EDITOR_FONT_SIZE_MAX,
        EDITOR_FONT_SIZE_DEFAULT,
      );
      if (size !== editorFontSize) setEditorFontSize(size);
    },
  );
}
