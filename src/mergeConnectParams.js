// @flow
import { URL } from 'url';
import merge from 'lodash.merge';
import type { ConnectOptions } from './AMQPAdapter';

const defaultParams = { hostname: 'localhost', protocol: 'amqp', port: 5672 };
export default function mergeConnectParams(
  passed: ?ConnectOptions,
  defaults: ?ConnectOptions,
): ConnectOptions {
  const params = merge({}, defaultParams, defaults, passed);

  if (!params.url || typeof params.url !== 'string') {
    return params;
  }

  const url = new URL(params.url);
  const urlObject = {
    protocol: url.protocol.replace(':', ''),
    username: url.username || params.username,
    password: url.password || params.username,
    hostname: url.hostname,
    port: url.port,
  };

  for (const [key, value] of url.searchParams) {
    urlObject[key] = value;
  }

  return merge(params, urlObject);
}
