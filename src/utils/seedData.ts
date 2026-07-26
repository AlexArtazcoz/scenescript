import { v4 as uuidv4 } from 'uuid';
import type { Script, Scene } from '../types';
import * as db from '../services/db';

export async function seedOnboardingScript(): Promise<{ script: Script; scenes: Scene[] }> {
  const scriptId = uuidv4();
  const now = Date.now();

  const script: Script = {
    id: scriptId,
    name: 'Getting Started with SceneScript',
    titleJP: '',
    emoji: '',
    paceWordsPerSec: 2.5,
    voiceProfile: 'Friendly, clear, and encouraging. Like a calm product tour that explains one idea at a time without jargon.',
    sceneOrder: [],
    status: 'in-progress',
    createdAt: now,
    updatedAt: now,
  };

  const scenesData = [
    {
      title: 'WELCOME',
      durationSec: 35,
      draftNotes: `Welcome to SceneScript — a calm place to plan a video one scene at a time. Each column on the right is a single scene, and reading left to right walks you through the whole piece. This short demo is a script about the app itself: it explains every part as you scroll. When you're ready, clear the demo and start your own.`,
      onScreenTexts: [
        'Each column = one scene',
        'Read left → right',
        'A demo that explains itself',
      ],
      references: [
        { label: 'Watch the overview', url: 'https://youtu.be/5XqCRitYRC4', note: 'Short video tour of the app' },
      ],
    },
    {
      title: 'SCENES',
      durationSec: 25,
      draftNotes: `A scene is the smallest unit of your script: a beat, a shot, or a single thought. Add one with the pen on the far left, and drag scenes sideways to reorder them. The trick is to keep each scene focused — one idea per column reads best.`,
      onScreenTexts: [
        'Add with the pen',
        'Drag to reorder',
        'One idea per scene',
      ],
      references: [],
    },
    {
      title: 'DURATION',
      durationSec: 22,
      draftNotes: `Every scene carries a duration in seconds. That number sets a word budget for the narration, based on your speaking pace, so you can feel how long the finished cut runs before you record a word. Tap the number to adjust it.`,
      onScreenTexts: [
        'Seconds per scene',
        'Drives the word budget',
        'Tap to adjust',
      ],
      references: [],
    },
    {
      title: 'TITLES',
      durationSec: 20,
      draftNotes: `Give each scene a short title — up to eight characters — so the storyboard stays scannable at a glance. Titles are just labels; the real content lives in the draft and narration below them.`,
      onScreenTexts: [
        'Short labels',
        'Up to 8 characters',
        'Keep it scannable',
      ],
      references: [],
    },
    {
      title: 'DRAFT',
      durationSec: 25,
      draftNotes: `The draft is your scratchpad. Jot rough notes, links, half-sentences — whatever captures the idea. Nothing here needs to be polished. Think of the draft as the raw material your narration is built from.`,
      onScreenTexts: [
        'Your scratchpad',
        'Rough notes welcome',
        'Raw material for narration',
      ],
      references: [],
    },
    {
      title: 'NARRATE',
      durationSec: 30,
      draftNotes: `Narration is the spoken script for a scene. Write it yourself, or generate a draft from your notes with one tap once you've added an API key. The length is tuned to the scene's duration and your pace, so it fits the time you have.`,
      onScreenTexts: [
        'The spoken script',
        'Write it or generate it',
        'Fits the duration',
      ],
      references: [],
    },
    {
      title: 'OVERLAYS',
      durationSec: 22,
      draftNotes: `On-screen items are the text and visuals that appear over a scene — captions, labels, and b-roll you still need to capture. Add them as a checklist and tick them off as you shoot or design.`,
      onScreenTexts: [
        'Captions & labels',
        'B-roll checklist',
        'Check off as you go',
      ],
      references: [],
    },
    {
      title: 'LINKS',
      durationSec: 20,
      draftNotes: `References keep your sources and inspiration next to the scene that needs them. Paste a URL, add a short note, and it's one click away while you write.`,
      onScreenTexts: [
        'Sources & inspiration',
        'Paste a URL + note',
        'One click away',
      ],
      references: [
        { label: 'Example reference', url: 'https://youtu.be/5XqCRitYRC4', note: 'Any link you want to keep handy' },
      ],
    },
    {
      title: 'VERSIONS',
      durationSec: 25,
      draftNotes: `Not sure about a line? Keep several versions of a narration and switch between them. The count badge next to the title shows how many you have — great for trying a punchier take without losing the original.`,
      onScreenTexts: [
        'Keep multiple takes',
        'Switch anytime',
        'Never lose a version',
      ],
      references: [],
    },
    {
      title: 'LOCK',
      durationSec: 22,
      draftNotes: `When a scene is final, lock it. Locked scenes turn into a clean, read-only card so you can review the flow without editing by accident. Unlock anytime to keep tweaking.`,
      onScreenTexts: [
        'Mark a scene final',
        'Clean read-only card',
        'Unlock anytime',
      ],
      references: [],
    },
    {
      title: 'SETTINGS',
      durationSec: 28,
      draftNotes: `Open Settings to add your OpenAI-compatible API key, pick a model, and set your speaking pace. You can also adjust text size and line height to make the editor comfortable. Your key stays in your browser.`,
      onScreenTexts: [
        'API key & model',
        'Speaking pace',
        'Text size & spacing',
        'Key stays local',
      ],
      references: [],
    },
    {
      title: 'START',
      durationSec: 25,
      draftNotes: `That's the whole app: scenes, drafts, narration, and the small tools around them. Clear this demo whenever you're ready, then write your first script. Have fun.`,
      onScreenTexts: [
        'Clear the demo',
        'Write your first script',
        'Have fun',
      ],
      references: [],
    },
  ];

  const scenes: Scene[] = scenesData.map((data, index) => {
    const sceneId = uuidv4();
    script.sceneOrder.push(sceneId);

    return {
      id: sceneId,
      scriptId,
      title: data.title,
      durationSec: data.durationSec,
      isFixed: false,
      draftVersions: [
        {
          index: 0,
          content: data.draftNotes,
          createdAt: now - (scenesData.length - index) * 60000,
          source: 'manual' as const,
        },
      ],
      currentDraftIndex: 0,
      narration: null,
      narrationGeneratedAt: null,
      narrationFromDraftIndex: null,
      narrationVersions: [],
      currentNarrationVersionIndex: -1,
      onScreenTexts: data.onScreenTexts.map(text => ({
        id: uuidv4(),
        text,
        isChecked: false,
      })),
      references: data.references.map(ref => ({
        id: uuidv4(),
        ...ref,
      })),
    };
  });

  // Save to database
  await db.saveScript(script);
  for (const scene of scenes) {
    await db.saveScene(scene);
  }

  return { script, scenes };
}

// Also create some pre-generated narrations for a few scenes to show the "complete" state
export async function seedWithSampleNarrations(): Promise<{ script: Script; scenes: Scene[] }> {
  const { script, scenes } = await seedOnboardingScript();

  // Add sample narrations to the first few scenes to demonstrate the "generated" state
  const sampleNarrations = [
    // WELCOME — 35s * 2.5 ≈ 88 words
    `Welcome to SceneScript, a calm place to plan a video one scene at a time. Each column you see on the right is a single scene, and reading left to right walks you through the whole piece. This short demo is a script about the app itself, and it explains every part as you scroll. Take a minute to look around. When you feel ready, clear the demo and start writing something of your own.`,

    // SCENES — 25s * 2.5 ≈ 62 words
    `A scene is the smallest unit of your script: a beat, a shot, or a single thought. Add one with the pen on the far left, and drag scenes sideways to reorder them. The trick is to keep each scene focused. One idea per column reads best, both for you and for anyone you share it with.`,

    // DURATION — 22s * 2.5 ≈ 55 words
    `Every scene carries a duration in seconds. That number sets a word budget for your narration, based on the speaking pace in settings. So you can feel how long the finished cut will run before you ever record a word. Tap the number whenever you want a scene to be shorter or longer.`,
  ];

  // Update scenes with narrations
  for (let i = 0; i < sampleNarrations.length && i < scenes.length; i++) {
    scenes[i].narration = sampleNarrations[i];
    scenes[i].narrationGeneratedAt = Date.now();
    scenes[i].narrationFromDraftIndex = 0;
    await db.saveScene(scenes[i]);
  }

  // Lock the first scene to demonstrate the fixed state
  scenes[0].isFixed = true;
  // Mark an on-screen text as checked in the locked scene
  if (scenes[0].onScreenTexts.length > 0) {
    scenes[0].onScreenTexts[0].isChecked = true;
  }
  await db.saveScene(scenes[0]);

  // Add a second draft version to one scene to demonstrate versioning
  if (scenes[3]) {
    scenes[3].draftVersions.push({
      index: 1,
      content: `Keep titles tiny. A title is just a handle for the scene, so eight characters is plenty — think "INTRO" or "OUTRO". The full thought belongs in the draft and narration, where there's room to breathe.`,
      createdAt: Date.now(),
      source: 'manual',
    });
    scenes[3].currentDraftIndex = 1;
    await db.saveScene(scenes[3]);
  }

  return { script, scenes };
}
