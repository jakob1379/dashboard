import { Edge, Node } from "@xyflow/react";
import { describe, expect, it } from "vitest";
import { DEFAULT_LAYOUT_CONFIG } from "./graph-builder";
import { applyD3HierarchicalLayout, POLICY_COLUMN_Y_OFFSET } from "./layouts";

const node = (
  id: string,
  type: string,
  data: Record<string, unknown> = {},
): Node => ({
  id,
  type,
  position: { x: 0, y: 0 },
  data,
});
const edge = (source: string, target: string): Edge => ({
  id: `${source}->${target}`,
  source,
  target,
});

const crossings = (nodes: Node[], edges: Edge[]) => {
  const pos = new Map(nodes.map((n) => [n.id, n.position]));
  const segs = edges.map((e) => [pos.get(e.source)!, pos.get(e.target)!]);
  let count = 0;
  segs.forEach(([a1, a2], i) =>
    segs.slice(i + 1).forEach(([b1, b2]) => {
      if (a1.x !== b1.x || a2.x !== b2.x) return;
      if ((a1.y - b1.y) * (a2.y - b2.y) < 0) count++;
    }),
  );
  return count;
};

const buildView = (
  routes: [string, string][],
  selected = "select-peer-node",
  side?: "left",
) => {
  const nodes: Node[] = [node(selected, "selectPeerNode")];
  const edges: Edge[] = [];
  routes.forEach(([policy, dest]) => {
    nodes.push(node(policy, "policyNode", side ? { side } : {}));
    if (!nodes.some((n) => n.id === dest))
      nodes.push(node(dest, side ? "sourceGroupNode" : "destinationGroupNode"));
    edges.push(
      side ? edge(dest, policy) : edge(selected, policy),
      side ? edge(policy, selected) : edge(policy, dest),
    );
  });
  return { nodes, edges };
};

describe("applyD3HierarchicalLayout", () => {
  // The peer view that rendered with crossing edges: policies arrive in
  // enabled order, destinations in first-seen order.
  const routes: [string, string][] = [
    ["minknow", "srv-lab"],
    ["accounts-ssh", "srv-lab"],
    ["proxies-ssh", "srv-proxies"],
    ["lab-rdp", "srv-lab"],
    ["dashboard", "srv-proxies"],
    ["onsite-ssh", "srv-onsite"],
    ["lab-to-lab", "srv-lab"],
  ];

  it("orders policies so their destination edges do not cross", () => {
    const { nodes, edges } = buildView(routes);
    const { updatedNodes } = applyD3HierarchicalLayout(
      nodes,
      edges,
      400,
      120,
      "peer",
      DEFAULT_LAYOUT_CONFIG,
    );
    expect(crossings(updatedNodes, edges)).toBe(0);

    const policyOrder = updatedNodes
      .filter((n) => n.type === "policyNode")
      .sort((a, b) => a.position.y - b.position.y)
      .map((n) => n.id);
    // Input order is kept among policies sharing a destination.
    expect(policyOrder).toEqual([
      "minknow",
      "accounts-ssh",
      "lab-rdp",
      "lab-to-lab",
      "proxies-ssh",
      "dashboard",
      "onsite-ssh",
    ]);
  });

  it("untangles the mirrored left policy column against its sources", () => {
    const { nodes, edges } = buildView(routes, "selected-group", "left");
    const { updatedNodes } = applyD3HierarchicalLayout(
      nodes,
      edges,
      400,
      120,
      "group",
      DEFAULT_LAYOUT_CONFIG,
    );
    expect(crossings(updatedNodes, edges)).toBe(0);
  });

  const layout = (nodes: Node[], edges: Edge[]) =>
    applyD3HierarchicalLayout(
      nodes,
      edges,
      400,
      120,
      "peer",
      DEFAULT_LAYOUT_CONFIG,
    ).updatedNodes;
  const yOf = (list: Node[], id: string) =>
    list.find((n) => n.id === id)!.position.y;

  it("centres each destination on the policies that feed it", () => {
    const { nodes, edges } = buildView(routes);
    const placed = layout(nodes, edges);
    const feeding = (dest: string) =>
      routes.filter(([, d]) => d === dest).map(([p]) => yOf(placed, p));
    ["srv-lab", "srv-proxies", "srv-onsite"].forEach((dest) => {
      const ys = feeding(dest);
      const mean = ys.reduce((a, b) => a + b, 0) / ys.length;
      expect(yOf(placed, dest) + POLICY_COLUMN_Y_OFFSET).toBeCloseTo(mean);
    });
  });

  it("makes room between policy groups for a policy with many destinations", () => {
    const { nodes, edges } = buildView([
      ["ssh", "servers"],
      ["web", "web-servers"],
      ["fan", "provider-a"],
    ]);
    nodes.push(
      node("provider-b", "providerNode"),
      node("provider-c", "providerNode"),
    );
    edges.push(edge("fan", "provider-b"), edge("fan", "provider-c"));
    const placed = layout(nodes, edges);

    const providers = ["provider-a", "provider-b", "provider-c"].map((id) =>
      yOf(placed, id),
    );
    expect(providers).toEqual([...providers].sort((a, b) => a - b));
    expect(providers[1] - providers[0]).toBe(
      DEFAULT_LAYOUT_CONFIG.destinationGroup.spacing,
    );
    expect(yOf(placed, "fan") - POLICY_COLUMN_Y_OFFSET).toBeCloseTo(
      providers[1],
    );
    expect(yOf(placed, "web-servers") - yOf(placed, "servers")).toBe(
      DEFAULT_LAYOUT_CONFIG.destinationGroup.spacing,
    );
    expect(yOf(placed, "fan") - yOf(placed, "web")).toBe(
      2 * DEFAULT_LAYOUT_CONFIG.destinationGroup.spacing,
    );
    expect(crossings(placed, edges)).toBe(0);
  });

  it("spaces blocks by each column's own pitch, not the larger one", () => {
    const routes: [string, string][] = [
      ["ssh", "servers"],
      ["https", "servers"],
      ["rdp", "servers"],
      ["http", "servers"],
      ["postgres", "databases"],
      ["redis", "databases"],
    ];
    const { nodes, edges } = buildView(routes);
    const placed = layout(nodes, edges);
    const policy = DEFAULT_LAYOUT_CONFIG.policy.spacing;

    expect(yOf(placed, "postgres") - yOf(placed, "http")).toBe(policy);
    expect(yOf(placed, "databases") - yOf(placed, "servers")).toBe(3 * policy);
  });
});
