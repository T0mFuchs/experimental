import AutosizeInput from "react-input-autosize";
import { useState } from "react";
import { useAtomValue } from "jotai";

import { socketAtom, subscribedFolderAtom } from "atoms";

function NewPage() {
  const socket = useAtomValue(socketAtom);
  const subscribedFolder = useAtomValue(subscribedFolderAtom);
  const [name, setName] = useState("");

  return (
    <li className="mb-0.5 p-1 pb-1.25">
      <span className="i-mdi-file-outline mr-1" />
      <AutosizeInput
        value={name}
        inputClassName="border-transparent rounded"
        minWidth={100}
        maxLength={40}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            socket.send(
              JSON.stringify({
                type: "page_add",
                payload: {
                  folderId: subscribedFolder.id,
                  pageIds: subscribedFolder.page_ids,
                  name,
                },
              })
            );
            setName("");
          }
        }}
      />
    </li>
  );
}

export { NewPage };
