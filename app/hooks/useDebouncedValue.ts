import { useSearchParams } from "react-router";
import { useEffect, useState } from "react";
import { useDebounce } from "use-debounce";

type Options = {
  delay?: number;
  minLength?: number;
};

type ReturnValue = [string, (value: string) => void];

export function useDebouncedValue({ delay = 500, minLength = 3 }: Options = { delay: 500, minLength: 3 }): ReturnValue {
  const [value, setValue] = useState("");
  const [debouncedValue] = useDebounce(value, delay);
  const [_, setSearchParams] = useSearchParams();

  useEffect(() => {
    const params = new URLSearchParams();
    // User deleted the search
    if (debouncedValue.length === 0) {
      params.delete("s");
      setSearchParams(params, { replace: true });
      return;
    }

    // Needs at least 3 characters
    if (debouncedValue.length < minLength) {
      return;
    }

    params.set("s", debouncedValue);
    setSearchParams(params, { replace: true });
  }, [debouncedValue]);

  return [value, setValue];
}
