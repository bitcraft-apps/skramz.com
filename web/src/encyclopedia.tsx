import { Suspense, lazy } from "react";
import { Link, useParams } from "react-router-dom";
import { useBand, useMember, useRelease } from "./hooks";
import { artUrl } from "./media";
import { usePlayerStore } from "./stores/playerStore";

// Graph loads only with band + graph pages; the player slot never unmounts.
const GraphView = lazy(() => import("./GraphView"));

function str(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return typeof value === "string" ? value : "";
}

// Shared listen section for band + release views. Zero links render a
// graceful empty state instead of an empty list. Rows without an embed_url
// stay playable via their outbound url (fallback link); only embed URLs
// enter the queue.
function ListenList({ links }: { links: Record<string, unknown>[] }) {
  const items = links.filter(
    (link) => typeof link.id === "string" && typeof link.url === "string",
  );
  if (items.length === 0) return <p>No streams yet.</p>;
  const embedUrl = (link: Record<string, unknown>): string | null =>
    typeof link.embed_url === "string" && link.embed_url.trim()
      ? link.embed_url
      : null;
  const playFrom = (start: string) => {
    const api = usePlayerStore.getState();
    for (const item of items) {
      const embed = embedUrl(item);
      if (embed) api.enqueue(embed);
    }
    api.play(start);
  };
  return (
    <ul>
      {items.map((item) => {
        const embed = embedUrl(item);
        const provider = str(item, "provider") || "listen";
        return embed ? (
          <li key={str(item, "id")}>
            <button type="button" onClick={() => playFrom(embed)}>
              play {provider}
            </button>
          </li>
        ) : (
          <li key={str(item, "id")}>
            <a href={str(item, "url")} target="_blank" rel="noreferrer">
              {provider}
            </a>
          </li>
        );
      })}
    </ul>
  );
}

export function BandGraphPage() {
  const { id } = useParams();
  return (
    <main aria-label="band graph page" className="w-full">
      <Suspense fallback={<section aria-label="band graph">loading graph</section>}>
        <GraphView id={typeof id === "string" ? id : ""} />
      </Suspense>
    </main>
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
      <p>
        <Link to={`/bands/${str(band, "id")}/graph`}>relationship map →</Link>
      </p>
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
