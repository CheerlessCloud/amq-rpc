/* eslint-disable no-empty-function,no-unused-vars */
// @flow
import EError from 'eerror';
import { type IMessage } from '../AMQPMessage';
import RpcService from '../Service';
import errorToObject from './errorToObject';
import type { IHandler } from './IHandler';

// eslint-disable-next-line no-use-before-define
function lastErrorHurdle(error: Error, handler: RpcHandler) {
  const errorCallback = handler._service._errorHandler;

  errorCallback(
    EError.wrap(error, {
      action: handler.action,
      messageId: handler._message.id,
      correlationId: handler._message._props.correlationId,
    }),
  );
}

export default class RpcHandler implements IHandler {
  +_service: RpcService;
  +_message: IMessage;
  +context: Object = {};

  get action(): string {
    return 'default';
  }

  get payload(): $PropertyType<IMessage, 'payload'> {
    return this._message.payload;
  }

  constructor({ service, message }: { service: RpcService, message: IMessage }): RpcHandler {
    this._service = service;
    this._message = message;

    if (this.handle === RpcHandler.prototype.handle) {
      throw new Error('You must override handle method');
    }

    return this;
  }

  async reply({ payload, error }: { payload?: ?Object, error?: Error }) {
    const { messageId, correlationId, replyTo } = this._message._props;
    if (!replyTo) {
      return;
    }

    const adapter = this._service._getAdapter();
    await adapter.send(
      replyTo,
      {
        error: errorToObject(error),
        payload: payload === undefined ? null : payload,
      },
      { messageId, correlationId },
    );
  }

  async beforeHandle() {}

  async handle(): ?Object {}

  async handleFail(error: Error) {
    await this.reply({ error });
    await this._message.reject();
  }

  async handleSuccess(replyPayload: ?Object) {
    await this.reply({ payload: replyPayload });
    await this._message.ack();
  }

  async onSuccess(replyPayload: ?Object) {}
  async onFail(error: Error) {}
  async afterHandle(error: ?Error, replyPayload: ?Object) {}

  async execute() {
    let handleError = null;
    let replyPayload = null;

    try {
      await this.beforeHandle();
      replyPayload = await this.handle();
      await this.handleSuccess(replyPayload);
      await this.onSuccess(replyPayload);
    } catch (error) {
      handleError = error;
      try {
        await this.handleFail(handleError);
        await this.onFail(handleError);
      } catch (err) {
        lastErrorHurdle(EError.wrap(err, { handleError }), this);
      }
    } finally {
      try {
        await this.afterHandle(handleError, replyPayload);
      } catch (err) {
        lastErrorHurdle(EError.wrap(err, { handleError }), this);
      }
    }
  }
}
