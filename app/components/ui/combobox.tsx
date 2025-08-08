import { GetControlPropsResult } from "@rvf/react-router";
import { IconCheck, IconSelector } from "@tabler/icons-react";
import * as React from "react";

import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "~/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { cn } from "~/lib/utils";

type Props = {
  id: string;
  options: Array<{ value: string; label: string | null }>;
  value: GetControlPropsResult<string | undefined>["value"];
  onChange?: GetControlPropsResult<string | undefined>["onChange"];
  placeholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  ref?: React.Ref<HTMLButtonElement>;
};

export function Combobox(props: Props) {
  const [open, setOpen] = React.useState(false);
  const selectedOption = props.options.find((option) => option.value === props.value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          ref={props.ref}
          disabled={props.disabled}
          role="combobox"
          aria-expanded={open}
          className={cn(
            "border-input bg-background ring-offset-background data-placeholder:text-foreground flex h-10 w-full cursor-pointer touch-manipulation items-center justify-between truncate rounded-md border px-3 py-2 text-sm transition-[color,box-shadow] select-none [&>span]:line-clamp-1",
            "focus-visible:ring-ring/25 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:outline-hidden",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
        >
          {props.value ? selectedOption?.label : (props.placeholder ?? "Select an option")}
          <IconSelector className="ml-2 size-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        <Command>
          <CommandInput placeholder="Search..." className="h-10" />
          <CommandList>
            <CommandEmpty>{props.emptyMessage ?? "No results found."}</CommandEmpty>
            <CommandGroup>
              {props.options.map((option) => {
                if (option.label === null) {
                  return null;
                }
                return (
                  <ComboboxItem
                    key={option.value}
                    option={option}
                    value={props.value}
                    onChange={props.onChange}
                    setOpen={setOpen}
                  />
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

type ComboboxItemProps = {
  option: { value: string; label: string | null };
  value: string | undefined;
  onChange?: (value: string) => void;
  setOpen: (open: boolean) => void;
};

export function ComboboxItem({ option, value, onChange, setOpen }: ComboboxItemProps) {
  return (
    <CommandItem
      key={option.value}
      value={option.label ?? ""}
      onSelect={() => {
        onChange?.(option.value);
        setOpen(false);
      }}
      className="text-sm"
    >
      {option.label}
      <IconCheck
        aria-hidden="true"
        className={cn("ml-auto size-4", value === option.label ? "opacity-100" : "opacity-0")}
      />
    </CommandItem>
  );
}
