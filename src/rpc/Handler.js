/* eslint-disable no-empty-function,no-unused-vars */
// @flow
import EError from 'eerror';
import { type IMessage } from '../AMQPMessage';
import AMQPMessageRpcController from '../AMQPMessageRpcController';
import RpcService from '../Service';
import errorToObject from './errorToObject';
import type { IHandler } from './IHandler';

// eslint-disable-next-line no-use-before-define
function lastErrorHurdle(error: Error, handler: RpcHandler) {
  const errorCallback = handler._service._errorHandler;

  // $FlowFixMe
  const { correlationId } = handler._message.props;
  errorCallback(
    EError.wrap(error, {
      action: handler.action,
      messageId: handler._message.id,
      correlationId,
    }),
  );
}

export default class RpcHandler implements IHandler {
  +_service: RpcService;
  +_message: IMessage;
  +_messageController: AMQPMessageRpcController;
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
    // $FlowFixMe
    this._messageController = new AMQPMessageRpcController(message, service);

    if (this.handle === RpcHandler.prototype.handle) {
      throw new Error('You must override handle method');
    }

    return this;
  }

  async beforeHandle() {}

  async handle(): ?Object {}

  async handleFail(error: Error) {
    if (this._message.applicationLevelRetryLimit !== null) {
      this._message.setApplicationLevelRetryLimit(this._message.applicationLevelRetryLimit - 1);
    }

    if (
      this._message.applicationLevelRetryLimit === null ||
      this._message.applicationLevelRetryLimit <= 0
    ) {
      await this._messageController.reply({ error });
      await this._messageController.reject();
    } else {
      // retry flow
      await this._messageController.ack();
      await this._messageController.resendAsRetry();
    }
  }

  async handleSuccess(replyPayload: ?Object) {
    await this._messageController.reply({ payload: replyPayload });
    await this._messageController.ack();
  }

  async onSuccess(replyPayload: ?Object) {}
  async onFail(error: Error) {}
  async afterHandle(error: ?Error, replyPayload: ?Object) {}

  async execute() {
    let handleError = null;
    let replyPayload = null;

    try {
      if (this._message.applicationLevelRetryLimit !== null) {
        // $FlowFixMe
        if (this._message.props.redelivered) {
          this._message.setApplicationLevelRetryLimit(this._message.applicationLevelRetryLimit - 1);
        }

        if (this._message.applicationLevelRetryLimit <= 0) {
          throw new Error('Retry limit exceeded');
        }
      }

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
