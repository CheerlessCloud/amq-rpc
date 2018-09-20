// @flow
import EError from 'eerror';
import type { IMessage } from './AMQPMessage';
import { type ConnectOptions, type QueueOptions } from './AMQPAdapter';
import AdapterConsumer from './AdapterConsumer';
import type { IRpcServiceHandler } from './IRpcServiceHandler';

type RpcServiceQueueOptions = { ...$Exact<QueueOptions>, prefetch?: number };

type RpcServiceConstructorOptions = {
  connectParams?: ConnectOptions,
  service: string,
  version: string,
  queue: ?RpcServiceQueueOptions,
};

class RpcService extends AdapterConsumer {
  // eslint-disable-next-line flowtype/generic-spacing
  _handlers: Map<string, Class<IRpcServiceHandler>> = new Map();
  _service: string;
  _version: string;
  _subscribeState: 'uninitiated' | 'functionalHandler' | 'classHandler' = 'uninitiated';
  _queueOptions: ?RpcServiceQueueOptions = { durable: true };

  get service(): string {
    return this._service;
  }

  get version(): string {
    return this._version;
  }

  get queueName(): string {
    return `${this.service}-v${this.version}`;
  }

  constructor({ connectParams, service, version, queue }: RpcServiceConstructorOptions) {
    super();
    this._service = service;
    this._version = version;
    this._queueOptions = { ...this._queueOptions, ...queue };
    this._setConnectParams(connectParams);
  }

  async _reply(message: IMessage, payload: ?Object = null, error: ?Error = null) {
    const { messageId, correlationId, replyTo } = message._props;
    if (!replyTo) {
      return;
    }

    let errorObj = null;
    if (error) {
      errorObj = {};
      Object.getOwnPropertyNames(error).forEach(key => {
        (errorObj: any)[key] = (error: any)[key];
      });
    }

    const adapter = this._getAdapter();
    await adapter.send(
      replyTo,
      {
        error: errorObj,
        payload,
      },
      { messageId, correlationId },
    );
  }

  async _addSubscriber(handler: IMessage => Promise<any> | any) {
    const adapter = this._getAdapter();
    await adapter.ensureQueue({ name: this.queueName, ...this._queueOptions });
    const { prefetch = 1 } = this._queueOptions || {};
    await adapter.setPrefetch(prefetch);

    await adapter.subscribe(
      this.queueName,
      {
        noAck: false,
      },
      handler,
    );
  }

  async setFunctionalHandler(handler: (Object, IMessage) => Promise<any> | any) {
    if (this._subscribeState !== 'uninitiated') {
      throw new Error('Handler already set');
    }

    await this._addSubscriber(message => this._functionalMessageHandler(handler, message));
    this._subscribeState = 'functionalHandler';
  }

  async addHandler(handler: Class<IRpcServiceHandler>) {
    if (this._subscribeState === 'functionalHandler') {
      throw new Error('Functional handler already set');
    }

    const { action } = handler.prototype;

    if (!action) {
      throw new Error('Handler must implement IRpcServiceHandler interface');
    }

    if (this._handlers.has(action)) {
      throw new Error('Handler for this action already set');
    }

    this._handlers.set(action, handler);

    if (this._subscribeState === 'uninitiated') {
      await this._addSubscriber(message => this._classMessageHandler(message));
      this._subscribeState = 'classHandler';
    }
  }

  // @todo merge _classMessageHandler and _functionalMessageHandler and extract to class
  async _classMessageHandler(message: IMessage) {
    const { type: action = 'default' } = message._props;
    const RpcServiceHandler = this._handlers.get(action);

    if (!RpcServiceHandler) {
      await message.reject(!message._props.redelivered);
      this._errorHandler(
        new EError('Handler for action not found').combine({
          action,
          handlers: this._handlers,
          messageId: message.id,
          requeue: !message._props.redelivered,
        }),
      );
      return;
    }

    let handler = null;
    try {
      handler = new RpcServiceHandler({ service: this, message });
    } catch (err) {
      await message.reject(!message._props.redelivered);
      return;
    }

    let isSuccess = false;
    try {
      await handler.beforeHandle();
      const replyPayload = await handler.handle();
      await handler.afterHandle();
      await this._reply(message, replyPayload);
      isSuccess = true;
      await handler.onSuccess();
    } catch (err) {
      await this._reply(message, null, err);
      await handler.onFail(err);
    } finally {
      try {
        if (isSuccess) {
          await message.ack();
        } else {
          await message.reject();
        }
      } catch (err) {
        this._errorHandler(
          EError.wrap(err, {
            action,
            messageId: message.id,
            isSuccess,
            subMessage: 'Error at message ack/reject',
          }),
        );
      }
    }
  }

  async _functionalMessageHandler(
    handler: (Object, IMessage) => Promise<any> | any,
    message: IMessage,
  ) {
    let isSuccess = false;
    try {
      const { payload } = message;
      const replyPayload = await handler(payload, message);
      await this._reply(message, replyPayload);
      isSuccess = true;
    } catch (err) {
      await this._reply(message, null, err);
    } finally {
      try {
        if (isSuccess) {
          await message.ack();
        } else {
          await message.reject();
        }
      } catch (err) {
        this._errorHandler(
          EError.wrap(err, {
            messageId: message.id,
            isSuccess,
            subMessage: 'Error at message ack/reject',
          }),
        );
      }
    }
  }

  async interventSignalInterceptors({
    stopSignal = 'SIGINT',
    gracefulStopTimeout = 60 * 1000,
  }: { stopSignal?: string, gracefulStopTimeout?: number } = {}) {
    const endCallback = async () => {
      try {
        await this.destroy({ gracefulStopTimeout });
        process.exit(0);
      } catch (err) {
        this._errorHandler(
          EError.wrap(err, {
            subMessage: 'Error at destroy service',
            service: this,
          }),
        );
        process.exit(1);
      }
    };

    process.once(stopSignal, endCallback);
  }
}

export default RpcService;
