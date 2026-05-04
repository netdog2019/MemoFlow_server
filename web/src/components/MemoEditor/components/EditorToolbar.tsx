import {
  BoldIcon,
  HashIcon,
  ImageIcon,
  IndentIcon,
  ListIcon,
  ListOrderedIcon,
  MicIcon,
  OutdentIcon,
  SendHorizontalIcon,
  SquareIcon,
} from "lucide-react";
import type { FC, MouseEvent as ReactMouseEvent } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useTranslate } from "@/utils/i18n";
import {
  forceOpenSuggestions,
  indentList,
  insertTag,
  outdentList,
  refreshEditorInput,
  toggleBoldStyle,
  toggleBulletedList,
  toggleItalicStyle,
  toggleNumberedList,
  toggleTaskList,
} from "../Editor/formatting";
import { useFileUpload } from "../hooks";
import { validationService } from "../services";
import { useEditorContext } from "../state";
import InsertMenu from "../Toolbar/InsertMenu";
import type { EditorToolbarProps } from "../types";

const MOBILE_MEDIA_ACCEPT = ".avif,.gif,.heic,.heif,.jpeg,.jpg,.png,.webp,.m4v,.mov,.mp4,.webm";

const isMobileBrowser = () => {
  if (typeof navigator === "undefined") {
    return false;
  }

  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
};

export const EditorToolbar: FC<EditorToolbarProps> = ({
  onSave,
  onCancel,
  memoName,
  onAudioRecorderClick,
  editorRef,
  isActive = false,
  isBoldActive = false,
  isItalicActive = false,
  onToolbarAction,
}) => {
  const t = useTranslate();
  const { state, actions, dispatch } = useEditorContext();
  const { valid } = validationService.canSave(state);

  const isSaving = state.ui.isLoading.saving;
  const toolbarButtonClassName =
    "size-8 rounded-full text-muted-foreground shadow-none transition-[background-color,color,box-shadow] hover:text-foreground hover:bg-background/90";
  const {
    fileInputRef: mediaInputRef,
    selectingFlag: selectingMediaFlag,
    handleFileInputChange: handleMediaInputChange,
    handleUploadClick: handleMediaUploadClick,
  } = useFileUpload((newFiles) => {
    newFiles.forEach((file) => dispatch(actions.addLocalFile(file)));
  });
  const {
    fileInputRef: attachmentInputRef,
    selectingFlag: selectingAttachmentFlag,
    handleFileInputChange: handleAttachmentInputChange,
    handleUploadClick: handleAttachmentUploadClick,
  } = useFileUpload((newFiles) => {
    newFiles.forEach((file) => dispatch(actions.addLocalFile(file)));
  });

  const handleLocationChange = (location: (typeof state.metadata)["location"]) => {
    dispatch(actions.setMetadata({ location }));
  };

  const handleToggleFocusMode = () => {
    dispatch(actions.toggleFocusMode());
  };

  const handleTag = () => {
    const editor = editorRef.current;
    if (!editor) return;
    onToolbarAction?.();
    const isTextarea = editor.getEditor()?.tagName === "TEXTAREA";
    if (isTextarea) {
      insertTag(editor);
    } else {
      editor.focus();
      const cursor = editor.getCursorPosition();
      forceOpenSuggestions("#", { word: "#", start: cursor, end: cursor });
    }

    requestAnimationFrame(() => {
      editor.focus();
      requestAnimationFrame(() => {
        if (isTextarea) {
          refreshEditorInput(editor);
          forceOpenSuggestions("#");
        }
      });
    });
  };

  const handleBold = () => {
    const editor = editorRef.current;
    if (!editor) return;
    onToolbarAction?.();
    toggleBoldStyle(editor);
  };

  const handleItalic = () => {
    const editor = editorRef.current;
    if (!editor) return;
    onToolbarAction?.();
    toggleItalicStyle(editor);
  };

  const handleTaskList = () => {
    const editor = editorRef.current;
    if (!editor) return;
    onToolbarAction?.();
    toggleTaskList(editor);
    requestAnimationFrame(() => {
      editor.focus();
      refreshEditorInput(editor);
    });
  };

  const handleBulletedList = () => {
    const editor = editorRef.current;
    if (!editor) return;
    onToolbarAction?.();
    toggleBulletedList(editor);
    requestAnimationFrame(() => {
      editor.focus();
      refreshEditorInput(editor);
    });
  };

  const handleNumberedList = () => {
    const editor = editorRef.current;
    if (!editor) return;
    onToolbarAction?.();
    toggleNumberedList(editor);
    requestAnimationFrame(() => {
      editor.focus();
      refreshEditorInput(editor);
    });
  };

  const handleIndent = () => {
    const editor = editorRef.current;
    if (!editor) return;
    onToolbarAction?.();
    indentList(editor);
    requestAnimationFrame(() => editor.focus());
  };

  const handleOutdent = () => {
    const editor = editorRef.current;
    if (!editor) return;
    onToolbarAction?.();
    outdentList(editor);
    requestAnimationFrame(() => editor.focus());
  };

  const handleAudioRecorder = () => {
    onToolbarAction?.();
    onAudioRecorderClick();
  };

  const handleMediaUpload = () => {
    onToolbarAction?.();
    handleMediaUploadClick(isMobileBrowser() ? MOBILE_MEDIA_ACCEPT : "image/*,video/*");
  };

  const handleAttachmentUpload = () => {
    onToolbarAction?.();
    handleAttachmentUploadClick("*");
  };

  const preventToolbarFocusSteal = (event: ReactMouseEvent<HTMLElement>) => {
    event.preventDefault();
  };

  return (
    <div
      className={cn(
        "w-full border-t border-border/45 pt-2 transition-opacity duration-200",
        isActive ? "opacity-100" : "opacity-50 hover:opacity-85",
      )}
    >
      <div className="flex w-full items-center gap-2">
        <div className="min-w-0 flex flex-1 items-center gap-1 overflow-x-auto whitespace-nowrap pr-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={toolbarButtonClassName}
            onMouseDown={preventToolbarFocusSteal}
            onClick={handleTag}
            title="标签"
          >
            <HashIcon className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={toolbarButtonClassName}
            onMouseDown={preventToolbarFocusSteal}
            onClick={handleMediaUpload}
            title="插入图片或视频"
            disabled={state.ui.isLoading.uploading}
          >
            <ImageIcon className="size-4" />
          </Button>
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={toolbarButtonClassName}
                onMouseDown={preventToolbarFocusSteal}
                title="列表"
                onClick={() => onToolbarAction?.()}
              >
                <ListIcon className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="center" sideOffset={8} className="min-w-0 rounded-full px-1.5 py-1 shadow-sm">
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={toolbarButtonClassName}
                  onMouseDown={preventToolbarFocusSteal}
                  onClick={handleBulletedList}
                  title="符号列表"
                >
                  <ListIcon className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={toolbarButtonClassName}
                  onMouseDown={preventToolbarFocusSteal}
                  onClick={handleNumberedList}
                  title="数字列表"
                >
                  <ListOrderedIcon className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={toolbarButtonClassName}
                  onMouseDown={preventToolbarFocusSteal}
                  onClick={handleIndent}
                  title="向后缩进"
                >
                  <IndentIcon className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={toolbarButtonClassName}
                  onMouseDown={preventToolbarFocusSteal}
                  onClick={handleOutdent}
                  title="向前缩进"
                >
                  <OutdentIcon className="size-4" />
                </Button>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(toolbarButtonClassName, isBoldActive && "bg-accent text-accent-foreground shadow-sm ring-1 ring-accent/40")}
            onMouseDown={preventToolbarFocusSteal}
            onClick={handleBold}
            title="加粗"
          >
            <BoldIcon className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={toolbarButtonClassName}
            onMouseDown={preventToolbarFocusSteal}
            onClick={handleTaskList}
            title="清单"
          >
            <SquareIcon className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={toolbarButtonClassName}
            onMouseDown={preventToolbarFocusSteal}
            onClick={handleAudioRecorder}
            title="插入录音"
            disabled={state.ui.isLoading.uploading}
          >
            <MicIcon className="size-4" />
          </Button>
          <InsertMenu
            location={state.metadata.location}
            onLocationChange={handleLocationChange}
            onToggleFocusMode={handleToggleFocusMode}
            memoName={memoName}
            onAudioRecorderClick={onAudioRecorderClick}
            visibility={state.metadata.visibility}
            onVisibilityChange={(visibility) => dispatch(actions.setMetadata({ visibility }))}
            onFileUploadClick={handleAttachmentUpload}
            onItalicClick={handleItalic}
            isItalicActive={isItalicActive}
          />
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {onCancel && (
            <Button
              variant="ghost"
              size="sm"
              className="rounded-full"
              onMouseDown={preventToolbarFocusSteal}
              onClick={onCancel}
              disabled={isSaving}
            >
              {t("common.cancel")}
            </Button>
          )}
          <Button
            size="icon"
            className="size-8 rounded-full text-white hover:text-white disabled:text-white/70"
            onMouseDown={preventToolbarFocusSteal}
            onClick={onSave}
            disabled={!valid || isSaving}
            title={t("editor.save")}
          >
            <SendHorizontalIcon className="size-4 text-current" />
          </Button>
        </div>
      </div>
      <input
        id="memo-editor-media-input"
        ref={mediaInputRef}
        type="file"
        className="sr-only"
        accept="*"
        multiple
        onChange={handleMediaInputChange}
        disabled={selectingMediaFlag || state.ui.isLoading.uploading}
      />
      <input
        id="memo-editor-file-input"
        ref={attachmentInputRef}
        type="file"
        className="sr-only"
        multiple
        onChange={handleAttachmentInputChange}
        disabled={selectingAttachmentFlag || state.ui.isLoading.uploading}
      />
    </div>
  );
};
