// Decodes a raw Snappy block, the format GitHub serves attestation bundles in
// from bundle_url. Format: https://github.com/google/snappy/blob/main/format_description.txt
export function decompressSnappy(input: Buffer, maxLength: number): Buffer {
  let pos = 0;

  // The block starts with the uncompressed length as a little-endian varint.
  let length = 0;
  for (let shift = 0; ; shift += 7) {
    if (pos >= input.length || shift > 28) {
      throw new SnappyError("the length header is malformed");
    }
    const byte = input[pos++]!;
    length += (byte & 0x7f) * 2 ** shift;
    if (byte < 0x80) {
      break;
    }
  }
  if (length > maxLength) {
    throw new SnappyError(
      `the uncompressed length ${length} is over the limit of ${maxLength} bytes`,
    );
  }

  const output = Buffer.alloc(length);
  let out = 0;

  const need = (bytes: number) => {
    if (pos + bytes > input.length) {
      throw new SnappyError("the block ends early");
    }
  };

  while (pos < input.length) {
    const tag = input[pos++]!;
    const type = tag & 0x03;

    if (type === 0) {
      // Literal: the length is in the tag, or in the next 1 to 4 bytes.
      let literalLength = tag >>> 2;
      if (literalLength >= 60) {
        const lengthBytes = literalLength - 59;
        need(lengthBytes);
        literalLength = input.readUIntLE(pos, lengthBytes);
        pos += lengthBytes;
      }
      literalLength += 1;
      need(literalLength);
      if (out + literalLength > length) {
        throw new SnappyError("a literal runs past the uncompressed length");
      }
      input.copy(output, out, pos, pos + literalLength);
      pos += literalLength;
      out += literalLength;
      continue;
    }

    // Copy: repeat bytes already written, starting `offset` bytes back.
    let copyLength: number;
    let offset: number;
    if (type === 1) {
      need(1);
      copyLength = ((tag >>> 2) & 0x07) + 4;
      offset = ((tag >>> 5) << 8) | input[pos]!;
      pos += 1;
    } else if (type === 2) {
      need(2);
      copyLength = (tag >>> 2) + 1;
      offset = input.readUInt16LE(pos);
      pos += 2;
    } else {
      need(4);
      copyLength = (tag >>> 2) + 1;
      offset = input.readUInt32LE(pos);
      pos += 4;
    }
    if (offset === 0 || offset > out) {
      throw new SnappyError("a copy points outside the data written so far");
    }
    if (out + copyLength > length) {
      throw new SnappyError("a copy runs past the uncompressed length");
    }
    // Byte by byte, because a copy can overlap the bytes it is writing.
    for (let i = 0; i < copyLength; i++) {
      output[out] = output[out - offset]!;
      out += 1;
    }
  }

  if (out !== length) {
    throw new SnappyError(
      `the block decodes to ${out} bytes, not the ${length} its header says`,
    );
  }
  return output;
}

export class SnappyError extends Error {
  constructor(reason: string) {
    super(`Could not decompress the Snappy block: ${reason}.`);
    this.name = "SnappyError";
  }
}
