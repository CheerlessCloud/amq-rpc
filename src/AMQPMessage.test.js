/* eslint-disable no-param-reassign */
import test from 'ava';
import uuid from 'uuid/v4';
import AMQPMessage from './AMQPMessage';

test.beforeEach(t => {
  const ctx = {};
  t.context = ctx;

  ctx.channel = {
    ack: () => {},
    reject: () => {},
  };

  ctx.getAmqpMessageObject = (payloadBuffer, contentType) => ({
    content: payloadBuffer,
    fields: {
      deliveryTag: uuid(),
      consumerTag: uuid(),
      exchange: '',
      routingKey: uuid(),
      redelivered: false,
    },
    properties: {
      expiration: '1000',
      userId: uuid(),
      CC: '',
      priority: 100,
      persistent: true,
      contentType,
      contentEncoding: 'utf-8',
      headers: {},
      correlationId: uuid(),
      replyTo: uuid(),
      messageId: uuid(),
      timestamp: Date.now(),
      type: uuid(),
      appId: uuid(),
    },
  });
});

test('construct', t => {
  const amqpMessage = t.context.getAmqpMessageObject(Buffer.from('1'));
  const message = new AMQPMessage(amqpMessage, t.context.channel);
  t.true(message instanceof AMQPMessage);
});

test('get payload object', t => {
  const payload = { foo: 42 };
  const payloadAsString = JSON.stringify(payload);
  const payloadAsBuffer = Buffer.from(payloadAsString);
  const amqpMessage = t.context.getAmqpMessageObject(payloadAsBuffer);
  const message = new AMQPMessage(amqpMessage, t.context.channel);

  t.deepEqual(message.payload, payload);
  t.is(message.getPayloadAsString(), payloadAsString);
  t.deepEqual(message.getPayloadAsObject(), payload);
  t.deepEqual(message.getPayloadAsBuffer(), payloadAsBuffer);
});

// @todo implement this behavior in message and in service/client
test.skip('get payload buffer', t => {
  const payloadAsBuffer = Buffer.from('myawesomebuffer: 0x12FFFF');
  const amqpMessage = t.context.getAmqpMessageObject(payloadAsBuffer, 'buffer');
  const message = new AMQPMessage(amqpMessage, t.context.channel);

  t.deepEqual(message.payload, payloadAsBuffer);
  t.is(message.getPayloadAsString(), 'myawesomebuffer: 0x12FFFF');
  t.throws(() => message.getPayloadAsObject());
  t.deepEqual(message.getPayloadAsBuffer(), payloadAsBuffer);
});

test('correct ack', async t => {
  t.plan(1);
  const { channel } = t.context;

  const amqpMessage = t.context.getAmqpMessageObject(Buffer.from('1'));

  channel.ack = async message => {
    t.is(message, amqpMessage);
  };

  const message = new AMQPMessage(amqpMessage, channel);

  await message.ack();
});

test('correct reject', async t => {
  t.plan(2);
  const { channel } = t.context;

  const amqpMessage = t.context.getAmqpMessageObject(Buffer.from('1'));

  channel.reject = async (message, requeue) => {
    t.is(message, amqpMessage);
    t.is(requeue, false);
  };

  const message = new AMQPMessage(amqpMessage, channel);

  await message.reject();
});

test('correct rejectAndRequeue', async t => {
  t.plan(2);
  const { channel } = t.context;

  const amqpMessage = t.context.getAmqpMessageObject(Buffer.from('1'));

  channel.reject = async (message, requeue) => {
    t.is(message, amqpMessage);
    t.is(requeue, true);
  };

  const message = new AMQPMessage(amqpMessage, channel);

  await message.rejectAndRequeue();
});

test("can't ack or reject already acked/rejected message", async t => {
  t.plan(2);
  const { channel } = t.context;
  channel.reject = async () => {
    t.pass('rejected');
  };

  const amqpMessage = t.context.getAmqpMessageObject(Buffer.from('1'));
  const message = new AMQPMessage(amqpMessage, channel);

  await message.reject();
  await t.throws(message.reject(), 'Message already acked/rejected or created in sealed mode');
});
