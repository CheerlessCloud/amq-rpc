// @flow
import { connect } from 'amqplib';
import type {
  ConnectOptions as AMQPConnectOptions,
  Connection,
  Channel,
  AssertQueueOptions,
  PublishOptions,
  ConsumeOptions,
  Message as OriginalAMQPMessage,
} from 'amqplib';
import EventEmitter from 'events';
import pTimeout from 'p-timeout';
import pEvent from 'p-event';
import EError from 'eerror';
import AMQPMessage, { type IMessage } from './AMQPMessage';

type AMQPAdapterEventBusPossibleEvent = 'lock' | 'unlock' | 'bufferOverflow' | 'endHandle';
type AMQPAdapterEventBus = {
  ...EventEmitter,
  on(AMQPAdapterEventBusPossibleEvent, (reason: string) => mixed): void,
  once(AMQPAdapterEventBusPossibleEvent, (reason: string) => mixed): void,
  emit(AMQPAdapterEventBusPossibleEvent, reason: string): void,
};

opaque type _Connection = Connection;
opaque type _Channel = Channel;
opaque type _State =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'blocked'
  | 'disconnecting'
  | 'disconnected';

export type ConnectOptions = {
  url?: string,
  socket?: {
    cert?: Buffer,
    key?: Buffer,
    passphrase?: string,
    ca?: Array<Buffer>,
    noDelay?: boolean,
  },
  ...$Exact<AMQPConnectOptions>,
};

export type QueueOptions = AssertQueueOptions;

class AMQPAdapter {
  _connection: _Connection;
  _channel: _Channel;
  _state: _State = 'idle';
  _eventBus: AMQPAdapterEventBus = (new EventEmitter(): any);
  _inflightHandlers: number = 0;
  _errorHandler: Error => mixed = err => console.error(err);

  constructor({ connection, channel }: { connection: Connection, channel: Channel }) {
    this._connection = connection;
    this._channel = channel;

    (this._connection: any).setMaxListeners(0);
    (this._eventBus: any).setMaxListeners(0);
    (this._channel: any).setMaxListeners(0);

    this._mountEventHandlers();

    this._state = 'connected';
  }

  // @todo inject connection and channel
  static async connect(connectParams: ConnectOptions): Promise<AMQPAdapter> {
    const connection = await connect(connectParams);
    const channel = await connection.createChannel();

    return new AMQPAdapter({ connection, channel });
  }

  _mountEventHandlers() {
    // @todo check correctness of using on/once for this events
    this._connection.on('close', () => {
      this._state = 'disconnected';
      this._eventBus.emit('lock', 'connectionClosed');
    });

    this._connection.on('blocked', () => {
      this._state = 'blocked';
      this._eventBus.emit('lock', 'blocked');
    });

    this._connection.on('unblocked', () => {
      this._state = 'connected';
      this._eventBus.emit('unlock', 'unblocked');
    });

    this._eventBus.on('bufferOverflow', () => {
      this._state = 'blocked';
      this._eventBus.emit('lock', 'bufferOverflow');
    });

    this._channel.on('drain', () => {
      this._state = 'connected';
      this._eventBus.emit('unlock', 'drain');
    });

    this._channel.on('close', () => {
      this._state = 'disconnected';
      this._eventBus.emit('lock', 'channelClosed');
    });

    this._connection.on('error', err => {
      if (!err) {
        return;
      }

      this._errorHandler(
        EError.wrap(err, {
          adapter: this,
          adapterState: this._state,
          connection: this._connection,
        }),
      );
    });

    this._channel.on('error', err => {
      this._errorHandler(
        EError.wrap(err, {
          adapter: this,
          adapterState: this._state,
          channel: this._channel,
        }),
      );
    });
  }

  async _waitReady(timeout: ?number = 10 * 1000): Promise<Channel> {
    if (['connected', 'disconnecting'].includes(this._state)) {
      return this._channel;
    }

    await pEvent(this._eventBus, 'unlock', { timeout });

    return this._channel;
  }

  // @todo check queue exist and handle error
  async ensureQueue({ name, ...params }: { ...AssertQueueOptions, name: string }) {
    const channel: Channel = await this._waitReady();
    await channel.assertQueue(name, params);
  }

  // @todo wait drain and, generally, send timeout
  async send(queue: string, payload: Object, options: ?PublishOptions): Promise<void> {
    const channel: Channel = await this._waitReady();

    // @todo correct serialize (or not) and send buffer or string payload with contentType
    const serializedPayload = Buffer.from(JSON.stringify(payload));

    // @todo: check is target queue created and wait for creation some time
    const isSended = await channel.sendToQueue(queue, serializedPayload, options || {});

    if (!isSended) {
      this._eventBus.emit('bufferOverflow', 'bufferOverflow');
      await pEvent(this._eventBus, 'unlock');
      await this.send(queue, payload, options);
    }
  }

  async subscribe(
    queue: string,
    options: ?ConsumeOptions | ((?IMessage) => Promise<any> | any),
    handler: ?(IMessage) => Promise<any> | any,
  ) {
    if (typeof handler === 'undefined' && typeof options === 'function') {
      handler = options; // eslint-disable-line no-param-reassign
      options = {}; // eslint-disable-line no-param-reassign
    }

    if (typeof handler !== 'function') {
      throw new EError('Handler must be function').combine({
        handler,
        handlerType: typeof handler,
        queue,
      });
    }

    if (!handler) {
      throw new Error("Can't subscribe to queue without message handler");
    }

    const channel: Channel = await this._waitReady();

    await channel.consume(
      queue,
      async (originalMessage: ?OriginalAMQPMessage) => {
        if (!originalMessage) {
          this._errorHandler(
            new EError('No message passed to subscribe handler').combine({
              passedMessage: originalMessage,
              queue,
              options,
            }),
          );
          return;
        }

        this._inflightHandlers += 1;
        try {
          const message = new AMQPMessage(originalMessage, this._channel);
          await (handler: any)(message);
        } catch (err) {
          this._errorHandler(
            EError.wrap(err, {
              queue,
              options,
              originalMessage,
              adapterState: this._state,
            }),
          );
        } finally {
          this._inflightHandlers -= 1;
          this._eventBus.emit('endHandle', 'endHandle');
        }
      },
      options || {},
    );
  }

  setPrefetch(count: number) {
    this._channel.prefetch(count);
  }

  async disconnect({ gracefulStopTimeout = 10000 }: { gracefulStopTimeout?: number } = {}) {
    this._state = 'disconnecting';

    // @todo in wait end time reject with requeue all messages or unsubscribe
    // but how we can ack is this situation?
    if (gracefulStopTimeout > 0) {
      try {
        await this._waitEndHandlers(gracefulStopTimeout);
      } catch (err) {
        this._errorHandler(
          EError.wrap(err, {
            gracefulStopTimeout,
            subMessage: 'Error at graceful disconnect',
          }),
        );
      }
    }

    await this._connection.close();
  }

  async _waitEndHandlers(gracefulStopTimeout: number) {
    if (this._inflightHandlers <= 0) {
      return;
    }

    const waiter = pEvent(this._eventBus, 'endHandle', () => this._inflightHandlers > 0);

    await pTimeout(waiter, gracefulStopTimeout, 'Graceful disconnect timeout exceeded');
  }
}

export default AMQPAdapter;
