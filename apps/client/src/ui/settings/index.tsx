import { useAtom } from "jotai";
import * as Popover from "@radix-ui/react-popover";
import { Separator, Switch } from "ui";
import { disableAnimationsAtom } from "atoms";

function Settings() {
  const [disableAnimations, setDisableAnimations] = useAtom(
    disableAnimationsAtom
  );

  return (
    <div className="absolute right-0 top--1">
      <Popover.Root>
        <Popover.Trigger aria-describedby="settings button"
            className="bg-current focus:animate-pulse h-20px hover:animate-pulse i-mdi-cog w-20px z-19"
            title="settings" />
        <Popover.Portal>
          <Popover.Content
            className='animation-timining-function-ease dark:bg-dark duration-350 flex flex-col gap-2 light:bg-light-900 px-2 relative right-2 rounded w-50'
            sideOffset={20}
          >
            <h4>Settings</h4>
            <Separator
              className="bg-neutral h-1px mx-2 w-full"
              orientation="horizontal"
            />
            <div className="p-0.5">
              <div className="block">
                <Switch
                  id="disable animations switch"
                  label={`${
                    disableAnimations ? "enable" : "disable"
                  } animations`}
                  checked={disableAnimations}
                  onChange={setDisableAnimations}
                />
              </div>
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}

export default Settings;
