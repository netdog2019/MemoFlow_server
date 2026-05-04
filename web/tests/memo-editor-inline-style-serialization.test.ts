import { describe, expect, it } from "vitest";
import { deserializeEditorContent } from "@/components/MemoEditor/Editor";

describe("memo editor inline style serialization", () => {
  it("converts empty bold markdown markers into internal tokens", () => {
    expect(deserializeEditorContent("****")).not.toContain("*");
  });

  it("keeps task list markdown markers visible to the overlay renderer", () => {
    expect(deserializeEditorContent("- [x] done")).toBe("- [x] done");
    expect(deserializeEditorContent("- [ ] todo")).toBe("- [ ] todo");
  });
});
