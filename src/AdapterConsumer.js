// @flow
import AMQPAdapter from './AMQPAdapter';
import mergeConnectParams from './mergeConnectParams';
import type { ConnectOptions } from './AMQPAdapter';

opaque type _AMQPAdapter = AMQPAdapter;
opaque type _ConnectOptions = ConnectOptions;

export default class AdapterConsumer {
  _adapter: ?_AMQPAdapter;
  _connectParams: _ConnectOptions;
  _errorHandler: Error => mixed = err => console.error(err);

  _getAdapter(): AMQPAdapter {
    if (!this._adapter) {
      throw new Error('You must call ensureConnection before act with connection');
    }

    return this._adapter;
  }

  _setConnectParams(connectParams: ?ConnectOptions) {
    if (!connectParams) {
      return;
    }

    this._connectParams = connectParams;
  }

  // eslint-disable-next-line no-empty-function
  async _onInit() {}

  async ensureConnection({ connectParams }: { connectParams?: ConnectOptions } = {}) {
    if (this._adapter) {
      return;
    }

    const options = mergeConnectParams(connectParams, this._connectParams);

    this._adapter = await AMQPAdapter.connect(options);
    this._adapter._errorHandler = this._errorHandler;

    await this._onInit();
    return this;
  }

  async destroy(options: { gracefulStopTimeout?: number }) {
    const adapter = this._getAdapter();
    await adapter.disconnect(options);
  }

  setErrorHandler(handler: Error => mixed) {
    this._errorHandler = handler;
    if (this._adapter) {
      this._adapter._errorHandler = handler;
    }
  }
}
