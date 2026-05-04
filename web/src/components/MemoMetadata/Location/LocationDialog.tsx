import { LatLng } from "leaflet";
import { LoaderCircleIcon, SearchIcon } from "lucide-react";
import { useState } from "react";
import type { LocationState } from "@/components/MemoEditor/types/insert-menu";
import { LocationPicker } from "@/components/map";
import { type AmapPlaceSearchResult, reverseGeocodeAmapLocation, searchAmapPlaces } from "@/components/map/map-utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import { useTranslate } from "@/utils/i18n";

interface LocationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: LocationState;
  onPositionChange: (position: LatLng) => void;
  onUpdateCoordinate: (type: "lat" | "lng", value: string) => void;
  onPlaceholderChange: (placeholder: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}

export const LocationDialog = ({
  open,
  onOpenChange,
  state,
  onPositionChange,
  onPlaceholderChange,
  onCancel,
  onConfirm,
}: LocationDialogProps) => {
  const t = useTranslate();
  const { placeholder, position } = state;
  const [searchText, setSearchText] = useState("");
  const [searchResults, setSearchResults] = useState<AmapPlaceSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [resolvingPosition, setResolvingPosition] = useState(false);

  const handleSearch = async () => {
    const trimmedSearchText = searchText.trim();
    if (!trimmedSearchText) {
      setSearchResults([]);
      setSearchError("");
      return;
    }

    setSearching(true);
    setSearchError("");
    try {
      const results = await searchAmapPlaces(trimmedSearchText);
      setSearchResults(results);
      setSearchError(results.length === 0 ? "没有找到匹配的地址" : "");
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : "地址搜索失败");
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleSelectSearchResult = (result: AmapPlaceSearchResult) => {
    onPositionChange(new LatLng(result.lat, result.lng));
    onPlaceholderChange(
      result.detail ? `${result.name} · ${result.detail}` : result.address ? `${result.name} · ${result.address}` : result.name,
    );
    setSearchText(result.name);
    setSearchResults([]);
    setSearchError("");
  };

  const handleMapPositionChange = async (nextPosition: LatLng) => {
    onPositionChange(nextPosition);
    const fallbackLabel = `${nextPosition.lat.toFixed(6)}, ${nextPosition.lng.toFixed(6)}`;
    onPlaceholderChange(fallbackLabel);
    setResolvingPosition(true);
    try {
      const resolvedLabel = await reverseGeocodeAmapLocation(nextPosition.lat, nextPosition.lng);
      onPlaceholderChange(resolvedLabel);
    } catch (error) {
      console.warn("Failed to resolve Amap location detail:", error);
      onPlaceholderChange(fallbackLabel);
    } finally {
      setResolvingPosition(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="h-[min(86vh,46rem)] max-h-[calc(100vh-1rem)] !w-[min(100vw-1rem,58rem)] !max-w-[58rem] overflow-hidden p-0!"
        bodyClassName="gap-0 overflow-hidden"
        showCloseButton={false}
      >
        <VisuallyHidden>
          <DialogClose />
        </VisuallyHidden>
        <VisuallyHidden>
          <DialogTitle>{t("tooltip.select-location")}</DialogTitle>
        </VisuallyHidden>
        <VisuallyHidden>
          <DialogDescription>Search or choose a location on the Amap map</DialogDescription>
        </VisuallyHidden>

        <div className="flex h-full min-h-0 flex-col">
          <div className="border-b border-border/70 bg-background/94 p-3">
            <form
              className="flex items-center gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                void handleSearch();
              }}
            >
              <div className="relative min-w-0 flex-1">
                <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  placeholder="搜索地址、地点或建筑"
                  className="h-10 rounded-full pl-9"
                />
              </div>
              <Button type="submit" className="h-10 rounded-full px-4" disabled={searching}>
                {searching ? <LoaderCircleIcon className="h-4 w-4 animate-spin" /> : null}
                搜索
              </Button>
            </form>

            {(searchResults.length > 0 || searchError) && (
              <div className="mt-2 max-h-40 overflow-auto rounded-2xl border border-border/70 bg-popover/98 p-1 shadow-sm">
                {searchResults.map((result) => (
                  <button
                    key={result.id}
                    type="button"
                    className="block w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-accent/55"
                    onClick={() => handleSelectSearchResult(result)}
                  >
                    <div className="truncate font-medium text-foreground">{result.name}</div>
                    {result.detail || result.address ? (
                      <div className="mt-0.5 truncate text-xs text-muted-foreground">{result.detail || result.address}</div>
                    ) : null}
                  </button>
                ))}
                {searchError ? <div className="px-3 py-2 text-sm text-muted-foreground">{searchError}</div> : null}
              </div>
            )}
          </div>

          <div className="min-h-0 flex-1 bg-muted/30">
            <LocationPicker className="h-full rounded-none border-0 shadow-none" latlng={position} onChange={handleMapPositionChange} />
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-border/70 bg-background/94 p-3">
            <div className="min-w-0 text-sm">
              <div className="truncate font-medium text-foreground">
                {resolvingPosition ? "正在获取周边位置详情..." : placeholder || "点击地图或搜索地址选择位置"}
              </div>
              {position ? (
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {position.lat.toFixed(6)}, {position.lng.toFixed(6)}
                </div>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button variant="ghost" className="rounded-full" onClick={onCancel}>
                {t("common.close")}
              </Button>
              <Button
                className="rounded-full"
                onClick={onConfirm}
                disabled={!position || placeholder.trim().length === 0 || resolvingPosition}
              >
                {t("common.confirm")}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
