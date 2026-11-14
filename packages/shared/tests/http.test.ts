import { Readable } from "node:stream";
import {
  errorMessage,
  isTlsError,
  isTransientNetworkError,
  readBody,
} from "../src/http.js";

describe("readBody", () => {
  test("reads the whole body", async () => {
    const body = Readable.from([Buffer.from("ab"), Buffer.from("cd")]);
    expect((await readBody(body, 4)).toString()).toBe("abcd");
  });

  test("stops at the size limit", async () => {
    const body = Readable.from([Buffer.from("ab"), Buffer.from("cde")]);
    await expect(readBody(body, 4)).rejects.toThrow(
      "The response is larger than 4 bytes.",
    );
  });
});

describe("error classification", () => {
  test("finds a transient code anywhere in the cause chain", () => {
    const error = new Error("fetch failed", {
      cause: Object.assign(new Error("socket hang up"), { code: "ECONNRESET" }),
    });
    expect(isTransientNetworkError(error)).toBe(true);
    expect(isTlsError(error)).toBe(false);
  });

  test("does not treat a TLS error as transient", () => {
    const error = Object.assign(new Error("unable to verify"), {
      code: "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
    });
    expect(isTransientNetworkError(error)).toBe(false);
    expect(isTlsError(error)).toBe(true);
  });

  test("treats an unknown error as neither", () => {
    expect(isTransientNetworkError(new Error("boom"))).toBe(false);
    expect(isTlsError("boom")).toBe(false);
  });

  test("adds the code to the message once", () => {
    expect(
      errorMessage(
        Object.assign(new Error("connect failed"), { code: "ECONNREFUSED" }),
      ),
    ).toBe("connect failed (ECONNREFUSED)");
    expect(
      errorMessage(
        Object.assign(new Error("read ECONNRESET"), { code: "ECONNRESET" }),
      ),
    ).toBe("read ECONNRESET");
    expect(errorMessage("text")).toBe("text");
  });
});
