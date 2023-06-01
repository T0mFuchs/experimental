import { useState } from "react";
import * as AD from "@radix-ui/react-alert-dialog";
import * as CB from "@radix-ui/react-checkbox";
import clsx from "clsx";

import styles from "./index.module.css";

import type { ReactNode } from "react";
import type { CheckedState } from "@radix-ui/react-checkbox";

interface Properties {
  actionText: string;
  callbackFunction: () => void;
  checkbox?: boolean;
  children: ReactNode;
  disableAnimations: boolean;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

function AlertDialog({
  actionText,
  callbackFunction,
  checkbox,
  children,
  disableAnimations,
  onOpenChange,
  open,
}: Properties) {
  const [checked, setChecked] = useState(false);
  return (
    <AD.Root open={open} onOpenChange={onOpenChange}>
      <AD.Portal>
        <AD.Overlay
          className={clsx(
            "fixed inset-0 bg-dark-900/85",
            !disableAnimations && styles.Overlay
          )}
        />
        <AD.Content
          className={clsx(
            "fixed top-50% left-50% translate--50% p-2 bg-dark rounded flex flex-col items-center",
            !disableAnimations && styles.Content
          )}
        >
          <AD.Cancel className="absolute bg-red focus:(bg-blue scale-110) hover:(bg-blue scale-110) i-mdi-close right-0 top-0" />
          <div>{children}</div>
          {checkbox && (
            <form className="flex items-center">
              <CB.Root
                checked={checked}
                className='flex h-20px items-center justify-center w-20px'
                onCheckedChange={setChecked as (checked: CheckedState) => void}
                id="alert-dialog-checkbox"
              >
                <CB.Indicator className="mr-2">
                  <span className="i-mdi-check" />
                </CB.Indicator>
              </CB.Root>
              <label htmlFor="alert-dialog-checkbox">
                this is not reversable
              </label>
            </form>
          )}
          <div>
            <AD.Action
              className={clsx(
                "bg-transparent border-1 border-double focus:(border-red text-red) hover:(border-red text-red) my-2 rounded",
                checkbox && !checked && "opacity-50"
              )}
              onClick={callbackFunction}
              disabled={checkbox ? !checked : false}
            >
              {actionText}
            </AD.Action>
          </div>
        </AD.Content>
      </AD.Portal>
    </AD.Root>
  );
}

export default AlertDialog;
