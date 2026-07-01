// Client-side report + ZIP helpers, shared by the playlist "Download all" bundle.
// The crc32 / buildZip / saveBlob primitives mirror the hand-rolled ones in
// YouTubeToolContent.tsx (no zip dependency); kept here so the playlist tool can
// bundle many per-video reports without duplicating them a third time.

// The subset of the /api/youtube/extract response a per-video report reads. All
// optional/guarded so a partial payload never throws the bundle.
export type VideoExtract = {
  videoId: string;
  title?: string;
  channel?: string;
  uploadDate?: string | null;
  durationText?: string | null;
  viewCount?: number | null;
  likeCount?: number | null;
  tags?: string[];
  description?: string;
  transcript?: {
    text?: string;
    available?: boolean;
    language?: string | null;
    isAutomatic?: boolean;
  };
};

// Turn a video title into a filename that is safe on every OS: drop diacritics,
// keep only broadly-legal characters, spaces → "-", trim stray dots/dashes, dodge
// Windows' reserved device names. Falls back to "video". Mirrors safeFilename in
// the single-video tools.
export function safeFilename(title: string): string {
  let s = (title || "")
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9._ -]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 120)
    .replace(/[-.]+$/g, "");
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(s)) s = `_${s}`;
  return s || "video";
}

// A compact per-video markdown report for the bundle: metadata block + description
// + transcript. Tuned to be readable and to hand cleanly to an LLM.
export function videoReportMarkdown(v: VideoExtract): string {
  const watch = `https://www.youtube.com/watch?v=${v.videoId}`;
  const num = (n?: number | null) => (n != null ? n.toLocaleString() : "N/A");
  const lines: string[] = [`# ${v.title || v.videoId}`, ""];

  const meta: string[] = [`**Source:** ${watch}`];
  if (v.channel) meta.push(`**Channel:** ${v.channel}`);
  if (v.durationText) meta.push(`**Duration:** ${v.durationText}`);
  if (v.uploadDate) meta.push(`**Uploaded:** ${v.uploadDate}`);
  meta.push(`**Views:** ${num(v.viewCount)}`);
  meta.push(`**Likes:** ${num(v.likeCount)}`);
  if (v.tags && v.tags.length) meta.push(`**Tags:** ${v.tags.join(", ")}`);
  lines.push(meta.map((m) => `> ${m}  `).join("\n"), "");

  lines.push("## Description", "", "```", v.description || "(no description)", "```", "");

  lines.push("## Transcript", "");
  const t = v.transcript?.text?.trim();
  lines.push(t || "_No transcript available for this video._", "");

  return lines.join("\n");
}

export function saveBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Defer revocation: revoking synchronously can cut off a large download in some
  // browsers before the blob stream has been captured.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

// Minimal CRC-32 for the hand-rolled zip below (avoids a zip dependency).
function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc ^= bytes[i];
    for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// Build an uncompressed ("stored") ZIP from many small text files. Stored is fine
// here: the entries are markdown, and it keeps the writer tiny and dependency-free.
export function buildZip(files: { name: string; data: Uint8Array }[]): Blob {
  const enc = new TextEncoder();
  const u16 = (n: number) => [n & 0xff, (n >>> 8) & 0xff];
  const u32 = (n: number) => [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff];
  const parts: Uint8Array[] = [];
  const central: number[] = [];
  let offset = 0;

  for (const f of files) {
    const name = enc.encode(f.name);
    const crc = crc32(f.data);
    const size = f.data.length;
    const local = Uint8Array.from([
      ...u32(0x04034b50), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
      ...u32(crc), ...u32(size), ...u32(size), ...u16(name.length), ...u16(0),
      ...name,
    ]);
    parts.push(local, f.data);
    central.push(
      ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
      ...u32(crc), ...u32(size), ...u32(size), ...u16(name.length), ...u16(0), ...u16(0),
      ...u16(0), ...u16(0), ...u32(0), ...u32(offset), ...name,
    );
    offset += local.length + size;
  }

  const centralBytes = Uint8Array.from(central);
  const eocd = Uint8Array.from([
    ...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length),
    ...u32(centralBytes.length), ...u32(offset), ...u16(0),
  ]);
  return new Blob([...parts, centralBytes, eocd] as BlobPart[], { type: "application/zip" });
}
