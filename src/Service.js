// @flow
import EError from 'eerror';
import type { IMessage } from './AMQPMessage';
import { type ConnectOptions, type QueueOptions } from './AMQPAdapter';
import AdapterConsumer from './AdapterConsumer';
import HandlerMap from './rpc/HandlerMap';
import type { IHandler } from './rpc/IHandler';

type RpcServiceQueueOptions = { ...$Exact<QueueOptions>, prefetch?: number };

type RpcServiceConstructorOptions = {
  connectParams?: ConnectOptions,
  service: string,
  version: string,
  queue: ?RpcServiceQueueOptions,
};

class RpcService extends AdapterConsumer {
  _handlerMap: HandlerMap = new HandlerMap();
  _service: string;
  _version: string;
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

  async _initSubscriber() {
    const adapter = this._getAdapter();
    await adapter.ensureQueue({ name: this.queueName, ...this._queueOptions });
    const { prefetch = 1 } = this._queueOptions || {};
    await adapter.setPrefetch(prefetch);

    await adapter.subscribe(
      this.queueName,
      {
        noAck: false,
      },
      message => this._messageHandler(message),
    );
  }

  async _onInit() {
    await this._initSubscriber();
  }

  async addHandler(handler: Class<IHandler>) {
    this._handlerMap.add(handler);
  }

  async _getHandlerClassByMessage(message: IMessage): Promise<?Class<IHandler>> {
    const { type: action } = message._props;
    const Handler = this._handlerMap.get(action);

    if (Handler) {
      return Handler;
    }

    try {
      // @todo: retry in other instance
      const error = new EError('Handler for action not found').combine({
        action,
        messageId: message.id,
      });
      this._errorHandler(error);

      await message.reject();
      await this._reply(message, null, error);
    } catch (error) {
      this._errorHandler(error);
    }
  }

  async _constructHandler(Handler: Class<IHandler>, message: IMessage): Promise<?IHandler> {
    try {
      const handler: IHandler = new Handler({ service: this, message });
      return handler;
    } catch (err) {
      try {
        // @todo: review and refactor behavior error on construct handler
        const error = new EError('Error on construct class handler').combine({
          action: Handler.prototype.action,
          messageId: message.id,
          originalError: err,
        });
        this._errorHandler(error);
        await message.reject();
        await this._reply(message, null, error);
      } catch (error) {
        this._errorHandler(error);
      }
    }
  }

  async _messageHandler(message: IMessage): Promise<void> {
    const Handler: ?Class<IHandler> = await this._getHandlerClassByMessage(message);

    if (!Handler) {
      return;
    }

    const handler: ?IHandler = await this._constructHandler(Handler, message);

    if (!handler) {
      return;
    }

    await handler.execute();
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
