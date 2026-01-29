<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { api, type Post } from '$lib/api';
  import { marked } from 'marked';
  import { 
    ChevronLeft, Send, Loader2, Bot, User, Trash2,
    FileText, Image, Music, Video, Link2, Paperclip,
    ExternalLink, Sparkles, MessageSquare, Plus
  } from 'lucide-svelte';

  // Configure marked for safe rendering
  marked.setOptions({
    breaks: true,
    gfm: true,
  });

  function parseMarkdown(content: string): string {
    return marked.parse(content) as string;
  }

  interface Props {
    onnavigate?: (detail?: { postId?: string; view?: 'input' | 'canvas' | 'chat' }) => void;
  }

  let { onnavigate }: Props = $props();

  // ═══════════════════════════════════════════════════════════════════════════
  // TYPES & STATE
  // ═══════════════════════════════════════════════════════════════════════════

  interface Message {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    sources?: { id: string; preview: string; type?: string }[];
    timestamp: Date;
    error?: boolean;
  }

  interface Conversation {
    id: string;
    title: string;
    messages: Message[];
    createdAt: Date;
    updatedAt: Date;
  }

  // State
  let conversations = $state<Conversation[]>([]);
  let activeConversation = $state<Conversation | null>(null);
  let inputValue = $state('');
  let loading = $state(false);
  let inputEl: HTMLTextAreaElement;
  let messagesEl: HTMLDivElement;
  let showSidebar = $state(true);

  // Context awareness - recent posts summary
  let recentPostsContext = $state<string>('');

  // Quick actions / suggestions
  const quickActions = [
    { label: "Summarize recent notes", query: "Summarize my most recent notes and thoughts" },
    { label: "Find links about...", query: "Find links I saved about " },
    { label: "What did I capture today?", query: "What did I capture today?" },
    { label: "Show tasks and TODOs", query: "What tasks or TODOs do I have?" },
    { label: "Connect related ideas", query: "Find connections between my recent captures" },
  ];

  // Type info for sources
  const TYPE_ICONS: Record<string, typeof FileText> = {
    text: FileText,
    image: Image,
    audio: Music,
    video: Video,
    url: Link2,
    file: Paperclip,
  };

  const TYPE_COLORS: Record<string, string> = {
    text: '#6b7280',
    image: '#3b82f6',
    audio: '#10b981',
    video: '#ec4899',
    url: '#8b5cf6',
    file: '#f59e0b',
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // CONVERSATION MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  function createNewConversation(): Conversation {
    const conv: Conversation = {
      id: crypto.randomUUID(),
      title: 'New conversation',
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    conversations = [conv, ...conversations];
    activeConversation = conv;
    saveConversations();
    return conv;
  }

  function selectConversation(conv: Conversation) {
    activeConversation = conv;
  }

  function deleteConversation(conv: Conversation) {
    conversations = conversations.filter(c => c.id !== conv.id);
    if (activeConversation?.id === conv.id) {
      activeConversation = conversations[0] || null;
    }
    saveConversations();
  }

  function updateConversationTitle(conv: Conversation, firstMessage: string) {
    conv.title = firstMessage.slice(0, 40) + (firstMessage.length > 40 ? '...' : '');
    conv.updatedAt = new Date();
    saveConversations();
  }

  // Persist conversations to localStorage
  function saveConversations() {
    try {
      localStorage.setItem('ai-chat-conversations', JSON.stringify(conversations));
    } catch (e) {
      console.warn('Failed to save conversations:', e);
    }
  }

  function loadConversations() {
    try {
      const saved = localStorage.getItem('ai-chat-conversations');
      if (saved) {
        const parsed = JSON.parse(saved);
        conversations = parsed.map((c: any) => ({
          ...c,
          createdAt: new Date(c.createdAt),
          updatedAt: new Date(c.updatedAt),
          messages: c.messages.map((m: any) => ({
            ...m,
            timestamp: new Date(m.timestamp),
          })),
        }));
        if (conversations.length > 0) {
          activeConversation = conversations[0];
        }
      }
    } catch (e) {
      console.warn('Failed to load conversations:', e);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CHAT LOGIC
  // ═══════════════════════════════════════════════════════════════════════════

  async function sendMessage(content?: string) {
    const messageContent = content || inputValue.trim();
    if (!messageContent || loading) return;

    // Ensure we have an active conversation
    if (!activeConversation) {
      createNewConversation();
    }

    const conv = activeConversation!;

    // Update title if this is the first message
    if (conv.messages.length === 0) {
      updateConversationTitle(conv, messageContent);
    }

    // Add user message
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: messageContent,
      timestamp: new Date(),
    };
    conv.messages = [...conv.messages, userMessage];
    conv.updatedAt = new Date();
    activeConversation = { ...conv };
    
    inputValue = '';
    loading = true;

    // Reset textarea height
    if (inputEl) {
      inputEl.style.height = 'auto';
    }

    await tick();
    scrollToBottom();

    try {
      const response = await api.ai.chat(messageContent);
      
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response.response,
        sources: response.sources?.map(s => ({
          ...s,
          type: 'text', // Default type, could be enhanced with actual type
        })),
        timestamp: new Date(),
      };
      conv.messages = [...conv.messages, assistantMessage];
      conv.updatedAt = new Date();
      activeConversation = { ...conv };
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: "Sorry, I couldn't process that request. Make sure AI is enabled in your settings.",
        timestamp: new Date(),
        error: true,
      };
      conv.messages = [...conv.messages, errorMessage];
      activeConversation = { ...conv };
    } finally {
      loading = false;
      saveConversations();
      await tick();
      scrollToBottom();
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function handleInput() {
    if (inputEl) {
      inputEl.style.height = 'auto';
      inputEl.style.height = Math.min(inputEl.scrollHeight, 150) + 'px';
    }
  }

  function scrollToBottom() {
    if (messagesEl) {
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }
  }

  function navigateToPost(postId: string) {
    onnavigate?.({ view: 'canvas', postId });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LIFECYCLE
  // ═══════════════════════════════════════════════════════════════════════════

  onMount(async () => {
    loadConversations();
    
    // Load context about recent posts
    try {
      const stats = await api.posts.stats();
      recentPostsContext = `You have ${stats.totalPosts} total posts. `;
      if (stats.postsToday > 0) {
        recentPostsContext += `${stats.postsToday} captured today. `;
      }
      if (stats.streak > 1) {
        recentPostsContext += `You're on a ${stats.streak}-day streak!`;
      }
    } catch (e) {
      // Stats not critical
    }
    
    inputEl?.focus();
  });

  // Format relative time
  function formatRelativeTime(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  }
</script>

<div class="chat-page">
  <!-- Sidebar -->
  <aside class="sidebar" class:collapsed={!showSidebar}>
    <div class="sidebar-header">
      <h2>Conversations</h2>
      <button class="new-chat-btn" onclick={() => createNewConversation()} title="New conversation">
        <Plus size={18} />
      </button>
    </div>
    
    <div class="conversation-list">
      {#if conversations.length === 0}
        <div class="no-conversations">
          <MessageSquare size={24} />
          <p>No conversations yet</p>
        </div>
      {:else}
        {#each conversations as conv (conv.id)}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div 
            class="conversation-item"
            class:active={activeConversation?.id === conv.id}
            onclick={() => selectConversation(conv)}
            onkeydown={(e) => e.key === 'Enter' && selectConversation(conv)}
            role="button"
            tabindex="0"
          >
            <div class="conv-content">
              <span class="conv-title">{conv.title}</span>
              <span class="conv-meta">{conv.messages.length} messages · {formatRelativeTime(conv.updatedAt)}</span>
            </div>
            <button 
              class="conv-delete"
              onclick={(e) => { e.stopPropagation(); deleteConversation(conv); }}
              title="Delete conversation"
            >
              <Trash2 size={14} />
            </button>
          </div>
        {/each}
      {/if}
    </div>
    
    <div class="sidebar-footer">
      <button class="back-btn" onclick={() => onnavigate?.({ view: 'input' })}>
        <ChevronLeft size={18} />
        <span>Back to Home</span>
      </button>
    </div>
  </aside>

  <!-- Main Chat Area -->
  <main class="chat-main">
    <!-- Header -->
    <header class="chat-header">
      <button class="toggle-sidebar" onclick={() => showSidebar = !showSidebar}>
        <MessageSquare size={18} />
      </button>
      <div class="header-title">
        <Sparkles size={20} />
        <h1>AI Assistant</h1>
      </div>
      {#if recentPostsContext}
        <span class="context-badge">{recentPostsContext}</span>
      {/if}
    </header>

    <!-- Messages -->
    <div class="messages-container" bind:this={messagesEl}>
      {#if !activeConversation || activeConversation.messages.length === 0}
        <!-- Empty State -->
        <div class="empty-state">
          <div class="empty-icon">
            <Bot size={48} />
          </div>
          <h2>Ask me anything</h2>
          <p>I can search through your posts, find patterns, summarize content, and help you discover connections.</p>
          
          <div class="quick-actions">
            {#each quickActions as action}
              <button 
                class="action-chip"
                onclick={() => sendMessage(action.query)}
              >
                {action.label}
              </button>
            {/each}
          </div>
        </div>
      {:else}
        <!-- Message List -->
        <div class="messages-list">
          {#each activeConversation.messages as message (message.id)}
            <div class="message {message.role}" class:error={message.error}>
              <div class="message-avatar">
                {#if message.role === 'user'}
                  <User size={18} />
                {:else}
                  <Bot size={18} />
                {/if}
              </div>
              
              <div class="message-body">
                {#if message.role === 'assistant'}
                  <div class="message-content prose">{@html parseMarkdown(message.content)}</div>
                {:else}
                  <div class="message-content">{message.content}</div>
                {/if}
                
                {#if message.sources && message.sources.length > 0}
                  <div class="message-sources">
                    <span class="sources-label">Referenced posts:</span>
                    <div class="sources-list">
                      {#each message.sources as source}
                        {@const Icon = TYPE_ICONS[source.type || 'text'] || FileText}
                        {@const color = TYPE_COLORS[source.type || 'text'] || '#6b7280'}
                        <button 
                          class="source-chip"
                          style="--source-color: {color}"
                          onclick={() => navigateToPost(source.id)}
                        >
                          <svelte:component this={Icon} size={12} />
                          <span>{source.preview}</span>
                          <ExternalLink size={10} />
                        </button>
                      {/each}
                    </div>
                  </div>
                {/if}
                
                <span class="message-time">
                  {message.timestamp.toLocaleTimeString('en-US', { 
                    hour: 'numeric', 
                    minute: '2-digit' 
                  })}
                </span>
              </div>
            </div>
          {/each}
          
          {#if loading}
            <div class="message assistant">
              <div class="message-avatar">
                <Bot size={18} />
              </div>
              <div class="message-body">
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
      <div class="input-container">
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
      <p class="input-hint">Enter to send · Shift+Enter for new line</p>
    </div>
  </main>
</div>

<style>
  .chat-page {
    display: flex;
    height: 100vh;
    background: var(--color-bg, #08080c);
  }

  /* Sidebar */
  .sidebar {
    width: 280px;
    background: var(--color-surface, #121218);
    border-right: 1px solid var(--color-border, #1e1e26);
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    transition: width 0.2s, margin 0.2s;
  }

  .sidebar.collapsed {
    width: 0;
    margin-left: -1px;
    overflow: hidden;
  }

  .sidebar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px;
    border-bottom: 1px solid var(--color-border, #1e1e26);
  }

  .sidebar-header h2 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--color-fg, #fafafa);
  }

  .new-chat-btn {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-primary, #6366f1);
    border: none;
    border-radius: 8px;
    color: white;
    cursor: pointer;
    transition: all 0.15s;
  }

  .new-chat-btn:hover {
    background: var(--color-primary-hover, #818cf8);
    transform: scale(1.05);
  }

  .conversation-list {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
  }

  .no-conversations {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 20px;
    color: var(--color-muted, #71717a);
    text-align: center;
  }

  .no-conversations p {
    margin: 12px 0 0;
    font-size: 13px;
  }

  .conversation-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 12px;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 10px;
    text-align: left;
    cursor: pointer;
    transition: all 0.15s;
    margin-bottom: 4px;
  }

  .conversation-item:hover {
    background: var(--color-bg, #08080c);
    border-color: var(--color-border, #1e1e26);
  }

  .conversation-item.active {
    background: var(--color-primary-dim, rgba(99, 102, 241, 0.15));
    border-color: var(--color-primary, #6366f1);
  }

  .conv-content {
    flex: 1;
    min-width: 0;
  }

  .conv-title {
    display: block;
    font-size: 13px;
    font-weight: 500;
    color: var(--color-fg, #fafafa);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .conv-meta {
    display: block;
    font-size: 11px;
    color: var(--color-muted, #71717a);
    margin-top: 2px;
  }

  .conv-delete {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: var(--color-muted, #71717a);
    cursor: pointer;
    opacity: 0;
    transition: all 0.15s;
  }

  .conversation-item:hover .conv-delete {
    opacity: 1;
  }

  .conv-delete:hover {
    background: rgba(239, 68, 68, 0.15);
    color: #ef4444;
  }

  .sidebar-footer {
    padding: 12px;
    border-top: 1px solid var(--color-border, #1e1e26);
  }

  .back-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 10px 12px;
    background: transparent;
    border: 1px solid var(--color-border, #1e1e26);
    border-radius: 8px;
    color: var(--color-muted, #71717a);
    font-size: 13px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .back-btn:hover {
    background: var(--color-bg, #08080c);
    color: var(--color-fg, #fafafa);
  }

  /* Main Chat */
  .chat-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .chat-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 20px;
    border-bottom: 1px solid var(--color-border, #1e1e26);
  }

  .toggle-sidebar {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: 1px solid var(--color-border, #1e1e26);
    border-radius: 8px;
    color: var(--color-muted, #71717a);
    cursor: pointer;
    transition: all 0.15s;
  }

  .toggle-sidebar:hover {
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
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--color-fg, #fafafa);
  }

  .context-badge {
    margin-left: auto;
    padding: 6px 12px;
    background: var(--color-surface, #121218);
    border-radius: 16px;
    font-size: 12px;
    color: var(--color-muted, #71717a);
  }

  /* Messages Container */
  .messages-container {
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
    max-width: 500px;
    margin: 0 auto;
  }

  .empty-icon {
    width: 80px;
    height: 80px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
    border-radius: 20px;
    color: white;
    margin-bottom: 24px;
    box-shadow: 0 8px 32px rgba(99, 102, 241, 0.3);
  }

  .empty-state h2 {
    margin: 0 0 12px;
    font-size: 24px;
    font-weight: 600;
    color: var(--color-fg, #fafafa);
  }

  .empty-state p {
    margin: 0 0 28px;
    font-size: 14px;
    color: var(--color-muted, #71717a);
    line-height: 1.6;
  }

  .quick-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: center;
  }

  .action-chip {
    padding: 10px 16px;
    background: var(--color-surface, #121218);
    border: 1px solid var(--color-border, #1e1e26);
    border-radius: 20px;
    color: var(--color-muted, #71717a);
    font-size: 13px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .action-chip:hover {
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
    background: var(--color-primary, #6366f1);
    color: white;
  }

  .message-body {
    max-width: 75%;
    min-width: 0;
  }

  .message.user .message-body {
    text-align: right;
  }

  .message-content {
    padding: 14px 18px;
    border-radius: 16px;
    font-size: 14px;
    line-height: 1.6;
  }

  .message.assistant .message-content {
    background: var(--color-surface, #121218);
    color: var(--color-fg, #fafafa);
    border-bottom-left-radius: 4px;
  }

  .message.user .message-content {
    background: var(--color-primary, #6366f1);
    color: white;
    border-bottom-right-radius: 4px;
    white-space: pre-wrap;
  }

  .message.error .message-content {
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #fca5a5;
  }

  /* Markdown Styles */
  .message-content.prose :global(p) {
    margin: 0 0 12px;
  }

  .message-content.prose :global(p:last-child) {
    margin-bottom: 0;
  }

  .message-content.prose :global(h1),
  .message-content.prose :global(h2),
  .message-content.prose :global(h3) {
    margin: 16px 0 8px;
    font-weight: 600;
    color: var(--color-fg, #fafafa);
  }

  .message-content.prose :global(ul),
  .message-content.prose :global(ol) {
    margin: 8px 0;
    padding-left: 20px;
  }

  .message-content.prose :global(li) {
    margin: 4px 0;
  }

  .message-content.prose :global(code) {
    background: rgba(0, 0, 0, 0.3);
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 13px;
    font-family: 'SF Mono', Monaco, Consolas, monospace;
  }

  .message-content.prose :global(pre) {
    background: #1e1e2e;
    padding: 12px 16px;
    border-radius: 8px;
    overflow-x: auto;
    margin: 12px 0;
  }

  .message-content.prose :global(pre code) {
    background: none;
    padding: 0;
  }

  .message-content.prose :global(a) {
    color: var(--color-primary-hover, #818cf8);
  }

  .message-content.prose :global(blockquote) {
    border-left: 3px solid var(--color-primary, #6366f1);
    padding-left: 16px;
    margin: 12px 0;
    color: var(--color-muted, #71717a);
    font-style: italic;
  }

  .message-content.prose :global(table) {
    width: 100%;
    border-collapse: collapse;
    margin: 12px 0;
    font-size: 13px;
  }

  .message-content.prose :global(th),
  .message-content.prose :global(td) {
    padding: 8px 12px;
    border: 1px solid var(--color-border, #1e1e26);
    text-align: left;
  }

  .message-content.prose :global(th) {
    background: var(--color-bg, #08080c);
    font-weight: 600;
  }

  /* Sources */
  .message-sources {
    margin-top: 12px;
  }

  .sources-label {
    display: block;
    font-size: 11px;
    color: var(--color-muted, #71717a);
    margin-bottom: 8px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .sources-list {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .source-chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 5px 10px;
    background: var(--color-bg, #08080c);
    border: 1px solid var(--color-border, #1e1e26);
    border-radius: 6px;
    color: var(--source-color);
    font-size: 11px;
    cursor: pointer;
    transition: all 0.15s;
    max-width: 180px;
  }

  .source-chip span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .source-chip:hover {
    background: var(--color-surface, #121218);
    border-color: var(--source-color);
  }

  .message-time {
    display: block;
    margin-top: 6px;
    font-size: 11px;
    color: var(--color-muted, #71717a);
  }

  /* Typing Indicator */
  .typing-indicator {
    display: flex;
    gap: 4px;
    padding: 14px 18px;
    background: var(--color-surface, #121218);
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

  @keyframes bounce {
    0%, 80%, 100% { transform: scale(0); }
    40% { transform: scale(1); }
  }

  /* Input Area */
  .input-area {
    padding: 16px 20px 20px;
    border-top: 1px solid var(--color-border, #1e1e26);
  }

  .input-container {
    display: flex;
    gap: 12px;
    align-items: flex-end;
    max-width: 800px;
    margin: 0 auto;
    background: var(--color-surface, #121218);
    border: 1px solid var(--color-border, #1e1e26);
    border-radius: 14px;
    padding: 8px 8px 8px 16px;
    transition: all 0.2s;
  }

  .input-container:focus-within {
    border-color: var(--color-primary, #6366f1);
    box-shadow: 0 0 0 3px var(--color-primary-dim, rgba(99, 102, 241, 0.15));
  }

  .input-container textarea {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    color: var(--color-fg, #fafafa);
    font-size: 14px;
    line-height: 1.5;
    resize: none;
    min-height: 24px;
    max-height: 150px;
    padding: 6px 0;
  }

  .input-container textarea::placeholder {
    color: var(--color-muted, #71717a);
  }

  .send-btn {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-primary, #6366f1);
    border: none;
    border-radius: 10px;
    color: white;
    cursor: pointer;
    transition: all 0.15s;
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
    margin: 8px 0 0;
  }

  :global(.spin) {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  /* Responsive */
  @media (max-width: 768px) {
    .sidebar {
      position: fixed;
      left: 0;
      top: 0;
      bottom: 0;
      z-index: 100;
      box-shadow: 4px 0 20px rgba(0, 0, 0, 0.5);
    }

    .sidebar.collapsed {
      transform: translateX(-100%);
      width: 280px;
      margin-left: 0;
    }

    .context-badge {
      display: none;
    }

    .message-body {
      max-width: 85%;
    }
  }
</style>
