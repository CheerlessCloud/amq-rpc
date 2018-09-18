// @flow
import type { Message as CommonAMQPMessage, Channel as AMQPChannel } from 'amqplib';

export type MessageProps = {
  ...$Exact<$PropertyType<CommonAMQPMessage, 'fields'>>,
  ...$Exact<$PropertyType<CommonAMQPMessage, 'properties'>>,
};

export interface IMessage {
  +id: ?string;
  +correlationId: ?string;
  +payload: Object;
  +headers: Map<string, mixed>;
  +isAnswerQueueEnabled: boolean;
  +_props: MessageProps;
  constructor(amqpMessage: CommonAMQPMessage, channel: AMQPChannel): IMessage;
  getPayloadAsObject(encoding?: buffer$NonBufferEncoding): Object;
  getPayloadAsString(encoding?: buffer$NonBufferEncoding): string;
  getPayloadAsBuffer(): Buffer;
  ack(): Promise<void>;
  reject(requeue: ?boolean): Promise<void>;
  rejectAndRequeue(): Promise<void>;
}

export default class AMQPMessage implements IMessage {
  _channel: AMQPChannel;
  _amqpMessage: CommonAMQPMessage;

  constructor(amqpMessage: CommonAMQPMessage, channel: AMQPChannel): IMessage {
    this._channel = channel;
    this._amqpMessage = amqpMessage;
    return this;
  }

  get id(): ?string {
    return this._amqpMessage.properties.messageId;
  }

  get correlationId(): ?string {
    return this._amqpMessage.properties.correlationId;
  }

  get payload(): Object {
    return this.getPayloadAsObject();
  }

  get _props(): MessageProps {
    return { ...this._amqpMessage.properties, ...this._amqpMessage.fields };
  }

  getPayloadAsObject(encoding?: buffer$NonBufferEncoding): Object {
    if (!encoding) {
      // eslint-disable-next-line no-param-reassign
      encoding = (this._amqpMessage.properties.contentEncoding: any);
    }

    return JSON.parse(this._amqpMessage.content.toString(encoding));
  }

  getPayloadAsString(encoding?: buffer$NonBufferEncoding): string {
    return this._amqpMessage.content.toString(encoding);
  }

  getPayloadAsBuffer(): Buffer {
    return this._amqpMessage.content;
  }

  get headers(): Map<string, mixed> {
    return new Map(Object.entries(this._amqpMessage.properties.headers));
  }

  get isAnswerQueueEnabled(): boolean {
    return !!this._amqpMessage.properties.replyTo;
  }

  async ack() {
    this._channel.ack(this._amqpMessage);
  }

  async reject(requeue: ?boolean = false) {
    this._channel.reject(this._amqpMessage, !!requeue);
  }

  async rejectAndRequeue(): Promise<void> {
    await this.reject(true);
  }
}
