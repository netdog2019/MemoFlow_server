import L, { DivIcon, type LatLngExpression } from "leaflet";
import { MapPinIcon } from "lucide-react";
import { useEffect, useRef } from "react";
import ReactDOMServer from "react-dom/server";
import { useMap } from "react-leaflet";
import { applyAmapSecurityConfig, getAmapRuntimeSettings } from "./amap-settings";

const AMAP_DETAIL_TILE_URL = "https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}";
const AMAP_LABEL_TILE_URL = "https://wprd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scl=1&style=8&ltype=11&x={x}&y={y}&z={z}";
const AMAP_SUBDOMAINS = ["1", "2", "3", "4"];
const AMAP_MAX_ZOOM = 18;
const TILE_RETRY_DELAY_MS = 700;
const mapTileLayers = new WeakMap<L.Map, L.TileLayer[]>();
let amapJsApiPromise: Promise<AmapJsApi> | undefined;

export const redrawAmapTileLayer = (map: L.Map) => {
  mapTileLayers.get(map)?.forEach((tileLayer) => tileLayer.redraw());
};

export const ThemedTileLayer = () => {
  const map = useMap();
  const tileLayerRef = useRef<L.TileLayer | undefined>(undefined);
  const retryTimerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    let animationFrame = 0;
    const detailTileLayer = L.tileLayer(AMAP_DETAIL_TILE_URL, {
      attribution: "高德地图",
      className: "amap-raster-tile-layer",
      crossOrigin: "anonymous",
      detectRetina: false,
      keepBuffer: 3,
      maxNativeZoom: AMAP_MAX_ZOOM,
      maxZoom: AMAP_MAX_ZOOM,
      minZoom: 0,
      subdomains: AMAP_SUBDOMAINS,
      updateInterval: 100,
      updateWhenIdle: false,
      updateWhenZooming: true,
      zIndex: 1,
    });
    const labelTileLayer = L.tileLayer(AMAP_LABEL_TILE_URL, {
      attribution: "高德地图",
      className: "amap-raster-label-layer",
      crossOrigin: "anonymous",
      detectRetina: false,
      keepBuffer: 3,
      maxNativeZoom: AMAP_MAX_ZOOM,
      maxZoom: AMAP_MAX_ZOOM,
      minZoom: 0,
      pane: "tilePane",
      subdomains: AMAP_SUBDOMAINS,
      updateInterval: 100,
      updateWhenIdle: false,
      updateWhenZooming: true,
      zIndex: 2,
    });
    const tileLayers = [detailTileLayer, labelTileLayer];

    const scheduleRetry = () => {
      if (retryTimerRef.current !== undefined) {
        window.clearTimeout(retryTimerRef.current);
      }
      retryTimerRef.current = window.setTimeout(() => {
        tileLayers.forEach((tileLayer) => tileLayer.redraw());
      }, TILE_RETRY_DELAY_MS);
    };

    const clearRetry = () => {
      if (retryTimerRef.current !== undefined) {
        window.clearTimeout(retryTimerRef.current);
      }
    };

    tileLayers.forEach((tileLayer) => {
      tileLayer.on("tileerror", scheduleRetry);
      tileLayer.on("load", clearRetry);
      tileLayer.addTo(map);
    });
    tileLayerRef.current = detailTileLayer;
    mapTileLayers.set(map, tileLayers);

    animationFrame = window.requestAnimationFrame(() => {
      map.invalidateSize({ pan: false });
      tileLayers.forEach((tileLayer) => tileLayer.redraw());
    });

    return () => {
      window.cancelAnimationFrame(animationFrame);
      if (retryTimerRef.current !== undefined) {
        window.clearTimeout(retryTimerRef.current);
      }
      tileLayers.forEach((tileLayer) => {
        tileLayer.off("tileerror", scheduleRetry);
        tileLayer.off("load", clearRetry);
        tileLayer.removeFrom(map);
      });
      tileLayerRef.current = undefined;
      mapTileLayers.delete(map);
    };
  }, [map]);

  return null;
};

export const getAmapOpenUrl = (lat: number, lng: number, label = "位置"): string => {
  const encodedLabel = encodeURIComponent(label);
  return `https://uri.amap.com/marker?position=${lng},${lat}&name=${encodedLabel}&src=memos&coordinate=wgs84&callnative=0`;
};

export const AmapTileMapResizer = ({ center, zoom, onReady }: { center?: LatLngExpression; zoom?: number; onReady?: () => void }) => {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    let animationFrame = 0;
    let lastWidth = 0;
    let lastHeight = 0;
    const refreshMapSize = () => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(() => {
        const { width, height } = container.getBoundingClientRect();
        if (width <= 0 || height <= 0) {
          return;
        }

        map.invalidateSize({ pan: false });
        if (width !== lastWidth || height !== lastHeight) {
          redrawAmapTileLayer(map);
          lastWidth = width;
          lastHeight = height;
        }
        onReady?.();
      });
    };
    const timeouts = [0, 80, 180, 360, 700].map((delay) => window.setTimeout(refreshMapSize, delay));
    const resizeObserver = new ResizeObserver(refreshMapSize);

    resizeObserver.observe(container);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      timeouts.forEach((timeout) => window.clearTimeout(timeout));
      resizeObserver.disconnect();
    };
  }, [map, onReady]);

  useEffect(() => {
    if (!center) {
      return;
    }

    const currentZoom = zoom ?? map.getZoom();
    map.setView(center, currentZoom, { animate: false });
    map.invalidateSize({ pan: false });
    redrawAmapTileLayer(map);
  }, [center, map, zoom]);

  return null;
};

export interface AmapPlaceSearchResult {
  id: string;
  name: string;
  address: string;
  detail: string;
  lat: number;
  lng: number;
}

interface AmapPlaceResponse {
  status?: string;
  info?: string;
  pois?: Array<{
    id?: string;
    name?: string;
    address?: string | string[];
    location?: string;
    type?: string;
    tel?: string | string[];
    pname?: string;
    cityname?: string;
    adname?: string;
  }>;
}

interface AmapReverseGeocodeResponse {
  status?: string;
  info?: string;
  regeocode?: {
    formatted_address?: string;
    addressComponent?: {
      province?: string;
      city?: string | string[];
      district?: string;
      township?: string;
      streetNumber?: {
        street?: string;
        number?: string;
      };
    };
    pois?: Array<{
      name?: string;
      type?: string;
      address?: string;
      distance?: string;
    }>;
    roads?: Array<{
      name?: string;
      distance?: string;
    }>;
  };
}

interface AmapJsApi {
  PlaceSearch: new (
    options?: Record<string, unknown>,
  ) => {
    search: (keyword: string, callback: (status: string, result: AmapJsPlaceSearchResult | string) => void) => void;
  };
  Geocoder: new (
    options?: Record<string, unknown>,
  ) => {
    getAddress: (location: [number, number], callback: (status: string, result: AmapJsGeocodeResult | string) => void) => void;
  };
}

interface AmapJsPlaceSearchResult {
  poiList?: {
    pois?: Array<{
      id?: string;
      name?: string;
      address?: string | string[];
      location?: { lng?: number; lat?: number };
      type?: string;
      tel?: string | string[];
      pname?: string;
      cityname?: string;
      adname?: string;
    }>;
  };
}

interface AmapJsGeocodeResult {
  regeocode?: {
    formattedAddress?: string;
    addressComponent?: {
      province?: string;
      city?: string | string[];
      district?: string;
      township?: string;
      street?: string;
      streetNumber?: string;
    };
    pois?: Array<{
      name?: string;
      type?: string;
      address?: string;
      distance?: string;
    }>;
    roads?: Array<{
      name?: string;
      distance?: string;
    }>;
  };
}

const joinReadableParts = (parts: Array<string | undefined>): string =>
  parts.filter((part): part is string => Boolean(part?.trim())).join(" · ");

const isAmapPlatformMismatchError = (error: unknown): boolean => error instanceof Error && error.message.includes("USERKEY_PLAT_NOMATCH");

const getAmapJsApi = async (): Promise<AmapJsApi> => {
  const { apiKey } = getAmapRuntimeSettings();
  applyAmapSecurityConfig();
  if (!apiKey) {
    throw new Error("没有可用的地图 Key");
  }
  if (typeof window === "undefined") {
    throw new Error("高德 JS API 只能在浏览器中加载");
  }

  const existing = (window as Window & { AMap?: AmapJsApi }).AMap;
  if (existing?.PlaceSearch && existing?.Geocoder) {
    return existing;
  }

  if (!amapJsApiPromise) {
    amapJsApiPromise = new Promise<AmapJsApi>((resolve, reject) => {
      const script = document.createElement("script");
      script.async = true;
      script.src = `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(apiKey)}&plugin=AMap.PlaceSearch,AMap.Geocoder`;
      script.onload = () => {
        const loaded = (window as Window & { AMap?: AmapJsApi }).AMap;
        if (loaded?.PlaceSearch && loaded?.Geocoder) {
          resolve(loaded);
        } else {
          reject(new Error("高德 JS API 加载后插件不可用"));
        }
      };
      script.onerror = () => reject(new Error("高德 JS API 加载失败"));
      document.head.appendChild(script);
    }).catch((error) => {
      amapJsApiPromise = undefined;
      throw error;
    });
  }

  return amapJsApiPromise;
};

const searchAmapPlacesByJsApi = async (keyword: string): Promise<AmapPlaceSearchResult[]> => {
  const amap = await getAmapJsApi();
  const placeSearch = new amap.PlaceSearch({ pageSize: 8, pageIndex: 1, extensions: "all" });

  return new Promise((resolve, reject) => {
    placeSearch.search(keyword, (status, result) => {
      if (status !== "complete" || typeof result === "string") {
        reject(new Error(typeof result === "string" ? result : "高德 JS 地点搜索失败"));
        return;
      }

      resolve(
        (result.poiList?.pois ?? []).flatMap((poi, index) => {
          const lng = Number(poi.location?.lng);
          const lat = Number(poi.location?.lat);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            return [];
          }

          const address = Array.isArray(poi.address) ? poi.address.join("") : poi.address || "";
          const area = [poi.pname, poi.cityname, poi.adname].filter(Boolean).join("");
          const tel = Array.isArray(poi.tel) ? poi.tel.join(" / ") : poi.tel;
          return [
            {
              id: poi.id || `${lng},${lat}-${index}`,
              name: poi.name || keyword,
              address,
              detail: joinReadableParts([area, address, poi.type, tel ? `电话 ${tel}` : undefined]),
              lat,
              lng,
            },
          ];
        }),
      );
    });
  });
};

export const searchAmapPlaces = async (keyword: string): Promise<AmapPlaceSearchResult[]> => {
  const trimmedKeyword = keyword.trim();
  const { apiKey } = getAmapRuntimeSettings();
  applyAmapSecurityConfig();
  if (!trimmedKeyword || !apiKey) {
    return [];
  }

  const searchParams = new URLSearchParams({
    key: apiKey,
    keywords: trimmedKeyword,
    offset: "8",
    page: "1",
    extensions: "all",
  });

  const response = await fetch(`https://restapi.amap.com/v3/place/text?${searchParams.toString()}`);
  if (!response.ok) {
    throw new Error(`高德地点搜索失败：${response.status}`);
  }

  const data = (await response.json()) as AmapPlaceResponse;
  if (data.status !== "1") {
    const error = new Error(data.info || "高德地点搜索失败");
    if (isAmapPlatformMismatchError(error)) {
      return searchAmapPlacesByJsApi(trimmedKeyword);
    }
    throw error;
  }

  return (data.pois ?? []).flatMap((poi, index) => {
    const [lngText, latText] = (poi.location ?? "").split(",");
    const lng = Number(lngText);
    const lat = Number(latText);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return [];
    }

    const address = Array.isArray(poi.address) ? poi.address.join("") : poi.address || "";
    const area = [poi.pname, poi.cityname, poi.adname].filter(Boolean).join("");
    const tel = Array.isArray(poi.tel) ? poi.tel.join(" / ") : poi.tel;
    const detail = joinReadableParts([area, address, poi.type, tel ? `电话 ${tel}` : undefined]);
    return [
      {
        id: poi.id || `${poi.location}-${index}`,
        name: poi.name || trimmedKeyword,
        address,
        detail,
        lat,
        lng,
      },
    ];
  });
};

const reverseGeocodeAmapLocationByJsApi = async (lat: number, lng: number): Promise<string> => {
  const amap = await getAmapJsApi();
  const geocoder = new amap.Geocoder({ radius: 1000, extensions: "all" });

  return new Promise((resolve, reject) => {
    geocoder.getAddress([lng, lat], (status, result) => {
      if (status !== "complete" || typeof result === "string") {
        reject(new Error(typeof result === "string" ? result : "高德 JS 逆地理编码失败"));
        return;
      }

      const regeocode = result.regeocode;
      const component = regeocode?.addressComponent;
      const street = joinReadableParts([component?.street, component?.streetNumber]);
      const nearbyPoi = regeocode?.pois?.[0];
      const nearbyRoad = regeocode?.roads?.[0];
      const nearbyPoiText = nearbyPoi?.name ? `附近 ${nearbyPoi.name}${nearbyPoi.distance ? ` ${nearbyPoi.distance}m` : ""}` : undefined;
      const nearbyRoadText = nearbyRoad?.name
        ? `靠近 ${nearbyRoad.name}${nearbyRoad.distance ? ` ${nearbyRoad.distance}m` : ""}`
        : undefined;

      resolve(
        joinReadableParts([
          regeocode?.formattedAddress,
          street,
          nearbyPoiText,
          nearbyPoi?.type,
          nearbyRoadText,
          `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
        ]) || `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
      );
    });
  });
};

export const reverseGeocodeAmapLocation = async (lat: number, lng: number): Promise<string> => {
  const { apiKey } = getAmapRuntimeSettings();
  applyAmapSecurityConfig();
  if (!apiKey) {
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  }

  const searchParams = new URLSearchParams({
    key: apiKey,
    location: `${lng},${lat}`,
    extensions: "all",
    radius: "1000",
    roadlevel: "0",
  });

  const response = await fetch(`https://restapi.amap.com/v3/geocode/regeo?${searchParams.toString()}`);
  if (!response.ok) {
    throw new Error(`高德逆地理编码失败：${response.status}`);
  }

  const data = (await response.json()) as AmapReverseGeocodeResponse;
  if (data.status !== "1") {
    const error = new Error(data.info || "高德逆地理编码失败");
    if (isAmapPlatformMismatchError(error)) {
      return reverseGeocodeAmapLocationByJsApi(lat, lng);
    }
    throw error;
  }

  const regeocode = data.regeocode;
  const component = regeocode?.addressComponent;
  const street = joinReadableParts([component?.streetNumber?.street, component?.streetNumber?.number]);
  const nearbyPoi = regeocode?.pois?.[0];
  const nearbyRoad = regeocode?.roads?.[0];
  const nearbyPoiText = nearbyPoi?.name ? `附近 ${nearbyPoi.name}${nearbyPoi.distance ? ` ${nearbyPoi.distance}m` : ""}` : undefined;
  const nearbyRoadText = nearbyRoad?.name ? `靠近 ${nearbyRoad.name}${nearbyRoad.distance ? ` ${nearbyRoad.distance}m` : ""}` : undefined;

  return (
    joinReadableParts([
      regeocode?.formatted_address,
      street,
      nearbyPoiText,
      nearbyPoi?.type,
      nearbyRoadText,
      `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
    ]) || `${lat.toFixed(6)}, ${lng.toFixed(6)}`
  );
};

export const testAmapConnection = async (apiKey: string): Promise<"web-service" | "js-api"> => {
  const trimmedKey = apiKey.trim();
  if (!trimmedKey) {
    throw new Error("没有可测试的地图 Key");
  }

  const searchParams = new URLSearchParams({
    key: trimmedKey,
    keywords: "北京",
    city: "010",
    offset: "1",
    page: "1",
    extensions: "base",
  });

  const response = await fetch(`https://restapi.amap.com/v3/place/text?${searchParams.toString()}`);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const data = (await response.json()) as { status?: string; info?: string; infocode?: string };
  if (data.status === "1") {
    return "web-service";
  }

  const error = new Error(data.info || data.infocode || "高德返回失败");
  if (!isAmapPlatformMismatchError(error)) {
    throw error;
  }

  await searchAmapPlacesByJsApi("北京");
  return "js-api";
};

interface MarkerIconOptions {
  fill?: string;
  size?: number;
  className?: string;
}

export const createMarkerIcon = (options?: MarkerIconOptions): DivIcon => {
  const { fill = "var(--primary)", size = 28, className = "" } = options || {};
  return new DivIcon({
    className: "relative border-none bg-transparent",
    html: ReactDOMServer.renderToString(
      <div className={`relative flex items-center justify-center ${className}`.trim()}>
        <MapPinIcon fill={fill} size={size} strokeWidth={1.9} style={{ filter: "drop-shadow(0 6px 10px rgba(15, 23, 42, 0.22))" }} />
      </div>,
    ),
    iconSize: [size + 8, size + 8],
    iconAnchor: [(size + 8) / 2, size + 4],
    popupAnchor: [0, -(size * 0.7)],
  });
};

export const defaultMarkerIcon = createMarkerIcon();
