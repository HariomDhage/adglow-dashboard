import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Tables } from '@/lib/types';

interface FbConnection {
  access_token: string;
  ad_account_id: string | null;
  page_id: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Tables<'profiles'> | null;
  fbConnection: FbConnection | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signInWithFacebook: () => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Tables<'profiles'> | null>(null);
  const [fbConnection, setFbConnection] = useState<FbConnection | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      setProfile(data);
    } catch {
      console.error('Failed to fetch profile');
    }
  };

  const fetchFbConnection = async (userId: string) => {
    try {
      const { data } = await supabase
        .from('fb_connections')
        .select('access_token, ad_account_id, page_id')
        .eq('user_id', userId)
        .single();
      if (data) setFbConnection(data);
    } catch {
      // No FB connection yet — that's fine
    }
  };

  // When user logs in via Facebook OAuth, Supabase stores the provider token.
  // We capture it and save to fb_connections for Meta API calls.
  const saveFbToken = async (currentSession: Session) => {
    const providerToken = currentSession.provider_token;
    const userId = currentSession.user.id;
    const provider = currentSession.user.app_metadata?.provider;

    if (provider === 'facebook' && providerToken) {
      const { error } = await supabase
        .from('fb_connections')
        .upsert({
          user_id: userId,
          access_token: providerToken,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

      if (!error) {
        setFbConnection({ access_token: providerToken, ad_account_id: null, page_id: null });
      }
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
        fetchFbConnection(session.user.id);
        // If coming back from Facebook OAuth, save the token
        if (session.provider_token) saveFbToken(session);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
        fetchFbConnection(session.user.id);
        if (session.provider_token) saveFbToken(session);
      } else {
        setProfile(null);
        setFbConnection(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    return { error: error as Error | null };
  };

  const signInWithFacebook = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'facebook',
      options: {
        scopes: 'ads_management,ads_read,business_management,pages_read_engagement',
        redirectTo: `${window.location.origin}/dashboard`,
      },
    });
    return { error: error as Error | null };
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
      },
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setFbConnection(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, fbConnection, loading, signIn, signUp, signInWithFacebook, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
