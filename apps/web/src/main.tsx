import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";

import React from "react";
import ReactDOM from "react-dom/client";
import { MantineProvider, ColorSchemeScript } from "@mantine/core";
import { ModalsProvider } from "@mantine/modals";
import { Notifications } from "@mantine/notifications";
import { App } from "./App";
import { SharedRun } from "./pages/SharedRun";
import { ContextStoreProvider } from "./context/ContextStore";
import { EnvironmentsStoreProvider } from "./environments/EnvironmentsStore";
import { theme } from "./theme";
import "./index.css";

// Lightweight client-side routing for /s/:slug
const SHARE_PATH_RE = /^\/s\/([A-Za-z0-9]{1,64})$/;
const shareMatch = SHARE_PATH_RE.exec(window.location.pathname);
const shareSlug = shareMatch ? shareMatch[1]! : null;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ColorSchemeScript defaultColorScheme="auto" />
    <MantineProvider theme={theme} defaultColorScheme="auto">
      <ModalsProvider>
        <Notifications />
        <EnvironmentsStoreProvider>
          <ContextStoreProvider>
            {shareSlug ? <SharedRun slug={shareSlug} /> : <App />}
          </ContextStoreProvider>
        </EnvironmentsStoreProvider>
      </ModalsProvider>
    </MantineProvider>
  </React.StrictMode>
);
