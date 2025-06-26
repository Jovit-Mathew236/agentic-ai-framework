"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Brain } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// Import types and utilities (keeping original imports)
import type { TranscriptEntry, SystemMessageEntry } from "@/lib/interview";

// Import WebRTC utilities (keeping original imports)
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

// --- Interview Store (original implementation) ---
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

// --- Main Component ---
const InterviewDashboard: React.FC = () => {
  const store = useInterviewStore();
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [customSystemMessage, setCustomSystemMessage] = useState<string>("");
  const [masterAIResponse, setMasterAIResponse] = useState<string>("");

  // WebRTC related state and refs (all original)
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const [connectionState, setConnectionState] =
    useState<RTCConnectionState>("disconnected");
  const [rtcSessionId, setRtcSessionId] = useState<string | null>(null);

  // Added state from original
  const isAudioPlaybackEnabled = true;

  interface ToolRequestData {
    action: string;
    toolName?: string;
    args?: Record<string, unknown>;
  }

  // Refs for functions to break dependency cycles (original)
  const simulateConversationEventRef =
    useRef<
      (
        speaker: "ai" | "candidate",
        message: string,
        score?: number | null
      ) => Promise<void>
    >(null);
  const sendToMasterAIRef =
    useRef<
      (message: string, toolRequestData?: ToolRequestData) => Promise<void>
    >(null);
  const handleRtcMessageRef =
    useRef<(data: Record<string, unknown>) => void>(null);

  // Mock logClientEvent and logServerEvent (original implementation)
  const logClientEvent = useCallback(
    (data: unknown, eventName: string) => {
      console.log(`[CLIENT EVENT: ${eventName}]`, data);
      const systemMessage: SystemMessageEntry = {
        id: Date.now() + Math.random(),
        timestamp: new Date().toLocaleTimeString(),
        role: "system",
        content: `Client Event: ${eventName} - ${JSON.stringify(data)}`,
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
        content: `Server Event: ${eventName} - ${JSON.stringify(data)}`,
        toolUsed: "rtc_logging",
      };
      store.setSystemMessages((prev) => [...prev, systemMessage]);
    },
    [store.setSystemMessages]
  );

  // Stub for onAgentStreamReady (original)
  const onAgentStreamReady = useCallback((stream: MediaStream) => {
    console.log("Agent audio stream ready:", stream);
    if (audioElementRef.current) {
      audioElementRef.current.srcObject = stream;
      audioElementRef.current
        .play()
        .catch((e) => console.warn("Audio play failed onAgentStreamReady:", e));
    }
  }, []);

  // Simulate sending conversation events (original implementation)
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
          } else {
            console.warn("RTC send failed, falling back to HTTP.");
            await sendToMasterAIRef.current?.(message);
          }
        } else {
          console.warn(
            "RTC not connected, sending candidate message via HTTP fallback."
          );
          await sendToMasterAIRef.current?.(message);
        }
      }
    },
    [store.setTranscript, connectionState, dcRef, sendToMasterAIRef]
  );

  // Core: send message to Master AI (original implementation)
  const sendToMasterAI = useCallback(
    async (message: string) => {
      try {
        const response = await fetch("/api/interview-event", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: rtcSessionId || `client-${crypto.randomUUID()}`,
            userMessageContent: message,
          }),
        });

        if (!response.ok)
          throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        if (data.sessionId && !rtcSessionId) setRtcSessionId(data.sessionId);
        if (data.response)
          simulateConversationEventRef.current?.("ai", data.response);

        if (data.masterAISystemMessage) {
          setMasterAIResponse(
            `Orchestrator AI set system message: ${data.masterAISystemMessage}`
          );
        } else if (data.response) {
          setMasterAIResponse(`Slave AI responded.`);
        } else {
          setMasterAIResponse(`No specific AI action or response.`);
        }
      } catch (error) {
        setMasterAIResponse(`Error: ${(error as Error).message}`);
        console.error("Error sending to Master AI:", error);
      }
    },
    [
      rtcSessionId,
      store.setSystemMessages,
      setMasterAIResponse,
      simulateConversationEventRef,
    ]
  );

  // Update refs to always point to the latest function instance (original)
  useEffect(() => {
    sendToMasterAIRef.current = sendToMasterAI;
  }, [sendToMasterAI]);

  useEffect(() => {
    simulateConversationEventRef.current = simulateConversationEvent;
  }, [simulateConversationEvent]);

  // Effect for creating audio element (original)
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

  // Cleanup WebRTC connection on component unmount (original)
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

  const handleRtcMessage = useCallback(
    (data: Record<string, unknown>) => {
      try {
        console.log("Received via Data Channel:", data);
        if (data.type === "ai_message" && typeof data.content === "string") {
          simulateConversationEventRef.current?.("ai", data.content);
        } else if (
          data.type === "system_event" &&
          typeof data.content === "string"
        ) {
          const systemMessage: SystemMessageEntry = {
            id: Date.now(),
            timestamp: new Date().toLocaleTimeString(),
            role: "system",
            content: data.content,
            toolUsed: (data.toolUsed as string) || "rtc_event",
          };
          store.setSystemMessages((prev) => [...prev, systemMessage]);
        } else if (data.type === "conversation.item.created") {
          interface ConversationItemContent {
            type: string;
            text?: string;
          }
          const item = data.item as {
            role?: string;
            content?: ConversationItemContent[];
          };
          if (
            item &&
            item.role === "assistant" &&
            Array.isArray(item.content) &&
            item.content[0]?.type === "text" &&
            typeof item.content[0]?.text === "string"
          ) {
            simulateConversationEventRef.current?.("ai", item.content[0].text);
          }
        }
      } catch (error) {
        console.error("Failed to handle RTC message:", error);
      }
    },
    [store.setSystemMessages, simulateConversationEventRef]
  );

  // Update ref for handleRtcMessage (original)
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

  // Start interview (original implementation)
  const startInterview = async () => {
    store.setIsActive(true);
    setIsRecording(true);
    store.setTranscript([]);
    store.setSystemMessages([]);
    store.setCurrentQuestion(undefined);
    setRtcSessionId(null);

    await connectToRealtime();
    await sendToMasterAIRef.current?.("Interview started (via HTTP init)");

    const initialSystemMessage: SystemMessageEntry = {
      id: Date.now(),
      timestamp: new Date().toLocaleTimeString(),
      role: "system",
      content:
        "Interview initiated. Attempting RTC connection and AI interaction...",
      toolUsed: "initialization",
    };
    store.setSystemMessages([initialSystemMessage]);
  };

  // Stop interview (original implementation)
  const stopInterview = async () => {
    store.setIsActive(false);
    setIsRecording(false);

    if (pcRef.current || dcRef.current) {
      disconnectRTCSession(pcRef.current, dcRef.current);
      pcRef.current = null;
      dcRef.current = null;
    }
    setConnectionState("disconnected");

    await sendToMasterAIRef.current?.("Interview concluded by user");
    simulateConversationEventRef.current?.(
      "ai",
      "Thank you. The interview has concluded."
    );
  };

  // Manual system message injection (original implementation)
  const injectSystemMessage = () => {
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
  };

  const simulateCandidateResponse = useCallback(() => {
    const responses = [
      "I have 5 years experience in React and Node.js.",
      "My strength is problem-solving.",
      "I reduced API response time by 40%.",
      "I like cats.",
      "I love dogs!",
    ];
    const randomResponse =
      responses[Math.floor(Math.random() * responses.length)];
    simulateConversationEventRef.current?.("candidate", randomResponse);
  }, [simulateConversationEventRef]);
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

          {/* Status Card */}
          <StatusCard store={store} />

          {/* current question card */}
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
                  : "Master AI Update"}
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
