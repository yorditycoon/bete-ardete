import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { RadioGroup, RadioGroupItem } from "../components/ui/radio-group";
import { Label } from "../components/ui/label";
import { Progress } from "../components/ui/progress";
import { CheckCircle, Award, Loader2, BookOpen, Trophy, Unlock, Lock, Folder, ChevronDown, ChevronRight, FolderOpen } from "lucide-react";
import { supabase } from "../lib/supabase"; 
import { toast } from "sonner";

export function QuizPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  // Book & Folder States
  const [books, setBooks] = useState<any[]>([]);
  const [activeBook, setActiveBook] = useState<any>(null);
  const [expandedBookId, setExpandedBookId] = useState<string | null>(null);
  
  // Quiz states
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [selectedQuiz, setSelectedQuiz] = useState<any>(null);
  
  // Quiz taking states
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [quizStarted, setQuizStarted] = useState(false);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [completedQuizzes, setCompletedQuizzes] = useState<Record<string, number>>({});

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);

      if (user) {
        const { data: scores } = await supabase
          .from('quiz_scores')
          .select('quiz_id, score')
          .eq('user_id', user.id);
        
        if (scores) {
          const scoreMap: Record<string, number> = {};
          scores.forEach((s: any) => scoreMap[s.quiz_id] = s.score);
          setCompletedQuizzes(scoreMap);
        }
      }

      const { data: allBooks } = await supabase
        .from('study_books')
        .select('*')
        .order('created_at', { ascending: false });

      if (allBooks) setBooks(allBooks);

      const active = (allBooks || []).find((b: any) => b.status === 'active');
      if (active) {
        setActiveBook(active);
        setExpandedBookId(active.id);
      } else if (allBooks && allBooks.length > 0) {
        setExpandedBookId(allBooks[0].id);
      }

      const { data: quizData, error } = await supabase
        .from('quizzes')
        .select(`*, questions:quiz_questions(*)`)
        .order('created_at', { ascending: true }); 

      if (error) {
        toast.error("Failed to load quizzes");
      } else {
        setQuizzes(quizData || []);
        if (active && quizData) {
          const activeBookQuizzes = (quizData || []).filter((q: any) => q?.book_id === active.id);
          if (activeBookQuizzes.length > 0) {
            setSelectedQuiz(activeBookQuizzes[0]);
          }
        }
      }
      setIsLoading(false);
    };

    fetchData();
  }, []);

  const currentQuestion = selectedQuiz?.questions?.[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === (selectedQuiz?.questions?.length || 1) - 1;
  const isAlreadyCompleted = selectedQuiz && completedQuizzes[selectedQuiz?.id] !== undefined;

  const handleStartQuiz = (e?: React.SyntheticEvent) => {
    if (e) e.preventDefault();
    if (!selectedQuiz?.questions?.length) return toast.error("This quiz has no questions yet.");
    setQuizStarted(true);
    setCurrentQuestionIndex(0);
    setSelectedAnswers({});
    setQuizCompleted(false);
  };

  const handleAnswerSelect = (questionId: string, answerIndex: number) => {
    if (!questionId) return;
    setSelectedAnswers(prev => ({ ...prev, [questionId]: answerIndex }));
  };

  const calculateScore = () => {
    if (!selectedQuiz || !selectedQuiz.questions || selectedQuiz.questions.length === 0) return 0;
    let correct = 0;
    selectedQuiz.questions.forEach((q: any) => {
      if (selectedAnswers[q.id] === q.correct_option_index) {
        correct++;
      }
    });
    return Math.round((correct / selectedQuiz.questions.length) * 100);
  };

  const handleSubmitQuiz = async () => {
    if (!currentUser || !selectedQuiz) return;
    
    const score = calculateScore();
    setIsSaving(true);
    
    try {
      const { error } = await supabase
        .from('quiz_scores')
        .insert({
          user_id: currentUser.id,
          quiz_id: selectedQuiz.id,
          score: score
        });

      if (error) throw error;
      
      setCompletedQuizzes(prev => ({ ...prev, [selectedQuiz.id]: score }));
      setQuizCompleted(true);
      toast.success(`Quiz completed! Score: ${score}%`);
      
    } catch (err: any) {
      toast.error("Failed to save score: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleNextQuestion = (e?: React.SyntheticEvent) => {
    if (e) e.preventDefault();
    if (isLastQuestion) {
      handleSubmitQuiz();
    } else {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };

  const toggleFolder = (bookId: string) => {
    if (expandedBookId === bookId) {
      setExpandedBookId(null);
    } else {
      setExpandedBookId(bookId);
    }
  };

  const getQuizTypeStyling = (type: string | undefined, isSelected: boolean) => {
    switch (type) {
      case 'midterm':
        return {
          badge: "bg-blue-100 text-blue-800 border-blue-200",
          icon: <Unlock className={`w-4 h-4 sm:w-5 sm:h-5 ${isSelected ? "text-blue-600" : "text-blue-400"}`} />,
          label: "Midterm",
          border: isSelected ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500 shadow-sm" : "border-gray-100 hover:border-blue-200 hover:bg-gray-50"
        };
      case 'final':
        return {
          badge: "bg-purple-100 text-purple-800 border-purple-200",
          icon: <Trophy className={`w-4 h-4 sm:w-5 sm:h-5 ${isSelected ? "text-purple-600" : "text-purple-400"}`} />,
          label: "Final",
          border: isSelected ? "border-purple-500 bg-purple-50 ring-1 ring-purple-500 shadow-sm" : "border-gray-100 hover:border-purple-200 hover:bg-gray-50"
        };
      default: 
        return {
          badge: "bg-green-100 text-green-800 border-green-200",
          icon: <BookOpen className={`w-4 h-4 sm:w-5 sm:h-5 ${isSelected ? "text-green-600" : "text-green-400"}`} />,
          label: "Weekly",
          border: isSelected ? "border-green-600 bg-green-50 ring-1 ring-green-600 shadow-sm" : "border-gray-100 hover:border-green-200 hover:bg-gray-50"
        };
    }
  };

  if (isLoading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-green-600 w-10 h-10" /></div>;

  if (books.length === 0) {
    return (
      <div className="text-center p-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
        <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500 font-bold text-lg">No Study Books Found</p>
        <p className="text-sm text-gray-400">The Admin hasn't created any books or quizzes yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      
      <div className="bg-gradient-to-r from-green-100 to-green-50 rounded-xl p-6 sm:p-8 border border-green-200 shadow-sm flex flex-col justify-center">
        <h2 className="text-2xl sm:text-3xl font-black text-green-900 mb-2">Knowledge Check</h2>
        <p className="text-green-700 font-medium">Test your understanding and unlock your final grades.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        
        {/* FOLDER LIST SIDEBAR - FIXED SCROLLING AND HEIGHT */}
        <div className="lg:col-span-1 lg:sticky lg:top-20 z-10">
          <Card className="border-green-200 shadow-sm flex flex-col max-h-[400px] lg:max-h-[calc(100vh-120px)]">
            <CardHeader className="p-4 bg-gray-50/50 border-b border-gray-100 flex-none rounded-t-xl">
              <CardTitle className="text-lg flex items-center gap-2 text-green-900">
                <FolderOpen className="w-5 h-5 text-green-600" />
                Assessment Folders
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 overflow-y-auto flex-1 space-y-3">
              {(books || []).map((book: any) => {
                const bookQuizzes = (quizzes || []).filter((q: any) => q?.book_id === book?.id);
                const isExpanded = expandedBookId === book.id;
                const isActive = book.status === 'active';

                return (
                  <div key={book.id} className={`rounded-xl border transition-all shadow-sm overflow-hidden shrink-0 ${isExpanded ? "border-green-300 bg-white" : "border-gray-200 bg-white hover:border-green-200"}`}>
                    <button 
                      type="button"
                      onClick={(e) => { e.preventDefault(); toggleFolder(book.id); }} 
                      className={`w-full flex items-center justify-between p-4 transition-colors ${isExpanded ? "bg-green-50/50" : "hover:bg-gray-50"}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${isExpanded ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                          <Folder className="w-5 h-5" />
                        </div>
                        <div className="text-left">
                          <p className={`font-bold text-sm sm:text-base leading-tight ${isExpanded ? "text-green-900" : "text-gray-700"}`}>
                            {book.title}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            {isActive && <Badge className="bg-green-100 text-green-800 text-[9px] px-1.5 py-0 border-none">Active Study</Badge>}
                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{bookQuizzes.length} Quizzes</p>
                          </div>
                        </div>
                      </div>
                      {isExpanded ? <ChevronDown className="w-5 h-5 text-green-600 shrink-0" /> : <ChevronRight className="w-5 h-5 text-gray-400 shrink-0" />}
                    </button>

                    {isExpanded && (
                      <div className="bg-gray-50/50 p-3 space-y-2 border-t border-gray-100">
                        {bookQuizzes.length === 0 ? (
                          <p className="text-xs text-gray-400 text-center py-4 italic">No assessments added to this book yet.</p>
                        ) : (
                          bookQuizzes.map((quiz: any) => {
                            const hasDone = completedQuizzes[quiz.id] !== undefined;
                            const isSelected = selectedQuiz?.id === quiz.id;
                            const styling = getQuizTypeStyling(quiz.quiz_type, isSelected);

                            return (
                              <button
                                type="button"
                                key={quiz.id}
                                onClick={(e) => {
                                  e.preventDefault();
                                  setSelectedQuiz(quiz);
                                  setQuizStarted(false);
                                  setQuizCompleted(false);
                                  // Smooth scroll down to the quiz panel on smaller screens
                                  setTimeout(() => {
                                    document.getElementById('quiz-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                  }, 100);
                                }}
                                className={`w-full text-left p-3 rounded-lg border transition-all bg-white flex items-center justify-between gap-2 ${styling.border}`}
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="shrink-0">{styling.icon}</div>
                                  <div className="min-w-0">
                                    <p className={`font-bold text-sm truncate ${isSelected ? "text-green-900" : "text-gray-700"}`}>{quiz.title}</p>
                                    <p className="text-[10px] text-gray-400 font-medium uppercase mt-0.5">{styling.label} • {quiz.questions?.length || 0} Qs</p>
                                  </div>
                                </div>
                                
                                {hasDone && (
                                  <Badge className="bg-green-100 text-green-800 border-green-200 px-1.5 py-0.5 shrink-0">
                                    <CheckCircle className="w-3 h-3 mr-1" /> {completedQuizzes[quiz.id]}%
                                  </Badge>
                                )}
                              </button>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        {/* QUIZ INTERFACE MAIN PANEL */}
        <Card id="quiz-panel" className="lg:col-span-2 border-green-200 shadow-sm flex flex-col min-h-[500px] h-fit">
          {!selectedQuiz ? (
            <CardContent className="flex-1 flex flex-col items-center justify-center p-12 text-center">
              <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-6 border border-gray-100 shadow-inner">
                <FolderOpen className="w-10 h-10 text-gray-300" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Select an Assessment</h3>
              <p className="text-gray-500 max-w-sm">Open a book folder on the left and choose a weekly quiz, midterm, or final exam to begin.</p>
            </CardContent>
          ) : (
            <>
              <CardHeader className="border-b border-gray-100 bg-gray-50/50 pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-xl sm:text-2xl text-gray-900">{selectedQuiz?.title}</CardTitle>
                    <CardDescription className="text-green-700 font-bold mt-1">
                      {(books || []).find((b: any) => b?.id === selectedQuiz?.book_id)?.title || "Study Book"}
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className={`w-fit ${getQuizTypeStyling(selectedQuiz?.quiz_type, true).badge}`}>
                    {getQuizTypeStyling(selectedQuiz?.quiz_type, true).label}
                  </Badge>
                </div>
              </CardHeader>
              
              <CardContent className="pt-6 flex-1 flex flex-col">
                
                {quizCompleted ? (
                  <div className="text-center py-6 flex-1">
                    <h3 className="text-2xl font-bold text-green-900 mb-2">Great Job!</h3>
                    <p className="text-6xl font-black text-green-600 mb-4">{calculateScore()}%</p>
                    
                    <div className="mt-8 space-y-4 text-left bg-gray-50 p-4 sm:p-6 rounded-xl border border-gray-100">
                      <p className="font-bold text-gray-900 text-lg border-b border-gray-200 pb-2 mb-4">Review Your Answers</p>
                      {(selectedQuiz?.questions || []).map((q: any, idx: number) => {
                        const isCorrect = selectedAnswers[q.id] === q.correct_option_index;
                        return (
                          <div key={q.id} className={`p-4 sm:p-5 rounded-xl border bg-white shadow-sm ${isCorrect ? "border-green-200" : "border-red-200"}`}>
                            <p className="text-base font-bold text-gray-900 mb-2">{idx + 1}. {q.question_text}</p>
                            <div className={`p-3 rounded-lg text-sm font-medium ${isCorrect ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>
                              <span className="font-bold opacity-70 mr-2">Your Answer:</span> 
                              {q.options?.[selectedAnswers[q.id]] || "Skipped"}
                            </div>
                            {!isCorrect && (
                              <div className="mt-2 p-3 rounded-lg text-sm font-medium bg-green-50 text-green-800 border border-green-100">
                                <span className="font-bold opacity-70 mr-2">Correct Answer:</span> 
                                {q.options?.[q.correct_option_index]}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <Button type="button" onClick={(e) => { e.preventDefault(); setQuizCompleted(false); }} variant="outline" className="mt-8 w-full border-green-200 text-green-700 hover:bg-green-50 font-bold py-6">
                      Finish Review
                    </Button>
                  </div>

                ) : isAlreadyCompleted ? (
                  <div className="text-center py-16 flex-1 flex flex-col items-center justify-center">
                    <div className="w-24 h-24 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-green-100 shadow-inner">
                      <CheckCircle className="w-12 h-12 text-green-500" />
                    </div>
                    <h3 className="text-3xl font-black text-gray-900 mb-2">Assessment Completed!</h3>
                    <p className="text-gray-500 mb-8 max-w-sm mx-auto">You have already submitted this assessment. There are no retakes.</p>
                    
                    <div className="bg-green-50 border border-green-200 px-12 py-6 rounded-2xl shadow-sm">
                      <p className="text-xs font-bold uppercase tracking-widest text-green-800 mb-1">Your Final Score</p>
                      <p className="text-6xl font-black text-green-600">{completedQuizzes[selectedQuiz?.id] || 0}%</p>
                    </div>
                  </div>

                ) : !quizStarted ? (
                  <div className="text-center py-16 flex-1 flex flex-col items-center justify-center">
                    <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner border-4 border-white ${
                      selectedQuiz?.quiz_type === 'final' ? 'bg-purple-100 text-purple-600' :
                      selectedQuiz?.quiz_type === 'midterm' ? 'bg-blue-100 text-blue-600' :
                      'bg-green-100 text-green-600'
                    }`}>
                      {selectedQuiz?.quiz_type === 'final' ? <Trophy className="w-12 h-12" /> : 
                       selectedQuiz?.quiz_type === 'midterm' ? <Unlock className="w-12 h-12" /> : 
                       <Award className="w-12 h-12" />}
                    </div>
                    <h3 className="text-3xl font-black text-gray-900 mb-3">Ready for the challenge?</h3>
                    <p className="text-gray-600 mb-8 px-4 sm:px-10 max-w-md mx-auto leading-relaxed">
                      {selectedQuiz?.quiz_type === 'final' 
                        ? "This is your final exam for the book! Make sure you are completely ready before starting." 
                        : "Make sure you've completed the required readings before starting this assessment."}
                      <br/>
                      <span className="font-bold text-red-600 mt-4 inline-block bg-red-50 border border-red-100 px-4 py-1.5 rounded-full text-xs uppercase tracking-wider shadow-sm">
                        You only get ONE chance to submit!
                      </span>
                    </p>
                    <Button type="button" onClick={handleStartQuiz} className="bg-green-600 hover:bg-green-700 px-12 py-7 text-lg font-bold shadow-lg shadow-green-600/20 rounded-xl w-full sm:w-auto">
                      Start {getQuizTypeStyling(selectedQuiz?.quiz_type, false).label}
                    </Button>
                  </div>

                ) : (
                  <div className="space-y-6 flex-1 flex flex-col">
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                      <div className="flex justify-between items-end mb-3">
                        <span className="text-sm font-bold text-green-800 uppercase tracking-wider">Question {currentQuestionIndex + 1} of {selectedQuiz?.questions?.length || 1}</span>
                        <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">Take your time</span>
                      </div>
                      <Progress value={((currentQuestionIndex + 1) / (selectedQuiz?.questions?.length || 1)) * 100} className="h-2.5 bg-gray-200 [&>div]:bg-green-500" />
                    </div>
                    
                    <div className="py-4 sm:py-6 flex-1">
                      <h4 className="text-xl sm:text-2xl font-bold text-gray-900 mb-8 leading-snug">{currentQuestion?.question_text}</h4>
                      
                      <RadioGroup
                        value={selectedAnswers[currentQuestion?.id || '']?.toString()}
                        onValueChange={(val) => handleAnswerSelect(currentQuestion?.id || '', parseInt(val))}
                        className="space-y-3 sm:space-y-4"
                      >
                        {(currentQuestion?.options || []).map((opt: string, i: number) => (
                          <div key={i} className={`flex items-center space-x-4 p-4 sm:p-5 rounded-xl border-2 transition-all cursor-pointer ${
                            selectedAnswers[currentQuestion?.id || ''] === i ? "border-green-600 bg-green-50 shadow-sm" : "border-gray-100 hover:bg-gray-50 hover:border-gray-300"
                          }`}>
                            <RadioGroupItem value={i.toString()} id={`q-${i}`} className="text-green-600 w-5 h-5" />
                            <Label htmlFor={`q-${i}`} className="flex-1 cursor-pointer font-medium text-gray-700 text-base sm:text-lg leading-snug">{opt}</Label>
                          </div>
                        ))}
                      </RadioGroup>
                    </div>

                    <div className="flex flex-col sm:flex-row justify-between gap-3 pt-6 border-t border-gray-100 mt-auto">
                      <Button type="button" variant="outline" onClick={(e) => { e.preventDefault(); setCurrentQuestionIndex(prev => prev - 1); }} disabled={currentQuestionIndex === 0} className="border-gray-200 text-gray-600 font-bold py-6 sm:w-1/3">
                        Previous
                      </Button>
                      <Button 
                        type="button"
                        onClick={handleNextQuestion} 
                        disabled={selectedAnswers[currentQuestion?.id || ''] === undefined || isSaving}
                        className="bg-green-600 hover:bg-green-700 font-bold shadow-md py-6 sm:w-2/3 text-base"
                      >
                        {isSaving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
                        {isSaving ? "Saving Results..." : isLastQuestion ? "Submit Final Answers" : "Next Question"}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}