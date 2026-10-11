import { createContext, useContext } from 'react';
import { createStore, StoreApi } from 'zustand';

export interface FormDraftStore {
  baseUrl: string;
  drafts: Record<string, unknown>;
  dirty: Record<string, boolean>;

  setDraft: (key: string, values: unknown | null) => void;
  setDirty: (key: string, dirty: boolean) => void;
}

export const createFormDraftStore = (baseUrl: string) =>
  createStore<FormDraftStore>()((set) => ({
    baseUrl,
    drafts: {},
    dirty: {},

    setDraft: (key, values) =>
      set((state) => {
        if (values === null) {
          if (!(key in state.drafts)) return state;

          const { [key]: _, ...drafts } = state.drafts;
          return { drafts };
        }

        return { drafts: { ...state.drafts, [key]: values } };
      }),
    setDirty: (key, dirty) =>
      set((state) => ((state.dirty[key] ?? false) === dirty ? state : { dirty: { ...state.dirty, [key]: dirty } })),
  }));

export const isWithinFormDraftScope = (baseUrl: string, pathname: string) =>
  pathname === baseUrl || pathname.startsWith(`${baseUrl}/`);

export const FormDraftStoreContext = createContext<StoreApi<FormDraftStore> | null>(null);

export const useFormDraftStoreApi = () => useContext(FormDraftStoreContext);
