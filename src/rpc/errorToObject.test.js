// @flow
import test from 'ava';
import EError from 'eerror';
import errorToObject from './errorToObject';

test('call with undefined', t => {
  t.is(errorToObject(undefined), null);
});

test('call with null', t => {
  t.is(errorToObject(null), null);
});

test('call with eerror', t => {
  const error = new EError('My awesome error').combine({
    name: 'AwesomeError',
    foo: { bar: 42 },
  });

  t.deepEqual(errorToObject(error), {
    name: 'AwesomeError',
    foo: { bar: 42 },
    message: 'My awesome error',
    stack: error.stack,
  });
});
