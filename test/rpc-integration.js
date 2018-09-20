/* eslint-disable no-param-reassign */
import test from 'ava';
import uuid from 'uuid/v4';
import EError from 'eerror';
import RpcClient from '../src/Client';
import RpcService from '../src/Service';
import RpcServiceHandler from '../src/RpcServiceHandler';

test.beforeEach(async t => {
  const ctx = {};
  t.context = ctx;

  ctx.serviceName = uuid();
  ctx.serviceVersion = '1.0';
  ctx.connectParams = {
    url: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
  };

  ctx.client = new RpcClient({
    service: ctx.serviceName,
    version: ctx.serviceVersion,
    connectParams: ctx.connectParams,
  });

  ctx.service = new RpcService({
    service: ctx.serviceName,
    version: ctx.serviceVersion,
    connectParams: ctx.connectParams,
    queue: {
      prefetch: 1,
      durable: true,
      maxPriority: 100,
    },
  });
});

test('service and client basic integration', async t => {
  t.plan(2);
  const { client, service } = t.context;

  await client.ensureConnection();
  await service.ensureConnection();

  const payload = { foo: 'bar' };
  const reply = { bar: 'foo' };

  await service.setFunctionalHandler(async receivedPayload => {
    t.deepEqual(receivedPayload, payload);
    return reply;
  });

  const callResult = await client.send(payload);
  t.deepEqual(callResult, reply);

  await service.destroy();
  await client.destroy();
});

// @todo refactor this suite, because asynchronous execution pipeline is too entangled
test('send payload to service without wait response', async t => {
  t.plan(4);
  const { client, service } = t.context;
  await client.ensureConnection();
  await service.ensureConnection();

  const payload = { foo: 'bar' };
  const reply = { bar: 'foo' };

  let handlerIsExecuted = false;
  let sendIsReturnedResult = false;
  let onHandleExecuted = () => {};

  await service.setFunctionalHandler(async receivedPayload => {
    t.deepEqual(receivedPayload, payload);
    t.is(sendIsReturnedResult, true);
    handlerIsExecuted = true;
    onHandleExecuted();
    return reply;
  });

  const callResult = await client.sendWithoutWaitResponse(payload);
  sendIsReturnedResult = true;
  t.is(callResult, undefined);
  t.is(handlerIsExecuted, false);
  await new Promise(resolve => {
    onHandleExecuted = resolve;
  });

  await service.destroy();
  await client.destroy();
});

test('class-based handler for service', async t => {
  t.plan(2);
  const { client, service } = t.context;

  await client.ensureConnection();
  await service.ensureConnection();

  const payload = { foo: 'bar' };
  const reply = { bar: 'foo' };

  await service.addHandler(
    class extends RpcServiceHandler {
      get action() {
        return 'myAction';
      }

      async handle() {
        t.deepEqual(this.payload, payload);
        return reply;
      }
    },
  );

  const callResult = await client.call('myAction', payload);
  t.deepEqual(callResult, reply);

  await service.destroy();
  await client.destroy();
});

test('correct pass error from service', async t => {
  t.plan(6);
  const { client, service } = t.context;

  await client.ensureConnection();
  await service.ensureConnection();
  const payload = { bar: 'foo' };
  const error = new EError('my awesome error').combine({
    foo: 42,
    name: 'MyAwesomeError',
  });

  await service.addHandler(
    class extends RpcServiceHandler {
      async handle() {
        throw EError.wrap(error, this.payload);
      }
    },
  );

  try {
    await client.send(payload);
  } catch (err) {
    t.is(err.name, error.name);
    t.is(err.message, error.message);
    t.is(err.foo, error.foo);
    t.is(err.bar, payload.bar);
    t.is(err.message, error.message);
    t.true(err instanceof EError);
  }

  await service.destroy();
  await client.destroy();
});

test('throw error to client on not found action', async t => {
  t.plan(3);
  const { client, service } = t.context;

  await client.ensureConnection();
  await service.ensureConnection();

  await service.addHandler(
    class extends RpcServiceHandler {
      get action() {
        return 'myAction';
      }

      async handle() {
        t.fail("hmmm, it's impossible!");
      }
    },
  );

  // after first error reject message with requeue
  service.setErrorHandler(err => {
    t.is(err.message, 'Handler for action not found');
  });

  await t.throws(client.call('undefinedAction', { foo: '42' }), 'Handler for action not found');

  await service.destroy();
  await client.destroy();
});
