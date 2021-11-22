import { utils } from "ethers";

export const addressesEqual = (first, second) => {
  first = first && utils.getAddress(first);
  second = second && utils.getAddress(second);
  return first === second;
};
