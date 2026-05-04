import { describe, expect, it } from "vitest";
import { getInlineStyleEnterTransition } from "@/components/MemoEditor/Editor";

describe("memo editor inline style enter transition", () => {
  it("moves enter outside an italic closing marker", () => {
    const content = "*hello*";
    const cursor = content.length - 1;

    expect(getInlineStyleEnterTransition(content, cursor)).toEqual({
      content: "*hello*\n",
      cursor: content.length + 1,
    });
  });

  it("moves enter outside a bold closing marker", () => {
    const content = "**hello**";
    const cursor = content.length - 2;

    expect(getInlineStyleEnterTransition(content, cursor)).toEqual({
      content: "**hello**\n",
      cursor: content.length + 1,
    });
  });

  it("removes empty italic markers before inserting a newline", () => {
    const content = "**";
    const cursor = 1;

    expect(getInlineStyleEnterTransition(content, cursor)).toEqual({
      content: "\n",
      cursor: 1,
    });
  });
});
