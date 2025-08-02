import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai"
import fs from "fs"

export class LLMHelper {
  private model: GenerativeModel
  private readonly systemPrompt = `You are CreativEase Coach, an expert assistant for creative tools like Adobe Premiere Pro, DaVinci Resolve, After Effects, Photoshop, Illustrator, and Final Cut Pro. You help users solve workflow challenges, learn new techniques, and navigate complex UI features. Always provide clear, actionable step-by-step guidance with specific UI references and helpful tips for creative professionals.`

  constructor(apiKey: string) {
    const genAI = new GoogleGenerativeAI(apiKey)
    this.model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" })
  }

  private async fileToGenerativePart(imagePath: string) {
    const imageData = await fs.promises.readFile(imagePath)
    return {
      inlineData: {
        data: imageData.toString("base64"),
        mimeType: "image/png"
      }
    }
  }

  private cleanJsonResponse(text: string): string {
    // Remove markdown code block syntax if present
    text = text.replace(/^```(?:json)?\n/, '').replace(/\n```$/, '');
    // Remove any leading/trailing whitespace
    text = text.trim();
    return text;
  }

  public async extractProblemFromImages(imagePaths: string[]) {
    try {
      const imageParts = await Promise.all(imagePaths.map(path => this.fileToGenerativePart(path)))
      
      const prompt = `${this.systemPrompt}\n\nYou are a wingman. Please analyze these images and extract the following information in JSON format:\n{
  "problem_statement": "A clear statement of the problem or situation depicted in the images.",
  "context": "Relevant background or context from the images.",
  "suggested_responses": ["First possible answer or action", "Second possible answer or action", "..."],
  "reasoning": "Explanation of why these suggestions are appropriate."
}\nImportant: Return ONLY the JSON object, without any markdown formatting or code blocks.`

      const result = await this.model.generateContent([prompt, ...imageParts])
      const response = await result.response
      const text = this.cleanJsonResponse(response.text())
      return JSON.parse(text)
    } catch (error) {
      console.error("Error extracting problem from images:", error)
      throw error
    }
  }

  public async generateSolution(problemInfo: any) {
    const prompt = `${this.systemPrompt}\n\nGiven this problem or situation:\n${JSON.stringify(problemInfo, null, 2)}\n\nPlease provide your response in the following JSON format:\n{
  "solution": {
    "code": "The code or main answer here.",
    "problem_statement": "Restate the problem or situation.",
    "context": "Relevant background/context.",
    "suggested_responses": ["First possible answer or action", "Second possible answer or action", "..."],
    "reasoning": "Explanation of why these suggestions are appropriate."
  }
}\nImportant: Return ONLY the JSON object, without any markdown formatting or code blocks.`

    console.log("[LLMHelper] Calling Gemini LLM for solution...");
    try {
      const result = await this.model.generateContent(prompt)
      console.log("[LLMHelper] Gemini LLM returned result.");
      const response = await result.response
      const text = this.cleanJsonResponse(response.text())
      const parsed = JSON.parse(text)
      console.log("[LLMHelper] Parsed LLM response:", parsed)
      return parsed
    } catch (error) {
      console.error("[LLMHelper] Error in generateSolution:", error);
      throw error;
    }
  }

  public async debugSolutionWithImages(problemInfo: any, currentCode: string, debugImagePaths: string[]) {
    try {
      const imageParts = await Promise.all(debugImagePaths.map(path => this.fileToGenerativePart(path)))
      
      const prompt = `${this.systemPrompt}\n\nYou are a wingman. Given:\n1. The original problem or situation: ${JSON.stringify(problemInfo, null, 2)}\n2. The current response or approach: ${currentCode}\n3. The debug information in the provided images\n\nPlease analyze the debug information and provide feedback in this JSON format:\n{
  "solution": {
    "code": "The code or main answer here.",
    "problem_statement": "Restate the problem or situation.",
    "context": "Relevant background/context.",
    "suggested_responses": ["First possible answer or action", "Second possible answer or action", "..."],
    "reasoning": "Explanation of why these suggestions are appropriate."
  }
}\nImportant: Return ONLY the JSON object, without any markdown formatting or code blocks.`

      const result = await this.model.generateContent([prompt, ...imageParts])
      const response = await result.response
      const text = this.cleanJsonResponse(response.text())
      const parsed = JSON.parse(text)
      console.log("[LLMHelper] Parsed debug LLM response:", parsed)
      return parsed
    } catch (error) {
      console.error("Error debugging solution with images:", error)
      throw error
    }
  }

  public async analyzeAudioFile(audioPath: string) {
    try {
      const audioData = await fs.promises.readFile(audioPath);
      const audioPart = {
        inlineData: {
          data: audioData.toString("base64"),
          mimeType: "audio/mp3"
        }
      };
      const prompt = `${this.systemPrompt}\n\nListen to this creative workflow question or challenge. Provide a helpful, concise response with specific steps they can take in their creative software. Focus on practical solutions for video editing, design, or creative workflows. Answer naturally and be specific about UI elements, menus, or techniques.`;
      const result = await this.model.generateContent([prompt, audioPart]);
      const response = await result.response;
      const text = response.text();
      return { text, timestamp: Date.now() };
    } catch (error) {
      console.error("Error analyzing audio file:", error);
      throw error;
    }
  }

  public async analyzeAudioFromBase64(data: string, mimeType: string) {
    try {
      const audioPart = {
        inlineData: {
          data,
          mimeType
        }
      };
      const prompt = `${this.systemPrompt}\n\nListen to this creative workflow question or challenge. Provide a helpful, concise response with specific steps they can take in their creative software. Focus on practical solutions for video editing, design, or creative workflows. Answer naturally and be specific about UI elements, menus, or techniques. Be concise.`;
      const result = await this.model.generateContent([prompt, audioPart]);
      const response = await result.response;
      const text = response.text();
      return { text, timestamp: Date.now() };
    } catch (error) {
      console.error("Error analyzing audio from base64:", error);
      throw error;
    }
  }

  public async getCreativeGuidance(data: string, mimeType: string) {
    try {
      const audioPart = {
        inlineData: {
          data,
          mimeType
        }
      };
      const prompt = `${this.systemPrompt}

User is asking for help with their creative workflow. Listen to their question and provide structured guidance in JSON format:

{
  "steps": [
    "Step 1: Specific action with UI references",
    "Step 2: Next action to take", 
    "Step 3: Final step or verification"
  ],
  "highlights": [
    "UI Panel or Button to highlight",
    "Menu item or shortcut to emphasize"
  ],
  "learn_more_url": "https://helpx.adobe.com/relevant-tutorial-link"
}

Focus on:
- Specific UI navigation (menus, panels, buttons)
- Keyboard shortcuts when helpful
- Common creative workflows
- Practical, actionable steps
- Real Adobe/creative tool documentation links when possible

Return ONLY the JSON object, no markdown formatting.`;

      const result = await this.model.generateContent([prompt, audioPart]);
      const response = await result.response;
      const text = this.cleanJsonResponse(response.text());
      return JSON.parse(text);
    } catch (error) {
      console.error("Error in getCreativeGuidance:", error);
      throw error;
    }
  }

  public async getCreativeGuidanceFromText(userQuestion: string) {
    try {
      const prompt = `${this.systemPrompt}

User is asking for help with their creative workflow: "${userQuestion}"

Provide structured guidance in JSON format:

{
  "steps": [
    "Step 1: Specific action with UI references",
    "Step 2: Next action to take", 
    "Step 3: Final step or verification"
  ],
  "highlights": [
    "UI Panel or Button to highlight",
    "Menu item or shortcut to emphasize"
  ],
  "learn_more_url": "https://helpx.adobe.com/relevant-tutorial-link"
}

Focus on:
- Specific UI navigation (menus, panels, buttons)
- Keyboard shortcuts when helpful
- Common creative workflows
- Practical, actionable steps
- Real Adobe/creative tool documentation links when possible

Return ONLY the JSON object, no markdown formatting.`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = this.cleanJsonResponse(response.text());
      return JSON.parse(text);
    } catch (error) {
      console.error("Error in getCreativeGuidanceFromText:", error);
      throw error;
    }
  }

  public async analyzeImageFile(imagePath: string) {
    try {
      const imageData = await fs.promises.readFile(imagePath);
      const imagePart = {
        inlineData: {
          data: imageData.toString("base64"),
          mimeType: "image/png"
        }
      };
      const prompt = `${this.systemPrompt}\n\nDescribe the content of this image in a short, concise answer. In addition to your main answer, suggest several possible actions or responses the user could take next based on the image. Do not return a structured JSON object, just answer naturally as you would to a user. Be concise and brief.`;
      const result = await this.model.generateContent([prompt, imagePart]);
      const response = await result.response;
      const text = response.text();
      return { text, timestamp: Date.now() };
    } catch (error) {
      console.error("Error analyzing image file:", error);
      throw error;
    }
  }
} 