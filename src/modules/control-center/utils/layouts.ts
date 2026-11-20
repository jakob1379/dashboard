import { Edge, Node } from "@xyflow/react";

interface SimulationNode extends Node {
  x: number;
  y: number;
}

export const DEFAULT_MAX_ZOOM = 1.6;
export const DEFAULT_MIN_ZOOM = 0.2;
export const EMPTY_STATE_ZOOM = 0.65;

export const POLICY_COLUMN_Y_OFFSET = 18;

const NODE_Y_NUDGE: Record<string, number> = {
  peerNode: 2,
  sourcePeerNode: 2,
  expandedGroupPeer: 2,
  selectPeerNode: 2,
  selectUserNode: 2,
};

const isPolicyPill = (n: Pick<Node, "type">) =>
  n.type === "policyNode" || n.type === "agentPolicyNode";

export const nodeYNudge = (type?: string) => (type && NODE_Y_NUDGE[type]) || 0;

export const applyD3HierarchicalLayout = (
  nodes: Node[],
  edges: Edge[],
  width = 280,
  spacing = 100,
  view?: string,
  options?: {
    policy?: { width: number; spacing: number };
    destinationGroup?: { width: number; spacing: number };
    peersAndResources?: { width: number; spacing: number };
  },
) => {
  const simulationNodes: SimulationNode[] = nodes.map((node) => ({
    ...node,
    x: node.position?.x || 0,
    y: node.position?.y || 0,
  }));

  const columnWidth = width;
  const nodeSpacing = spacing;
  const startX = 0;
  const centerY = 0;

  const sourcePeerNodes = simulationNodes.filter(
    (n) => n.type === "sourcePeerNode",
  );
  const groupNodes = simulationNodes.filter((n) => n.type === "groupNode");
  const sourceGroupNodes = simulationNodes.filter(
    (n) => n.type === "sourceGroupNode",
  );
  const destinationGroupNodes = simulationNodes.filter(
    (n) => n.type === "destinationGroupNode",
  );
  const destinationResourceNodes = simulationNodes.filter(
    (n) => n.type === "destinationResourceNode",
  );
  // The single-group view mirrors policies that target the selected group to
  // the left, stamping those policy nodes with data.side === "left".
  const policyNodes = simulationNodes.filter(
    (n) => isPolicyPill(n) && n.data?.side !== "left",
  );
  const leftPolicyNodes = simulationNodes.filter(
    (n) => isPolicyPill(n) && n.data?.side === "left",
  );
  const networkNodes = simulationNodes.filter((n) => n.type === "networkNode");
  const resourceNodes = simulationNodes.filter(
    (n) => n.type === "resourceNode",
  );
  // Providers are destinations, so they share the destination column.
  const providerNodes = simulationNodes.filter(
    (n) => n.type === "providerNode",
  );
  const peerNodes = simulationNodes.filter((n) => n.type === "peerNode");
  const expandedGroupPeers = simulationNodes.filter(
    (n) => n.type === "expandedGroupPeer",
  );

  let networkAndResourceNodes = [...networkNodes, ...resourceNodes];

  if (view === "group") {
    networkAndResourceNodes = [...networkAndResourceNodes, ...peerNodes];
  }

  if (view === "peer") {
    networkAndResourceNodes = [
      ...networkAndResourceNodes,
      ...expandedGroupPeers,
    ];
  }

  centerNodesVertically(
    sourcePeerNodes,
    startX - 100,
    options?.destinationGroup?.spacing ?? nodeSpacing,
    centerY,
  );

  if (peerNodes.length > 0 && view !== "group") {
    centerNodesVertically(
      peerNodes,
      startX + (view === "group" ? columnWidth * 4 : 0),
      nodeSpacing,
      centerY,
    );
  }

  // Outside the drilled network view the source column shares the destination
  // column's pitch, and the draft rebuild mirrors it.
  centerNodesVertically(
    groupNodes,
    startX,
    view === "network"
      ? nodeSpacing
      : options?.destinationGroup?.spacing ?? nodeSpacing,
    centerY,
  );
  if (view === "group") {
    // Sources of policies targeting the selected group sit on the far left.
    centerNodesVertically(
      sourceGroupNodes,
      startX - (options?.destinationGroup?.width ?? columnWidth),
      options?.destinationGroup?.spacing ?? nodeSpacing,
      centerY,
    );
  } else {
    centerNodesVertically(
      sourceGroupNodes,
      startX + columnWidth,
      nodeSpacing,
      centerY,
    );
  }

  centerNodesVertically(
    policyNodes,
    startX + (options?.policy?.width ?? columnWidth),
    options?.policy?.spacing ?? nodeSpacing,
    centerY + POLICY_COLUMN_Y_OFFSET,
  );
  centerNodesVertically(
    leftPolicyNodes,
    startX - (options?.policy?.width ?? columnWidth),
    options?.policy?.spacing ?? nodeSpacing,
    centerY + POLICY_COLUMN_Y_OFFSET,
  );

  centerNodesVertically(
    [...destinationGroupNodes, ...destinationResourceNodes, ...providerNodes],
    startX + (options?.destinationGroup?.width ?? columnWidth),
    options?.destinationGroup?.spacing ?? nodeSpacing,
    centerY,
  );

  centerNodesVertically(
    networkAndResourceNodes,
    startX + (options?.peersAndResources?.width ?? columnWidth),
    options?.peersAndResources?.spacing ?? nodeSpacing,
    centerY + 5,
  );

  const updatedNodes: Node[] = simulationNodes.map((node) => ({
    ...node,
    position: { x: node.x, y: node.y },
  }));
  // The drilled network view anchors its resource column to a frame, so it
  // keeps the plain stack.
  arrangePolicyColumns(
    updatedNodes,
    edges,
    view === "network"
      ? undefined
      : {
          policy: options?.policy?.spacing ?? nodeSpacing,
          outer: options?.destinationGroup?.spacing ?? nodeSpacing,
        },
  );

  const nodeById = new Map(
    updatedNodes.map((n) => [n.id, { x: n.position.x, y: n.position.y }]),
  );
  const updatedEdges: Edge[] = edges.map((edge) => {
    const sourceNode = nodeById.get(edge.source);
    const targetNode = nodeById.get(edge.target);

    return {
      ...edge,
      data: {
        ...edge.data,
        points:
          sourceNode && targetNode
            ? [
                { x: sourceNode.x, y: sourceNode.y },
                { x: targetNode.x, y: targetNode.y },
              ]
            : undefined,
      },
    };
  });

  return { updatedNodes, updatedEdges };
};

type Block = { pLo: number; pHi: number; dLo: number; dHi: number };

const overlaps = (a: Block, b: Block) =>
  (a.pLo <= b.pHi && b.pLo <= a.pHi) || (a.dLo <= b.dHi && b.dLo <= a.dHi);

// Blocks are the smallest runs of policies and outer nodes that no edge
// leaves, so each one can be stacked on its own without crossing another.
const policyBlocks = (
  policies: Node[],
  outer: Map<string, Node[]>,
  outerIndex: Map<string, number>,
) => {
  const blocks: Block[] = policies.map((p, i) => {
    const ds = (outer.get(p.id) ?? [])
      .map((n) => outerIndex.get(n.id))
      .filter((d): d is number => d !== undefined);
    return {
      pLo: i,
      pHi: i,
      dLo: ds.length ? Math.min(...ds) : Infinity,
      dHi: ds.length ? Math.max(...ds) : -Infinity,
    };
  });
  for (let i = 0; i < blocks.length; i++) {
    for (let j = i + 1; j < blocks.length; j++) {
      if (!overlaps(blocks[i], blocks[j])) continue;
      const [a, b] = [blocks[i], blocks[j]];
      blocks[i] = {
        pLo: Math.min(a.pLo, b.pLo),
        pHi: Math.max(a.pHi, b.pHi),
        dLo: Math.min(a.dLo, b.dLo),
        dHi: Math.max(a.dHi, b.dHi),
      };
      blocks.splice(j, 1);
      j = i;
    }
  }
  return blocks.sort((a, b) => a.pLo - b.pLo);
};

// Stacks the blocks with a gap between them; inside one, the policies and
// their outer nodes are both centred on the block, so a destination sits level
// with the policies feeding it and a policy fanning out to many nodes gets the
// room they need.
const alignPolicyBlocks = (
  column: Node[],
  outer: Map<string, Node[]>,
  pitch: { policy: number; outer: number },
) => {
  const policies = [...column].sort((a, b) => a.position.y - b.position.y);
  const px = policies[0].position.x;
  const neighbours = policies.flatMap((p) => outer.get(p.id) ?? []);
  if (neighbours.length === 0) return;
  // Only the adjacent column moves; farther ones (drilled resources) stay put.
  const nearestX = neighbours.reduce((best, n) =>
    Math.abs(n.position.x - px) < Math.abs(best.position.x - px) ? n : best,
  ).position.x;
  const dests = [
    ...new Set(neighbours.filter((n) => n.position.x === nearestX)),
  ].sort((a, b) => a.position.y - b.position.y);
  const outerIndex = new Map(dests.map((n, i) => [n.id, i]));

  // Each column only keeps its own pitch from the previous block, so a tall
  // policy stack can tuck under a lone destination and vice versa.
  let policyEnd = -Infinity;
  let destEnd = -Infinity;
  const placed = policyBlocks(policies, outer, outerIndex).map((b) => {
    const hasDests = b.dHi >= b.dLo;
    const hp = (b.pHi - b.pLo) * pitch.policy;
    const hd = hasDests ? (b.dHi - b.dLo) * pitch.outer : 0;
    const mid = Math.max(
      policyEnd + pitch.policy + hp / 2,
      hasDests ? destEnd + pitch.outer + hd / 2 : -Infinity,
      Math.max(hp, hd) / 2,
    );
    policyEnd = mid + hp / 2;
    if (hasDests) destEnd = mid + hd / 2;
    return { b, mid, hp, hd };
  });
  const shift = Math.max(policyEnd, destEnd) / 2;
  placed.forEach(({ b, mid, hp, hd }) => {
    for (let k = b.pLo; k <= b.pHi; k++) {
      const y =
        mid -
        shift -
        hp / 2 +
        (k - b.pLo) * pitch.policy +
        POLICY_COLUMN_Y_OFFSET;
      policies[k].position = { ...policies[k].position, y };
    }
    for (let k = b.dLo; k <= b.dHi; k++) {
      const y = mid - shift - hd / 2 + (k - b.dLo) * pitch.outer;
      dests[k].position = { ...dests[k].position, y };
    }
  });
};

// Barycenter pass: each policy column keeps its y slots, but they are handed
// out by the mean y of every policy's outer-side neighbours, so policies that
// share a destination sit together instead of crossing each other's edges.
// Ties keep array order, which keeps the result independent of earlier passes.
// With `pitch`, the column and its outer neighbours are then re-stacked in
// blocks (`alignPolicyBlocks`).
export const arrangePolicyColumns = (
  nodes: Node[],
  edges: Edge[],
  pitch?: { policy: number; outer: number },
) => {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const outer = new Map<string, Node[]>();
  const add = (policy: Node | undefined, other: Node | undefined) => {
    if (!policy || !other || !isPolicyPill(policy)) return;
    const outward =
      policy.data?.side === "left"
        ? other.position.x < policy.position.x
        : other.position.x > policy.position.x;
    if (!outward) return;
    outer.set(policy.id, [...(outer.get(policy.id) ?? []), other]);
  };
  edges.forEach((e) => {
    add(byId.get(e.source), byId.get(e.target));
    add(byId.get(e.target), byId.get(e.source));
  });

  const columns = new Map<string, Node[]>();
  nodes.filter(isPolicyPill).forEach((n) => {
    const key = `${n.position.x}:${n.data?.side === "left"}`;
    columns.set(key, [...(columns.get(key) ?? []), n]);
  });
  columns.forEach((column) => {
    const slots = column.map((n) => n.position.y).sort((a, b) => a - b);
    const keyOf = (n: Node, i: number) => {
      const ys = outer.get(n.id)?.map((o) => o.position.y);
      return ys ? ys.reduce((a, b) => a + b, 0) / ys.length : slots[i];
    };
    column
      .map((n, i) => ({ n, key: keyOf(n, i) }))
      .sort((a, b) => a.key - b.key)
      .forEach(({ n }, i) => {
        n.position = { ...n.position, y: slots[i] };
      });
    if (pitch) alignPolicyBlocks(column, outer, pitch);
  });
};

const centerNodesVertically = (
  nodesList: SimulationNode[],
  x: number,
  nodeSpacing: number,
  centerY: number,
  enable = true,
) => {
  if (nodesList.length === 0) return;

  const totalHeight = (nodesList.length - 1) * nodeSpacing;
  const startY = centerY - totalHeight / 2;
  nodesList.forEach((node, index) => {
    node.x = x;
    node.y =
      (enable ? startY : 0) + index * nodeSpacing + nodeYNudge(node.type);
  });
};
