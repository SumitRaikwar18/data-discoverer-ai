import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface RequestBody {
  messages: ChatMessage[];
  chatId?: string;
  title?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Add request timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000); // 25 second timeout

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      clearTimeout(timeoutId);
      return new Response('Unauthorized', { 
        status: 401, 
        headers: corsHeaders 
      });
    }

    const { messages, chatId, title }: RequestBody = await req.json();
    const aimlApiKey = Deno.env.get('AIML_API_KEY');

    if (!aimlApiKey) {
      clearTimeout(timeoutId);
      throw new Error('AI/ML API key not configured');
    }

    // Add system prompt for research assistant
    const systemPrompt = {
      role: 'system' as const,
      content: `You are an advanced AI research assistant powered by GPT-5, designed specifically to help scientists with their research workflows. Your capabilities include:

1. **Experiment Design**: Create detailed, methodologically sound experimental protocols
2. **Literature Analysis**: Summarize and analyze scientific papers to identify research gaps
3. **Hypothesis Generation**: Develop testable hypotheses based on available data and theory
4. **Data Interpretation**: Explain complex research results in clear, accessible language
5. **Grant Writing**: Assist with crafting compelling research proposals and grant applications

Key guidelines:
- Use advanced multi-step reasoning to break down complex problems
- Provide evidence-based recommendations with proper scientific justification
- Consider experimental controls, statistical power, and reproducibility
- Reference relevant methodologies and best practices
- Be precise with scientific terminology while remaining accessible
- Always consider ethical implications and limitations

When helping with experiments, include:
- Clear hypotheses and objectives
- Detailed methodology and controls
- Sample size calculations when relevant
- Expected outcomes and interpretation guidelines
- Potential limitations and alternative approaches

For data analysis, provide:
- Statistical approach recommendations
- Interpretation of results in context
- Discussion of confidence levels and significance
- Suggestions for follow-up analyses

Always think step-by-step and show your reasoning process for complex scientific questions.`
    };

    const allMessages = [systemPrompt, ...messages];

    // Call AI/ML API
    const response = await fetch('https://api.aimlapi.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${aimlApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-5-2025-08-07',
        messages: allMessages,
        max_completion_tokens: 2048,
        stream: false,
        temperature: 0.7,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.text();
      console.error('AI/ML API Error:', errorData);
      throw new Error(`AI/ML API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Validate AI response
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('Invalid AI response format');
    }
    
    const aiResponse = data.choices[0].message.content;
    
    if (!aiResponse || aiResponse.trim().length === 0) {
      throw new Error('Empty AI response');
    }

    // Create or update chat
    let currentChatId = chatId;
    if (!currentChatId) {
      // Create new chat
      const chatTitle = title || messages[0]?.content.slice(0, 50) + '...' || 'New Research Chat';
      const { data: newChat, error: chatError } = await supabaseClient
        .from('chats')
        .insert({
          user_id: user.id,
          title: chatTitle,
        })
        .select()
        .single();

      if (chatError) {
        console.error('Error creating chat:', chatError);
        throw new Error('Failed to create chat');
      }

      currentChatId = newChat.id;
    }

    // Save user message with error handling
    const { error: userMessageError } = await supabaseClient.from('messages').insert({
      chat_id: currentChatId,
      role: 'user',
      content: messages[messages.length - 1].content,
    });

    if (userMessageError) {
      console.error('Error saving user message:', userMessageError);
      throw new Error('Failed to save user message');
    }

    // Save AI response with error handling
    const { error: aiMessageError } = await supabaseClient.from('messages').insert({
      chat_id: currentChatId,
      role: 'assistant',
      content: aiResponse,
    });

    if (aiMessageError) {
      console.error('Error saving AI message:', aiMessageError);
      throw new Error('Failed to save AI response');
    }

    return new Response(
      JSON.stringify({
        response: aiResponse,
        chatId: currentChatId,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in chat-with-ai function:', error);
    
    // Provide more specific error responses
    let statusCode = 500;
    let errorMessage = 'Internal server error';
    
    if (error.name === 'AbortError') {
      statusCode = 408;
      errorMessage = 'Request timeout';
    } else if (error.message?.includes('AI/ML API error')) {
      statusCode = 502;
      errorMessage = 'AI service unavailable';
    } else if (error.message?.includes('Invalid AI response') || error.message?.includes('Empty AI response')) {
      statusCode = 502;
      errorMessage = 'Invalid AI response';
    }
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: error.message
      }),
      {
        status: statusCode,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});