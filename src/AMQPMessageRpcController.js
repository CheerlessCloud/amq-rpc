// @flow
import type { PublishOptions } from 'amqplib';
import AMQPMessageController from './AMQPMessageController';
import AMQPMessage from './AMQPMessage';
import RpcService from './Service';
import errorToObject from './rpc/errorToObject';

class AMQPMessageRpcController extends AMQPMessageController {
  _service: RpcService;

  constructor(message: AMQPMessage, service: RpcService) {
    super(message);
    this._service = service;
  }

  async reply({ payload, error }: { payload?: ?Object, error?: Error }) {
    const { messageId, correlationId, replyTo } = this._message.props;
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

  async resendAsRetry() {
    const retryLimit = this._message.applicationLevelRetryLimit;

    if (retryLimit === null) {
      throw new Error('Retry disabled');
    }

    const adapter = this._service._getAdapter();

    await adapter.send(
      this._message.sourceQueue,
      this._message.payload,
      this._getPublishOptionsForRetry(),
    );
  }

  _getPublishOptionsForRetry() {
    const { props, applicationLevelRetryLimit } = this._message;

    // @todo decremnt expiration
    // @todo pass routing key
    const mapped: PublishOptions = {
      expiration: props.expiration,
      correlationId: props.correlationId,
      replyTo: props.replyTo,
      exchange: props.exchange,
      userId: props.userId,
      priority: props.priority,
      persistent: props.persistent,
      contentType: props.contentType,
      contentEncoding: props.contentEncoding,
      timestamp: props.timestamp,
      type: props.type,
      appId: props.appId,
      messageId: props.messageId,
      headers: {
        ...props.headers,
        'X-Retry-Limit': applicationLevelRetryLimit,
      },
    };

    return mapped;
  }
}

export default AMQPMessageRpcController;
