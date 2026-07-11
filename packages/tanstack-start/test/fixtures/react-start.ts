export function useServerFn<
  Fn extends (...arguments_: never[]) => Promise<unknown>,
>(serverFn: Fn): (...arguments_: Parameters<Fn>) => ReturnType<Fn> {
  return (...arguments_) => serverFn(...arguments_) as ReturnType<Fn>;
}
