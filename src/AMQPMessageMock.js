import uuid from 'uuid/v4';
// eslint-disable-next-line import/no-extraneous-dependencies
import { stub } from 'sinon';
import AMQPMessage from './AMQPMessage';

const randomNumber = count => Math.round(Math.random() * count);

export const createChannelMock = () => ({
  ack: stub().resolves(undefined),
  reject: stub().resolves(undefined),
});

export const createAmqpMessageObjectMock = ({
  payloadAsBuffer,
  payload = { defaultPayload: 'test' },
  contentType = 'application/json',
  headers = {},
  redelivered = false,
  routingKey = uuid(),
  deliveryTag = randomNumber(1e6),
  correlationId = uuid(),
  replyTo = uuid(),
  messageId = uuid(),
  timestamp = Date.now(),
  type = uuid(),
  appId = uuid(),
} = {}) => ({
  content: payloadAsBuffer || Buffer.from(JSON.stringify(payload)),
  fields: {
    deliveryTag,
    consumerTag: randomNumber(1e6),
    exchange: '',
    routingKey,
    redelivered,
  },
  properties: {
    expiration: '1000',
    userId: uuid(),
    CC: '',
    priority: 100,
    persistent: true,
    contentType,
    contentEncoding: 'utf-8',
    headers,
    correlationId,
    replyTo,
    messageId,
    timestamp,
    type,
    appId,
  },
});

export const createAmqpMessageMock = (
  messageProperties,
  channel = createChannelMock(),
  sourceQueue = uuid(),
  isSealed = false,
) => {
  const amqpMessageObject = createAmqpMessageObjectMock(messageProperties);
  const amqpMessage = new AMQPMessage(amqpMessageObject, channel, sourceQueue, isSealed);
  return {
    message: amqpMessage,
    amqpMessage,
    amqpMessageObject,
    channel,
    sourceQueue,
    isSealed,
  };
};

export default createAmqpMessageMock;
