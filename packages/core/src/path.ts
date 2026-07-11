import type { ReservedFormPathSegment } from "./path-segment";

type Primitive = string | number | boolean | bigint | symbol | null | undefined;
type FileLike = {
  readonly name: string;
  readonly size: number;
  readonly type: string;
  readonly lastModified: number;
};
type Atomic =
  | Primitive
  | Date
  | RegExp
  | Error
  | Function
  | Promise<unknown>
  | Map<unknown, unknown>
  | Set<unknown>
  | ArrayBuffer
  | DataView
  | FileLike;

type IsAny<T> = 0 extends 1 & T ? true : false;
type IsTraversable<T> = IsAny<T> extends true
  ? false
  : NonNullable<T> extends Atomic
    ? false
    : NonNullable<T> extends object
      ? true
      : false;
type NextDepth<Depth extends readonly unknown[]> = [...Depth, 0];
type AtMaxDepth<Depth extends readonly unknown[]> = Depth["length"] extends 8 ? true : false;
type Join<Prefix extends string, Key extends string> = Prefix extends ""
  ? Key
  : `${Prefix}.${Key}`;
type PathWhitespace = " " | "\f" | "\n" | "\r" | "\t" | "\v";
type TrimPathWhitespace<Key extends string> =
  Key extends `${PathWhitespace}${infer Rest}`
    ? TrimPathWhitespace<Rest>
    : Key extends `${infer Rest}${PathWhitespace}`
      ? TrimPathWhitespace<Rest>
      : Key;
type NumericLikePathKey<Key extends string> = TrimPathWhitespace<Key> extends ""
  ? true
  : TrimPathWhitespace<Key> extends
    | `${number}`
    | "+Infinity"
    | "-Infinity"
    | "Infinity"
    ? true
    : false;
type SafePathKey<Key extends string> = Key extends "" | ReservedFormPathSegment
  ? never
  : NumericLikePathKey<Key> extends true
    ? never
    : Key extends
      | `$ACTION_${string}`
      | `__formadapter_${string}`
      | `${string}.${string}`
      | `${string}[${string}`
      | `${string}]${string}`
      | `${string}'${string}`
      | `${string}"${string}`
    ? never
    : Key;

type PathsForValue<
  Value,
  Prefix extends string,
  Depth extends readonly unknown[],
> =
  | Prefix
  | (AtMaxDepth<Depth> extends true
      ? never
      : NonNullable<Value> extends readonly (infer Item)[]
        ? | `${Prefix}[]`
          | (IsTraversable<Item> extends true
              ? PathsForValue<NonNullable<Item>, `${Prefix}[]`, NextDepth<Depth>>
              : never)
        : IsTraversable<Value> extends true
          ? ObjectPaths<NonNullable<Value>, Prefix, NextDepth<Depth>>
          : never);

type ObjectPaths<
  Value,
  Prefix extends string,
  Depth extends readonly unknown[],
> = Value extends unknown
  ? Value extends object
    ? {
        [Key in Extract<keyof Value, string>]-?: PathsForValue<
          Value[Key],
          Join<Prefix, SafePathKey<Key>>,
          Depth
        >;
      }[Extract<keyof Value, string>]
    : never
  : never;

/** Canonical schema field paths. Array items use `[]`, for example `users[].email`. */
export type FieldPath<Value> = IsTraversable<Value> extends true
  ? Extract<ObjectPaths<NonNullable<Value>, "", []>, string>
  : never;

type SegmentValue<Value, Segment extends string> = Value extends unknown
  ? Segment extends `${infer Prefix}[]`
    ? SegmentValue<Value, Prefix> extends readonly (infer Item)[]
      ? Item
      : never
    : Segment extends keyof NonNullable<Value>
      ? NonNullable<Value>[Segment]
      : never
  : never;

type PathValueInternal<Value, Path extends string> = Path extends `${infer Head}.${infer Tail}`
  ? PathValueInternal<SegmentValue<Value, Head>, Tail>
  : SegmentValue<Value, Path>;

export type PathValue<Value, Path extends FieldPath<Value>> = PathValueInternal<Value, Path>;

export type DeepPartial<Value> = IsAny<Value> extends true
  ? Value
  : Value extends Atomic
    ? Value
    : Value extends readonly (infer Item)[]
      ? Array<DeepPartial<Item>>
      : Value extends object
        ? { [Key in keyof Value]?: DeepPartial<Value[Key]> }
        : Value;

export function pathToName(path: ReadonlyArray<string | number>): string {
  return path.map(String).join(".");
}

export function pathToConfigPath(path: ReadonlyArray<string | number>): string {
  let result = "";
  for (const segment of path) {
    if (typeof segment === "number") {
      result += "[]";
    } else {
      result += result === "" ? segment : `.${segment}`;
    }
  }
  return result;
}
