/* eslint-disable no-empty-function,no-unused-vars */
// @flow
import { type IMessage } from '../AMQPMessage';
import RpcService from '../Service';
import errorToObject from './errorToObject';

export default class RpcHandler {
  +_service: RpcService;
  +_message: IMessage;
  +context: Object = {};

  get action(): string {
    return 'default';
  }

  get payload(): $PropertyType<IMessage, 'payload'> {
    return this._message.payload;
  }

  constructor({ service, message }: { service: RpcService, message: IMessage }) {
    this._service = service;
    this._message = message;

    if (this.handle === RpcHandler.prototype.handle) {
      throw new Error('You must override handle method');
    }
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

  handleFail(err: Error) {
    // reply
    // reject
  }

  async handleSuccess(replyPayload: ?Object) {
    await this.reply({ payload: replyPayload });
    await this._message.ack();
  }

  async onSuccess() {}
  async onFail(error: Error) {}
  async afterHandle() {}

  async execute() {
    try {
      await this.beforeHandle();
      const replyPayload = await this.handle();
      await this.handleSuccess(replyPayload);
      await this.onSuccess();
    } catch (err) {
      await this.handleFail(err);
      await this.onFail(err);
    } finally {
      await this.afterHandle();
    }
  }
}
