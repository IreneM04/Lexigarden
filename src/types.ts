export type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
export type WordCategory = 'Life' | 'Action' | 'Emotion' | 'Academic' | 'Business' | 'Abstract' | 'Technical';
export type WordStatus = 'new' | 'learning' | 'review' | 'mastered';
export type Season = 'Spring' | 'Summer' | 'Autumn' | 'Winter';

export interface WordInfo {
  word: string;
  phonetic: string;
  partOfSpeech: string;
  definition: string;
  example: string;
  category: WordCategory;
  level: CEFRLevel;
  audioData?: string;
  status: WordStatus;
  masteryCount: number;
  growthInteractions: number;
  lastPracticedAt: number;
  isManual?: boolean;
  isFavorite?: boolean;
}

export type AchievementTier = 'Bronze' | 'Silver' | 'Gold';

export interface Achievement {
  id: string;
  title: string;
  description: string;
  emoji: string;
  targets: {
    Bronze: number;
    Silver: number;
    Gold: number;
  };
  type: 'planting' | 'mastery' | 'coins' | 'streak' | 'manual' | 'combo' | 'time';
  currentValue: number;
  unlockedTiers: AchievementTier[];
}

export interface Plot {
  id: number;
  cropId: string | null;
  word: string | null;
  status: 'empty' | 'planted' | 'growing' | 'mature';
  growthStage: number;
  isUnlocked: boolean;
}

export interface UserStats {
  level: number;
  xp: number;
  coins: number;
  streak: number;
  combo: number;
  farmLevel: number;
  title: string;
  avatar: string;
  lastLoginAt: number;
  dailyQuests: {
    wordsLearned: number;
    npcDialogues: number;
    reviewsDone: number;
  };
  totalCoinsEarned: number;
  totalWordsPlanted: number;
  maxCombo: number;
}

export interface SeedPack {
  id: string;
  name: string;
  description: string;
  price: number;
  categories: WordCategory[];
  isUnlocked: boolean;
}

export interface GameState {
  user: UserStats;
  plots: Plot[];
  notebook: WordInfo[];
  inventory: Record<string, number>; // cropId -> count
  npcState: {
    currentDialogueId: string | null;
    completedCount: number;
    storyStage: number;
  };
  season: Season;
  masteredCount: number;
  totalWordsSeen: number;
  dailyEvent?: string;
  achievements: Achievement[];
  unlockedSeedPacks: string[];
}

export interface Crop {
  id: string;
  name: string;
  baseValue: number;
  emoji: string;
  category: WordCategory;
  growthCoefficient: number;
}

export const CROPS: Record<string, Crop> = {
  corn: { id: 'corn', name: 'Corn', baseValue: 5, emoji: '🌽', category: 'Life', growthCoefficient: 1.0 },
  carrot: { id: 'carrot', name: 'Carrot', baseValue: 10, emoji: '🥕', category: 'Action', growthCoefficient: 1.1 },
  tulip: { id: 'tulip', name: 'Tulip', baseValue: 15, emoji: '🌷', category: 'Emotion', growthCoefficient: 1.2 },
  wheat: { id: 'wheat', name: 'Wheat', baseValue: 20, emoji: '🌾', category: 'Academic', growthCoefficient: 1.4 },
  grape: { id: 'grape', name: 'Grape', baseValue: 30, emoji: '🍇', category: 'Business', growthCoefficient: 1.5 },
  pine: { id: 'pine', name: 'Pine', baseValue: 50, emoji: '🌲', category: 'Abstract', growthCoefficient: 1.8 },
  ginseng: { id: 'ginseng', name: 'Ginseng', baseValue: 80, emoji: '🌿', category: 'Technical', growthCoefficient: 2.0 },
};

export const SEED_PACKS: SeedPack[] = [
  { id: 'basic', name: 'Basic Life Pack', description: 'Common everyday words.', price: 0, categories: ['Life'], isUnlocked: true },
  { id: 'ielts', name: 'IELTS Pack', description: 'Academic and high-frequency words for IELTS.', price: 500, categories: ['Academic', 'Action'], isUnlocked: false },
  { id: 'gre', name: 'GRE Pack', description: 'Advanced and abstract words for GRE.', price: 1500, categories: ['Abstract', 'Technical'], isUnlocked: false },
  { id: 'toefl', name: 'TOEFL Pack', description: 'Campus and academic words for TOEFL.', price: 1000, categories: ['Academic', 'Emotion'], isUnlocked: false },
  { id: 'postgrad', name: 'Post-Grad Pack', description: 'Words for postgraduate entrance exams.', price: 800, categories: ['Business', 'Action'], isUnlocked: false },
];

export const INITIAL_STATE: GameState = {
  user: {
    level: 1,
    xp: 0,
    coins: 100,
    streak: 1,
    combo: 0,
    farmLevel: 1,
    title: 'Word Apprentice',
    avatar: '👨‍🌾',
    lastLoginAt: Date.now(),
    dailyQuests: {
      wordsLearned: 0,
      npcDialogues: 0,
      reviewsDone: 0,
    },
    totalCoinsEarned: 0,
    totalWordsPlanted: 0,
    maxCombo: 0,
  },
  plots: Array.from({ length: 25 }, (_, i) => ({
    id: i,
    cropId: null,
    word: null,
    status: 'empty',
    growthStage: 0,
    isUnlocked: [7, 11, 12, 13, 17].includes(i),
  })),
  notebook: [],
  inventory: {},
  npcState: {
    currentDialogueId: null,
    completedCount: 0,
    storyStage: 0,
  },
  season: 'Spring',
  masteredCount: 0,
  totalWordsSeen: 0,
  unlockedSeedPacks: ['basic'],
  achievements: [
    { id: 'first_seed', title: 'First Seed', description: 'Plant your first word', emoji: '🌱', targets: { Bronze: 1, Silver: 10, Gold: 50 }, type: 'planting', currentValue: 0, unlockedTiers: [] },
    { id: 'hardworking_farmer', title: 'Hardworking Farmer', description: 'Plant words in a day', emoji: '👨‍🌾', targets: { Bronze: 20, Silver: 50, Gold: 100 }, type: 'planting', currentValue: 0, unlockedTiers: [] },
    { id: 'sowing_machine', title: 'Sowing Machine', description: 'Total words planted', emoji: '🚜', targets: { Bronze: 100, Silver: 500, Gold: 2000 }, type: 'planting', currentValue: 0, unlockedTiers: [] },
    { id: 'first_harvest', title: 'First Harvest', description: 'Master your first word', emoji: '🌾', targets: { Bronze: 1, Silver: 10, Gold: 50 }, type: 'mastery', currentValue: 0, unlockedTiers: [] },
    { id: 'small_harvest', title: 'Small Harvest', description: 'Words mastered in a day', emoji: '🧺', targets: { Bronze: 10, Silver: 30, Gold: 100 }, type: 'mastery', currentValue: 0, unlockedTiers: [] },
    { id: 'rich_farmer', title: 'Rich Farmer', description: 'Total coins earned', emoji: '💰', targets: { Bronze: 100, Silver: 1000, Gold: 10000 }, type: 'coins', currentValue: 0, unlockedTiers: [] },
    { id: 'streak_master', title: 'Streak Master', description: 'Consecutive days learned', emoji: '🔥', targets: { Bronze: 7, Silver: 30, Gold: 100 }, type: 'streak', currentValue: 0, unlockedTiers: [] },
    { id: 'memory_pro', title: 'Memory Pro', description: 'Consecutive correct answers', emoji: '🧠', targets: { Bronze: 5, Silver: 20, Gold: 50 }, type: 'combo', currentValue: 0, unlockedTiers: [] },
    { id: 'manual_learner', title: 'Curious Mind', description: 'Manually add words', emoji: '✍️', targets: { Bronze: 5, Silver: 20, Gold: 50 }, type: 'manual', currentValue: 0, unlockedTiers: [] },
    { id: 'combo_king', title: 'Combo King', description: 'Reach a high combo', emoji: '⚡', targets: { Bronze: 5, Silver: 10, Gold: 20 }, type: 'combo', currentValue: 0, unlockedTiers: [] },
  ]
};
