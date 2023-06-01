import { useRef } from "react";
import { useOnClickOutside } from "hooks";

import type { ReactNode } from "react";

interface Properties {
  children: ReactNode;
  clientX: number;
  clientY: number;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

function Popover({
  children,
  clientX,
  clientY,
  onOpenChange,
  open,
}: Properties) {
  const divReference = useRef<HTMLDivElement>();
  useOnClickOutside(divReference, () => onOpenChange(false));
  return (
    <div
      ref={divReference}
      className="absolute"
      style={{
        left: clientX,
        top: clientY,
      }}
    >
      {open ? (
        <div className='animation-timining-function-ease dark:bg-dark duration-350 flex flex-col gap-2 light:bg-light-900 min-w-50% px-2 relative right-2 rounded z-10'>
          {children}
        </div>
      ) : // eslint-disable-next-line unicorn/no-null
      null}
    </div>
  );
}

export default Popover;
