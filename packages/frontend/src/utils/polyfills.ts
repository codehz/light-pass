/// <reference lib="es2019.array" />
/// <reference lib="es2019.object" />
/// <reference lib="es2022.array" />
/// <reference lib="es2023.array" />
export {};

function polyfill<T extends object, N extends keyof T>(
  target: T,
  name: N,
  value: T[N],
) {
  if (!(name in target)) {
    Object.defineProperty(target, name, {
      configurable: true,
      value,
    });
  }
}

const copyarray = (arr: any[]) => Array.prototype.slice.call(arr);

polyfill(Array.prototype, "flat", function flat(this: any, depth = 1) {
  // @ts-ignore
  return depth
    ? // @ts-ignore
      Array.prototype.reduce.call(this, (acc: any, cur) => {
        if (Array.isArray(cur)) {
          acc.push.apply(acc, flat.call(cur, depth - 1));
        } else {
          acc.push(cur);
        }

        return acc;
      })
    : Array.prototype.slice.call(this);
} as any);

polyfill(Array.prototype, "flatMap", function () {
  // @ts-ignore
  // eslint-disable-next-line prefer-rest-params
  return Array.prototype.map.apply(this, arguments).flat();
} as any);

polyfill(Array.prototype, "at", function (this: any, index: number) {
  const len = this.length;
  const idx = +index;
  const k = idx >= 0 ? idx : len + idx;
  if (k < 0 || k >= len) return undefined;
  return this[k];
});

polyfill(
  Array.prototype,
  "findLast",
  function (
    this: Array<any>,
    predicate: (value: any, index: number, array: any[]) => unknown,
    thisArg: any = this,
  ) {
    const arr = copyarray(this);
    const len = arr.length >>> 0;
    for (let i = len - 1; i >= 0; i--) {
      if (predicate.call(thisArg, arr[i], i, arr)) {
        return arr[i];
      }
    }
    return undefined;
  },
);

polyfill(
  Array.prototype,
  "findLastIndex",
  function (
    this: Array<any>,
    predicate: (value: any, index: number, array: any[]) => unknown,
    thisArg: any = this,
  ) {
    const arr = copyarray(this);
    const len = arr.length >>> 0;
    for (let i = len - 1; i >= 0; i--) {
      if (predicate.call(thisArg, arr[i], i, arr)) {
        return i;
      }
    }
    return -1;
  },
);

polyfill(
  Array.prototype,
  "with",
  function (this: Array<any>, index: number, value: any) {
    const copied = copyarray(this);
    copied[index] = value;
    return copied;
  },
);

polyfill(
  Array.prototype,
  "toSorted",
  function (this: Array<any>, compareFn?: (a: any, b: any) => number) {
    return copyarray(this).sort(compareFn);
  },
);

polyfill(
  Array.prototype,
  "toSpliced",
  function (this: Array<any>, start: number, deleteCount?: number) {
    return copyarray(this).splice(start, deleteCount);
  },
);

polyfill(Array.prototype, "toReversed", function (this: Array<any>) {
  return copyarray(this).reverse();
});

polyfill(String.prototype, "at", function (this: any, index: number) {
  const len = this.length;
  const idx = +index;
  const k = idx >= 0 ? idx : len + idx;
  if (k < 0 || k >= len) return undefined;
  return this[k];
});

polyfill(Object, "fromEntries", function (iterable: any) {
  return [...iterable].reduce((obj, [key, val]) => {
    obj[key] = val;
    return obj;
  }, {});
});

polyfill(URL.prototype, "toJSON", function (this: URL) {
  return this.toString();
});

polyfill(URL, "canParse", (url: string) => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
});

polyfill(
  Object,
  "groupBy",
  (items: any[], callbackfn: (value: any, index: number) => any) => {
    const obj = Object.create(null);
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const key = callbackfn(item, i);
      obj[key] = [...(obj[key] || []), item];
    }
    return obj;
  },
);

polyfill(Promise, "withResolvers", function withResolvers<T>() {
  const result = Object.create(null) as {
    promise: Promise<T>;
    resolve: (value?: T | PromiseLike<T>) => void;
    reject: (reason?: any) => void;
  };
  result.promise = new Promise<T>((resolve, reject) => {
    result.resolve = resolve as any;
    result.reject = reject;
  });
  return result;
});

// @ts-ignore
Symbol.dispose ??= Symbol.for("Symbol.dispose");
// @ts-ignore
Symbol.asyncDispose ??= Symbol.for("Symbol.asyncDispose");
