import { revalidateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";

// On-demand revalidation hook called by the api after admin writes so the
// storefront's ISR cache doesn't lag the JSON file. Token-gated via the
// REVALIDATE_TOKEN env shared between this container and the api.
//
// POST /api/revalidate
//   header: Authorization: Bearer <REVALIDATE_TOKEN>
//   body:   { "tag": "current-employees" }
//
// Returns 401 on missing/wrong token (timing-safe compare), 400 if no tag,
// 200 with { ok: true, tag } on success. Currently single-tag for
// simplicity — extend to a {tags: string[]} array when a second consumer
// shows up.

export const dynamic = "force-dynamic";

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export async function POST(req: NextRequest) {
  const expected = process.env.REVALIDATE_TOKEN;
  if (!expected) {
    return NextResponse.json(
      { error: "REVALIDATE_TOKEN not configured" },
      { status: 503 },
    );
  }

  const auth = req.headers.get("authorization") ?? "";
  const supplied = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!supplied || !timingSafeEqual(supplied, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const tag = (body as { tag?: unknown })?.tag;
  if (typeof tag !== "string" || tag.length === 0) {
    return NextResponse.json({ error: "tag is required" }, { status: 400 });
  }

  revalidateTag(tag);
  return NextResponse.json({ ok: true, tag });
}
