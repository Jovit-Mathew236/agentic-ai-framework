import React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Bot, MessageCircle, User } from "lucide-react";
import { Badge } from "../ui/badge";
import { TranscriptEntry } from "@/lib/interview";
type Props = {
  store: {
    transcript: TranscriptEntry[];
  };
};

const TranscriptSection = (props: Props) => {
  const getScoreColor = (score: number) => {
    if (score >= 8) return "text-emerald-600 border-emerald-500 bg-emerald-50";
    if (score >= 5) return "text-amber-600 border-amber-500 bg-amber-50"; // Adjusted threshold
    return "text-red-600 border-red-500 bg-red-50";
  };

  return (
    <Card className="shadow-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
          <MessageCircle className="w-5 h-5" />
          Conversation Transcript
        </CardTitle>
        <CardDescription className="dark:text-slate-400">
          Real-time log of AI and candidate messages.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4 max-h-[calc(100vh-400px)] min-h-[300px] overflow-y-auto p-1 pr-3">
          {" "}
          {/* Added padding for scrollbar */}
          {props.store.transcript.length === 0 ? (
            <div className="text-center py-10 text-slate-500 dark:text-slate-400">
              <MessageCircle className="w-16 h-16 mx-auto mb-3 opacity-30" />
              <p>Conversation will appear here.</p>
            </div>
          ) : (
            props.store.transcript.map((entry, index) => (
              <div
                key={entry.id || index}
                className={`flex flex-col p-3 rounded-lg shadow-sm ${
                  entry.speaker === "user"
                    ? "bg-blue-500/10 border-blue-500/20 items-end ml-6 dark:bg-blue-500/20 dark:border-blue-500/30"
                    : "bg-slate-500/10 border-slate-500/20 items-start mr-6 dark:bg-slate-700/30 dark:border-slate-600"
                }`}
              >
                <div className="flex items-center gap-2 mb-1 w-full">
                  {entry.speaker === "user" ? (
                    <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  ) : (
                    <Bot className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                  )}
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    {entry.speaker === "assistant"
                      ? "AI Interviewer"
                      : "Candidate"}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 ml-auto">
                    {entry.timestamp}
                  </span>
                </div>
                <p
                  className={`text-sm ${
                    entry.speaker === "user"
                      ? "text-blue-800 dark:text-blue-200 text-right"
                      : "text-slate-800 dark:text-slate-200"
                  }`}
                >
                  {entry.message}
                </p>
                {entry.score !== null && (
                  <div className="mt-2 self-start">
                    {" "}
                    {/* Align score to left for AI, right for candidate might be too much */}
                    <Badge
                      variant="outline"
                      className={`${getScoreColor(entry.score || 0)} text-xs`}
                    >
                      Score: {entry.score?.toFixed(1)}
                    </Badge>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default TranscriptSection;
