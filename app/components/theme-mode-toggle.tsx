import { IconMoon, IconSunHigh } from "@tabler/icons-react";
import { Theme, useTheme } from "remix-themes";

import { Button } from "~/components/ui/button";

export function ThemeModeToggle() {
  const [_, setTheme] = useTheme();

  function handleToggleTheme() {
    setTheme((theme) => (theme === Theme.DARK ? Theme.LIGHT : Theme.DARK));
  }

  return (
    <Button variant="ghost" size="icon" onClick={handleToggleTheme} className="shrink-0">
      <IconSunHigh className="h-[1.2rem] w-[1.2rem] scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
      <IconMoon className="absolute h-[1.2rem] w-[1.2rem] scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
