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

// --- Master AI Configuration ---
const MASTER_MODEL = "gpt-4.1-nano-2025-04-14";
const MASTER_SYSTEM_PROMPT = `You are a silent interview monitor. Your job is to:
1. Analyze conversation exchanges between interviewer and candidate
2. ALWAYS call detectAnimal function when you see mentions of: cats, dogs, or any animals
3. Look for keywords like "cat", "cats", "dog", "dogs", "pet", "pets" in the conversation
4. Based on detection results, provide specific instructions to guide the interviewer
5. If no animals are mentioned, respond with "No intervention needed."
6. Keep responses concise and focused on interview flow management

IMPORTANT: When you see animal-related words, you MUST call the detectAnimal function.`;

export async function POST(req: NextRequest) {
  try {
    const { sessionId, conversationBatch, type } = await req.json();

    if (!sessionId) {
      return NextResponse.json(
        { error: "Session ID is required." },
        { status: 400 }
      );
    }

    let masterAIContext = getMasterAIContext(sessionId);
    if (!masterAIContext) {
      masterAIContext = initializeSession(sessionId);
    }

    // Handle batch conversation processing (MAIN FLOW)
    if (type === "conversation_batch" && conversationBatch) {
      console.log("[Master AI] Processing conversation batch...");

      // Add all messages from batch to conversation history
      conversationBatch.forEach((msg: any) => {
        masterAIContext.conversationHistory.push({
          id: Date.now() + Math.random(),
          timestamp: new Date().toISOString(),
          speaker: msg.role === "user" ? "candidate" : "ai",
          message: msg.content,
        });
      });

      // Analyze the conversation batch
      const recentConversation = conversationBatch
        .map((msg: any) => `${msg.role}: ${msg.content}`)
        .join("\n");

      console.log("[Master AI] Analyzing conversation:", recentConversation);

      // Prepare messages for OpenAI API
      const masterMessages: ChatCompletionMessageParam[] = [
        {
          role: "system",
          content: MASTER_SYSTEM_PROMPT,
        },
        // Add previous conversation history if available (optional, but good for context)
        ...masterAIContext.conversationHistory.slice(-5).map((entry) => ({
          role: entry.speaker === "candidate" ? "user" : "assistant",
          content: entry.message,
        })),
        // Current exchange
        {
          role: "user",
          content: `Analyze this conversation exchange and determine if intervention is needed:\n\n${recentConversation}`,
        },
      ];

      let finalSystemInstruction = "No intervention needed."; // Default
      let toolArgs: any = {}; // To store arguments if a tool is called

      try {
        const masterResponse = await openai.chat.completions.create({
          model: MASTER_MODEL,
          messages: masterMessages,
          tools: openAITools,
          tool_choice: "auto",
        });

        const masterMessage = masterResponse.choices[0].message;

        // Handle tool calls if present
        if (masterMessage.tool_calls && masterMessage.tool_calls.length > 0) {
          console.log("[Master AI] Tool calls detected");

          // Add the assistant message with tool calls to the conversation
          masterMessages.push({
            role: "assistant",
            content: masterMessage.content, // This might be null if only tool_calls are present
            tool_calls: masterMessage.tool_calls,
          });

          // Process each tool call
          for (const toolCall of masterMessage.tool_calls) {
            const functionName = toolCall.function.name;
            const functionArgs = JSON.parse(toolCall.function.arguments);
            toolArgs = functionArgs; // Store args for later

            if (functionName === "detectAnimal") {
              console.log(
                `[Master AI] Executing tool: ${functionName} with args:`,
                functionArgs
              );

              const toolResult = await detectAnimal(
                functionArgs,
                masterAIContext,
                sessionId
              );

              // Add tool response to the conversation
              masterMessages.push({
                role: "tool",
                tool_call_id: toolCall.id,
                content: JSON.stringify(toolResult.data || toolResult.error),
              });
            }
          }

          // Get final response from master after tool execution
          console.log("[Master AI] Getting final intervention decision...");
          const finalMasterResponse = await openai.chat.completions.create({
            model: MASTER_MODEL,
            messages: masterMessages, // Now includes tool results
          });

          const finalMessage = finalMasterResponse.choices[0].message;

          if (finalMessage.content) {
            console.log(`[Master AI] Final decision: ${finalMessage.content}`);
            finalSystemInstruction = finalMessage.content; // This is the instruction for the interviewer
          } else {
            // If no content but tool was called, construct a basic instruction
            if (toolArgs.animal === "cat") {
              finalSystemInstruction =
                "The candidate mentioned cats. Ask them about their experience with dinosaurs or pets in general.";
            } else if (toolArgs.animal === "dinosaur") {
              finalSystemInstruction =
                "The candidate mentioned dinosaurs. Ask them about their experience with cats or other pets.";
            } else {
              finalSystemInstruction = "No intervention needed.";
            }
          }
        } else if (masterMessage.content) {
          // No tool calls, use direct response
          console.log(`[Master AI] Direct response: ${masterMessage.content}`);
          finalSystemInstruction = masterMessage.content;
        }

        // Update the context with the determined system instruction
        updateMasterAIContext(sessionId, {
          masterAISystemMessage: finalSystemInstruction,
        });

        // Important: Return the system instruction in the response
        return NextResponse.json({
          masterAISystemMessage: finalSystemInstruction,
          sessionId: sessionId,
        });
      } catch (error) {
        console.error("Error processing conversation batch:", error);
        // Update context with an error message if processing fails
        updateMasterAIContext(sessionId, {
          masterAISystemMessage: `Error processing conversation: ${
            (error as Error).message
          }`,
        });
        return NextResponse.json(
          { error: "Failed to process conversation batch." },
          { status: 500 }
        );
      }
    }

    // Default response for other request types
    return NextResponse.json({
      masterAISystemMessage: "No intervention needed.", // Default if no batch processing occurred
      sessionId: sessionId,
    });
  } catch (error) {
    console.error("Error in interview-event route:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
