import { usePlayerStore } from "./stores/playerStore";

// Persistent player slot. Lives in the root App component, outside
// <Routes>, so client-side navigation never unmounts it (audio keeps
// playing uninterrupted across routes). Bound to usePlayerStore: the queue
// holds media_links embed URLs, rendered as an embed iframe — audio bytes
// are never fetched. Links without an embed_url never enter the queue;
// their pages render a fallback outbound link instead.
export function PlayerSlot() {
  const current = usePlayerStore((s) => s.current);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const volume = usePlayerStore((s) => s.volume);
  const toggle = usePlayerStore((s) => s.toggle);
  const next = usePlayerStore((s) => s.next);
  const prev = usePlayerStore((s) => s.prev);
  const setVolume = usePlayerStore((s) => s.setVolume);

  const btn =
    "zine-border inline-block cursor-pointer bg-paper px-2 py-0.5 text-xs font-bold uppercase hover:bg-acid";

  return (
    <div data-testid="player-slot" className="zine-border bg-acid px-2 py-1">
      {current ? (
        <div className="flex flex-wrap items-center gap-2">
          <iframe
            data-testid="player-embed"
            title="player"
            src={current}
            allow="autoplay; encrypted-media"
            className="zine-border w-full bg-ink"
          />
          <button
            type="button"
            onClick={prev}
            aria-label="previous"
            className={btn}
          >
            prev
          </button>
          <button
            type="button"
            onClick={toggle}
            aria-label={isPlaying ? "pause" : "play"}
            className={btn}
          >
            {isPlaying ? "pause" : "play"}
          </button>
          <button
            type="button"
            onClick={next}
            aria-label="next"
            className={btn}
          >
            next
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            aria-label="volume"
          />
        </div>
      ) : (
        <p className="text-xs font-bold uppercase">no track queued</p>
      )}
    </div>
  );
}
