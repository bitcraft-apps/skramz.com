import type { ClaimSource } from "./hooks";

// Evidence rendering for the deepest-correct-record template: freshness line,
// plain-words state chips, and a "how we know this" ledger. Zine tokens only
// (zine-border, bg-acid, uppercase) — no new palette. Every helper tolerates
// payloads without a sources array, so older cached responses render clean.
// Per ADR-0006 the API statuses and tiers are untouched; only the
// reader-facing strings change, and internal `note` text never renders.

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

// "last reviewed 2026-10-17", or an honest state when the row has none.
export function FreshnessLine({ updatedAt }: { updatedAt: unknown }) {
  const date = day(updatedAt);
  return (
    <p className="mt-2 text-xs font-bold uppercase">
      {date ? `last reviewed ${date}` : "not yet reviewed"}
    </p>
  );
}

const CHIP =
  "zine-border inline-block px-1 text-xs font-bold uppercase";

// Tier kinds, not ranks (ADR-0006): readers see what kind of source backs a
// claim, never a 1/2/3 number.
function tierKind(tier: unknown): string {
  if (tier === 1) return "official";
  if (tier === 2) return "press & archives";
  return "community";
}

// Bare domain for `source: {domain}` labels, so readers get provenance scent
// without clicking. Subdomains collapse ("en.wikipedia.org" → "wikipedia");
// unparseable urls fall back to a bare "source".
function domainLabel(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    const parts = host.split(".").filter(Boolean);
    const base = parts.length > 2 ? parts.slice(1) : parts;
    return base[0] ?? "";
  } catch {
    return "";
  }
}

export function SourceLink({ url }: { url: string }) {
  const domain = domainLabel(url);
  return (
    <a href={url} target="_blank" rel="noreferrer" className="underline hover:bg-acid">
      {domain ? `source: ${domain}` : "source"}
    </a>
  );
}

// Inline note for one claim: confirmed collapses to source links, unconfirmed
// shows its chip, disputed shows the chip plus every other reported value
// with its link. Empty when the claim has no source rows.
export function SourceNote({ rows }: { rows: ClaimSource[] }) {
  if (rows.length === 0) return null;
  const unconfirmed = rows.filter((r) => r.status === "unconfirmed");
  const disputed = rows.filter((r) => r.status === "disputed");
  const confirmed = rows.filter((r) => r.status === "confirmed");
  return (
    <span>
      {unconfirmed.length > 0 && (
        <span className={`${CHIP} bg-acid`} title="No solid source yet">
          not yet confirmed
        </span>
      )}
      {disputed.length > 0 && (
        <span className={`${CHIP} bg-acid`}>sources disagree</span>
      )}
      {disputed.map((r) => (
        <span key={r.id} className="ml-1 text-xs font-bold uppercase">
          {typeof r.value === "string" && r.value ? (
            <>also reported as {r.value} </>
          ) : (
            <>another source disagrees </>
          )}
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

// Schema identifiers never reach readers: `formed_year` → `formed`,
// `membership` → `member`; anything unmapped falls back to spaces.
const FIELD_LABELS: Record<string, string> = {
  formed_year: "formed",
  disbanded_year: "disbanded",
  joined_year: "joined",
  left_year: "left",
  role: "role",
  membership: "member",
  name: "name",
  title: "title",
  location: "location",
  bio: "bio",
};

function fieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field.replace(/_/g, " ");
}

type NoteGroup = {
  key: string;
  field: string;
  value: string;
  rows: ClaimSource[];
};

// One ledger row per (claim, value): rivals stay on separate rows, identical
// claims collapse so corroboration can be counted instead of repeated.
function groupNotes(sources: ClaimSource[]): NoteGroup[] {
  const groups = new Map<string, NoteGroup>();
  for (const r of sources) {
    if (r.status !== "disputed" && r.status !== "unconfirmed") continue;
    const value = typeof r.value === "string" ? r.value : "";
    if (r.status === "unconfirmed" && !value) continue;
    const key = `${r.entity_id}·${r.field}·${value}`;
    const group = groups.get(key) ?? { key, field: r.field, value, rows: [] };
    group.rows.push(r);
    groups.set(key, group);
  }
  return [...groups.values()];
}

// "community source" for one row, "2 community sources agree" for several,
// "3 sources agree" when kinds mix. Counts link every source and never
// promote on count alone (counts can mirror one copied error).
function provenance(rows: ClaimSource[]): string {
  if (rows.length > 1) {
    const kinds = [...new Set(rows.map((r) => tierKind(r.tier)))];
    const noun = kinds.length === 1 ? `${kinds[0]} sources` : "sources";
    return `${rows.length} ${noun} agree`;
  }
  return `${tierKind(rows[0].tier)} source`;
}

// Bottom-of-page ledger as a native disclosure: every disagreeing value and
// every not-yet-confirmed lead, in human sentences with kind labels and
// domain links. Silent on fully confirmed pages.
export function RecordNotes({ sources }: { sources: ClaimSource[] }) {
  const groups = groupNotes(sources);
  if (groups.length === 0) return null;
  const hasDispute = groups.some((g) =>
    g.rows.some((r) => r.status === "disputed"),
  );
  return (
    <section
      aria-label="how we know this"
      className="zine-border zine-shadow mt-4 bg-paper p-3"
    >
      <details>
        <summary className="cursor-pointer text-sm font-bold uppercase">
          how we know this ({groups.length})
        </summary>
        {hasDispute && (
          <p className="mt-2 text-xs font-bold uppercase">
            When sources disagree we show the strongest source and keep the
            other one here.
          </p>
        )}
        <ul className="mt-2">
          {groups.map((g) => {
            const disputed = g.rows.some((r) => r.status === "disputed");
            return (
              <li key={g.key} className="mt-1 text-xs font-bold uppercase">
                <span className={`${CHIP} bg-acid`}>
                  {disputed ? "sources disagree" : "not yet confirmed"}
                </span>{" "}
                {fieldLabel(g.field)}
                {g.value ? `: ${g.value}` : ""} · {provenance(g.rows)}{" "}
                {g.rows.map((r) => (
                  <span key={r.id} className="ml-1">
                    <SourceLink url={r.source_url} />
                  </span>
                ))}
              </li>
            );
          })}
        </ul>
      </details>
    </section>
  );
}
