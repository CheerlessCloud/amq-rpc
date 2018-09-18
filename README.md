# AMQ RPC

[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)
[![FlowJS](https://img.shields.io/badge/flow-v0.69-yellow.svg)](https://flow.org/en/)
[![Build Status](https://travis-ci.org/CheerlessCloud/amq-rpc.svg?branch=master)](https://travis-ci.org/CheerlessCloud/amq-rpc)
[![Coverage Status](https://coveralls.io/repos/github/CheerlessCloud/amq-rpc/badge.svg?branch=master)](https://coveralls.io/github/CheerlessCloud/amq-rpc?branch=master)

[![Greenkeeper badge](https://badges.greenkeeper.io/CheerlessCloud/amq-rpc.svg)](https://greenkeeper
.io/)
[![dependencies Status](https://david-dm.org/CheerlessCloud/amq-rpc/status.svg)](https://david-dm
.org/CheerlessCloud/amq-rpc)
[![devDependencies Status](https://david-dm.org/CheerlessCloud/amq-rpc/dev-status.svg)](https://david-dm.org/CheerlessCloud/amq-rpc?type=dev)

[![npm](https://img.shields.io/npm/v/amq-rpc.svg)]()
[![node](https://img.shields.io/node/v/amq-rpc.svg)]()
[![MIT License](https://img.shields.io/npm/l/amq-rpc.svg)]()

[![NPM](https://nodei.co/npm/amq-rpc.png?downloads=true&downloadRank=true&stars=true)](https://nodei
.co/npm/eerror/)


> **Attention, module currently in active development ⚠️**<br>**Soon to be released, maybe around
 24 september 2018 🖖**
 
## Samples
Client:

```javascript
import { RpcClient } from 'amq-rpc';

const client = new RpcClient({
  service: 'my-awesome-service',
  version: '1.2',
  connectParams: {
    url: 'amqp://guest:guest@localhost:5672/?vhost=/',
    heartbeat: 30,
  },
  waitResponseTimeout: 30 * 1000, // timeout for wait result from service
});

await client.ensureConnection(); // accept in first param object as connectParams in constructor

const result = await client.send({ foo: 'bar' }, { correlationId: 'e.g. nginx req id' });
const result = await client.call('myAction', { foo: 'bar' }, { correlationId: 'e.g. nginx req id'
 });

await client.destroy();
```

Service:

```javascript
import { RpcClient, RpcServiceHandler } from 'amq-rpc';

const service = new RpcService({
  service: 'my-awesome-service',
  version: '1.2',
  connectParams: {
    url: 'amqp://guest:guest@localhost:5672/?vhost=/',
    heartbeat: 30,
  },
  queue: {
    prefetch: 1,
    durable: true,
    maxPriority: 100,
  },
});

service.setErrorHandler((error) => {
  // All errors, which can't passed to reject operation (as error in subscriber function,
  // outside of user handler), will be passed to this callback.
});

await service.ensureConnection();

// first argument - payload
// second - message, see src/AMQPMessage.js 
await service.setFunctionalHandler(async (receivedPayload, message) => {
  // returned object send to client and return from call/send method
  // if error throwed, message will be rejected
  // so you mustn't manual call ack/reject on message
  return { bar: 'foo' };
});

// In this sample to one service added functional handler and class handler together,
// but in real work it throw error. Service can be only in one "handler mode".
await service.addHandler(class extends RpcServiceHandler {
  get action() {
    return 'myAction';
  }

  async handle() {
    // this.payload - sended payload
    // message, as in functional handler, automatically ack/reject
    return { foo: 42 };
  }
});

await service.addHandler(class extends RpcServiceHandler {
  // If in message type property didn't fill (send without special options),
  // service will find 'default' action
  get action() {
    return 'default';
  }

  async handle() {
    return { bar: 'foo' };
  }
});

// If process receive SIGINT, service will be gracefully stopped
// (wait for handler end work until timeout exceeded and then call for process.exit())
await service.interventSignalInterceptors({ stopSignal: 'SIGINT', gracefulStopTimeout: 10 * 1000 });
```
