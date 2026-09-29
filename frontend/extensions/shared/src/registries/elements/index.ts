import { Registry } from 'shared';
import { ComponentListRegistry } from 'shared/src/registries/slices/componentList.ts';
import { MonacoEditorRegistry } from './monacoEditor.ts';
import { PierreEditorRegistry } from './pierreEditor.ts';

export class ElementsRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.monacoEditor.mergeFrom(other.monacoEditor);
    this.pierreEditor.mergeFrom(other.pierreEditor);
    this.copyright.mergeFrom(other.copyright);

    return this;
  }

  public monacoEditor: MonacoEditorRegistry = new MonacoEditorRegistry();
  public pierreEditor: PierreEditorRegistry = new PierreEditorRegistry();
  public copyright: ComponentListRegistry<{}> = new ComponentListRegistry();

  public enterMonacoEditor(callback: (registry: MonacoEditorRegistry) => unknown): this {
    callback(this.monacoEditor);
    return this;
  }

  public enterPierreEditor(callback: (registry: PierreEditorRegistry) => unknown): this {
    callback(this.pierreEditor);
    return this;
  }

  public enterCopyright(callback: (registry: ComponentListRegistry<{}>) => unknown): this {
    callback(this.copyright);
    return this;
  }
}
