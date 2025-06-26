"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Brain } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { v4 as uuidv4 } from "uuid";
// Import types and utilities
import type { TranscriptEntry, SystemMessageEntry } from "@/lib/interview";

// Import WebRTC utilities
import {
  createRealtimeConnection,
  sendMessageOnDataChannel,
  disconnectRTCSession,
  RTCConnectionState,
} from "@/lib/webrtc/rtc-utils";
import { TooltipProvider } from "../ui/tooltip";
import ActivityLog from "./activity-log";
import TranscriptSection from "./transcript-section";
import CurrentQuestionCard from "./current-question-card";
import StatusCard from "./status-card";
import ControlPanel from "./control-panel";
import Header from "./header";

// --- Interview Store ---
const useInterviewStore = () => {
  const [isActive, setIsActive] = useState<boolean>(false);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [systemMessages, setSystemMessages] = useState<SystemMessageEntry[]>(
    []
  );
  const [currentScore, setCurrentScore] = useState<number>(0);
  const [questionBank, setQuestionBank] = useState<never[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<undefined>(undefined);

  return {
    isActive,
    setIsActive,
    transcript,
    setTranscript,
    systemMessages,
    setSystemMessages,
    currentScore,
    setCurrentScore,
    questionBank,
    setQuestionBank,
    currentQuestion,
    setCurrentQuestion,
  };
};

// --- Conversation Buffer Interface ---
interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  eventType?: string;
}

interface ConversationBuffer {
  messages: ConversationMessage[];
  lastSent: number;
  pendingUserMessage?: string;
  pendingAssistantMessage?: string;
}

// --- Main Component ---
const InterviewDashboard: React.FC = () => {
  const store = useInterviewStore();
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [customSystemMessage, setCustomSystemMessage] = useState<string>("");
  const [masterAIResponse, setMasterAIResponse] = useState<string>(""); // State to display Master AI feedback

  // WebRTC related state and refs
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const [connectionState, setConnectionState] =
    useState<RTCConnectionState>("disconnected");
  const [rtcSessionId, setRtcSessionId] = useState<string | null>(null);

  // Conversation buffer for batching messages to master AI
  const conversationBufferRef = useRef<ConversationBuffer>({
    messages: [],
    lastSent: 0,
    pendingUserMessage: undefined,
    pendingAssistantMessage: undefined,
  });

  // Buffer configuration - REDUCED for more frequent sending
  const BUFFER_TIMEOUT = 5000; // Send to master every 5 seconds
  const MAX_BUFFER_SIZE = 2; // Or when buffer reaches 2 messages (1 user + 1 assistant)

  const isAudioPlaybackEnabled = true;

  // Refs for functions to break dependency cycles
  const simulateConversationEventRef =
    useRef<
      (
        speaker: "ai" | "candidate",
        message: string,
        score?: number | null
      ) => Promise<void>
    >(null);
  const sendToMasterAIRef = useRef<(message: string) => Promise<void>>(null);
  const handleRtcMessageRef =
    useRef<(data: Record<string, unknown>) => void>(null);

  // Mock logClientEvent and logServerEvent
  const logClientEvent = useCallback(
    (data: unknown, eventName: string) => {
      console.log(`[CLIENT EVENT: ${eventName}]`, data);
      const systemMessage: SystemMessageEntry = {
        id: Date.now() + Math.random(),
        timestamp: new Date().toLocaleTimeString(),
        role: "system",
        content: `Client Event: ${eventName}`,
        toolUsed: "rtc_logging",
      };
      store.setSystemMessages((prev) => [...prev, systemMessage]);
    },
    [store.setSystemMessages]
  );

  const logServerEvent = useCallback(
    (data: unknown, eventName: string) => {
      console.log(`[SERVER EVENT: ${eventName}]`, data);
      const systemMessage: SystemMessageEntry = {
        id: Date.now() + Math.random(),
        timestamp: new Date().toLocaleTimeString(),
        role: "system",
        content: `Server Event: ${eventName}`,
        toolUsed: "rtc_logging",
      };
      store.setSystemMessages((prev) => [...prev, systemMessage]);
    },
    [store.setSystemMessages]
  );

  const onAgentStreamReady = useCallback((stream: MediaStream) => {
    console.log("Agent audio stream ready:", stream);
    if (audioElementRef.current) {
      audioElementRef.current.srcObject = stream;
      audioElementRef.current
        .play()
        .catch((e) => console.warn("Audio play failed onAgentStreamReady:", e));
    }
  }, []);

  // FIXED: Add message to conversation buffer with proper pairing
  const addToConversationBuffer = useCallback(
    (role: "user" | "assistant", content: string, eventType?: string) => {
      // Skip very short or repetitive messages
      if (content.length < 3) {
        console.log("Skipping very short message:", content);
        return;
      }

      const buffer = conversationBufferRef.current;

      console.log(
        `[BUFFER] Adding ${role} message: "${content.substring(0, 50)}..."`
      );

      if (role === "user") {
        buffer.pendingUserMessage = content;
        console.log(`[BUFFER] Stored pending user message`);
      } else if (role === "assistant") {
        buffer.pendingAssistantMessage = content;
        console.log(`[BUFFER] Stored pending assistant message`);
      }

      // Check if we have a complete exchange (both user and assistant messages)
      if (buffer.pendingUserMessage && buffer.pendingAssistantMessage) {
        console.log(`[BUFFER] Complete exchange detected, adding to buffer`);

        // Add both messages to buffer
        buffer.messages.push({
          role: "user",
          content: buffer.pendingUserMessage,
          timestamp: Date.now() - 1000, // Slightly earlier timestamp for user
          eventType: "user_message",
        });

        buffer.messages.push({
          role: "assistant",
          content: buffer.pendingAssistantMessage,
          timestamp: Date.now(),
          eventType: "assistant_message",
        });

        // Clear pending messages
        buffer.pendingUserMessage = undefined;
        buffer.pendingAssistantMessage = undefined;

        console.log(
          `[BUFFER] Buffer now has ${buffer.messages.length} messages`
        );

        // Immediately flush the complete exchange
        flushConversationBuffer();
      }
    },
    []
  );

  // FIXED: Flush conversation buffer to master AI and handle interventions
  const flushConversationBuffer = useCallback(async () => {
    const buffer = conversationBufferRef.current;
    if (buffer.messages.length === 0) {
      console.log("[BUFFER] No messages to flush");
      return;
    }

    console.log(
      `[BUFFER] Flushing ${buffer.messages.length} messages to Master AI`
    );

    try {
      const response = await fetch("/api/interview-event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: rtcSessionId || `client-${crypto.randomUUID()}`,
          conversationBatch: buffer.messages,
          type: "conversation_batch",
        }),
      });

      console.log(
        `[BUFFER] Master AI request sent, status: ${response.status}`
      );

      if (response.ok) {
        const data = await response.json();
        console.log(`[BUFFER] Master AI response:`, data);

        // Handle master AI instructions
        if (
          data.masterAISystemMessage &&
          data.masterAISystemMessage !== "No intervention needed."
        ) {
          console.log(
            `[BUFFER] Master AI intervention: ${data.masterAISystemMessage}`
          );

          // Send system message to slave AI via WebRTC
          // const id = uuidv4().slice(0, 32);
          const systemMessagePayload = {
            type: "conversation.item.create",
            item: {
              // id: id,
              type: "message",
              role: "system",
              content: [
                {
                  type: "input_text",
                  text: data.masterAISystemMessage,
                },
              ],
            },
          };

          if (connectionState === "connected" && dcRef.current) {
            const sent = sendMessageOnDataChannel(
              dcRef.current,
              systemMessagePayload
            );
            if (sent) {
              console.log(
                "System instruction sent to Slave AI:",
                systemMessagePayload
              );
            } else {
              console.warn("Failed to send system instruction to Slave AI.");
            }
          }
          let sentVia = "";

          if (connectionState === "connected" && dcRef.current) {
            const sent = sendMessageOnDataChannel(
              dcRef.current,
              systemMessagePayload
            );
            if (sent) sentVia = "RTC";
            else
              console.warn("RTC send failed for system message, trying HTTP.");
          }

          if (sentVia !== "RTC") {
            sendToMasterAIRef.current?.(
              `System Message (via HTTP): ${data.masterAISystemMessage}`
            );
            sentVia = "HTTP";
          }
          const uiMessage: SystemMessageEntry = {
            id: Date.now(),
            timestamp: new Date().toLocaleTimeString(),
            role: "system",
            content: `Sent (${sentVia}): ${data.masterAISystemMessage}`,
            toolUsed: `manual_injection_${sentVia.toLowerCase()}`,
          };
          store.setSystemMessages((prev) => [...prev, uiMessage]);
        } else {
          setMasterAIResponse("Master AI: Monitoring - No intervention needed");
          console.log("[BUFFER] Master AI: No intervention needed");
        }

        // Update session ID if needed
        if (data.sessionId && !rtcSessionId) {
          setRtcSessionId(data.sessionId);
        }

        // Clear buffer after successful send
        buffer.messages = [];
        buffer.lastSent = Date.now();

        console.log(
          "[BUFFER] Conversation batch sent successfully to Master AI"
        );
      } else {
        console.error(
          "[BUFFER] Failed to send conversation batch:",
          response.status
        );
        const errorText = await response.text();
        console.error("[BUFFER] Error response:", errorText);
        setMasterAIResponse(
          `Error sending to Master AI: ${response.statusText}`
        );
      }
    } catch (error) {
      console.error(
        "[BUFFER] Error sending conversation batch to Master AI:",
        error
      );
      setMasterAIResponse(
        `Error communicating with Master AI: ${(error as Error).message}`
      );
    }
  }, [rtcSessionId, connectionState, store.setSystemMessages]);

  // Auto-flush buffer on interval
  useEffect(() => {
    const interval = setInterval(() => {
      if (conversationBufferRef.current.messages.length > 0) {
        console.log("[BUFFER] Auto-flushing buffer due to timeout");
        flushConversationBuffer();
      }
    }, BUFFER_TIMEOUT);

    return () => clearInterval(interval);
  }, [flushConversationBuffer]);

  // Simulate sending conversation events
  const simulateConversationEvent = useCallback(
    async (
      speaker: "ai" | "candidate",
      message: string,
      score: number | null = null
    ): Promise<void> => {
      const newEntry: TranscriptEntry = {
        id: Date.now(),
        timestamp: new Date().toLocaleTimeString(),
        speaker,
        message,
        score,
      };
      store.setTranscript((prev) => [...prev, newEntry]);

      // Add to conversation buffer for master AI analysis
      addToConversationBuffer(
        speaker === "candidate" ? "user" : "assistant",
        message,
        `simulated_${speaker}_message`
      );

      if (speaker === "candidate") {
        if (connectionState === "connected" && dcRef.current) {
          const messageId = crypto.randomUUID();
          const rtcMessage = {
            type: "conversation.item.create",
            item: {
              id: messageId,
              type: "message",
              role: "user",
              content: [{ type: "input_text", text: message }],
            },
          };
          const sent = sendMessageOnDataChannel(dcRef.current, rtcMessage);
          if (sent) {
            console.log("Candidate message sent via RTC:", rtcMessage);
          }
        }
      }
    },
    [store.setTranscript, connectionState, addToConversationBuffer]
  );

  // Core: send message to Master AI (for initialization only)
  const sendToMasterAI = useCallback(async (message: string) => {
    console.log("Master AI initialization:", message);
    // This function might be used for initial setup of the master AI,
    // but the primary interaction is through the /api/interview-event endpoint.
  }, []);

  // Update refs
  useEffect(() => {
    sendToMasterAIRef.current = sendToMasterAI;
  }, [sendToMasterAI]);

  useEffect(() => {
    simulateConversationEventRef.current = simulateConversationEvent;
  }, [simulateConversationEvent]);

  // Effect for creating audio element
  useEffect(() => {
    if (!audioElementRef.current) {
      audioElementRef.current = document.createElement("audio");
      audioElementRef.current.autoplay = isAudioPlaybackEnabled;
      document.body.appendChild(audioElementRef.current);
    }
    return () => {
      if (
        audioElementRef.current &&
        document.body.contains(audioElementRef.current)
      ) {
        document.body.removeChild(audioElementRef.current);
        audioElementRef.current = null;
      }
    };
  }, [isAudioPlaybackEnabled]);

  // Cleanup WebRTC connection on component unmount
  useEffect(() => {
    return () => {
      if (pcRef.current || dcRef.current) {
        console.log("Cleaning up WebRTC connection on unmount...");
        disconnectRTCSession(pcRef.current, dcRef.current);
        pcRef.current = null;
        dcRef.current = null;
        setConnectionState("disconnected");
      }
    };
  }, []);

  // FIXED: Enhanced RTC message handler with proper user message capture
  const handleRtcMessage = useCallback(
    (data: Record<string, unknown>) => {
      try {
        console.log("Received via Data Channel:", data);

        // FIXED: Handle user input audio transcription (THIS WAS MISSING!)
        if (
          data.type === "conversation.item.input_audio_transcription.completed"
        ) {
          const transcript = data.transcript as string;
          if (transcript && transcript.trim()) {
            console.log("[RTC] User speech transcribed:", transcript);
            simulateConversationEventRef.current?.("candidate", transcript);
            // Add user input to buffer
            addToConversationBuffer(
              "user",
              transcript,
              "input_audio_transcription"
            );
          }
        }

        // Handle conversation item created (for user messages)
        if (
          data.type === "conversation.item.created" ||
          data.type === "conversation.item.input_audio_transcription"
        ) {
          console.log("[RTC] Conversation item created:", data);

          const item = data.item as {
            role?: string;
            content?: Array<{
              type: string;
              text?: string;
              transcript?: string;
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              audio?: any;
            }>;
          };

          if (item && item.role === "user" && Array.isArray(item.content)) {
            // Look for transcript in audio content
            const audioContent = item.content.find(
              (c) => c.type === "input_audio"
            );
            if (audioContent) {
              console.log(
                "[RTC] User audio message created, waiting for transcription..."
              );
            }

            // Look for text content
            const textContent = item.content.find(
              (c) => c.type === "input_text"
            );
            if (textContent && textContent.text) {
              console.log("[RTC] User text message:", textContent.text);
              simulateConversationEventRef.current?.(
                "candidate",
                textContent.text
              );
              addToConversationBuffer(
                "user",
                textContent.text,
                "conversation_item_created"
              );
            }
          }
        }

        // Handle conversation item completed events
        if (data.type === "conversation.item.completed") {
          const item = data.item as {
            role?: string;
            content?: Array<{
              type: string;
              text?: string;
              transcript?: string;
            }>;
          };

          if (
            item &&
            item.role === "assistant" &&
            Array.isArray(item.content)
          ) {
            const textContent = item.content.find(
              (c) => c.type === "text" || c.transcript
            );
            const message = textContent?.text || textContent?.transcript || "";

            if (message && message.trim()) {
              console.log("[RTC] Assistant message completed:", message);
              simulateConversationEventRef.current?.("ai", message);
              addToConversationBuffer(
                "assistant",
                message,
                "conversation_item_completed"
              );
            }
          }
        }

        // Handle response audio transcript completion
        if (data.type === "response.audio_transcript.done") {
          const transcript = data.transcript as string;
          if (transcript && transcript.trim()) {
            console.log(
              "[RTC] Assistant audio transcript completed:",
              transcript
            );
            simulateConversationEventRef.current?.("ai", transcript);
            addToConversationBuffer(
              "assistant",
              transcript,
              "audio_transcript_done"
            );
          }
        }

        // Handle response completion
        if (data.type === "response.done") {
          console.log("[RTC] Response completed by Slave AI");
          logClientEvent(data, "response.done");
        }

        // Handle other event types for backward compatibility
        if (data.type === "system_event" && typeof data.content === "string") {
          const systemMessage: SystemMessageEntry = {
            id: Date.now(),
            timestamp: new Date().toLocaleTimeString(),
            role: "system",
            content: data.content,
            toolUsed: (data.toolUsed as string) || "rtc_event",
          };
          store.setSystemMessages((prev) => [...prev, systemMessage]);
        }
      } catch (error) {
        console.error("Failed to handle RTC message:", error);
      }
    },
    [
      store.setSystemMessages,
      simulateConversationEventRef,
      addToConversationBuffer,
      logClientEvent,
    ]
  );

  // Update ref for handleRtcMessage
  useEffect(() => {
    handleRtcMessageRef.current = handleRtcMessage;
  }, [handleRtcMessage]);

  const fetchEphemeralKey = useCallback(async (): Promise<string | null> => {
    try {
      logClientEvent(
        { url: "/api/rtc-session" },
        "fetch_ephemeral_key_request"
      );
      const tokenResponse = await fetch("/api/rtc-session");
      const data = await tokenResponse.json();
      logServerEvent(data, "fetch_ephemeral_key_response");

      if (!data.client_secret?.value) {
        logClientEvent(data, "error.no_ephemeral_key");
        console.error("No ephemeral key provided by the server");
        setConnectionState("failed");
        return null;
      }
      return data.client_secret.value;
    } catch (error) {
      console.error("Error fetching ephemeral key:", error);
      logClientEvent(
        { error: (error as Error).message },
        "error.fetch_ephemeral_key"
      );
      setConnectionState("failed");
      return null;
    }
  }, [logClientEvent, logServerEvent, setConnectionState]);

  const connectToRealtime = useCallback(async () => {
    if (connectionState !== "disconnected" && connectionState !== "failed") {
      console.log("Connection already active or in progress", connectionState);
      return;
    }
    setConnectionState("connecting");

    try {
      const EPHEMERAL_KEY = await fetchEphemeralKey();
      if (!EPHEMERAL_KEY) {
        return;
      }

      if (!audioElementRef.current) {
        audioElementRef.current = document.createElement("audio");
        document.body.appendChild(audioElementRef.current);
      }
      audioElementRef.current.autoplay = isAudioPlaybackEnabled;

      const { pc, dc } = await createRealtimeConnection(
        EPHEMERAL_KEY,
        audioElementRef
      );
      pcRef.current = pc;
      dcRef.current = dc;

      pc.ontrack = (e: RTCTrackEvent) => {
        console.log("Remote track received from agent in Dashboard");
        if (audioElementRef.current && e.streams?.[0]) {
          audioElementRef.current.srcObject = e.streams[0];
          audioElementRef.current
            .play()
            .catch((err) => console.warn("Audio play failed in ontrack:", err));
          onAgentStreamReady?.(e.streams[0]);
        }
      };

      dc.addEventListener("open", () => {
        logClientEvent({}, "data_channel.open");
        setConnectionState("connected");
        console.log("RTC Data Channel Opened");
      });
      dc.addEventListener("close", () => {
        logClientEvent({}, "data_channel.close");
        console.log("Data channel closed.");
        setConnectionState("disconnected");
        disconnectRTCSession(pcRef.current, dcRef.current);
        pcRef.current = null;
        dcRef.current = null;
      });
      dc.addEventListener("error", (err: Event) => {
        const errorEvent = err as RTCErrorEvent;
        logClientEvent(
          { error: errorEvent?.error?.message || String(err) },
          "data_channel.error"
        );
        console.error("Data channel error:", err);
        setConnectionState("failed");
        disconnectRTCSession(pcRef.current, dcRef.current);
        pcRef.current = null;
        dcRef.current = null;
      });

      dc.addEventListener("message", (e: MessageEvent) => {
        try {
          const parsedData = JSON.parse(e.data);
          handleRtcMessageRef.current?.(parsedData);
        } catch (parseError) {
          console.error(
            "Failed to parse incoming RTC message:",
            parseError,
            "Raw data:",
            e.data
          );
        }
      });
    } catch (err) {
      console.error("Error connecting to realtime:", err);
      logClientEvent(
        { error: (err as Error).message },
        "error.connect_to_realtime"
      );
      setConnectionState("failed");
      if (pcRef.current || dcRef.current) {
        disconnectRTCSession(pcRef.current, dcRef.current);
        pcRef.current = null;
        dcRef.current = null;
      }
    }
  }, [
    connectionState,
    isAudioPlaybackEnabled,
    onAgentStreamReady,
    logClientEvent,
    fetchEphemeralKey,
    setConnectionState,
    audioElementRef,
    handleRtcMessageRef,
  ]);

  // Start interview
  const startInterview = async () => {
    store.setIsActive(true);
    setIsRecording(true);
    store.setTranscript([]);
    store.setSystemMessages([]);
    store.setCurrentQuestion(undefined);
    setRtcSessionId(null); // Reset session ID on new interview

    // Clear conversation buffer
    conversationBufferRef.current = {
      messages: [],
      lastSent: 0,
      pendingUserMessage: undefined,
      pendingAssistantMessage: undefined,
    };

    await connectToRealtime();

    // Initial system message for the dashboard UI
    const initialSystemMessage: SystemMessageEntry = {
      id: Date.now(),
      timestamp: new Date().toLocaleTimeString(),
      role: "system",
      content: "Interview initiated. Master AI monitoring enabled.",
      toolUsed: "initialization",
    };
    store.setSystemMessages([initialSystemMessage]);
  };

  // Stop interview
  const stopInterview = async () => {
    store.setIsActive(false);
    setIsRecording(false);

    // Flush any remaining messages in buffer before stopping
    if (conversationBufferRef.current.messages.length > 0) {
      await flushConversationBuffer();
    }

    if (pcRef.current || dcRef.current) {
      disconnectRTCSession(pcRef.current, dcRef.current);
      pcRef.current = null;
      dcRef.current = null;
    }
    setConnectionState("disconnected");

    // Add a concluding message
    simulateConversationEventRef.current?.(
      "ai",
      "Thank you. The interview has concluded."
    );
  };

  // Manual system message injection
  const injectSystemMessage = useCallback(() => {
    if (!customSystemMessage.trim()) return;
    const systemMessagePayload = {
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "system",
        content: [
          {
            type: "input_text",
            text: customSystemMessage,
          },
        ],
      },
    };
    let sentVia = "";

    if (connectionState === "connected" && dcRef.current) {
      const sent = sendMessageOnDataChannel(
        dcRef.current,
        systemMessagePayload
      );
      if (sent) sentVia = "RTC";
      else console.warn("RTC send failed for system message, trying HTTP.");
    }

    if (sentVia !== "RTC") {
      sendToMasterAIRef.current?.(
        `System Message (via HTTP): ${customSystemMessage}`
      );
      sentVia = "HTTP";
    }
    const uiMessage: SystemMessageEntry = {
      id: Date.now(),
      timestamp: new Date().toLocaleTimeString(),
      role: "system",
      content: `Sent (${sentVia}): ${customSystemMessage}`,
      toolUsed: `manual_injection_${sentVia.toLowerCase()}`,
    };
    store.setSystemMessages((prev) => [...prev, uiMessage]);
    setCustomSystemMessage("");
  }, [customSystemMessage, connectionState, store.setSystemMessages]);

  const simulateCandidateResponse = useCallback(() => {
    const responses = [
      "I have 5 years experience in React and Node.js.",
      "My strength is problem-solving and debugging complex issues.",
      "I reduced API response time by 40% in my last project.",
      "I like cats and enjoy working with them around.", // Added for testing
      "I love dogs! They're such loyal companions.", // Added for testing
      "I'm passionate about clean code and best practices.",
      "I've worked extensively with TypeScript and Next.js.",
    ];
    const randomResponse =
      responses[Math.floor(Math.random() * responses.length)];
    simulateConversationEventRef.current?.("candidate", randomResponse);
  }, [simulateConversationEventRef]);

  // Manual buffer flush for testing
  const manualFlushBuffer = useCallback(() => {
    if (conversationBufferRef.current.messages.length > 0) {
      console.log("[MANUAL] Manually flushing buffer");
      flushConversationBuffer();
    } else {
      console.log("[MANUAL] No messages in buffer to flush");
      setMasterAIResponse("No messages in buffer to flush.");
    }
  }, [flushConversationBuffer]);

  // --- Render with modern UI ---
  return (
    <TooltipProvider>
      <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 p-4 md:p-6 dark:from-slate-900 dark:to-slate-800">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <Header
            isRecording={isRecording}
            connectionState={connectionState}
            store={store}
          />

          {/* Control Panel */}
          <ControlPanel
            store={store}
            connectionState={connectionState}
            startInterview={startInterview}
            stopInterview={stopInterview}
            simulateCandidateResponse={simulateCandidateResponse}
            connectToRealtime={connectToRealtime}
            customSystemMessage={customSystemMessage}
            setCustomSystemMessage={setCustomSystemMessage}
            injectSystemMessage={injectSystemMessage}
          />

          {/* Conversation Buffer Status */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Brain className="w-5 h-5 text-blue-600" />
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                    Master AI Monitor
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Buffer: {conversationBufferRef.current.messages.length}{" "}
                    messages
                    {conversationBufferRef.current.pendingUserMessage && (
                      <span className="ml-2 text-orange-600">
                        (Pending User)
                      </span>
                    )}
                    {conversationBufferRef.current.pendingAssistantMessage && (
                      <span className="ml-2 text-blue-600">
                        (Pending Assistant)
                      </span>
                    )}
                    {conversationBufferRef.current.lastSent > 0 && (
                      <span className="ml-2">
                        (Last sent:{" "}
                        {Math.round(
                          (Date.now() -
                            conversationBufferRef.current.lastSent) /
                            1000
                        )}
                        s ago)
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <button
                onClick={manualFlushBuffer}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                disabled={conversationBufferRef.current.messages.length === 0}
              >
                Send to Master AI
              </button>
            </div>
          </div>

          {/* Status Card */}
          <StatusCard store={store} />

          {/* Current Question Card */}
          <CurrentQuestionCard store={store} />

          {masterAIResponse && (
            <Alert
              className={`shadow-md ${
                masterAIResponse.toLowerCase().includes("error")
                  ? "bg-red-500/10 border-red-500/30 text-red-700 dark:bg-red-500/20 dark:border-red-500/50 dark:text-red-300"
                  : "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:bg-emerald-500/20 dark:border-emerald-500/50 dark:text-emerald-300"
              }`}
            >
              <Brain className="w-5 h-5" />
              <AlertTitle className="font-semibold">
                {masterAIResponse.toLowerCase().includes("error")
                  ? "Master AI Error"
                  : "Master AI Status"}
              </AlertTitle>
              <AlertDescription>{masterAIResponse}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TranscriptSection store={store} />
            <ActivityLog store={store} />
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
};

export default InterviewDashboard;
