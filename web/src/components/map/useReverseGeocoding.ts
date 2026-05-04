import { useQuery } from "@tanstack/react-query";
import { reverseGeocodeAmapLocation } from "./map-utils";

export const useReverseGeocoding = (lat: number | undefined, lng: number | undefined) => {
  return useQuery({
    queryKey: ["amap-geocoding", lat, lng],
    queryFn: async () => {
      const coordString = `${lat?.toFixed(6)}, ${lng?.toFixed(6)}`;
      if (lat === undefined || lng === undefined) return "";

      try {
        return await reverseGeocodeAmapLocation(lat, lng);
      } catch (error) {
        console.error("Failed to fetch Amap reverse geocoding data:", error);
        return coordString;
      }
    },
    enabled: lat !== undefined && lng !== undefined,
    staleTime: Infinity,
  });
};
