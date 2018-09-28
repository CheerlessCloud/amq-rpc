// @flow
export default function errorToObject(error: ?Error): null | Object {
  const errorObj = {};

  if (error === undefined) {
    return null;
  } else if (error === null) {
    return null;
  }

  Object.getOwnPropertyNames(error).forEach(key => {
    if (/.*__old\d+/.test(key)) {
      return;
    }

    errorObj[key] = (error: any)[key];
  });

  return errorObj;
}
