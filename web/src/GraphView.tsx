import { useMemo } from "react";
import ForceGraph2D from "react-force-graph-2d";
import { useNavigate } from "react-router-dom";
import { useBandGraph } from "./hooks";
import { useGraphUIStore } from "./stores/graphUIStore";

// Never render more than this many nodes; the API already bounds result rows.
const GRAPH_NODE_CAP = 500;

type GraphNode = { id: string; name: string };
type GraphLink = { source: string; target: string; via: string };

// Band relationship map: bands linked by shared members (via labels).
// Node clicks navigate client-side.
export function GraphView({ id }: { id: string }) {
  const depth = useGraphUIStore((s) => s.depth);
  const setDepth = useGraphUIStore((s) => s.setDepth);
  const showLabels = useGraphUIStore((s) => s.showLabels);
  const toggleLabels = useGraphUIStore((s) => s.toggleLabels);
  const navigate = useNavigate();
  const { data, isLoading, isError } = useBandGraph(id, depth);

  const graph = useMemo((): { nodes: GraphNode[]; links: GraphLink[] } => {
    if (!data) return { nodes: [], links: [] };
    const nodes = data.nodes
      .slice(0, GRAPH_NODE_CAP)
      .map((n) => ({ id: n.id, name: n.name }));
    const kept = new Set(nodes.map((n) => n.id));
    const links = data.edges
      .filter((e) => kept.has(e.from) && kept.has(e.to))
      .map((e) => ({ source: e.from, target: e.to, via: e.via }));
    return { nodes, links };
  }, [data]);

  if (isLoading) return <section aria-label="band graph">loading graph</section>;
  if (isError || !data)
    return <section aria-label="band graph">graph unavailable</section>;
  if (graph.nodes.length < 2)
    return (
      <section aria-label="band graph">
        <p>no connections yet</p>
      </section>
    );

  return (
    <section aria-label="band graph">
      <div>
        <label>
          depth
          <select
            aria-label="graph depth"
            value={depth}
            onChange={(e) => setDepth(Number(e.target.value))}
          >
            {[1, 2, 3, 4].map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={showLabels}
            onChange={toggleLabels}
            aria-label="show via labels"
          />
          via labels
        </label>
      </div>
      {data.nodes.length > GRAPH_NODE_CAP && (
        <p>
          showing first {GRAPH_NODE_CAP} of {data.nodes.length} bands
        </p>
      )}
      <ForceGraph2D
        graphData={graph}
        nodeLabel="name"
        linkLabel={showLabels ? "via" : undefined}
        linkDirectionalArrowLength={3}
        onNodeClick={(node) => navigate(`/bands/${String(node.id)}`)}
      />
      <ul aria-label="graph connections">
        {graph.links.map((l) => (
          <li key={`${l.source}-${l.target}-${l.via}`}>
            {showLabels ? `${l.source} to ${l.target} via ${l.via}` : `${l.source} to ${l.target}`}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default GraphView;
