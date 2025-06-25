// src/app/api/interview-event/route.ts
import { NextRequest, NextResponse } from "next/server";
import { openai } from "@/lib/openai";
import { openAITools } from "@/lib/openai-tool-definitions";
import * as MasterTools from "@/lib/master-ai-tools";
import type {
  TranscriptEntry,
  ToolFunctionResponsePayload,
  BackendToolFunctions,
  MasterAIToolContext,
} from "@/lib/interview";
import {
  ChatCompletionMessageParam,
  ChatCompletionMessageToolCall,
} from "openai/resources/chat/completions";

interface ToolCallResultForFrontend {
  tool_call_id: string;
  tool_name: string;
  result: Record<string, unknown>; // Changed from any for stricter typing
}

type MasterToolImplementations = {
  [K in keyof BackendToolFunctions]: BackendToolFunctions[K];
};

const GREETING_AGENT_INSTRUCTIONS = `
# Role and Purpose
You are the **Greeter** in an interview. Your role is to:
1. Welcome the candidate.
2. Provide a brief overview of the job and company (details will be in job_data).
3. Ask 3-4 initial screening questions using the 'getQuestion' tool.
4. Evaluate each response using the 'storeEvaluation' tool, focusing on intents from job_data.
5. After evaluations, transfer using 'transferAgents' tool.

`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const userInput: string | null = body.message; // Candidate's message
    const sessionId: string = body.sessionId || `session_${Date.now()}`; // Manage session ID
    const action: "start" | "continue" | "tool_response" =
      body.action || (userInput ? "continue" : "start");
    const toolResponseData = body.toolResponseData; // Data from our backend tool execution

    let currentMasterAIContext = MasterTools.getMasterAIContext(sessionId);

    if (action === "start") {
      currentMasterAIContext = MasterTools.initializeSession(sessionId);
      currentMasterAIContext.conversationHistory.push({
        id: `sys_init_${Date.now()}`,
        speaker: "system",
        message:
          GREETING_AGENT_INSTRUCTIONS +
          "\nJob Data: " +
          JSON.stringify(currentMasterAIContext.jobData, null, 2), // Provide job data
        timestamp: new Date().toISOString(),
      });
      MasterTools.updateMasterAIContext(sessionId, {
        currentTurn: 1,
        conversationHistory: currentMasterAIContext.conversationHistory,
      });
    } else if (userInput) {
      currentMasterAIContext.conversationHistory.push({
        id: `user_${Date.now()}`,
        speaker: "candidate",
        message: userInput,
        timestamp: new Date().toISOString(),
      });
      MasterTools.updateMasterAIContext(sessionId, {
        conversationHistory: currentMasterAIContext.conversationHistory,
        lastCandidateResponse:
          currentMasterAIContext.conversationHistory.slice(-1)[0],
      });
    }

    // Prepare messages for OpenAI API
    const messagesForOpenAI: ChatCompletionMessageParam[] =
      currentMasterAIContext.conversationHistory.map(
        (item: TranscriptEntry) => {
          if (item.speaker === "candidate") {
            return {
              role: "user",
              content: item.message,
            };
          } else if (item.speaker === "ai") {
            if (item.data?.tool_calls) {
              return {
                role: "assistant",
                content: item.message || null, // Content can be null if only tool_calls are present
                tool_calls: item.data
                  .tool_calls as ChatCompletionMessageToolCall[],
              };
            } else {
              return {
                role: "assistant",
                content: item.message,
              };
            }
          } else if (item.speaker === "system") {
            if (item.data?.type === "tool_response" && item.data.tool_call_id) {
              return {
                role: "tool",
                tool_call_id: item.data.tool_call_id,
                // For tool responses, the 'content' should be the stringified result
                content: item.message,
              };
            } else {
              return {
                role: "system",
                content: item.message,
              };
            }
          }
          // Fallback for unexpected cases, though ideally all paths are covered
          return {
            role: "system",
            content: `Unexpected history entry from speaker: ${item.speaker}`,
          };
        }
      );

    if (action === "tool_response" && toolResponseData) {
      messagesForOpenAI.push({
        role: "tool",
        tool_call_id: toolResponseData.tool_call_id,
        content: JSON.stringify(toolResponseData.result),
      });
      // Add this tool response to history for our MasterAI tracking
      currentMasterAIContext.conversationHistory.push({
        id: toolResponseData.tool_call_id,
        speaker: "system", // Use speaker instead of role directly
        message: `Tool response for ${
          toolResponseData.tool_name
        }: ${JSON.stringify(toolResponseData.result)}`,
        timestamp: new Date().toISOString(),
        data: {
          type: "tool_response",
          tool_call_id: toolResponseData.tool_call_id,
          tool_name: toolResponseData.tool_name,
        },
      });
      MasterTools.updateMasterAIContext(sessionId, {
        conversationHistory: currentMasterAIContext.conversationHistory,
      });
    }

    console.log(
      `[API /interview-event] Sending to OpenAI. Turn: ${currentMasterAIContext.currentTurn}, Action: ${action}`
    );
    // console.log("[API /interview-event] Messages for OpenAI:", JSON.stringify(messagesForOpenAI.slice(-5),null,2)); // Log last few

    const response = await openai.chat.completions.create({
      model: "gpt-4.1-nano", // Or your preferred model that supports tool calling
      messages: messagesForOpenAI,
      tools: openAITools,
      tool_choice: "auto", // OpenAI decides when to call a function
      temperature: 0.5, // Adjust for desired creativity/strictness
    });

    const aiResponse = response.choices[0].message;
    let masterNextActionGuidance: ToolFunctionResponsePayload["nextActionForMaster"] =
      "wait_for_user";

    if (aiResponse.content) {
      console.log(
        "[API /interview-event] AI text response:",
        aiResponse.content
      );
      currentMasterAIContext.conversationHistory.push({
        id: `ai_${Date.now()}`,
        speaker: "ai", // Use speaker instead of role directly
        message: aiResponse.content,
        timestamp: new Date().toISOString(),
      });
      MasterTools.updateMasterAIContext(sessionId, {
        conversationHistory: currentMasterAIContext.conversationHistory,
      });
    }

    // Handle tool calls if any
    const toolCalls = aiResponse.tool_calls;
    let immediateToolResponseRequired = false;
    const toolCallResultsForFrontend: ToolCallResultForFrontend[] = [];

    if (toolCalls) {
      console.log("[API /interview-event] AI wants to call tools:", toolCalls);
      // Add the AI's intent to call tools to history
      const lastHistoryItem =
        currentMasterAIContext.conversationHistory[
          currentMasterAIContext.conversationHistory.length - 1
        ];
      if (
        lastHistoryItem &&
        lastHistoryItem.speaker === "ai" &&
        !lastHistoryItem.data?.tool_calls
      ) {
        // If it's the same AI message
        lastHistoryItem.data = {
          ...(lastHistoryItem.data || {}),
          tool_calls: toolCalls,
        };
      } else {
        // Or if it's a new system entry for the tool call intent
        currentMasterAIContext.conversationHistory.push({
          id: `ai_tool_intent_${Date.now()}`,
          speaker: "ai", // Use speaker instead of role directly
          message: `[AI intends to use tool(s): ${toolCalls
            .map((tc) => tc.function.name)
            .join(", ")}]`,
          timestamp: new Date().toISOString(),
          data: { tool_calls: toolCalls },
        });
      }
      MasterTools.updateMasterAIContext(sessionId, {
        conversationHistory: currentMasterAIContext.conversationHistory,
      });

      for (const toolCall of toolCalls) {
        const functionName = toolCall.function
          .name as keyof BackendToolFunctions;
        const functionArgs = JSON.parse(toolCall.function.arguments);

        console.log(
          `[API /interview-event] Executing tool: ${functionName} with args:`,
          functionArgs
        );

        // Type assertion for MasterTools to ensure we only access functions defined in BackendToolFunctions
        const toolFn = (MasterTools as MasterToolImplementations)[functionName];

        if (toolFn) {
          const resultPayload: ToolFunctionResponsePayload = await toolFn(
            functionArgs,
            currentMasterAIContext as MasterAIToolContext, // Cast to MasterAIToolContext
            sessionId
          );

          toolCallResultsForFrontend.push({
            tool_call_id: toolCall.id,
            tool_name: functionName,
            result: resultPayload.data || {
              success: resultPayload.success,
              error: resultPayload.error,
            },
          });

          if (resultPayload.nextSystemMessageToSlave) {
            // This is tricky. If a tool execution immediately yields a new system message,
            // it implies the *next* turn for the slave AI should use it.
            // For now, we'll let the next OpenAI call handle it based on updated history.
            console.log(
              `[API /interview-event] Tool ${functionName} suggests next system message: ${resultPayload.nextSystemMessageToSlave}`
            );
          }
          if (resultPayload.nextActionForMaster) {
            masterNextActionGuidance = resultPayload.nextActionForMaster;
          }
          if (
            functionName === "storeEvaluation" ||
            functionName === "getQuestion"
          ) {
            MasterTools.updateMasterAIContext(sessionId, {
              currentTurn: currentMasterAIContext.currentTurn + 1,
            });
          }
        } else {
          console.error(
            `[API /interview-event] Unknown tool function: ${functionName}`
          );
          toolCallResultsForFrontend.push({
            tool_call_id: toolCall.id,
            tool_name: functionName,
            result: { error: `Unknown tool function: ${functionName}` },
          });
        }
      }
      immediateToolResponseRequired = true; // We need to send these results back to OpenAI
    }

    const updatedContext = MasterTools.getMasterAIContext(sessionId);

    return NextResponse.json({
      sessionId: sessionId,
      aiMessage: aiResponse.content, // Text part of AI's response
      toolCalls: toolCalls, // If AI wants to call a tool, frontend needs to know to send back results
      toolCallResults: immediateToolResponseRequired
        ? toolCallResultsForFrontend
        : undefined,
      history: updatedContext.conversationHistory,
      interviewState: {
        // Send relevant parts of master AI context
        currentTurn: updatedContext.currentTurn,
        evaluations: updatedContext.currentEvaluations,
        overallScore: updatedContext.currentOverallScore,
        currentQuestion: updatedContext.currentQuestion,
        concluded: updatedContext.concluded || false,
        jobTitle: updatedContext.jobData?.job_details?.title,
      },
      // Guidance for frontend based on master AI's state after tool execution
      masterNextAction: masterNextActionGuidance,
    });
  } catch (error) {
    console.error("API Error in /interview-event:", error);
    let errorMessage = "An unknown error occurred";
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return NextResponse.json(
      { error: errorMessage, history: [] },
      { status: 500 }
    );
  }
}
