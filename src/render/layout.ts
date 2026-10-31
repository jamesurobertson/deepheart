/** Where things stand in a room: the back wall's columns, fountain, banners and torches, and the spot in the floor
 *  where the stairwell goes down. Each player gets their own rooms, new on every descent (see Scene.roomSeed).
 *  Rooms keep a rhythm so any of them looks built: columns evenly spaced, the fountain and banners centered between
 *  them, the torches evenly spaced. */
export interface RoomLayout {
  pillars: number[];
  /** The fountain's wall tile, if the room has one. */
  fountain: number | null;
  /** Wall tiles hung with a banner, on the row above the columns. */
  banners: number[];
  /** Always four: the room has four torch lights. */
  torches: number[];
  stairs: { x: number; z: number };
}

/** The rooms as they were before layouts: the Rainbow Vault keeps this one. */
export const CLASSIC_LAYOUT: RoomLayout = { pillars: [-13, -5.5, 2, 9.5], fountain: -2, banners: [-9, 5, 12], torches: [-12, -2, 6, 14], stairs: { x: 9, z: -5 } };

/** The part of the back wall the camera shows. */
const WALL_FROM = -11;
const WALL_TO = 11;

export function roomLayout(r: () => number): RoomLayout {
  const pick = <T>(list: T[]) => list[Math.floor(r() * list.length)];

  // Columns: none, or an even run of them across the wall, each centered on a tile and an even number of tiles
  // apart, so a bay's middle is a whole tile for a banner or the fountain.
  const count = pick([0, 3, 3, 4, 4, 5]);
  const pillars: number[] = [];
  if (count) {
    const gap = 2 * Math.round((WALL_TO - WALL_FROM) / count / 2);
    const start = Math.round(-(gap * (count - 1)) / 2 + (r() - 0.5) * gap * 0.5) + 0.5;
    for (let i = 0; i < count; i++) pillars.push(start + i * gap);
  }
  // The bays between columns, by the wall tile at their middle (without columns, a few evenly spaced spots).
  const bays = pillars.length > 1 ? pillars.slice(1).map((x, i) => (pillars[i] + x) / 2 - 0.5) : [-8, -3, 2, 7];

  // The fountain in a bay near the middle, or none.
  const middle = bays.filter((x) => Math.abs(x) <= 5);
  const fountain = r() < 0.75 && middle.length ? pick(middle) : null;

  // Banners: in every bay, every other bay, or none, but never over the fountain.
  const pattern = pick(['all', 'alternate', 'alternate', 'none'] as const);
  const offset = Math.floor(r() * 2);
  const banners = pattern === 'none' ? [] : bays.filter((x, i) => x !== fountain && (pattern === 'all' || i % 2 === offset));

  // Four torches evenly spaced, the set slid along the wall together; one that would hang over a column (they can
  // stand four tiles tall) steps aside.
  const shift = Math.round((r() - 0.5) * 2);
  const torches = [-9, -3, 3, 9].map((x) => {
    const t = x + shift;
    const column = pillars.find((p) => Math.abs(p - (t - 0.5)) < 1);
    return column === undefined ? t : Math.round(column + (t - 0.5 >= column ? 1.5 : -1.5) + 0.5);
  });

  // The stairwell against the back wall near the right of the room, going down to the right.
  const stairs = { x: 8 + Math.floor(r() * 2), z: -5 };
  return { pillars, fountain, banners, torches, stairs };
}
