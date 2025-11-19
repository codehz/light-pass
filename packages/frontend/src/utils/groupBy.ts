export function groupBy<T, Rs extends T[]>(
  items: Iterable<T>,
  ...predicates: { [I in keyof Rs]: (item: T) => item is Rs[I] }
): [...{ [I in keyof Rs]: Rs[I][] }, Exclude<T, Rs[number]>[]] {
  const groups = predicates.map(() => []) as {
    [I in keyof Rs]: Rs[I][];
  };
  const unmatched: Exclude<T, Rs[number]>[] = [];
  outer: for (const item of items) {
    for (const [i, predicate] of predicates.entries()) {
      if (predicate(item)) {
        groups[i].push(item);
        continue outer;
      }
    }
    unmatched.push(item as Exclude<T, Rs[number]>);
  }
  return [...groups, unmatched];
}