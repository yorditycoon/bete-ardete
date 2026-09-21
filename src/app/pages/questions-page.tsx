import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { Badge } from "../components/ui/badge";
import { MessageSquare, Send, Loader2, User, Trash2 } from "lucide-react"; 
import { supabase } from "../lib/supabase";
import { toast } from "sonner";

export function QuestionsPage() {
  const [questions, setQuestions] = useState<any[]>([]);
  const [newQuestion, setNewQuestion] = useState("");
  const [answerText, setAnswerText] = useState<{ [key: string]: string }>({});
  const [filter, setFilter] = useState<"all" | "answered" | "pending">("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auth Context
  const currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");
  const isAdmin = currentUser.role === "admin";

  useEffect(() => {
    fetchQuestions(true); // Initial load shows spinner

    // Listen for any changes to the questions table
    const channel = supabase.channel('questions-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'anoquestions' }, () => {
        fetchQuestions(false); // Silent background refresh!
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  async function fetchQuestions(isInitial = false) {
    if (isInitial) setIsLoading(true);
    
    const { data, error } = await supabase
      .from("anoquestions")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to load questions history");
    } else {
      setQuestions(data || []);
    }
    
    if (isInitial) setIsLoading(false);
  }

  const handleSubmitQuestion = async (e?: React.SyntheticEvent) => {
    if (e) e.preventDefault();
    if (!newQuestion.trim()) return;
    setIsSubmitting(true);

    const { error } = await supabase.from("anoquestions").insert([
      {
        question: newQuestion.trim(),
        user_id: currentUser.id,
        user_name: "Anonymous", // Database-level anonymity enforcement
      },
    ]);

    if (error) {
      toast.error("Could not submit. Try again later.");
    } else {
      toast.success("Question submitted anonymously!");
      setNewQuestion("");
      fetchQuestions(false); 
    }
    setIsSubmitting(false);
  };

  const handleAnswerSubmit = async (questionId: string, e?: React.SyntheticEvent) => {
    if (e) e.preventDefault();
    const text = answerText[questionId];
    if (!text?.trim()) return;

    const { error } = await supabase
      .from("anoquestions")
      .update({ 
        answer: text, 
        answered_at: new Date().toISOString() 
      })
      .eq("id", questionId);

    if (error) {
      toast.error("Failed to save answer");
    } else {
      toast.success("Answer posted!");
      setAnswerText(prev => ({ ...prev, [questionId]: "" }));
      fetchQuestions(false);
    }
  };

  // --- DELETE QUESTION FUNCTION (ADMIN ONLY) ---
  const handleDeleteQuestion = async (questionId: string, e?: React.SyntheticEvent) => {
    if (e) e.preventDefault();
    const confirmed = window.confirm("Are you sure you want to delete this question? This action cannot be undone.");
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from("anoquestions")
        .delete()
        .eq("id", questionId);

      if (error) throw error;

      toast.success("Question deleted successfully.");
      // Update UI immediately without waiting for realtime
      setQuestions((prev) => prev.filter((q) => q.id !== questionId));
    } catch (error: any) {
      toast.error("Failed to delete question: " + error.message);
    }
  };

  const filteredQuestions = questions.filter((q) => {
    if (filter === "answered") return q.answer;
    if (filter === "pending") return !q.answer;
    return true;
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-green-600 mb-2" />
        <p className="text-sm text-muted-foreground">Fetching questions...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="bg-gradient-to-r from-green-100 to-green-50 rounded-xl p-6 border border-green-200 shadow-sm">
        <h2 className="text-2xl font-bold text-green-900 italic">"Seek, and you shall find"</h2>
        <p className="text-green-700 mt-2">
          {isAdmin ? "Respond to spiritual doubts and questions from the congregation. All identities are hidden." : "Submit your questions about church or the Bible completely anonymously."}
        </p>
      </div>

      {/* Ask Question Box (Hidden from Admin) */}
      {!isAdmin && (
        <Card className="border-green-200 shadow-sm bg-white">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-green-600" />
              Ask a Question Anonymously
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="What's on your mind? The Admin will not see your name..."
              value={newQuestion}
              onChange={(e) => setNewQuestion(e.target.value)}
              className="border-green-100 focus-visible:ring-green-500 min-h-[100px] text-base"
            />
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <p className="text-xs text-gray-500 font-medium bg-gray-50 px-3 py-2 rounded-md border border-gray-100">
                🔒 Your identity is protected and hidden from church leadership.
              </p>
              <Button 
                type="button"
                onClick={handleSubmitQuestion} 
                disabled={isSubmitting || !newQuestion.trim()}
                className="bg-green-600 hover:bg-green-700 font-bold px-6 shadow-md w-full sm:w-auto"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                {isSubmitting ? "Sending..." : "Submit Question"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2 p-1 bg-gray-100/80 w-fit rounded-lg border border-gray-200">
        {["all", "answered", "pending"].map((f) => (
          <Button
            type="button"
            key={f}
            variant={filter === f ? "default" : "ghost"}
            size="sm"
            onClick={(e) => { e.preventDefault(); setFilter(f as any); }}
            className={filter === f ? "bg-white text-green-700 shadow-sm hover:bg-white font-bold" : "text-gray-500 font-medium"}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </Button>
        ))}
      </div>

      {/* Question Cards */}
      <div className="space-y-4">
        {filteredQuestions.length === 0 ? (
           <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-200">
             <p className="text-gray-500 font-medium">No questions found in this category.</p>
           </div>
        ) : (
          filteredQuestions.map((q) => (
            <Card key={q.id} className="border-gray-200 overflow-hidden shadow-sm hover:border-green-200 transition-colors">
              <div className="p-4 sm:p-5">
                <div className="flex flex-wrap justify-between items-start gap-4 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-gray-100 rounded-full border border-gray-200">
                      <User className="w-4 h-4 text-gray-500" />
                    </div>
                    <div>
                      <p className="font-bold text-gray-900 text-sm">
                        {/* UI Identity Masking */}
                        {isAdmin 
                          ? "Anonymous Member" 
                          : q.user_id === currentUser.id 
                            ? "My Question" 
                            : "Anonymous Member"}
                      </p>
                      <p className="text-[10px] text-gray-400 font-mono uppercase tracking-wider">
                        {new Date(q.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  
                  {/* --- BADGE & DELETE BUTTON GROUP --- */}
                  <div className="flex items-center gap-2">
                    <Badge className={q.answer ? "bg-green-100 text-green-700 hover:bg-green-100" : "bg-amber-100 text-amber-700 hover:bg-amber-100"}>
                      {q.answer ? "Answered" : "Pending"}
                    </Badge>
                    
                    {/* Delete button only shows for Admins */}
                    {isAdmin && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={(e) => handleDeleteQuestion(q.id, e)}
                        className="text-gray-400 hover:text-red-600 hover:bg-red-50 h-8 w-8 transition-colors"
                        title="Delete Question"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>

                <p className="text-gray-800 text-base bg-gray-50 p-4 rounded-xl mb-4 border border-gray-100 font-medium leading-relaxed break-words">
                  {q.question}
                </p>

                {q.answer ? (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] font-black text-green-600 uppercase tracking-widest bg-green-50 px-2 py-1 rounded">Admin Response</span>
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed bg-white break-words">{q.answer}</p>
                  </div>
                ) : isAdmin ? (
                  <div className="space-y-3 mt-4 pt-4 border-t border-gray-100">
                    <Textarea
                      placeholder="Provide biblical guidance or an answer..."
                      value={answerText[q.id] || ""}
                      onChange={(e) => setAnswerText({ ...answerText, [q.id]: e.target.value })}
                      className="text-sm min-h-[100px] border-gray-200 focus-visible:ring-green-500"
                    />
                    <div className="flex justify-end">
                      <Button 
                        type="button"
                        size="sm" 
                        onClick={(e) => handleAnswerSubmit(q.id, e)} 
                        disabled={!answerText[q.id]?.trim()} 
                        className="bg-green-600 hover:bg-green-700 font-bold px-6 shadow-sm w-full sm:w-auto"
                      >
                        Post Answer
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}