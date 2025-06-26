// src/app/api/interview-event/route.ts
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import {
  ChatCompletionMessageParam,
  ChatCompletionMessage,
} from "openai/resources/chat/completions";

import {
  getMasterAIContext,
  updateMasterAIContext,
  initializeSession,
  detectAnimal,
} from "@/lib/master-ai-tools";
import { openAITools } from "@/lib/openai-tool-definitions";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// --- Orchestrator AI Configuration (GPT-4.1 Turbo) ---
const ORCHESTRATOR_MODEL = "gpt-3.5-turbo"; // Changed from gpt-4-0125-preview
const ORCHESTRATOR_SYSTEM_PROMPT = `You are an orchestrator. Detect if user mentions cats or dogs. Then call detectAnimal. Based on the output, return only a system message to guide the assistant to ask about the other animal.`;

// --- Slave AI Configuration (o4-mini) ---
const SLAVE_MODEL = "gpt-3.5-turbo"; // Changed from openai/gpt-4o-mini

export async function POST(req: NextRequest) {
  const { sessionId, userMessageContent } = await req.json();

  if (!sessionId || !userMessageContent) {
    return NextResponse.json(
      { error: "Session ID and user message are required." },
      { status: 400 }
    );
  }

  let masterAIContext = getMasterAIContext(sessionId);

  if (!masterAIContext) {
    masterAIContext = initializeSession(sessionId);
  }

  // Add user message to conversation history for both AIs
  masterAIContext.conversationHistory.push({
    id: Date.now(),
    timestamp: new Date().toISOString(),
    speaker: "candidate",
    message: userMessageContent,
  });

  // --- Step 1: Orchestrator AI (GPT-4.1 Turbo) decides on tool calls ---
  console.log("[Route] Calling Orchestrator AI...");

  const orchestratorMessages: ChatCompletionMessageParam[] = [
    { role: "system", content: ORCHESTRATOR_SYSTEM_PROMPT },
    { role: "user", content: userMessageContent },
  ];

  try {
    const orchestratorResponse = await openai.chat.completions.create({
      model: ORCHESTRATOR_MODEL,
      messages: orchestratorMessages,
      tools: openAITools,
      tool_choice: "auto",
    });

    const orchestratorResponseChoice = orchestratorResponse.choices[0];
    const orchestratorMessage: ChatCompletionMessage =
      orchestratorResponseChoice.message;

    // --- Step 2: Handle tool calls from Orchestrator AI ---
    if (
      orchestratorMessage.tool_calls &&
      orchestratorMessage.tool_calls.length > 0
    ) {
      console.log("[Route] Orchestrator AI made tool calls.");
      for (const toolCall of orchestratorMessage.tool_calls) {
        const functionName = toolCall.function.name;
        const functionArgs = JSON.parse(toolCall.function.arguments);

        if (functionName === "detectAnimal") {
          console.log(`[Route] Executing tool: ${functionName}`);

          const toolResult = await detectAnimal(
            functionArgs,
            masterAIContext,
            sessionId
          );

          // Add tool output to orchestrator's conversation history for context
          orchestratorMessages.push({
            tool_call_id: toolCall.id,
            role: "tool",
            content: JSON.stringify(toolResult.data || toolResult.error),
          });

          // --- Step 3: Get Orchestrator AI's final system message based on tool result ---
          console.log("[Route] Getting Orchestrator AI's final response...");
          const finalOrchestratorResponse =
            await openai.chat.completions.create({
              model: ORCHESTRATOR_MODEL,
              messages: orchestratorMessages,
            });

          const finalOrchestratorMessage: ChatCompletionMessage =
            finalOrchestratorResponse.choices[0].message;

          // The orchestrator is designed to return a system message. Directly use its content.
          const systemMessageContent = finalOrchestratorMessage.content || "";

          if ((finalOrchestratorMessage.role as string) !== "system") {
            console.warn(
              `[Route] Orchestrator AI returned unexpected role: ${finalOrchestratorMessage.role}. Using content as system message anyway.`
            );
          }
          console.log(
            `[Route] Orchestrator AI system message: ${systemMessageContent}`
          );
          updateMasterAIContext(sessionId, {
            masterAISystemMessage: systemMessageContent,
          });
        }
      }
    } else if (orchestratorMessage.content) {
      // If no tool calls, but orchestrator has a direct message, use it as system message
      console.log(
        `[Route] Orchestrator AI direct message: ${orchestratorMessage.content}`
      );
      updateMasterAIContext(sessionId, {
        masterAISystemMessage: orchestratorMessage.content || "",
      });
    }
  } catch (error) {
    console.error("Error during Orchestrator AI processing:", error);
    return NextResponse.json(
      { error: "Failed to process Orchestrator AI response." },
      { status: 500 }
    );
  }

  // --- Step 4: Slave AI (o4-mini) generates response using updated context ---
  console.log("[Route] Calling Slave AI...");

  masterAIContext = getMasterAIContext(sessionId); // Get updated context

  const slaveAIMessages: ChatCompletionMessageParam[] = [
    {
      role: "system",
      content:
        masterAIContext.masterAISystemMessage || "You are a helpful assistant.",
    },
    // Add previous conversation history from masterAIContext
    ...masterAIContext.conversationHistory.map((entry) => {
      let role: "user" | "assistant" | "system";
      if (entry.speaker === "candidate") {
        role = "user";
      } else if (entry.speaker === "ai") {
        role = "assistant";
      } else {
        role = "system";
      }
      return { role, content: entry.message };
    }),
  ];

  try {
    const slaveAIResponse = await openai.chat.completions.create({
      model: SLAVE_MODEL,
      messages: slaveAIMessages,
      // Stream: true if you want to stream the response
    });

    const assistantResponseContent = slaveAIResponse.choices[0].message.content;

    if (assistantResponseContent) {
      // Add Slave AI's response to conversation history
      masterAIContext.conversationHistory.push({
        id: Date.now() + 1,
        timestamp: new Date().toISOString(),
        speaker: "ai",
        message: assistantResponseContent,
      });

      updateMasterAIContext(sessionId, { ...masterAIContext }); // Save updated history

      return NextResponse.json({
        response: assistantResponseContent,
        masterAISystemMessage: masterAIContext.masterAISystemMessage,
      });
    }
  } catch (error) {
    console.error("Error during Slave AI processing:", error);
    return NextResponse.json(
      { error: "Failed to get response from Slave AI." },
      { status: 500 }
    );
  }

  return NextResponse.json({ response: "No response generated." });
}

// Removed: initializeInterview, interviewSessionStore, jobDataStore, and all other interview-related endpoints and logic.
