import { LatLng } from "leaflet";
import { ExternalLinkIcon } from "lucide-react";
import { LocationPicker } from "@/components/map";
import { getAmapOpenUrl } from "@/components/map/map-utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import type { Location } from "@/types/proto/api/v1/memo_service_pb";
import { getLocationCoordinatesText, getLocationDisplayText } from "./locationHelpers";

interface LocationPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  location?: Location;
}

const LocationPreviewDialog = ({ open, onOpenChange, location }: LocationPreviewDialogProps) => {
  if (!location) {
    return null;
  }

  const displayText = getLocationDisplayText(location);
  const amapUrl = getAmapOpenUrl(location.latitude, location.longitude, displayText);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="h-[min(86vh,46rem)] max-h-[calc(100vh-1rem)] !w-[min(100vw-1rem,58rem)] !max-w-[58rem] overflow-hidden p-0!"
        bodyClassName="gap-0 overflow-hidden"
        showCloseButton={false}
      >
        <VisuallyHidden>
          <DialogTitle>{displayText}</DialogTitle>
          <DialogDescription>{getLocationCoordinatesText(location, 6)}</DialogDescription>
        </VisuallyHidden>

        <div className="flex h-full min-h-0 flex-col">
          <div className="flex items-center justify-between gap-3 border-b border-border/70 bg-background/94 px-4 py-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-foreground">{displayText}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">{getLocationCoordinatesText(location, 6)}</div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button variant="outline" size="sm" asChild>
                <a href={amapUrl} target="_blank" rel="noreferrer">
                  <ExternalLinkIcon className="h-4 w-4" />
                  高德地图
                </a>
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
                关闭
              </Button>
            </div>
          </div>

          <div className="min-h-0 flex-1 bg-muted/30">
            <LocationPicker
              className="h-full rounded-none border-0 shadow-none"
              latlng={new LatLng(location.latitude, location.longitude)}
              readonly={true}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LocationPreviewDialog;
