import { beforeEach, describe, expect, it } from "vitest";
import { usePlayerStore } from "./playerStore";

beforeEach(() => {
  localStorage.clear();
  usePlayerStore.setState({
    queue: [],
    current: null,
    isPlaying: false,
    volume: 0.8,
  });
});

describe("usePlayerStore transitions", () => {
  it("play with no queue and no id stays stopped", () => {
    usePlayerStore.getState().play();
    const s = usePlayerStore.getState();
    expect(s.isPlaying).toBe(false);
    expect(s.current).toBeNull();
  });

  it("play(id) enqueues unknown ids and starts playback", () => {
    usePlayerStore.getState().play("b1");
    const s = usePlayerStore.getState();
    expect(s.queue).toEqual(["b1"]);
    expect(s.current).toBe("b1");
    expect(s.isPlaying).toBe(true);
  });

  it("play/pause/toggle cycle", () => {
    const api = usePlayerStore.getState();
    api.enqueue("b1");
    api.play();
    expect(usePlayerStore.getState().isPlaying).toBe(true);
    expect(usePlayerStore.getState().current).toBe("b1");

    usePlayerStore.getState().pause();
    expect(usePlayerStore.getState().isPlaying).toBe(false);

    usePlayerStore.getState().toggle();
    expect(usePlayerStore.getState().isPlaying).toBe(true);

    usePlayerStore.getState().toggle();
    expect(usePlayerStore.getState().isPlaying).toBe(false);
  });

  it("clamps volume to 0..1", () => {
    usePlayerStore.getState().setVolume(2);
    expect(usePlayerStore.getState().volume).toBe(1);
    usePlayerStore.getState().setVolume(-1);
    expect(usePlayerStore.getState().volume).toBe(0);
    usePlayerStore.getState().setVolume(0.5);
    expect(usePlayerStore.getState().volume).toBe(0.5);
  });

  it("enqueue dedupes; dequeue of current advances, empty queue stops", () => {
    const api = usePlayerStore.getState();
    api.enqueue("b1");
    api.enqueue("b1");
    api.enqueue("b2");
    expect(usePlayerStore.getState().queue).toEqual(["b1", "b2"]);

    usePlayerStore.getState().play("b1");
    usePlayerStore.getState().dequeue("b1");
    expect(usePlayerStore.getState().queue).toEqual(["b2"]);
    expect(usePlayerStore.getState().current).toBe("b2");

    usePlayerStore.getState().dequeue("b2");
    const s = usePlayerStore.getState();
    expect(s.queue).toEqual([]);
    expect(s.current).toBeNull();
    expect(s.isPlaying).toBe(false);
  });

  it("next/prev walk the queue and clamp at the ends", () => {
    const api = usePlayerStore.getState();
    api.enqueue("b1");
    api.enqueue("b2");
    api.play("b1");

    usePlayerStore.getState().next();
    expect(usePlayerStore.getState().current).toBe("b2");

    usePlayerStore.getState().next();
    expect(usePlayerStore.getState().current).toBe("b2");

    usePlayerStore.getState().prev();
    expect(usePlayerStore.getState().current).toBe("b1");

    usePlayerStore.getState().prev();
    expect(usePlayerStore.getState().current).toBe("b1");
  });

  it("persists queue, current, and volume — but not playback state", () => {
    const api = usePlayerStore.getState();
    api.enqueue("https://embed.example/a");
    api.play("https://embed.example/a");
    api.setVolume(0.3);
    const raw = localStorage.getItem("skramz-player");
    expect(raw).not.toBeNull();
    const saved = JSON.parse(raw!).state as Record<string, unknown>;
    expect(saved.queue).toEqual(["https://embed.example/a"]);
    expect(saved.current).toBe("https://embed.example/a");
    expect(saved.volume).toBe(0.3);
    expect(saved.isPlaying).toBeUndefined();
  });

  it("clear empties queue and stops but preserves volume", () => {
    const api = usePlayerStore.getState();
    api.enqueue("b1");
    api.setVolume(0.3);
    api.play("b1");
    usePlayerStore.getState().clear();
    const s = usePlayerStore.getState();
    expect(s.queue).toEqual([]);
    expect(s.current).toBeNull();
    expect(s.isPlaying).toBe(false);
    expect(s.volume).toBe(0.3);
  });
});
