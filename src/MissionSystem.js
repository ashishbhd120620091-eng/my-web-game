import React, { useState, useEffect, useRef, useCallback } from "react";

const DAILY_MISSIONS_KEY = "game_daily_missions";
const LAST_DAILY_REFRESH_KEY = "game_last_daily_refresh";
const LIFETIME_STATS_KEY = "game_lifetime_stats";
const STREAK_KEY = "game_daily_streak";
const LAST_PLAY_DAY_KEY = "game_last_play_day";

const defaultLifetimeStats = {
  totalCoins: 0,
  totalRuns: 0,
  totalDistance: 0,
  totalJumps: 0,
  totalSlides: 0,
  totalNearMisses: 0,
  totalScore: 0,
};

const missionTemplates = {
  easy: [
    { type: "collectCoins", target: 50, reward: 20, desc: "Collect 50 coins in a run" },
    { type: "runDistance", target: 500, reward: 20, desc: "Run 500 meters in a run" },
    { type: "performJumps", target: 5, reward: 20, desc: "Perform 5 jumps in a run" },
  ],
  medium: [
    { type: "performJumps", target: 20, reward: 50, desc: "Perform 20 jumps in a run" },
    { type: "performSlides", target: 15, reward: 50, desc: "Perform 15 slides in a run" },
    { type: "collectCoins", target: 150, reward: 50, desc: "Collect 150 coins in a run" },
  ],
  skill: [
    { type: "nearMisses", target: 5, reward: 100, desc: "Achieve 5 near misses in a run" },
    { type: "score", target: 5000, reward: 100, desc: "Reach 5,000 score in a run" },
    { type: "runDistance", target: 2500, reward: 100, desc: "Run 2,500 meters in a run" },
  ],
};

const generateDailyMissions = () => {
  const missions = [];
  const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];
  
  const easy = pickRandom(missionTemplates.easy);
  const medium = pickRandom(missionTemplates.medium);
  const skill = pickRandom(missionTemplates.skill);

  missions.push({ ...easy, id: "m_easy_" + Date.now(), progress: 0, completed: false, claimed: false });
  missions.push({ ...medium, id: "m_medium_" + Date.now(), progress: 0, completed: false, claimed: false });
  missions.push({ ...skill, id: "m_skill_" + Date.now(), progress: 0, completed: false, claimed: false });
  
  return missions;
};

const isNewDay = (lastRefreshTime) => {
  if (!lastRefreshTime) return true;
  const lastDate = new Date(lastRefreshTime);
  const today = new Date();
  return (
    lastDate.getDate() !== today.getDate() ||
    lastDate.getMonth() !== today.getMonth() ||
    lastDate.getFullYear() !== today.getFullYear()
  );
};

// Weekly Event System
const WEEKLY_EVENT_KEY = "game_weekly_event";
const LAST_EVENT_CHANGE_KEY = "game_last_event_change";
const EVENT_PROGRESS_KEY = "game_event_progress";
const EVENT_MILESTONES_KEY = "game_event_milestones_claimed";
const EVENT_DURATION = 3 * 24 * 60 * 60 * 1000; // 3 days in milliseconds

const eventTemplates = [
  { id: "coinRush", name: "Coin Rush", desc: "2x Coins spawned in lanes!", multiplier: { coins: 2 } },
  { id: "speedChallenge", name: "Speed Challenge", desc: "Higher starting speed & faster scaling!", multiplier: { speed: 1.25 } },
  { id: "noPowerupMode", name: "Hardcore Mode", desc: "No power-ups! Score 2x faster.", effect: { noPowerups: true, scoreMult: 2 } },
  { id: "magnetMania", name: "Magnet Mania", desc: "Magnet power-ups are everywhere!", effect: { moreMagnets: true } },
];

const lifetimeMilestones = [
  { id: "coins1", type: "totalCoins", target: 1000, reward: 200, desc: "Collect 1,000 total coins" },
  { id: "coins2", type: "totalCoins", target: 5000, reward: 1000, desc: "Collect 5,000 total coins" },
  { id: "distance1", type: "totalDistance", target: 5000, reward: 300, desc: "Run 5,000 total meters" },
  { id: "distance2", type: "totalDistance", target: 20000, reward: 1500, desc: "Run 20,000 total meters" },
  { id: "runs1", type: "totalRuns", target: 10, reward: 100, desc: "Complete 10 runs" },
  { id: "runs2", type: "totalRuns", target: 50, reward: 500, desc: "Complete 50 runs" },
];

const generateWeeklyEvent = () => {
  return eventTemplates[Math.floor(Math.random() * eventTemplates.length)];
};

export const useMissionEventSystem = (score, runCoins, totalDistance, totalJumps, totalSlides, totalNearMisses, addCoins) => {
  const [dailyMissions, setDailyMissions] = useState([]);
  const [lifetimeStats, setLifetimeStats] = useState(defaultLifetimeStats);
  const [currentEvent, setCurrentEvent] = useState(null);
  const [eventProgress, setEventProgress] = useState(0);
  const [eventMilestonesClaimed, setEventMilestonesClaimed] = useState([]);
  const [streak, setStreak] = useState(0);
  const [claimedMilestones, setClaimedMilestones] = useState([]);

  const initialized = useRef(false);

  // Load initial data
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    // Daily Missions
    const storedMissions = JSON.parse(localStorage.getItem(DAILY_MISSIONS_KEY));
    const lastRefresh = localStorage.getItem(LAST_DAILY_REFRESH_KEY);
    if (!storedMissions || isNewDay(lastRefresh)) {
      const newMissions = generateDailyMissions();
      setDailyMissions(newMissions);
      localStorage.setItem(DAILY_MISSIONS_KEY, JSON.stringify(newMissions));
      localStorage.setItem(LAST_DAILY_REFRESH_KEY, new Date().toISOString());
    } else {
      setDailyMissions(storedMissions);
    }

    // Lifetime Stats
    const storedStats = JSON.parse(localStorage.getItem(LIFETIME_STATS_KEY));
    if (storedStats) setLifetimeStats((prev) => ({ ...prev, ...storedStats }));
    
    const storedClaimed = JSON.parse(localStorage.getItem("game_claimed_milestones") || "[]");
    setClaimedMilestones(storedClaimed);

    // Streak
    const storedStreak = parseInt(localStorage.getItem(STREAK_KEY) || "0", 10);
    const lastPlay = localStorage.getItem(LAST_PLAY_DAY_KEY);
    if (lastPlay) {
        const lastDate = new Date(lastPlay);
        const now = new Date();
        const diffDays = Math.floor((now - lastDate) / (1000 * 60 * 60 * 24));
        if (diffDays === 1) {
            // Keep streak or it will increment on first run
        } else if (diffDays > 1) {
            localStorage.setItem(STREAK_KEY, "0");
            setStreak(0);
        } else {
            setStreak(storedStreak);
        }
    } else {
        setStreak(0);
    }

    // Weekly Event
    const storedEvent = JSON.parse(localStorage.getItem(WEEKLY_EVENT_KEY));
    const lastEventChange = localStorage.getItem(LAST_EVENT_CHANGE_KEY);
    const now = Date.now();
    
    if (!storedEvent || !lastEventChange || now - new Date(lastEventChange).getTime() > EVENT_DURATION) {
      const newEvent = generateWeeklyEvent();
      setCurrentEvent(newEvent);
      localStorage.setItem(WEEKLY_EVENT_KEY, JSON.stringify(newEvent));
      localStorage.setItem(LAST_EVENT_CHANGE_KEY, new Date(now).toISOString());
      localStorage.setItem(EVENT_PROGRESS_KEY, "0");
      localStorage.setItem(EVENT_MILESTONES_KEY, "[]");
      setEventProgress(0);
      setEventMilestonesClaimed([]);
    } else {
      setCurrentEvent(storedEvent);
      setEventProgress(parseInt(localStorage.getItem(EVENT_PROGRESS_KEY) || "0", 10));
      setEventMilestonesClaimed(JSON.parse(localStorage.getItem(EVENT_MILESTONES_KEY) || "[]"));
    }
  }, []);

  // Update real-time progress for daily missions
  useEffect(() => {
    if (dailyMissions.length === 0) return;

    let changed = false;
    const next = dailyMissions.map(m => {
      if (m.completed) return m;
      let val = 0;
      if (m.type === "collectCoins") val = runCoins;
      else if (m.type === "runDistance") val = totalDistance;
      else if (m.type === "performJumps") val = totalJumps;
      else if (m.type === "performSlides") val = totalSlides;
      else if (m.type === "nearMisses") val = totalNearMisses;
      else if (m.type === "score") val = score;

      if (val >= m.target) {
        changed = true;
        return { ...m, progress: m.target, completed: true };
      }
      if (val > m.progress) {
        changed = true;
        return { ...m, progress: val };
      }
      return m;
    });

    if (changed) {
      setDailyMissions(next);
      localStorage.setItem(DAILY_MISSIONS_KEY, JSON.stringify(next));
    }
  }, [score, runCoins, totalDistance, totalJumps, totalSlides, totalNearMisses, dailyMissions]);

  // Update event progress (cumulative across runs for the event duration)
  const updateEventProgress = useCallback((increment) => {
    setEventProgress(prev => {
      const next = prev + increment;
      localStorage.setItem(EVENT_PROGRESS_KEY, String(next));
      return next;
    });
  }, []);

  const claimEventMilestone = useCallback((milestone) => {
    if (eventMilestonesClaimed.includes(milestone)) return;
    const reward = milestone === 500 ? 100 : milestone === 1000 ? 250 : 500;
    addCoins(reward);
    const next = [...eventMilestonesClaimed, milestone];
    setEventMilestonesClaimed(next);
    localStorage.setItem(EVENT_MILESTONES_KEY, JSON.stringify(next));
  }, [eventMilestonesClaimed, addCoins]);

  const claimMissionReward = useCallback((missionId) => {
    const mission = dailyMissions.find(m => m.id === missionId);
    if (mission && mission.completed && !mission.claimed) {
      const bonus = 1 + (streak * 0.05); // 5% bonus per streak day
      addCoins(Math.floor(mission.reward * bonus));
      
      const next = dailyMissions.map(m => m.id === missionId ? { ...m, claimed: true } : m);
      setDailyMissions(next);
      localStorage.setItem(DAILY_MISSIONS_KEY, JSON.stringify(next));
      return true;
    }
    return false;
  }, [dailyMissions, streak, addCoins]);

  const incrementStreak = useCallback(() => {
    const lastPlay = localStorage.getItem(LAST_PLAY_DAY_KEY);
    const now = new Date();
    if (!lastPlay || isNewDay(lastPlay)) {
      setStreak(prev => {
        const next = prev + 1;
        localStorage.setItem(STREAK_KEY, String(next));
        return next;
      });
      localStorage.setItem(LAST_PLAY_DAY_KEY, now.toISOString());
    }
  }, []);

  const claimMilestone = useCallback((id) => {
    const m = lifetimeMilestones.find(mil => mil.id === id);
    if (!m || claimedMilestones.includes(id)) return;
    
    // Check if eligible
    const statVal = lifetimeStats[m.type] || 0;
    if (statVal >= m.target) {
        addCoins(m.reward);
        const next = [...claimedMilestones, id];
        setClaimedMilestones(next);
        localStorage.setItem("game_claimed_milestones", JSON.stringify(next));
    }
  }, [claimedMilestones, lifetimeStats, addCoins]);

  return {
    dailyMissions,
    lifetimeStats,
    currentEvent,
    eventProgress,
    eventMilestonesClaimed,
    streak,
    claimedMilestones,
    lifetimeMilestones,
    updateEventProgress,
    claimEventMilestone,
    claimMissionReward,
    incrementStreak,
    claimMilestone,
    setLifetimeStats,
  };
};

// Mystery Box System
const MYSTERY_BOX_KEY = "game_mystery_box_chance";

export const useMysteryBoxSystem = (addCoins) => {
  const [showMysteryBox, setShowMysteryBox] = useState(false);
  const [mysteryBoxReward, setMysteryBoxReward] = useState(null);

  const triggerMysteryBox = useCallback(() => {
    const chance = Math.random();
    if (chance < 0.15) { // 15% chance after a run
      let reward = {};
      const rewardChance = Math.random();
      if (rewardChance < 0.7) { // 70% common coins
        reward = { type: "coins", value: 100 + Math.floor(Math.random() * 50) };
      } else if (rewardChance < 0.95) { // 25% uncommon bonus coins
        reward = { type: "bonusCoins", value: 200 + Math.floor(Math.random() * 100) };
      } else { // 5% rare big reward
        reward = { type: "rareCoins", value: 500 + Math.floor(Math.random() * 200) };
      }
      setMysteryBoxReward(reward);
      setShowMysteryBox(true);
    }
  }, []);

  const openMysteryBox = useCallback(() => {
    if (mysteryBoxReward) {
      addCoins(mysteryBoxReward.value);
      setMysteryBoxReward(null);
      setShowMysteryBox(false);
      // Add simple open animation here if needed
    }
  }, [addCoins, mysteryBoxReward]);

  return {
    showMysteryBox,
    mysteryBoxReward,
    triggerMysteryBox,
    openMysteryBox,
    setShowMysteryBox // Expose setter to close UI
  };
};