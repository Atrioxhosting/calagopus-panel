import { lazy } from 'react';
import type { PierreDiffEditorProps, PierreEditorProps } from '@/elements/editors/PierreEditorImpl.tsx';
import Spinner from '@/elements/feedback/Spinner.tsx';

export type {
  PierreCaret,
  PierreCaretMetadata,
  PierreDiffEditorProps,
  PierreDiffOnMount,
  PierreEditorHandle,
  PierreEditorProps,
  PierreFileChangeEvent,
  PierreFileEditor,
  PierreLocalSelection,
  PierreOnMount,
} from '@/elements/editors/PierreEditorImpl.tsx';

const LazyPierreEditor = lazy(() => import('@/elements/editors/PierreEditorImpl.tsx'));
const LazyPierreDiffEditor = lazy(() =>
  import('@/elements/editors/PierreEditorImpl.tsx').then((module) => ({ default: module.PierreDiffEditor })),
);

export function PierreEditor(props: PierreEditorProps) {
  return (
    <Spinner.Suspense className='w-full h-full'>
      <LazyPierreEditor {...props} />
    </Spinner.Suspense>
  );
}

export function PierreDiffEditor(props: PierreDiffEditorProps) {
  return (
    <Spinner.Suspense className='w-full h-full'>
      <LazyPierreDiffEditor {...props} />
    </Spinner.Suspense>
  );
}

export default PierreEditor;
