import { useState, useEffect } from "react";
import { User, Session } from '@supabase/supabase-js';
import { supabase } from "@/integrations/supabase/client";
import AuthPage from "@/components/AuthPage";
import ResearchApp from "@/components/ResearchApp";

const Index = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setIsLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const handleAuthSuccess = (authUser: User, authSession: Session) => {
    setUser(authUser);
    setSession(authSession);
  };

  const handleSignOut = () => {
    setUser(null);
    setSession(null);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-bg">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 bg-gradient-primary rounded-full animate-pulse mx-auto"></div>
          <p className="text-muted-foreground">Loading your research environment...</p>
        </div>
      </div>
    );
  }

  if (!user || !session) {
    return <AuthPage onAuthSuccess={handleAuthSuccess} />;
  }

  return (
    <ResearchApp 
      user={user} 
      session={session} 
      onSignOut={handleSignOut} 
    />
  );
};

export default Index;
