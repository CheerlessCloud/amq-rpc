/* eslint-disable no-param-reassign */
import test from 'ava';
import uuid from 'uuid/v4';
import AMQPAdapter from '../src/AMQPAdapter';

test.beforeEach(async t => {
  const ctx = {};
  t.context = ctx;

  ctx.connectParams = {
    url: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
  };

  ctx.adapter = await AMQPAdapter.connect(ctx.connectParams);
  ctx.queue = uuid();
});

test('correct ack message after unsubscribe', async t => {
  t.plan(1);
  let readyToCancel = null;
  const readyToCancelPromise = new Promise(resolve => {
    readyToCancel = resolve;
  });

  const { adapter, queue } = t.context;

  await adapter.ensureQueue({ name: queue, durable: false });

  await adapter.subscribe(queue, async msg => {
    try {
      await adapter._unsubscribeAll();
      await msg.ack();
      t.pass('message correctly acked after unsubscribe');
    } catch (err) {
      t.fail(err);
    } finally {
      readyToCancel();
    }
  });

  await adapter.send(queue, { foo: 42 });

  await readyToCancelPromise;
});

test('throw error on undefined handler function at subscribe', async t => {
  const { adapter, queue } = t.context;

  await adapter.ensureQueue({ name: queue, durable: false });

  await t.throws(adapter.subscribe(queue, { noAck: true }), 'Handler must be function');
});
