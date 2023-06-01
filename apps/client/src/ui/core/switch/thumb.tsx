import clsx from "clsx";
import { useDraggable } from "@dnd-kit/core";

import type { CSSProperties } from "react";

import styles from "./index.module.css";

function Thumb({ checked }: { checked: boolean }) {
  const { attributes, listeners, transform, setNodeRef, isDragging } =
    useDraggable({
      id: "thumb",
    });

  return (
    <span className={styles.ThumbWrapper} {...listeners}>
      <span
        {...attributes}
        ref={setNodeRef}
        className={clsx(
          styles.Thumb,
          checked ? "right-0" : "left-0",
          isDragging && "transition-200"
        )}
        style={
          {
            "--transform": (transform?.x ?? 0) + "px",
          } as CSSProperties
        }
      ></span>
    </span>
  );
}

export { Thumb };
