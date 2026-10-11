import { UseFormReturnType } from '@mantine/form';
import isEqual from 'fast-deep-equal';
import { useEffect } from 'react';
import { useBlocker } from '@/plugins/useBlocker.ts';
import { isWithinFormDraftScope, useFormDraftStoreApi } from '@/stores/formDrafts.ts';

/**
 * Mantine's own `isDirty()` trusts per-field flags once any field was edited, which misses
 * differences introduced by `setValues` (e.g. a restored draft). Compare against the snapshot instead.
 */
export const isFormDirty = <T>(form: UseFormReturnType<T>) => !isEqual(form.getValues(), form.getInitialValues());

/**
 * Keeps unsaved edits of a form alive across unmounts within the nearest `FormDraftScope`, and reports
 * whether the form is dirty so the scope can warn before leaving. Does nothing outside of a scope. Call it
 * after `useHydrateForm` so the draft is restored on top of the hydrated values.
 *
 * Re-renders keep the dirty flag in sync; uncontrolled forms must also call the returned `sync` from
 * `onValuesChange`, since typing doesn't re-render them.
 */
export function useFormDraft<T>(form: UseFormReturnType<T>, key: string) {
  const store = useFormDraftStoreApi();

  const sync = () => store?.getState().setDirty(key, isFormDirty(form));

  useEffect(() => {
    if (!store) return;

    const draft = store.getState().drafts[key];
    if (draft) {
      store.getState().setDraft(key, null);
      form.setValues(draft as Partial<T>);
    }

    return () => {
      store.getState().setDraft(key, isFormDirty(form) ? form.getValues() : null);
      store.getState().setDirty(key, false);
    };
  }, [store]);

  useEffect(() => {
    sync();
  });

  return sync;
}

/**
 * Guards unsaved state that can't be kept as a draft (e.g. editor content outside of a form). Outside of a
 * `FormDraftScope` the returned blocker catches every navigation. Inside one it only catches navigation
 * within the scope, and reports `dirty` so the scope's own warning covers leaving it.
 */
export function useUnsavedChanges(key: string, dirty: boolean) {
  const store = useFormDraftStoreApi();

  useEffect(() => {
    store?.getState().setDirty(key, dirty);
  }, [store, dirty]);

  useEffect(() => () => store?.getState().setDirty(key, false), [store]);

  return useBlocker(
    dirty,
    false,
    (transition) => !store || isWithinFormDraftScope(store.getState().baseUrl, transition.location.pathname),
  );
}
