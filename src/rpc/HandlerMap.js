// @flow
import EError from 'eerror';
import type { IHandler } from './IHandler';

export default class HandlerMap {
  _map: Map<string, Class<IHandler>> = new Map();

  add(handler: Class<IHandler>) {
    const { action, execute } = (handler: any).prototype;

    if (!action || typeof execute !== 'function') {
      throw new EError('Handler must class implemented IHandler interface').combine({
        name: 'IncorrectHandlerInterface',
        handler,
      });
    }

    if (this._map.has(action)) {
      throw new EError('Handler for this action already set').combine({
        name: 'HandlerAlreadySet',
        action,
      });
    }

    this._map.set(action, handler);
  }

  get(action: string): ?Class<IHandler> {
    return this._map.get(action);
  }
}
