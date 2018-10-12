/* eslint-disable no-param-reassign */
import test from 'ava';
import { stub } from 'sinon';
import AdapterConsumer from './AdapterConsumer';
import AMQPAdapter from './AMQPAdapter';

test.serial(
  'call ensureConnection on already connected instance should reuse connection',
  async t => {
    const connectStub = stub(AMQPAdapter, 'connect').resolves({});
    const adapterConsumer = new class extends AdapterConsumer {}();
    await adapterConsumer.ensureConnection();

    t.true(connectStub.calledOnce);

    await adapterConsumer.ensureConnection();
    await adapterConsumer.ensureConnection();

    t.true(connectStub.calledOnce);
    connectStub.restore();
  },
);

test.serial(
  'concurrent call ensureConnection on same instance should call once connect',
  async t => {
    let resolvePromise = null;
    const promise = new Promise(resolve => {
      resolvePromise = resolve;
    });

    const connectStub = stub(AMQPAdapter, 'connect').resolves(promise);

    const adapterConsumer = new class extends AdapterConsumer {}();

    const connectPromises = Array.from({ length: 10 }).map(() =>
      adapterConsumer.ensureConnection(),
    );
    resolvePromise({});

    await Promise.all(connectPromises);

    t.true(connectStub.calledOnce);

    connectStub.restore();
  },
);

test.serial('exception flow in call concurrent ensureConnection', async t => {
  const connectError = new Error('Some connection error');
  const connectStub = stub(AMQPAdapter, 'connect')
    .onFirstCall()
    .rejects(connectError)
    .onSecondCall()
    .resolves({});

  const adapterConsumer = new class extends AdapterConsumer {}();

  const connectPromises = Array.from({ length: 10 })
    .map(() => adapterConsumer.ensureConnection({ connectParams: { firstCall: true } }))
    .map(promise => promise.catch(err => ({ err })));

  for (const { err } of await Promise.all(connectPromises)) {
    t.truthy(err);
    t.is(err, connectError);
  }

  t.true(connectStub.calledOnce);
  t.true(connectStub.getCall(0).args.pop().firstCall);

  // try connect again
  await adapterConsumer.ensureConnection({ connectParams: { secondCall: true } });

  t.true(connectStub.calledTwice);
  t.true(connectStub.getCall(1).args.pop().secondCall);

  connectStub.restore();
});
