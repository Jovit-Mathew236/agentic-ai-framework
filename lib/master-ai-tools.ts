// src/lib/master-ai-tools.ts
import type {
  ToolFunctionResponsePayload,
  MasterAIToolContext,
  DetectAnimalArgs,
} from "@/lib/interview";

// In-memory store - replace with database in production
const sessionStore: { [sessionId: string]: MasterAIToolContext } = {};

// Generic session management
function getSessionContext(sessionId: string): MasterAIToolContext {
  if (!sessionStore[sessionId]) {
    sessionStore[sessionId] = {
      conversationHistory: [],
    };
  }
  return sessionStore[sessionId];
}

function updateSessionContext(
  sessionId: string,
  updates: Partial<MasterAIToolContext>
): void {
  const context = getSessionContext(sessionId);
  sessionStore[sessionId] = { ...context, ...updates };
}

// TOOL FUNCTIONS - Add new tools here
export type ToolFunction = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args: any,
  context: MasterAIToolContext,
  sessionId: string
) => Promise<ToolFunctionResponsePayload>;

export const toolFunctions: { [key: string]: ToolFunction } = {
  detectAnimalssss: async (
    args: DetectAnimalArgs,
    context: MasterAIToolContext
    // sessionId: string
  ): Promise<ToolFunctionResponsePayload> => {
    console.log(`[Tool:detectAnimal] Args:`, args);
    console.log(`[Tool:detectAnimal] Context:`, context);

    const detectedAnimal = args.animal;

    // Create the intervention instruction
    const interventionInstruction = `INTERVENTION REQUIRED: Animal detected (${detectedAnimal}). 
    
IMMEDIATELY redirect the conversation by asking about cars, vehicles, or transportation. 
Examples:
- "That's interesting! Speaking of getting around, what kind of car do you drive?"
- "By the way, I'm curious about your transportation preferences. Do you prefer cars, public transit, or other vehicles?"
- "Let's talk about something different - what's your dream car?"

Do NOT continue discussing animals. Smoothly transition to vehicle/transportation topics.`;

    return {
      success: true,
      data: {
        animal: detectedAnimal,
        intervention: interventionInstruction,
        action: "redirect_to_cars",
      },
    };
  },

  // Example of additional tools you can add:

  //   detectEmotion: async (
  //     args: any,
  //     context: MasterAIToolContext,
  //     sessionId: string
  //   ) => {
  //     console.log(`[Tool:detectEmotion] Args:`, args);

  //     const interventionInstruction = `EMOTION DETECTED: ${args.emotion} (intensity: ${args.intensity}/10).

  // ADJUST your approach:
  // - If intensity > 7: Be more supportive and empathetic
  // - If negative emotion: Acknowledge their feelings before continuing
  // - If positive emotion: Match their energy level appropriately`;

  //     return {
  //       success: true,
  //       data: {
  //         emotion: args.emotion,
  //         intensity: args.intensity,
  //         intervention: interventionInstruction,
  //         action: "adjust_tone",
  //       },
  //     };
  //   },

  //   detectTechnicalTerms: async (
  //     args: any,
  //     context: MasterAIToolContext,
  //     sessionId: string
  //   ) => {
  //     console.log(`[Tool:detectTechnicalTerms] Args:`, args);

  //     const interventionInstruction = `TECHNICAL EXPERTISE DETECTED: ${
  //       args.category
  //     } terms used (${args.terms.join(", ")}).

  // FOLLOW UP with deeper technical questions:
  // - Ask about specific experience with these technologies
  // - Probe for practical applications they've worked on
  // - Assess depth of knowledge vs. surface-level familiarity`;

  //     return {
  //       success: true,
  //       data: {
  //         terms: args.terms,
  //         category: args.category,
  //         intervention: interventionInstruction,
  //         action: "probe_technical_depth",
  //       },
  //     };
  //   },
};

// Generic context management functions
export function getMasterContext(
  sessionId: string
): MasterAIToolContext | null {
  return sessionStore[sessionId] || null;
}

export function updateMasterContext(
  sessionId: string,
  updates: Partial<MasterAIToolContext>
): void {
  updateSessionContext(sessionId, updates);
}

export function initializeSession(sessionId: string): MasterAIToolContext {
  const newContext: MasterAIToolContext = {
    conversationHistory: [],
  };
  sessionStore[sessionId] = newContext;
  return newContext;
}
