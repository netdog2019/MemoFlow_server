import { describe, expect, it } from "vitest";
import { getTaskListEnterTransition, getTaskListToggleTransition, serializeEditorContent } from "@/components/MemoEditor/Editor";

describe("memo editor task list formatting", () => {
  it("places the cursor after the internal task marker for an empty line", () => {
    const transition = getTaskListToggleTransition("", 0);

    expect(serializeEditorContent(transition.content)).toBe("- [ ] ");
    expect(transition.cursor).toBe(transition.content.length);
  });

  it("keeps typed text on the same task line after toggling an empty line", () => {
    const transition = getTaskListToggleTransition("", 0);
    const nextContent = `${transition.content.slice(0, transition.cursor)}hello${transition.content.slice(transition.cursor)}`;

    expect(serializeEditorContent(nextContent)).toBe("- [ ] hello");
  });

  it("removes a task marker without swallowing the first character", () => {
    const taskLine = "- [ ] hello";
    const transition = getTaskListToggleTransition(taskLine, taskLine.length);

    expect(serializeEditorContent(transition.content)).toBe("hello");
    expect(transition.cursor).toBe("hello".length);
  });

  it("continues task list input on enter after text", () => {
    const content = getTaskListToggleTransition("", 0).content;
    const line = `${content}hello`;
    const transition = getTaskListEnterTransition(line, line.length);

    expect(transition).not.toBeNull();
    expect(serializeEditorContent(transition?.content ?? "")).toBe("- [ ] hello\n- [ ] ");
    expect(transition?.cursor).toBe(transition?.content.length);
  });

  it("exits task list input on enter from an empty task item", () => {
    const firstTransition = getTaskListToggleTransition("", 0);
    const firstLine = `${firstTransition.content}hello`;
    const secondTransition = getTaskListEnterTransition(firstLine, firstLine.length);

    expect(secondTransition).not.toBeNull();
    const exitTransition = getTaskListEnterTransition(secondTransition?.content ?? "", secondTransition?.cursor ?? 0);

    expect(exitTransition).not.toBeNull();
    expect(serializeEditorContent(exitTransition?.content ?? "")).toBe("- [ ] hello\n");
    expect(exitTransition?.cursor).toBe(exitTransition?.content.length);
  });

  it("continues task list input with doubled indentation", () => {
    const content = "    - [ ] nested";
    const transition = getTaskListEnterTransition(content, content.length);

    expect(transition).not.toBeNull();
    expect(serializeEditorContent(transition?.content ?? "")).toBe("    - [ ] nested\n    - [ ] ");
    expect(transition?.cursor).toBe(transition?.content.length);
  });

  it("outdents an empty nested task item on enter", () => {
    const content = ["- [ ] root", "    - [ ] child", "    - [ ] "].join("\n");
    const transition = getTaskListEnterTransition(content, content.length);

    expect(transition).not.toBeNull();
    expect(serializeEditorContent(transition?.content ?? "")).toBe("- [ ] root\n    - [ ] child\n- [ ] ");
    expect(transition?.cursor).toBe(transition?.content.length);
  });
});
