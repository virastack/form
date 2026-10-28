import { neighbourhoods as dataNeighbourhoods, provinces as dataProvinces } from "../data.js";

import type { AddressSource } from "./types.js";

/** Reads the bundled dataset, loading each province's neighbourhoods on demand. */
export const defaultSource: AddressSource = {
  provinces: dataProvinces,
  neighbourhoods: dataNeighbourhoods,
};
