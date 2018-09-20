// @flow
import test from 'ava';
import mergeConnectParams from './mergeConnectParams';

test('full test merging params', t => {
  t.deepEqual(
    mergeConnectParams(
      {
        url: 'amqps://guest:guest@localhost:5572/?vhost=/',
        someAdditionalArg: 'true',
        socket: { noDelay: true },
      },
      {
        protocol: 'amqp',
        socket: {
          passphrase: '42',
        },
      },
    ),
    {
      hostname: 'localhost',
      protocol: 'amqps',
      port: '5572',
      url: 'amqps://guest:guest@localhost:5572/?vhost=/',
      someAdditionalArg: 'true',
      username: 'guest',
      password: 'guest',
      vhost: '/',
      socket: { noDelay: true, passphrase: '42' },
    },
  );
});

test('test merging minimal arguments', t => {
  t.deepEqual(
    mergeConnectParams({
      url: 'amqp://localhost:5572/?heartbeat=30',
    }),
    {
      hostname: 'localhost',
      protocol: 'amqp',
      port: '5572',
      url: 'amqp://localhost:5572/?heartbeat=30',
      heartbeat: '30',
      password: undefined,
      username: undefined,
    },
  );
});

test('merge object params and defaults', t => {
  t.deepEqual(
    mergeConnectParams(
      {
        someAdditionalArg: 'true',
        socket: { noDelay: true },
      },
      {
        protocol: 'amqp',
        socket: {
          passphrase: '42',
        },
      },
    ),
    {
      hostname: 'localhost',
      protocol: 'amqp',
      port: 5672,
      socket: { noDelay: true, passphrase: '42' },
      someAdditionalArg: 'true',
    },
  );
});

test('merge object params and defaults with url', t => {
  t.deepEqual(
    mergeConnectParams(
      {
        someAdditionalArg: 'true',
        socket: { noDelay: true },
      },
      {
        url: 'amqps://guest:guest@localhost:5567?vhost=/',
      },
    ),
    {
      hostname: 'localhost',
      protocol: 'amqps',
      port: '5567',
      socket: { noDelay: true },
      someAdditionalArg: 'true',
      url: 'amqps://guest:guest@localhost:5567?vhost=/',
      username: 'guest',
      password: 'guest',
      vhost: '/',
    },
  );
});
