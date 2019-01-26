/* eslint-disable no-param-reassign */
import test from 'ava';
import uuid from 'uuid/v4';
import RpcClient from '../src/Client';
import RpcService from '../src/Service';
import RpcHandler from '../src/rpc/Handler';

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
    defaultRetryLimit: 3,
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

  await Promise.all([ctx.client.ensureConnection(), ctx.service.ensureConnection()]);
});

test.afterEach(async t => {
  const { client, service } = t.context;

  try {
    await service.destroy();
  } catch (err) {} // eslint-disable-line no-empty

  try {
    await client.destroy();
  } catch (err) {} // eslint-disable-line no-empty
});

test('should return result when tho fails and one success handle', async t => {
  t.plan(10);
  const { client, service } = t.context;

  const payload = { foo: 'bar' };
  const reply = { bar: 'foo' };
  let handlerCounter = 0;

  await service.addHandler(
    class extends RpcHandler {
      async handle() {
        handlerCounter += 1;
        t.deepEqual(this.payload, payload);
        if (handlerCounter < 3) {
          throw new Error('Some handler error');
        }
        return reply;
      }

      onFail(err) {
        t.truthy('on fail called twice');
        t.is(err.message, 'Some handler error');
      }

      onSuccess() {
        t.truthy('on success called once');
      }
    },
  );

  const callResult = await client.send(payload);
  t.deepEqual(callResult, reply);
  t.is(handlerCounter, 3);
});

test('should correct return error to client when retry limit exceeded', async t => {
  t.plan(8);
  const { client, service } = t.context;

  await client.ensureConnection();
  await service.ensureConnection();

  const payload = { foo: 'bar' };
  let handlerCounter = 0;

  await service.addHandler(
    class extends RpcHandler {
      async handle() {
        handlerCounter += 1;
        throw new Error('Some handler error');
      }

      async onFail(err) {
        t.truthy(err);
        t.is(err.message, 'Some handler error');
      }
    },
  );

  await t.throws(client.send(payload), 'Some handler error');

  t.is(handlerCounter, 3);
});
