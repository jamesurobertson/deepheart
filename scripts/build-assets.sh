#!/usr/bin/env bash
# Copies the CC0 source packs in assets-src/ into public/assets/ (only what the game uses)
# and converts audio to loudness-normalized mp3 so every browser can play it.
set -euo pipefail
cd "$(dirname "$0")/.."
SRC=assets-src
OUT=public/assets
rm -rf "$OUT" && mkdir -p "$OUT/sprites" "$OUT/icons" "$OUT/sfx"

D="$SRC/0x72_DungeonTilesetII_v1.7/0x72_DungeonTilesetII_v1.7"
cp "$D/0x72_DungeonTilesetII_v1.7.png" "$OUT/sprites/dungeon.png"
cp "$D/tile_list_v1.7" "$OUT/sprites/dungeon.txt"

W="$SRC/16x16_weapons_rpg_icons/16x16 Weapons RPG Icons"
for m in bronze iron steel gold; do cp "$W/$m-weapons.png" "$OUT/icons/weapons-$m.png"; done
cp "$SRC/rpg-items.png" "$OUT/icons/items.png"

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
# Background music (Juhani Junkala, "Chiptune Adventures", CC0). Seamless loops; kept quieter than SFX.
mkdir -p "$OUT/music"
M="$SRC/chiptune-adventures"
music() { ffmpeg -v error -y -i "$M/Juhani Junkala [Chiptune Adventures] $2.ogg" -af "loudnorm=I=-22:TP=-2" -b:a 128k -write_xing 1 "$OUT/music/$1.mp3"; }
music stage1 "1. Stage 1"
music stage2 "2. Stage 2"
music boss "3. Boss Fight"
music select "4. Stage Select"
du -sh "$OUT"/*
