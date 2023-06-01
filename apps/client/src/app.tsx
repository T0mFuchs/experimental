import AutosizeInput from "react-input-autosize";
import clsx from "clsx";
import hotkeys from "hotkeys-js";
import { lazy, useEffect, useState, useRef, forwardRef, Suspense } from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { focusAtom } from "jotai-optics";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  closestCenter,
  defaultDropAnimationSideEffects,
  DndContext,
  DragOverlay,
  DropAnimation,
  useDndContext,
  useSensor,
  useSensors,
  MouseSensor,
  MeasuringStrategy,
  TouchSensor,
  KeyboardSensor,
} from "@dnd-kit/core";
import {
  arrayMove,
  useSortable,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS, isKeyboardEvent } from "@dnd-kit/utilities";
import {
  disableAnimationsAtom,
  folderAtomFamily,
  folderIdsAtom,
  modalPageIndexAtom,
  pageAtomFamily,
  isMobileAtom,
  socketAtom,
  subscribedFolderAtom,
  sidebarIsOpenAtom,
  folderToDeleteAtom,
  alertFolderDeleteAtom,
  contentAtomFamily,
} from "atoms";
import { VITE_HOST_NAME, VITE_SERVER_PORT, VITE_TLS } from "environment";
import { useDebounce } from "hooks";
import { Accordion, PageOverlay, NewPage, Separator, SortablePage } from "ui";
import { Position } from "utils";
import type { CSSProperties, HTMLAttributes } from "react";
import type {
  DragStartEvent,
  DragEndEvent,
  DraggableAttributes,
  MeasuringConfiguration,
  UniqueIdentifier,
} from "@dnd-kit/core";
import type { SyntheticListenerMap } from "@dnd-kit/core/dist/hooks/utilities";
import type { Folder, Page } from "@packages/types";

const AlertDialog = lazy(() => import("ui/alert-dialog"));
const Modal = lazy(() => import("ui/modal"));
const Settings = lazy(() => import("ui/settings"));

const measuring: MeasuringConfiguration = {
  droppable: {
    strategy: MeasuringStrategy.Always,
  },
};

export default function App() {
  const [socket, setSocket] = useAtom(socketAtom);
  const subscribedFolder = useAtomValue(subscribedFolderAtom);
  const [sidebarIsOpen, setSidebarIsOpen] = useAtom(sidebarIsOpenAtom);
  const modalPageIndex = useAtomValue(modalPageIndexAtom);

  useEffect(() => {
    if (!socket) {
      setSocket(
        new WebSocket(
          `ws${
            typeof VITE_TLS === "boolean" && VITE_TLS === true ? "s" : ""
          }://${VITE_HOST_NAME}:${VITE_SERVER_PORT}`,
          [localStorage.getItem("sub-id") ?? undefined]
        )
      );
    }
  }, [socket, setSocket]);

  return (
    <>
      <div className="flex flex-row">
        <button
          className={
            (subscribedFolder ? "" : "bg-gray cursor-not-allowed ") +
            (sidebarIsOpen
              ? "i-mdi-arrange-send-backward"
              : "i-mdi-arrange-bring-forward") +
            " absolute z-2"
          }
          onPointerDown={() => {
            if (!subscribedFolder) return;
            setSidebarIsOpen((open) => !open);
          }}
          title={(sidebarIsOpen ? "close" : "open") + " sidebar"}
          aria-label={(sidebarIsOpen ? "close" : "open") + " sidebar"}
        />
      </div>
      <main className="flex flex-row gap-2">
        <Sidebar />
        {subscribedFolder ? (
          <Pages />
        ) : (
          <h3 className="flex-1 pl-4 pt-2">select a folder</h3>
        )}
      </main>
      <Suspense
        fallback={<span className="animate-spin bg-current i-mdi-cog" />}
      >
        <Settings />
      </Suspense>
      <Suspense fallback={<></>}>
        <Modal
          id={subscribedFolder?.page_ids?.[modalPageIndex] || ""}
          length={subscribedFolder?.page_ids?.length || 0}
        />
      </Suspense>
    </>
  );
}

function Sidebar() {
  const socket = useAtomValue(socketAtom);
  const [subscribedFolder, setSubscribedFolder] = useAtom(subscribedFolderAtom);
  const disableAnimations = useAtomValue(disableAnimationsAtom);
  const [folderIds, setFolderIds] = useAtom(folderIdsAtom);
  const [sidebarIsOpen, setSidebarIsOpen] = useAtom(sidebarIsOpenAtom);
  const [folderToDelete, setFolderToDelete] = useAtom(folderToDeleteAtom);
  const [previewAccordionOpen, setPreviewAccordionOpen] = useState(false);
  const [openAlert, setOpenAlert] = useAtom(alertFolderDeleteAtom);

  const virtualizerReference = useRef<HTMLUListElement>();
  const virtualizer = useVirtualizer({
    count: folderIds.length,
    getScrollElement: () => virtualizerReference.current,
    estimateSize: () => 10,
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
  // eslint-disable-next-line unicorn/no-null
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  // eslint-disable-next-line unicorn/no-useless-undefined
  const [lastDragged, setLastDragged] = useState<string | undefined>(undefined);

  useEffect(
    () =>
      hotkeys("ctrl+alt+f, command+alt+f", () =>
        setSidebarIsOpen((open) => !open)
      ),
    [setSidebarIsOpen]
  );

  useEffect(() => {
    if (!socket) return;
    const listener = (event: MessageEvent) => {
      const data = event.data as string;
      const { type, payload } = JSON.parse(data);
      switch (type) {
        case "sub-id": {
          localStorage.setItem("sub-id", payload as string);
          break;
        }
        case "get_folder": {
          folderAtomFamily(payload as Folder);
          setFolderIds((ids) => [...ids, payload.id as string]);
          // console.log("get_folder", payload);
          break;
        }
        case "add_folder": {
          folderAtomFamily(payload as Folder);
          setFolderIds((ids) => [...ids, payload.id as string]);
          // console.log("add_folder", payload);
          break;
        }
        case "remove_folder": {
          setFolderIds((ids) => ids.filter((id) => id !== payload));
          folderAtomFamily.remove({ id: payload });
          // eslint-disable-next-line unicorn/no-useless-undefined
          if (subscribedFolder?.id === payload) setSubscribedFolder(undefined);
          
          // console.log("remove_folder", payload);
          break;
        }
        case "remove_folder*": {
          const { id, pageIds, contentIds } = payload as {
            id: string;
            pageIds: string[];
            contentIds: string[];
          };
          if (id === subscribedFolder.id) setSubscribedFolder(undefined as any);
          setFolderIds((ids) => ids.filter((folderId) => folderId !== id));
          folderAtomFamily.remove({ id });
          for (const pageId of pageIds) {
            pageAtomFamily.remove({ id: pageId });
          }
          for (const contentId of contentIds) {
            contentAtomFamily.remove({ id: contentId });
          }
          break;
        }
        case "update_folders": {
          setFolderIds(payload as string[]);
          // console.log("update_folders", payload);
          break;
        }
        case "preview_folder": {
          setFolderToDelete(payload);
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
    subscribedFolder?.id,
    setFolderIds,
    setSubscribedFolder,
    setFolderToDelete,
  ]);

  useEffect(() => {
    if (folderToDelete !== undefined) setOpenAlert(true);
  }, [folderToDelete, setOpenAlert]);

  return (
    <>
      {sidebarIsOpen ? (
        <div className="flex h-100vh overflow-y-auto Scroll">
          <Suspense fallback={<></>}>
            <AlertDialog
              actionText="delete folder anyways"
              callbackFunction={() => {
                const contentIds: string[] = [];
                for (const pageId of folderToDelete.pageIds) {
                  const { contents } = folderToDelete.summary[pageId];
                  for (const content of contents) {
                    contentIds.push(content.id);
                  }
                }
                socket.send(
                  JSON.stringify({
                    type: "folder_remove*",
                    payload: {
                      id: folderToDelete.id,
                      pageIds: folderToDelete.pageIds,
                      contentIds,
                    },
                  })
                );
                // eslint-disable-next-line unicorn/no-useless-undefined
                setFolderToDelete(undefined);
              }}
              open={openAlert}
              onOpenChange={setOpenAlert}
              disableAnimations={disableAnimations}
            >
              {folderToDelete && (
                <div>
                  <h4>
                    Directory has {folderToDelete.pageIds.length}
                    page{folderToDelete.pageIds.length === 1 ? "" : "s"}
                  </h4>
                  {/* copy chevron icon from page component */}
                  <button
                    onPointerDown={() =>
                      setPreviewAccordionOpen((open) => !open)
                    }
                  >
                    {previewAccordionOpen ? "hide" : "show"}
                  </button>
                  <Accordion open disableAnimations={disableAnimations}>
                    {folderToDelete.pageIds.map((id) => {
                      return (
                        <div>
                          <h4>
                            {folderToDelete.summary[id].name || "untitled"}
                          </h4>
                          <ul>
                            {folderToDelete.summary[id].contents.map(
                              ({ value }) => {
                                return <li>{value || "<empty>"}</li>;
                              }
                            )}
                          </ul>
                        </div>
                      );
                    })}
                  </Accordion>
                </div>
              )}
            </AlertDialog>
          </Suspense>
          <ul ref={virtualizerReference} className="pl-6 pt-4">
            <Suspense fallback={<div>hydrating folders</div>}>
              <DndContext
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragCancel={handleDragCancel}
                onDragEnd={handleDragEnd}
                sensors={sensors}
              >
                <SortableContext
                  items={folderIds}
                  strategy={verticalListSortingStrategy}
                >
                  {virtualizer.getVirtualItems().map(({ key, index }) => {
                    const id = folderIds[index];
                    if (!id || id === "") return;
                    return (
                      <SortableFolder
                        id={id}
                        key={key}
                        activeIndex={
                          activeId ? folderIds.indexOf(activeId as string) : -1
                        }
                      />
                    );
                  })}
                </SortableContext>
                <DragOverlay>
                  {activeId ? (
                    <FolderOverlay id={activeId as string} items={folderIds} />
                  ) : undefined}
                </DragOverlay>
              </DndContext>
            </Suspense>
            <NewFolder />
          </ul>
          <Separator
            className="bg-neutral h-full ml-6 w-1px"
            orientation="horizontal"
          />
        </div>
      ) : undefined}
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
    if (folderIds.length === 0) return;
    if (!over || !activeId || activeId === over.id) return;
    const previousIndex = folderIds.indexOf(activeId as string);
    const nextIndex = folderIds.indexOf(over.id as string);
    socket.send(
      JSON.stringify({
        type: "folders_update",
        payload: arrayMove(folderIds, previousIndex, nextIndex),
      })
    );
    setLastDragged(activeId as string);
    // eslint-disable-next-line unicorn/no-null
    setActiveId(null);
  }
}

function SortableFolder({
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
    <Folder
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

function FolderOverlay({
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
    <Folder
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

function NewFolder() {
  const socket = useAtomValue(socketAtom);
  const [name, setName] = useState("");

  return (
    <li className="mb-0.5 p-0.5 pb-1">
      <span className="i-mdi-folder-outline mr-1" />
      <AutosizeInput
        inputClassName="border-transparent rounded"
        minWidth={75}
        value={name}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => {
          const { key } = event;
          if (key === "Enter") {
            if (!socket) throw new Error("socket is not connected");
            socket.send(
              JSON.stringify({
                type: "folder_add",
                payload: { name },
              })
            );
            setName("");
          }
        }}
      />
    </li>
  );
}

type FolderProperties = {
  id: string;
  clone?: boolean;
  ref?: (node: HTMLElement) => void;
  style?: CSSProperties;
  listeners?: SyntheticListenerMap;
  active?: boolean;
  attributes?: DraggableAttributes;
  hasFocus?: boolean;
  insertPosition?: Position;
};

const Folder = forwardRef<HTMLLIElement, FolderProperties>(function Folder(
  // eslint-disable-next-line unicorn/prevent-abbreviations
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
  const isMobile = useAtomValue(isMobileAtom);
  const folderAtom = folderAtomFamily({ id });
  const nameAtom = focusAtom(folderAtom, (optic) => optic.prop("name"));
  const folder = useAtomValue(folderAtom);
  const [subscribedFolder, setSubscribedFolder] = useAtom(subscribedFolderAtom);
  const setSidebarIsOpen = useSetAtom(sidebarIsOpenAtom);
  const setName = useSetAtom(nameAtom);
  const debouncedName = useDebounce(folder.name);

  const syncedName = useRef(folder.name);

  useEffect(() => {
    if (folder.name !== syncedName.current && folder.name === debouncedName) {
      socket.send(
        JSON.stringify({
          type: "folder_update",
          payload: { id, name: folder.name },
        })
      );
    }
  }, [folder.name, debouncedName, socket, id]);

  return (
    <li
      className={clsx(
        "mb-0.5 p-0.5 pb-1",
        active && "opacity-50",
        clone && "opacity-67",
        insertPosition === Position.Before &&
          "rounded-0.5 border-solid border-0 border-t-1 border-blue-700",
        insertPosition === Position.After &&
          "rounded-0.5 border-solid border-0 border-b-1 border-blue-700"
      )}
      ref={reference}
      style={style}
    >
      <span
        {...attributes}
        className={clsx(
          "i-mdi-folder mr-1 focus:bg-blue-700",
          clone ? "cursor-grabbing" : "cursor-grab"
        )}
        style={{ touchAction: "manipulation" }}
        {...listeners}
      />
      <AutosizeInput
        inputClassName="border-transparent rounded"
        minWidth={75}
        value={folder.name}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => {
          const { key } = event;
          if (
            folder.name === "" &&
            (key === "Backspace" || key === "Delete" || key === "Enter")
          ) {
            if (folder.page_ids) {
              socket.send(
                JSON.stringify({
                  type: "folder_preview",
                  payload: {
                    id: folder.id,
                    pageIds: folder.page_ids,
                  },
                })
              );
            } else {
              socket.send(
                JSON.stringify({
                  type: "folder_remove",
                  payload: id,
                })
              );
            }
          }
        }}
        onPointerDown={(event) => {
          if (subscribedFolder?.id === id) return;
          event.preventDefault();
          // #v-endif
          if (subscribedFolder)
            socket.send(
              JSON.stringify({
                type: "unsubscribe",
                payload: subscribedFolder.id,
              })
            );
          socket.send(
            JSON.stringify({
              type: "subscribe",
              payload: folder.id,
            })
          );
          // #v-ifdef DEV
          console.log("onPointerDown folder", folder);
          // #v-endif
          setSubscribedFolder(folder);
          if (isMobile) setSidebarIsOpen(false);
        }}
      />
    </li>
  );
});

function Pages() {
  const socket = useAtomValue(socketAtom);
  const subscribedFolder = useAtomValue(subscribedFolderAtom);
  const pageIdsAtom = focusAtom(subscribedFolderAtom, (optic) =>
    optic.prop("page_ids")
  );
  const subscribedFolderNameAtom = focusAtom(subscribedFolderAtom, (optic) =>
    optic.prop("name")
  );
  const setPageIds = useSetAtom(pageIdsAtom);
  const setFolderName = useSetAtom(subscribedFolderNameAtom);
  const virtualizerReference = useRef<HTMLUListElement>(null);
  const virtualizer = useVirtualizer({
    count: subscribedFolder?.page_ids?.length || 0,
    getScrollElement: () => virtualizerReference.current,
    estimateSize: () => 25,
    overscan: 10,
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
  // eslint-disable-next-line unicorn/no-null
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  // eslint-disable-next-line unicorn/no-useless-undefined
  const [lastDragged, setLastDragged] = useState<string | undefined>(undefined);

  // #v-ifdef DEV
  const renders = useRef(0);
  console.log("rendering pages", renders.current++);
  useEffect(
    () => console.log("subscribedFolder", subscribedFolder),
    [subscribedFolder]
  );
  useEffect(() => console.log("socket", socket), [socket]);
  // #v-endif

  useEffect(() => {
    if (!socket) return;
    const listener = (event: MessageEvent) => {
      const data = event.data as string;
      const { type, payload } = JSON.parse(data);
      // #v-ifdef DEV
      console.log("type", type);
      // #v-endif
      switch (type) {
        case "add_page": {
          pageAtomFamily(payload as Page);
          setPageIds((ids) => [...(ids || []), payload.id as string]);
          break;
        }
        case "remove_page": {
          const id = payload as string;
          // eslint-disable-next-line unicorn/prevent-abbreviations
          setPageIds((previousIds) => previousIds.filter((i) => i !== id));
          pageAtomFamily.remove({ id });
          break;
        }
        case "insert_page": {
          const { pageIds, args } = payload as {
            pageIds: string[];
            args: { id: string; name: string; content: string[] };
          };
          pageAtomFamily(args);
          setPageIds(pageIds);
          // console.log("insert_page", payload);
          break;
        }
        case "update_folder": {
          const { id, name, page_ids } = payload as Folder;
          if (id !== subscribedFolder.id) return;
          if (name) setFolderName(name);
          if (page_ids) setPageIds(page_ids);
          //console.log("update_folder", payload);
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
  }, [socket, subscribedFolder.id, setPageIds, setFolderName]);

  return (
    <ul className="flex-1 h-100vh my-25px overflow-y-auto Scroll">
      <Suspense fallback={<></>}>
        <DndContext
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragCancel={handleDragCancel}
          onDragEnd={handleDragEnd}
          sensors={sensors}
        >
          <SortableContext
            items={subscribedFolder?.page_ids || []}
            strategy={verticalListSortingStrategy}
          >
            {subscribedFolder.page_ids && (
              <>
                {virtualizer.getVirtualItems().map(({ key, index }) => {
                  const id = subscribedFolder?.page_ids[index];
                  if (!id || id === "") return;
                  return (
                    <SortablePage
                      id={id}
                      key={key}
                      activeIndex={
                        activeId
                          ? subscribedFolder.page_ids.indexOf(
                              activeId as string
                            )
                          : -1
                      }
                    />
                  );
                })}
              </>
            )}
          </SortableContext>
          <DragOverlay>
            {activeId ? (
              <PageOverlay
                id={activeId as string}
                items={subscribedFolder?.page_ids}
              />
            ) : undefined}
          </DragOverlay>
        </DndContext>
      </Suspense>
      <NewPage />
    </ul>
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
    const previousIndex = subscribedFolder.page_ids?.indexOf(
      activeId as string
    );
    const nextIndex = subscribedFolder.page_ids?.indexOf(over.id as string);
    socket.send(
      JSON.stringify({
        type: "folder_update",
        payload: {
          id: subscribedFolder.id,
          page_ids: arrayMove(
            subscribedFolder.page_ids,
            previousIndex,
            nextIndex
          ),
        },
      })
    );
    setLastDragged(activeId as string);
    // eslint-disable-next-line unicorn/no-null
    setActiveId(null);
  }
}
