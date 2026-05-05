import { create } from "@bufbuild/protobuf";
import { ExternalLinkIcon, InfoIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { getAmapRuntimeSettings, getStoredAmapRuntimeSettings, syncAmapRuntimeSettings } from "@/components/map/amap-settings";
import { testAmapConnection } from "@/components/map/map-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useInstance } from "@/contexts/InstanceContext";
import { InstanceSetting_Key, InstanceSetting_MapSettingSchema, InstanceSettingSchema } from "@/types/proto/api/v1/instance_service_pb";
import SettingGroup from "./SettingGroup";
import SettingRow from "./SettingRow";
import SettingSection from "./SettingSection";

const AMAP_APPLY_URL = "https://console.amap.com/dev/key/app";
const AMAP_DOC_URL = "https://lbs.amap.com/api/javascript-api-v2/guide/abc/prepare";

const MapSection = () => {
  const { mapSetting, updateSetting, fetchSetting } = useInstance();
  const fallbackSettings = useMemo(() => getStoredAmapRuntimeSettings(), []);
  const savedApiKey = mapSetting.amapApiKey || fallbackSettings.apiKey;
  const savedSecurityJsCode = mapSetting.amapSecurityJsCode || fallbackSettings.securityJsCode;
  const persistedApiKey = mapSetting.amapApiKey || "";
  const persistedSecurityJsCode = mapSetting.amapSecurityJsCode || "";
  const [apiKey, setApiKey] = useState(savedApiKey);
  const [securityJsCode, setSecurityJsCode] = useState(savedSecurityJsCode);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    void fetchSetting(InstanceSetting_Key.MAP).catch(() => undefined);
  }, [fetchSetting]);

  useEffect(() => {
    setApiKey(savedApiKey);
    setSecurityJsCode(savedSecurityJsCode);
  }, [savedApiKey, savedSecurityJsCode]);

  const hasChanges = apiKey.trim() !== persistedApiKey || securityJsCode.trim() !== persistedSecurityJsCode;

  const handleSave = async () => {
    const nextSettings = {
      apiKey: apiKey.trim(),
      securityJsCode: securityJsCode.trim(),
    };
    try {
      setIsSaving(true);
      await updateSetting(
        create(InstanceSettingSchema, {
          name: `instance/settings/${InstanceSetting_Key[InstanceSetting_Key.MAP]}`,
          value: {
            case: "mapSetting",
            value: create(InstanceSetting_MapSettingSchema, {
              amapApiKey: nextSettings.apiKey,
              amapSecurityJsCode: nextSettings.securityJsCode,
            }),
          },
        }),
      );
      await fetchSetting(InstanceSetting_Key.MAP);
      syncAmapRuntimeSettings(nextSettings);
      toast.success("高德地图设置已保存到服务器");
    } catch (error) {
      toast.error(error instanceof Error ? `高德地图设置保存失败：${error.message}` : "高德地图设置保存失败");
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    const testingKey = apiKey.trim() || getAmapRuntimeSettings().apiKey;
    if (!testingKey) {
      toast.error("没有可测试的地图 Key");
      return;
    }

    try {
      setIsTesting(true);
      const keyType = await testAmapConnection(testingKey);
      toast.success(`地图 Key 可用（${keyType === "web-service" ? "Web 服务 API" : "Web 端 JS API"}）`);
    } catch (error) {
      toast.error(error instanceof Error ? `地图 Key 测试失败：${error.message}` : "地图 Key 测试失败");
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <SettingSection title="地图">
      <SettingGroup title="高德地图" description="用于附件位置搜索、逆地理编码、地图缩略图和个人资料地图。">
        <SettingRow label="地图 Key" description="保存到服务器实例设置；同一服务下其他设备登录后会自动使用。" vertical>
          <Input
            className="w-full font-mono"
            value={apiKey}
            placeholder="请输入高德 Web 服务 Key 或 Web 端 JS API Key"
            onChange={(event) => setApiKey(event.target.value)}
          />
        </SettingRow>

        <SettingRow label="高德安全密钥" description="也叫 securityJsCode；会保存到服务器，并同步给浏览器地图运行时。" vertical>
          <Input
            className="w-full font-mono"
            type="password"
            value={securityJsCode}
            placeholder="请输入高德安全密钥"
            onChange={(event) => setSecurityJsCode(event.target.value)}
          />
        </SettingRow>

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-[0.85rem] border border-border/60 bg-background/60 px-4 py-3">
          <span className="text-sm text-muted-foreground">
            {apiKey.trim() ? "当前将使用服务器保存的地图 Key。" : "当前未设置地图 Key。"}
          </span>
          <Button variant="outline" size="sm" onClick={handleTestConnection} disabled={isTesting}>
            {isTesting ? "测试中..." : "测试连接"}
          </Button>
        </div>

        <div className="rounded-[0.85rem] border border-border/60 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          <div className="mb-2 flex items-center gap-2 font-medium text-foreground">
            <InfoIcon className="size-4" />
            申请建议
          </div>
          <ol className="list-decimal space-y-1 pl-5 leading-6">
            <li>登录高德开放平台控制台，创建应用并添加 Key。</li>
            <li>推荐优先申请 Web 服务 API Key，地址搜索和逆地理编码会直接使用它。</li>
            <li>如果申请的是 Web 端 JS API Key，请同步填写安全密钥 securityJsCode。</li>
            <li>发布到公网时，在高德控制台按域名或来源限制 Key，避免被其他站点滥用。</li>
          </ol>
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              className="inline-flex items-center gap-1.5 text-primary hover:underline"
              href={AMAP_APPLY_URL}
              target="_blank"
              rel="noreferrer"
            >
              申请 Key
              <ExternalLinkIcon className="size-3.5" />
            </a>
            <a
              className="inline-flex items-center gap-1.5 text-primary hover:underline"
              href={AMAP_DOC_URL}
              target="_blank"
              rel="noreferrer"
            >
              查看官方准备说明
              <ExternalLinkIcon className="size-3.5" />
            </a>
          </div>
        </div>
      </SettingGroup>

      <div className="w-full flex justify-end">
        <Button disabled={!hasChanges || isSaving} onClick={handleSave}>
          {isSaving ? "保存中..." : "保存"}
        </Button>
      </div>
    </SettingSection>
  );
};

export default MapSection;
