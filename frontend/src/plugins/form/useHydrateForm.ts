import { UseFormReturnType } from '@mantine/form';
import { useEffect, useRef } from 'react';
import { isFormDirty } from '@/plugins/form/useFormDraft.ts';

const NOT_HYDRATED = Symbol('not-hydrated');

interface UseHydrateFormOptions<C> {
  /**
   * Derives the identity of `context`. The form is re-hydrated only when this value changes, so a
   * parent that re-fetches and hands back a new object for the same entity won't stomp edits in
   * progress. Defaults to the `context` reference itself.
   */
  key?: (context: C) => unknown;
}

/**
 * Hydrates a form from an existing resource whenever that resource (identified by {@link
 * UseHydrateFormOptions.key}) changes. Replaces the
 * `useEffect(() => { if (context) form.setValues(toFormValues(context)); }, [context])` block that
 * every admin create/update page was repeating by hand.
 *
 * While the form has unsaved edits, hydration is deferred until the next context change after it is
 * clean again, so a background refetch (e.g. on window focus) can't overwrite them.
 */
export function useHydrateForm<T extends Record<string, unknown>, C>(
  form: UseFormReturnType<T>,
  context: C | undefined | null,
  toFormValues: (context: C) => Partial<T>,
  options?: UseHydrateFormOptions<C>,
) {
  const hydratedKeyRef = useRef<unknown>(NOT_HYDRATED);

  useEffect(() => {
    if (!context) {
      hydratedKeyRef.current = NOT_HYDRATED;
      return;
    }

    const key = options?.key ? options.key(context) : context;
    if (Object.is(key, hydratedKeyRef.current) || isFormDirty(form)) {
      return;
    }

    hydratedKeyRef.current = key;

    const values = toFormValues(context);

    form.resetDirty({ ...form.getValues(), ...values });
    form.setValues(values);
  }, [context]);
}
