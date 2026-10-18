/**
 * Groups of equivalent name forms seen in the ledgers. A search for any member
 * also matches the others ("John" finds "Jno. Harris"). Lowercase, no periods.
 * Add a group here when transcribers find a new abbreviation.
 */
export const NAME_ABBREVIATIONS: string[][] = [
  ["john", "jno"],
  ["william", "wm", "willm"],
  ["edward", "edw", "edwd"],
  ["george", "geo"],
  ["joseph", "jos"],
  ["charles", "chas"],
  ["thomas", "thos"],
  ["james", "jas"],
  ["samuel", "saml"],
  ["benjamin", "benj"],
  ["robert", "robt"],
  ["richard", "richd"],
  ["daniel", "danl"],
  ["alexander", "alex"],
  ["frederick", "fredk"],
  ["infant", "inf"],
  ["junior", "jr"],
  ["senior", "sr"],
];
