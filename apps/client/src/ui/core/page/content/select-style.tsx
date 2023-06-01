import clsx from "clsx";
import { useEffect, useRef, useState } from "react";

import { useOnClickOutside } from "hooks";

//! relative pathing in vite build breaks here ...
// TODO replace styleSchema with a dynamic import | when pathing works again
const styleSchema = {
	// default
	d: "none",
	// headings
	h1: "heading 1",
	h2: "heading 2",
	h3: "heading 3",
	// text
	b: "bold",
	i: "italic",
	u: "underline",
} as const;


import type { SetStateAction } from "jotai";
import type { ContentStyle } from "@packages/types";

interface Properties {
  style: string;
  setStyle: (
    // eslint-disable-next-line unicorn/prevent-abbreviations
    args: SetStateAction<ContentStyle>
  ) => void;
  callbackFunction: () => void;
}

const styleKeys = Object.keys(styleSchema);
const styleValues = Object.values(styleSchema);

function SelectStyle({ style, setStyle, callbackFunction }: Properties) {
  const reference = useRef<HTMLDivElement>();
  useOnClickOutside(reference, () => {
    callbackFunction();
  });
  const [arrowPosition, setArrowPosition] = useState(styleKeys.indexOf(style));
  return (
    <div
      ref={reference}
      className="flex flex-col gap-1"
      onKeyDown={(event) => {
        if (event.key === "Escape") callbackFunction();
      }}
    >
      <label className="font-700 text-neutral text-xs underline">styles</label>
      {styleKeys.map((styleKey, index) => (
        <Item key={index} styleKey={styleKey} index={index} />
      ))}
    </div>
  );
  function Item({ styleKey, index }) {
    const itemReference = useRef<HTMLButtonElement>();
    useEffect(() => {
      if (arrowPosition === index) itemReference.current.focus();
    }, [index]);
    return (
      <button
        ref={itemReference}
        onFocus={() => setArrowPosition(index)}
        className={clsx(
          "bg-transparent border-0",
          arrowPosition === index && "text-cyan-8"
        )}
        onClick={() => {
          setStyle(styleKey as any);
          callbackFunction();
        }}
        onKeyDown={(event) => {
          const { key } = event;
          if (key === "Enter") {
            setStyle(styleKey as any);
            callbackFunction();
          }
          if (key === "ArrowDown")
            setArrowPosition(index + 1 === styleKeys.length ? 0 : index + 1);
          if (key === "ArrowUp")
            setArrowPosition(
              index - 1 === -1 ? styleKeys.length - 1 : index - 1
            );
        }}
      >
        {styleValues[index]}
        {style === styleKey ? (
          <div
            className={clsx(
              "absolute inline-block right-2 text-neutral text-2/3"
            )}
          >
            <span className="bg-red i-mdi-chevron-left text-size-4.5" />
            selected
          </div>
        ) : undefined}
      </button>
    );
  }
}

export { SelectStyle };
