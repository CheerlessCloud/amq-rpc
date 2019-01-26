import test from 'ava';
import AMQPMessage from './AMQPMessage';
import {
  createAmqpMessageMock,
  createChannelMock,
  createAmqpMessageObjectMock,
} from './AMQPMessageMock';

test('construct AMQPMessage', t => {
  const amqpMessage = createAmqpMessageObjectMock({
    payload: { foo: 42 },
  });
  const channel = createChannelMock();

  t.notThrows(() => new AMQPMessage(amqpMessage, channel));
});

test('get payload object', t => {
  const payload = { foo: 42 };
  const payloadAsString = JSON.stringify(payload);
  const payloadAsBuffer = Buffer.from(payloadAsString);
  const { message } = createAmqpMessageMock({ payloadAsBuffer });

  t.deepEqual(message.payload, payload);
  t.is(message.getPayloadAsString(), payloadAsString);
  t.deepEqual(message.getPayloadAsObject(), payload);
  t.deepEqual(message.getPayloadAsBuffer(), payloadAsBuffer);
});

test('application level retry getters', t => {
  const { message: messageWithRetry } = createAmqpMessageMock({
    headers: {
      'X-Retry-Limit': 4,
    },
  });

  t.true(messageWithRetry.isApplicationLevelRetryEnabled);
  t.is(messageWithRetry.applicationLevelRetryLimit, 4);

  const { message: messageWithoutRetry } = createAmqpMessageMock();

  t.false(messageWithoutRetry.isApplicationLevelRetryEnabled);
  t.is(messageWithoutRetry.applicationLevelRetryLimit, null);
});

test('application level retry limit setter', t => {
  const { message, amqpMessageObject } = createAmqpMessageMock({
    headers: {
      'X-Retry-Limit': '4',
    },
  });

  t.true(message.isApplicationLevelRetryEnabled);
  t.is(message.applicationLevelRetryLimit, 4);
  t.is(amqpMessageObject.properties.headers['X-Retry-Limit'], '4');

  message.setApplicationLevelRetryLimit(6);

  t.true(message.isApplicationLevelRetryEnabled);
  t.is(message.applicationLevelRetryLimit, 6);
  t.is(amqpMessageObject.properties.headers['X-Retry-Limit'], '6');
});
