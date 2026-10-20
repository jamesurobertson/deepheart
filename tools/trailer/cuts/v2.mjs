// v1, but it starts slow: the Squire alone at full width, the Ranger for hire and the Dwarf still a silhouette.
import * as p from './parts.mjs';
import v1 from './v1.mjs';

export default v1.map((part) => (part === p.fight ? p.opening : part));
