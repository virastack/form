import { provinces as dataProvinces, neighbourhoods as dataNeighbourhoods } from "@virastack/address-data";

import type { AddressSource } from "./types.js";

/** Reads the bundled dataset, loading each province's neighbourhoods on demand. */
export const defaultSource: AddressSource = {
  provinces: dataProvinces,
  neighbourhoods: dataNeighbourhoods,
};
