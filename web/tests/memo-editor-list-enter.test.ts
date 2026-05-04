import { describe, expect, it } from "vitest";
import { deserializeEditorContent, getPlainListEnterTransition } from "@/components/MemoEditor/Editor";

describe("memo editor plain list enter transition", () => {
  it("normalizes compact unordered markers to widened marker spacing", () => {
    expect(deserializeEditorContent("- hello\n  - nested")).toBe("-   hello\n  -   nested");
  });

  it("normalizes compact ordered markers to widened marker spacing", () => {
    expect(deserializeEditorContent("1. hello\n    2. nested")).toBe("1.   hello\n    2.   nested");
  });

  it("continues unordered list input on enter after text", () => {
    const content = "-   hello";
    const transition = getPlainListEnterTransition(content, content.length);

    expect(transition).not.toBeNull();
    expect(transition?.content).toBe("-   hello\n-   ");
    expect(transition?.cursor).toBe(transition?.content.length);
  });

  it("exits unordered list input on enter from an empty item", () => {
    const content = "-   hello\n-   ";
    const transition = getPlainListEnterTransition(content, content.length);

    expect(transition).not.toBeNull();
    expect(transition?.content).toBe("-   hello\n");
    expect(transition?.cursor).toBe(transition?.content.length);
  });

  it("continues ordered list input with the next number", () => {
    const content = "1.   hello";
    const transition = getPlainListEnterTransition(content, content.length);

    expect(transition).not.toBeNull();
    expect(transition?.content).toBe("1.   hello\n2.   ");
    expect(transition?.cursor).toBe(transition?.content.length);
  });

  it("keeps indentation when continuing an indented ordered list", () => {
    const content = "    2.   nested";
    const transition = getPlainListEnterTransition(content, content.length);

    expect(transition).not.toBeNull();
    expect(transition?.content).toBe("    2.   nested\n    3.   ");
    expect(transition?.cursor).toBe(transition?.content.length);
  });

  it("keeps widened marker spacing when continuing an indented unordered list", () => {
    const content = "    *   nested";
    const transition = getPlainListEnterTransition(content, content.length);

    expect(transition).not.toBeNull();
    expect(transition?.content).toBe("    *   nested\n    *   ");
    expect(transition?.cursor).toBe(transition?.content.length);
  });

  it("uses different unordered markers by indentation level", () => {
    expect(getPlainListEnterTransition("-   root", "-   root".length)?.content).toBe("-   root\n-   ");
    expect(getPlainListEnterTransition("    *   child", "    *   child".length)?.content).toBe("    *   child\n    *   ");
    expect(getPlainListEnterTransition("        +   grandchild", "        +   grandchild".length)?.content).toBe(
      "        +   grandchild\n        +   ",
    );
  });

  it("continues ordered list numbering independently per indentation level", () => {
    const content = ["1.   root", "    1.   child", "    2.   child"].join("\n");
    const transition = getPlainListEnterTransition(content, content.length);

    expect(transition).not.toBeNull();
    expect(transition?.content).toBe("1.   root\n    1.   child\n    2.   child\n    3.   ");
  });

  it("outdents an empty nested ordered item on enter", () => {
    const content = ["1.   root", "    1.   child", "    2.   "].join("\n");
    const transition = getPlainListEnterTransition(content, content.length);

    expect(transition).not.toBeNull();
    expect(transition?.content).toBe("1.   root\n    1.   child\n2.   ");
    expect(transition?.cursor).toBe(transition?.content.length);
  });

  it("outdents an empty nested unordered item on enter", () => {
    const content = ["-   root", "    *   child", "    *   "].join("\n");
    const transition = getPlainListEnterTransition(content, content.length);

    expect(transition).not.toBeNull();
    expect(transition?.content).toBe("-   root\n    *   child\n-   ");
    expect(transition?.cursor).toBe(transition?.content.length);
  });

  it("exits ordered list input from an empty top-level item", () => {
    const content = ["1.   root", "2.   "].join("\n");
    const transition = getPlainListEnterTransition(content, content.length);

    expect(transition).not.toBeNull();
    expect(transition?.content).toBe("1.   root\n");
    expect(transition?.cursor).toBe(transition?.content.length);
  });
});
