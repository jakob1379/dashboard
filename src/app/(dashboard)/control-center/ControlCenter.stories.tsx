import type { Meta } from "@storybook/nextjs-vite";
import { fireEvent, screen, userEvent } from "storybook/test";
import ControlCenterPage from "@/app/(dashboard)/control-center/page";
import {
  click,
  inLayout,
  nav,
  resetStorage,
  type Story,
  until,
} from "@/storybook/core";
import { GROUP, group } from "@/storybook/fixtures";
import { settle } from "@/storybook/wait";

const meta: Meta = {
  title: "Pages/Core/ControlCenter",
  parameters: nav("/control-center"),
  beforeEach: resetStorage,
  render: inLayout(ControlCenterPage),
};
export default meta;

const byTestId = (id: string) =>
  screen.findByTestId(id, {}, { timeout: 10_000 });

/* The canvas fits its viewport after the nodes are measured; wait until
   React Flow has rendered nodes and the pre-fit hiding class is gone. */
const canvasReady = async () => {
  await until(() => {
    const nodes = document.querySelectorAll(".react-flow__node");
    if (nodes.length === 0) throw new Error("no nodes yet");
    if (document.querySelector(".cc-prefit"))
      throw new Error("viewport not fitted yet");
  });
  // Camera easing can outlast the pre-fit class; let the transform settle
  // before a story samples node coordinates for a panel or context menu.
  await settle(1500);
};

/* The draft toolbar slides in under the pointer; park the pointer and give
   the canvas a moment so the shot never catches a tool in hover state. */
const draftReady = async () => {
  await byTestId("cc-toolbar-add");
  await canvasReady();
  await userEvent.pointer({ coords: { clientX: 1, clientY: 1 } });
  await settle(1000);
};

const liveReady = async () => {
  await byTestId("cc-flow-peers");
  await canvasReady();
};

const view = (tab: string): Story => ({
  parameters: nav("/control-center", { tab }),
  play: liveReady,
});

export const PeersView = view("peers");
export const UsersView = view("users");
export const GroupsView = view("groups");
export const NetworksView = view("networks");
export const CloudPeersView: Story = { ...view("peers"), tags: ["cloud"] };

/* Policies arrive interleaved by destination; the layout must group them so
   no policy → destination edge crosses another. */
const sharedDestinationPolicies = (
  [
    ["Developers SSH", GROUP.servers, ["22"]],
    ["Developers HTTPS", GROUP.servers, ["443"]],
    ["Postgres", GROUP.databases, ["5432"]],
    ["Ops RDP", GROUP.servers, ["3389"]],
    ["Redis", GROUP.databases, ["6379"]],
    ["Kube API", GROUP.kubernetes, ["6443"]],
    ["Servers to Servers", GROUP.servers, ["8080"]],
  ] as const
).map(([name, destination, ports], i) => ({
  id: `pol-shared-${i}`,
  name,
  description: "",
  enabled: true,
  source_posture_checks: [],
  rules: [
    {
      name,
      description: "",
      enabled: true,
      action: "accept",
      bidirectional: false,
      protocol: "tcp",
      ports: [...ports],
      sources: [group(GROUP.all)],
      destinations: [group(destination)],
    },
  ],
}));

export const PeersViewSharedDestinations: Story = {
  ...view("peers"),
  parameters: {
    ...nav("/control-center", { tab: "peers" }),
    api: { "GET /policies": sharedDestinationPolicies },
  },
};

export const DraftModeChooser: Story = {
  play: async () => {
    await liveReady();
    await click(byTestId("cc-mode-draft"));
    await byTestId("cc-draft-use-current-option");
  },
};

export const DraftMode: Story = {
  play: async () => {
    await liveReady();
    await click(byTestId("cc-mode-draft"));
    await click(byTestId("cc-draft-use-current-option"));
    await draftReady();
  },
};

export const DraftAddMenu: Story = {
  play: async () => {
    await liveReady();
    await click(byTestId("cc-mode-draft"));
    await click(byTestId("cc-draft-use-current-option"));
    await draftReady();
    await click(byTestId("cc-toolbar-add"));
    await screen.findByPlaceholderText(
      /Search components/,
      {},
      { timeout: 10_000 },
    );
  },
};

export const NodeContextMenu: Story = {
  play: async () => {
    await liveReady();
    const node = document.querySelectorAll(".react-flow__node")[0];
    const rect = node.getBoundingClientRect();
    fireEvent.contextMenu(node.firstElementChild ?? node, {
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
    });
    await byTestId("cc-node-context-menu");
  },
};
