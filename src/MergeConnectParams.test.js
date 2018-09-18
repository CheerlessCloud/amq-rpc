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
