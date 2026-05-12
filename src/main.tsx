import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";

import React from "react";
import ReactDOM from "react-dom/client";
import { MantineProvider } from "@mantine/core";
import { ModalsProvider } from "@mantine/modals";
import { Notifications } from "@mantine/notifications";
import { App } from "./App";
import { ContextStoreProvider } from "./context/ContextStore";
import { EnvironmentsStoreProvider } from "./environments/EnvironmentsStore";
import { theme } from "./theme";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <MantineProvider theme={theme}>
      <ModalsProvider>
        <Notifications />
        <EnvironmentsStoreProvider>
          <ContextStoreProvider>
            <App />
          </ContextStoreProvider>
        </EnvironmentsStoreProvider>
      </ModalsProvider>
    </MantineProvider>
  </React.StrictMode>
);
