// Wipe QuickTime/MP4 container metadata without shifting offsets used by video samples.
export function stripVideoMetadata(buffer: ArrayBuffer) {
  const data = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  const text = (offset: number) => String.fromCharCode(...bytes.subarray(offset, offset + 4));
  const metadata = new Set(['udta', 'meta', 'uuid', 'loci', '©xyz', 'XMP_']);
  const containers = new Set(['moov', 'trak', 'mdia', 'minf', 'stbl', 'moof', 'traf']);
  let hasMovie = false;

  function boxes(start: number, end: number) {
    const result: { start: number; end: number; body: number; type: string }[] = [];
    while (start + 8 <= end) {
      let size = data.getUint32(start);
      let header = 8;
      if (size === 1) {
        if (start + 16 > end) throw new Error('Invalid video box');
        const extended = data.getBigUint64(start + 8);
        if (extended > BigInt(end - start)) throw new Error('Invalid video size');
        size = Number(extended);
        header = 16;
      } else if (size === 0) size = end - start;
      if (size < header || size > end - start) throw new Error('Invalid video size');
      result.push({ start, end: start + size, body: start + header, type: text(start + 4) });
      start += size;
    }
    if (start !== end) throw new Error('Incomplete video box');
    return result;
  }

  function clean(start: number, end: number, depth: number) {
    if (depth > 12) throw new Error('Invalid video structure');
    for (const box of boxes(start, end)) {
      hasMovie ||= depth === 0 && box.type === 'moov';
      const media = box.type === 'trak' ? boxes(box.body, box.end).find(({ type }) => type === 'mdia') : undefined;
      const handler = media && boxes(media.body, media.end).find(({ type }) => type === 'hdlr');
      const handlerType = handler && handler.body + 12 <= handler.end ? text(handler.body + 8) : undefined;
      if (metadata.has(box.type) || ['meta', 'mdta', 'mett', 'metx'].includes(handlerType ?? '')) {
        bytes.set([102, 114, 101, 101], box.start + 4); // free
        bytes.fill(0, box.body, box.end);
      } else if (containers.has(box.type)) clean(box.body, box.end, depth + 1);
    }
  }

  clean(0, data.byteLength, 0);
  if (!hasMovie) throw new Error('Missing movie data');
  return buffer;
}
