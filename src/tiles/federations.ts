import { Federation } from "../enums";

export default  {
  [Federation.Federation1]: ["12vp"],
  [Federation.Federation2]: ["8vp,q"],
  [Federation.Federation3]: ["8vp,2t"],
  [Federation.Federation4]: ["7vp,2o"],
  [Federation.Federation5]: ["7vp,6c"],
  [Federation.Federation6]: ["6vp,2k"],
  [Federation.FederationGleens]: ["o,k,2c"]
};

export function isGreen(federation: Federation) {
  return federation !== Federation.Federation1;
}