// @flow
import type { Message as CommonAMQPMessage, Channel as AMQPChannel } from 'amqplib';

export type MessageProps = {
  ...$Exact<$PropertyType<CommonAMQPMessage, 'fields'>>,
  ...$Exact<$PropertyType<CommonAMQPMessage, 'properties'>>,
};

export interface IMessage {
  +id: string;
  +correlationId: ?string;
  +payload: Object;
  +isSealed: boolean;
  +headers: Map<string, mixed>;
  +isAnswerQueueEnabled: boolean;
  +sourceQueue: string;
  +applicationLevelRetryLimit: null | number;
  +isApplicationLevelRetryEnabled: boolean;
  // constructor(
  //   amqpMessage: CommonAMQPMessage,
  //   channel: AMQPChannel,
  //   sourceQueue: string,
  //   isSealed: ?boolean,
  // ): IMessage;
  getPayloadAsObject(encoding?: buffer$NonBufferEncoding): Object;
  getPayloadAsString(encoding?: buffer$NonBufferEncoding): string;
  getPayloadAsBuffer(): Buffer;
  setApplicationLevelRetryLimit(number | string): void;
}

export default class AMQPMessage implements IMessage {
  _channel: AMQPChannel;
  _amqpMessage: CommonAMQPMessage;
  _isSealed: boolean = false;
  _sourceQueue: string;

  constructor(
    amqpMessage: CommonAMQPMessage,
    channel: AMQPChannel,
    sourceQueue: string,
    isSealed: ?boolean,
  ): IMessage {
    this._channel = channel;
    this._amqpMessage = amqpMessage;
    this._isSealed = isSealed || false;
    this._sourceQueue = sourceQueue;
    return this;
  }

  get id(): string {
    return this._amqpMessage.properties.messageId;
  }

  get correlationId(): ?string {
    return this._amqpMessage.properties.correlationId;
  }

  get payload(): Object {
    return this.getPayloadAsObject();
  }

  get isSealed(): boolean {
    return this._isSealed;
  }

  get sourceQueue(): string {
    return this._sourceQueue;
  }

  get props(): MessageProps {
    return { ...this._amqpMessage.properties, ...this._amqpMessage.fields };
  }

  get headers(): Map<string, mixed> {
    return new Map(Object.entries(this._amqpMessage.properties.headers));
  }

  get isAnswerQueueEnabled(): boolean {
    return !!this._amqpMessage.properties.replyTo;
  }

  get applicationLevelRetryLimit(): null | number {
    const retryLimitHeader = this.headers.get('X-Retry-Limit');
    return ![null, undefined].includes(retryLimitHeader) ? Number(retryLimitHeader) : null;
  }

  get isApplicationLevelRetryEnabled(): boolean {
    return typeof this.applicationLevelRetryLimit === 'number';
  }

  setApplicationLevelRetryLimit(value: number | string): void {
    this._amqpMessage.properties.headers['X-Retry-Limit'] = String(value);
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

  checkIsSealed() {
    if (!this._isSealed) {
      return;
    }

    throw new Error('Message already acked/rejected or created in sealed mode');
  }

  toSeal() {
    this.checkIsSealed();
    this._isSealed = true;
  }
}
