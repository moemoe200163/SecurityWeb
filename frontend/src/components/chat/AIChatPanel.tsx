'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { Message } from '@/lib/types';

interface AIChatPanelProps {
  messages: Message[];
  onSendMessage: (message: string) => void;
  disabled?: boolean;
}

export function AIChatPanel({ messages, onSendMessage, disabled = false }: AIChatPanelProps) {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !disabled) {
      onSendMessage(input.trim());
      setInput('');
    }
  };

  return (
    <div className="border border-[var(--border)] rounded-lg bg-[var(--card)] shadow-sm flex flex-col h-80">
      <div className="px-4 py-3 border-b border-[var(--border)] bg-[var(--muted)]/40">
        <h3 className="font-medium text-sm text-[var(--foreground)] flex items-center gap-2">
          <Bot className="h-4 w-4 text-blue-500" />
          AI 對話助手
        </h3>
      </div>

      <ScrollArea ref={scrollRef} className="flex-1 p-4">
        <div className="space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-sm text-[var(--muted-foreground)] py-8">
              <Bot className="h-8 w-8 mx-auto mb-2 text-[var(--muted-foreground)]" />
              <p>可以在分析過程中隨時提問</p>
              <p className="text-xs mt-1">例如：「幫我查這個 IP 的情報」</p>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                'flex gap-3',
                message.role === 'user' ? 'justify-end' : 'justify-start'
              )}
            >
              {message.role === 'assistant' && (
                <div className="h-8 w-8 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                  <Bot className="h-4 w-4 text-blue-600" />
                </div>
              )}

              <div
                className={cn(
                  'max-w-[80%] rounded-lg px-4 py-2 text-sm',
                  message.role === 'user'
                    ? 'bg-blue-500 text-white'
                    : 'bg-[var(--muted)] text-[var(--foreground)]'
                )}
              >
                <p className="whitespace-pre-wrap">{message.content}</p>
                <p
                  className={cn(
                    'text-xs mt-1',
                    message.role === 'user' ? 'text-blue-100' : 'text-[var(--muted-foreground)]'
                  )}
                >
                  {new Date(message.timestamp).toLocaleTimeString('zh-TW')}
                </p>
              </div>

              {message.role === 'user' && (
                <div className="h-8 w-8 rounded-full bg-[var(--muted)] flex items-center justify-center flex-shrink-0">
                  <User className="h-4 w-4 text-[var(--muted-foreground)]" />
                </div>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>

      <form onSubmit={handleSubmit} className="p-4 border-t border-[var(--border)] bg-[var(--muted)]/40">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="輸入問題..."
            disabled={disabled}
            className="flex-1"
          />
          <Button type="submit" size="icon" disabled={disabled || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}
