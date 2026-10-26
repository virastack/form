// Shared by the form and the server. No "use client": it runs in both.
import { definePolicy } from "@virastack/password/strength";

export const policy = definePolicy({ blocklist: ["acme"] });
