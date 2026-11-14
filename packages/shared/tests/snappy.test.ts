import fs from "node:fs";
import { decompressSnappy } from "../src/index.js";

const MAX = 1024;

describe("decompressSnappy", () => {
  test("decodes the bundle GitHub serves from bundle_url", () => {
    const decoded = decompressSnappy(
      fixture("bundle-qlty-v0.555.0.snappy"),
      16 * 1024 * 1024,
    );
    const inline = JSON.parse(
      fixture("attestations-qlty-v0.555.0.json").toString(),
    ).attestations[0].bundle;
    expect(JSON.parse(decoded.toString("utf8"))).toEqual(inline);
  });

  test("decodes a literal", () => {
    expect(decompressSnappy(block(5, [0x10], "hello"), MAX).toString()).toBe(
      "hello",
    );
  });

  test("decodes a literal whose length is in the next byte", () => {
    const text = "a".repeat(70);
    expect(
      decompressSnappy(block(70, [60 << 2, 69], text), MAX).toString(),
    ).toBe(text);
  });

  test("decodes copies with 1, 2 and 4 byte offsets", () => {
    // "abcd", then "abcd" with each copy form.
    const one = [0x01 | (0 << 2), 4]; // length 4, offset 4
    const two = [0x02 | (3 << 2), 4, 0]; // length 4, offset 4
    const four = [0x03 | (3 << 2), 4, 0, 0, 0]; // length 4, offset 4
    const data = block(16, [0x0c], "abcd", one, two, four);
    expect(decompressSnappy(data, MAX).toString()).toBe("abcd".repeat(4));
  });

  test("decodes a copy that overlaps its own output", () => {
    // "ab", then 6 bytes copied from 2 back.
    const data = block(8, [0x04], "ab", [0x01 | (2 << 2), 2]);
    expect(decompressSnappy(data, MAX).toString()).toBe("abababab");
  });

  test.each<[string, Buffer]>([
    ["an empty block", Buffer.alloc(0)],
    [
      "a length header that never ends",
      Buffer.from([0xff, 0xff, 0xff, 0xff, 0xff, 0xff]),
    ],
    ["a literal past the end of the block", block(5, [0x10], "hel")],
    ["a literal longer than the header says", block(2, [0x10], "hello")],
    ["a copy with offset 0", block(5, [0x00], "a", [0x01, 0])],
    ["a copy from before the start", block(5, [0x00], "a", [0x01, 2])],
    [
      "a copy longer than the header says",
      block(3, [0x00], "a", [0x01 | (2 << 2), 1]),
    ],
    ["a copy missing its offset", block(5, [0x00], "a", [0x02, 1])],
    ["less data than the header says", block(10, [0x10], "hello")],
  ])("rejects %s", (_, data) => {
    expect(() => decompressSnappy(data, MAX)).toThrow(
      /^Could not decompress the Snappy block: /,
    );
  });

  test("rejects a block longer than the limit", () => {
    expect(() => decompressSnappy(block(2000, [0x10], "hello"), MAX)).toThrow(
      "the uncompressed length 2000 is over the limit of 1024 bytes",
    );
  });
});

// Builds a block: the varint length, then tags, literal bytes and copies.
function block(length: number, ...parts: (number[] | string)[]): Buffer {
  const header: number[] = [];
  let rest = length;
  while (rest >= 0x80) {
    header.push((rest & 0x7f) | 0x80);
    rest >>>= 7;
  }
  header.push(rest);
  return Buffer.concat([
    Buffer.from(header),
    ...parts.map((part) =>
      typeof part === "string" ? Buffer.from(part) : Buffer.from(part),
    ),
  ]);
}

function fixture(name: string): Buffer {
  return fs.readFileSync(new URL(`./fixtures/${name}`, import.meta.url));
}
