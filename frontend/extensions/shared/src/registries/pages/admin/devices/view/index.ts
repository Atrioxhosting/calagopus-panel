import { Registry } from 'shared';
import { z } from 'zod';
import { adminDeviceSchema } from '@/lib/schemas/admin/devices';
import { SubNavigationRegistry } from '../../../../slices/subNavigation.ts';
import { EggsRegistry } from './eggs.ts';
import { NodesRegistry } from './nodes.ts';
import { ServersRegistry } from './servers.ts';

export class ViewRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.subNavigation.mergeFrom(other.subNavigation);
    this.eggs.mergeFrom(other.eggs);
    this.nodes.mergeFrom(other.nodes);
    this.servers.mergeFrom(other.servers);

    return this;
  }

  public subNavigation = new SubNavigationRegistry<{ device: z.infer<typeof adminDeviceSchema> }>();
  public eggs: EggsRegistry = new EggsRegistry();
  public nodes: NodesRegistry = new NodesRegistry();
  public servers: ServersRegistry = new ServersRegistry();

  public enterSubNavigation(
    callback: (registry: SubNavigationRegistry<{ device: z.infer<typeof adminDeviceSchema> }>) => unknown,
  ): this {
    callback(this.subNavigation);
    return this;
  }

  public enterEggs(callback: (registry: EggsRegistry) => unknown): this {
    callback(this.eggs);
    return this;
  }

  public enterNodes(callback: (registry: NodesRegistry) => unknown): this {
    callback(this.nodes);
    return this;
  }

  public enterServers(callback: (registry: ServersRegistry) => unknown): this {
    callback(this.servers);
    return this;
  }
}
