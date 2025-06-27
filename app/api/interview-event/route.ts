// src/app/api/interview-event/route.ts

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import {
  getMasterContext,
  updateMasterContext,
  initializeSession,
  toolFunctions,
} from "@/lib/master-ai-tools";
import {
  getEnabledTools,
  updateEnabledTools,
} from "@/lib/openai-tool-definitions";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const MASTER_MODEL = "gpt-4.1-nano-2025-04-14";
const MASTER_SYSTEM_PROMPT = `You are a Master AI conversation monitor. Your job is to:
1. Analyze conversation exchanges between participants
2. ONLY call tools when you clearly detect the specified conditions
3. If no clear triggers detected, respond with "No intervention needed."
4. Do NOT call tools for unrelated conversations`;

interface ConversationMessageForBatch {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export async function POST(req: NextRequest) {
  try {
    const { sessionId, conversationBatch, type, enabledTools } =
      await req.json();

    if (!sessionId) {
      return NextResponse.json(
        { error: "Session ID is required." },
        { status: 400 }
      );
    }

    // Handle tool configuration updates
    if (type === "update_tools" && enabledTools) {
      console.log("[Master AI] Updating enabled tools:", enabledTools);
      updateEnabledTools(enabledTools);
      return NextResponse.json({
        success: true,
        enabledTools: enabledTools,
        message: "Tools updated successfully",
      });
    }

    let masterContext = getMasterContext(sessionId);
    if (!masterContext) {
      masterContext = initializeSession(sessionId);
    }

    // Handle batch conversation processing
    if (type === "conversation_batch" && conversationBatch) {
      console.log("[Master AI] Processing conversation batch...");

      // Get currently enabled tools
      const currentTools = getEnabledTools();

      if (currentTools.length === 0) {
        console.log("[Master AI] No tools enabled, skipping analysis");
        return NextResponse.json({
          masterAISystemMessage: "No intervention needed - no tools enabled.",
          sessionId: sessionId,
        });
      }

      // Add to conversation history
      masterContext.conversationHistory.push(
        ...(conversationBatch as ConversationMessageForBatch[]).map((msg) => ({
          id: Date.now() + Math.random(),
          timestamp: new Date(msg.timestamp).toISOString(),
          speaker: msg.role,
          message: msg.content,
        }))
      );

      const recentConversation = (
        conversationBatch as ConversationMessageForBatch[]
      )
        .map((msg) => `${msg.role}: ${msg.content}`)
        .join("\n");

      console.log("[Master AI] Analyzing conversation:", recentConversation);
      console.log(
        "[Master AI] Using tools:",
        currentTools.map((t) => t.function.name)
      );

      const masterMessages: ChatCompletionMessageParam[] = [
        {
          role: "system",
          content: `${MASTER_SYSTEM_PROMPT}

Available tools: ${currentTools.map((tool) => tool.function.name).join(", ")}
Available tools descriptions: ${currentTools
            .map(
              (tool) => `${tool.function.name}: ${tool.function.description}`
            )
            .join("; ")}`,
        },
        {
          role: "user",
          content: `Analyze this conversation exchange and determine if intervention is needed. If you detect any trigger, you MUST call the appropriate tools:\n\n${recentConversation}`,
        },
      ];

      let finalSystemInstruction = "No intervention needed.";

      try {
        const masterResponse = await openai.chat.completions.create({
          model: MASTER_MODEL,
          messages: masterMessages,
          tools: currentTools,
          tool_choice: "auto",
        });

        const masterMessage = masterResponse.choices[0].message;

        if (masterMessage.tool_calls && masterMessage.tool_calls.length > 0) {
          console.log(
            "[Master AI] Tool calls detected:",
            masterMessage.tool_calls.length
          );
          masterMessages.push(masterMessage);

          const interventions: string[] = [];

          for (const toolCall of masterMessage.tool_calls) {
            const functionName = toolCall.function.name;
            const functionArgs = JSON.parse(toolCall.function.arguments);

            console.log(
              `[Master AI] Executing tool: ${functionName} with args:`,
              functionArgs
            );

            if (toolFunctions[functionName]) {
              const toolResult = await toolFunctions[functionName](
                functionArgs,
                masterContext,
                sessionId
              );

              console.log(
                `[Master AI] Tool ${functionName} result:`,
                toolResult
              );

              if (
                toolResult.success &&
                typeof toolResult.data?.intervention === "string"
              ) {
                interventions.push(toolResult.data.intervention);
              }

              masterMessages.push({
                role: "tool",
                tool_call_id: toolCall.id,
                content: JSON.stringify(toolResult.data || toolResult.error),
              });
            } else {
              console.error(`[Master AI] Unknown tool: ${functionName}`);
              masterMessages.push({
                role: "tool",
                tool_call_id: toolCall.id,
                content: JSON.stringify({
                  error: `Unknown tool: ${functionName}`,
                }),
              });
            }
          }

          if (interventions.length > 0) {
            finalSystemInstruction = interventions.join("\n\n");
            console.log(
              `[Master AI] Using tool-generated interventions: ${finalSystemInstruction}`
            );
          }
        } else if (masterMessage.content) {
          console.log("[Master AI] No tools called, using direct response");
          finalSystemInstruction = masterMessage.content;
        }

        console.log(
          `[Master AI] Final intervention instruction: ${finalSystemInstruction}`
        );
        updateMasterContext(sessionId, {
          masterAISystemMessage: finalSystemInstruction,
        });

        return NextResponse.json({
          masterAISystemMessage: finalSystemInstruction,
          sessionId: sessionId,
        });
      } catch (error) {
        console.error("Error processing conversation batch:", error);
        updateMasterContext(sessionId, {
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

    return NextResponse.json({
      masterAISystemMessage: "Request type not handled.",
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
