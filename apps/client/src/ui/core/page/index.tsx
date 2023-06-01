export * from "./content";
export * from "./new";
import AutosizeInput from "react-input-autosize";
import AutosizeTextarea from "react-textarea-autosize";
import hotkeys from "hotkeys-js";
import { lazy, useEffect, useRef, useState, forwardRef, Suspense } from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { focusAtom } from "jotai-optics";

import { useVirtualizer } from "@tanstack/react-virtual";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  useDndContext,
  useSensor,
  useSensors,
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
} from "@dnd-kit/core";
import {
  arrayMove,
  sortableKeyboardCoordinates,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS, isKeyboardEvent } from "@dnd-kit/utilities";

import {
  socketAtom,
  subscribedFolderAtom,
  disableAnimationsAtom,
  modalOpenAtom,
  modalPageIndexAtom,
  pageAtomFamily,
  contentAtomFamily,
} from "atoms";
import { Accordion, ContentOverlay, SortableContent, NewContent } from "ui";
import { useDebounce } from "hooks";
import { Position, splitStringAt } from "utils";

import type { CSSProperties } from "react";
import type {
  DragStartEvent,
  DragEndEvent,
  UniqueIdentifier,
} from "@dnd-kit/core";
import type { Page as PageContent, Content } from "@packages/types";
import type { SortableItem } from "types";
import clsx from "clsx";

const AlertDialog = lazy(() => import("ui/alert-dialog"));
const ContextMenu = lazy(() => import("ui/context-menu"));

export const Page = forwardRef<HTMLLIElement, SortableItem>(function Page(
  {
    id,
    active,
    attributes,
    clone,
    insertPosition,
    listeners,
    style,
    hasFocus = false,
  },
  reference
) {
  const socket = useAtomValue(socketAtom);
  const [subscribedFolder, setSubscribedFolder] = useAtom(subscribedFolderAtom);
  const disableAnimations = useAtomValue(disableAnimationsAtom);
  const pageAtom = pageAtomFamily({ id });
  pageAtom.onMount = () => {
    socket.send(
      JSON.stringify({
        type: "page_get",
        payload: id,
      })
    );
  }
  const [syncedName, setSyncedName] = useState(undefined as string | undefined);
  const nameAtom = focusAtom(pageAtom, (optic) => optic.prop("name"));
  const contentAtom = focusAtom(pageAtom, (optic) => optic.prop("content"));
  const [page, setPage] = useAtom(pageAtom);
  const [accordionIsOpen, setAccordionIsOpen] = useState(false);
  const [previewAccordionOpen, setPreviewAccordionOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [openContext, setOpenContext] = useState(false);
  const setContent = useSetAtom(contentAtom);
  const setName = useSetAtom(nameAtom);
  const setModalPageIndex = useSetAtom(modalPageIndexAtom);
  const setModalOpen = useSetAtom(modalOpenAtom);
  const debouncedName = useDebounce(page.name);

  const virtualizerReference = useRef<HTMLUListElement>();
  const virtualizer = useVirtualizer({
    count: page?.content?.length || 0,
    getScrollElement: () => virtualizerReference.current,
    estimateSize: () => 15,
    overscan: 20,
  });
  const sensors = useSensors(
    useSensor(MouseSensor),
    useSensor(TouchSensor, {
      activationConstraint: {
        distance: 2,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  const [pointerDown, setPointerDown] = useState<{
    timeStamp: number;
    clientX: number;
    clientY: number;
  }>();
  // eslint-disable-next-line unicorn/no-null
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [lastDragged, setLastDragged] = useState<string | undefined>(
    // eslint-disable-next-line unicorn/no-useless-undefined
    undefined
  );

  const inputReference = useRef<HTMLInputElement>();

  useEffect(() => {
    if (hasFocus) {
      inputReference.current?.focus();
    }
  }, [inputReference, hasFocus]);

  useEffect(() => {
    if (!page.name || !syncedName) return;
    if (page.name !== syncedName && page.name === debouncedName) {
      socket.send(
        JSON.stringify({
          type: "page_update",
          payload: {
            folderId: subscribedFolder.id,
            pageId: id,
            args: {
              name: page.name,
            },
          },
        })
      );
    }
  }, [page.name, debouncedName, syncedName, socket, subscribedFolder?.id, id]);

  // #v-ifdef DEV
  useEffect(() => console.log("page", page, "id", id), [page, id]);
  // #v-endif

  useEffect(() =>
    hotkeys("ctrl+alt+c, command+alt+c", () => setAccordionIsOpen(false))
  );

  useEffect(() => {
    if (!socket) return;
    const listener = (event: MessageEvent) => {
      const data = event.data as string;
      if (data === "keep-alive") return;
      const { type, payload } = JSON.parse(data);
      switch (type) {
        case "get_page": {
          if (payload.id !== id) return;
          setPage(payload as PageContent);
          setSyncedName(payload.name);
          break;
        }
        case "update_page": {
          const { pageId, args } = payload as {
            pageId: string;
            args: { name?: string; content?: string[] };
          };
          if (pageId !== id) return;
          if (args.name) setName(args.name);
          if (args.content) setContent(args.content);
          // console.log("update_page", payload);
          break;
        }
        case "add_content": {
          const { pageId, args } = payload as {
            pageId: string;
            args: Content;
          };
          if (pageId !== id) return;
          contentAtomFamily(args);
          setContent((previous) => [...(previous || []), args.id]);
          //  #v-ifdef DEV
          console.log("add_content", payload);
          //  #v-endif
          break;
        }
        case "remove_content": {
          const { pageId, contentId } = payload as {
            pageId: string;
            contentId: string;
          };
          if (pageId !== id) return;
          // eslint-disable-next-line unicorn/prevent-abbreviations
          setContent((previous) => previous.filter((i) => i !== contentId));
          contentAtomFamily.remove({ id: contentId });
          break;
        }
        case "insert_content": {
          const { pageId, contentIds, args } = payload as {
            pageId: string;
            contentIds: string[];
            args: Content;
          };
          if (pageId !== id) return;
          contentAtomFamily(args);
          setContent(contentIds);
          // console.log("insert_content", payload);
          break;
        }
        default: {
          return;
        }
      }
    };
    socket.addEventListener("message", listener);

    return () => {
      socket.removeEventListener("message", listener);
    };
  }, [
    socket,
    id,
    subscribedFolder.id,
    page,
    setPage,
    setName,
    setContent,
    setSubscribedFolder,
  ]);

  return (
    <>
      <Suspense fallback={<></>}>
        <AlertDialog
          actionText="confirm-delete"
          callbackFunction={() => {
            for (const id of page.content) {
              socket.send(
                JSON.stringify({
                  type: "content_remove",
                  payload: {
                    folderId: subscribedFolder.id,
                    pageId: page.id,
                    contentIds: page.content.slice(page.content.indexOf(id)),
                    contentId: id,
                  },
                })
              );
            }
            socket.send(
              JSON.stringify({
                type: "page_remove",
                payload: {
                  folderId: subscribedFolder.id,
                  pageIds: subscribedFolder.page_ids,
                  pageId: page.id,
                },
              })
            );
          }}
          checkbox
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          disableAnimations={disableAnimations}
        >
          <h4>
            <div>"{syncedName || "untitled"}" is not empty,</div>
            <div>
              {page?.content?.length}{" "}
              {"item" + (page?.content?.length === 1 ? "" : "s")} will be
              deleted
            </div>
          </h4>
          <div onPointerDown={() => setPreviewAccordionOpen((open) => !open)}>
            {previewAccordionOpen ? "hide" : "show"}
          </div>
          <div>
            <Accordion
              open={previewAccordionOpen}
              disableAnimations={disableAnimations}
            >
              {page?.content?.map((id) => {
                const contentAtom = contentAtomFamily({ id: id });
                return <PreviewContent contentAtom={contentAtom} />;
              })}
            </Accordion>
          </div>
        </AlertDialog>
      </Suspense>
      <li
        ref={reference}
        style={style}
        className={clsx(
          "mb-0.5 p-1 pb-1.25",
          active && "opacity-50",
          clone && "opacity-67",
          insertPosition === Position.Before &&
            "rounded-0.5 border-solid border-0 border-t-1 border-blue-700",
          insertPosition === Position.After &&
            "rounded-0.5 border-solid border-0 border-b-1 border-blue-700"
        )}
        onContextMenu={(event) => event.preventDefault()}
        onPointerDown={(event) => {
          if (!openContext)
            setPointerDown({
              timeStamp: event.timeStamp,
              clientX: event.clientX,
              clientY: event.clientY,
            });
        }}
        onPointerUp={(event) => {
          if (!pointerDown) return;
          if (
            event.button === 2 ||
            pointerDown.timeStamp < event.timeStamp - 1000
          )
            setOpenContext(true);
        }}
      >
        <span
          {...attributes}
          className='focus:bg-blue-700 i-mdi-file mr-1'
          style={{ touchAction: "manipulation" }}
          {...listeners}
        />
        <AutosizeInput
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          ref={inputReference}
          value={page?.name || ""}
          inputClassName="border-transparent rounded"
          minWidth={100}
          maxLength={40}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            const { key, currentTarget } = event;
            if (page.name === "" && (key === "Backspace" || key === "Enter")) {
              return page?.content.length < 1
                ? socket.send(
                    JSON.stringify({
                      type: "page_remove",
                      payload: {
                        folderId: subscribedFolder.id,
                        pageIds: subscribedFolder.page_ids,
                        pageId: page.id,
                      },
                    })
                  )
                : setConfirmDelete(true);
            }
            const { selectionStart } = currentTarget;
            if (
              key === "Enter" ||
              (key === "Backspace" && selectionStart === 0)
            ) {
              event.preventDefault();
              const [before, after] = splitStringAt(page.name, selectionStart);
              if (key === "Enter") {
                return socket.send(
                  JSON.stringify({
                    type: "page_insert_after",
                    payload: {
                      folderId: subscribedFolder.id,
                      pageId: page.id,
                      updateName: before,
                      pageIds: subscribedFolder.page_ids,
                      args: {
                        name: after,
                        content: [],
                      },
                    },
                  })
                );
              }

              if (key === "Backspace" && selectionStart === 0) {
                return socket.send(
                  JSON.stringify({
                    type: "page_merge",
                    payload: {
                      folderId: subscribedFolder.id,
                      previousId: page.id,
                      targetId:
                        subscribedFolder.page_ids[
                          subscribedFolder.page_ids.indexOf(page.id)
                        ],
                      pageIds: subscribedFolder.page_ids,
                      args: {
                        name: after,
                        content: page.content,
                      },
                    },
                  })
                );
              }
            }
          }}
        />
        <button
          onKeyDown={(event) => {
            if (event.key === "Enter")
              setAccordionIsOpen((previous) => !previous);
          }}
          onPointerDown={() => setAccordionIsOpen((previous) => !previous)}
          className={`i-mdi-chevron-down transform-gpu 
                  focus:animate-pulse hover:animate-pulse ml-0.5 mb-0.5
                  ${disableAnimations ? "duration-100" : "duration-350"} 
                  ${accordionIsOpen ? "rotate--180" : undefined}
                `}
        />
        <Suspense fallback={<div>hydrating Content</div>}>
          <Accordion
            open={accordionIsOpen}
            disableAnimations={disableAnimations}
          >
            <DndContext
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragCancel={handleDragCancel}
              onDragEnd={handleDragEnd}
              sensors={sensors}
            >
              <SortableContext
                items={page?.content || []}
                strategy={verticalListSortingStrategy}
              >
                {virtualizer.getVirtualItems().map(({ key, index }) => {
                  const id = page?.content[index];
                  if (!id || id === "") return;
                  return (
                    <SortableContent
                      key={key}
                      id={id}
                      pageId={page.id}
                      pageContent={page.content}
                      activeIndex={
                        activeId ? page.content.indexOf(activeId as string) : -1
                      }
                    />
                  );
                })}
              </SortableContext>
              <DragOverlay>
                {activeId ? (
                  <ContentOverlay
                    pageId={page.id}
                    pageContent={page.content}
                    id={activeId as string}
                    items={page.content}
                  />
                ) : undefined}
              </DragOverlay>
            </DndContext>
            <NewContent pageId={page.id} pageContent={page.content} />
          </Accordion>
          <ContextMenu
            clientX={pointerDown?.clientX || 0}
            clientY={pointerDown?.clientY || 0}
            onOpenChange={setOpenContext}
            open={openContext}
          >
            <div className="flex flex-col gap-1">
              <button
                onPointerDown={() => {
                  setModalPageIndex(
                    subscribedFolder?.page_ids?.indexOf(page.id)
                  );
                  setModalOpen(true);
                  setOpenContext(false);
                }}
              >
                open
              </button>
              <button
                onPointerDown={() => {
                  setConfirmDelete(true);
                  setOpenContext(false);
                }}
              >
                delete
              </button>
            </div>
          </ContextMenu>
        </Suspense>
      </li>
    </>
  );
  function handleDragStart({ active }: DragStartEvent) {
    setActiveId(active.id);
  }
  function handleDragCancel() {
    // eslint-disable-next-line unicorn/no-null
    setActiveId(null);
  }
  function handleDragEnd({ over }: DragEndEvent) {
    if (!activeId || !over || activeId === over.id) return;
    const previousIndex = page.content.indexOf(activeId as string);
    const nextIndex = page.content.indexOf(over.id as string);
    socket.send(
      JSON.stringify({
        type: "page_update",
        payload: {
          folderId: subscribedFolder.id,
          pageId: id,
          args: {
            content: arrayMove(page.content, previousIndex, nextIndex),
          },
        },
      })
    );
    setLastDragged(activeId as string);
    // eslint-disable-next-line unicorn/no-null
    setActiveId(null);
  }
});

function PreviewContent({ contentAtom }: { contentAtom: any }) {
  const content = useAtomValue(contentAtom);

  return (
    <AutosizeTextarea
      className="bg-transparent border-0 w-full"
      placeholder="empty"
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      value={content?.value}
    />
  );
}

export function SortablePage({
  id,
  activeIndex,
}: {
  id: string;
  activeIndex: number;
}) {
  const disableAnimations = useAtomValue(disableAnimationsAtom);
  const {
    attributes,
    listeners,
    index,
    isDragging,
    isSorting,
    over,
    setNodeRef,
    transition,
    transform,
  } = useSortable({
    id: id,
    animateLayoutChanges: function () {
      //? always animate layout changes
      return true;
    },
  });
  const style: CSSProperties = {
    transition: disableAnimations ? undefined : transition,
    transform: isSorting ? undefined : CSS.Translate.toString(transform),
  };
  return (
    <Page
      id={id}
      active={isDragging}
      attributes={attributes}
      listeners={listeners}
      ref={setNodeRef}
      style={style}
      insertPosition={
        // prettier-ignore
        over?.id === id
        ? (index > activeIndex
            ? Position.After
            : Position.Before)
          : undefined
      }
    />
  );
}

export function PageOverlay({
  id,
  items,
}: {
  id: string;
  items: UniqueIdentifier[];
}) {
  const { activatorEvent, over } = useDndContext();
  const isKeyboardSorting = isKeyboardEvent(activatorEvent);
  const activeIndex = items.indexOf(id);
  const overIndex = over?.id ? items.indexOf(over?.id) : -1;

  return (
    <Page
      id={id}
      clone
      insertPosition={
        // prettier-ignore
        isKeyboardSorting && overIndex !== activeIndex
          ? (overIndex > activeIndex
            ? Position.After
            : Position.Before)
          : undefined
      }
    />
  );
}

export default Page;
