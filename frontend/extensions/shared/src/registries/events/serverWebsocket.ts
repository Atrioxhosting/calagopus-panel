import { CancellableEvent, EventHandler, EventHandlerList, EventHandlerOptions, Registry } from 'shared';
import type { Websocket } from '@/plugins/websocket/Websocket.ts';

export interface ServerWebsocketFrame {
  event: string;
  args: string[];
}

export const serverWebsocketProtocolEvents: ReadonlySet<string> = new Set([
  'auth',
  'auth success',
  'token expiring',
  'token expired',
  'jwt error',
  'configure socket',
]);

export class ServerWebsocketMessageEvent extends CancellableEvent<ServerWebsocketFrame> {
  constructor(
    public readonly serverUuid: string,
    public readonly socket: Websocket,
    data: ServerWebsocketFrame,
  ) {
    super(data);
  }
}

export class ServerWebsocketSendEvent extends CancellableEvent<ServerWebsocketFrame> {
  constructor(
    public readonly serverUuid: string,
    public readonly socket: Websocket,
    data: ServerWebsocketFrame,
  ) {
    super(data);
  }
}

export class ServerWebsocketEventRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.messageHandlers.mergeFrom(other.messageHandlers);
    this.sendHandlers.mergeFrom(other.sendHandlers);

    return this;
  }

  public messageHandlers: EventHandlerList<ServerWebsocketMessageEvent> = new EventHandlerList();
  public sendHandlers: EventHandlerList<ServerWebsocketSendEvent> = new EventHandlerList();

  public addMessageHandler(handler: EventHandler<ServerWebsocketMessageEvent>, options?: EventHandlerOptions): this {
    this.messageHandlers.addHandler(handler, options);
    return this;
  }

  public removeMessageHandler(handler: EventHandler<ServerWebsocketMessageEvent>): this {
    this.messageHandlers.removeHandler(handler);
    return this;
  }

  public addSendHandler(handler: EventHandler<ServerWebsocketSendEvent>, options?: EventHandlerOptions): this {
    this.sendHandlers.addHandler(handler, options);
    return this;
  }

  public removeSendHandler(handler: EventHandler<ServerWebsocketSendEvent>): this {
    this.sendHandlers.removeHandler(handler);
    return this;
  }
}
