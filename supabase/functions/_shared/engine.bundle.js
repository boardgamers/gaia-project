globalThis.seedrandom=globalThis.seedrandom;
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __commonJS = (cb, mod) => function __require2() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key2 of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key2) && key2 !== except)
        __defProp(to, key2, { get: () => from[key2], enumerable: !(desc = __getOwnPropDesc(from, key2)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// engine/node_modules/.pnpm/lodash@4.18.1/node_modules/lodash/lodash.js
var require_lodash = __commonJS({
  "engine/node_modules/.pnpm/lodash@4.18.1/node_modules/lodash/lodash.js"(exports, module) {
    (function() {
      var undefined2;
      var VERSION = "4.18.1";
      var LARGE_ARRAY_SIZE = 200;
      var CORE_ERROR_TEXT = "Unsupported core-js use. Try https://npms.io/search?q=ponyfill.", FUNC_ERROR_TEXT = "Expected a function", INVALID_TEMPL_VAR_ERROR_TEXT = "Invalid `variable` option passed into `_.template`", INVALID_TEMPL_IMPORTS_ERROR_TEXT = "Invalid `imports` option passed into `_.template`";
      var HASH_UNDEFINED = "__lodash_hash_undefined__";
      var MAX_MEMOIZE_SIZE = 500;
      var PLACEHOLDER = "__lodash_placeholder__";
      var CLONE_DEEP_FLAG = 1, CLONE_FLAT_FLAG = 2, CLONE_SYMBOLS_FLAG = 4;
      var COMPARE_PARTIAL_FLAG = 1, COMPARE_UNORDERED_FLAG = 2;
      var WRAP_BIND_FLAG = 1, WRAP_BIND_KEY_FLAG = 2, WRAP_CURRY_BOUND_FLAG = 4, WRAP_CURRY_FLAG = 8, WRAP_CURRY_RIGHT_FLAG = 16, WRAP_PARTIAL_FLAG = 32, WRAP_PARTIAL_RIGHT_FLAG = 64, WRAP_ARY_FLAG = 128, WRAP_REARG_FLAG = 256, WRAP_FLIP_FLAG = 512;
      var DEFAULT_TRUNC_LENGTH = 30, DEFAULT_TRUNC_OMISSION = "...";
      var HOT_COUNT = 800, HOT_SPAN = 16;
      var LAZY_FILTER_FLAG = 1, LAZY_MAP_FLAG = 2, LAZY_WHILE_FLAG = 3;
      var INFINITY = 1 / 0, MAX_SAFE_INTEGER = 9007199254740991, MAX_INTEGER = 17976931348623157e292, NAN = 0 / 0;
      var MAX_ARRAY_LENGTH = 4294967295, MAX_ARRAY_INDEX = MAX_ARRAY_LENGTH - 1, HALF_MAX_ARRAY_LENGTH = MAX_ARRAY_LENGTH >>> 1;
      var wrapFlags = [
        ["ary", WRAP_ARY_FLAG],
        ["bind", WRAP_BIND_FLAG],
        ["bindKey", WRAP_BIND_KEY_FLAG],
        ["curry", WRAP_CURRY_FLAG],
        ["curryRight", WRAP_CURRY_RIGHT_FLAG],
        ["flip", WRAP_FLIP_FLAG],
        ["partial", WRAP_PARTIAL_FLAG],
        ["partialRight", WRAP_PARTIAL_RIGHT_FLAG],
        ["rearg", WRAP_REARG_FLAG]
      ];
      var argsTag = "[object Arguments]", arrayTag = "[object Array]", asyncTag = "[object AsyncFunction]", boolTag = "[object Boolean]", dateTag = "[object Date]", domExcTag = "[object DOMException]", errorTag = "[object Error]", funcTag = "[object Function]", genTag = "[object GeneratorFunction]", mapTag = "[object Map]", numberTag = "[object Number]", nullTag = "[object Null]", objectTag = "[object Object]", promiseTag = "[object Promise]", proxyTag = "[object Proxy]", regexpTag = "[object RegExp]", setTag = "[object Set]", stringTag = "[object String]", symbolTag = "[object Symbol]", undefinedTag = "[object Undefined]", weakMapTag = "[object WeakMap]", weakSetTag = "[object WeakSet]";
      var arrayBufferTag = "[object ArrayBuffer]", dataViewTag = "[object DataView]", float32Tag = "[object Float32Array]", float64Tag = "[object Float64Array]", int8Tag = "[object Int8Array]", int16Tag = "[object Int16Array]", int32Tag = "[object Int32Array]", uint8Tag = "[object Uint8Array]", uint8ClampedTag = "[object Uint8ClampedArray]", uint16Tag = "[object Uint16Array]", uint32Tag = "[object Uint32Array]";
      var reEmptyStringLeading = /\b__p \+= '';/g, reEmptyStringMiddle = /\b(__p \+=) '' \+/g, reEmptyStringTrailing = /(__e\(.*?\)|\b__t\)) \+\n'';/g;
      var reEscapedHtml = /&(?:amp|lt|gt|quot|#39);/g, reUnescapedHtml = /[&<>"']/g, reHasEscapedHtml = RegExp(reEscapedHtml.source), reHasUnescapedHtml = RegExp(reUnescapedHtml.source);
      var reEscape = /<%-([\s\S]+?)%>/g, reEvaluate = /<%([\s\S]+?)%>/g, reInterpolate = /<%=([\s\S]+?)%>/g;
      var reIsDeepProp = /\.|\[(?:[^[\]]*|(["'])(?:(?!\1)[^\\]|\\.)*?\1)\]/, reIsPlainProp = /^\w*$/, rePropName = /[^.[\]]+|\[(?:(-?\d+(?:\.\d+)?)|(["'])((?:(?!\2)[^\\]|\\.)*?)\2)\]|(?=(?:\.|\[\])(?:\.|\[\]|$))/g;
      var reRegExpChar = /[\\^$.*+?()[\]{}|]/g, reHasRegExpChar = RegExp(reRegExpChar.source);
      var reTrimStart = /^\s+/;
      var reWhitespace = /\s/;
      var reWrapComment = /\{(?:\n\/\* \[wrapped with .+\] \*\/)?\n?/, reWrapDetails = /\{\n\/\* \[wrapped with (.+)\] \*/, reSplitDetails = /,? & /;
      var reAsciiWord = /[^\x00-\x2f\x3a-\x40\x5b-\x60\x7b-\x7f]+/g;
      var reForbiddenIdentifierChars = /[()=,{}\[\]\/\s]/;
      var reEscapeChar = /\\(\\)?/g;
      var reEsTemplate = /\$\{([^\\}]*(?:\\.[^\\}]*)*)\}/g;
      var reFlags = /\w*$/;
      var reIsBadHex = /^[-+]0x[0-9a-f]+$/i;
      var reIsBinary = /^0b[01]+$/i;
      var reIsHostCtor = /^\[object .+?Constructor\]$/;
      var reIsOctal = /^0o[0-7]+$/i;
      var reIsUint = /^(?:0|[1-9]\d*)$/;
      var reLatin = /[\xc0-\xd6\xd8-\xf6\xf8-\xff\u0100-\u017f]/g;
      var reNoMatch = /($^)/;
      var reUnescapedString = /['\n\r\u2028\u2029\\]/g;
      var rsAstralRange = "\\ud800-\\udfff", rsComboMarksRange = "\\u0300-\\u036f", reComboHalfMarksRange = "\\ufe20-\\ufe2f", rsComboSymbolsRange = "\\u20d0-\\u20ff", rsComboRange = rsComboMarksRange + reComboHalfMarksRange + rsComboSymbolsRange, rsDingbatRange = "\\u2700-\\u27bf", rsLowerRange = "a-z\\xdf-\\xf6\\xf8-\\xff", rsMathOpRange = "\\xac\\xb1\\xd7\\xf7", rsNonCharRange = "\\x00-\\x2f\\x3a-\\x40\\x5b-\\x60\\x7b-\\xbf", rsPunctuationRange = "\\u2000-\\u206f", rsSpaceRange = " \\t\\x0b\\f\\xa0\\ufeff\\n\\r\\u2028\\u2029\\u1680\\u180e\\u2000\\u2001\\u2002\\u2003\\u2004\\u2005\\u2006\\u2007\\u2008\\u2009\\u200a\\u202f\\u205f\\u3000", rsUpperRange = "A-Z\\xc0-\\xd6\\xd8-\\xde", rsVarRange = "\\ufe0e\\ufe0f", rsBreakRange = rsMathOpRange + rsNonCharRange + rsPunctuationRange + rsSpaceRange;
      var rsApos = "['\u2019]", rsAstral = "[" + rsAstralRange + "]", rsBreak = "[" + rsBreakRange + "]", rsCombo = "[" + rsComboRange + "]", rsDigits = "\\d+", rsDingbat = "[" + rsDingbatRange + "]", rsLower = "[" + rsLowerRange + "]", rsMisc = "[^" + rsAstralRange + rsBreakRange + rsDigits + rsDingbatRange + rsLowerRange + rsUpperRange + "]", rsFitz = "\\ud83c[\\udffb-\\udfff]", rsModifier = "(?:" + rsCombo + "|" + rsFitz + ")", rsNonAstral = "[^" + rsAstralRange + "]", rsRegional = "(?:\\ud83c[\\udde6-\\uddff]){2}", rsSurrPair = "[\\ud800-\\udbff][\\udc00-\\udfff]", rsUpper = "[" + rsUpperRange + "]", rsZWJ = "\\u200d";
      var rsMiscLower = "(?:" + rsLower + "|" + rsMisc + ")", rsMiscUpper = "(?:" + rsUpper + "|" + rsMisc + ")", rsOptContrLower = "(?:" + rsApos + "(?:d|ll|m|re|s|t|ve))?", rsOptContrUpper = "(?:" + rsApos + "(?:D|LL|M|RE|S|T|VE))?", reOptMod = rsModifier + "?", rsOptVar = "[" + rsVarRange + "]?", rsOptJoin = "(?:" + rsZWJ + "(?:" + [rsNonAstral, rsRegional, rsSurrPair].join("|") + ")" + rsOptVar + reOptMod + ")*", rsOrdLower = "\\d*(?:1st|2nd|3rd|(?![123])\\dth)(?=\\b|[A-Z_])", rsOrdUpper = "\\d*(?:1ST|2ND|3RD|(?![123])\\dTH)(?=\\b|[a-z_])", rsSeq = rsOptVar + reOptMod + rsOptJoin, rsEmoji = "(?:" + [rsDingbat, rsRegional, rsSurrPair].join("|") + ")" + rsSeq, rsSymbol = "(?:" + [rsNonAstral + rsCombo + "?", rsCombo, rsRegional, rsSurrPair, rsAstral].join("|") + ")";
      var reApos = RegExp(rsApos, "g");
      var reComboMark = RegExp(rsCombo, "g");
      var reUnicode = RegExp(rsFitz + "(?=" + rsFitz + ")|" + rsSymbol + rsSeq, "g");
      var reUnicodeWord = RegExp([
        rsUpper + "?" + rsLower + "+" + rsOptContrLower + "(?=" + [rsBreak, rsUpper, "$"].join("|") + ")",
        rsMiscUpper + "+" + rsOptContrUpper + "(?=" + [rsBreak, rsUpper + rsMiscLower, "$"].join("|") + ")",
        rsUpper + "?" + rsMiscLower + "+" + rsOptContrLower,
        rsUpper + "+" + rsOptContrUpper,
        rsOrdUpper,
        rsOrdLower,
        rsDigits,
        rsEmoji
      ].join("|"), "g");
      var reHasUnicode = RegExp("[" + rsZWJ + rsAstralRange + rsComboRange + rsVarRange + "]");
      var reHasUnicodeWord = /[a-z][A-Z]|[A-Z]{2}[a-z]|[0-9][a-zA-Z]|[a-zA-Z][0-9]|[^a-zA-Z0-9 ]/;
      var contextProps = [
        "Array",
        "Buffer",
        "DataView",
        "Date",
        "Error",
        "Float32Array",
        "Float64Array",
        "Function",
        "Int8Array",
        "Int16Array",
        "Int32Array",
        "Map",
        "Math",
        "Object",
        "Promise",
        "RegExp",
        "Set",
        "String",
        "Symbol",
        "TypeError",
        "Uint8Array",
        "Uint8ClampedArray",
        "Uint16Array",
        "Uint32Array",
        "WeakMap",
        "_",
        "clearTimeout",
        "isFinite",
        "parseInt",
        "setTimeout"
      ];
      var templateCounter = -1;
      var typedArrayTags = {};
      typedArrayTags[float32Tag] = typedArrayTags[float64Tag] = typedArrayTags[int8Tag] = typedArrayTags[int16Tag] = typedArrayTags[int32Tag] = typedArrayTags[uint8Tag] = typedArrayTags[uint8ClampedTag] = typedArrayTags[uint16Tag] = typedArrayTags[uint32Tag] = true;
      typedArrayTags[argsTag] = typedArrayTags[arrayTag] = typedArrayTags[arrayBufferTag] = typedArrayTags[boolTag] = typedArrayTags[dataViewTag] = typedArrayTags[dateTag] = typedArrayTags[errorTag] = typedArrayTags[funcTag] = typedArrayTags[mapTag] = typedArrayTags[numberTag] = typedArrayTags[objectTag] = typedArrayTags[regexpTag] = typedArrayTags[setTag] = typedArrayTags[stringTag] = typedArrayTags[weakMapTag] = false;
      var cloneableTags = {};
      cloneableTags[argsTag] = cloneableTags[arrayTag] = cloneableTags[arrayBufferTag] = cloneableTags[dataViewTag] = cloneableTags[boolTag] = cloneableTags[dateTag] = cloneableTags[float32Tag] = cloneableTags[float64Tag] = cloneableTags[int8Tag] = cloneableTags[int16Tag] = cloneableTags[int32Tag] = cloneableTags[mapTag] = cloneableTags[numberTag] = cloneableTags[objectTag] = cloneableTags[regexpTag] = cloneableTags[setTag] = cloneableTags[stringTag] = cloneableTags[symbolTag] = cloneableTags[uint8Tag] = cloneableTags[uint8ClampedTag] = cloneableTags[uint16Tag] = cloneableTags[uint32Tag] = true;
      cloneableTags[errorTag] = cloneableTags[funcTag] = cloneableTags[weakMapTag] = false;
      var deburredLetters = {
        // Latin-1 Supplement block.
        "\xC0": "A",
        "\xC1": "A",
        "\xC2": "A",
        "\xC3": "A",
        "\xC4": "A",
        "\xC5": "A",
        "\xE0": "a",
        "\xE1": "a",
        "\xE2": "a",
        "\xE3": "a",
        "\xE4": "a",
        "\xE5": "a",
        "\xC7": "C",
        "\xE7": "c",
        "\xD0": "D",
        "\xF0": "d",
        "\xC8": "E",
        "\xC9": "E",
        "\xCA": "E",
        "\xCB": "E",
        "\xE8": "e",
        "\xE9": "e",
        "\xEA": "e",
        "\xEB": "e",
        "\xCC": "I",
        "\xCD": "I",
        "\xCE": "I",
        "\xCF": "I",
        "\xEC": "i",
        "\xED": "i",
        "\xEE": "i",
        "\xEF": "i",
        "\xD1": "N",
        "\xF1": "n",
        "\xD2": "O",
        "\xD3": "O",
        "\xD4": "O",
        "\xD5": "O",
        "\xD6": "O",
        "\xD8": "O",
        "\xF2": "o",
        "\xF3": "o",
        "\xF4": "o",
        "\xF5": "o",
        "\xF6": "o",
        "\xF8": "o",
        "\xD9": "U",
        "\xDA": "U",
        "\xDB": "U",
        "\xDC": "U",
        "\xF9": "u",
        "\xFA": "u",
        "\xFB": "u",
        "\xFC": "u",
        "\xDD": "Y",
        "\xFD": "y",
        "\xFF": "y",
        "\xC6": "Ae",
        "\xE6": "ae",
        "\xDE": "Th",
        "\xFE": "th",
        "\xDF": "ss",
        // Latin Extended-A block.
        "\u0100": "A",
        "\u0102": "A",
        "\u0104": "A",
        "\u0101": "a",
        "\u0103": "a",
        "\u0105": "a",
        "\u0106": "C",
        "\u0108": "C",
        "\u010A": "C",
        "\u010C": "C",
        "\u0107": "c",
        "\u0109": "c",
        "\u010B": "c",
        "\u010D": "c",
        "\u010E": "D",
        "\u0110": "D",
        "\u010F": "d",
        "\u0111": "d",
        "\u0112": "E",
        "\u0114": "E",
        "\u0116": "E",
        "\u0118": "E",
        "\u011A": "E",
        "\u0113": "e",
        "\u0115": "e",
        "\u0117": "e",
        "\u0119": "e",
        "\u011B": "e",
        "\u011C": "G",
        "\u011E": "G",
        "\u0120": "G",
        "\u0122": "G",
        "\u011D": "g",
        "\u011F": "g",
        "\u0121": "g",
        "\u0123": "g",
        "\u0124": "H",
        "\u0126": "H",
        "\u0125": "h",
        "\u0127": "h",
        "\u0128": "I",
        "\u012A": "I",
        "\u012C": "I",
        "\u012E": "I",
        "\u0130": "I",
        "\u0129": "i",
        "\u012B": "i",
        "\u012D": "i",
        "\u012F": "i",
        "\u0131": "i",
        "\u0134": "J",
        "\u0135": "j",
        "\u0136": "K",
        "\u0137": "k",
        "\u0138": "k",
        "\u0139": "L",
        "\u013B": "L",
        "\u013D": "L",
        "\u013F": "L",
        "\u0141": "L",
        "\u013A": "l",
        "\u013C": "l",
        "\u013E": "l",
        "\u0140": "l",
        "\u0142": "l",
        "\u0143": "N",
        "\u0145": "N",
        "\u0147": "N",
        "\u014A": "N",
        "\u0144": "n",
        "\u0146": "n",
        "\u0148": "n",
        "\u014B": "n",
        "\u014C": "O",
        "\u014E": "O",
        "\u0150": "O",
        "\u014D": "o",
        "\u014F": "o",
        "\u0151": "o",
        "\u0154": "R",
        "\u0156": "R",
        "\u0158": "R",
        "\u0155": "r",
        "\u0157": "r",
        "\u0159": "r",
        "\u015A": "S",
        "\u015C": "S",
        "\u015E": "S",
        "\u0160": "S",
        "\u015B": "s",
        "\u015D": "s",
        "\u015F": "s",
        "\u0161": "s",
        "\u0162": "T",
        "\u0164": "T",
        "\u0166": "T",
        "\u0163": "t",
        "\u0165": "t",
        "\u0167": "t",
        "\u0168": "U",
        "\u016A": "U",
        "\u016C": "U",
        "\u016E": "U",
        "\u0170": "U",
        "\u0172": "U",
        "\u0169": "u",
        "\u016B": "u",
        "\u016D": "u",
        "\u016F": "u",
        "\u0171": "u",
        "\u0173": "u",
        "\u0174": "W",
        "\u0175": "w",
        "\u0176": "Y",
        "\u0177": "y",
        "\u0178": "Y",
        "\u0179": "Z",
        "\u017B": "Z",
        "\u017D": "Z",
        "\u017A": "z",
        "\u017C": "z",
        "\u017E": "z",
        "\u0132": "IJ",
        "\u0133": "ij",
        "\u0152": "Oe",
        "\u0153": "oe",
        "\u0149": "'n",
        "\u017F": "s"
      };
      var htmlEscapes = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      };
      var htmlUnescapes = {
        "&amp;": "&",
        "&lt;": "<",
        "&gt;": ">",
        "&quot;": '"',
        "&#39;": "'"
      };
      var stringEscapes = {
        "\\": "\\",
        "'": "'",
        "\n": "n",
        "\r": "r",
        "\u2028": "u2028",
        "\u2029": "u2029"
      };
      var freeParseFloat = parseFloat, freeParseInt = parseInt;
      var freeGlobal = typeof global == "object" && global && global.Object === Object && global;
      var freeSelf = typeof self == "object" && self && self.Object === Object && self;
      var root = freeGlobal || freeSelf || Function("return this")();
      var freeExports = typeof exports == "object" && exports && !exports.nodeType && exports;
      var freeModule = freeExports && typeof module == "object" && module && !module.nodeType && module;
      var moduleExports = freeModule && freeModule.exports === freeExports;
      var freeProcess = moduleExports && freeGlobal.process;
      var nodeUtil = (function() {
        try {
          var types = freeModule && freeModule.require && freeModule.require("util").types;
          if (types) {
            return types;
          }
          return freeProcess && freeProcess.binding && freeProcess.binding("util");
        } catch (e) {
        }
      })();
      var nodeIsArrayBuffer = nodeUtil && nodeUtil.isArrayBuffer, nodeIsDate = nodeUtil && nodeUtil.isDate, nodeIsMap = nodeUtil && nodeUtil.isMap, nodeIsRegExp = nodeUtil && nodeUtil.isRegExp, nodeIsSet = nodeUtil && nodeUtil.isSet, nodeIsTypedArray = nodeUtil && nodeUtil.isTypedArray;
      function apply(func, thisArg, args) {
        switch (args.length) {
          case 0:
            return func.call(thisArg);
          case 1:
            return func.call(thisArg, args[0]);
          case 2:
            return func.call(thisArg, args[0], args[1]);
          case 3:
            return func.call(thisArg, args[0], args[1], args[2]);
        }
        return func.apply(thisArg, args);
      }
      function arrayAggregator(array, setter, iteratee, accumulator) {
        var index = -1, length = array == null ? 0 : array.length;
        while (++index < length) {
          var value = array[index];
          setter(accumulator, value, iteratee(value), array);
        }
        return accumulator;
      }
      function arrayEach(array, iteratee) {
        var index = -1, length = array == null ? 0 : array.length;
        while (++index < length) {
          if (iteratee(array[index], index, array) === false) {
            break;
          }
        }
        return array;
      }
      function arrayEachRight(array, iteratee) {
        var length = array == null ? 0 : array.length;
        while (length--) {
          if (iteratee(array[length], length, array) === false) {
            break;
          }
        }
        return array;
      }
      function arrayEvery(array, predicate) {
        var index = -1, length = array == null ? 0 : array.length;
        while (++index < length) {
          if (!predicate(array[index], index, array)) {
            return false;
          }
        }
        return true;
      }
      function arrayFilter(array, predicate) {
        var index = -1, length = array == null ? 0 : array.length, resIndex = 0, result = [];
        while (++index < length) {
          var value = array[index];
          if (predicate(value, index, array)) {
            result[resIndex++] = value;
          }
        }
        return result;
      }
      function arrayIncludes(array, value) {
        var length = array == null ? 0 : array.length;
        return !!length && baseIndexOf(array, value, 0) > -1;
      }
      function arrayIncludesWith(array, value, comparator) {
        var index = -1, length = array == null ? 0 : array.length;
        while (++index < length) {
          if (comparator(value, array[index])) {
            return true;
          }
        }
        return false;
      }
      function arrayMap(array, iteratee) {
        var index = -1, length = array == null ? 0 : array.length, result = Array(length);
        while (++index < length) {
          result[index] = iteratee(array[index], index, array);
        }
        return result;
      }
      function arrayPush(array, values) {
        var index = -1, length = values.length, offset = array.length;
        while (++index < length) {
          array[offset + index] = values[index];
        }
        return array;
      }
      function arrayReduce(array, iteratee, accumulator, initAccum) {
        var index = -1, length = array == null ? 0 : array.length;
        if (initAccum && length) {
          accumulator = array[++index];
        }
        while (++index < length) {
          accumulator = iteratee(accumulator, array[index], index, array);
        }
        return accumulator;
      }
      function arrayReduceRight(array, iteratee, accumulator, initAccum) {
        var length = array == null ? 0 : array.length;
        if (initAccum && length) {
          accumulator = array[--length];
        }
        while (length--) {
          accumulator = iteratee(accumulator, array[length], length, array);
        }
        return accumulator;
      }
      function arraySome(array, predicate) {
        var index = -1, length = array == null ? 0 : array.length;
        while (++index < length) {
          if (predicate(array[index], index, array)) {
            return true;
          }
        }
        return false;
      }
      var asciiSize = baseProperty("length");
      function asciiToArray(string) {
        return string.split("");
      }
      function asciiWords(string) {
        return string.match(reAsciiWord) || [];
      }
      function baseFindKey(collection, predicate, eachFunc) {
        var result;
        eachFunc(collection, function(value, key2, collection2) {
          if (predicate(value, key2, collection2)) {
            result = key2;
            return false;
          }
        });
        return result;
      }
      function baseFindIndex(array, predicate, fromIndex, fromRight) {
        var length = array.length, index = fromIndex + (fromRight ? 1 : -1);
        while (fromRight ? index-- : ++index < length) {
          if (predicate(array[index], index, array)) {
            return index;
          }
        }
        return -1;
      }
      function baseIndexOf(array, value, fromIndex) {
        return value === value ? strictIndexOf(array, value, fromIndex) : baseFindIndex(array, baseIsNaN, fromIndex);
      }
      function baseIndexOfWith(array, value, fromIndex, comparator) {
        var index = fromIndex - 1, length = array.length;
        while (++index < length) {
          if (comparator(array[index], value)) {
            return index;
          }
        }
        return -1;
      }
      function baseIsNaN(value) {
        return value !== value;
      }
      function baseMean(array, iteratee) {
        var length = array == null ? 0 : array.length;
        return length ? baseSum(array, iteratee) / length : NAN;
      }
      function baseProperty(key2) {
        return function(object) {
          return object == null ? undefined2 : object[key2];
        };
      }
      function basePropertyOf(object) {
        return function(key2) {
          return object == null ? undefined2 : object[key2];
        };
      }
      function baseReduce(collection, iteratee, accumulator, initAccum, eachFunc) {
        eachFunc(collection, function(value, index, collection2) {
          accumulator = initAccum ? (initAccum = false, value) : iteratee(accumulator, value, index, collection2);
        });
        return accumulator;
      }
      function baseSortBy(array, comparer) {
        var length = array.length;
        array.sort(comparer);
        while (length--) {
          array[length] = array[length].value;
        }
        return array;
      }
      function baseSum(array, iteratee) {
        var result, index = -1, length = array.length;
        while (++index < length) {
          var current = iteratee(array[index]);
          if (current !== undefined2) {
            result = result === undefined2 ? current : result + current;
          }
        }
        return result;
      }
      function baseTimes(n, iteratee) {
        var index = -1, result = Array(n);
        while (++index < n) {
          result[index] = iteratee(index);
        }
        return result;
      }
      function baseToPairs(object, props) {
        return arrayMap(props, function(key2) {
          return [key2, object[key2]];
        });
      }
      function baseTrim(string) {
        return string ? string.slice(0, trimmedEndIndex(string) + 1).replace(reTrimStart, "") : string;
      }
      function baseUnary(func) {
        return function(value) {
          return func(value);
        };
      }
      function baseValues(object, props) {
        return arrayMap(props, function(key2) {
          return object[key2];
        });
      }
      function cacheHas(cache, key2) {
        return cache.has(key2);
      }
      function charsStartIndex(strSymbols, chrSymbols) {
        var index = -1, length = strSymbols.length;
        while (++index < length && baseIndexOf(chrSymbols, strSymbols[index], 0) > -1) {
        }
        return index;
      }
      function charsEndIndex(strSymbols, chrSymbols) {
        var index = strSymbols.length;
        while (index-- && baseIndexOf(chrSymbols, strSymbols[index], 0) > -1) {
        }
        return index;
      }
      function countHolders(array, placeholder) {
        var length = array.length, result = 0;
        while (length--) {
          if (array[length] === placeholder) {
            ++result;
          }
        }
        return result;
      }
      var deburrLetter = basePropertyOf(deburredLetters);
      var escapeHtmlChar = basePropertyOf(htmlEscapes);
      function escapeStringChar(chr) {
        return "\\" + stringEscapes[chr];
      }
      function getValue(object, key2) {
        return object == null ? undefined2 : object[key2];
      }
      function hasUnicode(string) {
        return reHasUnicode.test(string);
      }
      function hasUnicodeWord(string) {
        return reHasUnicodeWord.test(string);
      }
      function iteratorToArray(iterator) {
        var data, result = [];
        while (!(data = iterator.next()).done) {
          result.push(data.value);
        }
        return result;
      }
      function mapToArray(map) {
        var index = -1, result = Array(map.size);
        map.forEach(function(value, key2) {
          result[++index] = [key2, value];
        });
        return result;
      }
      function overArg(func, transform) {
        return function(arg) {
          return func(transform(arg));
        };
      }
      function replaceHolders(array, placeholder) {
        var index = -1, length = array.length, resIndex = 0, result = [];
        while (++index < length) {
          var value = array[index];
          if (value === placeholder || value === PLACEHOLDER) {
            array[index] = PLACEHOLDER;
            result[resIndex++] = index;
          }
        }
        return result;
      }
      function setToArray(set3) {
        var index = -1, result = Array(set3.size);
        set3.forEach(function(value) {
          result[++index] = value;
        });
        return result;
      }
      function setToPairs(set3) {
        var index = -1, result = Array(set3.size);
        set3.forEach(function(value) {
          result[++index] = [value, value];
        });
        return result;
      }
      function strictIndexOf(array, value, fromIndex) {
        var index = fromIndex - 1, length = array.length;
        while (++index < length) {
          if (array[index] === value) {
            return index;
          }
        }
        return -1;
      }
      function strictLastIndexOf(array, value, fromIndex) {
        var index = fromIndex + 1;
        while (index--) {
          if (array[index] === value) {
            return index;
          }
        }
        return index;
      }
      function stringSize(string) {
        return hasUnicode(string) ? unicodeSize(string) : asciiSize(string);
      }
      function stringToArray(string) {
        return hasUnicode(string) ? unicodeToArray(string) : asciiToArray(string);
      }
      function trimmedEndIndex(string) {
        var index = string.length;
        while (index-- && reWhitespace.test(string.charAt(index))) {
        }
        return index;
      }
      var unescapeHtmlChar = basePropertyOf(htmlUnescapes);
      function unicodeSize(string) {
        var result = reUnicode.lastIndex = 0;
        while (reUnicode.test(string)) {
          ++result;
        }
        return result;
      }
      function unicodeToArray(string) {
        return string.match(reUnicode) || [];
      }
      function unicodeWords(string) {
        return string.match(reUnicodeWord) || [];
      }
      var runInContext = (function runInContext2(context) {
        context = context == null ? root : _.defaults(root.Object(), context, _.pick(root, contextProps));
        var Array2 = context.Array, Date2 = context.Date, Error2 = context.Error, Function2 = context.Function, Math2 = context.Math, Object2 = context.Object, RegExp2 = context.RegExp, String2 = context.String, TypeError2 = context.TypeError;
        var arrayProto = Array2.prototype, funcProto = Function2.prototype, objectProto = Object2.prototype;
        var coreJsData = context["__core-js_shared__"];
        var funcToString = funcProto.toString;
        var hasOwnProperty = objectProto.hasOwnProperty;
        var idCounter = 0;
        var maskSrcKey = (function() {
          var uid = /[^.]+$/.exec(coreJsData && coreJsData.keys && coreJsData.keys.IE_PROTO || "");
          return uid ? "Symbol(src)_1." + uid : "";
        })();
        var nativeObjectToString = objectProto.toString;
        var objectCtorString = funcToString.call(Object2);
        var oldDash = root._;
        var reIsNative = RegExp2(
          "^" + funcToString.call(hasOwnProperty).replace(reRegExpChar, "\\$&").replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g, "$1.*?") + "$"
        );
        var Buffer2 = moduleExports ? context.Buffer : undefined2, Symbol2 = context.Symbol, Uint8Array2 = context.Uint8Array, allocUnsafe = Buffer2 ? Buffer2.allocUnsafe : undefined2, getPrototype = overArg(Object2.getPrototypeOf, Object2), objectCreate = Object2.create, propertyIsEnumerable = objectProto.propertyIsEnumerable, splice = arrayProto.splice, spreadableSymbol = Symbol2 ? Symbol2.isConcatSpreadable : undefined2, symIterator = Symbol2 ? Symbol2.iterator : undefined2, symToStringTag = Symbol2 ? Symbol2.toStringTag : undefined2;
        var defineProperty = (function() {
          try {
            var func = getNative(Object2, "defineProperty");
            func({}, "", {});
            return func;
          } catch (e) {
          }
        })();
        var ctxClearTimeout = context.clearTimeout !== root.clearTimeout && context.clearTimeout, ctxNow = Date2 && Date2.now !== root.Date.now && Date2.now, ctxSetTimeout = context.setTimeout !== root.setTimeout && context.setTimeout;
        var nativeCeil = Math2.ceil, nativeFloor = Math2.floor, nativeGetSymbols = Object2.getOwnPropertySymbols, nativeIsBuffer = Buffer2 ? Buffer2.isBuffer : undefined2, nativeIsFinite = context.isFinite, nativeJoin = arrayProto.join, nativeKeys = overArg(Object2.keys, Object2), nativeMax = Math2.max, nativeMin = Math2.min, nativeNow = Date2.now, nativeParseInt = context.parseInt, nativeRandom = Math2.random, nativeReverse = arrayProto.reverse;
        var DataView = getNative(context, "DataView"), Map2 = getNative(context, "Map"), Promise2 = getNative(context, "Promise"), Set2 = getNative(context, "Set"), WeakMap = getNative(context, "WeakMap"), nativeCreate = getNative(Object2, "create");
        var metaMap = WeakMap && new WeakMap();
        var realNames = {};
        var dataViewCtorString = toSource(DataView), mapCtorString = toSource(Map2), promiseCtorString = toSource(Promise2), setCtorString = toSource(Set2), weakMapCtorString = toSource(WeakMap);
        var symbolProto = Symbol2 ? Symbol2.prototype : undefined2, symbolValueOf = symbolProto ? symbolProto.valueOf : undefined2, symbolToString = symbolProto ? symbolProto.toString : undefined2;
        function lodash(value) {
          if (isObjectLike(value) && !isArray(value) && !(value instanceof LazyWrapper)) {
            if (value instanceof LodashWrapper) {
              return value;
            }
            if (hasOwnProperty.call(value, "__wrapped__")) {
              return wrapperClone(value);
            }
          }
          return new LodashWrapper(value);
        }
        var baseCreate = /* @__PURE__ */ (function() {
          function object() {
          }
          return function(proto) {
            if (!isObject(proto)) {
              return {};
            }
            if (objectCreate) {
              return objectCreate(proto);
            }
            object.prototype = proto;
            var result2 = new object();
            object.prototype = undefined2;
            return result2;
          };
        })();
        function baseLodash() {
        }
        function LodashWrapper(value, chainAll) {
          this.__wrapped__ = value;
          this.__actions__ = [];
          this.__chain__ = !!chainAll;
          this.__index__ = 0;
          this.__values__ = undefined2;
        }
        lodash.templateSettings = {
          /**
           * Used to detect `data` property values to be HTML-escaped.
           *
           * @memberOf _.templateSettings
           * @type {RegExp}
           */
          "escape": reEscape,
          /**
           * Used to detect code to be evaluated.
           *
           * @memberOf _.templateSettings
           * @type {RegExp}
           */
          "evaluate": reEvaluate,
          /**
           * Used to detect `data` property values to inject.
           *
           * @memberOf _.templateSettings
           * @type {RegExp}
           */
          "interpolate": reInterpolate,
          /**
           * Used to reference the data object in the template text.
           *
           * @memberOf _.templateSettings
           * @type {string}
           */
          "variable": "",
          /**
           * Used to import variables into the compiled template.
           *
           * @memberOf _.templateSettings
           * @type {Object}
           */
          "imports": {
            /**
             * A reference to the `lodash` function.
             *
             * @memberOf _.templateSettings.imports
             * @type {Function}
             */
            "_": lodash
          }
        };
        lodash.prototype = baseLodash.prototype;
        lodash.prototype.constructor = lodash;
        LodashWrapper.prototype = baseCreate(baseLodash.prototype);
        LodashWrapper.prototype.constructor = LodashWrapper;
        function LazyWrapper(value) {
          this.__wrapped__ = value;
          this.__actions__ = [];
          this.__dir__ = 1;
          this.__filtered__ = false;
          this.__iteratees__ = [];
          this.__takeCount__ = MAX_ARRAY_LENGTH;
          this.__views__ = [];
        }
        function lazyClone() {
          var result2 = new LazyWrapper(this.__wrapped__);
          result2.__actions__ = copyArray(this.__actions__);
          result2.__dir__ = this.__dir__;
          result2.__filtered__ = this.__filtered__;
          result2.__iteratees__ = copyArray(this.__iteratees__);
          result2.__takeCount__ = this.__takeCount__;
          result2.__views__ = copyArray(this.__views__);
          return result2;
        }
        function lazyReverse() {
          if (this.__filtered__) {
            var result2 = new LazyWrapper(this);
            result2.__dir__ = -1;
            result2.__filtered__ = true;
          } else {
            result2 = this.clone();
            result2.__dir__ *= -1;
          }
          return result2;
        }
        function lazyValue() {
          var array = this.__wrapped__.value(), dir = this.__dir__, isArr = isArray(array), isRight = dir < 0, arrLength = isArr ? array.length : 0, view = getView(0, arrLength, this.__views__), start = view.start, end = view.end, length = end - start, index = isRight ? end : start - 1, iteratees = this.__iteratees__, iterLength = iteratees.length, resIndex = 0, takeCount = nativeMin(length, this.__takeCount__);
          if (!isArr || !isRight && arrLength == length && takeCount == length) {
            return baseWrapperValue(array, this.__actions__);
          }
          var result2 = [];
          outer:
            while (length-- && resIndex < takeCount) {
              index += dir;
              var iterIndex = -1, value = array[index];
              while (++iterIndex < iterLength) {
                var data = iteratees[iterIndex], iteratee2 = data.iteratee, type = data.type, computed = iteratee2(value);
                if (type == LAZY_MAP_FLAG) {
                  value = computed;
                } else if (!computed) {
                  if (type == LAZY_FILTER_FLAG) {
                    continue outer;
                  } else {
                    break outer;
                  }
                }
              }
              result2[resIndex++] = value;
            }
          return result2;
        }
        LazyWrapper.prototype = baseCreate(baseLodash.prototype);
        LazyWrapper.prototype.constructor = LazyWrapper;
        function Hash(entries) {
          var index = -1, length = entries == null ? 0 : entries.length;
          this.clear();
          while (++index < length) {
            var entry = entries[index];
            this.set(entry[0], entry[1]);
          }
        }
        function hashClear() {
          this.__data__ = nativeCreate ? nativeCreate(null) : {};
          this.size = 0;
        }
        function hashDelete(key2) {
          var result2 = this.has(key2) && delete this.__data__[key2];
          this.size -= result2 ? 1 : 0;
          return result2;
        }
        function hashGet(key2) {
          var data = this.__data__;
          if (nativeCreate) {
            var result2 = data[key2];
            return result2 === HASH_UNDEFINED ? undefined2 : result2;
          }
          return hasOwnProperty.call(data, key2) ? data[key2] : undefined2;
        }
        function hashHas(key2) {
          var data = this.__data__;
          return nativeCreate ? data[key2] !== undefined2 : hasOwnProperty.call(data, key2);
        }
        function hashSet(key2, value) {
          var data = this.__data__;
          this.size += this.has(key2) ? 0 : 1;
          data[key2] = nativeCreate && value === undefined2 ? HASH_UNDEFINED : value;
          return this;
        }
        Hash.prototype.clear = hashClear;
        Hash.prototype["delete"] = hashDelete;
        Hash.prototype.get = hashGet;
        Hash.prototype.has = hashHas;
        Hash.prototype.set = hashSet;
        function ListCache(entries) {
          var index = -1, length = entries == null ? 0 : entries.length;
          this.clear();
          while (++index < length) {
            var entry = entries[index];
            this.set(entry[0], entry[1]);
          }
        }
        function listCacheClear() {
          this.__data__ = [];
          this.size = 0;
        }
        function listCacheDelete(key2) {
          var data = this.__data__, index = assocIndexOf(data, key2);
          if (index < 0) {
            return false;
          }
          var lastIndex = data.length - 1;
          if (index == lastIndex) {
            data.pop();
          } else {
            splice.call(data, index, 1);
          }
          --this.size;
          return true;
        }
        function listCacheGet(key2) {
          var data = this.__data__, index = assocIndexOf(data, key2);
          return index < 0 ? undefined2 : data[index][1];
        }
        function listCacheHas(key2) {
          return assocIndexOf(this.__data__, key2) > -1;
        }
        function listCacheSet(key2, value) {
          var data = this.__data__, index = assocIndexOf(data, key2);
          if (index < 0) {
            ++this.size;
            data.push([key2, value]);
          } else {
            data[index][1] = value;
          }
          return this;
        }
        ListCache.prototype.clear = listCacheClear;
        ListCache.prototype["delete"] = listCacheDelete;
        ListCache.prototype.get = listCacheGet;
        ListCache.prototype.has = listCacheHas;
        ListCache.prototype.set = listCacheSet;
        function MapCache(entries) {
          var index = -1, length = entries == null ? 0 : entries.length;
          this.clear();
          while (++index < length) {
            var entry = entries[index];
            this.set(entry[0], entry[1]);
          }
        }
        function mapCacheClear() {
          this.size = 0;
          this.__data__ = {
            "hash": new Hash(),
            "map": new (Map2 || ListCache)(),
            "string": new Hash()
          };
        }
        function mapCacheDelete(key2) {
          var result2 = getMapData(this, key2)["delete"](key2);
          this.size -= result2 ? 1 : 0;
          return result2;
        }
        function mapCacheGet(key2) {
          return getMapData(this, key2).get(key2);
        }
        function mapCacheHas(key2) {
          return getMapData(this, key2).has(key2);
        }
        function mapCacheSet(key2, value) {
          var data = getMapData(this, key2), size2 = data.size;
          data.set(key2, value);
          this.size += data.size == size2 ? 0 : 1;
          return this;
        }
        MapCache.prototype.clear = mapCacheClear;
        MapCache.prototype["delete"] = mapCacheDelete;
        MapCache.prototype.get = mapCacheGet;
        MapCache.prototype.has = mapCacheHas;
        MapCache.prototype.set = mapCacheSet;
        function SetCache(values2) {
          var index = -1, length = values2 == null ? 0 : values2.length;
          this.__data__ = new MapCache();
          while (++index < length) {
            this.add(values2[index]);
          }
        }
        function setCacheAdd(value) {
          this.__data__.set(value, HASH_UNDEFINED);
          return this;
        }
        function setCacheHas(value) {
          return this.__data__.has(value);
        }
        SetCache.prototype.add = SetCache.prototype.push = setCacheAdd;
        SetCache.prototype.has = setCacheHas;
        function Stack(entries) {
          var data = this.__data__ = new ListCache(entries);
          this.size = data.size;
        }
        function stackClear() {
          this.__data__ = new ListCache();
          this.size = 0;
        }
        function stackDelete(key2) {
          var data = this.__data__, result2 = data["delete"](key2);
          this.size = data.size;
          return result2;
        }
        function stackGet(key2) {
          return this.__data__.get(key2);
        }
        function stackHas(key2) {
          return this.__data__.has(key2);
        }
        function stackSet(key2, value) {
          var data = this.__data__;
          if (data instanceof ListCache) {
            var pairs = data.__data__;
            if (!Map2 || pairs.length < LARGE_ARRAY_SIZE - 1) {
              pairs.push([key2, value]);
              this.size = ++data.size;
              return this;
            }
            data = this.__data__ = new MapCache(pairs);
          }
          data.set(key2, value);
          this.size = data.size;
          return this;
        }
        Stack.prototype.clear = stackClear;
        Stack.prototype["delete"] = stackDelete;
        Stack.prototype.get = stackGet;
        Stack.prototype.has = stackHas;
        Stack.prototype.set = stackSet;
        function arrayLikeKeys(value, inherited) {
          var isArr = isArray(value), isArg = !isArr && isArguments(value), isBuff = !isArr && !isArg && isBuffer(value), isType = !isArr && !isArg && !isBuff && isTypedArray(value), skipIndexes = isArr || isArg || isBuff || isType, result2 = skipIndexes ? baseTimes(value.length, String2) : [], length = result2.length;
          for (var key2 in value) {
            if ((inherited || hasOwnProperty.call(value, key2)) && !(skipIndexes && // Safari 9 has enumerable `arguments.length` in strict mode.
            (key2 == "length" || // Node.js 0.10 has enumerable non-index properties on buffers.
            isBuff && (key2 == "offset" || key2 == "parent") || // PhantomJS 2 has enumerable non-index properties on typed arrays.
            isType && (key2 == "buffer" || key2 == "byteLength" || key2 == "byteOffset") || // Skip index properties.
            isIndex(key2, length)))) {
              result2.push(key2);
            }
          }
          return result2;
        }
        function arraySample(array) {
          var length = array.length;
          return length ? array[baseRandom(0, length - 1)] : undefined2;
        }
        function arraySampleSize(array, n) {
          return shuffleSelf(copyArray(array), baseClamp(n, 0, array.length));
        }
        function arrayShuffle(array) {
          return shuffleSelf(copyArray(array));
        }
        function assignMergeValue(object, key2, value) {
          if (value !== undefined2 && !eq(object[key2], value) || value === undefined2 && !(key2 in object)) {
            baseAssignValue(object, key2, value);
          }
        }
        function assignValue(object, key2, value) {
          var objValue = object[key2];
          if (!(hasOwnProperty.call(object, key2) && eq(objValue, value)) || value === undefined2 && !(key2 in object)) {
            baseAssignValue(object, key2, value);
          }
        }
        function assocIndexOf(array, key2) {
          var length = array.length;
          while (length--) {
            if (eq(array[length][0], key2)) {
              return length;
            }
          }
          return -1;
        }
        function baseAggregator(collection, setter, iteratee2, accumulator) {
          baseEach(collection, function(value, key2, collection2) {
            setter(accumulator, value, iteratee2(value), collection2);
          });
          return accumulator;
        }
        function baseAssign(object, source) {
          return object && copyObject(source, keys(source), object);
        }
        function baseAssignIn(object, source) {
          return object && copyObject(source, keysIn(source), object);
        }
        function baseAssignValue(object, key2, value) {
          if (key2 == "__proto__" && defineProperty) {
            defineProperty(object, key2, {
              "configurable": true,
              "enumerable": true,
              "value": value,
              "writable": true
            });
          } else {
            object[key2] = value;
          }
        }
        function baseAt(object, paths) {
          var index = -1, length = paths.length, result2 = Array2(length), skip = object == null;
          while (++index < length) {
            result2[index] = skip ? undefined2 : get2(object, paths[index]);
          }
          return result2;
        }
        function baseClamp(number, lower, upper) {
          if (number === number) {
            if (upper !== undefined2) {
              number = number <= upper ? number : upper;
            }
            if (lower !== undefined2) {
              number = number >= lower ? number : lower;
            }
          }
          return number;
        }
        function baseClone(value, bitmask, customizer2, key2, object, stack) {
          var result2, isDeep = bitmask & CLONE_DEEP_FLAG, isFlat = bitmask & CLONE_FLAT_FLAG, isFull = bitmask & CLONE_SYMBOLS_FLAG;
          if (customizer2) {
            result2 = object ? customizer2(value, key2, object, stack) : customizer2(value);
          }
          if (result2 !== undefined2) {
            return result2;
          }
          if (!isObject(value)) {
            return value;
          }
          var isArr = isArray(value);
          if (isArr) {
            result2 = initCloneArray(value);
            if (!isDeep) {
              return copyArray(value, result2);
            }
          } else {
            var tag = getTag(value), isFunc = tag == funcTag || tag == genTag;
            if (isBuffer(value)) {
              return cloneBuffer(value, isDeep);
            }
            if (tag == objectTag || tag == argsTag || isFunc && !object) {
              result2 = isFlat || isFunc ? {} : initCloneObject(value);
              if (!isDeep) {
                return isFlat ? copySymbolsIn(value, baseAssignIn(result2, value)) : copySymbols(value, baseAssign(result2, value));
              }
            } else {
              if (!cloneableTags[tag]) {
                return object ? value : {};
              }
              result2 = initCloneByTag(value, tag, isDeep);
            }
          }
          stack || (stack = new Stack());
          var stacked = stack.get(value);
          if (stacked) {
            return stacked;
          }
          stack.set(value, result2);
          if (isSet(value)) {
            value.forEach(function(subValue) {
              result2.add(baseClone(subValue, bitmask, customizer2, subValue, value, stack));
            });
          } else if (isMap(value)) {
            value.forEach(function(subValue, key3) {
              result2.set(key3, baseClone(subValue, bitmask, customizer2, key3, value, stack));
            });
          }
          var keysFunc = isFull ? isFlat ? getAllKeysIn : getAllKeys : isFlat ? keysIn : keys;
          var props = isArr ? undefined2 : keysFunc(value);
          arrayEach(props || value, function(subValue, key3) {
            if (props) {
              key3 = subValue;
              subValue = value[key3];
            }
            assignValue(result2, key3, baseClone(subValue, bitmask, customizer2, key3, value, stack));
          });
          return result2;
        }
        function baseConforms(source) {
          var props = keys(source);
          return function(object) {
            return baseConformsTo(object, source, props);
          };
        }
        function baseConformsTo(object, source, props) {
          var length = props.length;
          if (object == null) {
            return !length;
          }
          object = Object2(object);
          while (length--) {
            var key2 = props[length], predicate = source[key2], value = object[key2];
            if (value === undefined2 && !(key2 in object) || !predicate(value)) {
              return false;
            }
          }
          return true;
        }
        function baseDelay(func, wait, args) {
          if (typeof func != "function") {
            throw new TypeError2(FUNC_ERROR_TEXT);
          }
          return setTimeout(function() {
            func.apply(undefined2, args);
          }, wait);
        }
        function baseDifference(array, values2, iteratee2, comparator) {
          var index = -1, includes2 = arrayIncludes, isCommon = true, length = array.length, result2 = [], valuesLength = values2.length;
          if (!length) {
            return result2;
          }
          if (iteratee2) {
            values2 = arrayMap(values2, baseUnary(iteratee2));
          }
          if (comparator) {
            includes2 = arrayIncludesWith;
            isCommon = false;
          } else if (values2.length >= LARGE_ARRAY_SIZE) {
            includes2 = cacheHas;
            isCommon = false;
            values2 = new SetCache(values2);
          }
          outer:
            while (++index < length) {
              var value = array[index], computed = iteratee2 == null ? value : iteratee2(value);
              value = comparator || value !== 0 ? value : 0;
              if (isCommon && computed === computed) {
                var valuesIndex = valuesLength;
                while (valuesIndex--) {
                  if (values2[valuesIndex] === computed) {
                    continue outer;
                  }
                }
                result2.push(value);
              } else if (!includes2(values2, computed, comparator)) {
                result2.push(value);
              }
            }
          return result2;
        }
        var baseEach = createBaseEach(baseForOwn);
        var baseEachRight = createBaseEach(baseForOwnRight, true);
        function baseEvery(collection, predicate) {
          var result2 = true;
          baseEach(collection, function(value, index, collection2) {
            result2 = !!predicate(value, index, collection2);
            return result2;
          });
          return result2;
        }
        function baseExtremum(array, iteratee2, comparator) {
          var index = -1, length = array.length;
          while (++index < length) {
            var value = array[index], current = iteratee2(value);
            if (current != null && (computed === undefined2 ? current === current && !isSymbol(current) : comparator(current, computed))) {
              var computed = current, result2 = value;
            }
          }
          return result2;
        }
        function baseFill(array, value, start, end) {
          var length = array.length;
          start = toInteger(start);
          if (start < 0) {
            start = -start > length ? 0 : length + start;
          }
          end = end === undefined2 || end > length ? length : toInteger(end);
          if (end < 0) {
            end += length;
          }
          end = start > end ? 0 : toLength(end);
          while (start < end) {
            array[start++] = value;
          }
          return array;
        }
        function baseFilter(collection, predicate) {
          var result2 = [];
          baseEach(collection, function(value, index, collection2) {
            if (predicate(value, index, collection2)) {
              result2.push(value);
            }
          });
          return result2;
        }
        function baseFlatten(array, depth, predicate, isStrict, result2) {
          var index = -1, length = array.length;
          predicate || (predicate = isFlattenable);
          result2 || (result2 = []);
          while (++index < length) {
            var value = array[index];
            if (depth > 0 && predicate(value)) {
              if (depth > 1) {
                baseFlatten(value, depth - 1, predicate, isStrict, result2);
              } else {
                arrayPush(result2, value);
              }
            } else if (!isStrict) {
              result2[result2.length] = value;
            }
          }
          return result2;
        }
        var baseFor = createBaseFor();
        var baseForRight = createBaseFor(true);
        function baseForOwn(object, iteratee2) {
          return object && baseFor(object, iteratee2, keys);
        }
        function baseForOwnRight(object, iteratee2) {
          return object && baseForRight(object, iteratee2, keys);
        }
        function baseFunctions(object, props) {
          return arrayFilter(props, function(key2) {
            return isFunction(object[key2]);
          });
        }
        function baseGet(object, path) {
          path = castPath(path, object);
          var index = 0, length = path.length;
          while (object != null && index < length) {
            object = object[toKey(path[index++])];
          }
          return index && index == length ? object : undefined2;
        }
        function baseGetAllKeys(object, keysFunc, symbolsFunc) {
          var result2 = keysFunc(object);
          return isArray(object) ? result2 : arrayPush(result2, symbolsFunc(object));
        }
        function baseGetTag(value) {
          if (value == null) {
            return value === undefined2 ? undefinedTag : nullTag;
          }
          return symToStringTag && symToStringTag in Object2(value) ? getRawTag(value) : objectToString(value);
        }
        function baseGt(value, other) {
          return value > other;
        }
        function baseHas(object, key2) {
          return object != null && hasOwnProperty.call(object, key2);
        }
        function baseHasIn(object, key2) {
          return object != null && key2 in Object2(object);
        }
        function baseInRange(number, start, end) {
          return number >= nativeMin(start, end) && number < nativeMax(start, end);
        }
        function baseIntersection(arrays, iteratee2, comparator) {
          var includes2 = comparator ? arrayIncludesWith : arrayIncludes, length = arrays[0].length, othLength = arrays.length, othIndex = othLength, caches = Array2(othLength), maxLength = Infinity, result2 = [];
          while (othIndex--) {
            var array = arrays[othIndex];
            if (othIndex && iteratee2) {
              array = arrayMap(array, baseUnary(iteratee2));
            }
            maxLength = nativeMin(array.length, maxLength);
            caches[othIndex] = !comparator && (iteratee2 || length >= 120 && array.length >= 120) ? new SetCache(othIndex && array) : undefined2;
          }
          array = arrays[0];
          var index = -1, seen = caches[0];
          outer:
            while (++index < length && result2.length < maxLength) {
              var value = array[index], computed = iteratee2 ? iteratee2(value) : value;
              value = comparator || value !== 0 ? value : 0;
              if (!(seen ? cacheHas(seen, computed) : includes2(result2, computed, comparator))) {
                othIndex = othLength;
                while (--othIndex) {
                  var cache = caches[othIndex];
                  if (!(cache ? cacheHas(cache, computed) : includes2(arrays[othIndex], computed, comparator))) {
                    continue outer;
                  }
                }
                if (seen) {
                  seen.push(computed);
                }
                result2.push(value);
              }
            }
          return result2;
        }
        function baseInverter(object, setter, iteratee2, accumulator) {
          baseForOwn(object, function(value, key2, object2) {
            setter(accumulator, iteratee2(value), key2, object2);
          });
          return accumulator;
        }
        function baseInvoke(object, path, args) {
          path = castPath(path, object);
          object = parent(object, path);
          var func = object == null ? object : object[toKey(last(path))];
          return func == null ? undefined2 : apply(func, object, args);
        }
        function baseIsArguments(value) {
          return isObjectLike(value) && baseGetTag(value) == argsTag;
        }
        function baseIsArrayBuffer(value) {
          return isObjectLike(value) && baseGetTag(value) == arrayBufferTag;
        }
        function baseIsDate(value) {
          return isObjectLike(value) && baseGetTag(value) == dateTag;
        }
        function baseIsEqual(value, other, bitmask, customizer2, stack) {
          if (value === other) {
            return true;
          }
          if (value == null || other == null || !isObjectLike(value) && !isObjectLike(other)) {
            return value !== value && other !== other;
          }
          return baseIsEqualDeep(value, other, bitmask, customizer2, baseIsEqual, stack);
        }
        function baseIsEqualDeep(object, other, bitmask, customizer2, equalFunc, stack) {
          var objIsArr = isArray(object), othIsArr = isArray(other), objTag = objIsArr ? arrayTag : getTag(object), othTag = othIsArr ? arrayTag : getTag(other);
          objTag = objTag == argsTag ? objectTag : objTag;
          othTag = othTag == argsTag ? objectTag : othTag;
          var objIsObj = objTag == objectTag, othIsObj = othTag == objectTag, isSameTag = objTag == othTag;
          if (isSameTag && isBuffer(object)) {
            if (!isBuffer(other)) {
              return false;
            }
            objIsArr = true;
            objIsObj = false;
          }
          if (isSameTag && !objIsObj) {
            stack || (stack = new Stack());
            return objIsArr || isTypedArray(object) ? equalArrays(object, other, bitmask, customizer2, equalFunc, stack) : equalByTag(object, other, objTag, bitmask, customizer2, equalFunc, stack);
          }
          if (!(bitmask & COMPARE_PARTIAL_FLAG)) {
            var objIsWrapped = objIsObj && hasOwnProperty.call(object, "__wrapped__"), othIsWrapped = othIsObj && hasOwnProperty.call(other, "__wrapped__");
            if (objIsWrapped || othIsWrapped) {
              var objUnwrapped = objIsWrapped ? object.value() : object, othUnwrapped = othIsWrapped ? other.value() : other;
              stack || (stack = new Stack());
              return equalFunc(objUnwrapped, othUnwrapped, bitmask, customizer2, stack);
            }
          }
          if (!isSameTag) {
            return false;
          }
          stack || (stack = new Stack());
          return equalObjects(object, other, bitmask, customizer2, equalFunc, stack);
        }
        function baseIsMap(value) {
          return isObjectLike(value) && getTag(value) == mapTag;
        }
        function baseIsMatch(object, source, matchData, customizer2) {
          var index = matchData.length, length = index, noCustomizer = !customizer2;
          if (object == null) {
            return !length;
          }
          object = Object2(object);
          while (index--) {
            var data = matchData[index];
            if (noCustomizer && data[2] ? data[1] !== object[data[0]] : !(data[0] in object)) {
              return false;
            }
          }
          while (++index < length) {
            data = matchData[index];
            var key2 = data[0], objValue = object[key2], srcValue = data[1];
            if (noCustomizer && data[2]) {
              if (objValue === undefined2 && !(key2 in object)) {
                return false;
              }
            } else {
              var stack = new Stack();
              if (customizer2) {
                var result2 = customizer2(objValue, srcValue, key2, object, source, stack);
              }
              if (!(result2 === undefined2 ? baseIsEqual(srcValue, objValue, COMPARE_PARTIAL_FLAG | COMPARE_UNORDERED_FLAG, customizer2, stack) : result2)) {
                return false;
              }
            }
          }
          return true;
        }
        function baseIsNative(value) {
          if (!isObject(value) || isMasked(value)) {
            return false;
          }
          var pattern = isFunction(value) ? reIsNative : reIsHostCtor;
          return pattern.test(toSource(value));
        }
        function baseIsRegExp(value) {
          return isObjectLike(value) && baseGetTag(value) == regexpTag;
        }
        function baseIsSet(value) {
          return isObjectLike(value) && getTag(value) == setTag;
        }
        function baseIsTypedArray(value) {
          return isObjectLike(value) && isLength(value.length) && !!typedArrayTags[baseGetTag(value)];
        }
        function baseIteratee(value) {
          if (typeof value == "function") {
            return value;
          }
          if (value == null) {
            return identity;
          }
          if (typeof value == "object") {
            return isArray(value) ? baseMatchesProperty(value[0], value[1]) : baseMatches(value);
          }
          return property(value);
        }
        function baseKeys(object) {
          if (!isPrototype(object)) {
            return nativeKeys(object);
          }
          var result2 = [];
          for (var key2 in Object2(object)) {
            if (hasOwnProperty.call(object, key2) && key2 != "constructor") {
              result2.push(key2);
            }
          }
          return result2;
        }
        function baseKeysIn(object) {
          if (!isObject(object)) {
            return nativeKeysIn(object);
          }
          var isProto = isPrototype(object), result2 = [];
          for (var key2 in object) {
            if (!(key2 == "constructor" && (isProto || !hasOwnProperty.call(object, key2)))) {
              result2.push(key2);
            }
          }
          return result2;
        }
        function baseLt(value, other) {
          return value < other;
        }
        function baseMap(collection, iteratee2) {
          var index = -1, result2 = isArrayLike(collection) ? Array2(collection.length) : [];
          baseEach(collection, function(value, key2, collection2) {
            result2[++index] = iteratee2(value, key2, collection2);
          });
          return result2;
        }
        function baseMatches(source) {
          var matchData = getMatchData(source);
          if (matchData.length == 1 && matchData[0][2]) {
            return matchesStrictComparable(matchData[0][0], matchData[0][1]);
          }
          return function(object) {
            return object === source || baseIsMatch(object, source, matchData);
          };
        }
        function baseMatchesProperty(path, srcValue) {
          if (isKey(path) && isStrictComparable(srcValue)) {
            return matchesStrictComparable(toKey(path), srcValue);
          }
          return function(object) {
            var objValue = get2(object, path);
            return objValue === undefined2 && objValue === srcValue ? hasIn(object, path) : baseIsEqual(srcValue, objValue, COMPARE_PARTIAL_FLAG | COMPARE_UNORDERED_FLAG);
          };
        }
        function baseMerge(object, source, srcIndex, customizer2, stack) {
          if (object === source) {
            return;
          }
          baseFor(source, function(srcValue, key2) {
            stack || (stack = new Stack());
            if (isObject(srcValue)) {
              baseMergeDeep(object, source, key2, srcIndex, baseMerge, customizer2, stack);
            } else {
              var newValue = customizer2 ? customizer2(safeGet(object, key2), srcValue, key2 + "", object, source, stack) : undefined2;
              if (newValue === undefined2) {
                newValue = srcValue;
              }
              assignMergeValue(object, key2, newValue);
            }
          }, keysIn);
        }
        function baseMergeDeep(object, source, key2, srcIndex, mergeFunc, customizer2, stack) {
          var objValue = safeGet(object, key2), srcValue = safeGet(source, key2), stacked = stack.get(srcValue);
          if (stacked) {
            assignMergeValue(object, key2, stacked);
            return;
          }
          var newValue = customizer2 ? customizer2(objValue, srcValue, key2 + "", object, source, stack) : undefined2;
          var isCommon = newValue === undefined2;
          if (isCommon) {
            var isArr = isArray(srcValue), isBuff = !isArr && isBuffer(srcValue), isTyped = !isArr && !isBuff && isTypedArray(srcValue);
            newValue = srcValue;
            if (isArr || isBuff || isTyped) {
              if (isArray(objValue)) {
                newValue = objValue;
              } else if (isArrayLikeObject(objValue)) {
                newValue = copyArray(objValue);
              } else if (isBuff) {
                isCommon = false;
                newValue = cloneBuffer(srcValue, true);
              } else if (isTyped) {
                isCommon = false;
                newValue = cloneTypedArray(srcValue, true);
              } else {
                newValue = [];
              }
            } else if (isPlainObject(srcValue) || isArguments(srcValue)) {
              newValue = objValue;
              if (isArguments(objValue)) {
                newValue = toPlainObject(objValue);
              } else if (!isObject(objValue) || isFunction(objValue)) {
                newValue = initCloneObject(srcValue);
              }
            } else {
              isCommon = false;
            }
          }
          if (isCommon) {
            stack.set(srcValue, newValue);
            mergeFunc(newValue, srcValue, srcIndex, customizer2, stack);
            stack["delete"](srcValue);
          }
          assignMergeValue(object, key2, newValue);
        }
        function baseNth(array, n) {
          var length = array.length;
          if (!length) {
            return;
          }
          n += n < 0 ? length : 0;
          return isIndex(n, length) ? array[n] : undefined2;
        }
        function baseOrderBy(collection, iteratees, orders) {
          if (iteratees.length) {
            iteratees = arrayMap(iteratees, function(iteratee2) {
              if (isArray(iteratee2)) {
                return function(value) {
                  return baseGet(value, iteratee2.length === 1 ? iteratee2[0] : iteratee2);
                };
              }
              return iteratee2;
            });
          } else {
            iteratees = [identity];
          }
          var index = -1;
          iteratees = arrayMap(iteratees, baseUnary(getIteratee()));
          var result2 = baseMap(collection, function(value, key2, collection2) {
            var criteria = arrayMap(iteratees, function(iteratee2) {
              return iteratee2(value);
            });
            return { "criteria": criteria, "index": ++index, "value": value };
          });
          return baseSortBy(result2, function(object, other) {
            return compareMultiple(object, other, orders);
          });
        }
        function basePick(object, paths) {
          return basePickBy(object, paths, function(value, path) {
            return hasIn(object, path);
          });
        }
        function basePickBy(object, paths, predicate) {
          var index = -1, length = paths.length, result2 = {};
          while (++index < length) {
            var path = paths[index], value = baseGet(object, path);
            if (predicate(value, path)) {
              baseSet(result2, castPath(path, object), value);
            }
          }
          return result2;
        }
        function basePropertyDeep(path) {
          return function(object) {
            return baseGet(object, path);
          };
        }
        function basePullAll(array, values2, iteratee2, comparator) {
          var indexOf2 = comparator ? baseIndexOfWith : baseIndexOf, index = -1, length = values2.length, seen = array;
          if (array === values2) {
            values2 = copyArray(values2);
          }
          if (iteratee2) {
            seen = arrayMap(array, baseUnary(iteratee2));
          }
          while (++index < length) {
            var fromIndex = 0, value = values2[index], computed = iteratee2 ? iteratee2(value) : value;
            while ((fromIndex = indexOf2(seen, computed, fromIndex, comparator)) > -1) {
              if (seen !== array) {
                splice.call(seen, fromIndex, 1);
              }
              splice.call(array, fromIndex, 1);
            }
          }
          return array;
        }
        function basePullAt(array, indexes) {
          var length = array ? indexes.length : 0, lastIndex = length - 1;
          while (length--) {
            var index = indexes[length];
            if (length == lastIndex || index !== previous) {
              var previous = index;
              if (isIndex(index)) {
                splice.call(array, index, 1);
              } else {
                baseUnset(array, index);
              }
            }
          }
          return array;
        }
        function baseRandom(lower, upper) {
          return lower + nativeFloor(nativeRandom() * (upper - lower + 1));
        }
        function baseRange(start, end, step, fromRight) {
          var index = -1, length = nativeMax(nativeCeil((end - start) / (step || 1)), 0), result2 = Array2(length);
          while (length--) {
            result2[fromRight ? length : ++index] = start;
            start += step;
          }
          return result2;
        }
        function baseRepeat(string, n) {
          var result2 = "";
          if (!string || n < 1 || n > MAX_SAFE_INTEGER) {
            return result2;
          }
          do {
            if (n % 2) {
              result2 += string;
            }
            n = nativeFloor(n / 2);
            if (n) {
              string += string;
            }
          } while (n);
          return result2;
        }
        function baseRest(func, start) {
          return setToString(overRest(func, start, identity), func + "");
        }
        function baseSample(collection) {
          return arraySample(values(collection));
        }
        function baseSampleSize(collection, n) {
          var array = values(collection);
          return shuffleSelf(array, baseClamp(n, 0, array.length));
        }
        function baseSet(object, path, value, customizer2) {
          if (!isObject(object)) {
            return object;
          }
          path = castPath(path, object);
          var index = -1, length = path.length, lastIndex = length - 1, nested = object;
          while (nested != null && ++index < length) {
            var key2 = toKey(path[index]), newValue = value;
            if (key2 === "__proto__" || key2 === "constructor" || key2 === "prototype") {
              return object;
            }
            if (index != lastIndex) {
              var objValue = nested[key2];
              newValue = customizer2 ? customizer2(objValue, key2, nested) : undefined2;
              if (newValue === undefined2) {
                newValue = isObject(objValue) ? objValue : isIndex(path[index + 1]) ? [] : {};
              }
            }
            assignValue(nested, key2, newValue);
            nested = nested[key2];
          }
          return object;
        }
        var baseSetData = !metaMap ? identity : function(func, data) {
          metaMap.set(func, data);
          return func;
        };
        var baseSetToString = !defineProperty ? identity : function(func, string) {
          return defineProperty(func, "toString", {
            "configurable": true,
            "enumerable": false,
            "value": constant(string),
            "writable": true
          });
        };
        function baseShuffle(collection) {
          return shuffleSelf(values(collection));
        }
        function baseSlice(array, start, end) {
          var index = -1, length = array.length;
          if (start < 0) {
            start = -start > length ? 0 : length + start;
          }
          end = end > length ? length : end;
          if (end < 0) {
            end += length;
          }
          length = start > end ? 0 : end - start >>> 0;
          start >>>= 0;
          var result2 = Array2(length);
          while (++index < length) {
            result2[index] = array[index + start];
          }
          return result2;
        }
        function baseSome(collection, predicate) {
          var result2;
          baseEach(collection, function(value, index, collection2) {
            result2 = predicate(value, index, collection2);
            return !result2;
          });
          return !!result2;
        }
        function baseSortedIndex(array, value, retHighest) {
          var low = 0, high = array == null ? low : array.length;
          if (typeof value == "number" && value === value && high <= HALF_MAX_ARRAY_LENGTH) {
            while (low < high) {
              var mid = low + high >>> 1, computed = array[mid];
              if (computed !== null && !isSymbol(computed) && (retHighest ? computed <= value : computed < value)) {
                low = mid + 1;
              } else {
                high = mid;
              }
            }
            return high;
          }
          return baseSortedIndexBy(array, value, identity, retHighest);
        }
        function baseSortedIndexBy(array, value, iteratee2, retHighest) {
          var low = 0, high = array == null ? 0 : array.length;
          if (high === 0) {
            return 0;
          }
          value = iteratee2(value);
          var valIsNaN = value !== value, valIsNull = value === null, valIsSymbol = isSymbol(value), valIsUndefined = value === undefined2;
          while (low < high) {
            var mid = nativeFloor((low + high) / 2), computed = iteratee2(array[mid]), othIsDefined = computed !== undefined2, othIsNull = computed === null, othIsReflexive = computed === computed, othIsSymbol = isSymbol(computed);
            if (valIsNaN) {
              var setLow = retHighest || othIsReflexive;
            } else if (valIsUndefined) {
              setLow = othIsReflexive && (retHighest || othIsDefined);
            } else if (valIsNull) {
              setLow = othIsReflexive && othIsDefined && (retHighest || !othIsNull);
            } else if (valIsSymbol) {
              setLow = othIsReflexive && othIsDefined && !othIsNull && (retHighest || !othIsSymbol);
            } else if (othIsNull || othIsSymbol) {
              setLow = false;
            } else {
              setLow = retHighest ? computed <= value : computed < value;
            }
            if (setLow) {
              low = mid + 1;
            } else {
              high = mid;
            }
          }
          return nativeMin(high, MAX_ARRAY_INDEX);
        }
        function baseSortedUniq(array, iteratee2) {
          var index = -1, length = array.length, resIndex = 0, result2 = [];
          while (++index < length) {
            var value = array[index], computed = iteratee2 ? iteratee2(value) : value;
            if (!index || !eq(computed, seen)) {
              var seen = computed;
              result2[resIndex++] = value === 0 ? 0 : value;
            }
          }
          return result2;
        }
        function baseToNumber(value) {
          if (typeof value == "number") {
            return value;
          }
          if (isSymbol(value)) {
            return NAN;
          }
          return +value;
        }
        function baseToString(value) {
          if (typeof value == "string") {
            return value;
          }
          if (isArray(value)) {
            return arrayMap(value, baseToString) + "";
          }
          if (isSymbol(value)) {
            return symbolToString ? symbolToString.call(value) : "";
          }
          var result2 = value + "";
          return result2 == "0" && 1 / value == -INFINITY ? "-0" : result2;
        }
        function baseUniq(array, iteratee2, comparator) {
          var index = -1, includes2 = arrayIncludes, length = array.length, isCommon = true, result2 = [], seen = result2;
          if (comparator) {
            isCommon = false;
            includes2 = arrayIncludesWith;
          } else if (length >= LARGE_ARRAY_SIZE) {
            var set4 = iteratee2 ? null : createSet(array);
            if (set4) {
              return setToArray(set4);
            }
            isCommon = false;
            includes2 = cacheHas;
            seen = new SetCache();
          } else {
            seen = iteratee2 ? [] : result2;
          }
          outer:
            while (++index < length) {
              var value = array[index], computed = iteratee2 ? iteratee2(value) : value;
              value = comparator || value !== 0 ? value : 0;
              if (isCommon && computed === computed) {
                var seenIndex = seen.length;
                while (seenIndex--) {
                  if (seen[seenIndex] === computed) {
                    continue outer;
                  }
                }
                if (iteratee2) {
                  seen.push(computed);
                }
                result2.push(value);
              } else if (!includes2(seen, computed, comparator)) {
                if (seen !== result2) {
                  seen.push(computed);
                }
                result2.push(value);
              }
            }
          return result2;
        }
        function baseUnset(object, path) {
          path = castPath(path, object);
          var index = -1, length = path.length;
          if (!length) {
            return true;
          }
          while (++index < length) {
            var key2 = toKey(path[index]);
            if (key2 === "__proto__" && !hasOwnProperty.call(object, "__proto__")) {
              return false;
            }
            if ((key2 === "constructor" || key2 === "prototype") && index < length - 1) {
              return false;
            }
          }
          var obj = parent(object, path);
          return obj == null || delete obj[toKey(last(path))];
        }
        function baseUpdate(object, path, updater, customizer2) {
          return baseSet(object, path, updater(baseGet(object, path)), customizer2);
        }
        function baseWhile(array, predicate, isDrop, fromRight) {
          var length = array.length, index = fromRight ? length : -1;
          while ((fromRight ? index-- : ++index < length) && predicate(array[index], index, array)) {
          }
          return isDrop ? baseSlice(array, fromRight ? 0 : index, fromRight ? index + 1 : length) : baseSlice(array, fromRight ? index + 1 : 0, fromRight ? length : index);
        }
        function baseWrapperValue(value, actions) {
          var result2 = value;
          if (result2 instanceof LazyWrapper) {
            result2 = result2.value();
          }
          return arrayReduce(actions, function(result3, action) {
            return action.func.apply(action.thisArg, arrayPush([result3], action.args));
          }, result2);
        }
        function baseXor(arrays, iteratee2, comparator) {
          var length = arrays.length;
          if (length < 2) {
            return length ? baseUniq(arrays[0]) : [];
          }
          var index = -1, result2 = Array2(length);
          while (++index < length) {
            var array = arrays[index], othIndex = -1;
            while (++othIndex < length) {
              if (othIndex != index) {
                result2[index] = baseDifference(result2[index] || array, arrays[othIndex], iteratee2, comparator);
              }
            }
          }
          return baseUniq(baseFlatten(result2, 1), iteratee2, comparator);
        }
        function baseZipObject(props, values2, assignFunc) {
          var index = -1, length = props.length, valsLength = values2.length, result2 = {};
          while (++index < length) {
            var value = index < valsLength ? values2[index] : undefined2;
            assignFunc(result2, props[index], value);
          }
          return result2;
        }
        function castArrayLikeObject(value) {
          return isArrayLikeObject(value) ? value : [];
        }
        function castFunction(value) {
          return typeof value == "function" ? value : identity;
        }
        function castPath(value, object) {
          if (isArray(value)) {
            return value;
          }
          return isKey(value, object) ? [value] : stringToPath(toString(value));
        }
        var castRest = baseRest;
        function castSlice(array, start, end) {
          var length = array.length;
          end = end === undefined2 ? length : end;
          return !start && end >= length ? array : baseSlice(array, start, end);
        }
        var clearTimeout = ctxClearTimeout || function(id) {
          return root.clearTimeout(id);
        };
        function cloneBuffer(buffer, isDeep) {
          if (isDeep) {
            return buffer.slice();
          }
          var length = buffer.length, result2 = allocUnsafe ? allocUnsafe(length) : new buffer.constructor(length);
          buffer.copy(result2);
          return result2;
        }
        function cloneArrayBuffer(arrayBuffer) {
          var result2 = new arrayBuffer.constructor(arrayBuffer.byteLength);
          new Uint8Array2(result2).set(new Uint8Array2(arrayBuffer));
          return result2;
        }
        function cloneDataView(dataView, isDeep) {
          var buffer = isDeep ? cloneArrayBuffer(dataView.buffer) : dataView.buffer;
          return new dataView.constructor(buffer, dataView.byteOffset, dataView.byteLength);
        }
        function cloneRegExp(regexp) {
          var result2 = new regexp.constructor(regexp.source, reFlags.exec(regexp));
          result2.lastIndex = regexp.lastIndex;
          return result2;
        }
        function cloneSymbol(symbol) {
          return symbolValueOf ? Object2(symbolValueOf.call(symbol)) : {};
        }
        function cloneTypedArray(typedArray, isDeep) {
          var buffer = isDeep ? cloneArrayBuffer(typedArray.buffer) : typedArray.buffer;
          return new typedArray.constructor(buffer, typedArray.byteOffset, typedArray.length);
        }
        function compareAscending(value, other) {
          if (value !== other) {
            var valIsDefined = value !== undefined2, valIsNull = value === null, valIsReflexive = value === value, valIsSymbol = isSymbol(value);
            var othIsDefined = other !== undefined2, othIsNull = other === null, othIsReflexive = other === other, othIsSymbol = isSymbol(other);
            if (!othIsNull && !othIsSymbol && !valIsSymbol && value > other || valIsSymbol && othIsDefined && othIsReflexive && !othIsNull && !othIsSymbol || valIsNull && othIsDefined && othIsReflexive || !valIsDefined && othIsReflexive || !valIsReflexive) {
              return 1;
            }
            if (!valIsNull && !valIsSymbol && !othIsSymbol && value < other || othIsSymbol && valIsDefined && valIsReflexive && !valIsNull && !valIsSymbol || othIsNull && valIsDefined && valIsReflexive || !othIsDefined && valIsReflexive || !othIsReflexive) {
              return -1;
            }
          }
          return 0;
        }
        function compareMultiple(object, other, orders) {
          var index = -1, objCriteria = object.criteria, othCriteria = other.criteria, length = objCriteria.length, ordersLength = orders.length;
          while (++index < length) {
            var result2 = compareAscending(objCriteria[index], othCriteria[index]);
            if (result2) {
              if (index >= ordersLength) {
                return result2;
              }
              var order = orders[index];
              return result2 * (order == "desc" ? -1 : 1);
            }
          }
          return object.index - other.index;
        }
        function composeArgs(args, partials, holders, isCurried) {
          var argsIndex = -1, argsLength = args.length, holdersLength = holders.length, leftIndex = -1, leftLength = partials.length, rangeLength = nativeMax(argsLength - holdersLength, 0), result2 = Array2(leftLength + rangeLength), isUncurried = !isCurried;
          while (++leftIndex < leftLength) {
            result2[leftIndex] = partials[leftIndex];
          }
          while (++argsIndex < holdersLength) {
            if (isUncurried || argsIndex < argsLength) {
              result2[holders[argsIndex]] = args[argsIndex];
            }
          }
          while (rangeLength--) {
            result2[leftIndex++] = args[argsIndex++];
          }
          return result2;
        }
        function composeArgsRight(args, partials, holders, isCurried) {
          var argsIndex = -1, argsLength = args.length, holdersIndex = -1, holdersLength = holders.length, rightIndex = -1, rightLength = partials.length, rangeLength = nativeMax(argsLength - holdersLength, 0), result2 = Array2(rangeLength + rightLength), isUncurried = !isCurried;
          while (++argsIndex < rangeLength) {
            result2[argsIndex] = args[argsIndex];
          }
          var offset = argsIndex;
          while (++rightIndex < rightLength) {
            result2[offset + rightIndex] = partials[rightIndex];
          }
          while (++holdersIndex < holdersLength) {
            if (isUncurried || argsIndex < argsLength) {
              result2[offset + holders[holdersIndex]] = args[argsIndex++];
            }
          }
          return result2;
        }
        function copyArray(source, array) {
          var index = -1, length = source.length;
          array || (array = Array2(length));
          while (++index < length) {
            array[index] = source[index];
          }
          return array;
        }
        function copyObject(source, props, object, customizer2) {
          var isNew = !object;
          object || (object = {});
          var index = -1, length = props.length;
          while (++index < length) {
            var key2 = props[index];
            var newValue = customizer2 ? customizer2(object[key2], source[key2], key2, object, source) : undefined2;
            if (newValue === undefined2) {
              newValue = source[key2];
            }
            if (isNew) {
              baseAssignValue(object, key2, newValue);
            } else {
              assignValue(object, key2, newValue);
            }
          }
          return object;
        }
        function copySymbols(source, object) {
          return copyObject(source, getSymbols(source), object);
        }
        function copySymbolsIn(source, object) {
          return copyObject(source, getSymbolsIn(source), object);
        }
        function createAggregator(setter, initializer) {
          return function(collection, iteratee2) {
            var func = isArray(collection) ? arrayAggregator : baseAggregator, accumulator = initializer ? initializer() : {};
            return func(collection, setter, getIteratee(iteratee2, 2), accumulator);
          };
        }
        function createAssigner(assigner) {
          return baseRest(function(object, sources) {
            var index = -1, length = sources.length, customizer2 = length > 1 ? sources[length - 1] : undefined2, guard = length > 2 ? sources[2] : undefined2;
            customizer2 = assigner.length > 3 && typeof customizer2 == "function" ? (length--, customizer2) : undefined2;
            if (guard && isIterateeCall(sources[0], sources[1], guard)) {
              customizer2 = length < 3 ? undefined2 : customizer2;
              length = 1;
            }
            object = Object2(object);
            while (++index < length) {
              var source = sources[index];
              if (source) {
                assigner(object, source, index, customizer2);
              }
            }
            return object;
          });
        }
        function createBaseEach(eachFunc, fromRight) {
          return function(collection, iteratee2) {
            if (collection == null) {
              return collection;
            }
            if (!isArrayLike(collection)) {
              return eachFunc(collection, iteratee2);
            }
            var length = collection.length, index = fromRight ? length : -1, iterable = Object2(collection);
            while (fromRight ? index-- : ++index < length) {
              if (iteratee2(iterable[index], index, iterable) === false) {
                break;
              }
            }
            return collection;
          };
        }
        function createBaseFor(fromRight) {
          return function(object, iteratee2, keysFunc) {
            var index = -1, iterable = Object2(object), props = keysFunc(object), length = props.length;
            while (length--) {
              var key2 = props[fromRight ? length : ++index];
              if (iteratee2(iterable[key2], key2, iterable) === false) {
                break;
              }
            }
            return object;
          };
        }
        function createBind(func, bitmask, thisArg) {
          var isBind = bitmask & WRAP_BIND_FLAG, Ctor = createCtor(func);
          function wrapper() {
            var fn = this && this !== root && this instanceof wrapper ? Ctor : func;
            return fn.apply(isBind ? thisArg : this, arguments);
          }
          return wrapper;
        }
        function createCaseFirst(methodName) {
          return function(string) {
            string = toString(string);
            var strSymbols = hasUnicode(string) ? stringToArray(string) : undefined2;
            var chr = strSymbols ? strSymbols[0] : string.charAt(0);
            var trailing = strSymbols ? castSlice(strSymbols, 1).join("") : string.slice(1);
            return chr[methodName]() + trailing;
          };
        }
        function createCompounder(callback) {
          return function(string) {
            return arrayReduce(words(deburr(string).replace(reApos, "")), callback, "");
          };
        }
        function createCtor(Ctor) {
          return function() {
            var args = arguments;
            switch (args.length) {
              case 0:
                return new Ctor();
              case 1:
                return new Ctor(args[0]);
              case 2:
                return new Ctor(args[0], args[1]);
              case 3:
                return new Ctor(args[0], args[1], args[2]);
              case 4:
                return new Ctor(args[0], args[1], args[2], args[3]);
              case 5:
                return new Ctor(args[0], args[1], args[2], args[3], args[4]);
              case 6:
                return new Ctor(args[0], args[1], args[2], args[3], args[4], args[5]);
              case 7:
                return new Ctor(args[0], args[1], args[2], args[3], args[4], args[5], args[6]);
            }
            var thisBinding = baseCreate(Ctor.prototype), result2 = Ctor.apply(thisBinding, args);
            return isObject(result2) ? result2 : thisBinding;
          };
        }
        function createCurry(func, bitmask, arity) {
          var Ctor = createCtor(func);
          function wrapper() {
            var length = arguments.length, args = Array2(length), index = length, placeholder = getHolder(wrapper);
            while (index--) {
              args[index] = arguments[index];
            }
            var holders = length < 3 && args[0] !== placeholder && args[length - 1] !== placeholder ? [] : replaceHolders(args, placeholder);
            length -= holders.length;
            if (length < arity) {
              return createRecurry(
                func,
                bitmask,
                createHybrid,
                wrapper.placeholder,
                undefined2,
                args,
                holders,
                undefined2,
                undefined2,
                arity - length
              );
            }
            var fn = this && this !== root && this instanceof wrapper ? Ctor : func;
            return apply(fn, this, args);
          }
          return wrapper;
        }
        function createFind(findIndexFunc) {
          return function(collection, predicate, fromIndex) {
            var iterable = Object2(collection);
            if (!isArrayLike(collection)) {
              var iteratee2 = getIteratee(predicate, 3);
              collection = keys(collection);
              predicate = function(key2) {
                return iteratee2(iterable[key2], key2, iterable);
              };
            }
            var index = findIndexFunc(collection, predicate, fromIndex);
            return index > -1 ? iterable[iteratee2 ? collection[index] : index] : undefined2;
          };
        }
        function createFlow(fromRight) {
          return flatRest(function(funcs) {
            var length = funcs.length, index = length, prereq = LodashWrapper.prototype.thru;
            if (fromRight) {
              funcs.reverse();
            }
            while (index--) {
              var func = funcs[index];
              if (typeof func != "function") {
                throw new TypeError2(FUNC_ERROR_TEXT);
              }
              if (prereq && !wrapper && getFuncName(func) == "wrapper") {
                var wrapper = new LodashWrapper([], true);
              }
            }
            index = wrapper ? index : length;
            while (++index < length) {
              func = funcs[index];
              var funcName = getFuncName(func), data = funcName == "wrapper" ? getData(func) : undefined2;
              if (data && isLaziable(data[0]) && data[1] == (WRAP_ARY_FLAG | WRAP_CURRY_FLAG | WRAP_PARTIAL_FLAG | WRAP_REARG_FLAG) && !data[4].length && data[9] == 1) {
                wrapper = wrapper[getFuncName(data[0])].apply(wrapper, data[3]);
              } else {
                wrapper = func.length == 1 && isLaziable(func) ? wrapper[funcName]() : wrapper.thru(func);
              }
            }
            return function() {
              var args = arguments, value = args[0];
              if (wrapper && args.length == 1 && isArray(value)) {
                return wrapper.plant(value).value();
              }
              var index2 = 0, result2 = length ? funcs[index2].apply(this, args) : value;
              while (++index2 < length) {
                result2 = funcs[index2].call(this, result2);
              }
              return result2;
            };
          });
        }
        function createHybrid(func, bitmask, thisArg, partials, holders, partialsRight, holdersRight, argPos, ary2, arity) {
          var isAry = bitmask & WRAP_ARY_FLAG, isBind = bitmask & WRAP_BIND_FLAG, isBindKey = bitmask & WRAP_BIND_KEY_FLAG, isCurried = bitmask & (WRAP_CURRY_FLAG | WRAP_CURRY_RIGHT_FLAG), isFlip = bitmask & WRAP_FLIP_FLAG, Ctor = isBindKey ? undefined2 : createCtor(func);
          function wrapper() {
            var length = arguments.length, args = Array2(length), index = length;
            while (index--) {
              args[index] = arguments[index];
            }
            if (isCurried) {
              var placeholder = getHolder(wrapper), holdersCount = countHolders(args, placeholder);
            }
            if (partials) {
              args = composeArgs(args, partials, holders, isCurried);
            }
            if (partialsRight) {
              args = composeArgsRight(args, partialsRight, holdersRight, isCurried);
            }
            length -= holdersCount;
            if (isCurried && length < arity) {
              var newHolders = replaceHolders(args, placeholder);
              return createRecurry(
                func,
                bitmask,
                createHybrid,
                wrapper.placeholder,
                thisArg,
                args,
                newHolders,
                argPos,
                ary2,
                arity - length
              );
            }
            var thisBinding = isBind ? thisArg : this, fn = isBindKey ? thisBinding[func] : func;
            length = args.length;
            if (argPos) {
              args = reorder(args, argPos);
            } else if (isFlip && length > 1) {
              args.reverse();
            }
            if (isAry && ary2 < length) {
              args.length = ary2;
            }
            if (this && this !== root && this instanceof wrapper) {
              fn = Ctor || createCtor(fn);
            }
            return fn.apply(thisBinding, args);
          }
          return wrapper;
        }
        function createInverter(setter, toIteratee) {
          return function(object, iteratee2) {
            return baseInverter(object, setter, toIteratee(iteratee2), {});
          };
        }
        function createMathOperation(operator, defaultValue) {
          return function(value, other) {
            var result2;
            if (value === undefined2 && other === undefined2) {
              return defaultValue;
            }
            if (value !== undefined2) {
              result2 = value;
            }
            if (other !== undefined2) {
              if (result2 === undefined2) {
                return other;
              }
              if (typeof value == "string" || typeof other == "string") {
                value = baseToString(value);
                other = baseToString(other);
              } else {
                value = baseToNumber(value);
                other = baseToNumber(other);
              }
              result2 = operator(value, other);
            }
            return result2;
          };
        }
        function createOver(arrayFunc) {
          return flatRest(function(iteratees) {
            iteratees = arrayMap(iteratees, baseUnary(getIteratee()));
            return baseRest(function(args) {
              var thisArg = this;
              return arrayFunc(iteratees, function(iteratee2) {
                return apply(iteratee2, thisArg, args);
              });
            });
          });
        }
        function createPadding(length, chars) {
          chars = chars === undefined2 ? " " : baseToString(chars);
          var charsLength = chars.length;
          if (charsLength < 2) {
            return charsLength ? baseRepeat(chars, length) : chars;
          }
          var result2 = baseRepeat(chars, nativeCeil(length / stringSize(chars)));
          return hasUnicode(chars) ? castSlice(stringToArray(result2), 0, length).join("") : result2.slice(0, length);
        }
        function createPartial(func, bitmask, thisArg, partials) {
          var isBind = bitmask & WRAP_BIND_FLAG, Ctor = createCtor(func);
          function wrapper() {
            var argsIndex = -1, argsLength = arguments.length, leftIndex = -1, leftLength = partials.length, args = Array2(leftLength + argsLength), fn = this && this !== root && this instanceof wrapper ? Ctor : func;
            while (++leftIndex < leftLength) {
              args[leftIndex] = partials[leftIndex];
            }
            while (argsLength--) {
              args[leftIndex++] = arguments[++argsIndex];
            }
            return apply(fn, isBind ? thisArg : this, args);
          }
          return wrapper;
        }
        function createRange(fromRight) {
          return function(start, end, step) {
            if (step && typeof step != "number" && isIterateeCall(start, end, step)) {
              end = step = undefined2;
            }
            start = toFinite(start);
            if (end === undefined2) {
              end = start;
              start = 0;
            } else {
              end = toFinite(end);
            }
            step = step === undefined2 ? start < end ? 1 : -1 : toFinite(step);
            return baseRange(start, end, step, fromRight);
          };
        }
        function createRelationalOperation(operator) {
          return function(value, other) {
            if (!(typeof value == "string" && typeof other == "string")) {
              value = toNumber(value);
              other = toNumber(other);
            }
            return operator(value, other);
          };
        }
        function createRecurry(func, bitmask, wrapFunc, placeholder, thisArg, partials, holders, argPos, ary2, arity) {
          var isCurry = bitmask & WRAP_CURRY_FLAG, newHolders = isCurry ? holders : undefined2, newHoldersRight = isCurry ? undefined2 : holders, newPartials = isCurry ? partials : undefined2, newPartialsRight = isCurry ? undefined2 : partials;
          bitmask |= isCurry ? WRAP_PARTIAL_FLAG : WRAP_PARTIAL_RIGHT_FLAG;
          bitmask &= ~(isCurry ? WRAP_PARTIAL_RIGHT_FLAG : WRAP_PARTIAL_FLAG);
          if (!(bitmask & WRAP_CURRY_BOUND_FLAG)) {
            bitmask &= ~(WRAP_BIND_FLAG | WRAP_BIND_KEY_FLAG);
          }
          var newData = [
            func,
            bitmask,
            thisArg,
            newPartials,
            newHolders,
            newPartialsRight,
            newHoldersRight,
            argPos,
            ary2,
            arity
          ];
          var result2 = wrapFunc.apply(undefined2, newData);
          if (isLaziable(func)) {
            setData(result2, newData);
          }
          result2.placeholder = placeholder;
          return setWrapToString(result2, func, bitmask);
        }
        function createRound(methodName) {
          var func = Math2[methodName];
          return function(number, precision) {
            number = toNumber(number);
            precision = precision == null ? 0 : nativeMin(toInteger(precision), 292);
            if (precision && nativeIsFinite(number)) {
              var pair = (toString(number) + "e").split("e"), value = func(pair[0] + "e" + (+pair[1] + precision));
              pair = (toString(value) + "e").split("e");
              return +(pair[0] + "e" + (+pair[1] - precision));
            }
            return func(number);
          };
        }
        var createSet = !(Set2 && 1 / setToArray(new Set2([, -0]))[1] == INFINITY) ? noop : function(values2) {
          return new Set2(values2);
        };
        function createToPairs(keysFunc) {
          return function(object) {
            var tag = getTag(object);
            if (tag == mapTag) {
              return mapToArray(object);
            }
            if (tag == setTag) {
              return setToPairs(object);
            }
            return baseToPairs(object, keysFunc(object));
          };
        }
        function createWrap(func, bitmask, thisArg, partials, holders, argPos, ary2, arity) {
          var isBindKey = bitmask & WRAP_BIND_KEY_FLAG;
          if (!isBindKey && typeof func != "function") {
            throw new TypeError2(FUNC_ERROR_TEXT);
          }
          var length = partials ? partials.length : 0;
          if (!length) {
            bitmask &= ~(WRAP_PARTIAL_FLAG | WRAP_PARTIAL_RIGHT_FLAG);
            partials = holders = undefined2;
          }
          ary2 = ary2 === undefined2 ? ary2 : nativeMax(toInteger(ary2), 0);
          arity = arity === undefined2 ? arity : toInteger(arity);
          length -= holders ? holders.length : 0;
          if (bitmask & WRAP_PARTIAL_RIGHT_FLAG) {
            var partialsRight = partials, holdersRight = holders;
            partials = holders = undefined2;
          }
          var data = isBindKey ? undefined2 : getData(func);
          var newData = [
            func,
            bitmask,
            thisArg,
            partials,
            holders,
            partialsRight,
            holdersRight,
            argPos,
            ary2,
            arity
          ];
          if (data) {
            mergeData(newData, data);
          }
          func = newData[0];
          bitmask = newData[1];
          thisArg = newData[2];
          partials = newData[3];
          holders = newData[4];
          arity = newData[9] = newData[9] === undefined2 ? isBindKey ? 0 : func.length : nativeMax(newData[9] - length, 0);
          if (!arity && bitmask & (WRAP_CURRY_FLAG | WRAP_CURRY_RIGHT_FLAG)) {
            bitmask &= ~(WRAP_CURRY_FLAG | WRAP_CURRY_RIGHT_FLAG);
          }
          if (!bitmask || bitmask == WRAP_BIND_FLAG) {
            var result2 = createBind(func, bitmask, thisArg);
          } else if (bitmask == WRAP_CURRY_FLAG || bitmask == WRAP_CURRY_RIGHT_FLAG) {
            result2 = createCurry(func, bitmask, arity);
          } else if ((bitmask == WRAP_PARTIAL_FLAG || bitmask == (WRAP_BIND_FLAG | WRAP_PARTIAL_FLAG)) && !holders.length) {
            result2 = createPartial(func, bitmask, thisArg, partials);
          } else {
            result2 = createHybrid.apply(undefined2, newData);
          }
          var setter = data ? baseSetData : setData;
          return setWrapToString(setter(result2, newData), func, bitmask);
        }
        function customDefaultsAssignIn(objValue, srcValue, key2, object) {
          if (objValue === undefined2 || eq(objValue, objectProto[key2]) && !hasOwnProperty.call(object, key2)) {
            return srcValue;
          }
          return objValue;
        }
        function customDefaultsMerge(objValue, srcValue, key2, object, source, stack) {
          if (isObject(objValue) && isObject(srcValue)) {
            stack.set(srcValue, objValue);
            baseMerge(objValue, srcValue, undefined2, customDefaultsMerge, stack);
            stack["delete"](srcValue);
          }
          return objValue;
        }
        function customOmitClone(value) {
          return isPlainObject(value) ? undefined2 : value;
        }
        function equalArrays(array, other, bitmask, customizer2, equalFunc, stack) {
          var isPartial = bitmask & COMPARE_PARTIAL_FLAG, arrLength = array.length, othLength = other.length;
          if (arrLength != othLength && !(isPartial && othLength > arrLength)) {
            return false;
          }
          var arrStacked = stack.get(array);
          var othStacked = stack.get(other);
          if (arrStacked && othStacked) {
            return arrStacked == other && othStacked == array;
          }
          var index = -1, result2 = true, seen = bitmask & COMPARE_UNORDERED_FLAG ? new SetCache() : undefined2;
          stack.set(array, other);
          stack.set(other, array);
          while (++index < arrLength) {
            var arrValue = array[index], othValue = other[index];
            if (customizer2) {
              var compared = isPartial ? customizer2(othValue, arrValue, index, other, array, stack) : customizer2(arrValue, othValue, index, array, other, stack);
            }
            if (compared !== undefined2) {
              if (compared) {
                continue;
              }
              result2 = false;
              break;
            }
            if (seen) {
              if (!arraySome(other, function(othValue2, othIndex) {
                if (!cacheHas(seen, othIndex) && (arrValue === othValue2 || equalFunc(arrValue, othValue2, bitmask, customizer2, stack))) {
                  return seen.push(othIndex);
                }
              })) {
                result2 = false;
                break;
              }
            } else if (!(arrValue === othValue || equalFunc(arrValue, othValue, bitmask, customizer2, stack))) {
              result2 = false;
              break;
            }
          }
          stack["delete"](array);
          stack["delete"](other);
          return result2;
        }
        function equalByTag(object, other, tag, bitmask, customizer2, equalFunc, stack) {
          switch (tag) {
            case dataViewTag:
              if (object.byteLength != other.byteLength || object.byteOffset != other.byteOffset) {
                return false;
              }
              object = object.buffer;
              other = other.buffer;
            case arrayBufferTag:
              if (object.byteLength != other.byteLength || !equalFunc(new Uint8Array2(object), new Uint8Array2(other))) {
                return false;
              }
              return true;
            case boolTag:
            case dateTag:
            case numberTag:
              return eq(+object, +other);
            case errorTag:
              return object.name == other.name && object.message == other.message;
            case regexpTag:
            case stringTag:
              return object == other + "";
            case mapTag:
              var convert = mapToArray;
            case setTag:
              var isPartial = bitmask & COMPARE_PARTIAL_FLAG;
              convert || (convert = setToArray);
              if (object.size != other.size && !isPartial) {
                return false;
              }
              var stacked = stack.get(object);
              if (stacked) {
                return stacked == other;
              }
              bitmask |= COMPARE_UNORDERED_FLAG;
              stack.set(object, other);
              var result2 = equalArrays(convert(object), convert(other), bitmask, customizer2, equalFunc, stack);
              stack["delete"](object);
              return result2;
            case symbolTag:
              if (symbolValueOf) {
                return symbolValueOf.call(object) == symbolValueOf.call(other);
              }
          }
          return false;
        }
        function equalObjects(object, other, bitmask, customizer2, equalFunc, stack) {
          var isPartial = bitmask & COMPARE_PARTIAL_FLAG, objProps = getAllKeys(object), objLength = objProps.length, othProps = getAllKeys(other), othLength = othProps.length;
          if (objLength != othLength && !isPartial) {
            return false;
          }
          var index = objLength;
          while (index--) {
            var key2 = objProps[index];
            if (!(isPartial ? key2 in other : hasOwnProperty.call(other, key2))) {
              return false;
            }
          }
          var objStacked = stack.get(object);
          var othStacked = stack.get(other);
          if (objStacked && othStacked) {
            return objStacked == other && othStacked == object;
          }
          var result2 = true;
          stack.set(object, other);
          stack.set(other, object);
          var skipCtor = isPartial;
          while (++index < objLength) {
            key2 = objProps[index];
            var objValue = object[key2], othValue = other[key2];
            if (customizer2) {
              var compared = isPartial ? customizer2(othValue, objValue, key2, other, object, stack) : customizer2(objValue, othValue, key2, object, other, stack);
            }
            if (!(compared === undefined2 ? objValue === othValue || equalFunc(objValue, othValue, bitmask, customizer2, stack) : compared)) {
              result2 = false;
              break;
            }
            skipCtor || (skipCtor = key2 == "constructor");
          }
          if (result2 && !skipCtor) {
            var objCtor = object.constructor, othCtor = other.constructor;
            if (objCtor != othCtor && ("constructor" in object && "constructor" in other) && !(typeof objCtor == "function" && objCtor instanceof objCtor && typeof othCtor == "function" && othCtor instanceof othCtor)) {
              result2 = false;
            }
          }
          stack["delete"](object);
          stack["delete"](other);
          return result2;
        }
        function flatRest(func) {
          return setToString(overRest(func, undefined2, flatten3), func + "");
        }
        function getAllKeys(object) {
          return baseGetAllKeys(object, keys, getSymbols);
        }
        function getAllKeysIn(object) {
          return baseGetAllKeys(object, keysIn, getSymbolsIn);
        }
        var getData = !metaMap ? noop : function(func) {
          return metaMap.get(func);
        };
        function getFuncName(func) {
          var result2 = func.name + "", array = realNames[result2], length = hasOwnProperty.call(realNames, result2) ? array.length : 0;
          while (length--) {
            var data = array[length], otherFunc = data.func;
            if (otherFunc == null || otherFunc == func) {
              return data.name;
            }
          }
          return result2;
        }
        function getHolder(func) {
          var object = hasOwnProperty.call(lodash, "placeholder") ? lodash : func;
          return object.placeholder;
        }
        function getIteratee() {
          var result2 = lodash.iteratee || iteratee;
          result2 = result2 === iteratee ? baseIteratee : result2;
          return arguments.length ? result2(arguments[0], arguments[1]) : result2;
        }
        function getMapData(map2, key2) {
          var data = map2.__data__;
          return isKeyable(key2) ? data[typeof key2 == "string" ? "string" : "hash"] : data.map;
        }
        function getMatchData(object) {
          var result2 = keys(object), length = result2.length;
          while (length--) {
            var key2 = result2[length], value = object[key2];
            result2[length] = [key2, value, isStrictComparable(value)];
          }
          return result2;
        }
        function getNative(object, key2) {
          var value = getValue(object, key2);
          return baseIsNative(value) ? value : undefined2;
        }
        function getRawTag(value) {
          var isOwn = hasOwnProperty.call(value, symToStringTag), tag = value[symToStringTag];
          try {
            value[symToStringTag] = undefined2;
            var unmasked = true;
          } catch (e) {
          }
          var result2 = nativeObjectToString.call(value);
          if (unmasked) {
            if (isOwn) {
              value[symToStringTag] = tag;
            } else {
              delete value[symToStringTag];
            }
          }
          return result2;
        }
        var getSymbols = !nativeGetSymbols ? stubArray : function(object) {
          if (object == null) {
            return [];
          }
          object = Object2(object);
          return arrayFilter(nativeGetSymbols(object), function(symbol) {
            return propertyIsEnumerable.call(object, symbol);
          });
        };
        var getSymbolsIn = !nativeGetSymbols ? stubArray : function(object) {
          var result2 = [];
          while (object) {
            arrayPush(result2, getSymbols(object));
            object = getPrototype(object);
          }
          return result2;
        };
        var getTag = baseGetTag;
        if (DataView && getTag(new DataView(new ArrayBuffer(1))) != dataViewTag || Map2 && getTag(new Map2()) != mapTag || Promise2 && getTag(Promise2.resolve()) != promiseTag || Set2 && getTag(new Set2()) != setTag || WeakMap && getTag(new WeakMap()) != weakMapTag) {
          getTag = function(value) {
            var result2 = baseGetTag(value), Ctor = result2 == objectTag ? value.constructor : undefined2, ctorString = Ctor ? toSource(Ctor) : "";
            if (ctorString) {
              switch (ctorString) {
                case dataViewCtorString:
                  return dataViewTag;
                case mapCtorString:
                  return mapTag;
                case promiseCtorString:
                  return promiseTag;
                case setCtorString:
                  return setTag;
                case weakMapCtorString:
                  return weakMapTag;
              }
            }
            return result2;
          };
        }
        function getView(start, end, transforms) {
          var index = -1, length = transforms.length;
          while (++index < length) {
            var data = transforms[index], size2 = data.size;
            switch (data.type) {
              case "drop":
                start += size2;
                break;
              case "dropRight":
                end -= size2;
                break;
              case "take":
                end = nativeMin(end, start + size2);
                break;
              case "takeRight":
                start = nativeMax(start, end - size2);
                break;
            }
          }
          return { "start": start, "end": end };
        }
        function getWrapDetails(source) {
          var match = source.match(reWrapDetails);
          return match ? match[1].split(reSplitDetails) : [];
        }
        function hasPath(object, path, hasFunc) {
          path = castPath(path, object);
          var index = -1, length = path.length, result2 = false;
          while (++index < length) {
            var key2 = toKey(path[index]);
            if (!(result2 = object != null && hasFunc(object, key2))) {
              break;
            }
            object = object[key2];
          }
          if (result2 || ++index != length) {
            return result2;
          }
          length = object == null ? 0 : object.length;
          return !!length && isLength(length) && isIndex(key2, length) && (isArray(object) || isArguments(object));
        }
        function initCloneArray(array) {
          var length = array.length, result2 = new array.constructor(length);
          if (length && typeof array[0] == "string" && hasOwnProperty.call(array, "index")) {
            result2.index = array.index;
            result2.input = array.input;
          }
          return result2;
        }
        function initCloneObject(object) {
          return typeof object.constructor == "function" && !isPrototype(object) ? baseCreate(getPrototype(object)) : {};
        }
        function initCloneByTag(object, tag, isDeep) {
          var Ctor = object.constructor;
          switch (tag) {
            case arrayBufferTag:
              return cloneArrayBuffer(object);
            case boolTag:
            case dateTag:
              return new Ctor(+object);
            case dataViewTag:
              return cloneDataView(object, isDeep);
            case float32Tag:
            case float64Tag:
            case int8Tag:
            case int16Tag:
            case int32Tag:
            case uint8Tag:
            case uint8ClampedTag:
            case uint16Tag:
            case uint32Tag:
              return cloneTypedArray(object, isDeep);
            case mapTag:
              return new Ctor();
            case numberTag:
            case stringTag:
              return new Ctor(object);
            case regexpTag:
              return cloneRegExp(object);
            case setTag:
              return new Ctor();
            case symbolTag:
              return cloneSymbol(object);
          }
        }
        function insertWrapDetails(source, details) {
          var length = details.length;
          if (!length) {
            return source;
          }
          var lastIndex = length - 1;
          details[lastIndex] = (length > 1 ? "& " : "") + details[lastIndex];
          details = details.join(length > 2 ? ", " : " ");
          return source.replace(reWrapComment, "{\n/* [wrapped with " + details + "] */\n");
        }
        function isFlattenable(value) {
          return isArray(value) || isArguments(value) || !!(spreadableSymbol && value && value[spreadableSymbol]);
        }
        function isIndex(value, length) {
          var type = typeof value;
          length = length == null ? MAX_SAFE_INTEGER : length;
          return !!length && (type == "number" || type != "symbol" && reIsUint.test(value)) && (value > -1 && value % 1 == 0 && value < length);
        }
        function isIterateeCall(value, index, object) {
          if (!isObject(object)) {
            return false;
          }
          var type = typeof index;
          if (type == "number" ? isArrayLike(object) && isIndex(index, object.length) : type == "string" && index in object) {
            return eq(object[index], value);
          }
          return false;
        }
        function isKey(value, object) {
          if (isArray(value)) {
            return false;
          }
          var type = typeof value;
          if (type == "number" || type == "symbol" || type == "boolean" || value == null || isSymbol(value)) {
            return true;
          }
          return reIsPlainProp.test(value) || !reIsDeepProp.test(value) || object != null && value in Object2(object);
        }
        function isKeyable(value) {
          var type = typeof value;
          return type == "string" || type == "number" || type == "symbol" || type == "boolean" ? value !== "__proto__" : value === null;
        }
        function isLaziable(func) {
          var funcName = getFuncName(func), other = lodash[funcName];
          if (typeof other != "function" || !(funcName in LazyWrapper.prototype)) {
            return false;
          }
          if (func === other) {
            return true;
          }
          var data = getData(other);
          return !!data && func === data[0];
        }
        function isMasked(func) {
          return !!maskSrcKey && maskSrcKey in func;
        }
        var isMaskable = coreJsData ? isFunction : stubFalse;
        function isPrototype(value) {
          var Ctor = value && value.constructor, proto = typeof Ctor == "function" && Ctor.prototype || objectProto;
          return value === proto;
        }
        function isStrictComparable(value) {
          return value === value && !isObject(value);
        }
        function matchesStrictComparable(key2, srcValue) {
          return function(object) {
            if (object == null) {
              return false;
            }
            return object[key2] === srcValue && (srcValue !== undefined2 || key2 in Object2(object));
          };
        }
        function memoizeCapped(func) {
          var result2 = memoize(func, function(key2) {
            if (cache.size === MAX_MEMOIZE_SIZE) {
              cache.clear();
            }
            return key2;
          });
          var cache = result2.cache;
          return result2;
        }
        function mergeData(data, source) {
          var bitmask = data[1], srcBitmask = source[1], newBitmask = bitmask | srcBitmask, isCommon = newBitmask < (WRAP_BIND_FLAG | WRAP_BIND_KEY_FLAG | WRAP_ARY_FLAG);
          var isCombo = srcBitmask == WRAP_ARY_FLAG && bitmask == WRAP_CURRY_FLAG || srcBitmask == WRAP_ARY_FLAG && bitmask == WRAP_REARG_FLAG && data[7].length <= source[8] || srcBitmask == (WRAP_ARY_FLAG | WRAP_REARG_FLAG) && source[7].length <= source[8] && bitmask == WRAP_CURRY_FLAG;
          if (!(isCommon || isCombo)) {
            return data;
          }
          if (srcBitmask & WRAP_BIND_FLAG) {
            data[2] = source[2];
            newBitmask |= bitmask & WRAP_BIND_FLAG ? 0 : WRAP_CURRY_BOUND_FLAG;
          }
          var value = source[3];
          if (value) {
            var partials = data[3];
            data[3] = partials ? composeArgs(partials, value, source[4]) : value;
            data[4] = partials ? replaceHolders(data[3], PLACEHOLDER) : source[4];
          }
          value = source[5];
          if (value) {
            partials = data[5];
            data[5] = partials ? composeArgsRight(partials, value, source[6]) : value;
            data[6] = partials ? replaceHolders(data[5], PLACEHOLDER) : source[6];
          }
          value = source[7];
          if (value) {
            data[7] = value;
          }
          if (srcBitmask & WRAP_ARY_FLAG) {
            data[8] = data[8] == null ? source[8] : nativeMin(data[8], source[8]);
          }
          if (data[9] == null) {
            data[9] = source[9];
          }
          data[0] = source[0];
          data[1] = newBitmask;
          return data;
        }
        function nativeKeysIn(object) {
          var result2 = [];
          if (object != null) {
            for (var key2 in Object2(object)) {
              result2.push(key2);
            }
          }
          return result2;
        }
        function objectToString(value) {
          return nativeObjectToString.call(value);
        }
        function overRest(func, start, transform2) {
          start = nativeMax(start === undefined2 ? func.length - 1 : start, 0);
          return function() {
            var args = arguments, index = -1, length = nativeMax(args.length - start, 0), array = Array2(length);
            while (++index < length) {
              array[index] = args[start + index];
            }
            index = -1;
            var otherArgs = Array2(start + 1);
            while (++index < start) {
              otherArgs[index] = args[index];
            }
            otherArgs[start] = transform2(array);
            return apply(func, this, otherArgs);
          };
        }
        function parent(object, path) {
          return path.length < 2 ? object : baseGet(object, baseSlice(path, 0, -1));
        }
        function reorder(array, indexes) {
          var arrLength = array.length, length = nativeMin(indexes.length, arrLength), oldArray = copyArray(array);
          while (length--) {
            var index = indexes[length];
            array[length] = isIndex(index, arrLength) ? oldArray[index] : undefined2;
          }
          return array;
        }
        function safeGet(object, key2) {
          if (key2 === "constructor" && typeof object[key2] === "function") {
            return;
          }
          if (key2 == "__proto__") {
            return;
          }
          return object[key2];
        }
        var setData = shortOut(baseSetData);
        var setTimeout = ctxSetTimeout || function(func, wait) {
          return root.setTimeout(func, wait);
        };
        var setToString = shortOut(baseSetToString);
        function setWrapToString(wrapper, reference, bitmask) {
          var source = reference + "";
          return setToString(wrapper, insertWrapDetails(source, updateWrapDetails(getWrapDetails(source), bitmask)));
        }
        function shortOut(func) {
          var count = 0, lastCalled = 0;
          return function() {
            var stamp = nativeNow(), remaining = HOT_SPAN - (stamp - lastCalled);
            lastCalled = stamp;
            if (remaining > 0) {
              if (++count >= HOT_COUNT) {
                return arguments[0];
              }
            } else {
              count = 0;
            }
            return func.apply(undefined2, arguments);
          };
        }
        function shuffleSelf(array, size2) {
          var index = -1, length = array.length, lastIndex = length - 1;
          size2 = size2 === undefined2 ? length : size2;
          while (++index < size2) {
            var rand = baseRandom(index, lastIndex), value = array[rand];
            array[rand] = array[index];
            array[index] = value;
          }
          array.length = size2;
          return array;
        }
        var stringToPath = memoizeCapped(function(string) {
          var result2 = [];
          if (string.charCodeAt(0) === 46) {
            result2.push("");
          }
          string.replace(rePropName, function(match, number, quote, subString) {
            result2.push(quote ? subString.replace(reEscapeChar, "$1") : number || match);
          });
          return result2;
        });
        function toKey(value) {
          if (typeof value == "string" || isSymbol(value)) {
            return value;
          }
          var result2 = value + "";
          return result2 == "0" && 1 / value == -INFINITY ? "-0" : result2;
        }
        function toSource(func) {
          if (func != null) {
            try {
              return funcToString.call(func);
            } catch (e) {
            }
            try {
              return func + "";
            } catch (e) {
            }
          }
          return "";
        }
        function updateWrapDetails(details, bitmask) {
          arrayEach(wrapFlags, function(pair) {
            var value = "_." + pair[0];
            if (bitmask & pair[1] && !arrayIncludes(details, value)) {
              details.push(value);
            }
          });
          return details.sort();
        }
        function wrapperClone(wrapper) {
          if (wrapper instanceof LazyWrapper) {
            return wrapper.clone();
          }
          var result2 = new LodashWrapper(wrapper.__wrapped__, wrapper.__chain__);
          result2.__actions__ = copyArray(wrapper.__actions__);
          result2.__index__ = wrapper.__index__;
          result2.__values__ = wrapper.__values__;
          return result2;
        }
        function chunk(array, size2, guard) {
          if (guard ? isIterateeCall(array, size2, guard) : size2 === undefined2) {
            size2 = 1;
          } else {
            size2 = nativeMax(toInteger(size2), 0);
          }
          var length = array == null ? 0 : array.length;
          if (!length || size2 < 1) {
            return [];
          }
          var index = 0, resIndex = 0, result2 = Array2(nativeCeil(length / size2));
          while (index < length) {
            result2[resIndex++] = baseSlice(array, index, index += size2);
          }
          return result2;
        }
        function compact(array) {
          var index = -1, length = array == null ? 0 : array.length, resIndex = 0, result2 = [];
          while (++index < length) {
            var value = array[index];
            if (value) {
              result2[resIndex++] = value;
            }
          }
          return result2;
        }
        function concat() {
          var length = arguments.length;
          if (!length) {
            return [];
          }
          var args = Array2(length - 1), array = arguments[0], index = length;
          while (index--) {
            args[index - 1] = arguments[index];
          }
          return arrayPush(isArray(array) ? copyArray(array) : [array], baseFlatten(args, 1));
        }
        var difference7 = baseRest(function(array, values2) {
          return isArrayLikeObject(array) ? baseDifference(array, baseFlatten(values2, 1, isArrayLikeObject, true)) : [];
        });
        var differenceBy = baseRest(function(array, values2) {
          var iteratee2 = last(values2);
          if (isArrayLikeObject(iteratee2)) {
            iteratee2 = undefined2;
          }
          return isArrayLikeObject(array) ? baseDifference(array, baseFlatten(values2, 1, isArrayLikeObject, true), getIteratee(iteratee2, 2)) : [];
        });
        var differenceWith = baseRest(function(array, values2) {
          var comparator = last(values2);
          if (isArrayLikeObject(comparator)) {
            comparator = undefined2;
          }
          return isArrayLikeObject(array) ? baseDifference(array, baseFlatten(values2, 1, isArrayLikeObject, true), undefined2, comparator) : [];
        });
        function drop(array, n, guard) {
          var length = array == null ? 0 : array.length;
          if (!length) {
            return [];
          }
          n = guard || n === undefined2 ? 1 : toInteger(n);
          return baseSlice(array, n < 0 ? 0 : n, length);
        }
        function dropRight(array, n, guard) {
          var length = array == null ? 0 : array.length;
          if (!length) {
            return [];
          }
          n = guard || n === undefined2 ? 1 : toInteger(n);
          n = length - n;
          return baseSlice(array, 0, n < 0 ? 0 : n);
        }
        function dropRightWhile(array, predicate) {
          return array && array.length ? baseWhile(array, getIteratee(predicate, 3), true, true) : [];
        }
        function dropWhile(array, predicate) {
          return array && array.length ? baseWhile(array, getIteratee(predicate, 3), true) : [];
        }
        function fill(array, value, start, end) {
          var length = array == null ? 0 : array.length;
          if (!length) {
            return [];
          }
          if (start && typeof start != "number" && isIterateeCall(array, value, start)) {
            start = 0;
            end = length;
          }
          return baseFill(array, value, start, end);
        }
        function findIndex(array, predicate, fromIndex) {
          var length = array == null ? 0 : array.length;
          if (!length) {
            return -1;
          }
          var index = fromIndex == null ? 0 : toInteger(fromIndex);
          if (index < 0) {
            index = nativeMax(length + index, 0);
          }
          return baseFindIndex(array, getIteratee(predicate, 3), index);
        }
        function findLastIndex(array, predicate, fromIndex) {
          var length = array == null ? 0 : array.length;
          if (!length) {
            return -1;
          }
          var index = length - 1;
          if (fromIndex !== undefined2) {
            index = toInteger(fromIndex);
            index = fromIndex < 0 ? nativeMax(length + index, 0) : nativeMin(index, length - 1);
          }
          return baseFindIndex(array, getIteratee(predicate, 3), index, true);
        }
        function flatten3(array) {
          var length = array == null ? 0 : array.length;
          return length ? baseFlatten(array, 1) : [];
        }
        function flattenDeep(array) {
          var length = array == null ? 0 : array.length;
          return length ? baseFlatten(array, INFINITY) : [];
        }
        function flattenDepth(array, depth) {
          var length = array == null ? 0 : array.length;
          if (!length) {
            return [];
          }
          depth = depth === undefined2 ? 1 : toInteger(depth);
          return baseFlatten(array, depth);
        }
        function fromPairs2(pairs) {
          var index = -1, length = pairs == null ? 0 : pairs.length, result2 = {};
          while (++index < length) {
            var pair = pairs[index];
            baseAssignValue(result2, pair[0], pair[1]);
          }
          return result2;
        }
        function head(array) {
          return array && array.length ? array[0] : undefined2;
        }
        function indexOf(array, value, fromIndex) {
          var length = array == null ? 0 : array.length;
          if (!length) {
            return -1;
          }
          var index = fromIndex == null ? 0 : toInteger(fromIndex);
          if (index < 0) {
            index = nativeMax(length + index, 0);
          }
          return baseIndexOf(array, value, index);
        }
        function initial(array) {
          var length = array == null ? 0 : array.length;
          return length ? baseSlice(array, 0, -1) : [];
        }
        var intersection = baseRest(function(arrays) {
          var mapped = arrayMap(arrays, castArrayLikeObject);
          return mapped.length && mapped[0] === arrays[0] ? baseIntersection(mapped) : [];
        });
        var intersectionBy = baseRest(function(arrays) {
          var iteratee2 = last(arrays), mapped = arrayMap(arrays, castArrayLikeObject);
          if (iteratee2 === last(mapped)) {
            iteratee2 = undefined2;
          } else {
            mapped.pop();
          }
          return mapped.length && mapped[0] === arrays[0] ? baseIntersection(mapped, getIteratee(iteratee2, 2)) : [];
        });
        var intersectionWith = baseRest(function(arrays) {
          var comparator = last(arrays), mapped = arrayMap(arrays, castArrayLikeObject);
          comparator = typeof comparator == "function" ? comparator : undefined2;
          if (comparator) {
            mapped.pop();
          }
          return mapped.length && mapped[0] === arrays[0] ? baseIntersection(mapped, undefined2, comparator) : [];
        });
        function join(array, separator) {
          return array == null ? "" : nativeJoin.call(array, separator);
        }
        function last(array) {
          var length = array == null ? 0 : array.length;
          return length ? array[length - 1] : undefined2;
        }
        function lastIndexOf(array, value, fromIndex) {
          var length = array == null ? 0 : array.length;
          if (!length) {
            return -1;
          }
          var index = length;
          if (fromIndex !== undefined2) {
            index = toInteger(fromIndex);
            index = index < 0 ? nativeMax(length + index, 0) : nativeMin(index, length - 1);
          }
          return value === value ? strictLastIndexOf(array, value, index) : baseFindIndex(array, baseIsNaN, index, true);
        }
        function nth(array, n) {
          return array && array.length ? baseNth(array, toInteger(n)) : undefined2;
        }
        var pull = baseRest(pullAll);
        function pullAll(array, values2) {
          return array && array.length && values2 && values2.length ? basePullAll(array, values2) : array;
        }
        function pullAllBy(array, values2, iteratee2) {
          return array && array.length && values2 && values2.length ? basePullAll(array, values2, getIteratee(iteratee2, 2)) : array;
        }
        function pullAllWith(array, values2, comparator) {
          return array && array.length && values2 && values2.length ? basePullAll(array, values2, undefined2, comparator) : array;
        }
        var pullAt = flatRest(function(array, indexes) {
          var length = array == null ? 0 : array.length, result2 = baseAt(array, indexes);
          basePullAt(array, arrayMap(indexes, function(index) {
            return isIndex(index, length) ? +index : index;
          }).sort(compareAscending));
          return result2;
        });
        function remove(array, predicate) {
          var result2 = [];
          if (!(array && array.length)) {
            return result2;
          }
          var index = -1, indexes = [], length = array.length;
          predicate = getIteratee(predicate, 3);
          while (++index < length) {
            var value = array[index];
            if (predicate(value, index, array)) {
              result2.push(value);
              indexes.push(index);
            }
          }
          basePullAt(array, indexes);
          return result2;
        }
        function reverse(array) {
          return array == null ? array : nativeReverse.call(array);
        }
        function slice(array, start, end) {
          var length = array == null ? 0 : array.length;
          if (!length) {
            return [];
          }
          if (end && typeof end != "number" && isIterateeCall(array, start, end)) {
            start = 0;
            end = length;
          } else {
            start = start == null ? 0 : toInteger(start);
            end = end === undefined2 ? length : toInteger(end);
          }
          return baseSlice(array, start, end);
        }
        function sortedIndex(array, value) {
          return baseSortedIndex(array, value);
        }
        function sortedIndexBy(array, value, iteratee2) {
          return baseSortedIndexBy(array, value, getIteratee(iteratee2, 2));
        }
        function sortedIndexOf(array, value) {
          var length = array == null ? 0 : array.length;
          if (length) {
            var index = baseSortedIndex(array, value);
            if (index < length && eq(array[index], value)) {
              return index;
            }
          }
          return -1;
        }
        function sortedLastIndex(array, value) {
          return baseSortedIndex(array, value, true);
        }
        function sortedLastIndexBy(array, value, iteratee2) {
          return baseSortedIndexBy(array, value, getIteratee(iteratee2, 2), true);
        }
        function sortedLastIndexOf(array, value) {
          var length = array == null ? 0 : array.length;
          if (length) {
            var index = baseSortedIndex(array, value, true) - 1;
            if (eq(array[index], value)) {
              return index;
            }
          }
          return -1;
        }
        function sortedUniq(array) {
          return array && array.length ? baseSortedUniq(array) : [];
        }
        function sortedUniqBy(array, iteratee2) {
          return array && array.length ? baseSortedUniq(array, getIteratee(iteratee2, 2)) : [];
        }
        function tail(array) {
          var length = array == null ? 0 : array.length;
          return length ? baseSlice(array, 1, length) : [];
        }
        function take(array, n, guard) {
          if (!(array && array.length)) {
            return [];
          }
          n = guard || n === undefined2 ? 1 : toInteger(n);
          return baseSlice(array, 0, n < 0 ? 0 : n);
        }
        function takeRight(array, n, guard) {
          var length = array == null ? 0 : array.length;
          if (!length) {
            return [];
          }
          n = guard || n === undefined2 ? 1 : toInteger(n);
          n = length - n;
          return baseSlice(array, n < 0 ? 0 : n, length);
        }
        function takeRightWhile(array, predicate) {
          return array && array.length ? baseWhile(array, getIteratee(predicate, 3), false, true) : [];
        }
        function takeWhile(array, predicate) {
          return array && array.length ? baseWhile(array, getIteratee(predicate, 3)) : [];
        }
        var union = baseRest(function(arrays) {
          return baseUniq(baseFlatten(arrays, 1, isArrayLikeObject, true));
        });
        var unionBy = baseRest(function(arrays) {
          var iteratee2 = last(arrays);
          if (isArrayLikeObject(iteratee2)) {
            iteratee2 = undefined2;
          }
          return baseUniq(baseFlatten(arrays, 1, isArrayLikeObject, true), getIteratee(iteratee2, 2));
        });
        var unionWith = baseRest(function(arrays) {
          var comparator = last(arrays);
          comparator = typeof comparator == "function" ? comparator : undefined2;
          return baseUniq(baseFlatten(arrays, 1, isArrayLikeObject, true), undefined2, comparator);
        });
        function uniq8(array) {
          return array && array.length ? baseUniq(array) : [];
        }
        function uniqBy(array, iteratee2) {
          return array && array.length ? baseUniq(array, getIteratee(iteratee2, 2)) : [];
        }
        function uniqWith2(array, comparator) {
          comparator = typeof comparator == "function" ? comparator : undefined2;
          return array && array.length ? baseUniq(array, undefined2, comparator) : [];
        }
        function unzip(array) {
          if (!(array && array.length)) {
            return [];
          }
          var length = 0;
          array = arrayFilter(array, function(group) {
            if (isArrayLikeObject(group)) {
              length = nativeMax(group.length, length);
              return true;
            }
          });
          return baseTimes(length, function(index) {
            return arrayMap(array, baseProperty(index));
          });
        }
        function unzipWith(array, iteratee2) {
          if (!(array && array.length)) {
            return [];
          }
          var result2 = unzip(array);
          if (iteratee2 == null) {
            return result2;
          }
          return arrayMap(result2, function(group) {
            return apply(iteratee2, undefined2, group);
          });
        }
        var without = baseRest(function(array, values2) {
          return isArrayLikeObject(array) ? baseDifference(array, values2) : [];
        });
        var xor = baseRest(function(arrays) {
          return baseXor(arrayFilter(arrays, isArrayLikeObject));
        });
        var xorBy = baseRest(function(arrays) {
          var iteratee2 = last(arrays);
          if (isArrayLikeObject(iteratee2)) {
            iteratee2 = undefined2;
          }
          return baseXor(arrayFilter(arrays, isArrayLikeObject), getIteratee(iteratee2, 2));
        });
        var xorWith = baseRest(function(arrays) {
          var comparator = last(arrays);
          comparator = typeof comparator == "function" ? comparator : undefined2;
          return baseXor(arrayFilter(arrays, isArrayLikeObject), undefined2, comparator);
        });
        var zip = baseRest(unzip);
        function zipObject(props, values2) {
          return baseZipObject(props || [], values2 || [], assignValue);
        }
        function zipObjectDeep(props, values2) {
          return baseZipObject(props || [], values2 || [], baseSet);
        }
        var zipWith2 = baseRest(function(arrays) {
          var length = arrays.length, iteratee2 = length > 1 ? arrays[length - 1] : undefined2;
          iteratee2 = typeof iteratee2 == "function" ? (arrays.pop(), iteratee2) : undefined2;
          return unzipWith(arrays, iteratee2);
        });
        function chain(value) {
          var result2 = lodash(value);
          result2.__chain__ = true;
          return result2;
        }
        function tap(value, interceptor) {
          interceptor(value);
          return value;
        }
        function thru(value, interceptor) {
          return interceptor(value);
        }
        var wrapperAt = flatRest(function(paths) {
          var length = paths.length, start = length ? paths[0] : 0, value = this.__wrapped__, interceptor = function(object) {
            return baseAt(object, paths);
          };
          if (length > 1 || this.__actions__.length || !(value instanceof LazyWrapper) || !isIndex(start)) {
            return this.thru(interceptor);
          }
          value = value.slice(start, +start + (length ? 1 : 0));
          value.__actions__.push({
            "func": thru,
            "args": [interceptor],
            "thisArg": undefined2
          });
          return new LodashWrapper(value, this.__chain__).thru(function(array) {
            if (length && !array.length) {
              array.push(undefined2);
            }
            return array;
          });
        });
        function wrapperChain() {
          return chain(this);
        }
        function wrapperCommit() {
          return new LodashWrapper(this.value(), this.__chain__);
        }
        function wrapperNext() {
          if (this.__values__ === undefined2) {
            this.__values__ = toArray(this.value());
          }
          var done = this.__index__ >= this.__values__.length, value = done ? undefined2 : this.__values__[this.__index__++];
          return { "done": done, "value": value };
        }
        function wrapperToIterator() {
          return this;
        }
        function wrapperPlant(value) {
          var result2, parent2 = this;
          while (parent2 instanceof baseLodash) {
            var clone3 = wrapperClone(parent2);
            clone3.__index__ = 0;
            clone3.__values__ = undefined2;
            if (result2) {
              previous.__wrapped__ = clone3;
            } else {
              result2 = clone3;
            }
            var previous = clone3;
            parent2 = parent2.__wrapped__;
          }
          previous.__wrapped__ = value;
          return result2;
        }
        function wrapperReverse() {
          var value = this.__wrapped__;
          if (value instanceof LazyWrapper) {
            var wrapped = value;
            if (this.__actions__.length) {
              wrapped = new LazyWrapper(this);
            }
            wrapped = wrapped.reverse();
            wrapped.__actions__.push({
              "func": thru,
              "args": [reverse],
              "thisArg": undefined2
            });
            return new LodashWrapper(wrapped, this.__chain__);
          }
          return this.thru(reverse);
        }
        function wrapperValue() {
          return baseWrapperValue(this.__wrapped__, this.__actions__);
        }
        var countBy2 = createAggregator(function(result2, value, key2) {
          if (hasOwnProperty.call(result2, key2)) {
            ++result2[key2];
          } else {
            baseAssignValue(result2, key2, 1);
          }
        });
        function every(collection, predicate, guard) {
          var func = isArray(collection) ? arrayEvery : baseEvery;
          if (guard && isIterateeCall(collection, predicate, guard)) {
            predicate = undefined2;
          }
          return func(collection, getIteratee(predicate, 3));
        }
        function filter(collection, predicate) {
          var func = isArray(collection) ? arrayFilter : baseFilter;
          return func(collection, getIteratee(predicate, 3));
        }
        var find = createFind(findIndex);
        var findLast = createFind(findLastIndex);
        function flatMap(collection, iteratee2) {
          return baseFlatten(map(collection, iteratee2), 1);
        }
        function flatMapDeep(collection, iteratee2) {
          return baseFlatten(map(collection, iteratee2), INFINITY);
        }
        function flatMapDepth(collection, iteratee2, depth) {
          depth = depth === undefined2 ? 1 : toInteger(depth);
          return baseFlatten(map(collection, iteratee2), depth);
        }
        function forEach(collection, iteratee2) {
          var func = isArray(collection) ? arrayEach : baseEach;
          return func(collection, getIteratee(iteratee2, 3));
        }
        function forEachRight(collection, iteratee2) {
          var func = isArray(collection) ? arrayEachRight : baseEachRight;
          return func(collection, getIteratee(iteratee2, 3));
        }
        var groupBy2 = createAggregator(function(result2, value, key2) {
          if (hasOwnProperty.call(result2, key2)) {
            result2[key2].push(value);
          } else {
            baseAssignValue(result2, key2, [value]);
          }
        });
        function includes(collection, value, fromIndex, guard) {
          collection = isArrayLike(collection) ? collection : values(collection);
          fromIndex = fromIndex && !guard ? toInteger(fromIndex) : 0;
          var length = collection.length;
          if (fromIndex < 0) {
            fromIndex = nativeMax(length + fromIndex, 0);
          }
          return isString(collection) ? fromIndex <= length && collection.indexOf(value, fromIndex) > -1 : !!length && baseIndexOf(collection, value, fromIndex) > -1;
        }
        var invokeMap = baseRest(function(collection, path, args) {
          var index = -1, isFunc = typeof path == "function", result2 = isArrayLike(collection) ? Array2(collection.length) : [];
          baseEach(collection, function(value) {
            result2[++index] = isFunc ? apply(path, value, args) : baseInvoke(value, path, args);
          });
          return result2;
        });
        var keyBy2 = createAggregator(function(result2, value, key2) {
          baseAssignValue(result2, key2, value);
        });
        function map(collection, iteratee2) {
          var func = isArray(collection) ? arrayMap : baseMap;
          return func(collection, getIteratee(iteratee2, 3));
        }
        function orderBy(collection, iteratees, orders, guard) {
          if (collection == null) {
            return [];
          }
          if (!isArray(iteratees)) {
            iteratees = iteratees == null ? [] : [iteratees];
          }
          orders = guard ? undefined2 : orders;
          if (!isArray(orders)) {
            orders = orders == null ? [] : [orders];
          }
          return baseOrderBy(collection, iteratees, orders);
        }
        var partition = createAggregator(function(result2, value, key2) {
          result2[key2 ? 0 : 1].push(value);
        }, function() {
          return [[], []];
        });
        function reduce(collection, iteratee2, accumulator) {
          var func = isArray(collection) ? arrayReduce : baseReduce, initAccum = arguments.length < 3;
          return func(collection, getIteratee(iteratee2, 4), accumulator, initAccum, baseEach);
        }
        function reduceRight(collection, iteratee2, accumulator) {
          var func = isArray(collection) ? arrayReduceRight : baseReduce, initAccum = arguments.length < 3;
          return func(collection, getIteratee(iteratee2, 4), accumulator, initAccum, baseEachRight);
        }
        function reject(collection, predicate) {
          var func = isArray(collection) ? arrayFilter : baseFilter;
          return func(collection, negate(getIteratee(predicate, 3)));
        }
        function sample(collection) {
          var func = isArray(collection) ? arraySample : baseSample;
          return func(collection);
        }
        function sampleSize(collection, n, guard) {
          if (guard ? isIterateeCall(collection, n, guard) : n === undefined2) {
            n = 1;
          } else {
            n = toInteger(n);
          }
          var func = isArray(collection) ? arraySampleSize : baseSampleSize;
          return func(collection, n);
        }
        function shuffle(collection) {
          var func = isArray(collection) ? arrayShuffle : baseShuffle;
          return func(collection);
        }
        function size(collection) {
          if (collection == null) {
            return 0;
          }
          if (isArrayLike(collection)) {
            return isString(collection) ? stringSize(collection) : collection.length;
          }
          var tag = getTag(collection);
          if (tag == mapTag || tag == setTag) {
            return collection.size;
          }
          return baseKeys(collection).length;
        }
        function some(collection, predicate, guard) {
          var func = isArray(collection) ? arraySome : baseSome;
          if (guard && isIterateeCall(collection, predicate, guard)) {
            predicate = undefined2;
          }
          return func(collection, getIteratee(predicate, 3));
        }
        var sortBy2 = baseRest(function(collection, iteratees) {
          if (collection == null) {
            return [];
          }
          var length = iteratees.length;
          if (length > 1 && isIterateeCall(collection, iteratees[0], iteratees[1])) {
            iteratees = [];
          } else if (length > 2 && isIterateeCall(iteratees[0], iteratees[1], iteratees[2])) {
            iteratees = [iteratees[0]];
          }
          return baseOrderBy(collection, baseFlatten(iteratees, 1), []);
        });
        var now = ctxNow || function() {
          return root.Date.now();
        };
        function after(n, func) {
          if (typeof func != "function") {
            throw new TypeError2(FUNC_ERROR_TEXT);
          }
          n = toInteger(n);
          return function() {
            if (--n < 1) {
              return func.apply(this, arguments);
            }
          };
        }
        function ary(func, n, guard) {
          n = guard ? undefined2 : n;
          n = func && n == null ? func.length : n;
          return createWrap(func, WRAP_ARY_FLAG, undefined2, undefined2, undefined2, undefined2, n);
        }
        function before(n, func) {
          var result2;
          if (typeof func != "function") {
            throw new TypeError2(FUNC_ERROR_TEXT);
          }
          n = toInteger(n);
          return function() {
            if (--n > 0) {
              result2 = func.apply(this, arguments);
            }
            if (n <= 1) {
              func = undefined2;
            }
            return result2;
          };
        }
        var bind = baseRest(function(func, thisArg, partials) {
          var bitmask = WRAP_BIND_FLAG;
          if (partials.length) {
            var holders = replaceHolders(partials, getHolder(bind));
            bitmask |= WRAP_PARTIAL_FLAG;
          }
          return createWrap(func, bitmask, thisArg, partials, holders);
        });
        var bindKey = baseRest(function(object, key2, partials) {
          var bitmask = WRAP_BIND_FLAG | WRAP_BIND_KEY_FLAG;
          if (partials.length) {
            var holders = replaceHolders(partials, getHolder(bindKey));
            bitmask |= WRAP_PARTIAL_FLAG;
          }
          return createWrap(key2, bitmask, object, partials, holders);
        });
        function curry(func, arity, guard) {
          arity = guard ? undefined2 : arity;
          var result2 = createWrap(func, WRAP_CURRY_FLAG, undefined2, undefined2, undefined2, undefined2, undefined2, arity);
          result2.placeholder = curry.placeholder;
          return result2;
        }
        function curryRight(func, arity, guard) {
          arity = guard ? undefined2 : arity;
          var result2 = createWrap(func, WRAP_CURRY_RIGHT_FLAG, undefined2, undefined2, undefined2, undefined2, undefined2, arity);
          result2.placeholder = curryRight.placeholder;
          return result2;
        }
        function debounce(func, wait, options) {
          var lastArgs, lastThis, maxWait, result2, timerId, lastCallTime, lastInvokeTime = 0, leading = false, maxing = false, trailing = true;
          if (typeof func != "function") {
            throw new TypeError2(FUNC_ERROR_TEXT);
          }
          wait = toNumber(wait) || 0;
          if (isObject(options)) {
            leading = !!options.leading;
            maxing = "maxWait" in options;
            maxWait = maxing ? nativeMax(toNumber(options.maxWait) || 0, wait) : maxWait;
            trailing = "trailing" in options ? !!options.trailing : trailing;
          }
          function invokeFunc(time) {
            var args = lastArgs, thisArg = lastThis;
            lastArgs = lastThis = undefined2;
            lastInvokeTime = time;
            result2 = func.apply(thisArg, args);
            return result2;
          }
          function leadingEdge(time) {
            lastInvokeTime = time;
            timerId = setTimeout(timerExpired, wait);
            return leading ? invokeFunc(time) : result2;
          }
          function remainingWait(time) {
            var timeSinceLastCall = time - lastCallTime, timeSinceLastInvoke = time - lastInvokeTime, timeWaiting = wait - timeSinceLastCall;
            return maxing ? nativeMin(timeWaiting, maxWait - timeSinceLastInvoke) : timeWaiting;
          }
          function shouldInvoke(time) {
            var timeSinceLastCall = time - lastCallTime, timeSinceLastInvoke = time - lastInvokeTime;
            return lastCallTime === undefined2 || timeSinceLastCall >= wait || timeSinceLastCall < 0 || maxing && timeSinceLastInvoke >= maxWait;
          }
          function timerExpired() {
            var time = now();
            if (shouldInvoke(time)) {
              return trailingEdge(time);
            }
            timerId = setTimeout(timerExpired, remainingWait(time));
          }
          function trailingEdge(time) {
            timerId = undefined2;
            if (trailing && lastArgs) {
              return invokeFunc(time);
            }
            lastArgs = lastThis = undefined2;
            return result2;
          }
          function cancel() {
            if (timerId !== undefined2) {
              clearTimeout(timerId);
            }
            lastInvokeTime = 0;
            lastArgs = lastCallTime = lastThis = timerId = undefined2;
          }
          function flush() {
            return timerId === undefined2 ? result2 : trailingEdge(now());
          }
          function debounced() {
            var time = now(), isInvoking = shouldInvoke(time);
            lastArgs = arguments;
            lastThis = this;
            lastCallTime = time;
            if (isInvoking) {
              if (timerId === undefined2) {
                return leadingEdge(lastCallTime);
              }
              if (maxing) {
                clearTimeout(timerId);
                timerId = setTimeout(timerExpired, wait);
                return invokeFunc(lastCallTime);
              }
            }
            if (timerId === undefined2) {
              timerId = setTimeout(timerExpired, wait);
            }
            return result2;
          }
          debounced.cancel = cancel;
          debounced.flush = flush;
          return debounced;
        }
        var defer = baseRest(function(func, args) {
          return baseDelay(func, 1, args);
        });
        var delay = baseRest(function(func, wait, args) {
          return baseDelay(func, toNumber(wait) || 0, args);
        });
        function flip(func) {
          return createWrap(func, WRAP_FLIP_FLAG);
        }
        function memoize(func, resolver) {
          if (typeof func != "function" || resolver != null && typeof resolver != "function") {
            throw new TypeError2(FUNC_ERROR_TEXT);
          }
          var memoized = function() {
            var args = arguments, key2 = resolver ? resolver.apply(this, args) : args[0], cache = memoized.cache;
            if (cache.has(key2)) {
              return cache.get(key2);
            }
            var result2 = func.apply(this, args);
            memoized.cache = cache.set(key2, result2) || cache;
            return result2;
          };
          memoized.cache = new (memoize.Cache || MapCache)();
          return memoized;
        }
        memoize.Cache = MapCache;
        function negate(predicate) {
          if (typeof predicate != "function") {
            throw new TypeError2(FUNC_ERROR_TEXT);
          }
          return function() {
            var args = arguments;
            switch (args.length) {
              case 0:
                return !predicate.call(this);
              case 1:
                return !predicate.call(this, args[0]);
              case 2:
                return !predicate.call(this, args[0], args[1]);
              case 3:
                return !predicate.call(this, args[0], args[1], args[2]);
            }
            return !predicate.apply(this, args);
          };
        }
        function once(func) {
          return before(2, func);
        }
        var overArgs = castRest(function(func, transforms) {
          transforms = transforms.length == 1 && isArray(transforms[0]) ? arrayMap(transforms[0], baseUnary(getIteratee())) : arrayMap(baseFlatten(transforms, 1), baseUnary(getIteratee()));
          var funcsLength = transforms.length;
          return baseRest(function(args) {
            var index = -1, length = nativeMin(args.length, funcsLength);
            while (++index < length) {
              args[index] = transforms[index].call(this, args[index]);
            }
            return apply(func, this, args);
          });
        });
        var partial = baseRest(function(func, partials) {
          var holders = replaceHolders(partials, getHolder(partial));
          return createWrap(func, WRAP_PARTIAL_FLAG, undefined2, partials, holders);
        });
        var partialRight = baseRest(function(func, partials) {
          var holders = replaceHolders(partials, getHolder(partialRight));
          return createWrap(func, WRAP_PARTIAL_RIGHT_FLAG, undefined2, partials, holders);
        });
        var rearg = flatRest(function(func, indexes) {
          return createWrap(func, WRAP_REARG_FLAG, undefined2, undefined2, undefined2, indexes);
        });
        function rest(func, start) {
          if (typeof func != "function") {
            throw new TypeError2(FUNC_ERROR_TEXT);
          }
          start = start === undefined2 ? start : toInteger(start);
          return baseRest(func, start);
        }
        function spread(func, start) {
          if (typeof func != "function") {
            throw new TypeError2(FUNC_ERROR_TEXT);
          }
          start = start == null ? 0 : nativeMax(toInteger(start), 0);
          return baseRest(function(args) {
            var array = args[start], otherArgs = castSlice(args, 0, start);
            if (array) {
              arrayPush(otherArgs, array);
            }
            return apply(func, this, otherArgs);
          });
        }
        function throttle(func, wait, options) {
          var leading = true, trailing = true;
          if (typeof func != "function") {
            throw new TypeError2(FUNC_ERROR_TEXT);
          }
          if (isObject(options)) {
            leading = "leading" in options ? !!options.leading : leading;
            trailing = "trailing" in options ? !!options.trailing : trailing;
          }
          return debounce(func, wait, {
            "leading": leading,
            "maxWait": wait,
            "trailing": trailing
          });
        }
        function unary(func) {
          return ary(func, 1);
        }
        function wrap(value, wrapper) {
          return partial(castFunction(wrapper), value);
        }
        function castArray() {
          if (!arguments.length) {
            return [];
          }
          var value = arguments[0];
          return isArray(value) ? value : [value];
        }
        function clone2(value) {
          return baseClone(value, CLONE_SYMBOLS_FLAG);
        }
        function cloneWith(value, customizer2) {
          customizer2 = typeof customizer2 == "function" ? customizer2 : undefined2;
          return baseClone(value, CLONE_SYMBOLS_FLAG, customizer2);
        }
        function cloneDeep2(value) {
          return baseClone(value, CLONE_DEEP_FLAG | CLONE_SYMBOLS_FLAG);
        }
        function cloneDeepWith(value, customizer2) {
          customizer2 = typeof customizer2 == "function" ? customizer2 : undefined2;
          return baseClone(value, CLONE_DEEP_FLAG | CLONE_SYMBOLS_FLAG, customizer2);
        }
        function conformsTo(object, source) {
          return source == null || baseConformsTo(object, source, keys(source));
        }
        function eq(value, other) {
          return value === other || value !== value && other !== other;
        }
        var gt = createRelationalOperation(baseGt);
        var gte = createRelationalOperation(function(value, other) {
          return value >= other;
        });
        var isArguments = baseIsArguments(/* @__PURE__ */ (function() {
          return arguments;
        })()) ? baseIsArguments : function(value) {
          return isObjectLike(value) && hasOwnProperty.call(value, "callee") && !propertyIsEnumerable.call(value, "callee");
        };
        var isArray = Array2.isArray;
        var isArrayBuffer = nodeIsArrayBuffer ? baseUnary(nodeIsArrayBuffer) : baseIsArrayBuffer;
        function isArrayLike(value) {
          return value != null && isLength(value.length) && !isFunction(value);
        }
        function isArrayLikeObject(value) {
          return isObjectLike(value) && isArrayLike(value);
        }
        function isBoolean(value) {
          return value === true || value === false || isObjectLike(value) && baseGetTag(value) == boolTag;
        }
        var isBuffer = nativeIsBuffer || stubFalse;
        var isDate = nodeIsDate ? baseUnary(nodeIsDate) : baseIsDate;
        function isElement(value) {
          return isObjectLike(value) && value.nodeType === 1 && !isPlainObject(value);
        }
        function isEmpty(value) {
          if (value == null) {
            return true;
          }
          if (isArrayLike(value) && (isArray(value) || typeof value == "string" || typeof value.splice == "function" || isBuffer(value) || isTypedArray(value) || isArguments(value))) {
            return !value.length;
          }
          var tag = getTag(value);
          if (tag == mapTag || tag == setTag) {
            return !value.size;
          }
          if (isPrototype(value)) {
            return !baseKeys(value).length;
          }
          for (var key2 in value) {
            if (hasOwnProperty.call(value, key2)) {
              return false;
            }
          }
          return true;
        }
        function isEqual4(value, other) {
          return baseIsEqual(value, other);
        }
        function isEqualWith(value, other, customizer2) {
          customizer2 = typeof customizer2 == "function" ? customizer2 : undefined2;
          var result2 = customizer2 ? customizer2(value, other) : undefined2;
          return result2 === undefined2 ? baseIsEqual(value, other, undefined2, customizer2) : !!result2;
        }
        function isError(value) {
          if (!isObjectLike(value)) {
            return false;
          }
          var tag = baseGetTag(value);
          return tag == errorTag || tag == domExcTag || typeof value.message == "string" && typeof value.name == "string" && !isPlainObject(value);
        }
        function isFinite(value) {
          return typeof value == "number" && nativeIsFinite(value);
        }
        function isFunction(value) {
          if (!isObject(value)) {
            return false;
          }
          var tag = baseGetTag(value);
          return tag == funcTag || tag == genTag || tag == asyncTag || tag == proxyTag;
        }
        function isInteger(value) {
          return typeof value == "number" && value == toInteger(value);
        }
        function isLength(value) {
          return typeof value == "number" && value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
        }
        function isObject(value) {
          var type = typeof value;
          return value != null && (type == "object" || type == "function");
        }
        function isObjectLike(value) {
          return value != null && typeof value == "object";
        }
        var isMap = nodeIsMap ? baseUnary(nodeIsMap) : baseIsMap;
        function isMatch(object, source) {
          return object === source || baseIsMatch(object, source, getMatchData(source));
        }
        function isMatchWith(object, source, customizer2) {
          customizer2 = typeof customizer2 == "function" ? customizer2 : undefined2;
          return baseIsMatch(object, source, getMatchData(source), customizer2);
        }
        function isNaN2(value) {
          return isNumber(value) && value != +value;
        }
        function isNative(value) {
          if (isMaskable(value)) {
            throw new Error2(CORE_ERROR_TEXT);
          }
          return baseIsNative(value);
        }
        function isNull(value) {
          return value === null;
        }
        function isNil(value) {
          return value == null;
        }
        function isNumber(value) {
          return typeof value == "number" || isObjectLike(value) && baseGetTag(value) == numberTag;
        }
        function isPlainObject(value) {
          if (!isObjectLike(value) || baseGetTag(value) != objectTag) {
            return false;
          }
          var proto = getPrototype(value);
          if (proto === null) {
            return true;
          }
          var Ctor = hasOwnProperty.call(proto, "constructor") && proto.constructor;
          return typeof Ctor == "function" && Ctor instanceof Ctor && funcToString.call(Ctor) == objectCtorString;
        }
        var isRegExp = nodeIsRegExp ? baseUnary(nodeIsRegExp) : baseIsRegExp;
        function isSafeInteger(value) {
          return isInteger(value) && value >= -MAX_SAFE_INTEGER && value <= MAX_SAFE_INTEGER;
        }
        var isSet = nodeIsSet ? baseUnary(nodeIsSet) : baseIsSet;
        function isString(value) {
          return typeof value == "string" || !isArray(value) && isObjectLike(value) && baseGetTag(value) == stringTag;
        }
        function isSymbol(value) {
          return typeof value == "symbol" || isObjectLike(value) && baseGetTag(value) == symbolTag;
        }
        var isTypedArray = nodeIsTypedArray ? baseUnary(nodeIsTypedArray) : baseIsTypedArray;
        function isUndefined(value) {
          return value === undefined2;
        }
        function isWeakMap(value) {
          return isObjectLike(value) && getTag(value) == weakMapTag;
        }
        function isWeakSet(value) {
          return isObjectLike(value) && baseGetTag(value) == weakSetTag;
        }
        var lt = createRelationalOperation(baseLt);
        var lte = createRelationalOperation(function(value, other) {
          return value <= other;
        });
        function toArray(value) {
          if (!value) {
            return [];
          }
          if (isArrayLike(value)) {
            return isString(value) ? stringToArray(value) : copyArray(value);
          }
          if (symIterator && value[symIterator]) {
            return iteratorToArray(value[symIterator]());
          }
          var tag = getTag(value), func = tag == mapTag ? mapToArray : tag == setTag ? setToArray : values;
          return func(value);
        }
        function toFinite(value) {
          if (!value) {
            return value === 0 ? value : 0;
          }
          value = toNumber(value);
          if (value === INFINITY || value === -INFINITY) {
            var sign = value < 0 ? -1 : 1;
            return sign * MAX_INTEGER;
          }
          return value === value ? value : 0;
        }
        function toInteger(value) {
          var result2 = toFinite(value), remainder = result2 % 1;
          return result2 === result2 ? remainder ? result2 - remainder : result2 : 0;
        }
        function toLength(value) {
          return value ? baseClamp(toInteger(value), 0, MAX_ARRAY_LENGTH) : 0;
        }
        function toNumber(value) {
          if (typeof value == "number") {
            return value;
          }
          if (isSymbol(value)) {
            return NAN;
          }
          if (isObject(value)) {
            var other = typeof value.valueOf == "function" ? value.valueOf() : value;
            value = isObject(other) ? other + "" : other;
          }
          if (typeof value != "string") {
            return value === 0 ? value : +value;
          }
          value = baseTrim(value);
          var isBinary = reIsBinary.test(value);
          return isBinary || reIsOctal.test(value) ? freeParseInt(value.slice(2), isBinary ? 2 : 8) : reIsBadHex.test(value) ? NAN : +value;
        }
        function toPlainObject(value) {
          return copyObject(value, keysIn(value));
        }
        function toSafeInteger(value) {
          return value ? baseClamp(toInteger(value), -MAX_SAFE_INTEGER, MAX_SAFE_INTEGER) : value === 0 ? value : 0;
        }
        function toString(value) {
          return value == null ? "" : baseToString(value);
        }
        var assign = createAssigner(function(object, source) {
          if (isPrototype(source) || isArrayLike(source)) {
            copyObject(source, keys(source), object);
            return;
          }
          for (var key2 in source) {
            if (hasOwnProperty.call(source, key2)) {
              assignValue(object, key2, source[key2]);
            }
          }
        });
        var assignIn = createAssigner(function(object, source) {
          copyObject(source, keysIn(source), object);
        });
        var assignInWith = createAssigner(function(object, source, srcIndex, customizer2) {
          copyObject(source, keysIn(source), object, customizer2);
        });
        var assignWith = createAssigner(function(object, source, srcIndex, customizer2) {
          copyObject(source, keys(source), object, customizer2);
        });
        var at = flatRest(baseAt);
        function create(prototype, properties) {
          var result2 = baseCreate(prototype);
          return properties == null ? result2 : baseAssign(result2, properties);
        }
        var defaults = baseRest(function(object, sources) {
          object = Object2(object);
          var index = -1;
          var length = sources.length;
          var guard = length > 2 ? sources[2] : undefined2;
          if (guard && isIterateeCall(sources[0], sources[1], guard)) {
            length = 1;
          }
          while (++index < length) {
            var source = sources[index];
            var props = keysIn(source);
            var propsIndex = -1;
            var propsLength = props.length;
            while (++propsIndex < propsLength) {
              var key2 = props[propsIndex];
              var value = object[key2];
              if (value === undefined2 || eq(value, objectProto[key2]) && !hasOwnProperty.call(object, key2)) {
                object[key2] = source[key2];
              }
            }
          }
          return object;
        });
        var defaultsDeep = baseRest(function(args) {
          args.push(undefined2, customDefaultsMerge);
          return apply(mergeWith2, undefined2, args);
        });
        function findKey(object, predicate) {
          return baseFindKey(object, getIteratee(predicate, 3), baseForOwn);
        }
        function findLastKey(object, predicate) {
          return baseFindKey(object, getIteratee(predicate, 3), baseForOwnRight);
        }
        function forIn(object, iteratee2) {
          return object == null ? object : baseFor(object, getIteratee(iteratee2, 3), keysIn);
        }
        function forInRight(object, iteratee2) {
          return object == null ? object : baseForRight(object, getIteratee(iteratee2, 3), keysIn);
        }
        function forOwn(object, iteratee2) {
          return object && baseForOwn(object, getIteratee(iteratee2, 3));
        }
        function forOwnRight(object, iteratee2) {
          return object && baseForOwnRight(object, getIteratee(iteratee2, 3));
        }
        function functions(object) {
          return object == null ? [] : baseFunctions(object, keys(object));
        }
        function functionsIn(object) {
          return object == null ? [] : baseFunctions(object, keysIn(object));
        }
        function get2(object, path, defaultValue) {
          var result2 = object == null ? undefined2 : baseGet(object, path);
          return result2 === undefined2 ? defaultValue : result2;
        }
        function has(object, path) {
          return object != null && hasPath(object, path, baseHas);
        }
        function hasIn(object, path) {
          return object != null && hasPath(object, path, baseHasIn);
        }
        var invert = createInverter(function(result2, value, key2) {
          if (value != null && typeof value.toString != "function") {
            value = nativeObjectToString.call(value);
          }
          result2[value] = key2;
        }, constant(identity));
        var invertBy = createInverter(function(result2, value, key2) {
          if (value != null && typeof value.toString != "function") {
            value = nativeObjectToString.call(value);
          }
          if (hasOwnProperty.call(result2, value)) {
            result2[value].push(key2);
          } else {
            result2[value] = [key2];
          }
        }, getIteratee);
        var invoke = baseRest(baseInvoke);
        function keys(object) {
          return isArrayLike(object) ? arrayLikeKeys(object) : baseKeys(object);
        }
        function keysIn(object) {
          return isArrayLike(object) ? arrayLikeKeys(object, true) : baseKeysIn(object);
        }
        function mapKeys(object, iteratee2) {
          var result2 = {};
          iteratee2 = getIteratee(iteratee2, 3);
          baseForOwn(object, function(value, key2, object2) {
            baseAssignValue(result2, iteratee2(value, key2, object2), value);
          });
          return result2;
        }
        function mapValues(object, iteratee2) {
          var result2 = {};
          iteratee2 = getIteratee(iteratee2, 3);
          baseForOwn(object, function(value, key2, object2) {
            baseAssignValue(result2, key2, iteratee2(value, key2, object2));
          });
          return result2;
        }
        var merge3 = createAssigner(function(object, source, srcIndex) {
          baseMerge(object, source, srcIndex);
        });
        var mergeWith2 = createAssigner(function(object, source, srcIndex, customizer2) {
          baseMerge(object, source, srcIndex, customizer2);
        });
        var omit = flatRest(function(object, paths) {
          var result2 = {};
          if (object == null) {
            return result2;
          }
          var isDeep = false;
          paths = arrayMap(paths, function(path) {
            path = castPath(path, object);
            isDeep || (isDeep = path.length > 1);
            return path;
          });
          copyObject(object, getAllKeysIn(object), result2);
          if (isDeep) {
            result2 = baseClone(result2, CLONE_DEEP_FLAG | CLONE_FLAT_FLAG | CLONE_SYMBOLS_FLAG, customOmitClone);
          }
          var length = paths.length;
          while (length--) {
            baseUnset(result2, paths[length]);
          }
          return result2;
        });
        function omitBy(object, predicate) {
          return pickBy(object, negate(getIteratee(predicate)));
        }
        var pick2 = flatRest(function(object, paths) {
          return object == null ? {} : basePick(object, paths);
        });
        function pickBy(object, predicate) {
          if (object == null) {
            return {};
          }
          var props = arrayMap(getAllKeysIn(object), function(prop) {
            return [prop];
          });
          predicate = getIteratee(predicate);
          return basePickBy(object, props, function(value, path) {
            return predicate(value, path[0]);
          });
        }
        function result(object, path, defaultValue) {
          path = castPath(path, object);
          var index = -1, length = path.length;
          if (!length) {
            length = 1;
            object = undefined2;
          }
          while (++index < length) {
            var value = object == null ? undefined2 : object[toKey(path[index])];
            if (value === undefined2) {
              index = length;
              value = defaultValue;
            }
            object = isFunction(value) ? value.call(object) : value;
          }
          return object;
        }
        function set3(object, path, value) {
          return object == null ? object : baseSet(object, path, value);
        }
        function setWith(object, path, value, customizer2) {
          customizer2 = typeof customizer2 == "function" ? customizer2 : undefined2;
          return object == null ? object : baseSet(object, path, value, customizer2);
        }
        var toPairs = createToPairs(keys);
        var toPairsIn = createToPairs(keysIn);
        function transform(object, iteratee2, accumulator) {
          var isArr = isArray(object), isArrLike = isArr || isBuffer(object) || isTypedArray(object);
          iteratee2 = getIteratee(iteratee2, 4);
          if (accumulator == null) {
            var Ctor = object && object.constructor;
            if (isArrLike) {
              accumulator = isArr ? new Ctor() : [];
            } else if (isObject(object)) {
              accumulator = isFunction(Ctor) ? baseCreate(getPrototype(object)) : {};
            } else {
              accumulator = {};
            }
          }
          (isArrLike ? arrayEach : baseForOwn)(object, function(value, index, object2) {
            return iteratee2(accumulator, value, index, object2);
          });
          return accumulator;
        }
        function unset(object, path) {
          return object == null ? true : baseUnset(object, path);
        }
        function update(object, path, updater) {
          return object == null ? object : baseUpdate(object, path, castFunction(updater));
        }
        function updateWith(object, path, updater, customizer2) {
          customizer2 = typeof customizer2 == "function" ? customizer2 : undefined2;
          return object == null ? object : baseUpdate(object, path, castFunction(updater), customizer2);
        }
        function values(object) {
          return object == null ? [] : baseValues(object, keys(object));
        }
        function valuesIn(object) {
          return object == null ? [] : baseValues(object, keysIn(object));
        }
        function clamp(number, lower, upper) {
          if (upper === undefined2) {
            upper = lower;
            lower = undefined2;
          }
          if (upper !== undefined2) {
            upper = toNumber(upper);
            upper = upper === upper ? upper : 0;
          }
          if (lower !== undefined2) {
            lower = toNumber(lower);
            lower = lower === lower ? lower : 0;
          }
          return baseClamp(toNumber(number), lower, upper);
        }
        function inRange2(number, start, end) {
          start = toFinite(start);
          if (end === undefined2) {
            end = start;
            start = 0;
          } else {
            end = toFinite(end);
          }
          number = toNumber(number);
          return baseInRange(number, start, end);
        }
        function random(lower, upper, floating) {
          if (floating && typeof floating != "boolean" && isIterateeCall(lower, upper, floating)) {
            upper = floating = undefined2;
          }
          if (floating === undefined2) {
            if (typeof upper == "boolean") {
              floating = upper;
              upper = undefined2;
            } else if (typeof lower == "boolean") {
              floating = lower;
              lower = undefined2;
            }
          }
          if (lower === undefined2 && upper === undefined2) {
            lower = 0;
            upper = 1;
          } else {
            lower = toFinite(lower);
            if (upper === undefined2) {
              upper = lower;
              lower = 0;
            } else {
              upper = toFinite(upper);
            }
          }
          if (lower > upper) {
            var temp = lower;
            lower = upper;
            upper = temp;
          }
          if (floating || lower % 1 || upper % 1) {
            var rand = nativeRandom();
            return nativeMin(lower + rand * (upper - lower + freeParseFloat("1e-" + ((rand + "").length - 1))), upper);
          }
          return baseRandom(lower, upper);
        }
        var camelCase = createCompounder(function(result2, word, index) {
          word = word.toLowerCase();
          return result2 + (index ? capitalize(word) : word);
        });
        function capitalize(string) {
          return upperFirst(toString(string).toLowerCase());
        }
        function deburr(string) {
          string = toString(string);
          return string && string.replace(reLatin, deburrLetter).replace(reComboMark, "");
        }
        function endsWith(string, target, position) {
          string = toString(string);
          target = baseToString(target);
          var length = string.length;
          position = position === undefined2 ? length : baseClamp(toInteger(position), 0, length);
          var end = position;
          position -= target.length;
          return position >= 0 && string.slice(position, end) == target;
        }
        function escape(string) {
          string = toString(string);
          return string && reHasUnescapedHtml.test(string) ? string.replace(reUnescapedHtml, escapeHtmlChar) : string;
        }
        function escapeRegExp(string) {
          string = toString(string);
          return string && reHasRegExpChar.test(string) ? string.replace(reRegExpChar, "\\$&") : string;
        }
        var kebabCase = createCompounder(function(result2, word, index) {
          return result2 + (index ? "-" : "") + word.toLowerCase();
        });
        var lowerCase = createCompounder(function(result2, word, index) {
          return result2 + (index ? " " : "") + word.toLowerCase();
        });
        var lowerFirst = createCaseFirst("toLowerCase");
        function pad(string, length, chars) {
          string = toString(string);
          length = toInteger(length);
          var strLength = length ? stringSize(string) : 0;
          if (!length || strLength >= length) {
            return string;
          }
          var mid = (length - strLength) / 2;
          return createPadding(nativeFloor(mid), chars) + string + createPadding(nativeCeil(mid), chars);
        }
        function padEnd(string, length, chars) {
          string = toString(string);
          length = toInteger(length);
          var strLength = length ? stringSize(string) : 0;
          return length && strLength < length ? string + createPadding(length - strLength, chars) : string;
        }
        function padStart(string, length, chars) {
          string = toString(string);
          length = toInteger(length);
          var strLength = length ? stringSize(string) : 0;
          return length && strLength < length ? createPadding(length - strLength, chars) + string : string;
        }
        function parseInt2(string, radix, guard) {
          if (guard || radix == null) {
            radix = 0;
          } else if (radix) {
            radix = +radix;
          }
          return nativeParseInt(toString(string).replace(reTrimStart, ""), radix || 0);
        }
        function repeat(string, n, guard) {
          if (guard ? isIterateeCall(string, n, guard) : n === undefined2) {
            n = 1;
          } else {
            n = toInteger(n);
          }
          return baseRepeat(toString(string), n);
        }
        function replace() {
          var args = arguments, string = toString(args[0]);
          return args.length < 3 ? string : string.replace(args[1], args[2]);
        }
        var snakeCase = createCompounder(function(result2, word, index) {
          return result2 + (index ? "_" : "") + word.toLowerCase();
        });
        function split(string, separator, limit) {
          if (limit && typeof limit != "number" && isIterateeCall(string, separator, limit)) {
            separator = limit = undefined2;
          }
          limit = limit === undefined2 ? MAX_ARRAY_LENGTH : limit >>> 0;
          if (!limit) {
            return [];
          }
          string = toString(string);
          if (string && (typeof separator == "string" || separator != null && !isRegExp(separator))) {
            separator = baseToString(separator);
            if (!separator && hasUnicode(string)) {
              return castSlice(stringToArray(string), 0, limit);
            }
          }
          return string.split(separator, limit);
        }
        var startCase = createCompounder(function(result2, word, index) {
          return result2 + (index ? " " : "") + upperFirst(word);
        });
        function startsWith(string, target, position) {
          string = toString(string);
          position = position == null ? 0 : baseClamp(toInteger(position), 0, string.length);
          target = baseToString(target);
          return string.slice(position, position + target.length) == target;
        }
        function template(string, options, guard) {
          var settings = lodash.templateSettings;
          if (guard && isIterateeCall(string, options, guard)) {
            options = undefined2;
          }
          string = toString(string);
          options = assignWith({}, options, settings, customDefaultsAssignIn);
          var imports = assignWith({}, options.imports, settings.imports, customDefaultsAssignIn), importsKeys = keys(imports), importsValues = baseValues(imports, importsKeys);
          arrayEach(importsKeys, function(key2) {
            if (reForbiddenIdentifierChars.test(key2)) {
              throw new Error2(INVALID_TEMPL_IMPORTS_ERROR_TEXT);
            }
          });
          var isEscaping, isEvaluating, index = 0, interpolate = options.interpolate || reNoMatch, source = "__p += '";
          var reDelimiters = RegExp2(
            (options.escape || reNoMatch).source + "|" + interpolate.source + "|" + (interpolate === reInterpolate ? reEsTemplate : reNoMatch).source + "|" + (options.evaluate || reNoMatch).source + "|$",
            "g"
          );
          var sourceURL = "//# sourceURL=" + (hasOwnProperty.call(options, "sourceURL") ? (options.sourceURL + "").replace(/\s/g, " ") : "lodash.templateSources[" + ++templateCounter + "]") + "\n";
          string.replace(reDelimiters, function(match, escapeValue, interpolateValue, esTemplateValue, evaluateValue, offset) {
            interpolateValue || (interpolateValue = esTemplateValue);
            source += string.slice(index, offset).replace(reUnescapedString, escapeStringChar);
            if (escapeValue) {
              isEscaping = true;
              source += "' +\n__e(" + escapeValue + ") +\n'";
            }
            if (evaluateValue) {
              isEvaluating = true;
              source += "';\n" + evaluateValue + ";\n__p += '";
            }
            if (interpolateValue) {
              source += "' +\n((__t = (" + interpolateValue + ")) == null ? '' : __t) +\n'";
            }
            index = offset + match.length;
            return match;
          });
          source += "';\n";
          var variable = hasOwnProperty.call(options, "variable") && options.variable;
          if (!variable) {
            source = "with (obj) {\n" + source + "\n}\n";
          } else if (reForbiddenIdentifierChars.test(variable)) {
            throw new Error2(INVALID_TEMPL_VAR_ERROR_TEXT);
          }
          source = (isEvaluating ? source.replace(reEmptyStringLeading, "") : source).replace(reEmptyStringMiddle, "$1").replace(reEmptyStringTrailing, "$1;");
          source = "function(" + (variable || "obj") + ") {\n" + (variable ? "" : "obj || (obj = {});\n") + "var __t, __p = ''" + (isEscaping ? ", __e = _.escape" : "") + (isEvaluating ? ", __j = Array.prototype.join;\nfunction print() { __p += __j.call(arguments, '') }\n" : ";\n") + source + "return __p\n}";
          var result2 = attempt(function() {
            return Function2(importsKeys, sourceURL + "return " + source).apply(undefined2, importsValues);
          });
          result2.source = source;
          if (isError(result2)) {
            throw result2;
          }
          return result2;
        }
        function toLower(value) {
          return toString(value).toLowerCase();
        }
        function toUpper(value) {
          return toString(value).toUpperCase();
        }
        function trim(string, chars, guard) {
          string = toString(string);
          if (string && (guard || chars === undefined2)) {
            return baseTrim(string);
          }
          if (!string || !(chars = baseToString(chars))) {
            return string;
          }
          var strSymbols = stringToArray(string), chrSymbols = stringToArray(chars), start = charsStartIndex(strSymbols, chrSymbols), end = charsEndIndex(strSymbols, chrSymbols) + 1;
          return castSlice(strSymbols, start, end).join("");
        }
        function trimEnd(string, chars, guard) {
          string = toString(string);
          if (string && (guard || chars === undefined2)) {
            return string.slice(0, trimmedEndIndex(string) + 1);
          }
          if (!string || !(chars = baseToString(chars))) {
            return string;
          }
          var strSymbols = stringToArray(string), end = charsEndIndex(strSymbols, stringToArray(chars)) + 1;
          return castSlice(strSymbols, 0, end).join("");
        }
        function trimStart(string, chars, guard) {
          string = toString(string);
          if (string && (guard || chars === undefined2)) {
            return string.replace(reTrimStart, "");
          }
          if (!string || !(chars = baseToString(chars))) {
            return string;
          }
          var strSymbols = stringToArray(string), start = charsStartIndex(strSymbols, stringToArray(chars));
          return castSlice(strSymbols, start).join("");
        }
        function truncate(string, options) {
          var length = DEFAULT_TRUNC_LENGTH, omission = DEFAULT_TRUNC_OMISSION;
          if (isObject(options)) {
            var separator = "separator" in options ? options.separator : separator;
            length = "length" in options ? toInteger(options.length) : length;
            omission = "omission" in options ? baseToString(options.omission) : omission;
          }
          string = toString(string);
          var strLength = string.length;
          if (hasUnicode(string)) {
            var strSymbols = stringToArray(string);
            strLength = strSymbols.length;
          }
          if (length >= strLength) {
            return string;
          }
          var end = length - stringSize(omission);
          if (end < 1) {
            return omission;
          }
          var result2 = strSymbols ? castSlice(strSymbols, 0, end).join("") : string.slice(0, end);
          if (separator === undefined2) {
            return result2 + omission;
          }
          if (strSymbols) {
            end += result2.length - end;
          }
          if (isRegExp(separator)) {
            if (string.slice(end).search(separator)) {
              var match, substring = result2;
              if (!separator.global) {
                separator = RegExp2(separator.source, toString(reFlags.exec(separator)) + "g");
              }
              separator.lastIndex = 0;
              while (match = separator.exec(substring)) {
                var newEnd = match.index;
              }
              result2 = result2.slice(0, newEnd === undefined2 ? end : newEnd);
            }
          } else if (string.indexOf(baseToString(separator), end) != end) {
            var index = result2.lastIndexOf(separator);
            if (index > -1) {
              result2 = result2.slice(0, index);
            }
          }
          return result2 + omission;
        }
        function unescape(string) {
          string = toString(string);
          return string && reHasEscapedHtml.test(string) ? string.replace(reEscapedHtml, unescapeHtmlChar) : string;
        }
        var upperCase = createCompounder(function(result2, word, index) {
          return result2 + (index ? " " : "") + word.toUpperCase();
        });
        var upperFirst = createCaseFirst("toUpperCase");
        function words(string, pattern, guard) {
          string = toString(string);
          pattern = guard ? undefined2 : pattern;
          if (pattern === undefined2) {
            return hasUnicodeWord(string) ? unicodeWords(string) : asciiWords(string);
          }
          return string.match(pattern) || [];
        }
        var attempt = baseRest(function(func, args) {
          try {
            return apply(func, undefined2, args);
          } catch (e) {
            return isError(e) ? e : new Error2(e);
          }
        });
        var bindAll = flatRest(function(object, methodNames) {
          arrayEach(methodNames, function(key2) {
            key2 = toKey(key2);
            baseAssignValue(object, key2, bind(object[key2], object));
          });
          return object;
        });
        function cond(pairs) {
          var length = pairs == null ? 0 : pairs.length, toIteratee = getIteratee();
          pairs = !length ? [] : arrayMap(pairs, function(pair) {
            if (typeof pair[1] != "function") {
              throw new TypeError2(FUNC_ERROR_TEXT);
            }
            return [toIteratee(pair[0]), pair[1]];
          });
          return baseRest(function(args) {
            var index = -1;
            while (++index < length) {
              var pair = pairs[index];
              if (apply(pair[0], this, args)) {
                return apply(pair[1], this, args);
              }
            }
          });
        }
        function conforms(source) {
          return baseConforms(baseClone(source, CLONE_DEEP_FLAG));
        }
        function constant(value) {
          return function() {
            return value;
          };
        }
        function defaultTo(value, defaultValue) {
          return value == null || value !== value ? defaultValue : value;
        }
        var flow = createFlow();
        var flowRight = createFlow(true);
        function identity(value) {
          return value;
        }
        function iteratee(func) {
          return baseIteratee(typeof func == "function" ? func : baseClone(func, CLONE_DEEP_FLAG));
        }
        function matches(source) {
          return baseMatches(baseClone(source, CLONE_DEEP_FLAG));
        }
        function matchesProperty(path, srcValue) {
          return baseMatchesProperty(path, baseClone(srcValue, CLONE_DEEP_FLAG));
        }
        var method = baseRest(function(path, args) {
          return function(object) {
            return baseInvoke(object, path, args);
          };
        });
        var methodOf = baseRest(function(object, args) {
          return function(path) {
            return baseInvoke(object, path, args);
          };
        });
        function mixin(object, source, options) {
          var props = keys(source), methodNames = baseFunctions(source, props);
          if (options == null && !(isObject(source) && (methodNames.length || !props.length))) {
            options = source;
            source = object;
            object = this;
            methodNames = baseFunctions(source, keys(source));
          }
          var chain2 = !(isObject(options) && "chain" in options) || !!options.chain, isFunc = isFunction(object);
          arrayEach(methodNames, function(methodName) {
            var func = source[methodName];
            object[methodName] = func;
            if (isFunc) {
              object.prototype[methodName] = function() {
                var chainAll = this.__chain__;
                if (chain2 || chainAll) {
                  var result2 = object(this.__wrapped__), actions = result2.__actions__ = copyArray(this.__actions__);
                  actions.push({ "func": func, "args": arguments, "thisArg": object });
                  result2.__chain__ = chainAll;
                  return result2;
                }
                return func.apply(object, arrayPush([this.value()], arguments));
              };
            }
          });
          return object;
        }
        function noConflict() {
          if (root._ === this) {
            root._ = oldDash;
          }
          return this;
        }
        function noop() {
        }
        function nthArg(n) {
          n = toInteger(n);
          return baseRest(function(args) {
            return baseNth(args, n);
          });
        }
        var over = createOver(arrayMap);
        var overEvery = createOver(arrayEvery);
        var overSome = createOver(arraySome);
        function property(path) {
          return isKey(path) ? baseProperty(toKey(path)) : basePropertyDeep(path);
        }
        function propertyOf(object) {
          return function(path) {
            return object == null ? undefined2 : baseGet(object, path);
          };
        }
        var range4 = createRange();
        var rangeRight = createRange(true);
        function stubArray() {
          return [];
        }
        function stubFalse() {
          return false;
        }
        function stubObject() {
          return {};
        }
        function stubString() {
          return "";
        }
        function stubTrue() {
          return true;
        }
        function times(n, iteratee2) {
          n = toInteger(n);
          if (n < 1 || n > MAX_SAFE_INTEGER) {
            return [];
          }
          var index = MAX_ARRAY_LENGTH, length = nativeMin(n, MAX_ARRAY_LENGTH);
          iteratee2 = getIteratee(iteratee2);
          n -= MAX_ARRAY_LENGTH;
          var result2 = baseTimes(length, iteratee2);
          while (++index < n) {
            iteratee2(index);
          }
          return result2;
        }
        function toPath(value) {
          if (isArray(value)) {
            return arrayMap(value, toKey);
          }
          return isSymbol(value) ? [value] : copyArray(stringToPath(toString(value)));
        }
        function uniqueId(prefix) {
          var id = ++idCounter;
          return toString(prefix) + id;
        }
        var add2 = createMathOperation(function(augend, addend) {
          return augend + addend;
        }, 0);
        var ceil = createRound("ceil");
        var divide = createMathOperation(function(dividend, divisor) {
          return dividend / divisor;
        }, 1);
        var floor = createRound("floor");
        function max(array) {
          return array && array.length ? baseExtremum(array, identity, baseGt) : undefined2;
        }
        function maxBy3(array, iteratee2) {
          return array && array.length ? baseExtremum(array, getIteratee(iteratee2, 2), baseGt) : undefined2;
        }
        function mean(array) {
          return baseMean(array, identity);
        }
        function meanBy(array, iteratee2) {
          return baseMean(array, getIteratee(iteratee2, 2));
        }
        function min(array) {
          return array && array.length ? baseExtremum(array, identity, baseLt) : undefined2;
        }
        function minBy2(array, iteratee2) {
          return array && array.length ? baseExtremum(array, getIteratee(iteratee2, 2), baseLt) : undefined2;
        }
        var multiply = createMathOperation(function(multiplier, multiplicand) {
          return multiplier * multiplicand;
        }, 1);
        var round = createRound("round");
        var subtract = createMathOperation(function(minuend, subtrahend) {
          return minuend - subtrahend;
        }, 0);
        function sum3(array) {
          return array && array.length ? baseSum(array, identity) : 0;
        }
        function sumBy2(array, iteratee2) {
          return array && array.length ? baseSum(array, getIteratee(iteratee2, 2)) : 0;
        }
        lodash.after = after;
        lodash.ary = ary;
        lodash.assign = assign;
        lodash.assignIn = assignIn;
        lodash.assignInWith = assignInWith;
        lodash.assignWith = assignWith;
        lodash.at = at;
        lodash.before = before;
        lodash.bind = bind;
        lodash.bindAll = bindAll;
        lodash.bindKey = bindKey;
        lodash.castArray = castArray;
        lodash.chain = chain;
        lodash.chunk = chunk;
        lodash.compact = compact;
        lodash.concat = concat;
        lodash.cond = cond;
        lodash.conforms = conforms;
        lodash.constant = constant;
        lodash.countBy = countBy2;
        lodash.create = create;
        lodash.curry = curry;
        lodash.curryRight = curryRight;
        lodash.debounce = debounce;
        lodash.defaults = defaults;
        lodash.defaultsDeep = defaultsDeep;
        lodash.defer = defer;
        lodash.delay = delay;
        lodash.difference = difference7;
        lodash.differenceBy = differenceBy;
        lodash.differenceWith = differenceWith;
        lodash.drop = drop;
        lodash.dropRight = dropRight;
        lodash.dropRightWhile = dropRightWhile;
        lodash.dropWhile = dropWhile;
        lodash.fill = fill;
        lodash.filter = filter;
        lodash.flatMap = flatMap;
        lodash.flatMapDeep = flatMapDeep;
        lodash.flatMapDepth = flatMapDepth;
        lodash.flatten = flatten3;
        lodash.flattenDeep = flattenDeep;
        lodash.flattenDepth = flattenDepth;
        lodash.flip = flip;
        lodash.flow = flow;
        lodash.flowRight = flowRight;
        lodash.fromPairs = fromPairs2;
        lodash.functions = functions;
        lodash.functionsIn = functionsIn;
        lodash.groupBy = groupBy2;
        lodash.initial = initial;
        lodash.intersection = intersection;
        lodash.intersectionBy = intersectionBy;
        lodash.intersectionWith = intersectionWith;
        lodash.invert = invert;
        lodash.invertBy = invertBy;
        lodash.invokeMap = invokeMap;
        lodash.iteratee = iteratee;
        lodash.keyBy = keyBy2;
        lodash.keys = keys;
        lodash.keysIn = keysIn;
        lodash.map = map;
        lodash.mapKeys = mapKeys;
        lodash.mapValues = mapValues;
        lodash.matches = matches;
        lodash.matchesProperty = matchesProperty;
        lodash.memoize = memoize;
        lodash.merge = merge3;
        lodash.mergeWith = mergeWith2;
        lodash.method = method;
        lodash.methodOf = methodOf;
        lodash.mixin = mixin;
        lodash.negate = negate;
        lodash.nthArg = nthArg;
        lodash.omit = omit;
        lodash.omitBy = omitBy;
        lodash.once = once;
        lodash.orderBy = orderBy;
        lodash.over = over;
        lodash.overArgs = overArgs;
        lodash.overEvery = overEvery;
        lodash.overSome = overSome;
        lodash.partial = partial;
        lodash.partialRight = partialRight;
        lodash.partition = partition;
        lodash.pick = pick2;
        lodash.pickBy = pickBy;
        lodash.property = property;
        lodash.propertyOf = propertyOf;
        lodash.pull = pull;
        lodash.pullAll = pullAll;
        lodash.pullAllBy = pullAllBy;
        lodash.pullAllWith = pullAllWith;
        lodash.pullAt = pullAt;
        lodash.range = range4;
        lodash.rangeRight = rangeRight;
        lodash.rearg = rearg;
        lodash.reject = reject;
        lodash.remove = remove;
        lodash.rest = rest;
        lodash.reverse = reverse;
        lodash.sampleSize = sampleSize;
        lodash.set = set3;
        lodash.setWith = setWith;
        lodash.shuffle = shuffle;
        lodash.slice = slice;
        lodash.sortBy = sortBy2;
        lodash.sortedUniq = sortedUniq;
        lodash.sortedUniqBy = sortedUniqBy;
        lodash.split = split;
        lodash.spread = spread;
        lodash.tail = tail;
        lodash.take = take;
        lodash.takeRight = takeRight;
        lodash.takeRightWhile = takeRightWhile;
        lodash.takeWhile = takeWhile;
        lodash.tap = tap;
        lodash.throttle = throttle;
        lodash.thru = thru;
        lodash.toArray = toArray;
        lodash.toPairs = toPairs;
        lodash.toPairsIn = toPairsIn;
        lodash.toPath = toPath;
        lodash.toPlainObject = toPlainObject;
        lodash.transform = transform;
        lodash.unary = unary;
        lodash.union = union;
        lodash.unionBy = unionBy;
        lodash.unionWith = unionWith;
        lodash.uniq = uniq8;
        lodash.uniqBy = uniqBy;
        lodash.uniqWith = uniqWith2;
        lodash.unset = unset;
        lodash.unzip = unzip;
        lodash.unzipWith = unzipWith;
        lodash.update = update;
        lodash.updateWith = updateWith;
        lodash.values = values;
        lodash.valuesIn = valuesIn;
        lodash.without = without;
        lodash.words = words;
        lodash.wrap = wrap;
        lodash.xor = xor;
        lodash.xorBy = xorBy;
        lodash.xorWith = xorWith;
        lodash.zip = zip;
        lodash.zipObject = zipObject;
        lodash.zipObjectDeep = zipObjectDeep;
        lodash.zipWith = zipWith2;
        lodash.entries = toPairs;
        lodash.entriesIn = toPairsIn;
        lodash.extend = assignIn;
        lodash.extendWith = assignInWith;
        mixin(lodash, lodash);
        lodash.add = add2;
        lodash.attempt = attempt;
        lodash.camelCase = camelCase;
        lodash.capitalize = capitalize;
        lodash.ceil = ceil;
        lodash.clamp = clamp;
        lodash.clone = clone2;
        lodash.cloneDeep = cloneDeep2;
        lodash.cloneDeepWith = cloneDeepWith;
        lodash.cloneWith = cloneWith;
        lodash.conformsTo = conformsTo;
        lodash.deburr = deburr;
        lodash.defaultTo = defaultTo;
        lodash.divide = divide;
        lodash.endsWith = endsWith;
        lodash.eq = eq;
        lodash.escape = escape;
        lodash.escapeRegExp = escapeRegExp;
        lodash.every = every;
        lodash.find = find;
        lodash.findIndex = findIndex;
        lodash.findKey = findKey;
        lodash.findLast = findLast;
        lodash.findLastIndex = findLastIndex;
        lodash.findLastKey = findLastKey;
        lodash.floor = floor;
        lodash.forEach = forEach;
        lodash.forEachRight = forEachRight;
        lodash.forIn = forIn;
        lodash.forInRight = forInRight;
        lodash.forOwn = forOwn;
        lodash.forOwnRight = forOwnRight;
        lodash.get = get2;
        lodash.gt = gt;
        lodash.gte = gte;
        lodash.has = has;
        lodash.hasIn = hasIn;
        lodash.head = head;
        lodash.identity = identity;
        lodash.includes = includes;
        lodash.indexOf = indexOf;
        lodash.inRange = inRange2;
        lodash.invoke = invoke;
        lodash.isArguments = isArguments;
        lodash.isArray = isArray;
        lodash.isArrayBuffer = isArrayBuffer;
        lodash.isArrayLike = isArrayLike;
        lodash.isArrayLikeObject = isArrayLikeObject;
        lodash.isBoolean = isBoolean;
        lodash.isBuffer = isBuffer;
        lodash.isDate = isDate;
        lodash.isElement = isElement;
        lodash.isEmpty = isEmpty;
        lodash.isEqual = isEqual4;
        lodash.isEqualWith = isEqualWith;
        lodash.isError = isError;
        lodash.isFinite = isFinite;
        lodash.isFunction = isFunction;
        lodash.isInteger = isInteger;
        lodash.isLength = isLength;
        lodash.isMap = isMap;
        lodash.isMatch = isMatch;
        lodash.isMatchWith = isMatchWith;
        lodash.isNaN = isNaN2;
        lodash.isNative = isNative;
        lodash.isNil = isNil;
        lodash.isNull = isNull;
        lodash.isNumber = isNumber;
        lodash.isObject = isObject;
        lodash.isObjectLike = isObjectLike;
        lodash.isPlainObject = isPlainObject;
        lodash.isRegExp = isRegExp;
        lodash.isSafeInteger = isSafeInteger;
        lodash.isSet = isSet;
        lodash.isString = isString;
        lodash.isSymbol = isSymbol;
        lodash.isTypedArray = isTypedArray;
        lodash.isUndefined = isUndefined;
        lodash.isWeakMap = isWeakMap;
        lodash.isWeakSet = isWeakSet;
        lodash.join = join;
        lodash.kebabCase = kebabCase;
        lodash.last = last;
        lodash.lastIndexOf = lastIndexOf;
        lodash.lowerCase = lowerCase;
        lodash.lowerFirst = lowerFirst;
        lodash.lt = lt;
        lodash.lte = lte;
        lodash.max = max;
        lodash.maxBy = maxBy3;
        lodash.mean = mean;
        lodash.meanBy = meanBy;
        lodash.min = min;
        lodash.minBy = minBy2;
        lodash.stubArray = stubArray;
        lodash.stubFalse = stubFalse;
        lodash.stubObject = stubObject;
        lodash.stubString = stubString;
        lodash.stubTrue = stubTrue;
        lodash.multiply = multiply;
        lodash.nth = nth;
        lodash.noConflict = noConflict;
        lodash.noop = noop;
        lodash.now = now;
        lodash.pad = pad;
        lodash.padEnd = padEnd;
        lodash.padStart = padStart;
        lodash.parseInt = parseInt2;
        lodash.random = random;
        lodash.reduce = reduce;
        lodash.reduceRight = reduceRight;
        lodash.repeat = repeat;
        lodash.replace = replace;
        lodash.result = result;
        lodash.round = round;
        lodash.runInContext = runInContext2;
        lodash.sample = sample;
        lodash.size = size;
        lodash.snakeCase = snakeCase;
        lodash.some = some;
        lodash.sortedIndex = sortedIndex;
        lodash.sortedIndexBy = sortedIndexBy;
        lodash.sortedIndexOf = sortedIndexOf;
        lodash.sortedLastIndex = sortedLastIndex;
        lodash.sortedLastIndexBy = sortedLastIndexBy;
        lodash.sortedLastIndexOf = sortedLastIndexOf;
        lodash.startCase = startCase;
        lodash.startsWith = startsWith;
        lodash.subtract = subtract;
        lodash.sum = sum3;
        lodash.sumBy = sumBy2;
        lodash.template = template;
        lodash.times = times;
        lodash.toFinite = toFinite;
        lodash.toInteger = toInteger;
        lodash.toLength = toLength;
        lodash.toLower = toLower;
        lodash.toNumber = toNumber;
        lodash.toSafeInteger = toSafeInteger;
        lodash.toString = toString;
        lodash.toUpper = toUpper;
        lodash.trim = trim;
        lodash.trimEnd = trimEnd;
        lodash.trimStart = trimStart;
        lodash.truncate = truncate;
        lodash.unescape = unescape;
        lodash.uniqueId = uniqueId;
        lodash.upperCase = upperCase;
        lodash.upperFirst = upperFirst;
        lodash.each = forEach;
        lodash.eachRight = forEachRight;
        lodash.first = head;
        mixin(lodash, (function() {
          var source = {};
          baseForOwn(lodash, function(func, methodName) {
            if (!hasOwnProperty.call(lodash.prototype, methodName)) {
              source[methodName] = func;
            }
          });
          return source;
        })(), { "chain": false });
        lodash.VERSION = VERSION;
        arrayEach(["bind", "bindKey", "curry", "curryRight", "partial", "partialRight"], function(methodName) {
          lodash[methodName].placeholder = lodash;
        });
        arrayEach(["drop", "take"], function(methodName, index) {
          LazyWrapper.prototype[methodName] = function(n) {
            n = n === undefined2 ? 1 : nativeMax(toInteger(n), 0);
            var result2 = this.__filtered__ && !index ? new LazyWrapper(this) : this.clone();
            if (result2.__filtered__) {
              result2.__takeCount__ = nativeMin(n, result2.__takeCount__);
            } else {
              result2.__views__.push({
                "size": nativeMin(n, MAX_ARRAY_LENGTH),
                "type": methodName + (result2.__dir__ < 0 ? "Right" : "")
              });
            }
            return result2;
          };
          LazyWrapper.prototype[methodName + "Right"] = function(n) {
            return this.reverse()[methodName](n).reverse();
          };
        });
        arrayEach(["filter", "map", "takeWhile"], function(methodName, index) {
          var type = index + 1, isFilter = type == LAZY_FILTER_FLAG || type == LAZY_WHILE_FLAG;
          LazyWrapper.prototype[methodName] = function(iteratee2) {
            var result2 = this.clone();
            result2.__iteratees__.push({
              "iteratee": getIteratee(iteratee2, 3),
              "type": type
            });
            result2.__filtered__ = result2.__filtered__ || isFilter;
            return result2;
          };
        });
        arrayEach(["head", "last"], function(methodName, index) {
          var takeName = "take" + (index ? "Right" : "");
          LazyWrapper.prototype[methodName] = function() {
            return this[takeName](1).value()[0];
          };
        });
        arrayEach(["initial", "tail"], function(methodName, index) {
          var dropName = "drop" + (index ? "" : "Right");
          LazyWrapper.prototype[methodName] = function() {
            return this.__filtered__ ? new LazyWrapper(this) : this[dropName](1);
          };
        });
        LazyWrapper.prototype.compact = function() {
          return this.filter(identity);
        };
        LazyWrapper.prototype.find = function(predicate) {
          return this.filter(predicate).head();
        };
        LazyWrapper.prototype.findLast = function(predicate) {
          return this.reverse().find(predicate);
        };
        LazyWrapper.prototype.invokeMap = baseRest(function(path, args) {
          if (typeof path == "function") {
            return new LazyWrapper(this);
          }
          return this.map(function(value) {
            return baseInvoke(value, path, args);
          });
        });
        LazyWrapper.prototype.reject = function(predicate) {
          return this.filter(negate(getIteratee(predicate)));
        };
        LazyWrapper.prototype.slice = function(start, end) {
          start = toInteger(start);
          var result2 = this;
          if (result2.__filtered__ && (start > 0 || end < 0)) {
            return new LazyWrapper(result2);
          }
          if (start < 0) {
            result2 = result2.takeRight(-start);
          } else if (start) {
            result2 = result2.drop(start);
          }
          if (end !== undefined2) {
            end = toInteger(end);
            result2 = end < 0 ? result2.dropRight(-end) : result2.take(end - start);
          }
          return result2;
        };
        LazyWrapper.prototype.takeRightWhile = function(predicate) {
          return this.reverse().takeWhile(predicate).reverse();
        };
        LazyWrapper.prototype.toArray = function() {
          return this.take(MAX_ARRAY_LENGTH);
        };
        baseForOwn(LazyWrapper.prototype, function(func, methodName) {
          var checkIteratee = /^(?:filter|find|map|reject)|While$/.test(methodName), isTaker = /^(?:head|last)$/.test(methodName), lodashFunc = lodash[isTaker ? "take" + (methodName == "last" ? "Right" : "") : methodName], retUnwrapped = isTaker || /^find/.test(methodName);
          if (!lodashFunc) {
            return;
          }
          lodash.prototype[methodName] = function() {
            var value = this.__wrapped__, args = isTaker ? [1] : arguments, isLazy = value instanceof LazyWrapper, iteratee2 = args[0], useLazy = isLazy || isArray(value);
            var interceptor = function(value2) {
              var result3 = lodashFunc.apply(lodash, arrayPush([value2], args));
              return isTaker && chainAll ? result3[0] : result3;
            };
            if (useLazy && checkIteratee && typeof iteratee2 == "function" && iteratee2.length != 1) {
              isLazy = useLazy = false;
            }
            var chainAll = this.__chain__, isHybrid = !!this.__actions__.length, isUnwrapped = retUnwrapped && !chainAll, onlyLazy = isLazy && !isHybrid;
            if (!retUnwrapped && useLazy) {
              value = onlyLazy ? value : new LazyWrapper(this);
              var result2 = func.apply(value, args);
              result2.__actions__.push({ "func": thru, "args": [interceptor], "thisArg": undefined2 });
              return new LodashWrapper(result2, chainAll);
            }
            if (isUnwrapped && onlyLazy) {
              return func.apply(this, args);
            }
            result2 = this.thru(interceptor);
            return isUnwrapped ? isTaker ? result2.value()[0] : result2.value() : result2;
          };
        });
        arrayEach(["pop", "push", "shift", "sort", "splice", "unshift"], function(methodName) {
          var func = arrayProto[methodName], chainName = /^(?:push|sort|unshift)$/.test(methodName) ? "tap" : "thru", retUnwrapped = /^(?:pop|shift)$/.test(methodName);
          lodash.prototype[methodName] = function() {
            var args = arguments;
            if (retUnwrapped && !this.__chain__) {
              var value = this.value();
              return func.apply(isArray(value) ? value : [], args);
            }
            return this[chainName](function(value2) {
              return func.apply(isArray(value2) ? value2 : [], args);
            });
          };
        });
        baseForOwn(LazyWrapper.prototype, function(func, methodName) {
          var lodashFunc = lodash[methodName];
          if (lodashFunc) {
            var key2 = lodashFunc.name + "";
            if (!hasOwnProperty.call(realNames, key2)) {
              realNames[key2] = [];
            }
            realNames[key2].push({ "name": methodName, "func": lodashFunc });
          }
        });
        realNames[createHybrid(undefined2, WRAP_BIND_KEY_FLAG).name] = [{
          "name": "wrapper",
          "func": undefined2
        }];
        LazyWrapper.prototype.clone = lazyClone;
        LazyWrapper.prototype.reverse = lazyReverse;
        LazyWrapper.prototype.value = lazyValue;
        lodash.prototype.at = wrapperAt;
        lodash.prototype.chain = wrapperChain;
        lodash.prototype.commit = wrapperCommit;
        lodash.prototype.next = wrapperNext;
        lodash.prototype.plant = wrapperPlant;
        lodash.prototype.reverse = wrapperReverse;
        lodash.prototype.toJSON = lodash.prototype.valueOf = lodash.prototype.value = wrapperValue;
        lodash.prototype.first = lodash.prototype.head;
        if (symIterator) {
          lodash.prototype[symIterator] = wrapperToIterator;
        }
        return lodash;
      });
      var _ = runInContext();
      if (typeof define == "function" && typeof define.amd == "object" && define.amd) {
        root._ = _;
        define(function() {
          return _;
        });
      } else if (freeModule) {
        (freeModule.exports = _)._ = _;
        freeExports._ = _;
      } else {
        root._ = _;
      }
    }).call(exports);
  }
});

// engine/node_modules/.pnpm/lodash@4.18.1/node_modules/lodash/index.js
var require_lodash2 = __commonJS({
  "engine/node_modules/.pnpm/lodash@4.18.1/node_modules/lodash/index.js"(exports, module) {
    module.exports = require_lodash();
  }
});

// engine/node_modules/.pnpm/seedrandom@2.4.3/node_modules/seedrandom/lib/alea.js
var require_alea = __commonJS({
  "engine/node_modules/.pnpm/seedrandom@2.4.3/node_modules/seedrandom/lib/alea.js"(exports, module) {
    (function(global2, module2, define2) {
      function Alea(seed) {
        var me = this, mash = Mash();
        me.next = function() {
          var t = 2091639 * me.s0 + me.c * 23283064365386963e-26;
          me.s0 = me.s1;
          me.s1 = me.s2;
          return me.s2 = t - (me.c = t | 0);
        };
        me.c = 1;
        me.s0 = mash(" ");
        me.s1 = mash(" ");
        me.s2 = mash(" ");
        me.s0 -= mash(seed);
        if (me.s0 < 0) {
          me.s0 += 1;
        }
        me.s1 -= mash(seed);
        if (me.s1 < 0) {
          me.s1 += 1;
        }
        me.s2 -= mash(seed);
        if (me.s2 < 0) {
          me.s2 += 1;
        }
        mash = null;
      }
      function copy(f, t) {
        t.c = f.c;
        t.s0 = f.s0;
        t.s1 = f.s1;
        t.s2 = f.s2;
        return t;
      }
      function impl(seed, opts) {
        var xg = new Alea(seed), state = opts && opts.state, prng = xg.next;
        prng.int32 = function() {
          return xg.next() * 4294967296 | 0;
        };
        prng.double = function() {
          return prng() + (prng() * 2097152 | 0) * 11102230246251565e-32;
        };
        prng.quick = prng;
        if (state) {
          if (typeof state == "object") copy(state, xg);
          prng.state = function() {
            return copy(xg, {});
          };
        }
        return prng;
      }
      function Mash() {
        var n = 4022871197;
        var mash = function(data) {
          data = data.toString();
          for (var i = 0; i < data.length; i++) {
            n += data.charCodeAt(i);
            var h = 0.02519603282416938 * n;
            n = h >>> 0;
            h -= n;
            h *= n;
            n = h >>> 0;
            h -= n;
            n += h * 4294967296;
          }
          return (n >>> 0) * 23283064365386963e-26;
        };
        return mash;
      }
      if (module2 && module2.exports) {
        module2.exports = impl;
      } else if (define2 && define2.amd) {
        define2(function() {
          return impl;
        });
      } else {
        this.alea = impl;
      }
    })(
      exports,
      typeof module == "object" && module,
      // present in node.js
      typeof define == "function" && define
      // present with an AMD loader
    );
  }
});

// engine/node_modules/.pnpm/seedrandom@2.4.3/node_modules/seedrandom/lib/xor128.js
var require_xor128 = __commonJS({
  "engine/node_modules/.pnpm/seedrandom@2.4.3/node_modules/seedrandom/lib/xor128.js"(exports, module) {
    (function(global2, module2, define2) {
      function XorGen(seed) {
        var me = this, strseed = "";
        me.x = 0;
        me.y = 0;
        me.z = 0;
        me.w = 0;
        me.next = function() {
          var t = me.x ^ me.x << 11;
          me.x = me.y;
          me.y = me.z;
          me.z = me.w;
          return me.w ^= me.w >>> 19 ^ t ^ t >>> 8;
        };
        if (seed === (seed | 0)) {
          me.x = seed;
        } else {
          strseed += seed;
        }
        for (var k = 0; k < strseed.length + 64; k++) {
          me.x ^= strseed.charCodeAt(k) | 0;
          me.next();
        }
      }
      function copy(f, t) {
        t.x = f.x;
        t.y = f.y;
        t.z = f.z;
        t.w = f.w;
        return t;
      }
      function impl(seed, opts) {
        var xg = new XorGen(seed), state = opts && opts.state, prng = function() {
          return (xg.next() >>> 0) / 4294967296;
        };
        prng.double = function() {
          do {
            var top = xg.next() >>> 11, bot = (xg.next() >>> 0) / 4294967296, result = (top + bot) / (1 << 21);
          } while (result === 0);
          return result;
        };
        prng.int32 = xg.next;
        prng.quick = prng;
        if (state) {
          if (typeof state == "object") copy(state, xg);
          prng.state = function() {
            return copy(xg, {});
          };
        }
        return prng;
      }
      if (module2 && module2.exports) {
        module2.exports = impl;
      } else if (define2 && define2.amd) {
        define2(function() {
          return impl;
        });
      } else {
        this.xor128 = impl;
      }
    })(
      exports,
      typeof module == "object" && module,
      // present in node.js
      typeof define == "function" && define
      // present with an AMD loader
    );
  }
});

// engine/node_modules/.pnpm/seedrandom@2.4.3/node_modules/seedrandom/lib/xorwow.js
var require_xorwow = __commonJS({
  "engine/node_modules/.pnpm/seedrandom@2.4.3/node_modules/seedrandom/lib/xorwow.js"(exports, module) {
    (function(global2, module2, define2) {
      function XorGen(seed) {
        var me = this, strseed = "";
        me.next = function() {
          var t = me.x ^ me.x >>> 2;
          me.x = me.y;
          me.y = me.z;
          me.z = me.w;
          me.w = me.v;
          return (me.d = me.d + 362437 | 0) + (me.v = me.v ^ me.v << 4 ^ (t ^ t << 1)) | 0;
        };
        me.x = 0;
        me.y = 0;
        me.z = 0;
        me.w = 0;
        me.v = 0;
        if (seed === (seed | 0)) {
          me.x = seed;
        } else {
          strseed += seed;
        }
        for (var k = 0; k < strseed.length + 64; k++) {
          me.x ^= strseed.charCodeAt(k) | 0;
          if (k == strseed.length) {
            me.d = me.x << 10 ^ me.x >>> 4;
          }
          me.next();
        }
      }
      function copy(f, t) {
        t.x = f.x;
        t.y = f.y;
        t.z = f.z;
        t.w = f.w;
        t.v = f.v;
        t.d = f.d;
        return t;
      }
      function impl(seed, opts) {
        var xg = new XorGen(seed), state = opts && opts.state, prng = function() {
          return (xg.next() >>> 0) / 4294967296;
        };
        prng.double = function() {
          do {
            var top = xg.next() >>> 11, bot = (xg.next() >>> 0) / 4294967296, result = (top + bot) / (1 << 21);
          } while (result === 0);
          return result;
        };
        prng.int32 = xg.next;
        prng.quick = prng;
        if (state) {
          if (typeof state == "object") copy(state, xg);
          prng.state = function() {
            return copy(xg, {});
          };
        }
        return prng;
      }
      if (module2 && module2.exports) {
        module2.exports = impl;
      } else if (define2 && define2.amd) {
        define2(function() {
          return impl;
        });
      } else {
        this.xorwow = impl;
      }
    })(
      exports,
      typeof module == "object" && module,
      // present in node.js
      typeof define == "function" && define
      // present with an AMD loader
    );
  }
});

// engine/node_modules/.pnpm/seedrandom@2.4.3/node_modules/seedrandom/lib/xorshift7.js
var require_xorshift7 = __commonJS({
  "engine/node_modules/.pnpm/seedrandom@2.4.3/node_modules/seedrandom/lib/xorshift7.js"(exports, module) {
    (function(global2, module2, define2) {
      function XorGen(seed) {
        var me = this;
        me.next = function() {
          var X = me.x, i = me.i, t, v, w;
          t = X[i];
          t ^= t >>> 7;
          v = t ^ t << 24;
          t = X[i + 1 & 7];
          v ^= t ^ t >>> 10;
          t = X[i + 3 & 7];
          v ^= t ^ t >>> 3;
          t = X[i + 4 & 7];
          v ^= t ^ t << 7;
          t = X[i + 7 & 7];
          t = t ^ t << 13;
          v ^= t ^ t << 9;
          X[i] = v;
          me.i = i + 1 & 7;
          return v;
        };
        function init(me2, seed2) {
          var j, w, X = [];
          if (seed2 === (seed2 | 0)) {
            w = X[0] = seed2;
          } else {
            seed2 = "" + seed2;
            for (j = 0; j < seed2.length; ++j) {
              X[j & 7] = X[j & 7] << 15 ^ seed2.charCodeAt(j) + X[j + 1 & 7] << 13;
            }
          }
          while (X.length < 8) X.push(0);
          for (j = 0; j < 8 && X[j] === 0; ++j) ;
          if (j == 8) w = X[7] = -1;
          else w = X[j];
          me2.x = X;
          me2.i = 0;
          for (j = 256; j > 0; --j) {
            me2.next();
          }
        }
        init(me, seed);
      }
      function copy(f, t) {
        t.x = f.x.slice();
        t.i = f.i;
        return t;
      }
      function impl(seed, opts) {
        if (seed == null) seed = +/* @__PURE__ */ new Date();
        var xg = new XorGen(seed), state = opts && opts.state, prng = function() {
          return (xg.next() >>> 0) / 4294967296;
        };
        prng.double = function() {
          do {
            var top = xg.next() >>> 11, bot = (xg.next() >>> 0) / 4294967296, result = (top + bot) / (1 << 21);
          } while (result === 0);
          return result;
        };
        prng.int32 = xg.next;
        prng.quick = prng;
        if (state) {
          if (state.x) copy(state, xg);
          prng.state = function() {
            return copy(xg, {});
          };
        }
        return prng;
      }
      if (module2 && module2.exports) {
        module2.exports = impl;
      } else if (define2 && define2.amd) {
        define2(function() {
          return impl;
        });
      } else {
        this.xorshift7 = impl;
      }
    })(
      exports,
      typeof module == "object" && module,
      // present in node.js
      typeof define == "function" && define
      // present with an AMD loader
    );
  }
});

// engine/node_modules/.pnpm/seedrandom@2.4.3/node_modules/seedrandom/lib/xor4096.js
var require_xor4096 = __commonJS({
  "engine/node_modules/.pnpm/seedrandom@2.4.3/node_modules/seedrandom/lib/xor4096.js"(exports, module) {
    (function(global2, module2, define2) {
      function XorGen(seed) {
        var me = this;
        me.next = function() {
          var w = me.w, X = me.X, i = me.i, t, v;
          me.w = w = w + 1640531527 | 0;
          v = X[i + 34 & 127];
          t = X[i = i + 1 & 127];
          v ^= v << 13;
          t ^= t << 17;
          v ^= v >>> 15;
          t ^= t >>> 12;
          v = X[i] = v ^ t;
          me.i = i;
          return v + (w ^ w >>> 16) | 0;
        };
        function init(me2, seed2) {
          var t, v, i, j, w, X = [], limit = 128;
          if (seed2 === (seed2 | 0)) {
            v = seed2;
            seed2 = null;
          } else {
            seed2 = seed2 + "\0";
            v = 0;
            limit = Math.max(limit, seed2.length);
          }
          for (i = 0, j = -32; j < limit; ++j) {
            if (seed2) v ^= seed2.charCodeAt((j + 32) % seed2.length);
            if (j === 0) w = v;
            v ^= v << 10;
            v ^= v >>> 15;
            v ^= v << 4;
            v ^= v >>> 13;
            if (j >= 0) {
              w = w + 1640531527 | 0;
              t = X[j & 127] ^= v + w;
              i = 0 == t ? i + 1 : 0;
            }
          }
          if (i >= 128) {
            X[(seed2 && seed2.length || 0) & 127] = -1;
          }
          i = 127;
          for (j = 4 * 128; j > 0; --j) {
            v = X[i + 34 & 127];
            t = X[i = i + 1 & 127];
            v ^= v << 13;
            t ^= t << 17;
            v ^= v >>> 15;
            t ^= t >>> 12;
            X[i] = v ^ t;
          }
          me2.w = w;
          me2.X = X;
          me2.i = i;
        }
        init(me, seed);
      }
      function copy(f, t) {
        t.i = f.i;
        t.w = f.w;
        t.X = f.X.slice();
        return t;
      }
      ;
      function impl(seed, opts) {
        if (seed == null) seed = +/* @__PURE__ */ new Date();
        var xg = new XorGen(seed), state = opts && opts.state, prng = function() {
          return (xg.next() >>> 0) / 4294967296;
        };
        prng.double = function() {
          do {
            var top = xg.next() >>> 11, bot = (xg.next() >>> 0) / 4294967296, result = (top + bot) / (1 << 21);
          } while (result === 0);
          return result;
        };
        prng.int32 = xg.next;
        prng.quick = prng;
        if (state) {
          if (state.X) copy(state, xg);
          prng.state = function() {
            return copy(xg, {});
          };
        }
        return prng;
      }
      if (module2 && module2.exports) {
        module2.exports = impl;
      } else if (define2 && define2.amd) {
        define2(function() {
          return impl;
        });
      } else {
        this.xor4096 = impl;
      }
    })(
      exports,
      // window object or global
      typeof module == "object" && module,
      // present in node.js
      typeof define == "function" && define
      // present with an AMD loader
    );
  }
});

// engine/node_modules/.pnpm/seedrandom@2.4.3/node_modules/seedrandom/lib/tychei.js
var require_tychei = __commonJS({
  "engine/node_modules/.pnpm/seedrandom@2.4.3/node_modules/seedrandom/lib/tychei.js"(exports, module) {
    (function(global2, module2, define2) {
      function XorGen(seed) {
        var me = this, strseed = "";
        me.next = function() {
          var b = me.b, c = me.c, d = me.d, a = me.a;
          b = b << 25 ^ b >>> 7 ^ c;
          c = c - d | 0;
          d = d << 24 ^ d >>> 8 ^ a;
          a = a - b | 0;
          me.b = b = b << 20 ^ b >>> 12 ^ c;
          me.c = c = c - d | 0;
          me.d = d << 16 ^ c >>> 16 ^ a;
          return me.a = a - b | 0;
        };
        me.a = 0;
        me.b = 0;
        me.c = 2654435769 | 0;
        me.d = 1367130551;
        if (seed === Math.floor(seed)) {
          me.a = seed / 4294967296 | 0;
          me.b = seed | 0;
        } else {
          strseed += seed;
        }
        for (var k = 0; k < strseed.length + 20; k++) {
          me.b ^= strseed.charCodeAt(k) | 0;
          me.next();
        }
      }
      function copy(f, t) {
        t.a = f.a;
        t.b = f.b;
        t.c = f.c;
        t.d = f.d;
        return t;
      }
      ;
      function impl(seed, opts) {
        var xg = new XorGen(seed), state = opts && opts.state, prng = function() {
          return (xg.next() >>> 0) / 4294967296;
        };
        prng.double = function() {
          do {
            var top = xg.next() >>> 11, bot = (xg.next() >>> 0) / 4294967296, result = (top + bot) / (1 << 21);
          } while (result === 0);
          return result;
        };
        prng.int32 = xg.next;
        prng.quick = prng;
        if (state) {
          if (typeof state == "object") copy(state, xg);
          prng.state = function() {
            return copy(xg, {});
          };
        }
        return prng;
      }
      if (module2 && module2.exports) {
        module2.exports = impl;
      } else if (define2 && define2.amd) {
        define2(function() {
          return impl;
        });
      } else {
        this.tychei = impl;
      }
    })(
      exports,
      typeof module == "object" && module,
      // present in node.js
      typeof define == "function" && define
      // present with an AMD loader
    );
  }
});

// engine/node_modules/.pnpm/seedrandom@2.4.3/node_modules/seedrandom/seedrandom.js
var require_seedrandom = __commonJS({
  "engine/node_modules/.pnpm/seedrandom@2.4.3/node_modules/seedrandom/seedrandom.js"(exports, module) {
    (function(pool, math) {
      var global2 = this, width = 256, chunks = 6, digits = 52, rngname = "random", startdenom = math.pow(width, chunks), significance = math.pow(2, digits), overflow = significance * 2, mask = width - 1, nodecrypto;
      function seedrandom4(seed, options, callback) {
        var key2 = [];
        options = options == true ? { entropy: true } : options || {};
        var shortseed = mixkey(flatten3(
          options.entropy ? [seed, tostring(pool)] : seed == null ? autoseed() : seed,
          3
        ), key2);
        var arc4 = new ARC4(key2);
        var prng = function() {
          var n = arc4.g(chunks), d = startdenom, x = 0;
          while (n < significance) {
            n = (n + x) * width;
            d *= width;
            x = arc4.g(1);
          }
          while (n >= overflow) {
            n /= 2;
            d /= 2;
            x >>>= 1;
          }
          return (n + x) / d;
        };
        prng.int32 = function() {
          return arc4.g(4) | 0;
        };
        prng.quick = function() {
          return arc4.g(4) / 4294967296;
        };
        prng.double = prng;
        mixkey(tostring(arc4.S), pool);
        return (options.pass || callback || function(prng2, seed2, is_math_call, state) {
          if (state) {
            if (state.S) {
              copy(state, arc4);
            }
            prng2.state = function() {
              return copy(arc4, {});
            };
          }
          if (is_math_call) {
            math[rngname] = prng2;
            return seed2;
          } else return prng2;
        })(
          prng,
          shortseed,
          "global" in options ? options.global : this == math,
          options.state
        );
      }
      math["seed" + rngname] = seedrandom4;
      function ARC4(key2) {
        var t, keylen = key2.length, me = this, i = 0, j = me.i = me.j = 0, s = me.S = [];
        if (!keylen) {
          key2 = [keylen++];
        }
        while (i < width) {
          s[i] = i++;
        }
        for (i = 0; i < width; i++) {
          s[i] = s[j = mask & j + key2[i % keylen] + (t = s[i])];
          s[j] = t;
        }
        (me.g = function(count) {
          var t2, r = 0, i2 = me.i, j2 = me.j, s11 = me.S;
          while (count--) {
            t2 = s11[i2 = mask & i2 + 1];
            r = r * width + s11[mask & (s11[i2] = s11[j2 = mask & j2 + t2]) + (s11[j2] = t2)];
          }
          me.i = i2;
          me.j = j2;
          return r;
        })(width);
      }
      function copy(f, t) {
        t.i = f.i;
        t.j = f.j;
        t.S = f.S.slice();
        return t;
      }
      ;
      function flatten3(obj, depth) {
        var result = [], typ = typeof obj, prop;
        if (depth && typ == "object") {
          for (prop in obj) {
            try {
              result.push(flatten3(obj[prop], depth - 1));
            } catch (e) {
            }
          }
        }
        return result.length ? result : typ == "string" ? obj : obj + "\0";
      }
      function mixkey(seed, key2) {
        var stringseed = seed + "", smear, j = 0;
        while (j < stringseed.length) {
          key2[mask & j] = mask & (smear ^= key2[mask & j] * 19) + stringseed.charCodeAt(j++);
        }
        return tostring(key2);
      }
      function autoseed() {
        try {
          var out;
          if (nodecrypto && (out = nodecrypto.randomBytes)) {
            out = out(width);
          } else {
            out = new Uint8Array(width);
            (global2.crypto || global2.msCrypto).getRandomValues(out);
          }
          return tostring(out);
        } catch (e) {
          var browser = global2.navigator, plugins = browser && browser.plugins;
          return [+/* @__PURE__ */ new Date(), global2, plugins, global2.screen, tostring(pool)];
        }
      }
      function tostring(a) {
        return String.fromCharCode.apply(0, a);
      }
      mixkey(math.random(), pool);
      if (typeof module == "object" && module.exports) {
        module.exports = seedrandom4;
        try {
          nodecrypto = __require("crypto");
        } catch (ex) {
        }
      } else if (typeof define == "function" && define.amd) {
        define(function() {
          return seedrandom4;
        });
      }
    })(
      [],
      // pool: entropy pool starts empty
      Math
      // math: package containing random, pow, and seedrandom
    );
  }
});

// engine/node_modules/.pnpm/seedrandom@2.4.3/node_modules/seedrandom/index.js
var require_seedrandom2 = __commonJS({
  "engine/node_modules/.pnpm/seedrandom@2.4.3/node_modules/seedrandom/index.js"(exports, module) {
    var alea = require_alea();
    var xor128 = require_xor128();
    var xorwow = require_xorwow();
    var xorshift7 = require_xorshift7();
    var xor4096 = require_xor4096();
    var tychei = require_tychei();
    var sr = require_seedrandom();
    sr.alea = alea;
    sr.xor128 = xor128;
    sr.xorwow = xorwow;
    sr.xorshift7 = xorshift7;
    sr.xor4096 = xor4096;
    sr.tychei = tychei;
    module.exports = sr;
  }
});

// engine/node_modules/.pnpm/shuffle-seed@1.1.6/node_modules/shuffle-seed/shuffle-seed.js
var require_shuffle_seed = __commonJS({
  "engine/node_modules/.pnpm/shuffle-seed@1.1.6/node_modules/shuffle-seed/shuffle-seed.js"(exports, module) {
    (function() {
      var self2 = {};
      if (Math.seedrandom) seedrandom = Math.seedrandom;
      var isArray = function($) {
        return Object.prototype.toString.call($) === "[object Array]";
      };
      var extend = function(obj) {
        for (var i = 1; i < arguments.length; i++) for (var key2 in arguments[i]) obj[key2] = arguments[i][key2];
        return obj;
      };
      var seedify = function(seed) {
        if (/(number|string)/i.test(Object.prototype.toString.call(seed).match(/^\[object (.*)\]$/)[1])) return seed;
        if (isNaN(seed)) return Number(String(this.strSeed = seed).split("").map(function(x) {
          return x.charCodeAt(0);
        }).join(""));
        return seed;
      };
      var seedRand = function(func, min, max) {
        return Math.floor(func() * (max - min + 1)) + min;
      };
      self2.shuffle = function(arr, seed) {
        if (!isArray(arr)) return null;
        seed = seedify(seed) || "none";
        var size = arr.length;
        var rng = seedrandom(seed);
        var resp = [];
        var keys = [];
        for (var i = 0; i < size; i++) keys.push(i);
        for (var i = 0; i < size; i++) {
          var r = seedRand(rng, 0, keys.length - 1);
          var g = keys[r];
          keys.splice(r, 1);
          resp.push(arr[g]);
        }
        return resp;
      };
      self2.unshuffle = function(arr, seed) {
        if (!isArray(arr)) return null;
        seed = seedify(seed) || "none";
        var size = arr.length;
        var rng = seedrandom(seed);
        var resp = [];
        var map = [];
        var keys = [];
        for (var i = 0; i < size; i++) {
          resp.push(null);
          keys.push(i);
        }
        for (var i = 0; i < size; i++) {
          var r = seedRand(rng, 0, keys.length - 1);
          var g = keys[r];
          keys.splice(r, 1);
          resp[g] = arr[i];
        }
        return resp;
      };
      if (typeof exports !== "undefined") {
        module.exports = self2;
      } else {
        this["shuffleSeed"] = self2;
      }
    }).call(exports);
  }
});

// engine/node_modules/.pnpm/shuffle-seed@1.1.6/node_modules/shuffle-seed/index.js
var require_shuffle_seed2 = __commonJS({
  "engine/node_modules/.pnpm/shuffle-seed@1.1.6/node_modules/shuffle-seed/index.js"(exports, module) {
    var seedrandom4 = require_seedrandom2();
    var self2 = require_shuffle_seed();
    module.exports = self2;
  }
});

// engine/node_modules/.pnpm/eventemitter3@3.1.2/node_modules/eventemitter3/index.js
var require_eventemitter3 = __commonJS({
  "engine/node_modules/.pnpm/eventemitter3@3.1.2/node_modules/eventemitter3/index.js"(exports, module) {
    "use strict";
    var has = Object.prototype.hasOwnProperty;
    var prefix = "~";
    function Events() {
    }
    if (Object.create) {
      Events.prototype = /* @__PURE__ */ Object.create(null);
      if (!new Events().__proto__) prefix = false;
    }
    function EE(fn, context, once) {
      this.fn = fn;
      this.context = context;
      this.once = once || false;
    }
    function addListener(emitter, event, fn, context, once) {
      if (typeof fn !== "function") {
        throw new TypeError("The listener must be a function");
      }
      var listener = new EE(fn, context || emitter, once), evt = prefix ? prefix + event : event;
      if (!emitter._events[evt]) emitter._events[evt] = listener, emitter._eventsCount++;
      else if (!emitter._events[evt].fn) emitter._events[evt].push(listener);
      else emitter._events[evt] = [emitter._events[evt], listener];
      return emitter;
    }
    function clearEvent(emitter, evt) {
      if (--emitter._eventsCount === 0) emitter._events = new Events();
      else delete emitter._events[evt];
    }
    function EventEmitter3() {
      this._events = new Events();
      this._eventsCount = 0;
    }
    EventEmitter3.prototype.eventNames = function eventNames() {
      var names = [], events, name;
      if (this._eventsCount === 0) return names;
      for (name in events = this._events) {
        if (has.call(events, name)) names.push(prefix ? name.slice(1) : name);
      }
      if (Object.getOwnPropertySymbols) {
        return names.concat(Object.getOwnPropertySymbols(events));
      }
      return names;
    };
    EventEmitter3.prototype.listeners = function listeners(event) {
      var evt = prefix ? prefix + event : event, handlers = this._events[evt];
      if (!handlers) return [];
      if (handlers.fn) return [handlers.fn];
      for (var i = 0, l = handlers.length, ee = new Array(l); i < l; i++) {
        ee[i] = handlers[i].fn;
      }
      return ee;
    };
    EventEmitter3.prototype.listenerCount = function listenerCount(event) {
      var evt = prefix ? prefix + event : event, listeners = this._events[evt];
      if (!listeners) return 0;
      if (listeners.fn) return 1;
      return listeners.length;
    };
    EventEmitter3.prototype.emit = function emit(event, a1, a2, a3, a4, a5) {
      var evt = prefix ? prefix + event : event;
      if (!this._events[evt]) return false;
      var listeners = this._events[evt], len = arguments.length, args, i;
      if (listeners.fn) {
        if (listeners.once) this.removeListener(event, listeners.fn, void 0, true);
        switch (len) {
          case 1:
            return listeners.fn.call(listeners.context), true;
          case 2:
            return listeners.fn.call(listeners.context, a1), true;
          case 3:
            return listeners.fn.call(listeners.context, a1, a2), true;
          case 4:
            return listeners.fn.call(listeners.context, a1, a2, a3), true;
          case 5:
            return listeners.fn.call(listeners.context, a1, a2, a3, a4), true;
          case 6:
            return listeners.fn.call(listeners.context, a1, a2, a3, a4, a5), true;
        }
        for (i = 1, args = new Array(len - 1); i < len; i++) {
          args[i - 1] = arguments[i];
        }
        listeners.fn.apply(listeners.context, args);
      } else {
        var length = listeners.length, j;
        for (i = 0; i < length; i++) {
          if (listeners[i].once) this.removeListener(event, listeners[i].fn, void 0, true);
          switch (len) {
            case 1:
              listeners[i].fn.call(listeners[i].context);
              break;
            case 2:
              listeners[i].fn.call(listeners[i].context, a1);
              break;
            case 3:
              listeners[i].fn.call(listeners[i].context, a1, a2);
              break;
            case 4:
              listeners[i].fn.call(listeners[i].context, a1, a2, a3);
              break;
            default:
              if (!args) for (j = 1, args = new Array(len - 1); j < len; j++) {
                args[j - 1] = arguments[j];
              }
              listeners[i].fn.apply(listeners[i].context, args);
          }
        }
      }
      return true;
    };
    EventEmitter3.prototype.on = function on(event, fn, context) {
      return addListener(this, event, fn, context, false);
    };
    EventEmitter3.prototype.once = function once(event, fn, context) {
      return addListener(this, event, fn, context, true);
    };
    EventEmitter3.prototype.removeListener = function removeListener(event, fn, context, once) {
      var evt = prefix ? prefix + event : event;
      if (!this._events[evt]) return this;
      if (!fn) {
        clearEvent(this, evt);
        return this;
      }
      var listeners = this._events[evt];
      if (listeners.fn) {
        if (listeners.fn === fn && (!once || listeners.once) && (!context || listeners.context === context)) {
          clearEvent(this, evt);
        }
      } else {
        for (var i = 0, events = [], length = listeners.length; i < length; i++) {
          if (listeners[i].fn !== fn || once && !listeners[i].once || context && listeners[i].context !== context) {
            events.push(listeners[i]);
          }
        }
        if (events.length) this._events[evt] = events.length === 1 ? events[0] : events;
        else clearEvent(this, evt);
      }
      return this;
    };
    EventEmitter3.prototype.removeAllListeners = function removeAllListeners(event) {
      var evt;
      if (event) {
        evt = prefix ? prefix + event : event;
        if (this._events[evt]) clearEvent(this, evt);
      } else {
        this._events = new Events();
        this._eventsCount = 0;
      }
      return this;
    };
    EventEmitter3.prototype.off = EventEmitter3.prototype.removeListener;
    EventEmitter3.prototype.addListener = EventEmitter3.prototype.on;
    EventEmitter3.prefixed = prefix;
    EventEmitter3.EventEmitter = EventEmitter3;
    if ("undefined" !== typeof module) {
      module.exports = EventEmitter3;
    }
  }
});

// engine/node_modules/.pnpm/semver-compare@1.0.0/node_modules/semver-compare/index.js
var require_semver_compare = __commonJS({
  "engine/node_modules/.pnpm/semver-compare@1.0.0/node_modules/semver-compare/index.js"(exports, module) {
    module.exports = function cmp(a, b) {
      var pa = a.split(".");
      var pb = b.split(".");
      for (var i = 0; i < 3; i++) {
        var na = Number(pa[i]);
        var nb = Number(pb[i]);
        if (na > nb) return 1;
        if (nb > na) return -1;
        if (!isNaN(na) && isNaN(nb)) return 1;
        if (isNaN(na) && !isNaN(nb)) return -1;
      }
      return 0;
    };
  }
});

// engine/src/engine.ts
var import_lodash24 = __toESM(require_lodash2());
import assert25 from "node:assert";

// engine/package.json
var version = "4.8.51";

// engine/src/algorithms/preference-split-auction.ts
import assert from "node:assert";
var MIN_PREFERENCE_SPLIT_PLAYERS = 2;
var PREFERENCE_SPLIT_BUDGET_PER_PLAYER = 20;
function defaultPreferenceSplitBudget(players) {
  return PREFERENCE_SPLIT_BUDGET_PER_PLAYER * players;
}
var MIN_PREFERENCE_SPLIT_BUDGET = 1;
var MAX_PREFERENCE_SPLIT_BUDGET = 999;
function roundVictoryPoints(value) {
  return Math.floor(value + 0.5);
}
function isValidPreferenceSplitBudget(budget) {
  return typeof budget === "number" && Number.isInteger(budget) && budget >= MIN_PREFERENCE_SPLIT_BUDGET && budget <= MAX_PREFERENCE_SPLIT_BUDGET;
}
function preferenceSplitBidError(entries, factions2, budget) {
  if (!isValidPreferenceSplitBudget(budget)) {
    return `The bid budget must be a whole number between ${MIN_PREFERENCE_SPLIT_BUDGET} and ${MAX_PREFERENCE_SPLIT_BUDGET}`;
  }
  if (entries.length !== factions2.length) {
    return `You have to bid on all ${factions2.length} factions, no more and no less`;
  }
  if (new Set(entries.map((e) => e.faction)).size !== entries.length) {
    return "You can only bid once per faction";
  }
  for (const entry of entries) {
    if (!factions2.includes(entry.faction)) {
      return `${entry.faction} is not up for auction`;
    }
    if (typeof entry.points !== "number" || !Number.isFinite(entry.points)) {
      return "Every bid has to be a number";
    }
    if (!Number.isInteger(entry.points)) {
      return "Bids have to be whole numbers";
    }
    if (entry.points < 0) {
      return "Bids cannot be negative";
    }
  }
  const total = entries.reduce((sum3, e) => sum3 + e.points, 0);
  if (total !== budget) {
    return total < budget ? `You still have ${budget - total} of your ${budget} bid points left to spend` : `You have spent ${total - budget} more than your ${budget} bid points`;
  }
  return null;
}
function shuffled(items, random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = pick(i + 1, random);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
function pick(count, random) {
  return Math.min(count - 1, Math.max(0, Math.floor(random() * count)));
}
function resolvePreferenceSplitAuction(factions2, players, bids, budget, random = Math.random) {
  assert(
    players.length >= MIN_PREFERENCE_SPLIT_PLAYERS,
    `The Preference Split Auction needs at least ${MIN_PREFERENCE_SPLIT_PLAYERS} players, got ${players.length}`
  );
  assert(
    factions2.length === players.length,
    `The Preference Split Auction needs one faction per player - got ${factions2.length} factions for ${players.length} players`
  );
  assert(new Set(factions2).size === factions2.length, "The factions up for auction have to be distinct");
  assert(isValidPreferenceSplitBudget(budget), `Invalid bid budget ${budget}`);
  const submitted = /* @__PURE__ */ new Map();
  for (const bid of bids) {
    const key2 = `${bid.player}/${bid.faction}`;
    assert(!submitted.has(key2), `Duplicate bid by player ${bid.player} on ${bid.faction}`);
    submitted.set(key2, bid.points);
  }
  const bidOf = (player, faction) => {
    const points = submitted.get(`${player}/${faction}`);
    assert(points !== void 0, `Player ${player} did not bid on ${faction}`);
    return points;
  };
  for (const player of players) {
    const error = preferenceSplitBidError(
      factions2.map((faction) => ({ faction, points: bidOf(player, faction) })),
      factions2,
      budget
    );
    assert(error === null, `Player ${player}'s bids are not a legal split of ${budget}: ${error}`);
  }
  const summaries = factions2.map((faction) => {
    const factionBids = players.map((player) => ({ player, points: bidOf(player, faction) }));
    const total = factionBids.reduce((sum3, b) => sum3 + b.points, 0);
    return {
      faction,
      bids: factionBids,
      total,
      average: total / players.length,
      rank: 0,
      tiedWith: []
    };
  });
  const byTotal = [...summaries].sort((a, b) => b.total - a.total);
  const ordered = [];
  for (let i = 0; i < byTotal.length; ) {
    let j = i;
    while (j < byTotal.length && byTotal[j].total === byTotal[i].total) {
      j++;
    }
    const group = byTotal.slice(i, j);
    if (group.length > 1) {
      const tied = group.map((s) => s.faction);
      for (const summary of group) {
        summary.tiedWith = tied.filter((faction) => faction !== summary.faction);
      }
      ordered.push(...shuffled(group, random));
    } else {
      ordered.push(...group);
    }
    i = j;
  }
  ordered.forEach((summary, index) => {
    summary.rank = index + 1;
  });
  const remaining = [...players];
  const allocations = ordered.map((summary) => {
    const eligible = [...remaining];
    const highest = Math.max(...eligible.map((player) => bidOf(player, summary.faction)));
    const tiedPlayers = eligible.filter((player) => bidOf(player, summary.faction) === highest);
    const winner = tiedPlayers.length === 1 ? tiedPlayers[0] : tiedPlayers[pick(tiedPlayers.length, random)];
    remaining.splice(remaining.indexOf(winner), 1);
    return {
      faction: summary.faction,
      rank: summary.rank,
      eligible,
      winner,
      winnerBid: bidOf(winner, summary.faction),
      basePrice: summary.average,
      payment: roundVictoryPoints(summary.average),
      tiedPlayers: tiedPlayers.length > 1 ? tiedPlayers : []
    };
  });
  assert(remaining.length === 0, "The auction left a player without a faction");
  assert(
    new Set(allocations.map((a) => a.winner)).size === players.length,
    "The auction gave a player more than one faction"
  );
  assert(
    new Set(allocations.map((a) => a.faction)).size === factions2.length,
    "The auction awarded a faction more than once"
  );
  for (const allocation of allocations) {
    assert(
      allocation.payment === roundVictoryPoints(allocation.basePrice),
      `${allocation.faction} was not priced at its average`
    );
  }
  return {
    budget,
    players: [...players],
    order: ordered.map((summary) => summary.faction),
    factions: ordered,
    allocations
  };
}

// engine/src/enums.ts
var Planet = /* @__PURE__ */ ((Planet4) => {
  Planet4["Empty"] = "e";
  Planet4["Terra"] = "r";
  Planet4["Desert"] = "d";
  Planet4["Swamp"] = "s";
  Planet4["Oxide"] = "o";
  Planet4["Volcanic"] = "v";
  Planet4["Titanium"] = "t";
  Planet4["Ice"] = "i";
  Planet4["Gaia"] = "g";
  Planet4["Transdim"] = "m";
  Planet4["Lost"] = "l";
  Planet4["Protoplanet"] = "p";
  Planet4["Asteroid"] = "a";
  return Planet4;
})(Planet || {});
var ResearchField = /* @__PURE__ */ ((ResearchField4) => {
  ResearchField4["Terraforming"] = "terra";
  ResearchField4["Navigation"] = "nav";
  ResearchField4["Intelligence"] = "int";
  ResearchField4["GaiaProject"] = "gaia";
  ResearchField4["Economy"] = "eco";
  ResearchField4["Science"] = "sci";
  ResearchField4["Diplomacy"] = "dip";
  return ResearchField4;
})(ResearchField || {});
function hasExpansion(expansions, expansion) {
  return (expansions & expansion) !== 0;
}
((Planet4) => {
  function values(expansions) {
    const ret = [
      "e" /* Empty */,
      "r" /* Terra */,
      "d" /* Desert */,
      "s" /* Swamp */,
      "o" /* Oxide */,
      "v" /* Volcanic */,
      "t" /* Titanium */,
      "i" /* Ice */,
      "g" /* Gaia */,
      "m" /* Transdim */,
      "l" /* Lost */
    ];
    if (hasExpansion(expansions, 4 /* LostFleet */)) {
      ret.push("p" /* Protoplanet */, "a" /* Asteroid */);
    }
    return ret;
  }
  Planet4.values = values;
})(Planet || (Planet = {}));
((ResearchField4) => {
  function values(expansions) {
    const ret = [
      "terra" /* Terraforming */,
      "nav" /* Navigation */,
      "int" /* Intelligence */,
      "gaia" /* GaiaProject */,
      "eco" /* Economy */,
      "sci" /* Science */
    ];
    if (hasExpansion(expansions, 2 /* Frontiers */)) {
      ret.push("dip" /* Diplomacy */);
    }
    return ret;
  }
  ResearchField4.values = values;
})(ResearchField || (ResearchField = {}));
var Resource = /* @__PURE__ */ ((Resource2) => {
  Resource2["None"] = "~";
  Resource2["Ore"] = "o";
  Resource2["Credit"] = "c";
  Resource2["Knowledge"] = "k";
  Resource2["Qic"] = "q";
  Resource2["ChargePower"] = "pw";
  Resource2["PayPower"] = "pay-pw";
  Resource2["BowlToken"] = "bowl-t";
  Resource2["BurnToken"] = "burn-token";
  Resource2["GainToken"] = "t";
  Resource2["GainTokenArea3"] = "ta3";
  Resource2["Brainstone"] = "brainstone";
  Resource2["GainTokenGaiaArea"] = "tg";
  Resource2["MoveTokenToGaiaArea"] = "t->tg";
  Resource2["MoveTokenFromGaiaAreaToArea1"] = "tg->t";
  Resource2["VictoryPoint"] = "vp";
  Resource2["TerraformCostDiscount"] = "d";
  Resource2["Range"] = "r";
  Resource2["ShipRange"] = "ship-range";
  Resource2["GaiaFormer"] = "gf";
  Resource2["MoveGaiaFormerFromGaiaAreaToArea1"] = "gf->t";
  Resource2["InstantGaiaforming"] = "instant-gaiaforming";
  Resource2["SpaceStation"] = "space-station";
  Resource2["DowngradeLab"] = "down-lab";
  Resource2["UpgradeTerraforming"] = "up-terra";
  Resource2["UpgradeNavigation"] = "up-nav";
  Resource2["UpgradeIntelligence"] = "up-int";
  Resource2["UpgradeGaiaProject"] = "up-gaia";
  Resource2["UpgradeEconomy"] = "up-eco";
  Resource2["UpgradeScience"] = "up-sci";
  Resource2["UpgradeDiplomacy"] = "up-dip";
  Resource2["UpgradeLowest"] = "up-lowest";
  Resource2["TechTile"] = "tech";
  Resource2["RescoreFederation"] = "fed";
  Resource2["GainArtifact"] = "artifact";
  Resource2["TemporaryStep"] = "step";
  Resource2["TemporaryRange"] = "range";
  Resource2["MoveTokenFromArea3ToGaia"] = "t-a3";
  Resource2["PISwap"] = "swap-PI";
  Resource2["Turn"] = "turn";
  Resource2["TradeBonus"] = "tradeBonus";
  Resource2["TradeDiscount"] = "tradeDiscount";
  Resource2["TradeShip"] = "tradeShip";
  Resource2["PowerRing"] = "power-ring";
  return Resource2;
})(Resource || {});
function isResourceUsed(resource, expansion) {
  switch (resource) {
    case "ship-range" /* ShipRange */:
    case "tradeBonus" /* TradeBonus */:
    case "tradeDiscount" /* TradeDiscount */:
    case "tradeShip" /* TradeShip */:
    case "up-dip" /* UpgradeDiplomacy */:
      return hasExpansion(expansion, 2 /* Frontiers */);
  }
  return true;
}
var Operator = /* @__PURE__ */ ((Operator2) => {
  Operator2["Once"] = ">";
  Operator2["Income"] = "+";
  Operator2["Trigger"] = ">>";
  Operator2["Activate"] = "=>";
  Operator2["Pass"] = "|";
  Operator2["FourPowerBuildings"] = "PA->4pw";
  return Operator2;
})(Operator || {});
var Condition = /* @__PURE__ */ ((Condition2) => {
  Condition2["None"] = "~";
  Condition2["Mine"] = "m";
  Condition2["TradingStation"] = "ts";
  Condition2["ResearchLab"] = "lab";
  Condition2["BigBuilding"] = "PA";
  Condition2["Federation"] = "fed";
  Condition2["Gaia"] = "g";
  Condition2["PlanetType"] = "pt";
  Condition2["TechTile"] = "tt";
  Condition2["Sector"] = "s";
  Condition2["Structure"] = "st";
  Condition2["StructureFed"] = "stfed";
  Condition2["Satellite"] = "sat";
  Condition2["StructureValue"] = "stvalue";
  Condition2["StructureFedValue"] = "stfedvalue";
  Condition2["ResearchLevels"] = "a";
  Condition2["HighestResearchLevel"] = "L";
  Condition2["Asteroid"] = "ast";
  Condition2["DeepSpaceSector"] = "ds";
  Condition2["PlanetaryInstituteAcademyDistance"] = "pi-ac-dist";
  Condition2["MineOnGaia"] = "mg";
  Condition2["AdvanceResearch"] = "a";
  Condition2["TerraformStep"] = "step";
  Condition2["GaiaFormer"] = "gf";
  Condition2["Trade"] = "trade";
  Condition2["SpaceshipQicAction"] = "shipq";
  Condition2["NewSector"] = "newsector";
  Condition2["NewPlanetType"] = "newplanet";
  return Condition2;
})(Condition || {});
((Condition2) => {
  function matchesBuilding(condition, building, planet) {
    if (condition === building) {
      return true;
    }
    switch (condition) {
      case "mg" /* MineOnGaia */:
        return building === "m" /* Mine */ && planet === "g" /* Gaia */;
      case "PA" /* BigBuilding */:
        return building === "PI" /* PlanetaryInstitute */ || isAcademy(building) || building === "colony" /* Colony */;
    }
    return false;
  }
  Condition2.matchesBuilding = matchesBuilding;
})(Condition || (Condition = {}));
var Building = /* @__PURE__ */ ((Building3) => {
  Building3["Mine"] = "m";
  Building3["TradingStation"] = "ts";
  Building3["ResearchLab"] = "lab";
  Building3["PlanetaryInstitute"] = "PI";
  Building3["Academy1"] = "ac1";
  Building3["Academy2"] = "ac2";
  Building3["GaiaFormer"] = "gf";
  Building3["SpaceStation"] = "sp";
  Building3["Colony"] = "colony";
  Building3["CustomsPost"] = "customsPost";
  Building3["ColonyShip"] = "colonyShip";
  Building3["TradeShip"] = "tradeShip";
  Building3["ConstructionShip"] = "constructionShip";
  Building3["ResearchShip"] = "researchShip";
  Building3["Scout"] = "scout";
  Building3["Frigate"] = "frigate";
  Building3["BattleShip"] = "battleShip";
  return Building3;
})(Building || {});
((Building3) => {
  function values(expansion) {
    return Object.values(Building3).filter((b) => {
      if (typeof b !== "string") {
        return false;
      }
      if (isShip(b)) {
        if (!isAvailableShip(b)) {
          return false;
        }
        return hasExpansion(expansion, 2 /* Frontiers */);
      }
      switch (b) {
        case "colony" /* Colony */:
        case "customsPost" /* CustomsPost */:
          return hasExpansion(expansion, 2 /* Frontiers */);
      }
      return true;
    });
  }
  Building3.values = values;
  function ships() {
    return values(2 /* Frontiers */).filter((b) => isShip(b));
  }
  Building3.ships = ships;
})(Building || (Building = {}));
function isAvailableShip(b) {
  switch (b) {
    case "colonyShip" /* ColonyShip */:
    case "tradeShip" /* TradeShip */:
      return true;
  }
  return false;
}
function isShip(b) {
  switch (b) {
    case "colonyShip" /* ColonyShip */:
    case "tradeShip" /* TradeShip */:
    case "constructionShip" /* ConstructionShip */:
    case "researchShip" /* ResearchShip */:
    case "scout" /* Scout */:
    case "frigate" /* Frigate */:
    case "battleShip" /* BattleShip */:
      return true;
  }
  return false;
}
function isAcademy(b) {
  return b === "ac1" /* Academy1 */ || b === "ac2" /* Academy2 */;
}
var Faction = /* @__PURE__ */ ((Faction7) => {
  Faction7["Terrans"] = "terrans";
  Faction7["Lantids"] = "lantids";
  Faction7["HadschHallas"] = "hadsch-hallas";
  Faction7["Ivits"] = "ivits";
  Faction7["Geodens"] = "geodens";
  Faction7["BalTaks"] = "baltaks";
  Faction7["Xenos"] = "xenos";
  Faction7["Gleens"] = "gleens";
  Faction7["Taklons"] = "taklons";
  Faction7["Ambas"] = "ambas";
  Faction7["Firaks"] = "firaks";
  Faction7["Bescods"] = "bescods";
  Faction7["Nevlas"] = "nevlas";
  Faction7["Itars"] = "itars";
  Faction7["Tinkeroids"] = "tinkeroids";
  Faction7["Darkanians"] = "darkanians";
  Faction7["Moweyds"] = "moweyds";
  Faction7["SpaceGiants"] = "space-giants";
  return Faction7;
})(Faction || {});
((Faction7) => {
  function values(expansions) {
    const ret = [
      "terrans" /* Terrans */,
      "lantids" /* Lantids */,
      "hadsch-hallas" /* HadschHallas */,
      "ivits" /* Ivits */,
      "geodens" /* Geodens */,
      "baltaks" /* BalTaks */,
      "xenos" /* Xenos */,
      "gleens" /* Gleens */,
      "taklons" /* Taklons */,
      "ambas" /* Ambas */,
      "firaks" /* Firaks */,
      "bescods" /* Bescods */,
      "nevlas" /* Nevlas */,
      "itars" /* Itars */
    ];
    if (hasExpansion(expansions, 4 /* LostFleet */)) {
      ret.push("tinkeroids" /* Tinkeroids */, "darkanians" /* Darkanians */, "moweyds" /* Moweyds */, "space-giants" /* SpaceGiants */);
    }
    return ret;
  }
  Faction7.values = values;
})(Faction || (Faction = {}));
var RoundScoring = /* @__PURE__ */ ((RoundScoring4) => {
  RoundScoring4["Round1"] = "round1";
  RoundScoring4["Round2"] = "round2";
  RoundScoring4["Round3"] = "round3";
  RoundScoring4["Round4"] = "round4";
  RoundScoring4["Round5"] = "round5";
  RoundScoring4["Round6"] = "round6";
  return RoundScoring4;
})(RoundScoring || {});
((RoundScoring4) => {
  function values() {
    return Object.values(RoundScoring4).filter((val) => {
      if (typeof val !== "string") {
        return;
      }
      if (/^round[0-9]/.test(val)) {
        return true;
      }
    });
  }
  RoundScoring4.values = values;
})(RoundScoring || (RoundScoring = {}));
var Booster = /* @__PURE__ */ ((Booster11) => {
  Booster11["Booster1"] = "booster1";
  Booster11["Booster2"] = "booster2";
  Booster11["Booster3"] = "booster3";
  Booster11["Booster4"] = "booster4";
  Booster11["Booster5"] = "booster5";
  Booster11["Booster6"] = "booster6";
  Booster11["Booster7"] = "booster7";
  Booster11["Booster8"] = "booster8";
  Booster11["Booster9"] = "booster9";
  Booster11["Booster10"] = "booster10";
  Booster11["LostFleetFormer"] = "booster-lostfleet-former";
  Booster11["LostFleetPlanet"] = "booster-lostfleet-planet";
  Booster11["LostFleetDeep"] = "booster-lostfleet-deep";
  Booster11["LostFleetInstant"] = "booster-lostfleet-instant";
  return Booster11;
})(Booster || {});
((Booster7) => {
  function values(expansions = 0 /* None */) {
    const ret = [
      "booster1" /* Booster1 */,
      "booster2" /* Booster2 */,
      "booster3" /* Booster3 */,
      "booster4" /* Booster4 */,
      "booster5" /* Booster5 */,
      "booster6" /* Booster6 */,
      "booster7" /* Booster7 */,
      "booster8" /* Booster8 */,
      "booster9" /* Booster9 */,
      "booster10" /* Booster10 */
    ];
    if (hasExpansion(expansions, 4 /* LostFleet */)) {
      ret.push("booster-lostfleet-former" /* LostFleetFormer */, "booster-lostfleet-planet" /* LostFleetPlanet */, "booster-lostfleet-deep" /* LostFleetDeep */, "booster-lostfleet-instant" /* LostFleetInstant */);
    }
    return ret;
  }
  Booster7.values = values;
})(Booster || (Booster = {}));
var TechTile = /* @__PURE__ */ ((TechTile3) => {
  TechTile3["Tech1"] = "tech1";
  TechTile3["Tech2"] = "tech2";
  TechTile3["Tech3"] = "tech3";
  TechTile3["Tech4"] = "tech4";
  TechTile3["Tech5"] = "tech5";
  TechTile3["Tech6"] = "tech6";
  TechTile3["Tech7"] = "tech7";
  TechTile3["Tech8"] = "tech8";
  TechTile3["Tech9"] = "tech9";
  TechTile3["TechFrontiers1"] = "tech-frontiers1";
  return TechTile3;
})(TechTile || {});
((TechTile3) => {
  function values(expansions) {
    return Object.values(TechTile3).filter((val) => {
      if (typeof val !== "string") {
        return;
      }
      return !val.includes("frontiers") || hasExpansion(expansions, 2 /* Frontiers */);
    });
  }
  TechTile3.values = values;
})(TechTile || (TechTile = {}));
var TechPos = /* @__PURE__ */ ((TechPos4) => {
  TechPos4["Terraforming"] = "tech-terra";
  TechPos4["Navigation"] = "tech-nav";
  TechPos4["Intelligence"] = "tech-int";
  TechPos4["GaiaProject"] = "tech-gaia";
  TechPos4["Economy"] = "tech-eco";
  TechPos4["Science"] = "tech-sci";
  TechPos4["Diplomacy"] = "tech-dip";
  TechPos4["Free1"] = "tech-free1";
  TechPos4["Free2"] = "tech-free2";
  TechPos4["Free3"] = "tech-free3";
  return TechPos4;
})(TechPos || {});
((TechPos4) => {
  function values(expansions) {
    const ret = [
      "tech-terra",
      "tech-nav",
      "tech-int",
      "tech-gaia",
      "tech-eco",
      "tech-sci",
      "tech-free1",
      "tech-free2",
      "tech-free3"
    ];
    if (hasExpansion(expansions, 2 /* Frontiers */)) {
      ret.push("tech-dip" /* Diplomacy */);
    }
    return ret;
  }
  TechPos4.values = values;
})(TechPos || (TechPos = {}));
var TechTilePos = /* @__PURE__ */ ((TechTilePos6) => {
  TechTilePos6["Terraforming"] = "terra";
  TechTilePos6["Navigation"] = "nav";
  TechTilePos6["Intelligence"] = "int";
  TechTilePos6["GaiaProject"] = "gaia";
  TechTilePos6["Economy"] = "eco";
  TechTilePos6["Science"] = "sci";
  TechTilePos6["Diplomacy"] = "dip";
  TechTilePos6["Free1"] = "free1";
  TechTilePos6["Free2"] = "free2";
  TechTilePos6["Free3"] = "free3";
  return TechTilePos6;
})(TechTilePos || {});
((TechTilePos6) => {
  function values(expansions) {
    const ret = ["terra", "nav", "int", "gaia", "eco", "sci", "free1", "free2", "free3"];
    if (hasExpansion(expansions, 2 /* Frontiers */)) {
      ret.push("dip" /* Diplomacy */);
    }
    return ret;
  }
  TechTilePos6.values = values;
})(TechTilePos || (TechTilePos = {}));
var AdvTechTile = /* @__PURE__ */ ((AdvTechTile3) => {
  AdvTechTile3["AdvTech1"] = "advtech1";
  AdvTechTile3["AdvTech2"] = "advtech2";
  AdvTechTile3["AdvTech3"] = "advtech3";
  AdvTechTile3["AdvTech4"] = "advtech4";
  AdvTechTile3["AdvTech5"] = "advtech5";
  AdvTechTile3["AdvTech6"] = "advtech6";
  AdvTechTile3["AdvTech7"] = "advtech7";
  AdvTechTile3["AdvTech8"] = "advtech8";
  AdvTechTile3["AdvTech9"] = "advtech9";
  AdvTechTile3["AdvTech10"] = "advtech10";
  AdvTechTile3["AdvTech11"] = "advtech11";
  AdvTechTile3["AdvTech12"] = "advtech12";
  AdvTechTile3["AdvTech13"] = "advtech13";
  AdvTechTile3["AdvTech14"] = "advtech14";
  AdvTechTile3["AdvTech15"] = "advtech15";
  AdvTechTile3["AsteroidPass"] = "advtech-asteroidpass";
  AdvTechTile3["Big"] = "advtech-big";
  AdvTechTile3["Deep"] = "advtech-deep";
  AdvTechTile3["DeepPass"] = "advtech-deeppass";
  AdvTechTile3["QAction"] = "advtech-qaction";
  AdvTechTile3["Terra"] = "advtech-terra";
  return AdvTechTile3;
})(AdvTechTile || {});
((AdvTechTile3) => {
  function values(expansions) {
    const ret = [
      "advtech1" /* AdvTech1 */,
      "advtech2" /* AdvTech2 */,
      "advtech3" /* AdvTech3 */,
      "advtech4" /* AdvTech4 */,
      "advtech5" /* AdvTech5 */,
      "advtech6" /* AdvTech6 */,
      "advtech7" /* AdvTech7 */,
      "advtech8" /* AdvTech8 */,
      "advtech9" /* AdvTech9 */,
      "advtech10" /* AdvTech10 */,
      "advtech11" /* AdvTech11 */,
      "advtech12" /* AdvTech12 */,
      "advtech13" /* AdvTech13 */,
      "advtech14" /* AdvTech14 */,
      "advtech15" /* AdvTech15 */
    ];
    if (hasExpansion(expansions, 4 /* LostFleet */)) {
      ret.push(
        "advtech-asteroidpass" /* AsteroidPass */,
        "advtech-big" /* Big */,
        "advtech-deep" /* Deep */,
        "advtech-deeppass" /* DeepPass */,
        "advtech-qaction" /* QAction */,
        "advtech-terra" /* Terra */
      );
    }
    return ret;
  }
  AdvTechTile3.values = values;
})(AdvTechTile || (AdvTechTile = {}));
var AdvTechTilePos = /* @__PURE__ */ ((AdvTechTilePos5) => {
  AdvTechTilePos5["Terraforming"] = "adv-terra";
  AdvTechTilePos5["Navigation"] = "adv-nav";
  AdvTechTilePos5["Intelligence"] = "adv-int";
  AdvTechTilePos5["GaiaProject"] = "adv-gaia";
  AdvTechTilePos5["Economy"] = "adv-eco";
  AdvTechTilePos5["Science"] = "adv-sci";
  AdvTechTilePos5["Diplomacy"] = "adv-dip";
  AdvTechTilePos5["ScoringExtension"] = "adv-ext";
  return AdvTechTilePos5;
})(AdvTechTilePos || {});
((AdvTechTilePos5) => {
  function values(expansions) {
    const ret = ["adv-terra", "adv-nav", "adv-int", "adv-gaia", "adv-eco", "adv-sci"];
    if (hasExpansion(expansions, 2 /* Frontiers */)) {
      ret.push("adv-dip" /* Diplomacy */);
    }
    if (hasExpansion(expansions, 4 /* LostFleet */)) {
      ret.push("adv-ext" /* ScoringExtension */);
    }
    return ret;
  }
  AdvTechTilePos5.values = values;
})(AdvTechTilePos || (AdvTechTilePos = {}));
var Federation = /* @__PURE__ */ ((Federation7) => {
  Federation7["Fed1"] = "fed1";
  Federation7["Fed2"] = "fed2";
  Federation7["Fed3"] = "fed3";
  Federation7["Fed4"] = "fed4";
  Federation7["Fed5"] = "fed5";
  Federation7["Fed6"] = "fed6";
  Federation7["Gleens"] = "gleens";
  return Federation7;
})(Federation || {});
((Federation7) => {
  function values(expansions) {
    return ["fed1", "fed2", "fed3", "fed4", "fed5", "fed6"];
  }
  Federation7.values = values;
})(Federation || (Federation = {}));
var BoardAction = /* @__PURE__ */ ((BoardAction5) => {
  BoardAction5["Power1"] = "power1";
  BoardAction5["Power2"] = "power2";
  BoardAction5["Power3"] = "power3";
  BoardAction5["Power4"] = "power4";
  BoardAction5["Power5"] = "power5";
  BoardAction5["Power6"] = "power6";
  BoardAction5["Power7"] = "power7";
  BoardAction5["Qic1"] = "qic1";
  BoardAction5["Qic2"] = "qic2";
  BoardAction5["Qic3"] = "qic3";
  return BoardAction5;
})(BoardAction || {});
((BoardAction5) => {
  function values(expansions = 0 /* None */) {
    const ret = Object.values(BoardAction5).filter(
      (val) => typeof val === "string" && /^power[0-9]/.test(val)
    );
    if (!hasExpansion(expansions, 4 /* LostFleet */)) {
      ret.push("qic1" /* Qic1 */, "qic2" /* Qic2 */, "qic3" /* Qic3 */);
    }
    return ret;
  }
  BoardAction5.values = values;
})(BoardAction || (BoardAction = {}));
var ScoringTile = /* @__PURE__ */ ((ScoringTile3) => {
  ScoringTile3["Score1"] = "score1";
  ScoringTile3["Score2"] = "score2";
  ScoringTile3["Score3"] = "score3";
  ScoringTile3["Score4"] = "score4";
  ScoringTile3["Score5"] = "score5";
  ScoringTile3["Score6"] = "score6";
  ScoringTile3["Score7"] = "score7";
  ScoringTile3["Score8"] = "score8";
  ScoringTile3["Score9"] = "score9";
  ScoringTile3["Score10"] = "score10";
  ScoringTile3["LfLab4"] = "lflab4";
  ScoringTile3["LfSector3"] = "lfsector3";
  ScoringTile3["LfPlanet3"] = "lfplanet3";
  return ScoringTile3;
})(ScoringTile || {});
((ScoringTile3) => {
  function values(expansions = 0) {
    const base = Object.values(ScoringTile3).filter((val) => {
      if (typeof val !== "string") {
        return;
      }
      if (/^score[0-9]/.test(val)) {
        return true;
      }
    });
    if (hasExpansion(expansions, 4 /* LostFleet */)) {
      base.push("lflab4" /* LfLab4 */, "lfsector3" /* LfSector3 */, "lfplanet3" /* LfPlanet3 */);
    }
    return base;
  }
  ScoringTile3.values = values;
})(ScoringTile || (ScoringTile = {}));
var FinalTile = /* @__PURE__ */ ((FinalTile5) => {
  FinalTile5["Structure"] = "structure";
  FinalTile5["StructureFed"] = "structureFed";
  FinalTile5["PlanetType"] = "planetType";
  FinalTile5["Gaia"] = "gaia";
  FinalTile5["Sector"] = "sector";
  FinalTile5["Satellite"] = "satellite";
  FinalTile5["Asteroid"] = "asteroid";
  FinalTile5["PlanetaryInstituteAcademyDistance"] = "piAcademyDistance";
  FinalTile5["DeepSpaceSector"] = "deepSpaceSector";
  return FinalTile5;
})(FinalTile || {});
((FinalTile5) => {
  function values(expansions = 0) {
    const ret = [
      "structure" /* Structure */,
      "structureFed" /* StructureFed */,
      "planetType" /* PlanetType */,
      "gaia" /* Gaia */,
      "sector" /* Sector */,
      "satellite" /* Satellite */
    ];
    if (hasExpansion(expansions, 4 /* LostFleet */)) {
      ret.push("asteroid" /* Asteroid */, "piAcademyDistance" /* PlanetaryInstituteAcademyDistance */, "deepSpaceSector" /* DeepSpaceSector */);
    }
    return ret;
  }
  FinalTile5.values = values;
})(FinalTile || (FinalTile = {}));
var Phase = /* @__PURE__ */ ((Phase3) => {
  Phase3["SetupInit"] = "setupInit";
  Phase3["SetupBoard"] = "setupBoard";
  Phase3["SetupFactionBan"] = "setupFactionBan";
  Phase3["SetupFaction"] = "setupFaction";
  Phase3["SetupAuction"] = "setupAuction";
  Phase3["SetupSilentBid"] = "setupSilentBid";
  Phase3["SetupPreferenceBid"] = "setupPreferenceBid";
  Phase3["SetupBuilding"] = "setupBuilding";
  Phase3["SetupBooster"] = "setupBooster";
  Phase3["BeginGame"] = "beginGame";
  Phase3["RoundStart"] = "roundStart";
  Phase3["RoundIncome"] = "roundIncome";
  Phase3["RoundGaia"] = "roundGaia";
  Phase3["RoundShip"] = "roundShip";
  Phase3["RoundMove"] = "roundMove";
  Phase3["RoundLeech"] = "roundLeech";
  Phase3["RoundFinish"] = "roundFinish";
  Phase3["EndGame"] = "endGame";
  return Phase3;
})(Phase || {});
var TinkeringTile = /* @__PURE__ */ ((TinkeringTile6) => {
  TinkeringTile6["Step1"] = "tinkering-step1";
  TinkeringTile6["Power4"] = "tinkering-power4";
  TinkeringTile6["Qic1"] = "tinkering-qic1";
  TinkeringTile6["Step3"] = "tinkering-step3";
  TinkeringTile6["Knowledge3"] = "tinkering-knowledge3";
  TinkeringTile6["Qic2"] = "tinkering-qic2";
  return TinkeringTile6;
})(TinkeringTile || {});
((TinkeringTile6) => {
  function values() {
    return [
      "tinkering-step1" /* Step1 */,
      "tinkering-power4" /* Power4 */,
      "tinkering-qic1" /* Qic1 */,
      "tinkering-step3" /* Step3 */,
      "tinkering-knowledge3" /* Knowledge3 */,
      "tinkering-qic2" /* Qic2 */
    ];
  }
  TinkeringTile6.values = values;
})(TinkeringTile || (TinkeringTile = {}));
var Spaceship = /* @__PURE__ */ ((Spaceship10) => {
  Spaceship10["Twilight"] = "twilight";
  Spaceship10["Rebellion"] = "rebellion";
  Spaceship10["TFMars"] = "tfmars";
  Spaceship10["Eclipse"] = "eclipse";
  return Spaceship10;
})(Spaceship || {});
((Spaceship10) => {
  function values(expansions) {
    if (!hasExpansion(expansions, 4 /* LostFleet */)) {
      return [];
    }
    return ["twilight" /* Twilight */, "rebellion" /* Rebellion */, "tfmars" /* TFMars */, "eclipse" /* Eclipse */];
  }
  Spaceship10.values = values;
})(Spaceship || (Spaceship = {}));
var SpaceshipTechTile = /* @__PURE__ */ ((SpaceshipTechTile5) => {
  SpaceshipTechTile5["Range"] = "ship-tech-range";
  SpaceshipTechTile5["Terraform"] = "ship-tech-terraform";
  SpaceshipTechTile5["Resource"] = "ship-tech-resource";
  return SpaceshipTechTile5;
})(SpaceshipTechTile || {});
((SpaceshipTechTile5) => {
  function values(expansions) {
    if (!hasExpansion(expansions, 4 /* LostFleet */)) {
      return [];
    }
    return ["ship-tech-range" /* Range */, "ship-tech-terraform" /* Terraform */, "ship-tech-resource" /* Resource */];
  }
  SpaceshipTechTile5.values = values;
})(SpaceshipTechTile || (SpaceshipTechTile = {}));
var SpaceshipFederation = /* @__PURE__ */ ((SpaceshipFederation6) => {
  SpaceshipFederation6["Credit"] = "ship-fed-credit";
  SpaceshipFederation6["Knowledge"] = "ship-fed-knowledge";
  SpaceshipFederation6["OreQic"] = "ship-fed-orequic";
  SpaceshipFederation6["PowerTokens"] = "ship-fed-power";
  SpaceshipFederation6["Range"] = "ship-fed-range";
  SpaceshipFederation6["Tech"] = "ship-fed-tech";
  SpaceshipFederation6["Terraform"] = "ship-fed-terraform";
  SpaceshipFederation6["Vp"] = "ship-fed-vp";
  return SpaceshipFederation6;
})(SpaceshipFederation || {});
((SpaceshipFederation6) => {
  function values(expansions) {
    if (!hasExpansion(expansions, 4 /* LostFleet */)) {
      return [];
    }
    return [
      "ship-fed-credit" /* Credit */,
      "ship-fed-knowledge" /* Knowledge */,
      "ship-fed-orequic" /* OreQic */,
      "ship-fed-power" /* PowerTokens */,
      "ship-fed-range" /* Range */,
      "ship-fed-tech" /* Tech */,
      "ship-fed-terraform" /* Terraform */,
      "ship-fed-vp" /* Vp */
    ];
  }
  SpaceshipFederation6.values = values;
})(SpaceshipFederation || (SpaceshipFederation = {}));
var ArtifactToken = /* @__PURE__ */ ((ArtifactToken5) => {
  ArtifactToken5["KnowledgeOre"] = "artifact-knowledgeore";
  ArtifactToken5["Credit"] = "artifact-credit";
  ArtifactToken5["KnowledgeQic"] = "artifact-knowledgeqic";
  ArtifactToken5["CreditLarge"] = "artifact-creditlarge";
  ArtifactToken5["Power"] = "artifact-power";
  ArtifactToken5["Asteroid"] = "artifact-asteroid";
  ArtifactToken5["Protoplanet"] = "artifact-protoplanet";
  ArtifactToken5["ResearchLevel"] = "artifact-researchlevel";
  ArtifactToken5["ResearchTracks"] = "artifact-researchtracks";
  ArtifactToken5["Federation"] = "artifact-federation";
  ArtifactToken5["GaiaProject"] = "artifact-gaiaproject";
  ArtifactToken5["PlanetTypes"] = "artifact-planettypes";
  ArtifactToken5["DeepSpace"] = "artifact-deepspace";
  return ArtifactToken5;
})(ArtifactToken || {});
((ArtifactToken5) => {
  function values(expansions) {
    if (!hasExpansion(expansions, 4 /* LostFleet */)) {
      return [];
    }
    return [
      "artifact-knowledgeore" /* KnowledgeOre */,
      "artifact-credit" /* Credit */,
      "artifact-knowledgeqic" /* KnowledgeQic */,
      "artifact-creditlarge" /* CreditLarge */,
      "artifact-power" /* Power */,
      "artifact-asteroid" /* Asteroid */,
      "artifact-protoplanet" /* Protoplanet */,
      "artifact-researchlevel" /* ResearchLevel */,
      "artifact-researchtracks" /* ResearchTracks */,
      "artifact-federation" /* Federation */,
      "artifact-gaiaproject" /* GaiaProject */,
      "artifact-planettypes" /* PlanetTypes */,
      "artifact-deepspace" /* DeepSpace */
    ];
  }
  ArtifactToken5.values = values;
})(ArtifactToken || (ArtifactToken = {}));

// engine/src/setup.ts
var import_shuffle_seed = __toESM(require_shuffle_seed2());
import assert2 from "node:assert";

// engine/src/spaceships.ts
var spaceshipActionEffects = {
  ["twilight" /* Twilight */]: {
    qic: [">fed"],
    power: [],
    knowledge: ["3range"]
  },
  ["rebellion" /* Rebellion */]: {
    qic: ["tech"],
    power: [],
    knowledge: ["2c,1q"]
  },
  ["tfmars" /* TFMars */]: {
    qic: ["2vp", "tt > vp"],
    power: [],
    credit: []
  },
  ["eclipse" /* Eclipse */]: {
    qic: ["2vp", "pt > vp"],
    power: [],
    credit: []
  }
};
var spaceshipBoards = {
  ["twilight" /* Twilight */]: {
    hasStandardTechSlot: false,
    actions: [
      { type: "qic", cost: "3q", effect: "Re-score (re-trigger) a Federation token you already own" },
      { type: "power", cost: "3pw,2o", effect: "Build a Research Lab" },
      { type: "knowledge", cost: "1k", effect: "+3 range for Build a Mine, Gaiaforming, or Exploring a spaceship" }
    ]
  },
  ["rebellion" /* Rebellion */]: {
    hasStandardTechSlot: true,
    actions: [
      { type: "qic", cost: "3q", effect: "Claim a Tech tile" },
      {
        type: "power",
        cost: "3pw,1o",
        effect: "Build a Trading Station, ignoring the usual adjacent-mine requirement"
      },
      { type: "knowledge", cost: "2k", effect: "Gain 2 credits and 1 Q.I.C." }
    ]
  },
  ["tfmars" /* TFMars */]: {
    hasStandardTechSlot: true,
    actions: [
      { type: "qic", cost: "2q", effect: "Gain 2 VP plus 1 VP per Tech tile owned" },
      {
        type: "power",
        cost: "2pw",
        effect: "Instant Gaiaforming: convert a transdim planet in range into a Gaia planet"
      },
      { type: "credit", cost: "3c", effect: "Terraform 1 step and build a mine" }
    ]
  },
  ["eclipse" /* Eclipse */]: {
    hasStandardTechSlot: true,
    actions: [
      { type: "qic", cost: "2q", effect: "Gain 2 VP plus 1 VP per planet type colonized" },
      { type: "power", cost: "3pw,2k", effect: "Advance 1 level on any Research track" },
      { type: "credit", cost: "6c", effect: "Place a free Mine on an Asteroid in range" }
    ]
  }
};
var EXPLORATION_CHARGE_TRACK = [0, 2, 2, 3];
function artifactSlotCount(ship, nbPlayers) {
  return ship === "twilight" /* Twilight */ ? nbPlayers : 0;
}
function shipsInPlay(expansions, nbPlayers) {
  return Spaceship.values(expansions).filter((ship) => nbPlayers > 2 || ship !== "rebellion" /* Rebellion */);
}
function claimableSpaceshipFederations(explorationShips, spaceshipFederations) {
  return Spaceship.values(4 /* LostFleet */).filter((ship) => explorationShips[ship] !== void 0 && spaceshipFederations[ship] !== void 0).map((ship) => ({
    ship,
    federation: spaceshipFederations[ship]
  }));
}
function claimableSpaceshipTechs(explorationShips, spaceshipTechs) {
  return Spaceship.values(4 /* LostFleet */).filter((ship) => explorationShips[ship] !== void 0 && (spaceshipTechs[ship]?.count ?? 0) > 0).map((ship) => ({
    ship,
    tile: spaceshipTechs[ship].tile
  }));
}

// engine/src/setup.ts
function techFactory(engine, type, tilePos, techTiles, count) {
  return {
    type,
    init: () => {
      for (const pos of tilePos) {
        engine.tiles.techs[pos] = null;
      }
    },
    nextAvailable: () => {
      const used = tilePos.map((p) => engine.tiles.techs[p]).filter((t) => t).map((t) => t.tile);
      for (const pos of tilePos) {
        if (!engine.tiles.techs[pos]) {
          return {
            position: pos,
            options: techTiles.filter((t) => !used.includes(t))
          };
        }
      }
      return null;
    },
    applyOption: (option, position) => {
      engine.tiles.techs[position] = { tile: option, count };
    }
  };
}
function shipAssignmentFactory(type, positions, pool, target) {
  return {
    type,
    init: () => {
      for (const pos of positions) {
        delete target[pos];
      }
    },
    nextAvailable: () => {
      const used = positions.map((pos) => target[pos]).filter((t) => t !== void 0);
      for (const pos of positions) {
        if (target[pos] === void 0) {
          return {
            position: pos,
            options: pool.filter((o) => !used.includes(o))
          };
        }
      }
      return null;
    },
    applyOption: (option, position) => {
      target[position] = option;
    }
  };
}
function spaceshipTechAssignmentFactory(positions, pool, target, count) {
  return {
    type: "spaceshipTechTile" /* SpaceshipTechTile */,
    init: () => {
      for (const pos of positions) {
        delete target[pos];
      }
    },
    nextAvailable: () => {
      const used = positions.map((pos) => target[pos]?.tile).filter((t) => t !== void 0);
      for (const pos of positions) {
        if (target[pos] === void 0) {
          return {
            position: pos,
            options: pool.filter((o) => !used.includes(o))
          };
        }
      }
      return null;
    },
    applyOption: (option, position) => {
      target[position] = {
        tile: option,
        count
      };
    }
  };
}
function scoringFactory(engine, type, available, used, targetSize) {
  return {
    type,
    init: () => {
      used.length = 0;
    },
    nextAvailable: () => {
      return used.length === targetSize ? null : {
        position: used.length + 1,
        options: available.filter((a) => !used.includes(a))
      };
    },
    applyOption: (option) => {
      used.push(option);
    }
  };
}
function usedSectorNames(map) {
  return Array.from(map.grid.values()).map((g) => g.data.sector).map((s) => s);
}
function unusedMapTiles(map) {
  const names = usedSectorNames(map);
  return map.configuration().sectors.filter((s) => !names.includes(s.name));
}
function setMap(engine, tiles) {
  engine.map.generate(tiles, () => 0, engine.options.map?.mirror ?? false);
  engine.options.map = engine.map.placement;
}
var getFactories = (engine, nbPlayers = engine.players.length) => [
  {
    type: "booster" /* Booster */,
    init: () => {
      for (const b of Booster.values(engine.expansions)) {
        delete engine.tiles.boosters[b];
      }
    },
    nextAvailable: () => {
      const boosters = Booster.values(engine.expansions);
      const left = boosters.filter((b) => !engine.tiles.boosters[b]);
      const used = boosters.filter((b) => engine.tiles.boosters[b]).length;
      if (used < nbPlayers + 3) {
        const b = left[0];
        return {
          position: used + 1,
          options: left
        };
      }
      return null;
    },
    applyOption: (option) => {
      engine.tiles.boosters[option] = true;
    }
  },
  techFactory(
    engine,
    "techTile" /* TechTile */,
    TechTilePos.values(engine.expansions),
    TechTile.values(engine.expansions),
    nbPlayers
  ),
  techFactory(
    engine,
    "advTechTile" /* AdvTechTile */,
    AdvTechTilePos.values(engine.expansions),
    AdvTechTile.values(engine.expansions),
    1
  ),
  {
    type: "terraformingFederation" /* TerraformingFederation */,
    init: () => {
      for (const federation of Federation.values(engine.expansions)) {
        engine.tiles.federations[federation] = 3;
        engine.terraformingFederation = null;
      }
    },
    nextAvailable: () => {
      return engine.terraformingFederation ? null : {
        position: 1,
        options: Federation.values(engine.expansions)
      };
    },
    applyOption: (option) => {
      engine.terraformingFederation = option;
      engine.tiles.federations[engine.terraformingFederation] -= 1;
    }
  },
  scoringFactory(
    engine,
    "roundScoringTile" /* RoundScoringTile */,
    ScoringTile.values(engine.expansions),
    engine.tiles.scorings.round,
    6
  ),
  scoringFactory(
    engine,
    "finalScoringTile" /* FinalScoringTile */,
    FinalTile.values(engine.expansions),
    engine.tiles.scorings.final,
    2
  ),
  spaceshipTechAssignmentFactory(
    shipsInPlay(engine.expansions, nbPlayers).filter((ship) => spaceshipBoards[ship].hasStandardTechSlot),
    SpaceshipTechTile.values(engine.expansions),
    engine.tiles.spaceshipTechs,
    nbPlayers
  ),
  shipAssignmentFactory(
    "spaceshipFederation" /* SpaceshipFederation */,
    shipsInPlay(engine.expansions, nbPlayers),
    SpaceshipFederation.values(engine.expansions),
    engine.tiles.spaceshipFederations
  ),
  scoringFactory(
    engine,
    "artifactToken" /* ArtifactToken */,
    ArtifactToken.values(engine.expansions),
    engine.tiles.artifacts,
    hasExpansion(engine.expansions, 4 /* LostFleet */) ? artifactSlotCount("twilight" /* Twilight */, nbPlayers) : 0
  ),
  {
    type: "mapTile" /* MapTile */,
    init: () => {
      setMap(engine, []);
    },
    nextAvailable: () => {
      const used = engine.map.grid.size / 19;
      const nbSectors = engine.map.configuration().nbSectors;
      return used === nbSectors ? null : {
        position: used + 1,
        options: unusedMapTiles(engine.map).map((t) => t.name)
      };
    },
    applyOption: (option) => {
      const used = usedSectorNames(engine.map);
      const tiles = engine.map.configuration().sectors.filter((s) => used.includes(s.name) || s.name === option);
      setMap(engine, tiles);
    }
  }
];
function applyRandomBoardSetup(engine, seed, nbPlayers) {
  const factories = getFactories(engine, nbPlayers).filter((f) => f.type !== "mapTile" /* MapTile */);
  for (const factory of factories) {
    factory.init();
    let options;
    let next;
    while ((next = factory.nextAvailable()) !== null) {
      if (!options) {
        options = import_shuffle_seed.default.shuffle(next.options, engine.map.rng());
      }
      factory.applyOption(options.shift(), next.position);
    }
  }
  if (hasExpansion(engine.expansions, 4 /* LostFleet */)) {
    engine.scoringExtensionSide = nbPlayers <= 2 || engine.map.rng() < 0.5 ? "vp" /* VictoryPoints */ : "ships" /* ExploredShips */;
    engine.lostFleetEconomySide = engine.map.rng() < 0.5 ? "pw" /* Power */ : "vp" /* VictoryPoints */;
  }
}
function initCustomSetup(engine) {
  for (const factory of getFactories(engine)) {
    factory.init();
  }
}
function nextAvailableSetupOption(engine) {
  for (const factory of getFactories(engine)) {
    const o = factory.nextAvailable();
    if (o) {
      return {
        type: factory.type,
        position: o.position,
        options: o.options
      };
    }
  }
  return null;
}
function applySetupOption(engine, type, position, option) {
  for (const factory of getFactories(engine)) {
    const o = factory.nextAvailable();
    if (o) {
      assert2(factory.type === type, `expected option for ${factory.type}, but got option for ${type}`);
      assert2(
        o.position.toString() === position.toString(),
        `option ${option} has wrong position ${position}, expected ${o.position}`
      );
      factory.applyOption(option, position);
      return;
    }
  }
}
function possibleSetupBoardActions(engine, player) {
  if (engine.options.customBoardSetup) {
    const setupOption = nextAvailableSetupOption(engine);
    if (setupOption) {
      return [{ name: "set" /* Setup */, player, data: setupOption }];
    }
  }
  return [{ name: "rotate" /* RotateSectors */, player }];
}

// engine/src/available/actions.ts
var import_lodash18 = __toESM(require_lodash2());

// engine/src/actions.ts
var ConversionPool = class {
  constructor(table, player) {
    this.actions = [];
    this.push(table, player);
  }
  push(table, player) {
    this.actions.push(...freeActionData(Object.keys(table).map((k) => Number(k)), player));
  }
  remove(action) {
    const conversion = freeActionConversions[action];
    this.actions = this.actions.filter((act) => !(act.cost === conversion.cost && act.income === conversion.income));
  }
};
var freeActions = {
  [0 /* PowerToQic */]: { cost: "4pw", income: "1q" },
  [2 /* PowerToOre */]: { cost: "3pw", income: "1o" },
  [4 /* QicToOre */]: { cost: "1q", income: "1o" },
  [1 /* PowerToKnowledge */]: { cost: "4pw", income: "1k" },
  [3 /* PowerToCredit */]: { cost: "1pw", income: "1c" },
  [6 /* KnowledgeToCredit */]: { cost: "1k", income: "1c" },
  [7 /* OreToCredit */]: { cost: "1o", income: "1c" },
  [5 /* OreToToken */]: { cost: "1o", income: "1t" }
};
var freeActionsHadschHallas = {
  [8 /* CreditToQic */]: { cost: "4c", income: "1q" },
  [9 /* CreditToOre */]: { cost: "3c", income: "1o" },
  [10 /* CreditToKnowledge */]: { cost: "4c", income: "1k" }
};
var freeActionsTerrans = {
  [11 /* GaiaTokenToQic */]: { cost: "4tg", income: "1q" },
  [13 /* GaiaTokenToOre */]: { cost: "3tg", income: "1o" },
  [12 /* GaiaTokenToKnowledge */]: { cost: "4tg", income: "1k" },
  [14 /* GaiaTokenToCredit */]: { cost: "1tg", income: "1c" }
};
var freeActionsItars = { [15 /* GaiaTokenToTech */]: { cost: "4tg", income: "tech" } };
var freeActionsNevlas = {
  [16 /* PowerToGaiaForKnowledge */]: { cost: "1t-a3", income: "1k" }
};
var freeActionsNevlasPI = {
  [18 /* PowerTo2Credit */]: { cost: "2pw", income: "2c" },
  // this is for convenience
  [17 /* PowerToOreAndCredit */]: { cost: "4pw", income: "1o,1c" },
  [19 /* PowerTo2Ore */]: { cost: "6pw", income: "2o" }
};
var freeActionsBaltaks = { [20 /* GaiaFormerToQic */]: { cost: "1gf", income: "1q" } };
var freeActionsTaklons = { [21 /* PowerTo3Credit */]: { cost: "3pw", income: "3c" } };
var freeActionsXenos = {
  [22 /* OreToPowerTokenArea3 */]: { cost: "1o", income: "1ta3" }
};
var freeActionConversions = Object.assign(
  {},
  freeActions,
  freeActionsHadschHallas,
  freeActionsTerrans,
  freeActionsItars,
  freeActionsNevlas,
  freeActionsNevlasPI,
  freeActionsBaltaks,
  freeActionsTaklons,
  freeActionsXenos
);
var boardActions = {
  ["power1" /* Power1 */]: { cost: "7pw", income: ["3k"] },
  ["power2" /* Power2 */]: { cost: "5pw", income: ["2step"] },
  ["power3" /* Power3 */]: { cost: "4pw", income: ["2o"] },
  ["power4" /* Power4 */]: { cost: "4pw", income: ["7c"] },
  ["power5" /* Power5 */]: { cost: "4pw", income: ["2k"] },
  ["power6" /* Power6 */]: { cost: "3pw", income: ["1step"] },
  ["power7" /* Power7 */]: { cost: "3pw", income: ["2t"] },
  ["qic1" /* Qic1 */]: { cost: "4q", income: ["tech"] },
  ["qic2" /* Qic2 */]: { cost: "3q", income: [">fed"] },
  ["qic3" /* Qic3 */]: { cost: "2q", income: ["3vp", "pt > vp"] }
};

// engine/src/player-data.ts
var import_eventemitter32 = __toESM(require_eventemitter3());
var import_lodash17 = __toESM(require_lodash2());
import assert13 from "node:assert";

// engine/src/reward.ts
var import_lodash = __toESM(require_lodash2());
import assert3 from "node:assert";
var resources = new Set(Object.values(Resource));
var Reward = class _Reward {
  constructor(countOrRewardString, type) {
    let count = countOrRewardString;
    if (arguments.length === 1) {
      const str = count;
      if (str.indexOf("+") > 0) {
        const regex = /^(.*)\+([0-9]*)$/;
        let _unused;
        [_unused, type, count] = regex.exec(str);
      } else {
        const regex = /^(-?[0-9]*)?(.*)$/;
        let _unused;
        [_unused, count, type] = regex.exec(str);
      }
    }
    if (type === "~" /* None */ || !resources.has(type)) {
      this.count = 0;
      this.type = "~" /* None */;
    } else {
      this.count = typeof count === "number" ? count : count !== void 0 && count.length > 0 ? +count : 1;
      this.type = type;
    }
  }
  toString() {
    if (this.isEmpty()) {
      return "~";
    }
    return this.toStringWithZero();
  }
  toStringWithOne() {
    if (this.isEmpty()) {
      return "~";
    }
    return `${this.count}${this.type}`;
  }
  toStringWithZero() {
    return this.count === 1 ? this.type.toString() : `${this.count}${this.type}`;
  }
  toJSON() {
    return this.toString();
  }
  isEmpty() {
    return this.count === 0 || this.type === "~" /* None */;
  }
  static parse(source) {
    assert3(typeof source === "string", `Reward.parse: ${source}'s type is not string, but ${typeof source}`);
    return source.split(",").map((rew) => new _Reward(rew));
  }
  /**
   * Given an array of rewards, merge rewards that give the same
   * kind of resource, and return a new array of rewards
   *
   * @param rewards
   */
  static merge(...rewards) {
    const grouped = (0, import_lodash.groupBy)([].concat(...rewards), "type");
    return Object.keys(grouped).map(
      (key2) => new _Reward(
        grouped[key2].reduce((val, rew) => val + rew.count, 0),
        key2
      )
    ).filter((rew) => !rew.isEmpty());
  }
  static negative(rewards) {
    return rewards.map((reward) => new _Reward(-reward.count, reward.type));
  }
  static toString(rewards, sorted = true) {
    const sortOrder = ["pw", "q", "k", "o", "c"];
    if (sorted) {
      rewards.sort(
        (rew1, rew2) => sortOrder.findIndex((so) => so === rew2.type) - sortOrder.findIndex((so) => so === rew1.type)
      );
    }
    if (rewards.length === 0) {
      return "~";
    }
    return rewards.map((rew) => rew.toString()).join(",");
  }
  static match(rewards1, rewards2) {
    return _Reward.toString(rewards1, true) === _Reward.toString(rewards2, true);
  }
  static includes(container, contained) {
    const indexed = {};
    for (const reward of container) {
      indexed[reward.type] = (indexed[reward.type] || 0) + reward.count;
    }
    for (const reward of contained) {
      indexed[reward.type] = (indexed[reward.type] || 0) - reward.count;
      if (indexed[reward.type] < 0) {
        return false;
      }
    }
    return true;
  }
};

// engine/src/available/buildings.ts
var import_lodash16 = __toESM(require_lodash2());

// engine/src/algorithms/scoring.ts
var import_lodash2 = __toESM(require_lodash2());

// engine/src/events.ts
function findCondition(spec) {
  let conditionMatch = /^(.+?)(\b| )/.exec(spec);
  if (!conditionMatch) {
    conditionMatch = /^([^ ]*)$/.exec(spec);
  }
  const conditionString = conditionMatch[1];
  const remaining = spec.substr(conditionString.length).trimLeft();
  for (const cond of Object.values(Condition)) {
    if (conditionString === cond) {
      return [cond, remaining];
    }
  }
  if (spec.split(" ").length === 3) {
    return [conditionString, remaining];
  }
  return ["~" /* None */, spec];
}
function findOperator(spec) {
  let operatorMatch = /^(.+?)(\b| )/.exec(spec);
  if (!operatorMatch) {
    operatorMatch = /^([^ ]*)$/.exec(spec);
  }
  const operatorString = operatorMatch[1];
  for (const op of Object.values(Operator)) {
    if (operatorString === op) {
      const remaining = spec.substr(operatorString.length).trimLeft();
      return [op, remaining];
    }
  }
  return [">" /* Once */, spec];
}
var tradeSource = "trade";
var tradeCostSource = "tradeCost";
function isTileOrBoosterSource(source) {
  return typeof source === "string" && (source.startsWith("booster") || source.startsWith("tech-") || source.startsWith("adv-"));
}
var Event = class _Event {
  constructor(spec, source) {
    this.activated = false;
    if (typeof spec === "object") {
      this.spec = spec.spec;
      this.source = spec.source;
    } else {
      this.spec = spec;
      this.source = source;
    }
    if (this.spec.endsWith("!")) {
      this.spec = this.spec.slice(0, this.spec.length - 1);
      this.activated = true;
    }
    let remaining;
    if (["PA->4pw" /* FourPowerBuildings */].includes(this.spec)) {
      this.condition = "~" /* None */;
      this.rewards = [];
      this.operator = spec;
    } else {
      [this.condition, remaining] = findCondition(this.spec);
      [this.operator, remaining] = findOperator(remaining);
      this.rewards = Reward.parse(remaining);
    }
    if (this.operator === "=>" /* Activate */ && this.condition !== "~" /* None */) {
      this.rewards.splice(0, 0, new Reward(-1, this.condition));
      this.condition = "~" /* None */;
    }
  }
  toString() {
    return this.spec + (this.activated ? "!" : "");
  }
  toJSON() {
    return { spec: this.toString(), source: this.source };
  }
  action() {
    const idx = this.spec.indexOf("=>");
    const ret = { rewards: this.spec.slice(idx + 2).trim(), enabled: !this.activated };
    if (idx > 0) {
      ret.rewards = "-" + this.spec.slice(0, idx).trim() + "," + ret.rewards;
    }
    return ret;
  }
  clone() {
    return new _Event(this.spec, this.source);
  }
  static parse(events, source) {
    return events.map((ev) => new _Event(ev, source));
  }
};

// engine/src/tiles/scoring.ts
var roundScorings = {
  ["score1" /* Score1 */]: ["step >> 2vp"],
  ["score2" /* Score2 */]: ["a >> 2vp"],
  ["score3" /* Score3 */]: ["m >> 2vp"],
  ["score4" /* Score4 */]: ["fed >> 5vp"],
  ["score5" /* Score5 */]: ["ts >> 4vp"],
  ["score6" /* Score6 */]: ["mg >> 4vp"],
  ["score7" /* Score7 */]: ["PA >> 5vp"],
  ["score8" /* Score8 */]: ["ts >> 3vp"],
  ["score9" /* Score9 */]: ["mg >> 3vp"],
  ["score10" /* Score10 */]: ["PA >> 5vp"],
  // Lost Fleet (RULES_CLARIFICATIONS.md §G4)
  ["lflab4" /* LfLab4 */]: ["lab >> 4vp"],
  ["lfsector3" /* LfSector3 */]: ["newsector >> 3vp"],
  ["lfplanet3" /* LfPlanet3 */]: ["newplanet >> 3vp"]
};
function roundScoringEvents(tile, round) {
  const roundScoring = roundScorings[tile];
  return Event.parse(roundScoring, `round${round}`);
}
var finalScorings = {
  ["structure" /* Structure */]: { condition: "st" /* Structure */, neutralPlayer: 11 },
  ["structureFed" /* StructureFed */]: { condition: "stfed" /* StructureFed */, neutralPlayer: 10 },
  ["planetType" /* PlanetType */]: { condition: "pt" /* PlanetType */, neutralPlayer: 5 },
  ["gaia" /* Gaia */]: { condition: "g" /* Gaia */, neutralPlayer: 4 },
  ["sector" /* Sector */]: { condition: "s" /* Sector */, neutralPlayer: 6 },
  ["satellite" /* Satellite */]: { condition: "sat" /* Satellite */, neutralPlayer: 8 },
  ["asteroid" /* Asteroid */]: { condition: "ast" /* Asteroid */, neutralPlayer: 3 },
  ["piAcademyDistance" /* PlanetaryInstituteAcademyDistance */]: {
    condition: "pi-ac-dist" /* PlanetaryInstituteAcademyDistance */,
    neutralPlayer: 8
  },
  ["deepSpaceSector" /* DeepSpaceSector */]: { condition: "ds" /* DeepSpaceSector */, neutralPlayer: 3 }
};
function finalScoringNeutralPlayer(tile, expansions) {
  if (tile === "planetType" /* PlanetType */ && hasExpansion(expansions, 4 /* LostFleet */)) {
    return 6;
  }
  return finalScorings[tile].neutralPlayer;
}

// engine/src/algorithms/scoring.ts
function finalRankings(finalTiles, collection, expansions = 0 /* None */) {
  const allRankings = [];
  for (const tile of finalTiles) {
    const players = (0, import_lodash2.sortBy)(collection, (player) => player.finalCount(tile)).reverse();
    const rankings = players.map((pl) => ({
      player: pl,
      count: pl.finalCount(tile)
    }));
    if (collection.length === 2) {
      rankings.push({
        player: null,
        count: finalScoringNeutralPlayer(tile, expansions)
      });
      rankings.sort((pl1, pl2) => pl2.count - pl1.count);
    }
    allRankings.push(rankings);
  }
  return allRankings;
}
function gainFinalScoringVictoryPoints(allRankings, player) {
  allRankings.forEach((rankings, index) => {
    const ranking = rankings.find((rnk) => rnk.player?.faction === player?.faction);
    const count = ranking.count;
    const first = rankings.findIndex((pl) => pl.count === count);
    const ties = rankings.filter((pl) => pl.count === count).length;
    if (ranking.player && count > 0) {
      const VPs = [18, 12, 6, 0, 0, 0];
      player.gainRewards(
        [new Reward(Math.floor((0, import_lodash2.sum)(VPs.slice(first, first + ties)) / ties), "vp" /* VictoryPoint */)],
        `final${index + 1}`
      );
    }
  });
}

// engine/src/map.ts
import assert5 from "node:assert";

// engine/node_modules/.pnpm/hexagrid@2.1.1/node_modules/hexagrid/src/utils.ts
function loadDefaults(args, defaults) {
  return Object.assign(defaults, args);
}

// engine/node_modules/.pnpm/hexagrid@2.1.1/node_modules/hexagrid/src/hex.ts
var Hex = class {
  constructor(q = 0, r = 0, data) {
    this.q = q;
    this.r = r;
    this.data = data;
  }
  q;
  r;
  data;
  get s() {
    return 0 - this.q - this.r;
  }
  rotateRight(times = 1, _center) {
    times = (times % 6 + 6) % 6;
    const center = _center ? { q: _center.q, r: _center.r } : { q: 0, r: 0 };
    if (center) {
      [this.q, this.r] = [this.q - center.q, this.r - center.r];
    }
    switch (times) {
      case 0:
        break;
      case 1:
        [this.q, this.r] = [-this.r, -this.s];
        break;
      case 2:
        [this.q, this.r] = [this.s, this.q];
        break;
      case 3:
        [this.q, this.r] = [-this.q, -this.r];
        break;
      case 4:
        [this.q, this.r] = [this.r, this.s];
        break;
      case 5:
        [this.q, this.r] = [-this.s, -this.q];
        break;
      default:
        throw new TypeError("Hex.rotateLeft should have an integer as parameter");
    }
    if (center) {
      [this.q, this.r] = [this.q + center.q, this.r + center.r];
    }
  }
  rotateLeft(times = 1, center) {
    this.rotateRight(-times, center);
  }
  toString() {
    return `${this.q}x${this.r}`;
  }
  toJSON() {
    return {
      q: this.q,
      r: this.r,
      s: this.s,
      data: this.data
    };
  }
  /**
   * Creates an hexagon of radius r around options.center, feeding the data supplied. 
   * 
   * A radius of 0 gives a single hexagon
   * @param radius 
   * @param options 
   */
  static hexagon(radius, options) {
    const { center, data } = loadDefaults(options, { data: [], center: { q: 0, r: 0, s: 0 } });
    const ret = [];
    let totalLength = 0;
    for (let r = radius; r >= 0; r--) {
      ret.push(this.ring(r, { center, data: data.slice(totalLength) }));
      totalLength += ret[ret.length - 1].length;
    }
    return [].concat(...ret);
  }
  /**
   * Creates a ring of radius r around options.center, feeding the data supplied
   * 
   * @param radius 
   * @param options
   */
  static ring(radius, options) {
    const { center, data } = loadDefaults(options, { data: [], center: { q: 0, r: 0, s: 0 } });
    const ret = [];
    const feed = () => ret.length < data.length ? data[ret.length] : void 0;
    for (let [q, r] = [radius, 0]; q >= 0; q--, r++) {
      ret.push(new this(q, r, feed()));
    }
    for (let [q, r] = [-1, radius]; q >= -radius; q--) {
      ret.push(new this(q, r, feed()));
    }
    for (let [q, r] = [-radius, radius - 1]; r >= 0; r--) {
      ret.push(new this(q, r, feed()));
    }
    for (let [q, r] = [-radius + 1, -1]; r >= -radius; r--, q++) {
      ret.push(new this(q, r, feed()));
    }
    for (let [q, r] = [1, -radius]; q <= radius; q++) {
      ret.push(new this(q, r, feed()));
    }
    for (let [q, r] = [radius, -radius + 1]; r < 0; r++) {
      ret.push(new this(q, r, feed()));
    }
    for (let hex of ret) {
      hex.q += center.q;
      hex.r += center.r;
    }
    return ret;
  }
  /**
   * Creates a child class that extends Hex, and initializes by default
   * with data = `defaultData`
   * 
   * @param defaultData 
   */
  static extend(defaultData) {
    return class ExtendedHex extends this {
      constructor(q, r, data) {
        if (typeof defaultData === "object") {
          super(q, r, Object.assign({}, defaultData, data));
        } else {
          super(q, r, data === void 0 ? defaultData : data);
        }
      }
    };
  }
};

// engine/node_modules/.pnpm/hexagrid@2.1.1/node_modules/hexagrid/src/direction.ts
var Direction = /* @__PURE__ */ ((Direction2) => {
  Direction2[Direction2["North"] = 1] = "North";
  Direction2[Direction2["NorthEast"] = 2] = "NorthEast";
  Direction2[Direction2["SouthEast"] = 4] = "SouthEast";
  Direction2[Direction2["South"] = 8] = "South";
  Direction2[Direction2["SouthWest"] = 16] = "SouthWest";
  Direction2[Direction2["NorthWest"] = 32] = "NorthWest";
  return Direction2;
})(Direction || {});
((Direction2) => {
  function list() {
    return [
      1 /* North */,
      2 /* NorthEast */,
      4 /* SouthEast */,
      8 /* South */,
      16 /* SouthWest */,
      32 /* NorthWest */
    ];
  }
  Direction2.list = list;
  Direction2.all = 1 /* North */ | 2 /* NorthEast */ | 4 /* SouthEast */ | 8 /* South */ | 16 /* SouthWest */ | 32 /* NorthWest */;
})(Direction || (Direction = {}));

// engine/node_modules/.pnpm/hexagrid@2.1.1/node_modules/hexagrid/src/cubecoordinates.ts
var CubeCoordinates = class {
  constructor(q = 0, r = 0) {
    this.q = q;
    this.r = r;
    this.s = -q - r;
  }
  q;
  r;
  s;
};
((CubeCoordinates5) => {
  function translated(coord, direction2, n = 1) {
    const { q, r } = coord;
    const s = -q - r;
    switch (direction2) {
      // +, 0
      case 1 /* North */:
        return { r, q: q + n, s: s - n };
      // 0, +
      case 2 /* NorthEast */:
        return { r: r + n, q, s: s - n };
      // -, +
      case 4 /* SouthEast */:
        return { r: r + n, q: q - n, s };
      // -, 0
      case 8 /* South */:
        return { r, q: q - n, s: s + n };
      // 0, -
      case 16 /* SouthWest */:
        return { r: r - n, q, s: s + n };
      // +, -
      case 32 /* NorthWest */:
        return { r: r - n, q: q + n, s };
      default:
        throw new TypeError("Wrong direction: " + direction2);
    }
  }
  CubeCoordinates5.translated = translated;
  function direction(coord1, coord2) {
    if (coord1.q < coord2.q) {
      return coord1.r > coord2.r ? 32 /* NorthWest */ : 1 /* North */;
    } else if (coord1.q > coord2.q) {
      return coord1.r < coord2.r ? 4 /* SouthEast */ : 8 /* South */;
    } else {
      return coord1.r < coord2.r ? 2 /* NorthEast */ : 16 /* SouthWest */;
    }
  }
  CubeCoordinates5.direction = direction;
  function parse(str) {
    const spl = str.split("x");
    const q = +spl[0];
    const r = +spl[1];
    const s = -q - r;
    return { q, r, s };
  }
  CubeCoordinates5.parse = parse;
  function distance(coord1, coord2) {
    return (Math.abs(coord1.q - coord2.q) + Math.abs(coord1.r - coord2.r) + Math.abs(coord1.s - coord2.s)) / 2;
  }
  CubeCoordinates5.distance = distance;
  function toString(coord) {
    if (arguments.length === 0) {
      return "CubeCoordinates";
    }
    if (!coord) {
      return "undefined";
    }
    return `${coord.q}x${coord.r}`;
  }
  CubeCoordinates5.toString = toString;
})(CubeCoordinates || (CubeCoordinates = {}));

// engine/node_modules/.pnpm/hexagrid@2.1.1/node_modules/hexagrid/src/grid.ts
var Grid = class {
  hexes = /* @__PURE__ */ new Map();
  get size() {
    return this.hexes.size;
  }
  constructor(...hexes) {
    this.push(...hexes);
  }
  /**
   * Merge other grids into the current grid
   *
   * If any hex in the new grids overlap with hexes in the current grid,
   * the older hexes are overwritten, similarly to what happens with `Object.assign`.
   * @param grids grids to merge into the current grid
   */
  merge(...grids) {
    const [thisHexes, ...otherHexes] = [this, ...grids].map((grid) => Array.from(grid.values()));
    this.hexes.clear();
    this.push(...thisHexes.concat(...otherHexes));
    return this;
  }
  /**
   * Adds a bunch of hexes to the grid
   * @param hexes
   */
  push(...hexes) {
    for (const hex of hexes) {
      this.hexes.set(`${hex.q}x${hex.r}`, hex);
    }
  }
  get(coord) {
    return this.hexes.get(`${coord.q}x${coord.r}`);
  }
  neighbour(coord, direction) {
    return this.get(CubeCoordinates.translated(coord, direction));
  }
  neighbours(center, directions = Direction.all) {
    const ret = [];
    for (const direction of Direction.list()) {
      if (direction & directions) {
        const hex = this.get(CubeCoordinates.translated(center, direction));
        if (hex) {
          ret.push(hex);
        }
      }
    }
    return ret;
  }
  /**
   * Get the list of hexes forming the shortest path between two hexes (included)
   *
   * Using A*
   *
   */
  path(coord1, coord2) {
    const hex1 = this.get(coord1);
    const hex2 = this.get(coord2);
    if (!hex1 || !hex2) {
      return void 0;
    }
    const destCoord = hex2.toString();
    const allPaths = {};
    const toExpand = {};
    let toExpandNext = [];
    const addPath = (path) => {
      const [last] = path.slice(-1);
      const minDist = CubeCoordinates.distance(last, hex2);
      toExpand[minDist] = toExpand[minDist] || {};
      toExpand[minDist][last.toString()] = path;
      allPaths[last.toString()] = path;
    };
    const readyNextIteration = () => {
      let minDistance = Number.POSITIVE_INFINITY;
      for (const key2 of Object.keys(toExpand)) {
        if (+key2 < minDistance) {
          minDistance = +key2;
        }
      }
      if (minDistance < Number.POSITIVE_INFINITY) {
        toExpandNext = Object.values(toExpand[minDistance]);
        delete toExpand[minDistance];
      } else {
        toExpandNext = [];
      }
    };
    addPath([hex1]);
    readyNextIteration();
    while (!(destCoord in allPaths) && toExpandNext.length > 0) {
      for (const path of toExpandNext) {
        const hex = path[path.length - 1];
        for (const neighbour of this.neighbours(hex)) {
          if (allPaths[neighbour.toString()]) {
            continue;
          }
          addPath([...path, neighbour]);
        }
      }
      readyNextIteration();
    }
    return allPaths[destCoord];
  }
  /**
   * Shortest path between two coordinates, stopping when obstacle
   * @param hex1
   * @param hex2
   */
  easyPath(coord1, coord2) {
    const hex1 = this.get(coord1);
    const hex2 = this.get(coord2);
    if (!hex1 || !hex2) {
      return void 0;
    }
    const path = [hex1];
    let currentHex = hex1;
    while (currentHex.q !== hex2.q || currentHex.r !== hex2.r) {
      currentHex = this.neighbour(currentHex, CubeCoordinates.direction(currentHex, hex2));
      if (!currentHex) {
        return void 0;
      }
      path.push(currentHex);
    }
    return path;
  }
  /**
   * Distance between two hexes. -1 if not possible
   *
   */
  distance(hex1, hex2) {
    const path = this.path(hex1, hex2);
    return (path || []).length - 1;
  }
  /**
   * Removes a hex by its coordinates. Returns whether there
   * was a hex removed
   *
   * @param q
   * @param r
   */
  remove({ q, r }) {
    return this.hexes.delete(`${q}x${r}`);
  }
  /**
   * Rotates the whole grid X times to the left, relative to center.
   *
   * Each rotation is 60°
   *
   * @param times
   * @param center The origin if not given
   */
  rotateLeft(times = 1, center) {
    this.hexes.forEach((hex) => hex.rotateLeft(times, center));
    this.recalibrate();
    return this;
  }
  /**
   * Rotates the whole grid X times to the right, relative to center.
   *
   * Each rotation is 60°
   *
   * @param times
   * @param center The origin if not given
   */
  rotateRight(times = 1, center) {
    this.hexes.forEach((hex) => hex.rotateRight(times, center));
    this.recalibrate();
    return this;
  }
  /**
   * Separate the hexes given into groups.
   *
   * Each hex in a group can travel through to other
   * members of its group by going through only members
   * of its group.
   *
   * @param hexes
   */
  groups(hexes) {
    const hexSet = new Set(hexes);
    const groups = [];
    for (const hex of hexes) {
      if ((() => {
        for (const group of groups) {
          if (group.has(hex)) {
            return true;
          }
        }
      })()) {
        continue;
      }
      const newGroup = /* @__PURE__ */ new Set([hex]);
      let toExplore = /* @__PURE__ */ new Set([hex]);
      let nextToExplore = /* @__PURE__ */ new Set();
      groups.push(newGroup);
      while (toExplore.size > 0) {
        for (const hex2 of toExplore) {
          for (const nb of this.neighbours(hex2)) {
            if (newGroup.has(nb)) {
              continue;
            }
            if (!hexSet.has(nb)) {
              continue;
            }
            newGroup.add(nb);
            nextToExplore.add(nb);
          }
        }
        toExplore = nextToExplore;
        nextToExplore = /* @__PURE__ */ new Set();
      }
    }
    return groups;
  }
  /**
   * Makes sure the underlying storage of Hexes is coherent, if
   * any of their coordinates was changed since they were added
   */
  recalibrate() {
    const array = Array.from(this.values());
    this.hexes.clear();
    this.push(...array);
    return this;
  }
  values() {
    return this.hexes.values();
  }
  toJSON() {
    return Array.from(this.values());
  }
};

// engine/src/map.ts
var import_lodash4 = __toESM(require_lodash2());
var import_seedrandom2 = __toESM(require_seedrandom2());
var import_shuffle_seed3 = __toESM(require_shuffle_seed2());

// engine/src/gaia-hex.ts
import assert4 from "node:assert";

// engine/src/lost-fleet-map.ts
var import_lodash3 = __toESM(require_lodash2());
var SECTOR_RADIUS = 2;
var SHIFTED_OFFSET = { q: 5, r: -1, s: -4 };
var CUBE_DIRECTIONS = [
  { q: 1, r: 0, s: -1 },
  { q: 0, r: 1, s: -1 },
  { q: -1, r: 1, s: 0 },
  { q: -1, r: 0, s: 1 },
  { q: 0, r: -1, s: 1 },
  { q: 1, r: -1, s: 0 }
];
function key(c) {
  return `${c.q}x${c.r}`;
}
function add(a, b) {
  return { q: a.q + b.q, r: a.r + b.r, s: a.s + b.s };
}
function neighbours(c) {
  return CUBE_DIRECTIONS.map((d) => add(c, d));
}
function shiftedOffset(times) {
  const hex = new Hex(SHIFTED_OFFSET.q, SHIFTED_OFFSET.r);
  hex.rotateRight(times);
  return { q: hex.q, r: hex.r, s: hex.s };
}
function sectorHexes(center) {
  return Hex.hexagon(SECTOR_RADIUS, { center }).map((h) => ({ q: h.q, r: h.r, s: h.s }));
}
var ORIGIN = { q: 0, r: 0, s: 0 };
function lostFleetSectorCenters(nbPlayers) {
  if (nbPlayers <= 2) {
    return [ORIGIN, ...[0, 1, 2, 3, 4, 5].map((i) => shiftedOffset(i))];
  }
  if (nbPlayers === 3) {
    const ring = [0, 1, 2, 3, 4, 5].map((i) => shiftedOffset(i));
    const extra1 = add(shiftedOffset(0), shiftedOffset(1));
    const extra2 = add(shiftedOffset(1), shiftedOffset(2));
    return [ORIGIN, ...ring, extra1, extra2];
  }
  const hubA = ORIGIN;
  const hubB = add(hubA, shiftedOffset(0));
  return [
    hubA,
    hubB,
    add(hubA, shiftedOffset(2)),
    add(hubA, shiftedOffset(3)),
    add(hubA, shiftedOffset(4)),
    add(hubB, shiftedOffset(5)),
    add(hubB, shiftedOffset(0)),
    add(hubB, shiftedOffset(1)),
    add(hubA, shiftedOffset(1)),
    add(hubB, shiftedOffset(4))
  ];
}
function buildHalo(centers) {
  const occupied = /* @__PURE__ */ new Set();
  for (const c of centers) for (const h of sectorHexes(c)) occupied.add(key(h));
  const touch = /* @__PURE__ */ new Map();
  const cells = /* @__PURE__ */ new Map();
  centers.forEach((c, idx) => {
    for (const h of sectorHexes(c)) {
      for (const n of neighbours(h)) {
        const k = key(n);
        if (occupied.has(k)) continue;
        if (!touch.has(k)) {
          touch.set(k, /* @__PURE__ */ new Set());
          cells.set(k, n);
        }
        touch.get(k).add(idx);
      }
    }
  });
  return { touch, cells };
}
function components(cellKeys, cells) {
  const seen = /* @__PURE__ */ new Set();
  const comps = [];
  for (const start of cellKeys) {
    if (seen.has(start)) continue;
    const stack = [start];
    seen.add(start);
    const comp = [];
    while (stack.length) {
      const ck = stack.pop();
      comp.push(ck);
      for (const n of neighbours(cells.get(ck))) {
        const nk = key(n);
        if (cellKeys.has(nk) && !seen.has(nk)) {
          seen.add(nk);
          stack.push(nk);
        }
      }
    }
    comps.push(comp);
  }
  comps.sort((a, b) => b.length - a.length);
  return comps;
}
function findInterspaceHoles(centers) {
  const { touch, cells } = buildHalo(centers);
  const haloKeys = new Set(touch.keys());
  const comps = components(haloKeys, cells);
  const interior = comps.slice(1);
  return interior.filter((c) => c.length === 1).map((c) => cells.get(c[0]));
}
function findDeepSpaceNotches(centers) {
  const { touch, cells } = buildHalo(centers);
  const haloKeys = new Set(touch.keys());
  const comps = components(haloKeys, cells);
  const outer = new Set(comps[0]);
  const seeds = [...outer].filter((k) => touch.get(k).size >= 2);
  return seeds.map((seedKey) => {
    const seed = cells.get(seedKey);
    const outerNeighbours = neighbours(seed).filter((n) => outer.has(key(n)));
    for (let i = 0; i < outerNeighbours.length; i++) {
      for (let j = i + 1; j < outerNeighbours.length; j++) {
        if (neighbours(outerNeighbours[i]).some((n) => key(n) === key(outerNeighbours[j]))) {
          return [seed, outerNeighbours[i], outerNeighbours[j]];
        }
      }
    }
    return [seed];
  });
}
function findAdjacentNotchPairs(centers) {
  const notches = findDeepSpaceNotches(centers);
  const pairs = [];
  for (let i = 0; i < notches.length; i++) {
    for (let j = i + 1; j < notches.length; j++) {
      const adjacent = notches[i].some((a) => notches[j].some((b) => neighbours(a).some((n) => key(n) === key(b))));
      if (adjacent) {
        pairs.push([i, j]);
      }
    }
  }
  return pairs;
}
function classifySectorId(sector) {
  if (sector.startsWith("IS")) {
    return "interspace" /* Interspace */;
  }
  if (sector.startsWith("DS")) {
    return "deepSpace" /* DeepSpace */;
  }
  return "space" /* Space */;
}
function lostFleetSectorKey(hex) {
  const type = classifySectorId(hex.data.sector);
  if (type === "interspace" /* Interspace */) {
    return void 0;
  }
  return type === "deepSpace" /* DeepSpace */ ? hex.data.sector.replace(/_\d+$/, "") : hex.data.sector;
}
function isNewLostFleetSector(occupied, hex) {
  const key2 = lostFleetSectorKey(hex);
  if (key2 === void 0) {
    return false;
  }
  return !occupied.some((other) => other !== hex && other.hasPlanet() && lostFleetSectorKey(other) === key2);
}
function colonizedDeepSpaceSectorCount(hexes) {
  return (0, import_lodash3.uniq)(
    hexes.filter((hex) => classifySectorId(hex.data.sector) === "deepSpace" /* DeepSpace */).map((hex) => lostFleetSectorKey(hex))
  ).length;
}
var P = "p" /* Protoplanet */;
var A = "a" /* Asteroid */;
var M = "m" /* Transdim */;
var B = "e" /* Empty */;
var DEEP_SPACE_TILES = [
  { id: 11, a: [P, A, B], b: [A, B, B] },
  { id: 12, a: [M, P, B], b: [A, B, B] },
  { id: 13, a: [M, B, A], b: [B, B, A] },
  { id: 14, a: [P, B, A], b: [B, B, A] },
  { id: 15, a: [P, B, B], b: [P, B, A] },
  { id: 16, a: [B, B, P], b: [A, B, A] },
  { id: 17, a: [M, B, B], b: [B, A, B] },
  { id: 18, a: [P, B, B], b: [A, B, B] }
];
var DEEP_SPACE_TILES_2P = [11, 12, 13, 14, 15, 16];
var INTERSPACE_SETS = {
  2: { asteroid: 2, protoplanet: 1, spaceships: 3, excludedShips: ["rebellion" /* Rebellion */], blank: 0, total: 6 },
  3: { asteroid: 2, protoplanet: 1, spaceships: 4, excludedShips: [], blank: 1, total: 8 },
  4: { asteroid: 4, protoplanet: 1, spaceships: 4, excludedShips: [], blank: 1, total: 10 }
};
function interspaceSet(nbPlayers) {
  const set3 = INTERSPACE_SETS[Math.min(Math.max(nbPlayers, 2), 4)];
  return set3;
}

// engine/src/gaia-hex.ts
var GaiaHex = class extends Hex {
  constructor(q, r, data) {
    super(q, r, data);
  }
  hasPlanet() {
    return this.data.planet !== "e" /* Empty */;
  }
  occupied() {
    return this.data.player !== void 0;
  }
  hasSpaceship() {
    return this.data.spaceship !== void 0;
  }
  occupyingPlayers() {
    if (this.data.player === void 0) {
      return [];
    }
    if (this.buildingOf(this.data.player) === "gf" /* GaiaFormer */) {
      return [];
    }
    return [this.data.player, this.data.additionalMine].filter((x) => x !== void 0);
  }
  // Space stations do not count as colonized, gaia-formers do not count as colonized
  colonizedBy(player) {
    const building = this.buildingOf(player);
    return stdBuildingValue(building) > 0 && building !== "customsPost" /* CustomsPost */;
  }
  isMainOccupier(player) {
    return this.colonizedBy(player) && this.data.additionalMine !== player;
  }
  /** Space stations are not structures, so a trading station built near one will still be isolated */
  hasStructure() {
    return this.occupied() && this.data.building !== "gf" /* GaiaFormer */ && this.data.building !== "sp" /* SpaceStation */;
  }
  /**
   * Can the player use this hex as a starting point to create new buildings?
   * @param player
   */
  isRangeStartingPoint(player) {
    return this.colonizedBy(player) || this.buildingOf(player) === "sp" /* SpaceStation */;
  }
  buildingOf(player) {
    if (this.data.additionalMine === player) {
      return "m" /* Mine */;
    }
    if (this.data.player !== player) {
      return void 0;
    }
    return this.data.building;
  }
  get federations() {
    return this.data.federations ?? [];
  }
  belongsToFederationOf(player) {
    return this.federations.includes(player);
  }
  addToFederationOf(player) {
    if (this.belongsToFederationOf(player)) {
      return false;
    }
    if (this.data.federations) {
      this.data.federations.push(player);
    } else {
      this.data.federations = [player];
    }
    return true;
  }
  get customPosts() {
    return this.data.customPosts ?? [];
  }
  get tradeTokens() {
    return this.data.tradeTokens ?? [];
  }
  // Can probably math this better
  get relativeCoordinates() {
    if (this.data.sectorCenter) {
      return { q: this.q - this.data.sectorCenter.q, r: this.r - this.data.sectorCenter.r };
    }
    const horizontal = { q: -3, r: 5 };
    const vertical = { q: 2, r: 3 };
    const diagonal = { q: 5, r: -2 };
    const current = { q: this.q, r: this.r };
    let counter = 0;
    while (counter++ < 10 && magnitude(current.q, current.r) > 2) {
      for (const direction of [horizontal, vertical, diagonal]) {
        while (magnitude(current.q - direction.q, current.r - direction.r) < magnitude(current.q, current.r)) {
          current.q -= direction.q;
          current.r -= direction.r;
        }
        while (magnitude(current.q + direction.q, current.r + direction.r) < magnitude(current.q, current.r)) {
          current.q += direction.q;
          current.r += direction.r;
        }
      }
    }
    return current;
  }
  toString() {
    if (classifySectorId(this.data.sector) !== "space" /* Space */) {
      return this.data.sector;
    }
    const relative = this.relativeCoordinates;
    const suffix = suffixes[`${relative.q}x${relative.r}`];
    assert4(suffix, `Can't find suffix for ${this.q}x${this.r} ${relative.q}x${relative.r}`);
    return [this.data.sector.replace(/[AB]$/, ""), suffixes[`${relative.q}x${relative.r}`]].join("");
  }
};
var suffixes = {
  "2x0": "A0",
  "1x1": "A1",
  "0x2": "A2",
  "-1x2": "A3",
  "-2x2": "A4",
  "-2x1": "A5",
  "-2x0": "A6",
  "-1x-1": "A7",
  "0x-2": "A8",
  "1x-2": "A9",
  "2x-2": "A10",
  "2x-1": "A11",
  "1x0": "B0",
  "0x1": "B1",
  "-1x1": "B2",
  "-1x0": "B3",
  "0x-1": "B4",
  "1x-1": "B5",
  "0x0": "C"
};
var reverseSuffixes = Object.keys(suffixes).reduce((acc, key2) => ({ ...acc, [suffixes[key2]]: key2 }), {});
function magnitude(q, r) {
  return Math.max(Math.abs(q), Math.abs(r), Math.abs(-q - r));
}

// engine/src/lost-fleet-board.ts
var import_seedrandom = __toESM(require_seedrandom2());
var import_shuffle_seed2 = __toESM(require_shuffle_seed2());

// engine/src/sector.ts
var Sector = class {
  /**
   * Generates a new sector
   *
   * @param definition The contents of the sector
   * @param id The id of the sector
   */
  static create(definition, name, center = { q: 0, r: 0, s: 0 }) {
    if (typeof definition === "string") {
      definition = definition.split("");
    }
    const planetArray = [].concat(...definition);
    const dataArray = planetArray.map((planet) => ({ planet, sector: name, sectorCenter: center }));
    const grid = new Grid(...GaiaHex.hexagon(2, { center, data: dataArray }));
    return grid;
  }
};

// engine/src/lost-fleet-board.ts
function lostFleetSectorTiles(nbPlayers) {
  if (nbPlayers <= 2) {
    return [s1, s2, s3, s4, s5b, s6b, s7b];
  }
  if (nbPlayers === 3) {
    return [s1, s2, s3, s4, s5b, s6b, s7b, s9, s10];
  }
  return [s1, s2, s3, s4, s5, s6, s7, s8, s9, s10];
}
var CENTER_ELIGIBLE_SECTOR_NAMES = ["1", "2", "3", "4"];
function officialCenterTileOrder(nbPlayers, rng) {
  const allTiles = lostFleetSectorTiles(nbPlayers);
  const centerPool = allTiles.filter((t) => CENTER_ELIGIBLE_SECTOR_NAMES.includes(t.name));
  const rest = allTiles.filter((t) => !CENTER_ELIGIBLE_SECTOR_NAMES.includes(t.name));
  const numCenters = nbPlayers === 4 ? 2 : 1;
  const shuffledCenterPool = import_shuffle_seed2.default.shuffle(centerPool, rng());
  const chosenCenters = shuffledCenterPool.slice(0, numCenters);
  const leftoverCenterPoolTiles = shuffledCenterPool.slice(numCenters);
  const outerTiles = import_shuffle_seed2.default.shuffle([...rest, ...leftoverCenterPoolTiles], rng());
  return [...chosenCenters, ...outerTiles];
}
function generateSectorGrid(nbPlayers, rng, officialCenterSectors = false) {
  const centers = lostFleetSectorCenters(nbPlayers);
  const tiles = officialCenterSectors ? officialCenterTileOrder(nbPlayers, rng) : import_shuffle_seed2.default.shuffle(lostFleetSectorTiles(nbPlayers), rng());
  const sectors2 = [];
  const grids = tiles.map((tile, i) => {
    const rotation = Math.floor(rng() * 6);
    const center = centers[i];
    sectors2.push({ sector: tile.name, rotation, center });
    return Sector.create(tile.map, tile.name, center).rotateRight(rotation, center);
  });
  const [first, ...rest] = grids;
  return { grid: first.merge(...rest), sectors: sectors2 };
}
function interspaceTags(nbPlayers, rng) {
  const set3 = interspaceSet(nbPlayers);
  const ships = import_shuffle_seed2.default.shuffle(shipsInPlay(4 /* LostFleet */, nbPlayers), rng());
  const tags = [
    ...ships.map((spaceship) => ({ planet: "e" /* Empty */, spaceship })),
    ...Array(set3.asteroid).fill({ planet: "a" /* Asteroid */ }),
    ...Array(set3.protoplanet).fill({ planet: "p" /* Protoplanet */ }),
    ...Array(set3.blank).fill({ planet: "e" /* Empty */ })
  ];
  return tags;
}
var MIN_SPACESHIP_DISTANCE = 4;
function dist(a, b) {
  return (Math.abs(a.q - b.q) + Math.abs(a.r - b.r) + Math.abs(a.s - b.s)) / 2;
}
function pickSpaceshipHoles(holes, count, rng) {
  const indices = holes.map((_, i) => i);
  const maxAttempts = 1e3;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const candidate = import_shuffle_seed2.default.shuffle(indices, rng() + attempt).slice(0, count);
    let valid = true;
    for (let i = 0; i < candidate.length && valid; i++) {
      for (let j = i + 1; j < candidate.length; j++) {
        if (dist(holes[candidate[i]], holes[candidate[j]]) < MIN_SPACESHIP_DISTANCE) {
          valid = false;
          break;
        }
      }
    }
    if (valid) {
      return candidate;
    }
  }
  throw new Error("Could not find a valid spaceship tile arrangement satisfying the spacing rule");
}
function placeInterspaceTiles(grid, nbPlayers, rng) {
  const centers = lostFleetSectorCenters(nbPlayers);
  const holes = findInterspaceHoles(centers);
  const tags = interspaceTags(nbPlayers, rng);
  const spaceshipTags = tags.filter((t) => t.spaceship !== void 0);
  const otherTags = import_shuffle_seed2.default.shuffle(
    tags.filter((t) => t.spaceship === void 0),
    rng()
  );
  const spaceshipHoleIndices = new Set(pickSpaceshipHoles(holes, spaceshipTags.length, rng));
  const shuffledSpaceshipTags = import_shuffle_seed2.default.shuffle(spaceshipTags, rng());
  let spaceshipCursor = 0;
  let otherCursor = 0;
  holes.forEach((hole, i) => {
    const tag = spaceshipHoleIndices.has(i) ? shuffledSpaceshipTags[spaceshipCursor++] : otherTags[otherCursor++];
    grid.push(new GaiaHex(hole.q, hole.r, { planet: tag.planet, sector: `IS${i}`, spaceship: tag.spaceship }));
  });
}
function placeDeepSpaceTiles(grid, nbPlayers, rng) {
  const centers = lostFleetSectorCenters(nbPlayers);
  const notches = findDeepSpaceNotches(centers);
  const tilePool = nbPlayers <= 2 ? DEEP_SPACE_TILES.filter((t) => DEEP_SPACE_TILES_2P.includes(t.id)) : DEEP_SPACE_TILES;
  const tiles = import_shuffle_seed2.default.shuffle(tilePool, rng());
  notches.forEach((notch, i) => {
    const tile = tiles[i];
    const side = rng() < 0.5 ? "a" : "b";
    const face = tile[side];
    notch.forEach((cell, j) => {
      grid.push(new GaiaHex(cell.q, cell.r, { planet: face[j], sector: `DS${tile.id}_${j}` }));
    });
  });
}
function isValidBoard(grid) {
  for (const hex of grid.values()) {
    for (const neighbour of grid.neighbours(hex)) {
      if (hex.data.planet !== "m" /* Transdim */ && hex.data.planet !== "e" /* Empty */ && hex.data.planet !== "g" /* Gaia */ && hex.data.planet === neighbour.data.planet) {
        return false;
      }
    }
  }
  return true;
}
var MAX_LAYOUT_ATTEMPTS = 50;
function generateLostFleetBoard(nbPlayers, seed, officialCenterSectors = false) {
  for (let attempt = 0; attempt < MAX_LAYOUT_ATTEMPTS; attempt++) {
    const rng = (0, import_seedrandom.default)(attempt === 0 ? seed : `${seed}-retry${attempt}`);
    const { grid, sectors: sectors2 } = generateSectorGrid(nbPlayers, rng, officialCenterSectors);
    placeInterspaceTiles(grid, nbPlayers, rng);
    placeDeepSpaceTiles(grid, nbPlayers, rng);
    if (isValidBoard(grid)) {
      return { grid, adjacentNotchPairs: findAdjacentNotchPairs(lostFleetSectorCenters(nbPlayers)), sectors: sectors2 };
    }
  }
  throw new Error(
    `Could not find a valid Lost Fleet board layout for seed "${seed}" after ${MAX_LAYOUT_ATTEMPTS} attempts`
  );
}

// engine/src/map.ts
var s1 = { name: "1", map: "eeemevoeedee,ereees,e".replace(/,/g, "") };
var s2 = { name: "2", map: "teedemeoeeev,eieese,e".replace(/,/g, "") };
var s3 = { name: "3", map: "meeteedreeee,eeieeg,e".replace(/,/g, "") };
var s4 = { name: "4", map: "teeereeeeiee,oeseve,e".replace(/,/g, "") };
var s5 = { name: "5A", map: "iemoeedveeee,eeeeeg,e".replace(/,/g, "") };
var s5b = { name: "5B", map: "iemoeeeveeee,eeeeeg,e".replace(/,/g, "") };
var s6 = { name: "6A", map: "emeedmeeeeee,ereges,e".replace(/,/g, "") };
var s6b = { name: "6B", map: "emeedmeeeeee,eregee,e".replace(/,/g, "") };
var s7 = { name: "7A", map: "eseeeeteeeme,oegege,e".replace(/,/g, "") };
var s7b = { name: "7B", map: "eeeeeeteeeme,gesege,e".replace(/,/g, "") };
var s8 = { name: "8", map: "remeeeemeeee,ieteve,e".replace(/,/g, "") };
var s9 = { name: "9", map: "emieeeeeseev,eegete,e".replace(/,/g, "") };
var s10 = { name: "10", map: "emmeeeeoreee,eegeed,e".replace(/,/g, "") };
var sectors = (0, import_lodash4.keyBy)([s1, s2, s3, s4, s5, s5b, s6, s6b, s7, s7b, s8, s9, s10], "name");
var reverseSide = (side) => {
  return side[0] + side.slice(1, 12).split("").reverse().join("") + side[12] + side.slice(13, 18).split("").reverse().join("") + side[18];
};
var rSectors = (0, import_lodash4.keyBy)(
  [s1, s2, s3, s4, s5, s5b, s6, s6b, s7, s7b, s8, s9, s10].map((s) => ({ name: s.name, map: reverseSide(s.map) })),
  "name"
);
var smallCenters = ["5x-2", "2x3", "3x-5", "0x0", "-3x5", "-2x-3", "-5x2"].map(
  (coord) => CubeCoordinates.parse(coord)
);
var bigCenters = ["5x-2", "2x3", "-1x8", "3x-5", "0x0", "-3x5", "-6x10", "-2x-3", "-5x2", "-8x7"].map(
  (coord) => CubeCoordinates.parse(coord)
);
var smallConfiguration = {
  sectors: [s1, s2, s3, s4, s5b, s6b, s7b],
  nbSectors: 7,
  centers: [{ q: 0, r: 0, s: 0 }]
};
var bigConfiguration = {
  sectors: [s1, s2, s3, s4, s5, s6, s7, s8, s9, s10],
  nbSectors: 10,
  centers: [{ q: 0, r: 0, s: 0 }]
};
var xConfiguration = {
  sectors: [s1, s2, s3, s4, s5, s6, s7, s8],
  nbSectors: 8,
  centers: [{ q: 0, r: 0, s: 0 }]
};
for (let i = 0; i < 6; i++) {
  const hex = new Hex(5, -2);
  hex.rotateRight(i);
  smallConfiguration.centers.push(hex.toJSON());
  bigConfiguration.centers.push(hex.toJSON());
  xConfiguration.centers.push(hex.toJSON());
}
function lostFleetConfiguration(nbPlayers) {
  return {
    sectors: [],
    nbSectors: lostFleetSectorCenters(nbPlayers).length,
    centers: lostFleetSectorCenters(nbPlayers)
  };
}
xConfiguration.centers.splice(xConfiguration.centers.length - 1);
for (let i = -1; i <= 1; i++) {
  const hex = new Hex(-6, 10);
  hex.rotateRight(i, { q: -3, r: 5, s: -2 });
  bigConfiguration.centers.push(hex);
  if (i !== 0) {
    xConfiguration.centers.push(hex);
  }
}
function parseLocation(coords) {
  const match = /^([0-9]{1,2})([ABC][0-9]{0,2})$/.exec(coords);
  assert5(match, "Malformed coordinate: " + coords);
  const [_, sector, suffix] = match;
  return { sector, suffix };
}
var SpaceMap = class _SpaceMap {
  constructor(nbPlayers, seed, mirror, layout = "standard", lostFleet = false, officialCenterSectors = false) {
    // hexagrid
    this.distanceCache = {};
    if (nbPlayers === void 0) {
      return;
    }
    this.nbPlayers = nbPlayers;
    this.rng = (0, import_seedrandom2.default)(seed);
    this.seed = seed;
    this.layout = layout;
    this.lostFleet = lostFleet;
    if (lostFleet) {
      const board = generateLostFleetBoard(nbPlayers, seed, officialCenterSectors);
      this.grid = board.grid;
      this.placement = { sectors: board.sectors, mirror: false };
      return;
    }
    const germanRules = ![
      "Gianluigi-Buffon",
      "randomSeed",
      "12",
      "9876",
      "yellow-paint-8951",
      "green-jeans-8458",
      "Fastgame01"
    ].includes(seed);
    do {
      this.generate(this.randomTiles(), () => Math.floor(this.rng() * 6), mirror);
    } while (!this.isValid(germanRules));
  }
  load(conf) {
    const centers = conf.sectors.length === 7 ? smallCenters : bigCenters;
    const oldGen = [
      "Gianluigi-Buffon",
      "randomSeed",
      "12",
      "9876",
      "yellow-paint-8951",
      "green-jeans-8458",
      "Fastgame01",
      "zadbd",
      "bosco-marcuzzo3",
      "Alex-Del-Pieroooooo",
      "SGAMBATA",
      "djfjjv4k",
      "randomSeed2",
      "randomseed",
      "polite-food-8474",
      "green-jeans-8458",
      "waiting-fabs-1",
      "curious-stay-2150",
      "Three",
      "GaiaRocks",
      "SalmurOnTheBoard"
    ].includes(this.seed);
    const [hexagon, ...hexagons] = conf.sectors.map((val, i) => {
      const def = (conf.mirror || oldGen ? rSectors : sectors)[val.sector].map;
      if (!val.center) {
        val.center = centers[i];
      }
      const center = val.center;
      return Sector.create(def, val.sector, center).rotateRight(val.rotation, center);
    });
    this.grid = hexagon ? hexagon.merge(...hexagons) : new Grid();
    this.placement = conf;
  }
  /**
   *  Check if the map is correct (no two HOME planets of the same color side by side - following german rules)
   */
  isValid(germanRules = true) {
    for (const hex of this.grid.values()) {
      for (const nb of this.grid.neighbours(hex)) {
        if (germanRules) {
          if (hex.data.planet !== "m" /* Transdim */ && hex.data.planet !== "e" /* Empty */ && hex.data.planet !== "g" /* Gaia */ && hex.data.planet === nb.data.planet) {
            return false;
          }
        } else {
          if (hex.data.sector !== nb.data.sector && hex.data.planet !== "e" /* Empty */ && hex.data.planet === nb.data.planet) {
            return false;
          }
        }
      }
    }
    return true;
  }
  /**
   * Generate the map
   */
  generate(tiles, rotation, mirror = false) {
    const centers = this.configuration().centers;
    this.placement = {
      sectors: tiles.map((side, i) => ({
        sector: side.name,
        rotation: rotation(),
        center: centers[i]
      })),
      mirror
    };
    this.load(this.placement);
  }
  rotateSector(center, times) {
    const coords = this.parse(center);
    assert5(
      this.configuration().centers.some((pt) => pt.q === coords.q && pt.r === coords.r),
      `${center} is not the center of a sector`
    );
    const sectorHexes2 = Hex.hexagon(2, { center: coords });
    for (const hex of sectorHexes2) {
      this.grid.get(hex).rotateRight(times, coords);
    }
  }
  randomTiles() {
    const definitions = this.configuration().sectors;
    return import_shuffle_seed3.default.shuffle(definitions, this.rng()).slice(0, this.configuration().nbSectors);
  }
  toJSON() {
    return Array.from(this.grid.values());
  }
  static fromData(data) {
    const map = new _SpaceMap();
    map.grid = new Grid(...data.map((hex) => new GaiaHex(hex.q, hex.r, hex.data)));
    return map;
  }
  configuration() {
    if (this.lostFleet) {
      return lostFleetConfiguration(this.nbPlayers);
    }
    if (this.layout === "xshape") {
      return xConfiguration;
    }
    return _SpaceMap.configuration(this.nbPlayers);
  }
  distance(hex1, hex2) {
    return CubeCoordinates.distance(hex1, hex2);
  }
  withinDistance(center, distance) {
    const group = GaiaHex.hexagon(distance, { center });
    const ret = [];
    for (const hex of group) {
      if (this.grid.get(hex)) {
        ret.push(this.grid.get(hex));
      }
    }
    return ret;
  }
  excludedHexesForBuildingFederation(player, faction) {
    const ret = /* @__PURE__ */ new Set();
    for (const hex of this.grid.values()) {
      if (hex.hasSpaceship()) {
        ret.add(hex);
        continue;
      }
      if (hex.data.planet !== "e" /* Empty */ && !hex.colonizedBy(player)) {
        ret.add(hex);
        continue;
      }
      if (faction !== "ivits" /* Ivits */ && hex.belongsToFederationOf(player)) {
        ret.add(hex);
        for (const neighbour of this.grid.neighbours(hex)) {
          ret.add(neighbour);
        }
      }
    }
    return ret;
  }
  recalibrate() {
    this.grid.recalibrate();
  }
  static configuration(nbPlayers) {
    if (nbPlayers <= 2) {
      return smallConfiguration;
    } else {
      return bigConfiguration;
    }
  }
  parse(coords) {
    if (coords.includes("x")) {
      return CubeCoordinates.parse(coords);
    }
    if (classifySectorId(coords) !== "space" /* Space */) {
      const hex = [...this.grid.values()].find((h) => h.toString() === coords);
      assert5(hex, `Can't find hex for Lost Fleet coordinate ${coords}`);
      return { q: hex.q, r: hex.r, s: hex.s };
    }
    assert5(this.placement, "Needs sector info to parse sector coordinates");
    const { sector, suffix } = parseLocation(coords);
    const relative = CubeCoordinates.parse(reverseSuffixes[suffix]);
    let center = this.placement.sectors.find((conf) => conf.sector.replace(/[AB]/, "") === sector).center;
    if (!center) {
      const index = this.placement.sectors.findIndex((conf) => conf.sector.replace(/[AB]/, "") === sector);
      center = (this.placement.sectors.length === 7 ? smallCenters : bigCenters)[index];
    }
    return {
      q: center.q + relative.q,
      r: center.r + relative.r,
      s: center.s + relative.s
    };
  }
  getS(coords) {
    return this.grid.get(this.parse(coords));
  }
};

// engine/src/player.ts
var import_eventemitter3 = __toESM(require_eventemitter3());
import assert9 from "node:assert";
var import_lodash13 = __toESM(require_lodash2());

// engine/src/algorithms/spanning-tree.ts
var import_lodash7 = __toESM(require_lodash2());
import assert6 from "node:assert";

// engine/src/algorithms/minimum-path-length.ts
var import_lodash5 = __toESM(require_lodash2());
function minimumPathLength(groups) {
  if (groups.length === 1) {
    return 0;
  }
  const shortestPaths = /* @__PURE__ */ new Map();
  for (const group of groups) {
    shortestPaths.set(group, /* @__PURE__ */ new Map());
  }
  for (let i = 0; i < groups.length; i++) {
    for (let j = i + 1; j < groups.length; j++) {
      const [group1, group2] = [groups[i], groups[j]];
      const shortest = Math.min(...(0, import_lodash5.flatten)(group1.map((x) => group2.map((y) => CubeCoordinates.distance(x, y))))) - 1;
      shortestPaths.get(group1).set(group2, shortest);
    }
  }
  let modified;
  do {
    modified = false;
    for (let i = 0; i < groups.length; i++) {
      for (let j = i + 1; j < groups.length; j++) {
        for (let k = j + 1; k < groups.length; k++) {
          const [group1, group2, group3] = [groups[i], groups[j], groups[k]];
          if (shortestPaths.get(group1).get(group2) + shortestPaths.get(group2).get(group3) < shortestPaths.get(group1).get(group3)) {
            shortestPaths.get(group1).set(group3, shortestPaths.get(group1).get(group2) + shortestPaths.get(group2).get(group3));
            modified = true;
          }
          if (shortestPaths.get(group1).get(group2) + shortestPaths.get(group1).get(group3) < shortestPaths.get(group2).get(group3)) {
            shortestPaths.get(group2).set(group3, shortestPaths.get(group1).get(group2) + shortestPaths.get(group1).get(group3));
            modified = true;
          }
          if (shortestPaths.get(group1).get(group3) + shortestPaths.get(group2).get(group3) < shortestPaths.get(group1).get(group2)) {
            shortestPaths.get(group1).set(group2, shortestPaths.get(group1).get(group3) + shortestPaths.get(group2).get(group3));
            modified = true;
          }
        }
      }
    }
  } while (modified);
  return Math.max(...(0, import_lodash5.flatten)([...shortestPaths.values()].map((v) => [...v.values()])));
}

// engine/src/algorithms/shortest-path.ts
var import_lodash6 = __toESM(require_lodash2());
function shortestPath(starts, dests, grid, costOf = (hex) => 1) {
  const destSet = new Set(dests);
  const pathTo = /* @__PURE__ */ new Map();
  for (const start of starts) {
    pathTo.set(start, { path: [start], cost: costOf(start) });
    if (destSet.has(start)) {
      return { path: [start], cost: costOf(start) };
    }
  }
  let toExpand = starts;
  let toExpandNext = [];
  let minToDest = grid.size + 1;
  let bestPath;
  let minDistance = 0;
  const distanceToNextDest = (path, excl) => {
    const targets = (0, import_lodash6.difference)(dests, excl);
    if (targets.length === 0) {
      return 0;
    }
    path = bestPath ? (0, import_lodash6.difference)(path, bestPath.path.slice(1, -1)) : path;
    return Math.min(...(0, import_lodash6.flatten)(path.map((x) => targets.map((y) => grid.distance(x, y)))));
  };
  const isBetter = (path) => {
    if (path.cost < minToDest) {
      return true;
    }
    if (path.cost > minToDest) {
      return false;
    }
    return distanceToNextDest(path.path, [path.path[0], path.path[path.path.length]]) < minDistance;
  };
  while (toExpand.length > 0) {
    for (const hex of toExpand) {
      const curPath = pathTo.get(hex);
      if (curPath.cost > minToDest) {
        continue;
      }
      for (const neighbour of grid.neighbours(hex)) {
        if (pathTo.has(neighbour) && pathTo.get(neighbour).cost <= curPath.cost + costOf(neighbour)) {
          continue;
        }
        const extendedPath = {
          cost: curPath.cost + costOf(neighbour),
          path: [...curPath.path, neighbour]
        };
        pathTo.set(neighbour, extendedPath);
        toExpandNext.push(neighbour);
        if (destSet.has(neighbour) && isBetter(extendedPath)) {
          minToDest = extendedPath.cost;
          bestPath = extendedPath;
          minDistance = distanceToNextDest(extendedPath.path.slice(1, -1), [
            extendedPath.path[0],
            extendedPath.path[extendedPath.path.length - 1]
          ]);
        }
      }
    }
    toExpand = toExpandNext;
    toExpandNext = [];
  }
  return bestPath;
}

// engine/src/algorithms/spanning-tree.ts
function spanningTree(destGroups, grid, maxAdditional, algorithm, costOf) {
  if (algorithm === "exhaustive") {
    assert6(false, "Exhaustive spanning tree algorithm needs to be updated, use heuristic instead");
  } else {
    return spanningTreeWithHeuristic(destGroups, grid, maxAdditional, costOf);
  }
}
function spanningTreeWithHeuristic(destGroups, grid, maxAdditional = -1, costOf = (hex) => 1) {
  const minCost = minimumPathLength(destGroups);
  if (maxAdditional > -1 && maxAdditional < minCost) {
    return { minCost };
  }
  const destHexes = [].concat(...destGroups);
  const destHexesSet = new Set(destHexes);
  if (destGroups.length <= 1) {
    return { path: destHexes, cost: (0, import_lodash7.sumBy)(destHexes, costOf) };
  }
  const destGroupsMap = /* @__PURE__ */ new Map();
  for (const group of destGroups) {
    for (const hex of group) {
      destGroupsMap.set(hex, group);
    }
  }
  const [minQ, maxQ] = [(0, import_lodash7.minBy)(destHexes, "q").q, (0, import_lodash7.maxBy)(destHexes, "q").q];
  const [minR, maxR] = [(0, import_lodash7.minBy)(destHexes, "r").r, (0, import_lodash7.maxBy)(destHexes, "r").r];
  const [minS, maxS] = [(0, import_lodash7.minBy)(destHexes, "s").s, (0, import_lodash7.maxBy)(destHexes, "s").s];
  const startingPoints = [];
  if (destGroups.length > 2) {
    startingPoints.push(
      ...[...grid.values()].filter(
        (hex) => !destHexesSet.has(hex) && (0, import_lodash7.inRange)(hex.q, minQ + 1, maxQ) && (0, import_lodash7.inRange)(hex.r, minR + 1, maxR) && (0, import_lodash7.inRange)(hex.s, minS + 1, maxS)
      )
    );
  }
  for (const group of destGroups) {
    startingPoints.push(group[0]);
  }
  const groupAround = (hex) => {
    if (destGroupsMap.has(hex)) {
      return destGroupsMap.get(hex);
    } else {
      return (0, import_lodash7.uniq)([hex, ...grid.neighbours(hex).map((nb) => destGroupsMap.get(nb) ?? [])].flat(1));
    }
  };
  let minScore = maxAdditional === -1 ? grid.size + 1 : maxAdditional + 1;
  let bestSolution;
  for (const startingPoint of startingPoints) {
    let hexes = groupAround(startingPoint);
    let cost;
    let toReach = (0, import_lodash7.difference)(destHexes, hexes);
    do {
      const hexSet = new Set(hexes);
      const path = shortestPath(hexes, toReach, grid, (hex) => hexSet.has(hex) ? 0 : costOf(hex));
      if (!path) {
        hexes = void 0;
        break;
      }
      hexes = (0, import_lodash7.uniq)(hexes.concat(path.path.slice(1, -1), groupAround(path.path[path.path.length - 1])));
      cost = (0, import_lodash7.sumBy)(hexes, costOf);
      toReach = (0, import_lodash7.difference)(toReach, hexes);
    } while (cost < minScore && toReach.length > 0);
    if (hexes && cost < minScore) {
      minScore = cost;
      bestSolution = hexes;
    }
  }
  if (bestSolution) {
    return { path: bestSolution, cost: minScore };
  }
  return { minCost };
}

// engine/src/cost.ts
var TERRAFORMING_COST = 3;
var QIC_RANGE_UPGRADE = 2;
function terraformingCost(d, steps, replay) {
  const oreNeeded = (temporaryStep) => (TERRAFORMING_COST - d.terraformCostDiscount) * Math.max(steps - temporaryStep, 0);
  const cost = oreNeeded(d.temporaryStep);
  if (!replay && d.temporaryStep > 0 && oreNeeded(0) === cost) {
    return null;
  }
  return new Reward(cost, "o" /* Ore */);
}
function qicForDistance(map, hex, pl, replay, temporaryRange = pl.data.temporaryRange) {
  const distance = (acceptGaiaFormer) => {
    const hexes = acceptGaiaFormer ? Array.from(map.grid.values()).filter((loc) => loc.data.player === pl.player) : pl.data.occupied.filter((loc) => acceptGaiaFormer || loc.isRangeStartingPoint(pl.player));
    return Math.min(...hexes.map((loc) => map.distance(hex, loc)));
  };
  function qic(temporaryRange2, distance2) {
    return Math.max(Math.ceil((distance2 - effectiveRange(pl.data) - temporaryRange2) / QIC_RANGE_UPGRADE), 0);
  }
  const d = distance(false);
  const qicNeeded = qic(temporaryRange, d);
  if (!replay && temporaryRange > 0 && qic(0, distance(false)) === qicNeeded) {
    return null;
  }
  const qicWithGaiaFormer = qic(temporaryRange, distance(true));
  return {
    amount: qicNeeded,
    distance: d,
    warning: qicWithGaiaFormer < qicNeeded ? "gaia-former-would-extend-range" /* gaiaFormerWouldExtendRange */ : null
  };
}

// engine/src/faction-boards/index.ts
var import_lodash10 = __toESM(require_lodash2());

// engine/src/faction-boards/ambas.ts
var ambas = {
  faction: "ambas" /* Ambas */,
  standard: {
    buildings: {
      ["PI" /* PlanetaryInstitute */]: {
        income: [["+4pw", "+2t", "=> swap-PI"]]
      }
    },
    income: ["3k,4o,15c,q,up-nav", "+2o,k"]
  }
};
var ambas_default = ambas;

// engine/src/faction-boards/baltaks.ts
var baltaks = {
  faction: "baltaks" /* BalTaks */,
  standard: {
    buildings: {
      ["ac2" /* Academy2 */]: {
        cost: "6c,6o",
        income: [["=>4c", "tech"]]
      }
    },
    income: ["3k,4o,15c,up-gaia", "+o,k"],
    power: {
      area2: 2
    },
    handlers: {
      freeActionChoice: (player, pool) => pool.push(freeActionsBaltaks, player)
    }
  },
  variants: [
    {
      type: "beta",
      board: {
        income: ["3k,4o,15c,up-gaia,up-int", "+o,k"]
      },
      version: 0
    }
  ]
};
var baltaks_default = baltaks;

// engine/src/faction-boards/bescods.ts
var bescods = {
  faction: "bescods" /* Bescods */,
  standard: {
    buildings: {
      ["ts" /* TradingStation */]: {
        income: [["+k"], ["+k"], ["+k"], ["+k"]]
      },
      ["lab" /* ResearchLab */]: {
        income: [
          ["+3c", "tech"],
          ["+4c", "tech"],
          ["+5c", "tech"]
        ]
      },
      ["PI" /* PlanetaryInstitute */]: {
        income: [["+4pw", "+2t"]]
      }
    },
    income: ["3k,4o,15c,q", "+o", "=> up-lowest"]
  },
  variants: [
    {
      type: "more-balanced",
      board: {
        income: ["2k,4o,15c,q", "+o", "=> up-lowest"]
      },
      version: 0
    },
    {
      type: "beta",
      version: 0,
      board: {
        income: ["k,4o,15c,q,up-sci", "+o", "=> up-lowest"]
      }
    },
    {
      type: "beta",
      version: 2,
      board: {
        income: ["k,4o,15c,q,up-sci,up-sci", "+o", "=> up-lowest"]
      }
    }
  ]
};
var bescods_default = bescods;

// engine/src/faction-boards/darkanians.ts
function gainSectorBonus(player, hex) {
  if (player.data.hasPlanetaryInstitute() && isNewLostFleetSector(player.data.occupied, hex)) {
    player.gainRewards(Reward.parse("2c,1k"), "darkanians" /* Darkanians */);
  }
}
var darkanians = {
  faction: "darkanians" /* Darkanians */,
  standard: {
    income: ["3k,7o,15c,q,up-nav,up-eco", "+o,k"],
    power: {
      area1: 4,
      area2: 2
    },
    handlers: {
      [`build-${"m" /* Mine */}`]: (player, hex) => gainSectorBonus(player, hex)
    }
  }
};
var darkanians_default = darkanians;

// engine/src/faction-boards/firaks.ts
var firaks = {
  faction: "firaks" /* Firaks */,
  standard: {
    buildings: {
      ["PI" /* PlanetaryInstitute */]: {
        income: [["+4pw", "+t", "=> down-lab"]]
      }
    },
    income: ["2k,3o,15c,q", "+o,2k"]
  },
  variants: [
    {
      type: "more-balanced",
      board: {
        income: ["2k,4o,15c,q", "+o,2k"],
        power: {
          area1: 4,
          area2: 2
        }
      },
      version: 0
    },
    {
      type: "beta",
      version: 0,
      board: {
        income: ["2k,3o,15c,q,up-sci", "+o,2k"]
      }
    },
    {
      type: "beta",
      version: 2,
      board: {
        income: ["2k,3o,15c,q,up-eco", "+o,2k"]
      }
    }
  ]
};
var firaks_default = firaks;

// engine/src/faction-boards/geodens.ts
function gainExtraKnowledge(player, hex) {
  if (player.data.hasPlanetaryInstitute() && player.data.isNewPlanetType(hex)) {
    player.gainRewards([new Reward("3k")], "geodens" /* Geodens */);
  }
}
var geodens = {
  faction: "geodens" /* Geodens */,
  standard: {
    income: ["3k,4o,15c,q,up-terra", "+o,k"],
    handlers: {
      [`build-${"m" /* Mine */}`]: (player, hex) => gainExtraKnowledge(player, hex),
      [`build-${"colony" /* Colony */}`]: (player, hex) => gainExtraKnowledge(player, hex)
    }
  },
  variants: [
    {
      type: "beta",
      version: 0,
      board: {
        income: ["3k,4o,15c,q,up-terra,up-terra", "+o,k"]
      }
    },
    {
      type: "beta",
      version: 2,
      board: {
        income: ["5k,4o,15c,q,up-terra,up-terra", "+o,k"]
      }
    }
  ]
};
var geodens_default = geodens;

// engine/src/faction-boards/gleens.ts
function gaiaVp(hex, player) {
  if (hex.data.planet === "g" /* Gaia */) {
    player.gainRewards([new Reward("2vp")], "gleens" /* Gleens */);
  }
}
var gleens = {
  faction: "gleens" /* Gleens */,
  // Lost Fleet §I5: a once-per-round special action granting +2 range (RULES_CLARIFICATIONS.md
  // p.11) - new to the base faction, so it's gated to Lost Fleet games only (see
  // FactionBoard's constructor) rather than added to `standard.income` unconditionally. Same
  // "=>" Activate-operator mechanism as Space Giants' "=> 2step" and Booster5's "=> range+3",
  // both of which already exercise the generic hasActiveBooster()/temporaryRange plumbing this
  // reuses, so no new engine mechanism is needed.
  lostFleetIncome: ["=> range+2"],
  standard: {
    buildings: {
      ["PI" /* PlanetaryInstitute */]: {
        income: [["+4pw", "+o"]]
      }
    },
    income: ["3k,4o,15c,up-nav", "+o,k"],
    handlers: {
      [`build-${"PI" /* PlanetaryInstitute */}`]: (player) => player.gainFederationToken("gleens" /* Gleens */),
      [`build-${"m" /* Mine */}`]: (player, hex) => gaiaVp(hex, player),
      [`build-${"colony" /* Colony */}`]: (player, hex) => gaiaVp(hex, player)
    }
  },
  variants: [
    {
      type: "more-balanced",
      board: {
        income: ["3k,4o,15c,q,up-nav", "+o,k"]
      },
      version: 0
    },
    {
      type: "beta",
      version: 0,
      board: {
        income: ["3k,4o,15c,up-nav,up-nav", "+o,k"]
      }
    },
    {
      type: "beta",
      version: 2,
      board: {
        income: ["3k,4o,15c,up-nav,up-nav,up-nav", "+o,k"]
      }
    }
  ]
};
var gleens_default = gleens;

// engine/src/faction-boards/hadsch-hallas.ts
var hadschHallas = {
  faction: "hadsch-hallas" /* HadschHallas */,
  standard: {
    income: ["3k,4o,15c,q,up-eco", "+o,k,3c"],
    handlers: {
      freeActionChoice: (player, pool) => {
        if (player.data.hasPlanetaryInstitute()) {
          pool.push(freeActionsHadschHallas, player);
        }
      }
    }
  },
  variants: [
    {
      type: "beta",
      board: {
        income: ["3k,4o,15c,q,up-eco,up-eco", "+o,k,3c"]
      },
      version: 0
    }
  ]
};
var hadsch_hallas_default = hadschHallas;

// engine/src/faction-boards/itars.ts
var itars = {
  faction: "itars" /* Itars */,
  standard: {
    buildings: {
      ["ac1" /* Academy1 */]: {
        income: [["+3k", "tech"]]
      }
    },
    income: ["3k,5o,15c,q", "+o,k,t"],
    power: {
      area1: 4
    },
    handlers: {
      burn: (player, amount) => {
        player.gainRewards([new Reward(amount, "tg" /* GainTokenGaiaArea */)], "itars" /* Itars */);
      }
    }
  },
  variants: [
    {
      type: "more-balanced",
      board: {
        income: ["3k,5o,15c,q", "+o,k"],
        buildings: {
          ["ac1" /* Academy1 */]: {
            income: [["+2k", "tech"]]
          },
          ["PI" /* PlanetaryInstitute */]: {
            cost: "6c,4o",
            income: [["+4pw", "+2t"]]
          }
        }
      },
      version: 0
    }
  ]
};
var itars_default = itars;

// engine/src/faction-boards/ivits.ts
var ivits = {
  faction: "ivits" /* Ivits */,
  standard: {
    power: {
      area1: 2,
      area2: 2
    },
    buildings: {
      ["PI" /* PlanetaryInstitute */]: {
        cost: "~",
        income: [["+4pw", "+t", "=> space-station"]]
      }
    },
    income: ["3k,4o,15c,q", "+o,k,q"]
  },
  variants: [
    {
      type: "more-balanced",
      players: 2,
      board: {
        income: ["3k,4o,15c", "+o,k,q"],
        //PI is placed earlier, see beginSetupBuildingPhase
        buildings: {
          ["PI" /* PlanetaryInstitute */]: {
            cost: "~",
            income: [["+4pw", "=> space-station"]]
          }
        }
      },
      version: 0
    }
  ]
};
var ivits_default = ivits;

// engine/src/faction-boards/lantids.ts
function gainAdjustedPiBonus(player, hex) {
  if (!hasExpansion(player.expansions, 4 /* LostFleet */) || !player.data.hasPlanetaryInstitute()) {
    return;
  }
  if (player.nbPlayers <= 2 && hex.data.planet === "r" /* Terra */) {
    player.gainRewards(Reward.parse("2k"), "lantids" /* Lantids */);
  }
  if (player.nbPlayers === 3 && hex.data.additionalMine === player.player) {
    player.gainRewards(Reward.parse("1pw"), "lantids" /* Lantids */);
  }
}
var lantids = {
  faction: "lantids" /* Lantids */,
  // Lost Fleet §I2 (owner board-read): Lantids gain +1 power token to Area I as basic income, from
  // the start. New to the base faction, so gated to Lost Fleet games (appended in FactionBoard's
  // constructor) rather than added to `standard.income`. Encoded as "t" (a gained power token, which
  // enters Area I), matching how Itars' board writes its own +1PB1 income ("+o,k,t").
  lostFleetIncome: ["+t"],
  standard: {
    buildings: {
      ["PI" /* PlanetaryInstitute */]: {
        income: [["+4pw"]]
      }
    },
    income: ["3k,4o,13c,q", "+o,k"],
    power: {
      area1: 4,
      area2: 0
    },
    handlers: {
      [`build-${"m" /* Mine */}`]: (player, hex) => gainAdjustedPiBonus(player, hex)
    }
  },
  variants: [
    {
      type: "more-balanced",
      board: {
        income: ["3k,4o,15c,q", "+o,k"],
        power: {
          area1: 4,
          area2: 2
        }
      },
      version: 0
    },
    {
      type: "beta",
      board: {
        income: ["3k,4o,13c,q,up-eco,up-eco", "+o,k"]
      },
      version: 0
    }
  ]
};
var lantids_default = lantids;

// engine/src/faction-boards/moweyds.ts
var moweyds = {
  faction: "moweyds" /* Moweyds */,
  standard: {
    income: ["5k,6o,15c,2q,up-gaia", "+o,k"],
    power: {
      area1: 4,
      area2: 4
    },
    buildings: {
      ["PI" /* PlanetaryInstitute */]: {
        income: [["+4pw", "+t", "=> power-ring"]]
      }
    }
  }
};
var moweyds_default = moweyds;

// engine/src/faction-boards/nevlas.ts
var nevlas = {
  faction: "nevlas" /* Nevlas */,
  standard: {
    buildings: {
      ["ts" /* TradingStation */]: {
        income: [["+3c"], ["+4c"], ["+4c"], ["+5c"]]
      },
      ["lab" /* ResearchLab */]: {
        income: [
          ["+2pw", "tech"],
          ["+2pw", "tech"],
          ["+2pw", "tech"]
        ]
      }
    },
    income: ["2k,4o,15c,q,up-sci", "+o,k"],
    handlers: {
      [`build-${"PI" /* PlanetaryInstitute */}`]: (player) => player.data.tokenModifier = 2,
      freeActionChoice: (player, pool) => {
        pool.push(freeActionsNevlas, player);
        if (player.data.hasPlanetaryInstitute()) {
          pool.push(freeActionsNevlasPI, player);
          for (const action of pool.actions) {
            const a = conversionToFreeAction(action);
            if (a === 3 /* PowerToCredit */ || a === 2 /* PowerToOre */) {
              action.hide = true;
            }
          }
        }
      }
    }
  }
};
var nevlas_default = nevlas;

// engine/src/faction-boards/space-giants.ts
var spaceGiants = {
  faction: "space-giants" /* SpaceGiants */,
  standard: {
    // Exploration board special action: once per round, Build a Mine with 2 free terraforming
    // steps (extra ore still owed for any step beyond that) - reuses the same temporaryStep
    // discount mechanism as the "step" round booster.
    income: ["3k,6o,15c,q,up-nav", "+o,k", "=> 2step"],
    power: {
      area1: 4,
      area2: 4
    },
    buildings: {
      ["PI" /* PlanetaryInstitute */]: {
        // standard +4pw income buffed to +6pw, plus an immediate tech tile of choice (once only)
        income: [["+6pw", "+t", "tech"]]
      }
    }
  }
};
var space_giants_default = spaceGiants;

// engine/src/faction-boards/taklons.ts
var taklons = {
  faction: "taklons" /* Taklons */,
  standard: {
    brainstone: "area1" /* Area1 */,
    handlers: {
      freeActionChoice: (player, pool) => pool.push(freeActionsTaklons, player)
    }
  }
};
var taklons_default = taklons;

// engine/src/faction-boards/terrans.ts
function terranCharge(player, amount) {
  player.gainRewards([new Reward(amount, "pw" /* ChargePower */)], "terrans" /* Terrans */);
}
var terrans = {
  faction: "terrans" /* Terrans */,
  standard: {
    income: ["3k,4o,15c,q,up-gaia", "+o,k"],
    power: {
      area1: 4
    },
    handlers: {
      discardGaia: (player, amount) => {
        terranCharge(player, amount);
      },
      "gaiaPhase-tokensMovedFromGaia": (player, amount) => {
        terranCharge(player, amount);
      }
    }
  },
  variants: [
    {
      type: "beta",
      version: 0,
      board: {
        income: ["3k,4o,15c,q,up-gaia,up-nav", "+o,k"]
      }
    },
    {
      type: "beta",
      version: 2,
      board: {
        income: ["3k,4o,15c,q,up-gaia", "+o,k"]
        //vanilla
      }
    }
  ]
};
var terrans_default = terrans;

// engine/src/faction-boards/tinkeroids.ts
var tinkeroids = {
  faction: "tinkeroids" /* Tinkeroids */,
  standard: {
    income: ["2k,4o,15c,q,up-sci", "+o,k"],
    power: {
      area1: 4,
      area2: 2
    }
  }
};
var tinkeroids_default = tinkeroids;

// engine/src/faction-boards/types.ts
var import_lodash9 = __toESM(require_lodash2());

// engine/src/utils.ts
var import_lodash8 = __toESM(require_lodash2());
var import_semver_compare = __toESM(require_semver_compare());
function customizer(objValue, srcValue) {
  if (Array.isArray(objValue)) {
    return srcValue;
  }
}
function merge(target, ...sources) {
  return (0, import_lodash8.mergeWith)(target, ...sources, customizer);
}
function combinations(t) {
  if (t.length === 0) {
    return [[]];
  }
  return combinations(t.slice(1)).flatMap((value) => [value, value.concat(t[0])]);
}
function isVersionOrLater(actualVersion, requiredVersion) {
  if (!actualVersion) return false;
  return (0, import_semver_compare.default)(actualVersion, requiredVersion) !== -1;
}

// engine/src/faction-boards/types.ts
var GAIA_FORMER_COST = 6;
var defaultBoard = {
  buildings: {
    ["m" /* Mine */]: {
      cost: "2c,o",
      income: [["+o"], ["+o"], [], ["+o"], ["+o"], ["+o"], ["+o"], ["+o"]]
    },
    ["ts" /* TradingStation */]: {
      cost: "3c,2o",
      isolatedCost: "6c,2o",
      income: [["+3c"], ["+4c"], ["+4c"], ["+5c"]]
    },
    ["lab" /* ResearchLab */]: {
      cost: "5c,3o",
      income: [
        ["+k", "tech"],
        ["+k", "tech"],
        ["+k", "tech"]
      ]
    },
    ["ac1" /* Academy1 */]: {
      cost: "6c,6o",
      income: [["+2k", "tech"]]
    },
    ["ac2" /* Academy2 */]: {
      cost: "6c,6o",
      income: [["=>q", "tech"]]
    },
    ["PI" /* PlanetaryInstitute */]: {
      cost: "6c,4o",
      income: [["+4pw", "+t"]]
    },
    ["gf" /* GaiaFormer */]: {
      cost: `${GAIA_FORMER_COST}t->tg`,
      income: [[], [], []]
    },
    ["sp" /* SpaceStation */]: {
      cost: "~",
      income: [[], [], [], [], [], []]
    },
    //frontiers
    ["colony" /* Colony */]: {
      cost: "~",
      income: [
        ["+3c", "+3pw", "+3vp", "2vp"],
        ["+3c", "+3pw", "+4vp", "2vp"],
        ["+3c", "+3pw", "+5vp", "2vp"]
      ]
    },
    ["customsPost" /* CustomsPost */]: {
      cost: "2c",
      income: [["+2c"], ["+2c"], ["+2c"], ["+2c"], ["+2c"]]
    },
    ["colonyShip" /* ColonyShip */]: {
      cost: "4c,3o",
      income: [[], [], []]
    },
    ["constructionShip" /* ConstructionShip */]: {
      cost: "3c,2o",
      income: [[], [], []]
    },
    ["researchShip" /* ResearchShip */]: {
      cost: "3c,2o",
      income: [[], [], []]
    },
    ["tradeShip" /* TradeShip */]: {
      cost: "5c,1o",
      income: [[], [], []]
    },
    ["scout" /* Scout */]: {
      cost: "1c,1o",
      income: [[], [], []]
    },
    ["frigate" /* Frigate */]: {
      cost: "3c,2o",
      income: [[], [], []]
    },
    ["battleShip" /* BattleShip */]: {
      cost: "5c,5o",
      income: [[], [], []]
    }
  },
  income: ["3k,4o,15c,q", "+o,k"],
  power: {
    area1: 2,
    area2: 4
  },
  brainstone: null,
  handlers: {}
};
var FactionBoard = class {
  constructor(input, variant, expansion) {
    Object.assign(this, merge({}, defaultBoard, input.standard, variant ?? {}));
    if (input.lostFleetIncome && hasExpansion(expansion, 4 /* LostFleet */)) {
      this.income = [...this.income, ...input.lostFleetIncome];
    }
    const buildings = Building.values(6 /* All */);
    const toRewards = [`${"ts" /* TradingStation */}.isolatedCost`].concat(buildings.map((bld) => `${bld}.cost`));
    const toIncome = buildings.map((bld) => `${bld}.income`);
    for (const toRew of toRewards) {
      (0, import_lodash9.set)(this.buildings, toRew, Reward.parse((0, import_lodash9.get)(this.buildings, toRew)));
    }
    this.income = Event.parse(this.income, null);
    for (const event of this.income) {
      event.source = event.operator === ">" /* Once */ ? "beginGame" /* BeginGame */ : "income" /* ChooseIncome */;
    }
    for (const toInc of toIncome) {
      (0, import_lodash9.set)(
        this.buildings,
        toInc,
        (0, import_lodash9.get)(this.buildings, toInc).map((events) => Event.parse(events, "income" /* ChooseIncome */))
      );
    }
  }
  cost(building, isolated) {
    if (building === "ts" /* TradingStation */ && isolated) {
      return this.buildings[building].isolatedCost;
    }
    return this.buildings[building].cost;
  }
};

// engine/src/faction-boards/xenos.ts
var xenos = {
  faction: "xenos" /* Xenos */,
  standard: {
    buildings: {
      ["PI" /* PlanetaryInstitute */]: {
        income: [["+4pw", "+q"]]
      }
    },
    income: ["3k,4o,15c,q,up-int", "+o,k"],
    handlers: {
      freeActionChoice: (player, pool) => {
        if (hasExpansion(player.expansions, 4 /* LostFleet */)) {
          pool.remove(5 /* OreToToken */);
          pool.push(freeActionsXenos, player);
        }
      }
    }
  },
  variants: [
    {
      type: "more-balanced",
      board: {
        buildings: {
          ["PI" /* PlanetaryInstitute */]: {
            income: [["+4pw", "+q", "+t"]]
          }
        }
      },
      version: 0
    },
    {
      type: "beta",
      board: {
        income: ["3k,4o,15c,q,up-int,up-int", "+o,k"]
      },
      version: 0
    }
  ]
};
var xenos_default = xenos;

// engine/src/faction-boards/index.ts
var factionBoards = {
  ["terrans" /* Terrans */]: terrans_default,
  ["lantids" /* Lantids */]: lantids_default,
  ["xenos" /* Xenos */]: xenos_default,
  ["gleens" /* Gleens */]: gleens_default,
  ["taklons" /* Taklons */]: taklons_default,
  ["ambas" /* Ambas */]: ambas_default,
  ["hadsch-hallas" /* HadschHallas */]: hadsch_hallas_default,
  ["ivits" /* Ivits */]: ivits_default,
  ["geodens" /* Geodens */]: geodens_default,
  ["baltaks" /* BalTaks */]: baltaks_default,
  ["firaks" /* Firaks */]: firaks_default,
  ["bescods" /* Bescods */]: bescods_default,
  ["nevlas" /* Nevlas */]: nevlas_default,
  ["itars" /* Itars */]: itars_default,
  ["tinkeroids" /* Tinkeroids */]: tinkeroids_default,
  ["darkanians" /* Darkanians */]: darkanians_default,
  ["moweyds" /* Moweyds */]: moweyds_default,
  ["space-giants" /* SpaceGiants */]: space_giants_default
};
function factionVariantBoard(customization, faction) {
  if (!customization) {
    return null;
  }
  const variants = factionBoards[faction].variants;
  if (customization.variant === "standard" || !variants) {
    return null;
  }
  const matchVariant = (v) => v.type === customization.variant && v.version <= customization.version;
  const byPlayerCount = variants.filter((v) => matchVariant(v) && v.players === customization.players);
  if (byPlayerCount.length) {
    return (0, import_lodash10.maxBy)(byPlayerCount, "version");
  }
  const byType = variants.filter((v) => matchVariant(v) && !("players" in v));
  if (byType.length) {
    return (0, import_lodash10.maxBy)(byType, "version");
  }
  return null;
}
function latestVariantVersion(variant) {
  return Math.max(
    ...Object.values(factionBoards).flatMap((x) => x.variants?.filter((x2) => x2.type === variant)).filter(Boolean).map((x) => x.version ?? 0),
    0
  );
}
function factionBoard(faction, variant, expansion) {
  return new FactionBoard(factionBoards[faction], variant, expansion);
}

// engine/src/factions.ts
var import_shuffle_seed4 = __toESM(require_shuffle_seed2());
var import_lodash11 = __toESM(require_lodash2());
var lostFleetTerraformingBoardPlanets = [
  "r" /* Terra */,
  "o" /* Oxide */,
  "v" /* Volcanic */,
  "d" /* Desert */,
  "s" /* Swamp */,
  "t" /* Titanium */,
  "i" /* Ice */
];
var factions = {
  ["terrans" /* Terrans */]: {
    planet: "r" /* Terra */
  },
  ["lantids" /* Lantids */]: {
    planet: "r" /* Terra */
  },
  ["xenos" /* Xenos */]: {
    planet: "d" /* Desert */
  },
  ["gleens" /* Gleens */]: {
    planet: "d" /* Desert */
  },
  ["taklons" /* Taklons */]: {
    planet: "s" /* Swamp */
  },
  ["ambas" /* Ambas */]: {
    planet: "s" /* Swamp */
  },
  ["hadsch-hallas" /* HadschHallas */]: {
    planet: "o" /* Oxide */
  },
  ["ivits" /* Ivits */]: {
    planet: "o" /* Oxide */
  },
  ["geodens" /* Geodens */]: {
    planet: "v" /* Volcanic */
  },
  ["baltaks" /* BalTaks */]: {
    planet: "v" /* Volcanic */
  },
  ["firaks" /* Firaks */]: {
    planet: "t" /* Titanium */
  },
  ["bescods" /* Bescods */]: {
    planet: "t" /* Titanium */
  },
  ["nevlas" /* Nevlas */]: {
    planet: "i" /* Ice */
  },
  ["itars" /* Itars */]: {
    planet: "i" /* Ice */
  },
  ["tinkeroids" /* Tinkeroids */]: {
    planet: "a" /* Asteroid */
  },
  // No home terrain planet (Lost Fleet) - `planet` here only drives the same-color
  // oppositeFaction() exclusivity below, not terraforming (see terraformingStepsRequired()
  // in planets.ts, which special-cases these factions instead of reading factionPlanet()).
  ["darkanians" /* Darkanians */]: {
    planet: "a" /* Asteroid */
  },
  ["moweyds" /* Moweyds */]: {
    planet: "p" /* Protoplanet */
  },
  ["space-giants" /* SpaceGiants */]: {
    planet: "p" /* Protoplanet */
  }
};
function isTerraformingBoardFaction(faction) {
  return faction === "tinkeroids" /* Tinkeroids */ || faction === "moweyds" /* Moweyds */;
}
function isBaseGameFaction(faction) {
  return !["tinkeroids" /* Tinkeroids */, "darkanians" /* Darkanians */, "moweyds" /* Moweyds */, "space-giants" /* SpaceGiants */].includes(faction);
}
function lostFleetTerraformingBoard(seed) {
  return import_shuffle_seed4.default.shuffle([...lostFleetTerraformingBoardPlanets], `${seed}-lost-fleet-terraforming-board`);
}
function lostFleetTerraformingCost3Planets(players, turnOrder, board) {
  const specialPlayers = turnOrder.map((player) => players.find((pl) => pl.player === player)).filter((pl) => !!pl && isTerraformingBoardFaction(pl.faction));
  if (specialPlayers.length === 0) {
    return {};
  }
  const counts = board.map(() => 1);
  const baseGamePlanets = players.filter((pl) => isBaseGameFaction(pl.faction)).map((pl) => factionPlanet(pl.faction));
  if (specialPlayers.length === 2) {
    for (const planet of baseGamePlanets) {
      const idx = board.findIndex((entry) => entry === planet);
      if (idx !== -1) {
        counts[idx] += 1;
      }
    }
  }
  const ret = {};
  for (const player of specialPlayers) {
    ret[player.player] = [...baseGamePlanets];
  }
  for (const planet of baseGamePlanets) {
    let remainingMandatory = specialPlayers.length;
    while (remainingMandatory > 0) {
      const idx = board.findIndex((entry, index) => entry === planet && counts[index] > 0);
      if (idx === -1) {
        break;
      }
      counts[idx] -= 1;
      remainingMandatory -= 1;
    }
  }
  for (const player of specialPlayers) {
    const selected = ret[player.player];
    while (selected.length < 3) {
      const idx = counts.findIndex((count) => count > 0);
      if (idx === -1) {
        break;
      }
      selected.push(board[idx]);
      counts[idx] -= 1;
    }
  }
  return ret;
}
function tinkeringTilesForRound(round) {
  if (round <= 3) {
    return ["tinkering-step1" /* Step1 */, "tinkering-power4" /* Power4 */, "tinkering-qic1" /* Qic1 */];
  }
  return ["tinkering-step3" /* Step3 */, "tinkering-knowledge3" /* Knowledge3 */, "tinkering-qic2" /* Qic2 */];
}
function tinkeringTileSpec(tile) {
  switch (tile) {
    case "tinkering-step1" /* Step1 */:
      return "step";
    case "tinkering-power4" /* Power4 */:
      return "4pw";
    case "tinkering-qic1" /* Qic1 */:
      return "q";
    case "tinkering-step3" /* Step3 */:
      return "3step";
    case "tinkering-knowledge3" /* Knowledge3 */:
      return "3k";
    case "tinkering-qic2" /* Qic2 */:
      return "2q";
  }
}
function oppositeFaction(faction) {
  const allFactions = Faction.values(6 /* All */);
  if (!allFactions.includes(faction)) {
    return null;
  }
  for (const fct of allFactions) {
    if (fct !== faction && factions[fct].planet === factions[faction].planet) {
      return fct;
    }
  }
}
function remainingFactions(chosenFactions, expansions) {
  return (0, import_lodash11.difference)(
    Faction.values(expansions),
    chosenFactions.map((f) => f),
    chosenFactions.map((f) => oppositeFaction(f))
  );
}
function factionPlanet(faction) {
  const fact = factions[faction];
  if (fact) {
    return fact.planet;
  }
  return "l" /* Lost */;
}
function startingSetupPlacements(faction) {
  switch (faction) {
    case "ivits" /* Ivits */:
    case "tinkeroids" /* Tinkeroids */:
    case "darkanians" /* Darkanians */:
    case "moweyds" /* Moweyds */:
    case "space-giants" /* SpaceGiants */:
      return 1;
    case "xenos" /* Xenos */:
      return 3;
    default:
      return 2;
  }
}
function lostFleetSetupStage(faction) {
  switch (faction) {
    case "tinkeroids" /* Tinkeroids */:
    case "darkanians" /* Darkanians */:
    case "moweyds" /* Moweyds */:
    case "space-giants" /* SpaceGiants */:
      return 2;
    case "ivits" /* Ivits */:
      return 3;
    default:
      return 1;
  }
}

// engine/src/federation.ts
var import_lodash12 = __toESM(require_lodash2());
import assert7 from "node:assert";
function isOutclassedBy(fed, comparison) {
  if (fed.satellites <= comparison.satellites) {
    return false;
  }
  if (fed.planets < comparison.planets) {
    return false;
  }
  const fedPlanets = fed.hexes.filter((hex) => hex.hasPlanet());
  const compPlanets = comparison.hexes.filter((hex) => hex.hasPlanet());
  if (fed.planets > comparison.planets && fed.satellites > comparison.satellites && (0, import_lodash12.difference)(compPlanets, fedPlanets).length === 0) {
    return true;
  }
  if (fedPlanets.length === compPlanets.length && (0, import_lodash12.difference)(fedPlanets, compPlanets).length === 0) {
    if (fed.satellites > comparison.satellites) {
      return true;
    }
  }
  return false;
}
function federationCost(faction, hasPlanetaryInstitute, federationCount) {
  if (faction === "xenos" /* Xenos */ && hasPlanetaryInstitute) {
    return 6;
  }
  if (faction === "ivits" /* Ivits */) {
    return 7 * (1 + federationCount);
  }
  return 7;
}
function parseFederationLocation(location, map) {
  const coords = location.split(",").map((loc) => map.parse(loc));
  for (const coord of coords) {
    assert7(map.grid.get(coord), `Coord ${coord.q}x${coord.r} is not part of the map`);
  }
  const hexes = (0, import_lodash12.uniq)(coords.map((coord) => map.grid.get(coord)));
  assert7(hexes.length === coords.length, "There are repeating coordinates in the given federation");
  return hexes;
}

// engine/src/income.ts
import assert8 from "node:assert";
var IncomeSelection = class _IncomeSelection {
  constructor(needed, autoplayEvents, descriptions2, remainingChargesAfterIncome2) {
    this.needed = needed;
    this.autoplayEvents = autoplayEvents;
    this.descriptions = descriptions2;
    this.remainingChargesAfterIncome = remainingChargesAfterIncome2;
  }
  static create(data, settings, events, additionalEvents) {
    const notActivated = events.filter((ev) => !ev.activated);
    if (additionalEvents) {
      notActivated.push(...additionalEvents);
    }
    const gainTokens = notActivated.filter((ev) => ev.rewards.some((rw) => rw.type === "t" /* GainToken */));
    const chargePowers = notActivated.filter((ev) => ev.rewards.some((rw) => rw.type === "pw" /* ChargePower */));
    return new _IncomeSelection(
      gainTokens.length !== 0 && chargePowers.length !== 0,
      () => {
        if (!settings.autoIncome) {
          assert8(false, "auto income was called, but it's not enabled for the player");
        }
        return calculateAutoIncome(data, gainTokens, chargePowers);
      },
      descriptions(gainTokens, chargePowers),
      remainingChargesAfterIncome(data.clone(), gainTokens, chargePowers)
    );
  }
};
function descriptions(gainTokens, chargePowers) {
  return [
    ...gainTokens.map((ev) => ev.rewards.find((rw) => rw.type === "t" /* GainToken */)),
    ...chargePowers.map((ev) => ev.rewards.find((rw) => rw.type === "pw" /* ChargePower */))
  ];
}
function remainingChargesAfterIncome(data, gainTokens, chargePowers) {
  applyGainTokens(data, gainTokens);
  const waste = applyChargePowers(data, chargePowers);
  if (waste > 0) {
    return -waste;
  }
  return 100 - applyChargePowers(data, Event.parse(["+100pw"], null));
}
function runIncomeSimulation(data, beforeCharge, chargePowers, allGainTokens) {
  applyGainTokens(data, beforeCharge);
  const waste = applyChargePowers(data, chargePowers);
  const gainAfterCharge = allGainTokens.filter((event) => !beforeCharge.includes(event));
  applyGainTokens(data, gainAfterCharge);
  return { waste, power: data.power, events: beforeCharge.concat(chargePowers).concat(gainAfterCharge) };
}
function calculateAutoIncome(data, gainTokens, chargePowers) {
  const possibleSequences = combinations(gainTokens).map(
    (beforeCharge) => runIncomeSimulation(data.clone(), beforeCharge, chargePowers, gainTokens)
  );
  let minWaste = Infinity;
  for (const s of possibleSequences) {
    minWaste = Math.min(minWaste, s.waste);
  }
  let maxCharge;
  for (const s of possibleSequences.filter((value) => value.waste === minWaste)) {
    if (!maxCharge || s.power.area3 > maxCharge.power.area3) {
      maxCharge = s;
    }
  }
  return maxCharge.events;
}
function applyGainTokens(data, gainTokens) {
  for (const e of gainTokens) {
    data.gainRewards(e.rewards);
  }
}
function applyChargePowers(data, chargePowers) {
  let waste = 0;
  for (const e of chargePowers) {
    for (const reward of e.rewards) {
      if (reward.type === "pw" /* ChargePower */) {
        const power = reward.count;
        const charged = data.chargePower(power);
        waste += power - charged;
      }
    }
  }
  return waste;
}

// engine/src/planets.ts
function terraformingStepsRequired(faction, targetPlanet, cost3Planets = []) {
  const planetCycle = [
    "r" /* Terra */,
    "o" /* Oxide */,
    "v" /* Volcanic */,
    "d" /* Desert */,
    "s" /* Swamp */,
    "t" /* Titanium */,
    "i" /* Ice */
  ];
  if (targetPlanet === "g" /* Gaia */ || targetPlanet === "m" /* Transdim */ || targetPlanet === "a" /* Asteroid */) {
    return 0;
  }
  if (targetPlanet === "p" /* Protoplanet */) {
    return 3;
  }
  if (faction === "darkanians" /* Darkanians */) {
    return 1;
  }
  if (faction === "space-giants" /* SpaceGiants */) {
    return 2;
  }
  if (faction === "tinkeroids" /* Tinkeroids */ || faction === "moweyds" /* Moweyds */) {
    return cost3Planets.includes(targetPlanet) ? 3 : 1;
  }
  let dist2 = planetCycle.findIndex((pc) => pc === targetPlanet) - planetCycle.findIndex((pc) => pc === factionPlanet(faction));
  if (dist2 > 3) {
    dist2 -= 7;
  } else if (dist2 < -3) {
    dist2 += 7;
  }
  return Math.abs(dist2);
}
var planetNames = {
  ["d" /* Desert */]: "desert",
  ["o" /* Oxide */]: "oxide",
  ["l" /* Lost */]: "lost",
  ["g" /* Gaia */]: "gaia",
  ["i" /* Ice */]: "ice",
  ["e" /* Empty */]: "empty",
  ["s" /* Swamp */]: "swamp",
  ["r" /* Terra */]: "terra",
  ["t" /* Titanium */]: "titanium",
  ["m" /* Transdim */]: "transdim",
  ["v" /* Volcanic */]: "volcanic",
  ["p" /* Protoplanet */]: "protoplanet",
  ["a" /* Asteroid */]: "asteroid"
};

// engine/src/research-tracks.ts
var researchTracks = {
  ["terra" /* Terraforming */]: [[], ["2o"], ["d"], ["d", "3pw"], ["2o"], []],
  ["nav" /* Navigation */]: [[], ["q"], ["r", "ship-range"], ["q", "3pw"], ["r", "ship-range"], ["r", "2ship-range"]],
  ["int" /* Intelligence */]: [[], ["q"], ["q"], ["2q", "3pw"], ["2q"], ["4q"]],
  ["gaia" /* GaiaProject */]: [[], [">gf"], ["3t"], [">gf", "3pw"], [">gf"], ["4vp", "g > vp"]],
  ["eco" /* Economy */]: [[], ["+2c,pw"], ["+2c,1o,2pw"], ["+3c,1o,3pw", "3pw"], ["+4c,2o,4pw"], ["6c,3o,6pw"]],
  ["sci" /* Science */]: [[], ["+k"], ["+2k"], ["+3k", "3pw"], ["+4k"], ["9k"]],
  ["dip" /* Diplomacy */]: [
    [],
    ["+pw", "tradeDiscount"],
    ["+2pw", "tradeBonus"],
    ["+3pw", "tradeDiscount", "3pw"],
    ["+4pw", "tradeBonus"],
    ["+6pw", "tradeBonus", "tradeDiscount"]
  ]
};
var frontiersEco = [
  ["tradeShip"],
  ["+2c", "tradeShip"],
  ["+2c,1o,1pw"],
  ["+3c,1o,1pw", "3pw", "tradeShip"],
  ["+4c,2o,2pw"],
  ["6c,3o,6pw"]
];
var lostFleetEcoPw = [
  researchTracks["eco" /* Economy */][0],
  researchTracks["eco" /* Economy */][1],
  researchTracks["eco" /* Economy */][2],
  ["+2c,1o,3pw", "3pw"],
  ["+2c,2o,2pw"],
  researchTracks["eco" /* Economy */][5]
];
var lostFleetEcoVp = [
  researchTracks["eco" /* Economy */][0],
  researchTracks["eco" /* Economy */][1],
  researchTracks["eco" /* Economy */][2],
  ["+3c,1o,1vp", "3pw"],
  ["+4c,2o,1vp"],
  researchTracks["eco" /* Economy */][5]
];
function researchEvents(field, level, expansion, lostFleetEconomySide) {
  const spec = field === "eco" /* Economy */ && hasExpansion(expansion, 2 /* Frontiers */) ? frontiersEco[level] : field === "eco" /* Economy */ && hasExpansion(expansion, 4 /* LostFleet */) ? (lostFleetEconomySide === "vp" /* VictoryPoints */ ? lostFleetEcoVp : lostFleetEcoPw)[level] : researchTracks[field][level];
  return spec.map((s) => new Event(s, field)).filter((e) => e.rewards.every((r) => isResourceUsed(r.type, expansion)));
}
function lastTile(field) {
  return researchTracks[field].length - 1;
}
function keyNeeded(field, dest) {
  return dest === lastTile(field);
}

// engine/src/tiles/boosters.ts
var boosterSpec = {
  ["booster1" /* Booster1 */]: ["+k", "+o"],
  ["booster2" /* Booster2 */]: ["+o", "+2t"],
  ["booster3" /* Booster3 */]: ["+q", "+2c"],
  ["booster4" /* Booster4 */]: ["+2c", "=> step"],
  ["booster5" /* Booster5 */]: ["+2pw", "=> range+3"],
  ["booster6" /* Booster6 */]: ["+o", "m | vp"],
  ["booster7" /* Booster7 */]: ["+o", "ts | 2vp"],
  ["booster8" /* Booster8 */]: ["+k", "lab | 3vp"],
  ["booster9" /* Booster9 */]: ["+4pw", "PA | 4vp"],
  ["booster10" /* Booster10 */]: ["+4c", "g | vp"],
  ["booster-lostfleet-former" /* LostFleetFormer */]: ["+o", "gf | 3vp"],
  ["booster-lostfleet-planet" /* LostFleetPlanet */]: ["+o", "pt | vp"],
  ["booster-lostfleet-deep" /* LostFleetDeep */]: ["+3c", "ds | 2vp"],
  ["booster-lostfleet-instant" /* LostFleetInstant */]: ["+2pw", "=> instant-gaiaforming"]
};
function boosterEvents(booster) {
  return Event.parse(boosterSpec[booster], booster);
}

// engine/src/tiles/federations.ts
var federationSpec = {
  ["fed1" /* Fed1 */]: "12vp",
  ["fed2" /* Fed2 */]: "8vp,q",
  ["fed3" /* Fed3 */]: "8vp,2t",
  ["fed4" /* Fed4 */]: "7vp,2o",
  ["fed5" /* Fed5 */]: "7vp,6c",
  ["fed6" /* Fed6 */]: "6vp,2k",
  ["gleens" /* Gleens */]: "o,k,2c"
};
function federationRewards(federation) {
  return Reward.parse(federationSpec[federation]);
}
function isGreen(federation) {
  return federation !== "fed1" /* Fed1 */;
}

// engine/src/tiles/spaceship-federations.ts
var spaceshipFederationSpec = {
  ["ship-fed-credit" /* Credit */]: "Immediately gain 8 VP and 8 credits.",
  ["ship-fed-knowledge" /* Knowledge */]: "Immediately gain 4 VP and 4 knowledge.",
  ["ship-fed-orequic" /* OreQic */]: "Immediately gain 4 VP, 2 ore, and 1 Q.I.C.",
  ["ship-fed-power" /* PowerTokens */]: "Immediately gain 7 VP and 2 power tokens placed directly into Area III.",
  ["ship-fed-range" /* Range */]: "Once: receive a Build a Mine action of limitless range without paying the build cost; ore still pays for terraforming, Q.I.C. still required for Gaia planets.",
  ["ship-fed-tech" /* Tech */]: "Once: receive 1 Tech tile of choice (same rules as Upgrade Existing Structures).",
  ["ship-fed-terraform" /* Terraform */]: "Once: receive a Build a Mine action with up to 3 free terraforming steps without paying the build cost; Q.I.C.s may still increase range.",
  ["ship-fed-vp" /* Vp */]: "Immediately gain 12 VP."
};
var spaceshipFederationRewards = {
  ["ship-fed-credit" /* Credit */]: "8vp,8c",
  ["ship-fed-knowledge" /* Knowledge */]: "4vp,4k",
  ["ship-fed-orequic" /* OreQic */]: "4vp,2o,q",
  ["ship-fed-power" /* PowerTokens */]: "7vp",
  ["ship-fed-tech" /* Tech */]: "tech",
  ["ship-fed-vp" /* Vp */]: "12vp"
};

// engine/src/tiles/techs.ts
var techTileSpec = {
  ["tech1" /* Tech1 */]: ["o,q"],
  ["tech2" /* Tech2 */]: ["pt > k"],
  ["tech3" /* Tech3 */]: ["PA->4pw" /* FourPowerBuildings */],
  ["tech4" /* Tech4 */]: ["7vp"],
  ["tech5" /* Tech5 */]: ["+o,pw"],
  ["tech6" /* Tech6 */]: ["+k,c"],
  ["tech7" /* Tech7 */]: ["mg >> 3vp"],
  ["tech8" /* Tech8 */]: ["+4c"],
  ["tech9" /* Tech9 */]: ["=> 4pw"],
  ["tech-frontiers1" /* TechFrontiers1 */]: ["trade >> 2c"],
  ["advtech1" /* AdvTech1 */]: ["fed | 3vp"],
  ["advtech2" /* AdvTech2 */]: ["a >> 2vp"],
  ["advtech3" /* AdvTech3 */]: ["=> q,5c"],
  ["advtech4" /* AdvTech4 */]: ["m > 2vp"],
  ["advtech5" /* AdvTech5 */]: ["lab | 3vp"],
  ["advtech6" /* AdvTech6 */]: ["s > o"],
  ["advtech7" /* AdvTech7 */]: ["pt | vp"],
  ["advtech8" /* AdvTech8 */]: ["g > 2vp"],
  ["advtech9" /* AdvTech9 */]: ["ts > 4vp"],
  ["advtech10" /* AdvTech10 */]: ["s > 2vp"],
  ["advtech11" /* AdvTech11 */]: ["=> 3o"],
  ["advtech12" /* AdvTech12 */]: ["fed > 5vp"],
  ["advtech13" /* AdvTech13 */]: ["=> 3k"],
  ["advtech14" /* AdvTech14 */]: ["m >> 3vp"],
  ["advtech15" /* AdvTech15 */]: ["ts >> 3vp"],
  // Lost Fleet, see RULES_CLARIFICATIONS.md §G2
  ["advtech-asteroidpass" /* AsteroidPass */]: ["ast | 2vp"],
  ["advtech-big" /* Big */]: ["PA > 6vp"],
  ["advtech-deep" /* Deep */]: ["ds > 4vp"],
  ["advtech-deeppass" /* DeepPass */]: ["ds | 2vp"],
  ["advtech-qaction" /* QAction */]: ["shipq >> 4vp"],
  ["advtech-terra" /* Terra */]: ["step >> 2vp"]
};
function techTileEventWithSource(tile, source) {
  return Event.parse(techTileSpec[tile], source);
}
function techTileEventSource(pos) {
  return isAdvanced(pos) ? pos : `tech-${pos}`;
}
function techTileEvents(chooseTechTile) {
  if (chooseTechTile.tile === "ship-tech-resource" /* Resource */) {
    return Event.parse(["o,3k"], chooseTechTile.pos);
  }
  if (isSpaceshipTechTile(chooseTechTile.tile)) {
    return [];
  }
  return techTileEventWithSource(
    chooseTechTile.tile,
    techTileEventSource(chooseTechTile.pos)
  );
}
function isAdvanced(pos) {
  return pos.startsWith("adv");
}
function isSpaceshipTechTile(tile) {
  return tile.startsWith("ship-tech-");
}

// engine/src/player.ts
var MAX_SATELLITES = 25;
var defaultAutoCharge = 1;
var defaultAutoChargeTargetSpendablePower = 0;
var Settings = class {
  constructor(autoChargePower2 = defaultAutoCharge, autoChargeTargetSpendablePower = defaultAutoChargeTargetSpendablePower, autoIncome2 = false, autoBrainstone2 = false, itarsAutoChargeToArea3 = false) {
    this.autoChargePower = autoChargePower2;
    this.autoChargeTargetSpendablePower = autoChargeTargetSpendablePower;
    this.autoIncome = autoIncome2;
    this.autoBrainstone = autoBrainstone2;
    this.itarsAutoChargeToArea3 = itarsAutoChargeToArea3;
  }
};
var Player5 = class _Player extends import_eventemitter3.EventEmitter {
  constructor(expansion = 0 /* None */, player = 0 /* Player1 */) {
    super();
    this.player = player;
    this.faction = null;
    this.variant = null;
    this.board = null;
    this.data = new PlayerData2();
    this.settings = new Settings();
    this.events = {
      [">" /* Once */]: [],
      ["+" /* Income */]: [],
      [">>" /* Trigger */]: [],
      ["=>" /* Activate */]: [],
      ["|" /* Pass */]: [],
      ["PA->4pw" /* FourPowerBuildings */]: []
    };
    // Did we decline the last offer?
    this.declined = false;
    /** Active expansions, set in loadBoard; lets faction-board handlers gate expansion-only abilities. */
    this.expansions = 0 /* None */;
    this.data.on("advance-research", (track, dest) => this.onResearchAdvanced(track, dest, expansion));
  }
  get income() {
    return Reward.toString(this.incomeRewards, true);
  }
  get incomeRewards() {
    return Reward.merge([].concat(...this.events["+" /* Income */].map((event) => event.rewards)));
  }
  resourceIncome(resource) {
    return this.incomeRewards.find((r) => r.type === resource)?.count ?? 0;
  }
  get actions() {
    return this.events["=>" /* Activate */].map((event) => event.action());
  }
  /**
   * Special actions with no Booster/Tech-tile/Advanced-Tech-tile of their own to render them on
   * (faction-innate ones like Space Giants' Exploration board or Ivits' Planetary Institute) -
   * the only ones the player board's "under the mines" row should show, since a Booster/Tech-tile/
   * Advanced-Tech-tile-granted special action is already shown on its own component.
   */
  get actionsWithoutTile() {
    return this.events["=>" /* Activate */].filter((event) => !isTileOrBoosterSource(event.source)).map((event) => event.action());
  }
  progress(finalTile) {
    return this.eventConditionCount(finalScorings[finalTile].condition);
  }
  get fedValue() {
    return this.eventConditionCount("stfedvalue" /* StructureFedValue */);
  }
  get structureValue() {
    return this.eventConditionCount("stvalue" /* StructureValue */);
  }
  get ownedPlanetsCount() {
    return (0, import_lodash13.countBy)(this.ownedPlanets, "data.planet");
  }
  toJSON() {
    const json = {
      player: this.player,
      faction: this.faction,
      data: this.data,
      settings: this.settings,
      events: this.events,
      name: this.name,
      dropped: this.dropped,
      variant: this.variant && {
        board: this.variant.board,
        version: this.variant.version
      },
      factionLoaded: !!this.board
    };
    if (this.federationCache) {
      json.federationCache = {
        availableSatellites: this.federationCache.availableSatellites,
        federations: this.federationCache.federations.map((fedInfo) => ({
          ...fedInfo,
          hexes: fedInfo.hexes.map((h) => h.toString())
        }))
      };
    }
    return json;
  }
  /**
   * @param board LEGACY Only useful for old games, now loaded directly from data.variant
   */
  static fromData(data, map, board, expansions, version2, nbPlayers, lostFleetEconomySide) {
    const player = new _Player(expansions, data.player);
    player.faction = data.faction;
    if (data.variant || data.factionVariant) {
      if (data.factionVariant) {
        player.variant = {
          board: data.factionVariant,
          version: data.factionVariantVersion
        };
      } else {
        player.variant = data.variant;
      }
      board = player.variant;
    }
    if (data.faction && (data.factionLoaded || !isVersionOrLater(version2, "4.8.4"))) {
      player.loadFaction(board, expansions, true, nbPlayers, lostFleetEconomySide);
    }
    for (const kind of Object.keys(data.events)) {
      player.events[kind] = data.events[kind].map((ev) => new Event(ev));
    }
    player.name = data.name;
    player.dropped = data.dropped;
    if (data.federationCache) {
      player.federationCache = data.federationCache;
      for (const fed of player.federationCache.federations) {
        fed.hexes = fed.hexes.map((hex) => map.getS(hex));
      }
    }
    player.loadPlayerData(data.data);
    player.settings = data.settings ?? player.settings;
    if (player.settings.autoChargePower === 0) {
      player.settings.autoChargePower = "decline-cost";
    }
    return player;
  }
  loadPlayerData(data) {
    if (data) {
      (0, import_lodash13.merge)(this.data, data);
    }
  }
  get planet() {
    return factionPlanet(this.faction);
  }
  payCosts(costs, source) {
    for (const cost of costs) {
      this.data.gainReward(this.factionReward(cost, source, false), true, source);
    }
  }
  gainRewards(rewards, source) {
    this.data.gainRewards(
      rewards.map((rew) => this.factionReward(rew, source, true)),
      false,
      source
    );
  }
  maxPayRange(cost) {
    const costs = Reward.merge(cost);
    for (let max = 0; ; max += 1) {
      for (const rew of costs) {
        if (!this.data.hasResource(new Reward(rew.count * (max + 1), rew.type))) {
          return max;
        }
      }
    }
  }
  hasActiveBooster(type) {
    return this.events["=>" /* Activate */].some((e) => !e.activated && e.rewards.some((r) => r.type === type));
  }
  canBuild(map, hex, targetPlanet, building, lastRound, replay, {
    isolated,
    addedCost,
    existingBuilding
  } = {}) {
    if (this.data.buildings[building] >= this.maxBuildings(building)) {
      return null;
    }
    if (!addedCost) {
      addedCost = [];
    }
    if (hex?.hasSpaceship() && !isShip(building)) {
      return null;
    }
    if (!this.data.canPay(addedCost)) {
      return null;
    }
    const buildActionUsed = this.data.temporaryStep > 0 || this.data.temporaryRange > 0;
    const warnings = [];
    if (addedCost.some((c) => c.type === "q" /* Qic */ && c.count > 0) && this.hasActiveBooster("range" /* TemporaryRange */) && !buildActionUsed) {
      warnings.push("range-booster-not-used" /* rangeBoosterNotUsed */);
    }
    let steps = 0;
    if (building === "gf" /* GaiaFormer */) {
      addedCost.push(new Reward(-this.data.gaiaFormingDiscount(), "t->tg" /* MoveTokenToGaiaArea */));
    } else if (building === "m" /* Mine */ || building === "colony" /* Colony */) {
      if (targetPlanet === "g" /* Gaia */) {
        if (this.data.temporaryStep > 0 && !replay) {
          return null;
        }
        if (!existingBuilding) {
          addedCost.push(this.gaiaFormingCost());
        } else {
        }
      } else {
        steps = terraformingStepsRequired(this.faction, targetPlanet, this.data.lostFleetCost3Planets);
        const reward = terraformingCost(this.data, steps, replay);
        if (reward === null) {
          return null;
        }
        if (steps > 0 && this.hasActiveBooster("step" /* TemporaryStep */) && !buildActionUsed) {
          warnings.push("step-booster-not-used" /* stepBoosterNotUsed */);
        }
        if (reward.count > 0 && this.data.terraformCostDiscount < 2) {
          warnings.push("expensive-terraforming" /* expensiveTerraforming */);
        }
        if (this.data.temporaryStep > steps) {
          warnings.push("step-action-partially-wasted" /* stepActionPartiallyWasted */);
        }
        addedCost.push(reward);
        const scoredPlanet = hex?.data?.planet ?? targetPlanet;
        if (scoredPlanet === "p" /* Protoplanet */ && scoredPlanet !== factionPlanet(this.faction)) {
          addedCost.push(new Reward(-6, "vp" /* VictoryPoint */));
        } else if (targetPlanet === "a" /* Asteroid */) {
          if (!this.data.hasResource(new Reward(1, "gf" /* GaiaFormer */))) {
            return null;
          }
          addedCost.push(...Reward.negative(this.board.cost(building, isolated)));
        }
      }
    }
    const cost = Reward.merge(this.board.cost(building, isolated), addedCost);
    const creditCost = (r) => r.filter((r2) => r2.type === "c" /* Credit */)[0].count;
    if (building === "ts" /* TradingStation */ && creditCost(cost) === creditCost(this.board.buildings["ts" /* TradingStation */].isolatedCost)) {
      warnings.push("expensive-trade-station" /* expensiveTradingStation */);
    }
    const toGaia = cost.find((r) => r.type === "t->tg" /* MoveTokenToGaiaArea */);
    if (toGaia?.count > this.data.power.area1) {
      warnings.push("gaia-forming-with-charged-tokens" /* gaiaFormingWithChargedTokens */);
    }
    if (building === "gf" /* GaiaFormer */ && lastRound) {
      warnings.push("gaia-former-last-round" /* gaiaFormerLastRound */);
    }
    if (hex && this.faction !== "ivits" /* Ivits */) {
      for (const h of map.withinDistance(hex, 1)) {
        if (h.belongsToFederationOf(this.player)) {
          warnings.push("building-will-be-part-of-federation" /* buildingWillBePartOfFederation */);
          break;
        }
      }
    }
    return !this.data.canPay(cost) ? null : {
      cost,
      steps,
      warnings
    };
  }
  maxBuildings(building) {
    switch (building) {
      case "gf" /* GaiaFormer */:
        return this.data.gaiaformers - this.data.gaiaformersInGaia - this.data.gaiaformersUsedForAsteroid;
      case "tradeShip" /* TradeShip */:
        return this.data.tradeShips;
      default:
        return this.board.buildings[building].income.length;
    }
  }
  get ownedPlanets() {
    return this.data.occupied.filter((hex) => hex.data.planet !== "e" /* Empty */ && hex.isMainOccupier(this.player));
  }
  loadFaction(board, expansions, skipIncome = false, nbPlayers, lostFleetEconomySide) {
    this.variant = {
      board: board?.board,
      version: board?.version
    };
    this.loadBoard(
      factionBoard(this.faction, this.variant.board, expansions),
      expansions,
      skipIncome,
      true,
      nbPlayers,
      lostFleetEconomySide
    );
  }
  loadBoard(board, expansions, skipIncome = false, subscribeListeners = true, nbPlayers, lostFleetEconomySide) {
    this.board = board;
    this.expansions = expansions;
    this.nbPlayers = nbPlayers;
    this.lostFleetEconomySide = lostFleetEconomySide;
    if (!skipIncome) {
      this.gainRewards(this.data.initialPowerRewards(this.board), "beginGame" /* BeginGame */);
      this.loadTechs(expansions);
      this.loadEvents(this.board.income);
    }
    if (subscribeListeners) {
      for (const eventName of Object.keys(this.board.handlers)) {
        for (const emitter of [this, this.data]) {
          emitter.on(eventName, (...args) => this.board.handlers[eventName](this, ...args));
        }
      }
    }
  }
  loadTechs(expansions) {
    const fields = ResearchField.values(expansions);
    for (const field of fields) {
      this.loadEvents(researchEvents(field, this.data.research[field], expansions, this.lostFleetEconomySide));
    }
  }
  loadEvents(events) {
    for (const event of events) {
      this.loadEvent(event);
    }
  }
  loadEvent(event) {
    this.events[event.operator].push(event.clone());
    if (event.operator === ">" /* Once */) {
      this.gainRewards(this.eventConditionRewards(event), event.source);
    }
  }
  removeEvents(events) {
    for (const event of events) {
      this.removeEvent(event);
    }
  }
  removeEvent(event) {
    let index = this.events[event.operator].findIndex((ev) => ev.spec === event.spec && ev.source === event.source);
    if (index === -1) {
      index = this.events[event.operator].findIndex((ev) => ev.spec === event.spec);
    }
    if (index !== -1) {
      this.events[event.operator].splice(index, 1);
    } else {
    }
  }
  removeRoundBoosterEvents(type) {
    const events = boosterEvents(this.data.tiles.booster).filter(
      (ev) => type && ev.operator === "+" /* Income */ || !type && ev.operator !== "+" /* Income */
    );
    for (const event of events) {
      this.removeEvent(event);
    }
  }
  activateEvent(spec) {
    for (const event of this.events["=>" /* Activate */]) {
      if (event.spec === spec && !event.activated) {
        this.gainRewards(event.rewards, event.source);
        event.activated = true;
        return;
      }
    }
  }
  /**
   * This is managing Income phase to solve +t and +pw ordering
   * It's assuming that each reward belongs to a different event, which has only that reward
   * In case of multiple matches pick the first
   *
   * @param rewards
   */
  receiveIncomeEvent(rewards) {
    for (const rew of rewards) {
      const event = this.events["+" /* Income */].find(
        (ev) => !ev.activated && ev.rewards.some((rew2) => Reward.match([rew], [rew2]))
      );
      assert9(event);
      this.gainRewards(event.rewards, event.source);
      event.activated = true;
    }
  }
  /**
   * Second parameter is necessary in case someone advances research mutliple times in one go, we don't
   * want to remove multiple green federations for one track
   */
  onResearchAdvanced(field, dest, expansion) {
    const events = researchEvents(field, dest, expansion, this.lostFleetEconomySide);
    this.loadEvents(events);
    const oldEvents = researchEvents(field, dest - 1, expansion, this.lostFleetEconomySide);
    this.removeEvents(oldEvents);
    if (dest === lastTile(field)) {
      this.data.removeGreenFederation();
    }
    this.receiveTriggerIncome("a" /* AdvanceResearch */);
  }
  build(building, hex, cost, map, stepsReq, consumesAsteroidGaiaformer = true) {
    this.payCosts(cost, "build" /* Build */);
    const wasOccupied = this.data.occupied.includes(hex);
    const isNewLostPlanet = hex.data.planet === "l" /* Lost */ && !hex.occupied();
    const isNewAsteroidColonization = hex.data.planet === "a" /* Asteroid */ && !hex.occupied();
    if (isNewAsteroidColonization && consumesAsteroidGaiaformer) {
      this.data.gaiaformersUsedForAsteroid += 1;
    }
    if (building !== "gf" /* GaiaFormer */ && building !== "customsPost" /* CustomsPost */ && !isShip(building)) {
      if (!wasOccupied) {
        this.data.occupied.push(hex);
        this.federationCache = null;
      }
      if (this.federationCache) {
        assert9(wasOccupied, "logic error");
        if (this.buildingValue(hex, { federation: true }) === this.buildingValue(hex, { federation: true, building })) {
        } else if (!hex.belongsToFederationOf(this.player)) {
          this.federationCache = null;
        } else if (this.faction === "ivits" /* Ivits */) {
          this.federationCache = null;
        }
      }
    }
    if (isNewLostPlanet) {
      this.data.lostPlanet += 1;
    } else {
      this.data.buildings[building] += 1;
    }
    const upgradedBuilding = hex.buildingOf(this.player);
    if (upgradedBuilding && building !== "customsPost" /* CustomsPost */) {
      this.data.buildings[upgradedBuilding] -= 1;
      this.removeEvents(this.board.buildings[upgradedBuilding].income[this.data.buildings[upgradedBuilding]]);
    }
    if (!isNewLostPlanet) {
      this.loadEvents(this.board.buildings[building].income[this.data.buildings[building] - 1]);
    }
    const isAdditionalMine = !upgradedBuilding && hex.occupied();
    if (isShip(building)) {
      this.placeShip(building, hex);
    } else if (building === "customsPost" /* CustomsPost */) {
      hex.data.customPosts = hex.customPosts.concat(this.player);
    } else {
      if (isAdditionalMine) {
        hex.data.additionalMine = this.player;
        if (this.data.hasPlanetaryInstitute()) {
          this.gainRewards([new Reward("2k")], "lantids" /* Lantids */);
        }
      } else {
        hex.data.building = building;
        hex.data.player = this.player;
      }
      this.addBuildingToNearbyFederation(building, hex, map);
    }
    this.receiveBuildingTriggerIncome(building, hex.data.planet, isAdditionalMine);
    if (building === "m" /* Mine */) {
      if (isNewLostFleetSector(this.data.occupied, hex)) {
        this.receiveTriggerIncome("newsector" /* NewSector */);
      }
      if (!this.data.occupied.some((other) => other !== hex && other.data.planet === hex.data.planet)) {
        this.receiveTriggerIncome("newplanet" /* NewPlanetType */);
      }
    }
    if (stepsReq) {
      this.receiveTerraformingStepTriggerIncome(stepsReq);
    }
    this.emit(`build-${building}`, hex);
  }
  addBuildingToNearbyFederation(building, hex, map) {
    const added = [];
    if (building !== "gf" /* GaiaFormer */ && !hex.belongsToFederationOf(this.player)) {
      const group = this.buildingGroup(hex, map);
      const hasFederation = map.grid.neighbours(hex).some((hx) => hx.belongsToFederationOf(this.player));
      if (hasFederation) {
        for (const h of group) {
          if (h.addToFederationOf(this.player)) {
            added.push(h);
          }
        }
      }
    }
    return added;
  }
  placeShip(ship, hex) {
    this.data.ships.push({ type: ship, location: hex.toString(), moved: true, player: this.player });
  }
  findUnmovedShip(ship, location) {
    return this.data.ships.find((s) => s.location === location && s.type === ship && !s.moved);
  }
  removeShip(ship, destroyed) {
    const l = this.data.ships;
    l.splice(l.indexOf(ship), 1);
    if (destroyed) {
      this.data.destroyedShips[ship.type]++;
      this.data.buildings[ship.type]--;
    } else {
      this.data.deployedShips[ship.type]++;
    }
  }
  resetTemporaryVariables() {
    this.data.temporaryRange = 0;
    this.data.temporaryStep = 0;
  }
  pass() {
    this.receivePassIncome();
    this.removeRoundBoosterEvents();
    this.data.tiles.booster = void 0;
  }
  getRoundBooster(roundBooster) {
    this.data.tiles.booster = roundBooster;
    this.loadEvents(boosterEvents(roundBooster));
  }
  gainTechTile(chooseTechTile) {
    const advanced = isAdvanced(chooseTechTile.pos);
    if (advanced) {
      this.data.removeGreenFederation();
    }
    this.data.tiles.techs.push({ ...chooseTechTile, enabled: true });
    this.loadEvents(techTileEvents(chooseTechTile));
    if (chooseTechTile.tile === "tech3" /* Tech3 */) {
      this.federationCache = null;
    }
  }
  coverTechTile(pos) {
    const tile = this.data.tiles.techs.find((tech) => tech.pos === pos);
    tile.enabled = false;
    const events = techTileEvents(tile);
    this.removeEvents(events);
    if (events.some((event) => event.operator === "PA->4pw" /* FourPowerBuildings */)) {
      this.federationCache = null;
    }
  }
  incomeSelection(additionalEvents) {
    return IncomeSelection.create(this.data, this.settings, this.events["+" /* Income */], additionalEvents);
  }
  canGaiaTerrans() {
    return this.data.gaiaPowerTokens() > 0 && this.faction === "terrans" /* Terrans */ && this.data.hasPlanetaryInstitute();
  }
  canGaiaItars() {
    return this.data.gaiaPowerTokens() >= 4 && this.faction === "itars" /* Itars */ && this.data.hasPlanetaryInstitute();
  }
  canUpgradeResearch(field) {
    if (this.data.research[field] === lastTile(field)) {
      return false;
    }
    const destTile = this.data.research[field] + 1;
    if (keyNeeded(field, destTile) && !this.data.hasGreenFederation()) {
      return false;
    }
    if (this.faction === "baltaks" /* BalTaks */ && !this.data.hasPlanetaryInstitute() && field === "nav" /* Navigation */) {
      return false;
    }
    return true;
  }
  receiveIncome(events) {
    for (const event of events) {
      if (!event.activated) {
        if (!event.rewards.some((rew) => rew.type === "pw" /* ChargePower */)) {
          event.activated = true;
        }
        this.gainRewards(event.rewards, event.source);
        event.activated = true;
      } else {
      }
    }
    for (const event of events) {
      event.activated = false;
    }
  }
  passIncomeEvents() {
    return this.events["|" /* Pass */].map(
      (event) => new Event(this.eventConditionRewards(event).join(","), event.source)
    );
  }
  eventConditionRewards(event) {
    const times = this.eventConditionCount(event.condition);
    return event.rewards.map((reward) => new Reward(reward.count * times, reward.type));
  }
  receivePassIncome() {
    for (const e of this.passIncomeEvents()) {
      this.gainRewards(e.rewards, e.source);
    }
  }
  receiveBuildingTriggerIncome(building, planet, isAdditionalMine) {
    for (const event of this.events[">>" /* Trigger */]) {
      if (Condition.matchesBuilding(event.condition, building, planet) && (!isAdditionalMine || event.condition === "m" /* Mine */)) {
        this.gainRewards(event.rewards, event.source);
      }
    }
  }
  receiveTriggerIncome(condition) {
    for (const event of this.events[">>" /* Trigger */]) {
      if (event.condition === condition) {
        this.gainRewards(event.rewards, event.source);
      }
    }
  }
  receiveTerraformingStepTriggerIncome(stepsReq) {
    for (const event of this.events[">>" /* Trigger */]) {
      if (event.condition === "step" /* TerraformStep */) {
        this.gainRewards(
          event.rewards.map((rw) => new Reward(rw.count * stepsReq, rw.type)),
          event.source
        );
      }
    }
  }
  finalCount(tile) {
    return this.eventConditionCount(finalScorings[tile].condition);
  }
  gaiaPhaseEnd() {
    if (this.data.brainstone === "gaia" /* Gaia */) {
      this.data.brainstone = "area1" /* Area1 */;
      this.gainRewards([new Reward(1, "brainstone" /* Brainstone */)], "roundGaia" /* RoundGaia */);
    }
    const gaia = this.data.power.gaia;
    if (gaia > 0) {
      this.gainRewards([new Reward(gaia, "tg->t" /* MoveTokenFromGaiaAreaToArea1 */)], "roundGaia" /* RoundGaia */);
    }
    if (this.data.gaiaformersInGaia > 0) {
      this.gainRewards(
        [new Reward(this.data.gaiaformersInGaia, "gf->t" /* MoveGaiaFormerFromGaiaAreaToArea1 */)],
        "roundGaia" /* RoundGaia */
      );
    }
    this.data.gaiaformersUsedForOther = 0;
  }
  buildingValue(hex, options) {
    const building = options?.building ?? hex.buildingOf(this.player);
    const forFederation = options?.federation ?? false;
    if (forFederation) {
      switch (building) {
        case "sp" /* SpaceStation */:
          return 1;
        case "customsPost" /* CustomsPost */:
          return 0;
      }
    }
    let baseValue = stdBuildingValue(building);
    if (baseValue === 0) {
      return 0;
    }
    const hasSpecialOperator = options?.hasSpecialOperator ?? this.events["PA->4pw" /* FourPowerBuildings */].length > 0;
    if (baseValue === 3 && hasSpecialOperator) {
      baseValue = 4;
    }
    const hasPlanetaryInstitute = options?.hasPlanetaryInstitute ?? this.data.hasPlanetaryInstitute();
    const addedBescods = this.faction === "bescods" /* Bescods */ && hasPlanetaryInstitute && hex?.data?.planet === "t" /* Titanium */ ? 1 : 0;
    const addedPowerRing = hex?.data?.powerRing === this.player ? 2 : 0;
    return baseValue + addedBescods + addedPowerRing;
  }
  maxLeech(extraPowerToken) {
    return this.data.maxLeech(this.data.leechPossible, extraPowerToken).value;
  }
  canLeech() {
    if (!this.data.leechPossible) {
      return false;
    }
    if (this.faction === "taklons" /* Taklons */ && this.data.hasPlanetaryInstitute()) {
      return true;
    }
    return !!this.data.chargePower(1, false);
  }
  gainFederationToken(federation) {
    this.data.tiles.federations.push({
      tile: federation,
      green: isGreen(federation)
    });
    this.gainRewards(federationRewards(federation), "federation" /* FormFederation */);
    this.receiveTriggerIncome("fed" /* Federation */);
  }
  gainSpaceshipFederationToken(federation) {
    this.data.spaceshipFederations.push({
      tile: federation,
      green: true
    });
    const rewardSpec = spaceshipFederationRewards[federation];
    if (rewardSpec) {
      this.gainRewards(Reward.parse(rewardSpec), "federation" /* FormFederation */);
    }
    if (federation === "ship-fed-power" /* PowerTokens */) {
      this.data.power.area3 += 2;
    }
    this.receiveTriggerIncome("fed" /* Federation */);
  }
  factionReward(reward, source, gleensQic) {
    if (this.faction === "terrans" /* Terrans */ && reward.type === "tg" /* GainTokenGaiaArea */) {
      return new Reward(-reward.count, "tg->t" /* MoveTokenFromGaiaAreaToArea1 */);
    }
    if (gleensQic && source !== "beginGame" /* BeginGame */ && this.faction === "gleens" /* Gleens */ && this.data.buildings["ac2" /* Academy2 */] === 0 && reward.type === "q" /* Qic */) {
      return new Reward(reward.count, "o" /* Ore */);
    }
    return reward;
  }
  /**
   * Additional cost to pay to transform a gaia planet into an habitable planet
   */
  gaiaFormingCost() {
    if (this.faction === "gleens" /* Gleens */) {
      return new Reward(1, "o" /* Ore */);
    }
    if (this.faction === "darkanians" /* Darkanians */ || this.faction === "space-giants" /* SpaceGiants */) {
      return new Reward(2, "q" /* Qic */);
    }
    return new Reward(1, "q" /* Qic */);
  }
  needsTinkeringTileChoice(round) {
    return this.faction === "tinkeroids" /* Tinkeroids */ && round >= 1 && round <= 6 && !this.data.currentTinkeringTile;
  }
  availableTinkeringTiles(round) {
    return tinkeringTilesForRound(round).filter((tile) => !this.data.usedTinkeringTiles.includes(tile));
  }
  chooseTinkeringTile(round, tile) {
    assert9(this.availableTinkeringTiles(round).includes(tile), `${tile} is not available in round ${round}`);
    const spec = tinkeringTileSpec(tile);
    this.data.currentTinkeringTile = tile;
    this.loadEvents(Event.parse([`=> ${spec}`], "tinkeroids" /* Tinkeroids */));
  }
  removeCurrentTinkeringTile() {
    if (!this.data.currentTinkeringTile) {
      return;
    }
    this.removeEvent(new Event(`=> ${tinkeringTileSpec(this.data.currentTinkeringTile)}`, "tinkeroids" /* Tinkeroids */));
    this.data.usedTinkeringTiles.push(this.data.currentTinkeringTile);
    this.data.currentTinkeringTile = null;
  }
  eventConditionCount(condition) {
    switch (condition) {
      case "~" /* None */:
        return 1;
      case "m" /* Mine */:
        return this.data.buildings["m" /* Mine */] + this.data.lostPlanet + this.data.artifactPlanetTypes.length;
      case "ts" /* TradingStation */:
        return this.data.buildings["ts" /* TradingStation */];
      case "lab" /* ResearchLab */:
        return this.data.buildings["lab" /* ResearchLab */];
      case "PA" /* BigBuilding */:
        return this.data.buildings["ac1" /* Academy1 */] + this.data.buildings["ac2" /* Academy2 */] + this.data.buildings["PI" /* PlanetaryInstitute */] + this.data.buildings["colony" /* Colony */];
      case "fed" /* Federation */:
        return this.data.tiles.federations.length + this.data.spaceshipFederations.length;
      case "g" /* Gaia */:
        return this.ownedPlanets.filter((hex) => hex.data.planet === "g" /* Gaia */).length;
      case "pt" /* PlanetType */:
        return (0, import_lodash13.uniq)([...this.ownedPlanets.map((hex) => hex.data.planet), ...this.data.artifactPlanetTypes]).length;
      case "tt" /* TechTile */:
        return this.data.tiles.techs.filter((tech) => !isAdvanced(tech.pos)).length;
      case "s" /* Sector */:
        return (0, import_lodash13.uniq)(
          this.data.occupied.filter(
            (hex) => hex.colonizedBy(this.player) && classifySectorId(hex.data.sector) === "space" /* Space */
          ).map((hex) => hex.data.sector)
        ).length;
      case "st" /* Structure */:
        return this.data.occupied.filter((hex) => hex.colonizedBy(this.player)).length;
      case "stfed" /* StructureFed */:
        return this.data.occupied.filter(
          (hex) => hex.colonizedBy(this.player) && hex.belongsToFederationOf(this.player)
        ).length;
      case "sat" /* Satellite */:
        return this.data.satellites + this.data.buildings["sp" /* SpaceStation */];
      case "stvalue" /* StructureValue */:
        return (0, import_lodash13.sum)(this.data.occupied.map((hex) => this.buildingValue(hex, { federation: true })));
      case "stfedvalue" /* StructureFedValue */:
        return (0, import_lodash13.sum)(
          this.data.occupied.map(
            (hex) => hex.belongsToFederationOf(this.player) ? this.buildingValue(hex, { federation: true }) : 0
          )
        );
      case "a" /* AdvanceResearch */:
        return (0, import_lodash13.sum)(Object.values(this.data.research));
      case "L" /* HighestResearchLevel */:
        return Math.max(...Object.values(this.data.research));
      case "gf" /* GaiaFormer */:
        return this.data.gaiaformers - this.data.gaiaformersInGaia - this.data.gaiaformersUsedForAsteroid + this.data.gaiaformersUsedForOther;
      case "ast" /* Asteroid */:
        return this.ownedPlanets.filter((hex) => hex.data.planet === "a" /* Asteroid */).length + this.data.artifactPlanetTypes.filter((planet) => planet === "a" /* Asteroid */).length;
      case "ds" /* DeepSpaceSector */:
        return colonizedDeepSpaceSectorCount(this.ownedPlanets);
      case "pi-ac-dist" /* PlanetaryInstituteAcademyDistance */: {
        const pi = this.data.occupied.find((hex) => hex.buildingOf(this.player) === "PI" /* PlanetaryInstitute */);
        const academies = this.data.occupied.filter((hex) => isAcademy(hex.buildingOf(this.player)));
        if (!pi || academies.length === 0) {
          return 0;
        }
        return Math.max(...academies.map((academy) => CubeCoordinates.distance(pi, academy)));
      }
    }
    return 0;
  }
  notifyOfNewPlanet(hexOfPlanet) {
    if (this.federationCache) {
      if (this.federationCache.federations.some((fed) => fed.hexes.some((hex) => hex === hexOfPlanet))) {
        this.federationCache = null;
      }
    }
  }
  availableFederations(map, flexible) {
    const maxSatellites = this.maxSatellites;
    let custom = false;
    if (this.federationCache) {
      if (maxSatellites <= this.federationCache.availableSatellites) {
        return this.federationCache.federations.filter((fed) => fed.newSatellites <= maxSatellites);
      } else {
      }
    }
    const excluded = map.excludedHexesForBuildingFederation(this.player, this.faction);
    const hexes = this.data.occupied.filter((hex) => !excluded.has(hex));
    const buildingGroups = this.buildingGroups(hexes, map);
    const buildingGroupsList = (0, import_lodash13.uniq)([...buildingGroups.values()]);
    const values = buildingGroupsList.map(
      (buildings) => (0, import_lodash13.sum)(buildings.map((node) => this.buildingValue(node, { federation: true })))
    );
    let combinations2 = this.possibleCombinationsForFederations(
      (0, import_lodash13.zipWith)(buildingGroupsList, values, (val1, val2) => ({ hexes: val1, value: val2 }))
    );
    if (this.faction === "ivits" /* Ivits */ && this.data.federationCount > 0) {
      combinations2 = combinations2.filter(
        (combination) => combination.some((hexList) => hexList[0].belongsToFederationOf(this.player))
      );
    }
    const federations = [];
    const occupiedSet = new Set(this.data.occupied);
    for (const combination of combinations2) {
      const destGroups = combination;
      const buildingsInDestGroups = new Set([].concat(...destGroups));
      const flexibleExcluded = new Set(
        [].concat(
          ...this.data.occupied.map((hex) => buildingsInDestGroups.has(hex) ? [] : [hex, ...map.grid.neighbours(hex)])
        )
      );
      const allHexes = [...map.grid.values()].filter(
        (hex) => !excluded.has(hex) && (!flexible || !flexibleExcluded.has(hex))
      );
      const workingGrid = new Grid(
        ...allHexes.map(
          (hex) => new Hex(hex.q, hex.r, { cost: occupiedSet.has(hex) || hex.belongsToFederationOf(this.player) ? 0 : 1 })
        )
      );
      const convertedDestGroups = destGroups.map((destGroup) => destGroup.map((hex) => workingGrid.get(hex)));
      let tree = spanningTree(convertedDestGroups, workingGrid, maxSatellites, "heuristic", (hex) => hex.data.cost);
      if ("path" in tree && !flexible && flexibleExcluded.size > 0) {
        const allHexes2 = [...map.grid.values()].filter((hex) => !excluded.has(hex) && !flexibleExcluded.has(hex));
        const workingGrid2 = new Grid(
          ...allHexes2.map(
            (hex) => new Hex(hex.q, hex.r, { cost: occupiedSet.has(hex) || hex.belongsToFederationOf(this.player) ? 0 : 1 })
          )
        );
        const convertedDestGroups2 = destGroups.map((destGroup) => destGroup.map((hex) => workingGrid2.get(hex)));
        const treeWithoutOtherPlanets = spanningTree(
          convertedDestGroups2,
          workingGrid2,
          maxSatellites,
          "heuristic",
          (hex) => hex.data.cost
        );
        if ("path" in treeWithoutOtherPlanets && treeWithoutOtherPlanets.cost <= tree.cost) {
          tree = treeWithoutOtherPlanets;
        }
      }
      if ("path" in tree) {
        federations.push(
          this.addAdjacentBuildings(
            tree.path.map((hex) => map.grid.get(hex)),
            map
          )
        );
      } else if (tree.minCost <= maxSatellites && (maxSatellites >= 7 && combination.length >= 4 || this.faction === "ivits" /* Ivits */)) {
        custom = true;
      }
    }
    const uniqFederations = (0, import_lodash13.uniqWith)(federations, (fed1, fed2) => {
      const fed1coords = fed1.map((x) => x.toString()).sort().join(",");
      const fed2coords = fed2.map((x) => x.toString()).sort().join(",");
      return fed1coords === fed2coords;
    });
    const fedsWithInfo = uniqFederations.map((federation) => this.federationInfo(federation));
    const toRemove = [];
    for (const fed of fedsWithInfo) {
      for (const comparison of fedsWithInfo) {
        if (comparison !== fed && isOutclassedBy(fed, comparison)) {
          toRemove.push(fed);
          break;
        }
      }
    }
    const feds = (0, import_lodash13.difference)(fedsWithInfo, toRemove);
    this.federationCache = {
      availableSatellites: maxSatellites,
      federations: feds,
      custom: custom && feds.length === 0
    };
    return feds;
  }
  get maxSatellites() {
    const maxNumber = MAX_SATELLITES - this.data.satellites;
    if (this.faction === "ivits" /* Ivits */) {
      return Math.min(this.data.qics, maxNumber);
    } else {
      return Math.min(this.data.discardablePowerTokens(), maxNumber);
    }
  }
  federationInfo(hexes) {
    const satellites = hexes.filter((hex) => !hex.occupyingPlayers()?.includes(this.player));
    const nPlanets = hexes.filter((hex) => hex.colonizedBy(this.player)).length;
    const powerValue = (0, import_lodash13.sum)(hexes.map((hex) => this.buildingValue(hex, { federation: true })));
    const newSatellites = satellites.filter((sat) => !sat.belongsToFederationOf(this.player)).length;
    return {
      hexes,
      satellites: satellites.length,
      newSatellites,
      planets: nPlanets,
      powerValue
    };
  }
  formFederation(hexes, token) {
    this.completeFederation(hexes);
    this.gainFederationToken(token);
  }
  completeFederation(hexes) {
    let newSatellites = 0;
    for (const hex of hexes) {
      if (hex.buildingOf(this.player) === void 0 && !hex.belongsToFederationOf(this.player)) {
        newSatellites += 1;
      }
      hex.addToFederationOf(this.player);
    }
    this.payCosts(
      [new Reward(newSatellites, this.faction === "ivits" /* Ivits */ ? "q" /* Qic */ : "t" /* GainToken */)],
      "federation" /* FormFederation */
    );
    this.data.satellites += newSatellites;
    this.data.federationCount += 1;
    this.federationCache = null;
  }
  checkAndGetFederationInfo(location, map, flexible, replay) {
    const hexes = this.hexesForFederationLocation(location, map);
    const excluded = map.excludedHexesForBuildingFederation(this.player, this.faction);
    for (const hex of hexes) {
      assert9(!excluded.has(hex), `${hex.toString()} can't be part of a new federation`);
    }
    assert9(map.grid.groups(hexes).length === 1, "The hexes of the federation must be adjacent");
    const info = this.federationInfo(hexes);
    assert9(
      info.powerValue >= this.federationCost,
      "Your buildings need to have a total value of at least " + this.federationCost
    );
    if (replay) {
      return info;
    }
    assert9(info.newSatellites <= this.maxSatellites, "Federation requires too many satellites");
    const available = this.availableFederations(map, flexible);
    const outclasser = available.find((fed) => isOutclassedBy(info, fed));
    assert9(!outclasser, "Federation is outclassed by other federation at " + (outclasser?.hexes ?? []).join(","));
    if (!flexible) {
      const allHexes = [...map.grid.values()].filter((hex) => !excluded.has(hex));
      const occupiedSet = new Set(this.data.occupied);
      const workingGrid = new Grid(
        ...allHexes.map(
          (hex) => new Hex(hex.q, hex.r, {
            cost: occupiedSet.has(hex) || hex.belongsToFederationOf(this.player) ? 0 : 1
          })
        )
      );
      const allGroups = [
        ...this.buildingGroups(
          hexes.filter(
            (hx) => hx.belongsToFederationOf(this.player) || this.buildingValue(hx, { federation: true }) > 0
          ),
          map
        ).values()
      ];
      const groups = (0, import_lodash13.uniq)(allGroups);
      const convertedDestGroups = groups.map((destGroup) => destGroup.map((hex) => workingGrid.get(hex)));
      const tree = spanningTree(convertedDestGroups, workingGrid, info.satellites, "heuristic", (hex) => hex.data.cost);
      if ("path" in tree) {
        const path = tree.path.map((hex) => map.grid.get(hex));
        const smallFederation = this.addAdjacentBuildings(path, map);
        const info2 = this.federationInfo(smallFederation);
        assert9(
          info2.satellites >= info.satellites,
          "The federation can be built with fewer satellites, for example: " + path.join(",")
        );
      }
    }
    assert9(
      this.faction !== "ivits" /* Ivits */ || this.data.federationCount === 0 || hexes.some((hex) => hex.belongsToFederationOf(this.player)),
      "Ivits must extend their first federation"
    );
    return info;
  }
  hexesForFederationLocation(location, map) {
    const hexes = parseFederationLocation(location, map);
    if (this.faction !== "ivits" /* Ivits */) {
      const max = MAX_SATELLITES + this.federationCost;
      assert9(hexes.length <= max, `The federation is too big, it is impossible to build with only ${max} satellites`);
    }
    return this.addAdjacentBuildings(hexes, map);
  }
  get federationCost() {
    return federationCost(this.faction, this.data.hasPlanetaryInstitute(), this.data.federationCount);
  }
  possibleCombinationsForFederations(nodes, toReach = this.federationCost) {
    const ret = [];
    for (let i = 0; i < nodes.length; i++) {
      if (nodes[i].value === 0) {
        continue;
      }
      if (nodes[i].value >= toReach) {
        ret.push([nodes[i].hexes]);
        continue;
      }
      for (const possibility of this.possibleCombinationsForFederations(nodes.slice(i + 1), toReach - nodes[i].value)) {
        possibility.push(nodes[i].hexes);
        ret.push(possibility);
      }
    }
    return ret;
  }
  buildingGroups(hexes = this.data.occupied, map) {
    const groups = /* @__PURE__ */ new Map();
    for (const hexWithbuilding of hexes) {
      if (groups.has(hexWithbuilding)) {
        continue;
      }
      const group = this.buildingGroup(hexWithbuilding, map);
      for (const hex of group) {
        groups.set(hex, group);
      }
    }
    return groups;
  }
  buildingGroup(hex, map) {
    const ret = [];
    const addHex = (hx) => {
      ret.push(hx);
      for (const hx2 of map.grid.neighbours(hx)) {
        if (!ret.includes(hx2)) {
          if ((hx2.belongsToFederationOf(this.player) || this.buildingValue(hx2, { federation: true })) > 0) {
            addHex(hx2);
          } else if (this.faction === "ivits" /* Ivits */ && hx2.belongsToFederationOf(this.player) && hx.belongsToFederationOf(this.player)) {
            addHex(hx2);
          }
        }
      }
    };
    addHex(hex);
    return ret;
  }
  addAdjacentBuildings(hexes, map) {
    return (0, import_lodash13.uniq)([].concat(...hexes.map((hex) => this.buildingGroup(hex, map))));
  }
  /**
   * Check if player can build there, regardless of cost
   * @param hex
   */
  canOccupy(hex) {
    if (hex.colonizedBy(this.player)) {
      return false;
    }
    if (!hex.hasPlanet()) {
      return false;
    }
    if (hex.data.player !== void 0) {
      if (this.faction !== "lantids" /* Lantids */) {
        return false;
      }
      if (!hex.colonizedBy(hex.data.player)) {
        return false;
      }
    }
    return true;
  }
};

// engine/src/algorithms/silent-auction.ts
import assert10 from "node:assert";
var MAX_SILENT_BID = 40;
function silentAuctionBidError(entries, factions2, maxBid = MAX_SILENT_BID) {
  if (entries.length !== factions2.length) {
    return `You have to bid on all ${factions2.length} factions up for auction`;
  }
  const seen = /* @__PURE__ */ new Set();
  for (const entry of entries) {
    if (!factions2.includes(entry.faction)) {
      return `${entry.faction} is not up for auction`;
    }
    if (seen.has(entry.faction)) {
      return `You can only bid once on ${entry.faction}`;
    }
    seen.add(entry.faction);
    if (!Number.isInteger(entry.points) || entry.points < 0) {
      return `Every bid has to be a whole, non-negative number of victory points`;
    }
    if (entry.points > maxBid) {
      return `A bid cannot be higher than ${maxBid} victory points`;
    }
  }
  return null;
}
function resolveSilentAuction(factions2, seatOrder, bids, nominatedFaction, random = Math.random) {
  const maxBid = (player, faction) => bids.find((b) => b.player === player && b.faction === faction)?.max ?? 0;
  const price = new Map(factions2.map((f) => [f, 0]));
  const leader = new Map(factions2.map((f) => [f, void 0]));
  const log = [];
  const costFor = (player, faction) => {
    const lead = leader.get(faction);
    if (lead === player) {
      return price.get(faction);
    }
    return lead === void 0 ? 0 : price.get(faction) + 1;
  };
  const valueFor = (player, faction) => maxBid(player, faction) - costFor(player, faction);
  let consecutiveSkips = 0;
  let turn = 0;
  const maxIterations = seatOrder.length * (Math.max(...bids.map((b) => b.max), 0) + 1) * factions2.length + 1e3;
  for (let i = 0; i < maxIterations && consecutiveSkips < seatOrder.length; i++) {
    const player = seatOrder[turn % seatOrder.length];
    turn++;
    const leadingFaction = factions2.find((f) => leader.get(f) === player);
    const bestValue = Math.max(...factions2.map((f) => valueFor(player, f)));
    if (leadingFaction !== void 0 && valueFor(player, leadingFaction) === bestValue) {
      log.push({ player, faction: leadingFaction, price: price.get(leadingFaction), skipped: true });
      consecutiveSkips++;
      continue;
    }
    let candidates = factions2.filter((f) => valueFor(player, f) === bestValue);
    let tiebreak;
    if (candidates.length > 1) {
      const existing = candidates.filter((f) => leader.get(f) !== void 0);
      if (existing.length > 0 && existing.length < candidates.length) {
        candidates = existing;
        tiebreak = "existing";
      }
    }
    if (candidates.length > 1) {
      const nominated = nominatedFaction.get(player);
      if (nominated && candidates.includes(nominated)) {
        candidates = [nominated];
        tiebreak = "nominated";
      }
    }
    if (candidates.length > 1) {
      candidates = [candidates[Math.floor(random() * candidates.length)]];
      tiebreak = "random";
    }
    const best = candidates[0];
    const newPrice = costFor(player, best);
    price.set(best, newPrice);
    leader.set(best, player);
    consecutiveSkips = 0;
    log.push({ player, faction: best, price: newPrice, skipped: false, tiebreak });
  }
  for (const faction of factions2) {
    assert10(leader.get(faction) !== void 0, `Silent auction did not converge for ${faction}`);
  }
  return { winners: new Map(factions2.map((f) => [f, leader.get(f)])), prices: price, log };
}

// engine/src/available/types.ts
var ISOLATED_DISTANCE = 3;
var UPGRADE_RESEARCH_COST = new Reward(4, "k" /* Knowledge */);
var Offer = class {
  constructor(offer, cost) {
    this.offer = offer;
    this.cost = cost;
  }
};

// engine/src/available/research.ts
function canResearchField(engine, player, field) {
  const destTile = player.data.research[field] + 1;
  if (destTile === lastTile(field) && engine.players.some((p) => p.data.research[field] === destTile)) {
    return false;
  }
  return player.canUpgradeResearch(field);
}
function possibleResearchAreas(engine, player, cost, data) {
  const commands = [];
  const tracks = [];
  const pl = engine.player(player);
  const fields = ResearchField.values(engine.expansions);
  if (cost === null || pl.data.canPay([cost])) {
    let avFields = fields;
    if (data) {
      if (data.bescods) {
        const minArea = Math.min(...fields.map((field) => pl.data.research[field]));
        avFields = fields.filter((field) => pl.data.research[field] === minArea);
      } else if (data.pos) {
        avFields = [data.pos];
      }
    }
    for (const field of avFields) {
      if (canResearchField(engine, pl, field)) {
        tracks.push({
          field,
          to: pl.data.research[field] + 1,
          cost: cost?.toString() ?? ""
        });
      }
    }
  }
  if (tracks.length > 0) {
    commands.push({
      name: "up" /* UpgradeResearch */,
      player,
      data: { tracks }
    });
  }
  if (cost !== UPGRADE_RESEARCH_COST) {
    commands.push({
      name: "decline" /* Decline */,
      player,
      data: { offers: [new Offer("up" /* UpgradeResearch */, null)] }
    });
  }
  return commands;
}
function possibleCoverTechTiles(engine, player) {
  const commands = [];
  const tiles = engine.player(player).data.tiles.techs.filter((tl) => tl.enabled && !isAdvanced(tl.pos));
  commands.push({
    name: "cover" /* ChooseCoverTechTile */,
    player,
    data: { tiles }
  });
  return commands;
}
function canTakeAdvancedTechTile(engine, data, tilePos) {
  if (engine.tiles.techs[tilePos].count <= 0) {
    return false;
  }
  if (!data.hasGreenFederation()) {
    return false;
  }
  if (tilePos === "adv-ext" /* ScoringExtension */) {
    const meetsExtensionCondition = engine.scoringExtensionSide === "ships" /* ExploredShips */ ? data.exploredShipsCount() >= 3 : data.victoryPoints >= 25;
    if (!meetsExtensionCondition) {
      return false;
    }
  } else if (data.research[tilePos.slice("adv-".length)] < 4) {
    return false;
  }
  if (!data.tiles.techs.some((tech) => tech.enabled && !isAdvanced(tech.pos))) {
    return false;
  }
  return true;
}
function possibleTechTiles(engine, player) {
  const commands = [];
  const tiles = [];
  const data = engine.players[player].data;
  for (const tilePos of TechTilePos.values(engine.expansions)) {
    if (!data.tiles.techs.find((tech) => tech.tile === engine.tiles.techs[tilePos].tile)) {
      tiles.push({
        tile: engine.tiles.techs[tilePos].tile,
        pos: tilePos
      });
    }
  }
  for (const tilePos of AdvTechTilePos.values(engine.expansions)) {
    if (canTakeAdvancedTechTile(engine, data, tilePos)) {
      tiles.push({
        tile: engine.tiles.techs[tilePos].tile,
        pos: tilePos
      });
    }
  }
  for (const claimableTech of claimableSpaceshipTechs(data.explorationShips, engine.tiles.spaceshipTechs)) {
    if (!data.tiles.techs.find((tech) => tech.tile === claimableTech.tile)) {
      tiles.push({
        tile: claimableTech.tile,
        pos: claimableTech.ship
      });
    }
  }
  if (tiles.length > 0) {
    commands.push({
      name: "tech" /* ChooseTechTile */,
      player,
      data: { tiles }
    });
  }
  return commands;
}

// engine/src/move/phase.ts
var import_lodash15 = __toESM(require_lodash2());
import assert12 from "node:assert";

// engine/src/move/setup.ts
var import_lodash14 = __toESM(require_lodash2());
import assert11 from "node:assert";
function moveInit(engine, players, seed) {
  assert11(players >= 2 && players <= 5, "Invalid number of players");
  assert11(
    !(engine.options.frontiers && engine.options.lostFleet),
    "Frontiers and Lost Fleet expansions cannot be combined"
  );
  assert11(
    !(engine.options.lostFleet && engine.options.map?.sectors),
    "A custom map configuration cannot be combined with the Lost Fleet expansion"
  );
  assert11(
    !(engine.options.lostFleet && engine.options.customBoardSetup),
    "Custom (drafted) board setup is not supported with the Lost Fleet expansion"
  );
  if (engine.options.auction === "preference-split" /* PreferenceSplit */) {
    const budget = engine.options.auctionBudget ?? defaultPreferenceSplitBudget(players);
    assert11(
      isValidPreferenceSplitBudget(budget),
      `The Preference Split Auction's bid budget must be a whole number between ${MIN_PREFERENCE_SPLIT_BUDGET} and ${MAX_PREFERENCE_SPLIT_BUDGET}, got ${engine.options.auctionBudget}`
    );
    assert11(
      !engine.options.randomFactions,
      "The Preference Split Auction cannot be combined with forced random factions"
    );
  }
  engine.map = new SpaceMap(
    players,
    seed,
    engine.options.map?.mirror ?? false,
    engine.options.layout,
    engine.options.lostFleet,
    engine.options.officialCenterSectors
  );
  if (engine.options.map?.sectors) {
    engine.map.load(engine.options.map);
  }
  engine.options.map = engine.map.placement;
  applyRandomBoardSetup(engine, seed, players);
  if (engine.options.lostFleet) {
    engine.lostFleetTerraformingRow = lostFleetTerraformingBoard(seed);
  }
  BoardAction.values(engine.expansions).forEach((pos) => {
    engine.boardActions[pos] = null;
  });
  engine.players = [];
  engine.setup = [];
  for (let i = 0; i < players; i++) {
    engine.addPlayer(new Player5(engine.expansions, i));
  }
  if (engine.options.randomFactions) {
    const randomFactions = [];
    for (const _ of engine.players) {
      const possible = remainingFactions(randomFactions, engine.expansions);
      randomFactions.push(possible[Math.floor(possible.length * engine.map.rng())]);
    }
    engine.randomFactions = randomFactions;
  }
}
function moveSetup(engine, command, player, type, position, _to, option) {
  applySetupOption(engine, type, position, option);
}
function moveRotateSectors(engine, command, player, ...params) {
  assert11(params.length % 2 === 0, "The rotate command needs an even number of parameters");
  const pairs = [];
  for (let i = 0; i < params.length; i += 2) {
    pairs.push([params[i], params[i + 1]]);
  }
  assert11((0, import_lodash14.uniq)(pairs.map((pair) => pair[0])).length === params.length / 2, "Duplicate rotations are not allowed");
  for (const pair of pairs) {
    engine.map.rotateSector(pair[0], +pair[1]);
  }
  engine.map.recalibrate();
  assert11(engine.map.isValid(), "Map is invalid with two planets for the same type being near each other");
}
function moveChooseFaction(engine, command, player, faction) {
  assert11(command.data.includes(faction), `${faction} is not in the available factions`);
  engine.setup.push(faction);
  if (engine.options.auction !== "choose-bid" /* ChooseBid */) {
    executeBid(engine, player, faction, 0);
  }
}
function moveBid(engine, command, player, faction, bid) {
  if (!engine.replay) {
    const bidsAC = command.data.bids;
    const bidAC = bidsAC.find((b) => b.faction === faction);
    assert11(bidAC, `${faction} is not in the available factions`);
    assert11(bidAC.bid.includes(+bid), "You have to bid the right amount");
  }
  executeBid(engine, player, faction, bid);
}
function executeBid(engine, player, faction, bid) {
  const previous = engine.players.find((s) => s.faction === faction);
  if (previous) {
    previous.faction = void 0;
  }
  engine.players[player].faction = faction;
  engine.players[player].data.bid = +bid;
}
function moveBanFaction(engine, command, player, faction) {
  assert11(command.data.includes(faction), `${faction} is not available to ban`);
  engine.bannedFactions.push(faction);
}
function moveSilentBid(engine, command, player, ...params) {
  assert11(params.length % 2 === 0, "The silentBid command needs an even number of parameters");
  const entries = [];
  for (let i = 0; i < params.length; i += 2) {
    assert11(/^\d+$/.test(params[i + 1]), `"${params[i + 1]}" is not a whole, non-negative bid`);
    entries.push({ faction: params[i], points: +params[i + 1] });
  }
  assert11(
    (0, import_lodash14.uniq)(entries.map((entry) => entry.faction)).length === entries.length,
    "Duplicate factions are not allowed in a silent bid"
  );
  assert11(
    !engine.silentAuctionBids.some((bid) => bid.player === player),
    `Player ${player} has already submitted their bids`
  );
  const error = silentAuctionBidError(entries, engine.setup);
  assert11(error === null, error);
  for (const entry of entries) {
    engine.silentAuctionBids.push({ player, faction: entry.faction, max: entry.points });
  }
}
function movePreferenceBid(engine, command, player, ...params) {
  assert11(params.length % 2 === 0, "The preferenceBid command needs an even number of parameters");
  const entries = [];
  for (let i = 0; i < params.length; i += 2) {
    assert11(/^\d+$/.test(params[i + 1]), `"${params[i + 1]}" is not a whole, non-negative number of bid points`);
    entries.push({ faction: params[i], points: +params[i + 1] });
  }
  assert11(
    !engine.preferenceSplitBids.some((bid) => bid.player === player),
    `Player ${player} has already submitted their bids`
  );
  const error = preferenceSplitBidError(entries, engine.setup, engine.preferenceSplitBudget);
  assert11(error === null, error);
  for (const entry of entries) {
    engine.preferenceSplitBids.push({ player, faction: entry.faction, points: entry.points });
  }
}

// engine/src/move/phase.ts
function phaseSetupInit(engine, move) {
  const split = move.split(" ");
  const command = split.shift();
  assert12(command === "init" /* Init */, "The first command of a game needs to be the initialization command");
  const players = split.shift();
  moveInit(engine, +players || 2, split.shift() || "defaultSeed");
  beginSetupBoardPhase(engine);
}
function phaseSetupBoard(engine, move) {
  engine.loadTurnMoves(move, { split: false, processFirst: true });
  if (possibleSetupBoardActions(engine, engine.currentPlayer).length === 0 || move.includes("rotate" /* RotateSectors */)) {
    beginSetupFactionPhaseOrBan(engine);
  }
}
function phaseSetupFactionBan(engine, move) {
  engine.loadTurnMoves(move, { split: false, processFirst: true });
  if (!engine.moveToNextPlayer(engine.turnOrder, { loop: false })) {
    beginSetupFactionPhase(engine);
  }
}
function phaseSetupFaction(engine, move) {
  engine.loadTurnMoves(move, { split: false, processFirst: true });
  if (engine.isVersionOrLater("4.7.0") && engine.options.auction === "bid-while-choosing" /* BidWhileChoosing */) {
    moveToNextPlayerWithoutAChosenFaction(engine);
    return;
  }
  if (!engine.moveToNextPlayer(engine.turnOrder, { loop: false })) {
    if (engine.options.auction === "silent" /* Silent */) {
      beginSetupSilentBidPhase(engine);
    } else if (engine.options.auction === "preference-split" /* PreferenceSplit */) {
      beginSetupPreferenceBidPhase(engine);
    } else if (engine.options.auction) {
      beginSetupAuctionPhase(engine);
    } else {
      endSetupFactionPhase(engine);
    }
  }
}
function phaseSetupAuction(engine, move) {
  engine.loadTurnMoves(move, { processFirst: true });
  moveToNextPlayerWithoutAChosenFaction(engine);
}
function phaseSetupSilentBid(engine, move) {
  engine.loadTurnMoves(move, { split: false, processFirst: true });
  if (!engine.moveToNextPlayer(engine.turnOrder, { loop: false })) {
    const nominatedFaction = new Map(engine.players.map((pl) => [pl.player, pl.faction]));
    const result = resolveSilentAuction(
      engine.setup,
      engine.players.map((pl) => pl.player),
      engine.silentAuctionBids,
      nominatedFaction,
      () => engine.map.rng()
    );
    engine.silentAuctionLog = result.log;
    for (const player of engine.players) {
      player.faction = void 0;
    }
    for (const faction of engine.setup) {
      const winner = engine.player(result.winners.get(faction));
      winner.faction = faction;
      winner.data.bid = result.prices.get(faction);
    }
    endSetupFactionPhase(engine);
  }
}
function phaseSetupPreferenceBid(engine, move) {
  engine.loadTurnMoves(move, { split: false, processFirst: true });
  if (!engine.moveToNextPlayer(engine.turnOrder, { loop: false })) {
    resolvePreferenceSplitPhase(engine);
    endSetupFactionPhase(engine);
  }
}
function resolvePreferenceSplitPhase(engine) {
  if (engine.preferenceSplitResult) {
    return;
  }
  const result = resolvePreferenceSplitAuction(
    engine.setup,
    engine.players.map((pl) => pl.player),
    engine.preferenceSplitBids,
    engine.preferenceSplitBudget,
    () => engine.map.rng()
  );
  engine.preferenceSplitResult = result;
  for (const player of engine.players) {
    player.faction = void 0;
  }
  for (const allocation of result.allocations) {
    const winner = engine.player(allocation.winner);
    winner.faction = allocation.faction;
    winner.data.bid = allocation.payment;
  }
}
function moveToNextPlayerWithoutAChosenFaction(engine) {
  const player = [...(0, import_lodash15.range)(engine.currentPlayer + 1, engine.players.length), ...(0, import_lodash15.range)(0, engine.currentPlayer)].find(
    (player2) => !engine.players.some((pl) => pl.player === player2 && pl.faction)
  );
  if (player !== void 0) {
    engine.currentPlayer = player;
  } else {
    endSetupFactionPhase(engine);
  }
}
function phaseSetupBuilding(engine, move) {
  engine.loadTurnMoves(move, { split: false, processFirst: true });
  if (!engine.moveToNextPlayer(engine.turnOrder, { loop: false })) {
    beginSetupBoosterPhase(engine);
  }
}
function phaseSetupBooster(engine, move) {
  engine.loadTurnMoves(move, { split: false, processFirst: true });
  if (!engine.moveToNextPlayer(engine.turnOrder, { loop: false })) {
    beginRoundStartPhase(engine);
  }
}
function phaseRoundIncome(engine, move) {
  engine.loadTurnMoves(move, { processFirst: true });
  while (!handleNextIncome(engine)) {
    engine.generateAvailableCommands();
    engine.processNextMove();
  }
}
function phaseRoundGaia(engine, move) {
  engine.loadTurnMoves(move, { processFirst: true });
  while (!handleNextGaia(engine, true)) {
    engine.generateAvailableCommands();
    engine.processNextMove();
  }
}
function phaseRoundMove(engine, move) {
  const pl = engine.player(engine.playerToMove);
  pl.data.turns = 1;
  engine.loadTurnMoves(move);
  const playerAfter = engine.getNextPlayer();
  while (pl.data.turns > 0) {
    pl.resetTemporaryVariables();
    engine.doFreeActions("beforeMove" /* BeforeMove */);
    const executedCommand = engine.handleMainMove();
    pl.resetTemporaryVariables();
    pl.data.turns -= 1;
    if (executedCommand === "pass" /* Pass */) {
      if (engine.turnOrder.length === 0) {
        cleanUpPhase(engine);
        return;
      } else {
        break;
      }
    } else if (pl.data.turns <= 0) {
      engine.doFreeActions("afterMove" /* AfterMove */);
      engine.handleEndTurn();
    } else {
      engine.generateAvailableCommands();
    }
  }
  beginLeechingPhase(engine);
  engine.currentPlayer = playerAfter;
}
function phaseRoundLeech(engine, move) {
  engine.loadTurnMoves(move, { split: false, processFirst: true });
  engine.tempCurrentPlayer = engine.tempTurnOrder.shift();
  if (engine.tempCurrentPlayer === void 0) {
    beginLeechingPhase(engine);
  }
}
function beginSetupBoardPhase(engine) {
  engine.changePhase("setupBoard" /* SetupBoard */);
  if (engine.options.customBoardSetup) {
    initCustomSetup(engine);
    engine.currentPlayer = engine.players[engine.options.creator ?? 0].player;
  } else if (engine.options.advancedRules) {
    engine.currentPlayer = engine.players.slice(-1).pop().player;
  } else {
    beginSetupFactionPhaseOrBan(engine);
  }
}
function beginSetupFactionPhaseOrBan(engine) {
  const banPhase = engine.options.banPhase ?? engine.options.auction === "silent" /* Silent */;
  if (banPhase) {
    beginSetupFactionBanPhase(engine);
  } else {
    beginSetupFactionPhase(engine);
  }
}
function beginSetupFactionBanPhase(engine) {
  engine.changePhase("setupFactionBan" /* SetupFactionBan */);
  engine.turnOrder = engine.players.map((pl) => pl.player);
  engine.moveToNextPlayer(engine.turnOrder, { loop: false });
}
function beginSetupSilentBidPhase(engine) {
  engine.changePhase("setupSilentBid" /* SetupSilentBid */);
  engine.turnOrder = engine.players.map((pl) => pl.player);
  engine.moveToNextPlayer(engine.turnOrder, { loop: false });
}
function beginSetupPreferenceBidPhase(engine) {
  engine.changePhase("setupPreferenceBid" /* SetupPreferenceBid */);
  engine.turnOrder = engine.players.map((pl) => pl.player);
  engine.moveToNextPlayer(engine.turnOrder, { loop: false });
}
function beginSetupFactionPhase(engine) {
  engine.changePhase("setupFaction" /* SetupFaction */);
  engine.turnOrder = engine.players.map((pl) => pl.player);
  engine.moveToNextPlayer(engine.turnOrder, { loop: false });
}
function beginSetupAuctionPhase(engine) {
  engine.changePhase("setupAuction" /* SetupAuction */);
  engine.turnOrder = engine.players.map((pl) => pl.player);
  engine.moveToNextPlayer(engine.turnOrder, { loop: false });
}
function endSetupFactionPhase(engine) {
  for (const pl of engine.players) {
    if (!pl.faction) {
      pl.faction = engine.setup[pl.player];
    }
    const faction = pl.faction;
    const board = pl.variant ?? factionVariantBoard(engine.factionCustomization, faction);
    pl.loadFaction(board, engine.expansions, false, engine.players.length, engine.lostFleetEconomySide);
  }
  if (engine.options.lostFleet) {
    const terraformingRow = engine.lostFleetTerraformingRow ?? lostFleetTerraformingBoard(engine.map.seed);
    const cost3Planets = lostFleetTerraformingCost3Planets(
      engine.players.map((pl) => ({ player: pl.player, faction: pl.faction })),
      engine.turnOrderAfterSetupAuction,
      terraformingRow
    );
    for (const [player, planets] of Object.entries(cost3Planets)) {
      engine.player(+player).data.lostFleetCost3Planets = [...planets];
    }
    for (const pl of engine.players) {
      if (pl.faction === "moweyds" /* Moweyds */) {
        pl.data.explorationShips["tfmars" /* TFMars */] = 1;
      }
    }
  }
  beginSetupBuildingPhase(engine);
}
function beginSetupBuildingPhase(engine) {
  engine.changePhase("setupBuilding" /* SetupBuilding */);
  const posIvits = engine.players.findIndex((player) => player.faction === "ivits" /* Ivits */);
  const baseSetupTurnOrder = engine.turnOrderAfterSetupAuction.filter(
    (player) => lostFleetSetupStage(engine.players[player].faction) === 1
  );
  const reverseSetupTurnOrder = baseSetupTurnOrder.slice().reverse().filter((player) => startingSetupPlacements(engine.players[player].faction) >= 2);
  const extraSetupTurnOrder = baseSetupTurnOrder.filter(
    (player) => startingSetupPlacements(engine.players[player].faction) >= 3
  );
  const expansionSetupTurnOrder = engine.turnOrderAfterSetupAuction.filter(
    (player) => lostFleetSetupStage(engine.players[player].faction) === 2
  );
  engine.turnOrder = baseSetupTurnOrder.concat(reverseSetupTurnOrder, extraSetupTurnOrder, expansionSetupTurnOrder);
  if (posIvits !== -1) {
    if (engine.players.length === 2 && engine.factionCustomization.variant === "more-balanced") {
      const first = engine.turnOrder.shift();
      engine.turnOrder.unshift(posIvits);
      engine.turnOrder.unshift(first);
    } else {
      engine.turnOrder.push(posIvits);
    }
  }
  engine.moveToNextPlayer(engine.turnOrder, { loop: false });
}
function beginSetupBoosterPhase(engine) {
  engine.changePhase("setupBooster" /* SetupBooster */);
  engine.turnOrder = engine.turnOrderAfterSetupAuction.reverse();
  engine.moveToNextPlayer(engine.turnOrder, { loop: false });
}
function beginRoundStartPhase(engine) {
  engine.round += 1;
  engine.addAdvancedLog({ round: engine.round });
  engine.turnOrder = engine.passedPlayers || engine.turnOrderAfterSetupAuction;
  engine.passedPlayers = [];
  engine.currentPlayer = engine.turnOrder[0];
  for (const player of engine.playersInOrder()) {
    player.loadEvents(engine.currentRoundScoringEvents);
    player.data.ships?.forEach((s) => {
      s.moved = false;
    });
  }
  beginIncomePhase(engine);
}
function handleNextIncome(engine) {
  const pl = engine.player(engine.currentPlayer);
  if (pl.needsTinkeringTileChoice(engine.round)) {
    return false;
  }
  if (pl.incomeSelection().needed) {
    return false;
  }
  pl.receiveIncome(pl.events["+" /* Income */]);
  if (!engine.moveToNextPlayer(engine.tempTurnOrder, { loop: false })) {
    endIncomePhase(engine);
  } else {
    handleNextIncome(engine);
  }
  return true;
}
function handleNextGaia(engine, afterCommand = false) {
  const player = engine.player(engine.currentPlayer);
  if (!afterCommand) {
    player.declined = false;
  }
  if (!player.declined && (player.canGaiaTerrans() || player.canGaiaItars())) {
    return false;
  }
  player.gaiaPhaseEnd();
  if (!engine.moveToNextPlayer(engine.tempTurnOrder, { loop: false })) {
    endGaiaPhase(engine);
  } else {
    handleNextGaia(engine);
  }
  return true;
}
function beginIncomePhase(engine) {
  engine.changePhase("roundIncome" /* RoundIncome */);
  engine.addAdvancedLog({ phase: "roundIncome" /* RoundIncome */ });
  engine.tempTurnOrder = [...engine.turnOrder];
  engine.moveToNextPlayer(engine.tempTurnOrder, { loop: false });
  handleNextIncome(engine);
}
function endIncomePhase(engine) {
  for (const player of engine.playersInOrder()) {
    player.removeRoundBoosterEvents("+" /* Income */);
  }
  beginGaiaPhase(engine);
}
function beginGaiaPhase(engine) {
  engine.changePhase("roundGaia" /* RoundGaia */);
  engine.addAdvancedLog({ phase: "roundGaia" /* RoundGaia */ });
  engine.tempTurnOrder = [...engine.turnOrder];
  for (const hex of engine.map.toJSON()) {
    if (hex.data.planet === "m" /* Transdim */ && hex.data.player !== void 0 && hex.data.building === "gf" /* GaiaFormer */) {
      hex.data.planet = "g" /* Gaia */;
    }
  }
  engine.moveToNextPlayer(engine.tempTurnOrder, { loop: false });
  handleNextGaia(engine);
}
function endGaiaPhase(engine) {
  engine.currentPlayer = engine.turnOrder[0];
  beginRoundMovePhase(engine);
  engine.addAdvancedLog({ phase: "roundMove" /* RoundMove */ });
}
function beginRoundMovePhase(engine) {
  engine.changePhase("roundMove" /* RoundMove */);
}
function cleanUpPhase(engine) {
  for (const player of engine.players) {
    player.removeEvents(engine.currentRoundScoringEvents);
    player.removeCurrentTinkeringTile();
    for (const event of player.events["=>" /* Activate */]) {
      event.activated = false;
    }
  }
  BoardAction.values(engine.expansions).forEach((pos) => {
    engine.boardActions[pos] = null;
  });
  engine.spaceshipActions = {};
  if (engine.isLastRound) {
    finalScoringPhase(engine);
  } else {
    beginRoundStartPhase(engine);
  }
}
function finalScoringPhase(engine) {
  engine.changePhase("endGame" /* EndGame */);
  engine.addAdvancedLog({ phase: "endGame" /* EndGame */ });
  engine.currentPlayer = engine.tempCurrentPlayer = void 0;
  const allRankings = finalRankings(engine.tiles.scorings.final, engine.players, engine.expansions);
  for (const player of engine.players) {
    gainFinalScoringVictoryPoints(allRankings, player);
    player.data.gainResearchVictoryPoints();
    player.data.finalResourceHandling();
    player.gainRewards([new Reward(Math.max(Math.floor(-1 * player.data.bid)), "vp" /* VictoryPoint */)], "bid" /* Bid */);
  }
}
function beginLeechingPhase(engine) {
  if (engine.leechSources.length === 0) {
    beginRoundMovePhase(engine);
    return;
  }
  const source = engine.leechSources.shift();
  const sourceHex = engine.map.getS(source.coordinates);
  const canLeechPlayers = [];
  engine.lastLeechSource = source;
  if (stdBuildingValue(sourceHex.buildingOf(source.player)) === 0) {
    return beginLeechingPhase(engine);
  }
  for (const pl of engine.playersInTableOrderFrom(source.player)) {
    if (source.player === pl.player) {
      pl.data.leechPossible = 0;
      continue;
    }
    pl.data.leechPossible = leechPossible(
      engine,
      sourceHex,
      (hex) => pl.buildingValue(engine.map.grid.get(hex), {
        building: hex.buildingOf(pl.player) ?? (hex.customPosts.some((c) => c === pl.player) ? "customsPost" /* CustomsPost */ : null)
      })
    );
    if (pl.canLeech()) {
      canLeechPlayers.push(pl);
    }
  }
  if (canLeechPlayers.length > 0) {
    engine.changePhase("roundLeech" /* RoundLeech */);
    engine.tempTurnOrder = canLeechPlayers.map((pl) => pl.player);
    engine.tempCurrentPlayer = engine.tempTurnOrder.shift();
  } else {
    return beginLeechingPhase(engine);
  }
}
function leechPossible(engine, sourceHex, buildingValue) {
  let leech = 0;
  for (const hex of engine.map.withinDistance(sourceHex, LEECHING_DISTANCE)) {
    leech = Math.max(leech, buildingValue(hex));
  }
  return leech;
}
function advanceResearchAreaPhase(engine, player, cost, field) {
  const pl = engine.player(player);
  if (!pl.canUpgradeResearch(field)) {
    return;
  }
  const destTile = pl.data.research[field] + 1;
  if (destTile === lastTile(field)) {
    if (engine.players.some((pl2) => pl2.data.research[field] === destTile)) {
      return;
    }
  }
  pl.payCosts(Reward.parse(cost), "up" /* UpgradeResearch */);
  pl.gainRewards([new Reward(`${"up" /* UpgradeResearch */}-${field}`)], "up" /* UpgradeResearch */);
  if (pl.data.research[field] === lastTile(field)) {
    if (field === "terra" /* Terraforming */) {
      if (engine.terraformingFederation) {
        pl.gainFederationToken(engine.terraformingFederation);
        engine.terraformingFederation = void 0;
      }
    } else if (field === "nav" /* Navigation */) {
      engine.processNextMove("placeLostPlanet" /* PlaceLostPlanet */);
    }
  }
}

// engine/src/tiles/artifacts.ts
var artifactTokenSpec = {
  ["artifact-knowledgeore" /* KnowledgeOre */]: "Ongoing: gain an extra 1 knowledge + 1 ore every income phase.",
  ["artifact-credit" /* Credit */]: "Immediately gain 3 credits + 3 ore.",
  ["artifact-knowledgeqic" /* KnowledgeQic */]: "Immediately gain 3 knowledge + 1 Q.I.C.",
  ["artifact-creditlarge" /* CreditLarge */]: "Immediately gain 5 credits + 2 ore.",
  ["artifact-power" /* Power */]: "Ongoing: gain an extra 2 power every income phase, placed directly in Area III.",
  ["artifact-asteroid" /* Asteroid */]: "Immediately and only once gain 7 VP; counts as building a mine and colonizing an Asteroid (no sector allocation, no mine physically placed).",
  ["artifact-protoplanet" /* Protoplanet */]: "Immediately and only once gain 7 VP; counts as building a mine and colonizing a Protoplanet (no sector allocation, no 6 VP protoplanet bonus, no mine physically placed).",
  ["artifact-researchlevel" /* ResearchLevel */]: (
    // VERIFY: rules text's owner-comment on which Research Area this token uses was cut off mid-sentence
    // (RULES_CLARIFICATIONS.md §G6); assuming ResearchField.Science as the closest match to "Knowledge-themed".
    "Immediately and only once gain 3 VP per level reached in the matching Research Area."
  ),
  ["artifact-researchtracks" /* ResearchTracks */]: "Immediately and only once gain 3 VP for each Research Area at level 3 or higher.",
  ["artifact-federation" /* Federation */]: "Re-score (re-trigger) a Federation token you already own.",
  ["artifact-gaiaproject" /* GaiaProject */]: "Immediately and only once gain 3 VP per step up the Gaiaforming track.",
  ["artifact-planettypes" /* PlanetTypes */]: "Immediately and only once gain 3 VP + 1 VP per planet type colonized.",
  ["artifact-deepspace" /* DeepSpace */]: "Immediately and only once gain 3 VP per Deep Space sector colonized."
};
var artifactTokenRewards = {
  ["artifact-knowledgeore" /* KnowledgeOre */]: "+k,o",
  ["artifact-credit" /* Credit */]: "3c,3o",
  ["artifact-knowledgeqic" /* KnowledgeQic */]: "3k,q",
  ["artifact-creditlarge" /* CreditLarge */]: "5c,2o",
  // Income (every round), straight into Area 3 - same primitive Xenos's free action uses
  // (actions.ts's OreToPowerTokenArea3, "1ta3"), just as a recurring Income-operator reward
  // instead of a one-time grant.
  ["artifact-power" /* Power */]: "+2ta3",
  ["artifact-federation" /* Federation */]: ">fed"
};

// engine/src/buildings.ts
function upgradedBuildings(currentBuilding, faction) {
  switch (currentBuilding) {
    case "gf" /* GaiaFormer */:
      return ["m" /* Mine */];
    case "m" /* Mine */:
      return ["ts" /* TradingStation */];
    case "ts" /* TradingStation */:
      return faction === "bescods" /* Bescods */ ? ["ac1" /* Academy1 */, "ac2" /* Academy2 */, "lab" /* ResearchLab */] : ["PI" /* PlanetaryInstitute */, "lab" /* ResearchLab */];
    case "lab" /* ResearchLab */:
      return faction === "bescods" /* Bescods */ ? ["PI" /* PlanetaryInstitute */] : ["ac1" /* Academy1 */, "ac2" /* Academy2 */];
  }
  return [];
}
function stdBuildingValue(building) {
  switch (building) {
    case "m" /* Mine */:
    case "customsPost" /* CustomsPost */:
      return 1;
    case "ts" /* TradingStation */:
    case "lab" /* ResearchLab */:
      return 2;
    case "PI" /* PlanetaryInstitute */:
    case "ac1" /* Academy1 */:
    case "ac2" /* Academy2 */:
    case "colony" /* Colony */:
      return 3;
  }
  return 0;
}

// engine/src/available/buildings.ts
function newAvailableBuilding(building, hex, canBuild, upgrade) {
  return {
    building,
    coordinates: hex.toString(),
    cost: Reward.toString(canBuild.cost),
    warnings: canBuild.warnings,
    steps: canBuild.steps,
    upgrade
  };
}
function addPossibleNewPlanet(map, hex, pl, planet, building, buildings, lastRound, replay) {
  const qicNeeded = qicForDistance(map, hex, pl, replay);
  if (qicNeeded === null) {
    return;
  }
  const check = pl.canBuild(map, hex, planet, building, lastRound, replay, {
    addedCost: [new Reward(qicNeeded.amount, "q" /* Qic */)]
  });
  if (check) {
    switch (pl.faction) {
      case "geodens" /* Geodens */:
        if (building === "m" /* Mine */ && !pl.data.hasPlanetaryInstitute() && pl.data.isNewPlanetType(hex)) {
          check.warnings.push("geodens-build-without-PI" /* geodensBuildWithoutPi */);
        }
        break;
      case "lantids" /* Lantids */:
        if (hex.occupied() && building === "m" /* Mine */) {
          if (pl.data.occupied.filter((hex2) => hex2.data.additionalMine !== void 0).length === pl.maxBuildings("m" /* Mine */) - 1) {
            check.warnings.push("lantids-deadlock" /* lantidsDeadlock */);
          }
          if (!pl.data.hasPlanetaryInstitute()) {
            check.warnings.push("lantids-build-without-PI" /* lantidsBuildWithoutPi */);
          }
        }
        break;
    }
    const availableBuilding = newAvailableBuilding(building, hex, check, false);
    if (qicNeeded.warning) {
      availableBuilding.warnings.push(qicNeeded.warning);
    }
    buildings.push(availableBuilding);
  }
}
function possibleBuildings(engine, player) {
  const map = engine.map;
  const pl = engine.player(player);
  const buildings = [];
  for (const hex of engine.map.toJSON()) {
    const building = hex.buildingOf(player);
    if (building) {
      if (hex.data.planet === "m" /* Transdim */) {
        continue;
      }
      if (hex.isRangeStartingPoint(player) && hasExpansion(engine.expansions, 2 /* Frontiers */)) {
        buildings.push(...possibleShips(pl, engine, map, hex));
      }
      if (player !== hex.data.player) {
        continue;
      }
      if (hex.data.planet === "l" /* Lost */) {
        continue;
      }
      const isolated = (() => {
        if (building !== "m" /* Mine */) {
          return true;
        }
        for (const _pl of engine.players) {
          if (_pl !== pl) {
            for (const loc of _pl.data.occupied) {
              if (loc.hasStructure() && map.distance(loc, hex) < ISOLATED_DISTANCE) {
                return false;
              }
            }
          }
        }
        return true;
      })();
      const upgraded = upgradedBuildings(building, pl.faction);
      for (const upgrade of upgraded) {
        const check = pl.canBuild(map, hex, hex.data.planet, upgrade, engine.isLastRound, engine.replay, {
          isolated,
          existingBuilding: building
        });
        if (check) {
          buildings.push(newAvailableBuilding(upgrade, hex, check, true));
        }
      }
    } else if (pl.canOccupy(hex)) {
      const planet = hex.occupied() ? pl.planet : hex.data.planet;
      const building2 = hex.data.planet === "m" /* Transdim */ ? "gf" /* GaiaFormer */ : "m" /* Mine */;
      addPossibleNewPlanet(map, hex, pl, planet, building2, buildings, engine.isLastRound, engine.replay);
    }
  }
  if (buildings.length > 0) {
    return [
      {
        name: "build" /* Build */,
        player,
        data: { buildings: (0, import_lodash16.uniq)(buildings) }
        //ship locations may be duplicated
      }
    ];
  }
  return [];
}
function possibleSpaceStations(engine, player) {
  const map = engine.map;
  const pl = engine.player(player);
  const buildings = [];
  for (const hex of map.toJSON()) {
    if (hex.hasSpaceship() || hex.occupied() || hex.hasPlanet() || hex.belongsToFederationOf(player)) {
      continue;
    }
    addPossibleNewPlanet(map, hex, pl, pl.planet, "sp" /* SpaceStation */, buildings, engine.isLastRound, engine.replay);
  }
  if (buildings.length > 0) {
    return [{ name: "build" /* Build */, player, data: { buildings } }];
  }
  return [];
}
function possibleMineBuildings(engine, player, acceptGaiaFormer, data) {
  if (data && data.buildings) {
    return [{ name: "build" /* Build */, player, data }];
  }
  const commands = [];
  const [buildingCommand] = possibleBuildings(engine, player);
  if (buildingCommand) {
    buildingCommand.data.buildings = buildingCommand.data.buildings.filter((bld) => {
      if (bld.upgrade) {
        return false;
      }
      if (bld.building === "m" /* Mine */) {
        return true;
      }
      return acceptGaiaFormer && bld.building === "gf" /* GaiaFormer */;
    });
    if (buildingCommand.data.buildings.length > 0) {
      commands.push(buildingCommand);
    }
  }
  return commands;
}
function possibleLabDowngrades(engine, player) {
  const pl = engine.player(player);
  const spots = pl.data.occupied.filter((hex) => hex.buildingOf(player) === "lab" /* ResearchLab */);
  if (!spots) {
    return [];
  }
  return [
    {
      name: "build" /* Build */,
      player,
      data: {
        buildings: spots.map((hex) => ({
          building: "ts" /* TradingStation */,
          coordinates: hex.toString(),
          cost: "~",
          downgrade: true
        }))
      }
    }
  ];
}
function possibleSpaceLostPlanet(engine, player) {
  const commands = [];
  const p = engine.player(player);
  const data = p.data;
  const spaces = [];
  for (const hex of engine.map.toJSON()) {
    if (hex.hasSpaceship() || hex.data.planet !== "e" /* Empty */ || hex.data.federations || hex.data.building) {
      continue;
    }
    const qicNeeded = qicForDistance(engine.map, hex, p, engine.replay);
    if (qicNeeded.amount > data.qics) {
      continue;
    }
    spaces.push({
      coordinates: hex.toString(),
      cost: qicNeeded.amount > 0 ? new Reward(qicNeeded.amount, "q" /* Qic */).toString() : "~",
      warnings: qicNeeded.warning ? [qicNeeded.warning] : null
    });
  }
  if (spaces.length > 0) {
    commands.push({
      name: "lostPlanet" /* PlaceLostPlanet */,
      player,
      data: { spaces }
    });
  }
  return commands;
}
function possiblePISwaps(engine, player) {
  const commands = [];
  const data = engine.player(player).data;
  const buildings = [];
  for (const hex of data.occupied) {
    if (hex.buildingOf(player) === "m" /* Mine */ && hex.data.planet !== "l" /* Lost */) {
      buildings.push({
        building: "m" /* Mine */,
        coordinates: hex.toString(),
        warnings: hex.belongsToFederationOf(player) ? ["ambas-swap-into-federation" /* ambasSwapIntoFederation */] : null
      });
    }
  }
  if (buildings.length > 0) {
    commands.push({
      name: "swap-PI" /* PISwap */,
      player,
      data: { buildings }
    });
  }
  return commands;
}

// engine/src/available/ships.ts
var MAX_SHIPS_PER_HEX = 3;
var SHIP_ACTION_RANGE = 1;
var TRADE_COST = 3;
var tradeOptions = [
  {
    buildings: ["m" /* Mine */],
    domestic: true,
    free: true,
    base: Reward.parse("1o"),
    bonus: []
  },
  {
    buildings: ["m" /* Mine */],
    base: [],
    bonus: Reward.parse("1c,1o"),
    build: "customsPost" /* CustomsPost */
  },
  {
    buildings: ["ts" /* TradingStation */],
    base: Reward.parse("5c"),
    bonus: Reward.parse("3c,1pw")
  },
  {
    buildings: ["lab" /* ResearchLab */],
    base: Reward.parse("2k"),
    bonus: Reward.parse("1k")
  },
  {
    buildings: ["ac1" /* Academy1 */, "ac2" /* Academy2 */],
    base: Reward.parse("2k"),
    bonus: Reward.parse("1k"),
    researchAdvancementBonus: true
  },
  {
    buildings: ["PI" /* PlanetaryInstitute */],
    base: Reward.parse("1t,2pw"),
    bonus: Reward.parse("4pw")
  },
  {
    buildings: ["colony" /* Colony */],
    base: Reward.parse("3vp"),
    bonus: Reward.parse("2vp")
  }
];
function shipsInHex(location, data) {
  return data.players.flatMap((p) => p.data.ships).filter((s) => s.location === location);
}
function possibleShips(pl, engine, map, hex) {
  const buildings = [];
  for (const ship of Building.ships()) {
    const check = pl.canBuild(null, null, null, ship, engine.isLastRound, engine.replay);
    if (check) {
      for (const h of map.withinDistance(hex, 1)) {
        if (!h.hasPlanet() && shipsInHex(h.toString(), engine).length < MAX_SHIPS_PER_HEX) {
          buildings.push(newAvailableBuilding(ship, h, check, false));
        }
      }
    }
  }
  return buildings;
}
function shipTargets(source, hex, range4, targets, engine) {
  if (!targets.find((t) => t.coordinates === hex) && (shipsInHex(hex, engine).length < MAX_SHIPS_PER_HEX || source === hex)) {
    targets.push({ coordinates: hex });
  }
  if (range4 === 0) {
    return targets;
  }
  const map = engine.map;
  for (const h of map.withinDistance(map.getS(hex), 1)) {
    const c = h.toString();
    if (!h.hasPlanet() && c !== source) {
      shipTargets(source, c, range4 - 1, targets, engine);
    }
  }
  return targets;
}
function possibleShipActionsOfType(engine, ship, shipLocation, type, allowDecline, locationFactory) {
  const map = engine.map;
  const locations = map.withinDistance(map.getS(shipLocation), SHIP_ACTION_RANGE).flatMap((h) => locationFactory(h));
  const actions = [];
  if (locations.length > 0) {
    actions.push({
      type,
      locations
    });
  }
  if (allowDecline) {
    actions.push({
      type: "nothing" /* Nothing */,
      locations: []
    });
  }
  return actions;
}
function tradeBonus(data, option) {
  let rewards = [];
  for (let i = 0; i < data.tradeBonus; i++) {
    rewards = Reward.merge(rewards.concat(option.bonus));
  }
  return rewards;
}
function isFurther(guest, host) {
  return ResearchField.values(6 /* All */).filter((f) => host[f] > guest[f]).length;
}
function baseTradeReward(option, guest, host) {
  if (option.researchAdvancementBonus) {
    const base = option.base[0];
    return [new Reward(Math.max(base.count, isFurther(guest.research, host.research)), base.type)];
  }
  return option.base;
}
function tradeLocation(cost, rewards, target) {
  return {
    ...target,
    tradeCost: cost.toStringWithZero(),
    rewards: rewards.map((r) => r.toStringWithZero()).join(",")
  };
}
function possibleBuilding(engine, h, player, building, rewards, cost) {
  const p = engine.player(player);
  const canBuildAfterTrade = p.canBuild(engine.map, h, h.data.planet, building, engine.isLastRound, engine.replay, {
    addedCost: Reward.negative(rewards)
  });
  if (canBuildAfterTrade) {
    canBuildAfterTrade.cost = p.board.cost(building, false);
    const availableBuilding = newAvailableBuilding(building, h, canBuildAfterTrade, false);
    return [tradeLocation(cost, rewards, availableBuilding)];
  }
  return [];
}
function tradeRewards(option, guest, host) {
  return Reward.merge(baseTradeReward(option, guest, host).concat(tradeBonus(guest, option)));
}
function tradeCost(guest, option) {
  return option.free ? new Reward(0, "pw" /* ChargePower */) : guest.tradeCost();
}
function tradeLocations(h, player, engine) {
  const p = engine.player(player);
  if (h.hasStructure() && !h.tradeTokens.some((t) => t === player) && !h.customPosts.some((t) => t === player)) {
    const building = h.data.building;
    const host = engine.player(h.data.player).data;
    const guest = p.data;
    const domestic = h.data.player === player;
    const option = tradeOptions.find((o) => o.buildings.includes(building) && !!o.domestic === domestic);
    if (option) {
      const cost = tradeCost(guest, option);
      if (engine.player(player).data.canPay([cost])) {
        const rewards = tradeRewards(option, guest, host);
        return option.build ? possibleBuilding(engine, h, player, option.build, rewards, cost) : [tradeLocation(cost, rewards, { coordinates: h.toString() })];
      }
    }
  }
  return [];
}
function colonyActions(engine, ship, h) {
  const player = engine.player(ship.player);
  const existingBuilding = h.buildingOf(player.player);
  if (h.hasPlanet() && h.data.planet !== "m" /* Transdim */ && (!h.occupied() || existingBuilding === "gf" /* GaiaFormer */)) {
    const check = player.canBuild(engine.map, h, h.data.planet, "colony" /* Colony */, engine.isLastRound, engine.replay, {
      existingBuilding
    });
    if (check) {
      return [newAvailableBuilding("colony" /* Colony */, h, check, false)];
    }
  }
  return [];
}
function possibleShipActions(engine, ship, shipLocation, requireTemporaryStep) {
  switch (ship.type) {
    case "colonyShip" /* ColonyShip */:
      return possibleShipActionsOfType(
        engine,
        ship,
        shipLocation,
        "buildColony" /* BuildColony */,
        !requireTemporaryStep,
        (h) => colonyActions(engine, ship, h)
      );
    case "tradeShip" /* TradeShip */:
      return possibleShipActionsOfType(
        engine,
        ship,
        shipLocation,
        "trade" /* Trade */,
        true,
        (h) => tradeLocations(h, ship.player, engine)
      );
  }
  return [];
}
function possibleShipMovements(engine, player, requireTemporaryStep) {
  const pl = engine.player(player);
  const ships = pl.data.ships.filter((s) => !s.moved && (!requireTemporaryStep || s.type === "colonyShip" /* ColonyShip */));
  if (ships.length === 0) {
    return [];
  }
  const shipRange = engine.player(player).data.shipRange;
  return [
    {
      name: "move" /* MoveShip */,
      player,
      data: ships.map((s) => ({
        ship: s.type,
        source: s.location,
        targets: shipTargets(s.location, s.location, shipRange, [], engine).map((t) => ({
          location: t,
          actions: possibleShipActions(engine, s, t.coordinates, requireTemporaryStep)
        })).filter((t) => t.actions.length > 0)
      })).filter((d) => d.targets.length > 0)
    }
  ];
}

// engine/src/player-data.ts
var MAX_ORE = 15;
var MAX_CREDIT = 30;
var MAX_KNOWLEDGE = 15;
var resourceLimits = {
  ["o" /* Ore */]: MAX_ORE,
  ["c" /* Credit */]: MAX_CREDIT,
  ["k" /* Knowledge */]: MAX_KNOWLEDGE
};
var Power = class {
  constructor(area1 = 0, area2 = 0, area3 = 0, gaia = 0) {
    this.area1 = area1;
    this.area2 = area2;
    this.area3 = area3;
    this.gaia = gaia;
  }
};
function powerLogString(power, brainstoneArea) {
  const areaString = (area, tokens) => {
    return tokens.toString() + (area === brainstoneArea ? ",B" : "");
  };
  const result = [
    areaString("area1" /* Area1 */, power.area1),
    areaString("area2" /* Area2 */, power.area2),
    areaString("area3" /* Area3 */, power.area3),
    areaString("gaia" /* Gaia */, power.gaia)
  ];
  return result.join("/");
}
var PlayerData2 = class _PlayerData extends import_eventemitter32.EventEmitter {
  constructor() {
    super(...arguments);
    this.victoryPoints = 10;
    this.bid = 0;
    this.credits = 0;
    this.ores = 0;
    this.qics = 0;
    this.knowledge = 0;
    this.power = new Power();
    this.brainstone = null;
    this.buildings = (0, import_lodash17.fromPairs)(Building.values(6 /* All */).map((bld) => [bld, 0]));
    this.destroyedShips = (0, import_lodash17.fromPairs)(Building.ships().map((bld) => [bld, 0]));
    this.deployedShips = (0, import_lodash17.fromPairs)(Building.ships().map((bld) => [bld, 0]));
    this.satellites = 0;
    this.research = {
      terra: 0,
      nav: 0,
      int: 0,
      gaia: 0,
      eco: 0,
      sci: 0,
      dip: 0
    };
    this.range = 1;
    this.shipRange = 2;
    /** Total number of gaiaformers gained (including those on the board & the gaia area) */
    this.gaiaformers = 0;
    /** number of gaiaformers gained that are in gaia area */
    this.gaiaformersInGaia = 0;
    /** number of gaiaformers permanently consumed to colonize an asteroid (Lost Fleet) */
    this.gaiaformersUsedForAsteroid = 0;
    /**
     * Of the current gaiaformersInGaia total, how much got there by spending an already-owned
     * Gaiaformer on something other than actually starting a Gaia project (e.g. Baltaks' "GaiaFormer
     * -> Q.I.C." free action costing "1gf" - see gainReward's Resource.GaiaFormer case). Tracked
     * purely so the §G3 "former" booster's pass bonus can add it back: the owner-confirmed ruling
     * (RULES_CLARIFICATIONS.md G3) counts Gaiaformers "on Faction board or deployed" and excludes
     * only ones used to colonize an asteroid, NOT ones spent this way. Deliberately does NOT affect
     * availability/canPay - reset in lockstep with gaiaformersInGaia in Player.gaiaPhaseEnd(), so it
     * never drifts, and left otherwise unused so it can't change replay behavior of existing games.
     */
    this.gaiaformersUsedForOther = 0;
    this.terraformCostDiscount = 0;
    this.tradeBonus = 0;
    this.tradeDiscount = 0;
    this.tradeShips = 0;
    this.tiles = {
      booster: null,
      techs: [],
      federations: []
    };
    /** Number of federations built (used for ivits) */
    this.federationCount = 0;
    /** Lost Fleet Federation tokens claimed from explored spaceship boards */
    this.spaceshipFederations = [];
    /** Lost Fleet spaceship exploration slot occupied by this player's shuttle, if any, per ship */
    this.explorationShips = {};
    /** Lost Fleet: the 3 base-game planet colors that cost this player 3 terraform steps */
    this.lostFleetCost3Planets = [];
    /** Lost Fleet Tinkeroids: the current round's chosen Tinkering tile, if any */
    this.currentTinkeringTile = null;
    /** Lost Fleet Tinkeroids: tiles already used and removed from play */
    this.usedTinkeringTiles = [];
    /** Lost Fleet Moweyds: number of Power Rings placed so far */
    this.powerRingsPlaced = 0;
    /** Hexes occupied by buildings with value (not gaia formers), refs match the map hexes with a simple equality test */
    this.occupied = [];
    this.ships = [];
    this.tokenModifier = 1;
    this.lostPlanet = 0;
    /** Virtual planet types granted by Asteroid/Protoplanet-themed Artifact tokens, no hex placed */
    this.artifactPlanetTypes = [];
    /** Lost Fleet Twilight: Artifact tokens claimed via Choose Artifact, kept for display under the player board */
    this.artifacts = [];
    this.temporaryRange = 0;
    this.temporaryStep = 0;
    this.canUpgradeResearch = true;
    this.turns = 0;
    // when picking rewards
    this.toPick = void 0;
  }
  toJSON() {
    const ret = {
      victoryPoints: this.victoryPoints,
      bid: this.bid,
      credits: this.credits,
      ores: this.ores,
      qics: this.qics,
      knowledge: this.knowledge,
      power: this.power,
      research: this.research,
      range: this.range,
      gaiaformers: this.gaiaformers,
      gaiaformersInGaia: this.gaiaformersInGaia,
      gaiaformersUsedForAsteroid: this.gaiaformersUsedForAsteroid,
      gaiaformersUsedForOther: this.gaiaformersUsedForOther,
      terraformCostDiscount: this.terraformCostDiscount,
      tiles: this.tiles,
      satellites: this.satellites,
      brainstone: this.brainstone,
      leechPossible: this.leechPossible,
      tokenModifier: this.tokenModifier,
      buildings: this.buildings,
      destroyedShips: this.destroyedShips,
      deployedShips: this.deployedShips,
      federationCount: this.federationCount,
      spaceshipFederations: this.spaceshipFederations,
      explorationShips: this.explorationShips,
      lostFleetCost3Planets: this.lostFleetCost3Planets,
      currentTinkeringTile: this.currentTinkeringTile,
      usedTinkeringTiles: this.usedTinkeringTiles,
      powerRingsPlaced: this.powerRingsPlaced,
      lostPlanet: this.lostPlanet,
      artifactPlanetTypes: this.artifactPlanetTypes,
      artifacts: this.artifacts,
      ships: this.ships,
      shipRange: this.shipRange,
      tradeBonus: this.tradeBonus,
      tradeDiscount: this.tradeDiscount,
      tradeShips: this.tradeShips,
      temporaryRange: this.temporaryRange,
      temporaryStep: this.temporaryStep
    };
    return ret;
  }
  initialPowerRewards(board) {
    const rewards = [
      new Reward(board.power.area1 + board.power.area2, "t" /* GainToken */),
      new Reward(board.power.area2, "pw" /* ChargePower */)
    ];
    if (board.brainstone !== null) {
      assert13(board.brainstone === "area1" /* Area1 */, "other initial areas for brainstone are not supported");
      rewards.push(new Reward(1, "brainstone" /* Brainstone */));
    }
    return rewards;
  }
  /**
   * Creates a copy of the current player data, except its event emitter is not linked to anything
   */
  clone() {
    return Object.assign(new _PlayerData(), (0, import_lodash17.cloneDeep)(this.toJSON()));
  }
  emitBrainstoneEvent(choices, area1Warning) {
    const d = {
      choices: choices.map((a) => ({
        area: a,
        warning: a === "area1" /* Area1 */ ? area1Warning : void 0
      }))
    };
    this.emit("brainstone", d);
  }
  gainRewards(rewards, forced = false, source) {
    let followBrainStoneHeuristics = true;
    if (!forced && this.brainstone && rewards.some((rew) => rew.type === "pw" /* ChargePower */)) {
      const [cloneHeuristic, cloneNoHeuristic] = [this.clone(), this.clone()];
      for (const reward of rewards) {
        cloneHeuristic.gainReward(reward, false, null, true);
      }
      for (const reward of rewards) {
        cloneNoHeuristic.gainReward(reward, false, null, false);
      }
      if (cloneHeuristic.brainstone !== cloneNoHeuristic.brainstone) {
        if (this.brainstoneDest === void 0) {
          this.emitBrainstoneEvent([cloneHeuristic.brainstone, cloneNoHeuristic.brainstone]);
        }
        followBrainStoneHeuristics = this.brainstoneDest === cloneHeuristic.brainstone;
        delete this.brainstoneDest;
      }
    }
    for (const reward of rewards) {
      this.gainReward(reward, false, source, followBrainStoneHeuristics);
    }
  }
  gainReward(reward, pay = false, source, followBrainStoneHeuristics = true) {
    if (reward.isEmpty()) {
      return;
    }
    let { count } = reward;
    const resource = reward.type;
    if (pay) {
      count = -count;
    }
    if (resource.startsWith("up-") && resource !== "up-lowest" /* UpgradeLowest */) {
      const field = resource.slice("up-".length);
      this.canUpgradeResearch = true;
      this.emit("beforeResearchUpgrade", field);
      if (this.canUpgradeResearch) {
        this.advanceResearch(resource.slice("up-".length), count);
      }
      return;
    }
    switch (resource) {
      case "o" /* Ore */:
        this.ores = Math.min(MAX_ORE, this.ores + count);
        break;
      case "c" /* Credit */:
        this.credits = Math.min(MAX_CREDIT, this.credits + count);
        break;
      case "k" /* Knowledge */:
        this.knowledge = Math.min(MAX_KNOWLEDGE, this.knowledge + count);
        break;
      case "vp" /* VictoryPoint */:
        this.victoryPoints += count;
        break;
      case "q" /* Qic */:
        this.qics += count;
        break;
      case "t" /* GainToken */:
        count > 0 ? this.power.area1 += count : this.discardPower(-count);
        break;
      case "ta3" /* GainTokenArea3 */:
        this.power.area3 += count;
        break;
      case "brainstone" /* Brainstone */:
        this.brainstone = "area1" /* Area1 */;
        break;
      case "tg" /* GainTokenGaiaArea */:
        count > 0 ? this.chargeGaiaPower(count) : this.discardGaiaPower(-count);
        break;
      case "t->tg" /* MoveTokenToGaiaArea */:
        this.movePowerToGaia(-count);
        break;
      case "tg->t" /* MoveTokenFromGaiaAreaToArea1 */:
        this.movePowerFromGaia(count);
        break;
      case "pw" /* ChargePower */:
        count > 0 ? this.chargePower(count, true, followBrainStoneHeuristics) : this.spendPower(-count);
        break;
      case "burn-token" /* BurnToken */:
        this.burnPower(count);
        break;
      case "r" /* Range */:
        this.range += count;
        break;
      case "ship-range" /* ShipRange */:
        this.shipRange += count;
        break;
      case "range" /* TemporaryRange */:
        this.temporaryRange += count;
        break;
      case "tradeBonus" /* TradeBonus */:
        this.tradeBonus += count;
        break;
      case "tradeDiscount" /* TradeDiscount */:
        this.tradeDiscount += count;
        break;
      case "tradeShip" /* TradeShip */:
        this.tradeShips += count;
        break;
      case "gf" /* GaiaFormer */:
        if (count > 0) {
          this.gaiaformers += count;
        } else {
          this.gaiaformersInGaia -= count;
          this.gaiaformersUsedForOther -= count;
        }
        break;
      case "gf->t" /* MoveGaiaFormerFromGaiaAreaToArea1 */:
        this.gaiaformersInGaia -= count;
        break;
      case "d" /* TerraformCostDiscount */:
        this.terraformCostDiscount += count;
        break;
      case "step" /* TemporaryStep */:
        this.temporaryStep += count;
        break;
      case "t-a3" /* MoveTokenFromArea3ToGaia */:
        if (count < 0) {
          this.power.area3 += count;
          this.power.gaia -= count;
        }
        break;
      case "turn" /* Turn */:
        this.turns += count;
        break;
      default:
        break;
    }
    if (count > 0) {
      this.emit(`gain-${reward.type}`, count, source);
    } else if (count < 0) {
      this.emit(`pay-${reward.type}`, -count, source);
    }
  }
  hasResource(reward) {
    const type = reward.type;
    return type === "~" /* None */ || this.getResources(type) >= reward.count;
  }
  getResources(type) {
    switch (type) {
      case "o" /* Ore */:
        return this.ores;
      case "c" /* Credit */:
        return this.credits;
      case "k" /* Knowledge */:
        return this.knowledge;
      case "vp" /* VictoryPoint */:
        return this.victoryPoints;
      case "q" /* Qic */:
        return this.qics;
      case "t->tg" /* MoveTokenToGaiaArea */:
      case "t" /* GainToken */:
        return this.discardablePowerTokens();
      case "tg" /* GainTokenGaiaArea */:
        return this.gaiaPowerTokens();
      case "pw" /* ChargePower */:
        return this.spendablePowerTokens();
      case "t-a3" /* MoveTokenFromArea3ToGaia */:
        return this.power.area3;
      case "gf" /* GaiaFormer */:
        return this.gaiaformers - this.gaiaformersInGaia - this.buildings["gf" /* GaiaFormer */] - this.gaiaformersUsedForAsteroid;
    }
    return 0;
  }
  canPay(reward) {
    const rewards = Reward.merge(reward);
    for (const rew of rewards) {
      if (!this.hasResource(rew)) {
        return false;
      }
    }
    return true;
  }
  hasPlanetaryInstitute() {
    return this.buildings["PI" /* PlanetaryInstitute */] > 0;
  }
  hasExplored(ship) {
    return this.explorationShips[ship] !== void 0;
  }
  exploredShipsCount() {
    return Object.keys(this.explorationShips).length;
  }
  discardablePowerTokens() {
    return this.power.area1 + this.power.area2 + this.power.area3 + (this.brainstoneInPlay() ? 1 : 0);
  }
  spendablePowerTokens() {
    return Math.floor(this.power.area3 * this.tokenModifier) + this.brainstoneValue();
  }
  gaiaPowerTokens() {
    return this.power.gaia + (this.brainstone === "gaia" /* Gaia */ ? 1 : 0);
  }
  maxLeech(leechPossible2, extraPowerToken) {
    const charge = this.chargePower(leechPossible2, false) + (extraPowerToken ? 2 : 0);
    const victoryPoints = this.victoryPoints + 1;
    const value = Math.min(leechPossible2, charge, victoryPoints);
    return { value, victoryPoints, charge };
  }
  /**
   * Move power tokens from a power area to an upper one, depending on the amount
   * of power charged
   *
   * @param power Power charged
   */
  chargePower(power, apply = true, followBrainStoneHeuristics = true) {
    let brainstoneUsage = 0;
    let brainstonePos = this.brainstone;
    if (power === 0) {
      return 0;
    }
    if (brainstonePos === "area1" /* Area1 */) {
      if (followBrainStoneHeuristics || this.power.area1 < power) {
        brainstoneUsage += 1;
        power -= 1;
        brainstonePos = "area2" /* Area2 */;
      }
    }
    const area1ToUp = Math.min(power, this.power.area1);
    power -= area1ToUp;
    if (brainstonePos === "area2" /* Area2 */ && power > 0) {
      if (followBrainStoneHeuristics || this.power.area2 + area1ToUp < power) {
        brainstoneUsage += 1;
        power -= 1;
        brainstonePos = "area3" /* Area3 */;
      }
    }
    const area2ToUp = Math.min(power, this.power.area2 + area1ToUp);
    if (apply) {
      this.power.area1 -= area1ToUp;
      this.power.area2 += area1ToUp - area2ToUp;
      this.power.area3 += area2ToUp;
      this.brainstone = brainstonePos;
    }
    return area1ToUp + area2ToUp + brainstoneUsage;
  }
  spendPower(power) {
    if (this.brainstone === "area3" /* Area3 */) {
      let useBrainStone = true;
      const warning = power < 3 ? "brainstone-charges-wasted" /* brainstoneChargesWasted */ : void 0;
      const needBrainstone = this.power.area3 < power;
      let choices = [];
      if (needBrainstone) {
        if (warning) {
          choices = ["area1" /* Area1 */];
        } else {
          useBrainStone = true;
        }
      } else {
        if (warning) {
          useBrainStone = false;
        } else {
          choices = ["area1" /* Area1 */, "area3" /* Area3 */];
        }
      }
      if (choices.length > 0) {
        if (this.brainstoneDest === void 0) {
          this.emitBrainstoneEvent(choices, warning);
        }
        useBrainStone = this.brainstoneDest === "area1" /* Area1 */;
        delete this.brainstoneDest;
      }
      if (useBrainStone) {
        this.brainstone = "area1" /* Area1 */;
        power = Math.max(power - 3, 0);
      }
    }
    this.power.area3 -= Math.ceil(power / this.tokenModifier);
    this.power.area1 += Math.ceil(power / this.tokenModifier);
  }
  tokensBelowArea(area) {
    let power = 0;
    switch (area) {
      case "area3" /* Area3 */:
        power += this.power.area3;
      // eslint-disable-next-line no-fallthrough
      case "area2" /* Area2 */:
        power += this.power.area2;
      // eslint-disable-next-line no-fallthrough
      case "area1" /* Area1 */:
        power += this.power.area1;
    }
    return power;
  }
  discardPower(power) {
    this.moveTokens(power, null);
  }
  movePowerToGaia(power) {
    this.moveTokens(power, "gaia" /* Gaia */);
  }
  movePowerFromGaia(power) {
    this.power.gaia -= power;
    this.power.area1 += power;
    this.emit("discardGaia", power);
  }
  moveTokens(power, targetArea) {
    const brainstoneEvent = targetArea ?? "discard";
    let movedBrainstone = 0;
    if (this.brainstone && this.brainstone !== "gaia" /* Gaia */) {
      if (this.discardablePowerTokens() === power) {
        this.brainstone = targetArea;
        power -= 1;
        movedBrainstone = 1;
      } else if (targetArea || this.tokensBelowArea(this.brainstone) < power) {
        if (this.brainstoneDest === void 0) {
          this.emitBrainstoneEvent([this.brainstone, brainstoneEvent]);
        }
        if (this.brainstoneDest === brainstoneEvent) {
          this.brainstone = targetArea;
          power -= 1;
          movedBrainstone = 1;
        }
        delete this.brainstoneDest;
      }
    }
    const area1ToGaia = Math.min(power, this.power.area1);
    const area2ToGaia = Math.min(power - area1ToGaia, this.power.area2);
    const area3ToGaia = Math.min(power - area1ToGaia - area2ToGaia, this.power.area3);
    this.power.area1 -= area1ToGaia;
    this.power.area2 -= area2ToGaia;
    this.power.area3 -= area3ToGaia;
    if (targetArea === "gaia" /* Gaia */) {
      this.power.gaia += area1ToGaia + area2ToGaia + area3ToGaia;
    }
    const event = {
      area1: area1ToGaia,
      area2: area2ToGaia,
      area3: area3ToGaia,
      gaia: 0,
      brainstone: movedBrainstone
    };
    this.emit("move-tokens", event);
  }
  chargeGaiaPower(power) {
    this.power.gaia += power;
  }
  discardGaiaPower(power) {
    this.power.gaia -= power;
  }
  burnablePower() {
    return Math.floor((this.power.area2 + (this.brainstone === "area2" /* Area2 */ ? 1 : 0)) / 2);
  }
  burnPower(power) {
    if (this.brainstone === "area2" /* Area2 */ && power > 0) {
      this.brainstone = "area3" /* Area3 */;
      power -= 1;
      this.power.area2 -= 1;
    }
    this.power.area2 -= 2 * power;
    this.power.area3 += power;
    this.emit("burn", power);
  }
  advanceResearch(which, count) {
    while (count-- > 0) {
      this.research[which] += 1;
      this.emit("advance-research", which, this.research[which]);
    }
  }
  brainstoneInPlay() {
    return this.brainstone && this.brainstone !== "gaia" /* Gaia */;
  }
  brainstoneValue() {
    return this.brainstone === "area3" /* Area3 */ ? 3 : 0;
  }
  hasGreenFederation() {
    return this.tiles.federations.some((fed) => fed.green) || this.spaceshipFederations.some((fed) => fed.green);
  }
  gaiaFormingDiscount() {
    return this.gaiaformers > 1 ? this.gaiaformers : 0;
  }
  tradeCost() {
    return new Reward(TRADE_COST - this.tradeDiscount, "pw" /* ChargePower */);
  }
  /**
   * Convert all resources into knowledge / ore / credits,
   * to have the maximum victory points
   */
  finalResourceHandling() {
    const ret = [];
    const gain = (...rewards) => {
      this.gainRewards(rewards, true, "spend" /* Spend */);
      ret.push(...rewards);
    };
    const burnablePower = this.burnablePower();
    if (burnablePower) {
      gain(new Reward(burnablePower, "burn-token" /* BurnToken */));
    }
    const creditGain = this.spendablePowerTokens();
    if (creditGain > 0) {
      gain(new Reward(-creditGain / this.tokenModifier, "pw" /* ChargePower */), new Reward(creditGain, "c" /* Credit */));
    }
    const qics = this.qics;
    if (qics > 0) {
      gain(new Reward(-qics, "q" /* Qic */), new Reward(qics, "o" /* Ore */));
    }
    const resources2 = this.ores + this.credits + this.knowledge;
    if (resources2 > 0) {
      gain(new Reward(Math.max(Math.floor(resources2 / 3)), "vp" /* VictoryPoint */));
    }
    return ret;
  }
  gainResearchVictoryPoints() {
    for (const research of ResearchField.values(6 /* All */)) {
      this.gainReward(new Reward(Math.max(this.research[research] - 2, 0) * 4, "vp" /* VictoryPoint */), false, research);
    }
  }
  removeGreenFederation() {
    if (this.tiles.federations.some((fed) => {
      if (fed.green) {
        fed.green = false;
        return true;
      }
    })) {
      return;
    }
    this.spaceshipFederations.some((fed) => {
      if (fed.green) {
        fed.green = false;
        return true;
      }
    });
  }
  isNewPlanetType(hex) {
    for (const hex2 of this.occupied) {
      if (hex !== hex2 && hex2.data.planet === hex.data.planet) {
        return false;
      }
    }
    return true;
  }
};
function effectiveRange(data) {
  const hasRangeTech = (data.tiles?.techs ?? []).some((t) => t.tile === "ship-tech-range" /* Range */ && t.enabled);
  return data.range + (hasRangeTech ? 1 : 0);
}

// engine/src/available/spaceship-actions.ts
function possibleSpaceshipActions(engine, player) {
  const pl = engine.player(player);
  const actions = [];
  for (const ship of shipsInPlay(engine.expansions, engine.players.length)) {
    if (!pl.data.hasExplored(ship)) {
      continue;
    }
    const wiredEffects = spaceshipActionEffects[ship];
    if (!wiredEffects) {
      continue;
    }
    for (const action of spaceshipBoards[ship].actions) {
      if (!(action.type in wiredEffects)) {
        continue;
      }
      if (engine.spaceshipActions[ship]?.[action.type] !== void 0) {
        continue;
      }
      if (ship === "tfmars" /* TFMars */ && action.type === "power" && possibleInstantGaiaforming(engine, player).length === 0) {
        continue;
      }
      if ((ship === "eclipse" /* Eclipse */ || ship === "tfmars" /* TFMars */) && action.type === "credit" && possibleSpaceshipBuildMine(engine, player, { ship }).length === 0) {
        continue;
      }
      if (ship === "twilight" /* Twilight */ && action.type === "power" && possibleSpaceshipUpgradeBuilding(engine, player, {
        from: "ts" /* TradingStation */,
        to: "lab" /* ResearchLab */
      }).length === 0) {
        continue;
      }
      if (ship === "rebellion" /* Rebellion */ && action.type === "power" && possibleSpaceshipUpgradeBuilding(engine, player, { from: "m" /* Mine */, to: "ts" /* TradingStation */ }).length === 0) {
        continue;
      }
      if (ship === "eclipse" /* Eclipse */ && action.type === "power" && !possibleResearchAreas(engine, player, null).some((c) => c.name === "up" /* UpgradeResearch */)) {
        continue;
      }
      if (!pl.data.canPay(Reward.parse(action.cost))) {
        continue;
      }
      const noOwnedFederation = ship === "twilight" /* Twilight */ && action.type === "qic" && pl.data.tiles.federations.length === 0 && pl.data.spaceshipFederations.length === 0;
      actions.push({
        ship,
        type: action.type,
        cost: action.cost,
        ...noOwnedFederation ? { warnings: ["no-owned-federation-to-rescore" /* noOwnedFederationToRescore */] } : {}
      });
    }
  }
  if (actions.length === 0) {
    return [];
  }
  return [
    {
      name: "spaceshipAction" /* SpaceshipAction */,
      player,
      data: { actions }
    }
  ];
}
function possibleInstantGaiaforming(engine, player) {
  const pl = engine.player(player);
  const spaces = [];
  if (!pl.data.hasResource(new Reward(1, "gf" /* GaiaFormer */))) {
    return [];
  }
  for (const hex of engine.map.toJSON()) {
    if (hex.data.planet !== "m" /* Transdim */ || hex.data.building) {
      continue;
    }
    const qicNeeded = qicForDistance(engine.map, hex, pl, engine.replay);
    if (qicNeeded.amount > pl.data.qics) {
      continue;
    }
    spaces.push({
      coordinates: hex.toString(),
      cost: qicNeeded.amount > 0 ? new Reward(qicNeeded.amount, "q" /* Qic */).toString() : "~",
      warnings: qicNeeded.warning ? [qicNeeded.warning] : null
    });
  }
  if (spaces.length === 0) {
    return [];
  }
  return [{ name: "gaiaFormTransdim" /* GaiaFormTransdim */, player, data: { spaces } }];
}
function possibleSpaceshipBuildMine(engine, player, data) {
  const pl = engine.player(player);
  const buildings = [];
  if (pl.data.buildings["m" /* Mine */] >= pl.maxBuildings("m" /* Mine */)) {
    return [];
  }
  for (const hex of engine.map.toJSON()) {
    if (data.ship === "eclipse" /* Eclipse */) {
      if (hex.data.planet !== "a" /* Asteroid */ || !pl.canOccupy(hex)) {
        continue;
      }
    } else if (hex.data.planet === "m" /* Transdim */ || hex.data.planet === "a" /* Asteroid */ || !pl.canOccupy(hex)) {
      continue;
    }
    const qicNeeded = qicForDistance(engine.map, hex, pl, engine.replay);
    if (qicNeeded === null) {
      continue;
    }
    const rewards = [];
    let steps = 0;
    if (data.ship === "tfmars" /* TFMars */) {
      const planet = hex.occupied() ? pl.planet : hex.data.planet;
      steps = terraformingStepsRequired(pl.faction, planet, pl.data.lostFleetCost3Planets);
      const oreCost = terraformingCost(pl.data, Math.max(steps - 1, 0), engine.replay);
      if (oreCost === null) {
        continue;
      }
      rewards.push(...pl.board.cost("m" /* Mine */, false));
      if (oreCost.count > 0) {
        rewards.push(oreCost);
      }
    }
    if (qicNeeded.amount > 0) {
      rewards.push(new Reward(qicNeeded.amount, "q" /* Qic */));
    }
    const mergedRewards = Reward.merge(rewards);
    if (!pl.data.canPay(mergedRewards)) {
      continue;
    }
    buildings.push({
      building: "m" /* Mine */,
      coordinates: hex.toString(),
      cost: Reward.toString(mergedRewards),
      steps,
      warnings: qicNeeded.warning ? [qicNeeded.warning] : null,
      // §C4: Eclipse's Credit action places the mine on an Asteroid with "the 6 credits [as] the
      // entire cost" — explicitly distinct from §E2's Gaiaformer-consuming route.
      consumesAsteroidGaiaformer: data.ship === "eclipse" /* Eclipse */ ? false : void 0
    });
  }
  if (buildings.length === 0) {
    return [];
  }
  return [{ name: "build" /* Build */, player, data: { buildings } }];
}
function possibleSpaceshipUpgradeBuilding(engine, player, data) {
  const pl = engine.player(player);
  const buildings = [];
  if (pl.data.buildings[data.to] < pl.maxBuildings(data.to)) {
    for (const hex of pl.data.occupied) {
      if (hex.data.player === player && hex.data.building === data.from && hex.data.planet !== "l" /* Lost */) {
        buildings.push({
          building: data.to,
          coordinates: hex.toString(),
          cost: "~",
          upgrade: true
        });
      }
    }
  }
  if (buildings.length === 0) {
    return [];
  }
  return [{ name: "build" /* Build */, player, data: { buildings } }];
}

// engine/src/available/actions.ts
function conversionToFreeAction(act) {
  const entry = Object.entries(freeActionConversions).find(([k, v]) => v.cost === act.cost && v.income === act.income);
  return entry !== null ? Number(entry[0]) : null;
}
function possibleSpecialActions(engine, player) {
  const commands = [];
  const specialacts = [];
  const pl = engine.player(player);
  for (const event of pl.events["=>" /* Activate */]) {
    if (!event.activated) {
      if (event.rewards[0].type === "down-lab" /* DowngradeLab */ && (pl.data.buildings["lab" /* ResearchLab */] === 0 || pl.data.buildings["ts" /* TradingStation */] >= pl.maxBuildings("ts" /* TradingStation */))) {
        continue;
      }
      if (event.rewards[0].type === "swap-PI" /* PISwap */ && pl.data.buildings["m" /* Mine */] === 0) {
        continue;
      }
      if (event.rewards[0].type === "instant-gaiaforming" /* InstantGaiaforming */ && possibleInstantGaiaforming(engine, player).length === 0) {
        continue;
      }
      if (!pl.data.canPay(Reward.negative(event.rewards.filter((rw) => rw.count < 0)))) {
        continue;
      }
      specialacts.push({
        income: event.action().rewards,
        // Reward.toString(event.rewards),
        spec: event.spec
      });
    }
  }
  if (specialacts.length > 0) {
    commands.push({
      name: "special" /* Special */,
      player,
      data: { specialacts }
    });
  }
  return commands;
}
function possibleTinkeringTiles(engine, player) {
  const pl = engine.player(player);
  const tiles = pl.availableTinkeringTiles(engine.round);
  if (tiles.length === 0) {
    return [];
  }
  return [{ name: "chooseTinkeringTile" /* ChooseTinkeringTile */, player, data: { tiles } }];
}
function possiblePowerRingPlacements(engine, player) {
  const pl = engine.player(player);
  const spaces = [];
  if (pl.data.powerRingsPlaced >= 6) {
    return [];
  }
  for (const hex of pl.data.occupied) {
    if (!hex.hasPlanet() || hex.buildingOf(player) === void 0 || hex.data.powerRing !== void 0) {
      continue;
    }
    spaces.push({ coordinates: hex.toString() });
  }
  if (spaces.length === 0) {
    return [];
  }
  return [{ name: "placePowerRing" /* PlacePowerRing */, player, data: { spaces } }];
}
function possibleBoardActions(actions, p, replay) {
  const commands = [];
  const canGain = (reward) => {
    const type = reward.type;
    if (!(type in resourceLimits)) {
      return true;
    }
    return p.data.getResources(type) < resourceLimits[type];
  };
  let poweracts = BoardAction.values().filter(
    (pwract) => actions[pwract] === null && p.data.canPay(Reward.parse(boardActions[pwract].cost)) && boardActions[pwract].income.some((income) => Reward.parse(income).some((reward) => replay || canGain(reward)))
  );
  if (p.data.tiles.federations.length === 0) {
    poweracts = poweracts.filter((act) => act !== "qic2" /* Qic2 */);
  }
  if (poweracts.length > 0) {
    const data = {
      poweracts: poweracts.map((act) => ({
        name: act,
        cost: boardActions[act].cost,
        income: boardActions[act].income
      }))
    };
    commands.push({
      name: "action" /* Action */,
      player: p.player,
      data
    });
  }
  return commands;
}
function possibleFreeActions(pl) {
  const commands = [];
  const pool = new ConversionPool(freeActions, pl);
  pl.emit("freeActionChoice", pool);
  const spendCommand = transformToSpendCommand(pool, pl);
  if (spendCommand) {
    commands.push(spendCommand);
  }
  if (pl.data.burnablePower() > 0) {
    commands.push({
      name: "burn" /* BurnPower */,
      player: pl.player,
      data: (0, import_lodash18.range)(1, pl.data.burnablePower() + 1)
    });
  }
  return commands;
}
function freeActionData(availableFreeActions, player) {
  const acts = [];
  for (const freeAction of availableFreeActions) {
    const conversion = freeActionConversions[freeAction];
    const maxPay = player.maxPayRange(Reward.parse(conversion.cost));
    if (maxPay > 0) {
      acts.push({
        cost: conversion.cost,
        income: conversion.income,
        range: maxPay > 1 ? (0, import_lodash18.range)(1, maxPay + 1) : void 0
      });
    }
  }
  return acts;
}
function transformToSpendCommand(actions, player) {
  if (actions.actions.length > 0) {
    return {
      name: "spend" /* Spend */,
      player: player.player,
      data: {
        acts: actions.actions
      }
    };
  }
  return null;
}
function possibleGaiaFreeActions(engine, player) {
  const commands = [];
  const pl = engine.player(player);
  if (pl.canGaiaTerrans()) {
    commands.push(transformToSpendCommand(new ConversionPool(freeActionsTerrans, pl), pl));
  } else if (pl.canGaiaItars()) {
    if (possibleTechTiles(engine, player).length > 0) {
      commands.push(transformToSpendCommand(new ConversionPool(freeActionsItars, pl), pl));
    }
    commands.push({
      name: "decline" /* Decline */,
      player,
      data: { offers: [new Offer("tech" /* TechTile */, new Reward(4, "tg" /* GainTokenGaiaArea */).toString())] }
    });
  }
  return commands;
}

// engine/src/available/artifacts.ts
var EXAMINE_ARTIFACT_COST = "6t";
function possibleExamineArtifact(engine, player) {
  const pl = engine.player(player);
  if (!pl.data.hasExplored("twilight" /* Twilight */)) {
    return [];
  }
  if (engine.tiles.artifacts.length === 0) {
    return [];
  }
  if (!pl.data.canPay(Reward.parse(EXAMINE_ARTIFACT_COST))) {
    return [];
  }
  return [{ name: "examineArtifact" /* ExamineArtifact */, player, data: { cost: EXAMINE_ARTIFACT_COST } }];
}
function possibleArtifactTokens(engine, player) {
  const pl = engine.player(player);
  const tokens = engine.tiles.artifacts;
  const ownsAnyFederationToken = pl.data.tiles.federations.length > 0 || pl.data.spaceshipFederations.length > 0;
  const noEffectTokens = !ownsAnyFederationToken && tokens.includes("artifact-federation" /* Federation */) ? ["artifact-federation" /* Federation */] : void 0;
  return [{ name: "chooseArtifactToken" /* ChooseArtifactToken */, player, data: { tokens, noEffectTokens } }];
}

// engine/src/exploration.ts
var QIC_RANGE_UPGRADE2 = 2;
function maxExplorationShuttles(nbPlayers) {
  return nbPlayers === 2 ? 2 : 3;
}
function spaceshipHex(map, ship) {
  return [...map.grid.values()].find((hex) => hex.data.spaceship === ship);
}
function nextFreeExplorationSlot(players, ship) {
  const occupiedSlots = new Set(
    players.map((pl) => pl.data.explorationShips[ship]).filter((slot) => slot !== void 0)
  );
  for (let slot = 1; slot <= EXPLORATION_CHARGE_TRACK.length; slot++) {
    if (!occupiedSlots.has(slot)) {
      return slot;
    }
  }
  return null;
}
function qicForExplorationDistance(map, hex, pl, replay, temporaryRange = pl.data.temporaryRange) {
  const origins = pl.data.occupied.filter((loc) => loc.colonizedBy(pl.player));
  if (origins.length === 0) {
    return null;
  }
  const distance = Math.min(...origins.map((loc) => map.distance(hex, loc)));
  const qic = (rangeBoost) => Math.max(Math.ceil((distance - effectiveRange(pl.data) - rangeBoost) / QIC_RANGE_UPGRADE2), 0);
  const amount = qic(temporaryRange);
  if (!replay && temporaryRange > 0 && qic(0) === amount) {
    return null;
  }
  return {
    amount,
    distance
  };
}
function explorationCost(pl) {
  const cost = [new Reward(pl.faction === "baltaks" /* BalTaks */ ? 7 : 5, "vp" /* VictoryPoint */)];
  if (pl.faction === "nevlas" /* Nevlas */ || pl.faction === "itars" /* Itars */) {
    cost.push(new Reward(1, "t" /* GainToken */));
  }
  return cost;
}
function canPayExplorationCost(pl, cost) {
  if (pl.faction === "taklons" /* Taklons */ && pl.data.brainstone === "gaia" /* Gaia */) {
    return false;
  }
  return pl.data.canPay(cost);
}
function explorationCostAdjustments(pl) {
  const adjustments = [];
  if (pl.faction === "taklons" /* Taklons */ && pl.data.brainstone !== "gaia" /* Gaia */) {
    adjustments.push("brainstone -> gaia");
  }
  return adjustments;
}
function deployExplorationShuttle(pl, ship, slot, source) {
  pl.data.explorationShips[ship] = slot;
  if (pl.faction === "taklons" /* Taklons */ && pl.data.brainstone !== "gaia" /* Gaia */) {
    pl.data.brainstoneDest = "gaia" /* Gaia */;
    pl.data.gainReward(new Reward(1, "t->tg" /* MoveTokenToGaiaArea */), true, source);
  }
  const charge = EXPLORATION_CHARGE_TRACK[slot - 1];
  if (charge > 0) {
    pl.gainRewards([new Reward(charge, "pw" /* ChargePower */)], source);
  }
}

// engine/src/available/exploration.ts
function possibleExplorations(engine, player) {
  if (!hasExpansion(engine.expansions, 4 /* LostFleet */)) {
    return [];
  }
  const pl = engine.player(player);
  if (pl.data.exploredShipsCount() >= maxExplorationShuttles(engine.players.length)) {
    return [];
  }
  const ships = [];
  for (const ship of shipsInPlay(engine.expansions, engine.players.length)) {
    if (pl.data.hasExplored(ship)) {
      continue;
    }
    const hex = spaceshipHex(engine.map, ship);
    if (!hex) {
      continue;
    }
    const slot = nextFreeExplorationSlot(engine.players, ship);
    if (!slot) {
      continue;
    }
    const distanceCost = qicForExplorationDistance(engine.map, hex, pl, engine.replay);
    if (!distanceCost) {
      continue;
    }
    const cost = Reward.merge(explorationCost(pl).concat(new Reward(distanceCost.amount, "q" /* Qic */)));
    if (!canPayExplorationCost(pl, cost)) {
      continue;
    }
    ships.push({
      ship,
      coordinates: hex.toString(),
      cost: Reward.toString(cost),
      charge: EXPLORATION_CHARGE_TRACK[slot - 1],
      slot,
      adjustments: explorationCostAdjustments(pl)
    });
  }
  if (ships.length === 0) {
    return [];
  }
  return [
    {
      name: "explore" /* Explore */,
      player,
      data: { ships }
    }
  ];
}

// engine/src/available/federations.ts
var import_lodash19 = __toESM(require_lodash2());
function federationWarnings(p, fed) {
  const ret = [];
  if (p.faction !== "ivits" /* Ivits */ && fed.newSatellites > p.data.power.area1) {
    ret.push("federation-with-charged-tokens" /* federationWithChargedTokens */);
  }
  if (p.faction === "ambas" /* Ambas */ && !fed.hexes.some((h) => h.buildingOf(p.player) === "PI" /* PlanetaryInstitute */)) {
    ret.push("ambas-federation-without-PI" /* ambasFederationWithoutPi */);
  }
  return ret;
}
function possibleFederations(engine, player) {
  const commands = Array();
  const possiblePoolTiles = Object.keys(engine.tiles.federations).filter((key2) => engine.tiles.federations[key2] > 0).map((f) => f);
  const p = engine.player(player);
  const claimableFederations = claimableSpaceshipFederations(
    p.data.explorationShips,
    engine.tiles.spaceshipFederations
  );
  const possibleTiles = [
    ...possiblePoolTiles,
    ...claimableFederations.map((entry) => entry.federation)
  ];
  if (possibleTiles.length > 0) {
    if (engine.options.noFedCheck || engine.replay) {
      commands.push({
        name: "federation" /* FormFederation */,
        player,
        data: {
          tiles: possibleTiles,
          federations: [],
          claimableFederations
        }
      });
    } else {
      const possibleFeds = p.availableFederations(engine.map, engine.options.flexibleFederations);
      if (possibleFeds.length > 0 || p.federationCache.custom) {
        commands.push({
          name: "federation" /* FormFederation */,
          player,
          data: {
            tiles: possibleTiles,
            federations: possibleFeds.map((fed) => ({
              ...fed,
              hexes: fed.hexes.map((hex) => hex.toString()).sort().join(","),
              warnings: federationWarnings(p, fed)
            })),
            claimableFederations
          }
        });
      }
    }
  }
  return commands;
}
function possibleFederationTiles(engine, player, from) {
  const commands = [];
  const possibleTiles = Object.keys(engine.tiles.federations).filter((key2) => engine.tiles.federations[key2] > 0).map((f) => f);
  const pl = engine.player(player);
  const playerTiles = (0, import_lodash19.uniq)([
    ...pl.data.tiles.federations.map((fed) => fed.tile),
    ...pl.data.spaceshipFederations.map((fed) => fed.tile)
  ]);
  if (from === "player" && playerTiles.length === 0) {
    return commands;
  }
  commands.push({
    name: "fedtile" /* ChooseFederationTile */,
    player,
    data: {
      tiles: from === "player" ? playerTiles : possibleTiles,
      // Tiles that are rescored just add the rewards, but don't take the token
      rescore: from === "player"
    }
  });
  return commands;
}
function possibleFreeBuildMine(engine, player, discount) {
  const pl = engine.player(player);
  const buildings = [];
  if (pl.data.buildings["m" /* Mine */] >= pl.maxBuildings("m" /* Mine */)) {
    return [];
  }
  for (const hex of engine.map.toJSON()) {
    if (hex.data.planet === "m" /* Transdim */ || !pl.canOccupy(hex)) {
      continue;
    }
    if (hex.data.planet === "a" /* Asteroid */ && !pl.data.hasResource(new Reward(1, "gf" /* GaiaFormer */))) {
      continue;
    }
    const rewards = [];
    let steps = 0;
    if (hex.data.planet === "g" /* Gaia */) {
      rewards.push(pl.gaiaFormingCost());
    } else {
      const planet = hex.occupied() ? pl.planet : hex.data.planet;
      steps = terraformingStepsRequired(pl.faction, planet, pl.data.lostFleetCost3Planets);
      const discountedSteps = Math.max(steps - discount.terraformDiscount, 0);
      const oreCost = terraformingCost(pl.data, discountedSteps, engine.replay);
      if (oreCost === null) {
        continue;
      }
      if (oreCost.count > 0) {
        rewards.push(oreCost);
      }
    }
    if (hex.data.planet === "p" /* Protoplanet */ && hex.data.planet !== pl.planet) {
      rewards.push(new Reward(-6, "vp" /* VictoryPoint */));
    }
    let qicWarning;
    if (!discount.waiveRangeQic) {
      const qicNeeded = qicForDistance(engine.map, hex, pl, engine.replay);
      if (qicNeeded === null) {
        continue;
      }
      if (qicNeeded.amount > 0) {
        rewards.push(new Reward(qicNeeded.amount, "q" /* Qic */));
      }
      qicWarning = qicNeeded.warning;
    }
    const mergedRewards = Reward.merge(rewards);
    if (!pl.data.canPay(mergedRewards)) {
      continue;
    }
    buildings.push({
      building: "m" /* Mine */,
      coordinates: hex.toString(),
      cost: Reward.toString(mergedRewards),
      steps,
      warnings: qicWarning ? [qicWarning] : null
    });
  }
  if (buildings.length === 0) {
    return [];
  }
  return [{ name: "build" /* Build */, player, data: { buildings } }];
}
function possibleFederationTokenBuildMine(engine, player, data) {
  return possibleFreeBuildMine(engine, player, {
    terraformDiscount: data.federation === "ship-fed-terraform" /* Terraform */ ? 3 : 0,
    waiveRangeQic: data.federation === "ship-fed-range" /* Range */
  });
}
function possibleSpaceshipTechTileBuildMine(engine, player) {
  return possibleFreeBuildMine(engine, player, { terraformDiscount: 2, waiveRangeQic: false });
}

// engine/src/available/leech.ts
function possibleLeech(engine, player) {
  const commands = [];
  const pl = engine.player(player);
  if (pl.data.leechPossible > 0) {
    const extraPower = pl.faction === "taklons" /* Taklons */ && pl.data.hasPlanetaryInstitute();
    const maxLeech = pl.maxLeech();
    const offers = [];
    if (extraPower) {
      offers.push(...getTaklonsExtraLeechOffers(maxLeech, pl.maxLeech(true)));
    } else {
      offers.push(
        new Offer(
          `${maxLeech}${"pw" /* ChargePower */}`,
          new Reward(Math.max(maxLeech - 1, 0), "vp" /* VictoryPoint */).toStringWithOne()
        )
      );
    }
    ["charge" /* ChargePower */, "decline" /* Decline */].map(
      (name) => commands.push({
        name,
        player,
        data: {
          // Kept for compatibility with older viewer
          offer: offers[0].offer,
          // Kept for compatibility with older viewer
          cost: offers[0].cost,
          // new format
          offers
        }
      })
    );
  }
  return commands;
}
function getTaklonsExtraLeechOffers(earlyLeechValue, lateLeechValue) {
  const earlyLeech = new Offer(
    `${earlyLeechValue}${"pw" /* ChargePower */},1t`,
    new Reward(Math.max(earlyLeechValue - 1, 0), "vp" /* VictoryPoint */).toStringWithOne()
  );
  const lateLeech = new Offer(
    `1t,${lateLeechValue}${"pw" /* ChargePower */}`,
    new Reward(Math.max(lateLeechValue - 1, 0), "vp" /* VictoryPoint */).toStringWithOne()
  );
  return [earlyLeech, lateLeech];
}

// engine/src/available/round.ts
function possibleRoundBoosters(engine, player) {
  const commands = [];
  const boosters = engine.isLastRound ? [] : Booster.values(engine.expansions).filter((booster) => engine.tiles.boosters[booster]);
  commands.push({
    name: engine.phase === "setupBooster" /* SetupBooster */ ? "booster" /* ChooseRoundBooster */ : "pass" /* Pass */,
    player,
    data: { boosters }
  });
  return commands;
}
function possibleIncomes(engine, player) {
  const commands = [];
  const pl = engine.player(player);
  const s = pl.incomeSelection();
  if (s.needed) {
    commands.push({
      name: "income" /* ChooseIncome */,
      player,
      data: s.descriptions.map((d) => d.toString())
    });
  }
  return commands;
}

// engine/src/available/setup.ts
var import_lodash20 = __toESM(require_lodash2());
function chooseFactionOrBid(engine, player) {
  const chooseFaction = {
    name: "faction" /* ChooseFaction */,
    player,
    data: choosableFactions(engine)
  };
  if (engine.options.auction === "bid-while-choosing" /* BidWhileChoosing */) {
    return [...possibleBids(engine, player), chooseFaction];
  }
  return [chooseFaction];
}
function choosableFactions(engine) {
  let factions2;
  if (engine.randomFactions) {
    if (engine.options.auction && engine.options.auction !== "choose-bid" /* ChooseBid */) {
      factions2 = (0, import_lodash20.difference)(engine.randomFactions, engine.setup);
    } else {
      factions2 = engine.randomFactions.length > engine.setup.length ? [engine.randomFactions[engine.setup.length]] : [];
    }
  } else {
    factions2 = remainingFactions(engine.setup, engine.expansions);
  }
  return (0, import_lodash20.difference)(factions2, engine.bannedFactions);
}
function banableFactions(engine) {
  return (0, import_lodash20.difference)(Faction.values(engine.expansions), engine.bannedFactions);
}
function possibleFactionBans(engine, player) {
  return [{ name: "banFaction" /* BanFaction */, player, data: banableFactions(engine) }];
}
function possibleSilentBids(engine, player) {
  const bids = engine.setup.map((faction) => ({
    faction,
    bid: (0, import_lodash20.range)(0, MAX_SILENT_BID + 1)
  }));
  return [{ name: "silentBid" /* SilentBid */, player, data: { maxBid: MAX_SILENT_BID, factions: [...engine.setup], bids } }];
}
function possiblePreferenceBids(engine, player) {
  const budget = engine.preferenceSplitBudget;
  const bids = engine.setup.map((faction) => ({
    faction,
    bid: (0, import_lodash20.range)(0, budget + 1)
  }));
  return [{ name: "preferenceBid" /* PreferenceBid */, player, data: { budget, factions: [...engine.setup], bids } }];
}
function possibleBids(engine, player) {
  const commands = [];
  const bids = [];
  for (const faction of engine.setup) {
    const bid = engine.players.find((pl) => pl.faction === faction) ? engine.players.find((pl) => pl.faction === faction).data.bid : -1;
    bids.push({
      faction,
      bid: (0, import_lodash20.range)(bid + 1, bid + 10)
    });
  }
  if (bids.length > 0) {
    commands.push({
      name: "bid" /* Bid */,
      player,
      data: { bids }
    });
  }
  return commands;
}

// engine/src/available/available-command.ts
function generate(engine, subPhase = null, data) {
  const player = engine.playerToMove;
  if (engine.phase === "roundMove" /* RoundMove */ && !subPhase) {
    subPhase = "beforeMove" /* BeforeMove */;
  }
  switch (subPhase) {
    case "chooseTechTile" /* ChooseTechTile */:
      return possibleTechTiles(engine, player);
    case "coverTechTile" /* CoverTechTile */:
      return possibleCoverTechTiles(engine, player);
    case "upgradeResearch" /* UpgradeResearch */:
      return possibleResearchAreas(engine, player, null, data);
    case "placeLostPlanet" /* PlaceLostPlanet */:
      return possibleSpaceLostPlanet(engine, player);
    case "instantGaiaforming" /* InstantGaiaforming */:
      return possibleInstantGaiaforming(engine, player);
    case "spaceshipBuildMine" /* SpaceshipBuildMine */:
      return possibleSpaceshipBuildMine(engine, player, data);
    case "spaceshipUpgradeBuilding" /* SpaceshipUpgradeBuilding */:
      return possibleSpaceshipUpgradeBuilding(engine, player, data);
    case "federationTokenBuildMine" /* FederationTokenBuildMine */:
      return possibleFederationTokenBuildMine(engine, player, data);
    case "spaceshipTechTileBuildMine" /* SpaceshipTechTileBuildMine */:
      return possibleSpaceshipTechTileBuildMine(engine, player);
    case "chooseFederationTile" /* ChooseFederationTile */:
      return possibleFederationTiles(engine, player, "pool");
    case "rescoreFederationTile" /* RescoreFederationTile */:
      return possibleFederationTiles(engine, player, "player");
    case "chooseArtifactToken" /* ChooseArtifactToken */:
      return possibleArtifactTokens(engine, player);
    case "placePowerRing" /* PlacePowerRing */:
      return possiblePowerRingPlacements(engine, player);
    case "buildMine" /* BuildMine */:
      return [...possibleMineBuildings(engine, player, false), ...possibleShipMovements(engine, player, true)];
    case "buildMineOrGaiaFormer" /* BuildMineOrGaiaFormer */:
      return [...possibleMineBuildings(engine, player, true, data), ...possibleExplorations(engine, player)];
    case "spaceStation" /* SpaceStation */:
      return possibleSpaceStations(engine, player);
    case "swap-PI" /* PISwap */:
      return possiblePISwaps(engine, player);
    case "down-lab" /* DowngradeLab */:
      return possibleLabDowngrades(engine, player);
    case "brainStone" /* BrainStone */:
      return [{ name: "brainstone" /* BrainStone */, player, data }];
    // case SubPhase.MoveShip:
    //   return possibleShipMovements(engine, player);
    case "beforeMove" /* BeforeMove */: {
      return [
        ...possibleBuildings(engine, player),
        ...possibleExplorations(engine, player),
        ...possibleShipMovements(engine, player, false),
        ...possibleFederations(engine, player),
        ...possibleResearchAreas(engine, player, UPGRADE_RESEARCH_COST),
        ...possibleBoardActions(engine.boardActions, engine.player(player), engine.replay),
        ...possibleSpecialActions(engine, player),
        ...possibleFreeActions(engine.player(player)),
        ...possibleRoundBoosters(engine, player),
        ...possibleSpaceshipActions(engine, player),
        ...possibleExamineArtifact(engine, player)
      ];
    }
    case "afterMove" /* AfterMove */:
      return [...possibleFreeActions(engine.player(player)), { name: "endturn" /* EndTurn */, player }];
    default:
      break;
  }
  switch (engine.phase) {
    case "setupInit" /* SetupInit */:
      return [{ name: "init" /* Init */ }];
    //doesn't have player
    case "setupBoard" /* SetupBoard */:
      return possibleSetupBoardActions(engine, player);
    case "setupFactionBan" /* SetupFactionBan */:
      return possibleFactionBans(engine, player);
    case "setupFaction" /* SetupFaction */:
      return chooseFactionOrBid(engine, player);
    case "setupAuction" /* SetupAuction */:
      return possibleBids(engine, player);
    case "setupSilentBid" /* SetupSilentBid */:
      return possibleSilentBids(engine, player);
    case "setupPreferenceBid" /* SetupPreferenceBid */:
      return possiblePreferenceBids(engine, player);
    case "setupBuilding" /* SetupBuilding */: {
      const planet = engine.player(player).planet;
      const faction = engine.player(player).faction;
      const buildings = [];
      for (const hex of engine.map.toJSON()) {
        if (hex.data.planet === planet && !hex.data.building) {
          buildings.push({
            building: faction === "ivits" /* Ivits */ || faction === "tinkeroids" /* Tinkeroids */ ? "PI" /* PlanetaryInstitute */ : "m" /* Mine */,
            coordinates: hex.toString(),
            cost: "~",
            // §B1/§B2: starting buildings are placed, not built via the "Build a Mine" action —
            // no Gaiaformer is consumed on a home Asteroid (factions own 0 Gaiaformers at setup).
            consumesAsteroidGaiaformer: false
          });
        }
      }
      return [{ name: "build" /* Build */, player, data: { buildings } }];
    }
    case "setupBooster" /* SetupBooster */:
      return possibleRoundBoosters(engine, player);
    case "roundIncome" /* RoundIncome */:
      if (engine.player(player).needsTinkeringTileChoice(engine.round)) {
        return possibleTinkeringTiles(engine, player);
      }
      return possibleIncomes(engine, player);
    case "roundGaia" /* RoundGaia */:
      return possibleGaiaFreeActions(engine, player);
    case "roundLeech" /* RoundLeech */:
      return possibleLeech(engine, player);
  }
  return [];
}

// engine/src/move/actions.ts
var import_lodash21 = __toESM(require_lodash2());
import assert14 from "node:assert";
function moveSpecial(engine, command, player, income) {
  const { specialacts } = command.data;
  const actAvailable = specialacts.find((sa) => Reward.match(Reward.parse(sa.income), Reward.parse(income)));
  assert14(actAvailable !== void 0, `Special action ${income} is not available`);
  engine.player(player).activateEvent(actAvailable.spec);
}
function moveSpend(engine, command, player, costS, _for, incomeS) {
  const pl = engine.player(player);
  const cost = Reward.merge(Reward.parse(costS));
  const income = Reward.merge(Reward.parse(incomeS));
  assert14(!cost.some((r) => r.count <= 0) && !income.some((r) => r.count <= 0), "Nice try!");
  assert14(pl.data.canPay(cost) && cost, `Impossible to pay ${costS} for ${incomeS}`);
  assert14(_for === "for", "Expect second part of command to be 'for'");
  const isPossible = (cost2, income2) => {
    for (const action of command.data.acts) {
      const actionCost = Reward.parse(action.cost);
      if (Reward.includes(cost2, actionCost)) {
        const newCost = Reward.merge(cost2, Reward.negative(actionCost));
        let newIncome = Reward.merge(income2, Reward.negative(Reward.parse(action.income)));
        newCost.push(...Reward.negative(newIncome.filter((rew) => rew.count < 0)));
        newIncome = newIncome.filter((rew) => rew.count > 0);
        if (newIncome.length === 0 && newCost.length === 0) {
          return true;
        }
        if (isPossible(newCost, newIncome)) {
          return true;
        }
      }
    }
    return false;
  };
  assert14(isPossible(cost, income), `spend ${cost} for ${income} is not allowed`);
  pl.payCosts(cost, "spend" /* Spend */);
  pl.gainRewards(income, "spend" /* Spend */);
}
function moveBurn(engine, command, player, cost) {
  assert14(command.data.includes(+cost), `Impossible to burn ${cost} power`);
  engine.players[player].data.burnPower(+cost);
}
function moveAction(engine, command, player, action) {
  assert14(
    command.data.poweracts.find((act) => act.name === action),
    `${action} is not in the available power actions`
  );
  const pl = engine.player(player);
  engine.boardActions[action] = player;
  pl.payCosts(Reward.parse(boardActions[action].cost), action);
  pl.loadEvents(Event.parse(boardActions[action].income, action));
}
function movePiSwap(engine, command, player, location) {
  const { buildings } = command.data;
  const pl = engine.player(player);
  const PIHex = pl.data.occupied.find((hex) => hex.buildingOf(player) === "PI" /* PlanetaryInstitute */);
  const parsed = engine.map.parse(location);
  for (const elem of buildings) {
    if ((0, import_lodash21.isEqual)(engine.map.parse(elem.coordinates), parsed)) {
      const hex = engine.map.getS(location);
      if (hex.buildingOf(player) === "m" /* Mine */) {
        hex.data.building = "PI" /* PlanetaryInstitute */;
        PIHex.data.building = "m" /* Mine */;
        pl.federationCache = null;
        return;
      }
    }
  }
  assert14(false, `Impossible to execute PI swap command at ${location}`);
}
function moveChooseTinkeringTile(engine, command, player, tile) {
  assert14(command.data.tiles.includes(tile), `${tile} is not in the available Tinkering tiles`);
  engine.player(player).chooseTinkeringTile(engine.round, tile);
}
function movePlacePowerRing(engine, command, player, location) {
  const parsed = engine.map.parse(location);
  const space = command.data.spaces.find((entry) => (0, import_lodash21.isEqual)(engine.map.parse(entry.coordinates), parsed));
  assert14(space, `Impossible to place a Power Ring at ${location}`);
  const pl = engine.player(player);
  const hex = engine.map.getS(location);
  hex.data.powerRing = player;
  pl.data.powerRingsPlaced += 1;
  pl.federationCache = null;
}

// engine/src/move/artifacts.ts
import assert15 from "node:assert";
function moveExamineArtifact(engine, command, player) {
  const pl = engine.player(player);
  pl.payCosts(Reward.parse(command.data.cost), "twilight" /* Twilight */);
  pl.gainRewards([new Reward(1, "artifact" /* GainArtifact */)], "twilight" /* Twilight */);
}
function moveChooseArtifactToken(engine, command, player, token) {
  assert15(command.data.tokens.includes(token), `Artifact token ${token} is not available`);
  engine.tiles.artifacts.splice(engine.tiles.artifacts.indexOf(token), 1);
  applyArtifactToken(engine, player, token);
}
function applyArtifactToken(engine, player, token) {
  const pl = engine.player(player);
  pl.data.artifacts.push(token);
  const rewardSpec = artifactTokenRewards[token];
  if (rewardSpec) {
    pl.loadEvents(Event.parse([rewardSpec], "twilight" /* Twilight */));
  }
  switch (token) {
    case "artifact-asteroid" /* Asteroid */:
      applyArtifactPlanetType(pl, "a" /* Asteroid */);
      break;
    case "artifact-protoplanet" /* Protoplanet */:
      applyArtifactPlanetType(pl, "p" /* Protoplanet */);
      break;
    case "artifact-researchlevel" /* ResearchLevel */:
      pl.gainRewards(
        [new Reward(3 * pl.data.research["sci" /* Science */], "vp" /* VictoryPoint */)],
        "twilight" /* Twilight */
      );
      break;
    case "artifact-researchtracks" /* ResearchTracks */:
      pl.gainRewards(
        [new Reward(3 * Object.values(pl.data.research).filter((level) => level >= 3).length, "vp" /* VictoryPoint */)],
        "twilight" /* Twilight */
      );
      break;
    case "artifact-gaiaproject" /* GaiaProject */:
      pl.gainRewards(
        [new Reward(3 * pl.data.research["gaia" /* GaiaProject */], "vp" /* VictoryPoint */)],
        "twilight" /* Twilight */
      );
      break;
    case "artifact-planettypes" /* PlanetTypes */:
      pl.gainRewards(
        [new Reward(3 + pl.eventConditionCount("pt" /* PlanetType */), "vp" /* VictoryPoint */)],
        "twilight" /* Twilight */
      );
      break;
    case "artifact-deepspace" /* DeepSpace */:
      pl.gainRewards(
        [new Reward(3 * pl.eventConditionCount("ds" /* DeepSpaceSector */), "vp" /* VictoryPoint */)],
        "twilight" /* Twilight */
      );
      break;
  }
}
function applyArtifactPlanetType(pl, planet) {
  const alreadyColonized = pl.ownedPlanets.some((hex) => hex.data.planet === planet) || pl.data.artifactPlanetTypes.includes(planet);
  pl.gainRewards([new Reward(7, "vp" /* VictoryPoint */)], "twilight" /* Twilight */);
  pl.data.artifactPlanetTypes.push(planet);
  if (!alreadyColonized) {
    pl.receiveTriggerIncome("newplanet" /* NewPlanetType */);
  }
}

// engine/src/move/auto.ts
import assert16 from "node:assert";

// engine/src/auto-charge.ts
var ChargeRequest = class {
  constructor(player, offers, isLastRound, playerHasPassed, incomeSelection) {
    this.player = player;
    this.offers = offers;
    this.isLastRound = isLastRound;
    this.playerHasPassed = playerHasPassed;
    this.incomeSelection = incomeSelection;
    const autoCharge = player.settings.autoChargePower;
    let minCharge = 100;
    let maxCharge = 0;
    const limit = Math.max(
      player.settings.autoChargeTargetSpendablePower,
      autoCharge === "decline-cost" || autoCharge === "ask" ? 1 : autoCharge
    );
    let allowedMax = 0;
    let maxAllowedOffer = null;
    for (const offer of this.offers) {
      const rewards = Reward.parse(offer.offer);
      for (let i = 0; i < rewards.length; i++) {
        const reward = rewards[i];
        if (reward.type === "pw" /* ChargePower */) {
          const charge = reward.count;
          if (charge < minCharge) {
            minCharge = charge;
          }
          if (charge > maxCharge) {
            maxCharge = charge;
          }
          if (charge <= limit) {
            if (charge > allowedMax) {
              maxAllowedOffer = offer;
              allowedMax = charge;
            } else if (charge === allowedMax && i === 0) {
              maxAllowedOffer = offer;
            }
          }
        }
      }
    }
    this.minCharge = minCharge;
    this.maxCharge = maxCharge;
    this.maxAllowedOffer = maxAllowedOffer;
  }
};
var chargeRules = [
  askOrDeclineForPassedPlayer,
  (r) => askForMultipleTaklonsOffers(r.offers, r.player.settings.autoBrainstone),
  (r) => allowBasedOnTargetPower(r.player),
  (r) => askOrDeclineBasedOnCost(r.minCharge, r.maxCharge, r.player.settings.autoChargePower),
  askForItars,
  () => "yes" /* Yes */
];
function decideChargeRequest(r) {
  let noYes = false;
  for (const chargeRule of chargeRules) {
    const decision = chargeRule(r);
    if (decision === "no-automatic-yes" /* NoAutomaticYes */) {
      noYes = true;
    } else if (decision === "yes" /* Yes */ && noYes) {
    } else if (decision !== "undecided" /* Undecided */) {
      return decision;
    }
  }
  return "ask" /* Ask */;
}
function askOrDeclineForPassedPlayer(r) {
  const noOfferIsFree = r.offers.every((offer) => offer.cost !== "~");
  if (r.playerHasPassed) {
    if (r.isLastRound) {
      return noOfferIsFree ? "no" /* No */ : "yes" /* Yes */;
    }
    if (noOfferIsFree) {
      const remaining = r.incomeSelection.remainingChargesAfterIncome;
      if (remaining <= 0 && r.offers.length < 2) {
        return "no" /* No */;
      } else if (remaining < r.minCharge) {
        return "no-automatic-yes" /* NoAutomaticYes */;
      }
    }
  }
  return "undecided" /* Undecided */;
}
function askForMultipleTaklonsOffers(offers, autoBrainstone2) {
  if (offers.length === 2 && autoBrainstone2) {
    return "undecided" /* Undecided */;
  }
  if (offers.length > 1) {
    return "ask" /* Ask */;
  }
  return "undecided" /* Undecided */;
}
function allowBasedOnTargetPower(player) {
  if (player.data.spendablePowerTokens() < player.settings.autoChargeTargetSpendablePower) {
    return "yes" /* Yes */;
  }
  return "undecided" /* Undecided */;
}
function askOrDeclineBasedOnCost(minCharge, maxCharge, autoCharge) {
  if (autoCharge === "ask") {
    return "ask" /* Ask */;
  }
  if (autoCharge === "decline-cost") {
    if (minCharge > 1) {
      return "no" /* No */;
    }
    return "undecided" /* Undecided */;
  }
  if (maxCharge > Number(autoCharge)) {
    return "ask" /* Ask */;
  }
  return "undecided" /* Undecided */;
}
function askForItars(r) {
  if (r.player.faction === "itars" /* Itars */ && !r.player.settings.itarsAutoChargeToArea3 && !autoChargeItars(r.player.data.power.area1, r.minCharge) && !r.isLastRound) {
    return "ask" /* Ask */;
  }
  return "undecided" /* Undecided */;
}
function autoChargeItars(area1, power) {
  return area1 >= power;
}

// engine/src/move/auto.ts
function autoMove(engine, partialMove, options) {
  if (engine.playerToMove === void 0) {
    return false;
  }
  const toMove = engine.playerToMove;
  const factionOrPlayer = engine.player(toMove).faction ?? `p${toMove + 1}`;
  let _copy;
  const copy = () => _copy || (_copy = Engine3.fromData(JSON.parse(JSON.stringify(engine))));
  const copyOrThis = () => _copy || engine;
  const functions = [
    [
      "faction" /* ChooseFaction */,
      (cmd) => autoChooseFaction(copyOrThis(), cmd)
    ],
    [
      "charge" /* ChargePower */,
      (cmd) => autoChargePower(copyOrThis(), cmd)
    ],
    ["income" /* ChooseIncome */, () => autoIncome(copyOrThis())],
    [
      "brainstone" /* BrainStone */,
      (cmd) => autoBrainstone(copyOrThis(), cmd)
    ],
    ...options?.autoPass ? [[void 0, () => autoPass(copyOrThis())]] : []
  ];
  if (partialMove) {
    copy().move(partialMove);
    if (copy().newTurn) {
      engine.move(partialMove, false);
      return true;
    }
  }
  for (const [command, handler] of functions) {
    let movePart;
    if (command) {
      const availableCommand = copyOrThis().findAvailableCommand(toMove, command);
      if (!availableCommand) {
        continue;
      }
      movePart = handler(availableCommand);
    } else {
      movePart = handler();
    }
    if (!movePart) {
      continue;
    }
    const newMove = partialMove ? `${partialMove}. ${movePart}` : `${factionOrPlayer} ${movePart}`;
    return engine.autoMove(newMove, options);
  }
  return false;
}
function autoChooseFaction(engine, cmd) {
  if (engine.availableCommands.length > 1) {
    return false;
  }
  const factions2 = cmd.data;
  if (factions2.length === 1) {
    return `${"faction" /* ChooseFaction */} ${factions2[0]}`;
  }
  return false;
}
function autoChargePower(engine, cmd) {
  const offers = cmd.data.offers;
  const pl = engine.player(engine.playerToMove);
  const playerHasPassed = engine.passedPlayers.includes(pl.player);
  const request = new ChargeRequest(pl, offers, engine.isLastRound, playerHasPassed, pl.incomeSelection());
  const chargeDecision = decideChargeRequest(request);
  switch (chargeDecision) {
    case "yes" /* Yes */: {
      const offer = request.maxAllowedOffer;
      if (!offer) {
        return false;
      }
      assert16(offer, `could not find max offer: ${JSON.stringify([offers, pl.settings])}`);
      return `${"charge" /* ChargePower */} ${offer.offer}`;
    }
    case "no" /* No */:
      return `${"decline" /* Decline */} ${offers[0].offer}`;
    case "ask" /* Ask */:
      return false;
    case "undecided" /* Undecided */:
      assert16(false, `Could not decide how to charge power: ${request}`);
  }
}
function autoIncome(engine) {
  const pl = engine.player(engine.playerToMove);
  if (pl.settings.autoIncome) {
    const events = pl.incomeSelection().autoplayEvents();
    const relevantReward = events[0]?.rewards.find(
      (rew) => rew.type === "pw" /* ChargePower */ || rew.type === "t" /* GainToken */
    );
    if (!relevantReward) {
      return false;
    }
    return `${"income" /* ChooseIncome */} ${relevantReward}`;
  }
  return false;
}
function autoBrainstone(engine, cmd) {
  const pl = engine.player(engine.playerToMove);
  if (pl.settings.autoBrainstone) {
    if (cmd.data.choices.some((c) => c.warning)) {
      return false;
    }
    const choices = cmd.data.choices.map((c) => c.area);
    if (choices.some((choice) => choice === "gaia" /* Gaia */ || choice === "discard")) {
      return false;
    }
    const dest = choices.includes("area3" /* Area3 */) ? "area3" /* Area3 */ : "area2" /* Area2 */;
    return `${"brainstone" /* BrainStone */} ${dest}`;
  }
  return false;
}
function autoPass(engine) {
  const toMove = engine.playerToMove;
  assert16(toMove !== void 0, "Can't execute a move when no player can move");
  const pl = engine.player(toMove);
  if (engine.availableCommands.some((cmd) => cmd.name === "decline" /* Decline */)) {
    const cmd = engine.findAvailableCommand(engine.playerToMove, "decline" /* Decline */);
    return `${"decline" /* Decline */} ${cmd.data.offers[0].offer}`;
  } else if (engine.availableCommands.some((cmd) => cmd.name === "pass" /* Pass */)) {
    const cmd = engine.findAvailableCommand(engine.playerToMove, "pass" /* Pass */);
    const boosters = cmd.data.boosters;
    if (boosters.length > 0) {
      return `${"pass" /* Pass */} ${boosters[0]}`;
    } else {
      return `${"pass" /* Pass */}`;
    }
  } else if (engine.availableCommands.some((cmd) => cmd.name === "income" /* ChooseIncome */)) {
    const cmd = engine.findAvailableCommand(engine.playerToMove, "income" /* ChooseIncome */);
    return `${"income" /* ChooseIncome */} ${cmd.data}`;
  } else if (engine.availableCommands.some((cmd) => cmd.name === "brainstone" /* BrainStone */)) {
    const cmd = engine.findAvailableCommand(engine.playerToMove, "brainstone" /* BrainStone */);
    return `${"brainstone" /* BrainStone */} ${cmd.data.choices[0].area}`;
  } else if (engine.availableCommands.some(
    (cmd) => cmd.name === "spend" /* Spend */ && cmd.data.acts[0].cost.includes("tg" /* GainTokenGaiaArea */)
  )) {
    return `${"spend" /* Spend */} ${pl.data.power.gaia}${"tg" /* GainTokenGaiaArea */} for ${pl.data.power.gaia}${"c" /* Credit */}`;
  } else {
    assert16(
      false,
      "Can't automove for player " + (engine.playerToMove + 1) + ", available command: " + engine.availableCommands[0].name
    );
  }
}

// engine/src/move/buildings.ts
var import_lodash22 = __toESM(require_lodash2());
import assert17 from "node:assert";
function moveBuild(engine, command, player, building, location) {
  const { buildings } = command.data;
  const parsed = engine.map.parse(location);
  const pl = engine.player(player);
  for (const elem of buildings) {
    if (elem.building === building && (0, import_lodash22.isEqual)(engine.map.parse(elem.coordinates), parsed)) {
      placeBuilding(engine, pl, elem);
      return;
    }
  }
  assert17(
    false,
    `Impossible to execute build command at ${location}, available: ${buildings.map((b) => b.coordinates)}`
  );
}
function placeBuilding(engine, pl, building) {
  const hex = engine.map.getS(building.coordinates);
  pl.build(
    building.building,
    hex,
    Reward.parse(building.cost),
    engine.map,
    building.steps,
    building.consumesAsteroidGaiaformer ?? true
  );
  if ((engine.phase === "roundMove" /* RoundMove */ || engine.phase === "roundShip" /* RoundShip */) && !isShip(building.building)) {
    engine.leechSources.unshift({ player: pl.player, coordinates: building.coordinates });
  }
}
function moveLostPlanet(engine, command, player, location) {
  const { spaces } = command.data;
  const parsed = engine.map.parse(location);
  const data = spaces.find((space) => (0, import_lodash22.isEqual)(engine.map.parse(space.coordinates), parsed));
  assert17(data, `Impossible to place lost planet at ${location}`);
  const hex = engine.map.getS(location);
  assert17(!hex.hasSpaceship(), "Can't place the Lost Planet on a spaceship hex");
  hex.data.planet = "l" /* Lost */;
  engine.players.forEach((p) => p.notifyOfNewPlanet(hex));
  engine.player(player).build("m" /* Mine */, hex, Reward.parse(data.cost), engine.map, 0);
  engine.leechSources.unshift({ player, coordinates: location });
}

// engine/src/move/exploration.ts
import assert18 from "node:assert";
function moveExplore(engine, command, player, ship) {
  const availableShip = command.data.ships.find((entry) => entry.ship === ship);
  assert18(availableShip !== void 0, `${ship} is not in the available exploration targets`);
  const pl = engine.player(player);
  const cost = Reward.parse(availableShip.cost);
  assert18(canPayExplorationCost(pl, cost), `${player} cannot pay the exploration cost for ${ship}`);
  pl.payCosts(cost, "explore" /* Explore */);
  deployExplorationShuttle(pl, ship, availableShip.slot, "explore" /* Explore */);
}

// engine/src/move/federation.ts
import assert19 from "node:assert";
function moveChooseFederationTile(engine, command, player, federation) {
  const { tiles, rescore } = command.data;
  assert19(tiles.indexOf(federation) !== -1, `Federation ${federation} is not availabe`);
  if (rescore) {
    if (Object.values(SpaceshipFederation).includes(federation)) {
      rescoreSpaceshipFederationToken(engine, player, federation);
    } else {
      engine.player(player).gainRewards(federationRewards(federation), "qic2" /* Qic2 */);
    }
  } else {
    engine.player(player).gainFederationToken(federation);
    engine.tiles.federations[federation] -= 1;
  }
}
function rescoreSpaceshipFederationToken(engine, player, federation) {
  const pl = engine.player(player);
  const rewardSpec = spaceshipFederationRewards[federation];
  if (rewardSpec) {
    pl.gainRewards(Reward.parse(rewardSpec), "qic2" /* Qic2 */);
  }
  if (federation === "ship-fed-power" /* PowerTokens */) {
    pl.data.power.area3 += 2;
  }
  if (federation === "ship-fed-range" /* Range */ || federation === "ship-fed-terraform" /* Terraform */) {
    engine.processNextMove("federationTokenBuildMine" /* FederationTokenBuildMine */, { federation }, false);
  }
}
function moveFormFederation(engine, command, player, hexes, tile) {
  const pl = engine.player(player);
  const claimableFederations = claimableSpaceshipFederations(
    pl.data.explorationShips,
    engine.tiles.spaceshipFederations
  );
  const claimedShip = claimableFederations.find((entry) => entry.federation === tile);
  const poolFederation = Federation.values(6 /* All */).find((entry) => entry === tile);
  assert19(poolFederation !== void 0 || claimedShip !== void 0, `Impossible to form federation with token ${tile}`);
  const fedInfo = pl.checkAndGetFederationInfo(hexes, engine.map, engine.options.flexibleFederations, engine.replay);
  assert19(fedInfo, `Impossible to form federation at ${hexes}`);
  assert19(command.data.tiles.includes(tile), `Impossible to form federation ${tile}`);
  if (poolFederation !== void 0) {
    pl.formFederation(fedInfo.hexes, poolFederation);
    engine.tiles.federations[poolFederation] -= 1;
  } else {
    pl.completeFederation(fedInfo.hexes);
    pl.gainSpaceshipFederationToken(claimedShip.federation);
    delete engine.tiles.spaceshipFederations[claimedShip.ship];
    if (claimedShip.federation === "ship-fed-range" /* Range */ || claimedShip.federation === "ship-fed-terraform" /* Terraform */) {
      engine.processNextMove("federationTokenBuildMine" /* FederationTokenBuildMine */, { federation: claimedShip.federation }, false);
    }
  }
}

// engine/src/move/leech.ts
import assert20 from "node:assert";
function moveChargePower(engine, command, player, income) {
  const leechCommand = command.data;
  const leechRewards = Reward.parse(income);
  if (!leechCommand.offers) {
    const legacy = leechCommand;
    leechCommand.offers = [
      {
        offer: legacy.offer,
        cost: legacy.cost
      }
    ];
  }
  const offer = leechCommand.offers.find((ofr) => ofr.offer === income);
  assert20(offer, `Cannot leech ${income}. Possible leeches: ${leechCommand.offers.map((ofr) => ofr.offer).join(" - ")}`);
  engine.player(player).gainRewards(leechRewards, "charge" /* ChargePower */);
  engine.player(player).payCosts(Reward.parse(offer.cost), "charge" /* ChargePower */);
}
function moveDecline(engine, command, player) {
  engine.player(player).declined = true;
}
function moveBrainStone(engine, command, player, dest) {
  const areas = command.data.choices.map((a) => a.area);
  assert20(areas.includes(dest), `Possible brain stone areas: ${areas.join(", ")} - got ${dest}`);
  engine.players[player].data.brainstoneDest = dest;
}

// engine/src/move/research.ts
import assert21 from "node:assert";
function moveResearch(engine, command, player, field) {
  const { tracks } = command.data;
  const track = tracks.find((tr) => tr.field === field);
  assert21(track, `Impossible to upgrade research for ${field}`);
  advanceResearchAreaPhase(engine, player, track.cost, field);
}
function moveChooseTechTile(engine, command, player, pos) {
  const { tiles } = command.data;
  const tileAvailable = tiles.find((ta) => ta.pos === pos);
  assert21(tileAvailable !== void 0, `Impossible to get ${pos} tile`);
  if (isAdvanced(pos)) {
    engine.processNextMove("coverTechTile" /* CoverTechTile */);
  }
  engine.player(player).gainTechTile(tileAvailable);
  if (Spaceship.values(engine.expansions).includes(pos)) {
    const shipTech = engine.tiles.spaceshipTechs[pos];
    assert21(shipTech !== void 0 && shipTech.count > 0, `Impossible to get ${pos} spaceship tech tile`);
    shipTech.count -= 1;
    if (shipTech.count === 0) {
      delete engine.tiles.spaceshipTechs[pos];
    }
  } else {
    engine.tiles.techs[pos].count -= 1;
  }
  if (tileAvailable.tile === "ship-tech-terraform" /* Terraform */) {
    engine.processNextMove("spaceshipTechTileBuildMine" /* SpaceshipTechTileBuildMine */, null, false);
  }
  engine.processNextMove(
    "upgradeResearch" /* UpgradeResearch */,
    ResearchField.values(engine.expansions).includes(pos) ? { pos } : void 0
  );
}
function moveChooseCoverTechTile(engine, command, player, tilePos) {
  const { tiles } = command.data;
  const tileAvailable = tiles.find((ta) => ta.pos === tilePos);
  assert21(tileAvailable !== void 0, `Impossible to cover ${tilePos} tile`);
  engine.player(player).coverTechTile(tileAvailable.pos);
}

// engine/src/move/round.ts
import assert22 from "node:assert";
function moveChooseRoundBooster(engine, command, player, booster) {
  const { boosters } = command.data;
  assert22(boosters.includes(booster), `${booster} is not in the available boosters`);
  engine.tiles.boosters[booster] = false;
  engine.players[player].getRoundBooster(booster);
}
function movePass(engine, command, player, booster) {
  engine.tiles.boosters[engine.players[player].data.tiles.booster] = true;
  engine.players[player].pass();
  if (!engine.isLastRound) {
    moveChooseRoundBooster(engine, command, player, booster);
  }
  engine.passedPlayers.push(player);
  engine.turnOrder.splice(engine.turnOrder.indexOf(player), 1);
}
function moveEndTurn(engine, command, player) {
}
function moveChooseIncome(engine, command, player, income) {
  const incomes = command.data;
  const incomeRewards = income.split(",");
  const pl = engine.player(player);
  for (const incR of incomeRewards) {
    const eventIdx = incomes.findIndex((rw) => Reward.match(Reward.parse(incR), Reward.parse(rw)));
    assert22(eventIdx > -1, `${incR} is not in the available income: ${incomes.join(",")}`);
    incomes.splice(eventIdx, 1);
  }
  pl.receiveIncomeEvent(Reward.parse(income));
}

// engine/src/move/ships.ts
import assert23 from "node:assert";
function moveShip(engine, command, player, shipType, source, dest, actionType, actionLocation) {
  const pl = engine.player(player);
  const data = command.data;
  const shipCommand = data.find((s) => s.ship === shipType && s.source === source);
  assert23(shipCommand, `There is no ship ${shipType} at ${source}`);
  const target = shipCommand.targets.find((t) => t.location.coordinates === dest);
  assert23(target, `The ship ${shipType} doesn't have the range to move from ${source} to ${dest}`);
  const ship = pl.findUnmovedShip(shipType, source);
  assert23(ship, `No ${shipType} at ${source} (or has already moved)`);
  ship.moved = true;
  ship.location = dest;
  const actions = target.actions;
  if (actionType) {
    const action = actions?.find((a) => a.type === actionType);
    assert23(action, `action ${actionType} not possible for ship ${shipType} at ship location ${dest}`);
    assert23(actionLocation, "no action location provided");
    const location = action.locations.find((l) => l.coordinates === actionLocation);
    assert23(location, `action ${actionType} not possible for ship ${shipType} at action location ${actionLocation}`);
    switch (actionType) {
      case "buildColony" /* BuildColony */:
        placeBuilding(engine, pl, location);
        pl.removeShip(ship, false);
        break;
      case "trade" /* Trade */:
        trade(engine, pl, location);
        break;
    }
  }
}
function trade(engine, pl, location) {
  if (location.tradeCost) {
    pl.payCosts(Reward.parse(location.tradeCost), tradeCostSource);
  }
  if (location.rewards) {
    pl.gainRewards(Reward.parse(location.rewards), tradeSource);
  }
  const hex = engine.map.getS(location.coordinates);
  if (hex.data.building === "m" /* Mine */ && pl.player !== hex.data.player) {
    const cost = location.cost ? Reward.parse(location.cost) : [];
    pl.build("customsPost" /* CustomsPost */, hex, cost, engine.map);
  } else {
    hex.data.tradeTokens = hex.tradeTokens.concat(pl.player);
  }
  pl.receiveTriggerIncome("trade" /* Trade */);
}

// engine/src/move/spaceship-actions.ts
var import_lodash23 = __toESM(require_lodash2());
import assert24 from "node:assert";
function moveSpaceshipAction(engine, command, player, ship, type) {
  const availableAction = command.data.actions.find((action) => action.ship === ship && action.type === type);
  assert24(availableAction !== void 0, `${ship} ${type} action is not available`);
  const pl = engine.player(player);
  engine.spaceshipActions[ship] = { ...engine.spaceshipActions[ship], [type]: player };
  pl.payCosts(Reward.parse(availableAction.cost), ship);
  if (type === "qic") {
    pl.receiveTriggerIncome("shipq" /* SpaceshipQicAction */);
  }
  if (ship === "eclipse" /* Eclipse */ && type === "power") {
    engine.processNextMove("upgradeResearch" /* UpgradeResearch */, null, false);
    return;
  }
  if (ship === "tfmars" /* TFMars */ && type === "power") {
    engine.processNextMove("instantGaiaforming" /* InstantGaiaforming */, null, false);
    return;
  }
  if ((ship === "eclipse" /* Eclipse */ || ship === "tfmars" /* TFMars */) && type === "credit") {
    engine.processNextMove("spaceshipBuildMine" /* SpaceshipBuildMine */, { ship }, false);
    return;
  }
  if (ship === "rebellion" /* Rebellion */ && type === "power") {
    engine.processNextMove(
      "spaceshipUpgradeBuilding" /* SpaceshipUpgradeBuilding */,
      { from: "m" /* Mine */, to: "ts" /* TradingStation */ },
      false
    );
    return;
  }
  if (ship === "twilight" /* Twilight */ && type === "power") {
    engine.processNextMove(
      "spaceshipUpgradeBuilding" /* SpaceshipUpgradeBuilding */,
      { from: "ts" /* TradingStation */, to: "lab" /* ResearchLab */ },
      false
    );
    return;
  }
  pl.loadEvents(Event.parse(spaceshipActionEffects[ship][type], ship));
}
function moveGaiaFormTransdim(engine, command, player, location) {
  const { spaces } = command.data;
  const parsed = engine.map.parse(location);
  const space = spaces.find((space2) => (0, import_lodash23.isEqual)(engine.map.parse(space2.coordinates), parsed));
  assert24(space, `Impossible to instant-gaiaform at ${location}`);
  const pl = engine.player(player);
  const hex = engine.map.getS(location);
  pl.build("gf" /* GaiaFormer */, hex, Reward.parse(space.cost), engine.map);
  hex.data.planet = "g" /* Gaia */;
}

// engine/src/engine.ts
var LEECHING_DISTANCE = 2;
var premovePreviewablePhases = ["roundMove" /* RoundMove */, "roundLeech" /* RoundLeech */, "roundIncome" /* RoundIncome */, "roundGaia" /* RoundGaia */];
var replaceRegex = new RegExp(
  `\\b((${"pass" /* Pass */}|${"swap-PI" /* PISwap */}|${"gf" /* GaiaFormer */}|${"federation" /* FormFederation */} [^ ]+|${"up" /* UpgradeResearch */}) ?([^. ]+)?)(\\.|$)`,
  "g"
);
var powerRegex = new RegExp(
  " \\((\\d+(,B)?/\\d+(,B)?/\\d+(,B)?/\\d+(,B)?) \u21D2 \\d+(,B)?/\\d+(,B)?/\\d+(,B)?/\\d+(,B)?\\)"
);
function createMoveToShow(move, player, map, executeMove) {
  let moveToGaia = null;
  const data = player.data;
  const oldPower = powerLogString(data.power, data.brainstone);
  const listener = (event) => moveToGaia = event;
  const formerBooster = data.tiles.booster;
  const formerPI = player.faction === "ambas" /* Ambas */ && move.includes("swap-PI" /* PISwap */) ? [...map.grid.values()].find((h) => h.buildingOf(player.player) === "PI" /* PlanetaryInstitute */) : null;
  data.on("move-tokens", listener);
  try {
    executeMove();
  } finally {
    data.off("move-tokens", listener);
  }
  const addDetails = () => {
    return move.replace(replaceRegex, (match, moveWithoutEnding, command, commandArgument, moveEnding) => {
      if (moveToGaia) {
        const powerUsage = Object.entries(moveToGaia).map(([area, amt]) => {
          return amt > 0 ? area + ": " + amt : "";
        }).filter((s) => s.length > 0).join(", ");
        return `${moveWithoutEnding} using ${powerUsage}${moveEnding}`;
      }
      switch (command) {
        case "pass" /* Pass */:
          return `${moveWithoutEnding} returning ${formerBooster}${moveEnding}`;
        case "swap-PI" /* PISwap */:
          return `${moveWithoutEnding} (from ${formerPI.toString()})${moveEnding}`;
        case "up" /* UpgradeResearch */: {
          const level = data.research[commandArgument];
          if (!level) {
            return match;
          }
          return `${moveWithoutEnding} (${level - 1} \u21D2 ${level})${moveEnding}`;
        }
      }
      return match;
    });
  };
  const withDetails = addDetails();
  const newPower = powerLogString(data.power, data.brainstone);
  if (oldPower !== newPower) {
    const lastOldPower = powerRegex.exec(withDetails);
    if (lastOldPower) {
      return `${withDetails.replace(lastOldPower[0], "")} (${lastOldPower[1]} \u21D2 ${newPower})`;
    }
    return `${withDetails} (${oldPower} \u21D2 ${newPower})`;
  }
  return withDetails;
}
var Engine3 = class _Engine {
  constructor(moves = [], options = {}, engineVersion, replay) {
    this.players = [];
    this.setup = [];
    // Silent Auction variant (AuctionVariant.Silent) state - see move/phase.ts's
    // SetupFactionBan/SetupSilentBid phases and algorithms/silent-auction.ts.
    this.bannedFactions = [];
    this.silentAuctionBids = [];
    this.silentAuctionLog = [];
    // Preference Split Auction variant (AuctionVariant.PreferenceSplit) state - see move/phase.ts's
    // SetupPreferenceBid phase and algorithms/preference-split-auction.ts. `preferenceSplitResult`
    // is the persisted, audited outcome (ranking, both kinds of random tiebreak, every payment):
    // written exactly once, when the last submission lands, and never recomputed afterwards.
    this.preferenceSplitBids = [];
    this.options = {};
    this.tiles = {
      boosters: {},
      techs: {},
      scorings: { round: [], final: [] },
      federations: {},
      spaceshipTechs: {},
      spaceshipFederations: {},
      artifacts: []
    };
    this.boardActions = {};
    this.spaceshipActions = {};
    this.availableCommands = [];
    this.phase = "setupInit" /* SetupInit */;
    this.subPhase = "beforeMove" /* BeforeMove */;
    this.version = version;
    this.round = 0 /* None */;
    /** Order of players in the turn */
    this.turnOrder = [];
    // used to transit between phases
    this.tempTurnOrder = [];
    this.leechSources = [];
    // All moves
    this.moveHistory = [];
    // Advanced log
    this.advancedLog = [];
    // Current move being processed, separated in phase
    this.turnMoves = [];
    // Raw move string for an incomplete turn, used by the viewer to append
    // follow-up commands without the human-readable log decorations.
    this.pendingMove = "";
    // Tells the UI if the new move should be on the same line or not
    this.newTurn = true;
    this.options = options;
    if (engineVersion) {
      this.version = engineVersion;
    }
    this.replay = replay;
    if (this.options.factionVariantVersion === void 0) {
      this.options.factionVariantVersion = latestVariantVersion(this.options.factionVariant);
    }
    this.sanitizeOptions();
    this.loadMoves(moves);
  }
  // be more permissive during replay
  /** The Preference Split Auction's per-player bid budget, defaulted once so every layer
   * (move validation, available commands, the viewer's form) reads the same number. The default
   * scales with the player count - see `defaultPreferenceSplitBudget`. Only safe to read once
   * `players` is populated; `moveInit` resolves the same default from its own argument instead. */
  get preferenceSplitBudget() {
    return this.options.auctionBudget ?? defaultPreferenceSplitBudget(this.players.length);
  }
  get expansions() {
    return 0 | (this.options.frontiers ? 2 /* Frontiers */ : 0) | (this.options.lostFleet ? 4 /* LostFleet */ : 0);
  }
  /** Fix old options passed. To remove when legacy data is no more in database */
  sanitizeOptions(players) {
    if (this.options.factionVariant === void 0) {
      this.options.factionVariant = "standard";
    }
    if (this.options.auction === true) {
      if (this.isVersionOrLater("4.7.0")) {
        this.options.auction = "bid-while-choosing" /* BidWhileChoosing */;
      } else {
        this.options.auction = "choose-bid" /* ChooseBid */;
      }
    }
    if (players && this.options.factionVariantVersion === void 0) {
      const versions = players.filter((p) => p.factionVariantVersion !== void 0 && p.factionVariantVersion !== null).map((p) => p.factionVariantVersion);
      this.options.factionVariantVersion = Math.max(...versions, 0);
    }
  }
  get factionCustomization() {
    return {
      variant: this.options.factionVariant,
      version: this.options.factionVariantVersion,
      players: this.players.length
    };
  }
  isVersionOrLater(version2) {
    return isVersionOrLater(this.version, version2);
  }
  loadMoves(_moves) {
    const moves = [..._moves];
    while (moves.length > 0) {
      const move = moves.shift().trim();
      this.move(move, moves.length === 0);
    }
  }
  move(_move, allowIncomplete = true) {
    if (this.replay) {
      this.newTurn = true;
    } else {
      assert25(this.newTurn, "Cannot execute a move after executing an incomplete move");
    }
    const execute = () => {
      if (!this.executeMove(move)) {
        if (!this.replay) {
          assert25(allowIncomplete, `Move ${move} (line ${this.moveHistory.length + 1}) is not complete!`);
        }
        this.newTurn = false;
      }
    };
    const move = _move.trim();
    this.pendingMove = move;
    let moveToShow = move;
    if (this.playerToMove !== void 0) {
      this.log(this.playerToMove, void 0, 0, void 0);
      moveToShow = createMoveToShow(move, this.player(this.playerToMove), this.map, execute);
    } else {
      execute();
    }
    if (!this.replay) {
      assert25(this.turnMoves.length === 0, "Unnecessary commands at the end of the turn: " + this.turnMoves.join(". "));
    }
    this.pendingMove = this.newTurn ? "" : move;
    this.moveHistory.push(moveToShow);
  }
  log(player, resource, amount, source) {
    const lastEntry = this.advancedLog[this.advancedLog.length - 1];
    let move = this.moveHistory.length;
    let lastMoveRegistered;
    let lastPlayerRegistered;
    const playersEncountered = /* @__PURE__ */ new Set();
    for (let i = this.advancedLog.length - 1; i >= 0; i--) {
      playersEncountered.add(this.advancedLog[i].player);
      if (this.advancedLog[i].move !== void 0) {
        lastMoveRegistered = this.advancedLog[i].move;
        lastPlayerRegistered = this.advancedLog[i].player;
        break;
      }
    }
    if (lastMoveRegistered === move) {
      if (lastPlayerRegistered !== player || playersEncountered.size > 1) {
        move = void 0;
      }
    }
    if (lastEntry && lastEntry.player === player && lastEntry.move === move) {
      if (amount) {
        (0, import_lodash24.set)(lastEntry, `changes.${source}.${resource}`, (lastEntry.changes?.[source]?.[resource] ?? 0) + amount);
      }
    } else {
      this.addAdvancedLog({
        player,
        move,
        changes: amount ? {
          [source]: { [resource]: amount }
        } : void 0
      });
    }
  }
  addAdvancedLog(entry) {
    this.advancedLog.push(entry);
  }
  generateAvailableCommandsIfNeeded(subphase = null, data) {
    return this.availableCommands || this.generateAvailableCommands(subphase, data);
  }
  generateAvailableCommands(subphase = null, data) {
    return this.availableCommands = generate(this, subphase, data);
  }
  findAvailableCommand(player, command) {
    this.availableCommands = this.availableCommands || this.generateAvailableCommands();
    return this.availableCommands.find((availableCommand) => {
      if (availableCommand.name !== command) {
        return false;
      }
      if (availableCommand.player === void 0) {
        return false;
      }
      return availableCommand.player === player;
    });
  }
  clearAvailableCommands() {
    this.availableCommands = null;
    this.availableCommand = null;
  }
  /**
   * "Premove" support (PREMOVE_PLAN.md §2): forces THIS engine - always a disposable preview clone,
   * never a real game state - into "it is `seat`'s ordinary move-phase turn right now".
   *
   * The phase override is the part that's easy to miss: `available-command.ts`'s generator branches
   * on `engine.phase` first, so a clone left in `RoundLeech` (or `RoundIncome`/`RoundGaia`) answers
   * with that phase's decision - or with nothing at all once its `tempTurnOrder` no longer names the
   * forced seat - instead of the move the seat will actually get. That's what previously emptied the
   * command list for a Sequential premove chained after one that offers an opponent a leech.
   */
  forcePremovePreviewTurn(seat) {
    this.phase = "roundMove" /* RoundMove */;
    this.currentPlayer = seat;
    this.tempCurrentPlayer = void 0;
    this.clearAvailableCommands();
  }
  /**
   * "Premove" support (PREMOVE_PLAN.md §2): what `seat` could legally do right now if it were their
   * turn, without it actually being their turn. Returns `null` (premove not offered) when it already
   * is their turn (the real buttons apply - including a leech/income decision they owe this instant),
   * when they've already passed this round (nothing to premove into), or before round 1 / outside a
   * running round (setup/scoring/endgame/auction all have a differently-shaped "next turn" that isn't
   * well-defined to preview).
   *
   * The other phases a running round can rest in - `RoundLeech` while someone answers a charge offer,
   * `RoundIncome`/`RoundGaia` while someone makes a start-of-round choice - DO preview (2026-08-06).
   * They're exactly when an off-turn player wants to queue a premove and used to be offered nothing
   * at all, and the seat's own next turn is still an ordinary move-phase turn in the same round.
   * Income the seat hasn't collected yet is simply absent from the preview, which offers fewer
   * options rather than illegal ones; the resolver still refuses to fire outside a genuine
   * `Phase.RoundMove` turn and revalidates the move when that turn arrives.
   *
   * Never mutates `this` - operates on a disposable clone, exactly like every other preview/replay
   * path in this engine (`fromData(JSON.parse(JSON.stringify(...)))`).
   */
  previewAvailableCommandsFor(seat) {
    if (this.round < 1 /* Round1 */ || !premovePreviewablePhases.includes(this.phase) || seat === this.playerToMove || this.passedPlayers?.includes(seat)) {
      return null;
    }
    const clone2 = _Engine.fromData(JSON.parse(JSON.stringify(this)));
    clone2.forcePremovePreviewTurn(seat);
    try {
      return clone2.generateAvailableCommands();
    } catch {
      return null;
    }
  }
  addPlayer(player) {
    this.players.push(player);
    player.data.on(
      `gain-${"tech" /* TechTile */}`,
      (count, source) => this.processNextMove("chooseTechTile" /* ChooseTechTile */, null, source === "qic1" /* Qic1 */ || source === "rebellion" /* Rebellion */)
    );
    player.data.on(
      `gain-${"instant-gaiaforming" /* InstantGaiaforming */}`,
      () => this.processNextMove("instantGaiaforming" /* InstantGaiaforming */, null, true)
    );
    player.data.on(`gain-${"step" /* TemporaryStep */}`, () => this.processNextMove("buildMine" /* BuildMine */, null, true));
    player.data.on(`gain-${"range" /* TemporaryRange */}`, (count) => {
      this.processNextMove("buildMineOrGaiaFormer" /* BuildMineOrGaiaFormer */, null, true);
    });
    player.data.on(
      `gain-${"fed" /* RescoreFederation */}`,
      () => this.processNextMove("rescoreFederationTile" /* RescoreFederationTile */, null, false)
    );
    player.data.on(
      `gain-${"artifact" /* GainArtifact */}`,
      () => this.processNextMove("chooseArtifactToken" /* ChooseArtifactToken */, null, true)
    );
    player.data.on(`gain-${"power-ring" /* PowerRing */}`, () => this.processNextMove("placePowerRing" /* PlacePowerRing */, null, true));
    player.data.on(`gain-${"swap-PI" /* PISwap */}`, () => this.processNextMove("swap-PI" /* PISwap */, null, true));
    player.data.on(`gain-${"space-station" /* SpaceStation */}`, () => this.processNextMove("spaceStation" /* SpaceStation */, null, true));
    player.data.on(`gain-${"down-lab" /* DowngradeLab */}`, () => {
      this.processNextMove("down-lab" /* DowngradeLab */, null, true);
      this.processNextMove("upgradeResearch" /* UpgradeResearch */, null, false);
    });
    player.data.on(
      `gain-${"up-lowest" /* UpgradeLowest */}`,
      () => this.processNextMove("upgradeResearch" /* UpgradeResearch */, { bescods: true }, true)
    );
    player.data.on("brainstone", (data) => this.processNextMove("brainStone" /* BrainStone */, data));
    player.data.on("beforeResearchUpgrade", (field) => {
      const destTile = player.data.research[field] + 1;
      if (!player.canUpgradeResearch(field)) {
        player.data.canUpgradeResearch = false;
      } else if (destTile === lastTile(field) && this.players.some((pl) => pl.data.research[field] === destTile)) {
        player.data.canUpgradeResearch = false;
      }
    });
    for (const resource of [
      "vp" /* VictoryPoint */,
      "pw" /* ChargePower */,
      "c" /* Credit */,
      "q" /* Qic */,
      "k" /* Knowledge */,
      "o" /* Ore */,
      "t" /* GainToken */,
      "tg" /* GainTokenGaiaArea */,
      "burn-token" /* BurnToken */,
      "brainstone" /* Brainstone */,
      "tg->t" /* MoveTokenFromGaiaAreaToArea1 */,
      "gf->t" /* MoveGaiaFormerFromGaiaAreaToArea1 */
    ]) {
      player.data.on(
        `gain-${resource}`,
        (amount, source) => this.log(player.player, resource, amount, source)
      );
      player.data.on(
        `pay-${resource}`,
        (amount, source) => this.log(player.player, resource, -amount, source)
      );
    }
  }
  player(player) {
    return this.players[player];
  }
  playersInOrder() {
    return this.turnOrder.map((i) => this.players[i]);
  }
  /**
   * Get next players starting from `player`, finishing to the player before `player`
   * @param player
   */
  playersInTableOrderFrom(player) {
    const pos = this.turnOrderAfterSetupAuction.findIndex((pl) => pl === player);
    const turn = [...this.turnOrderAfterSetupAuction.slice(pos), ...this.turnOrderAfterSetupAuction.slice(0, pos)];
    return turn.map((pl) => this.players[pl]);
  }
  get turnOrderAfterSetupAuction() {
    return this.setup.map((faction) => this.players.findIndex((pl) => pl.faction === faction));
  }
  get playerToMove() {
    if (this.tempCurrentPlayer !== void 0) {
      return this.tempCurrentPlayer;
    }
    return this.currentPlayer;
  }
  getNextPlayer(list = this.turnOrder) {
    return list[(list.indexOf(this.currentPlayer) + 1) % list.length];
  }
  moveToNextPlayer(list, params = { loop: true }) {
    if (list.length === 0) {
      return false;
    }
    if (!(params.loop ?? true)) {
      this.currentPlayer = list.shift();
    } else {
      this.currentPlayer = this.getNextPlayer(list);
    }
    return true;
  }
  /** Automatically generate moves based on player settings */
  autoMove(partialMove, options) {
    return autoMove(this, partialMove, options);
  }
  static fromData(data) {
    const engine = new _Engine();
    delete engine.version;
    if (!data) {
      return engine;
    }
    for (const key2 of Object.keys(data)) {
      if (key2 === "map" || key2 === "players" || Object.getOwnPropertyDescriptor(_Engine.prototype, key2)?.get) {
        continue;
      }
      engine[key2] = data[key2];
    }
    engine.sanitizeOptions(data.players);
    if (data.map) {
      engine.map = SpaceMap.fromData(data.map);
      engine.map.nbPlayers = data.players.length;
      engine.map.layout = engine.options.layout;
      engine.map.lostFleet = engine.options.lostFleet;
      engine.map.placement = engine.options.map;
    }
    const customization = {
      variant: engine.options.factionVariant,
      players: data.players.length,
      version: engine.options.factionVariantVersion
    };
    for (const player of data.players) {
      engine.addPlayer(
        Player5.fromData(
          player,
          engine.map,
          player.faction && factionVariantBoard(customization, player.faction),
          engine.expansions,
          engine.version,
          data.players.length,
          engine.lostFleetEconomySide
        )
      );
    }
    if (data.map) {
      for (const hex of engine.map.grid.values()) {
        for (const player of hex.occupyingPlayers()) {
          engine.player(player).data.occupied.push(hex);
        }
      }
    }
    for (const key2 of Object.keys(engine.boardActions)) {
      const action = engine.boardActions[key2];
      if (typeof action === "boolean") {
        engine.boardActions[key2] = action ? null : 4 /* Player5 */;
      }
    }
    return engine;
  }
  toJSON() {
    const proto = Object.getPrototypeOf(this);
    const jsonObj = Object.assign({}, this);
    Object.entries(Object.getOwnPropertyDescriptors(proto)).filter(([key2, descriptor]) => typeof descriptor.get === "function").map(([key2, descriptor]) => {
      if (descriptor && key2[0] !== "_") {
        try {
          const val = this[key2];
          jsonObj[key2] = val;
        } catch (error) {
        }
      }
    });
    return jsonObj;
  }
  replayedTo(move = Infinity, keepReplayMode = false) {
    const oldHistory = this.moveHistory.slice(0, move);
    const oldPlayers = this.players;
    const engine = new _Engine(oldHistory.slice(0, 1), this.options, this.version ?? "1.0.0", true);
    for (let i = 0; i < oldPlayers.length && i < engine.players.length; i++) {
      engine.players[i].name = oldPlayers[i].name;
      engine.players[i].dropped = oldPlayers[i].dropped;
      if (oldPlayers[i].factionVariant && !oldPlayers[i].variant) {
        engine.players[i].variant = {
          board: oldPlayers[i].factionVariant,
          version: oldPlayers[i].factionVersion
        };
      } else {
        engine.players[i].variant = oldPlayers[i].variant;
      }
    }
    engine.loadMoves(oldHistory.slice(1));
    assert25(engine.newTurn, "Last move of the game is incomplete");
    engine.replay = keepReplayMode;
    engine.generateAvailableCommandsIfNeeded();
    return engine;
  }
  static slowMotion([first, ...moves], options = {}, version2 = null) {
    if (!first) {
      return new _Engine([], options, version2);
    }
    let state = JSON.parse(JSON.stringify(new _Engine([first], options, version2)));
    for (const move of moves) {
      const tempEngine = _Engine.fromData(state);
      tempEngine.move(move);
      state = JSON.parse(JSON.stringify(tempEngine));
    }
    return _Engine.fromData(state);
  }
  static parseMoves(moves) {
    return moves.trim().split("\n").map((move) => move.trim());
  }
  /**
   * Load turn moves.
   *
   * @param move The move string to process. Can contain multiple moves separated by a dot
   * @param params params.processFirst indicates to process the first move. params.split is set to true if leftover commands are allowed
   */
  loadTurnMoves(move, params = {
    split: true,
    processFirst: false
  }) {
    this.oldPhase = this.phase;
    const playerS = move.substr(0, move.indexOf(" "));
    let player;
    if (/^p[1-7]$/.test(playerS)) {
      player = +playerS[1] - 1;
    } else {
      const pl = this.players.find((_pl) => _pl.faction === playerS);
      if (pl) {
        player = pl.player;
      }
    }
    if (!this.replay) {
      assert25(
        this.playerToMove === player,
        "Wrong turn order in move " + move + ", expected player " + (this.playerToMove + 1)
      );
    }
    this.processedPlayer = player;
    const split = params.split ?? true;
    const processFirst = params.processFirst ?? true;
    if (!split) {
      assert25(processFirst);
    }
    this.turnMoves = move.substr(playerS.length).split(".").map((x) => x.trim());
    if (processFirst) {
      this.processNextMove();
      assert25(
        split || this.turnMoves.length === 0,
        "There is an extra command at the end of the turn: " + this.turnMoves.join(". ")
      );
    }
  }
  /**
   * Return true if it is a full move
   * @param move
   */
  executeMove(move) {
    const phaseRegistry = {
      ["beginGame" /* BeginGame */]: () => {
        throw new Error("beginGame cannot be executed");
      },
      ["endGame" /* EndGame */]: () => {
        throw new Error("endGame cannot be executed");
      },
      ["roundStart" /* RoundStart */]: () => {
        throw new Error("roundStart cannot be executed");
      },
      ["roundFinish" /* RoundFinish */]: () => {
        throw new Error("roundFinish cannot be executed");
      },
      ["roundShip" /* RoundShip */]: () => {
        throw new Error("roundShip cannot be executed");
      },
      ["setupInit" /* SetupInit */]: phaseSetupInit,
      ["setupBoard" /* SetupBoard */]: phaseSetupBoard,
      ["setupFactionBan" /* SetupFactionBan */]: phaseSetupFactionBan,
      ["setupFaction" /* SetupFaction */]: phaseSetupFaction,
      ["setupAuction" /* SetupAuction */]: phaseSetupAuction,
      ["setupSilentBid" /* SetupSilentBid */]: phaseSetupSilentBid,
      ["setupPreferenceBid" /* SetupPreferenceBid */]: phaseSetupPreferenceBid,
      ["setupBuilding" /* SetupBuilding */]: phaseSetupBuilding,
      ["setupBooster" /* SetupBooster */]: phaseSetupBooster,
      ["roundIncome" /* RoundIncome */]: phaseRoundIncome,
      ["roundGaia" /* RoundGaia */]: phaseRoundGaia,
      ["roundMove" /* RoundMove */]: phaseRoundMove,
      ["roundLeech" /* RoundLeech */]: phaseRoundLeech
    };
    try {
      phaseRegistry[this.phase](this, move);
      this.clearAvailableCommands();
    } catch (err) {
      if (err.availableCommands) {
        this.availableCommands = err.availableCommands;
        return this.playerToMove !== this.processedPlayer || this.phase !== this.oldPhase;
      } else {
        throw err;
      }
    }
    return true;
  }
  parseMove(move) {
    const split = move.split(" ");
    return {
      command: split[0] || "endturn" /* EndTurn */,
      args: split.slice(1)
    };
  }
  processNextMove(subphase, data, required = false) {
    if (subphase) {
      this.generateAvailableCommands(subphase, data);
      if (this.availableCommands.length === 0) {
        if (required && !this.replay) {
          this.availableCommands = [{ name: "deadEnd" /* DeadEnd */, player: this.currentPlayer, data: subphase }];
        } else {
          return;
        }
      }
    }
    if (this.turnMoves.length === 0) {
      throw Object.assign(new Error("Missing command to end turn"), {
        availableCommands: this.availableCommands
      });
    }
    const move = this.parseMove(this.turnMoves.shift());
    if (move.args.length === 2 && move.args[0] === "\u21D2") {
      return;
    }
    this.checkCommand(move.command);
    const moveRegistry = {
      ["init" /* Init */]: () => {
        throw new Error("init cannot be executed");
      },
      ["deadEnd" /* DeadEnd */]: () => {
        throw new Error("deadEnd cannot be executed");
      },
      ["set" /* Setup */]: moveSetup,
      ["rotate" /* RotateSectors */]: moveRotateSectors,
      ["banFaction" /* BanFaction */]: moveBanFaction,
      ["faction" /* ChooseFaction */]: moveChooseFaction,
      ["bid" /* Bid */]: moveBid,
      ["silentBid" /* SilentBid */]: moveSilentBid,
      ["preferenceBid" /* PreferenceBid */]: movePreferenceBid,
      ["build" /* Build */]: moveBuild,
      ["lostPlanet" /* PlaceLostPlanet */]: moveLostPlanet,
      ["move" /* MoveShip */]: moveShip,
      ["special" /* Special */]: moveSpecial,
      ["spend" /* Spend */]: moveSpend,
      ["burn" /* BurnPower */]: moveBurn,
      ["action" /* Action */]: moveAction,
      ["swap-PI" /* PISwap */]: movePiSwap,
      ["fedtile" /* ChooseFederationTile */]: moveChooseFederationTile,
      ["federation" /* FormFederation */]: moveFormFederation,
      ["charge" /* ChargePower */]: moveChargePower,
      ["decline" /* Decline */]: moveDecline,
      ["brainstone" /* BrainStone */]: moveBrainStone,
      ["up" /* UpgradeResearch */]: moveResearch,
      ["tech" /* ChooseTechTile */]: moveChooseTechTile,
      ["cover" /* ChooseCoverTechTile */]: moveChooseCoverTechTile,
      ["booster" /* ChooseRoundBooster */]: moveChooseRoundBooster,
      ["chooseTinkeringTile" /* ChooseTinkeringTile */]: moveChooseTinkeringTile,
      ["explore" /* Explore */]: moveExplore,
      ["spaceshipAction" /* SpaceshipAction */]: moveSpaceshipAction,
      ["gaiaFormTransdim" /* GaiaFormTransdim */]: moveGaiaFormTransdim,
      ["placePowerRing" /* PlacePowerRing */]: movePlacePowerRing,
      ["pass" /* Pass */]: movePass,
      ["endturn" /* EndTurn */]: moveEndTurn,
      ["income" /* ChooseIncome */]: moveChooseIncome,
      ["examineArtifact" /* ExamineArtifact */]: moveExamineArtifact,
      ["chooseArtifactToken" /* ChooseArtifactToken */]: moveChooseArtifactToken
    };
    moveRegistry[move.command](this, this.avCommand(), this.playerToMove, ...move.args);
    return move;
  }
  peekNextMove() {
    return this.parseMove(this.turnMoves[0]);
  }
  checkCommand(command) {
    this.availableCommand = this.findAvailableCommand(this.playerToMove, command);
    if (!this.availableCommand && !this.replay) {
      assert25(this.availableCommand, `Command ${command} is not in the list of available commands`);
    }
  }
  doFreeActions(subPhase) {
    while (this.turnMoves.length > 0) {
      if (!["spend" /* Spend */, "burn" /* BurnPower */].includes(this.peekNextMove().command)) {
        return;
      }
      this.processNextMove();
      this.generateAvailableCommands(subPhase);
    }
  }
  handleMainMove() {
    if (this.processNextMove().command === "pass" /* Pass */) {
      return "pass" /* Pass */;
    } else {
      this.generateAvailableCommands("afterMove" /* AfterMove */);
    }
  }
  handleEndTurn() {
    this.processNextMove();
  }
  get currentRoundScoringEvents() {
    const tile = this.tiles.scorings.round[this.round - 1];
    return tile && roundScoringEvents(tile, this.round);
  }
  changePhase(phase) {
    this.phase = phase;
  }
  get ended() {
    return this.phase === "endGame" /* EndGame */;
  }
  set ended(val) {
    assert25(val, "You can't set ended to false");
    this.phase = "endGame" /* EndGame */;
  }
  get isLastRound() {
    return this.round === 6 /* LastRound */;
  }
  avCommand() {
    return this.availableCommand;
  }
};

// viewer/src/logic/auto-decide.ts
function parseAutoChargePreference(pref) {
  if (pref === "decline-cost") {
    return "decline-cost";
  }
  const n = Number(pref);
  return n >= 1 && n <= 5 ? n : "ask";
}
function autoDecideChargePower(engine, autoChargePower2, isEligibleSeat = () => true) {
  const before = engine.moveHistory.length;
  let iterations = 0;
  while (engine.playerToMove !== void 0 && isEligibleSeat(engine.playerToMove) && iterations++ < 20) {
    engine.player(engine.playerToMove).settings.autoChargePower = autoChargePower2;
    if (!engine.autoMove()) {
      break;
    }
  }
  return engine.moveHistory.length > before ? engine.moveHistory.slice(before).join(". ") : null;
}
export {
  Engine3 as Engine,
  Phase,
  autoDecideChargePower,
  parseAutoChargePreference
};
/*! Bundled license information:

lodash/lodash.js:
  (**
   * @license
   * Lodash <https://lodash.com/>
   * Copyright OpenJS Foundation and other contributors <https://openjsf.org/>
   * Released under MIT license <https://lodash.com/license>
   * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
   * Copyright Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
   *)
*/
