// v2 with the Frost Imp's card filmed full width with a camera move, and RAINBOW VAULTS! in the plural.
import * as p from './parts.mjs';
import v2 from './v2.mjs';

const swaps = new Map([[p.card, p.frostcard], [p.vault, p.vaults]]);
export default v2.map((part) => swaps.get(part) ?? part);
