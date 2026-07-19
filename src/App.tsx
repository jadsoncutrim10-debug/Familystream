import { useState, useEffect, useRef } from 'react';
import { 
  Film, 
  Search, 
  Tv, 
  Settings, 
  ShieldCheck, 
  LogOut, 
  Heart, 
  Plus, 
  X, 
  Sparkles, 
  Grid, 
  Play,
  RotateCcw,
  Check,
  User,
  Share2,
  Download,
  Moon,
  Sun,
  Laptop
} from 'lucide-react';
import { dbService } from './lib/dbService';
import { isFirebaseEnabled } from './lib/firebase';
import { MediaItem, Episode, Season, UserAccount, Profile, AppConfig, PlaybackHistory } from './types';

// Subcomponents
import AuthScreen from './components/AuthScreen';
import ProfileSelector from './components/ProfileSelector';
import VideoPlayer from './components/VideoPlayer';
import HeroBanner from './components/HeroBanner';
import MediaSlider from './components/MediaSlider';
import MediaModal from './components/MediaModal';
import AdminPanel from './components/AdminPanel';
import ConfigPanel from './components/ConfigPanel';

export default function App() {
  const [config, setConfig] = useState<AppConfig>({
    platformName: 'FamilyStream',
    primaryColor: '#E50914',
    defaultTheme: 'dark',
    language: 'pt-BR',
    storageProvider: 'local'
  });

  const [loading, setLoading] = useState(true);
  const [userAccount, setUserAccount] = useState<UserAccount | null>(null);
  const [activeProfile, setActiveProfile] = useState<Profile | null>(null);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);

  // Navigation states
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('Todos');

  // Popup Modals states
  const [selectedMediaDetails, setSelectedMediaDetails] = useState<MediaItem | null>(null);
  const [playingMedia, setPlayingMedia] = useState<MediaItem | null>(null);
  const [playingEpisode, setPlayingEpisode] = useState<Episode | undefined>(undefined);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [adminPanelInitialMedia, setAdminPanelInitialMedia] = useState<MediaItem | null>(null);
  const [showConfigPanel, setShowConfigPanel] = useState(false);
  const [showPwaModal, setShowPwaModal] = useState(false);
  const [pwaInstallStatus, setPwaInstallStatus] = useState<'idle' | 'installing' | 'installed'>('idle');

  // Theme Toggler state
  const [currentTheme, setCurrentTheme] = useState<'dark' | 'light'>('dark');

  // Keep track of the last time we saved to remote Firestore (to avoid overloading writes)
  const lastSavedTimeRef = useRef<number>(0);
  const latestUserAccountRef = useRef<UserAccount | null>(null);

  // Sync latest userAccount state to ref
  useEffect(() => {
    latestUserAccountRef.current = userAccount;
  }, [userAccount]);

  // Initialize Configurations, Media, and Auth
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // 1. Get platform configuration
        const cfg = await dbService.getConfig();
        setConfig(cfg);
        setCurrentTheme(cfg.defaultTheme);

        // 2. Load library videos
        const videos = await dbService.getMediaItems();
        setMediaItems(videos);

        // 3. Subscribe to authentication state
        const unsubscribe = dbService.subscribeToAuth(async (firebaseUser) => {
          if (firebaseUser) {
            let acc = await dbService.getUserAccount(firebaseUser.uid);
            const userEmail = firebaseUser.email || '';
            const isAdminEmail = userEmail.toLowerCase() === 'jadsoncutrim10@gmail.com';
            
            if (acc) {
              // Enforce admin role for specified email
              if (isAdminEmail && acc.role !== 'admin') {
                acc.role = 'admin';
                await dbService.saveUserAccount(acc);
              }
              setUserAccount(acc);
              // Auto restore active profile if exists
              if (acc.activeProfileId) {
                const active = acc.profiles.find(p => p.id === acc.activeProfileId);
                if (active) setActiveProfile(active);
              }
            } else {
              // Self-heal
              const defaultProfiles = [
                { id: 'p1', name: 'Pai (Admin)', avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=150&auto=format&fit=crop', isKid: false },
                { id: 'p2', name: 'Mãe', avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=150&auto=format&fit=crop', isKid: false },
                { id: 'p3', name: 'Crianças 🧸', avatarUrl: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?q=80&w=150&auto=format&fit=crop', isKid: true },
              ];
              const fallbackAcc: UserAccount = {
                uid: firebaseUser.uid,
                email: userEmail || 'user@familystream.com',
                role: isAdminEmail ? 'admin' : 'user',
                profiles: defaultProfiles,
                activeProfileId: 'p1',
                favorites: [],
                customLists: [],
                history: [],
                createdAt: new Date().toISOString()
              };
              await dbService.saveUserAccount(fallbackAcc);
              setUserAccount(fallbackAcc);
              setActiveProfile(defaultProfiles[0]);
            }
          } else {
            setUserAccount(null);
            setActiveProfile(null);
          }
          setLoading(false);
        });

        return () => unsubscribe();
      } catch (error) {
        console.error('Error initializing app:', error);
        setLoading(false);
      }
    };

    initializeApp();
  }, []);

  // Update theme settings on configuration updates
  useEffect(() => {
    setCurrentTheme(config.defaultTheme);
  }, [config]);

  const handleProfileSelect = (profile: Profile) => {
    setActiveProfile(profile);
    if (userAccount) {
      const updated = { ...userAccount, activeProfileId: profile.id };
      setUserAccount(updated);
      dbService.saveUserAccount(updated);
    }
  };

  const handleLogout = () => {
    if (confirm('Deseja realmente encerrar sua sessão?')) {
      if (isFirebaseEnabled) {
        import('firebase/auth').then(({ getAuth, signOut }) => {
          const auth = getAuth();
          signOut(auth);
        });
      } else {
        localStorage.removeItem('familystream_current_uid');
        setUserAccount(null);
        setActiveProfile(null);
      }
    }
  };

  const handleToggleFavorite = async (mediaId: string) => {
    if (!userAccount) return;

    const favorites = [...userAccount.favorites];
    const index = favorites.indexOf(mediaId);
    if (index >= 0) {
      favorites.splice(index, 1);
    } else {
      favorites.push(mediaId);
    }

    const updatedUser = { ...userAccount, favorites };
    setUserAccount(updatedUser);
    await dbService.saveUserAccount(updatedUser);
  };

  // Reset last saved progress marker whenever we change active media or episode
  useEffect(() => {
    lastSavedTimeRef.current = 0;
  }, [playingMedia?.id, playingEpisode?.id]);

  // Playback progress updates (Called periodically during video playback)
  const handlePlaybackTimeUpdate = async (currentTime: number, duration: number) => {
    if (!userAccount || !playingMedia) return;

    const completed = (currentTime / duration) >= 0.90; // 90% watched counts as completed

    const record: PlaybackHistory = {
      mediaId: playingMedia.id,
      episodeId: playingEpisode?.id,
      currentTime,
      duration,
      completed,
      updatedAt: Date.now()
    };

    // Filter old records of this media/episode and prepend new one
    const filteredHistory = userAccount.history.filter(
      h => {
        const hEpisodeId = h.episodeId || '';
        const currentEpisodeId = playingEpisode?.id || '';
        return !(h.mediaId === playingMedia.id && hEpisodeId === currentEpisodeId);
      }
    );

    const updatedUser: UserAccount = {
      ...userAccount,
      history: [record, ...filteredHistory]
    };

    setUserAccount(updatedUser);

    // Throttle remote database saves to once every 10 seconds, unless video is completed or it is the first save
    const timeDiff = Math.abs(currentTime - lastSavedTimeRef.current);
    const isFirstSaveForThisTrack = lastSavedTimeRef.current === 0;
    const shouldSaveRemote = completed || isFirstSaveForThisTrack || timeDiff >= 10;

    if (shouldSaveRemote) {
      lastSavedTimeRef.current = currentTime;
      await dbService.saveUserAccount(updatedUser, false); // remote save
    } else {
      await dbService.saveUserAccount(updatedUser, true); // skip remote save, save only in local storage
    }
  };

  const handleEpisodeCompleted = async (episodeId?: string) => {
    // Force increment video view count upon completion
    if (playingMedia) {
      await dbService.incrementViews(playingMedia.id);
      const updatedList = await dbService.getMediaItems();
      setMediaItems(updatedList);
    }
  };

  const handleNextEpisodeTrigger = (nextEp: Episode) => {
    setPlayingEpisode(nextEp);
  };

  // PWA installation process simulator
  const handleSimulatePwaInstall = () => {
    setPwaInstallStatus('installing');
    setTimeout(() => {
      setPwaInstallStatus('installed');
      setTimeout(() => {
        setShowPwaModal(false);
        setPwaInstallStatus('idle');
        alert('FamilyStream foi instalado com sucesso na sua área de trabalho/tela inicial!');
      }, 1000);
    }, 2000);
  };

  // Content Filtering (Search & Category tags)
  // Kid profiles can only view videos with classification "Livre" or tags for Kids!
  const filteredMedia = mediaItems.filter((item) => {
    // 1. Kids profile restrictions
    if (activeProfile?.isKid) {
      const isLivre = item.rating === 'Livre' || item.category === 'Infantil';
      if (!isLivre) return false;
    }

    // 2. Exclude videos that failed validation or are marked as corrupted
    if (item.isValidated === false) {
      return false;
    }

    // 3. Category selection
    if (activeCategory !== 'Todos') {
      if (item.category !== activeCategory) return false;
    }

    // 3. Instant search text queries (search by name, tags, directors, cast)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = item.title.toLowerCase().includes(q);
      const matchCategory = item.category.toLowerCase().includes(q);
      const matchDirector = item.director?.toLowerCase().includes(q);
      const matchTags = item.tags.some(t => t.toLowerCase().includes(q));
      const matchCast = item.cast?.some(c => c.toLowerCase().includes(q));
      const matchYear = item.year.toString().includes(q);

      return matchTitle || matchCategory || matchDirector || matchTags || matchCast || matchYear;
    }

    return true;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col justify-center items-center text-white font-sans gap-3">
        <Film className="w-12 h-12 text-red-600 animate-pulse" />
        <span className="text-sm font-bold tracking-widest uppercase text-neutral-400">Carregando FamilyStream...</span>
        <div className="w-40 bg-neutral-900 h-1 rounded-full overflow-hidden mt-1">
          <div className="bg-red-600 h-full animate-progress" />
        </div>
      </div>
    );
  }

  // Auth Screen guard
  if (!userAccount) {
    return <AuthScreen config={config} onAuthSuccess={(user) => setUserAccount(user)} />;
  }

  // Profiles selection guard
  if (!activeProfile) {
    return (
      <ProfileSelector 
        config={config} 
        userAccount={userAccount} 
        onProfileSelect={handleProfileSelect} 
        onUserUpdate={(u) => setUserAccount(u)} 
      />
    );
  }

  // Fetch the featured banner (find one that is featured or default to first movie in the filtered category list)
  const featuredItem = filteredMedia.find(m => m.isFeatured) || 
                       filteredMedia[0] || 
                       null;

  // Continue watching list (history where progress is incomplete)
  const seenMediaIds = new Set<string>();
  const continueWatchingItems = userAccount.history
    .map((record) => {
      const item = mediaItems.find(m => m.id === record.mediaId);
      if (!item) return null;
      // Filter out completed and check kid profile access
      if (record.completed) return null;
      if (activeProfile.isKid && item.rating !== 'Livre' && item.category !== 'Infantil') return null;
      // Filter by active category if selected
      if (activeCategory !== 'Todos' && item.category !== activeCategory) return null;
      
      // Deduplicate: only show the single most recent record for each unique mediaId
      if (seenMediaIds.has(record.mediaId)) return null;
      seenMediaIds.add(record.mediaId);
      
      return { item, record };
    })
    .filter(Boolean) as { item: MediaItem; record: PlaybackHistory }[];

  const favoriteItems = mediaItems.filter(m => userAccount.favorites.includes(m.id) && (!activeProfile.isKid || m.rating === 'Livre'));

  // Split view styling classes based on Light vs Dark theme state
  const isLightTheme = currentTheme === 'light';
  const bodyBgClass = isLightTheme ? 'bg-neutral-50 text-neutral-900' : 'bg-[#050505] text-white';
  const headerBgClass = isLightTheme ? 'bg-white/90 border-b border-neutral-200 text-neutral-900' : 'bg-black/40 border-b border-white/10 text-white';
  const textTitleClass = isLightTheme ? 'text-neutral-900' : 'text-white';
  const badgeThemeClass = isLightTheme ? 'bg-neutral-200 text-neutral-800' : 'bg-neutral-900 text-neutral-300';

  const categoryPresets = ['Todos', ...(config.categories || ['Filmes', 'Séries', 'Documentários', 'Vídeos da família', 'Infantil', 'Música', 'Outros'])];

  return (
    <div className={`min-h-screen ${bodyBgClass} transition-colors duration-300 font-sans relative overflow-x-hidden selection:bg-orange-600 selection:text-white`}>
      
      {/* 1. STICKY TOP NAVIGATION BAR */}
      <header className={`sticky top-0 z-30 ${headerBgClass} backdrop-blur-md px-4 md:px-16 py-3.5 flex flex-col md:flex-row justify-between items-center gap-4 transition-all duration-300`}>
        <div className="flex items-center justify-between w-full md:w-auto gap-4">
          
          {/* Logo brand */}
          <div className="flex items-center gap-2 cursor-pointer select-none" onClick={() => { setActiveCategory('Todos'); setSearchQuery(''); }}>
            {config.customLogoUrl ? (
              <img src={config.customLogoUrl} alt="Logo" className="h-8 object-contain" referrerPolicy="no-referrer" />
            ) : (
              <div className="flex items-center gap-1.5 font-sans font-black text-2xl tracking-tighter bg-gradient-to-r from-orange-500 to-red-600 bg-clip-text text-transparent uppercase">
                <span>{config.platformName}</span>
              </div>
            )}
          </div>

          {/* Quick theme toggler and install apps bar for mobile */}
          <div className="flex items-center gap-2 md:hidden">
            <button
              onClick={() => setCurrentTheme(currentTheme === 'dark' ? 'light' : 'dark')}
              className="p-2 hover:bg-neutral-500/10 rounded-full text-neutral-400 hover:text-white"
              title="Alternar Tema"
            >
              {isLightTheme ? <Moon className="w-5 h-5 text-neutral-700" /> : <Sun className="w-5 h-5 text-amber-500" />}
            </button>
            <button
              onClick={() => setShowPwaModal(true)}
              className="p-1.5 px-3 bg-neutral-800/80 text-white text-[10px] font-extrabold uppercase rounded-full flex items-center gap-1"
            >
              <Download className="w-3 h-3" /> Instalar
            </button>
          </div>
        </div>

        {/* Categories Bar & Search container */}
        <div className="flex-1 flex flex-col sm:flex-row items-center justify-end gap-3 w-full">
          
          {/* Instant Search box */}
          <div className="relative w-full sm:max-w-xs shrink-0">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Pesquisar títulos, elenco, tags..."
              className="w-full bg-neutral-900/60 border border-neutral-800/80 focus:border-neutral-700/80 rounded-full py-2 pl-10 pr-4 text-xs focus:outline-none text-white transition-colors placeholder:text-neutral-500"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>

          {/* Preset Buttons layout for desktop navigation */}
          <div className="flex items-center gap-2.5">
            
            {/* Desktop Theme toggler */}
            <button
              onClick={() => setCurrentTheme(currentTheme === 'dark' ? 'light' : 'dark')}
              className="hidden md:flex p-2 hover:bg-neutral-500/10 rounded-full text-neutral-400 hover:text-white cursor-pointer"
              title="Alternar Tema"
            >
              {isLightTheme ? <Moon className="w-5 h-5 text-neutral-700" /> : <Sun className="w-5 h-5 text-amber-500" />}
            </button>

            {/* Simulated install button */}
            <button
              onClick={() => setShowPwaModal(true)}
              className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 text-white text-xs font-bold uppercase rounded-lg hover:bg-neutral-700 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Instalar App
            </button>

            {/* Admin control gear (only if userAccount role is admin) */}
            {userAccount.role === 'admin' && (
              <button
                onClick={() => setShowAdminPanel(true)}
                className="p-2 hover:bg-neutral-500/10 rounded-full text-neutral-400 hover:text-amber-500 cursor-pointer transition-colors"
                title="Painel Administrativo"
              >
                <ShieldCheck className="w-5 h-5" />
              </button>
            )}

            {/* Settings button */}
            <button
              onClick={() => setShowConfigPanel(true)}
              className="p-2 hover:bg-neutral-500/10 rounded-full text-neutral-400 hover:text-white cursor-pointer transition-colors"
              title="Preferências"
            >
              <Settings className="w-5 h-5" />
            </button>

            {/* Log out profile button */}
            <button
              onClick={handleLogout}
              className="p-2 hover:bg-neutral-500/10 rounded-full text-neutral-400 hover:text-red-500 cursor-pointer transition-colors"
              title="Sair da Conta"
            >
              <LogOut className="w-5 h-5" />
            </button>

            {/* User Account active profile display */}
            <div 
              onClick={() => setActiveProfile(null)}
              className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 hover:border-neutral-700 rounded-full py-1 pl-1.5 pr-3.5 cursor-pointer select-none"
              title="Trocar Perfil"
            >
              <img src={activeProfile.avatarUrl} alt="Avatar" className="w-6 h-6 rounded-full object-cover shrink-0" referrerPolicy="no-referrer" />
              <span className="text-[10px] md:text-xs font-bold text-neutral-300 truncate max-w-[80px]">{activeProfile.name}</span>
            </div>
          </div>
        </div>
      </header>

      {/* 2. SUB HEADER CATEGORIES ROW FILTERS */}
      <div className={`px-4 md:px-16 py-3 border-b border-white/5 flex gap-2 overflow-x-auto scrollbar-none shrink-0 ${isLightTheme ? 'bg-neutral-100' : 'bg-[#050505]/60 backdrop-blur-md'}`}>
        {categoryPresets.map((cat) => {
          const isSelected = activeCategory === cat;
          return (
            <button
              key={cat}
              onClick={() => { setActiveCategory(cat); setSearchQuery(''); }}
              style={{
                backgroundColor: isSelected ? config.primaryColor : undefined,
                color: isSelected ? '#FFFFFF' : undefined,
                borderColor: isSelected ? 'transparent' : undefined
              }}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap border cursor-pointer transition-all ${isSelected ? 'shadow-md' : 'text-white/60 border-white/10 hover:text-white hover:border-white/30 bg-white/5'}`}
            >
              {cat === 'Todos' ? '✦ Todos' : cat}
            </button>
          );
        })}
      </div>

      {/* 3. MAIN CONTENTS SECTION */}
      {searchQuery.trim() ? (
        /* SEARCH MODE */
        <div className="py-12 space-y-8 animate-fadeIn">
          <div className="px-6 md:px-16 text-left space-y-1">
            <span className="text-xs text-neutral-500 font-bold uppercase tracking-widest font-mono">Pesquisa Instantânea</span>
            <h2 className="text-2xl font-black text-white">Resultados para: "{searchQuery}"</h2>
          </div>

          {filteredMedia.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 px-6 md:px-16">
              {filteredMedia.map((item) => (
                <div
                  key={item.id}
                  onClick={() => setSelectedMediaDetails(item)}
                  className="relative group cursor-pointer bg-neutral-900 rounded-xl overflow-hidden border border-neutral-800/80 hover:border-neutral-700/80 transition-all shadow-lg hover:scale-[1.03]"
                >
                  <div className="relative aspect-[16/10] overflow-hidden">
                    <img src={item.coverUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center">
                      <Play className="w-8 h-8 fill-white text-white" />
                    </div>
                    <span className="absolute top-2 left-2 bg-black/70 text-[9px] font-extrabold px-1.5 py-0.5 rounded text-amber-500 border border-neutral-800/80">
                      {item.quality}
                    </span>
                  </div>
                  <div className="p-3 text-left">
                    <h4 className="font-bold text-xs text-white line-clamp-1">{item.title}</h4>
                    <p className="text-[10px] text-neutral-400 font-medium mt-1">{item.year} • {item.category}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-20 space-y-2">
              <Film className="w-12 h-12 text-neutral-700 mx-auto" />
              <p className="text-neutral-400 font-bold">Nenhum vídeo localizado para sua pesquisa.</p>
              <p className="text-xs text-neutral-500">Dica: verifique a ortografia ou limpe a busca.</p>
            </div>
          )}
        </div>
      ) : (
        /* DISCOVERY HOME MODE */
        <div className="space-y-12 pb-24">
          
          {/* Dynamic Hero banner */}
          {featuredItem && (
            <HeroBanner 
              media={featuredItem} 
              onPlay={(item) => {
                // If it is series, locate first episode!
                if (item.category === 'Séries' && item.seasons && item.seasons.length > 0) {
                  setPlayingMedia(item);
                  setPlayingEpisode(item.seasons[0].episodes[0]);
                } else {
                  setPlayingMedia(item);
                }
              }}
              onMoreInfo={(item) => setSelectedMediaDetails(item)}
              primaryColor={config.primaryColor}
            />
          )}

          {/* Continue Watching Row (Only if there is progress record) */}
          {continueWatchingItems.length > 0 && (
            <div className="w-full px-6 md:px-16 space-y-4 text-white font-sans text-left">
              <h3 className="text-lg md:text-xl font-black tracking-tight uppercase">Continue Assistindo</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {continueWatchingItems.map(({ item, record }) => {
                  const progressPercentage = Math.floor((record.currentTime / record.duration) * 100);
                  
                  let displayProgressTitle = '';
                  let foundEpisode: any = null;
                  if (record.episodeId && item.seasons) {
                    for (const season of item.seasons) {
                      const ep = season.episodes?.find(e => e.id === record.episodeId);
                      if (ep) {
                        foundEpisode = ep;
                        displayProgressTitle = `Ep. ${ep.episodeNumber}`;
                        break;
                      }
                    }
                  }
                  if (!displayProgressTitle) {
                    displayProgressTitle = record.episodeId ? `Ep. 1` : `${item.duration}`;
                  }

                  return (
                    <div 
                      key={`${item.id}-${record.episodeId || ''}`}
                      onClick={() => {
                        setPlayingMedia(item);
                        if (record.episodeId) {
                          setPlayingEpisode(foundEpisode || item.seasons?.[0]?.episodes?.[0]);
                        }
                      }}
                      className="group cursor-pointer bg-neutral-900 rounded-xl overflow-hidden border border-neutral-800 hover:border-neutral-700 transition-all text-left shadow-lg"
                    >
                      <div className="relative aspect-[16/10] overflow-hidden">
                        {(() => {
                          let displayImg = item.coverUrl;
                          if (foundEpisode) {
                            if (foundEpisode.thumbnailUrl && !foundEpisode.thumbnailUrl.includes('photo-1536440136628-849c177e76a1')) {
                              displayImg = foundEpisode.thumbnailUrl;
                            } else {
                              displayImg = item.bannerUrl || item.coverUrl;
                            }
                          }
                          return (
                            <img 
                              src={displayImg} 
                              alt={item.title} 
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              referrerPolicy="no-referrer"
                            />
                          );
                        })()}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Play className="w-8 h-8 fill-white text-white" />
                        </div>
                      </div>

                      {/* Progress bar overlay */}
                      <div className="w-full bg-neutral-800 h-1">
                        <div className="h-full" style={{ width: `${progressPercentage}%`, backgroundColor: config.primaryColor }} />
                      </div>

                      <div className="p-3">
                        <h4 className="font-bold text-xs text-neutral-100 truncate line-clamp-1 group-hover:text-white">{item.title}</h4>
                        <div className="flex justify-between items-center mt-1 text-[10px] text-neutral-400">
                          <span>{displayProgressTitle}</span>
                          <span className="font-mono text-neutral-500">{progressPercentage}% assistido</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeCategory === 'Todos' ? (
            <>
              {/* Recently Added Slider */}
              <MediaSlider 
                title="Adicionados Recentemente" 
                items={filteredMedia.slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())} 
                favorites={userAccount.favorites}
                onCardClick={(item) => setSelectedMediaDetails(item)}
                onPlayClick={(item) => {
                  if (item.category === 'Séries' && item.seasons && item.seasons.length > 0) {
                    setPlayingMedia(item);
                    setPlayingEpisode(item.seasons[0].episodes[0]);
                  } else {
                    setPlayingMedia(item);
                  }
                }}
                primaryColor={config.primaryColor}
              />

              {/* Favorites List Slider (Only if there are saved favorites) */}
              {favoriteItems.length > 0 && (
                <MediaSlider 
                  title="Meus Favoritos ❤️" 
                  items={favoriteItems} 
                  favorites={userAccount.favorites}
                  onCardClick={(item) => setSelectedMediaDetails(item)}
                  onPlayClick={(item) => {
                    if (item.category === 'Séries' && item.seasons && item.seasons.length > 0) {
                      setPlayingMedia(item);
                      setPlayingEpisode(item.seasons[0].episodes[0]);
                    } else {
                      setPlayingMedia(item);
                    }
                  }}
                  primaryColor={config.primaryColor}
                />
              )}

              {/* Most Watched Slider */}
              <MediaSlider 
                title="Mais Assistidos" 
                items={filteredMedia.slice().sort((a, b) => (b.views || 0) - (a.views || 0))} 
                favorites={userAccount.favorites}
                onCardClick={(item) => setSelectedMediaDetails(item)}
                onPlayClick={(item) => {
                  if (item.category === 'Séries' && item.seasons && item.seasons.length > 0) {
                    setPlayingMedia(item);
                    setPlayingEpisode(item.seasons[0].episodes[0]);
                  } else {
                    setPlayingMedia(item);
                  }
                }}
                primaryColor={config.primaryColor}
              />

              {/* Family videos rows */}
              <MediaSlider 
                title="Vídeos de Família 🎥" 
                items={mediaItems.filter(m => m.category === 'Vídeos da família')} 
                favorites={userAccount.favorites}
                onCardClick={(item) => setSelectedMediaDetails(item)}
                onPlayClick={(item) => setPlayingMedia(item)}
                primaryColor={config.primaryColor}
              />

              {/* Series row */}
              <MediaSlider 
                title="Séries em Destaque 🍿" 
                items={mediaItems.filter(m => m.category === 'Séries')} 
                favorites={userAccount.favorites}
                onCardClick={(item) => setSelectedMediaDetails(item)}
                onPlayClick={(item) => {
                  if (item.seasons && item.seasons.length > 0) {
                    setPlayingMedia(item);
                    setPlayingEpisode(item.seasons[0].episodes[0]);
                  }
                }}
                primaryColor={config.primaryColor}
              />
            </>
          ) : (
            /* CATEGORY SPECIFIC GRID VIEW */
            <div className="px-6 md:px-16 space-y-6 text-left">
              <div className="flex justify-between items-center border-b border-white/10 pb-2.5">
                <h3 className="text-xl md:text-2xl font-black tracking-tight uppercase text-white">
                  {activeCategory}
                </h3>
                <span className="text-xs text-neutral-400 font-bold bg-neutral-900 border border-neutral-850 px-3 py-1 rounded-full">
                  {filteredMedia.length} {filteredMedia.length === 1 ? 'título' : 'títulos'}
                </span>
              </div>

              {filteredMedia.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                  {filteredMedia.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => setSelectedMediaDetails(item)}
                      className="relative group cursor-pointer bg-neutral-900/60 rounded-xl overflow-hidden border border-neutral-800/80 hover:border-neutral-700/80 hover:bg-neutral-900 transition-all shadow-lg hover:scale-[1.03]"
                    >
                      <div className="relative aspect-[16/10] overflow-hidden">
                        <img src={item.coverUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" referrerPolicy="no-referrer" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <Play className="w-8 h-8 fill-white text-white" />
                        </div>
                        <span className="absolute top-2 left-2 bg-black/70 text-[9px] font-extrabold px-1.5 py-0.5 rounded text-amber-500 border border-neutral-800/80">
                          {item.quality}
                        </span>
                      </div>
                      <div className="p-3 text-left">
                        <h4 className="font-bold text-xs text-white line-clamp-1 group-hover:text-red-500 transition-colors">{item.title}</h4>
                        <p className="text-[10px] text-neutral-400 font-medium mt-1">{item.year} • {item.category}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-20 space-y-2">
                  <Film className="w-12 h-12 text-neutral-700 mx-auto" />
                  <p className="text-neutral-400 font-bold">Nenhum título encontrado em "{activeCategory}".</p>
                  <p className="text-xs text-neutral-500">Adicione novos títulos a esta categoria pelo painel administrativo.</p>
                </div>
              )}
            </div>
          )}

        </div>
      )}

      {/* 4. MEDIAS DETAILS POP-UP MODAL */}
      {selectedMediaDetails && (
        <MediaModal 
          media={selectedMediaDetails} 
          userAccount={userAccount} 
          onClose={() => setSelectedMediaDetails(null)} 
          onPlay={(media, episode) => {
            setPlayingMedia(media);
            setPlayingEpisode(episode);
            setSelectedMediaDetails(null); // Close details pop-up when starting the player
          }}
          onToggleFavorite={handleToggleFavorite}
          onEdit={(media) => {
            setAdminPanelInitialMedia(media);
            setShowAdminPanel(true);
            setSelectedMediaDetails(null);
          }}
          primaryColor={config.primaryColor}
        />
      )}

      {/* 5. CINEMATIC VIDEO PLAYER OVERLAY */}
      {playingMedia && (
        <VideoPlayer 
          media={playingMedia}
          episode={playingEpisode}
          nextEpisode={
            playingEpisode && playingMedia.seasons?.[0]?.episodes
              ? playingMedia.seasons[0].episodes.find(e => e.episodeNumber === playingEpisode.episodeNumber + 1)
              : undefined
          }
          initialTime={
            userAccount.history.find(
              h => h.mediaId === playingMedia.id && (!playingEpisode || h.episodeId === playingEpisode.id)
            )?.currentTime || 0
          }
          onTimeUpdate={handlePlaybackTimeUpdate}
          onEpisodeCompleted={handleEpisodeCompleted}
          onNextEpisodeTrigger={handleNextEpisodeTrigger}
          onClose={async () => {
            if (latestUserAccountRef.current) {
              await dbService.saveUserAccount(latestUserAccountRef.current, false); // force remote save of latest progress state
            }
            lastSavedTimeRef.current = 0;
            setPlayingMedia(null);
            setPlayingEpisode(undefined);
          }}
          primaryColor={config.primaryColor}
        />
      )}

      {/* 6. ADMINISTRATIVE PANEL PANEL OVERLAY */}
      {showAdminPanel && (
        <AdminPanel 
          config={config}
          onConfigChange={(cfg) => setConfig(cfg)}
          mediaItems={mediaItems}
          onMediaItemsChange={(items) => setMediaItems(items)}
          userAccount={userAccount}
          onClose={() => {
            setShowAdminPanel(false);
            setAdminPanelInitialMedia(null);
          }}
          initialMediaToEdit={adminPanelInitialMedia}
        />
      )}

      {/* 7. CONFIGURATIONS PANEL MODAL OVERLAY */}
      {showConfigPanel && (
        <ConfigPanel 
          config={config} 
          onConfigChange={(cfg) => setConfig(cfg)} 
          mediaItems={mediaItems}
          onMediaItemsChange={(items) => setMediaItems(items)}
          onClose={() => setShowConfigPanel(false)} 
        />
      )}

      {/* 8. PWA INSTALLATION INSTRUCTION MODAL */}
      {showPwaModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-45 flex items-center justify-center p-4 text-white font-sans">
          <div className="absolute inset-0 cursor-default" onClick={() => setShowPwaModal(false)} />
          
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl relative z-50 animate-scaleIn text-left space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-neutral-800">
              <span className="text-xs text-neutral-400 font-bold uppercase tracking-wider">Instalação de Aplicativo</span>
              <button onClick={() => setShowPwaModal(false)} className="text-neutral-500 hover:text-white">✕</button>
            </div>

            <div className="text-center space-y-2 py-2">
              <Laptop className="w-12 h-12 text-amber-500 mx-auto" />
              <h3 className="font-extrabold text-lg">Instalar {config.platformName}</h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Leve o FamilyStream no seu smartphone, tablet ou computador. Desfrute de reprodução em tela cheia fluida e inicialização rápida sem barra de endereço.
              </p>
            </div>

            <div className="space-y-2">
              <button
                onClick={handleSimulatePwaInstall}
                disabled={pwaInstallStatus === 'installing'}
                style={{ backgroundColor: config.primaryColor }}
                className="w-full py-2.5 rounded-lg font-bold text-xs hover:opacity-90 active:scale-95 transition-all text-white flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {pwaInstallStatus === 'installing' ? (
                  <>Instalando no Sistema...</>
                ) : (
                  <>Confirmar Instalação</>
                )}
              </button>
              
              <button
                onClick={() => setShowPwaModal(false)}
                className="w-full py-2.5 bg-neutral-950 border border-neutral-800 hover:border-neutral-700 rounded-lg text-neutral-400 hover:text-white font-bold text-xs transition-colors cursor-pointer"
              >
                Talvez mais tarde
              </button>
            </div>

            <div className="text-[10px] text-neutral-500 text-center leading-relaxed">
              *Compatível com Google Chrome, Apple Safari, Microsoft Edge, Opera e Android WebViews.
            </div>
          </div>
        </div>
      )}

      {/* 9. BOTTOM CINEMATIC PLATFORM CREDIT FOOTER */}
      <footer className="py-12 border-t border-white/5 mt-20 text-center text-xs text-neutral-500 select-none space-y-2 relative">
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-orange-500/50 to-transparent" />
        <div className="flex justify-center items-center gap-1.5 text-neutral-400 font-semibold uppercase tracking-wider text-[10px]">
          <Film className="w-3.5 h-3.5" />
          <span>{config.platformName} Platform</span>
        </div>
        <p className="font-light">Destinado exclusivamente ao gerenciamento e compartilhamento de memórias autorizadas.</p>
        <p className="text-[10px] text-neutral-600 font-mono">Suporte nativo HLS.js • Firebase Cloud Sync</p>
      </footer>
    </div>
  );
}
