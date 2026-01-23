import { Groq } from 'groq-sdk';
import { CONFIG } from '../config.js';

// Initialize Groq client
const groq = new Groq({
  apiKey: CONFIG.GROQ_API_KEY,
});

const MODEL = 'openai/gpt-oss-20b';

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

async function callGroq(messages: Message[]): Promise<string> {
  if (!CONFIG.AI_ENABLED || !CONFIG.GROQ_API_KEY) {
    throw new Error('AI is not enabled or API key is missing');
  }

  const chatCompletion = await groq.chat.completions.create({
    messages,
    model: MODEL,
    temperature: 0.3,
    max_completion_tokens: 1024,
    top_p: 1,
    stream: false,
  });

  return chatCompletion.choices[0]?.message?.content || '';
}

// Suggest tags for a post
export async function suggestTags(content: string, contentType: string): Promise<string[]> {
  const systemPrompt = `You are a helpful assistant that suggests tags for content.
Given the content, suggest 3-5 relevant tags that would help organize and find this content later.
Return ONLY a JSON array of lowercase tag strings, nothing else.
Example: ["meeting", "project-alpha", "urgent", "follow-up"]`;

  const userPrompt = `Content type: ${contentType}
Content: ${content.slice(0, 1000)}

Suggest relevant tags:`;

  try {
    const response = await callGroq([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);
    
    // Parse JSON array from response
    const match = response.match(/\[.*\]/s);
    if (match) {
      return JSON.parse(match[0]);
    }
    return [];
  } catch (error) {
    console.error('Tag suggestion failed:', error);
    return [];
  }
}

// Extract tasks from content
export async function extractTasks(content: string): Promise<Array<{ description: string; dueDate?: string }>> {
  const systemPrompt = `You are a helpful assistant that extracts actionable tasks from content.
Given the content, identify any action items, to-dos, or tasks mentioned.
Return ONLY a JSON array of objects with "description" and optional "dueDate" (ISO format if date mentioned).
If no tasks found, return empty array.
Example: [{"description": "Follow up with John", "dueDate": "2026-01-25"}, {"description": "Review document"}]`;

  const userPrompt = `Content: ${content.slice(0, 1000)}

Extract tasks:`;

  try {
    const response = await callGroq([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);
    
    const match = response.match(/\[.*\]/s);
    if (match) {
      return JSON.parse(match[0]);
    }
    return [];
  } catch (error) {
    console.error('Task extraction failed:', error);
    return [];
  }
}

// Generate description for a post
export async function generateDescription(content: string, contentType: string): Promise<string> {
  const systemPrompt = `You are a helpful assistant that generates short descriptions for content.
Given the content, generate a brief 1-2 sentence description that captures the essence.
Return ONLY the description text, nothing else.`;

  const userPrompt = `Content type: ${contentType}
Content: ${content.slice(0, 1500)}

Generate a brief description:`;

  try {
    const response = await callGroq([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);
    return response.trim();
  } catch (error) {
    console.error('Description generation failed:', error);
    return '';
  }
}

// Analyze image content (for OCR placeholder - would need vision model)
export async function analyzeImage(imageUrl: string): Promise<{ text?: string; description?: string }> {
  // Note: For real OCR, you'd use a vision model or OCR service like Tesseract
  // Groq's GPT-OSS-20B is text-only, so this is a placeholder
  // In production, integrate with Google Vision API, AWS Textract, or Tesseract.js
  console.log('Image analysis requested for:', imageUrl);
  return { 
    text: '', 
    description: 'Image content - OCR not available in current model' 
  };
}

// Transcribe audio content (placeholder - would need whisper or similar)
export async function transcribeAudio(audioUrl: string): Promise<string> {
  // Note: For real transcription, you'd use Whisper API or similar
  // This is a placeholder for the architecture
  console.log('Audio transcription requested for:', audioUrl);
  return '';
}

// Chat with AI about posts
export async function chat(query: string, context: string[]): Promise<string> {
  const systemPrompt = `You are a helpful assistant for a personal knowledge board.
The user has saved various posts (notes, links, ideas) and wants to find or understand their content.
Answer based on the provided context. Be concise and helpful.
If you can't answer from the context, say so.`;

  const contextText = context.length > 0 
    ? `\n\nRelevant posts from the user's board:\n${context.slice(0, 5).join('\n---\n')}`
    : '';

  const userPrompt = `${query}${contextText}`;

  try {
    const response = await callGroq([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);
    return response;
  } catch (error) {
    console.error('Chat failed:', error);
    throw error;
  }
}
