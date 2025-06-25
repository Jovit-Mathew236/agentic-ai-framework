import React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Activity, Clock } from "lucide-react";
import { SystemMessageEntry } from "@/lib/interview";
type Props = {
  store: {
    systemMessages: SystemMessageEntry[];
  };
};

const ActivityLog = (props: Props) => {
  return (
    <Card className="shadow-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
          <Activity className="w-5 h-5" />
          System Activity Log
        </CardTitle>
        <CardDescription className="dark:text-slate-400">
          Internal AI processing and events.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 max-h-[calc(100vh-400px)] min-h-[300px] overflow-y-auto p-1 pr-3">
          {props.store.systemMessages.length === 0 ? (
            <div className="text-center py-10 text-slate-500 dark:text-slate-400">
              <Clock className="w-16 h-16 mx-auto mb-3 opacity-30" />
              <p>System events will appear here.</p>
            </div>
          ) : (
            props.store.systemMessages.map((msg, index) => (
              <div
                key={msg.id || index}
                className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 dark:bg-amber-500/20 dark:border-amber-500/30"
              >
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                    {msg.toolUsed || "EVENT"}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 ml-auto">
                    {msg.timestamp}
                  </span>
                </div>
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  {msg.content}
                </p>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ActivityLog;
