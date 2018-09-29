/* eslint-disable no-param-reassign, no-empty-function */
// @flow
import test from 'ava';
import type { IHandler } from './IHandler';
import HandlerMap from './HandlerMap';

test.beforeEach(t => {
  t.context = {
    createHandler(action: string = 'default'): Class<IHandler> {
      // $FlowFixMe
      return class {
        get action(): string {
          return action;
        }

        async execute() {}
      };
    },
  };
});

test('create instance', t => {
  t.notThrows(() => new HandlerMap());
});

test('add and get handlers', async t => {
  const action1 = 'action1';
  const action2 = 'action2';
  const handler1 = t.context.createHandler(action1);
  const handler2 = t.context.createHandler(action2);
  const handlerMap = new HandlerMap();

  t.notThrows(() => handlerMap.add(handler2));
  t.notThrows(() => handlerMap.add(handler1));

  t.notThrows(() => t.is(handlerMap.get(action1), handler1));
  t.notThrows(() => t.is(handlerMap.get(action2), handler2));
  t.notThrows(() => t.false(handlerMap.get(action2) === handler1));
});

test('throw error on attempt add two handlers with same action', async t => {
  const action = 'action1';
  const handler1 = t.context.createHandler(action);
  const handler2 = t.context.createHandler(action);
  const handlerMap = new HandlerMap();

  t.notThrows(() => handlerMap.add(handler1));

  try {
    handlerMap.add(handler2);
    t.fail('add handler with same action must throw error');
  } catch (err) {
    t.is(err.message, 'Handler for this action already set');
    t.is(err.name, 'HandlerAlreadySet');
    t.is(err.action, action);
  }
});

test('throw error on add handler with incorrect shape', async t => {
  const handlerMap = new HandlerMap();

  try {
    // $FlowFixMe
    handlerMap.add(class {});
    t.fail('add handler with incorrect handler shape must throw error');
  } catch (err) {
    t.is(err.message, 'Handler must class implemented IHandler interface');
    t.is(err.name, 'IncorrectHandlerInterface');
  }

  try {
    handlerMap.add(
      // $FlowFixMe
      class {
        action: 'action1';
      },
    );
    t.fail('add handler with incorrect handler shape must throw error');
  } catch (err) {
    t.is(err.message, 'Handler must class implemented IHandler interface');
    t.is(err.name, 'IncorrectHandlerInterface');
  }

  try {
    handlerMap.add(
      // $FlowFixMe
      class {
        async execute() {}
      },
    );
    t.fail('add handler with incorrect handler shape must throw error');
  } catch (err) {
    t.is(err.message, 'Handler must class implemented IHandler interface');
    t.is(err.name, 'IncorrectHandlerInterface');
  }
});
