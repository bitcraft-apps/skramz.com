import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, Route, Routes } from "react-router-dom";
import { PlayerSlot } from "./PlayerSlot";
import { BandView, MemberView, ReleaseView } from "./encyclopedia";
import { useBands, useSearch, type SearchResult } from "./hooks";
import { queryClient } from "./queryClient";

const GROUP_CAP = 5;

type Hit = SearchResult["hits"][number];

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function hitHref(hit: Hit): string {
  const id = str(hit.id);
  if (hit.type === "member") return `/members/${id}`;
  if (hit.type === "release") return `/releases/${id}`;
  return `/bands/${id}`;
}

// Search-first gateway: an idle band strip plus debounced unified search
// grouped into bands / members / releases.
export function Home() {
  const [raw, setRaw] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(raw), 300);
    return () => clearTimeout(timer);
  }, [raw]);
  const query = debounced.trim();
  const searching = query.length >= 2;
  const idle = useBands(!searching);
  const search = useSearch(searching ? query : "");
  const reset = () => {
    setRaw("");
    setDebounced("");
  };

  const hits = search.data?.hits ?? [];
  const groups = (
    [
      ["bands", "band"],
      ["members", "member"],
      ["releases", "release"],
    ] as const
  )
    .map(([heading, type]) => ({
      heading,
      items: hits.filter((hit) => hit.type === type).slice(0, GROUP_CAP),
    }))
    .filter((group) => group.items.length > 0);
  const idleBands = idle.data?.data ?? [];

  return (
    <main>
      <input
        type="search"
        aria-label="search"
        placeholder="search bands, members, releases"
        value={raw}
        onChange={(event) => setRaw(event.target.value)}
      />
      {searching ? (
        search.isPending ? (
          <p>loading</p>
        ) : search.isError ? (
          <div>
            <p>search failed</p>
            <button type="button" onClick={() => search.refetch()}>
              retry
            </button>
            <button type="button" onClick={reset}>
              reset
            </button>
          </div>
        ) : hits.length === 0 ? (
          <div>
            <p>no results</p>
            <button type="button" onClick={reset}>
              reset
            </button>
          </div>
        ) : (
          groups.map((group) => (
            <section key={group.heading} aria-label={group.heading}>
              <h2>{group.heading}</h2>
              <ul>
                {group.items.map((hit) => (
                  <li key={`${hit.type}:${str(hit.id)}`}>
                    <Link to={hitHref(hit)}>{str(hit.name) || str(hit.id)}</Link>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )
      ) : (
        <div>
          {raw.trim().length > 0 && <p>keep typing</p>}
          {idle.isPending ? (
            <p>loading</p>
          ) : idle.isError ? (
            <div>
              <p>failed to load bands</p>
              <button type="button" onClick={() => idle.refetch()}>
                retry
              </button>
            </div>
          ) : idleBands.length === 0 ? (
            <p>no bands yet</p>
          ) : (
            <ul>
              {idleBands.map((band) => {
                const id = str(band.id);
                const name = str(band.name) || id;
                return (
                  <li key={id}>
                    <Link to={`/bands/${id}`}>{name}</Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </main>
  );
}

function About() {
  return <main>about</main>;
}

// Root shell: nav + persistent player slot never unmount across routes;
// only the <Routes> outlet swaps.
export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <nav>
        <Link to="/">home</Link> <Link to="/about">about</Link>
      </nav>
      <PlayerSlot />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/bands/:id" element={<BandView />} />
        <Route path="/members/:id" element={<MemberView />} />
        <Route path="/releases/:id" element={<ReleaseView />} />
      </Routes>
    </QueryClientProvider>
  );
}
