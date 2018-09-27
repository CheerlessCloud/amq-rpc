// @flow
export default function errorToObject(error: ?Error): void | Object {
  const errorObj = {};

  if (error === undefined) {
    return undefined;
  } else if (error === null) {
    return undefined;
  }

  Object.getOwnPropertyNames(error).forEach(key => {
    if (/.*__old\d+/.test(key)) {
      return;
    }

    errorObj[key] = (error: any)[key];
  });

  return errorObj;
}
