import { type Node } from "@xyflow/react";
import { ChevronsUpDownIcon } from "lucide-react";
import * as React from "react";
import { PolicyPill } from "@/modules/control-center/nodes/PolicyPill";
import { type PolicyStackData } from "@/modules/control-center/utils/policy-stacks";

type PolicyStackNode = Node<PolicyStackData, "policyStackNode">;

export const PolicyStackNode = ({ data }: PolicyStackNode) => (
  <PolicyPill
    data-testid={"cc-policy-stack"}
    title={data.policies.map((p) => p.rules?.[0]?.name ?? p.name).join("\n")}
    active={data.policies.some((p) => p.rules?.[0]?.enabled)}
    className={
      "shadow-[0_3px_0_-1px_var(--color-nb-gray-940),0_3px_0_0_var(--color-nb-gray-850)]"
    }
    label={`${data.policies.length} policies`}
    aside={
      <span className={"flex items-center gap-1 font-sans"}>
        <ChevronsUpDownIcon size={12} />
        Expand
      </span>
    }
  />
);
