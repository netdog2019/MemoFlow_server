export const AMAP_RUNTIME_SETTINGS_STORAGE_KEY = "memos-amap-runtime-settings";
const AMAP_RUNTIME_SETTINGS_RESET_KEY = "memos-amap-runtime-settings-reset-20260504";

export interface AmapRuntimeSettings {
  apiKey: string;
  securityJsCode: string;
}

export const getDefaultAmapRuntimeSettings = (): AmapRuntimeSettings => ({
  apiKey: "",
  securityJsCode: "",
});

export const getStoredAmapRuntimeSettings = (): AmapRuntimeSettings => {
  if (typeof window === "undefined") {
    return { apiKey: "", securityJsCode: "" };
  }

  try {
    if (!window.localStorage.getItem(AMAP_RUNTIME_SETTINGS_RESET_KEY)) {
      window.localStorage.removeItem(AMAP_RUNTIME_SETTINGS_STORAGE_KEY);
      window.localStorage.setItem(AMAP_RUNTIME_SETTINGS_RESET_KEY, "1");
    }

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
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(
    AMAP_RUNTIME_SETTINGS_STORAGE_KEY,
    JSON.stringify({
      apiKey: settings.apiKey.trim(),
      securityJsCode: settings.securityJsCode.trim(),
    }),
  );
};

export const clearAmapRuntimeSettings = () => {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(AMAP_RUNTIME_SETTINGS_STORAGE_KEY);
};

export const syncAmapRuntimeSettings = (settings: AmapRuntimeSettings) => {
  const normalized = {
    apiKey: settings.apiKey.trim(),
    securityJsCode: settings.securityJsCode.trim(),
  };
  if (!normalized.apiKey && !normalized.securityJsCode) {
    clearAmapRuntimeSettings();
    return;
  }
  saveAmapRuntimeSettings(normalized);
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
