// src/lib/master-ai-tools.ts

import type {
  ToolFunctionResponsePayload,
  MasterAIToolContext,
  DetectAnimalArgs,
} from "@/lib/interview";

// In-memory store
const sessionStore: { [sessionId: string]: MasterAIToolContext } = {};

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

export type ToolFunction = (
  args: any,
  context: MasterAIToolContext,
  sessionId: string
) => Promise<ToolFunctionResponsePayload>;

export const toolFunctions: { [key: string]: ToolFunction } = {
  detectAnimalssss: async (
    args: DetectAnimalArgs,
    context: MasterAIToolContext
  ): Promise<ToolFunctionResponsePayload> => {
    console.log(`[Tool:detectAnimal] Args:`, args);
    const detectedAnimal = args.animal;

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

  detectEmotion: async (
    args: any,
    context: MasterAIToolContext,
    sessionId: string
  ): Promise<ToolFunctionResponsePayload> => {
    console.log(`[Tool:detectEmotion] Args:`, args);
    const interventionInstruction = `EMOTION DETECTED: ${args.emotion} (intensity: ${args.intensity}/10).
ADJUST your approach:
- If intensity > 7: Be more supportive and empathetic
- If negative emotion: Acknowledge their feelings before continuing
- If positive emotion: Match their energy level appropriately`;

    return {
      success: true,
      data: {
        emotion: args.emotion,
        intensity: args.intensity,
        intervention: interventionInstruction,
        action: "adjust_tone",
      },
    };
  },

  detectTechnicalTerms: async (
    args: any,
    context: MasterAIToolContext,
    sessionId: string
  ): Promise<ToolFunctionResponsePayload> => {
    console.log(`[Tool:detectTechnicalTerms] Args:`, args);
    const interventionInstruction = `TECHNICAL EXPERTISE DETECTED: ${
      args.category
    } terms used (${args.terms.join(", ")}).
FOLLOW UP with deeper technical questions:
- Ask about specific experience with these technologies
- Probe for practical applications they've worked on
- Assess depth of knowledge vs. surface-level familiarity`;

    return {
      success: true,
      data: {
        terms: args.terms,
        category: args.category,
        intervention: interventionInstruction,
        action: "probe_technical_depth",
      },
    };
  },

  detectPersonalInfo: async (
    args: any,
    context: MasterAIToolContext,
    sessionId: string
  ): Promise<ToolFunctionResponsePayload> => {
    console.log(`[Tool:detectPersonalInfo] Args:`, args);
    const interventionInstruction = `PERSONAL INFORMATION SHARED: ${args.info_type} (sensitivity: ${args.sensitivity}).
RESPOND appropriately:
- If high sensitivity: Acknowledge briefly and redirect to professional topics
- If medium sensitivity: Show appropriate interest but maintain boundaries
- If low sensitivity: Can engage naturally while staying professional`;

    return {
      success: true,
      data: {
        info_type: args.info_type,
        sensitivity: args.sensitivity,
        intervention: interventionInstruction,
        action: "manage_personal_boundary",
      },
    };
  },

  detectInterviewDelay: async (
    args: any,
    context: MasterAIToolContext,
    sessionId: string
  ): Promise<ToolFunctionResponsePayload> => {
    console.log(`[Tool:detectInterviewDelay] Args:`, args);
    const interventionInstruction = `INTERVIEW FLOW ISSUE: ${args.delay_type} detected.
TAKE ACTION: ${args.suggested_action}
- If redirect: "Let's focus on [next topic]"
- If summarize: "To summarize what you've shared..."
- If move_on: "That's great insight. Moving forward..."
- If refocus: "Let's get back to discussing..."
- If time_check: "We have limited time, so..."`;

    return {
      success: true,
      data: {
        delay_type: args.delay_type,
        suggested_action: args.suggested_action,
        intervention: interventionInstruction,
        action: "manage_interview_flow",
      },
    };
  },
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
