import { Suspense, lazy } from "react";
import { Link, useParams } from "react-router-dom";
import { useBand, useMember, useRelease } from "./hooks";
import { artUrl } from "./media";
import { FreshnessLine, RecordNotes, SourceNote, asSources, matchSources } from "./sources";
import { usePlayerStore } from "./stores/playerStore";

// Graph loads only with band + graph pages; the player slot never unmounts.
const GraphView = lazy(() => import("./GraphView"));

function str(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return typeof value === "string" ? value : "";
}

// Non-blank embed_url, or null when the link is outbound-only.
function embedUrl(link: Record<string, unknown>): string | null {
  return typeof link.embed_url === "string" && link.embed_url.trim()
    ? link.embed_url
    : null;
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

const BTN =
  "zine-border zine-shadow-sm inline-block cursor-pointer bg-paper px-3 py-1 text-sm font-bold uppercase hover:bg-acid";

const NOTICE =
  "zine-border inline-block bg-acid px-2 py-1 text-sm font-bold uppercase";

function year(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string" && value.trim()) return value.trim();
  return "";
}

export function BandView() {
  const { id } = useParams();
  const { data, isPending, isError, isSuccess, refetch } = useBand(id);
  if (isPending) {
    return (
      <main>
        <p className={NOTICE}>loading</p>
      </main>
    );
  }
  if (isError || !isSuccess) {
    return (
      <main>
        <div className="zine-border zine-shadow bg-paper p-3">
          <p className="text-sm font-bold uppercase">failed to load band</p>
          <div className="mt-2">
            <button type="button" onClick={() => refetch()} className={BTN}>
              retry
            </button>
          </div>
        </div>
      </main>
    );
  }
  const band = data.data;
  const name = str(band, "name");
  const photo = artUrl(band.photo_r2_key);
  const location = str(band, "location").trim();
  const formed = year(band.formed_year);
  const disbanded = year(band.disbanded_year);
  const meta = [
    location,
    formed && `formed ${formed}`,
    disbanded && `disbanded ${disbanded}`,
  ].filter(Boolean);
  const bio = str(band, "bio").trim();
  const sources = asSources(data.sources);
  const embeds = data.media_links
    .map(embedUrl)
    .filter((url): url is string => url !== null);
  const playFirst = () => {
    const api = usePlayerStore.getState();
    for (const url of embeds) {
      api.enqueue(url);
    }
    api.play(embeds[0]);
  };
  return (
    <main>
      <section
        aria-label="band hero"
        className="zine-border zine-shadow bg-paper p-4"
      >
        <h1 className="bg-ink text-paper inline-block px-2 py-1 text-2xl font-bold uppercase">
          {name}
        </h1>
        {meta.length > 0 && (
          <p className="mt-2 text-sm font-bold uppercase">{meta.join(" · ")}</p>
        )}
        {photo && (
          <img
            src={photo}
            alt={`${name} photo`}
            className="zine-border zine-shadow-sm mt-3 w-full"
          />
        )}
        {bio && <p className="mt-3 max-w-prose text-sm leading-relaxed">{bio}</p>}
        <FreshnessLine updatedAt={band.updated_at} />
        {embeds.length > 0 && (
          <div className="mt-3">
            <button type="button" onClick={playFirst} className={BTN}>
              play
            </button>
          </div>
        )}
        <p className="mt-3">
          <Link
            to={`/bands/${str(band, "id")}/graph`}
            className="font-bold underline hover:bg-acid"
          >
            relationship map →
          </Link>
        </p>
      </section>
      <section
        aria-label="members"
        className="zine-border zine-shadow mt-4 bg-paper"
      >
        <h2 className="border-b-[3px] border-ink bg-acid px-3 py-1 text-sm font-bold uppercase">
          members
        </h2>
        <ul>
          {data.members.map((m) => {
            const edgeId = str(m, "band_member_id");
            const stint = [
              str(m, "role"),
              [year(m.joined_year), year(m.left_year)].filter(Boolean).join("–"),
            ].filter(Boolean);
            const edgeRows = edgeId
              ? ["membership", "role", "joined_year", "left_year"].flatMap((field) =>
                  matchSources(sources, edgeId, field),
                )
              : [];
            return (
              <li
                key={str(m, "id")}
                className="border-t-[3px] border-ink first:border-t-0"
              >
                <Link
                  to={`/members/${str(m, "id")}`}
                  className="block px-3 py-2 font-bold hover:bg-acid"
                >
                  {str(m, "name")}
                </Link>
                {(stint.length > 0 || edgeRows.length > 0) && (
                  <p className="px-3 pb-2 text-xs font-bold uppercase">
                    {stint.join(" · ")}
                    {stint.length > 0 && edgeRows.length > 0 ? " " : null}
                    <SourceNote rows={edgeRows} />
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </section>
      <section
        aria-label="releases"
        className="zine-border zine-shadow mt-4 bg-paper"
      >
        <h2 className="border-b-[3px] border-ink bg-acid px-3 py-1 text-sm font-bold uppercase">
          releases
        </h2>
        <ul>
          {data.releases.map((r) => {
            const cover = artUrl(r.cover_r2_key);
            return (
              <li
                key={str(r, "id")}
                className="border-t-[3px] border-ink first:border-t-0"
              >
                <Link
                  to={`/releases/${str(r, "id")}`}
                  className="block px-3 py-2 font-bold hover:bg-acid"
                >
                  {str(r, "title")}
                </Link>
                {cover && <img src={cover} alt={`${str(r, "title")} cover`} />}
              </li>
            );
          })}
        </ul>
      </section>
      <section
        aria-label="listen"
        className="zine-border zine-shadow mt-4 bg-paper p-3"
      >
        <h2 className="text-sm font-bold uppercase">listen</h2>
        <div className="mt-2">
          <ListenList links={data.media_links} />
        </div>
      </section>
      <RecordNotes sources={sources} />
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
      <FreshnessLine updatedAt={data.data.updated_at} />
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
      <RecordNotes sources={asSources(data.sources)} />
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
      <FreshnessLine updatedAt={data.data.updated_at} />
      {cover && <img src={cover} alt={`${str(data.data, "title")} cover`} />}
      <h2>listen</h2>
      <ListenList links={data.media_links} />
      <RecordNotes sources={asSources(data.sources)} />
    </main>
  );
}
