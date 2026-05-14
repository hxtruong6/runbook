import type { EnvironmentsState } from "./types";

export const DEFAULT_ENVIRONMENTS_STATE: EnvironmentsState = {
  environments: [
    {
      id: "default-local",
      name: "Local",
      baseUrl: "http://localhost:3000",
      auth: { kind: "none" },
      headers: {},
      createdAt: new Date(0).toISOString(),
    },
    {
      id: "default-staging",
      name: "Staging",
      baseUrl: "https://staging.example.com",
      auth: { kind: "bearer", token: "" },
      headers: {},
      createdAt: new Date(0).toISOString(),
    },
  ],
  activeId: "default-local",
};
