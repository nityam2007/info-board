import { Groq } from 'groq-sdk';
import { CONFIG } from '../config.js';
import { readFileSync } from 'fs';
import sharp from 'sharp';

// Initialize Groq client
const groq = new Groq({
  apiKey: CONFIG.GROQ_API_KEY,
});

// Text model for general tasks
const TEXT_MODEL = 'openai/gpt-oss-20b';

// Vision model for image analysis (Llama 4 Scout - faster, 750 T/sec, 16 experts)
// NOTE: Must be enabled in Groq console at https://console.groq.com/settings/limits
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
    // Read image and detect actual format using sharp
    const imageBuffer = readFileSync(imagePath);
    const metadata = await sharp(imageBuffer).metadata();
    const actualFormat = metadata.format; // 'jpeg', 'png', 'webp', 'gif', 'avif', 'heif', etc.
    
    let base64Image: string;
    let mimeType: string;
    
    // Convert unsupported formats (AVIF, HEIF) to PNG
    // Groq vision API supports: jpeg, png, gif, webp
    if (actualFormat === 'avif' || actualFormat === 'heif') {
      console.log(`   Converting ${actualFormat.toUpperCase()} to PNG for API compatibility`);
      const pngBuffer = await sharp(imageBuffer).png().toBuffer();
      base64Image = pngBuffer.toString('base64');
      mimeType = 'image/png';
    } else {
      base64Image = imageBuffer.toString('base64');
      // Map sharp format to mime type
      mimeType = actualFormat === 'jpeg' ? 'image/jpeg'
        : actualFormat === 'png' ? 'image/png'
        : actualFormat === 'gif' ? 'image/gif'
        : actualFormat === 'webp' ? 'image/webp'
        : 'image/png'; // Default to PNG for unknown
    }
    
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

// Analyze text content for auto-tagging and summary
export async function analyzeText(content: string): Promise<{
  tags: string[];
  summary: string;
}> {
  if (!CONFIG.AI_ENABLED || !CONFIG.GROQ_API_KEY) {
    return { tags: [], summary: '' };
  }

  try {
    const systemPrompt = `You are a content analyzer. Analyze the text and provide:
1. 3-5 relevant tags for categorizing this content (lowercase, hyphenated for multi-word)
2. A brief 1-sentence summary

Return your response in this exact JSON format:
{
  "tags": ["tag1", "tag2", "tag3"],
  "summary": "Brief summary of the content"
}

Return ONLY valid JSON, nothing else.`;

    const response = await callGroq([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Analyze this text:\n\n${content.slice(0, 2000)}` },
    ]);

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        tags: Array.isArray(parsed.tags) ? parsed.tags : [],
        summary: parsed.summary || '',
      };
    }

    return { tags: [], summary: '' };
  } catch (error) {
    console.error('Text analysis failed:', error);
    return { tags: [], summary: '' };
  }
}

// Analyze URL content for auto-tagging
export async function analyzeUrl(title: string, description: string, url: string): Promise<{
  tags: string[];
  summary: string;
}> {
  if (!CONFIG.AI_ENABLED || !CONFIG.GROQ_API_KEY) {
    return { tags: [], summary: '' };
  }

  try {
    // Extract domain for context
    let domain = '';
    try {
      domain = new URL(url).hostname.replace('www.', '');
    } catch {}

    const systemPrompt = `You are a content analyzer for saved links/bookmarks. Analyze the URL metadata and provide:
1. 3-5 relevant tags for categorizing this link (lowercase, hyphenated for multi-word)
2. A brief 1-sentence summary if title/description are meaningful

Consider the source domain when suggesting tags (e.g., youtube -> video, github -> code, twitter -> social).

Return your response in this exact JSON format:
{
  "tags": ["tag1", "tag2", "tag3"],
  "summary": "Brief summary or empty string"
}

Return ONLY valid JSON, nothing else.`;

    const userContent = `URL: ${url}
Domain: ${domain}
Title: ${title || 'No title'}
Description: ${description || 'No description'}`;

    const response = await callGroq([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ]);

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        tags: Array.isArray(parsed.tags) ? parsed.tags : [],
        summary: parsed.summary || '',
      };
    }

    return { tags: [], summary: '' };
  } catch (error) {
    console.error('URL analysis failed:', error);
    return { tags: [], summary: '' };
  }
}

// Analyze audio: transcribe + extract tags
export async function analyzeAudio(audioPath: string): Promise<{
  transcription: string;
  tags: string[];
  summary: string;
}> {
  if (!CONFIG.AI_ENABLED || !CONFIG.GROQ_API_KEY) {
    return { transcription: '', tags: [], summary: '' };
  }

  try {
    // First transcribe
    console.log('   Transcribing audio...');
    const transcription = await transcribeAudio(audioPath);
    
    if (!transcription || transcription.trim().length === 0) {
      console.log('   No transcription available');
      return { transcription: '', tags: [], summary: '' };
    }

    console.log(`   Transcription: ${transcription.slice(0, 100)}...`);

    // Then analyze the transcription for tags and summary
    const analysis = await analyzeText(transcription);
    
    return {
      transcription,
      tags: analysis.tags,
      summary: analysis.summary,
    };
  } catch (error) {
    console.error('Audio analysis failed:', error);
    return { transcription: '', tags: [], summary: '' };
  }
}
