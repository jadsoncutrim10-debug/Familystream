export interface Episode {
  id: string;
  title: string;
  description: string;
  duration: string;
  videoUrl: string;
  thumbnailUrl: string;
  episodeNumber: number;
}

export interface Season {
  id: string;
  number: number;
  episodes: Episode[];
}

export type MediaCategory = string;

export interface MediaItem {
  id: string;
  title: string;
  description: string;
  category: MediaCategory;
  year: number;
  coverUrl: string;
  bannerUrl: string;
  videoUrl: string;
  duration: string; // e.g. "2h 15m" or "45m"
  rating: string; // e.g. "Livre", "10", "12", "14", "16", "18"
  tags: string[];
  cast?: string[];
  director?: string;
  language: string;
  subtitlesUrl?: string;
  quality: '4K' | '1080p' | '720p' | 'SD';
  views: number;
  createdAt: string;
  isFeatured?: boolean;
  seasons?: Season[];
  isValidated?: boolean;
  validationError?: string;
  validationLogs?: string[];
}

export interface Profile {
  id: string;
  name: string;
  avatarUrl: string;
  isKid: boolean;
}

export interface PlaybackHistory {
  mediaId: string;
  episodeId?: string;
  currentTime: number;
  duration: number;
  completed: boolean;
  updatedAt: number;
}

export interface CustomList {
  id: string;
  name: string;
  mediaIds: string[];
}

export interface AppConfig {
  platformName: string;
  customLogoUrl?: string;
  primaryColor: string; // Tailwind color code or hex e.g. '#E50914' (Red)
  bannerMediaId?: string;
  defaultTheme: 'dark' | 'light';
  language: 'pt-BR' | 'en';
  storageProvider: 'local' | 'cloudflare' | 's3' | 'supabase';
  categories?: string[];
}

export interface UserAccount {
  uid: string;
  email: string;
  role: 'admin' | 'user';
  profiles: Profile[];
  activeProfileId?: string;
  favorites: string[]; // mediaIds
  customLists: CustomList[];
  history: PlaybackHistory[];
  createdAt: string;
}
