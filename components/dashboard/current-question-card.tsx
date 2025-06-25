import React from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"; // Added AlertTitle
import { Target } from "lucide-react";
import { Badge } from "../ui/badge";
import { Question } from "@/lib/interview";

type Props = {
  store: {
    currentQuestion: Question | undefined;
  };
};

const CurrentQuestionCard = (props: Props) => {
  return (
    <>
      {props.store.currentQuestion && (
        <Alert
          variant="default"
          className="shadow-lg bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border-blue-500/30 dark:from-blue-500/20 dark:to-indigo-500/20 dark:border-blue-500/50"
        >
          <Target className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <AlertTitle className="font-semibold text-blue-800 dark:text-blue-300">
            Current Question
          </AlertTitle>
          <AlertDescription className="text-blue-700 dark:text-blue-400">
            <p className="text-lg mb-1">
              {props.store.currentQuestion.question}
            </p>
            <div className="flex gap-2 mt-2">
              <Badge
                variant="secondary"
                className="dark:bg-slate-700 dark:text-slate-300"
              >
                {props.store.currentQuestion.category}
              </Badge>
              <Badge
                variant="outline"
                className="dark:border-slate-600 dark:text-slate-400"
              >
                Difficulty: {props.store.currentQuestion.difficulty}
              </Badge>
            </div>
          </AlertDescription>
        </Alert>
      )}
    </>
  );
};

export default CurrentQuestionCard;
