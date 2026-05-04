import { Fragment, memo } from "react";

interface WysiwygOverlayProps {
  content: string;
  className?: string;
  scrollTop?: number;
  onTagClick?: (tagName: string) => void;
}

const TAG_REGEX = /#[\p{L}\p{N}_/-]+/gu;
const MARKER_CLASS = "select-none text-transparent";
const BOLD_OPEN = "\u2060";
const BOLD_CLOSE = "\u2005";
const ITALIC_OPEN = "\u2062";
const ITALIC_CLOSE = "\u200A";
const LEGACY_TASK_TODO = "\u2003\u2006";
const LEGACY_TASK_DONE = "\u2003\u2005";
const SPACED_TASK_TODO = "\u2003\u2004\u2006";
const SPACED_TASK_DONE = "\u2003\u2004\u2005";
const LIST_INDENT = "    ";
const ORDERED_LIST_STYLES = ["decimal", "lower-alpha", "lower-roman", "upper-alpha", "upper-roman"] as const;

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getListIndentLevel(indent: string) {
  return Math.floor(indent.replace(/\t/g, LIST_INDENT).length / LIST_INDENT.length);
}

const TaskCheckbox = ({ checked }: { checked: boolean }) => (
  <span
    className={`pointer-events-none absolute left-0.5 top-[0.32rem] inline-flex size-4 items-center justify-center rounded border text-[0.72rem] leading-none ${
      checked ? "border-emerald-600 bg-emerald-600 text-white" : "border-muted-foreground/60 bg-background text-transparent"
    }`}
  >
    ✓
  </span>
);

const TaskPrefix = ({ indent, marker, checked }: { indent: string; marker: string; checked: boolean }) => (
  <>
    <span className={MARKER_CLASS}>{indent}</span>
    <span className={`${MARKER_CLASS} relative inline-block`}>
      {marker}
      <TaskCheckbox checked={checked} />
    </span>
  </>
);

const BulletPrefix = ({ indent, marker }: { indent: string; marker: string }) => {
  const normalizedMarker = `${marker.trimStart().charAt(0) || "-"}   `;
  const level = getListIndentLevel(indent) % 3;

  return (
    <>
      <span className={MARKER_CLASS}>{indent}</span>
      <span className={`${MARKER_CLASS} relative inline-block`}>
        {normalizedMarker}
        {level === 0 ? (
          <span className="pointer-events-none absolute left-1 top-[0.78rem] h-1.5 w-1.5 rounded-full bg-muted-foreground" />
        ) : level === 1 ? (
          <span className="pointer-events-none absolute left-1 top-[0.78rem] h-1.5 w-1.5 rounded-full border border-muted-foreground" />
        ) : (
          <span className="pointer-events-none absolute left-1 top-[0.78rem] h-1.5 w-1.5 bg-muted-foreground" />
        )}
      </span>
    </>
  );
};

function toAlphaListMarker(number: number, uppercase: boolean) {
  let value = Math.max(1, number);
  let result = "";

  while (value > 0) {
    value -= 1;
    result = String.fromCharCode((uppercase ? 65 : 97) + (value % 26)) + result;
    value = Math.floor(value / 26);
  }

  return result;
}

function toRomanListMarker(number: number, uppercase: boolean) {
  const numerals = [
    [1000, "m"],
    [900, "cm"],
    [500, "d"],
    [400, "cd"],
    [100, "c"],
    [90, "xc"],
    [50, "l"],
    [40, "xl"],
    [10, "x"],
    [9, "ix"],
    [5, "v"],
    [4, "iv"],
    [1, "i"],
  ] as const;
  let value = Math.min(Math.max(1, number), 3999);
  let result = "";

  for (const [amount, numeral] of numerals) {
    while (value >= amount) {
      result += numeral;
      value -= amount;
    }
  }

  return uppercase ? result.toUpperCase() : result;
}

function formatOrderedListNumber(number: number, indent: string) {
  const style = ORDERED_LIST_STYLES[getListIndentLevel(indent) % ORDERED_LIST_STYLES.length] ?? "decimal";

  switch (style) {
    case "lower-alpha":
      return toAlphaListMarker(number, false);
    case "upper-alpha":
      return toAlphaListMarker(number, true);
    case "lower-roman":
      return toRomanListMarker(number, false);
    case "upper-roman":
      return toRomanListMarker(number, true);
    default:
      return String(number);
  }
}

const OrderedPrefix = ({ indent, number, delimiter }: { indent: string; number: string; delimiter: string }) => {
  const displayNumber = formatOrderedListNumber(Number.parseInt(number, 10), indent);
  const normalizedMarker = `${" ".repeat(Math.max(number.length, displayNumber.length))}${delimiter}   `;

  return (
    <>
      <span className={MARKER_CLASS}>{indent}</span>
      <span className={`${MARKER_CLASS} relative inline-block tabular-nums`}>
        {normalizedMarker}
        <span className="pointer-events-none absolute left-0 top-0 inline-flex text-muted-foreground">
          {displayNumber}
          {delimiter}
        </span>
      </span>
    </>
  );
};

const renderInlineTokens = (text: string, keyPrefix: string, onTagClick?: (tagName: string) => void): React.ReactNode[] => {
  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  let tokenIndex = 0;

  const pushPlainText = (value: string) => {
    if (!value) {
      return;
    }

    nodes.push(<span key={`${keyPrefix}-plain-${tokenIndex++}`}>{value}</span>);
  };

  while (cursor < text.length) {
    if (text.startsWith(BOLD_OPEN, cursor)) {
      const end = text.indexOf(BOLD_CLOSE, cursor + BOLD_OPEN.length);
      if (end >= cursor + BOLD_OPEN.length) {
        nodes.push(
          <span key={`${keyPrefix}-bold-open-${tokenIndex++}`} className={MARKER_CLASS}>
            {BOLD_OPEN}
          </span>,
        );
        nodes.push(
          <span
            key={`${keyPrefix}-bold-${tokenIndex++}`}
            className="font-normal text-foreground [text-shadow:0.015em_0_0_currentColor,-0.015em_0_0_currentColor]"
          >
            {renderInlineTokens(text.slice(cursor + BOLD_OPEN.length, end), `${keyPrefix}-bold-inner-${tokenIndex}`, onTagClick)}
          </span>,
        );
        nodes.push(
          <span key={`${keyPrefix}-bold-close-${tokenIndex++}`} className={MARKER_CLASS}>
            {BOLD_CLOSE}
          </span>,
        );
        cursor = end + BOLD_CLOSE.length;
        continue;
      }
    }

    if (text.startsWith(ITALIC_OPEN, cursor)) {
      const end = text.indexOf(ITALIC_CLOSE, cursor + ITALIC_OPEN.length);
      if (end >= cursor + ITALIC_OPEN.length) {
        nodes.push(
          <span key={`${keyPrefix}-italic-open-${tokenIndex++}`} className={MARKER_CLASS}>
            {ITALIC_OPEN}
          </span>,
        );
        nodes.push(
          <span key={`${keyPrefix}-italic-${tokenIndex++}`} className="inline-block origin-center -skew-x-[10deg] text-foreground">
            {renderInlineTokens(text.slice(cursor + ITALIC_OPEN.length, end), `${keyPrefix}-italic-inner-${tokenIndex}`, onTagClick)}
          </span>,
        );
        nodes.push(
          <span key={`${keyPrefix}-italic-close-${tokenIndex++}`} className={MARKER_CLASS}>
            {ITALIC_CLOSE}
          </span>,
        );
        cursor = end + ITALIC_CLOSE.length;
        continue;
      }
    }

    const tagMatch = text.slice(cursor).match(/^#[\p{L}\p{N}_/-]+/u);
    if (tagMatch) {
      const cleanTag = tagMatch[0];
      const tagName = cleanTag.slice(1);
      nodes.push(
        <span
          key={`${keyPrefix}-tag-${tokenIndex++}`}
          className="pointer-events-auto cursor-pointer font-medium text-emerald-600 transition-opacity hover:opacity-75"
          onMouseDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onTagClick?.(tagName);
          }}
        >
          {cleanTag}
        </span>,
      );
      cursor += cleanTag.length;
      continue;
    }

    const nextSpecialIndex = (() => {
      const rest = text.slice(cursor);
      const candidates = [rest.indexOf(BOLD_OPEN), rest.indexOf(ITALIC_OPEN), rest.search(TAG_REGEX)].filter((index) => index >= 0);

      if (candidates.length === 0) {
        return text.length;
      }

      return cursor + Math.min(...candidates);
    })();

    if (nextSpecialIndex === cursor) {
      pushPlainText(text[cursor]);
      cursor += 1;
      continue;
    }

    pushPlainText(text.slice(cursor, nextSpecialIndex));
    cursor = nextSpecialIndex;
  }

  return nodes;
};

const renderLine = (line: string, index: number, onTagClick?: (tagName: string) => void) => {
  if (line.length === 0) {
    return (
      <div key={`line-${index}`} className="whitespace-pre-wrap break-words text-foreground">
        &nbsp;
      </div>
    );
  }

  const taskMatch = line.match(/^(\s*)([-*+])\s+\[([ xX])\]\s?(.*)$/);
  if (taskMatch) {
    const [, indent, symbol, checkedState, text] = taskMatch;
    const marker = `${symbol} [${checkedState}] `;
    const isChecked = checkedState.toLowerCase() === "x";

    return (
      <div key={`line-${index}`} className="whitespace-pre-wrap break-words text-foreground">
        <TaskPrefix indent={indent} marker={marker} checked={isChecked} />
        {renderInlineTokens(text, `line-${index}-task`, onTagClick)}
      </div>
    );
  }

  const internalTaskMatch = line.match(
    new RegExp(`^(\\s*)(${[LEGACY_TASK_TODO, LEGACY_TASK_DONE, SPACED_TASK_TODO, SPACED_TASK_DONE].map(escapeRegExp).join("|")})(.*)$`),
  );
  if (internalTaskMatch) {
    const [, indent, taskToken, text] = internalTaskMatch;
    const marker = "- [ ] ";
    const isChecked = taskToken === LEGACY_TASK_DONE || taskToken === SPACED_TASK_DONE;

    return (
      <div key={`line-${index}`} className="whitespace-pre-wrap break-words text-foreground">
        <span className={MARKER_CLASS}>
          {indent}
          {taskToken}
        </span>
        <span className={`${MARKER_CLASS} relative inline-block`}>
          {marker}
          <TaskCheckbox checked={isChecked} />
        </span>
        {renderInlineTokens(text, `line-${index}-task-internal`, onTagClick)}
      </div>
    );
  }

  const unorderedMatch = line.match(/^(\s*)(([-*+])\s+)(.*)$/);
  if (unorderedMatch) {
    const [, indent, marker, , text] = unorderedMatch;

    return (
      <div key={`line-${index}`} className="whitespace-pre-wrap break-words text-foreground">
        <BulletPrefix indent={indent} marker={marker} />
        {renderInlineTokens(text, `line-${index}-unordered`, onTagClick)}
      </div>
    );
  }

  const orderedMatch = line.match(/^(\s*)((\d+)([.)])\s+)(.*)$/);
  if (orderedMatch) {
    const [, indent, , number, delimiter, text] = orderedMatch;

    return (
      <div key={`line-${index}`} className="whitespace-pre-wrap break-words text-foreground">
        <OrderedPrefix indent={indent} number={number} delimiter={delimiter} />
        {renderInlineTokens(text, `line-${index}-ordered`, onTagClick)}
      </div>
    );
  }

  return (
    <div key={`line-${index}`} className="whitespace-pre-wrap break-words text-foreground">
      {renderInlineTokens(line, `line-${index}`, onTagClick)}
    </div>
  );
};

const WysiwygOverlay = ({ content, className, scrollTop = 0, onTagClick }: WysiwygOverlayProps) => {
  const lines = content.split("\n");

  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden rounded-[0.85rem] ${className ?? ""}`}>
      <div
        className="min-h-full px-0 py-1 text-[0.94rem] leading-[1.7] font-normal tracking-normal antialiased"
        style={{ transform: `translateY(-${scrollTop}px)` }}
      >
        {lines.map((line, index) => (
          <Fragment key={`overlay-line-${index}`}>{renderLine(line, index, onTagClick)}</Fragment>
        ))}
      </div>
    </div>
  );
};

export default memo(WysiwygOverlay);
