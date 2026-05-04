import { create } from "@bufbuild/protobuf";
import { FieldMaskSchema } from "@bufbuild/protobuf/wkt";
import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { shortcutServiceClient } from "@/connect";
import { useAuth } from "@/contexts/AuthContext";
import useCurrentUser from "@/hooks/useCurrentUser";
import useLoading from "@/hooks/useLoading";
import { useTagCounts } from "@/hooks/useUserQueries";
import { handleError } from "@/lib/error";
import { Shortcut, ShortcutSchema } from "@/types/proto/api/v1/shortcut_service_pb";
import { useTranslate } from "@/utils/i18n";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shortcut?: Shortcut;
  onSuccess?: () => void;
}

type ShortcutConditionKind =
  | "content"
  | "tagTree"
  | "tagExact"
  | "tagStartsWith"
  | "visibility"
  | "createdRecent"
  | "updatedRecent"
  | "createdAfter"
  | "createdBefore"
  | "updatedAfter"
  | "updatedBefore"
  | "pinned"
  | "hasTaskList"
  | "hasIncompleteTasks"
  | "hasLink"
  | "hasCode";

interface ShortcutCondition {
  id: string;
  kind: ShortcutConditionKind;
  value: string;
  negate: boolean;
}

const shortcutConditionOptions: Array<{ value: ShortcutConditionKind; label: string; placeholder?: string }> = [
  { value: "content", label: "内容包含", placeholder: "关键词" },
  { value: "tagTree", label: "包含标签", placeholder: "工作" },
  { value: "tagExact", label: "精确标签", placeholder: "项目/后端" },
  { value: "tagStartsWith", label: "标签前缀", placeholder: "项目" },
  { value: "visibility", label: "可见性" },
  { value: "createdRecent", label: "最近 N 天创建", placeholder: "7" },
  { value: "updatedRecent", label: "最近 N 小时更新", placeholder: "24" },
  { value: "createdAfter", label: "创建日期起" },
  { value: "createdBefore", label: "创建日期止" },
  { value: "updatedAfter", label: "更新日期起" },
  { value: "updatedBefore", label: "更新日期止" },
  { value: "pinned", label: "置顶" },
  { value: "hasTaskList", label: "有清单" },
  { value: "hasIncompleteTasks", label: "有未完成清单" },
  { value: "hasLink", label: "有链接" },
  { value: "hasCode", label: "有代码" },
];

const shortcutExamples = [
  { title: "最近 7 天", filter: "created_ts >= now() - 7 * 86400" },
  { title: "未完成清单", filter: "has_incomplete_tasks" },
  { title: "置顶资料", filter: "pinned && has_link" },
  { title: "公开内容", filter: 'visibility == "PUBLIC"' },
  { title: "项目标签", filter: 'tags.exists(t, t.startsWith("项目"))' },
];

const booleanConditionKinds = new Set<ShortcutConditionKind>(["pinned", "hasTaskList", "hasIncompleteTasks", "hasLink", "hasCode"]);
const tagConditionKinds = new Set<ShortcutConditionKind>(["tagTree", "tagExact", "tagStartsWith"]);
const dateConditionKinds = new Set<ShortcutConditionKind>(["createdAfter", "createdBefore", "updatedAfter", "updatedBefore"]);
const numberConditionKinds = new Set<ShortcutConditionKind>(["createdRecent", "updatedRecent"]);

const createEmptyCondition = (): ShortcutCondition => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  kind: "tagTree",
  value: "",
  negate: false,
});

const escapeCELString = (value: string): string => JSON.stringify(value);

const getConditionPlaceholder = (kind: ShortcutConditionKind) =>
  shortcutConditionOptions.find((option) => option.value === kind)?.placeholder ?? "";

const getDefaultConditionValue = (kind: ShortcutConditionKind): string => {
  if (kind === "visibility") return "PUBLIC";
  return "";
};

const dateInputToEpochSeconds = (value: string): number | undefined => {
  const matched = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
  if (!matched) return undefined;
  const [, year, month, day] = matched;
  const timestamp = new Date(Number(year), Number(month) - 1, Number(day), 0, 0, 0, 0).getTime();
  if (!Number.isFinite(timestamp)) return undefined;
  return Math.floor(timestamp / 1000);
};

const openDatePicker = (event: React.MouseEvent<HTMLInputElement> | React.FocusEvent<HTMLInputElement>) => {
  const input = event.currentTarget;
  try {
    input.showPicker?.();
  } catch {
    // Some browsers only allow showPicker from direct user activation.
  }
};

const conditionToExpression = (condition: ShortcutCondition): string | undefined => {
  const value = condition.value.trim();
  let expression = "";

  switch (condition.kind) {
    case "content":
      if (!value) return undefined;
      expression = `content.contains(${escapeCELString(value)})`;
      break;
    case "tagTree":
      if (!value) return undefined;
      expression = `tag in [${escapeCELString(value.replace(/^#+/u, ""))}]`;
      break;
    case "tagExact":
      if (!value) return undefined;
      expression = `${escapeCELString(value.replace(/^#+/u, ""))} in tags`;
      break;
    case "tagStartsWith":
      if (!value) return undefined;
      expression = `tags.exists(t, t.startsWith(${escapeCELString(value.replace(/^#+/u, ""))}))`;
      break;
    case "visibility":
      if (!value) return undefined;
      expression = `visibility == ${escapeCELString(value)}`;
      break;
    case "createdRecent": {
      const days = Number(value);
      if (!Number.isFinite(days) || days <= 0) return undefined;
      expression = `created_ts >= now() - ${Math.round(days)} * 86400`;
      break;
    }
    case "updatedRecent": {
      const hours = Number(value);
      if (!Number.isFinite(hours) || hours <= 0) return undefined;
      expression = `updated_ts >= now() - ${Math.round(hours)} * 3600`;
      break;
    }
    case "createdAfter": {
      const epochSeconds = dateInputToEpochSeconds(value);
      if (!epochSeconds) return undefined;
      expression = `created_ts >= ${epochSeconds}`;
      break;
    }
    case "createdBefore": {
      const epochSeconds = dateInputToEpochSeconds(value);
      if (!epochSeconds) return undefined;
      expression = `created_ts < ${epochSeconds + 86400}`;
      break;
    }
    case "updatedAfter": {
      const epochSeconds = dateInputToEpochSeconds(value);
      if (!epochSeconds) return undefined;
      expression = `updated_ts >= ${epochSeconds}`;
      break;
    }
    case "updatedBefore": {
      const epochSeconds = dateInputToEpochSeconds(value);
      if (!epochSeconds) return undefined;
      expression = `updated_ts < ${epochSeconds + 86400}`;
      break;
    }
    case "pinned":
      expression = "pinned";
      break;
    case "hasTaskList":
      expression = "has_task_list";
      break;
    case "hasIncompleteTasks":
      expression = "has_incomplete_tasks";
      break;
    case "hasLink":
      expression = "has_link";
      break;
    case "hasCode":
      expression = "has_code";
      break;
  }

  return condition.negate ? `!(${expression})` : expression;
};

const buildShortcutFilterExpression = (conditions: ShortcutCondition[], logic: "and" | "or") => {
  const expressions = conditions.flatMap((condition) => conditionToExpression(condition) ?? []);
  return expressions.join(logic === "or" ? " || " : " && ");
};

function CreateShortcutDialog({ open, onOpenChange, shortcut: initialShortcut, onSuccess }: Props) {
  const t = useTranslate();
  const user = useCurrentUser();
  const { refetchSettings } = useAuth();
  const { data: tagCount = {} } = useTagCounts(true);
  const [shortcut, setShortcut] = useState<Shortcut>(
    create(ShortcutSchema, {
      name: initialShortcut?.name || "",
      title: initialShortcut?.title || "",
      filter: initialShortcut?.filter || "",
    }),
  );
  const [conditions, setConditions] = useState<ShortcutCondition[]>([createEmptyCondition()]);
  const [conditionLogic, setConditionLogic] = useState<"and" | "or">("and");
  const requestState = useLoading(false);
  const isCreating = shortcut.name === "";
  const tagOptions = useMemo(
    () =>
      Object.entries(tagCount)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .sort((a, b) => b[1] - a[1]),
    [tagCount],
  );

  useEffect(() => {
    setShortcut(
      create(ShortcutSchema, {
        name: initialShortcut?.name || "",
        title: initialShortcut?.title || "",
        filter: initialShortcut?.filter || "",
      }),
    );
    setConditions([createEmptyCondition()]);
    setConditionLogic("and");
  }, [initialShortcut]);

  const onShortcutTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPartialState({
      title: e.target.value,
    });
  };

  const onShortcutFilterChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPartialState({
      filter: e.target.value,
    });
  };

  const setPartialState = (partialState: Partial<Shortcut>) => {
    setShortcut({
      ...shortcut,
      ...partialState,
    });
  };

  const updateCondition = (id: string, partial: Partial<ShortcutCondition>) => {
    setConditions((current) => current.map((condition) => (condition.id === id ? { ...condition, ...partial } : condition)));
  };

  const applyConditionBuilder = () => {
    const expression = buildShortcutFilterExpression(conditions, conditionLogic);
    if (!expression) {
      toast.error("请至少填写一个有效条件");
      return;
    }
    setPartialState({ filter: expression });
  };

  const handleExampleClick = (example: (typeof shortcutExamples)[number]) => {
    setPartialState({ title: shortcut.title || example.title, filter: example.filter });
  };

  const handleSaveBtnClick = async () => {
    if (!shortcut.title || !shortcut.filter) {
      toast.error("Title and filter cannot be empty");
      return;
    }

    try {
      requestState.setLoading();
      if (isCreating) {
        await shortcutServiceClient.createShortcut({
          parent: user?.name,
          shortcut: {
            name: "",
            title: shortcut.title,
            filter: shortcut.filter,
          },
        });
        toast.success("Create shortcut successfully");
      } else {
        await shortcutServiceClient.updateShortcut({
          shortcut: {
            ...shortcut,
            name: initialShortcut!.name,
          },
          updateMask: create(FieldMaskSchema, { paths: ["title", "filter"] }),
        });
        toast.success("Update shortcut successfully");
      }
      await refetchSettings();
      requestState.setFinish();
      onSuccess?.();
      onOpenChange(false);
    } catch (error: unknown) {
      await handleError(error, toast.error, {
        context: isCreating ? "Create shortcut" : "Update shortcut",
        onError: () => requestState.setError(),
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{`${isCreating ? t("common.create") : t("common.edit")} ${t("common.shortcuts")}`}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="grid gap-2">
            <Label htmlFor="title">{t("common.title")}</Label>
            <Input id="title" type="text" placeholder="" value={shortcut.title} onChange={onShortcutTitleChange} />
          </div>
          <div className="grid gap-3 rounded-[0.85rem] border border-border/60 bg-background/55 p-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <Label>条件选择</Label>
                <p className="mt-1 text-xs text-muted-foreground">根据官方捷径文档生成 CEL 过滤表达式。</p>
              </div>
              <Select value={conditionLogic} onValueChange={(value) => setConditionLogic(value === "or" ? "or" : "and")}>
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="and">AND</SelectItem>
                  <SelectItem value="or">OR</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              {conditions.map((condition) => {
                const needsValue = !booleanConditionKinds.has(condition.kind);
                const isDateCondition = dateConditionKinds.has(condition.kind);
                const isNumberCondition = numberConditionKinds.has(condition.kind);
                return (
                  <div key={condition.id} className="grid grid-cols-[1fr_1fr_auto_auto] items-center gap-2 max-sm:grid-cols-1">
                    <Select
                      value={condition.kind}
                      onValueChange={(value) =>
                        updateCondition(condition.id, {
                          kind: value as ShortcutConditionKind,
                          value: getDefaultConditionValue(value as ShortcutConditionKind),
                          negate: false,
                        })
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {shortcutConditionOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {condition.kind === "visibility" ? (
                      <Select value={condition.value || "PUBLIC"} onValueChange={(value) => updateCondition(condition.id, { value })}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PRIVATE">PRIVATE</SelectItem>
                          <SelectItem value="PROTECTED">PROTECTED</SelectItem>
                          <SelectItem value="PUBLIC">PUBLIC</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : tagConditionKinds.has(condition.kind) ? (
                      <Select
                        value={condition.value}
                        onValueChange={(value) => updateCondition(condition.id, { value })}
                        disabled={tagOptions.length === 0}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder={tagOptions.length > 0 ? "选择标签" : "暂无标签"} />
                        </SelectTrigger>
                        <SelectContent>
                          {tagOptions.map(([tag, amount]) => (
                            <SelectItem key={tag} value={tag}>
                              #{tag}
                              {amount > 1 ? ` (${amount})` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        type={isDateCondition ? "date" : isNumberCondition ? "number" : "text"}
                        className="w-full"
                        min={isNumberCondition ? 1 : undefined}
                        step={isNumberCondition ? 1 : undefined}
                        disabled={!needsValue}
                        value={needsValue ? condition.value : ""}
                        placeholder={needsValue ? getConditionPlaceholder(condition.kind) : "无需填写"}
                        onClick={isDateCondition ? openDatePicker : undefined}
                        onFocus={isDateCondition ? openDatePicker : undefined}
                        onChange={(event) => updateCondition(condition.id, { value: event.target.value })}
                      />
                    )}
                    <Button
                      type="button"
                      variant={condition.negate ? "default" : "outline"}
                      size="sm"
                      onClick={() => updateCondition(condition.id, { negate: !condition.negate })}
                    >
                      排除
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setConditions((current) => current.filter((item) => item.id !== condition.id))}
                      disabled={conditions.length === 1}
                    >
                      删除
                    </Button>
                  </div>
                );
              })}
            </div>
            <div className="flex flex-wrap justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setConditions((current) => [...current, createEmptyCondition()])}
              >
                添加条件
              </Button>
              <Button type="button" size="sm" onClick={applyConditionBuilder}>
                生成过滤表达式
              </Button>
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="filter">高级过滤表达式</Label>
            <Textarea
              id="filter"
              rows={3}
              placeholder={t("common.shortcut-filter")}
              value={shortcut.filter}
              onChange={onShortcutFilterChange}
            />
          </div>
          <div className="grid gap-2">
            <Label>示例捷径</Label>
            <div className="flex flex-wrap gap-2">
              {shortcutExamples.map((example) => (
                <button
                  key={example.title}
                  type="button"
                  className="rounded-full border border-border/70 px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
                  onClick={() => handleExampleClick(example)}
                  title={example.filter}
                >
                  {example.title}
                </button>
              ))}
            </div>
          </div>
          <div className="text-sm text-muted-foreground">
            <p className="mb-2">{t("common.learn-more")}:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>
                <a
                  className="text-primary hover:underline"
                  href="https://www.usememos.com/docs/usage/shortcuts"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Docs - Shortcuts
                </a>
              </li>
            </ul>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" disabled={requestState.isLoading} onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button disabled={requestState.isLoading} onClick={handleSaveBtnClick}>
            {t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CreateShortcutDialog;
