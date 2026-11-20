import { Node } from "@xyflow/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { REVEAL, tweenLayout } from "./canvas-transition";

const node = (id: string, y: number): Node => ({
  id,
  position: { x: 500, y },
  data: {},
});

describe("tweenLayout", () => {
  let pane: HTMLElement;

  beforeEach(() => {
    vi.useFakeTimers();
    pane = document.createElement("div");
    pane.className = "react-flow";
    document.body.appendChild(pane);
  });
  afterEach(() => {
    pane.remove();
    vi.useRealTimers();
  });

  const anchors = {
    enter: new Map([
      ["a", { x: 500, y: 100 }],
      ["b", { x: 500, y: 100 }],
    ]),
    exit: new Map([["stack", { x: 500, y: 30 }]]),
  };
  const prev = [node("stack", 100), node("kube", 200)];
  const next = [node("a", 0), node("b", 60), node("kube", 300)];
  const at = (call: Node[], id: string) => call.find((n) => n.id === id)!;

  it("moves to the target in one commit, then drops the leaving nodes", () => {
    let state: Node[] = [];
    const setNodes = vi.fn((v: Node[] | ((nodes: Node[]) => Node[])) => {
      state = typeof v === "function" ? v(state) : v;
    });
    tweenLayout(prev, next, anchors, setNodes);

    expect(pane.classList.contains("cc-layout-tween")).toBe(true);
    const moving = setNodes.mock.calls[0][0] as Node[];
    expect(at(moving, "kube").position.y).toBe(300);
    // A new node sits at its target and enters from its anchor.
    expect(at(moving, "a")).toMatchObject({
      position: { y: 0 },
      className: "cc-node-enter",
      style: { "--cc-enter-x": "0px", "--cc-enter-y": "100px" },
    });
    expect(at(moving, "stack")).toMatchObject({
      position: { y: 30 },
      style: { opacity: 0 },
    });

    vi.advanceTimersByTime(REVEAL);
    expect(state).toEqual(next);
    expect(setNodes).toHaveBeenCalledTimes(2);
    expect(pane.classList.contains("cc-layout-tween")).toBe(false);
  });

  it("stops a running tween when a new one starts", () => {
    const first = vi.fn();
    const second = vi.fn();
    tweenLayout(prev, next, anchors, first);
    tweenLayout(next, prev, { enter: new Map(), exit: new Map() }, second);
    vi.advanceTimersByTime(REVEAL);
    expect(first).toHaveBeenCalledTimes(1);
    expect(second.mock.calls[0][0]).toEqual(prev);
    let state = second.mock.calls[0][0] as Node[];
    second.mock.calls.slice(1).forEach(([v]) => {
      state = typeof v === "function" ? v(state) : v;
    });
    expect(state).toEqual(prev);
  });

  it("never overwrites nodes that replaced its own while it ran", () => {
    let state: Node[] = [];
    const setNodes = (v: Node[] | ((nodes: Node[]) => Node[])) => {
      state = typeof v === "function" ? v(state) : v;
    };
    tweenLayout(prev, next, anchors, setNodes);
    const other = [node("other-view", 0)];
    setNodes(other);
    vi.advanceTimersByTime(REVEAL);
    expect(state).toBe(other);
  });

  it("keeps changes made to an entering node while it ran", () => {
    let state: Node[] = [];
    const setNodes = (v: Node[] | ((nodes: Node[]) => Node[])) => {
      state = typeof v === "function" ? v(state) : v;
    };
    tweenLayout(prev, next, anchors, setNodes);
    setNodes((nodes) =>
      nodes.map((n) =>
        n.id === "a" ? { ...n, style: { ...n.style, opacity: 0.5 } } : n,
      ),
    );
    vi.advanceTimersByTime(REVEAL);
    expect(at(state, "a")).toMatchObject({ style: { opacity: 0.5 } });
    expect(at(state, "a").className).toBeUndefined();
    expect(at(state, "a").style).not.toHaveProperty("--cc-enter-x");
  });
});
