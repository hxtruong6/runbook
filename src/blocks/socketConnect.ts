// src/blocks/socketConnect.ts
import type { BlockDef } from "./types";

export const socketConnectDef: BlockDef = {
  kind: "socketConnect",
  label: "§9 Socket.IO — join chairside session",
  auth: "cookie-or-jwt",
  inputs: [
    { name: "userId", label: "User ID", type: "string", required: true, fromContextKey: "userId" },
    { name: "role", label: "Role", type: "enum", required: true, enumValues: ["DENTIST", "USER"] },
    { name: "orthoReviewId", label: "Ortho review ID", type: "string", required: true, fromContextKey: "orthoReviewId" },
  ],
  outputs: [],
  build: () => {
    throw new Error("socketConnect uses connect(), not build()");
  },
};
