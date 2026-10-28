export interface AddressOption {
  readonly value: string;
  readonly label: string;
}

export interface NeighbourhoodOption extends AddressOption {
  /** The first postal code, which is the only one for all but a few hundred. */
  readonly postalCode: string;
  readonly postalCodes: readonly string[];
}

export interface AddressValue {
  /** Plate code as a string, so it survives a form submit unchanged. */
  readonly provinceCode: string | null;
  readonly province: string | null;
  readonly district: string | null;
  readonly neighbourhood: string | null;
  readonly postalCode: string | null;
  /** Every code the neighbourhood covers; empty until one is picked. */
  readonly postalCodes: readonly string[];
}

export interface AddressProvince {
  readonly code: number;
  readonly name: string;
  readonly districts: readonly string[];
}

export interface AddressNeighbourhood {
  readonly name: string;
  readonly postalCode: string;
  readonly postalCodes: readonly string[];
}

/**
 * Where the lists come from. The default reads `@virastack/address/data`; swap
 * it for a fixture in tests, or for your own endpoint.
 */
export interface AddressSource {
  readonly provinces: readonly AddressProvince[];
  neighbourhoods(provinceCode: number): Promise<ReadonlyMap<string, readonly AddressNeighbourhood[]>>;
}

export type AddressLevel = "province" | "district" | "neighbourhood";
