import { ContainerRegistry, Registry } from 'shared';
import type { Props as ContainerProps } from '@/elements/containers/ServerContentContainer.tsx';
import { ComponentListRegistry } from '../../slices/componentList.ts';
import { SubNavigationRegistry } from '../../slices/subNavigation.ts';

export class MountsRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.container.mergeFrom(other.container);
    this.actionBar.mergeFrom(other.actionBar);
    this.subNavigation.mergeFrom(other.subNavigation);

    return this;
  }

  public container: ContainerRegistry<ContainerProps> = new ContainerRegistry();
  public actionBar: ComponentListRegistry = new ComponentListRegistry();
  public subNavigation: SubNavigationRegistry = new SubNavigationRegistry();

  public enterContainer(callback: (registry: ContainerRegistry<ContainerProps>) => unknown): this {
    callback(this.container);
    return this;
  }

  public enterActionBar(callback: (registry: ComponentListRegistry) => unknown): this {
    callback(this.actionBar);
    return this;
  }

  public enterSubNavigation(callback: (registry: SubNavigationRegistry) => unknown): this {
    callback(this.subNavigation);
    return this;
  }
}
