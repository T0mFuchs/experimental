import { atom } from "jotai";
import { atomFamily, atomWithStorage } from "jotai/utils";

import type { Content, Folder, Page } from "@packages/types";

export const socketAtom = atom(undefined as WebSocket | undefined);
export const folderIdsAtom = atom<string[]>([]);
// eslint-disable-next-line unicorn/no-useless-undefined
export const subscribedFolderAtom = atom(undefined as Folder | undefined);
export const folderAtomFamily = atomFamily(
  (folder: Folder) => atom(folder),
  (a, b) => a.id === b.id
);
export const pageAtomFamily = atomFamily(
  (page: Page) => atom(page),
  (a, b) => a.id === b.id
);
export const contentAtomFamily = atomFamily(
  (content: Content) => atom(content),
  (a, b) => a.id === b.id
);
export const disableAnimationsAtom = atomWithStorage(
  "prefers-reduced-motion",
  window.matchMedia("(prefers-reduced-motion)").matches ? true : false
);
export const isMobileAtom = atom(
  window.matchMedia("(max-width: 670px)").matches ? true : false
);
export const sidebarIsOpenAtom = atom(true);
export const modalOpenAtom = atom(false);
export const modalPageIndexAtom = atom(0);

export const alertFolderDeleteAtom = atom(false);
export const folderToDeleteAtom = atom(
  undefined as
    | {
        id: string;
        name?: string;
        pageIds: string[];
        summary: {
          [pageId: string]: {
            name: string;
            contents: {
              id: string;
              value: string;
            }[];
          };
        };
      }
    | undefined
);
