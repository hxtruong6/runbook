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
  {
    id: "example-github-user-repos",
    name: "Example: GitHub — List Repos",
    createdAt: new Date(0).toISOString(),
    reusable: false,
    blocks: [
      {
        id: "github-block-1",
        kind: "httpRequest",
        overrides: {
          method: "GET",
          url: "https://api.github.com/users/octocat/repos",
          headers: JSON.stringify({ Accept: "application/vnd.github+json" }),
        },
      },
    ],
  },
  {
    id: "example-rest-crud",
    name: "Example: REST CRUD (JSONPlaceholder)",
    createdAt: new Date(0).toISOString(),
    reusable: false,
    blocks: [
      {
        id: "crud-block-1",
        kind: "httpRequest",
        overrides: {
          method: "GET",
          url: "https://jsonplaceholder.typicode.com/posts/1",
        },
      },
      {
        id: "crud-block-2",
        kind: "httpRequest",
        overrides: {
          method: "POST",
          url: "https://jsonplaceholder.typicode.com/posts",
          headers: JSON.stringify({ "Content-Type": "application/json" }),
          body: JSON.stringify({ title: "New post", body: "Hello world", userId: 1 }),
        },
      },
      {
        id: "crud-block-3",
        kind: "httpRequest",
        overrides: {
          method: "DELETE",
          url: "https://jsonplaceholder.typicode.com/posts/1",
        },
      },
    ],
  },
];
