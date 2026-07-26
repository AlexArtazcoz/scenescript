import type { Scene, SceneComputed, SceneWithComputed } from '../types';
import { countWords, calculateTarget, calculateFit } from './wordCount';

/**
 * Compute derived properties for a scene
 */
export function computeSceneProperties(
  scene: Scene,
  paceWordsPerSec: number
): SceneComputed {
  const { target } = calculateTarget(scene.durationSec, paceWordsPerSec);
  const actualWords = countWords(scene.narration);
  const { status, percent } = calculateFit(actualWords, target);

  // Scene is outdated if current draft version differs from the one used to generate narration
  const isOutdated =
    scene.narrationFromDraftIndex !== null
      ? scene.currentDraftIndex !== scene.narrationFromDraftIndex
      : scene.narration === null; // Consider as outdated if never generated

  return {
    targetWords: target,
    actualWords,
    fitStatus: status,
    fitPercent: percent,
    isOutdated,
    canEdit: !scene.isFixed,
    canGenerate: !scene.isFixed,
  };
}

/**
 * Enhance scene with computed properties
 */
export function withComputed(
  scene: Scene,
  paceWordsPerSec: number
): SceneWithComputed {
  return {
    ...scene,
    computed: computeSceneProperties(scene, paceWordsPerSec),
  };
}

/**
 * Get the current draft content for a scene
 */
export function getCurrentDraft(scene: Scene): string {
  const draft = scene.draftVersions[scene.currentDraftIndex];
  return draft?.content ?? '';
}

/**
 * Get scenes that need generation based on mode
 */
export function getScenesForGeneration(
  scenes: Scene[],
  sceneOrder: string[],
  mode: 'all-unlocked' | 'missing-or-outdated' | { fromSceneId: string; onlyOutdated: boolean },
  paceWordsPerSec: number
): Scene[] {
  // Sort scenes by their order
  const orderedScenes = sceneOrder
    .map(id => scenes.find(s => s.id === id))
    .filter((s): s is Scene => s !== undefined);

  if (typeof mode === 'string') {
    if (mode === 'all-unlocked') {
      return orderedScenes.filter(s => !s.isFixed);
    } else {
      // missing-or-outdated
      return orderedScenes.filter(s => {
        if (s.isFixed) return false;
        const computed = computeSceneProperties(s, paceWordsPerSec);
        return computed.isOutdated || s.narration === null;
      });
    }
  } else {
    // from-scene mode
    const startIndex = orderedScenes.findIndex(s => s.id === mode.fromSceneId);
    if (startIndex === -1) return [];

    const fromScenes = orderedScenes.slice(startIndex);

    if (mode.onlyOutdated) {
      return fromScenes.filter(s => {
        if (s.isFixed) return false;
        const computed = computeSceneProperties(s, paceWordsPerSec);
        return computed.isOutdated || s.narration === null;
      });
    } else {
      return fromScenes.filter(s => !s.isFixed);
    }
  }
}

/**
 * Calculate total runtime of all scenes
 */
export function calculateTotalRuntime(
  scenes: Scene[],
  sceneOrder: string[]
): number {
  return sceneOrder.reduce((total, id) => {
    const scene = scenes.find(s => s.id === id);
    return total + (scene?.durationSec ?? 0);
  }, 0);
}

/**
 * Generate YouTube description from references
 */
export function generateYouTubeDescription(
  scenes: Scene[],
  sceneOrder: string[],
  scriptName: string
): string {
  const lines: string[] = [scriptName, '', '---', ''];

  let currentTime = 0;

  for (const sceneId of sceneOrder) {
    const scene = scenes.find(s => s.id === sceneId);
    if (!scene) continue;

    // Add timestamp and title
    const timestamp = formatTimestamp(currentTime);
    lines.push(`${timestamp} - ${scene.title}`);

    // Add references for this scene
    if (scene.references.length > 0) {
      for (const ref of scene.references) {
        lines.push(`  ${ref.label}: ${ref.url}`);
        if (ref.note) {
          lines.push(`    ${ref.note}`);
        }
      }
    }

    lines.push('');
    currentTime += scene.durationSec;
  }

  return lines.join('\n');
}

function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
