// @flow
import type { IMessage } from './AMQPMessage';
import RpcService from './Service';

export interface IRpcServiceHandler {
  +action: string;
  +message: IMessage;
  constructor({ service: RpcService, message: IMessage }): IRpcServiceHandler;
  beforeHandle(): Promise<void> | void;
  handle(): Promise<void> | void;
  onSuccess(): Promise<void> | void;
  onFail(Error): Promise<void> | void;
  afterHandle(): Promise<void> | void;
}
