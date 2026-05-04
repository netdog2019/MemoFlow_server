import type { Element } from "hast";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { rehypeHeadingId } from "@/utils/rehype-plugins/rehype-heading-id";
import { remarkDisableSetext } from "@/utils/remark-plugins/remark-disable-setext";
import { remarkMention } from "@/utils/remark-plugins/remark-mention";
import { remarkPreserveType } from "@/utils/remark-plugins/remark-preserve-type";
import { remarkTag } from "@/utils/remark-plugins/remark-tag";
import { CodeBlock } from "./CodeBlock";
import { isMentionNode, isTagNode, isTaskListItemNode } from "./ConditionalComponent";
import { SANITIZE_SCHEMA } from "./constants";
import { Mention } from "./Mention";
import { Blockquote, Heading, HorizontalRule, Image, InlineCode, Link, List, ListItem, Paragraph } from "./markdown";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "./Table";
import { Tag } from "./Tag";
import { TaskListItem } from "./TaskListItem";
import { TrustedIframe } from "./TrustedIframe";

type RenderMode = "memo" | "editor-preview";

interface MemoMarkdownRendererProps {
  content: string;
  className?: string;
  mode?: RenderMode;
  resolvedMentionUsernames?: Set<string>;
}

function getMentionUsername(node: Element, children?: React.ReactNode): string {
  const dataMention = node.properties?.["data-mention"];
  if (typeof dataMention === "string" && dataMention !== "") {
    return dataMention;
  }

  const camelDataMention = (node.properties as Record<string, unknown> | undefined)?.dataMention;
  if (typeof camelDataMention === "string" && camelDataMention !== "") {
    return camelDataMention;
  }

  const text = Array.isArray(children) ? children.join("") : children;
  if (typeof text === "string" && text.startsWith("@")) {
    return text.slice(1).toLowerCase();
  }

  return "";
}

const PassiveTaskListItem = ({ checked, className }: { checked?: boolean; className?: string }) => (
  <Checkbox checked={checked} disabled className={className} />
);

const PassiveTag = ({ children, className, ...props }: React.HTMLAttributes<HTMLSpanElement>) => (
  <span
    className={cn("inline-flex items-center align-baseline px-0.5 py-0 text-[0.9em] leading-none font-normal text-primary", className)}
    {...props}
  >
    {children}
  </span>
);

const MemoMarkdownRenderer = ({
  content,
  className,
  mode = "memo",
  resolvedMentionUsernames = new Set<string>(),
}: MemoMarkdownRendererProps) => {
  const isEditorPreview = mode === "editor-preview";

  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkDisableSetext, remarkMath, remarkGfm, remarkBreaks, remarkMention, remarkTag, remarkPreserveType]}
        rehypePlugins={[
          rehypeRaw,
          [rehypeSanitize, SANITIZE_SCHEMA],
          rehypeHeadingId,
          [rehypeKatex, { throwOnError: false, strict: false }],
        ]}
        components={{
          input: ((inputProps: React.ComponentProps<"input"> & { node?: Element }) => {
            const { node, ...rest } = inputProps;
            if (node && isTaskListItemNode(node)) {
              return isEditorPreview ? (
                <PassiveTaskListItem checked={inputProps.checked} className={inputProps.className} />
              ) : (
                <TaskListItem {...inputProps} />
              );
            }
            return <input {...rest} />;
          }) as React.ComponentType<React.ComponentProps<"input">>,
          span: ((spanProps: React.ComponentProps<"span"> & { node?: Element }) => {
            const { node, ...rest } = spanProps;
            if (node && isMentionNode(node)) {
              const username = getMentionUsername(node, spanProps.children);
              return <Mention {...spanProps} data-mention={username} resolved={resolvedMentionUsernames.has(username)} />;
            }
            if (node && isTagNode(node)) {
              return isEditorPreview ? <PassiveTag {...rest} /> : <Tag {...spanProps} />;
            }
            return <span {...rest} />;
          }) as React.ComponentType<React.ComponentProps<"span">>,
          h1: ({ children, ...props }) => (
            <Heading level={1} {...props}>
              {children}
            </Heading>
          ),
          h2: ({ children, ...props }) => (
            <Heading level={2} {...props}>
              {children}
            </Heading>
          ),
          h3: ({ children, ...props }) => (
            <Heading level={3} {...props}>
              {children}
            </Heading>
          ),
          h4: ({ children, ...props }) => (
            <Heading level={4} {...props}>
              {children}
            </Heading>
          ),
          h5: ({ children, ...props }) => (
            <Heading level={5} {...props}>
              {children}
            </Heading>
          ),
          h6: ({ children, ...props }) => (
            <Heading level={6} {...props}>
              {children}
            </Heading>
          ),
          p: ({ children, ...props }) => <Paragraph {...props}>{children}</Paragraph>,
          blockquote: ({ children, ...props }) => <Blockquote {...props}>{children}</Blockquote>,
          hr: (props) => <HorizontalRule {...props} />,
          ul: ({ children, ...props }) => <List {...props}>{children}</List>,
          ol: ({ children, ...props }) => (
            <List ordered {...props}>
              {children}
            </List>
          ),
          li: ({ children, ...props }) => <ListItem {...props}>{children}</ListItem>,
          a: ({ children, ...props }) => <Link {...props}>{children}</Link>,
          code: ({ children, ...props }) => <InlineCode {...props}>{children}</InlineCode>,
          iframe: TrustedIframe as React.ComponentType<React.ComponentProps<"iframe">>,
          img: ({ ...props }) => <Image {...props} />,
          pre: CodeBlock,
          table: ({ children, ...props }) => <Table {...props}>{children}</Table>,
          thead: ({ children, ...props }) => <TableHead {...props}>{children}</TableHead>,
          tbody: ({ children, ...props }) => <TableBody {...props}>{children}</TableBody>,
          tr: ({ children, ...props }) => <TableRow {...props}>{children}</TableRow>,
          th: ({ children, ...props }) => <TableHeaderCell {...props}>{children}</TableHeaderCell>,
          td: ({ children, ...props }) => <TableCell {...props}>{children}</TableCell>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default MemoMarkdownRenderer;
