import { Play, Star, Sparkles, Heart } from 'lucide-react';
import { MediaItem } from '../types';

interface MediaSliderProps {
  title: string;
  items: MediaItem[];
  favorites?: string[]; // userAccount.favorites to show heart indicators!
  onCardClick: (media: MediaItem) => void;
  onPlayClick: (media: MediaItem) => void;
  primaryColor: string;
}

export default function MediaSlider({ 
  title, 
  items, 
  favorites = [], 
  onCardClick, 
  onPlayClick, 
  primaryColor 
}: MediaSliderProps) {
  if (items.length === 0) return null;

  return (
    <div id={`slider-${title.toLowerCase().replace(/\s+/g, '-')}`} className="w-full px-6 md:px-16 space-y-3.5 select-none text-white font-sans">
      <div className="flex justify-between items-center">
        <h2 className="text-xl md:text-2xl font-black tracking-tight text-white flex items-center gap-2">
          {title}
        </h2>
        <span className="text-[10px] md:text-xs text-neutral-500 font-bold uppercase tracking-widest">{items.length} {items.length === 1 ? 'item' : 'itens'}</span>
      </div>

      {/* Horizontal Scroll Slider */}
      <div className="flex gap-4 md:gap-5 overflow-x-auto pb-4 pt-1 px-1 scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-transparent scroll-smooth">
        {items.map((item) => {
          const isFav = favorites.includes(item.id);
          const ratingColor = item.rating === 'Livre' ? 'text-emerald-400 border-emerald-500/20' : 'text-red-400 border-red-500/20';
          
          return (
            <div
              key={item.id}
              onClick={() => onCardClick(item)}
              className="relative flex-shrink-0 w-44 md:w-56 group cursor-pointer bg-neutral-900/30 backdrop-blur-md rounded-xl overflow-hidden border border-white/5 transition-all duration-300 shadow-lg hover:shadow-2xl hover:scale-[1.03]"
              onMouseEnter={(e) => { 
                e.currentTarget.style.borderColor = primaryColor; 
                e.currentTarget.style.boxShadow = `0 0 15px ${primaryColor}25`; 
              }}
              onMouseLeave={(e) => { 
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.05)'; 
                e.currentTarget.style.boxShadow = ''; 
              }}
            >
              {/* Image Container with Hover Effects */}
              <div className="relative aspect-[16/10] overflow-hidden">
                <img 
                  src={item.coverUrl} 
                  alt={item.title} 
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  referrerPolicy="no-referrer"
                  loading="lazy"
                />
                
                {/* Favorites and Play hover indicators */}
                <div className="absolute inset-0 bg-neutral-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      onPlayClick(item);
                    }}
                    style={{ backgroundColor: primaryColor }}
                    className="p-2.5 rounded-full text-white hover:scale-110 active:scale-95 transition-transform cursor-pointer shadow-lg"
                    title="Reproduzir Vídeo"
                  >
                    <Play className="w-5 h-5 fill-white text-white translate-x-[1px]" />
                  </button>
                </div>

                {/* Top Badge: Quality */}
                <div className="absolute top-2 left-2 flex gap-1 items-center">
                  <span className="bg-black/75 backdrop-blur-sm border border-neutral-800/80 text-[9px] font-extrabold px-1.5 py-0.5 rounded tracking-wider text-amber-400 uppercase">
                    {item.quality}
                  </span>
                  
                  {isFav && (
                    <span className="bg-neutral-950/80 backdrop-blur-sm p-1 rounded-full border border-neutral-800/80">
                      <Heart className="w-3 h-3 text-red-500 fill-red-500" />
                    </span>
                  )}
                </div>

                {/* Bottom Badge: duration */}
                <div className="absolute bottom-2 right-2 bg-neutral-950/80 backdrop-blur-sm px-1.5 py-0.5 rounded text-[10px] font-medium text-neutral-300">
                  {item.duration}
                </div>
              </div>

              {/* Media Card Details Area */}
              <div className="p-3.5 space-y-1.5 text-left">
                <h4 className="font-bold text-sm text-neutral-100 line-clamp-1 group-hover:text-white transition-colors">
                  {item.title}
                </h4>
                
                <div className="flex items-center gap-2 text-[11px] font-semibold text-neutral-400">
                  <span>{item.year}</span>
                  <span className="w-1 h-1 rounded-full bg-neutral-600" />
                  <span className={`border px-1 py-0.2 rounded text-[9px] font-extrabold ${ratingColor}`}>
                    {item.rating}
                  </span>
                  <span className="w-1 h-1 rounded-full bg-neutral-600" />
                  <span className="text-neutral-500 font-normal line-clamp-1 flex-1 text-right">{item.category}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
