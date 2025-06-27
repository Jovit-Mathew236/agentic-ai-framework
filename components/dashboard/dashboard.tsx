"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Brain } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type {
  TranscriptEntry,
  SystemMessageEntry,
  // ServerEvent,
} from "@/lib/interview";
import {
  createRealtimeConnection,
  sendMessageOnDataChannel,
  disconnectRTCSession,
  RTCConnectionState,
} from "@/lib/webrtc/rtc-utils";
import { TooltipProvider } from "../ui/tooltip";
import ActivityLog from "./activity-log";
import TranscriptSection from "./transcript-section";
// import CurrentQuestionCard from "./current-question-card";
// import StatusCard from "./status-card";
import ControlPanel from "./control-panel";
import Header from "./header";
import { ServerEvent } from "@/types/tools";
import ToolToggle from "./tool-toggle";
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
  const [masterAIResponse, setMasterAIResponse] = useState<string>("");
  const [connectionState, setConnectionState] =
    useState<RTCConnectionState>("disconnected");
  const [rtcSessionId, setRtcSessionId] = useState<string | null>(null);
  const [enabledTools, setEnabledTools] = useState<string[]>([
    "detectAnimalssss",
  ]);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);

  const conversationBufferRef = useRef<ConversationBuffer>({
    messages: [],
    lastSent: 0,
    pendingUserMessage: undefined,
    pendingAssistantMessage: undefined,
  });

  const BUFFER_TIMEOUT = 5000;
  // const isAudioPlaybackEnabled = true;

  const handleToolConfigChange = useCallback(
    async (newEnabledTools: string[]) => {
      // Prevent unnecessary updates if tools haven't actually changed
      if (
        JSON.stringify(newEnabledTools.sort()) ===
        JSON.stringify(enabledTools.sort())
      ) {
        return;
      }

      setEnabledTools(newEnabledTools);

      // Send to backend
      try {
        const response = await fetch("/api/interview-event", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: rtcSessionId || `config-${crypto.randomUUID()}`,
            enabledTools: newEnabledTools,
            type: "update_tools",
          }),
        });

        if (response.ok) {
          const data = await response.json();
          console.log("Tools updated:", data);
        }
      } catch (error) {
        console.error("Error updating tools:", error);
      }
    },
    [enabledTools, rtcSessionId]
  ); // Dependencies for useCallback

  const logClientEvent = (data: unknown, eventName: string) => {
    console.log(`[CLIENT EVENT: ${eventName}]`, data);
    store.setSystemMessages((prev) => [
      ...prev,
      {
        id: Date.now(),
        timestamp: new Date().toLocaleTimeString(),
        role: "system",
        content: `Client Event: ${eventName}`,
        toolUsed: "logging",
      },
    ]);
  };

  const sendSystemMessageViaRTC = (message: string) => {
    if (dcRef.current?.readyState !== "open") {
      console.warn("RTC Data Channel is not open. Cannot send message.");
      return { success: false, method: "FAILED_RTC_DELIVERY" };
    }
    const payload = {
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "system",
        content: [{ type: "input_text", text: message }],
      },
    };
    const sent = sendMessageOnDataChannel(dcRef.current, payload);
    return { success: sent, method: sent ? "RTC" : "FAILED_RTC_SEND" };
  };

  const flushConversationBuffer = async () => {
    const buffer = conversationBufferRef.current;
    if (buffer.messages.length === 0) return;

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

      if (!response.ok) throw new Error(`API Error: ${response.status}`);

      const data = await response.json();
      console.log("[BUFFER] Master AI response:", data);

      if (
        data.masterAISystemMessage &&
        data.masterAISystemMessage !== "No intervention needed."
      ) {
        console.log(
          `[BUFFER] Master AI intervention received: "${data.masterAISystemMessage}"`
        );
        const { method } = sendSystemMessageViaRTC(data.masterAISystemMessage);
        setMasterAIResponse(
          `Master AI Intervention (${method}): ${data.masterAISystemMessage}`
        );
        logClientEvent(
          { message: data.masterAISystemMessage, status: method },
          "master_ai_intervention"
        );
      } else {
        setMasterAIResponse("Master AI: Monitoring - No intervention needed.");
      }

      if (data.sessionId) setRtcSessionId(data.sessionId);
      buffer.messages = [];
      buffer.lastSent = Date.now();
    } catch (error) {
      console.error("[BUFFER] Error flushing conversation buffer:", error);
      setMasterAIResponse(
        `Error communicating with Master AI: ${(error as Error).message}`
      );
    }
  };

  const addToConversationBuffer = (
    role: "user" | "assistant",
    content: string
  ) => {
    if (content.length < 3) return;

    const buffer = conversationBufferRef.current;
    console.log(
      `[BUFFER] Adding ${role} message: "${content.substring(0, 50)}..."`
    );

    if (role === "user") buffer.pendingUserMessage = content;
    else if (role === "assistant") buffer.pendingAssistantMessage = content;

    if (buffer.pendingUserMessage && buffer.pendingAssistantMessage) {
      console.log(
        "[BUFFER] Complete exchange detected. Adding to buffer and flushing."
      );
      buffer.messages.push({
        role: "user",
        content: buffer.pendingUserMessage,
        timestamp: Date.now() - 1000,
      });
      buffer.messages.push({
        role: "assistant",
        content: buffer.pendingAssistantMessage,
        timestamp: Date.now(),
      });

      buffer.pendingUserMessage = undefined;
      buffer.pendingAssistantMessage = undefined;

      flushConversationBuffer();
    }
  };

  const simulateConversationEvent = (
    speaker: "user" | "assistant",
    message: string
  ) => {
    store.setTranscript((prev) => [
      ...prev,
      {
        id: Date.now(),
        timestamp: new Date().toLocaleTimeString(),
        speaker,
        message,
      },
    ]);
    addToConversationBuffer(speaker, message);

    if (speaker === "user" && dcRef.current?.readyState === "open") {
      sendMessageOnDataChannel(dcRef.current, {
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "user",
          content: [{ type: "input_text", text: message }],
        },
      });
    }
  };

  const handleRtcMessage = (data: ServerEvent) => {
    console.log("Received via Data Channel:", data);
    if (
      data.type === "conversation.item.input_audio_transcription.completed" &&
      data.transcript
    ) {
      simulateConversationEvent("user", data.transcript);
    } else if (
      data.type === "response.audio_transcript.done" &&
      data.transcript
    ) {
      simulateConversationEvent("assistant", data.transcript);
    }
  };

  const connectToRealtime = async () => {
    if (connectionState === "connected" || connectionState === "connecting")
      return;
    setConnectionState("connecting");

    try {
      const tokenResponse = await fetch("/api/rtc-session");
      const data = await tokenResponse.json();
      if (!data.client_secret?.value)
        throw new Error("No ephemeral key from server.");

      if (!audioElementRef.current) {
        audioElementRef.current = document.createElement("audio");
        audioElementRef.current.autoplay = true;
        document.body.appendChild(audioElementRef.current);
      }

      const { pc, dc } = await createRealtimeConnection(
        data.client_secret.value,
        audioElementRef
      );
      pcRef.current = pc;
      dcRef.current = dc;

      pc.ontrack = (e) => {
        if (audioElementRef.current && e.streams[0]) {
          audioElementRef.current.srcObject = e.streams[0];
        }
      };

      dc.onopen = () => {
        setConnectionState("connected");
        logClientEvent({}, "data_channel_open");
      };
      dc.onclose = () => {
        setConnectionState("disconnected");
        logClientEvent({}, "data_channel_close");
      };
      dc.onerror = (e) => console.error("Data Channel Error:", e);
      dc.onmessage = (e) => handleRtcMessage(JSON.parse(e.data));
    } catch (error) {
      console.error("Connection failed:", error);
      setConnectionState("failed");
    }
  };

  const startInterview = () => {
    store.setIsActive(true);
    setIsRecording(true);
    store.setTranscript([]);
    store.setSystemMessages([]);
    setRtcSessionId(null);
    conversationBufferRef.current = { messages: [], lastSent: 0 };
    connectToRealtime();
    logClientEvent({}, "interview_started");
  };

  const stopInterview = () => {
    store.setIsActive(false);
    setIsRecording(false);
    disconnectRTCSession(pcRef.current, dcRef.current);
    pcRef.current = null;
    dcRef.current = null;
    setConnectionState("disconnected");
    logClientEvent({}, "interview_stopped");
  };

  const injectSystemMessage = () => {
    if (!customSystemMessage.trim()) return;
    const { method } = sendSystemMessageViaRTC(customSystemMessage);
    setMasterAIResponse(`Manual Injection Status: ${method}`);
    logClientEvent(
      { message: customSystemMessage, status: method },
      "manual_injection"
    );
    setCustomSystemMessage("");
  };

  const simulateCandidateResponse = () => {
    const responses = [
      "I have 5 years experience in React.",
      "My strength is problem-solving.",
      "I like cats.",
    ];
    simulateConversationEvent(
      "user",
      responses[Math.floor(Math.random() * responses.length)]
    );
  };

  // --- useEffect Hooks ---

  useEffect(() => {
    const interval = setInterval(() => {
      if (conversationBufferRef.current.messages.length > 0) {
        console.log("[BUFFER] Auto-flushing due to timeout.");
        flushConversationBuffer();
      }
    }, BUFFER_TIMEOUT);
    return () => clearInterval(interval);
  }, []); // Empty dependency array ensures this runs once

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      disconnectRTCSession(pcRef.current, dcRef.current);
    };
  }, []);

  // --- Render ---
  return (
    <TooltipProvider>
      <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 p-4 md:p-6 dark:from-slate-900 dark:to-slate-800">
        <div className="max-w-7xl mx-auto space-y-6">
          <Header
            isRecording={isRecording}
            connectionState={connectionState}
            store={store}
          />
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
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-4">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100">
              Master AI Monitor
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Buffer: {conversationBufferRef.current.messages.length} messages
            </p>
          </div>
          {masterAIResponse && (
            <Alert
              className={
                masterAIResponse.toLowerCase().includes("error") ||
                masterAIResponse.toLowerCase().includes("failed")
                  ? "bg-red-500/10"
                  : "bg-emerald-500/10"
              }
            >
              <Brain className="w-5 h-5" />
              <AlertTitle>Master AI Status</AlertTitle>
              <AlertDescription>{masterAIResponse}</AlertDescription>
            </Alert>
          )}
          <ToolToggle onToolConfigChange={handleToolConfigChange} />

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
