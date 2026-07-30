# yTems → eina de log de projectes d'arquitectura

Estat del projecte i pla de treball. Aquest fitxer és el punt de partida per a
qualsevol sessió nova: llegeix-lo abans de tocar res.

## Context

Còpia pròpia de `halfof8/script-app-oss` (SceneScript, editor de guions de vídeo
escena a escena) transformada en una eina per portar el **log complet de cada
projecte d'arquitectura** (concurs, encàrrec, exercici de curs), mantenint
l'apartat de vídeo de YouTube per documentar cada projecte.

Usuari: Alex, estudiant d'arquitectura. Objectiu final: tenir tots els projectes
reunits en un sol lloc amb plànols, PDFs i imatges adjuntats a cada pas, i poder
recuperar-ho tot d'aquí a 10 anys.

- Nom públic: **yTems** (abans «Sistema»). El repo, el package d'Android i el
  bundle id de macOS es queden com estaven: canviar-los trencaria l'URL en viu
  i faria que l'APK s'instal·lés com una app nova, perdent la configuració.
- Repo: https://github.com/AlexArtazcoz/scenescript (públic, branca `main`)
- Local: `~/Desktop/Claude/Investing/scenescript`
- Stack: React 19 + TypeScript + Vite + Tailwind 4 + Zustand + Dexie (IndexedDB) + dnd-kit
- Idioma dels commits i de la UI nova: català

## Model conceptual

Cada **projecte** (abans "script") es manté a backlog / in progress / done i
conté **4 subcategories renombrables** (fases). Cada fase té les seves pròpies
columnes verticals; cada columna és un pas del procés.

| # | Fase (nom per defecte) | kind | Semàntica de la durada |
|---|---|---|---|
| 1 | Anàlisi i urbanisme | `architecture` | hores a dedicar |
| 2 | Estratègia i projecte | `architecture` | hores a dedicar |
| 3 | Síntesi i producte final | `architecture` | hores a dedicar |
| 4 | Vídeo YouTube | `video` | segons (comportament original) |

A les fases d'arquitectura el **lock** vol dir "hores ja dedicades" (pas fet),
no "bloquejat". El total de la barra esquerra mostra `dedicades/totals h`.

Cada columna té: títol, hores/segons, **àrea de text lliure gran** (on s'escriu),
checklist d'ítems, referències (enllaços) i **adjunts** (PDF/PNG/JPG).

## Fases del pla

- [x] **Fase 1 — Model de dades v6** (`78b38bb`)
  `Script.categories: ScriptCategory[]`, `Scene.categoryId`, taula `attachments`
  amb blobs. Migració Dexie v6: els projectes existents passen sencers a la fase
  de vídeo. Validadors amb backfill segur (abans esborraven la BD sencera si
  trobaven un camp desconegut). Export/import amb adjunts en base64.
- [x] **Fase 2 — Store i plantilles** (`9f024e4`, `0ac0f46`)
  `projectTemplate.ts` amb les columnes plantilla de les 3 fases (passos reals
  del procés d'un arquitecte, amb hores estimades i checklist). `createScript`
  les sembra. Accions per categoria: `renameCategory`, `addScene`,
  `reorderScenes`, `addAttachment`, `deleteAttachment`.
- [x] **Fase 3 — UI de fases** (`0ac0f46`)
  Les 4 fases viuen **al menú de projectes**, no al llenç: clic al projecte
  desplega les seves fases amb animació esglaonada (lletra petita, comptador de
  columnes, doble clic per renombrar). Clic a una fase obre el tauler en aquella
  fase i tanca el calaix. El llenç queda net. La barra esquerra mostra la fase
  activa en taronja sota el títol del projecte.
- [x] **Fase 4 — Columnes: hores i adjunts** (`b6a43b2`)
  Escala d'hores 2–20h a arquitectura (5–50s al vídeo), títols de 16 caràcters
  (8 al vídeo), secció d'adjunts amb miniatura per a imatges i pill per a PDFs,
  límit de 20 MB per fitxer.
- [x] **Fase 5 — Totals i generació per fase** (`b6a43b2`)
  Totals de la barra esquerra per fase; generació per lots limitada a la fase
  activa; el context de l'LLM només veu columnes germanes; la descripció de
  YouTube sempre llegeix la fase de vídeo.
- [x] **Fase 6 — Adjunts de veritat, "Per fer" i referències**
  Visor d'adjunts a pantalla completa (`AttachmentViewer.tsx`): PDFs dins d'un
  iframe amb el visor del navegador, imatges amb clic per fer zoom, fletxes ←/→ i
  tira de miniatures per moure's entre els adjunts de la columna, descarregar,
  obrir en pestanya nova, reanomenar (clic al nom) i esborrar amb doble
  confirmació. Esc tanca. Les fitxes de la columna mostren miniatura (imatges) o
  pill amb etiqueta PDF, nom i mida, amb descàrrega i esborrat al passar per
  sobre. Es poden **arrossegar fitxers** a la secció d'adjunts. Bloquejada la
  columna, només queda descarregar. Etiquetes segons la fase: a arquitectura
  "Per fer" (abans "On-screen"), "Referències" i el diàleg en català; a la fase
  de vídeo es manté l'anglès original. Les referències sense protocol
  (`archdaily.com`) ara s'obren bé i, si no tenen títol, agafen el domini.
  Bug corregit: els object URL es revocaven sota StrictMode i les miniatures i
  el PDF quedaven morts — ara `useBlobUrl` crea i revoca dins del mateix efecte.
- [x] **Fase 7 — Fora benvinguda i demo**
  Eliminats el text de benvinguda de l'App i tota la seed/demo d'onboarding
  (`seedData.ts` esborrat). Amb la BD buida i còpia configurada, l'única
  pantalla inicial és el botó "Restaura els projectes".
- [x] **Fase 8 — Còpia de seguretat al GitHub + desplegament**
  `src/services/backup.ts`: cada còpia és un commit en un repo privat
  (`data.json` + un fitxer per adjunt) via la Git Data API — blobs → tree →
  commit → ref. Els adjunts que no canvien no es tornen a pujar (es compara el
  sha de git calculat en local); els esborrats a l'app s'esborren de la còpia
  (la història de git els conserva). Còpia automàtica cada 3 min si hi ha
  canvis (empremta de l'estat), botó manual i restauració completa des de
  Configuració (secció "Còpia de seguretat (GitHub)"). El token fine-grained
  (només Contents del repo de còpies) viu a localStorage; l'API key d'OpenAI
  mai s'inclou a la còpia. Bootstrap automàtic de repo buit (crea el README).
  Desplegament: workflow `.github/workflows/deploy.yml` a GitHub Pages, base
  `/scenescript/` al build (assets via `import.meta.env.BASE_URL`).
  Verificat amb una API de GitHub simulada: backup → restauració amb integritat
  byte a byte. **Pendent d'Alex:** crear el repo privat de còpies
  (`gh repo create scenescript-backup --private`), activar Pages
  (Settings → Pages → Source: GitHub Actions; amb repo privat cal pla de
  pagament o fer públic el repo del codi) i generar el token fine-grained.
  Nota: a Pages no hi ha el proxy LLM del dev server — la generació no
  funciona allà.

## Fitxers clau

| Fitxer | Què hi ha |
|---|---|
| `src/utils/projectTemplate.ts` | les 4 fases per defecte, columnes plantilla, `resolveActiveCategory` |
| `src/services/db.ts` | esquema Dexie v6, migració, validadors, export/import, CRUD d'adjunts |
| `src/stores/scriptStore.ts` | estat i accions (projectes, columnes, categories, adjunts) |
| `src/stores/uiStore.ts` | `activeCategoryId` i la resta d'estat d'UI |
| `src/components/Sidebar/Sidebar.tsx` | menú de projectes + desplegable de fases |
| `src/components/Storyboard.tsx` | tauler horitzontal, scoping per fase, drag & drop |
| `src/components/SceneCard/SceneCard.tsx` | la columna (1900+ línies): hores, checklist, referències, fitxes d'adjunts |
| `src/components/SceneCard/AttachmentViewer.tsx` | visor d'adjunts a pantalla completa (PDF, imatges, tira de miniatures) |
| `src/components/SceneCard/attachmentUtils.ts` | `useBlobUrl`, `downloadBlob`, `formatBytes` — object URLs segurs amb StrictMode |
| `src/components/LeftBar/LeftBar.tsx` | barra negra: total per fase, menú del boli, import/export |
| `src/services/backup.ts` | còpia/restauració al GitHub (Git Data API), còpia automàtica |
| `.github/workflows/deploy.yml` | build i desplegament a GitHub Pages a cada push a main |
| `SCHEMA_MIGRATIONS.md` | procés obligatori per a qualsevol canvi d'esquema |

## Convencions i traps

- **Qualsevol canvi d'esquema** segueix `SCHEMA_MIGRATIONS.md`: pujar
  `CURRENT_SCHEMA_VERSION`, afegir bloc `version(N).upgrade()`, i **fer backfill
  dins dels validadors** — si `validateScript` retorna false, `initializeDatabase`
  esborra tota la base de dades.
- `Script.sceneOrder` és **llegat**: es manté sincronitzat amb la fase de vídeo
  per compatibilitat, però l'ordre real viu a `category.sceneOrder`.
- Els adjunts van a la seva taula: mai dins de `Scene` (les escenes es reescriuen
  a cada tecla premuda).
- Verificació al navegador amb les eines de preview abans de donar res per bo;
  `npm run build` net i sense errors de lint nous (n'hi ha de preexistents al
  repo original: 8 a `Storyboard.tsx`, 18 entre `SceneCard`/`store`/`generation`).
- Commits en català, un per fase, i push després de cada fase.

## Com arrencar

```bash
npm --prefix ~/Desktop/Claude/Investing/scenescript run dev
```

Consola del navegador: `resetDatabase()` esborra la BD local (només en dev).
