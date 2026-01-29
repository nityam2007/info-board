<script lang="ts">
  import InputHome from './views/InputHome.svelte';
  import Canvas from './views/Canvas.svelte';
  import AIChat from './views/AIChat.svelte';
  import Admin from './views/Admin.svelte';
  
  // Router state
  let currentView = $state<'input' | 'canvas' | 'chat' | 'admin'>('input');
  let searchParam = $state('');
  let postIdParam = $state('');
  let transitioning = $state(false);
  
  function handleNavigate(detail?: { search?: string; postId?: string; view?: 'input' | 'canvas' | 'chat' | 'admin' }) {
    // Start transition
    transitioning = true;
    
    setTimeout(() => {
      if (detail?.view) {
        currentView = detail.view;
        // Check if search is defined (including empty string for focus-search mode)
        searchParam = detail.search !== undefined ? detail.search : '';
        postIdParam = '';
      } else if (detail?.search !== undefined) {
        // search can be empty string (means focus search bar)
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
      
      // End transition
      setTimeout(() => {
        transitioning = false;
      }, 50);
    }, 150);
  }
  
  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && currentView !== 'input') {
      handleNavigate({ view: 'input' });
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<main class="app-container" class:transitioning>
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
  {:else if currentView === 'admin'}
    <Admin onnavigate={handleNavigate} />
  {/if}
</main>

<style>
  .app-container {
    min-height: 100vh;
    width: 100%;
    opacity: 1;
    transition: opacity 0.15s ease-out;
  }
  
  .app-container.transitioning {
    opacity: 0;
  }
</style>
