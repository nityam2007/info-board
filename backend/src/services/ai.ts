import { Groq } from 'groq-sdk';
import { CONFIG } from '../config.js';
import { readFileSync } from 'fs';

// Initialize Groq client
const groq = new Groq({
  apiKey: CONFIG.GROQ_API_KEY,
});

// Text model for general tasks
const TEXT_MODEL = 'openai/gpt-oss-20b';

// Vision model for image analysis (Llama 4 Scout - faster, good quality)
const VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
}

async function callGroq(messages: Message[], model: string = TEXT_MODEL): Promise<string> {
  if (!CONFIG.AI_ENABLED || !CONFIG.GROQ_API_KEY) {
    throw new Error('AI is not enabled or API key is missing');
  }

  const chatCompletion = await groq.chat.completions.create({
    messages: messages as any,
    model,
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

// Analyze image content with vision model (OCR + description)
export async function analyzeImage(imagePath: string): Promise<{ 
  ocrText: string; 
  description: string; 
  tags: string[];
}> {
  if (!CONFIG.AI_ENABLED || !CONFIG.GROQ_API_KEY) {
    console.log('AI not enabled, skipping image analysis');
    return { ocrText: '', description: '', tags: [] };
  }

  try {
    // Read image and convert to base64
    const imageBuffer = readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');
    
    // Detect mime type from extension
    const ext = imagePath.toLowerCase().split('.').pop();
    const mimeType = ext === 'png' ? 'image/png' 
      : ext === 'gif' ? 'image/gif'
      : ext === 'webp' ? 'image/webp'
      : 'image/jpeg';
    
    const imageUrl = `data:${mimeType};base64,${base64Image}`;

    // Combined prompt for OCR, description, and tags
    const systemPrompt = `You are an image analysis assistant. Analyze the image and provide:
1. Any text visible in the image (OCR) - extract ALL readable text
2. A brief description of what the image shows
3. 3-5 relevant tags for categorizing this image

Return your response in this exact JSON format:
{
  "ocrText": "extracted text here or empty string if no text",
  "description": "brief description of the image",
  "tags": ["tag1", "tag2", "tag3"]
}

Return ONLY valid JSON, nothing else.`;

    const response = await callGroq([
      { role: 'system', content: systemPrompt },
      { 
        role: 'user', 
        content: [
          { type: 'text', text: 'Analyze this image:' },
          { type: 'image_url', image_url: { url: imageUrl } }
        ]
      },
    ], VISION_MODEL);

    // Parse JSON response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        ocrText: parsed.ocrText || '',
        description: parsed.description || '',
        tags: Array.isArray(parsed.tags) ? parsed.tags : [],
      };
    }

    console.warn('Could not parse image analysis response:', response);
    return { ocrText: '', description: '', tags: [] };

  } catch (error) {
    console.error('Image analysis failed:', error);
    return { ocrText: '', description: '', tags: [] };
  }
}

// Analyze image from base64 directly (for uploads before saving)
export async function analyzeImageBase64(base64Data: string, mimeType: string): Promise<{ 
  ocrText: string; 
  description: string; 
  tags: string[];
}> {
  if (!CONFIG.AI_ENABLED || !CONFIG.GROQ_API_KEY) {
    console.log('AI not enabled, skipping image analysis');
    return { ocrText: '', description: '', tags: [] };
  }

  try {
    const imageUrl = `data:${mimeType};base64,${base64Data}`;

    const systemPrompt = `You are an image analysis assistant. Analyze the image and provide:
1. Any text visible in the image (OCR) - extract ALL readable text
2. A brief description of what the image shows
3. 3-5 relevant tags for categorizing this image

Return your response in this exact JSON format:
{
  "ocrText": "extracted text here or empty string if no text",
  "description": "brief description of the image",
  "tags": ["tag1", "tag2", "tag3"]
}

Return ONLY valid JSON, nothing else.`;

    const response = await callGroq([
      { role: 'system', content: systemPrompt },
      { 
        role: 'user', 
        content: [
          { type: 'text', text: 'Analyze this image:' },
          { type: 'image_url', image_url: { url: imageUrl } }
        ]
      },
    ], VISION_MODEL);

    // Parse JSON response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        ocrText: parsed.ocrText || '',
        description: parsed.description || '',
        tags: Array.isArray(parsed.tags) ? parsed.tags : [],
      };
    }

    console.warn('Could not parse image analysis response:', response);
    return { ocrText: '', description: '', tags: [] };

  } catch (error) {
    console.error('Image analysis failed:', error);
    return { ocrText: '', description: '', tags: [] };
  }
}

// Transcribe audio content using Whisper
export async function transcribeAudio(audioPath: string): Promise<string> {
  if (!CONFIG.AI_ENABLED || !CONFIG.GROQ_API_KEY) {
    console.log('AI not enabled, skipping audio transcription');
    return '';
  }

  try {
    const audioBuffer = readFileSync(audioPath);
    const audioFile = new File([audioBuffer], 'audio.mp3', { type: 'audio/mpeg' });

    const transcription = await groq.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-large-v3-turbo',
      response_format: 'text',
    });

    return typeof transcription === 'string' ? transcription : (transcription as any).text || '';
  } catch (error) {
    console.error('Audio transcription failed:', error);
    return '';
  }
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
