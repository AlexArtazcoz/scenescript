import { v4 as uuidv4 } from 'uuid';
import type { Scene, ScriptCategory } from '../types';

// The 4 default tabs every project gets. Order is chronological:
// analysis → strategy/design → synthesis/delivery → the YouTube video about it.
// Names are defaults only — the user can rename each tab per project.
export const DEFAULT_CATEGORIES: { name: string; kind: ScriptCategory['kind'] }[] = [
  { name: 'Anàlisi i urbanisme', kind: 'architecture' },
  { name: 'Estratègia i projecte', kind: 'architecture' },
  { name: 'Síntesi i producte final', kind: 'architecture' },
  { name: 'Vídeo YouTube', kind: 'video' },
];

export function makeDefaultCategories(): ScriptCategory[] {
  return DEFAULT_CATEGORIES.map(c => ({
    id: uuidv4(),
    name: c.name,
    kind: c.kind,
    sceneOrder: [],
  }));
}

export function getVideoCategory(categories: ScriptCategory[]): ScriptCategory | undefined {
  return categories.find(c => c.kind === 'video');
}

// === Template columns for new projects ===
// Chronological steps of a real architecture project (Spanish LOE phases +
// RIBA Plan of Work, adapted to student/competition work). Each column:
// title ≤16 chars, hours = estimated dedication (durationSec holds hours in
// architecture tabs), checklist = what must be done/collected in that step.
// The big free-text area of every column starts empty — that's where you write.

interface TemplateColumn {
  title: string;
  hours: number;
  checklist: string[];
}

// Indexed by position in DEFAULT_CATEGORIES (video tab has no template).
const TEMPLATE_COLUMNS: TemplateColumn[][] = [
  // 1 — Anàlisi i urbanisme
  [
    { title: 'BASES I BRIEF', hours: 4, checklist: ['Bases llegides i resumides', 'Programa i superfícies demanades', 'Terminis i entregables', 'Criteris del jurat o client'] },
    { title: 'LLOC', hours: 8, checklist: ['Visita feta (o Street View)', 'Fotos i croquis del lloc', 'Història i teixit urbà', 'Fluxos, accessos i vistes'] },
    { title: 'PLÀNOLS TROBATS', hours: 4, checklist: ['Cadastre descarregat', 'Topogràfic aconseguit', 'Planejament (POUM/PGM)', 'Ortofoto i parcel·lari'] },
    { title: 'NORMATIVA', hours: 4, checklist: ['Paràmetres edificables', 'Usos permesos', 'Alçades i ocupació', 'Afectacions i servituds'] },
    { title: 'REFERENTS', hours: 5, checklist: ['3-5 casos comparables', 'Què manllevo de cada un', 'Escala i programa similars'] },
    { title: 'MANIFEST', hours: 3, checklist: ['Postura urbana en 5 línies', 'Què defenso i què rebutjo', 'Paraules clau del projecte'] },
    { title: 'IDEA URBANA', hours: 8, checklist: ['Estratègia d’implantació', 'Croquis de la idea', 'Relació amb el teixit'] },
    { title: 'PRODUCTE URBÀ', hours: 12, checklist: ['Planta urbana 1/1000-1/500', 'Seccions a escala urbana', 'Planta de parcel·la sencera'] },
  ],
  // 2 — Estratègia i projecte
  [
    { title: 'IDEA CLAU', hours: 6, checklist: ['La idea en una sola frase', 'Testada contra lloc i programa', 'Croquis que l’explica', 'Què soluciona exactament'] },
    { title: 'PROGRAMA', hours: 4, checklist: ['Quadre de superfícies', 'Relacions entre usos', 'Organigrama funcional'] },
    { title: 'TIPOLOGIA', hours: 5, checklist: ['Tipus edificatori triat', 'Agregació i repetició', 'Per què aquest tipus'] },
    { title: 'VOLUMETRIA', hours: 6, checklist: ['Implantació a la parcel·la', 'Volums i orientació', 'Maqueta de treball'] },
    { title: 'PLANTES', hours: 15, checklist: ['Planta baixa amb entorn', 'Plantes tipus', 'Nuclis i circulacions'] },
    { title: 'SECCIONS', hours: 10, checklist: ['Secció transversal clau', 'Secció longitudinal', 'Alçats principals'] },
    { title: 'MATERIALITAT', hours: 6, checklist: ['Paleta de materials', 'Reutilització i reciclatge', 'Textures i ambients'] },
    { title: 'ESTRUCTURA', hours: 5, checklist: ['Sistema estructural', 'Llums i cruixies', 'Estratègia d’instal·lacions'] },
    { title: 'DETALL CLAU', hours: 8, checklist: ['El detall que ho resol', 'Secció constructiva 1/20', 'Trobades crítiques'] },
  ],
  // 3 — Síntesi i producte final
  [
    { title: 'ESCALES', hours: 5, checklist: ['Coherència urbà ↔ detall', 'Salts d’escala revisats', 'Res no queda orfe'] },
    { title: 'UNITAT', hours: 4, checklist: ['Discurs únic del projecte', 'Idea clau visible a tot', 'Incoherències corregides'] },
    { title: 'PLÀNOLS FINALS', hours: 15, checklist: ['Plantes definitives', 'Seccions i alçats finals', 'Detalls acabats'] },
    { title: 'MEMÒRIA', hours: 6, checklist: ['Text de la memòria', 'Justificació normativa', 'Quadre de superfícies final'] },
    { title: 'IMATGES', hours: 10, checklist: ['Renders o collages', 'Maqueta final', 'Esquemes explicatius'] },
    { title: 'ENTREGA', hours: 4, checklist: ['Làmines compostes', 'Formats segons bases', 'Entrega feta i comprovada'] },
  ],
];

// Build the template scenes for a new project and register them in each
// category's sceneOrder (mutates the passed categories). Video tab stays empty.
export function makeTemplateScenes(scriptId: string, categories: ScriptCategory[]): Scene[] {
  const now = Date.now();
  const scenes: Scene[] = [];

  const architectureCategories = categories.filter(c => c.kind === 'architecture');
  architectureCategories.forEach((category, catIndex) => {
    const columns = TEMPLATE_COLUMNS[catIndex] ?? [];
    for (const col of columns) {
      const scene: Scene = {
        id: uuidv4(),
        scriptId,
        categoryId: category.id,
        title: col.title,
        durationSec: col.hours, // hours in architecture tabs
        isFixed: false,
        draftVersions: [{ index: 0, content: '', createdAt: now, source: 'manual' }],
        currentDraftIndex: 0,
        narration: null,
        narrationGeneratedAt: null,
        narrationFromDraftIndex: null,
        narrationVersions: [],
        currentNarrationVersionIndex: -1,
        onScreenTexts: col.checklist.map(text => ({ id: uuidv4(), text, isChecked: false })),
        references: [],
      };
      category.sceneOrder.push(scene.id);
      scenes.push(scene);
    }
  });

  return scenes;
}
