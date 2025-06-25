"use client";
import React, { useState, useEffect } from "react"; // Added useEffect
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Link2,
  Play,
  Send,
  Settings,
  Square,
  User,
  Zap,
  BookOpen,
  Target,
  MessageSquare,
  Copy, // Added for copy button
} from "lucide-react";
import { Button } from "../ui/button";
import { Separator } from "../ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
// import { Input } from "../ui/input"; // Input component is not used directly
import { Badge } from "@/components/ui/badge";
import { ToolFunctions } from "@/lib/interview";

// Enhanced interface for system message configuration
interface SystemMessageConfig {
  subject: string;
  type: string;
  action: string;
}

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
  const [systemMessageConfig, setSystemMessageConfig] =
    useState<SystemMessageConfig>({
      subject: "nextjs",
      type: "easy",
      action: "technical_questions",
    });
  const [isCopied, setIsCopied] = useState(false);

  // Configuration options
  const subjects = [
    { value: "nextjs", label: "Next.js", icon: "⚛️" },
    { value: "react", label: "React", icon: "⚛️" },
    { value: "sql", label: "SQL", icon: "🗄️" },
    { value: "arduino", label: "Arduino", icon: "🔧" },
    { value: "sensors", label: "Sensors", icon: "📡" },
    { value: "javascript", label: "JavaScript", icon: "🟨" },
    { value: "python", label: "Python", icon: "🐍" },
    { value: "nodejs", label: "Node.js", icon: "🟢" },
  ];

  const types = [
    { value: "easy", label: "Easy", color: "bg-green-500 hover:bg-green-600" },
    {
      value: "medium",
      label: "Medium",
      color: "bg-yellow-500 hover:bg-yellow-600",
    }, // Added medium color
    { value: "hard", label: "Hard", color: "bg-red-500 hover:bg-red-600" },
  ];

  const actions = [
    {
      value: "technical_questions",
      label: "Technical",
      description: "Focus on technical knowledge and problem-solving.",
    },
    {
      value: "personal_questions",
      label: "Personal",
      description: "Ask about house members, pet names, personal interests.",
    },
    {
      value: "behavioral_questions",
      label: "Behavioral",
      description: "Focus on past experiences and situational responses.",
    },
    {
      value: "mixed_questions",
      label: "Mixed",
      description: "Combine technical, personal, and behavioral questions.",
    },
  ];

  // Generate system message based on configuration
  const generateSystemMessage = () => {
    const subjectDetails = subjects.find(
      (s) => s.value === systemMessageConfig.subject
    );
    const typeDetails = types.find((t) => t.value === systemMessageConfig.type);
    const actionDetails = actions.find(
      (a) => a.value === systemMessageConfig.action
    );

    if (!subjectDetails || !typeDetails || !actionDetails) return "";

    let message = `You are now conducting a ${typeDetails.label.toLowerCase()} level interview focused on ${
      subjectDetails.label
    }. `;

    switch (actionDetails.value) {
      case "technical_questions":
        message += `Ask detailed technical questions about ${subjectDetails.label}, focusing on practical implementation and problem-solving scenarios.`;
        break;
      case "personal_questions":
        message += `Ask personal questions to understand the candidate better. Include questions about their background, family members, pets, hobbies, and personal interests related to ${subjectDetails.label}.`;
        break;
      case "behavioral_questions":
        message += `Focus on behavioral questions related to ${subjectDetails.label} projects. Ask about past experiences, challenges faced, and how they handled specific situations.`;
        break;
      case "mixed_questions":
        message += `Use a mix of technical, personal, and behavioral questions. Balance between ${subjectDetails.label} expertise and personal background including family, pets, and interests.`;
        break;
    }

    return message;
  };

  // Auto-generate message when configuration changes
  useEffect(() => {
    const generatedMessage = generateSystemMessage();
    // if (generatedMessage) { // Only set if not empty, or always set it?
    props.setCustomSystemMessage(generatedMessage);
    // }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [systemMessageConfig, props.setCustomSystemMessage]); // Added props.setCustomSystemMessage to deps

  const handleCopy = () => {
    if (props.customSystemMessage) {
      navigator.clipboard.writeText(props.customSystemMessage);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000); // Reset after 2 seconds
    }
  };

  return (
    <Card className="shadow-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/70 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
          <Settings className="w-5 h-5" />
          Master Control Panel
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Primary Control Buttons */}
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={props.startInterview}
                disabled={
                  props.store.isActive || props.connectionState === "connecting"
                }
                size="lg"
                className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-500 dark:hover:bg-emerald-600"
              >
                <Play className="w-4 h-4 mr-2" />
                Start
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
                className="w-full sm:w-auto"
              >
                <Square className="w-4 h-4 mr-2" />
                End
              </Button>
            </TooltipTrigger>
            <TooltipContent>Conclude the current session.</TooltipContent>
          </Tooltip>
          <div className="hidden sm:block sm:flex-grow" />{" "}
          {/* Spacer for larger screens */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={props.simulateCandidateResponse}
                variant="outline"
                size="lg"
                className="w-full sm:w-auto border-purple-300 text-purple-700 hover:bg-purple-100/50 dark:border-purple-600 dark:text-purple-300 dark:hover:bg-purple-700/30"
              >
                <User className="w-4 h-4 mr-2" />
                Simulate
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
                className="w-full sm:w-auto border-blue-300 text-blue-700 hover:bg-blue-100/50 dark:border-blue-600 dark:text-blue-300 dark:hover:bg-blue-700/30"
              >
                <Link2 className="w-4 h-4 mr-2" />
                Connect
              </Button>
            </TooltipTrigger>
            <TooltipContent>Attempt to (re)connect WebRTC.</TooltipContent>
          </Tooltip>
        </div>

        <Separator className="dark:bg-slate-700" />

        {/* Enhanced System Message Configuration */}
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <h3 className="text-xl font-semibold text-slate-700 dark:text-slate-200">
              Smart System Message Builder
            </h3>
          </div>

          {/* Responsive three-section configuration */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {/* Subject Selection */}
            <Card className="border-2 border-blue-200 dark:border-blue-700 bg-blue-50/30 dark:bg-blue-900/30 shadow-md hover:shadow-lg transition-shadow">
              <CardHeader className="pb-2 pt-4">
                <CardTitle className="flex items-center gap-2 text-base font-semibold text-blue-700 dark:text-blue-300">
                  <BookOpen className="w-5 h-5" />
                  Interview Subject
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 pb-4">
                <Select
                  value={systemMessageConfig.subject}
                  onValueChange={(value) =>
                    setSystemMessageConfig((prev) => ({
                      ...prev,
                      subject: value,
                    }))
                  }
                >
                  <SelectTrigger className="w-full bg-white dark:bg-slate-800 dark:border-slate-700 focus:ring-blue-500">
                    <SelectValue placeholder="Choose subject..." />
                  </SelectTrigger>
                  <SelectContent className="dark:bg-slate-800 dark:border-slate-700">
                    {subjects.map((subject) => (
                      <SelectItem
                        key={subject.value}
                        value={subject.value}
                        className="dark:text-slate-200 dark:hover:bg-slate-700/70"
                      >
                        <span className="mr-2">{subject.icon}</span>
                        {subject.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {/* Difficulty Type */}
            <Card className="border-2 border-orange-200 dark:border-orange-700 bg-orange-50/30 dark:bg-orange-900/30 shadow-md hover:shadow-lg transition-shadow">
              <CardHeader className="pb-2 pt-4">
                <CardTitle className="flex items-center gap-2 text-base font-semibold text-orange-700 dark:text-orange-300">
                  <Target className="w-5 h-5" />
                  Difficulty Level
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pb-4">
                <div className="grid grid-cols-3 gap-2">
                  {types.map((type) => (
                    <Button
                      key={type.value}
                      variant={
                        systemMessageConfig.type === type.value
                          ? "default"
                          : "outline"
                      }
                      size="sm"
                      onClick={() =>
                        setSystemMessageConfig((prev) => ({
                          ...prev,
                          type: type.value,
                        }))
                      }
                      className={`w-full ${
                        systemMessageConfig.type === type.value
                          ? `${type.color} text-white shadow-md`
                          : "border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700/50"
                      }`}
                    >
                      {type.label}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Action Type */}
            <Card className="border-2 border-green-200 dark:border-green-700 bg-green-50/30 dark:bg-green-900/30 shadow-md hover:shadow-lg transition-shadow md:col-span-2 lg:col-span-1">
              {" "}
              {/* Spans 2 cols on md, 1 on lg */}
              <CardHeader className="pb-2 pt-4">
                <CardTitle className="flex items-center gap-2 text-base font-semibold text-green-700 dark:text-green-300">
                  <Zap className="w-5 h-5" />
                  Question Style
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 pb-4">
                <Select
                  value={systemMessageConfig.action}
                  onValueChange={(value) =>
                    setSystemMessageConfig((prev) => ({
                      ...prev,
                      action: value,
                    }))
                  }
                >
                  <SelectTrigger className="w-full bg-white dark:bg-slate-800 dark:border-slate-700 focus:ring-green-500">
                    <SelectValue placeholder="Select question style..." />
                  </SelectTrigger>
                  <SelectContent className="dark:bg-slate-800 dark:border-slate-700">
                    {actions.map((action) => (
                      <SelectItem
                        key={action.value}
                        value={action.value}
                        className="dark:text-slate-200 dark:hover:bg-slate-700/70"
                      >
                        <div className="flex flex-col">
                          <span className="font-medium text-left">
                            {action.label}
                          </span>
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            {action.description}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          </div>

          {/* Selected Configuration Summary Badges */}
          <div className="flex flex-wrap gap-2 items-center p-2 rounded-md bg-slate-100 dark:bg-slate-800 border dark:border-slate-700">
            <span className="text-sm font-medium text-slate-600 dark:text-slate-300 mr-2">
              Configuration:
            </span>
            <Badge
              variant="secondary"
              className="bg-blue-100 text-blue-800 dark:bg-blue-900/70 dark:text-blue-200"
            >
              {
                subjects.find((s) => s.value === systemMessageConfig.subject)
                  ?.icon
              }{" "}
              {
                subjects.find((s) => s.value === systemMessageConfig.subject)
                  ?.label
              }
            </Badge>
            <Badge
              className={`${
                types.find((t) => t.value === systemMessageConfig.type)?.color
              } text-white`}
            >
              {types.find((t) => t.value === systemMessageConfig.type)?.label}
            </Badge>
            <Badge
              variant="outline"
              className="bg-green-100 text-green-800 dark:bg-green-900/70 dark:text-green-200 border-green-300 dark:border-green-700"
            >
              {
                actions.find((a) => a.value === systemMessageConfig.action)
                  ?.label
              }{" "}
              Style
            </Badge>
          </div>

          {/* Generated Message Preview */}
          <Card className="border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-base font-semibold text-slate-700 dark:text-slate-300">
                Generated System Prompt
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pb-4">
              <div className="bg-slate-100 dark:bg-slate-900 p-4 rounded-md border dark:border-slate-700 min-h-[80px] max-h-[150px] overflow-y-auto">
                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                  {props.customSystemMessage ||
                    "Select options above to auto-generate a system prompt..."}
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  onClick={props.injectSystemMessage}
                  disabled={
                    !props.customSystemMessage.trim() || !props.store.isActive
                  }
                  className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
                >
                  <Send className="w-4 h-4 mr-2" />
                  Inject Prompt
                </Button>
                <Button
                  variant="outline"
                  onClick={handleCopy}
                  disabled={!props.customSystemMessage.trim()}
                  className="flex-1 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700/50"
                >
                  <Copy className="w-4 h-4 mr-2" />
                  {isCopied ? "Copied!" : "Copy Prompt"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <Separator className="dark:bg-slate-700" />

        {/* Existing Tool Selection */}
        <div className="space-y-3">
          <label
            htmlFor="tool-select"
            className="block text-base font-semibold text-slate-700 dark:text-slate-200 mb-1"
          >
            Manual AI Tool Call
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <Select
              value={props.selectedTool}
              onValueChange={(value: keyof ToolFunctions) =>
                props.setSelectedTool(value)
              }
            >
              <SelectTrigger
                id="tool-select"
                className="flex-1 bg-white dark:bg-slate-800 dark:border-slate-700 focus:ring-indigo-500"
              >
                <SelectValue placeholder="Select a tool" />
              </SelectTrigger>
              <SelectContent className="dark:bg-slate-800 dark:border-slate-700">
                <SelectItem
                  value="getQuestion"
                  className="dark:text-slate-200 dark:hover:bg-slate-700/70"
                >
                  getQuestion
                </SelectItem>
                <SelectItem
                  value="evaluateAnswer"
                  className="dark:text-slate-200 dark:hover:bg-slate-700/70"
                >
                  evaluateAnswer
                </SelectItem>
                <SelectItem
                  value="updateInterviewState"
                  className="dark:text-slate-200 dark:hover:bg-slate-700/70"
                >
                  updateInterviewState
                </SelectItem>
                <SelectItem
                  value="analyzeBehavior"
                  className="dark:text-slate-200 dark:hover:bg-slate-700/70"
                >
                  analyzeBehavior
                </SelectItem>
                <SelectItem
                  value="assessTechnicalResponse"
                  className="dark:text-slate-200 dark:hover:bg-slate-700/70"
                >
                  assessTechnicalResponse
                </SelectItem>
              </SelectContent>
            </Select>
            <Button
              onClick={props.callTool}
              variant="outline"
              disabled={!props.store.isActive}
              className="dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700/50"
            >
              <Zap className="w-4 h-4 mr-2" /> Execute Tool
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ControlPanel;
