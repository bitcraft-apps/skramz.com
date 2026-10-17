import type { ClaimSource } from "./hooks";

// Evidence rendering for the deepest-correct-record template: freshness line,
// unconfirmed badges, and disputed rivals with source links. Zine tokens only
// (zine-border, bg-acid, uppercase) — no new palette. Every helper tolerates
// payloads without a sources array, so older cached responses render clean.

export function asSources(value: unknown): ClaimSource[] {
  return Array.isArray(value) ? (value as ClaimSource[]) : [];
}

export function matchSources(
  sources: ClaimSource[],
  entityId: string,
  field: string,
): ClaimSource[] {
  return sources.filter((s) => s.entity_id === entityId && s.field === field);
}

function day(value: unknown): string {
  return typeof value === "string" && value.length >= 10 ? value.slice(0, 10) : "";
}

// "last reviewed 2026-10-17", or an honest unknown when the row has none.
export function FreshnessLine({ updatedAt }: { updatedAt: unknown }) {
  const date = day(updatedAt);
  return (
    <p className="mt-2 text-xs font-bold uppercase">
      last reviewed {date || "unknown"}
    </p>
  );
}

const CHIP =
  "zine-border inline-block px-1 text-xs font-bold uppercase";

// Inline note for one claim: confirmed collapses to a source link,
// unconfirmed shows its badge, disputed shows the badge plus every rival
// value with its link. Empty when the claim has no source rows.
export function SourceNote({ rows }: { rows: ClaimSource[] }) {
  if (rows.length === 0) return null;
  const unconfirmed = rows.filter((r) => r.status === "unconfirmed");
  const disputed = rows.filter((r) => r.status === "disputed");
  const confirmed = rows.filter((r) => r.status === "confirmed");
  return (
    <span>
      {unconfirmed.length > 0 && <span className={`${CHIP} bg-acid`}>unconfirmed</span>}
      {disputed.length > 0 && <span className={`${CHIP} bg-acid`}>disputed</span>}
      {disputed.map((r) => (
        <span key={r.id} className="ml-1 text-xs font-bold uppercase">
          rival: {typeof r.value === "string" && r.value ? r.value : "—"}{" "}
          <SourceLink url={r.source_url} />
        </span>
      ))}
      {disputed.length === 0 &&
        unconfirmed.length === 0 &&
        confirmed.map((r) => (
          <span key={r.id} className="ml-1 text-xs font-bold uppercase">
            <SourceLink url={r.source_url} />
          </span>
        ))}
    </span>
  );
}

export function SourceLink({ url }: { url: string }) {
  return (
    <a href={url} target="_blank" rel="noreferrer" className="underline hover:bg-acid">
      source
    </a>
  );
}

// Bottom-of-page ledger: every disputed rival and every unconfirmed lead with
// a value, so gaps and disagreements stay visible instead of silent.
export function RecordNotes({ sources }: { sources: ClaimSource[] }) {
  const rows = sources.filter(
    (r) =>
      r.status === "disputed" ||
      (r.status === "unconfirmed" && typeof r.value === "string" && r.value),
  );
  if (rows.length === 0) return null;
  return (
    <section
      aria-label="record notes"
      className="zine-border zine-shadow mt-4 bg-paper p-3"
    >
      <h2 className="text-sm font-bold uppercase">record notes</h2>
      <ul className="mt-2">
        {rows.map((r) => (
          <li key={r.id} className="mt-1 text-xs font-bold uppercase">
            <span className={`${CHIP} bg-acid`}>{r.status}</span>{" "}
            {r.entity_type} · {r.field}
            {typeof r.value === "string" && r.value ? `: ${r.value}` : ""}{" "}
            <SourceLink url={r.source_url} />
            {typeof r.note === "string" && r.note ? <span>: {r.note}</span> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
