import type { Location } from "@/types/proto/api/v1/memo_service_pb";

export const getLocationDisplayText = (location: Location): string => {
  return location.placeholder || `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`;
};

export const getLocationCoordinatesText = (location: Location, digits = 4): string => {
  return `${location.latitude.toFixed(digits)}°, ${location.longitude.toFixed(digits)}°`;
};

const MAX_THUMBNAIL_LABEL_LENGTH = 6;

const trimToLength = (text: string, maxLength = MAX_THUMBNAIL_LABEL_LENGTH): string => Array.from(text).slice(0, maxLength).join("");

const normalizeLocationName = (text: string): string => {
  return text
    .trim()
    .replace(/^(?:附近|靠近)\s*/, "")
    .replace(/\s+\d+(?:\.\d+)?m$/i, "")
    .replace(/\([^)]*\)|（[^）]*）/g, "")
    .replace(/^\d+(?:\.\d+)?[°,\s，]+\d+(?:\.\d+)?°?$/, "")
    .replace(/电话\s*.*$/, "")
    .replace(/^(?:中国)?[^省市区县]{1,12}省/, "")
    .replace(/^[^省市区县]{1,12}市/, "")
    .replace(/^[^省市区县]{1,12}[区县]/, "")
    .replace(/(?:街道|镇|乡)$/, "")
    .replace(/(有限责任公司|股份有限公司|有限公司|分公司|总店|旗舰店|专卖店|店)$/g, "")
    .trim();
};

const isWeakLocationCandidate = (text: string): boolean => {
  if (!text) {
    return true;
  }

  if (/^\d+(?:\.\d+)?[°,\s，]+\d+(?:\.\d+)?°?$/.test(text)) {
    return true;
  }

  if (/^(?:商务住宅|购物服务|餐饮服务|生活服务|公司企业|地名地址信息|道路附属设施|交通设施服务|公共设施)(?:[;；/].*)?$/.test(text)) {
    return true;
  }

  return /^(?:中国)?[^省市区县]{1,12}(?:省|市|区|县|街道|镇|乡)$/.test(text);
};

const getLocationLabelCandidates = (placeholder: string): string[] => {
  const parts = placeholder
    .split("·")
    .map((part) => part.trim())
    .filter(Boolean);

  const nearbyParts = parts.filter((part) => /^(?:附近|靠近)\s*/.test(part));
  return [...nearbyParts, ...parts];
};

export const getLocationThumbnailLabel = (location: Location): string => {
  const placeholder = location.placeholder.trim();
  const candidates = getLocationLabelCandidates(placeholder);

  for (const candidate of candidates) {
    const normalizedCandidate = normalizeLocationName(candidate);
    if (!isWeakLocationCandidate(normalizedCandidate)) {
      return trimToLength(normalizedCandidate);
    }
  }

  return "坐标位置";
};
