<script lang="ts">
  import InputHome from './views/InputHome.svelte';
  import Canvas from './views/Canvas.svelte';
  import AIChat from './views/AIChat.svelte';
  
  // Router state
  let currentView = $state<'input' | 'canvas' | 'chat'>('input');
  let searchParam = $state('');
  let postIdParam = $state('');
  
  function handleNavigate(detail?: { search?: string; postId?: string; view?: 'input' | 'canvas' | 'chat' }) {
    if (detail?.view) {
      currentView = detail.view;
      searchParam = '';
      postIdParam = '';
    } else if (detail?.search) {
      searchParam = detail.search;
      currentView = 'canvas';
    } else if (detail?.postId) {
      postIdParam = detail.postId;
      currentView = 'canvas';
    } else {
      // Toggle between input and canvas (default behavior)
      currentView = currentView === 'input' ? 'canvas' : 'input';
      searchParam = '';
      postIdParam = '';
    }
  }
  
  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && currentView !== 'input') {
      handleNavigate({ view: 'input' });
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<main class="app-container">
  {#if currentView === 'input'}
    <InputHome onnavigate={handleNavigate} />
  {:else if currentView === 'canvas'}
    <Canvas 
      initialSearch={searchParam} 
      initialPostId={postIdParam}
      onnavigate={handleNavigate} 
    />
  {:else if currentView === 'chat'}
    <AIChat onnavigate={handleNavigate} />
  {/if}
</main>

<style>
  .app-container {
    min-height: 100vh;
    width: 100%;
  }
</style>
