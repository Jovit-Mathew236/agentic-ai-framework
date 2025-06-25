// src/types/interview.ts
import { ChatCompletionMessageToolCall } from "openai/resources/chat/completions";

// --- Basic Types ---
export interface Question {
  id: number | string; // Allow string for unique IDs like from LLM
  question: string;
  category: string;
  difficulty: number;
  expected_answer?: string; // Added from your reference
  topic_name?: string; // Added
  question_type?: string; // Added (e.g., 'qna', 'behavioral', 'technical')
}

export interface TranscriptEntry {
  id: number | string; // Allow string for unique IDs like from LLM
  timestamp: string;
  speaker: "ai" | "candidate" | "system"; // 'ai' is the Slave/Interviewer AI
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

// --- Dashboard Specific Simulated Tool Types ---
export interface ToolContext {
  currentScore: number;
  conversationHistory: TranscriptEntry[];
  questionBank: Question[];
}

export interface ToolFunctionResponse {
  action: string;
  message: string;
  score?: number;
  feedback?: string;
}

// Canonical Tool Functions definition, moved from types/tools.ts
export interface ToolFunctions {
  // Question Management
  getQuestion: (params: {
    category: string;
    difficulty: number;
    previousQuestions?: string[];
  }) => Promise<{
    question: string;
    expectedCriteria: string[];
    category: string;
    difficulty: number;
    question_id?: string | number; // Added to match MasterAI usage
    reference_answer?: string; // Added to match MasterAI usage
    suggestedType?: "qna" | "coding" | "behavioral" | "technical"; // Added to match MasterAI usage
  }>;

  // Answer Evaluation
  evaluateAnswer: (params: {
    question: string;
    answer: string;
    criteria: string[];
  }) => Promise<{
    score: number;
    feedback: string;
    strengths: string[];
    weaknesses: string[];
    flags?: string[];
  }>;

  // Interview Progress Management
  updateInterviewState: (params: {
    currentScore: number;
    timeElapsed: number;
    questionsAsked: number;
    candidateEngagement: number;
  }) => Promise<{
    shouldContinue: boolean;
    nextAction: string;
    adjustedDifficulty?: number;
  }>;

  // Candidate Analysis
  analyzeBehavior: (params: {
    transcriptSegment: string;
    audioFeatures?: {
      volume: number;
      pitch: number;
      speed: number;
    };
  }) => Promise<{
    confidence: number;
    clarity: number;
    professionalism: number;
    flags: string[];
  }>;

  // Technical Skill Assessment
  assessTechnicalResponse: (params: {
    question: string;
    response: string;
    technology: string;
    expectedConcepts: string[];
  }) => Promise<{
    technicalAccuracy: number;
    conceptCoverage: string[];
    missingConcepts: string[];
    suggestions: string[];
  }>;
}

// --- Job & Evaluation Types (from your greetingAgent reference) ---
export interface FollowUpQuestionDetails {
  _id: number;
  ai_question_id: number;
  performance_level: "high" | "low";
  question_text: string;
  expected_answer: string;
}

export interface InterviewQuestionFromJob {
  // Renamed to avoid conflict
  id: number | string;
  job_id: number;
  topic_id: number;
  topic_name: string;
  intent_id: number;
  question: string; // Renamed from question_text
  expected_answer: string;
  evaluation_criteria: string;
  difficulty_level: string;
  question_type: string;
  tags: string[];
  category?: string; // Added to align with Question interface
  follow_up_questions?: {
    high?: FollowUpQuestionDetails;
    low?: FollowUpQuestionDetails;
  };
}

export interface JobIntent {
  intent_id: number;
  intent_name: string;
  description: string;
  weightage: number;
}

export interface JobData {
  job_details?: {
    id?: number;
    title?: string;
    description?: string;
    objective?: string;
    // ... other job details
  };
  requirements?: {
    skills?: string;
    qualifications?: string;
  };
  responsibilities?: string;
  interview_questions?: InterviewQuestionFromJob[];
  job_intents?: JobIntent[];
  language?: string;
}

export interface IntentScoreInput {
  intent_id: number;
  intent_name: string;
  score: number; // Score 0-100 for this intent
  analysis?: string;
}

export interface EvaluationResult {
  question: string; // The question text that was asked
  question_id?: number | string; // ID of the question
  response: string; // Candidate's response
  analysis: string; // Overall analysis from AI
  average_score: number; // Weighted average score for this answer
  intent_scores: IntentScoreInput[]; // Scores for each relevant job intent
  reference_answer?: string;
  comparison_notes?: string;
  question_category?: string;
  agent_name: string; // Name of the agent/role that performed evaluation
  job_questions?: InterviewQuestionFromJob[]; // For context
}

// --- Tool Argument and Context Types ---
export interface GetQuestionArgs {
  question_number: number;
  question: string; // The question text AI wants to ask (after paraphrasing)
  suggestedType: "qna" | "coding" | "behavioral" | "technical";
  question_id: number | string; // Can be from job_data or custom
  reference_answer: string; // Expected answer / criteria
  category?: string; // e.g., topic_name
}

export type StoreEvaluationArgs = EvaluationResult; // Renaming for clarity

export interface TransferContext {
  job_data?: JobData; // Make job_data optional here if it's established early
  evaluations: EvaluationResult[];
  overall_score: number;
}
export interface TransferAgentsArgs {
  destination_agent: string; // e.g., "technicalInterviewer", "conclusionInterviewer"
  rationale_for_transfer: string;
  conversation_context: TransferContext;
}

export interface MasterAIToolContext {
  currentTurn: number;
  conversationHistory: TranscriptEntry[];
  jobData?: JobData; // Loaded at the start of the interview
  currentEvaluations: EvaluationResult[];
  currentOverallScore: number;
  currentQuestion?: InterviewQuestionFromJob | Question; // The question being currently discussed
  lastCandidateResponse?: TranscriptEntry;
  concluded?: boolean; // Added for tracking interview conclusion state
  // Add other stateful items the Master AI needs to track
}

// --- Tool Function Definitions (What your backend implements) ---
export interface ToolFunctionResponsePayload {
  // What the tool function returns to the Master AI
  success: boolean;
  data?: Record<string, unknown>; // Changed from any
  error?: string;
  nextSystemMessageToSlave?: string; // Optional: If the tool directly dictates the next system prompt
  nextActionForMaster?:
    | "ask_next_question"
    | "conclude"
    | "wait_for_user"
    | "transfer_agent"; // Guidance for Master AI
}

// These are functions implemented in your backend / Master AI logic
export interface BackendToolFunctions {
  getQuestion: (
    args: Parameters<ToolFunctions["getQuestion"]>[0],
    context: MasterAIToolContext,
    sessionId: string
  ) => Promise<
    ToolFunctionResponsePayload & {
      question?: Question | InterviewQuestionFromJob;
    }
  >;
  evaluateAnswer: (
    args: Parameters<ToolFunctions["evaluateAnswer"]>[0],
    context: MasterAIToolContext,
    sessionId: string
  ) => Promise<ToolFunctionResponsePayload & { evaluation?: EvaluationResult }>;
  updateInterviewState: (
    args: Parameters<ToolFunctions["updateInterviewState"]>[0],
    context: MasterAIToolContext,
    sessionId: string
  ) => Promise<ToolFunctionResponsePayload>;
  analyzeBehavior: (
    args: Parameters<ToolFunctions["analyzeBehavior"]>[0],
    context: MasterAIToolContext,
    sessionId: string
  ) => Promise<ToolFunctionResponsePayload>;
  assessTechnicalResponse: (
    args: Parameters<ToolFunctions["assessTechnicalResponse"]>[0],
    context: MasterAIToolContext,
    sessionId: string
  ) => Promise<ToolFunctionResponsePayload>;
  storeEvaluation: StoreEvaluationTool;
  transferAgents: TransferAgentsTool;
}

// Re-export the original types after BackendToolFunctions
export type StoreEvaluationTool = (
  args: StoreEvaluationArgs,
  context: MasterAIToolContext,
  sessionId: string
) => Promise<ToolFunctionResponsePayload & { evaluation?: EvaluationResult }>;

export type TransferAgentsTool = (
  args: TransferAgentsArgs,
  context: MasterAIToolContext,
  sessionId: string
) => Promise<
  ToolFunctionResponsePayload & { transferred: boolean; destination: string }
>;

// --- OpenAI Tool Definition (What you send to OpenAI API) ---
export interface OpenAIToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, unknown>; // This 'any' is often necessary for dynamic OpenAI schema
      required?: string[];
    };
  };
}
