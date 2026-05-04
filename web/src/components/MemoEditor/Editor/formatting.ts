import { normalizeEditorContent } from "../utils/contentNormalization";
import {
  EDITOR_FORCE_SUGGESTIONS_EVENT,
  EDITOR_SET_SUGGESTIONS_ANCHOR_EVENT,
  EDITOR_UI_SYNC_EVENT,
  type EditorRefActions,
  serializeEditorContent,
} from "./index";

export function toggleBoldStyle(editor: EditorRefActions): void {
  editor.toggleInlineStyle("bold");
}

export function toggleItalicStyle(editor: EditorRefActions): void {
  editor.toggleInlineStyle("italic");
}

export function insertTag(editor: EditorRefActions): void {
  editor.insertTagTrigger();
}

export function toggleTaskList(editor: EditorRefActions): void {
  editor.toggleTaskList();
}

export function toggleBulletedList(editor: EditorRefActions): void {
  editor.toggleBulletedList();
}

export function toggleNumberedList(editor: EditorRefActions): void {
  editor.toggleNumberedList();
}

export function outdentList(editor: EditorRefActions): void {
  editor.outdentList();
}

export function indentList(editor: EditorRefActions): void {
  editor.indentList();
}

export function outdentCurrentListItem(editor: EditorRefActions): boolean {
  editor.outdentList();
  return true;
}

export function indentCurrentListItem(editor: EditorRefActions): boolean {
  editor.indentList();
  return true;
}

export function normalizeEditorContentForSave(content: string): string {
  return normalizeEditorContent(serializeEditorContent(content));
}

export function refreshEditorInput(editor: EditorRefActions): void {
  const syncEvent = new CustomEvent(EDITOR_UI_SYNC_EVENT, { bubbles: true });
  editor.getEditor()?.dispatchEvent(syncEvent);
  document.dispatchEvent(new CustomEvent(EDITOR_UI_SYNC_EVENT));
}

export function forceOpenSuggestions(triggerChar: string, detail?: { word?: string; start?: number; end?: number }): void {
  document.dispatchEvent(new CustomEvent(EDITOR_FORCE_SUGGESTIONS_EVENT, { detail: { triggerChar, ...detail } }));
}

export function setSuggestionsAnchor(left: number, top: number, height = 24): void {
  document.dispatchEvent(new CustomEvent(EDITOR_SET_SUGGESTIONS_ANCHOR_EVENT, { detail: { left, top, height } }));
}
