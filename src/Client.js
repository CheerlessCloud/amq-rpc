// @flow
import uuid from 'uuid/v4';
import EError from 'eerror';
import pTimeout from 'p-timeout';
import type { IMessage } from './AMQPMessage';
import { type ConnectOptions } from './AMQPAdapter';
import AdapterConsumer from './AdapterConsumer';

opaque type CallbacksMap = Map<string, (?Error, ?Object) => void>;

function reconstructErrorFromService(error) {
  const { message = 'error from service', stack: fromServiceStack, ...errorObject } = error;
  return new EError(message).combine({ fromServiceStack, ...errorObject });
}

function createRpcCallResponseWaiter(
  callbacksMap: CallbacksMap,
  messageId: string,
): Promise<mixed> {
  return new Promise((resolve, reject) => {
    callbacksMap.set(messageId, (err: ?Error, result: ?Object) => {
      callbacksMap.delete(messageId);
      if (err) {
        return reject(err);
      }

      return resolve(result);
    });
  });
}

function createRpcCallResponseDummyWaiter(callbacksMap: CallbacksMap, messageId: string) {
  callbacksMap.set(messageId, () => {
    callbacksMap.delete(messageId);
  });
}

type RpcClientConstructorOptions = {
  connectParams?: ConnectOptions,
  service: string,
  version: string,
  waitResponseTimeout?: number,
};

type RpcClientSendOptions = {
  +expiration?: string,
  +priority?: number,
  +persistent?: boolean,
  +contentType?: string,
  +contentEncoding?: string,
  +headers?: Object,
  +correlationId?: string,
  +type?: string,
  waitResponseTimeout?: number,
};

class RpcClient extends AdapterConsumer {
  // @Injectable
  _callbacks: CallbacksMap = new Map();
  _service: string;
  _version: string;
  _replyQueueName: string = '';
  _waitResponseTimeout: ?number;

  get service(): string {
    return this._service;
  }

  get version(): string {
    return this._version;
  }

  get queueName(): string {
    return `${this._service}-v${this._version}`;
  }

  constructor({
    connectParams,
    service,
    version,
    waitResponseTimeout,
  }: RpcClientConstructorOptions) {
    super();
    this._service = service;
    this._version = version;
    this._waitResponseTimeout = waitResponseTimeout;
    this._setConnectParams(connectParams);
  }

  async _onInit() {
    await this._initReplyQueue();
  }

  async _initReplyQueue() {
    const adapter = this._getAdapter();
    this._replyQueueName = `${this.queueName}-reply-${uuid()}`;

    await adapter.ensureQueue({ name: this._replyQueueName, exclusive: true, durable: false });

    await adapter.subscribe(this._replyQueueName, { noAck: true }, (message: IMessage) =>
      this._replyMessageHandler(message),
    );
  }

  _replyMessageHandler(replyMessage: IMessage) {
    if (!replyMessage.id) {
      return;
    }

    const callback = this._callbacks.get(replyMessage.id);

    if (!callback) {
      return;
    }

    try {
      const { payload, error } = replyMessage.payload;

      if (error) {
        return callback(reconstructErrorFromService(error));
      }

      callback(null, payload);
    } catch (err) {
      callback(err);
    }
  }

  async send(payload: Object, options: ?RpcClientSendOptions) {
    const messageId = uuid();

    const waiter = createRpcCallResponseWaiter(this._callbacks, messageId);

    await this._sendMessage(messageId, payload, options);

    if (options && options.waitResponseTimeout) {
      return pTimeout(
        waiter,
        options.waitResponseTimeout,
        'Wait response from service is timed out',
      );
    }

    if (this._waitResponseTimeout) {
      return pTimeout(waiter, this._waitResponseTimeout, 'Wait response from service is timed out');
    }

    return waiter;
  }

  async sendWithoutWaitResponse(payload: Object, options: ?RpcClientSendOptions) {
    const messageId = uuid();
    createRpcCallResponseDummyWaiter(this._callbacks, messageId);
    await this._sendMessage(messageId, payload, options);
  }

  async _sendMessage(messageId: string, payload: Object, options: ?RpcClientSendOptions) {
    const adapter = this._getAdapter();

    // @todo check is queue exist before send
    await adapter.send(this.queueName, payload, {
      ...options,
      messageId,
      replyTo: this._replyQueueName,
      timestamp: Date.now(),
      appId: this.queueName,
    });
  }

  async call(action: string, payload: Object, options: ?RpcClientSendOptions) {
    return this.send(payload, {
      ...options,
      type: action,
    });
  }

  async callWithoutWaitResponse(action: string, payload: Object, options: ?RpcClientSendOptions) {
    await this.sendWithoutWaitResponse(payload, {
      ...options,
      type: action,
    });
  }
}

export default RpcClient;
