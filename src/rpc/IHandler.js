// @flow
import type { IMessage } from '../AMQPMessage';
import RpcService from '../Service';

export interface IHandler {
  +action: string;
  constructor({ service: RpcService, message: IMessage }): IHandler;
  execute(): Promise<void>;
}
