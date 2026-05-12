import type { BlockDef } from "./types";
import { getBaseUrl } from "../api/config";

export const signinDef: BlockDef = {
  kind: "signin",
  label: "Sign in (POST /v1/user/auth/signin)",
  auth: "none",
  inputs: [
    { name: "email", label: "Email", type: "string", required: true, fromContextKey: "email" },
    { name: "password", label: "Password", type: "password", required: true },
  ],
  outputs: [
    { jsonPath: "jwt", contextKey: "jwt" },
    { jsonPath: "_id", contextKey: "userId" },
  ],
  build: (v) => ({
    method: "POST",
    url: `${getBaseUrl()}/v1/user/auth/signin`,
    headers: { "x-client-version": "0.4.0", accept: "application/json" },
    body: { email: v.email, password: v.password },
  }),
};
