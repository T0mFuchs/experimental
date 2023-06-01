import { Position } from "utils";
import type { CSSProperties } from "react";
import type { DraggableAttributes } from "@dnd-kit/core";
import type { SyntheticListenerMap } from "@dnd-kit/core/dist/hooks/utilities";

export type SortableItem = {
  id: string;
  clone?: boolean;
  ref?: (node: HTMLElement) => void;
  style?: CSSProperties;
  listeners?: SyntheticListenerMap;
  active?: boolean;
  attributes?: DraggableAttributes;
  hasFocus?: boolean;
  insertPosition?: Position;
}