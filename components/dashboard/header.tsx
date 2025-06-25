import React from "react";
import { Badge } from "../ui/badge";
import { Activity, Link2, Mic, MicOff, Radio, Unlink2 } from "lucide-react";
import { RTCConnectionState } from "@/lib/webrtc/rtc-utils";

type Props = {
  isRecording: boolean;
  connectionState: RTCConnectionState;
  store: {
    isActive: boolean;
  };
};

const Header = (props: Props) => {
  const getRTCConnectionBadge = (state: RTCConnectionState) => {
    switch (state) {
      case "connected":
        return (
          <Badge
            variant="default"
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Link2 className="w-3 h-3 mr-1" />
            Connected
          </Badge>
        );
      case "connecting":
        return (
          <Badge variant="outline" className="text-amber-600 border-amber-500">
            <Activity className="w-3 h-3 mr-1 animate-spin" />
            Connecting
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="destructive">
            <Unlink2 className="w-3 h-3 mr-1" />
            Failed
          </Badge>
        );
      default: // disconnected
        return (
          <Badge variant="secondary">
            <Unlink2 className="w-3 h-3 mr-1" />
            Disconnected
          </Badge>
        );
    }
  };

  const getMicStatusBadge = (recording: boolean) => {
    return recording ? (
      <Badge
        variant="default"
        className="bg-red-500 hover:bg-red-600 text-white"
      >
        <Mic className="w-3 h-3 mr-1" /> Mic Active
      </Badge>
    ) : (
      <Badge variant="secondary">
        <MicOff className="w-3 h-3 mr-1" /> Mic Inactive
      </Badge>
    );
  };
  return (
    <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-white dark:bg-slate-800/50 shadow-md rounded-lg border border-slate-200 dark:border-slate-700">
      <div>
        <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">
          AI Interview Dashboard
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mt-1">
          Real-time analysis & control
        </p>
      </div>
      <div className="flex items-center gap-3">
        {getMicStatusBadge(props.isRecording)}
        {getRTCConnectionBadge(props.connectionState)}
        {props.store.isActive && (
          <Badge
            variant="outline"
            className="bg-green-500/10 text-green-600 border-green-500 dark:bg-green-500/20 dark:text-green-400 dark:border-green-700"
          >
            <Radio className="w-3 h-3 mr-1 animate-pulse" />
            Session Active
          </Badge>
        )}
      </div>
    </header>
  );
};

export default Header;
