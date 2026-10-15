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

  return (
    <div data-testid="player-slot" className="zine-border">
      {current ? (
        <>
          <iframe
            data-testid="player-embed"
            title="player"
            src={current}
            allow="autoplay; encrypted-media"
          />
          <button type="button" onClick={prev} aria-label="previous">
            prev
          </button>
          <button
            type="button"
            onClick={toggle}
            aria-label={isPlaying ? "pause" : "play"}
          >
            {isPlaying ? "pause" : "play"}
          </button>
          <button type="button" onClick={next} aria-label="next">
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
        </>
      ) : (
        <p>no track queued</p>
      )}
    </div>
  );
}
