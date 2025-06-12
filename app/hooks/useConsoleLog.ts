import { useEffect } from "react";

export function useConsoleLog(message?: any, ...optionalParams: Array<any>) {
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, no-console
    console.log(message, ...optionalParams);
  }, [optionalParams]);
}
