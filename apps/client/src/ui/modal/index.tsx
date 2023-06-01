import hotkeys from "hotkeys-js";
import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import { useAtom, useAtomValue } from "jotai";
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  restrictToHorizontalAxis,
  restrictToWindowEdges,
} from "@dnd-kit/modifiers";

import { modalOpenAtom, modalPageIndexAtom, isMobileAtom } from "atoms";
import { Separator, Page } from "ui";

function Modal({ id, length }: { id: string; length: number }) {
  const isMobile = useAtomValue(isMobileAtom);
  const [open, setOpen] = useAtom(modalOpenAtom);
  const [pageIndex, setPageIndex] = useAtom(modalPageIndexAtom);

  const [x, setX] = useState(0);

  const modalReference = useRef<HTMLDivElement>();

  const distanceReference = useRef(0);

  const modifiers = [restrictToHorizontalAxis, restrictToWindowEdges];

  const sensors = useSensors(useSensor(PointerSensor));

  useEffect(
    () =>
      hotkeys("esc", () => {
        setOpen(false);
        setX(0);
      }),
    [setOpen]
  );

  return (
    <>
      {open ? (
        <DndContext
          autoScroll={false}
          sensors={sensors}
          onDragMove={({ delta }) => {
            const distance = distanceReference.current - delta.x;
            distanceReference.current = delta.x;
            setX(distance);
          }}
          onDragEnd={() => {
            distanceReference.current = 0;
          }}
          modifiers={modifiers}
        >
          <>
            <div
              ref={modalReference}
              className={clsx(
                "dark:bg-dark light:bg-neutral-300 fixed max-w-99.5% min-h-full overflow-hidden right-0 top-0 z-3",
                isMobile && "w-full"
              )}
              style={{
                width: x + modalReference?.current?.clientWidth,
              }}
            >
              <DragHandle />
              <div className="flex gap-2 p-1 pb-2">
                <button
                  className="focus:bg-red hover:bg-red i-mdi-close relative top-1"
                  title="close"
                  onPointerDown={() => {
                    setOpen(false);
                    setX(0);
                  }}
                />
                <button
                  className="focus:animate-pulse i-mdi-menu-up-outline relative top-1"
                  title="previous page"
                  disabled={pageIndex === 0}
                  onPointerDown={() => {
                    setPageIndex((previous) => previous - 1);
                  }}
                />
                <button
                  className="focus:animate-pulse i-mdi-menu-down-outline relative top-1"
                  title="next page"
                  disabled={pageIndex === length - 1}
                  onPointerDown={() => {
                    setPageIndex((previous) => previous + 1);
                  }}
                />
                <span
                  className="mt-0.5 text-xs"
                  title={`page ${pageIndex + 1} of ${length}`}
                >
                  {pageIndex + 1}/{length}
                </span>
              </div>
              <div>
                <Page id={id} />
              </div>
            </div>
          </>
        </DndContext>
      ) : undefined}
    </>
  );
}

function DragHandle() {
  const { attributes, isDragging, listeners, setNodeRef } = useDraggable({
    id: "modal-window",
  });
  // TODO fix make transition move from right (start) to left (end)
  return (
    <div className="absolute h-100vmax left--1">
      <span
        ref={setNodeRef}
        className={clsx(
          isDragging && "bg-blue-700 w-3",
          "absolute cursor-col-resize h-full w-2 z-20"
        )}
        style={{
          transitionDuration: "200ms",
          transitionProperty: "width, background-color",
          transitionTimingFunction: "linear",
        }}
        {...attributes}
        {...listeners}
      />
      <Separator
        orientation="vertical"
        className={clsx(
          "bg-neutral h-full inline-block mx-1 w-1px z-19",
          !isDragging && "left--1 "
        )}
      />
    </div>
  );
}

export default Modal;
