# SceneScript

A local-first tool for writing video scripts scene by scene, with optional AI-assisted
narration generation through any OpenAI-compatible API.

[![Watch the SceneScript overview on YouTube](docs/overview.png)](https://youtu.be/5XqCRitYRC4)

▶︎ **[Watch the overview on YouTube](https://youtu.be/5XqCRitYRC4)** — a short tour of how the app works.

> ⚠️ **Status: unfinished personal playground.** I built this for myself, so expect rough edges.
> There is **no mobile version and no responsive layout** — it's designed for a wide desktop screen
> only. It is shared as-is, mostly as a reference and a fun thing to poke at, not as a polished product.

## Try the demo

The fastest way to learn the app is the built-in **onboarding demo**. From an empty project, click
**Load onboarding demo**: it loads a sample script whose scenes double as a guided tour, walking you
through scenes, durations, drafts, narration, on-screen text, references, versions, locking, and
settings. Clear it whenever you're ready to start your own.

SceneScript organizes a video into a horizontal storyboard of scene columns. Each scene
holds a duration, draft notes, on-screen text, and reference links. You can generate spoken
narration per scene (or in batch) that respects a target word count derived from the scene
duration and a configurable speaking pace, then export everything — including a generated
YouTube description — when you're done.

All data is stored locally in your browser via IndexedDB. No backend is required.

## Features

- Scene-based storyboard with drag-to-reorder, insert, and delete
- Per-scene draft versions and narration versions
- AI narration generation targeting a word count based on duration × pace
- Timeline and reading layout modes
- On-screen text checklist and reference links per scene
- YouTube description generator
- Import / export of all data as JSON
- Bring-your-own-key: works with any OpenAI-compatible `chat/completions` endpoint

## Getting started

```bash
npm install
npm run dev
```

Then open the printed local URL. Click **Load onboarding demo** to populate a sample script
that walks you through every feature, or start from an empty project.

## Configuration

Open **Settings** to set:

- **API Base URL** — defaults to `https://api.openai.com/v1`. Any OpenAI-compatible endpoint works.
- **API Key** — stored locally in your browser only.
- **Model** — e.g. `gpt-4o`, `gpt-4.1`, etc.
- **Pace** — words per second, used to compute per-scene target word counts.

During development, requests are routed through a small dev-server proxy
(`/llm-proxy`, see `vite.config.ts`) to avoid browser CORS restrictions. The proxy simply
forwards the request to the base URL you configured, attaching your key as a Bearer token.

## Scripts

- `npm run dev` — start the Vite dev server
- `npm run build` — type-check and build for production
- `npm run preview` — preview the production build
- `npm run lint` — run ESLint

## Tech stack

React 19, TypeScript, Vite, Tailwind CSS, Zustand, Dexie (IndexedDB), dnd-kit.

## License

See [LICENSE](./LICENSE).
