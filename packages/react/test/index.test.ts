import { expect, test } from "bun:test";

import { hello } from "../src/index";

test("exports hello", () => {
  expect(hello).toBe("world");
});

