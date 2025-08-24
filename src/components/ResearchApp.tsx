import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from '@supabase/supabase-js';
import { SidebarProvider } from "@/components/ui/sidebar";
import { ResearchSidebar } from "./ResearchSidebar";
import ChatInterface from "./ChatInterface";
import { useToast } from "@/hooks/use-toast";

interface Message {
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

interface ResearchAppProps {
  user: User;
  session: Session;
  onSignOut: () => void;
}

export default function ResearchApp({ user, session, onSignOut }: ResearchAppProps) {
  const [selectedChatId, setSelectedChatId] = useState<string | undefined>();
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const { toast } = useToast();

  const loadChatMessages = async (chatId: string) => {
    setIsLoadingMessages(true);
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      setChatMessages((data || []).map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
        created_at: msg.created_at
      })));
    } catch (error: any) {
      console.error('Error loading messages:', error);
      toast({
        title: "Error",
        description: "Failed to load chat messages",
        variant: "destructive",
      });
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const handleChatSelect = (chatId: string) => {
    setSelectedChatId(chatId);
    loadChatMessages(chatId);
  };

  const handleNewChat = () => {
    setSelectedChatId(undefined);
    setChatMessages([]);
  };

  const handleNewChatCreated = (chatId: string, title: string) => {
    setSelectedChatId(chatId);
    // Messages are already updated in ChatInterface component
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      onSignOut();
    } catch (error: any) {
      console.error('Error signing out:', error);
      toast({
        title: "Error",
        description: "Failed to sign out",
        variant: "destructive",
      });
    }
  };

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full bg-background">
        <ResearchSidebar
          selectedChatId={selectedChatId}
          onChatSelect={handleChatSelect}
          onNewChat={handleNewChat}
          onSignOut={handleSignOut}
        />
        
        <main className="flex-1 flex flex-col">
          <div className="border-b bg-card px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-semibold">AI Research Assistant</h1>
                <p className="text-sm text-muted-foreground">
                  Advanced scientific reasoning powered by GPT-5
                </p>
              </div>
              <div className="text-sm text-muted-foreground">
                Welcome, {user.email}
              </div>
            </div>
          </div>
          
          <div className="flex-1">
            <ChatInterface
              chatId={selectedChatId}
              messages={chatMessages}
              onNewChat={handleNewChatCreated}
            />
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}