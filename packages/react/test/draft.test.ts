import { beforeEach, describe, expect, it } from "vitest";

import {
  createStorageDraftAdapter,
  localStorageDraftAdapter,
  sessionStorageDraftAdapter,
} from "../src";

describe("draft storage adapters", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("keeps local and session drafts isolated and clears them", async () => {
    await localStorageDraftAdapter.save<{ name: string }>("profile", { name: "Ada" });
    await sessionStorageDraftAdapter.save<{ name: string }>("profile", { name: "Grace" });

    expect(await localStorageDraftAdapter.load<{ name: string }>("profile"))
      .toEqual({ name: "Ada" });
    expect(await sessionStorageDraftAdapter.load<{ name: string }>("profile"))
      .toEqual({ name: "Grace" });
    await localStorageDraftAdapter.clear("profile");
    expect(await localStorageDraftAdapter.load("profile")).toBeNull();
  });

  it("omits files from JSON storage and surfaces corrupt data", async () => {
    const adapter = createStorageDraftAdapter(() => localStorage);
    const crossRealmFile = {
      [Symbol.toStringTag]: "File",
      lastModified: 0,
      name: "other-realm.txt",
      size: 4,
      type: "text/plain",
    };
    const crossRealmBlob = {
      [Symbol.toStringTag]: "Blob",
      size: 4,
      type: "text/plain",
    };
    await adapter.save<{
      attachment?: File;
      blob?: Blob;
      crossRealmBlob?: typeof crossRealmBlob;
      crossRealmFile?: typeof crossRealmFile;
      name: string;
    }>("upload", {
      attachment: new File(["data"], "private.txt"),
      blob: new Blob(["data"]),
      crossRealmBlob,
      crossRealmFile,
      name: "Ada",
    });
    expect(await adapter.load("upload")).toEqual({ name: "Ada" });

    localStorage.setItem("broken", "{");
    expect(() => adapter.load("broken")).toThrow(SyntaxError);
  });

  it("preserves ordinary domain objects that happen to contain file metadata names", async () => {
    const adapter = createStorageDraftAdapter(() => localStorage);
    const artifact = {
      lastModified: 1_700_000_000_000,
      name: "Quarterly report",
      size: 42,
    };

    await adapter.save("artifact", { artifact });

    expect(await adapter.load("artifact")).toEqual({ artifact });
  });
});
