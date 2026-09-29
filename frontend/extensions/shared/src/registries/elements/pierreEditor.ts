import { Registry } from 'shared';
import type { PierreDiffOnMount, PierreOnMount } from '@/elements/editors/PierreEditor.tsx';

export class PierreEditorRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.onMountHandlers.push(...other.onMountHandlers);
    this.diffOnMountHandlers.push(...other.diffOnMountHandlers);

    return this;
  }

  public onMountHandlers: PierreOnMount[] = [];
  public diffOnMountHandlers: PierreDiffOnMount[] = [];

  public addOnMountHandler(handler: PierreOnMount): this {
    this.onMountHandlers.push(handler);
    return this;
  }

  public addDiffOnMountHandler(handler: PierreDiffOnMount): this {
    this.diffOnMountHandlers.push(handler);
    return this;
  }
}
