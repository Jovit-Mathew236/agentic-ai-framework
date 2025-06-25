// src/lib/openai-tool-definitions.ts
import type { OpenAIToolDefinition } from "@/lib/interview";

export const openAITools: OpenAIToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "getQuestion",
      description:
        "Gets the next question to ask the candidate. You should formulate the question text based on the interview strategy, job data, and candidate's previous responses, then provide it to this tool.",
      parameters: {
        type: "object",
        properties: {
          question_number: {
            type: "number",
            description:
              "The sequential number of this question in the interview (e.g., 1, 2, 3).",
          },
          question: {
            type: "string",
            description:
              "The full text of the question you have formulated to ask the candidate.",
          },
          question_id: {
            type: "string",
            description:
              'A unique ID for this question (e.g., from job_data or a custom one like "icebreaker_1").',
          },
          reference_answer: {
            type: "string",
            description:
              "The expected answer or key criteria for this question. Use 'expected_answer' from job_data if relevant.",
          },
          suggestedType: {
            type: "string",
            enum: ["qna", "behavioral", "technical", "coding"],
            description:
              "The type of question (e.g., 'behavioral', 'technical').",
          },
          category: {
            type: "string",
            description:
              "Optional category, e.g., 'Teamwork', 'React Knowledge', or topic_name from job_data.",
          },
        },
        required: [
          "question_number",
          "question",
          "question_id",
          "reference_answer",
          "suggestedType",
        ],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "storeEvaluation",
      description:
        "Stores the detailed evaluation of the candidate's response to the last question, including scores for specific job intents.",
      parameters: {
        type: "object",
        properties: {
          question: {
            type: "string",
            description: "The exact question text that was asked.",
          },
          question_id: {
            type: "string",
            description: "The ID of the question that was asked.",
          },
          response: {
            type: "string",
            description: "The candidate's full, verbatim response.",
          },
          intent_scores: {
            type: "array",
            description:
              "Array of scores for each relevant job intent. Each item must include intent_id, intent_name, and score (0-100).",
            items: {
              type: "object",
              properties: {
                intent_id: {
                  type: "number",
                  description: "ID of the intent from job_data.",
                },
                intent_name: {
                  type: "string",
                  description: "Name of the intent from job_data.",
                },
                score: {
                  type: "number",
                  description: "Score (0-100) for this intent.",
                },
                analysis: {
                  type: "string",
                  description:
                    "Optional brief analysis for this specific intent's score.",
                },
              },
              required: ["intent_id", "intent_name", "score"],
            },
          },
          average_score: {
            type: "number",
            description:
              "The AI-calculated weighted average score (0-100) for this response based on intent_scores and their weightings.",
          },
          analysis: {
            type: "string",
            description:
              "Overall analysis of the candidate's response. Must be evidence-based from what the candidate ACTUALLY said.",
          },
          reference_answer: {
            type: "string",
            description:
              "The reference/expected answer for comparison (from getQuestion or job_data).",
          },
          comparison_notes: {
            type: "string",
            description:
              "Optional AI-generated notes comparing candidate's answer to reference.",
          },
          question_category: {
            type: "string",
            description: "Optional category of the question.",
          },
        },
        required: [
          "question",
          "question_id",
          "response",
          "intent_scores",
          "average_score",
          "analysis",
          "reference_answer",
        ],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "transferAgents",
      description:
        "Transfers the interview to a different agent or concludes the interview process. Call this when your role is complete or a specific condition for transfer is met.",
      parameters: {
        type: "object",
        properties: {
          destination_agent: {
            type: "string",
            description:
              'Name of the agent to transfer to (e.g., "technicalInterviewer", "conclusionInterviewer").',
          },
          rationale_for_transfer: {
            type: "string",
            description: "Brief reason for the transfer.",
          },
          conversation_context: {
            type: "object",
            description:
              "Comprehensive context for the next agent, including original job_data, ALL evaluations made so far, and the final overall_score.",
            properties: {
              // job_data: { type: 'object', description: 'The complete original job_data object.'}, // Can be large, Master AI can inject this if needed.
              evaluations: {
                type: "array",
                items: { type: "object" },
                description:
                  "Array of ALL EvaluationResult objects from this interview session.",
              },
              overall_score: {
                type: "number",
                description:
                  "The final calculated overall score for the candidate in this phase.",
              },
            },
            required: ["evaluations", "overall_score"],
          },
        },
        required: [
          "destination_agent",
          "rationale_for_transfer",
          "conversation_context",
        ],
      },
    },
  },
];
