import { create } from "@bufbuild/protobuf";
import { isEqual } from "lodash-es";
import { MoreVerticalIcon, PlusIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import ConfirmDialog from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useInstance } from "@/contexts/InstanceContext";
import { handleError } from "@/lib/error";
import { cn } from "@/lib/utils";
import {
  InstanceSetting_AIProviderConfig,
  InstanceSetting_AIProviderConfigSchema,
  InstanceSetting_AIProviderType,
  InstanceSetting_AISettingSchema,
  InstanceSetting_Key,
  InstanceSettingSchema,
} from "@/types/proto/api/v1/instance_service_pb";
import { useTranslate } from "@/utils/i18n";
import SettingGroup from "./SettingGroup";
import SettingSection from "./SettingSection";
import SettingTable from "./SettingTable";

type LocalAIProvider = {
  id: string;
  title: string;
  type: InstanceSetting_AIProviderType;
  endpoint: string;
  apiKey: string;
  apiKeySet: boolean;
  apiKeyHint: string;
  model: string;
  transcriptionModel: string;
  systemPrompt: string;
  prompt: string;
  temperature: number;
  topP: number;
  maxTokens: number;
  timeoutSeconds: number;
  extraOptionsJson: string;
};

type ProviderPreset = {
  id: string;
  title: string;
  group: "official" | "compatible" | "self-hosted" | "custom";
  type: InstanceSetting_AIProviderType;
  endpoint: string;
  model: string;
  transcriptionModel: string;
  apiKeyPlaceholder: string;
  note: string;
};

const providerTypeOptions = [InstanceSetting_AIProviderType.OPENAI, InstanceSetting_AIProviderType.GEMINI];

const providerPresets: ProviderPreset[] = [
  {
    id: "openai",
    title: "OpenAI",
    group: "official",
    type: InstanceSetting_AIProviderType.OPENAI,
    endpoint: "https://api.openai.com/v1",
    model: "gpt-4.1-mini",
    transcriptionModel: "gpt-4o-transcribe",
    apiKeyPlaceholder: "sk-...",
    note: "官方 OpenAI API，音频转写使用 /audio/transcriptions。",
  },
  {
    id: "gemini",
    title: "Google Gemini",
    group: "official",
    type: InstanceSetting_AIProviderType.GEMINI,
    endpoint: "https://generativelanguage.googleapis.com/v1beta",
    model: "gemini-2.5-flash",
    transcriptionModel: "gemini-2.5-flash",
    apiKeyPlaceholder: "AIza...",
    note: "官方 Gemini API，音频转写由 Gemini generateContent 完成。",
  },
  {
    id: "deepseek",
    title: "DeepSeek",
    group: "compatible",
    type: InstanceSetting_AIProviderType.OPENAI,
    endpoint: "https://api.deepseek.com/v1",
    model: "deepseek-chat",
    transcriptionModel: "",
    apiKeyPlaceholder: "sk-...",
    note: "OpenAI 兼容接口；当前转写功能需要该 endpoint 支持 /audio/transcriptions。",
  },
  {
    id: "openrouter",
    title: "OpenRouter",
    group: "compatible",
    type: InstanceSetting_AIProviderType.OPENAI,
    endpoint: "https://openrouter.ai/api/v1",
    model: "openai/gpt-4.1-mini",
    transcriptionModel: "",
    apiKeyPlaceholder: "sk-or-...",
    note: "OpenAI 兼容聚合接口；不同模型能力取决于 OpenRouter 上游。",
  },
  {
    id: "siliconflow",
    title: "硅基流动 SiliconFlow",
    group: "compatible",
    type: InstanceSetting_AIProviderType.OPENAI,
    endpoint: "https://api.siliconflow.cn/v1",
    model: "Qwen/Qwen2.5-7B-Instruct",
    transcriptionModel: "",
    apiKeyPlaceholder: "sk-...",
    note: "OpenAI 兼容接口；模型名请按硅基流动控制台可用模型填写。",
  },
  {
    id: "dashscope",
    title: "阿里云 DashScope",
    group: "compatible",
    type: InstanceSetting_AIProviderType.OPENAI,
    endpoint: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    model: "qwen-plus",
    transcriptionModel: "",
    apiKeyPlaceholder: "sk-...",
    note: "DashScope OpenAI 兼容模式；模型和音频能力以阿里云控制台为准。",
  },
  {
    id: "moonshot",
    title: "Moonshot Kimi",
    group: "compatible",
    type: InstanceSetting_AIProviderType.OPENAI,
    endpoint: "https://api.moonshot.cn/v1",
    model: "moonshot-v1-8k",
    transcriptionModel: "",
    apiKeyPlaceholder: "sk-...",
    note: "OpenAI 兼容接口；适合 Kimi 文本模型。",
  },
  {
    id: "zhipu",
    title: "智谱 GLM",
    group: "compatible",
    type: InstanceSetting_AIProviderType.OPENAI,
    endpoint: "https://open.bigmodel.cn/api/paas/v4",
    model: "glm-4-flash",
    transcriptionModel: "",
    apiKeyPlaceholder: "",
    note: "OpenAI 兼容接口；模型名请按智谱开放平台填写。",
  },
  {
    id: "lmstudio",
    title: "LM Studio",
    group: "self-hosted",
    type: InstanceSetting_AIProviderType.OPENAI,
    endpoint: "http://localhost:1234/v1",
    model: "local-model",
    transcriptionModel: "",
    apiKeyPlaceholder: "lm-studio",
    note: "本地 OpenAI 兼容服务。若 Memos 运行在 Docker 中，localhost 指容器内部，通常要改成宿主机地址。",
  },
  {
    id: "ollama",
    title: "Ollama",
    group: "self-hosted",
    type: InstanceSetting_AIProviderType.OPENAI,
    endpoint: "http://localhost:11434/v1",
    model: "qwen2.5:7b",
    transcriptionModel: "",
    apiKeyPlaceholder: "ollama",
    note: "Ollama OpenAI 兼容接口。若 Memos 运行在 Docker 中，localhost 指容器内部，通常要改成宿主机地址。",
  },
  {
    id: "custom",
    title: "自定义",
    group: "custom",
    type: InstanceSetting_AIProviderType.OPENAI,
    endpoint: "",
    model: "",
    transcriptionModel: "",
    apiKeyPlaceholder: "",
    note: "手动填写 provider 类型、endpoint、模型和参数。",
  },
];

const byokNotes = ["setting.ai.byok-key-note", "setting.ai.byok-storage-note", "setting.ai.byok-model-note"] as const;

const createProviderID = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

const getProviderTypeLabel = (type: InstanceSetting_AIProviderType) => {
  return InstanceSetting_AIProviderType[type] ?? "UNKNOWN";
};

const toLocalProvider = (provider: InstanceSetting_AIProviderConfig): LocalAIProvider => ({
  id: provider.id,
  title: provider.title,
  type: provider.type,
  endpoint: provider.endpoint,
  apiKey: "",
  apiKeySet: provider.apiKeySet,
  apiKeyHint: provider.apiKeyHint,
  model: provider.model,
  transcriptionModel: provider.transcriptionModel,
  systemPrompt: provider.systemPrompt,
  prompt: provider.prompt,
  temperature: provider.temperature,
  topP: provider.topP,
  maxTokens: provider.maxTokens,
  timeoutSeconds: provider.timeoutSeconds,
  extraOptionsJson: provider.extraOptionsJson,
});

const newProvider = (): LocalAIProvider => ({
  id: createProviderID(),
  title: "",
  type: InstanceSetting_AIProviderType.OPENAI,
  endpoint: "",
  apiKey: "",
  apiKeySet: false,
  apiKeyHint: "",
  model: "",
  transcriptionModel: "",
  systemPrompt: "",
  prompt: "",
  temperature: 0,
  topP: 0,
  maxTokens: 0,
  timeoutSeconds: 0,
  extraOptionsJson: "",
});

const toProviderConfig = (provider: LocalAIProvider) =>
  create(InstanceSetting_AIProviderConfigSchema, {
    id: provider.id,
    title: provider.title.trim(),
    type: provider.type,
    endpoint: provider.endpoint.trim(),
    apiKey: provider.apiKey,
    model: provider.model.trim(),
    transcriptionModel: provider.transcriptionModel.trim(),
    systemPrompt: provider.systemPrompt.trim(),
    prompt: provider.prompt.trim(),
    temperature: provider.temperature,
    topP: provider.topP,
    maxTokens: provider.maxTokens,
    timeoutSeconds: provider.timeoutSeconds,
    extraOptionsJson: provider.extraOptionsJson.trim(),
  });

const AISection = () => {
  const t = useTranslate();
  const { aiSetting: originalSetting, updateSetting, fetchSetting } = useInstance();
  const [providers, setProviders] = useState<LocalAIProvider[]>(() => originalSetting.providers.map(toLocalProvider));
  const [editingProvider, setEditingProvider] = useState<LocalAIProvider | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<LocalAIProvider | undefined>();

  useEffect(() => {
    setProviders(originalSetting.providers.map(toLocalProvider));
  }, [originalSetting.providers]);

  const originalProviders = useMemo(() => originalSetting.providers.map(toLocalProvider), [originalSetting.providers]);
  const hasChanges = !isEqual(providers, originalProviders);

  const handleCreateProvider = () => {
    setEditingProvider(newProvider());
  };

  const handleEditProvider = (provider: LocalAIProvider) => {
    setEditingProvider({ ...provider, apiKey: "" });
  };

  const handleSaveProvider = (provider: LocalAIProvider) => {
    const title = provider.title.trim();
    const endpoint = provider.endpoint.trim();
    const model = provider.model.trim();
    const transcriptionModel = provider.transcriptionModel.trim();
    const systemPrompt = provider.systemPrompt.trim();
    const prompt = provider.prompt.trim();
    const extraOptionsJson = provider.extraOptionsJson.trim();

    if (!title) {
      toast.error(t("setting.ai.provider-title-required"));
      return;
    }
    if (!provider.apiKeySet && !provider.apiKey.trim()) {
      toast.error(t("setting.ai.api-key-required"));
      return;
    }

    const normalizedProvider = {
      ...provider,
      title,
      endpoint,
      model,
      transcriptionModel,
      systemPrompt,
      prompt,
      extraOptionsJson,
    };
    setProviders((prev) => {
      const exists = prev.some((item) => item.id === normalizedProvider.id);
      if (!exists) {
        return [...prev, normalizedProvider];
      }
      return prev.map((item) => (item.id === normalizedProvider.id ? normalizedProvider : item));
    });
    setEditingProvider(undefined);
  };

  const handleDeleteProvider = () => {
    if (!deleteTarget) return;
    setProviders((prev) => prev.filter((provider) => provider.id !== deleteTarget.id));
    setDeleteTarget(undefined);
  };

  const handleSaveSetting = async () => {
    try {
      await updateSetting(
        create(InstanceSettingSchema, {
          name: `instance/settings/${InstanceSetting_Key[InstanceSetting_Key.AI]}`,
          value: {
            case: "aiSetting",
            value: create(InstanceSetting_AISettingSchema, {
              providers: providers.map(toProviderConfig),
            }),
          },
        }),
      );
      await fetchSetting(InstanceSetting_Key.AI);
      toast.success(t("message.update-succeed"));
    } catch (error: unknown) {
      handleError(error, toast.error, {
        context: "Update AI providers",
      });
    }
  };

  return (
    <SettingSection
      title={t("setting.ai.label")}
      actions={
        <Button onClick={handleCreateProvider}>
          <PlusIcon className="w-4 h-4 mr-2" />
          {t("setting.ai.add-provider")}
        </Button>
      }
    >
      <section className="rounded-[0.85rem] border border-border bg-muted/30 px-4 py-3">
        <div className="flex max-w-3xl flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-[0.85rem] border border-border bg-background px-2 py-0.5 text-xs font-medium text-foreground">
              {t("setting.ai.byok-label")}
            </span>
            <h4 className="text-sm font-semibold text-foreground">{t("setting.ai.byok-title")}</h4>
          </div>
          <p className="text-sm text-muted-foreground">{t("setting.ai.byok-description")}</p>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {byokNotes.map((note) => (
              <li key={note} className="flex gap-2">
                <span className="mt-2 size-1 rounded-full bg-muted-foreground/60" aria-hidden />
                <span>{t(note)}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <SettingGroup title={t("setting.ai.providers")} description={t("setting.ai.description")}>
        <SettingTable
          columns={[
            {
              key: "title",
              header: t("common.name"),
              render: (_, provider: LocalAIProvider) => (
                <div className="flex flex-col gap-0.5">
                  <span className="text-foreground">{provider.title}</span>
                  <span className="font-mono text-xs text-muted-foreground">{provider.id}</span>
                </div>
              ),
            },
            {
              key: "type",
              header: t("setting.ai.provider-type"),
              render: (_, provider: LocalAIProvider) => <span>{getProviderTypeLabel(provider.type)}</span>,
            },
            {
              key: "endpoint",
              header: t("setting.ai.endpoint"),
              render: (_, provider: LocalAIProvider) => (
                <span className="font-mono text-xs">{provider.endpoint || t("setting.ai.default-endpoint")}</span>
              ),
            },
            {
              key: "model",
              header: "模型",
              render: (_, provider: LocalAIProvider) => (
                <div className="flex flex-col gap-0.5">
                  <span className="font-mono text-xs">{provider.model || "-"}</span>
                  {provider.transcriptionModel ? (
                    <span className="text-[11px] text-muted-foreground">转写：{provider.transcriptionModel}</span>
                  ) : null}
                </div>
              ),
            },
            {
              key: "apiKeySet",
              header: t("setting.ai.api-key"),
              render: (_, provider: LocalAIProvider) => (
                <span className="font-mono text-xs">{provider.apiKeySet ? provider.apiKeyHint || t("setting.ai.configured") : "-"}</span>
              ),
            },
            {
              key: "actions",
              header: "",
              className: "text-right",
              render: (_, provider: LocalAIProvider) => (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <MoreVerticalIcon className="w-4 h-auto" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" sideOffset={2}>
                    <DropdownMenuItem onClick={() => handleEditProvider(provider)}>{t("common.edit")}</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setDeleteTarget(provider)} className="text-destructive focus:text-destructive">
                      {t("common.delete")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ),
            },
          ]}
          data={providers}
          emptyMessage={t("setting.ai.no-providers")}
          getRowKey={(provider) => provider.id}
        />
      </SettingGroup>

      <div className="w-full flex justify-end">
        <Button disabled={!hasChanges} onClick={handleSaveSetting}>
          {t("common.save")}
        </Button>
      </div>

      <AIProviderDialog
        provider={editingProvider}
        onOpenChange={(open) => !open && setEditingProvider(undefined)}
        onSave={handleSaveProvider}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(undefined)}
        title={deleteTarget ? t("setting.ai.delete-provider", { title: deleteTarget.title }) : ""}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        onConfirm={handleDeleteProvider}
        confirmVariant="destructive"
      />
    </SettingSection>
  );
};

interface AIProviderDialogProps {
  provider?: LocalAIProvider;
  onOpenChange: (open: boolean) => void;
  onSave: (provider: LocalAIProvider) => void;
}

const AIProviderDialog = ({ provider, onOpenChange, onSave }: AIProviderDialogProps) => {
  const t = useTranslate();
  const [draft, setDraft] = useState<LocalAIProvider>(() => provider ?? newProvider());
  const [selectedPresetID, setSelectedPresetID] = useState("custom");

  useEffect(() => {
    const next = provider ?? newProvider();
    setDraft(next);
    setSelectedPresetID(matchPreset(next).id);
  }, [provider]);

  const updateDraft = (partial: Partial<LocalAIProvider>) => {
    setDraft((prev) => ({ ...prev, ...partial }));
  };

  const selectedPreset = providerPresets.find((preset) => preset.id === selectedPresetID) ?? providerPresets[providerPresets.length - 1];
  const apiKeyPlaceholder = draft.apiKeySet ? t("setting.ai.keep-api-key") : selectedPreset.apiKeyPlaceholder;

  const handlePresetChange = (presetID: string) => {
    const preset = providerPresets.find((item) => item.id === presetID);
    if (!preset) {
      return;
    }

    setSelectedPresetID(preset.id);
    if (preset.id === "custom") {
      return;
    }
    updateDraft({
      title: preset.title,
      type: preset.type,
      endpoint: preset.endpoint,
      model: preset.model,
      transcriptionModel: preset.transcriptionModel,
    });
  };

  const handleSave = () => {
    onSave(draft);
  };

  return (
    <Dialog open={!!provider} onOpenChange={onOpenChange}>
      <DialogContent size="2xl" bodyClassName="gap-5">
        <DialogHeader>
          <DialogTitle>{provider?.apiKeySet ? t("setting.ai.edit-provider") : t("setting.ai.add-provider")}</DialogTitle>
          <DialogDescription>{t("setting.ai.dialog-description")}</DialogDescription>
        </DialogHeader>

        <section className="rounded-xl border border-border/70 bg-muted/24 p-3">
          <div className="flex flex-col gap-1.5">
            <Label>Provider 预设</Label>
            <Select value={selectedPresetID} onValueChange={handlePresetChange}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {providerPresets.map((preset) => (
                  <SelectItem key={preset.id} value={preset.id}>
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate">{preset.title}</span>
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-0.5 text-[10px]",
                          preset.group === "official" && "bg-primary/10 text-primary",
                          preset.group === "compatible" && "bg-amber-500/12 text-amber-700 dark:text-amber-300",
                          preset.group === "self-hosted" && "bg-sky-500/12 text-sky-700 dark:text-sky-300",
                          preset.group === "custom" && "bg-muted text-muted-foreground",
                        )}
                      >
                        {getPresetGroupLabel(preset.group)}
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs leading-5 text-muted-foreground">{selectedPreset.note}</p>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label>{t("setting.ai.provider-title")}</Label>
            <Input value={draft.title} onChange={(e) => updateDraft({ title: e.target.value })} placeholder="OpenAI" />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>{t("setting.ai.provider-type")}</Label>
            <Select
              value={String(draft.type)}
              onValueChange={(value) => updateDraft({ type: Number(value) as InstanceSetting_AIProviderType })}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {providerTypeOptions.map((type) => (
                  <SelectItem key={type} value={String(type)}>
                    {getProviderTypeLabel(type)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label>{t("setting.ai.endpoint")}</Label>
            <Input
              value={draft.endpoint}
              onChange={(e) => updateDraft({ endpoint: e.target.value })}
              placeholder={getDefaultEndpointPlaceholder(draft.type)}
            />
            <p className="text-xs text-muted-foreground">{t("setting.ai.endpoint-hint")}</p>
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label>{t("setting.ai.api-key")}</Label>
            <Input
              type="password"
              value={draft.apiKey}
              onChange={(e) => updateDraft({ apiKey: e.target.value })}
              placeholder={apiKeyPlaceholder}
            />
            {draft.apiKeySet && (
              <p className="text-xs text-muted-foreground">{t("setting.ai.current-key", { key: draft.apiKeyHint || "-" })}</p>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-border/70 bg-card/45 p-3">
          <div className="mb-3">
            <h4 className="text-sm font-semibold text-foreground">高级参数和 Prompt</h4>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              模型、转写模型和默认 prompt 会保存到 provider 中；当前音频转写会优先使用转写模型和默认 prompt。其他生成参数供 AI
              洞察/摘要等后续功能读取。
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label>默认模型</Label>
              <Input
                value={draft.model}
                onChange={(e) => updateDraft({ model: e.target.value })}
                placeholder={selectedPreset.model || "gpt-4.1-mini"}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>转写模型</Label>
              <Input
                value={draft.transcriptionModel}
                onChange={(e) => updateDraft({ transcriptionModel: e.target.value })}
                placeholder={selectedPreset.transcriptionModel || "留空使用内置默认模型"}
              />
            </div>
            <NumberField
              label="Temperature"
              value={draft.temperature}
              min={0}
              max={2}
              step={0.1}
              placeholder="0"
              onChange={(temperature) => updateDraft({ temperature })}
            />
            <NumberField
              label="Top P"
              value={draft.topP}
              min={0}
              max={1}
              step={0.05}
              placeholder="0"
              onChange={(topP) => updateDraft({ topP })}
            />
            <NumberField
              label="Max tokens"
              value={draft.maxTokens}
              min={0}
              step={1}
              placeholder="0 表示不限制"
              onChange={(maxTokens) => updateDraft({ maxTokens })}
            />
            <NumberField
              label="Timeout seconds"
              value={draft.timeoutSeconds}
              min={0}
              step={1}
              placeholder="0 表示使用默认超时"
              onChange={(timeoutSeconds) => updateDraft({ timeoutSeconds })}
            />
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label>System prompt</Label>
              <Textarea
                rows={3}
                value={draft.systemPrompt}
                onChange={(e) => updateDraft({ systemPrompt: e.target.value })}
                placeholder="例如：你是一个严谨的个人知识管理助手。"
                className="min-h-20 rounded-xl px-3 py-2 text-sm"
              />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label>默认 prompt / 转写提示词</Label>
              <Textarea
                rows={3}
                value={draft.prompt}
                onChange={(e) => updateDraft({ prompt: e.target.value })}
                placeholder="例如：优先保留人名、项目名和专业术语。"
                className="min-h-20 rounded-xl px-3 py-2 text-sm"
              />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label>额外参数 JSON</Label>
              <Textarea
                rows={3}
                value={draft.extraOptionsJson}
                onChange={(e) => updateDraft({ extraOptionsJson: e.target.value })}
                placeholder='{"response_format":"json_object"}'
                className="min-h-20 rounded-xl px-3 py-2 font-mono text-xs"
              />
            </div>
          </div>
        </section>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleSave}>{t("common.save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const getDefaultEndpointPlaceholder = (type: InstanceSetting_AIProviderType) => {
  switch (type) {
    case InstanceSetting_AIProviderType.OPENAI:
      return "https://api.openai.com/v1";
    case InstanceSetting_AIProviderType.GEMINI:
      return "https://generativelanguage.googleapis.com/v1beta";
    default:
      return "";
  }
};

const matchPreset = (provider: LocalAIProvider): ProviderPreset => {
  const endpoint = provider.endpoint.trim().replace(/\/+$/, "");
  return (
    providerPresets.find(
      (preset) => preset.id !== "custom" && preset.type === provider.type && preset.endpoint.replace(/\/+$/, "") === endpoint,
    ) ?? providerPresets[providerPresets.length - 1]
  );
};

const getPresetGroupLabel = (group: ProviderPreset["group"]) => {
  switch (group) {
    case "official":
      return "官方";
    case "compatible":
      return "兼容";
    case "self-hosted":
      return "自建";
    case "custom":
      return "自定义";
    default:
      return "";
  }
};

const parseNumberInput = (value: string, min = 0, max?: number) => {
  if (value.trim() === "") {
    return 0;
  }
  const next = Number(value);
  if (!Number.isFinite(next)) {
    return 0;
  }
  return Math.min(Math.max(next, min), max ?? next);
};

const NumberField = ({
  label,
  value,
  min = 0,
  max,
  step,
  placeholder,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step: number;
  placeholder: string;
  onChange: (value: number) => void;
}) => (
  <div className="flex flex-col gap-1.5">
    <Label>{label}</Label>
    <Input
      type="number"
      min={min}
      max={max}
      step={step}
      value={value || ""}
      onChange={(event) => onChange(parseNumberInput(event.target.value, min, max))}
      placeholder={placeholder}
    />
  </div>
);

export default AISection;
