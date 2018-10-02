import mergeWith = require('lodash.mergewith');

function customizer(objValue, srcValue) {
  if (Array.isArray(objValue)) {
    return srcValue;
  }
}

/** Like lodash.merge, but doesn't merge arrays */
export function merge(target, ...sources) {
  return mergeWith(target, ...sources, customizer);
}
