import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/authStore';
import { env, isSsoLogin, isMockLogin } from '../config/env';
import { Brain, Loader2, LogIn } from 'lucide-react';

export default function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { login, ssoLogin, handleSsoCallback } = useAuthStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isSsoLogin()) {
      const params = new URLSearchParams(window.location.search);
      if (params.has('code')) {
        setLoading(true);
        handleSsoCallback().then((ok) => {
          setLoading(false);
          if (ok) navigate('/');
        });
      } else {
        // Auto-redirect to SSO login
        ssoLogin();
      }
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const success = await login(username, password);
    setLoading(false);
    if (success) {
      navigate('/');
    } else {
      setError(t('login.error'));
    }
  };

  const showForm = !isSsoLogin();
  const showSsoButton = isSsoLogin();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Brain className="w-12 h-12 text-primary-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900">{t('login.title')}</h1>
          {isMockLogin() && (
            <p className="text-sm text-amber-600 mt-2">Mock 模式：輸入任意帳密即可登入</p>
          )}
          {isSsoLogin() && (
            <p className="text-sm text-gray-500 mt-2">正在重新導向至 SSO 登入...</p>
          )}
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="card space-y-4">
            {error && (
              <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('login.username')}
              </label>
              <input
                type="text"
                className="input-field"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('login.password')}
              </label>
              <input
                type="password"
                className="input-field"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn-primary w-full flex items-center justify-center gap-2" disabled={loading}>
              {loading && <Loader2 className="w-5 h-5 animate-spin" />}
              {t('login.submit')}
            </button>

            {showSsoButton && (
              <>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="bg-white px-2 text-gray-500">或</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={ssoLogin}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <LogIn className="w-5 h-5" />
                  {t('login.sso')}
                </button>
              </>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
