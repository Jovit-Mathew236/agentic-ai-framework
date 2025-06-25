// src/lib/master-ai-tools.ts
import type {
  // GetQuestionArgs, // Removed as it's no longer directly used for getQuestion args
  StoreEvaluationArgs,
  TransferAgentsArgs,
  MasterAIToolContext,
  ToolFunctionResponsePayload,
  Question,
  InterviewQuestionFromJob,
  EvaluationResult,
  JobData,
  JobIntent,
  ToolFunctions,
} from "@/lib/interview"; // Corrected path

// In-memory store for this example. In production, use a database.
const interviewSessionStore: { [sessionId: string]: MasterAIToolContext } = {};
let jobDataStore: JobData | null = null; // Simplified: one job data for all sessions

// Initialize job data (example - load from a file or DB in real app)
export function loadJobData(data: JobData): void {
  jobDataStore = data;
  console.log("Job data loaded into store.");
}

function getSessionContext(sessionId: string): MasterAIToolContext {
  if (!interviewSessionStore[sessionId]) {
    interviewSessionStore[sessionId] = {
      currentTurn: 0,
      conversationHistory: [],
      jobData: jobDataStore || undefined, // Use loaded job data
      currentEvaluations: [],
      currentOverallScore: 0,
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

export const getQuestion: (
  args: Parameters<ToolFunctions["getQuestion"]>[0],
  context: MasterAIToolContext,
  sessionId: string
) => Promise<
  ToolFunctionResponsePayload & {
    question?: Question | InterviewQuestionFromJob;
  }
> = async (args, context, sessionId) => {
  console.log(`[MasterTool:getQuestion] Args from Slave AI:`, args);
  console.log(`[MasterTool:getQuestion] Current context:`, context);

  let questionToAsk: Question | InterviewQuestionFromJob = {
    // Initialize with a default value
    id: `default_${Date.now()}`,
    question: `Please tell me about your experience. (Category: ${
      args.category || "General"
    }, Difficulty: ${args.difficulty || 1})`,
    category: args.category || "general",
    difficulty: args.difficulty || 1,
    expected_answer: "Demonstrate relevant experience and skills.",
    question_type: "qna",
    topic_name: args.category || "General Skills",
    evaluation_criteria: "Assesses problem-solving and communication.",
    tags: [],
    intent_id: 0,
    job_id: 0,
    topic_id: 0,
  };

  // Try to find a specific question from jobData based on category and difficulty
  if (context.jobData?.interview_questions) {
    const foundQuestion = context.jobData.interview_questions.find(
      (q) =>
        q.category === args.category &&
        q.difficulty_level === args.difficulty.toString() // Assuming difficulty_level is string in jobData
    );
    if (foundQuestion) {
      questionToAsk = foundQuestion; // Assign if a specific question is found
    }
  }

  updateSessionContext(sessionId, { currentQuestion: questionToAsk });

  return {
    success: true,
    question: questionToAsk,
    data: {
      // This is what the Slave AI gets back as the function call result
      question_id: questionToAsk.id,
      question_text: questionToAsk.question,
      question_type: questionToAsk.question_type,
      reference_answer: questionToAsk.expected_answer,
      category: questionToAsk.category,
      is_coding: questionToAsk.question_type === "coding",
      // question_number: args.question_number, // This field is not available in current args, removed it from the `data` object.
    },
    nextSystemMessageToSlave: `You have successfully retrieved the question. Now, ask the candidate this question clearly: "${questionToAsk.question}"`,
    nextActionForMaster: "wait_for_user",
  };
};

export const storeEvaluation: (
  args: StoreEvaluationArgs,
  context: MasterAIToolContext,
  sessionId: string // Added sessionId
) => Promise<
  ToolFunctionResponsePayload & { evaluation?: EvaluationResult }
> = async (args, context, sessionId) => {
  console.log(`[MasterTool:storeEvaluation] Args from Slave AI:`, args);

  // Validate args against jobData.job_intents if necessary (as in your greetingAgent)
  if (context.jobData?.job_intents) {
    const validIntentIds = new Set(
      context.jobData.job_intents.map((intent: JobIntent) => intent.intent_id)
    );
    for (const score of args.intent_scores) {
      if (!validIntentIds.has(score.intent_id)) {
        return {
          success: false,
          error: `Invalid intent_id: ${score.intent_id}. Not defined for this job.`,
          nextSystemMessageToSlave: `Error: You provided an invalid intent_id: ${score.intent_id}. Please re-evaluate using only the provided job intents.`,
          nextActionForMaster: "wait_for_user", // Or force re-evaluation
        };
      }
    }
  }

  const evaluationResult: EvaluationResult = {
    ...args,
    agent_name: "GreeterAgent" /* or context.currentAgentName */,
  };
  const updatedEvaluations = [...context.currentEvaluations, evaluationResult];
  const newOverallScore =
    updatedEvaluations.reduce((sum, ev) => sum + ev.average_score, 0) /
    updatedEvaluations.length;

  updateSessionContext(sessionId, {
    currentEvaluations: updatedEvaluations,
    currentOverallScore: newOverallScore,
  });

  console.log(
    `[MasterTool:storeEvaluation] Evaluation stored for question ID ${
      args.question_id
    }. New overall score: ${newOverallScore.toFixed(2)}`
  );

  // Decide next action based on score or number of questions
  const MAX_QUESTIONS = context.jobData?.interview_questions?.length || 4; // Example
  const SCORE_THRESHOLD_ADVANCE = 50; // Example

  let nextAction: ToolFunctionResponsePayload["nextActionForMaster"] =
    "ask_next_question";
  let nextSystemMsg = `Evaluation stored. The candidate's average score for the last answer was ${args.average_score.toFixed(
    0
  )}/100. Overall score is now ${newOverallScore.toFixed(
    0
  )}/100. Prepare to ask the next question.`;

  if (
    context.currentTurn >= MAX_QUESTIONS ||
    (newOverallScore < SCORE_THRESHOLD_ADVANCE &&
      context.currentTurn >= 2) /* min questions before concluding low score */
  ) {
    nextAction = "transfer_agent"; // Or 'conclude'
    nextSystemMsg = `Evaluation stored. The interview phase is complete or the candidate's performance requires concluding. Overall score: ${newOverallScore.toFixed(
      0
    )}/100. Prepare to transfer to the next agent or conclude.`;
  }

  return {
    success: true,
    evaluation: evaluationResult,
    data: {
      stored: true,
      message: "Evaluation stored successfully.",
      evaluation: args,
    }, // For Slave AI
    nextSystemMessageToSlave: nextSystemMsg,
    nextActionForMaster: nextAction,
  };
};

export const transferAgents: (
  args: TransferAgentsArgs,
  context: MasterAIToolContext,
  sessionId: string // Added sessionId
) => Promise<
  ToolFunctionResponsePayload & { transferred: boolean; destination: string }
> = async (args, context, sessionId) => {
  console.log(`[MasterTool:transferAgents] Args from Slave AI:`, args);
  // Logic to handle agent transfer. For now, just acknowledge.
  // In a multi-agent system, this would update state to load the next agent's config.

  // Ensure context provided by AI is reasonable
  if (
    !args.conversation_context ||
    typeof args.conversation_context.overall_score !== "number"
  ) {
    return {
      success: false,
      error: "Invalid conversation_context provided for transfer.",
      transferred: false,
      destination: args.destination_agent,
      nextSystemMessageToSlave:
        "Error in transfer: Invalid context. Please call transferAgents again with full context including job_data, all evaluations, and overall_score.",
      nextActionForMaster: "wait_for_user",
    };
  }

  console.log(
    `[MasterTool:transferAgents] Transferring to ${args.destination_agent} with rationale: ${args.rationale_for_transfer}`
  );

  updateSessionContext(sessionId, {
    concluded: true, // Mark interview as concluded for the current agent
  });

  return {
    success: true,
    transferred: true,
    destination: args.destination_agent,
    data: {
      message: `Successfully initiated transfer to ${args.destination_agent}.`,
      destination_agent: args.destination_agent,
      rationale: args.rationale_for_transfer,
    },
    nextSystemMessageToSlave: `Transfer initiated to ${args.destination_agent}. Reason: ${args.rationale_for_transfer}`,
    nextActionForMaster: "transfer_agent",
  };
};

// Placeholder implementations for missing BackendToolFunctions
export const evaluateAnswer: (
  args: Parameters<ToolFunctions["evaluateAnswer"]>[0],
  context: MasterAIToolContext,
  sessionId: string
) => Promise<
  ToolFunctionResponsePayload & { evaluation?: EvaluationResult }
> = async (args, context, sessionId) => {
  console.warn(
    `[MasterTool:evaluateAnswer] Placeholder called for session ${sessionId}. Args:`,
    args,
    `Context:`,
    context
  );
  // Implement actual evaluation logic here based on your requirements
  return {
    success: true,
    data: { message: "Evaluation placeholder executed." },
    nextActionForMaster: "wait_for_user",
  };
};

export const updateInterviewState: (
  args: Parameters<ToolFunctions["updateInterviewState"]>[0],
  context: MasterAIToolContext,
  sessionId: string
) => Promise<ToolFunctionResponsePayload> = async (
  args,
  context,
  sessionId
) => {
  console.warn(
    `[MasterTool:updateInterviewState] Placeholder called for session ${sessionId}. Args:`,
    args,
    `Context:`,
    context
  );
  // Implement actual state update logic here
  return {
    success: true,
    data: { message: "Update interview state placeholder executed." },
    nextActionForMaster: "wait_for_user",
  };
};

export const analyzeBehavior: (
  args: Parameters<ToolFunctions["analyzeBehavior"]>[0],
  context: MasterAIToolContext,
  sessionId: string
) => Promise<ToolFunctionResponsePayload> = async (
  args,
  context,
  sessionId
) => {
  console.warn(
    `[MasterTool:analyzeBehavior] Placeholder called for session ${sessionId}. Args:`,
    args,
    `Context:`,
    context
  );
  // Implement actual behavior analysis logic here
  return {
    success: true,
    data: { message: "Analyze behavior placeholder executed." },
    nextActionForMaster: "wait_for_user",
  };
};

export const assessTechnicalResponse: (
  args: Parameters<ToolFunctions["assessTechnicalResponse"]>[0],
  context: MasterAIToolContext,
  sessionId: string
) => Promise<ToolFunctionResponsePayload> = async (
  args,
  context,
  sessionId
) => {
  console.warn(
    `[MasterTool:assessTechnicalResponse] Placeholder called for session ${sessionId}. Args:`,
    args,
    `Context:`,
    context
  );
  // Implement actual technical response assessment logic here
  return {
    success: true,
    data: { message: "Assess technical response placeholder executed." },
    nextActionForMaster: "wait_for_user",
  };
};

// Load some sample job data when the module loads
// In a real app, this would come from a DB or API
const sampleJobData: JobData = {
  job_details: {
    id: 101,
    title: "Senior React Developer",
    objective: "To build and maintain our cutting-edge user interfaces.",
  },
  requirements: {
    skills: "React, TypeScript, Redux, Next.js",
    qualifications: "5+ years experience",
  },
  interview_questions: [
    {
      id: 1,
      job_id: 101,
      topic_id: 1,
      topic_name: "Introduction",
      intent_id: 1,
      question:
        "Tell me about your experience with React and state management.",
      expected_answer:
        "Candidate should detail specific projects, challenges, and solutions related to React and state management libraries like Redux or Zustand.",
      evaluation_criteria:
        "Depth of React knowledge, practical experience, problem-solving.",
      difficulty_level: "medium",
      question_type: "technical",
      tags: ["react", "state management"],
    },
    {
      id: 2,
      job_id: 101,
      topic_id: 2,
      topic_name: "Behavioral",
      intent_id: 2,
      question:
        "Describe a time you had to deal with a difficult team member. How did you handle it?",
      expected_answer:
        "Candidate should use STAR method, focus on positive resolution and learning.",
      evaluation_criteria: "Conflict resolution, communication, teamwork.",
      difficulty_level: "medium",
      question_type: "behavioral",
      tags: ["teamwork", "conflict"],
    },
  ],
  job_intents: [
    {
      intent_id: 1,
      intent_name: "React Proficiency",
      description:
        "Demonstrates deep understanding and practical application of React concepts.",
      weightage: 60,
    },
    {
      intent_id: 2,
      intent_name: "Teamwork & Communication",
      description:
        "Ability to work effectively in a team and communicate clearly.",
      weightage: 40,
    },
  ],
  language: "English",
};
loadJobData(sampleJobData);

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
  const newContext = {
    currentTurn: 0,
    conversationHistory: [],
    jobData: jobDataStore || undefined,
    currentEvaluations: [],
    currentOverallScore: 0,
    concluded: false, // Ensure this is initialized
  };
  interviewSessionStore[sessionId] = newContext;
  return newContext;
}
