/* eslint-disable no-empty-function,no-unused-vars */
// @flow
import { type IMessage } from './AMQPMessage';
import RpcService from './Service';
import type { IRpcServiceHandler } from './IRpcServiceHandler';

export default class RpcServiceHandler implements IRpcServiceHandler {
  get action(): string {
    return 'default';
  }
  // +required: string[] = [];

  +_service: RpcService;
  +message: IMessage;
  +payload: Object;

  constructor({ service, message }: { service: RpcService, message: IMessage }): RpcServiceHandler {
    this._service = service;
    this.message = message;
    this.payload = message.payload;
    return this;
  }

  async beforeHandle() {}
  async handle() {}
  async onSuccess() {}
  async onFail(error: Error) {}
  async afterHandle() {}
}
