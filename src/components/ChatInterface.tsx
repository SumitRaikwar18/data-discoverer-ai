import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Send, Bot, User, Loader2, FlaskConical, FileText, Lightbulb, BarChart3, PenTool, Download } from "lucide-react";
import ReactMarkdown from "react-markdown";
import jsPDF from "jspdf";

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: Date;
}

interface ChatInterfaceProps {
  chatId?: string;
  messages?: Message[];
  onNewChat: (chatId: string, title: string) => void;
}

const quickPrompts = [
  {
    icon: FlaskConical,
    title: "Design Experiment",
    prompt: "Help me design an experiment to test the hypothesis that [describe your hypothesis]. Include methodology, controls, and statistical considerations."
  },
  {
    icon: FileText,
    title: "Literature Analysis",
    prompt: "Analyze the current literature on [research topic] and identify key research gaps that could be addressed in future studies."
  },
  {
    icon: Lightbulb,
    title: "Generate Hypotheses",
    prompt: "Based on the following data/observations: [describe your data], generate testable hypotheses that could explain these findings."
  },
  {
    icon: BarChart3,
    title: "Interpret Data",
    prompt: "Help me interpret these research results: [paste your data/results]. Explain the significance and suggest follow-up analyses."
  },
  {
    icon: PenTool,
    title: "Grant Writing",
    prompt: "Help me draft a research proposal for [funding agency] focusing on [research area]. Include objectives, methodology, and expected outcomes."
  }
];

export default function ChatInterface({ chatId, messages: initialMessages = [], onNewChat }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

  const handleSubmit = async (messageContent?: string) => {
    const content = messageContent || input.trim();
    if (!content || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      // Add timeout for better error handling
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), 30000)
      );

      const requestPromise = supabase.functions.invoke('chat-with-ai', {
        body: {
          messages: [...messages, userMessage],
          chatId,
          title: content.slice(0, 50) + (content.length > 50 ? '...' : ''),
        },
      });

      const { data, error } = await Promise.race([requestPromise, timeoutPromise]);

      if (error) throw error;

      // Validate response data
      if (!data || !data.response) {
        throw new Error('Invalid response from AI service');
      }
      const assistantMessage: Message = {
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);

      // If this is a new chat, notify parent component
      if (!chatId && data.chatId) {
        onNewChat(data.chatId, content.slice(0, 50) + (content.length > 50 ? '...' : ''));
      }

    } catch (error: any) {
      console.error('Chat error:', error);
      
      // Remove the user message if there was an error
      setMessages(prev => prev.slice(0, -1));
      
      // Provide specific error messages
      let errorMessage = "Failed to send message. Please try again.";
      if (error.message === 'Request timeout') {
        errorMessage = "Request timed out. Please check your connection and try again.";
      } else if (error.message?.includes('Invalid response')) {
        errorMessage = "Received invalid response from AI service. Please try again.";
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleQuickPrompt = (prompt: string) => {
    setInput(prompt);
    textareaRef.current?.focus();
  };

  const generatePDF = () => {
    if (messages.length === 0) {
      toast({
        title: "No content",
        description: "No conversation to export",
        variant: "destructive",
      });
      return;
    }

    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;
      const margin = 20;
      const lineHeight = 7;
      let yPosition = margin;

      // Title
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("AI Research Assistant Conversation", margin, yPosition);
      yPosition += lineHeight * 2;

      // Date
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Generated on: ${new Date().toLocaleDateString()}`, margin, yPosition);
      yPosition += lineHeight * 2;

      // Messages
      messages.forEach((message, index) => {
        // Check if we need a new page
        if (yPosition > pageHeight - margin) {
          doc.addPage();
          yPosition = margin;
        }

        // Role header
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        const roleText = message.role === 'user' ? 'User:' : 'AI Assistant:';
        doc.text(roleText, margin, yPosition);
        yPosition += lineHeight;

        // Message content
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        
        // Split text to fit page width
        const textLines = doc.splitTextToSize(
          message.content, 
          pageWidth - (margin * 2)
        );
        
        textLines.forEach((line: string) => {
          if (yPosition > pageHeight - margin) {
            doc.addPage();
            yPosition = margin;
          }
          doc.text(line, margin, yPosition);
          yPosition += lineHeight;
        });

        yPosition += lineHeight; // Extra space between messages
      });

      // Save the PDF
      const timestamp = new Date().toISOString().split('T')[0];
      doc.save(`research-chat-${timestamp}.pdf`);

      toast({
        title: "PDF Generated",
        description: "Your conversation has been exported to PDF",
      });

    } catch (error) {
      console.error('PDF generation error:', error);
      toast({
        title: "Export Error",
        description: "Failed to generate PDF. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full space-y-8">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-gradient-primary rounded-full flex items-center justify-center mx-auto">
                <Bot className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-foreground">
                AI Research Assistant
              </h2>
              <p className="text-muted-foreground max-w-md">
                Powered by GPT-5's advanced reasoning. Ask me anything about research design, 
                data analysis, hypothesis generation, or grant writing.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-w-4xl w-full">
              {quickPrompts.map((prompt, index) => (
                <Card
                  key={index}
                  className="p-4 cursor-pointer hover:shadow-md transition-all duration-200 border-2 hover:border-primary"
                  onClick={() => handleQuickPrompt(prompt.prompt)}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                      <prompt.icon className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-medium text-sm mb-1">{prompt.title}</h3>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {prompt.prompt.slice(0, 80)}...
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message, index) => (
            <div
              key={index}
              className={`flex gap-3 ${
                message.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {message.role === 'assistant' && (
                <Avatar className="w-8 h-8 bg-gradient-primary">
                  <AvatarFallback className="bg-gradient-primary">
                    <Bot className="w-4 h-4 text-white" />
                  </AvatarFallback>
                </Avatar>
              )}
              
              <div
                className={`max-w-3xl rounded-lg p-4 ${
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground ml-12'
                    : 'bg-card border'
                }`}
              >
                {message.role === 'assistant' ? (
                  <div className="prose prose-sm max-w-none dark:prose-invert">
                    <ReactMarkdown>{message.content}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap">{message.content}</p>
                )}
              </div>

              {message.role === 'user' && (
                <Avatar className="w-8 h-8">
                  <AvatarFallback>
                    <User className="w-4 h-4" />
                  </AvatarFallback>
                </Avatar>
              )}
            </div>
          ))
        )}
        
        {isLoading && (
          <div className="flex gap-3">
            <Avatar className="w-8 h-8 bg-gradient-primary">
              <AvatarFallback className="bg-gradient-primary">
                <Bot className="w-4 h-4 text-white" />
              </AvatarFallback>
            </Avatar>
            <div className="bg-card border rounded-lg p-4">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-muted-foreground">AI is thinking...</span>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t bg-background p-4">
        <div className="flex gap-2 max-w-4xl mx-auto">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask me about experiment design, data analysis, hypothesis generation..."
            className="min-h-[60px] max-h-[200px] resize-none"
            disabled={isLoading}
          />
          <div className="flex flex-col gap-2">
            {messages.length > 0 && (
              <Button
                onClick={generatePDF}
                variant="outline"
                size="icon"
                className="w-12 h-12 rounded-lg"
                title="Export conversation to PDF"
              >
                <Download className="w-4 h-4" />
              </Button>
            )}
            <Button
              onClick={() => handleSubmit()}
              disabled={!input.trim() || isLoading}
              size="icon"
              className="w-12 h-12 rounded-lg"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}