import { LatLng } from "leaflet";
import { uniqBy } from "lodash-es";
import { FileIcon, ItalicIcon, LinkIcon, type LucideIcon, MapPinIcon, Maximize2Icon, MoreHorizontalIcon } from "lucide-react";
import { type MouseEvent as ReactMouseEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useDebounce } from "react-use";
import { LinkMemoDialog, LocationDialog } from "@/components/MemoMetadata";
import { useReverseGeocoding } from "@/components/map";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import VisibilityIcon from "@/components/VisibilityIcon";
import { type MemoRelation, Visibility } from "@/types/proto/api/v1/memo_service_pb";
import { useTranslate } from "@/utils/i18n";
import { useLinkMemo, useLocation } from "../hooks";
import { useEditorContext } from "../state";
import type { InsertMenuProps } from "../types";

const InsertMenu = (props: InsertMenuProps) => {
  const t = useTranslate();
  const { state, actions, dispatch } = useEditorContext();
  const { location: initialLocation, onLocationChange, onToggleFocusMode } = props;

  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [locationDialogOpen, setLocationDialogOpen] = useState(false);

  const linkMemo = useLinkMemo({
    isOpen: linkDialogOpen,
    currentMemoName: props.memoName,
    existingRelations: state.metadata.relations,
    onAddRelation: (relation: MemoRelation) => {
      dispatch(actions.setMetadata({ relations: uniqBy([...state.metadata.relations, relation], (r) => r.relatedMemo?.name) }));
      setLinkDialogOpen(false);
    },
  });

  const location = useLocation(props.location);
  const {
    state: locationState,
    locationInitialized,
    handlePositionChange: handleLocationPositionChange,
    getLocation,
    reset: locationReset,
    updateCoordinate,
    setPlaceholder,
  } = location;

  const [debouncedPosition, setDebouncedPosition] = useState<LatLng | undefined>(undefined);

  useDebounce(
    () => {
      setDebouncedPosition(locationState.position);
    },
    1000,
    [locationState.position],
  );

  const { data: displayName } = useReverseGeocoding(debouncedPosition?.lat, debouncedPosition?.lng);

  useEffect(() => {
    if (displayName) {
      setPlaceholder(displayName);
    }
  }, [displayName, setPlaceholder]);

  const handleOpenLinkDialog = useCallback(() => {
    setLinkDialogOpen(true);
  }, []);

  const handleLocationClick = useCallback(() => {
    setLocationDialogOpen(true);
    if (!initialLocation && !locationInitialized) {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            handleLocationPositionChange(new LatLng(position.coords.latitude, position.coords.longitude));
          },
          (error) => {
            console.error("Geolocation error:", error);
          },
        );
      }
    }
  }, [initialLocation, locationInitialized, handleLocationPositionChange]);

  const handleLocationConfirm = useCallback(() => {
    const newLocation = getLocation();
    if (newLocation) {
      onLocationChange(newLocation);
      setLocationDialogOpen(false);
    }
  }, [getLocation, onLocationChange]);

  const handleLocationCancel = useCallback(() => {
    locationReset();
    setLocationDialogOpen(false);
  }, [locationReset]);

  const handleToggleFocusMode = useCallback(() => {
    onToggleFocusMode?.();
  }, [onToggleFocusMode]);

  const preventFocusSteal = (event: ReactMouseEvent<HTMLElement>) => {
    event.preventDefault();
  };

  const menuItems = useMemo(
    () =>
      [
        {
          key: "link",
          label: t("editor.insert-menu.link-memo"),
          icon: LinkIcon,
          onClick: handleOpenLinkDialog,
        },
        {
          key: "location",
          label: t("editor.insert-menu.add-location"),
          icon: MapPinIcon,
          onClick: handleLocationClick,
        },
      ] satisfies Array<{ key: string; label: string; icon: LucideIcon; onClick: () => void }>,
    [handleLocationClick, handleOpenLinkDialog, t],
  );

  const visibilityOptions = useMemo(
    () => [
      { value: Visibility.PRIVATE, label: t("memo.visibility.private") },
      { value: Visibility.PROTECTED, label: t("memo.visibility.protected") },
      { value: Visibility.PUBLIC, label: t("memo.visibility.public") },
    ],
    [t],
  );

  return (
    <>
      <div className="flex items-center gap-1.5">
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 rounded-full text-muted-foreground shadow-none"
              onMouseDown={preventFocusSteal}
            >
              <MoreHorizontalIcon className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {menuItems.map((item) => (
              <DropdownMenuItem key={item.key} onClick={item.onClick}>
                <item.icon className="w-4 h-4" />
                {item.label}
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem onClick={props.onItalicClick}>
              <ItalicIcon className={props.isItalicActive ? "w-4 h-4 text-primary" : "w-4 h-4"} />
              斜体
            </DropdownMenuItem>
            <DropdownMenuItem onClick={props.onFileUploadClick}>
              <FileIcon className="w-4 h-4" />
              插入文件
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleToggleFocusMode}>
              <Maximize2Icon className="w-4 h-4" />
              {t("editor.focus-mode")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <VisibilityIcon visibility={props.visibility ?? Visibility.PRIVATE} />
                {t("common.visibility")}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {visibilityOptions.map((option) => (
                  <DropdownMenuItem
                    key={option.value}
                    className="gap-2"
                    onSelect={(event) => event.preventDefault()}
                    onClick={() => props.onVisibilityChange?.(option.value)}
                  >
                    <VisibilityIcon visibility={option.value} />
                    <span className="flex-1">{option.label}</span>
                    {props.visibility === option.value && <span className="text-xs text-primary">✓</span>}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <div className="px-3 py-2 text-xs text-muted-foreground opacity-80">{t("editor.slash-commands")}</div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <LinkMemoDialog
        open={linkDialogOpen}
        onOpenChange={setLinkDialogOpen}
        searchText={linkMemo.searchText}
        onSearchChange={linkMemo.setSearchText}
        filteredMemos={linkMemo.filteredMemos}
        isFetching={linkMemo.isFetching}
        onSelectMemo={linkMemo.addMemoRelation}
        isAlreadyLinked={linkMemo.isAlreadyLinked}
      />

      <LocationDialog
        open={locationDialogOpen}
        onOpenChange={setLocationDialogOpen}
        state={locationState}
        onPositionChange={handleLocationPositionChange}
        onUpdateCoordinate={updateCoordinate}
        onPlaceholderChange={setPlaceholder}
        onCancel={handleLocationCancel}
        onConfirm={handleLocationConfirm}
      />
    </>
  );
};

export default InsertMenu;
