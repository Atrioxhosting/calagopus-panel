import { Registry } from 'shared';

export class CancellableEvent<D> {
  private isCancelled = false;

  constructor(public data: D) {}

  public get cancelled(): boolean {
    return this.isCancelled;
  }

  public cancel(): void {
    this.isCancelled = true;
  }

  // Only reachable from handlers registered with `receiveCancelled: true`
  public uncancel(): void {
    this.isCancelled = false;
  }
}

export type EventPriority = 'highest' | 'high' | 'normal' | 'low' | 'lowest';

const priorityRank: Record<EventPriority, number> = {
  highest: 0,
  high: 1,
  normal: 2,
  low: 3,
  lowest: 4,
};

export type EventHandler<E> = (event: E) => void;

export interface EventHandlerOptions {
  priority?: EventPriority;
  // Also run this handler when an earlier handler cancelled the event. Defaults to `false`
  receiveCancelled?: boolean;
}

interface RegisteredEventHandler<E> {
  handler: EventHandler<E>;
  rank: number;
  receiveCancelled: boolean;
}

const MAX_EMIT_DEPTH = 8;
let emitDepth = 0;

export class EventHandlerList<E extends CancellableEvent<unknown>> implements Registry {
  public mergeFrom(other: this): this {
    for (const registered of other.handlers) {
      this.insert(registered);
    }

    return this;
  }

  public handlers: RegisteredEventHandler<E>[] = [];

  public addHandler(handler: EventHandler<E>, options: EventHandlerOptions = {}): this {
    this.insert({
      handler,
      rank: priorityRank[options.priority ?? 'normal'],
      receiveCancelled: options.receiveCancelled ?? false,
    });

    return this;
  }

  public removeHandler(handler: EventHandler<E>): this {
    this.handlers = this.handlers.filter((registered) => registered.handler !== handler);

    return this;
  }

  /**
   * Runs all handlers against the event and returns it, check `event.cancelled` and read `event.data` afterwards.
   * Handlers are synchronous, errors thrown by a handler are logged and do not stop the remaining handlers.
   */
  public emit(event: E): E {
    if (emitDepth >= MAX_EMIT_DEPTH) {
      console.error('Event handlers recursed too deeply, skipping handlers for', event);
      return event;
    }

    emitDepth++;
    try {
      for (const registered of this.handlers) {
        if (event.cancelled && !registered.receiveCancelled) continue;

        try {
          registered.handler(event);
        } catch (err) {
          console.error('Error while running event handler', err);
        }
      }
    } finally {
      emitDepth--;
    }

    return event;
  }

  private insert(registered: RegisteredEventHandler<E>) {
    const index = this.handlers.findIndex((other) => other.rank > registered.rank);
    const handlers = [...this.handlers];
    handlers.splice(index === -1 ? handlers.length : index, 0, registered);

    this.handlers = handlers;
  }
}
