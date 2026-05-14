import type { Scenario } from "./types";

export const PREBUILT_SCENARIOS: Scenario[] = [
  {
    id: "example-health-check",
    name: "Example: Health Check",
    createdAt: new Date(0).toISOString(),
    reusable: false,
    blocks: [
      {
        id: "example-block-1",
        kind: "httpRequest",
        overrides: {
          method: "GET",
          url: "https://httpbin.org/get",
        },
      },
    ],
  },
];
