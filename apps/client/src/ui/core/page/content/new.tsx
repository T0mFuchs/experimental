import TextareaAutosize from "react-textarea-autosize";
import { useState } from "react";
import { useAtomValue } from "jotai";

import { socketAtom, subscribedFolderAtom } from "atoms";
import { getCSSProperties } from "utils";

import { SelectStyle } from "./select-style";

import type { ContentStyle } from "@packages/types";

function NewContent({
  pageId,
  pageContent,
}: {
  pageId: string;
  pageContent: string[];
}) {
  const socket = useAtomValue(socketAtom);
  const subscribedFolder = useAtomValue(subscribedFolderAtom);
  const [value, setValue] = useState("");
  const [style, setStyle] = useState<ContentStyle>("d");

  return (
    <>
      <li className="flex mb-0.25 ml-3 p-0.5">
        <span className="i-mdi-card-outline mr-1 mt-1.5" />
        <TextareaAutosize
          className="bg-transparent border-0 w-full"
          maxLength={4000}
          maxRows={1}
          style={getCSSProperties(style)}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            const { altKey, key } = event;
            if (key === "Enter") {
              if (!socket) throw new Error("socket is not connected");
              socket.send(
                JSON.stringify({
                  type: "content_add",
                  payload: {
                    folderId: subscribedFolder.id,
                    pageId,
                    contentIds: pageContent,
                    args: {
                      value,
                      style,
                    },
                  },
                })
              );
              setValue("");
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
      {value.startsWith("/") && (
        <SelectStyle
          callbackFunction={() => setValue((previous) => previous.slice(1))}
          style={style}
          setStyle={setStyle}
        />
      )}
    </>
  );
}

export { NewContent };
