import { useEffect, useRef, useState, ChangeEvent } from 'react';
import Hls from 'hls.js';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  RotateCw, 
  Volume2, 
  VolumeX, 
  Maximize, 
  Minimize, 
  Settings, 
  ChevronLeft, 
  HelpCircle, 
  SkipForward, 
  Subtitles, 
  Sparkles,
  AlertTriangle 
} from 'lucide-react';
import { MediaItem, Episode, Season } from '../types';
import { videoStorage } from '../lib/videoStorage';

interface VideoPlayerProps {
  media: MediaItem;
  episode?: Episode;
  nextEpisode?: Episode;
  initialTime?: number;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onEpisodeCompleted?: (episodeId?: string) => void;
  onNextEpisodeTrigger?: (episode: Episode) => void;
  onClose: () => void;
  primaryColor: string;
}

export default function VideoPlayer({ 
  media, 
  episode, 
  nextEpisode, 
  initialTime = 0, 
  onTimeUpdate, 
  onEpisodeCompleted, 
  onNextEpisodeTrigger,
  onClose,
  primaryColor 
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1); // 0 to 1
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [quality, setQuality] = useState<'AUTO' | '4K' | '1080p' | '720p' | 'SD'>('AUTO');
  const [audioTrack, setAudioTrack] = useState('Principal');
  const [showControls, setShowControls] = useState(true);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  
  // Simulated subtitles state
  const [showSubtitles, setShowSubtitles] = useState(false);
  const [currentSubtitleText, setCurrentSubtitleText] = useState('');

  // Auto-next countdown state
  const [countdown, setCountdown] = useState<number | null>(null);
  const countdownIntervalRef = useRef<any>(null);

  const [resolvedVideoUrl, setResolvedVideoUrl] = useState('');
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [isBuffering, setIsBuffering] = useState(false);

  const initialTimeRef = useRef(initialTime);
  const hasSeekedRef = useRef(false);
  const lastProgressSaveRef = useRef<number>(-1);
  const bufferingTimeoutRef = useRef<any>(null);

  const startBufferingTimer = () => {
    if (bufferingTimeoutRef.current) {
      clearTimeout(bufferingTimeoutRef.current);
    }
    // Set a slight delay (600ms) before showing the buffering overlay
    // to avoid flashing the loader on micro-stalls, seek buffers or normal state updates
    bufferingTimeoutRef.current = setTimeout(() => {
      setIsBuffering(true);
    }, 600);
  };

  const clearBufferingTimer = () => {
    if (bufferingTimeoutRef.current) {
      clearTimeout(bufferingTimeoutRef.current);
      bufferingTimeoutRef.current = null;
    }
    setIsBuffering(false);
  };

  // Clean up any pending timer on unmount
  useEffect(() => {
    return () => {
      if (bufferingTimeoutRef.current) {
        clearTimeout(bufferingTimeoutRef.current);
      }
    };
  }, []);

  // Sync prop changes to the ref without re-triggering playback loading
  useEffect(() => {
    initialTimeRef.current = initialTime;
  }, [initialTime]);

  // Reset seek state when url changes
  useEffect(() => {
    hasSeekedRef.current = false;
    lastProgressSaveRef.current = -1;
  }, [resolvedVideoUrl]);

  const handleVideoError = () => {
    // If HLS.js is handling the video stream, ignore standard HTML5 video errors to let HLS recover.
    if (hlsRef.current) {
      console.warn("HTML5 video element reported an error, but HLS.js is handling the stream. Ignoring standard error handler to allow HLS recovery.");
      return;
    }

    const error = videoRef.current?.error;
    console.error("Video element error details - Code:", error?.code, "Message:", error?.message);
    
    let errMsgText = error?.message || '';
    let msg = "Não foi possível reproduzir este vídeo.";
    
    if (error) {
      if (error.code === 1) {
        msg = "A reprodução do vídeo foi cancelada.";
      } else if (error.code === 2) {
        msg = "Ocorreu um erro de conexão de rede ao tentar carregar o vídeo. Verifique sua internet.";
      } else if (error.code === 3 || errMsgText.toLowerCase().includes('decode')) {
        msg = `Falha na decodificação do vídeo. O arquivo de vídeo pode estar corrompido, incompleto ou o codec não é suportado pelo seu navegador. Detalhes: ${error.message || 'Erro de decodificação interna'}`;
      } else if (error.code === 4 || errMsgText.toLowerCase().includes('format') || errMsgText.toLowerCase().includes('media_element_error') || errMsgText.toLowerCase().includes('not supported') || errMsgText.toLowerCase().includes('codec')) {
        msg = `O formato ou os codecs deste arquivo de vídeo não são compatíveis com a reprodução web direta no seu navegador (ex: codec HEVC/H.265, formato MKV ou AVI). Recomendamos usar arquivos MP4 codificados com o codec de vídeo H.264 (AVC) e áudio AAC, que possuem compatibilidade universal. Detalhes: ${error.message || 'MEDIA_ELEMENT_ERROR: Format error'}`;
      } else {
        msg = `Erro de elemento de mídia no player. Detalhes: ${error.message || 'Formato de vídeo incompatível com o navegador web'}`;
      }
    } else if (errMsgText.toLowerCase().includes('format') || errMsgText.toLowerCase().includes('media_element_error')) {
      msg = `Incompatibilidade de formato detectada pelo player. O arquivo de vídeo possui codecs ou formato incompatível para reprodução web direta. Recomendamos converter para MP4 (H.264 + AAC) usando uma ferramenta gratuita como o Handbrake. Detalhes: ${errMsgText}`;
    } else {
      msg = "O navegador não pôde decodificar ou reproduzir este arquivo de vídeo local. Verifique se o formato e codecs são compatíveis (recomenda-se MP4 codificado com H.264 para vídeo e AAC para áudio).";
    }
    setPlaybackError(msg);
  };

  const activeTitle = episode ? `${media.title} - T${media.seasons?.[0]?.number || 1}:E${episode.episodeNumber} - ${episode.title}` : media.title;

  // Resolve Playable Video URL (either from IndexedDB upload or external link)
  useEffect(() => {
    let active = true;
    const fetchUrl = async () => {
      const id = episode ? episode.id : media.id;
      const fallbackUrl = episode ? episode.videoUrl : media.videoUrl;

      // Guard check: if fallbackUrl is literally "uploaded_local" but we don't have it in indexedDB, fail fast
      if (fallbackUrl === 'uploaded_local') {
        const has = await videoStorage.hasVideo(id);
        if (!has) {
          if (active) {
            setResolvedVideoUrl('');
            setPlaybackError("Este vídeo foi cadastrado como 'Arquivo de Vídeo Local', mas o arquivo não foi encontrado no banco de dados IndexedDB deste navegador. Por favor, acesse o Painel de Administração para fazer o upload do vídeo novamente.");
          }
          return;
        }
      }

      const playable = await videoStorage.getPlayableUrl(id, fallbackUrl);

      if (active) {
        if (playable === 'uploaded_local') {
          setResolvedVideoUrl('');
          setPlaybackError("O vídeo foi cadastrado localmente, mas não pôde ser carregado do banco de dados IndexedDB. Acesse o Painel de Administração e salve o vídeo novamente para corrigir.");
        } else {
          setResolvedVideoUrl(playable);
          setPlaybackError(null);
        }
      }
    };
    fetchUrl();
    return () => {
      active = false;
    };
  }, [media.id, episode?.id, episode?.videoUrl, media.videoUrl]);

  // Initialize Video
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (!resolvedVideoUrl) {
      video.removeAttribute('src');
      video.load();
      return;
    }

    setIsPlaying(false);
    setIsBuffering(true); // Start with loading/buffering state
    setCountdown(null);

    // Clean up previous HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (resolvedVideoUrl.includes('.m3u8')) {
      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: false, // VOD streams do not need low-latency, disabling prevents aggressive stalling
          backBufferLength: 90,
          maxBufferLength: 30, // standard 30-second buffering target
          maxMaxBufferLength: 60, // allow up to 60 seconds buffer
          maxBufferSize: 60 * 1024 * 1024, // 60MB max buffer
          maxBufferHole: 0.5, // seamlessly jump over small buffer gaps
          nudgeMaxRetry: 5 // nudge play head if playback stalls
        });
        hls.loadSource(resolvedVideoUrl);
        hls.attachMedia(video);
        hlsRef.current = hls;

        let mediaErrorCount = 0;
        hls.on(Hls.Events.ERROR, (event, data) => {
          console.warn('HLS error event:', data);
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                console.warn('Fatal HLS network error. Attempting to recover...');
                hls.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                mediaErrorCount++;
                if (mediaErrorCount <= 3) {
                  console.warn(`Fatal HLS media error (decoding issue). Attempting recovery ${mediaErrorCount}...`);
                  hls.recoverMediaError();
                } else {
                  console.error('Fatal HLS media error limit reached. Displaying error overlay.');
                  setPlaybackError('O formato ou codec deste arquivo de vídeo não pôde ser decodificado pelo navegador.');
                  clearBufferingTimer();
                  hls.destroy();
                  hlsRef.current = null;
                }
                break;
              default:
                console.error('Fatal unrecoverable HLS error:', data.details);
                setPlaybackError(`Falha de reprodução do stream de vídeo (${data.details || 'erro de formato/rede'}).`);
                clearBufferingTimer();
                hls.destroy();
                hlsRef.current = null;
                break;
            }
          }
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = resolvedVideoUrl;
      }
    } else {
      video.src = resolvedVideoUrl;
    }

    // Set initial time once loaded metadata
    const handleLoadedMetadata = () => {
      setDuration(video.duration || 0);
      clearBufferingTimer(); // Stop buffering once metadata is ready
      if (!hasSeekedRef.current) {
        if (initialTimeRef.current > 0 && initialTimeRef.current < (video.duration || 0) - 5) {
          video.currentTime = initialTimeRef.current;
        }
        hasSeekedRef.current = true;
      }
      video.play().then(() => setIsPlaying(true)).catch(() => {});
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      clearBufferingTimer();
    };
  }, [resolvedVideoUrl]);

  // Handle Controls Visibility Auto-Hide
  useEffect(() => {
    let timeoutId: any;
    
    const hideControls = () => {
      if (isPlaying) {
        setShowControls(false);
        setShowSettingsMenu(false);
      }
    };

    const resetTimer = () => {
      setShowControls(true);
      clearTimeout(timeoutId);
      if (isPlaying) {
        timeoutId = setTimeout(hideControls, 2500); // Auto hide after 2.5s of inactivity
      }
    };

    // If video starts playing, ensure controls are visible first, then set timeout to hide them
    if (isPlaying) {
      setShowControls(true);
      timeoutId = setTimeout(hideControls, 2500);
    } else {
      setShowControls(true);
    }

    // Capture standard mouse, pointer, touch, and click interactions to show/reset
    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('pointermove', resetTimer);
    window.addEventListener('touchstart', resetTimer, { passive: true });
    window.addEventListener('click', resetTimer);

    return () => {
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('pointermove', resetTimer);
      window.removeEventListener('touchstart', resetTimer);
      window.removeEventListener('click', resetTimer);
      clearTimeout(timeoutId);
    };
  }, [isPlaying]);

  // Sync Video properties
  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
    } else {
      video.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;

    const curTime = video.currentTime;
    setCurrentTime(curTime);

    // Only notify parent once per second to prevent overloading the React rendering/state queue
    const roundedTime = Math.floor(curTime);
    if (roundedTime !== lastProgressSaveRef.current) {
      lastProgressSaveRef.current = roundedTime;
      if (onTimeUpdate) {
        onTimeUpdate(curTime, video.duration || 0);
      }
    }

    // Simulate subtitles based on current timestamp
    if (showSubtitles) {
      updateSimulatedSubtitles(curTime);
    }

    // Check if close to end for auto next countdown
    if (nextEpisode && video.duration && (video.duration - curTime) <= 10 && countdown === null) {
      startNextEpisodeCountdown();
    }
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture shortcuts if typing in any input field
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        return;
      }

      const video = videoRef.current;
      if (!video) return;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowRight':
          e.preventDefault();
          video.currentTime = Math.min(video.currentTime + 10, video.duration || 0);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          video.currentTime = Math.max(video.currentTime - 10, 0);
          break;
        case 'ArrowUp':
          e.preventDefault();
          const newVolUp = Math.min(volume + 0.05, 1);
          setVolume(newVolUp);
          video.volume = newVolUp;
          setIsMuted(false);
          break;
        case 'ArrowDown':
          e.preventDefault();
          const newVolDown = Math.max(volume - 0.05, 0);
          setVolume(newVolDown);
          video.volume = newVolDown;
          if (newVolDown === 0) setIsMuted(true);
          break;
        case 'KeyM':
          e.preventDefault();
          toggleMute();
          break;
        case 'KeyF':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'Escape':
          if (isFullscreen) {
            toggleFullscreen();
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isPlaying, volume, isMuted, isFullscreen, countdown, nextEpisode]);

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleVolumeChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    const video = videoRef.current;
    if (!video) return;
    video.volume = val;
    setVolume(val);
    setIsMuted(val === 0);
  };

  const toggleFullscreen = () => {
    const container = containerRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      container.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const handleSeekChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = val;
    setCurrentTime(val);
  };

  const handleSpeedChange = (speed: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = speed;
    setPlaybackSpeed(speed);
  };

  const skipForward = () => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.min(video.currentTime + 10, video.duration || 0);
  };

  const skipBackward = () => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(video.currentTime - 10, 0);
  };

  // Simulated subtitles data depending on video duration percentage
  const updateSimulatedSubtitles = (time: number) => {
    if (!duration) return;
    const progress = (time / duration) * 100;

    if (progress > 2 && progress < 8) {
      setCurrentSubtitleText('Nossa, que dia maravilhoso para registrarmos isso!');
    } else if (progress >= 12 && progress < 18) {
      setCurrentSubtitleText('Toda a família reunida compartilhando momentos especiais.');
    } else if (progress >= 24 && progress < 32) {
      setCurrentSubtitleText('Não se esqueça de salvar essa recordação na sua lista privada.');
    } else if (progress >= 40 && progress < 48) {
      setCurrentSubtitleText('O segredo de um bom streaming em família é a diversão!');
    } else if (progress >= 55 && progress < 62) {
      setCurrentSubtitleText('Essa é a nossa cena favorita de todas, repare na risada!');
    } else if (progress >= 70 && progress < 78) {
      setCurrentSubtitleText('FamilyStream proporciona os melhores momentos.');
    } else if (progress >= 85 && progress < 92) {
      setCurrentSubtitleText('Obrigado por assistir com a gente. Até o próximo episódio!');
    } else {
      setCurrentSubtitleText('');
    }
  };

  const startNextEpisodeCountdown = () => {
    if (!nextEpisode) return;
    let sec = 8;
    setCountdown(sec);

    countdownIntervalRef.current = setInterval(() => {
      sec -= 1;
      setCountdown(sec);
      if (sec <= 0) {
        clearInterval(countdownIntervalRef.current);
        triggerNextEpisode();
      }
    }, 1000);
  };

  const triggerNextEpisode = () => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
    }
    setCountdown(null);
    if (onNextEpisodeTrigger && nextEpisode) {
      onNextEpisodeTrigger(nextEpisode);
    }
  };

  const cancelCountdown = () => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
    }
    setCountdown(null);
  };

  const handleVideoEnded = () => {
    setIsPlaying(false);
    if (onEpisodeCompleted) {
      onEpisodeCompleted(episode?.id);
    }
    if (nextEpisode && countdown === null) {
      triggerNextEpisode();
    }
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs)) return '00:00';
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);

    const pad = (n: number) => n.toString().padStart(2, '0');
    if (h > 0) {
      return `${h}:${pad(m)}:${pad(s)}`;
    }
    return `${pad(m)}:${pad(s)}`;
  };

  return (
    <div 
      ref={containerRef}
      id="custom-video-player-container"
      className="fixed inset-0 bg-black z-50 flex flex-col items-center justify-center select-none text-white overflow-hidden"
    >
      {/* Actual Video Tag */}
      <video
        ref={videoRef}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleVideoEnded}
        onClick={togglePlay}
        onError={handleVideoError}
        onWaiting={startBufferingTimer}
        onPlaying={clearBufferingTimer}
        onSeeking={startBufferingTimer}
        onSeeked={clearBufferingTimer}
        onCanPlay={clearBufferingTimer}
        className="w-full h-full object-contain cursor-pointer"
        playsInline
      />

      {/* Buffering/Loading Spinner overlay */}
      {isBuffering && !playbackError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/45 backdrop-blur-[1px] pointer-events-none z-30 animate-fadeIn">
          <div className="relative flex items-center justify-center">
            {/* Outer animated rotating border */}
            <div className="w-14 h-14 border-4 border-t-amber-500 border-r-transparent border-b-amber-500 border-l-transparent rounded-full animate-spin"></div>
            {/* Inner pulsing circle */}
            <div className="absolute w-8 h-8 bg-amber-500/20 rounded-full animate-ping"></div>
          </div>
          <span className="mt-4 text-xs font-bold text-amber-500 uppercase tracking-widest font-mono animate-pulse">
            Carregando...
          </span>
        </div>
      )}

      {/* Playback Error Overlay */}
      {playbackError && (
        <div className="absolute inset-0 bg-neutral-950/95 flex flex-col items-center justify-center p-6 text-center z-40 animate-fadeIn">
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-full text-red-500 mb-4">
            <AlertTriangle className="w-12 h-12" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">Não foi possível reproduzir este vídeo</h3>
          <p className="text-sm text-neutral-400 max-w-md leading-relaxed mb-6 font-sans">
            {playbackError}
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => {
                setPlaybackError(null);
                if (videoRef.current) {
                  videoRef.current.load();
                  videoRef.current.play().catch(() => {});
                }
              }}
              style={{ backgroundColor: primaryColor }}
              className="px-5 py-2.5 text-neutral-950 rounded-xl font-bold text-xs cursor-pointer transition-colors hover:opacity-90 active:scale-95"
            >
              Tentar Carregar Novamente
            </button>
            <button
              onClick={onClose}
              className="px-5 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl font-bold text-xs cursor-pointer transition-colors active:scale-95"
            >
              Voltar para o Catálogo
            </button>
          </div>
        </div>
      )}

      {/* Subtitles Overlay */}
      {showSubtitles && currentSubtitleText && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 bg-black/70 px-4 py-2 rounded text-center text-sm md:text-lg max-w-xl border border-white/10 shadow-lg pointer-events-none animate-fadeIn">
          {currentSubtitleText}
        </div>
      )}

      {/* Top Bar Overlay */}
      <div className={`absolute top-0 inset-x-0 bg-gradient-to-b from-black/80 via-black/40 to-transparent p-4 flex justify-between items-center transition-all duration-300 ${showControls ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'}`}>
        <div className="flex items-center gap-3">
          <button 
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-full transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div>
            <h3 className="font-bold text-sm md:text-base line-clamp-1">{activeTitle}</h3>
            <p className="text-xs text-neutral-400 font-mono hidden md:block">Streaming {media.quality} • {audioTrack}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Shortcuts Help button */}
          <button
            onClick={() => setShowShortcutsHelp(!showShortcutsHelp)}
            className={`p-2 hover:bg-white/10 rounded-full transition-colors cursor-pointer ${showShortcutsHelp ? 'text-amber-400' : ''}`}
            title="Atalhos do Teclado"
          >
            <HelpCircle className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Shortcuts Modal Guide overlay */}
      {showShortcutsHelp && (
        <div className="absolute top-16 right-4 bg-neutral-900/95 border border-neutral-800 p-4 rounded-xl shadow-2xl text-xs space-y-2 max-w-xs z-55 animate-fadeIn">
          <div className="flex justify-between items-center border-b border-neutral-800 pb-2">
            <span className="font-bold text-neutral-300">Atalhos de Teclado</span>
            <button onClick={() => setShowShortcutsHelp(false)} className="text-neutral-500 hover:text-white">✕</button>
          </div>
          <div className="space-y-1.5 text-neutral-400">
            <p className="flex justify-between"><span>[Espaço]</span> <span className="text-white">Play / Pause</span></p>
            <p className="flex justify-between"><span>[Seta Direita]</span> <span className="text-white">Avançar 10s</span></p>
            <p className="flex justify-between"><span>[Seta Esquerda]</span> <span className="text-white">Voltar 10s</span></p>
            <p className="flex justify-between"><span>[Seta Cima]</span> <span className="text-white">Aumentar Vol</span></p>
            <p className="flex justify-between"><span>[Seta Baixo]</span> <span className="text-white">Diminuir Vol</span></p>
            <p className="flex justify-between"><span>[M]</span> <span className="text-white">Mutar áudio</span></p>
            <p className="flex justify-between"><span>[F]</span> <span className="text-white">Tela cheia</span></p>
          </div>
        </div>
      )}

      {/* NEXT EPISODE COUNTDOWN FLOATING CARD */}
      {countdown !== null && nextEpisode && (
        <div className="absolute right-6 bottom-24 bg-neutral-900/90 border border-neutral-800 p-4 rounded-xl shadow-2xl flex items-center gap-4 max-w-sm z-50 animate-slideUp">
          <img 
            src={nextEpisode.thumbnailUrl} 
            alt={nextEpisode.title} 
            className="w-20 h-12 object-cover rounded-md"
            referrerPolicy="no-referrer"
          />
          <div className="flex-1 text-left">
            <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest block mb-0.5">Próximo Episódio</span>
            <h4 className="text-xs font-bold line-clamp-1">{nextEpisode.title}</h4>
            <div className="flex items-center gap-3 mt-2">
              <button 
                onClick={triggerNextEpisode}
                className="py-1 px-3 bg-white text-black font-extrabold text-xs rounded hover:bg-neutral-200 transition-colors cursor-pointer"
              >
                Tocar agora ({countdown}s)
              </button>
              <button 
                onClick={cancelCountdown}
                className="text-xs text-neutral-400 hover:text-white hover:underline cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Menu Popup */}
      {showSettingsMenu && (
        <div className="absolute right-4 bottom-20 bg-neutral-900/95 border border-neutral-800 rounded-xl p-4 shadow-2xl text-xs space-y-4 w-60 z-50 animate-fadeIn">
          {/* Quality Select */}
          <div>
            <span className="font-bold text-neutral-400 block mb-1.5 uppercase tracking-wider">Qualidade</span>
            <div className="flex flex-wrap gap-1.5">
              {['AUTO', '4K', '1080p', '720p', 'SD'].map((q) => (
                <button
                  key={q}
                  onClick={() => setQuality(q as any)}
                  className={`py-1 px-2.5 rounded font-bold transition-all ${quality === q ? 'bg-neutral-100 text-neutral-950 scale-105' : 'bg-neutral-950 hover:bg-neutral-800 text-neutral-400'}`}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Playback Speed */}
          <div>
            <span className="font-bold text-neutral-400 block mb-1.5 uppercase tracking-wider">Velocidade</span>
            <div className="flex flex-wrap gap-1.5">
              {[0.5, 1, 1.25, 1.5, 2].map((sp) => (
                <button
                  key={sp}
                  onClick={() => handleSpeedChange(sp)}
                  className={`py-1 px-2.5 rounded font-bold transition-all ${playbackSpeed === sp ? 'bg-neutral-100 text-neutral-950 scale-105' : 'bg-neutral-950 hover:bg-neutral-800 text-neutral-400'}`}
                >
                  {sp}x
                </button>
              ))}
            </div>
          </div>

          {/* Audio Tracks */}
          <div>
            <span className="font-bold text-neutral-400 block mb-1.5 uppercase tracking-wider">Áudio</span>
            <div className="flex gap-1.5">
              {['Principal', 'Direto (Dolby)'].map((track) => (
                <button
                  key={track}
                  onClick={() => setAudioTrack(track)}
                  className={`flex-1 py-1 px-2 rounded font-semibold text-center transition-all ${audioTrack === track ? 'bg-neutral-100 text-neutral-950' : 'bg-neutral-950 text-neutral-400'}`}
                >
                  {track}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Bottom Controls HUD Overlay */}
      <div className={`absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-4 flex flex-col gap-3 transition-all duration-300 ${showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
        
        {/* Timeline bar */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-neutral-300">{formatTime(currentTime)}</span>
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={currentTime}
            onChange={handleSeekChange}
            className="flex-1 accent-white bg-neutral-700 h-1 rounded-lg cursor-pointer hover:h-1.5 transition-all outline-none"
            style={{
              background: `linear-gradient(to right, ${primaryColor} 0%, ${primaryColor} ${(currentTime / (duration || 1)) * 100}%, #404040 ${(currentTime / (duration || 1)) * 100}%, #404040 100%)`
            }}
          />
          <span className="text-xs font-mono text-neutral-300">{formatTime(duration)}</span>
        </div>

        {/* Buttons Row */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            {/* Play/Pause */}
            <button 
              onClick={togglePlay}
              className="p-2 hover:bg-white/10 rounded-full transition-all cursor-pointer hover:scale-105 active:scale-95"
            >
              {isPlaying ? <Pause className="w-6 h-6 text-white fill-white" /> : <Play className="w-6 h-6 text-white fill-white" />}
            </button>

            {/* Skip 10s Back */}
            <button 
              onClick={skipBackward}
              className="p-2 hover:bg-white/10 rounded-full transition-all cursor-pointer"
              title="Voltar 10 segundos"
            >
              <RotateCcw className="w-5 h-5 text-neutral-300" />
            </button>

            {/* Skip 10s Forward */}
            <button 
              onClick={skipForward}
              className="p-2 hover:bg-white/10 rounded-full transition-all cursor-pointer"
              title="Avançar 10 segundos"
            >
              <RotateCw className="w-5 h-5 text-neutral-300" />
            </button>

            {/* Volume controls */}
            <div className="flex items-center gap-2 group/vol">
              <button onClick={toggleMute} className="p-2 hover:bg-white/10 rounded-full cursor-pointer">
                {isMuted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-0 group-hover/vol:w-16 h-1 bg-neutral-600 rounded-full cursor-pointer transition-all duration-300 accent-white opacity-0 group-hover/vol:opacity-100"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Simulated subtitles toggler */}
            <button
              onClick={() => setShowSubtitles(!showSubtitles)}
              className={`p-2 hover:bg-white/10 rounded-full transition-colors cursor-pointer ${showSubtitles ? 'text-amber-400' : 'text-neutral-400'}`}
              title="Alternar Legendas"
            >
              <Subtitles className="w-5 h-5" />
            </button>

            {/* Simulated settings cog */}
            <button
              onClick={() => setShowSettingsMenu(!showSettingsMenu)}
              className={`p-2 hover:bg-white/10 rounded-full transition-colors cursor-pointer ${showSettingsMenu ? 'text-white bg-white/10' : 'text-neutral-400'}`}
              title="Configurações de Áudio e Vídeo"
            >
              <Settings className="w-5 h-5" />
            </button>

            {/* Fullscreen toggler */}
            <button 
              onClick={toggleFullscreen}
              className="p-2 hover:bg-white/10 rounded-full transition-colors cursor-pointer"
              title="Tela Cheia"
            >
              {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
