# HAWA UI Design and Theme Specification

## 1. Overview and Design Philosophy

The user interface of the HAWA IoT Command Center and Web Serial Flasher is built on a brutalist industrial design system inspired by Nothing OS and tactile hardware aesthetics (such as Teenage Engineering and Braun/Dieter Rams).

### Core Principles
- **Strict Sharp Edges**: All interface elements utilize a universal zero-pixel border radius (`border-radius: 0 !important`). No rounded corners or pill curvatures are permitted.
- **Dual-Tone Architectural Palettes**:
  - **Dark Mode**: Deep Obsidian Black (`#0a0a0a`) paired with stark white (`#ffffff`) typography and subtle dark gray card layers.
  - **Light Mode**: Warm Vintage Bone / Cream (`#e7e5d6`) paired with deep jet black (`#000000`) typography.
- **Micro-Dot Matrix Grid**: Backgrounds across both pages render a signature 24px dot matrix grid simulating electronic matrix paper.
- **Strict Emoji-Free Interface**: Professional technical and serial displays rely entirely on vector SVG icons, monospace status tags, or dot-matrix indicators instead of unicode emojis.

---

## 2. Color Palettes and Design Tokens

### 2.1 Dark Mode (Deep Obsidian Edition)
Active by default when `data-theme="dark"` is set or preferred by system settings.

| Token | Hex Value | Purpose |
|---|---|---|
| `--bg-page` / `--bg-primary` | `#0a0a0a` | Deep canvas background |
| `--bg-surface` / `--bg-secondary` | `#050505` | Recessed header and base panels |
| `--bg-card` | `#121212` | Standard card and container background |
| `--bg-card-elevated` | `#181818` | Elevated active card state |
| `--bg-input` | `#050505` | Text fields, select inputs, and dropzones |
| `--border-subtle` | `rgba(255, 255, 255, 0.08)` | Hairline dividers and inactive outlines |
| `--border-color` | `rgba(255, 255, 255, 0.14)` | Standard element borders |
| `--border-frame` | `rgba(255, 255, 255, 0.22)` | Structural chassis container frames |
| `--border-active` | `#ffffff` | Focused and selected element borders |
| `--text-primary` / `--text-main` | `#ffffff` | Primary headings, titles, high-contrast labels |
| `--text-secondary` | `#d4d4d8` | Secondary descriptions and field labels |
| `--text-muted` | `#88888e` | Subtle captions, timestamps, hints |
| `--btn-primary-bg` | `#ffffff` | Primary action button fill |
| `--btn-primary-text` | `#000000` | Primary action button text |
| `--nothing-red` | `#d71921` | Signature Nothing Red accent and status indicators |
| `--nothing-red-glow` | `rgba(215, 25, 33, 0.45)` | Subtle accent luminescence |
| `--terminal-bg` | `#050505` | Serial console inner viewport |
| `--terminal-header-bg` | `#0e0e0e` | Serial console title bar |
| `--terminal-text` | `#ffffff` | Serial console stream text |

### 2.2 Light Mode (Warm Bone / Cream Edition)
Active when `data-theme="light"` is set on the `<html>` root element.

| Token | Hex Value | Purpose |
|---|---|---|
| `--bg-page` / `--bg-primary` | `#e7e5d6` | Warm bone/cream tactile canvas |
| `--bg-surface` / `--bg-secondary` | `#eeece1` | Recessed navigation bar and headers |
| `--bg-card` | `#f4f2e8` | Elevated card surfaces |
| `--bg-card-elevated` | `#faf9f3` | High-contrast highlighted cards |
| `--bg-input` | `#ffffff` | Form input surfaces |
| `--border-subtle` | `rgba(0, 0, 0, 0.08)` | Hairline dividers |
| `--border-color` | `rgba(0, 0, 0, 0.16)` | Standard component borders |
| `--border-frame` | `rgba(0, 0, 0, 0.24)` | Structural chassis outlines |
| `--border-active` | `#000000` | Active and focused element outlines |
| `--text-primary` / `--text-main` | `#000000` | Primary headings and text |
| `--text-secondary` | `#27272a` | Secondary text |
| `--text-muted` | `#52525b` | Captions, hints, footnotes |
| `--btn-primary-bg` | `#000000` | Primary action button fill |
| `--btn-primary-text` | `#e7e5d6` | Primary button text |
| `--btn-secondary-bg` | `#f4f2e8` | Secondary button background |
| `--btn-secondary-text` | `#000000` | Secondary button text |

---

## 3. Typography Hierarchy

The interface employs three distinct typographic styles for visual role clarity:

### 3.1 Dot-Matrix Font (`Doto`)
- **Usage**: Main page titles, metric digits, step labels, and primary brand badges.
- **CSS Family**: `'Doto', 'DotGothic16', monospace, sans-serif`
- **Weights**: 600, 700, 800, 900
- **Tracking / Letter Spacing**: `0.06em` to `0.1em` uppercase for authentic hardware character displays.

### 3.2 Brutalist Sans-Serif (`Space Grotesk`)
- **Usage**: Navigation links, form labels, card body copy, buttons, and descriptive summaries.
- **CSS Family**: `'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`
- **Weights**: 400 (Regular), 500 (Medium), 600 (Semi-bold), 700 (Bold)

### 3.3 Monospace Terminal Font (`JetBrains Mono`)
- **Usage**: Web Serial live telemetry console, hexadecimal memory offsets (`0x10000`), device MAC IDs, and baud rate selectors.
- **CSS Family**: `'JetBrains Mono', 'Fira Code', monospace`
- **Rule**: Text inside `.terminal-screen` is forced to `#ffffff !important` with a `1.55` line height for maximum legibility in both themes.

---

## 4. Component Patterns

### 4.1 Navigation Bar
- Fixed or sticky top bar with backdrop blur (`backdrop-filter: blur(16px)`).
- Contains the brand mark, navigation anchors, theme toggle control, and tunnel connection badge.
- Border: 1px solid bottom border (`var(--border-color)`).

### 4.2 Theme Toggle Button
- Sharp rectangular button displaying an SVG sun/moon icon accompanied by a dot-matrix state label (`LIGHT` / `DARK`).
- On hover, colors invert cleanly without rounded transitions.

### 4.3 Flasher Workflow Mode Tabs
- Top-level workflow switcher allowing the user to select between:
  1. **HAWA OTA Platform**: Automated Wi-Fi setup and remote cloud hub connection.
  2. **Custom Firmware (.bin)**: Direct upload of compiled `.bin` binaries from the local PC with custom partition offsets.
- Active tab features an illuminated red dot-matrix indicator in the top-right corner.

### 4.4 Hardware Selection and Form Controls
- Inputs, selects, and text areas utilize square borders (`0px`) with high-contrast active outlines.
- Numbered step bubbles (`01`, `02`, `03`) transition between inactive, active, and completed (`done`) states.

### 4.5 Web Serial Live Terminal
- Dual-pane layout on desktop screens with a minimum width allocation (`minmax(380px, 420px)`).
- Header bar includes window status dots (red, yellow, green) and a clear terminal action.
- Footer bar includes a baud rate dropdown selector (default `115200`) and a serial command transmission input.

### 4.6 Transparent Tactile Slide Bar Menu
- Left-docked permanent operator navigation rail (`76px` fixed width) configured with borderless transparency (`background: transparent; border-right: none;`).
- Ambient 24px dot-matrix background flows seamlessly under the sidebar canvas for an elevated floating deck look.
- Bulging curved pods (`.sidebar-capsule-pod`) house tactile stacked pill buttons (`border-radius: 999px`) with dark/light mode surface adaptation and soft ambient drop shadows.
- Dedicated tool pods: Fleet Matrix / Serial Telemetry, Firmware Repository / OTA Deployer, and System Settings / Web Flasher Bench.

---

## 5. Theme State Persistence Architecture

Both the Fleet Dashboard and the Web Serial Flasher coordinate state using browser `localStorage`:

```javascript
// Initialization (executed in head before render to avoid flash of wrong theme)
(function() {
  const saved = localStorage.getItem('hawa_theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
})();

// Toggle Handler
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('hawa_theme', theme);
  const label = document.getElementById('themeToggleLabel');
  if (label) label.textContent = (theme === 'light' ? 'DARK' : 'LIGHT');
}
```

---

## 6. Relevant Codebase Files

- [flash.html](file:///d:/HAWA/public/flash.html): Web Serial flashing workstation markup.
- [index.html](file:///d:/HAWA/public/index.html): Global OTA fleet command center markup.
- [flasher.css](file:///d:/HAWA/public/css/flasher.css): Flasher design system and theme tokens.
- [dashboard.css](file:///d:/HAWA/public/css/dashboard.css): Fleet dashboard design system and theme tokens.
- [flasher.js](file:///d:/HAWA/public/js/flasher.js): Web Serial API workflow and terminal handling.
- [dashboard.js](file:///d:/HAWA/public/js/dashboard.js): WebSocket telemetry client and theme sync.
