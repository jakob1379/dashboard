import { cn } from "@utils/helpers";
import { Handle, Position } from "@xyflow/react";
import * as React from "react";

type Props = {
  active?: boolean;
  label: React.ReactNode;
  aside: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>;

// The policy pill shared by a single policy and a stack of them.
export const PolicyPill = ({
  active,
  label,
  aside,
  className,
  children,
  ...props
}: Props) => (
  <div
    {...props}
    className={cn(
      "relative group/node bg-nb-gray-940 hover:bg-nb-gray-930 hover:border-nb-gray-800 cursor-pointer border border-nb-gray-850 rounded-full flex justify-between transition-all",
      !active && "opacity-60",
      className,
    )}
  >
    <div className={"flex items-center justify-center"}>
      <div
        className={cn(
          "h-2 w-2 rounded-full ml-3 mr-2",
          active ? "bg-green-400" : "bg-nb-gray-400",
        )}
      ></div>
    </div>
    <div className={"pt-2.5 pb-[0.6rem] pr-3 flex gap-4 leading-none"}>
      <div
        className={
          " text-nb-gray-200 font-normal whitespace-nowrap text-[0.8rem] flex items-center justify-center w-full"
        }
      >
        {label}
      </div>
    </div>
    <div
      className={
        "border-l border-nb-gray-800 flex items-center text-nb-gray-300 text-[0.65rem] pl-2 pr-3 font-mono"
      }
    >
      <div>{aside}</div>
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
    {children}
  </div>
);
