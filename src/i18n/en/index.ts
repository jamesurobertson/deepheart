import type { LocaleMeta } from '../types.ts';
import { DATA } from './data.ts';
import { GAME } from './game.ts';
import { KEEP } from './keep.ts';
import { MENU } from './menu.ts';
import { SYSTEM } from './system.ts';
import { UI } from './ui.ts';
import { WIKI } from './wiki.ts';

/** Every UI message in English, the language the others are translated from. Game content is in content.ts. */
export const EN = { ...SYSTEM, ...UI, ...MENU, ...KEEP, ...GAME, ...DATA, ...WIKI };

export const EN_META: LocaleMeta = {
  code: 'en',
  name: 'English',
  steam: 'english',
  numbers: {
    group: 3,
    short: ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc', 'UDc', 'DDc', 'TDc', 'QaDc', 'QiDc', 'SxDc', 'SpDc', 'OcDc', 'NoDc', 'Vg', 'UVg', 'DVg', 'TVg', 'QaVg', 'QiVg', 'SxVg', 'SpVg', 'OcVg', 'NoVg', 'Tg'],
    long: ['', 'thousand', 'million', 'billion', 'trillion', 'quadrillion', 'quintillion', 'sextillion', 'septillion', 'octillion', 'nonillion', 'decillion', 'undecillion', 'duodecillion', 'tredecillion', 'quattuordecillion', 'quindecillion', 'sexdecillion', 'septendecillion', 'octodecillion', 'novemdecillion', 'vigintillion'],
  },
};
