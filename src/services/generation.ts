import type { Scene, Script, GenerationResult } from '../types';
import { countWords, calculateTarget } from '../utils/wordCount';
import { getStoredApiKey, getStoredModel, getStoredBaseUrl } from './db';

/**
 * Generate narration for a single scene, sending the full script as context
 * so the model preserves tone, voice, and continuity.
 */
export async function generateNarration(
  scene: Scene,
  script: Script,
  allScenes?: Scene[],
  onProgress?: (attempt: number) => void
): Promise<GenerationResult> {
  const apiKey = getStoredApiKey();
  if (!apiKey) {
    return {
      sceneId: scene.id,
      success: false,
      error: 'No API key configured. Please add your OpenAI API key.',
    };
  }

  if (scene.isFixed) {
    return {
      sceneId: scene.id,
      success: false,
      error: 'Scene is locked. Unlock to regenerate.',
    };
  }

  const target = calculateTarget(scene.durationSec, script.paceWordsPerSec);
  const model = getStoredModel();
  // Use the stored base URL as-is (like the OpenAI SDK's base_url parameter).
  // Default: "https://api.openai.com/v1" → .../v1/chat/completions
  const resolvedBase = getStoredBaseUrl().replace(/\/$/, '');
  // All requests go through /llm-proxy to bypass browser CORS restrictions.
  const fetchUrl = '/llm-proxy/chat/completions';

  const systemPrompt = buildSystemPrompt(script);
  const contextBlock = buildScriptContext(script, allScenes ?? [], scene.id);
  let userPrompt = buildUserPrompt(scene, target, contextBlock);

  const maxAttempts = 3;
  let lastNarration = '';
  let lastWordCount = 0;

  // GPT-o* and GPT-5* reasoning models don't support temperature
  const isReasoningModel = model.startsWith('o') || model.startsWith('gpt-5');

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    onProgress?.(attempt);

    try {
      const body: Record<string, unknown> = {
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      };
      if (!isReasoningModel) body.temperature = 0.7;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'x-llm-base-url': resolvedBase,
        'x-llm-key': apiKey,
      };

      // 60-second timeout prevents indefinite hangs
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60_000);

      const t0 = performance.now();
      const res = await fetch(fetchUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      console.log(`[gen] ${model} attempt ${attempt}: ${res.status} in ${Math.round(performance.now() - t0)}ms`);

      if (!res.ok) {
        let errJson: any = {};
        const rawText = await res.text();
        try { errJson = JSON.parse(rawText); } catch { /* ignore */ }
        const errMsg = errJson?.error?.message || res.statusText || 'Unknown error';
        const errCode = errJson?.error?.code || '';
        const status = res.status;
        const keyHint = apiKey ? `key=${apiKey.slice(0, 7)}...${apiKey.slice(-4)}` : 'no key';

        console.error(`OpenAI ${status} (${keyHint}):`, rawText);

        if (status === 401) return { sceneId: scene.id, success: false, error: `401 ${keyHint}: ${errMsg}` };
        if (status === 404) return { sceneId: scene.id, success: false, error: `Model "${model}" not found. Check model name in Settings.` };
        if (status === 429) {
          if (attempt < maxAttempts) { await sleep(2000 * attempt); continue; }
          return { sceneId: scene.id, success: false, error: `OpenAI 429: ${errMsg}` };
        }
        if (status === 403) return { sceneId: scene.id, success: false, error: `Access forbidden: ${errMsg}` };
        return { sceneId: scene.id, success: false, error: `API error ${status} ${errCode}: ${errMsg}` };
      }

      const json = await res.json();
      const narration = (json.choices?.[0]?.message?.content ?? '').trim();

      const wordCount = countWords(narration);

      lastNarration = narration;
      lastWordCount = wordCount;

      if (wordCount >= target.min && wordCount <= target.max) {
        return {
          sceneId: scene.id,
          success: true,
          narration,
          wordCount,
        };
      }

      if (attempt < maxAttempts) {
        const direction = wordCount < target.min ? 'longer' : 'shorter';
        const diff = Math.abs(target.target - wordCount);
        userPrompt = `${buildUserPrompt(scene, target, contextBlock)}

IMPORTANT CORRECTION:
Your previous attempt had ${wordCount} words, but I need exactly ${target.target} words (±${Math.round(target.tolerance * 100)}%).
Please write a ${direction} version. Add or remove approximately ${diff} words.
Do NOT apologize or explain - just write the corrected narration.`;
      }
    } catch (error: any) {
      console.error(`[gen] fetch error (model=${model}, attempt=${attempt}):`, error);
      if (error?.name === 'AbortError') {
        return { sceneId: scene.id, success: false, error: 'Request timed out after 60 seconds. Check your network connection.' };
      }
      const msg = error?.message || String(error);
      return { sceneId: scene.id, success: false, error: `Network error: ${msg}` };
    }
  }

  return {
    sceneId: scene.id,
    success: true,
    narration: lastNarration,
    wordCount: lastWordCount,
  };
}

/**
 * Generate narration for multiple scenes in sequence
 */
export async function generateBatch(
  scenesToGenerate: Scene[],
  script: Script,
  allScenes: Scene[],
  onSceneStart?: (sceneId: string, index: number, total: number) => void,
  onSceneComplete?: (result: GenerationResult, index: number, total: number) => void
): Promise<GenerationResult[]> {
  const results: GenerationResult[] = [];
  const total = scenesToGenerate.length;

  for (let i = 0; i < scenesToGenerate.length; i++) {
    const scene = scenesToGenerate[i];
    onSceneStart?.(scene.id, i, total);

    const result = await generateNarration(scene, script, allScenes);
    results.push(result);

    onSceneComplete?.(result, i, total);

    if (i < scenesToGenerate.length - 1) {
      await sleep(500);
    }
  }

  return results;
}

function buildSystemPrompt(script: Script): string {
  return `You are a professional narration writer for a video script titled "${script.name}".
Your job is to write spoken narration for one specific scene, while keeping it consistent with the rest of the script.

CRITICAL RULES:
1. Write ONLY what the narrator will say out loud
2. NO stage directions, bracketed instructions, or parenthetical notes
3. NO "FADE IN", "CUT TO", or film terminology
4. Write in complete, natural-sounding sentences
5. The narration must flow smoothly when read aloud
6. Preserve the tone and voice established in the existing scenes

${script.voiceProfile ? `VOICE & TONE PROFILE:\n${script.voiceProfile}` : ''}`;
}

function buildScriptContext(script: Script, allScenes: Scene[], targetSceneId: string): string {
  if (!allScenes.length) return '';

  const ordered = script.sceneOrder
    .map(id => allScenes.find(s => s.id === id))
    .filter((s): s is Scene => s !== undefined);

  if (ordered.length <= 1) return '';

  const lines: string[] = ['FULL SCRIPT CONTEXT (for tone and continuity — do NOT rewrite these):'];

  for (const s of ordered) {
    if (s.id === targetSceneId) {
      lines.push(`\n>>> SCENE ${ordered.indexOf(s) + 1}: "${s.title}" [${s.durationSec}s] <<<  ← GENERATE THIS ONE`);
      if (s.narration) lines.push(`  (current narration: ${s.narration})`);
      lines.push(`  (on-screen: ${s.onScreenTexts.map(t => t.text).join(', ') || 'none'})`);
    } else {
      lines.push(`\nScene ${ordered.indexOf(s) + 1}: "${s.title}" [${s.durationSec}s]`);
      if (s.narration) {
        lines.push(`  Narration: ${s.narration}`);
      } else {
        lines.push(`  (no narration yet)`);
      }
    }
  }

  return lines.join('\n');
}

function buildUserPrompt(
  scene: Scene,
  target: { target: number; min: number; max: number },
  contextBlock: string,
): string {
  const onScreen = scene.onScreenTexts.length > 0
    ? scene.onScreenTexts.map(t => `- ${t.text}`).join('\n')
    : '';

  return `${contextBlock ? contextBlock + '\n\n' : ''}Generate narration for SCENE "${scene.title}" (${scene.durationSec}s).

${onScreen ? `ON-SCREEN TEXT (reference, do not repeat verbatim):\n${onScreen}\n` : ''}
WORD COUNT REQUIREMENT:
- Target: exactly ${target.target} words
- Acceptable: ${target.min}–${target.max} words
- This is a HARD constraint.

Write the spoken narration now (${target.target} words):`;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate YouTube description from all scene references
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

    // Format timestamp
    const mins = Math.floor(currentTime / 60);
    const secs = currentTime % 60;
    const timestamp = `${mins}:${secs.toString().padStart(2, '0')}`;

    lines.push(`${timestamp} - ${scene.title}`);

    // Add references
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

// ── YouTube Description LLM Generation ──

export interface YTDescriptionResult {
  titles: string[];
  intro: string;
  references: { label: string; url: string; note: string }[];
  tags: string[];
}

export async function generateYTDescriptionLLM(
  script: Script,
  allScenes: Scene[],
): Promise<{ success: true; data: YTDescriptionResult } | { success: false; error: string }> {
  const apiKey = getStoredApiKey();
  if (!apiKey) {
    return { success: false, error: 'No API key configured. Please add your API key in Settings.' };
  }

  const model = getStoredModel();
  const resolvedBase = getStoredBaseUrl().replace(/\/$/, '');
  const fetchUrl = '/llm-proxy/chat/completions';

  const ordered = script.sceneOrder
    .map(id => allScenes.find(s => s.id === id))
    .filter((s): s is Scene => s !== undefined);

  let currentTime = 0;
  const sceneBlocks: string[] = [];
  const allRefs: { label: string; url: string; note: string; sceneTitle: string }[] = [];

  for (const scene of ordered) {
    const mins = Math.floor(currentTime / 60);
    const secs = currentTime % 60;
    const ts = `${mins}:${secs.toString().padStart(2, '0')}`;

    let block = `[${ts}] Scene: "${scene.title}" (${scene.durationSec}s)`;
    if (scene.narration) block += `\n  Narration: ${scene.narration}`;
    if (scene.onScreenTexts.length > 0) {
      block += `\n  On-screen: ${scene.onScreenTexts.map(t => t.text).join(', ')}`;
    }
    sceneBlocks.push(block);

    for (const ref of scene.references) {
      allRefs.push({ label: ref.label, url: ref.url, note: ref.note, sceneTitle: scene.title });
    }

    currentTime += scene.durationSec;
  }

  const systemPrompt = `You are a YouTube SEO expert and copywriter. You help video creators write compelling YouTube descriptions.
Return ONLY valid JSON with this exact structure:
{
  "titles": ["title1", "title2", "title3"],
  "intro": "one paragraph intro",
  "references": [{"label": "...", "url": "...", "note": "..."}],
  "tags": ["tag1", "tag2", ...]
}`;

  const userPrompt = `Video title: "${script.name}"
${script.voiceProfile ? `Voice/tone: ${script.voiceProfile}\n` : ''}
SCENES:
${sceneBlocks.join('\n\n')}

REFERENCES FROM THE SCRIPT:
${allRefs.length > 0 ? allRefs.map(r => `- "${r.label}" ${r.url}${r.note ? ` (${r.note})` : ''} [from: ${r.sceneTitle}]`).join('\n') : '(none)'}

Please generate:
1. "titles" — 3 alternative YouTube titles optimized for high click-through rate. Use proven CTR patterns: curiosity gaps, specificity, emotional hooks, unexpected contrasts. Under 70 characters each. Think about what makes someone actually click.
2. "intro" — A casual, personal 2-3 sentence intro paragraph for the YouTube description, written in first person singular ("I", not "we" or "us"). Keep it grounded and conversational — no hype, no grandiose language. Just briefly say what the video covers.
3. "references" — Take the references listed above and proofread/clean them. Fix typos in labels, ensure URLs are well-formed. Keep all original references. Each item has "label", "url", and "note" fields.
4. "tags" — 8-12 relevant YouTube tags based on the video content.

Return JSON only, no markdown fences.`;

  const isReasoningModel = model.startsWith('o') || model.startsWith('gpt-5');
  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    response_format: { type: 'json_object' },
  };
  if (!isReasoningModel) body.temperature = 0.7;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-llm-base-url': resolvedBase,
    'x-llm-key': apiKey,
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90_000);

  try {
    const t0 = performance.now();
    const res = await fetch(fetchUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    console.log(`[yt-desc] ${model}: ${res.status} in ${Math.round(performance.now() - t0)}ms`);

    if (!res.ok) {
      const rawText = await res.text();
      let errMsg: string;
      try {
        const errJson = JSON.parse(rawText);
        errMsg = errJson?.error?.message || res.statusText;
      } catch {
        errMsg = rawText || res.statusText;
      }
      return { success: false, error: `API error ${res.status}: ${errMsg}` };
    }

    const json = await res.json();
    const content = (json.choices?.[0]?.message?.content ?? '').trim();

    let parsed: YTDescriptionResult;
    try {
      parsed = JSON.parse(content);
    } catch {
      return { success: false, error: 'Failed to parse LLM response as JSON.' };
    }

    if (!Array.isArray(parsed.titles) || !parsed.intro || !Array.isArray(parsed.tags)) {
      return { success: false, error: 'LLM returned an unexpected JSON structure.' };
    }

    parsed.references = Array.isArray(parsed.references) ? parsed.references : allRefs;

    return { success: true, data: parsed };
  } catch (error: any) {
    clearTimeout(timeout);
    if (error?.name === 'AbortError') {
      return { success: false, error: 'Request timed out after 90 seconds.' };
    }
    return { success: false, error: `Network error: ${error?.message || String(error)}` };
  }
}
