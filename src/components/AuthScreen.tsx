import { useState } from 'react';
import { 
  GoogleAuthProvider, 
  signInWithPopup 
} from 'firebase/auth';
import { auth, isFirebaseEnabled } from '../lib/firebase';
import { dbService } from '../lib/dbService';
import { UserAccount, AppConfig } from '../types';
import { Film, LogIn, AlertCircle, Info, ShieldCheck, Chrome } from 'lucide-react';

interface AuthScreenProps {
  config: AppConfig;
  onAuthSuccess: (user: UserAccount) => void;
}

export default function AuthScreen({ config, onAuthSuccess }: AuthScreenProps) {
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [simulatedEmail, setSimulatedEmail] = useState('jadsoncutrim10@gmail.com');

  // Default profiles on creation
  const defaultProfiles = [
    { id: 'p1', name: 'Pai (Admin)', avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=150&auto=format&fit=crop', isKid: false },
    { id: 'p2', name: 'Mãe', avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=150&auto=format&fit=crop', isKid: false },
    { id: 'p3', name: 'Crianças 🧸', avatarUrl: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?q=80&w=150&auto=format&fit=crop', isKid: true },
  ];

  const handleGoogleSignIn = async () => {
    setError('');
    setMessage('');
    setLoading(true);

    try {
      if (isFirebaseEnabled && auth) {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({
          prompt: 'select_account'
        });
        
        const cred = await signInWithPopup(auth, provider);
        const email = cred.user.email || '';
        const isAdminEmail = email.toLowerCase() === 'jadsoncutrim10@gmail.com';
        const role = isAdminEmail ? 'admin' : 'user';

        let userAcc = await dbService.getUserAccount(cred.user.uid);
        if (!userAcc) {
          userAcc = {
            uid: cred.user.uid,
            email: email,
            role: role,
            profiles: defaultProfiles,
            activeProfileId: 'p1',
            favorites: [],
            customLists: [],
            history: [],
            createdAt: new Date().toISOString()
          };
          await dbService.saveUserAccount(userAcc);
        } else {
          if (userAcc.role !== role || userAcc.email !== email) {
            userAcc.role = role;
            userAcc.email = email;
            await dbService.saveUserAccount(userAcc);
          }
        }
        onAuthSuccess(userAcc);
      } else {
        // Simulated sign in
        const email = simulatedEmail.trim() || 'jadsoncutrim10@gmail.com';
        const isAdminEmail = email.toLowerCase() === 'jadsoncutrim10@gmail.com';
        const role = isAdminEmail ? 'admin' : 'user';

        const localUsersStr = localStorage.getItem('familystream_users');
        const users: UserAccount[] = localUsersStr ? JSON.parse(localUsersStr) : [];
        
        let userAcc = users.find(u => u.email.toLowerCase() === email.toLowerCase());
        if (!userAcc) {
          userAcc = {
            uid: 'local_' + Math.random().toString(36).substring(2, 9),
            email: email,
            role: role,
            profiles: defaultProfiles,
            activeProfileId: 'p1',
            favorites: [],
            customLists: [],
            history: [],
            createdAt: new Date().toISOString()
          };
          users.push(userAcc);
          localStorage.setItem('familystream_users', JSON.stringify(users));
        } else {
          if (userAcc.role !== role) {
            userAcc.role = role;
            localStorage.setItem('familystream_users', JSON.stringify(users));
          }
        }
        
        localStorage.setItem('familystream_current_uid', userAcc.uid);
        onAuthSuccess(userAcc);
      }
    } catch (err: any) {
      console.error(err);
      let errorMsg = err.message || 'Ocorreu um erro ao fazer login com o Google.';
      
      if (err.code === 'auth/popup-blocked') {
        errorMsg = 'O pop-up de login foi bloqueado pelo seu navegador. Por favor, permita pop-ups para este site.';
      } else if (err.code === 'auth/cancelled-popup-request' || err.code === 'auth/popup-closed-by-user') {
        errorMsg = 'O login foi cancelado pelo usuário.';
      } else if (err.code === 'auth/operation-not-allowed') {
        errorMsg = 'O provedor Google Sign-In não está ativado no console do Firebase.';
      }
      
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] flex flex-col justify-center items-center px-4 relative overflow-hidden text-white font-sans selection:bg-orange-600 selection:text-white">
      {/* Background radial glow */}
      <div className="absolute w-[500px] h-[500px] rounded-full opacity-10 blur-[120px]" style={{ backgroundColor: config.primaryColor, top: '20%', left: '50%', transform: 'translate(-50%, -50%)' }} />
      
      {/* Top Header */}
      <div className="z-10 flex flex-col items-center gap-1.5 mb-8 select-none">
        <div className="flex items-center gap-2">
          <Film className="w-10 h-10" style={{ color: config.primaryColor }} />
          <span className="text-4xl font-extrabold uppercase tracking-tighter bg-gradient-to-r from-orange-500 to-red-600 bg-clip-text text-transparent">
            {config.platformName}
          </span>
        </div>
        <p className="text-xs text-neutral-500 font-semibold uppercase tracking-widest mt-1">Plataforma de Mídia da Família</p>
      </div>

      {/* Main card */}
      <div id="auth-card" className="w-full max-w-md bg-neutral-900/60 backdrop-blur-md rounded-2xl p-8 border border-white/10 shadow-2xl z-10 text-center">
        <h2 className="text-2xl font-bold mb-2">Acessar Plataforma</h2>
        <p className="text-neutral-400 text-sm mb-6">Entre de forma simples e rápida com sua Conta do Google</p>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl flex items-start gap-2 mb-6 text-sm text-left animate-shake">
            <AlertCircle className="w-5 h-5 shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
        )}

        {message && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-3 rounded-xl flex items-start gap-2 mb-6 text-sm text-left">
            <Info className="w-5 h-5 shrink-0 text-emerald-500" />
            <span>{message}</span>
          </div>
        )}

        <div className="space-y-6">
          {/* Main Google Login Button */}
          <button 
            type="button" 
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full py-3.5 px-6 rounded-xl font-bold text-sm bg-white hover:bg-neutral-100 text-black cursor-pointer hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-3 shadow-lg disabled:opacity-50"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-neutral-800 border-t-neutral-200 rounded-full animate-spin" />
            ) : (
              <>
                <Chrome className="w-5 h-5 text-red-500 fill-current" />
                <span>Entrar com o Google</span>
              </>
            )}
          </button>

          {/* Offline simulated input (only shown if firebase not enabled) */}
          {!isFirebaseEnabled && (
            <div className="pt-6 border-t border-white/5 text-left space-y-3">
              <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider block text-center">Modo de Simulação</span>
              <div>
                <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">E-mail do Google para Testar</label>
                <input 
                  type="email" 
                  value={simulatedEmail}
                  onChange={(e) => setSimulatedEmail(e.target.value)}
                  placeholder="exemplo@gmail.com"
                  className="w-full bg-neutral-950 border border-white/5 focus:border-white/20 rounded-lg py-2 px-3 text-xs focus:outline-none transition-colors"
                />
              </div>
              <p className="text-[10px] text-neutral-500 text-center">Como o Firebase está inativo localmente, você pode definir qualquer e-mail para simular o acesso.</p>
            </div>
          )}

          {/* Administrator notice */}
          <div className="pt-4 border-t border-white/5 flex items-center justify-center gap-2 text-xs text-neutral-400 font-medium">
            <ShieldCheck className="w-4 h-4 text-orange-500 shrink-0" />
            <span>Administrador: <strong className="text-orange-500 font-bold">jadsoncutrim10@gmail.com</strong></span>
          </div>
        </div>
      </div>
    </div>
  );
}
