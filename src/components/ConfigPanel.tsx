import { useState, FormEvent } from 'react';
import { AppConfig, MediaItem } from '../types';
import { dbService } from '../lib/dbService';
import { X, Settings, Sparkles, Check, Globe, Layout, Palette, Layers, Edit, Trash2, AlertCircle } from 'lucide-react';

interface ConfigPanelProps {
  config: AppConfig;
  onConfigChange: (config: AppConfig) => void;
  mediaItems?: MediaItem[];
  onMediaItemsChange?: (items: MediaItem[]) => void;
  onClose: () => void;
}

const COLOR_PRESETS = [
  { name: 'Vermelho Netflix', value: '#E50914' },
  { name: 'Azul Cósmico', value: '#3B82F6' },
  { name: 'Ouro Real', value: '#F59E0B' },
  { name: 'Esmeralda', value: '#10B981' },
  { name: 'Violeta', value: '#8B5CF6' },
  { name: 'Laranja Sunset', value: '#F97316' },
];

export default function ConfigPanel({ config, onConfigChange, mediaItems, onMediaItemsChange, onClose }: ConfigPanelProps) {
  const [name, setName] = useState(config.platformName);
  const [logo, setLogo] = useState(config.customLogoUrl || '');
  const [color, setColor] = useState(config.primaryColor);
  const [theme, setTheme] = useState(config.defaultTheme);
  const [lang, setLang] = useState(config.language);

  const [categories, setCategories] = useState<string[]>(config.categories || ['Filmes', 'Séries', 'Documentários', 'Vídeos da família', 'Infantil', 'Música', 'Outros']);
  const [newCategory, setNewCategory] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [categoryRenames, setCategoryRenames] = useState<{ from: string; to: string }[]>([]);

  // State for custom alerts and confirmations in iframes
  const [alertMsg, setAlertMsg] = useState<string | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<{ index: number; name: string } | null>(null);

  const handleRenameCategory = (index: number, newValue: string) => {
    const trimmed = newValue.trim();
    if (!trimmed) return;
    const oldValue = categories[index];
    if (oldValue === trimmed) {
      setEditingIndex(null);
      return;
    }

    if (categories.some((c, idx) => idx !== index && c.toLowerCase() === trimmed.toLowerCase())) {
      setAlertMsg('Já existe uma categoria com este nome.');
      return;
    }

    const updated = [...categories];
    updated[index] = trimmed;
    setCategories(updated);

    setCategoryRenames(prev => [
      ...prev.filter(r => r.to !== oldValue),
      { from: oldValue, to: trimmed }
    ]);

    setEditingIndex(null);
  };

  const handleDeleteCategory = (index: number) => {
    const oldValue = categories[index];
    if (categories.length <= 1) {
      setAlertMsg('Você precisa ter pelo menos uma categoria.');
      return;
    }
    setCategoryToDelete({ index, name: oldValue });
  };

  const confirmDeleteCategory = () => {
    if (!categoryToDelete) return;
    const { index } = categoryToDelete;
    const updated = categories.filter((_, idx) => idx !== index);
    setCategories(updated);
    setCategoryToDelete(null);
  };

  const handleAddCategory = () => {
    const trimmed = newCategory.trim();
    if (!trimmed) return;
    if (categories.some(c => c.toLowerCase() === trimmed.toLowerCase())) {
      setAlertMsg('Esta categoria já existe.');
      return;
    }
    setCategories([...categories, trimmed]);
    setNewCategory('');
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const updated: AppConfig = {
      ...config,
      platformName: name.trim(),
      customLogoUrl: logo.trim() || undefined,
      primaryColor: color,
      defaultTheme: theme,
      language: lang,
      categories: categories
    };

    onConfigChange(updated);
    await dbService.saveConfig(updated);

    if (mediaItems && onMediaItemsChange) {
      let itemsChanged = false;
      const updatedItems = mediaItems.map(item => {
        const matchRename = categoryRenames.find(r => r.from === item.category);
        if (matchRename) {
          itemsChanged = true;
          return { ...item, category: matchRename.to };
        }
        if (!categories.includes(item.category)) {
          itemsChanged = true;
          return { ...item, category: categories[0] || 'Outros' };
        }
        return item;
      });

      if (itemsChanged) {
        onMediaItemsChange(updatedItems);
        for (const item of updatedItems) {
          const original = mediaItems.find(m => m.id === item.id);
          if (original && original.category !== item.category) {
            await dbService.saveMediaItem(item);
          }
        }
      }
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 flex items-center justify-center p-4 text-white font-sans selection:bg-red-600">
      <div className="absolute inset-0 cursor-default" onClick={onClose} />

      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden z-50 flex flex-col animate-scaleIn max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-neutral-950 p-4 px-6 border-b border-neutral-800 flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <Settings className="w-5 h-5 text-amber-500" />
            <h3 className="font-extrabold text-sm uppercase tracking-wider">Ajustes da Plataforma</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-neutral-800 rounded-full text-neutral-400 hover:text-white transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-6 space-y-5 text-left overflow-y-auto flex-1">
          
          {/* Platform Name */}
          <div>
            <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5">Nome do FamilyStream</label>
            <input 
              type="text" required value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Ex: FamilyStream, CineCutrim"
              className="w-full bg-neutral-950 border border-neutral-800 focus:border-neutral-700 rounded-lg py-2 px-3 text-xs focus:outline-none"
            />
          </div>

          {/* Logo URL */}
          <div>
            <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5">URL da Logomarca Personalizada (Opcional)</label>
            <input 
              type="text" value={logo} onChange={(e) => setLogo(e.target.value)}
              placeholder="https://exemplo.com/logo.png"
              className="w-full bg-neutral-950 border border-neutral-800 focus:border-neutral-700 rounded-lg py-2 px-3 text-xs focus:outline-none"
            />
          </div>

          {/* Color theme presets */}
          <div>
            <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-2 flex items-center gap-1">
              <Palette className="w-3.5 h-3.5 text-neutral-500" /> Cor de Identidade Visual
            </label>
            <div className="grid grid-cols-3 gap-2">
              {COLOR_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => setColor(preset.value)}
                  className={`flex items-center gap-1.5 p-2 rounded-lg border text-[10px] font-bold transition-all text-left ${color === preset.value ? 'bg-neutral-800 border-neutral-600 text-white' : 'bg-neutral-950 border-transparent text-neutral-400 hover:text-neutral-200'}`}
                >
                  <span className="w-3 h-3 rounded-full shrink-0 border border-white/10" style={{ backgroundColor: preset.value }} />
                  <span className="truncate">{preset.name.split(' ')[0]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Theme & Language row */}
          <div className="grid grid-cols-2 gap-4">
            
            {/* Theme */}
            <div>
              <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Layout className="w-3.5 h-3.5 text-neutral-500" /> Tema Padrão
              </label>
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value as any)}
                className="w-full bg-neutral-950 border border-neutral-800 focus:border-neutral-700 rounded-lg py-2 px-3 text-xs focus:outline-none"
              >
                <option value="dark">Tema Escuro (Recomendado)</option>
                <option value="light">Tema Claro</option>
              </select>
            </div>

            {/* Language */}
            <div>
              <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Globe className="w-3.5 h-3.5 text-neutral-500" /> Idioma
              </label>
              <select
                value={lang}
                onChange={(e) => setLang(e.target.value as any)}
                className="w-full bg-neutral-950 border border-neutral-800 focus:border-neutral-700 rounded-lg py-2 px-3 text-xs focus:outline-none"
              >
                <option value="pt-BR">Português (Brasil)</option>
                <option value="en">English</option>
              </select>
            </div>

          </div>

          {/* Categories Management */}
          <div className="border-t border-neutral-800 pt-4 space-y-3">
            <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-neutral-500" /> Categorias de Mídia
            </label>

            {/* List of categories */}
            <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
              {categories.map((cat, idx) => (
                <div key={idx} className="flex items-center justify-between bg-neutral-950 p-2 px-3 rounded-lg border border-neutral-800/60">
                  {editingIndex === idx ? (
                    <div className="flex-1 flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="text"
                        value={editingValue}
                        onChange={(e) => setEditingValue(e.target.value)}
                        className="flex-1 bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-xs text-white focus:outline-none"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleRenameCategory(idx, editingValue);
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => handleRenameCategory(idx, editingValue)}
                        className="p-1 bg-emerald-600 rounded text-white hover:bg-emerald-700 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingIndex(null)}
                        className="p-1 bg-neutral-800 rounded text-neutral-400 hover:text-white cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="text-xs font-medium text-neutral-200">{cat}</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingIndex(idx);
                            setEditingValue(cat);
                          }}
                          className="p-1 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded transition-colors cursor-pointer animate-fadeIn"
                          title="Editar"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCategory(idx)}
                          className="p-1 text-red-400 hover:text-red-300 hover:bg-red-950/30 rounded transition-colors cursor-pointer animate-fadeIn"
                          title="Excluir"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>

            {/* Add custom category input */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="Nova categoria (ex: Viagens)"
                className="flex-1 bg-neutral-950 border border-neutral-800 focus:border-neutral-700 rounded-lg py-1.5 px-3 text-xs focus:outline-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCategory();
                  }
                }}
              />
              <button
                type="button"
                onClick={handleAddCategory}
                className="py-1.5 px-3 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-xs font-bold text-white cursor-pointer"
              >
                + Add
              </button>
            </div>
          </div>

          {/* Save Button */}
          <button
            type="submit"
            style={{ backgroundColor: color }}
            className="w-full py-2.5 rounded-lg font-bold text-xs hover:opacity-90 transition-all cursor-pointer text-center text-white flex items-center justify-center gap-1.5 mt-2"
          >
            <Check className="w-4 h-4 text-white font-extrabold" />
            Salvar Preferências
          </button>
        </form>
      </div>

      {/* Custom Warning Alert Modal */}
      {alertMsg && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-neutral-950 border border-neutral-800 rounded-2xl w-full max-w-xs p-5 shadow-2xl text-center animate-scaleIn">
            <div className="flex justify-center mb-3">
              <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500">
                <AlertCircle className="w-5 h-5" />
              </div>
            </div>
            <h3 className="text-sm font-bold mb-1">Aviso</h3>
            <p className="text-neutral-400 text-xs mb-4 leading-relaxed">{alertMsg}</p>
            <button
              onClick={() => setAlertMsg(null)}
              style={{ backgroundColor: color }}
              className="w-full py-2 rounded-lg font-bold text-xs transition-colors hover:opacity-90 cursor-pointer text-white"
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      {/* Custom Confirm Delete Modal */}
      {categoryToDelete && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-neutral-950 border border-neutral-800 rounded-2xl w-full max-w-sm p-5 shadow-2xl text-center animate-scaleIn">
            <div className="flex justify-center mb-3">
              <div className="w-10 h-10 rounded-full bg-red-600/10 flex items-center justify-center text-red-500">
                <Trash2 className="w-5 h-5" />
              </div>
            </div>
            <h3 className="text-sm font-bold mb-1">Excluir Categoria</h3>
            <p className="text-neutral-400 text-xs mb-4 leading-relaxed">
              Tem certeza que deseja excluir a categoria &ldquo;{categoryToDelete.name}&rdquo;? Quaisquer vídeos nesta categoria serão movidos automaticamente para a categoria &ldquo;{categories[categoryToDelete.index === 0 ? 1 : 0]}&rdquo;.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setCategoryToDelete(null)}
                className="flex-1 py-2 bg-neutral-850 hover:bg-neutral-800 text-neutral-300 hover:text-white rounded-lg font-bold text-xs transition-colors cursor-pointer border border-neutral-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDeleteCategory}
                className="flex-1 py-2 bg-red-600 hover:bg-red-700 rounded-lg font-bold text-xs transition-colors cursor-pointer text-white"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
