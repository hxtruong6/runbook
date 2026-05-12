import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { ContextStoreProvider } from "./context/ContextStore";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ContextStoreProvider>
      <App />
    </ContextStoreProvider>
  </React.StrictMode>
);
