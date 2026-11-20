import { cn } from "@utils/helpers";
import { Handle, type Node, Position } from "@xyflow/react";
import { ChevronsUpDownIcon } from "lucide-react";
import * as React from "react";
import { type PolicyStackData } from "@/modules/control-center/utils/policy-stacks";

type PolicyStackNode = Node<PolicyStackData, "policyStackNode">;

export const PolicyStackNode = ({ data }: PolicyStackNode) => {
  const isActive = data.policies.some((p) => p.enabled);
  const names = data.policies.map((p) => p.rules?.[0]?.name ?? p.name);

  return (
    <div
      data-testid={"cc-policy-stack"}
      title={names.join("\n")}
      className={cn(
        "relative bg-nb-gray-940 hover:bg-nb-gray-930 hover:border-nb-gray-800 cursor-pointer border border-nb-gray-850 rounded-full flex justify-between transition-all",
        "shadow-[0_3px_0_-1px_var(--color-nb-gray-940),0_3px_0_0_var(--color-nb-gray-850)]",
        !isActive && "opacity-60",
      )}
    >
      <div className={"flex items-center justify-center"}>
        <div
          className={cn(
            "h-2 w-2 rounded-full ml-3 mr-2",
            isActive ? "bg-green-400" : "bg-nb-gray-400",
          )}
        ></div>
      </div>
      <div
        className={
          "pt-2.5 pb-[0.6rem] pr-3 text-nb-gray-200 font-normal whitespace-nowrap text-[0.8rem] leading-none"
        }
      >
        {data.policies.length} policies
      </div>
      <div
        className={
          "border-l border-nb-gray-800 flex items-center gap-1 text-nb-gray-300 text-[0.65rem] pl-2 pr-3"
        }
      >
        <ChevronsUpDownIcon size={12} />
        Expand
      </div>

      <Handle
        type="source"
        position={Position.Right}
        id={"sr"}
        className={"opacity-0"}
        isConnectable={false}
      />
      <Handle
        type="target"
        position={Position.Left}
        id={"tl"}
        className={"opacity-0"}
        isConnectable={false}
      />
    </div>
  );
};
