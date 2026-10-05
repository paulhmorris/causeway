import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { useDebounce } from "use-debounce";

type Options = {
  delay?: number;
  minLength?: number;
  /** Search param to write the debounced value into. */
  param?: string;
};

type ReturnValue = [string, (value: string) => void];

export function useDebouncedValue({ delay = 500, minLength = 3, param = "s" }: Options = {}): ReturnValue {
  const [value, setValue] = useState("");
  const [debouncedValue] = useDebounce(value, delay);
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const params = new URLSearchParams();
    // User deleted the search
    if (debouncedValue.length === 0) {
      // Nothing to clear — skip so mounting doesn't cost a navigation and a loader run.
      if (!searchParams.has(param)) {
        return;
      }
      params.delete(param);
      setSearchParams(params, { replace: true });
      return;
    }

    // Needs at least `minLength` characters
    if (debouncedValue.length < minLength) {
      return;
    }

    params.set(param, debouncedValue);
    setSearchParams(params, { replace: true });
  }, [debouncedValue, searchParams, setSearchParams, minLength, param]);

  return [value, setValue];
}
