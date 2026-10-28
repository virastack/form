import base from "../../eslint.config.base.mjs";

export default [
  // The province payloads are generated.
  { ignores: ["data/**"] },
  ...base,
];
