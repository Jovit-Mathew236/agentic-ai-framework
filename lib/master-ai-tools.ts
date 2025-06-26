// src/lib/master-ai-tools.ts
import type {
  ToolFunctionResponsePayload,
  MasterAIToolContext,
  DetectAnimalArgs,
} from "@/lib/interview"; // Corrected path

// In-memory store for this example. Simplified for the new context.
const interviewSessionStore: { [sessionId: string]: MasterAIToolContext } = {};

function getSessionContext(sessionId: string): MasterAIToolContext {
  if (!interviewSessionStore[sessionId]) {
    interviewSessionStore[sessionId] = {
      conversationHistory: [],
    };
  }
  return interviewSessionStore[sessionId];
}

function updateSessionContext(
  sessionId: string,
  updates: Partial<MasterAIToolContext>
): void {
  const context = getSessionContext(sessionId);
  interviewSessionStore[sessionId] = { ...context, ...updates };
}

export const detectAnimal: (
  args: DetectAnimalArgs,
  context: MasterAIToolContext,
  sessionId: string
) => Promise<ToolFunctionResponsePayload> = async (
  args,
  context,
  sessionId
) => {
  console.log(`[MasterTool:detectAnimal] Args from Orchestrator AI:`, args);
  console.log(`[MasterTool:detectAnimal] Current context:`, context);

  // In a real application, you would implement the animal detection logic here.
  // For this simulation, we trust the Orchestrator AI's detection.
  const detectedAnimal = args.animal;

  updateSessionContext(sessionId, {
    masterAISystemMessage: `Detected animal: ${detectedAnimal}.`,
  });

  return {
    success: true,
    data: { animal: detectedAnimal },
  };
};

export function getMasterAIContext(sessionId: string): MasterAIToolContext {
  return getSessionContext(sessionId);
}

export function updateMasterAIContext(
  sessionId: string,
  updates: Partial<MasterAIToolContext>
): void {
  updateSessionContext(sessionId, updates);
}

export function initializeSession(sessionId: string): MasterAIToolContext {
  const newContext: MasterAIToolContext = {
    conversationHistory: [],
  };
  interviewSessionStore[sessionId] = newContext;
  return newContext;
}
