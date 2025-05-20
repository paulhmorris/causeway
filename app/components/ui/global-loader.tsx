import { useFetchers, useNavigation } from "react-router";
import NProgress from "nprogress";
import { useEffect } from "react";

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
