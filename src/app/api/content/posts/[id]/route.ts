import { NextRequest, NextResponse } from "next/server";
import { assertSameOrigin } from "@/lib/same-origin";
import { deletePost, postForViewer, updatePost } from "@/lib/content/posts";
import { contentErrorResponse, currentViewer, requireViewer } from "@/lib/content/route-helpers";
import { postInputSchema } from "@/lib/content/schemas";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const post = await postForViewer(id, await currentViewer());
    if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ post });
  } catch (err) {
    return contentErrorResponse(err, "content/posts/[id] GET");
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const v = await requireViewer();
    assertSameOrigin(req);
    const { id } = await ctx.params;
    const post = await updatePost(v, id, postInputSchema.parse(await req.json().catch(() => ({}))));
    return NextResponse.json({ post });
  } catch (err) {
    return contentErrorResponse(err, "content/posts/[id] PATCH");
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    const v = await requireViewer();
    assertSameOrigin(req);
    const { id } = await ctx.params;
    await deletePost(v, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return contentErrorResponse(err, "content/posts/[id] DELETE");
  }
}
