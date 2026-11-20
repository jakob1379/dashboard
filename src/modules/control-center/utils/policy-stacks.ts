import { Edge, Node } from "@xyflow/react";
import { Policy } from "@/interfaces/Policy";

export const POLICY_STACK_MIN = 3;

export type PolicyStacksRef = { current: ReadonlySet<string> };

export type PolicyStackData = {
  stackKey: string;
  policies: Policy[];
  side?: "left";
};

/**
 * Folds every run of at least POLICY_STACK_MIN policies that share the same
 * sources, destinations AND direction into one `policyStackNode`. A run whose key is in
 * `expanded` stays unfolded and its top policy carries `data.stackKey`, so it
 * can fold the run back.
 */
export const collapsePolicyStacks = (
  nodes: Node[],
  edges: Edge[],
  expanded: ReadonlySet<string>,
): { nodes: Node[]; edges: Edge[] } => {
  const policyIds = new Set(
    nodes.filter((n) => n.type === "policyNode").map((n) => n.id),
  );
  const ins = new Map<string, string[]>();
  const outs = new Map<string, string[]>();
  edges.forEach((e) => {
    if (policyIds.has(e.target))
      ins.set(e.target, [...(ins.get(e.target) ?? []), e.source]);
    if (policyIds.has(e.source))
      outs.set(e.source, [...(outs.get(e.source) ?? []), e.target]);
  });

  const members = new Map<string, Node[]>();
  nodes.forEach((n) => {
    if (!policyIds.has(n.id)) return;
    const bidirectional = (n.data?.policy as Policy | undefined)?.rules?.[0]
      ?.bidirectional;
    const key = [
      n.data?.side ?? "",
      bidirectional ? "both" : "",
      [...new Set(ins.get(n.id))].sort().join(","),
      [...new Set(outs.get(n.id))].sort().join(","),
    ].join("|");
    members.set(key, [...(members.get(key) ?? []), n]);
  });

  const stackOf = new Map<string, Node>();
  const heads = new Map<string, string>();
  members.forEach((group, key) => {
    if (group.length < POLICY_STACK_MIN) return;
    if (expanded.has(key)) {
      heads.set(group[0].id, key);
      return;
    }
    const side = group[0].data?.side === "left" ? "left" : undefined;
    const stack: Node = {
      id: `policy-stack-${key}`,
      type: "policyStackNode",
      position: { x: 0, y: 0 },
      data: {
        stackKey: key,
        policies: group.map((n) => n.data.policy as Policy),
        ...(side && { side }),
      } satisfies PolicyStackData,
    };
    group.forEach((n) => stackOf.set(n.id, stack));
  });
  if (stackOf.size === 0 && heads.size === 0) return { nodes, edges };

  // The stack takes its first member's slot, which keeps the enabled order.
  const placed = new Set<string>();
  const stackedNodes = nodes.flatMap((n) => {
    const head = heads.get(n.id);
    if (head) return [{ ...n, data: { ...n.data, stackKey: head } }];
    const stack = stackOf.get(n.id);
    if (!stack) return [n];
    if (placed.has(stack.id)) return [];
    placed.add(stack.id);
    return [stack];
  });

  const kept: Edge[] = [];
  const merged = new Map<string, Edge>();
  edges.forEach((e) => {
    const source = stackOf.get(e.source)?.id ?? e.source;
    const target = stackOf.get(e.target)?.id ?? e.target;
    if (source === e.source && target === e.target) {
      kept.push(e);
      return;
    }
    const id = `${source}->${target}`;
    const enabled =
      !!merged.get(id)?.data?.enabled || (e.data?.enabled ?? true) !== false;
    merged.set(id, { ...e, id, source, target, data: { ...e.data, enabled } });
  });

  return { nodes: stackedNodes, edges: [...kept, ...merged.values()] };
};

const memberIds = (stack: Node) =>
  (stack.data.policies as Policy[]).map((p) => `policy-${p.id}`);

/**
 * Where each node of `from` that is missing in `to` sits in `to`: a stack at
 * the centre of the policies it unfolded into, a policy at the stack it folded
 * into. Feeds `tweenLayout` both ways (enter: new → old, exit: old → new).
 */
export const stackAnchors = (from: Node[], to: Node[]) => {
  const pos = new Map(to.map((n) => [n.id, n.position]));
  const stacks = to.filter((n) => n.type === "policyStackNode");
  const anchors = new Map<string, { x: number; y: number }>();
  from.forEach((n) => {
    if (pos.has(n.id)) return;
    const counterparts =
      n.type === "policyStackNode"
        ? memberIds(n)
        : n.type === "policyNode"
        ? stacks.filter((s) => memberIds(s).includes(n.id)).map((s) => s.id)
        : [];
    const points = counterparts.flatMap((id) => pos.get(id) ?? []);
    if (points.length === 0) return;
    anchors.set(n.id, {
      x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
      y: points.reduce((sum, p) => sum + p.y, 0) / points.length,
    });
  });
  return anchors;
};
