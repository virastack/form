// Stands in for @virastack/mask when ../mask is not there; the combined test is skipped then.
export const useViraMask = () => {
  throw new Error("@virastack/mask v2 is not available");
};
