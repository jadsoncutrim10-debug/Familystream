import { useState } from 'react';
import { 
  X, 
  Play, 
  Plus, 
  Check, 
  Heart, 
  Film, 
  Calendar, 
  Clock, 
  Award, 
  ChevronRight, 
  BookOpen, 
  User, 
  Tv,
  Edit
} from 'lucide-react';
import { MediaItem, Episode, Season, UserAccount, PlaybackHistory } from '../types';

interface MediaModalProps {
  media: MediaItem;
  userAccount: UserAccount;
  onClose: () => void;
  onPlay: (media: MediaItem, episode?: Episode) => void;
  onToggleFavorite: (mediaId: string) => void;
  onEdit?: (media: MediaItem) => void;
  primaryColor: string;
}

export default function MediaModal({ 
  media, 
  userAccount, 
  onClose, 
  onPlay, 
  onToggleFavorite, 
  onEdit,
  primaryColor 
}: MediaModalProps) {
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>(
    media.seasons && media.seasons.length > 0 ? media.seasons[0].id : ''
  );

  const isFav = userAccount.favorites.includes(media.id);
  const isSeries = media.category === 'Séries' && media.seasons && media.seasons.length > 0;
  
  // Find currently active season based on state
  const activeSeason = media.seasons?.find(s => s.id === selectedSeasonId);

  // Helper to find watching progress for movie or specific episodes
  const getProgressForMedia = (mediaId: string, episodeId?: string) => {
    const record = userAccount.history.find(
      h => h.mediaId === mediaId && (!episodeId || h.episodeId === episodeId)
    );
    if (!record || record.duration === 0) return 0;
    return Math.floor((record.currentTime / record.duration) * 100);
  };

  const getResumeTimeForMedia = (mediaId: string, episodeId?: string) => {
    const record = userAccount.history.find(
      h => h.mediaId === mediaId && (!episodeId || h.episodeId === episodeId)
    );
    return record ? record.currentTime : 0;
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-40 flex items-center justify-center p-4 md:p-6 text-white font-sans overflow-y-auto selection:bg-orange-600">
      
      {/* Outer Click Closer */}
      <div className="absolute inset-0 cursor-default" onClick={onClose} />

      {/* Main Container Card */}
      <div 
        id="media-details-modal" 
        className="relative bg-[#050505] border border-white/10 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden z-50 flex flex-col my-8 animate-scaleIn max-h-[90vh] overflow-y-auto"
      >
        
        {/* Banner with Close button */}
        <div className="relative aspect-[21/9] md:aspect-[2.4] w-full shrink-0">
          <img 
            src={media.bannerUrl} 
            alt={media.title} 
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/40 to-transparent" />
          
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-2 bg-black/60 hover:bg-black/80 rounded-full border border-white/10 transition-colors cursor-pointer"
            title="Fechar Detalhes"
          >
            <X className="w-5 h-5 text-neutral-300" />
          </button>

          {/* Core Banner Actions */}
          <div className="absolute bottom-4 left-6 md:left-12 flex items-center gap-4">
            {!isSeries && (
              <button
                onClick={() => onPlay(media)}
                style={{ backgroundColor: primaryColor }}
                className="flex items-center gap-2 px-6 py-2.5 rounded-lg font-extrabold text-sm hover:opacity-90 active:scale-95 transition-all shadow-lg cursor-pointer text-white"
              >
                <Play className="w-4 h-4 fill-white" />
                {getProgressForMedia(media.id) > 0 ? 'Continuar Assistindo' : 'Assistir Agora'}
              </button>
            )}

            <button
              onClick={() => onToggleFavorite(media.id)}
              className="p-2.5 bg-neutral-950/60 backdrop-blur-md border border-neutral-700/60 rounded-lg hover:bg-neutral-800 hover:text-red-500 transition-all cursor-pointer flex items-center gap-1.5"
              title={isFav ? "Remover dos Favoritos" : "Adicionar aos Favoritos"}
            >
              <Heart className={`w-5 h-5 ${isFav ? 'text-red-500 fill-red-500' : 'text-neutral-300'}`} />
              <span className="text-xs font-semibold hidden sm:inline">{isFav ? 'Remover Favorito' : 'Adicionar Favorito'}</span>
            </button>

            {userAccount.role === 'admin' && (
              <button
                onClick={() => onEdit?.(media)}
                className="p-2.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-lg hover:bg-amber-500 hover:text-neutral-950 transition-all cursor-pointer flex items-center gap-1.5"
                title="Editar Cadastro do Vídeo/Série"
              >
                <Edit className="w-5 h-5 shrink-0" />
                <span className="text-xs font-bold hidden sm:inline">Editar Cadastro</span>
              </button>
            )}
          </div>
        </div>

        {/* Info Grid Content */}
        <div className="p-6 md:p-10 space-y-8 text-left overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
            
            {/* Left 2 Cols: Title, Description, Tags */}
            <div className="md:col-span-2 space-y-4">
              <div className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-500 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">{media.category}</span>
                <h2 className="text-2xl md:text-3xl font-black tracking-tight text-white uppercase">{media.title}</h2>
              </div>

              {/* Progress bar for Movie */}
              {!isSeries && getProgressForMedia(media.id) > 0 && (
                <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800 flex flex-col gap-1.5">
                  <span className="text-xs text-neutral-400 font-semibold flex justify-between">
                    <span>Você parou em {Math.floor(getResumeTimeForMedia(media.id) / 60)}m</span>
                    <span className="font-mono">{getProgressForMedia(media.id)}% assistido</span>
                  </span>
                  <div className="w-full bg-neutral-800 h-1.5 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${getProgressForMedia(media.id)}%`, backgroundColor: primaryColor }} />
                  </div>
                </div>
              )}

              <p className="text-sm md:text-base text-neutral-300 leading-relaxed font-light">
                {media.description}
              </p>

              {/* Tags block */}
              <div className="flex flex-wrap gap-2 pt-1">
                {media.tags.map((tag) => (
                  <span 
                    key={tag} 
                    className="text-xs font-medium text-neutral-400 px-2.5 py-1 bg-neutral-950 border border-neutral-800 rounded-full"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Right Col: Creators, Cast, Quality Specs */}
            <div className="bg-black/30 border border-white/5 p-5 rounded-xl space-y-3.5 text-xs">
              <div className="flex items-center gap-2 pb-2 border-b border-white/5">
                <Film className="w-4 h-4 text-neutral-400" />
                <span className="font-bold text-neutral-300 uppercase tracking-wider">Ficha Técnica</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-neutral-500 font-medium">Ano de Lançamento</span>
                <span className="font-bold text-neutral-200">{media.year}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-neutral-500 font-medium">Duração</span>
                <span className="font-bold text-neutral-200">{media.duration}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-neutral-500 font-medium">Classificação</span>
                <span className={`font-bold px-1.5 py-0.2 rounded border text-[10px] ${media.rating === 'Livre' ? 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5' : 'text-red-400 border-red-500/20 bg-red-500/5'}`}>{media.rating}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-neutral-500 font-medium">Idioma de Áudio</span>
                <span className="font-bold text-neutral-200">{media.language}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-neutral-500 font-medium">Resolução Máxima</span>
                <span className="font-extrabold text-amber-500 uppercase">{media.quality}</span>
              </div>

              {media.director && (
                <div className="flex justify-between items-start gap-4 pt-1.5 border-t border-white/5">
                  <span className="text-neutral-500 font-medium shrink-0">Direção</span>
                  <span className="font-bold text-neutral-200 text-right">{media.director}</span>
                </div>
              )}

              {media.cast && media.cast.length > 0 && (
                <div className="space-y-1.5 pt-1.5 border-t border-white/5 text-left">
                  <span className="text-neutral-500 font-medium block">Elenco</span>
                  <p className="text-neutral-300 line-clamp-2">{media.cast.join(', ')}</p>
                </div>
              )}
            </div>
          </div>

          {/* Series Ep Selector if Series */}
          {isSeries && (
            <div className="space-y-5 pt-4 border-t border-white/5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Tv className="w-5 h-5 text-amber-500" />
                  <h3 className="text-lg font-black tracking-tight uppercase">Temporadas e Episódios</h3>
                </div>

                {/* Season tabs selector */}
                <div className="flex gap-2">
                  {media.seasons?.map((season) => (
                    <button
                      key={season.id}
                      onClick={() => setSelectedSeasonId(season.id)}
                      style={{ borderColor: selectedSeasonId === season.id ? primaryColor : undefined }}
                      className={`px-4 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer ${selectedSeasonId === season.id ? 'bg-white/10 text-white border-white/20' : 'bg-transparent text-neutral-400 border-white/5 hover:border-white/20'}`}
                    >
                      Temporada {season.number}
                    </button>
                  ))}
                </div>
              </div>

              {/* Episode lists cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {(activeSeason?.episodes || [])
                  .slice()
                  .sort((a, b) => a.episodeNumber - b.episodeNumber)
                  .map((episode) => {
                    const progress = getProgressForMedia(media.id, episode.id);
                    const isEpCompleted = progress >= 90;

                    return (
                      <div 
                        key={episode.id}
                        onClick={() => onPlay(media, episode)}
                        className="group relative flex bg-black/40 hover:bg-black/80 border border-white/5 hover:border-white/20 rounded-xl p-3 items-start gap-4 cursor-pointer transition-all hover:scale-[1.01]"
                      >
                        {/* Thumbnail with hover Play and progress */}
                        <div className="relative w-28 aspect-[16/10] shrink-0 rounded-lg overflow-hidden bg-neutral-900 border border-white/5">
                          <img 
                            src={episode.thumbnailUrl && !episode.thumbnailUrl.includes('photo-1536440136628-849c177e76a1') 
                              ? episode.thumbnailUrl 
                              : media.bannerUrl || media.coverUrl
                            } 
                            alt={episode.title} 
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            referrerPolicy="no-referrer"
                            loading="lazy"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Play className="w-6 h-6 fill-white text-white" />
                          </div>
                          
                          {/* Completed check badge */}
                          {isEpCompleted && (
                            <div className="absolute top-1.5 left-1.5 p-0.5 bg-emerald-500 rounded-full border border-neutral-900 shadow">
                              <Check className="w-3 h-3 text-neutral-950 font-extrabold" />
                            </div>
                          )}

                          {/* Progress bar overlay on thumbnail */}
                          {progress > 0 && (
                            <div className="absolute bottom-0 inset-x-0 bg-neutral-800 h-1">
                              <div className="h-full" style={{ width: `${progress}%`, backgroundColor: primaryColor }} />
                            </div>
                          )}
                        </div>

                        {/* Episode details */}
                        <div className="flex-1 min-w-0 space-y-1 text-left">
                          <div className="flex justify-between items-start gap-2">
                            <h4 className="font-bold text-xs md:text-sm text-neutral-100 group-hover:text-white line-clamp-1">
                              {episode.episodeNumber}. {episode.title}
                            </h4>
                            <span className="text-[10px] font-mono text-neutral-400 shrink-0">{episode.duration}</span>
                          </div>
                          <p className="text-[11px] text-neutral-400 font-light line-clamp-2 md:line-clamp-3">
                            {episode.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
