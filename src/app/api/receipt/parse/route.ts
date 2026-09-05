import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parseReceiptText } from "@/lib/receipt-parse";
import {
  mapResolvedToApiShape,
  resolveReceiptItems,
} from "@/lib/receipt-resolve";

const schema = z.object({
  text: z.string().min(1).max(100_000),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text } = schema.parse(body);
    const parsed = parseReceiptText(text);
    const resolved = await resolveReceiptItems(parsed);
    const items = resolved.map(mapResolvedToApiShape);
    return NextResponse.json({
      items,
      count: items.length,
      // Keep legacy-friendly raw parse alongside resolved rows
      parsed: parsed.map((p) => ({
        name: p.name,
        quantity: p.quantity,
        unit: p.unit,
        confidence: p.confidence,
        rawLine: p.rawLine,
      })),
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Parse failed" }, { status: 500 });
  }
}
