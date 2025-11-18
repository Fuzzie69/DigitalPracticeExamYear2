# Practice Exam — Electrical Level 2/3 (NZ)

A lightweight, browser-based practice exam for NZ Electrical Level 2/3 trainees.

Key features
- Timed exam with progress bar and countdown. Duration is set in `quiz.js` via `EXAM_DURATION` (seconds) and persisted with a fixed end-time for Safari stability.
- Single-answer questions enforced; radios replace checkboxes so changing answers is reliable across navigation.
- Deterministic exam plan per sitting (seeded selection and option order) stored in a small cookie; answers, flags, and current index persist during the sitting.

Run locally
- Serve the folder so `fetch('questions.json')` works:
  - `npx http-server .` or `npx serve .`
  - `python -m http.server 8080`
  - VS Code Live Server
Then open the shown URL (e.g., `http://localhost:8080`).

Data
- Primary bank: `questions.json` (required keys: `id`, `question`, `options[]`, `answer`, `reference`).
- Optional curated sets like `questions-new.json`. The app currently loads `questions.json`.

Question media
- You can attach reference images to questions. Two schemas are supported:
  - Simple: `image: string`, plus optional `imageAlt: string`, `imageCaption: string`.
  - Rich: `images: Array<{ src: string, alt?: string, caption?: string }>`; this takes precedence when present.
- Place files under `assets/img/questions/<topic>/` (e.g., `assets/img/questions/resistance/`). PNG/JPG/SVG accepted.
- Paths:
  - If `src` starts with `assets/` or `./assets/` it is used as-is.
  - Otherwise it is treated as relative to `assets/img/` (e.g., `questions/resistance/q501.png` → `assets/img/questions/resistance/q501.png`).
- Accessibility: provide meaningful `alt` text; captions are optional but recommended.
- UI rendering: media is inserted after the question text as `<figure class="question-media"><img loading="lazy">[<figcaption>]</figcaption></figure>`.

Validation & tools
- Validate media paths and `alt` coverage:
  - `node tools/validate-media.js` (exits non‑zero on missing files; warns on missing `alt`).
- Generate a manifest of PNG assets for the gallery test:
  - `node tools/list-assets.js` (writes `tests/assets-manifest.js`).
- Visual gallery to spot broken images:
  - Open `tests/assets.test.html` in a browser.

Editing basics
- Change exam duration: update `EXAM_DURATION` in `quiz.js`.
- Add/modify questions: keep `id` unique; `answer` must be a string (single-answer mode) and appear in `options`.

Notes
- Timer colors: green normally, amber at 10 minutes remaining, red at 2 minutes.
