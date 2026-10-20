// The trailer's building blocks. Each part is a whole number of bars of the music: its shots (a take from out/takes,
// where in it to start, how many bars), and a caption or title card. A cut (v1.mjs, v2.mjs...) is a list of parts.
//   from / at: seconds into the take, or a moment found in its log: starts('card', -2.4), ends('boss', -0.7).
import { BEAT, ends, starts } from '../lib/edit.mjs';
import { FIRST_CLICK } from '../scenes/opening.mjs';

export const title = { shots: [{ take: 'sweep', from: 0.3, bars: 2 }], card: 'title', blur: true };

// Close up on a young party, the button held.
export const fight = { shots: [{ take: 'fresh', from: 0.6, bars: 2 }], caption: 'FIGHT MONSTERS' };

// Full width: the Squire alone, a click every two beats (half a bar in, so they land on beats one and three).
export const opening = { shots: [{ take: 'opening', from: FIRST_CLICK - 2 * BEAT, bars: 2 }], caption: 'FIGHT MONSTERS' };

export const hire = { shots: [{ take: 'hire', from: 0.5, bars: 2 }], caption: { main: 'HIRE HEROES', sub: 'a party of 24 companions' } };

export const deeper = { shots: [{ take: 'sweep', from: 1.0, bars: 1 }, { take: 'stairs', from: 4.0, bars: 1 }], caption: 'GO DEEPER' };

// The end of the fight, then the whole CLUTCH! slow motion.
export const boss = {
  shots: [{ take: 'boss', from: ends('boss', -0.7), bars: 2, sounds: [{ sfx: 'bosskill', at: ends('boss'), volume: 0.7 }] }],
  caption: 'BOSS BATTLES',
};

export const rampage = { shots: [{ take: 'rampage', from: 0.3, bars: 2 }], caption: 'UNLEASH A RAMPAGE' };

// The drop and landing, then the reveal centre screen (its flip sounds 0.38 s in).
export const card = {
  shots: [{ take: 'card', from: starts('card', -2.4), bars: 4, sounds: [{ sfx: 'cardgold', at: starts('card', 0.38), volume: 0.9 }] }],
  caption: { main: 'MONSTER CARDS', top: true },
};

// Full width, Frozen Vault: the camera pushes in as the card spins out of a Frost Imp, then pulls back as it flies
// to the Collection button. Same four bars and the same moment for the reveal as the card part above.
export const frostcard = {
  shots: [{ take: 'frostcard', from: starts('card', -2.4), bars: 4, sounds: [{ sfx: 'cardgold', at: starts('card', 0.38), volume: 0.9 }] }],
  caption: { main: 'MONSTER CARDS', top: true },
};

export const collection = { shots: [{ take: 'collection', from: 0.5, bars: 2 }], caption: 'COLLECT THEM ALL' };

// The goblin's last few seconds across the room, the catch, then the Treasure! banner.
export const goblin = {
  shots: [{ take: 'goblin', from: ends('raid', -3.4), bars: 4, sounds: [{ sfx: 'treasure', at: ends('raid'), volume: 0.7 }] }],
  caption: 'TREASURE GOBLINS',
};

export const vault = { shots: [{ take: 'vault', from: 0.1, bars: 2, sounds: [{ sfx: 'jackpot', at: 0.24, volume: 0.6 }] }] };

// The same shot with its banner in the plural: RAINBOW VAULTS!
export const vaults = { shots: [{ take: 'vaults', from: ends('raid', -0.12), bars: 2, sounds: [{ sfx: 'jackpot', at: ends('raid'), volume: 0.6 }] }] };

export const zones = { shots: ['zone0', 'zone1', 'zone2', 'zone3'].map((take) => ({ take, from: 0.5, bars: 1 })) };

export const end = { shots: [{ take: 'stairs', from: 3.0, bars: 4 }], card: 'end', blur: true };
