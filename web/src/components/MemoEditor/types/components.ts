import type { Location, Memo, Visibility } from "@/types/proto/api/v1/memo_service_pb";
import type { EditorRefActions } from "../Editor";
import type { Command } from "../Editor/commands";
import type { EditorState } from "../state";

export interface MemoEditorProps {
  className?: string;
  cacheKey?: string;
  placeholder?: string;
  /** Existing memo to edit. When provided, the editor initializes from it without fetching. */
  memo?: Memo;
  parentMemoName?: string;
  autoFocus?: boolean;
  onConfirm?: (memoName: string) => void;
  onCancel?: () => void;
}

export interface EditorContentProps {
  placeholder?: string;
  isActive?: boolean;
  onFocusChange?: (isFocused: boolean) => void;
  editorRef?: React.RefObject<EditorRefActions | null>;
}

export interface EditorToolbarProps {
  onSave: () => void;
  onCancel?: () => void;
  memoName?: string;
  onAudioRecorderClick: () => void;
  editorRef: React.RefObject<EditorRefActions>;
  isActive?: boolean;
  isBoldActive?: boolean;
  isItalicActive?: boolean;
  onToolbarAction?: () => void;
}

export interface EditorMetadataProps {
  memoName?: string;
}

export interface AudioRecorderPanelProps {
  audioRecorder: EditorState["audioRecorder"];
  /** Active mic stream while recording; used for live waveform visualization. */
  mediaStream: MediaStream | null;
  onStop: () => void;
  onCancel: () => void;
  onTranscribe?: () => void;
  canTranscribe?: boolean;
  isTranscribing?: boolean;
}

export interface FocusModeOverlayProps {
  isActive: boolean;
  onToggle: () => void;
}

export interface FocusModeExitButtonProps {
  isActive: boolean;
  onToggle: () => void;
  title: string;
}

export interface InsertMenuProps {
  location?: Location;
  visibility?: Visibility;
  onLocationChange: (location?: Location) => void;
  onVisibilityChange?: (visibility: Visibility) => void;
  onToggleFocusMode?: () => void;
  onFileUploadClick?: () => void;
  onItalicClick?: () => void;
  isItalicActive?: boolean;
  memoName?: string;
  onAudioRecorderClick?: () => void;
}

export interface TagSuggestionsProps {
  editorRef: React.RefObject<EditorRefActions | null>;
}

export interface SlashCommandsProps {
  editorRef: React.RefObject<EditorRefActions | null>;
  commands: Command[];
}

export interface EditorProps {
  className: string;
  initialContent: string;
  placeholder: string;
  onContentChange: (content: string) => void;
  onPaste: (event: React.ClipboardEvent) => void;
  isFocusMode?: boolean;
  isInIME?: boolean;
  isActive?: boolean;
  onCompositionStart?: () => void;
  onCompositionEnd?: () => void;
  onFocusChange?: (isFocused: boolean) => void;
}

export interface VisibilitySelectorProps {
  value: Visibility;
  onChange: (visibility: Visibility) => void;
  onOpenChange?: (open: boolean) => void;
}
