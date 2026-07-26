import { v4 as uuidv4 } from 'uuid';
import type { ScriptCategory } from '../types';

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
