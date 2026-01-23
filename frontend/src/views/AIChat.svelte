<script lang="ts">
  import { onMount } from 'svelte';
  import { api, type Post } from '$lib/api';
  import { marked } from 'marked';
  import { 
    ChevronLeft, Send, Loader2, Bot, User, 
    FileText, Image, Music, Video, Link2, Paperclip,
    ExternalLink, Sparkles
  } from 'lucide-svelte';

  // Configure marked for safe rendering
  marked.setOptions({
    breaks: true,
    gfm: true,
  });

  // Parse markdown to HTML
  function parseMarkdown(content: string): string {
    return marked.parse(content) as string;
  }

  interface Props {
    onnavigate?: (detail?: { postId?: string; view?: 'input' | 'canvas' | 'chat' }) => void;
  }

  let { onnavigate }: Props = $props();

  // ═══════════════════════════════════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════════════════════════════════

  interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    sources?: { id: string; preview: string }[];
    timestamp: Date;
  }

  let messages = $state<Message[]>([]);
  let inputValue = $state('');
  let loading = $state(false);
  let inputEl: HTMLTextAreaElement;
  let messagesEl: HTMLDivElement;

  // Suggested prompts for empty state
  const suggestions = [
    "What did I save about project deadlines?",
    "Summarize my recent notes",
    "Find links I saved about design",
    "What tasks do I have pending?",
    "Show me ideas I had last week"
  ];

  // Colors by content type
  const TYPE_COLORS: Record<string, string> = {
    text: '#6b7280',
    image: '#3b82f6',
    audio: '#10b981',
    video: '#ec4899',
    url: '#8b5cf6',
    file: '#f59e0b',
  };

  const TYPE_ICONS: Record<string, typeof FileText> = {
    text: FileText,
    image: Image,
    audio: Music,
    video: Video,
    url: Link2,
    file: Paperclip,
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // CHAT LOGIC
  // ═══════════════════════════════════════════════════════════════════════════

  async function sendMessage(content?: string) {
    const messageContent = content || inputValue.trim();
    if (!messageContent || loading) return;

    // Add user message
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: messageContent,
      timestamp: new Date(),
    };
    messages = [...messages, userMessage];
    inputValue = '';
    loading = true;

    // Auto-resize textarea
    if (inputEl) {
      inputEl.style.height = 'auto';
    }

    // Scroll to bottom
    setTimeout(() => scrollToBottom(), 50);

    try {
      const response = await api.ai.chat(messageContent);
      
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response.response,
        sources: response.sources,
        timestamp: new Date(),
      };
      messages = [...messages, assistantMessage];
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: "Sorry, I couldn't process that request. Please try again.",
        timestamp: new Date(),
      };
      messages = [...messages, errorMessage];
    } finally {
      loading = false;
      setTimeout(() => scrollToBottom(), 50);
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function handleInput() {
    // Auto-resize textarea
    if (inputEl) {
      inputEl.style.height = 'auto';
      inputEl.style.height = Math.min(inputEl.scrollHeight, 200) + 'px';
    }
  }

  function scrollToBottom() {
    if (messagesEl) {
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }
  }

  function navigateToPost(postId: string) {
    onnavigate?.({ postId });
  }

  function handleSuggestionClick(suggestion: string) {
    sendMessage(suggestion);
  }

  onMount(() => {
    inputEl?.focus();
  });
</script>

<div class="chat-container">
  <!-- Header -->
  <header class="chat-header">
    <button class="back-btn" onclick={() => onnavigate?.({ view: 'input' })}>
      <ChevronLeft size={20} />
      <span>Back</span>
    </button>
    
    <div class="header-title">
      <Sparkles size={20} />
      <h1>AI Chat</h1>
    </div>
    
    <div class="header-spacer"></div>
  </header>

  <!-- Messages Area -->
  <div class="messages-area" bind:this={messagesEl}>
    {#if messages.length === 0}
      <!-- Empty State -->
      <div class="empty-state">
        <div class="empty-icon">
          <Bot size={48} />
        </div>
        <h2>Ask me anything about your posts</h2>
        <p>I can search through your saved content, find connections, and help you remember things.</p>
        
        <div class="suggestions">
          {#each suggestions as suggestion}
            <button 
              class="suggestion-chip"
              onclick={() => handleSuggestionClick(suggestion)}
            >
              {suggestion}
            </button>
          {/each}
        </div>
      </div>
    {:else}
      <!-- Message List -->
      <div class="messages-list">
        {#each messages as message (message.id)}
          <div class="message {message.role}">
            <div class="message-avatar">
              {#if message.role === 'user'}
                <User size={18} />
              {:else}
                <Bot size={18} />
              {/if}
            </div>
            
            <div class="message-content">
              {#if message.role === 'assistant'}
                <div class="message-text prose">{@html parseMarkdown(message.content)}</div>
              {:else}
                <div class="message-text">{message.content}</div>
              {/if}
              
              {#if message.sources && message.sources.length > 0}
                <div class="message-sources">
                  <span class="sources-label">Sources:</span>
                  {#each message.sources as source}
                    <button 
                      class="source-card"
                      onclick={() => navigateToPost(source.id)}
                    >
                      <span class="source-preview">{source.preview}</span>
                      <ExternalLink size={12} />
                    </button>
                  {/each}
                </div>
              {/if}
              
              <div class="message-time">
                {message.timestamp.toLocaleTimeString('en-US', { 
                  hour: 'numeric', 
                  minute: '2-digit' 
                })}
              </div>
            </div>
          </div>
        {/each}
        
        {#if loading}
          <div class="message assistant">
            <div class="message-avatar">
              <Bot size={18} />
            </div>
            <div class="message-content">
              <div class="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        {/if}
      </div>
    {/if}
  </div>

  <!-- Input Area -->
  <div class="input-area">
    <div class="input-wrapper">
      <textarea
        bind:this={inputEl}
        bind:value={inputValue}
        placeholder="Ask about your posts..."
        onkeydown={handleKeydown}
        oninput={handleInput}
        rows="1"
        disabled={loading}
      ></textarea>
      
      <button 
        class="send-btn" 
        onclick={() => sendMessage()}
        disabled={!inputValue.trim() || loading}
      >
        {#if loading}
          <Loader2 size={20} class="spin" />
        {:else}
          <Send size={20} />
        {/if}
      </button>
    </div>
    
    <p class="input-hint">
      Press Enter to send, Shift+Enter for new line
    </p>
  </div>
</div>

<style>
  .chat-container {
    width: 100%;
    height: 100vh;
    display: flex;
    flex-direction: column;
    background: var(--color-bg, #08080c);
  }

  /* Header */
  .chat-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 20px;
    background: var(--color-bg, #08080c);
    backdrop-filter: blur(10px);
    border-bottom: 1px solid var(--color-border, #1e1e26);
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    z-index: 10;
  }

  .back-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 8px 12px;
    background: transparent;
    border: 1px solid var(--color-border, #1e1e26);
    border-radius: 8px;
    color: var(--color-muted, #71717a);
    cursor: pointer;
    transition: all 0.2s;
  }

  .back-btn:hover {
    background: var(--color-surface, #121218);
    color: var(--color-fg, #fafafa);
  }

  .header-title {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--color-primary, #6366f1);
  }

  .header-title h1 {
    font-size: 18px;
    font-weight: 600;
    margin: 0;
    color: var(--color-fg, #fafafa);
  }

  .header-spacer {
    width: 80px;
  }

  /* Messages Area */
  .messages-area {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
  }

  /* Empty State */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    text-align: center;
    padding: 40px 20px;
  }

  .empty-icon {
    width: 80px;
    height: 80px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-primary-dim, rgba(99, 102, 241, 0.15));
    border-radius: 20px;
    color: var(--color-primary, #6366f1);
    margin-bottom: 24px;
  }

  .empty-state h2 {
    font-size: 24px;
    font-weight: 600;
    color: var(--color-fg, #fafafa);
    margin: 0 0 12px 0;
  }

  .empty-state p {
    font-size: 15px;
    color: var(--color-muted, #71717a);
    max-width: 400px;
    margin: 0 0 32px 0;
    line-height: 1.5;
  }

  .suggestions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    justify-content: center;
    max-width: 500px;
  }

  .suggestion-chip {
    padding: 10px 16px;
    background: var(--color-surface, #121218);
    border: 1px solid var(--color-border, #1e1e26);
    border-radius: 20px;
    color: var(--color-muted, #71717a);
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .suggestion-chip:hover {
    background: var(--color-primary-dim, rgba(99, 102, 241, 0.15));
    border-color: var(--color-primary, #6366f1);
    color: var(--color-primary, #6366f1);
  }

  /* Messages */
  .messages-list {
    display: flex;
    flex-direction: column;
    gap: 20px;
    max-width: 800px;
    margin: 0 auto;
  }

  .message {
    display: flex;
    gap: 12px;
  }

  .message.user {
    flex-direction: row-reverse;
  }

  .message-avatar {
    width: 36px;
    height: 36px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 10px;
    background: var(--color-surface, #121218);
    color: var(--color-muted, #71717a);
  }

  .message.assistant .message-avatar {
    background: var(--color-primary-dim, rgba(99, 102, 241, 0.15));
    color: var(--color-primary, #6366f1);
  }

  .message.user .message-avatar {
    background: var(--color-primary-dim, rgba(99, 102, 241, 0.15));
    color: var(--color-primary, #6366f1);
  }

  .message-content {
    max-width: 85%;
  }

  .message.user .message-content {
    text-align: right;
  }

  .message-text {
    padding: 16px 20px;
    border-radius: 16px;
    font-size: 15px;
    line-height: 1.6;
  }

  /* AI Response - Light paper background */
  .message.assistant .message-text {
    background: var(--paper-light, linear-gradient(175deg, #fffef8 0%, #f5f4e8 50%, #eae8d8 100%));
    color: var(--paper-text-dark, #1a1a1a);
    border-bottom-left-radius: 4px;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
  }

  /* User message - Primary gradient */
  .message.user .message-text {
    background: var(--color-primary, #6366f1);
    color: white;
    border-bottom-right-radius: 4px;
    white-space: pre-wrap;
  }

  /* Markdown prose styling for AI responses */
  .message.assistant .message-text.prose {
    max-width: none;
  }

  .message.assistant .message-text.prose :global(p) {
    margin: 0 0 12px 0;
  }

  .message.assistant .message-text.prose :global(p:last-child) {
    margin-bottom: 0;
  }

  .message.assistant .message-text.prose :global(h1),
  .message.assistant .message-text.prose :global(h2),
  .message.assistant .message-text.prose :global(h3),
  .message.assistant .message-text.prose :global(h4) {
    color: var(--paper-text-dark, #1a1a1a);
    margin: 16px 0 8px 0;
    font-weight: 600;
  }

  .message.assistant .message-text.prose :global(h1:first-child),
  .message.assistant .message-text.prose :global(h2:first-child),
  .message.assistant .message-text.prose :global(h3:first-child) {
    margin-top: 0;
  }

  .message.assistant .message-text.prose :global(ul),
  .message.assistant .message-text.prose :global(ol) {
    margin: 8px 0;
    padding-left: 20px;
  }

  .message.assistant .message-text.prose :global(li) {
    margin: 4px 0;
  }

  .message.assistant .message-text.prose :global(code) {
    background: rgba(0, 0, 0, 0.08);
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 13px;
    font-family: 'SF Mono', Monaco, Consolas, monospace;
  }

  .message.assistant .message-text.prose :global(pre) {
    background: #1e1e2e;
    color: #cdd6f4;
    padding: 12px 16px;
    border-radius: 8px;
    overflow-x: auto;
    margin: 12px 0;
  }

  .message.assistant .message-text.prose :global(pre code) {
    background: none;
    padding: 0;
    color: inherit;
  }

  .message.assistant .message-text.prose :global(a) {
    color: var(--color-primary, #6366f1);
    text-decoration: none;
  }

  .message.assistant .message-text.prose :global(a:hover) {
    text-decoration: underline;
  }

  .message.assistant .message-text.prose :global(table) {
    width: 100%;
    border-collapse: collapse;
    margin: 12px 0;
    font-size: 14px;
  }

  .message.assistant .message-text.prose :global(th),
  .message.assistant .message-text.prose :global(td) {
    padding: 8px 12px;
    border: 1px solid rgba(0, 0, 0, 0.1);
    text-align: left;
  }

  .message.assistant .message-text.prose :global(th) {
    background: rgba(0, 0, 0, 0.05);
    font-weight: 600;
  }

  .message.assistant .message-text.prose :global(tr:nth-child(even)) {
    background: rgba(0, 0, 0, 0.02);
  }

  .message.assistant .message-text.prose :global(blockquote) {
    border-left: 3px solid var(--color-primary, #6366f1);
    padding-left: 16px;
    margin: 12px 0;
    color: var(--paper-text-muted, #555);
    font-style: italic;
  }

  .message.assistant .message-text.prose :global(hr) {
    border: none;
    border-top: 1px solid rgba(0, 0, 0, 0.1);
    margin: 16px 0;
  }

  .message.assistant .message-text.prose :global(strong) {
    font-weight: 600;
    color: var(--paper-text-dark, #1a1a1a);
  }

  .message-sources {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 12px;
    align-items: center;
  }

  .sources-label {
    font-size: 12px;
    color: var(--color-muted, #71717a);
  }

  .source-card {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background: var(--color-primary-dim, rgba(99, 102, 241, 0.15));
    border: 1px solid rgba(99, 102, 241, 0.3);
    border-radius: 8px;
    color: var(--color-primary, #6366f1);
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .source-card:hover {
    background: rgba(99, 102, 241, 0.25);
    border-color: var(--color-primary, #6366f1);
  }

  .source-preview {
    max-width: 150px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .message-time {
    font-size: 11px;
    color: var(--color-muted, #71717a);
    margin-top: 6px;
  }

  /* Typing Indicator */
  .typing-indicator {
    display: flex;
    gap: 4px;
    padding: 12px 16px;
    background: var(--paper-light, linear-gradient(175deg, #fffef8 0%, #f5f4e8 50%, #eae8d8 100%));
    border-radius: 16px;
    border-bottom-left-radius: 4px;
  }

  .typing-indicator span {
    width: 8px;
    height: 8px;
    background: var(--color-muted, #71717a);
    border-radius: 50%;
    animation: bounce 1.4s infinite ease-in-out both;
  }

  .typing-indicator span:nth-child(1) { animation-delay: -0.32s; }
  .typing-indicator span:nth-child(2) { animation-delay: -0.16s; }
  .typing-indicator span:nth-child(3) { animation-delay: 0s; }

  @keyframes bounce {
    0%, 80%, 100% { transform: scale(0); }
    40% { transform: scale(1); }
  }

  /* Input Area */
  .input-area {
    padding: 16px 20px 20px;
    background: var(--color-bg, #08080c);
    border-top: 1px solid var(--color-border, #1e1e26);
  }

  .input-wrapper {
    display: flex;
    gap: 12px;
    align-items: flex-end;
    max-width: 800px;
    margin: 0 auto;
    background: var(--color-surface, #121218);
    border: 1px solid var(--color-border, #1e1e26);
    border-radius: 16px;
    padding: 8px 8px 8px 16px;
  }

  .input-wrapper:focus-within {
    border-color: var(--color-primary, #6366f1);
    box-shadow: 0 0 0 3px var(--color-primary-dim, rgba(99, 102, 241, 0.15));
  }

  .input-wrapper textarea {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    color: var(--color-fg, #fafafa);
    font-size: 15px;
    line-height: 1.5;
    resize: none;
    min-height: 24px;
    max-height: 200px;
    padding: 6px 0;
  }

  .input-wrapper textarea::placeholder {
    color: var(--color-muted, #71717a);
  }

  .input-wrapper textarea:disabled {
    opacity: 0.5;
  }

  .send-btn {
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-primary, #6366f1);
    border: none;
    border-radius: 12px;
    color: white;
    cursor: pointer;
    transition: all 0.2s;
    flex-shrink: 0;
  }

  .send-btn:hover:not(:disabled) {
    background: var(--color-primary-hover, #818cf8);
    transform: scale(1.05);
  }

  .send-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .input-hint {
    font-size: 11px;
    color: var(--color-muted, #71717a);
    text-align: center;
    margin: 8px 0 0 0;
  }

  :global(.spin) {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
</style>
