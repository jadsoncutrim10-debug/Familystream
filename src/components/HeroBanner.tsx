import { Play, Info, Volume2, VolumeX } from 'lucide-react';
import { MediaItem } from '../types';

interface HeroBannerProps {
  media: MediaItem;
  onPlay: (media: MediaItem) => void;
  onMoreInfo: (media: MediaItem) => void;
  primaryColor: string;
}

export default function HeroBanner({ media, onPlay, onMoreInfo, primaryColor }: HeroBannerProps) {
  const badgeStyle = {
    borderColor: media.rating === 'Livre' ? '#10B981' : '#EF4444',
    color: media.rating === 'Livre' ? '#10B981' : '#EF4444'
  };

  return (
    <div 
      id="hero-banner-component"
      className="relative w-full h-[70vh] md:h-[85vh] flex flex-col justify-end overflow-hidden select-none bg-[#050505] font-sans"
    >
      {/* Background Banner Image with bottom and side fade overlays */}
      <div className="absolute inset-0 z-0">
        <img 
          src={media.bannerUrl} 
          alt={media.title} 
          className="w-full h-full object-cover scale-105 animate-zoomOut"
          referrerPolicy="no-referrer"
        />
        
        {/* Soft linear and radial dark overlays to merge perfectly into Immersive pitch black */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/40 to-transparent z-10" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#050505] via-transparent to-transparent z-10" />
      </div>

      {/* Hero Metadata and Buttons Box */}
      <div className="relative z-20 w-full max-w-4xl px-6 md:px-16 pb-12 md:pb-24 space-y-4 md:space-y-6 text-left">
        {/* Tagline or category */}
        <div className="flex items-center gap-2 mb-2">
          <span className="bg-orange-600 text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider text-white">
            Destaque
          </span>
          <span className="text-white/60 text-xs font-semibold">★ RECOMENDADO</span>
        </div>

        {/* Title */}
        <h1 className="text-4xl md:text-6xl font-black tracking-tight text-white line-clamp-2 uppercase drop-shadow-md leading-none">
          {media.title}
        </h1>

        {/* Metadata row */}
        <div className="flex items-center gap-3 text-xs md:text-sm text-white/60 font-medium">
          <span className="font-semibold text-white/80">{media.year}</span>
          <span className="w-1 h-1 rounded-full bg-white/30" />
          <span className="border border-white/20 px-1.5 py-0.5 text-[10px] font-bold rounded" style={badgeStyle}>
            {media.rating}
          </span>
          <span className="w-1 h-1 rounded-full bg-white/30" />
          <span className="font-semibold text-white/80">{media.duration}</span>
          <span className="w-1 h-1 rounded-full bg-white/30" />
          <span className="text-orange-500 font-bold tracking-wider">{media.quality}</span>
        </div>

        {/* Description summary */}
        <p className="text-sm md:text-base text-white/70 leading-relaxed max-w-xl md:max-w-2xl line-clamp-3 md:line-clamp-4 drop-shadow-sm font-light">
          {media.description}
        </p>

        {/* Action Buttons row */}
        <div className="flex flex-wrap items-center gap-3 md:gap-4 pt-2">
          <button
            onClick={() => onPlay(media)}
            style={{ backgroundColor: primaryColor }}
            className="flex items-center gap-2 px-8 py-3 rounded-xl font-extrabold text-sm md:text-base text-white hover:opacity-95 hover:scale-[1.02] active:scale-95 transition-all shadow-lg cursor-pointer"
          >
            <Play className="w-5 h-5 fill-white text-white" />
            Assistir
          </button>

          <button
            onClick={() => onMoreInfo(media)}
            className="flex items-center gap-2 px-6 py-3 bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20 text-white rounded-xl font-bold text-sm md:text-base active:scale-95 transition-all cursor-pointer"
          >
            <Info className="w-5 h-5" />
            Mais Detalhes
          </button>
        </div>
      </div>
    </div>
  );
}
