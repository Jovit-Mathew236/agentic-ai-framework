"use client";

import React, { useState, useEffect, useRef } from "react";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Settings,
  Brain,
  AlertCircle,
  Zap,
  Eye,
  Shield,
  Clock,
} from "lucide-react";

interface ToolConfig {
  name: string;
  displayName: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  enabled: boolean;
}

interface ToolToggleProps {
  onToolConfigChange?: (enabledTools: string[]) => void;
}

const ToolToggle: React.FC<ToolToggleProps> = ({ onToolConfigChange }) => {
  const [toolConfigs, setToolConfigs] = useState<ToolConfig[]>([
    {
      name: "detectAnimalssss",
      displayName: "Animals",
      description: "Detects animal mentions",
      icon: Eye,
      enabled: true,
    },
    {
      name: "detectEmotion",
      displayName: "Emotions",
      description: "Identifies emotional states",
      icon: Brain,
      enabled: false,
    },
    {
      name: "detectTechnicalTerms",
      displayName: "Tech Terms",
      description: "Recognizes technical jargon",
      icon: Zap,
      enabled: false,
    },
    {
      name: "detectPersonalInfo",
      displayName: "Personal Info",
      description: "Identifies personal details",
      icon: Shield,
      enabled: false,
    },
    {
      name: "detectInterviewDelay",
      displayName: "Flow Control",
      description: "Monitors conversation pace",
      icon: Clock,
      enabled: false,
    },
  ]);

  const isInitialRender = useRef(true);

  const toggleTool = (toolName: string) => {
    setToolConfigs((prev) =>
      prev.map((tool) =>
        tool.name === toolName ? { ...tool, enabled: !tool.enabled } : tool
      )
    );
  };

  const toggleAllTools = (enabled: boolean) => {
    setToolConfigs((prev) => prev.map((tool) => ({ ...tool, enabled })));
  };

  useEffect(() => {
    const enabledTools = toolConfigs
      .filter((tool) => tool.enabled)
      .map((tool) => tool.name);

    if (isInitialRender.current) {
      isInitialRender.current = false;
      return;
    }

    onToolConfigChange?.(enabledTools);
  }, [toolConfigs]);

  const enabledCount = toolConfigs.filter((tool) => tool.enabled).length;

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            <CardTitle className="text-base">AI Tools</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant={enabledCount > 0 ? "default" : "secondary"}
              className="text-xs"
            >
              {enabledCount}/{toolConfigs.length}
            </Badge>
            <button
              onClick={() =>
                toggleAllTools(enabledCount !== toolConfigs.length)
              }
              className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            >
              {enabledCount === toolConfigs.length ? "Clear" : "All"}
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-3 gap-3">
          {toolConfigs.map((tool) => {
            const IconComponent = tool.icon;
            return (
              <div
                key={tool.name}
                className={`
                  relative p-3 border rounded-lg cursor-pointer transition-all duration-200
                  ${
                    tool.enabled
                      ? "border-blue-200 bg-blue-50 hover:bg-blue-100"
                      : "border-gray-200 bg-gray-50 hover:bg-gray-100"
                  }
                `}
                onClick={() => toggleTool(tool.name)}
              >
                {/* Status indicator */}
                <div
                  className={`absolute top-2 right-2 w-2 h-2 rounded-full ${
                    tool.enabled ? "bg-green-500" : "bg-gray-300"
                  }`}
                />

                {/* Icon */}
                <div className="flex justify-center mb-2">
                  <IconComponent
                    className={`h-5 w-5 ${
                      tool.enabled ? "text-blue-600" : "text-gray-400"
                    }`}
                  />
                </div>

                {/* Tool name */}
                <div className="text-center">
                  <h4
                    className={`text-xs font-medium ${
                      tool.enabled ? "text-blue-900" : "text-gray-600"
                    }`}
                  >
                    {tool.displayName}
                  </h4>
                  <p className="text-xs text-gray-500 mt-1">
                    {tool.description}
                  </p>
                </div>

                {/* Hidden switch for accessibility */}
                <Switch
                  checked={tool.enabled}
                  onCheckedChange={() => toggleTool(tool.name)}
                  className="sr-only"
                />
              </div>
            );
          })}

          {/* Empty slot for 3x2 grid completion */}
          <div className="p-3 border border-dashed border-gray-300 rounded-lg bg-gray-50/50 flex items-center justify-center">
            <span className="text-xs text-gray-400">Available</span>
          </div>
        </div>

        {enabledCount === 0 && (
          <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center gap-2">
            <AlertCircle className="h-3 w-3 text-yellow-600 flex-shrink-0" />
            <span className="text-xs text-yellow-800">
              No tools active - monitoring only
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ToolToggle;
