import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, Clock, BookOpen, X } from "lucide-react";
import { Link } from "wouter";

interface ArticleModalProps {
  isOpen: boolean;
  onClose: () => void;
  article: {
    id: number;
    category: string;
    title: string;
    description: string;
    readTime: string;
    content?: string;
    link?: string;
  } | null;
}

export function ArticleModal({ isOpen, onClose, article }: ArticleModalProps) {
  if (!article) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto [&>button]:hidden">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <Badge className="mb-3 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-0">
                {article.category}
              </Badge>
              <DialogTitle className="text-3xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 bg-clip-text text-transparent mb-2">
                {article.title}
              </DialogTitle>
              <DialogDescription className="text-lg text-slate-600 dark:text-slate-400">
                {article.description}
              </DialogDescription>
            </div>
            <button
              onClick={onClose}
              className="ml-4 rounded-full p-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 shadow-sm hover:shadow-md hover:scale-110 bg-white dark:bg-gray-900"
              aria-label="Close"
              title="Close"
            >
              <X className="h-4 w-4 text-gray-700 dark:text-gray-300" />
            </button>
          </div>
        </DialogHeader>

        <div className="mt-6 space-y-6">
          {/* Article Content */}
          <div className="prose prose-slate dark:prose-invert max-w-none">
            {article.content ? (
              <div dangerouslySetInnerHTML={{ __html: article.content }} />
            ) : (
              <div className="space-y-4">
                <p className="text-slate-700 dark:text-slate-300">
                  {article.description}
                </p>
                <p className="text-slate-600 dark:text-slate-400">
                  This comprehensive guide will help you master {article.title.toLowerCase()}. 
                  Learn the fundamentals, best practices, and advanced techniques to maximize 
                  your productivity and success.
                </p>
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                    What You'll Learn
                  </h3>
                  <ul className="list-disc list-inside space-y-1 text-blue-800 dark:text-blue-200">
                    <li>Core concepts and fundamentals</li>
                    <li>Step-by-step workflows</li>
                    <li>Pro tips and best practices</li>
                    <li>Troubleshooting common issues</li>
                    <li>Advanced features and optimizations</li>
                  </ul>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-6 border-t border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <Clock className="h-4 w-4" />
              <span>{article.readTime}</span>
            </div>
            {article.link && (
              <Link href={article.link}>
                <Button className="bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 hover:from-blue-700 hover:via-purple-700 hover:to-blue-800 text-white">
                  Open {article.category}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
