const API_BASE = 'http://localhost:3000/api';

// Sample text posts
const textPosts = [
  "Just had an amazing coffee at the new cafe downtown. The barista really knows their craft!",
  "Note to self: Always test your code before pushing to production. Learned this the hard way today.",
  "Reading 'Atomic Habits' by James Clear. The 1% improvement concept is mind-blowing.",
  "The quick brown fox jumps over the lazy dog. This is a longer text post to test how multi-line content displays on the canvas. It should wrap nicely and show a preview.",
  "Ideas for the weekend project: 1) Add AI-powered tagging 2) Implement semantic search 3) Build mobile app",
  "Debugging tip: console.table() is way more useful than console.log() for arrays and objects",
  "API design principle: Make the simple things easy and the complex things possible",
  "Remember: Good code is code that can be easily deleted, not code that is easy to extend",
  "TIL: You can use CSS container queries to create truly responsive components without media queries",
  "The best user interfaces are the ones that feel like they were always there - invisible yet powerful",
  "Morning coffee thoughts: Sometimes the best code is the code you don't write",
  "Building something cool with Svelte 5. The new runes system is a game changer!",
  "Just finished reading an amazing book about distributed systems. Highly recommend it for anyone interested in backend architecture.",
  "GitHub Copilot is like having a junior developer who never sleeps but sometimes hallucinates",
  "Pro tip: Use git stash more often. It's a lifesaver when you need to quickly switch contexts",
  "Hello World! This is my first post on the info board.",
  "whatsup",
  "hii",
  "Capture anything",
  "Testing multi-line content:\n- Point 1\n- Point 2\n- Point 3",
  "The art of programming is the art of organizing complexity",
  "Simple is better than complex. Complex is better than complicated.",
  "Code review tip: Review the tests first, they tell you what the code should do",
  "Never trust user input. Ever. Validate everything.",
  "The best time to plant a tree was 20 years ago. The second best time is now.",
  "DRY is good, but don't repeat yourself blindly. Sometimes duplication is fine.",
  "Premature optimization is the root of all evil - Donald Knuth",
  "Make it work, make it right, make it fast - in that order",
  "A good API is not just easy to use but also hard to misuse",
  "Documentation is a love letter to your future self",
  "Learned something new about TypeScript generics today. They're more powerful than I thought!",
  "Current mood: debugging production issues at 2am",
  "Hot take: Most design patterns are overused and add unnecessary complexity",
  "The best developers are the ones who can explain complex things simply",
  "Started using Obsidian for note-taking. Game changer for connecting ideas.",
  "Remember to take breaks. Your brain needs time to process information.",
  "Just deployed my first Kubernetes cluster. Feels like magic when it works!",
  "CSS Grid is amazing. Why did I wait so long to learn it properly?",
  "Reading about WebAssembly - the future of web performance looks bright",
  "Shower thought: Code is just instructions for a very literal-minded friend",
];

// Sample URLs
const urls = [
  "https://nodejs.org",
  "https://svelte.dev",
  "https://github.com",
  "https://duckdb.org",
  "https://www.typescriptlang.org",
  "https://tailwindcss.com",
  "https://vitejs.dev",
  "https://developer.mozilla.org",
  "https://stackoverflow.com",
  "https://news.ycombinator.com",
  "https://reddit.com/r/programming",
  "https://dev.to",
  "https://medium.com",
  "https://css-tricks.com",
  "https://smashingmagazine.com",
  "https://web.dev",
  "https://expressjs.com",
  "https://bun.sh",
  "https://sqlite.org",
  "https://vercel.com",
  "https://netlify.com",
  "https://cloudflare.com",
  "https://prisma.io",
  "https://trpc.io",
  "https://remix.run",
];

// Sample image URLs to download
const imageUrls = [
  "https://picsum.photos/800/600",
  "https://picsum.photos/600/800",
  "https://picsum.photos/1000/600",
  "https://picsum.photos/700/700",
  "https://picsum.photos/900/500",
  "https://picsum.photos/500/900",
  "https://picsum.photos/800/800",
  "https://picsum.photos/1200/600",
  "https://picsum.photos/600/400",
  "https://picsum.photos/400/600",
  "https://picsum.photos/800/500",
  "https://picsum.photos/500/800",
  "https://picsum.photos/750/550",
  "https://picsum.photos/550/750",
  "https://picsum.photos/900/600",
  "https://picsum.photos/600/900",
  "https://picsum.photos/1000/800",
  "https://picsum.photos/800/1000",
  "https://picsum.photos/700/500",
  "https://picsum.photos/500/700",
  "https://picsum.photos/640/480",
  "https://picsum.photos/480/640",
  "https://picsum.photos/1280/720",
  "https://picsum.photos/720/1280",
  "https://picsum.photos/850/650",
  "https://picsum.photos/650/850",
  "https://picsum.photos/920/580",
  "https://picsum.photos/580/920",
  "https://picsum.photos/760/540",
  "https://picsum.photos/540/760",
];

async function createTextPost(content) {
  const res = await fetch(`${API_BASE}/posts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, source: 'manual' })
  });
  return res.json();
}

async function createUrlPost(url) {
  const res = await fetch(`${API_BASE}/upload/url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, source: 'manual' })
  });
  return res.json();
}

async function createImagePost(imageUrl) {
  // Download image and convert to base64
  const res = await fetch(imageUrl);
  const buffer = await res.arrayBuffer();
  const base64 = Buffer.from(buffer).toString('base64');
  const dataUrl = `data:image/jpeg;base64,${base64}`;
  
  const uploadRes = await fetch(`${API_BASE}/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      content: dataUrl, 
      filename: `image-${Date.now()}.jpg`,
      source: 'manual' 
    })
  });
  return uploadRes.json();
}

async function seed() {
  console.log('🌱 Seeding database with test data...\n');
  
  // Create text posts
  console.log('📝 Creating text posts...');
  for (let i = 0; i < textPosts.length; i++) {
    try {
      await createTextPost(textPosts[i]);
      process.stdout.write(`\r  Text: ${i + 1}/${textPosts.length}`);
    } catch (e) {
      console.error(`\n  Failed: ${e.message}`);
    }
  }
  console.log(' ✓');
  
  // Create URL posts
  console.log('🔗 Creating URL posts...');
  for (let i = 0; i < urls.length; i++) {
    try {
      await createUrlPost(urls[i]);
      process.stdout.write(`\r  URLs: ${i + 1}/${urls.length}`);
    } catch (e) {
      console.error(`\n  Failed: ${e.message}`);
    }
  }
  console.log(' ✓');
  
  // Create image posts
  console.log('🖼️  Creating image posts...');
  for (let i = 0; i < imageUrls.length; i++) {
    try {
      await createImagePost(imageUrls[i]);
      process.stdout.write(`\r  Images: ${i + 1}/${imageUrls.length}`);
      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 100));
    } catch (e) {
      console.error(`\n  Failed: ${e.message}`);
    }
  }
  console.log(' ✓');
  
  console.log('\n✅ Done! Created:');
  console.log(`   - ${textPosts.length} text posts`);
  console.log(`   - ${urls.length} URL posts`);
  console.log(`   - ${imageUrls.length} image posts`);
  console.log(`   Total: ${textPosts.length + urls.length + imageUrls.length} posts`);
}

seed().catch(console.error);
