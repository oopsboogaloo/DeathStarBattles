// Copyright © 2026 Chloe Bolland
// contact chloe@mammoththoughts.com if you wish to use, publish or reproduce this game or any part of it in any way

import { STORY_MISSIONS } from './StoryMissions.js';

const STORAGE_KEY = 'dsb_story';

// Lower rank = less assistance = better. 'off' is not in this map (it means clean).
const ASSIST_RANK = { eighth: 0, quarter: 1, half: 2, full: 3 };

export const StoryPersistence = {
  load() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    } catch {
      return {};
    }
  },

  save(data) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
  },

  isUnlocked(missionId, data) {
    if (missionId === STORY_MISSIONS[0].id) return true;
    return data.unlocked?.includes(missionId) ?? false;
  },

  getBestScore(missionId, data) {
    return data.scores?.[missionId] ?? null;
  },

  getAssistedLevel(missionId, data) {
    return data.assistedLevel?.[missionId] ?? null;
  },

  recordPass(missionId, score, data, bulletPaths = 'off') {
    const updated = { ...data };
    if (!updated.unlocked) updated.unlocked = [];
    if (!updated.scores)   updated.scores   = {};

    if (!updated.unlocked.includes(missionId)) updated.unlocked.push(missionId);

    const idx  = STORY_MISSIONS.findIndex(m => m.id === missionId);
    const next = STORY_MISSIONS[idx + 1];
    if (next && !updated.unlocked.includes(next.id)) updated.unlocked.push(next.id);

    if (bulletPaths === 'off') {
      // Clean run — record score, clear any assisted-only record
      if (score > (updated.scores[missionId] ?? -Infinity)) {
        updated.scores[missionId] = score;
      }
      if (updated.assistedLevel?.[missionId]) {
        updated.assistedLevel = { ...updated.assistedLevel };
        delete updated.assistedLevel[missionId];
      }
    } else {
      // Assisted run — only record if no clean score exists and this is the best assist level so far
      const hasCleanScore = updated.scores[missionId] != null;
      if (!hasCleanScore) {
        const newRank      = ASSIST_RANK[bulletPaths] ?? 99;
        const existingLevel = updated.assistedLevel?.[missionId];
        const existingRank  = existingLevel != null ? (ASSIST_RANK[existingLevel] ?? 99) : 99;
        if (newRank < existingRank) {
          updated.assistedLevel = { ...(updated.assistedLevel ?? {}), [missionId]: bulletPaths };
        }
      }
    }

    if (!updated.campaignComplete) {
      const allPassed = STORY_MISSIONS.every(m => updated.unlocked.includes(m.id));
      if (allPassed) updated.campaignComplete = true;
    }

    return updated;
  },

  isCampaignComplete(data) {
    return data.campaignComplete === true;
  },
};
