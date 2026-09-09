import { describe, expect, it } from "vitest";
import {
  escapeHtml,
  extractYoutubeEmbeds,
  extractYoutubeId,
  renderOriginStoryHtml,
} from "@/lib/origin-story-content";

describe("escapeHtml", () => {
  it("escapes tags and quotes", () => {
    expect(escapeHtml(`<img src="x" onerror='alert(1)'>`)).toBe(
      "&lt;img src=&quot;x&quot; onerror=&#39;alert(1)&#39;&gt;"
    );
  });
});

describe("extractYoutubeId", () => {
  it("parses watch, youtu.be, and shorts", () => {
    expect(
      extractYoutubeId("https://www.youtube.com/watch?v=M5lSk8yrk4U")
    ).toBe("M5lSk8yrk4U");
    expect(extractYoutubeId("https://youtu.be/M5lSk8yrk4U")).toBe(
      "M5lSk8yrk4U"
    );
    expect(
      extractYoutubeId("https://www.youtube.com/shorts/M5lSk8yrk4U")
    ).toBe("M5lSk8yrk4U");
  });
});

describe("renderOriginStoryHtml", () => {
  it("autolinks bare https URLs and markdown links safely", () => {
    const html = renderOriginStoryHtml(
      'See https://example.com/a and [Smithsonian](https://www.smithsonianmag.com/).\n\n<script>x</script>'
    );
    expect(html).toContain(
      'href="https://example.com/a" target="_blank" rel="noopener noreferrer"'
    );
    expect(html).toContain(">Smithsonian</a>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
  });

  it("does not link javascript: URLs", () => {
    const html = renderOriginStoryHtml("[x](javascript:alert(1))");
    expect(html).not.toContain("<a ");
    expect(html).toContain("[x](javascript:alert(1))");
  });
});

describe("extractYoutubeEmbeds", () => {
  it("dedupes and builds nocookie embed URLs", () => {
    const embeds = extractYoutubeEmbeds(
      "Watch https://www.youtube.com/watch?v=M5lSk8yrk4U and again https://youtu.be/M5lSk8yrk4U"
    );
    expect(embeds).toHaveLength(1);
    expect(embeds[0]!.embedUrl).toBe(
      "https://www.youtube-nocookie.com/embed/M5lSk8yrk4U"
    );
  });
});
