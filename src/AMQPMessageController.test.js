/* eslint-disable no-param-reassign */
import test from 'ava';
import AMQPMessageController from './AMQPMessageController';
import { createAmqpMessageMock } from './AMQPMessageMock';

test.beforeEach(t => {
  const ctx = {};
  t.context = ctx;

  const { message } = createAmqpMessageMock();
  ctx.message = message;
  ctx.channel = message._channel;
});

test('construct', t => {
  t.notThrows(() => new AMQPMessageController(t.context.message));
});

test('correct ack', async t => {
  t.plan(3);
  const { channel, message } = t.context;
  const controller = new AMQPMessageController(message);

  await t.notThrows(controller.ack());

  t.true(channel.ack.calledOnce);
  t.false(channel.reject.called);
});

test('correct reject', async t => {
  t.plan(3);
  const { channel, message } = t.context;
  const controller = new AMQPMessageController(message);

  await t.notThrows(controller.reject());

  t.false(channel.ack.called);
  t.true(channel.reject.calledOnceWith(message._amqpMessage, false));
});

test('correct rejectAndRequeue', async t => {
  t.plan(3);
  const { channel, message } = t.context;
  const controller = new AMQPMessageController(message);

  await t.notThrows(controller.rejectAndRequeue());

  t.false(channel.ack.called);
  t.true(channel.reject.calledOnceWith(message._amqpMessage, true));
});

test("can't ack/reject already acked message", async t => {
  t.plan(6);
  const { channel, message } = t.context;
  const controller = new AMQPMessageController(message);

  await t.notThrows(controller.ack());

  const errorMessage = 'Message already acked/rejected or created in sealed mode';
  await t.throws(controller.reject(), errorMessage);
  await t.throws(controller.rejectAndRequeue(), errorMessage);
  await t.throws(controller.ack(), errorMessage);

  t.true(channel.ack.calledOnce);
  t.false(channel.reject.called);
});

test("can't ack/reject already rejected message", async t => {
  t.plan(6);
  const { channel, message } = t.context;
  const controller = new AMQPMessageController(message);

  await t.notThrows(controller.reject());

  const errorMessage = 'Message already acked/rejected or created in sealed mode';
  await t.throws(controller.reject(), errorMessage);
  await t.throws(controller.rejectAndRequeue(), errorMessage);
  await t.throws(controller.ack(), errorMessage);

  t.false(channel.ack.called);
  t.true(channel.reject.calledOnce);
});
