# The Legendary Arc Reactor

> **A fan-made storytelling of the legendary Arc Reactor** — an immersive, scroll-driven 3D tale of a miniature fusion reactor, told piece by piece in light, metal and voice.

**The story of a miniature fusion reactor — an immersive, scroll-driven 3D storytelling experience.**

A dark, cinematic scrollytelling site that takes a fusion reactor apart piece by piece and builds it back again: plasma ignition, magnetic containment, a palladium core, deuterium fuel, a miniature cyclotron, particle acceleration, the energy converter, cooling, and the outer shell — ending with the complete, locked reactor.

> An original fan-made storytelling study. All modelling, renders, text and narration were created for this project. It is not affiliated with, or endorsed by, any film studio or comic publisher.

---

## Experience

1. **Loader** — a reactor boot sequence (`INITIALIZING FUSION CHAMBER` → `SYSTEM ONLINE`).
2. **Entry gate** — press **DIVE INTO THE REACTOR** to begin. That single click is the only thing that starts the guided tour: the reactor ambience **and** the hosted narration. (You can also choose *explore silently*.)
3. **18 chapters** — scroll (or let the guided tour drive) through the whole story:
   Overview → Scale → Ignition → Containment → The Arc → Chamber → Palladium → Fuel → Cyclotron → Acceleration → Fusion → Containment → Field Coils → Converter → Cooling → Outer Shell → Finale → Reinitialize.
4. **Finale** — six interactive hotspots (Fusion Core, Palladium Ring, Field Coils, Energy Converter, Cooling Array, Outer Shell) open a telemetry detail panel.

### Controls

| Action | How |
|---|---|
| Scroll the story | Mouse wheel / touch swipe / trackpad |
| Orbit the reactor | Drag (left mouse) — the camera eases back afterwards |
| Parallax | Move the mouse |
| Section index | **INDEX** button (top-right) or the right-side rail |
| Ambience sound | **SOUND** button (top-right) — procedural reactor hum + coolant |
| Narration | **VOICE** button (top-right) — hosted storytelling voice |
| Guided tour | Starts from the DIVE button; **GUIDED TOUR — TAP TO TAKE CONTROL** pill stops it; your own scroll also takes control |
| Detail panels | Click a hotspot in the finale chapter |
| Restart | **REINITIALIZE SEQUENCE** button in the outro |

### Voice narration

The whole story is narrated by a deep, documentary-style neural voice (Microsoft Edge neural TTS, `en-US-GuyNeural`, slightly slowed and pitched down for a cinematic host feel) as **one continuous recording** — `public/voice/full-story.mp3` (~104 seconds). It opens with *"Welcome to the story of the arc reactor… Please scroll to know more"* and then tells the entire story in a single unbroken flow, exactly like a YouTube voiceover:

- no per-line stops, no stuttering, no gaps — just one natural performance from start to finish;
- it plays regardless of where you are scrolled (the voice is the host; the visuals follow the scroll);
- the guided tour advances one narration line at a time (~2.2s), keeping the scroll roughly in pace with the voice — and any manual scroll instantly takes control back;
- stopping is only possible via the VOICE toggle.

Per-line clips (`public/voice/s{section}-l{line}.mp3`) are kept as a fallback set, and if the main file is missing the player falls back to the best available browser voice.

### Sound design

The ambience is fully procedural Web Audio (no audio files): detuned low hum (54 / 108 / 163 Hz), a slow breathing LFO, filtered coolant noise, and a faint electric shimmer. Its brightness follows the story energy as you scroll.

---

## Tech stack

- **React 18 + Vite 5** — app shell, HUD, captions, menu, panels
- **Three.js 0.170** (raw, no drei) — WebGL scene, custom camera timeline, CSS2D labels, Unreal bloom + custom film-grain/vignette/chromatic-aberration pass
- **Tailwind CSS 3** — utility layer (most styling is a custom design system in `src/index.css`)
- **Framer Motion 11** — caption word-stagger, loader, gate, panels
- **Blender 5.0 (headless, Cycles CPU)** — the reactor model + cinematic stills
- **Edge neural TTS** — narration MP3 generation
- **Express** — static production server (`server.js`)

## The 3D reactor

`public/models/arc_reactor.glb` — a **470-part** model built by `_blender/build_reactor.py`:

- base plate & feet, cooling fins + exhaust, energy converter, fusion chamber with ribs, glass cylinder, palladium ring, deuterium feed tubes, cyclotron disc + spiral, plasma core/torus, containment rings, 10 copper field coils, titanium shell segments, top cap, wiring details.
- Every part is named by group (`coil_`, `shell_`, `palladium_`, …). At runtime the scroll timeline drives a named-group assembly animation: parts slide, scale, spin and explode outward into their exploded-view positions, then lock back together in the finale.
- Materials are enhanced in-engine with procedural brushed-metal / copper / grunge normal + roughness maps (`src/three/textures.js`).
- Effects (`src/three/effects.js`): ambient dust, sparkles, plasma particles, deuterium gas streams, accelerator streaks, magnetic field lines with travelling beads, glow sprites, plasma torus, energy rings, converter electric arcs, HUD rings.

### Blender renders

Rendered in Cycles (CPU) to `public/renders/`:

| File | Use |
|---|---|
| `hero.png` / `hero-clean.png` | OG/hero stills |
| `hall.png` | Hall of Armor background (intro / finale / outro) |
| `lab.png` | Tokamak lab background (plasma / ignition) |
| `core.png` | Macro core bokeh backdrop |
| `bg-hall.jpg`, `bg-lab.jpg`, `bg-core.jpg` | Blurred, darkened versions used as the live WebGL backdrop |

Rebuild the model + renders:

```bash
"C:\Program Files\Blender Foundation\Blender 5.0\blender.exe" --background --factory-startup \
  --python _blender/build_reactor.py
# add `-- --no-render` to skip the stills
```

Regenerate narration (needs `pip install edge-tts`):

```bash
node .analysis/dump-lines.mjs   # writes .analysis/voice-lines.json from src/data/narrative.js
python .analysis/gen-voice.py   # writes public/voice/sXX-lY.mp3
```

## Project structure

```
.
├── index.html                  # SEO / OG meta, fonts
├── package.json
├── server.js                   # express production server (dist/)
├── vite.config.js
├── tailwind.config.js
├── _blender/
│   └── build_reactor.py        # model build + GLB export + Cycles renders
├── public/
│   ├── fonts/                  # NB Architekt (Light / Regular / Bold)
│   ├── models/arc_reactor.glb  # 470-part reactor
│   ├── renders/                # Blender stills + blurred backdrops
│   ├── voice/                  # 54 narration MP3s (s{section}-l{line}.mp3)
│   └── favicon.svg
└── src/
    ├── App.jsx                 # composition, dive gate, tour, audio/voice wiring
    ├── index.css               # design system (HUD, captions, labels, gate, responsive)
    ├── data/
    │   └── narrative.js        # 18 sections: captions, cameras, build states, labels, hotspots
    ├── hooks/
    │   ├── useScrollEngine.js  # scroll → timeline (section units)
    │   └── useMediaQuery.js
    ├── lib/
    │   ├── audio.js            # procedural Web Audio ambience
    │   ├── voice.js            # FIFO narration queue (MP3 + TTS fallback)
    │   └── math.js             # clamp / lerp / damp / easing helpers
    ├── three/
    │   ├── Scene.js            # renderer, camera timeline, assembly, bloom, CSS2D labels
    │   ├── effects.js          # particles, field lines, arcs, rings, glow
    │   └── textures.js         # procedural metal / plasma / glow textures
    └── components/
        ├── Loader.jsx          # boot sequence
        ├── DiveGate.jsx        # entry gate (starts sound + voice + tour)
        ├── Hud.jsx             # brand, SOUND / VOICE / INDEX, section readout, telemetry
        ├── Captions.jsx        # word-stagger captions + SCROLL hint (opening only)
        ├── ProgressRail.jsx    # right-side section rail
        ├── Menu.jsx            # full section index
        ├── DetailPanel.jsx     # finale hotspot telemetry panel
        ├── DimensionFrame.jsx  # 3.5 in / 9 cm dimension overlay (Scale chapter)
        ├── Outro.jsx           # finale / reinitialize
        ├── Cursor.jsx          # custom cursor (fine pointers only)
        └── Atmosphere.jsx      # vignette / scanlines / fades
```

## How the scroll engine works

The page is a fixed WebGL stage plus a tall invisible spacer (`TOTAL_VH` ≈ 1318 vh). Each of the 18 sections owns `height × 0.62` vh of scroll. `useScrollEngine` converts `scrollY` into a **timeline in section units** (0 = first beat of section 01, 16.5 = middle of the finale). `Scene.js` lerps camera position/target/FOV between neighbouring sections and damps the assembly values, so the reactor is always mid-animation while you scroll. Captions, HUD, rail, voice and labels all read from the same timeline.

## Responsive

- **Desktop / laptop** — full HUD, telemetry, progress rail, dimension frame, custom cursor, drag-orbit.
- **Tablet** — HUD condenses, rail hides, menu goes single-column.
- **Mobile (portrait)** — the camera automatically pulls back and widens its FOV so the reactor never crops; HUD buttons become icon-only; captions, labels and hotspots shrink; the detail panel goes full-width; notch safe-areas are respected. Verified at 390×844, 820×1180 and 1920×1080 with no horizontal overflow.
- **Reduced motion** — honoured via `prefers-reduced-motion` (tour auto-scroll off, animations collapsed, custom cursor off).

## Run it

```bash
npm install        # or reuse an existing node_modules
npm run dev        # dev server  → http://localhost:5173
npm run build      # production build → dist/
npm start          # express server → http://localhost:4173
```

Debug helpers (QA only): append `?skipLoader=1` to skip the loader + gate, `?t=12.5` to jump to a timeline position, or use `window.__ARC__` in the console (`scrollToTimeline(t)`, `stateRef`, `voiceRef`).

## Credits

- 3D model, materials, renders: built procedurally in Blender (`_blender/build_reactor.py`).
- Narration voice: Microsoft Edge neural TTS (`en-US-GuyNeural`).
- Typography: NB Architekt.
- Story text: original narration written for this project, inspired by the reference video's structure.
