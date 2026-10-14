import { NextRequest, NextResponse } from "next/server";
import { postInputSchema } from "@/lib/content/schemas";
import { assertSameOrigin } from "@/lib/same-origin";
import { createPost, livePosts, myPosts } from "@/lib/content/posts";
import { contentErrorResponse, currentViewer, requireViewer } from "@/lib/content/route-helpers";


/** Public list of live posts; `?mine=1` lists the signed-in author's own posts. */
export async function GET(req: NextRequest) {
  try {
    if (req.nextUrl.searchParams.get("mine")) {
      const v = await requireViewer();
      return NextResponse.json({ posts: await myPosts(v) });
    }
    await currentViewer();
    return NextResponse.json({ posts: await livePosts({ tag: req.nextUrl.searchParams.get("tag") }) });
  } catch (err) {
    return contentErrorResponse(err, "content/posts GET");
  }
}

export async function POST(req: NextRequest) {
  try {
    const v = await requireViewer();
    assertSameOrigin(req);
    const input = postInputSchema.parse(await req.json().catch(() => ({})));
    const post = await createPost(v, input);
    return NextResponse.json({ post }, { status: 201 });
  } catch (err) {
    return contentErrorResponse(err, "content/posts POST");
  }
}
