export * from "./new";
import TextareaAutosize from "react-textarea-autosize";
import { useEffect, useReducer, forwardRef } from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { focusAtom } from "jotai-optics";
import { useDndContext } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS, isKeyboardEvent } from "@dnd-kit/utilities";

import { socketAtom, subscribedFolderAtom, disableAnimationsAtom, contentAtomFamily } from "atoms";
import { useDebounce } from "hooks";
import { getCSSProperties, Position, splitStringAt } from "utils";

import { SelectStyle } from "./select-style";

import type { CSSProperties } from "react";
import type { UniqueIdentifier } from "@dnd-kit/core";
import type { SortableItem } from "types";
import { Content as PageContent } from "@packages/types";
import clsx from "clsx";

type ContentProperties = SortableItem & {
  pageId: string;
  pageContent: string[];
}

function reducer(
  state: PageContent | undefined,
  action: { type: "update_full" | "update_value" | "update_style"; data }
) {
  switch (action.type) {
    case "update_full": {
      return action.data;
    }
    case "update_value": {
      return {
        ...state,
        value: action.data,
      };
    }
    case "update_style": {
      {
        return {
          ...state,
          style: action.data,
        };
      }
    }
  }
}

const Content = forwardRef<HTMLLIElement, ContentProperties>(function Content(
  {
    id,
    pageId,
    pageContent,
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
  const contentAtom = contentAtomFamily({ id });
  contentAtom.onMount = () => {
    socket.send(
      JSON.stringify({
        type: "content_get",
        payload: id,
      })
    );
  };
  const subscribedFolder = useAtomValue(subscribedFolderAtom);
  const valueAtom = focusAtom(contentAtom, (optic) => optic.prop("value"));
  const styleAtom = focusAtom(contentAtom, (optic) => optic.prop("style"));
  const [content, setContent] = useAtom(contentAtom);
  const [syncedContent, dispatchSyncedContent] = useReducer(
    reducer,
    undefined as PageContent | undefined
  );
  const setValue = useSetAtom(valueAtom);
  const debouncedValue = useDebounce(content.value);
  const setStyle = useSetAtom(styleAtom);

  // #v-ifdef DEV
  useEffect(
    () => console.log("initialContent", syncedContent),
    [syncedContent]
  );
  useEffect(() => console.log("content", content.style), [content]);
  // #v-endif

  useEffect(() => {
    if (!content.value || !syncedContent?.value) return;
    if (
      content.value !== syncedContent.value &&
      content.value === debouncedValue
    ) {
      if (content.value.startsWith("/")) return;
      socket.send(
        JSON.stringify({
          type: "content_update",
          payload: {
            folderId: subscribedFolder.id,
            pageId,
            contentId: id,
            args: {
              value: content.value,
            },
          },
        })
      );
    }
    if (!content.style || !syncedContent?.style) return;
    if (content.style !== syncedContent.style) {
      socket.send(
        JSON.stringify({
          type: "content_update",
          payload: {
            folderId: subscribedFolder.id,
            pageId,
            contentId: id,
            args: {
              style: content.style,
            },
          },
        })
      );
      dispatchSyncedContent({ type: "update_style", data: content.style });
    }
  }, [
    content.value,
    content.style,
    debouncedValue,
    syncedContent,
    socket,
    subscribedFolder?.id,
    pageId,
    id,
  ]);

  useEffect(() => {
    if (!socket) return;
    const listener = (event: MessageEvent) => {
      const data = event.data as string;
      if (data === "keep-alive") return;
      const { type, payload } = JSON.parse(data);
      switch (type) {
        case "get_content": {
          if (payload?.id !== id) return;
          setContent(payload);
          dispatchSyncedContent({
            type: "update_full",
            data: {
              value: payload.value,
              style: payload.style,
            },
          });
          break;
        }
        case "update_content": {
          const { contentId, args } = payload as {
            contentId: string;
            args: { value?: string; style?: string };
          };
          if (contentId !== id) return;
          if (args.value) setValue(args.value);
          if (args.style) setStyle(args.style as any);
          // #v-ifdef DEV
          console.log("update_content", payload);
          // #v-endif
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
  }, [socket, id, setContent, setValue, setStyle]);

  return (
    <>
      <li
        className={clsx("flex mb-0.25 ml-3 p-0.5", active && "opacity-50",
        clone && "opacity-67",
        insertPosition === Position.Before &&
          "rounded-0.5 border-solid border-0 border-t-1 border-blue-700",
        insertPosition === Position.After &&
          "rounded-0.5 border-solid border-0 border-b-1 border-blue-700")}
        ref={reference}
        style={style}
        
      >
        <span
          {...attributes}
          className='focus:bg-blue-700 i-mdi-card mr-1 mt-1.5'
          style={{ touchAction: "manipulation" }}
          {...listeners}
        />
        <TextareaAutosize
          className="bg-transparent border-0 w-full"
          maxLength={4000}
          style={getCSSProperties(content.style)}
          value={content.value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            const { altKey, currentTarget, key } = event;
            const { selectionStart } = currentTarget;
            if (
              key === "Enter" ||
              (key === "Backspace" && selectionStart === 0)
            ) {
              event.preventDefault();
              const [before, after] = splitStringAt(
                content.value,
                selectionStart
              );
              if (key === "Enter") {
                return socket.send(
                  JSON.stringify({
                    type: "content_insert_after",
                    payload: {
                      folderId: subscribedFolder.id,
                      pageId,
                      contentId: id,
                      updateValue: before,
                      contentIds: pageContent,
                      args: {
                        value: after,
                        style: content.style,
                      },
                    },
                  })
                );
              }
              if (key === "Backspace" && selectionStart === 0) {
                return socket.send(
                  JSON.stringify({
                    type: "content_merge",
                    payload: {
                      folderId: subscribedFolder.id,
                      pageId,
                      previousId: id,
                      targetId: pageContent[pageContent.indexOf(id) - 1],
                      contentIds: pageContent,
                      args: {
                        value: after,
                        style: content.style,
                      },
                    },
                  })
                );
              }
            }
            if (altKey) {
              event.preventDefault();
              if (key.toLocaleLowerCase() === "i") setStyle("i");
              if (key.toLocaleLowerCase() === "b") setStyle("b");
              if (key.toLocaleLowerCase() === "u") setStyle("u");
              if (key.toLocaleLowerCase() === "d") setStyle("d");
            }
          }}
        />
      </li>
      {content?.value?.startsWith("/") && (
        <SelectStyle
          callbackFunction={() => setValue((previous) => previous.slice(1))}
          style={content.style}
          setStyle={setStyle}
        />
      )}
    </>
  );
});

export function SortableContent({
  id,
  activeIndex,
  pageId,
  pageContent,
}: {
  id: string;
  activeIndex: number;
  pageId: string;
  pageContent: string[];
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
    <Content
      id={id}
      pageId={pageId}
      pageContent={pageContent}
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

export function ContentOverlay({
  id,
  pageId,
  pageContent,
  items,
}: {
  id: string;
  pageId: string;
  pageContent: string[];
  items: UniqueIdentifier[];
}) {
  const { activatorEvent, over } = useDndContext();
  const isKeyboardSorting = isKeyboardEvent(activatorEvent);
  const activeIndex = items.indexOf(id);
  const overIndex = over?.id ? items.indexOf(over?.id) : -1;

  return (
    <Content
      id={id}
      pageId={pageId}
      pageContent={pageContent}
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

export { Content };
