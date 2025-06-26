// src/types/interview.ts
import { ChatCompletionMessageToolCall } from "openai/resources/chat/completions";

// --- Basic Types ---
export interface TranscriptEntry {
  id: number | string; // Allow string for unique IDs like from LLM
  timestamp: string;
  speaker: "assistant" | "user" | "system"; // 'ai' is the Slave/Interviewer AI
  message: string;
  score?: number | null; // Overall score for this turn/answer
  conversation_id?: string; // For tracking a specific session
  data?: {
    tool_calls?: ChatCompletionMessageToolCall[]; // For OpenAI tool calls
    tool_call_id?: string; // For OpenAI tool response
    tool_name?: string; // For OpenAI tool response
    type?: string; // For internal message types, e.g., 'tool_response'
  }; // For additional metadata, like tool calls/results
}

export interface SystemMessageEntry {
  id: number | string;
  timestamp: string;
  role: "system"; // This is a system message to the Slave AI
  content: string;
  toolUsed?: string; // Optional: name of the tool that generated this message
}

// --- Simplified Master AI Context ---
export interface MasterAIToolContext {
  conversationHistory: TranscriptEntry[];
  lastCandidateMessageContent?: string; // To hold the last message content for processing
  masterAISystemMessage?: string; // To hold system message from Master AI to Slave AI
  // Other context fields if needed, but keeping it minimal for now
}

// --- Simplified Tool Function Response Payload ---
export interface ToolFunctionResponsePayload {
  success: boolean;
  data?: Record<string, unknown>; // Data returned by the tool function
  error?: string;
  // nextSystemMessageToSlave and nextActionForMaster will be handled by the orchestrator AI logic in route.ts
}

// --- New Tool Definition for detectAnimal ---
export interface DetectAnimalArgs {
  animal: "cat" | "dinosaur" | "none";
}

// --- Backend Tool Functions (only detectAnimal) ---
export interface BackendToolFunctions {
  detectAnimal: (
    args: DetectAnimalArgs,
    context: MasterAIToolContext,
    sessionId: string
  ) => Promise<ToolFunctionResponsePayload>;
}

// --- OpenAI Tool Definition (What you send to OpenAI API) ---
export interface OpenAIToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
}
