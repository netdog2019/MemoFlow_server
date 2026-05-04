import { PauseIcon, PlayIcon, Volume2Icon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { formatAudioTime } from "./attachmentHelpers";

interface AudioThumbnailTileProps {
  filename: string;
  sourceUrl: string;
  title: string;
  subtitle?: string;
  className?: string;
}

const UNKNOWN_DURATION_LABEL = "--:--";

const getDurationLabel = (duration: number): string => (duration > 0 ? formatAudioTime(duration) : UNKNOWN_DURATION_LABEL);

const AudioThumbnailTile = ({ filename, sourceUrl, title, subtitle, className }: AudioThumbnailTileProps) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const progressPercent = duration > 0 ? Math.min((currentTime / duration) * 100, 100) : 0;
  const timeLabel = `${formatAudioTime(currentTime)} / ${getDurationLabel(duration)}`;

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  const togglePlayback = async () => {
    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    if (audio.paused) {
      try {
        await audio.play();
      } catch {
        setIsPlaying(false);
      }
      return;
    }

    audio.pause();
  };

  const handleSeek = (nextTime: number) => {
    const audio = audioRef.current;

    if (!audio || Number.isNaN(nextTime)) {
      return;
    }

    audio.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  const handleDuration = (nextDuration: number) => {
    setDuration(Number.isFinite(nextDuration) ? nextDuration : 0);
  };

  return (
    <div className={cn("relative h-full w-full overflow-hidden rounded-[inherit]", className)}>
      <div className="absolute inset-0 bg-linear-to-br from-secondary/78 via-background/34 to-accent/54" />
      <div className="absolute inset-x-0 top-0 h-full bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.32),transparent_48%)]" />
      <div className="absolute left-2 top-2 z-[2] flex h-7 w-7 items-center justify-center rounded-2xl bg-background/86 text-foreground shadow-xs">
        <Volume2Icon className="h-3.5 w-3.5" />
      </div>

      <button
        type="button"
        onClick={togglePlayback}
        className="absolute left-1/2 top-[37%] z-[3] flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/32 text-white shadow-lg backdrop-blur-sm transition-colors hover:bg-black/42"
        aria-label={isPlaying ? `Pause ${title}` : `Play ${title}`}
      >
        {isPlaying ? <PauseIcon className="h-4 w-4" /> : <PlayIcon className="h-4 w-4 translate-x-[1px] fill-current" />}
      </button>

      <div className="absolute inset-x-2 top-[55%] z-[3]">
        <div className="mb-1 flex items-center justify-between text-[9px] font-medium tabular-nums text-white/88">
          <span className="truncate pr-2">{title}</span>
          <span className="shrink-0">{timeLabel}</span>
        </div>

        <div className="relative flex h-4 items-center">
          <div className="absolute inset-x-0 h-1 rounded-full bg-white/24" />
          <div className="absolute left-0 h-1 rounded-full bg-white/72" style={{ width: `${progressPercent}%` }} />
          <input
            type="range"
            min={0}
            max={duration || 1}
            step={0.1}
            value={Math.min(currentTime, duration || 0)}
            onChange={(event) => handleSeek(Number(event.target.value))}
            aria-label={`Seek ${filename}`}
            className="relative z-10 h-4 w-full cursor-pointer appearance-none bg-transparent outline-none disabled:cursor-default
              [&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:rounded-full
              [&::-webkit-slider-runnable-track]:bg-transparent
              [&::-webkit-slider-thumb]:mt-[-4px] [&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:appearance-none
              [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-white/75
              [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow
              [&::-moz-range-track]:h-1 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-transparent
              [&::-moz-range-thumb]:size-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border
              [&::-moz-range-thumb]:border-white/75 [&::-moz-range-thumb]:bg-white"
            disabled={duration === 0}
          />
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/45 via-black/10 to-transparent px-2 pb-2 pt-6">
        <div className="truncate text-[11px] font-medium leading-tight text-white">{title}</div>
        {subtitle ? <div className="mt-0.5 truncate text-[10px] leading-tight text-white/78">{subtitle}</div> : null}
      </div>

      <audio
        ref={audioRef}
        src={sourceUrl}
        preload="metadata"
        className="hidden"
        onLoadedMetadata={(event) => handleDuration(event.currentTarget.duration)}
        onDurationChange={(event) => handleDuration(event.currentTarget.duration)}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => {
          setIsPlaying(false);
          setCurrentTime(0);
        }}
      />
    </div>
  );
};

export default AudioThumbnailTile;
