import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "./supabase";
import { toast } from "sonner";

interface AuthContextType {
  user: any;
  profile: any;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    // Helper to securely fetch profile data
    const handleSessionUpdate = async (session: any) => {
      const currentUser = session?.user || null;
      if (isMounted) setUser(currentUser);

      if (currentUser) {
        const { data } = await supabase.from('profiles').select('*').eq('id', currentUser.id).single();
        if (isMounted) setProfile(data);
      } else {
        if (isMounted) setProfile(null);
      }
      
      if (isMounted) setIsLoading(false);
    };

    // 1. Get initial session safely
    supabase.auth.getSession().then(({ data: { session } }) => {
      handleSessionUpdate(session);
    });

    // 2. Listen for auth changes cleanly
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      handleSessionUpdate(session);
    });

    // Cleanup function prevents the React Strict Mode race condition
    return () => { 
      isMounted = false;
      subscription.unsubscribe(); 
    };
  }, []);

  // Supabase Login function
  const login = async (email: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    
    if (error) {
      toast.error(error.message);
      setIsLoading(false);
      return false;
    }
    
    return true;
  };

  // Supabase Logout function
  const logout = async () => {
    setIsLoading(true);
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setIsLoading(false);
  };

  return (
    <AuthContext.Provider value={{ user, profile, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}