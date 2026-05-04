export const AMAP_RUNTIME_SETTINGS_STORAGE_KEY = "memos-amap-runtime-settings";

export interface AmapRuntimeSettings {
  apiKey: string;
  securityJsCode: string;
}

const envAmapApiKey = import.meta.env.VITE_AMAP_WEB_SERVICE_KEY || import.meta.env.VITE_AMAP_JS_API_KEY || "";
const envAmapSecurityJsCode = import.meta.env.VITE_AMAP_SECURITY_JS_CODE || "";

export const getDefaultAmapRuntimeSettings = (): AmapRuntimeSettings => ({
  apiKey: envAmapApiKey,
  securityJsCode: envAmapSecurityJsCode,
});

export const getStoredAmapRuntimeSettings = (): AmapRuntimeSettings => {
  if (typeof window === "undefined") {
    return { apiKey: "", securityJsCode: "" };
  }

  try {
    const raw = window.localStorage.getItem(AMAP_RUNTIME_SETTINGS_STORAGE_KEY);
    if (!raw) {
      return { apiKey: "", securityJsCode: "" };
    }

    const parsed = JSON.parse(raw) as Partial<AmapRuntimeSettings>;
    return {
      apiKey: typeof parsed.apiKey === "string" ? parsed.apiKey.trim() : "",
      securityJsCode: typeof parsed.securityJsCode === "string" ? parsed.securityJsCode.trim() : "",
    };
  } catch {
    return { apiKey: "", securityJsCode: "" };
  }
};

export const getAmapRuntimeSettings = (): AmapRuntimeSettings => {
  const stored = getStoredAmapRuntimeSettings();
  if (stored.apiKey) {
    return stored;
  }
  return getDefaultAmapRuntimeSettings();
};

export const saveAmapRuntimeSettings = (settings: AmapRuntimeSettings) => {
  window.localStorage.setItem(
    AMAP_RUNTIME_SETTINGS_STORAGE_KEY,
    JSON.stringify({
      apiKey: settings.apiKey.trim(),
      securityJsCode: settings.securityJsCode.trim(),
    }),
  );
};

export const applyAmapSecurityConfig = () => {
  const { securityJsCode } = getAmapRuntimeSettings();
  if (!securityJsCode || typeof window === "undefined") {
    return;
  }

  (window as Window & { _AMapSecurityConfig?: { securityJsCode: string } })._AMapSecurityConfig = {
    securityJsCode,
  };
};
