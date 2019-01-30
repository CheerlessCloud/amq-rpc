/* eslint-disable no-param-reassign */
import test from 'ava';
import { spy, stub } from 'sinon';
import uuid from 'uuid/v4';
import EError from 'eerror';
import errorToObject from './errorToObject';
import Handler from './Handler';
import { createAmqpMessageMock } from '../AMQPMessageMock';

test.beforeEach(t => {
  t.context = {};
  t.context.reply = { foo: 42 };
  t.context.AwesomeHandler = class AwesomeHandler extends Handler {
    async handle() {
      return t.context.reply;
    }
  };

  t.context.adapterSendStub = stub().resolves(undefined);
  t.context.adapterStub = {
    send: t.context.adapterSendStub,
  };

  t.context.serviceStub = {
    _errorHandler: stub(),
    _getAdapter: () => t.context.adapterStub,
  };

  const { message } = createAmqpMessageMock({
    payload: { foo: 'bar' },
  });

  t.context.messageStub = message;
});

test('construct handler', async t => {
  const { AwesomeHandler, serviceStub, messageStub } = t.context;
  t.notThrows(
    () =>
      new AwesomeHandler({
        service: serviceStub,
        message: messageStub,
      }),
  );
});

test('positive execute case', async t => {
  const { AwesomeHandler, serviceStub, messageStub } = t.context;
  const handler = new AwesomeHandler({
    service: serviceStub,
    message: messageStub,
  });
  handler.handleFail = err => t.fail(err);

  const beforeHandleSpy = spy(handler, 'beforeHandle');
  const handleSpy = spy(handler, 'handle');
  const afterHandleSpy = spy(handler, 'afterHandle');
  const handleFailSpy = spy(handler, 'handleFail');
  const handleSuccessSpy = spy(handler, 'handleSuccess');
  const onFailSpy = spy(handler, 'onFail');
  const onSuccessSpy = spy(handler, 'onSuccess');

  await t.notThrows(handler.execute());

  t.true(beforeHandleSpy.calledOnce);
  t.true(beforeHandleSpy.calledBefore(handleSpy));

  t.true(handleSpy.calledOnce);
  t.true(handleSpy.calledBefore(handleSuccessSpy));

  t.false(handleFailSpy.called);
  t.false(onFailSpy.called);

  t.true(handleSuccessSpy.calledOnce);
  t.true(handleSuccessSpy.calledBefore(onSuccessSpy));
  t.true(onSuccessSpy.calledOnce);
  t.true(onSuccessSpy.calledBefore(afterHandleSpy));

  t.true(messageStub._channel.ack.calledOnce);
  t.true(messageStub._channel.ack.calledBefore(onSuccessSpy));
  t.false(messageStub._channel.reject.called);

  t.true(afterHandleSpy.calledOnce);
});

test('correct reply at positive execute case', async t => {
  const { AwesomeHandler, serviceStub, messageStub } = t.context;
  const handler = new AwesomeHandler({
    service: serviceStub,
    message: messageStub,
  });
  handler.handleFail = err => t.fail(err);

  const handleSuccessSpy = spy(handler, 'handleSuccess');
  const replySpy = spy(handler._messageController, 'reply');

  await t.notThrows(handler.execute());

  t.true(handleSuccessSpy.calledOnceWith(t.context.reply));
  t.true(replySpy.calledOnceWith({ payload: t.context.reply }));
  t.true(t.context.adapterSendStub.calledOnce);
  t.true(messageStub._channel.ack.calledOnce);
  t.false(messageStub._channel.reject.called);
});

test('correct reply when exception throwed in handler', async t => {
  const { AwesomeHandler, serviceStub, messageStub } = t.context;
  const error = new Error('My awesome error');

  const handler = new AwesomeHandler({
    service: serviceStub,
    message: messageStub,
  });
  stub(handler, 'handle').rejects(error);

  const handleSuccessSpy = spy(handler, 'handleSuccess');
  const handleFailSpy = spy(handler, 'handleFail');
  const onFailSpy = spy(handler, 'onFail');
  const replySpy = spy(handler._messageController, 'reply');

  await t.notThrows(handler.execute());

  t.false(handleSuccessSpy.called);

  t.true(handleFailSpy.calledOnceWith(error));

  t.true(replySpy.calledOnce);
  t.deepEqual(replySpy.firstCall.args.pop(), { error });
  t.true(t.context.adapterSendStub.calledOnce);

  t.false(messageStub._channel.ack.calledOnce);
  t.true(messageStub._channel.reject.calledOnce);

  t.true(onFailSpy.calledOnce);
  t.true(onFailSpy.calledAfter(handleFailSpy));
});

test('correct error flow when exception throwed in handleFail', async t => {
  const { AwesomeHandler, serviceStub, messageStub } = t.context;
  const originalError = new Error('Original error from handle method');
  const error = new Error('Error from handleFail method');

  const handler = new AwesomeHandler({
    service: serviceStub,
    message: messageStub,
  });
  stub(handler, 'handle').rejects(originalError);
  stub(handler, 'handleFail').rejects(error);

  const handleSuccessSpy = spy(handler, 'handleSuccess');
  const onFailSpy = spy(handler, 'onFail');

  await t.notThrows(handler.execute());

  t.true(serviceStub._errorHandler.calledOnce);

  const [finalError] = serviceStub._errorHandler.firstCall.args;
  t.deepEqual(finalError.handleError, originalError);
  t.is(finalError.name, error.name);
  t.is(finalError.message, error.message);
  t.is(finalError.stack, error.stack);
  t.is(finalError.action, handler.action);
  t.is(finalError.messageId, messageStub.id);
  t.is(finalError.correlationId, messageStub.props.correlationId);

  t.false(handleSuccessSpy.called);
  t.false(messageStub._channel.ack.calledOnce);
  t.false(messageStub._channel.reject.calledOnce);
  t.false(onFailSpy.calledOnce);
});

test('correct error flow when exception throwed in afterHandle', async t => {
  const { AwesomeHandler, serviceStub, messageStub } = t.context;
  const error = new Error('Error from afterHandle method');

  const handler = new AwesomeHandler({
    service: serviceStub,
    message: messageStub,
  });
  const afterHandleStub = stub(handler, 'afterHandle').rejects(error);

  const handleSuccessSpy = spy(handler, 'handleSuccess');
  const onSuccessSpy = spy(handler, 'onSuccess');

  await t.notThrows(handler.execute());

  t.true(afterHandleStub.calledOnceWith(null, t.context.reply));
  t.true(serviceStub._errorHandler.calledOnce);

  const [finalError] = serviceStub._errorHandler.firstCall.args;
  t.is(finalError.name, error.name);
  t.is(finalError.message, error.message);
  t.is(finalError.stack, error.stack);
  t.is(finalError.action, handler.action);
  t.is(finalError.messageId, messageStub.id);
  t.is(finalError.correlationId, messageStub.props.correlationId);

  t.true(handleSuccessSpy.called);
  t.true(messageStub._channel.ack.calledOnce);
  t.false(messageStub._channel.reject.calledOnce);
  t.true(onSuccessSpy.calledOnceWith(t.context.reply));
});

test('must override handle method', async t => {
  const { serviceStub, messageStub } = t.context;
  const HandlerClass = class AwesomeHandler2 extends Handler {};
  t.throws(
    () =>
      new HandlerClass({
        service: serviceStub,
        message: messageStub,
      }),
    'You must override handle method',
  );
});

// TODO: move to AMQPMessageRpcController tests
test.skip('reply just return when no replyTo in message', async t => {
  const { AwesomeHandler, serviceStub, messageStub } = t.context;
  const handler = new AwesomeHandler({
    service: serviceStub,
    message: {
      ...messageStub,
      props: {
        ...messageStub.props,
        replyTo: undefined,
      },
    },
  });

  await t.notThrows(handler.reply({ payload: { foo: 42 } }));

  t.false(t.context.adapterSendStub.calledOnce);
  t.false(messageStub._channel.ack.calledOnce);
  t.false(messageStub._channel.reject.calledOnce);
});

// TODO: move to AMQPMessageRpcController tests
test.skip('reply on success', async t => {
  const { AwesomeHandler, serviceStub, messageStub, adapterSendStub } = t.context;
  const {
    messageStub: { props },
  } = t.context;
  const handler = new AwesomeHandler({
    service: serviceStub,
    message: messageStub,
  });

  await t.notThrows(handler.reply({ payload: { foo: 42 } }));

  t.true(adapterSendStub.calledOnce);

  const [queue, payload, options] = adapterSendStub.firstCall.args;
  t.is(queue, props.replyTo);
  t.deepEqual(payload, { payload: { foo: 42 }, error: null });
  t.deepEqual(options, { messageId: props.messageId, correlationId: props.correlationId });

  t.false(messageStub._channel.ack.calledOnce);
  t.false(messageStub._channel.reject.calledOnce);
});

test.skip('reply on error', async t => {
  const { AwesomeHandler, serviceStub, messageStub, adapterSendStub } = t.context;
  const error = new EError('My awesome error').combine({
    name: 'AwesomeError',
    foo: { bar: 42 },
  });
  const {
    messageStub: { props },
  } = t.context;
  const handler = new AwesomeHandler({
    service: serviceStub,
    message: messageStub,
  });

  await t.notThrows(handler.reply({ error }));

  t.true(adapterSendStub.calledOnce);

  const [queue, payload, options] = adapterSendStub.firstCall.args;
  t.is(queue, props.replyTo);
  t.deepEqual(payload, { payload: null, error: errorToObject(error) });
  t.deepEqual(options, { messageId: props.messageId, correlationId: props.correlationId });

  t.false(messageStub._channel.ack.calledOnce);
  t.false(messageStub._channel.reject.calledOnce);
});

test('default action name', async t => {
  const { AwesomeHandler, serviceStub, messageStub } = t.context;
  t.is(AwesomeHandler.prototype.action, 'default');

  const handler = new AwesomeHandler({
    service: serviceStub,
    message: messageStub,
  });

  t.is(handler.action, 'default');
});

test('payload getter', async t => {
  const { AwesomeHandler, serviceStub, messageStub } = t.context;
  const payload = { foo: 42, bar: { baz: '11' } };
  const handler = new AwesomeHandler({
    service: serviceStub,
    message: {
      ...messageStub,
      get payload() {
        t.pass();
        return payload;
      },
    },
  });

  t.deepEqual(handler.payload, payload);
});

test('#retry - fail with retry 1 and rejected', async t => {
  const { AwesomeHandler, serviceStub } = t.context;

  const { message } = createAmqpMessageMock({
    headers: {
      'X-Retry-Limit': 1,
    },
    redelivered: true,
  });

  const handler = new AwesomeHandler({
    service: serviceStub,
    message,
  });

  const beforeHandleSpy = spy(handler, 'beforeHandle');
  const handleSpy = spy(handler, 'handle');
  const afterHandleSpy = spy(handler, 'afterHandle');
  const handleFailSpy = spy(handler, 'handleFail');
  const handleSuccessSpy = spy(handler, 'handleSuccess');
  const onFailSpy = spy(handler, 'onFail');
  const onSuccessSpy = spy(handler, 'onSuccess');

  await t.notThrows(handler.execute());

  t.false(beforeHandleSpy.called);
  t.false(handleSpy.called);
  t.true(handleFailSpy.called);
  t.true(onFailSpy.called);

  t.false(handleSuccessSpy.called);
  t.false(onSuccessSpy.called);

  t.true(message._channel.reject.calledOnce);
  t.false(message._channel.ack.called);
  t.true(afterHandleSpy.calledOnce);
});

test('#retry - reject when retry 1 and error throwed', async t => {
  const { AwesomeHandler, serviceStub } = t.context;

  class MyHandler extends AwesomeHandler {
    async handle() {
      throw new Error();
    }
  }

  const { message } = createAmqpMessageMock({
    headers: {
      'X-Retry-Limit': 1,
    },
    redelivered: false,
  });

  const handler = new MyHandler({
    service: serviceStub,
    message,
  });

  const beforeHandleSpy = spy(handler, 'beforeHandle');
  const handleSpy = spy(handler, 'handle');
  const afterHandleSpy = spy(handler, 'afterHandle');
  const handleFailSpy = spy(handler, 'handleFail');
  const handleSuccessSpy = spy(handler, 'handleSuccess');
  const onFailSpy = spy(handler, 'onFail');
  const onSuccessSpy = spy(handler, 'onSuccess');

  await t.notThrows(handler.execute());

  t.true(beforeHandleSpy.called);
  t.true(handleSpy.called);
  t.true(handleFailSpy.called);
  t.true(onFailSpy.called);

  t.false(handleSuccessSpy.called);
  t.false(onSuccessSpy.called);

  t.true(message._channel.reject.calledOnce);
  t.false(message._channel.ack.called);
  t.true(afterHandleSpy.calledOnce);
});

test('#retry - resend message when retry 2 and error throwed', async t => {
  const { AwesomeHandler, serviceStub, adapterSendStub } = t.context;

  class MyHandler extends AwesomeHandler {
    async handle() {
      throw new Error();
    }
  }

  const sourceQueueName = uuid();
  const { message } = createAmqpMessageMock(
    {
      headers: {
        'X-Retry-Limit': 3,
      },
    },
    undefined,
    sourceQueueName,
  );

  const handler = new MyHandler({
    service: serviceStub,
    message,
  });

  const beforeHandleSpy = spy(handler, 'beforeHandle');
  const handleSpy = spy(handler, 'handle');
  const afterHandleSpy = spy(handler, 'afterHandle');
  const handleFailSpy = spy(handler, 'handleFail');
  const handleSuccessSpy = spy(handler, 'handleSuccess');
  const onFailSpy = spy(handler, 'onFail');
  const onSuccessSpy = spy(handler, 'onSuccess');
  const sendRetrySpy = spy(handler._messageController, 'resendAsRetry');

  await t.notThrows(handler.execute());

  t.true(beforeHandleSpy.called);
  t.true(handleSpy.called);
  t.true(handleFailSpy.called);
  t.true(onFailSpy.called);

  t.false(handleSuccessSpy.called);
  t.false(onSuccessSpy.called);

  t.false(message._channel.reject.calledOnce);
  t.true(message._channel.ack.called);
  t.true(sendRetrySpy.calledOnce);
  t.is(adapterSendStub.args.pop()[0], sourceQueueName);
  t.true(afterHandleSpy.calledOnce);
});
