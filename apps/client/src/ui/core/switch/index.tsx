/* eslint-disable unicorn/no-null */
//? https://github.com/clauderic/dnd-kit/blob/master/stories/3%20-%20Examples/FormElements/Switch/Switch.tsx
import { useState } from "react";
import {
  DndContext,
  getClientRect,
  MeasuringConfiguration,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  restrictToHorizontalAxis,
  restrictToParentElement,
} from "@dnd-kit/modifiers";

import clsx from "clsx";
import styles from "./index.module.css";

import { State } from "./constants";
import { Track } from "./track";
import { Thumb } from "./thumb";

import type { DragEndEvent, DragOverEvent } from "@dnd-kit/core";

interface Properties {
  accessibilityLabel?: string;
  id?: string;
  label?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

const modifiers = [restrictToParentElement, restrictToHorizontalAxis];
const measuring: MeasuringConfiguration = {
  draggable: {
    measure: getClientRect,
  },
};

export function Switch({
  accessibilityLabel = "",
  label = "",
  id,
  checked,
  onChange,
}: Properties) {
  const [overId, setOverId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 2,
      },
    })
  );

  const switchMarkup = (
    <button
      id={id}
      type="button"
      className={clsx(
        styles.variables,
        styles.Switch,
      )}
      onClick={handleClick}
      aria-pressed={checked}
      aria-label={accessibilityLabel}
    >
      <Track />
      <Thumb checked={checked} />
    </button>
  );

  const markup = label ? (
    <label className={styles.Label} htmlFor={id}>
      {label}
      {switchMarkup}
    </label>
  ) : (
    switchMarkup
  );

  return (
    <DndContext
      autoScroll={false}
      measuring={measuring}
      modifiers={modifiers}
      sensors={sensors}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      {markup}
    </DndContext>
  );

  function handleClick() {
    onChange(!checked);
  }

  function handleDragOver({ over }: DragOverEvent) {
    setOverId((over?.id as string) ?? null);
  }

  function handleDragEnd({ over }: DragEndEvent) {
    if (over) {
      const checked = over.id === State.On;
      onChange(checked);
    }

    setOverId(null);
  }

  function handleDragCancel() {
    setOverId(null);
  }
}
