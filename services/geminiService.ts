
import { GoogleGenAI, Type } from "@google/genai";
import { AIResponse, FileChange } from "../types";

export class GeminiService {
  async generateCode(prompt: string, currentContext: string): Promise<AIResponse> {
    // Fixed: Always use process.env.API_KEY directly and create instance right before making the call.
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: [
        {
          role: 'user',
          parts: [{ text: `You are an expert software engineer and local development agent.
Current File System Context:
${currentContext}

User Task:
${prompt}

Provide a detailed explanation of what you are building and then the specific file changes needed.
Return a valid JSON response.` }]
        }
      ],
      config: {
        thinkingConfig: { thinkingBudget: 4000 },
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            thinking: { type: Type.STRING, description: 'Step-by-step reasoning.' },
            message: { type: Type.STRING, description: 'User-facing explanation.' },
            changes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  path: { type: Type.STRING, description: 'Relative path of the file.' },
                  content: { type: Type.STRING, description: 'Full content of the file.' },
                  action: { type: Type.STRING, enum: ['create', 'update', 'delete'] }
                },
                required: ['path', 'content', 'action']
              }
            }
          },
          required: ['thinking', 'message', 'changes']
        }
      }
    });

    try {
      // Fixed: response.text is a property that returns the string output.
      const result = JSON.parse(response.text || '{}');
      return result as AIResponse;
    } catch (e) {
      console.error("Failed to parse Gemini response:", e);
      throw new Error("The AI returned an invalid response structure.");
    }
  }
}

export const geminiService = new GeminiService();
