import { createThemeAction } from "remix-themes";

import { themeSessionResolver } from "~/services.server/session";

export const action = createThemeAction(themeSessionResolver);
