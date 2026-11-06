// Bun bun-v1.4.4 src/wyhash/lib.rs SHA-256 78f3ec539de6b5efaf6b6626c83b62aa29f1cc0b2b1fe4972e23ea453dec1b6f,
// lines 408–419, 510–543, 552–582, 585–684 (one-based inclusive).
// One-shot adaptation uses BigInt for u64/u128 and Buffer for little-endian reads.
const mask = (1n << 64n) - 1n;
const secret = [0xa0761d6478bd642fn, 0xe7037ed1a0b428dbn, 0x8ebc6af09c88c6e3n, 0x589965cc75374cc3n] as const;

function mix(a: bigint, b: bigint): bigint {
  const product = a * b;
  return (product & mask) ^ (product >> 64n);
}

export function sourceWyhash(input: Uint8Array, seed = 0n): bigint {
  const bytes = Buffer.from(input.buffer, input.byteOffset, input.byteLength);
  const len = bytes.length;
  const read4 = (offset: number) => BigInt(bytes.readUInt32LE(offset));
  const read8 = (offset: number) => bytes.readBigUInt64LE(offset);
  seed = BigInt.asUintN(64, seed);
  let s0 = seed ^ mix(seed ^ secret[0], secret[1]);
  let s1 = s0, s2 = s0, a = 0n, b = 0n;
  if (len <= 16) {
    if (len >= 4) {
      const end = len - 4, quarter = (len >> 3) << 2;
      a = (read4(0) << 32n) | read4(quarter);
      b = (read4(end) << 32n) | read4(end - quarter);
    } else if (len > 0) {
      a = (BigInt(bytes[0]!) << 16n) | (BigInt(bytes[len >> 1]!) << 8n) | BigInt(bytes[len - 1]!);
    }
  } else {
    let i = 0;
    if (len >= 48) {
      while (i + 48 < len) {
        s0 = mix(read8(i) ^ secret[1], read8(i + 8) ^ s0);
        s1 = mix(read8(i + 16) ^ secret[2], read8(i + 24) ^ s1);
        s2 = mix(read8(i + 32) ^ secret[3], read8(i + 40) ^ s2);
        i += 48;
      }
      s0 ^= s1 ^ s2;
    }
    while (i + 16 < len) {
      s0 = mix(read8(i) ^ secret[1], read8(i + 8) ^ s0);
      i += 16;
    }
    a = read8(len - 16);
    b = read8(len - 8);
  }
  const product = (a ^ secret[1]) * (b ^ s0);
  return mix((product & mask) ^ secret[0] ^ BigInt(len), (product >> 64n) ^ secret[1]);
}

export function sourceBunHashString(value: string): string {
  return sourceWyhash(Buffer.from(value, "utf8")).toString(36);
}
