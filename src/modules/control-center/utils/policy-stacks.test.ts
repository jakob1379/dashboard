import { Edge, Node } from "@xyflow/react";
import { describe, expect, it } from "vitest";
import {
  collapsePolicyStacks,
  POLICY_STACK_MIN,
  stackAnchors,
} from "./policy-stacks";

const policy = (id: string, enabled = true): Node => ({
  id: `policy-${id}`,
  type: "policyNode",
  position: { x: 0, y: 0 },
  data: { policy: { id, enabled } },
});
const dest = (id: string): Node => ({
  id,
  type: "destinationGroupNode",
  position: { x: 0, y: 0 },
  data: {},
});
const edge = (source: string, target: string, enabled = true): Edge => ({
  id: `${source}->${target}`,
  source,
  target,
  type: "smart",
  data: { enabled },
});

const peerView = (routes: [string, string, boolean?][]) => {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  routes.forEach(([id, to, enabled = true]) => {
    nodes.push(policy(id, enabled));
    if (!nodes.some((n) => n.id === to)) nodes.push(dest(to));
    edges.push(
      edge("select-peer-node", `policy-${id}`, enabled),
      edge(`policy-${id}`, to, enabled),
    );
  });
  return { nodes, edges };
};

const stacks = (nodes: Node[]) =>
  nodes.filter((n) => n.type === "policyStackNode");

describe("collapsePolicyStacks", () => {
  const routes: [string, string, boolean?][] = [
    ["ssh", "servers"],
    ["https", "servers"],
    ["postgres", "databases"],
    ["rdp", "servers", false],
    ["kube", "kubernetes"],
  ];

  it("folds policies sharing source and destination into one node", () => {
    const view = peerView(routes);
    const { nodes, edges } = collapsePolicyStacks(
      view.nodes,
      view.edges,
      new Set(),
    );
    const [stack] = stacks(nodes);

    expect(stacks(nodes)).toHaveLength(1);
    expect((stack.data.policies as { id: string }[]).map((p) => p.id)).toEqual([
      "ssh",
      "https",
      "rdp",
    ]);
    expect(nodes.map((n) => n.id)).not.toContain("policy-ssh");
    expect(nodes.map((n) => n.id)).toContain("policy-postgres");
    expect(edges.filter((e) => e.source === stack.id)).toEqual([
      expect.objectContaining({ target: "servers", data: { enabled: true } }),
    ]);
    expect(edges.filter((e) => e.target === stack.id)).toHaveLength(1);
    expect(edges.some((e) => e.target === "policy-ssh")).toBe(false);
  });

  it(`leaves runs shorter than ${POLICY_STACK_MIN} alone`, () => {
    const view = peerView(routes.slice(0, 2));
    expect(collapsePolicyStacks(view.nodes, view.edges, new Set())).toEqual(
      view,
    );
  });

  it("unfolds an expanded stack and marks its top policy to fold it back", () => {
    const view = peerView(routes);
    const [stack] = stacks(
      collapsePolicyStacks(view.nodes, view.edges, new Set()).nodes,
    );
    const key = stack.data.stackKey as string;

    const { nodes, edges } = collapsePolicyStacks(
      view.nodes,
      view.edges,
      new Set([key]),
    );
    expect(stacks(nodes)).toHaveLength(0);
    expect(edges).toEqual(view.edges);
    expect(
      nodes.filter((n) => n.data.stackKey).map((n) => [n.id, n.data.stackKey]),
    ).toEqual([["policy-ssh", key]]);
  });

  it("does not fold policies that reach different destination sets", () => {
    const view = peerView([
      ["a", "servers"],
      ["b", "servers"],
      ["c", "servers"],
    ]);
    view.edges.push(edge("policy-c", "databases"));
    view.nodes.push(dest("databases"));
    expect(
      stacks(collapsePolicyStacks(view.nodes, view.edges, new Set()).nodes),
    ).toHaveLength(0);
  });

  it("marks a stack edge disabled only when every policy in it is", () => {
    const view = peerView([
      ["a", "servers", false],
      ["b", "servers", false],
      ["c", "servers", false],
    ]);
    const { edges } = collapsePolicyStacks(view.nodes, view.edges, new Set());
    expect(edges.every((e) => e.data?.enabled === false)).toBe(true);
  });

  it("anchors an unfolding stack and its policies on each other", () => {
    const view = peerView(routes);
    const collapsed = collapsePolicyStacks(view.nodes, view.edges, new Set());
    const [stack] = stacks(collapsed.nodes);
    const at = (n: Node, y: number) => ({ ...n, position: { x: 500, y } });
    const before = collapsed.nodes.map((n) => at(n, n === stack ? 100 : 0));
    const after = view.nodes.map((n, i) => at(n, i * 10));
    const y = (id: string) => after.find((n) => n.id === id)!.position.y;

    expect(stackAnchors(after, before).get("policy-ssh")).toEqual({
      x: 500,
      y: 100,
    });
    expect(stackAnchors(before, after).get(stack.id)).toEqual({
      x: 500,
      y: (y("policy-ssh") + y("policy-https") + y("policy-rdp")) / 3,
    });
    expect(stackAnchors(after, before).has("policy-postgres")).toBe(false);
  });
});
