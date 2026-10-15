import { Suspense, lazy } from "react";
import { Link, useParams } from "react-router-dom";
import { useBand, useMember, useRelease } from "./hooks";
import { artUrl } from "./media";

// Graph loads only with band pages; the player slot never unmounts.
const GraphView = lazy(() => import("./GraphView"));

function str(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return typeof value === "string" ? value : "";
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
      <Suspense fallback={<section aria-label="band graph">loading graph</section>}>
        <GraphView id={str(band, "id")} />
      </Suspense>
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
      <ul>
        {data.media_links.map((m) => (
          <li key={str(m, "id")}>{str(m, "provider")}</li>
        ))}
      </ul>
    </main>
  );
}
