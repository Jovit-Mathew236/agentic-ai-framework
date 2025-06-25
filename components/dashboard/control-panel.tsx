import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"; // For better UX on icons
import { Link2, Play, Send, Settings, Square, User, Zap } from "lucide-react";
import { Button } from "../ui/button";
import { Separator } from "../ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "../ui/input";
import { ToolFunctions } from "@/lib/interview";
type Props = {
  store: {
    isActive: boolean;
  };
  connectionState: "disconnected" | "connecting" | "connected" | "failed";
  startInterview: () => void;
  stopInterview: () => void;
  simulateCandidateResponse: () => void;
  connectToRealtime: () => void;
  callTool: () => void;
  selectedTool: keyof ToolFunctions;
  setSelectedTool: (tool: keyof ToolFunctions) => void;
  customSystemMessage: string;
  setCustomSystemMessage: (message: string) => void;
  injectSystemMessage: () => void;
};

const ControlPanel = (props: Props) => {
  return (
    <Card className="shadow-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
          <Settings className="w-5 h-5" />
          Master Control Panel
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={props.startInterview}
                disabled={
                  props.store.isActive || props.connectionState === "connecting"
                }
                size="lg"
                className="bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-500 dark:hover:bg-emerald-600"
              >
                <Play className="w-4 h-4 mr-2" />
                Start Session
              </Button>
            </TooltipTrigger>
            <TooltipContent>Begin a new interview session.</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={props.stopInterview}
                disabled={!props.store.isActive}
                size="lg"
                variant="destructive"
              >
                <Square className="w-4 h-4 mr-2" />
                End Session
              </Button>
            </TooltipTrigger>
            <TooltipContent>Conclude the current session.</TooltipContent>
          </Tooltip>
          <div className="flex-grow sm:flex-grow-0" />{" "}
          {/* Pushes buttons to sides on larger screens */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={props.simulateCandidateResponse}
                variant="outline"
                size="lg"
                className="border-purple-300 text-purple-700 hover:bg-purple-100/50 dark:border-purple-600 dark:text-purple-300 dark:hover:bg-purple-700/30"
              >
                <User className="w-4 h-4 mr-2" />
                Simulate Response
              </Button>
            </TooltipTrigger>
            <TooltipContent>Send a mock candidate response.</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={props.connectToRealtime}
                disabled={
                  props.connectionState === "connected" ||
                  props.connectionState === "connecting"
                }
                variant="outline"
                size="lg"
                className="border-blue-300 text-blue-700 hover:bg-blue-100/50 dark:border-blue-600 dark:text-blue-300 dark:hover:bg-blue-700/30"
              >
                <Link2 className="w-4 h-4 mr-2" />
                Connect RTC
              </Button>
            </TooltipTrigger>
            <TooltipContent>Attempt to (re)connect WebRTC.</TooltipContent>
          </Tooltip>
        </div>
        <Separator className="dark:bg-slate-700" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label
              htmlFor="tool-select"
              className="text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              AI Tool Selection
            </label>
            <div className="flex gap-2">
              <Select
                value={props.selectedTool}
                onValueChange={(value: keyof ToolFunctions) =>
                  props.setSelectedTool(value)
                }
              >
                <SelectTrigger
                  id="tool-select"
                  className="flex-1 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100"
                >
                  <SelectValue placeholder="Select a tool" />
                </SelectTrigger>
                <SelectContent className="dark:bg-slate-800 dark:border-slate-700">
                  <SelectItem
                    value="getQuestion"
                    className="dark:text-slate-200 dark:hover:bg-slate-700"
                  >
                    getQuestion
                  </SelectItem>
                  <SelectItem
                    value="evaluateAnswer"
                    className="dark:text-slate-200 dark:hover:bg-slate-700"
                  >
                    evaluateAnswer
                  </SelectItem>
                  <SelectItem
                    value="updateInterviewState"
                    className="dark:text-slate-200 dark:hover:bg-slate-700"
                  >
                    updateInterviewState
                  </SelectItem>
                  <SelectItem
                    value="analyzeBehavior"
                    className="dark:text-slate-200 dark:hover:bg-slate-700"
                  >
                    analyzeBehavior
                  </SelectItem>
                  <SelectItem
                    value="assessTechnicalResponse"
                    className="dark:text-slate-200 dark:hover:bg-slate-700"
                  >
                    assessTechnicalResponse
                  </SelectItem>
                </SelectContent>
              </Select>
              <Button
                onClick={props.callTool}
                variant="outline"
                className="dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                <Zap className="w-4 h-4 mr-2" /> Call
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <label
              htmlFor="system-message-input"
              className="text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              System Message Injection
            </label>
            <div className="flex gap-2">
              <Input
                id="system-message-input"
                value={props.customSystemMessage}
                onChange={(e) => props.setCustomSystemMessage(e.target.value)}
                placeholder="Type system message..."
                className="flex-1 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100 dark:placeholder-slate-400"
              />
              <Button
                onClick={props.injectSystemMessage}
                disabled={
                  !props.customSystemMessage.trim() || !props.store.isActive
                }
                variant="outline"
                className="dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ControlPanel;
