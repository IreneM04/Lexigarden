import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Stage, Layer, Rect, Text, Group } from 'react-konva';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Home, 
  Store, 
  BookOpen, 
  BarChart3, 
  User, 
  Coins, 
  Settings, 
  ChevronLeft, 
  Volume2,
  CheckCircle2,
  Sprout,
  Trophy,
  Flame,
  Droplets,
  Shovel,
  XCircle,
  Loader2,
  Plus,
  ArrowRight,
  Save,
  Search
} from 'lucide-react';
import { 
  AreaChart,
  Area,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer
} from 'recharts';
import { generateWord, generateNpcDialogue, generateGrowthChallenge, fetchWordDetails, type WordData, type NpcDialogue, type GrowthChallenge } from './services/geminiService';
import { saveGame, loadGame } from './services/persistenceService';
import { INITIAL_STATE, CROPS, SEED_PACKS, type GameState, type Plot, type Crop, type WordInfo, type WordStatus, type Season, type AchievementTier } from './types';
import { cn } from './utils';

const USER_ID = 'default_user';

// --- Sub-components ---

const Navbar = ({ activeTab, setActiveTab }: { activeTab: string, setActiveTab: (tab: any) => void }) => {
  const tabs = [
    { id: 'farm', label: 'Farm', icon: Home },
    { id: 'market', label: 'Market', icon: Store },
    { id: 'notebook', label: 'Words', icon: BookOpen },
    { id: 'stats', label: 'Stats', icon: BarChart3 },
    { id: 'quests', label: 'Quests', icon: Trophy },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-4 py-2 flex justify-around items-center z-50">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          className={cn(
            "flex flex-col items-center gap-1 p-2 transition-colors",
            activeTab === tab.id ? "text-farm-green" : "text-slate-400 hover:text-slate-600"
          )}
        >
          <tab.icon size={24} />
          <span className="text-[10px] font-medium uppercase tracking-wider">{tab.label}</span>
          {activeTab === tab.id && (
            <motion.div
              layoutId="activeTab"
              className="w-1 h-1 bg-farm-green rounded-full mt-0.5"
            />
          )}
        </button>
      ))}
    </nav>
  );
};

const Header = ({ stats, isSaving }: { stats: any, isSaving: boolean }) => (
  <header className="fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-md border-b border-slate-100 px-6 py-3 flex justify-between items-center z-50">
    <div className="flex items-center gap-2">
      <div className="w-8 h-8 bg-farm-green rounded-lg flex items-center justify-center text-white">
        <Sprout size={20} />
      </div>
      <h1 className="font-serif italic text-xl font-bold text-farm-green">LexiGarden</h1>
    </div>
    <div className="flex items-center gap-4">
      {isSaving && <Save className="w-4 h-4 text-emerald-500 animate-pulse" />}
      <div className="flex items-center gap-1.5 bg-amber-50 px-3 py-1 rounded-full border border-amber-100">
        <Coins size={16} className="text-amber-500" />
        <span className="text-sm font-bold text-amber-700">{stats.coins.toLocaleString()}</span>
      </div>
      <button className="text-slate-400 hover:text-slate-600">
        <Settings size={20} />
      </button>
    </div>
  </header>
);

export default function App() {
  const [gameState, setGameState] = useState<GameState>(INITIAL_STATE);
  const [selectedCrop, setSelectedCrop] = useState<string>('Corn');
  const [activeTab, setActiveTab] = useState<'farm' | 'notebook' | 'stats' | 'quests' | 'market' | 'learn'>('farm');
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  const [wordCache, setWordCache] = useState<Record<string, WordData[]>>({});
  const cacheRef = useRef<Record<string, WordData[]>>({});
  const [activeChallenge, setActiveChallenge] = useState<{
    type: 'planting' | 'growing' | 'harvesting' | 'npc' | 'chest' | 'boss' | 'risk';
    plotId?: number;
    wordData?: WordData;
    challengeData?: GrowthChallenge;
    npcDialogue?: NpcDialogue;
    reward?: { coins: number; xp: number };
  } | null>(null);

  const [comboState, setComboState] = useState({ count: 0, isFrenzy: false });
  const [manualWord, setManualWord] = useState('');
  const [isAddingManual, setIsAddingManual] = useState(false);
  const [plantingEffect, setPlantingEffect] = useState<{ x: number; y: number; emoji: string } | null>(null);
  const [plantingPlotId, setPlantingPlotId] = useState<number | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 600 });

  // Persistence: Load on mount
  useEffect(() => {
    const init = async () => {
      const saved = await loadGame(USER_ID);
      if (saved) setGameState(saved);
      Object.values(CROPS).forEach(crop => prefetchWord(crop.category));
    };
    init();
  }, []);

  const prefetchWord = async (category: string) => {
    if ((cacheRef.current[category]?.length || 0) >= 3) return;
    try {
      const word = await generateWord(category as any);
      const newCache = {
        ...cacheRef.current,
        [category]: [...(cacheRef.current[category] || []), word]
      };
      cacheRef.current = newCache;
      setWordCache(newCache);
    } catch (e) {
      console.error('Prefetch failed', e);
    }
  };

  const triggerSave = useCallback(async (state: GameState) => {
    setIsSaving(true);
    await saveGame(USER_ID, state);
    setTimeout(() => setIsSaving(false), 1000);
  }, []);

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const width = Math.min(containerRef.current.offsetWidth, 600);
        setDimensions({ width, height: width });
      }
    };
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  const playAudio = (base64?: string) => {
    if (!base64) return;
    new Audio(`data:audio/wav;base64,${base64}`).play();
  };

  const handlePlotClick = async (plotId: number) => {
    const plot = gameState.plots[plotId];
    if (!plot.isUnlocked) {
      if (gameState.user.coins >= 50) {
        const newState = {
          ...gameState,
          user: { ...gameState.user, coins: gameState.user.coins - 50 },
          plots: gameState.plots.map(p => p.id === plotId ? { ...p, isUnlocked: true } : p)
        };
        setGameState(newState);
        triggerSave(newState);
      }
      return;
    }

    if (plot.status === 'empty') {
      setPlantingPlotId(plotId);
    } else if (plot.status === 'planted' || plot.status === 'growing') {
      setIsActionLoading(true);
      try {
        const challengeData = await generateGrowthChallenge(plot.word!, plot.growthStage);
        setActiveChallenge({ type: 'growing', plotId, challengeData });
        setActiveTab('learn');
      } catch (e: any) {
        setFeedback({ type: 'error', message: 'Failed to start challenge.' });
      } finally { setIsActionLoading(false); }
    } else if (plot.status === 'mature') {
      setActiveChallenge({ type: 'risk', plotId });
    }
  };

  const handlePlantSeed = async (cropId: string) => {
    if (plantingPlotId === null) return;
    const plotId = plantingPlotId;
    const crop = CROPS[cropId];
    if (!crop) {
      setFeedback({ type: 'error', message: 'Invalid crop selected.' });
      return;
    }
    
    setSelectedCrop(cropId);
    setPlantingPlotId(null);

    const cachedWords = cacheRef.current[crop.category] || [];
    
    if (cachedWords.length > 0) {
      const wordData = cachedWords[0];
      const remaining = cachedWords.slice(1);
      const newCache = { ...cacheRef.current, [crop.category]: remaining };
      cacheRef.current = newCache;
      setWordCache(newCache);
      setActiveChallenge({ type: 'planting', plotId, wordData });
      setActiveTab('learn');
      prefetchWord(crop.category);
    } else {
      setIsActionLoading(true);
      try {
        const wordData = await generateWord(crop.category);
        setActiveChallenge({ type: 'planting', plotId, wordData });
        setActiveTab('learn');
        prefetchWord(crop.category);
      } catch (e: any) {
        console.error('Planting failed', e);
        setFeedback({ type: 'error', message: e.message || 'Failed to generate word. Check your API key.' });
      } finally { 
        setIsActionLoading(false); 
      }
    }
  };

  const startHarvest = async (plotId: number, useRisk: boolean = false) => {
    const plot = gameState.plots[plotId];
    setIsActionLoading(true);
    try {
      const challengeData = await generateGrowthChallenge(plot.word!, 3);
      setActiveChallenge({ type: 'harvesting', plotId, challengeData, reward: useRisk ? { coins: 0, xp: 0 } : undefined });
      setActiveTab('learn');
    } finally { setIsActionLoading(false); }
  };

  const onChallengeSuccess = (data?: any) => {
    if (!activeChallenge) return;
    const { type, plotId, wordData } = activeChallenge;
    let newState = { ...gameState };

    const newCombo = type === 'npc' || type === 'risk' ? gameState.user.combo : gameState.user.combo + 1;
    newState.user.combo = newCombo;
    newState.user.maxCombo = Math.max(newState.user.maxCombo, newCombo);
    
    if (newCombo >= 5) {
      setComboState({ count: newCombo, isFrenzy: true });
      setFeedback({ type: 'success', message: 'COMBO FRENZY! Double Rewards!' });
    }

    if (type === 'planting' && wordData) {
      const newWord: WordInfo = {
        ...wordData,
        status: 'learning',
        masteryCount: 0,
        growthInteractions: 0,
        lastPracticedAt: Date.now()
      };
      newState.plots = newState.plots.map(p => p.id === plotId ? {
        ...p, status: 'planted', word: wordData.word, cropId: selectedCrop, growthStage: 0
      } : p);
      newState.notebook = [...newState.notebook.filter(w => w.word !== wordData.word), newWord];
      newState.user.dailyQuests.wordsLearned += 1;
      newState.user.totalWordsPlanted += 1;
      newState.totalWordsSeen += 1;
      setFeedback({ type: 'success', message: 'Word planted!' });
      
      // Trigger planting animation
      const row = Math.floor(plotId! / 5);
      const col = plotId! % 5;
      setPlantingEffect({ 
        x: col * cellSize + cellSize / 2, 
        y: row * cellSize + cellSize / 2,
        emoji: '🫘'
      });
      setTimeout(() => setPlantingEffect(null), 1500);
    } else if (type === 'growing') {
      const isFrenzy = newCombo >= 5;
      newState.plots = newState.plots.map(p => p.id === plotId ? {
        ...p, 
        growthStage: isFrenzy ? p.growthStage + 2 : p.growthStage + 1,
        status: (isFrenzy ? p.growthStage + 2 : p.growthStage + 1) >= 3 ? 'mature' : 'growing'
      } : p);
      newState.user.dailyQuests.reviewsDone += 1;
      setFeedback({ type: 'success', message: isFrenzy ? 'COMBO GROWTH! +2 Stages!' : 'Crop grew!' });
    } else if (type === 'harvesting') {
      const plot = gameState.plots[plotId!];
      const crop = CROPS[plot.cropId!];
      const word = newState.notebook.find(w => w.word === plot.word);
      const isFrenzy = newCombo >= 5;
      const isRisk = activeChallenge.reward !== undefined;
      
      if (word) {
        word.masteryCount += 1;
        if (word.masteryCount >= 3) {
          word.status = 'mastered';
          newState.masteredCount += 1;
        }
      }

      newState.inventory[plot.cropId!] = (newState.inventory[plot.cropId!] || 0) + 1;
      newState.user.xp += 50 * (isFrenzy ? 2 : 1) * (isRisk ? 2 : 1);
      newState.user.dailyQuests.reviewsDone += 1;
      newState.plots = newState.plots.map(p => p.id === plotId ? { ...p, status: 'empty', word: null, cropId: null, growthStage: 0 } : p);
      setFeedback({ type: 'success', message: `Harvested ${crop.name}! Check the Market to sell.` });
      
      // Trigger harvest animation
      const row = Math.floor(plotId! / 5);
      const col = plotId! % 5;
      setPlantingEffect({ 
        x: col * cellSize + cellSize / 2, 
        y: row * cellSize + cellSize / 2,
        emoji: crop.emoji
      });
      setTimeout(() => setPlantingEffect(null), 1000);

      if (Math.random() > 0.8) {
        setActiveChallenge({ type: 'chest', reward: { coins: 50, xp: 100 } });
        return;
      }

      if (newState.masteredCount > 0 && newState.masteredCount % 10 === 0) {
        newState.user.farmLevel += 1;
        const seasons: Season[] = ['Spring', 'Summer', 'Autumn', 'Winter'];
        newState.season = seasons[Math.floor(newState.masteredCount / 50) % 4];
      }

      if (newState.totalWordsSeen > 0 && newState.totalWordsSeen % 20 === 0) {
        triggerBoss();
        return;
      }

      if (Math.random() > 0.6) triggerNpc();
    } else if (type === 'npc') {
      newState.user.coins += activeChallenge.npcDialogue?.reward.coins || 0;
      newState.user.xp += activeChallenge.npcDialogue?.reward.xp || 0;
      newState.user.dailyQuests.npcDialogues += 1;
      setFeedback({ type: 'success', message: 'NPC satisfied!' });
    } else if (type === 'chest') {
      newState.user.coins += activeChallenge.reward?.coins || 0;
      newState.user.xp += activeChallenge.reward?.xp || 0;
      setFeedback({ type: 'success', message: 'Chest opened!' });
    }

    newState.achievements = newState.achievements.map(a => {
      let val = a.currentValue;
      if (a.type === 'planting') val = newState.user.totalWordsPlanted;
      if (a.type === 'mastery') val = newState.masteredCount;
      if (a.type === 'coins') val = newState.user.totalCoinsEarned;
      if (a.type === 'streak') val = newState.user.streak;
      if (a.type === 'combo') val = newState.user.maxCombo;
      if (a.type === 'manual') val = newState.notebook.filter(w => w.isManual).length;
      
      const unlocked: AchievementTier[] = [];
      if (val >= a.targets.Bronze) unlocked.push('Bronze');
      if (val >= a.targets.Silver) unlocked.push('Silver');
      if (val >= a.targets.Gold) unlocked.push('Gold');
      
      return { ...a, currentValue: val, unlockedTiers: unlocked };
    });

    setGameState(newState);
    triggerSave(newState);
    setActiveChallenge(null);
    setActiveTab('farm');
    if (newCombo >= 5) setTimeout(() => setComboState({ count: 0, isFrenzy: false }), 5000);
    setTimeout(() => setFeedback(null), 2000);
  };

  const onChallengeFail = () => {
    setGameState(prev => ({ ...prev, user: { ...prev.user, combo: 0 } }));
    setComboState({ count: 0, isFrenzy: false });
    setFeedback({ type: 'error', message: 'Combo broken! Try again.' });
    setActiveChallenge(null);
    setActiveTab('farm');
    setTimeout(() => setFeedback(null), 2000);
  };

  const triggerBoss = async () => {
    setIsActionLoading(true);
    try {
      const challengeData = await generateGrowthChallenge('Harvest Festival', 3);
      setActiveChallenge({ type: 'boss', challengeData, reward: { coins: 500, xp: 1000 } });
      setActiveTab('learn');
    } finally { setIsActionLoading(false); }
  };

  const triggerNpc = async () => {
    const word = gameState.notebook.find(w => w.status === 'learning' || w.status === 'review')?.word || 'academic';
    setIsActionLoading(true);
    try {
      const npcDialogue = await generateNpcDialogue(word);
      setActiveChallenge({ type: 'npc', npcDialogue });
    } finally { setIsActionLoading(false); }
  };

  const handleAddManualWord = async () => {
    if (!manualWord.trim()) return;
    setIsAddingManual(true);
    try {
      const details = await fetchWordDetails(manualWord);
      const newWord: WordInfo = {
        ...details,
        status: 'new',
        masteryCount: 0,
        growthInteractions: 0,
        lastPracticedAt: Date.now(),
        isManual: true
      };
      
      const newState = {
        ...gameState,
        notebook: [...gameState.notebook.filter(w => w.word !== details.word), newWord]
      };
      
      const manualCount = newState.notebook.filter(w => w.isManual).length;
      newState.achievements = newState.achievements.map(a => {
        if (a.id === 'manual_learner') {
          const unlocked: AchievementTier[] = [];
          if (manualCount >= a.targets.Bronze) unlocked.push('Bronze');
          if (manualCount >= a.targets.Silver) unlocked.push('Silver');
          if (manualCount >= a.targets.Gold) unlocked.push('Gold');
          return { ...a, currentValue: manualCount, unlockedTiers: unlocked };
        }
        return a;
      });

      setGameState(newState);
      triggerSave(newState);
      setManualWord('');
      setFeedback({ type: 'success', message: 'Word added to notebook!' });
    } catch (e) {
      setFeedback({ type: 'error', message: 'Failed to fetch word details.' });
    } finally {
      setIsAddingManual(false);
    }
  };

  const toggleFavorite = (word: string) => {
    const newState = {
      ...gameState,
      notebook: gameState.notebook.map(w => w.word === word ? { ...w, isFavorite: !w.isFavorite } : w)
    };
    setGameState(newState);
    triggerSave(newState);
  };

  const sellCrop = (cropId: string) => {
    const count = gameState.inventory[cropId] || 0;
    if (count <= 0) return;
    
    const crop = CROPS[cropId];
    const price = Math.floor(crop.baseValue * crop.growthCoefficient);
    
    const newState = {
      ...gameState,
      inventory: { ...gameState.inventory, [cropId]: count - 1 },
      user: { 
        ...gameState.user, 
        coins: gameState.user.coins + price,
        totalCoinsEarned: gameState.user.totalCoinsEarned + price
      }
    };
    
    setGameState(newState);
    triggerSave(newState);
    setFeedback({ type: 'success', message: `Sold ${crop.name} for ${price} coins!` });
  };

  const buySeedPack = (packId: string) => {
    const pack = SEED_PACKS.find(p => p.id === packId);
    if (!pack || gameState.user.coins < pack.price || gameState.unlockedSeedPacks.includes(packId)) return;
    
    const newState = {
      ...gameState,
      user: { ...gameState.user, coins: gameState.user.coins - pack.price },
      unlockedSeedPacks: [...gameState.unlockedSeedPacks, packId]
    };
    
    setGameState(newState);
    triggerSave(newState);
    setFeedback({ type: 'success', message: `Unlocked ${pack.name}!` });
  };

  const cellSize = dimensions.width / 5;

  return (
    <div className="min-h-screen bg-[#fcfaf7] text-[#2d2d2d] font-sans pb-20">
      <Header stats={gameState.user} isSaving={isSaving} />
      
      <AnimatePresence mode="wait">
        {activeTab === 'farm' && (
          <motion.div key="farm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pt-20 pb-24 px-4 min-h-screen bg-[url('https://picsum.photos/id/10/1920/1080?blur=10')] bg-cover bg-fixed">
            <div className="max-w-4xl mx-auto space-y-6">
              {/* Farm Header */}
              <div className="bg-white/90 backdrop-blur shadow-xl rounded-3xl p-6 flex items-center justify-between border border-white/20">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className="w-16 h-16 bg-farm-green/10 rounded-2xl flex items-center justify-center text-farm-green">
                      <User size={32} />
                    </div>
                    <div className="absolute -bottom-1 -right-1 bg-farm-accent text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md">
                      Lvl {gameState.user.farmLevel}
                    </div>
                  </div>
                  <div>
                    <h2 className="font-bold text-slate-800">{gameState.user.title}</h2>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="w-32 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-farm-green" style={{ width: `${(gameState.user.xp % 100)}%` }} />
                      </div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase">Exp {gameState.user.xp % 100}/100</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="text-center">
                    <div className="flex items-center justify-center text-orange-500 mb-1">
                      <Flame size={20} fill="currentColor" />
                    </div>
                    <p className="text-xs font-bold text-slate-800">{gameState.user.streak} Day</p>
                    <p className="text-[10px] text-slate-400 uppercase font-bold">Streak</p>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center text-blue-500 mb-1">
                      <Droplets size={20} fill="currentColor" />
                    </div>
                    <p className="text-xs font-bold text-slate-800">{gameState.notebook.length}</p>
                    <p className="text-[10px] text-slate-400 uppercase font-bold">Words</p>
                  </div>
                </div>
              </div>

              {/* Farm Grid and Seed Selection */}
              <div className="flex flex-col lg:flex-row gap-8 items-start">
                <div className="flex-1 relative bg-white/40 backdrop-blur-sm rounded-[40px] p-8 border border-white/30 shadow-2xl w-full">
                  <div ref={containerRef} className="w-full aspect-square relative">
                    <Stage width={dimensions.width} height={dimensions.height}>
                      <Layer>
                        {gameState.plots.map((plot, i) => {
                          const row = Math.floor(i / 5);
                          const col = i % 5;
                          const x = col * cellSize;
                          const y = row * cellSize;
                          const crop = plot.cropId ? CROPS[plot.cropId] : null;

                          return (
                            <Group key={plot.id} x={x} y={y} onClick={() => handlePlotClick(plot.id)}>
                              <Rect
                                width={cellSize - 16}
                                height={cellSize - 16}
                                x={8}
                                y={8}
                                fill={!plot.isUnlocked ? '#d4cec2' : plot.status === 'empty' ? (plantingPlotId === plot.id ? '#5A5A40' : '#967d5f') : '#867055'}
                                cornerRadius={24}
                                opacity={plot.isUnlocked ? 1 : 0.5}
                                stroke={plantingPlotId === plot.id ? '#fff' : undefined}
                                strokeWidth={plantingPlotId === plot.id ? 4 : 0}
                              />
                              {!plot.isUnlocked && <Text text="🔒" fontSize={24} x={cellSize/2 - 12} y={cellSize/2 - 12} opacity={0.5} />}
                              {plot.status !== 'empty' && crop && (
                                <Group x={cellSize/2} y={cellSize/2}>
                                  <Text 
                                    text={plot.status === 'mature' ? crop.emoji : '🌱'} 
                                    fontSize={plot.status === 'mature' ? 48 : 32 + plot.growthStage * 8} 
                                    x={0}
                                    y={0}
                                    offsetX={plot.status === 'mature' ? 24 : 16}
                                    offsetY={plot.status === 'mature' ? 24 : 16}
                                    align="center"
                                    verticalAlign="middle"
                                  />
                                </Group>
                              )}
                            </Group>
                          );
                        })}
                      </Layer>
                    </Stage>
                    {isActionLoading && (
                      <div className="absolute inset-0 bg-white/40 backdrop-blur-sm flex items-center justify-center z-10 rounded-[40px]">
                        <Loader2 className="w-14 h-14 text-farm-green animate-spin" />
                      </div>
                    )}

                    {/* Animation Overlay */}
                    <AnimatePresence>
                      {plantingEffect && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.5, y: -50 }}
                          animate={{ opacity: 1, scale: 1.2, y: 0 }}
                          exit={{ opacity: 0, scale: 1.5, y: -20 }}
                          style={{
                            position: 'absolute',
                            left: plantingEffect.x,
                            top: plantingEffect.y,
                            transform: 'translate(-50%, -50%)',
                            fontSize: '40px',
                            zIndex: 20,
                            pointerEvents: 'none'
                          }}
                        >
                          {plantingEffect.emoji}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Side Seed Selection */}
                <AnimatePresence>
                  {plantingPlotId !== null && (
                    <motion.div 
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="w-full lg:w-64 bg-white/90 backdrop-blur p-6 rounded-[40px] shadow-xl border border-white/20"
                    >
                      <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-stone-400">Select Seed</h3>
                        <button onClick={() => setPlantingPlotId(null)} className="text-stone-400 hover:text-stone-600">
                          <XCircle size={20} />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 lg:grid-cols-1 gap-4">
                        {Object.values(CROPS).filter(c => gameState.unlockedSeedPacks.some(p => SEED_PACKS.find(sp => sp.id === p)?.categories.includes(c.category))).map(crop => (
                          <button
                            key={crop.id}
                            onClick={() => handlePlantSeed(crop.id)}
                            className={cn(
                              "p-4 rounded-[24px] border transition-all flex items-center gap-3",
                              selectedCrop === crop.id ? "bg-farm-green/10 border-farm-green" : "bg-stone-50 border-stone-100 hover:border-stone-300"
                            )}
                          >
                            <span className="text-2xl">{crop.emoji}</span>
                            <span className="font-bold text-xs text-stone-800">{crop.name}</span>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'market' && (
          <motion.div key="market" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pt-20 pb-24 px-4 min-h-screen bg-slate-50">
            <div className="max-w-4xl mx-auto space-y-8">
              <h2 className="text-2xl font-serif font-bold text-slate-800">Market & Seed Store</h2>
              
              <section className="space-y-4">
                <h3 className="font-bold text-slate-700">Your Inventory for Sale</h3>
                <div className="space-y-3">
                  {Object.entries(gameState.inventory).filter(([_, count]) => count > 0).map(([id, count]) => {
                    const crop = CROPS[id];
                    const price = Math.floor(crop.baseValue * crop.growthCoefficient);
                    return (
                      <div key={id} className="bg-white border border-slate-100 rounded-2xl p-4 flex items-center justify-between shadow-sm">
                        <div className="flex items-center gap-4">
                          <div className="text-4xl">{crop.emoji}</div>
                          <div>
                            <h4 className="font-bold text-slate-800">{crop.name} (x{count})</h4>
                            <p className="text-xs text-slate-500">Sell for {price} coins each</p>
                          </div>
                        </div>
                        <button onClick={() => sellCrop(id)} className="px-6 py-2 bg-farm-green text-white rounded-xl font-bold hover:bg-farm-green/90 transition-all flex items-center gap-2">
                          Sell 1 for {price} <Coins size={14} />
                        </button>
                      </div>
                    );
                  })}
                  {Object.values(gameState.inventory).every(c => c === 0) && (
                    <div className="text-center py-8 text-slate-400 italic">No crops in inventory. Go farm!</div>
                  )}
                </div>
              </section>

              <section className="space-y-4">
                <h3 className="font-bold text-slate-700">Seed Shop</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {SEED_PACKS.map(pack => (
                    <div key={pack.id} className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-4 shadow-sm">
                      <div className="w-16 h-16 bg-slate-50 rounded-xl flex items-center justify-center text-3xl">
                        {CROPS[pack.categories[0].toLowerCase()]?.emoji || '📦'}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-bold text-sm text-slate-800">{pack.name}</h4>
                        <p className="text-[10px] text-slate-500 mb-2">{pack.description}</p>
                        {gameState.unlockedSeedPacks.includes(pack.id) ? (
                          <span className="text-[10px] font-bold text-farm-green bg-farm-green/10 px-3 py-1 rounded-lg">Unlocked</span>
                        ) : (
                          <button 
                            onClick={() => buySeedPack(pack.id)}
                            className="w-full py-1.5 bg-farm-green text-white text-[10px] font-bold rounded-lg hover:bg-farm-green/90 transition-all"
                          >
                            Buy for {pack.price} coins
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </motion.div>
        )}

        {activeTab === 'notebook' && (
          <motion.div key="notebook" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pt-20 pb-24 px-4 min-h-screen bg-white">
            <div className="max-w-4xl mx-auto space-y-8">
              <div className="flex justify-between items-center">
                <h2 className="text-3xl font-serif font-bold">Vocabulary Notebook</h2>
                <div className="relative">
                  <input 
                    type="text" 
                    placeholder="Add word..." 
                    value={manualWord}
                    onChange={(e) => setManualWord(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddManualWord()}
                    className="pl-6 pr-12 py-2 bg-slate-50 border border-slate-100 rounded-full w-48 focus:outline-none focus:border-farm-green transition-all text-sm"
                  />
                  <button 
                    onClick={handleAddManualWord}
                    disabled={isAddingManual}
                    className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 bg-farm-green text-white rounded-full hover:bg-farm-green/90 disabled:opacity-50"
                  >
                    {isAddingManual ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {gameState.notebook.sort((a, b) => (b.isFavorite ? 1 : 0) - (a.isFavorite ? 1 : 0)).map((word, i) => (
                  <div key={i} className="p-6 bg-slate-50 rounded-3xl border border-slate-100 hover:border-farm-green/20 transition-all group relative">
                    <button onClick={() => toggleFavorite(word.word)} className={cn("absolute top-4 right-4 transition-colors", word.isFavorite ? "text-rose-500" : "text-slate-300 hover:text-rose-300")}>
                      <Trophy size={18} className={cn(word.isFavorite ? "fill-current" : "")} />
                    </button>
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-2xl font-serif text-farm-green">{word.word}</h3>
                          {word.isManual && <span className="text-[8px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-bold uppercase">Manual</span>}
                        </div>
                        <p className="text-xs font-mono text-slate-400">{word.phonetic} • {word.partOfSpeech}</p>
                      </div>
                      <button onClick={() => playAudio(word.audioData)} className="p-2 bg-white rounded-full shadow-sm hover:bg-farm-green/10">
                        <Volume2 size={18} className="text-farm-green" />
                      </button>
                    </div>
                    <p className="text-slate-600 mb-4 text-sm leading-relaxed">{word.definition}</p>
                    <div className="bg-white p-3 rounded-xl border border-slate-100 italic text-slate-500 text-xs">"{word.example}"</div>
                    <div className="mt-4 flex items-center justify-between">
                      <span className="text-[8px] font-bold uppercase tracking-widest text-slate-400 bg-slate-100 px-2 py-1 rounded-full">{word.status}</span>
                      <div className="w-24 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <div className="h-full bg-farm-green" style={{ width: `${(word.masteryCount / 3) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'stats' && (
          <motion.div key="stats" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pt-20 pb-24 px-4 min-h-screen bg-slate-50">
            <div className="max-w-4xl mx-auto space-y-8">
              <h2 className="text-2xl font-serif font-bold text-slate-800">Learning Dashboard</h2>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Mastered</p>
                  <p className="text-3xl font-serif text-farm-green">{gameState.masteredCount}</p>
                </div>
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Learning</p>
                  <p className="text-3xl font-serif text-indigo-600">{gameState.notebook.filter(w => w.status === 'learning').length}</p>
                </div>
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Streak</p>
                  <p className="text-3xl font-serif text-amber-600">{gameState.user.streak}d</p>
                </div>
              </div>

              <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100">
                <h3 className="font-bold text-slate-700 mb-6">Mastery Progress</h3>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={gameState.notebook.reduce((acc: any[], word) => {
                      const level = word.level;
                      const existing = acc.find(a => a.level === level);
                      if (existing) existing.count++;
                      else acc.push({ level, count: 1 });
                      return acc;
                    }, []).sort((a, b) => a.level.localeCompare(b.level))}>
                      <defs>
                        <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#5A5A40" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#5A5A40" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="level" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                      <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                      <Area type="monotone" dataKey="count" stroke="#5A5A40" strokeWidth={3} fillOpacity={1} fill="url(#colorCount)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'quests' && (
          <motion.div key="quests" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pt-20 pb-24 px-4 min-h-screen bg-slate-50">
            <div className="max-w-4xl mx-auto space-y-12">
              <section>
                <h2 className="text-3xl font-serif font-bold mb-8">Daily Quests</h2>
                <div className="space-y-4">
                  {[
                    { label: 'Learn 5 New Words', current: gameState.user.dailyQuests.wordsLearned, target: 5 },
                    { label: 'Complete 1 NPC Dialogue', current: gameState.user.dailyQuests.npcDialogues, target: 1 },
                    { label: 'Perform 10 Reviews', current: gameState.user.dailyQuests.reviewsDone, target: 10 }
                  ].map((q, i) => (
                    <div key={i} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center justify-between">
                      <div>
                        <h3 className="font-bold text-slate-800">{q.label}</h3>
                        <p className="text-xs text-slate-400 mt-1">Progress: {q.current} / {q.target}</p>
                      </div>
                      <div className="w-32 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-farm-green transition-all" style={{ width: `${Math.min((q.current / q.target) * 100, 100)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <h2 className="text-3xl font-serif font-bold mb-8">Achievements</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {gameState.achievements.map((a) => (
                    <div key={a.id} className={cn(
                      "p-6 rounded-3xl border transition-all text-center flex flex-col items-center gap-3 bg-white",
                      a.unlockedTiers.length > 0 ? "border-emerald-100 shadow-sm" : "border-stone-100 opacity-60 grayscale"
                    )}>
                      <div className="text-4xl">{a.emoji}</div>
                      <h3 className="font-bold text-sm text-stone-800 leading-tight">{a.title}</h3>
                      <p className="text-[10px] text-stone-400">{a.description}</p>
                      <div className="flex gap-1.5">
                        {['Bronze', 'Silver', 'Gold'].map(tier => (
                          <div key={tier} className={cn(
                            "w-2 h-2 rounded-full",
                            a.unlockedTiers.includes(tier as AchievementTier) 
                              ? (tier === 'Bronze' ? "bg-amber-600" : tier === 'Silver' ? "bg-stone-400" : "bg-amber-400")
                              : "bg-stone-200"
                          )} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </motion.div>
        )}

        {activeTab === 'learn' && activeChallenge && (
          <motion.div key="learn" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-white z-[100] overflow-y-auto">
            <div className="pt-20 pb-24 px-4 min-h-screen">
              <div className="max-w-2xl mx-auto space-y-8">
                <div className="flex items-center justify-between">
                  <button onClick={() => { setActiveChallenge(null); setActiveTab('farm'); }} className="flex items-center gap-1 text-slate-400 hover:text-slate-600">
                    <ChevronLeft size={20} />
                    <span className="text-sm font-bold">Back</span>
                  </button>
                  <h2 className="text-lg font-bold text-slate-800">
                    {activeChallenge.type === 'planting' ? 'Planting Word' : 
                     activeChallenge.type === 'growing' ? 'Growth Challenge' : 
                     activeChallenge.type === 'harvesting' ? 'Harvest Challenge' : 'Challenge'}
                  </h2>
                  <div className="w-20" />
                </div>

                {activeChallenge.type === 'planting' && activeChallenge.wordData && (
                  <div className="space-y-8">
                    <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white border border-slate-200 shadow-2xl rounded-[32px] p-8 space-y-6">
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <h3 className="text-4xl font-bold text-slate-800 tracking-tight">{activeChallenge.wordData.word}</h3>
                          <p className="text-slate-400 font-mono text-sm">{activeChallenge.wordData.phonetic}</p>
                        </div>
                        <button onClick={() => playAudio(activeChallenge.wordData?.audioData)} className="p-3 bg-slate-50 rounded-full text-slate-400 hover:text-farm-green transition-colors">
                          <Volume2 size={24} />
                        </button>
                      </div>
                      <div className="space-y-4">
                        <p className="text-slate-600 leading-relaxed">{activeChallenge.wordData.definition}</p>
                        <div className="bg-slate-50 p-4 rounded-2xl border-l-4 border-farm-green italic text-slate-500">"{activeChallenge.wordData.example}"</div>
                      </div>
                    </motion.div>
                    <button onClick={() => onChallengeSuccess()} className="w-full py-4 bg-farm-green text-white rounded-2xl font-bold shadow-lg hover:bg-farm-green/90 active:scale-95 transition-all flex items-center justify-center gap-2">
                      Plant this Word <ArrowRight size={20} />
                    </button>
                  </div>
                )}

                {(activeChallenge.type === 'growing' || activeChallenge.type === 'harvesting' || activeChallenge.type === 'boss') && activeChallenge.challengeData && (
                  <div className="space-y-8">
                    <div className="text-center">
                      <div className="inline-block px-4 py-1.5 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-bold uppercase tracking-widest mb-6">
                        {activeChallenge.type === 'boss' ? 'Boss Battle' : 'Knowledge Check'}
                      </div>
                      <h2 className="text-3xl font-serif text-slate-800 leading-tight mb-10">{activeChallenge.challengeData.question}</h2>
                      <div className="grid grid-cols-1 gap-4">
                        {activeChallenge.challengeData.options.map((opt, i) => (
                          <button 
                            key={i} 
                            onClick={() => opt === activeChallenge.challengeData?.answer ? onChallengeSuccess() : onChallengeFail()} 
                            className="w-full p-6 rounded-2xl border-2 border-slate-100 hover:border-farm-green hover:bg-farm-green/5 text-left font-bold text-slate-600 transition-all"
                          >
                            <span className="mr-3 opacity-30">{String.fromCharCode(65 + i)}.</span>
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {activeChallenge.type === 'risk' && (
                  <div className="text-center space-y-8 py-12">
                    <div className="w-24 h-24 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-6">
                      <Trophy size={48} className="text-amber-500" />
                    </div>
                    <h2 className="text-4xl font-serif text-slate-800">Double or Nothing?</h2>
                    <p className="text-slate-500 text-lg">Answer correctly for double rewards, but one mistake loses it all!</p>
                    <div className="flex flex-col gap-4">
                      <button onClick={() => startHarvest(activeChallenge.plotId!, true)} className="w-full py-4 bg-amber-500 text-white rounded-2xl font-bold text-xl shadow-lg hover:bg-amber-600 transition-all">
                        Risk for x2
                      </button>
                      <button onClick={() => startHarvest(activeChallenge.plotId!, false)} className="w-full py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold text-xl hover:bg-slate-200 transition-all">
                        Standard Harvest
                      </button>
                    </div>
                  </div>
                )}

                {activeChallenge.type === 'chest' && (
                  <div className="text-center space-y-8 py-12">
                    <motion.div animate={{ rotate: [0, -5, 5, -5, 5, 0] }} transition={{ repeat: Infinity, duration: 2 }} className="text-8xl mb-8">🎁</motion.div>
                    <h2 className="text-4xl font-serif text-slate-800">Lucky Treasure!</h2>
                    <p className="text-slate-500 text-lg">You found a hidden chest in the field.</p>
                    <button onClick={() => onChallengeSuccess()} className="w-full py-4 bg-farm-green text-white rounded-2xl font-bold text-xl shadow-lg">
                      Open for +{activeChallenge.reward?.coins} Coins
                    </button>
                  </div>
                )}

                {activeChallenge.type === 'npc' && activeChallenge.npcDialogue && (
                  <div className="space-y-8">
                    <div className="flex gap-6 items-start">
                      <div className="w-24 h-24 flex-shrink-0 rounded-3xl overflow-hidden shadow-lg border-4 border-white">
                        <img src="https://picsum.photos/seed/gardener/200/200" alt="NPC" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      </div>
                      <div className="flex-1 bg-slate-50 p-6 rounded-3xl border border-slate-100 relative">
                        <div className="absolute -left-2 top-6 w-4 h-4 bg-slate-50 border-l border-t border-slate-100 rotate-[-45deg]" />
                        <p className="text-xs font-bold text-farm-green uppercase mb-2">{activeChallenge.npcDialogue.npcName}</p>
                        <p className="text-lg font-serif italic text-slate-700 leading-relaxed">"{activeChallenge.npcDialogue.text}"</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-4">
                      {activeChallenge.npcDialogue.options.map((opt, i) => (
                        <button key={i} onClick={() => opt === activeChallenge.npcDialogue?.answer ? onChallengeSuccess() : setFeedback({ type: 'error', message: 'Incorrect!' })} className="w-full p-6 rounded-2xl border-2 border-slate-100 hover:border-farm-green hover:bg-farm-green/5 text-left font-bold text-slate-600 transition-all">
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Feedback Toast */}
      <AnimatePresence>
        {feedback && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className={cn("fixed bottom-24 left-1/2 -translate-x-1/2 px-8 py-4 rounded-full shadow-2xl flex items-center gap-3 z-[110]", feedback.type === 'success' ? "bg-farm-green text-white" : "bg-rose-600 text-white")}>
            {feedback.type === 'success' ? <CheckCircle2 size={24} /> : <XCircle size={24} />}
            <span className="font-bold tracking-tight">{feedback.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
