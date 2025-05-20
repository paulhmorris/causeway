import NProgress from "nprogress";
import { useEffect } from "react";
import { useFetchers, useNavigation } from "react-router";

export function GlobalLoader() {
  const navigation = useNavigation();
  const fetchers = useFetchers();

  useEffect(() => {
    const fetchersIdle = fetchers.every((f) => f.state === "idle");
    if (navigation.state === "idle" && fetchersIdle) {
      NProgress.done();
    } else {
      NProgress.start();
    }
  }, [navigation.state, fetchers]);

  return null;
}
