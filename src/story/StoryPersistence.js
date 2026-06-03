import { STORY_MISSIONS } from './StoryMissions.js';

const STORAGE_KEY = 'dsb_story';

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

  recordPass(missionId, score, data) {
    const updated = { ...data };
    if (!updated.unlocked) updated.unlocked = [];
    if (!updated.scores)   updated.scores   = {};

    if (!updated.unlocked.includes(missionId)) updated.unlocked.push(missionId);

    const idx  = STORY_MISSIONS.findIndex(m => m.id === missionId);
    const next = STORY_MISSIONS[idx + 1];
    if (next && !updated.unlocked.includes(next.id)) updated.unlocked.push(next.id);

    if (score > (updated.scores[missionId] ?? -Infinity)) {
      updated.scores[missionId] = score;
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
