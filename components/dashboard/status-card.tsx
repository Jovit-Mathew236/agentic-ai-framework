import React from "react";
import { Activity, Clock, MessageCircle, Target } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { SystemMessageEntry, TranscriptEntry } from "@/lib/interview";
type Props = {
  store: {
    currentScore: number;
    isActive: boolean;
    transcript: TranscriptEntry[];
    systemMessages: SystemMessageEntry[];
  };
};

const StatusCard = (props: Props) => {
  const getScoreColor = (score: number) => {
    if (score >= 8) return "text-emerald-600 border-emerald-500 bg-emerald-50";
    if (score >= 5) return "text-amber-600 border-amber-500 bg-amber-50"; // Adjusted threshold
    return "text-red-600 border-red-500 bg-red-50";
  };
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {[
        {
          title: "Current Score",
          value: `${props.store.currentScore.toFixed(1)}/10`,
          Icon: Target,
          colorClass: getScoreColor(props.store.currentScore),
        },
        {
          title: "Session Status",
          value: props.store.isActive ? "Active" : "Inactive",
          Icon: Activity,
          colorClass: props.store.isActive
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-slate-600 dark:text-slate-400",
        },
        {
          title: "Transcript Items",
          value: props.store.transcript.length,
          Icon: MessageCircle,
          colorClass: "text-blue-600 dark:text-blue-400",
        },
        {
          title: "System Events",
          value: props.store.systemMessages.length,
          Icon: Clock,
          colorClass: "text-purple-600 dark:text-purple-400",
        },
      ].map((stat) => (
        <Card
          key={stat.title}
          className="shadow-md border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50"
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  {stat.title}
                </p>
                <p className={`text-3xl font-bold ${stat.colorClass}`}>
                  {stat.value}
                </p>
              </div>
              <stat.Icon
                className={`w-8 h-8 ${
                  stat.colorClass || "text-slate-400 dark:text-slate-500"
                }`}
              />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default StatusCard;
