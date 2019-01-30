/* eslint-disable no-param-reassign */
import test from 'ava';
import RpcClient from './Client';

test.beforeEach(t => {
  const client = new RpcClient({
    service: '-mock-service-',
    version: '1.2',
    defaultRetryLimit: 3,
  });

  t.context = { client };
});

test('should correct set default retry limit in constructor and apply on send', async t => {
  const { client } = t.context;

  t.deepEqual(client._getRetryLimitHeaders(), {
    'X-Retry-Limit': client._defaultRetryLimit,
  });
});

test('should correct receive retry limit in options', async t => {
  const { client } = t.context;

  t.deepEqual(client._getRetryLimitHeaders({ retryLimit: 5 }), {
    'X-Retry-Limit': 5,
  });
});

test('should empty headers on undefined retry limit in defaults and options', async t => {
  const { client } = t.context;

  client._defaultRetryLimit = undefined;
  t.deepEqual(client._getRetryLimitHeaders(), {});
});
