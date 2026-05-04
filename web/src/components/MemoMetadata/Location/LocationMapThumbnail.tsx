import { LatLng } from "leaflet";
import { MapContainer, Marker } from "react-leaflet";
import { AmapTileMapResizer, defaultMarkerIcon, ThemedTileLayer } from "@/components/map/map-utils";
import { cn } from "@/lib/utils";
import type { Location } from "@/types/proto/api/v1/memo_service_pb";
import { getLocationDisplayText } from "./locationHelpers";

interface LocationMapThumbnailProps {
  location: Location;
  className?: string;
  imageClassName?: string;
}

const LocationMapThumbnail = ({ location, className, imageClassName }: LocationMapThumbnailProps) => {
  const position = new LatLng(location.latitude, location.longitude);

  return (
    <div
      className={cn(
        "relative isolate h-full w-full overflow-hidden rounded-[inherit] bg-muted/40 [&_.leaflet-pane]:z-0 [&_.leaflet-top]:z-[1]",
        className,
      )}
    >
      <div
        className={cn("pointer-events-none h-full w-full", imageClassName)}
        aria-label={`${getLocationDisplayText(location)} map preview`}
      >
        <MapContainer
          className="h-full w-full !bg-muted"
          center={position}
          zoom={18}
          maxZoom={18}
          zoomControl={false}
          attributionControl={false}
          dragging={false}
          keyboard={false}
          doubleClickZoom={false}
          scrollWheelZoom={false}
          touchZoom={false}
          boxZoom={false}
        >
          <ThemedTileLayer />
          <Marker position={position} icon={defaultMarkerIcon} interactive={false} />
          <AmapTileMapResizer center={position} zoom={18} />
        </MapContainer>
      </div>
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.02),rgba(0,0,0,0.16))]" />
    </div>
  );
};

export default LocationMapThumbnail;
