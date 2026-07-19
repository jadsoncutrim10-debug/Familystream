import { useState, FormEvent, MouseEvent as ReactMouseEvent, ChangeEvent } from 'react';
import { UserAccount, Profile, AppConfig } from '../types';
import { dbService } from '../lib/dbService';
import { Plus, Trash2, Edit2, Check, X, ShieldAlert, Upload, Camera, AlertCircle } from 'lucide-react';

interface ProfileSelectorProps {
  config: AppConfig;
  userAccount: UserAccount;
  onProfileSelect: (profile: Profile) => void;
  onUserUpdate: (user: UserAccount) => void;
}

const AVATAR_PRESETS = [
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=150&auto=format&fit=crop', // Dad
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=150&auto=format&fit=crop', // Mom
  'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?q=80&w=150&auto=format&fit=crop', // Kid avatar
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?q=80&w=150&auto=format&fit=crop', // Female young
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?q=80&w=150&auto=format&fit=crop', // Male tech
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=150&auto=format&fit=crop', // Neutral happy
];

export default function ProfileSelector({ config, userAccount, onProfileSelect, onUserUpdate }: ProfileSelectorProps) {
  const [isManaging, setIsManaging] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [newName, setNewName] = useState('');
  const [newIsKid, setNewIsKid] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState(AVATAR_PRESETS[0]);
  const [customPhotoBase64, setCustomPhotoBase64] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Custom modal/dialog states to replace window.alert/confirm in iframes
  const [profileToDelete, setProfileToDelete] = useState<string | null>(null);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  const handleSelect = (profile: Profile) => {
    if (isManaging) return;
    onProfileSelect(profile);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size limit (2MB)
    if (file.size > 2 * 1024 * 1024) {
      setAlertMessage('A imagem deve ter no máximo 2MB.');
      return;
    }

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setSelectedAvatar(reader.result);
        setCustomPhotoBase64(reader.result);
      }
      setIsUploading(false);
    };
    reader.onerror = () => {
      setAlertMessage('Falha ao ler o arquivo de imagem.');
      setIsUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    let updatedProfiles = [...userAccount.profiles];

    if (editingProfile) {
      updatedProfiles = updatedProfiles.map(p => p.id === editingProfile.id ? {
        ...p,
        name: newName.trim(),
        avatarUrl: selectedAvatar,
        isKid: newIsKid
      } : p);
    } else {
      const newProfile: Profile = {
        id: 'profile_' + Date.now().toString(36),
        name: newName.trim(),
        avatarUrl: selectedAvatar,
        isKid: newIsKid
      };
      updatedProfiles.push(newProfile);
    }

    const updatedUser: UserAccount = {
      ...userAccount,
      profiles: updatedProfiles,
      activeProfileId: editingProfile && userAccount.activeProfileId === editingProfile.id ? userAccount.activeProfileId : userAccount.activeProfileId
    };

    onUserUpdate(updatedUser);
    await dbService.saveUserAccount(updatedUser);

    // Reset form
    setNewName('');
    setNewIsKid(false);
    setEditingProfile(null);
    setCustomPhotoBase64(null);
    setShowAddForm(false);
  };

  const handleDeleteProfile = async (id: string, e: ReactMouseEvent) => {
    e.stopPropagation();
    if (userAccount.profiles.length <= 1) {
      setAlertMessage('Você precisa ter pelo menos um perfil ativo.');
      return;
    }
    setProfileToDelete(id);
  };

  const confirmDeleteProfile = async () => {
    if (!profileToDelete) return;
    const id = profileToDelete;

    const updatedUser: UserAccount = {
      ...userAccount,
      profiles: userAccount.profiles.filter(p => p.id !== id),
      activeProfileId: userAccount.activeProfileId === id ? userAccount.profiles[0].id : userAccount.activeProfileId
    };

    onUserUpdate(updatedUser);
    await dbService.saveUserAccount(updatedUser);
    setProfileToDelete(null);
  };

  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col justify-center items-center px-4 py-12 text-white font-sans">
      <div className="max-w-4xl w-full text-center">
        {!showAddForm ? (
          <>
            <h1 className="text-4xl md:text-5xl font-bold mb-3 tracking-tight">Quem está assistindo?</h1>
            <p className="text-neutral-400 mb-12 text-sm md:text-base">Escolha um perfil para carregar sua experiência personalizada.</p>

            {/* Profiles Grid */}
            <div className="flex flex-wrap justify-center gap-8 md:gap-12 mb-12">
              {userAccount.profiles.map((profile) => (
                <div 
                  key={profile.id}
                  onClick={() => handleSelect(profile)}
                  className={`group flex flex-col items-center cursor-pointer transition-transform ${isManaging ? 'scale-95' : 'hover:scale-105'}`}
                >
                  <div className="relative w-28 h-28 md:w-32 md:h-32 rounded-xl overflow-hidden border-2 border-transparent group-hover:border-white transition-all shadow-lg">
                    <img 
                      src={profile.avatarUrl} 
                      alt={profile.name} 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    
                    {/* Kid badge */}
                    {profile.isKid && (
                      <span className="absolute top-1.5 right-1.5 bg-amber-500 text-neutral-950 text-[10px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider">
                        Kids
                      </span>
                    )}

                    {/* Manage Overlay */}
                    {isManaging && (
                      <div className="absolute inset-0 bg-black/75 flex items-center justify-center gap-3">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingProfile(profile);
                            setNewName(profile.name);
                            setSelectedAvatar(profile.avatarUrl);
                            setNewIsKid(profile.isKid);
                            setShowAddForm(true);
                          }}
                          className="p-2 bg-amber-500 rounded-full hover:bg-amber-600 transition-colors text-neutral-950 cursor-pointer"
                          title="Editar Perfil"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={(e) => handleDeleteProfile(profile.id, e)}
                          className="p-2 bg-red-600 rounded-full hover:bg-red-700 transition-colors text-white cursor-pointer"
                          title="Excluir Perfil"
                        >
                          <Trash2 className="w-4 h-4 text-white" />
                        </button>
                      </div>
                    )}
                  </div>
                  
                  <span className="mt-4 text-neutral-400 group-hover:text-white font-medium text-base md:text-lg transition-colors flex items-center gap-1.5">
                    {profile.name}
                  </span>
                </div>
              ))}

              {/* Add Profile button */}
              {userAccount.profiles.length < 5 && (
                <div 
                  onClick={() => setShowAddForm(true)}
                  className="group flex flex-col items-center cursor-pointer transition-transform hover:scale-105"
                >
                  <div className="w-28 h-28 md:w-32 md:h-32 rounded-xl border-2 border-dashed border-neutral-700 hover:border-neutral-500 flex items-center justify-center transition-all bg-neutral-900/40">
                    <Plus className="w-10 h-10 text-neutral-500 group-hover:text-neutral-300 transition-colors" />
                  </div>
                  <span className="mt-4 text-neutral-500 group-hover:text-neutral-300 font-medium text-base md:text-lg transition-colors">
                    Adicionar Perfil
                  </span>
                </div>
              )}
            </div>

            {/* Manage Profiles Button */}
            <button
              onClick={() => setIsManaging(!isManaging)}
              className="px-6 py-2 border border-neutral-600 hover:border-white text-neutral-400 hover:text-white text-sm uppercase tracking-widest font-semibold rounded-md transition-colors"
            >
              {isManaging ? 'Concluir' : 'Gerenciar Perfis'}
            </button>
          </>
        ) : (
          /* Create Profile Form */
          <div className="max-w-md mx-auto bg-neutral-900/60 p-8 rounded-2xl border border-neutral-800">
            <h2 className="text-2xl font-bold mb-6 text-left flex items-center gap-2">
              {editingProfile ? <Edit2 className="w-6 h-6 text-amber-500" /> : <Plus className="w-6 h-6 text-amber-500" />}
              {editingProfile ? 'Editar Perfil' : 'Novo Perfil'}
            </h2>

            <form onSubmit={handleSaveProfile} className="space-y-6 text-left">
              <div>
                <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">Nome do Perfil</label>
                <input 
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ex: Pedro, Clarinha, Vovô"
                  className="w-full bg-neutral-950 border border-neutral-800 focus:border-neutral-700 rounded-lg py-2.5 px-3.5 text-sm focus:outline-none transition-colors"
                />
              </div>

              {/* Avatar Selector */}
              <div>
                <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-3">Escolha um Avatar ou envie uma Foto</label>
                <div className="flex flex-wrap gap-4 items-center mb-4 bg-neutral-950 p-4 rounded-xl border border-neutral-800">
                  {/* Custom File Uploader */}
                  <div className="flex flex-col items-center justify-center">
                    <label className="relative w-16 h-16 rounded-xl border-2 border-dashed border-neutral-700 hover:border-neutral-500 bg-neutral-900/60 flex flex-col items-center justify-center cursor-pointer transition-all overflow-hidden group">
                      {selectedAvatar && !AVATAR_PRESETS.includes(selectedAvatar) ? (
                        <img src={selectedAvatar} alt="Foto personalizada" className="w-full h-full object-cover animate-fadeIn" />
                      ) : (
                        <div className="flex flex-col items-center text-center p-1">
                          <Upload className="w-5 h-5 text-neutral-500 group-hover:text-neutral-300" />
                          <span className="text-[9px] text-neutral-500 group-hover:text-neutral-300 mt-1">Enviar</span>
                        </div>
                      )}
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={handleFileChange}
                        className="hidden" 
                      />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <Camera className="w-4 h-4 text-white" />
                      </div>
                    </label>
                    <span className="text-[10px] text-neutral-400 mt-1.5 font-medium">Foto Personalizada</span>
                  </div>

                  <div className="h-10 w-px bg-neutral-800 self-center hidden sm:block"></div>

                  {/* Presets */}
                  <div className="flex-1">
                    <span className="block text-[10px] text-neutral-500 font-semibold mb-2 uppercase">Avatares Padrão</span>
                    <div className="grid grid-cols-6 gap-2">
                      {AVATAR_PRESETS.map((avatar, idx) => (
                        <div 
                          key={idx}
                          onClick={() => {
                            setSelectedAvatar(avatar);
                          }}
                          className={`relative aspect-square rounded-lg overflow-hidden cursor-pointer border-2 transition-all ${selectedAvatar === avatar ? 'scale-105 border-white opacity-100' : 'border-transparent opacity-60 hover:opacity-100'}`}
                        >
                          <img src={avatar} alt={`Avatar ${idx}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          {selectedAvatar === avatar && (
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                              <Check className="w-3.5 h-3.5 text-white font-extrabold" />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Kids Mode Toggle */}
              <div className="flex items-center justify-between p-4 bg-neutral-950 rounded-xl border border-neutral-800">
                <div className="flex items-start gap-3">
                  <ShieldAlert className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-sm">Perfil Infantil?</h4>
                    <p className="text-xs text-neutral-500 mt-0.5">Filtrará conteúdos classificados como inadequados para crianças automaticamente.</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={newIsKid}
                    onChange={(e) => setNewIsKid(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                </label>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowAddForm(false); setEditingProfile(null); }}
                  className="flex-1 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white rounded-lg font-bold text-sm transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{ backgroundColor: config.primaryColor }}
                  className="flex-1 py-2.5 rounded-lg font-bold text-sm transition-colors hover:opacity-90 cursor-pointer text-center text-white"
                >
                  {editingProfile ? 'Salvar Alterações' : 'Criar Perfil'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Custom Warning Alert Modal */}
      {alertMessage && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl text-center animate-scaleIn">
            <div className="flex justify-center mb-4">
              <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500">
                <AlertCircle className="w-6 h-6" />
              </div>
            </div>
            <h3 className="text-lg font-bold mb-2">Atenção</h3>
            <p className="text-neutral-400 text-sm mb-6 leading-relaxed">{alertMessage}</p>
            <button
              onClick={() => setAlertMessage(null)}
              style={{ backgroundColor: config.primaryColor }}
              className="w-full py-2.5 rounded-lg font-bold text-sm transition-colors hover:opacity-90 cursor-pointer text-white"
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      {/* Custom Confirm Delete Modal */}
      {profileToDelete && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl text-center animate-scaleIn animate-scaleIn">
            <div className="flex justify-center mb-4">
              <div className="w-12 h-12 rounded-full bg-red-600/10 flex items-center justify-center text-red-500">
                <Trash2 className="w-6 h-6" />
              </div>
            </div>
            <h3 className="text-lg font-bold mb-2">Excluir Perfil</h3>
            <p className="text-neutral-400 text-sm mb-6 leading-relaxed">
              Tem certeza que deseja excluir este perfil? Todos os históricos deste perfil serão mantidos globalmente.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setProfileToDelete(null)}
                className="flex-1 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white rounded-lg font-bold text-sm transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDeleteProfile}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 rounded-lg font-bold text-sm transition-colors cursor-pointer text-white"
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
