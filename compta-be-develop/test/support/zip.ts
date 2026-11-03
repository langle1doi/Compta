import { inflateRawSync } from 'node:zlib';

/** Reads every entry of a zip from its central directory: what a customer would get after unzipping. */
export function readZip(zip: Buffer): Record<string, string> {
  const END_OF_DIRECTORY = 0x06054b50;
  let end = zip.length - 22;
  while (end >= 0 && zip.readUInt32LE(end) !== END_OF_DIRECTORY) end--;
  if (end < 0) throw new Error('Not a zip file');

  const entries: Record<string, string> = {};
  let offset = zip.readUInt32LE(end + 16);
  const count = zip.readUInt16LE(end + 10);
  for (let i = 0; i < count; i++) {
    const method = zip.readUInt16LE(offset + 10);
    const compressedSize = zip.readUInt32LE(offset + 20);
    const nameLength = zip.readUInt16LE(offset + 28);
    const extraLength = zip.readUInt16LE(offset + 30);
    const commentLength = zip.readUInt16LE(offset + 32);
    const localOffset = zip.readUInt32LE(offset + 42);
    const name = zip.toString('utf8', offset + 46, offset + 46 + nameLength);

    const dataStart = localOffset + 30 + zip.readUInt16LE(localOffset + 26) + zip.readUInt16LE(localOffset + 28);
    const data = zip.subarray(dataStart, dataStart + compressedSize);
    entries[name] = (method === 0 ? data : inflateRawSync(data)).toString('utf8');
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}
