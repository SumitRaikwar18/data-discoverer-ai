import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { 
  Plus, 
  MessageSquare, 
  Trash2, 
  User, 
  LogOut, 
  Settings,
  FlaskConical,
  Brain,
  PanelLeftClose,
  PanelLeft
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface Chat {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface Profile {
  full_name?: string;
  email?: string;
  institution?: string;
  research_field?: string;
}

interface ResearchSidebarProps {
  selectedChatId?: string;
  onChatSelect: (chatId: string) => void;
  onNewChat: () => void;
  onSignOut: () => void;
}

export function ResearchSidebar({ 
  selectedChatId, 
  onChatSelect, 
  onNewChat, 
  onSignOut 
}: ResearchSidebarProps) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [profile, setProfile] = useState<Profile>({});
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { state, toggleSidebar } = useSidebar();

  useEffect(() => {
    fetchChats();
    fetchProfile();
  }, []);

  const fetchChats = async () => {
    try {
      const { data, error } = await supabase
        .from('chats')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setChats(data || []);
    } catch (error: any) {
      console.error('Error fetching chats:', error);
      toast({
        title: "Error",
        description: "Failed to load chat history",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      setProfile(data || { email: user.email });
    } catch (error: any) {
      console.error('Error fetching profile:', error);
    }
  };

  const deleteChat = async (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    try {
      const { error } = await supabase
        .from('chats')
        .delete()
        .eq('id', chatId);

      if (error) throw error;

      setChats(prev => prev.filter(chat => chat.id !== chatId));
      
      if (selectedChatId === chatId) {
        onNewChat();
      }

      toast({
        title: "Chat deleted",
        description: "The conversation has been removed.",
      });
    } catch (error: any) {
      console.error('Error deleting chat:', error);
      toast({
        title: "Error",
        description: "Failed to delete chat",
        variant: "destructive",
      });
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) return 'Today';
    if (diffDays === 2) return 'Yesterday';
    if (diffDays <= 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  const isCollapsed = state === "collapsed";

  return (
    <Sidebar className="w-80 bg-gray-900 border-gray-800" collapsible="icon">
      <SidebarHeader className="p-4 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center flex-shrink-0">
              <Brain className="w-4 h-4 text-white" />
            </div>
            {!isCollapsed && (
              <div>
                <h1 className="font-semibold text-white">Research AI</h1>
                <p className="text-xs text-gray-400">GPT-5 Assistant</p>
              </div>
            )}
          </div>
          <Button
            onClick={toggleSidebar}
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-gray-400 hover:text-white hover:bg-gray-800"
          >
            {isCollapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </Button>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup className="mt-4">
          {!isCollapsed && (
            <SidebarGroupLabel className="px-4 text-xs font-medium text-gray-400 uppercase tracking-wider">
              Conversations
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent className="px-2">
            {!isCollapsed && (
              <Button 
                onClick={onNewChat}
                className="w-full justify-start gap-2 mb-2 bg-gray-800 text-white border-gray-700 hover:bg-gray-700"
                variant="outline"
              >
                <Plus className="w-4 h-4" />
                New Research Chat
              </Button>
            )}

            {isCollapsed && (
              <Button 
                onClick={onNewChat}
                className="w-10 h-10 p-0 mb-2 mx-auto bg-gray-800 text-white border-gray-700 hover:bg-gray-700"
                variant="outline"
                size="icon"
              >
                <Plus className="w-4 h-4" />
              </Button>
            )}

            <ScrollArea className="h-[400px]">
              <SidebarMenu>
                {chats.map((chat) => (
                  <SidebarMenuItem key={chat.id}>
                    <SidebarMenuButton
                      onClick={() => onChatSelect(chat.id)}
                      isActive={selectedChatId === chat.id}
                      className={`${isCollapsed ? "w-10 h-10 p-0 justify-center" : "w-full justify-between group"} ${
                        selectedChatId === chat.id ? "bg-gray-800 text-white" : "text-gray-300 hover:bg-gray-800 hover:text-white"
                      }`}
                      size={isCollapsed ? "sm" : "default"}
                    >
                      {isCollapsed ? (
                        <MessageSquare className="w-4 h-4 text-gray-400" />
                      ) : (
                        <>
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <MessageSquare className="w-4 h-4 flex-shrink-0 text-gray-400" />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium truncate">
                                {chat.title}
                              </p>
                              <p className="text-xs text-gray-500">
                                {formatDate(chat.updated_at)}
                              </p>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-white"
                            onClick={(e) => deleteChat(chat.id, e)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </ScrollArea>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-gray-800">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className={`${isCollapsed ? "w-10 h-10 p-0" : "w-full justify-start gap-3 p-2"} text-gray-300 hover:bg-gray-800 hover:text-white`}>
              <Avatar className="w-8 h-8 flex-shrink-0">
                <AvatarFallback className="text-xs bg-gray-700 text-gray-300">
                  {profile.full_name?.charAt(0) || profile.email?.charAt(0) || <User className="w-4 h-4" />}
                </AvatarFallback>
              </Avatar>
              {!isCollapsed && (
                <div className="text-left min-w-0 flex-1">
                  <p className="text-sm font-medium truncate text-white">
                    {profile.full_name || profile.email || 'User'}
                  </p>
                  {profile.institution && (
                    <p className="text-xs text-gray-400 truncate">
                      {profile.institution}
                    </p>
                  )}
                </div>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 bg-gray-800 border-gray-700">
            <DropdownMenuItem onClick={onSignOut} className="text-gray-300 hover:bg-gray-700 hover:text-white">
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}