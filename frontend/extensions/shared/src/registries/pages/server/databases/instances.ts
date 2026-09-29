import { ContainerRegistry, Registry } from 'shared';
import type { Props as ContainerProps } from '@/elements/containers/ServerContentContainer.tsx';
import { ComponentListRegistry } from '../../../slices/componentList.ts';

export class InstancesRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.container.mergeFrom(other.container);
    this.actionBar.mergeFrom(other.actionBar);

    return this;
  }

  public container: ContainerRegistry<ContainerProps> = new ContainerRegistry();
  public actionBar: ComponentListRegistry = new ComponentListRegistry();

  public enterContainer(callback: (registry: ContainerRegistry<ContainerProps>) => unknown): this {
    callback(this.container);
    return this;
  }

  public enterActionBar(callback: (registry: ComponentListRegistry) => unknown): this {
    callback(this.actionBar);
    return this;
  }
}
