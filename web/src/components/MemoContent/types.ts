import type React from "react";

export interface MemoContentProps {
  content: string;
  compact?: boolean;
  className?: string;
  contentClassName?: string;
  onClick?: (e: React.MouseEvent) => void;
  onDoubleClick?: (e: React.MouseEvent) => void;
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
}

export type ContentCompactView = "ALL" | "SNIPPET";
