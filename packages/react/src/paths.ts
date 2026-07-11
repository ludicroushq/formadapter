import type { FieldPath } from "@formadapter/core";

type ExcludeArrayItemTemplate<Path extends string> =
  Path extends `${string}[]${string}` ? never : Path;

type ConcretePath<Path extends string> =
  Path extends `${infer Prefix}[]${infer Suffix}`
    ? `${Prefix}.${number}${ConcretePath<Suffix>}`
    : Path;

type ConcreteSegmentValue<Value, Segment extends string> = Value extends unknown
  ? Segment extends `${number}`
    ? NonNullable<Value> extends readonly (infer Item)[]
      ? Item
      : never
    : Segment extends keyof NonNullable<Value>
      ? NonNullable<Value>[Segment]
      : never
  : never;

type ConcretePathValueInternal<
  Value,
  Path extends string,
> = Path extends `${infer Head}.${infer Tail}`
  ? ConcretePathValueInternal<ConcreteSegmentValue<Value, Head>, Tail>
  : ConcreteSegmentValue<Value, Path>;

/** Model paths that can be rendered outside an array-item scope. */
export type RenderableFieldPath<Value> = FieldPath<Value> extends infer Path
  ? Path extends string
    ? ExcludeArrayItemTemplate<Path>
    : never
  : never;

/** Runtime form-state paths. Array items use a concrete numeric segment. */
export type ConcreteFieldPath<Value> = FieldPath<Value> extends infer Path
  ? Path extends string
    ? ConcretePath<Path>
    : never
  : never;

/** The value at a concrete runtime form-state path. */
export type ConcretePathValue<
  Value,
  Path extends ConcreteFieldPath<Value>,
> = ConcretePathValueInternal<Value, Path>;
