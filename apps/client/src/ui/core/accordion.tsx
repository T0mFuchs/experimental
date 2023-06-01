import clsx from "clsx";
import type { ReactNode } from "react";

function Accordion({
  open,
  disableAnimations,
  children,
}: {
  open: boolean;
  disableAnimations: boolean;
  children: ReactNode;
}) {
  // TODO make div fade into background after closing
  return (
    <div className="overflow-hidden">
      <div
        aria-hidden={!open}
        aria-roledescription="accordion"
        className={clsx(
          disableAnimations ? "duration-0" : "duration-250",
          "Accordion ease-in-out transform-origin-top transition-transform"
        )}
        data-state={open ? "open" : "closed"}
        style={{ position: open ? "relative" : "absolute" }}
      >
        {children}
      </div>
    </div>
  );
}

export { Accordion };
