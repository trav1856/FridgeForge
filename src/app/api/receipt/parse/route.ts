import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parseReceiptText } from "@/lib/receipt-parse";

const schema = z.object({
  text: z.string().min(1).max(100_000),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text } = schema.parse(body);
    const items = parseReceiptText(text);
    return NextResponse.json({ items, count: items.length });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Parse failed" }, { status: 500 });
  }
}
