import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { assertSameOrigin } from "@/lib/same-origin";
import { postAction } from "@/lib/content/posts";
import { contentErrorResponse, requireViewer } from "@/lib/content/route-helpers";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("submit") }),
  z.object({ action: z.literal("publish"), publishAt: z.string().max(40).nullable().optional() }),
  z.object({ action: z.literal("unpublish") }),
  z.object({ action: z.literal("reject"), note: z.string().max(1000).nullable().optional() }),
]);

/** submit (chef → review) · publish (now or scheduled) · unpublish · reject (admin). */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const v = await requireViewer();
    assertSameOrigin(req);
    const { id } = await ctx.params;
    const post = await postAction(v, id, schema.parse(await req.json().catch(() => ({}))));
    return NextResponse.json({ post });
  } catch (err) {
    return contentErrorResponse(err, "content/posts/[id]/action POST");
  }
}
