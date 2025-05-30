import { useControlField } from "@rvf/react-router";
import { IconCalendar } from "@tabler/icons-react";
import { format } from "date-fns";

import { Button } from "~/components/ui/button";
import { Calendar } from "~/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { cn } from "~/lib/utils";

export function DatePicker({ name }: { name: string }) {
  const [date, setDate] = useControlField<Date | undefined>(name);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn("w-[280px] justify-start text-left font-normal sm:w-[280px]", !date && "text-muted-foreground")}
        >
          <IconCalendar className="mr-2 size-4" />
          {date ? format(date, "PPP") : <span>Pick a date</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <Calendar mode="single" selected={date} onSelect={setDate} autoFocus />
      </PopoverContent>
    </Popover>
  );
}
