import type { EditorState } from "../state";

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

const getContentByteLength = (content: string): number => {
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(content).length;
  }

  return new Blob([content]).size;
};

export const validationService = {
  getContentByteLength,

  canSave(state: EditorState, contentLengthLimit?: number): ValidationResult {
    // Cannot save while loading initial content
    if (state.ui.isLoading.loading) {
      return { valid: false, reason: "Loading memo content" };
    }

    // Must have content, attachment, or local file
    if (!state.content.trim() && state.metadata.attachments.length === 0 && state.localFiles.length === 0) {
      return { valid: false, reason: "Content, attachment, or file required" };
    }

    // Cannot save while uploading
    if (state.ui.isLoading.uploading) {
      return { valid: false, reason: "Wait for upload to complete" };
    }

    // Cannot save while audio recorder is active
    if (state.audioRecorder.status === "recording" || state.audioRecorder.status === "requesting_permission") {
      return { valid: false, reason: "Finish audio recording before saving" };
    }

    // Cannot save while already saving
    if (state.ui.isLoading.saving) {
      return { valid: false, reason: "Save in progress" };
    }

    if (contentLengthLimit && getContentByteLength(state.content) > contentLengthLimit) {
      return { valid: false, reason: `内容过长，最多 ${contentLengthLimit} 字节` };
    }

    return { valid: true };
  },
};
