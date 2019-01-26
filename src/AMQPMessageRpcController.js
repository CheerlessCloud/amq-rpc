// @flow
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
    const { messageId, correlationId, replyTo } = this._message.props;

    const retryLimit = this._message.applicationLevelRetryLimit;

    if (retryLimit === null) {
      throw new Error('Retry disabled');
    }

    const adapter = this._service._getAdapter();
    await adapter.send(this._message.sourceQueue, this._message.payload, {
      messageId,
      correlationId,
      replyTo,
      headers: {
        ...this._message.props.headers,
        'X-Retry-Limit': retryLimit,
      },
    });
  }
}

export default AMQPMessageRpcController;
