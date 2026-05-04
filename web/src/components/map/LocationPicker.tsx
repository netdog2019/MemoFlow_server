import { LatLng } from "leaflet";
import { ExternalLinkIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { MapContainer, Marker, useMap, useMapEvents } from "react-leaflet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AmapTileMapResizer, defaultMarkerIcon, getAmapOpenUrl, ThemedTileLayer } from "./map-utils";

interface LocationPickerProps {
  readonly?: boolean;
  latlng?: LatLng;
  onChange?: (position: LatLng) => void;
  className?: string;
}

const DEFAULT_CENTER_LAT_LNG = new LatLng(39.9042, 116.4074);
const noopOnLocationChange = () => {};
const LeafletLocationMarker = ({
  position: initialPosition,
  onChange,
  readonly: readOnly,
}: {
  position: LatLng | undefined;
  onChange: (position: LatLng) => void;
  readonly?: boolean;
}) => {
  const [position, setPosition] = useState(initialPosition);
  const map = useMapEvents({
    click(event) {
      if (readOnly) {
        return;
      }

      setPosition(event.latlng);
      onChange(event.latlng);
    },
  });

  useEffect(() => {
    if (initialPosition) {
      setPosition(initialPosition);
    } else {
      setPosition(undefined);
    }
  }, [initialPosition, map]);

  return position ? <Marker position={position} icon={defaultMarkerIcon} /> : null;
};

const LeafletMapControls = ({ position }: { position?: LatLng }) => {
  const map = useMap();

  return (
    <div className="absolute right-3 top-12 z-[450] flex flex-col gap-1.5">
      <button
        type="button"
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/80 bg-background/90 text-base text-foreground shadow-sm"
        onClick={() => map.zoomIn()}
        aria-label="放大"
      >
        +
      </button>
      <button
        type="button"
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/80 bg-background/90 text-base text-foreground shadow-sm"
        onClick={() => map.zoomOut()}
        aria-label="缩小"
      >
        -
      </button>
      {position ? (
        <Button asChild variant="secondary" size="icon" className="size-8 rounded-lg bg-background/90 shadow-sm">
          <a href={getAmapOpenUrl(position.lat, position.lng)} target="_blank" rel="noreferrer" aria-label="在高德地图打开">
            <ExternalLinkIcon className="h-4 w-4" />
          </a>
        </Button>
      ) : null}
    </div>
  );
};

const LocationPicker = ({ readonly: readOnly = false, latlng, onChange = noopOnLocationChange, className }: LocationPickerProps) => {
  const onChangeRef = useRef(onChange);

  onChangeRef.current = onChange;

  const position = latlng || DEFAULT_CENTER_LAT_LNG;
  const zoom = latlng ? 17 : 12;
  const statusLabel = readOnly ? "已标记位置" : latlng ? "已选择位置" : "点击高德地图选择位置";

  return (
    <div
      className={cn(
        "memo-location-map relative isolate h-72 w-full overflow-hidden rounded-xl border border-border bg-background shadow-sm",
        className,
      )}
    >
      <MapContainer
        className="h-full w-full !bg-muted"
        center={position}
        zoom={zoom}
        maxZoom={18}
        scrollWheelZoom={true}
        zoomControl={false}
        attributionControl={false}
      >
        <ThemedTileLayer />
        <LeafletLocationMarker position={latlng || position} readonly={readOnly} onChange={onChangeRef.current} />
        <LeafletMapControls position={latlng} />
        <AmapTileMapResizer center={position} zoom={zoom} />
      </MapContainer>

      <div className="pointer-events-none absolute left-3 top-3 z-[3] flex items-center gap-2">
        <div className="rounded-full border border-border bg-background/92 px-2.5 py-1 text-[11px] font-medium tracking-[0.02em] text-foreground/80 shadow-sm backdrop-blur-sm">
          {statusLabel}
        </div>
      </div>

      {latlng ? (
        <Button
          asChild
          variant="secondary"
          size="icon"
          className="absolute right-3 top-3 z-[3] size-8 rounded-lg bg-background/90 shadow-sm"
        >
          <a href={getAmapOpenUrl(latlng.lat, latlng.lng)} target="_blank" rel="noreferrer" aria-label="在高德地图打开">
            <ExternalLinkIcon className="h-4 w-4" />
          </a>
        </Button>
      ) : null}
    </div>
  );
};

export default LocationPicker;
