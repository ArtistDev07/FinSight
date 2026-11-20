# FinSight 2.0 — Design System & Visual Tokens

## Color & Theme Architecture (`src/index.css`)

FinSight supports seamless **Light Mode (Warm Editorial Mint)** and **Dark Mode (Deep Emerald Editorial)** toggled via `ThemeContext` and persisted with user preferences.

| Semantic Token | Light Mode Value | Dark Mode Value | Role |
| :--- | :--- | :--- | :--- |
| `--fs-bg` | `#F5F7F3` | `#0A1815` | Canvas background |
| `--fs-surface` | `#FFFFFF` | `#10231E` | Primary elevated card surface |
| `--fs-surface-2` | `#EDF3EF` | `#17342A` | Secondary inset surface & table headers |
| `--fs-brand` | `#123D32` | `#BCE8D3` | Primary brand emphasis & active states |
| `--fs-accent` | `#168366` | `#66C49F` | Interactive focus, links, and primary highlights |
| `--fs-text` | `#172923` | `#F0F6F2` | Primary high-contrast headings & numerals |
| `--fs-text-body` | `#53675E` | `#A3B9AD` | Secondary descriptions & labels |
| `--fs-text-muted` | `#819188` | `#7F978B` | Captions, metadata & table sub-labels |
| `--fs-border` | `#DEE7E0` | `#29453A` | Crisp 1px architectural card & divider borders |
| `--fs-success` | `#21845D` | `#58C993` | Positive cash flow & verified status |
| `--fs-warning` | `#C48A32` | `#E9BE70` | Caution utilization & pending review |
| `--fs-danger` | `#CB5252` | `#EF8585` | Overdue items, shortfalls & high-risk alerts |
| `--fs-info` | `#477EAD` | `#7BB9DC` | Informational metrics & partial settlements |

## Typography

- **Display Headings (`font-display`)**: `Manrope` with balanced wrapping.
- **Body Copy**: `Inter` at `15px` base / `1.55` line height.
- **Financial Numerals (`font-mono-num` / `tabular-nums`)**: `IBM Plex Mono` with tabular numerals for exact column alignment across INR ledgers and calculators.

## Reusable Component Primitives (`@layer components`)

- `.fs-card`, `.fs-card-secondary`, `.fs-container-lg`: Layered surfaces with `14px` / `20px` radii and `1px` `--fs-border`.
- `.fs-input`: Standardized form control inside `@layer components` so Tailwind spacing utilities (such as `pl-9` for leading icons) compose cleanly without cascade overrides.
- `.fs-btn-primary`, `.fs-btn-secondary`: Accessible button primitives with keyboard focus rings and reduced-motion support.
- **Custom Visual Assets (`src/components/brand/FinSightArtwork.tsx`, `src/components/charts/FinSightCharts.tsx`)**: Brand mark, hero Connected Financial Clarity Map SVG, module illustrations, empty state cards, and lightweight SVG charts (Bar, Allocation Ring, Cash-Flow Trajectory, Gauge).
