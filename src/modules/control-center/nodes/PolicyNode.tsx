import { SmallBadge } from "@components/ui/SmallBadge";
import { cn } from "@utils/helpers";
import { type Node, Position, useConnection } from "@xyflow/react";
import { ChevronsDownUpIcon } from "lucide-react";
import * as React from "react";
import { Policy } from "@/interfaces/Policy";
import { useIsContextMenuTarget } from "@/modules/control-center/contexts/ControlCenterContext";
import { useDraftMode } from "@/modules/control-center/draft/DraftModeContext";
import { ConnectHandle } from "@/modules/control-center/handles/ConnectHandle";
import { FullAreaTargetHandle } from "@/modules/control-center/handles/FullAreaTargetHandle";
import { PolicyPill } from "@/modules/control-center/nodes/PolicyPill";
import { getPolicyProtocolAndPortText } from "@/modules/control-center/utils/helpers";

type PolicyNode = Node<
  {
    policy: Policy;
    stackKey?: string;
  },
  "policyNode"
>;

export const PolicyNode = ({ data, id }: PolicyNode) => {
  const rule = data.policy.rules?.[0];
  const label = getPolicyProtocolAndPortText(data.policy);
  const { isDraft } = useDraftMode();
  const isDropTarget = useConnection(
    (c) => c.inProgress && c.fromNode?.id !== id,
  );

  const showHalo = useIsContextMenuTarget(id);

  return (
    <PolicyPill
      active={rule?.enabled}
      className={cn(
        isDraft &&
          isDropTarget &&
          "hover:bg-nb-gray-930 hover:ring-2 ring-white",
        showHalo && "ring-2 ring-sky-500",
      )}
      label={
        <>
          <div className={"truncate max-w-[200px]"}>{rule?.name}</div>
          {String(data.policy.id ?? "").startsWith("new-") && (
            <SmallBadge className={"ml-1.5"} />
          )}
        </>
      }
      aside={label === "" ? "All" : label}
    >
      {data.stackKey && (
        <button
          type={"button"}
          data-cc-stack-toggle
          data-testid={"cc-policy-stack-collapse"}
          className={
            "absolute -top-6 left-2 flex items-center gap-1 text-[0.65rem] text-nb-gray-400 hover:text-nb-gray-200 transition-colors"
          }
        >
          <ChevronsDownUpIcon size={12} />
          Collapse
        </button>
      )}

      {/* Dragging right adds the target group as a destination, left as a
          source. */}
      {isDraft && (
        <>
          <ConnectHandle type={"source"} position={Position.Left} />
          <ConnectHandle type={"source"} position={Position.Right} />
          <FullAreaTargetHandle isConnectable={isDropTarget} />
        </>
      )}
    </PolicyPill>
  );
};
