/* eslint-disable no-param-reassign */
// @flow
import test from 'ava';
import { spy, stub } from 'sinon';
import uuid from 'uuid/v4';
import Handler from './Handler';

test.beforeEach(t => {
  t.context = {};
  t.context.reply = { foo: 42 };
  t.context.AwesomeHandler = class AwesomeHandler extends Handler {
    async handle() {
      return t.context.reply;
    }
  };
  t.context.adapterSendStub = stub().resolves(undefined);
  t.context.serviceStub = {
    _getAdapter: () => ({
      send: t.context.adapterSendStub,
    }),
  };
  t.context.messageStub = {
    id: uuid(),
    _props: {
      messageId: uuid(),
      correlationId: uuid(),
      replyTo: uuid(),
    },
    payload: { foo: 'bar' },
    ack: stub().resolves(undefined),
    reject: stub().resolves(undefined),
  };
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

  t.true(messageStub.ack.calledOnce);
  t.true(messageStub.ack.calledBefore(onSuccessSpy));
  t.false(messageStub.reject.called);

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
  const replySpy = spy(handler, 'reply');

  await t.notThrows(handler.execute());

  t.true(handleSuccessSpy.calledOnceWith(t.context.reply));
  t.true(replySpy.calledOnceWith({ payload: t.context.reply }));
  t.true(t.context.adapterSendStub.calledOnce);
  t.true(messageStub.ack.calledOnce);
  t.false(messageStub.reject.called);
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
