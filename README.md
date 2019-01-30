# AMQ RPC

[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)
[![Conventional Changelog](https://img.shields.io/badge/changelog-conventional-brightgreen.svg)](https://github.com/conventional-changelog/conventional-changelog/tree/master/packages/conventional-changelog-angular)
[![FlowJS](https://img.shields.io/badge/flow-v0.69-yellow.svg)](https://flow.org/en/)
[![Build Status](https://travis-ci.org/CheerlessCloud/amq-rpc.svg?branch=master)](https://travis-ci.org/CheerlessCloud/amq-rpc)
[![Coverage Status](https://coveralls.io/repos/github/CheerlessCloud/amq-rpc/badge.svg?branch=master)](https://coveralls.io/github/CheerlessCloud/amq-rpc?branch=master)

[![Greenkeeper badge](https://badges.greenkeeper.io/CheerlessCloud/amq-rpc.svg)](https://greenkeeper.io/)
[![dependencies Status](https://david-dm.org/CheerlessCloud/amq-rpc/status.svg)](https://david-dm.org/CheerlessCloud/amq-rpc)
[![devDependencies Status](https://david-dm.org/CheerlessCloud/amq-rpc/dev-status.svg)](https://david-dm.org/CheerlessCloud/amq-rpc?type=dev)

[![npm](https://img.shields.io/npm/v/amq-rpc.svg)]()
[![node](https://img.shields.io/node/v/amq-rpc.svg)]()
[![MIT License](https://img.shields.io/npm/l/amq-rpc.svg)]()

[![NPM](https://nodei.co/npm/amq-rpc.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/eerror/)


> **Attention, module currently in active development ⚠️**<br>**Soon to be released, maybe around
 30 february 2019 🖖**

## Samples
Client:

```javascript
import { RpcClient } from 'amq-rpc';

(async () => {
  const client = new RpcClient({
    service: 'my-awesome-service',
    version: '1.2',
    connectParams: {
      url: 'amqp://guest:guest@localhost:5672/?vhost=/',
      heartbeat: 30,
    },
    waitResponseTimeout: 30 * 1000, // timeout for wait result from service
    defaultRetryLimit: 10 // retry limit, by default retry 1 (disabled)
  });

  await client.ensureConnection(); // accept in first param object as connectParams in constructor

  // equal to call 'default' handler
  const result = await client.send({ foo: 'bar' }, {
    correlationId: 'e.g. nginx req id',
    retryLimit: 5, // override default from constructor
  });
  const result2 = await client.call('myAction', { foo: 'bar' }, {
    correlationId: 'e.g. nginx req id',
    retryLimit: 5, // override default from constructor
  });

  await client.destroy();
})().catch(err => console.error(err) || process.exit(1));
```

Service:

```javascript
import { RpcService, RpcServiceHandler } from 'amq-rpc';

(async () => {
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

  await service.addHandler(class extends RpcServiceHandler {
    // If in message "type" property didn't fill (send without special options),
    // service will find handler with action 'default'
    get action() {
      // in base class, RpcServiceHandler, action equal to 'default'
      return 'myAction2';
    }

    async beforeHandle() {
      // called nearly before handle method
      // use it for prepare data, init resources or logging
      // all throwed errors, as in handle method passed to handleFail method
    }

    // ⚠️ you must redefine this method from RpcServiceHandler class
    async handle() {
      // this.payload - sended payload
      // this.context - special object, shared between methods. By default equal to {}.
      // returned data passed to client as reply payload
      return { bar: 'foo' };
    }

    // ⚠️ redefine this method only if you know what you do
    async handleFail(error: Error) {
      /*
        In base class, RpcServiceHandler:
         - if retry disabled or retry limit exceeded
          - reject message in queue
          - reply to client error with messageId and correlationId
         - else
          - ack currect message
          - resend message to source queue with decremented retry limit header
       */
      // you can redefine and customize error handling behavior
    }

    // ⚠️ redefine this method only if you know what you do
    async handleSuccess(replyPayload: Object) {
      /*
        In base class, RpcServiceHandler:
         - ack message in queue
         - reply to client with payload and error: null
       */
      // you can redefine and customize success handling behavior
    }

    async onFail(error: Error) {
      // hook for logging
    }

    async onSuccess(replyPayload: Object) {
      // hook for logging
    }

    async afterHandle(error: ?Error, replyPayload: ?Object) {
      // if current handler failed, error passed in first argument
      // if success handling, replyPayload passed as second argument
      // use it for logging or deinit resouces
      // wrap this code in try..catch block, because all errors from afterHandle method just
      // pass to error handler callback
    }
  });

  // Minimal handler
  await service.addHandler(class extends RpcServiceHandler {
    async handle() {
      return { bar: `${this.payload.foo} 42` };
    }
  });

  await service.ensureConnection();

  // If process receive SIGINT, service will be gracefully stopped
  // (wait for handler end work until timeout exceeded and then call for process.exit())
  await service.interventSignalInterceptors({ stopSignal: 'SIGINT', gracefulStopTimeout: 10 * 1000 });
})().catch(err => console.error(err) || process.exit(1));
```
