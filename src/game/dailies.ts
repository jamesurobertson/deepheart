/**
 * Daily activities: resource dungeons, the world boss, and a checklist that
 * stamps a 28-day board. Resets at local midnight.
 */
export type DungeonId = 'gold' | 'gear' | 'xp';
export type TaskId = 'kills' | 'challenge' | 'dungeons' | 'worldboss' | 'salvage' | 'manual';

export interface DailyState {
  day: string;
  keys: Record<DungeonId, number>;
  best: Record<DungeonId, number>; // highest floor cleared (persists across days)
  wbAttempts: number;
  wbLevel: number; // persists; rises each time the world boss dies
  tasks: Record<TaskId, number>;
  claimed: boolean;
  stamps: number; // 0..28 on the current board
}

export const DUNGEONS: Record<DungeonId, { name: string; blurb: string; icon: string }> = {
  gold: { name: 'Gold Vault', blurb: 'Mountains of gold for the Forge.', icon: 'coin' },
  gear: { name: 'Gear Trial', blurb: 'A guaranteed Rare-or-better item.', icon: 'chest_full_open' },
  xp: { name: 'Spirit Well', blurb: 'Huge experience for your hero and gear.', icon: 'flask_big_green' },
};

export const KEYS_PER_DAY = 3;
export const WB_ATTEMPTS = 3;
export const RUN_SECONDS = 30;
export const RUN_QUOTA = 45;
export const WB_SECONDS = 45;
export const BOARD_DAYS = 28;

export const TASKS: { id: TaskId; name: string; goal: number }[] = [
  { id: 'kills', name: 'Slay 1,000 monsters', goal: 1000 },
  { id: 'challenge', name: 'Attempt a stage Challenge', goal: 1 },
  { id: 'dungeons', name: 'Run 3 dungeons', goal: 3 },
  { id: 'worldboss', name: 'Fight the world boss', goal: 1 },
  { id: 'salvage', name: 'Salvage 5 items', goal: 5 },
  { id: 'manual', name: 'Take control for 30 seconds', goal: 30 },
];

export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function newDaily(): DailyState {
  return {
    day: today(),
    keys: { gold: KEYS_PER_DAY, gear: KEYS_PER_DAY, xp: KEYS_PER_DAY },
    best: { gold: 0, gear: 0, xp: 0 },
    wbAttempts: WB_ATTEMPTS,
    wbLevel: 1,
    tasks: { kills: 0, challenge: 0, dungeons: 0, worldboss: 0, salvage: 0, manual: 0 },
    claimed: false,
    stamps: 0,
  };
}

/** Roll the daily state over if the calendar day changed. Returns true if it reset. */
export function rollover(d: DailyState): boolean {
  const t = today();
  if (d.day === t) return false;
  d.day = t;
  d.keys = { gold: KEYS_PER_DAY, gear: KEYS_PER_DAY, xp: KEYS_PER_DAY };
  d.wbAttempts = WB_ATTEMPTS;
  d.tasks = { kills: 0, challenge: 0, dungeons: 0, worldboss: 0, salvage: 0, manual: 0 };
  d.claimed = false;
  if (d.stamps >= BOARD_DAYS) d.stamps = 0;
  return true;
}

export const tasksDone = (d: DailyState) => TASKS.every((t) => d.tasks[t.id] >= t.goal);

/** What stamping day `n` (1..28) of the board is worth. */
export function stampReward(n: number): { gold: number; item?: 'epic' | 'legendary'; shards?: number } {
  if (n === BOARD_DAYS) return { gold: 400 * n, item: 'legendary', shards: 5 };
  if (n % 7 === 0) return { gold: 300 * n, item: 'epic', shards: 1 };
  return { gold: 150 * n };
}
