import { ExternalLinkIcon, InfoIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { getAmapRuntimeSettings, getStoredAmapRuntimeSettings, saveAmapRuntimeSettings } from "@/components/map/amap-settings";
import { testAmapConnection } from "@/components/map/map-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import SettingGroup from "./SettingGroup";
import SettingRow from "./SettingRow";
import SettingSection from "./SettingSection";

const AMAP_APPLY_URL = "https://console.amap.com/dev/key/app";
const AMAP_DOC_URL = "https://lbs.amap.com/api/javascript-api-v2/guide/abc/prepare";

const MapSection = () => {
  const initialSettings = useMemo(() => getStoredAmapRuntimeSettings(), []);
  const [apiKey, setApiKey] = useState(initialSettings.apiKey);
  const [securityJsCode, setSecurityJsCode] = useState(initialSettings.securityJsCode);
  const [isTesting, setIsTesting] = useState(false);

  const hasChanges = apiKey.trim() !== initialSettings.apiKey || securityJsCode.trim() !== initialSettings.securityJsCode;

  const handleSave = () => {
    saveAmapRuntimeSettings({ apiKey, securityJsCode });
    toast.success("高德地图设置已保存");
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
      const keyLabel = apiKey.trim() ? "地图 Key" : "默认地图 Key";
      toast.success(`${keyLabel} 可用（${keyType === "web-service" ? "Web 服务 API" : "Web 端 JS API"}）`);
    } catch (error) {
      toast.error(error instanceof Error ? `地图 Key 测试失败：${error.message}` : "地图 Key 测试失败");
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <SettingSection title="地图">
      <SettingGroup title="高德地图" description="用于附件位置搜索、逆地理编码、地图缩略图和个人资料地图。">
        <SettingRow label="地图 Key" description="留空时使用 Memos 自带的默认地图配置。" vertical>
          <Input
            className="w-full font-mono"
            value={apiKey}
            placeholder="可选：请输入高德 Web 服务 Key 或 Web 端 JS API Key"
            onChange={(event) => setApiKey(event.target.value)}
          />
        </SettingRow>

        <SettingRow label="高德安全密钥" description="也叫 securityJsCode；使用 Web 端 JS API Key 时通常需要填写。" vertical>
          <Input
            className="w-full font-mono"
            type="password"
            value={securityJsCode}
            placeholder="请输入高德安全密钥"
            onChange={(event) => setSecurityJsCode(event.target.value)}
          />
        </SettingRow>

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-[0.85rem] border border-border/60 bg-background/60 px-4 py-3">
          <span className="text-sm text-muted-foreground">{apiKey.trim() ? "当前将使用自定义地图 Key。" : "当前将使用默认地图。"}</span>
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
        <Button disabled={!hasChanges} onClick={handleSave}>
          保存
        </Button>
      </div>
    </SettingSection>
  );
};

export default MapSection;
