import { Hono } from "hono";
import { compress } from "hono/compress";
import { serve } from "bun";
import { Database } from "bun:sqlite";
import { createClient } from "@libsql/client/http";
import { eq, lt, inArray } from "drizzle-orm";
import { drizzle as libsql_drizzle } from "drizzle-orm/libsql";
import { drizzle as sqlite_drizzle } from "drizzle-orm/bun-sqlite";
import { uid } from "uid/secure";
import {
  libsql_config,
  SQLITE_DB_NAME,
  VITE_HOST_NAME,
  VITE_SERVER_PORT,
} from "@/environment";
import {
  contents,
  pages,
  folders,
  folder_reference,
  subs,
  ips,
} from "@/schema";
import { router } from "@/router";

import type { WebSocketHandler, ServerWebSocket } from "bun";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { Folder, Page, Content } from "@packages/types";

interface WebSocketData {
  subId: string;
}

const RATE_LIMIT = 100;

export const sqlite_client = new Database(SQLITE_DB_NAME);
export const libsql_client = createClient(libsql_config);
export const sqlite_database = sqlite_drizzle(sqlite_client);
export const libsql_database = libsql_drizzle(libsql_client);

let resetCountInterval: NodeJS.Timer;
let deleteSubsInterval: NodeJS.Timer;

const app = new Hono();

await main().catch(console.error);
async function main() {
  try {
    serve<WebSocketData>({
      port: VITE_SERVER_PORT,
      hostname: VITE_HOST_NAME,
      async fetch(request, server) {
        console.log("req >", request.headers.toJSON());

        const idFromHeader = request.headers.get("sec-websocket-protocol");
        const subId =
          idFromHeader === "undefined" ? uid() : (idFromHeader as string);
        if (idFromHeader === "undefined")
          sqlite_database.insert(subs).values({ id: subId }).run();
        const update = sqlite_database
          .update(subs)
          .set({ t: Date.now() })
          .where(eq(subs.id, subId))
          .returning()
          .get() as { id: string; folders?: string; t: number } | undefined;
        if (!update)
          sqlite_database
            .insert(subs)
            .values({ id: subId, t: Date.now() })
            .run();

        if (server.upgrade(request, { data: { subId } })) return;
        app.use("*", compress());
        return app.fetch(request);
      },
      websocket: websocket<WebSocketHandler>(),
    });
    serve({ port: 3333, hostname: VITE_HOST_NAME, fetch: router.fetch });
  } catch (error) {
    console.error(error);
  }
}

function broadcast(
  ws: ServerWebSocket<WebSocketData>,
  topic: string,
  message: string
) {
  ws.send(message);
  ws.publish(topic, message);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function websocket<WebSocketHandler>() {
  return {
    async open(ws: ServerWebSocket<WebSocketData>) {
      console.log("open", ws.readyState, "ws.remoteAddress", ws.remoteAddress);
      resetCountInterval = setInterval(function () {
        sqlite_client.run("UPDATE i SET c = 0 WHERE c > 0");
        // console.log("restCountInterval");
      }, 2000);
      deleteSubsInterval = setInterval(function () {
        queueMicrotask(() => {
          sqlite_database
            .delete(subs)
            .where(lt(subs.t, Date.now() - 1000 * 60 * 60 * 24 * 7))
            .run();
          console.log("deleted subscriptions older than 7 days");
        });
      }, 1000 * 60 * 60);
      const previous = sqlite_client
        .query(`select * from i where i = '${ws.remoteAddress}'`)
        .get() as {
        ip: string;
        c: number;
        b: 1 | undefined;
      } | null;
      console.log("previous", previous);
      if (previous === null) {
        console.log("inserting new ip");
        sqlite_database
          .insert(ips)
          .values({ ip: ws.remoteAddress, c: 1 })
          .run();
      } else {
        if (previous.c < RATE_LIMIT) {
          if (previous.b === 1)
            throw new Error(
              "this should never throw | when rate-limiting is implemented | replace this with empty return statement"
            );
          sqlite_database
            .update(ips)
            .set({ c: previous.c + 1 })
            .where(eq(ips.ip, ws.remoteAddress))
            .run();
        } else {
          sqlite_database
            .update(ips)
            .set({ b: 1 })
            .where(eq(ips.ip, ws.remoteAddress))
            .run();
        }
      }
      ws.send(JSON.stringify({ type: "sub-id", payload: ws.data.subId }));
      ws.subscribe("folders");
      await libsql_database
        .select()
        .from(folder_reference)
        .where(eq(folder_reference.id, "default"))
        .get()
        .then(async (result) => {
          if (!result.ids) return;
          const folderIds = result.ids.split(" ");
          for (const id of folderIds) {
            if (id === "") continue;
            await libsql_database
              .select()
              .from(folders)
              .where(eq(folders.id, id))
              .get()
              .then((folder) =>
                ws.send(
                  JSON.stringify({
                    type: "get_folder",
                    payload: {
                      ...folder,
                      name: folder?.name ?? undefined,
                      page_ids: folder?.page_ids?.split(" ") ?? undefined,
                    },
                  })
                )
              );
          }
        });
    },
    async message(
      ws: ServerWebSocket<WebSocketData>,
      message: string | ArrayBuffer | Uint8Array
    ) {
      if (typeof message !== "string")
        throw new Error(
          `only type string supported; received: ${typeof message}`,
          { cause: `invalid message: ${message}` }
        );
      const previous = sqlite_client
        .query(`select * from i where i = '${ws.remoteAddress}'`)
        .get() as {
        ip: string;
        c: number;
        b: 1 | undefined;
      };
      if (previous === undefined) {
        sqlite_database
          .insert(ips)
          .values({ ip: ws.remoteAddress, c: 1 })
          .run();
      } else {
        if (previous.c < RATE_LIMIT) {
          if (previous.b === 1) return ws.close();
          sqlite_database
            .update(ips)
            .set({ c: previous.c + 1 })
            .where(eq(ips.ip, ws.remoteAddress))
            .run();
        } else {
          console.log("now blocked on msg");
          sqlite_database
            .update(ips)
            .set({ b: 1 })
            .where(eq(ips.ip, ws.remoteAddress))
            .run();
          return ws.close();
        }
      }
      const { type, payload } = JSON.parse(message as string) as {
        type:
          | "subscribe"
          | "unsubscribe"
          | "folders_update"
          | "folder_preview"
          | "folder_add"
          | "folder_remove"
          | "folder_remove*"
          | "folder_get"
          | "folder_update"
          | "page_add"
          | "page_remove"
          | "page_remove*"
          | "page_get"
          | "page_update"
          | "page_merge"
          | "page_insert_before"
          | "page_insert_after"
          | "content_add"
          | "content_remove"
          | "content_get"
          | "content_update"
          | "content_merge"
          | "content_insert_before"
          | "content_insert_after";
        payload: unknown;
      };
      // prettier-ignore
      console.log( "type:", type, "\npayload:", payload, "data.subId:", ws.data.subId, ws.remoteAddress, "rate limiter counter", previous.c);
      switch (type) {
        case "subscribe": {
          ws.subscribe(payload as string);
          console.log("subscribed to:", payload as string, ws.data);
          const previousSubscriptions =
            sqlite_database
              .select()
              .from(subs)
              .where(eq(subs.id, ws.data.subId))
              .get()
              .folders?.split(" ") ?? [];
          sqlite_database
            .update(subs)
            .set({
              folders: [...previousSubscriptions, payload as string].join(" "),
              t: Date.now(),
            })
            .where(eq(subs.id, ws.data.subId))
            .run();
          break;
        }
        case "unsubscribe": {
          ws.unsubscribe(payload as string);
          console.log("unsubscribed from:", payload as string, ws.data);
          sqlite_database
            .update(subs)
            .set({
              id: ws.data.subId,
              folders: (
                sqlite_database
                  .select()
                  .from(subs)
                  .where(eq(subs.id, ws.data.subId))
                  .get().folders || ""
              ).replace(payload as string, ""),
            })
            .where(eq(subs.id, ws.data.subId))
            .run();
          break;
        }
        case "folders_update": {
          try {
            await libsql_database
              .update(folder_reference)
              .set({
                ids: (payload as string[]).join(" "),
              })
              .where(eq(folder_reference.id, "default"))
              .run()
              .then(() => {
                ws.publish(
                  "folders",
                  JSON.stringify({
                    type: "update_folders",
                    payload: payload,
                  })
                );
                ws.send(
                  JSON.stringify({
                    type: "update_folders",
                    payload: payload,
                  })
                );
              });
          } catch (error) {
            console.error(error);
          }
          break;
        }
        case "folder_preview": {
          const { id, name, pageIds } = payload as {
            id: string;
            name?: string;
            pageIds: string[];
          };
          try {
            await libsql_database
              .select()
              .from(pages)
              .where(inArray(pages.id, pageIds))
              .run()
              .then(async (result) => {
                const out: {
                  [key: string]: {
                    name: string;
                    contents?: {
                      id: string;
                      value: string;
                    }[];
                  };
                } = {};
                const pages = result.rows as unknown as {
                  id: string;
                  name: string | null;
                  content: string | null;
                }[];
                for (const page of pages) {
                  out[page.id] = { name: page?.name || "", contents: [] };
                  if (!page.content) continue;
                  await libsql_database
                    .select()
                    .from(contents)
                    .where(inArray(contents.id, page.content.split(" ")))
                    .run()
                    .then((result) => {
                      const pageContents = result.rows as unknown as {
                        id: string;
                        value: string | null;
                        style: string | null;
                      }[];
                      for (const content of pageContents) {
                        out[page.id].contents?.push({
                          id: content.id,
                          value: content.value
                            ? content.value.trim().slice(undefined, 20) +
                              (content.value.length > 20 ? "..." : "")
                            : "",
                        });
                      }
                    });
                }
                ws.send(
                  JSON.stringify({
                    type: "preview_folder",
                    payload: {
                      id,
                      name,
                      pageIds,
                      summary: out,
                    },
                  })
                );
              });
          } catch (error) {
            console.error(error);
          }
          break;
        }
        case "folder_add": {
          try {
            await libsql_database
              .insert(folders)
              .values({
                id: uid(),
                ...(payload as { name: string }),
              })
              .returning()
              .get()
              .then(async (folder) => {
                await libsql_database
                  .select()
                  .from(folders)
                  .all()
                  .then(async (folders) => {
                    await libsql_database
                      .update(folder_reference)
                      .set({
                        ids: folders.map((folder) => folder.id).join(" "),
                      })
                      .where(eq(folder_reference.id, "default"))
                      .run()
                      .then(() => {
                        broadcast(
                          ws,
                          "folders",
                          JSON.stringify({
                            type: "add_folder",
                            payload: folder,
                          })
                        );
                      });
                  });
              });
          } catch (error) {
            console.error(error);
          }
          break;
        }
        case "folder_remove": {
          try {
            await libsql_database
              .delete(folders)
              .where(eq(folders.id, payload as string))
              .run()
              .then(() => {
                broadcast(
                  ws,
                  "folders",
                  JSON.stringify({
                    type: "remove_folder",
                    payload,
                  })
                );
              });
          } catch (error) {
            console.error(error);
          }
          break;
        }
        case "folder_remove*": {
          const { id, pageIds, contentIds } = payload as {
            id: string;
            pageIds: string[];
            contentIds: string[];
          };
          try {
            await libsql_database
              .delete(folders)
              .where(eq(folders.id, id))
              .run()
              .then(
                async () =>
                  await libsql_database
                    .delete(pages)
                    .where(inArray(pages.id, pageIds))
                    .run()
                    .then(
                      async () =>
                        await libsql_database
                          .delete(contents)
                          .where(inArray(contents.id, contentIds))
                          .run()
                    )
              )
              .then(() => {
                broadcast(
                  ws,
                  "folders",
                  JSON.stringify({
                    type: "remove_folder*",
                    payload: {
                      id,
                      pageIds,
                      contentIds,
                    },
                  })
                );
                ws.send;
              });
          } catch (error) {
            console.error(error);
          }
          break;
        }
        case "folder_get": {
          const { name } = payload as { name: string };
          try {
            await libsql_database
              .select()
              .from(folders)
              .where(eq(folders.name, name))
              .get()
              .then((result) => {
                ws.send(
                  JSON.stringify({
                    type: "get_folder",
                    payload: {
                      folder: {
                        ...result,
                        page_ids: result.page_ids?.split(" "),
                      },
                    },
                  })
                );
              });
          } catch (error) {
            console.error(error);
          }
          break;
        }
        case "folder_update": {
          const { id, name, page_ids } = payload as Folder;
          try {
            await libsql_database
              .update(folders)
              .set(
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                name && page_ids
                  ? { name, page_ids: page_ids.join(" ") }
                  : (name && { name }) ||
                      (page_ids && { page_ids: page_ids.join(" ") })
              )
              .where(eq(folders.id, id))
              .run()
              .then(() =>
                broadcast(
                  ws,
                  "folders",
                  JSON.stringify({
                    type: "update_folder",
                    payload: payload,
                  })
                )
              );
          } catch (error) {
            console.error(error);
          }
          break;
        }
        case "page_add": {
          const { folderId, pageIds, name } = payload as {
            folderId: string;
            pageIds?: string[];
            name: string;
          };
          if (!ws.isSubscribed(folderId)) ws.subscribe(folderId);
          try {
            await libsql_database
              .insert(pages)
              .values({ id: uid(), name: name })
              .returning()
              .get()
              .then(async (page) => {
                await libsql_database
                  .update(folders)
                  .set({
                    page_ids: pageIds
                      ? [...pageIds, page.id].join(" ")
                      : page.id,
                  })
                  .where(eq(folders.id, folderId))
                  .run()
                  .then(() =>
                    broadcast(
                      ws,
                      folderId,
                      JSON.stringify({
                        type: "add_page",
                        payload: {
                          ...page,
                          content: page.content?.split(" "),
                        },
                      })
                    )
                  );
              });
          } catch (error) {
            console.error(error);
          }
          break;
        }
        case "page_remove": {
          const { folderId, pageIds, pageId } = payload as {
            folderId: string;
            pageIds: string[];
            pageId: string;
          };
          try {
            await libsql_database
              .delete(pages)
              .where(eq(pages.id, pageId))
              .run()
              .then(async () => {
                const ids = pageIds.filter((id) => id !== pageId).join(" ");
                await libsql_database
                  .update(folders)
                  .set({ page_ids: ids.startsWith(" ") ? ids.slice(1) : ids })
                  .where(eq(folders.id, folderId))
                  .run()
                  .then(() =>
                    broadcast(
                      ws,
                      folderId,
                      JSON.stringify({
                        type: "remove_page",
                        payload: pageId,
                      })
                    )
                  );
              });
          } catch (error) {
            console.error(error);
          }
          break;
        }
        /* 
        case "page_remove*": {
          try {} catch (error) {
            console.error(error);
          }
          break;
        }
        */
        case "page_get": {
          try {
            await libsql_database
              .select()
              .from(pages)
              .where(eq(pages.id, payload as string))
              .get()
              .then((page) => {
                const out = [];
                const content = page?.content?.split(" ") || [];
                for (const id of content) {
                  if (id === "") continue;
                  out.push(id);
                }
                ws.send(
                  JSON.stringify({
                    type: "get_page",
                    payload: {
                      ...page,
                      content: out,
                    },
                  })
                );
              });
          } catch (error) {
            console.error(error);
          }
          break;
        }
        case "page_update": {
          try {
            const { folderId, pageId, args } = payload as {
              folderId: string;
              pageId: string;
              args: { name?: string; content?: string[] };
            };
            await libsql_database
              .update(pages)
              .set(
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                args.name && args.content
                  ? { name: args.name, content: args.content.join(" ") }
                  : (args.name && { name: args.name }) ||
                      (args.content && { content: args.content.join(" ") })
              )
              .where(eq(pages.id, pageId))
              .run()
              .then(() =>
                broadcast(
                  ws,
                  folderId,
                  JSON.stringify({
                    type: "update_page",
                    payload: { pageId, args },
                  })
                )
              );
          } catch (error) {
            console.error(error);
          }
          break;
        }
        case "page_merge": {
          try {
            const { folderId, pageIds, targetId, previousId, args } =
              payload as {
                folderId: string;
                pageIds: string[];
                targetId: string;
                previousId: string;
                args: { name: string; content?: string[] };
              };
            await libsql_database
              .select()
              .from(pages)
              .where(eq(pages.id, targetId))
              .get()
              .then(async (result) => {
                const ids: string[] = [];
                for (const index of pageIds) {
                  if (index === targetId) ids.push(result.id);
                  ids.push(index);
                }
                const contentIds = [
                  ...(result.content?.split(" ") || []),
                  ...(args.content || []),
                ];
                const name = result?.name
                  ? result.name + " " + args.name
                  : args.name;
                await libsql_database
                  .update(pages)
                  .set({
                    name: name,
                    content: contentIds.join(" "),
                  })
                  .where(eq(pages.id, targetId))
                  .run()
                  .then(async () => {
                    await libsql_database
                      .update(folders)
                      .set({
                        page_ids: ids.join(" "),
                      })
                      .where(eq(folders.id, folderId))
                      .run()
                      .then(
                        async () =>
                          await libsql_database
                            .delete(pages)
                            .where(eq(pages.id, previousId))
                            .run()
                            .then(() =>
                              broadcast(
                                ws,
                                folderId,
                                JSON.stringify({
                                  type: "remove_page",
                                  payload: previousId,
                                })
                              )
                            )
                      )
                      .then(() =>
                        broadcast(
                          ws,
                          folderId,
                          JSON.stringify({
                            type: "update_page",
                            payload: {
                              pageId: targetId,
                              args: {
                                name: name,
                                content: contentIds,
                              },
                            },
                          })
                        )
                      );
                  });
              });
          } catch (error) {
            console.error(error);
          }
          break;
        }
        case "page_insert_before":
        case "page_insert_after": {
          try {
            const { folderId, pageId, updateName, pageIds, args } = payload as {
              folderId: string;
              pageId: string;
              updateName: string;
              pageIds: string[];
              args: { name: string; content: string[] };
            };
            const id = uid();
            await libsql_database
              .insert(pages)
              .values({
                id: id,
                name: args.name,
                content: args.content.join(" "),
              })
              .run()
              .then(async () => {
                const ids: string[] = [];
                for (const _id of pageIds) {
                  ids.push(_id);
                  if (_id === pageId) ids.push(id);
                }
                if (!ids) throw new Error(`ids: ${ids}`);
                await libsql_database
                  .update(folders)
                  .set({ page_ids: ids.join(" ") })
                  .where(eq(folders.id, folderId))
                  .run()
                  .then(() => {
                    broadcast(
                      ws,
                      folderId,
                      JSON.stringify({
                        type: "update_page",
                        payload: {
                          pageId,
                          args: {
                            name: updateName,
                          },
                        },
                      })
                    );
                    broadcast(
                      ws,
                      folderId,
                      JSON.stringify({
                        type: "insert_page",
                        payload: {
                          pageIds: ids,
                          args: {
                            id: id,
                            ...args,
                          },
                        },
                      })
                    );
                  })
                  .then(
                    async () =>
                      await libsql_database
                        .update(pages)
                        .set({ name: updateName })
                        .where(eq(pages.id, pageId))
                        .run()
                  );
              });
          } catch (error) {
            console.error(error);
          }
          break;
        }
        case "content_add": {
          const { folderId, pageId, contentIds, args } = payload as {
            folderId: string;
            contentIds?: string[];
            pageId: string;
            args: { value?: string; style?: string };
          };
          const id = uid();
          try {
            await libsql_database
              .insert(contents)
              .values({ id: id, ...args })
              .returning()
              .get()
              .then(async (content) => {
                await libsql_database
                  .update(pages)
                  .set({
                    content: contentIds
                      ? [...contentIds, content.id].join(" ")
                      : content.id,
                  })
                  .where(eq(pages.id, pageId))
                  .run()
                  .then(() =>
                    broadcast(
                      ws,
                      folderId,
                      JSON.stringify({
                        type: "add_content",
                        payload: {
                          pageId: pageId,
                          args: content,
                        },
                      })
                    )
                  );
              });
          } catch (error) {
            console.error(error);
          }
          break;
        }
        case "content_remove": {
          const { folderId, pageId, contentIds, contentId } = payload as {
            folderId: string;
            pageId: string;
            contentIds: string[];
            contentId: string;
          };
          try {
            await libsql_database
              .delete(contents)
              .where(eq(contents.id, contentId))
              .run()
              .then(
                async () =>
                  await libsql_database
                    .update(pages)
                    .set({
                      content: contentIds
                        .filter((id) => id !== contentId)
                        .join(" "),
                    })
                    .where(eq(pages.id, pageId))
                    .run()
                    .then(() =>
                      broadcast(
                        ws,
                        folderId,
                        JSON.stringify({
                          type: "remove_content",
                          payload: {
                            pageId: pageId,
                            contentId: contentId,
                          },
                        })
                      )
                    )
              );
          } catch (error) {
            console.error(error);
          }
          break;
        }
        case "content_get": {
          try {
            await libsql_database
              .select()
              .from(contents)
              .where(eq(contents.id, payload as string))
              .get()
              .then((content) =>
                ws.send(
                  JSON.stringify({
                    type: "get_content",
                    payload: content,
                  })
                )
              );
          } catch (error) {
            console.error(error);
          }
          break;
        }
        case "content_update": {
          const { folderId, pageId, contentId, args } = payload as {
            folderId: string;
            pageId: string;
            contentId: string;
            args: { value?: string; style?: string };
          };
          try {
            if (!args.value && !args.style) throw new Error("args are empty");
            await libsql_database
              .update(contents)
              .set(
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                args.value && args.style
                  ? args
                  : (args.value && { value: args.value }) ||
                      (args.style && { style: args.style })
              )
              .where(eq(contents.id, contentId))
              .run()
              .then(() =>
                broadcast(
                  ws,
                  folderId,
                  JSON.stringify({
                    type: "update_content",
                    payload: {
                      pageId,
                      contentId,
                      args,
                    },
                  })
                )
              );
          } catch (error) {
            console.error(error);
          }
          break;
        }
        case "content_merge": {
          const { folderId, pageId, previousId, targetId, contentIds, args } =
            payload as {
              folderId: string;
              pageId: string;
              previousId: string;
              targetId: string;
              contentIds: string[];
              args: { value: string };
            };
          try {
            await libsql_database
              .select()
              .from(contents)
              .where(eq(contents.id, targetId))
              .get()
              .then(async (result) => {
                const ids: string[] = [];
                // eslint-disable-next-line unicorn/prevent-abbreviations
                for (const i of contentIds) {
                  if (i === targetId) {
                    ids.push(result.id);
                    continue;
                  }
                  if (i === previousId) continue;
                  ids.push(i);
                }
                const value = result.value
                  ? result.value + " " + args.value
                  : args.value;
                console.log("VALUE", value, "IDS", ids);
                await libsql_database
                  .update(contents)
                  .set({ value: value })
                  .where(eq(contents.id, result.id))
                  .run()
                  .then(
                    async () =>
                      await libsql_database
                        .update(pages)
                        .set({ content: ids.join(" ") })
                        .where(eq(pages.id, pageId))
                        .run()
                        .then(
                          async () =>
                            await libsql_database
                              .delete(contents)
                              .where(eq(contents.id, previousId))
                              .run()
                              .then(() => {
                                broadcast(
                                  ws,
                                  folderId,
                                  JSON.stringify({
                                    type: "remove_content",
                                    payload: {
                                      pageId,
                                      contentId: previousId,
                                    },
                                  })
                                );
                              })
                        )
                        .then(() =>
                          broadcast(
                            ws,
                            folderId,
                            JSON.stringify({
                              type: "update_content",
                              payload: {
                                pageId,
                                contentId: targetId,
                                args: {
                                  value: value,
                                  style: result.style,
                                },
                              },
                            })
                          )
                        )
                  );
              });
          } catch (error) {
            console.error(error);
          }
          break;
        }
        case "content_insert_before":
        case "content_insert_after": {
          const { folderId, pageId, contentId, updateValue, contentIds, args } =
            payload as {
              folderId: string;
              pageId: string;
              contentId: string;
              updateValue: string;
              contentIds: string[];
              args: { value: string; style?: string };
            };
          const id = uid();
          const ids: string[] = [];
          // eslint-disable-next-line unicorn/prevent-abbreviations
          for (const _id of contentIds) {
            ids.push(_id);
            if (_id === contentId) ids.push(id);
          }
          try {
            const newContent = {
              id: id,
              ...args,
              style: args.style || "d",
            };
            await libsql_database
              .insert(contents)
              .values(newContent)
              .run()
              .then(
                async () =>
                  await libsql_database
                    .update(pages)
                    .set({ content: ids.join(" ") })
                    .where(eq(pages.id, pageId))
                    .run()
                    .catch(console.error)
                    .then(() => {
                      broadcast(
                        ws,
                        folderId,
                        JSON.stringify({
                          type: "update_content",
                          payload: {
                            pageId,
                            contentId,
                            args: {
                              value: updateValue,
                            },
                          },
                        })
                      );
                      broadcast(
                        ws,
                        folderId,
                        JSON.stringify({
                          type: "insert_content",
                          payload: {
                            pageId,
                            contentIds: ids,
                            args: newContent,
                          },
                        })
                      );
                    })
                    .then(
                      async () =>
                        await libsql_database
                          .update(contents)
                          .set({ value: updateValue })
                          .where(eq(contents.id, contentId))
                          .run()
                    )
              );
          } catch (error) {
            console.error(error);
          }
          break;
        }
      }
    },
    async close(
      ws: ServerWebSocket<WebSocketData>,
      code?: number,
      message?: string
    ) {
      console.log("close", code, message, ws.readyState);
      ws.unsubscribe("folders");
      resetCountInterval.unref();
      deleteSubsInterval.unref();
    },
    perMessageDeflate: true,
  };
}
