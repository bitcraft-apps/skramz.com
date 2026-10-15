import { Link, useParams } from "react-router-dom";
import { useBand, useMember, useRelease } from "./hooks";
import { artUrl } from "./media";
import { usePlayerStore } from "./stores/playerStore";

function str(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return typeof value === "string" ? value : "";
}

// Normalize a media_links row. Rows without an embed_url stay playable via
// their outbound url (fallback link); only embed URLs enter the queue.
type ListenItem = {
  id: string;
  provider: string;
  url: string;
  embedUrl: string | null;
};

function listenItems(links: Record<string, unknown>[]): ListenItem[] {
  const items: ListenItem[] = [];
  for (const link of links) {
    if (typeof link.id !== "string" || typeof link.url !== "string") continue;
    const embed =
      typeof link.embed_url === "string" && link.embed_url.trim()
        ? link.embed_url
        : null;
    items.push({
      id: link.id,
      provider: str(link, "provider") || "listen",
      url: link.url,
      embedUrl: embed,
    });
  }
  return items;
}

// Shared listen section for band + release views. Zero links render a
// graceful empty state instead of an empty list.
function ListenList({ links }: { links: Record<string, unknown>[] }) {
  const items = listenItems(links);
  if (items.length === 0) return <p>No streams yet.</p>;
  const playFrom = (start: string) => {
    const api = usePlayerStore.getState();
    for (const item of items) {
      if (item.embedUrl) api.enqueue(item.embedUrl);
    }
    api.play(start);
  };
  return (
    <ul>
      {items.map((item) =>
        item.embedUrl ? (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => item.embedUrl && playFrom(item.embedUrl)}
            >
              play {item.provider}
            </button>
          </li>
        ) : (
          <li key={item.id}>
            <a href={item.url} target="_blank" rel="noreferrer">
              {item.provider}
            </a>
          </li>
        ),
      )}
    </ul>
  );
}

export function BandView() {
  const { id } = useParams();
  const { data, isSuccess } = useBand(id);
  if (!isSuccess) return <main>loading</main>;
  const band = data.data;
  const photo = artUrl(band.photo_r2_key);
  return (
    <main>
      <h1>{str(band, "name")}</h1>
      {photo && <img src={photo} alt={`${str(band, "name")} photo`} />}
      <h2>members</h2>
      <ul>
        {data.members.map((m) => (
          <li key={str(m, "id")}>
            <Link to={`/members/${str(m, "id")}`}>{str(m, "name")}</Link>
          </li>
        ))}
      </ul>
      <h2>releases</h2>
      <ul>
        {data.releases.map((r) => {
          const cover = artUrl(r.cover_r2_key);
          return (
            <li key={str(r, "id")}>
              <Link to={`/releases/${str(r, "id")}`}>{str(r, "title")}</Link>
              {cover && <img src={cover} alt={`${str(r, "title")} cover`} />}
            </li>
          );
        })}
      </ul>
      <h2>listen</h2>
      <ListenList links={data.media_links} />
    </main>
  );
}

export function MemberView() {
  const { id } = useParams();
  const { data, isSuccess } = useMember(id);
  if (!isSuccess) return <main>loading</main>;
  return (
    <main>
      <h1>{str(data.data, "name")}</h1>
      <h2>bands</h2>
      <ul>
        {data.bands.map((b) => {
          const photo = artUrl(b.photo_r2_key);
          return (
            <li key={str(b, "id")}>
              <Link to={`/bands/${str(b, "id")}`}>{str(b, "name")}</Link>
              {photo && <img src={photo} alt={`${str(b, "name")} photo`} />}
            </li>
          );
        })}
      </ul>
    </main>
  );
}

export function ReleaseView() {
  const { id } = useParams();
  const { data, isSuccess } = useRelease(id);
  if (!isSuccess) return <main>loading</main>;
  const cover = artUrl(data.data.cover_r2_key);
  return (
    <main>
      <h1>{str(data.data, "title")}</h1>
      {cover && <img src={cover} alt={`${str(data.data, "title")} cover`} />}
      <h2>listen</h2>
      <ListenList links={data.media_links} />
    </main>
  );
}
