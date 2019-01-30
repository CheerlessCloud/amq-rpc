// @flow
import type { Channel as AMQPChannel } from 'amqplib';
import AMQPMessage from './AMQPMessage';

class AMQPMessageController {
  _message: AMQPMessage;
  _messageSourceChannel: AMQPChannel;

  constructor(message: AMQPMessage) {
    this._message = message;
    this._messageSourceChannel = message._channel;
  }

  async ack() {
    this._message.checkIsSealed();
    await this._forceAck();
  }

  async reject(requeue: ?boolean = false) {
    this._message.checkIsSealed();
    await this._forceReject(requeue);
  }

  async rejectAndRequeue(): Promise<void> {
    this._message.checkIsSealed();
    await this._forceReject(true);
  }

  async _forceAck() {
    this._messageSourceChannel.ack(this._message._amqpMessage);
    this._message.toSeal();
  }

  async _forceReject(requeue: ?boolean = false) {
    this._messageSourceChannel.reject(this._message._amqpMessage, !!requeue);
    this._message.toSeal();
  }
}

export default AMQPMessageController;
