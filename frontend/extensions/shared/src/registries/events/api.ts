import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { CancellableEvent, EventHandler, EventHandlerList, EventHandlerOptions, Registry } from 'shared';

export const API_REQUEST_CANCELLED_CODE = 'ERR_EXTENSION_CANCELED';

export class ApiRequestEvent extends CancellableEvent<InternalAxiosRequestConfig> {}
export class ApiResponseEvent extends CancellableEvent<AxiosResponse> {}

export class ApiEventRegistry implements Registry {
  public mergeFrom(other: this): this {
    this.requestHandlers.mergeFrom(other.requestHandlers);
    this.responseHandlers.mergeFrom(other.responseHandlers);

    return this;
  }

  public requestHandlers: EventHandlerList<ApiRequestEvent> = new EventHandlerList();
  public responseHandlers: EventHandlerList<ApiResponseEvent> = new EventHandlerList();

  public addRequestHandler(handler: EventHandler<ApiRequestEvent>, options?: EventHandlerOptions): this {
    this.requestHandlers.addHandler(handler, options);
    return this;
  }

  public removeRequestHandler(handler: EventHandler<ApiRequestEvent>): this {
    this.requestHandlers.removeHandler(handler);
    return this;
  }

  public addResponseHandler(handler: EventHandler<ApiResponseEvent>, options?: EventHandlerOptions): this {
    this.responseHandlers.addHandler(handler, options);
    return this;
  }

  public removeResponseHandler(handler: EventHandler<ApiResponseEvent>): this {
    this.responseHandlers.removeHandler(handler);
    return this;
  }
}
