import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";

import React from "react";
import ReactDOM from "react-dom/client";
import { MantineProvider, ColorSchemeScript } from "@mantine/core";
import { ModalsProvider } from "@mantine/modals";
import { Notifications } from "@mantine/notifications";
import { App } from "./App";
import { ContextStoreProvider } from "./context/ContextStore";
import { EnvironmentsStoreProvider } from "./environments/EnvironmentsStore";
import { ProjectsStoreProvider } from "./projects/ProjectsStore";
import { theme } from "./theme";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ColorSchemeScript defaultColorScheme="auto" />
    <MantineProvider theme={theme} defaultColorScheme="auto">
      <ModalsProvider>
        <Notifications />
        <ProjectsStoreProvider>
          <EnvironmentsStoreProvider>
            <ContextStoreProvider>
              <App />
            </ContextStoreProvider>
          </EnvironmentsStoreProvider>
        </ProjectsStoreProvider>
      </ModalsProvider>
    </MantineProvider>
  </React.StrictMode>
);
