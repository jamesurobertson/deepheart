#!/usr/bin/env bash
# Copies the CC0 source packs in assets-src/ into public/assets/ (only what the game uses)
# and converts audio to loudness-normalized mp3 so every browser can play it.
set -euo pipefail
cd "$(dirname "$0")/.."
SRC=assets-src
OUT=public/assets
rm -rf "$OUT" && mkdir -p "$OUT/sprites" "$OUT/sfx"

# All sprites (DungeonTileset II + the add-on packs) are packed into one sheet.
node scripts/build-atlas.ts

# name -> source file (relative to assets-src). Swap freely; names are what the game uses.
sfx() { ffmpeg -v error -y -i "$SRC/$2" -af "loudnorm=I=-${3:-18}:TP=-1.5,aresample=44100" -ac 1 -b:a 96k "$OUT/sfx/$1.mp3"; }
I=kenney_impact-sounds/Audio; R=kenney_rpg-audio/Audio; U=kenney_interface-sounds/Audio; J=kenney_music-jingles/Audio
for n in 0 1 2 3 4; do
  sfx hit$n   "$I/impactPunch_medium_00$n.ogg" 22
  sfx crit$n  "$I/impactPlate_medium_00$n.ogg" 19
  sfx hurt$n  "$I/impactSoft_heavy_00$n.ogg" 22
  sfx step$n  "$I/footstep_concrete_00$n.ogg" 30
done
sfx mega      "$I/impactBell_heavy_000.ogg" 17
sfx kill      "$I/impactGeneric_light_002.ogg" 24
sfx chest     "$R/creak1.ogg" 20
sfx coins     "$R/handleCoins.ogg" 20
sfx equip     "$R/drawKnife1.ogg" 18
sfx salvage   "$U/glass_002.ogg" 22
sfx click     "$U/click_002.ogg" 22
sfx toggle    "$U/toggle_002.ogg" 22
sfx open      "$U/open_002.ogg" 22
sfx close     "$U/close_002.ogg" 22
sfx levelup   "$U/maximize_006.ogg" 22
sfx descend   "$R/doorOpen_1.ogg" 22
sfx death     "$J/Hit jingles/jingles_HIT03.ogg" 20
sfx drop1     "$U/drop_002.ogg" 20
sfx drop2     "$J/Pizzicato jingles/jingles_PIZZI01.ogg" 19
sfx drop3     "$J/Steel jingles/jingles_STEEL01.ogg" 18
sfx drop4     "$J/8-Bit jingles/jingles_NES00.ogg" 17
sfx awaken    "$J/Steel jingles/jingles_STEEL07.ogg" 17
sfx boss      "$J/Hit jingles/jingles_HIT15.ogg" 17
sfx bosskill  "$J/Hit jingles/jingles_HIT11.ogg" 17
# The card drop "tink" is synthesized, not from a pack.
node scripts/card-sound.ts
# Background music (Juhani Junkala, "Chiptune Adventures", CC0). Seamless loops; kept quieter than SFX.
mkdir -p "$OUT/music"
M="$SRC/chiptune-adventures"
music() { ffmpeg -v error -y -i "$M/Juhani Junkala [Chiptune Adventures] $2.ogg" -af "loudnorm=I=-22:TP=-2" -b:a 128k -write_xing 1 "$OUT/music/$1.mp3"; }
music halls "1. Stage 1"
music boss "3. Boss Fight"
# One track per zone, plus a second boss theme for zone bosses. All CC0, from OpenGameArt:
# Juhani Junkala "5 Chiptunes (Action)", Memoraphile "Spooky Dungeon", Wolfgang_ "Desert Theme",
# Zane Little "Void Estate", The Art Bros "Dark Forest Waltz", Jonathan So "Fields of Ice".
# Loaded one at a time by the game, so they're encoded a little smaller.
X="$SRC/music-extra"
zone() { ffmpeg -v error -y -i "$X/$2" -af "loudnorm=I=-22:TP=-2" -b:a 96k -write_xing 1 "$OUT/music/$1.mp3"; }
zone crypts  "spooky-dungeon.mp3"
zone warrens "juhani-level-1.mp3"
zone tomb    "desert-theme.mp3"
zone rotting "void-estate-haunted.ogg"
zone grove   "dark-forest-waltz.ogg"
zone demon   "juhani-level-3.mp3"
zone frozen  "fields-of-ice.mp3"
zone boss2   "juhani-level-2.mp3"
du -sh "$OUT"/*
