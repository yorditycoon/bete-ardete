import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { Progress } from "../components/ui/progress";
import { Badge } from "../components/ui/badge";
import { 
  BookOpen, Mic, CheckCircle, Calendar, MessageSquare,
  TrendingUp, Award, Loader2, Users, Trophy, Lock, Unlock, BookMarked, MapPin
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { toast } from "sonner";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router";
import { LucideIcon } from "lucide-react";

interface DashboardCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  href: string;
  color: string; 
}

export function DashboardCard({ title, description, icon: Icon, href, color }: DashboardCardProps) {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate(href)}
      className="group relative bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 text-left w-full overflow-hidden"
    >
      <div className={`absolute -right-4 -top-4 w-24 h-24 rounded-full opacity-10 transition-transform group-hover:scale-150 ${color}`} />
      
      <div className="flex flex-col gap-4 relative z-10">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-lg ${color}`}>
          <Icon className="w-6 h-6" />
        </div>
        
        <div>
          <h3 className="text-lg font-bold text-gray-900 group-hover:text-green-700 transition-colors">
            {title}
          </h3>
          <p className="text-sm text-gray-500 mt-1 leading-relaxed">
            {description}
          </p>
        </div>

        <div className="flex items-center text-xs font-bold text-green-600 uppercase tracking-wider mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
          Open Section →
        </div>
      </div>
    </button>
  );
}

export function MemberDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isGrading, setIsGrading] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  // Dynamic State
  const [question, setQuestion] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);
  const [familyName, setFamilyName] = useState<string>(""); 
  
  // --- Book Study States ---
  const [activeBook, setActiveBook] = useState<any>(null);
  const [bookGrade, setBookGrade] = useState<any>(null);
  const [milestones, setMilestones] = useState({
    midterm: { published: false, score: null as number | null },
    final: { published: false, score: null as number | null },
    avgWeeklyQuiz: 0
  });

  // Stats State
  const [stats, setStats] = useState({
    completedReadings: 0,
    totalReadings: 0, 
    voiceRecordings: 0,
    averageScore: 0,
    attendanceRate: 0,
  });

  const dailyVerse = {
    verse: "For I know the plans I have for you, declares the Lord, plans for welfare and not for evil, to give you a future and a hope.",
    reference: "Jeremiah 29:11"
  };

  useEffect(() => {
    loadMemberData();
  }, []);

  async function loadMemberData() {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      setCurrentUser(profile);

      if (profile?.family_id) {
        const { data: familyData } = await supabase.from('families').select('name').eq('id', profile.family_id).single();
        if (familyData) setFamilyName(familyData.name);
      }

      // 1. Fetch Upcoming Events
      const today = new Date().toISOString().split('T')[0];
      const { data: events } = await supabase.from('events').select('*').gte('event_date', today).order('event_date', { ascending: true }).limit(3);
      if (events) setUpcomingEvents(events);

      // 2. Fetch Active Book and Milestones
      const { data: book } = await supabase.from('study_books').select('*').eq('status', 'active').order('created_at', { ascending: false }).limit(1).single();
      
      let totalReadings = 10;
      let completedReadingsCount = 0;
      let voiceRecordingsCount = 0;
      let avgWeeklyScore = 0;

      if (book) {
        setActiveBook(book);

        const { data: gradeData } = await supabase.from('book_grades').select('*').eq('user_id', user.id).eq('book_id', book.id).maybeSingle();
        if (gradeData) setBookGrade(gradeData);

        const { data: assignments } = await supabase.from('assignments').select('id').eq('book_id', book.id);
        const assignmentIds = assignments?.map(a => a.id) || [];
        totalReadings = assignmentIds.length || 1; 

        const { data: readings } = await supabase.from('reading_progress').select('*').eq('user_id', user.id);
        const bookReadings = readings?.filter(r => assignmentIds.includes(r.reading_id)) || [];
        completedReadingsCount = bookReadings.filter(r => r.is_completed).length;
        
        // FIX: Since Read Aloud is mandatory to finish the week, Read Alouds = Completed Readings
        voiceRecordingsCount = completedReadingsCount; 

        const { data: bookQuizzes } = await supabase.from('quizzes').select('id, quiz_type').eq('book_id', book.id);
        const { data: allUserScores } = await supabase.from('quiz_scores').select('quiz_id, score').eq('user_id', user.id);

        const midtermQuiz = bookQuizzes?.find(q => q.quiz_type === 'midterm');
        const finalQuiz = bookQuizzes?.find(q => q.quiz_type === 'final');
        const weeklyQuizzes = bookQuizzes?.filter(q => q.quiz_type === 'weekly') || [];

        const midtermScore = midtermQuiz ? allUserScores?.find(s => s.quiz_id === midtermQuiz.id)?.score ?? null : null;
        const finalScore = finalQuiz ? allUserScores?.find(s => s.quiz_id === finalQuiz.id)?.score ?? null : null;
        
        const weeklyScores = allUserScores?.filter(s => weeklyQuizzes.map(wq => wq.id).includes(s.quiz_id)) || [];
        avgWeeklyScore = weeklyScores.length > 0 ? Math.round(weeklyScores.reduce((a, b) => a + b.score, 0) / weeklyScores.length) : 0;

        setMilestones({
          midterm: { published: !!midtermQuiz, score: midtermScore },
          final: { published: !!finalQuiz, score: finalScore },
          avgWeeklyQuiz: avgWeeklyScore
        });
      }

      // 3. Fetch Attendance
      const { data: attendance } = await supabase.from('attendance').select('present').eq('user_id', user.id);
      const attendanceRateCalc = attendance && attendance.length > 0
        ? Math.round((attendance.filter(a => a.present).length / attendance.length) * 100)
        : 0;

      setStats({
        completedReadings: completedReadingsCount,
        totalReadings: totalReadings, 
        voiceRecordings: voiceRecordingsCount,
        averageScore: avgWeeklyScore,
        attendanceRate: attendanceRateCalc
      });

    } catch (error: any) {
      console.error(error);
      toast.error("Error loading dashboard data");
    } finally {
      setLoading(false);
    }
  }

  const handleDeclareFinished = async () => {
    if (!activeBook || !currentUser) return;
    
    if (milestones.final.score === null) {
      return toast.error("You must complete the Final Exam before declaring the book finished!");
    }

    setIsGrading(true);
    try {
      const readingScore = stats.totalReadings > 0 ? (stats.completedReadings / stats.totalReadings) * 20 : 20;
      const quizScore = (milestones.avgWeeklyQuiz / 100) * 20;
      const midtermScore = ((milestones.midterm.score || 0) / 100) * 25;
      const finalScore = ((milestones.final.score || 0) / 100) * 35;

      const grandTotal = Math.round(readingScore + quizScore + midtermScore + finalScore);

      const { data, error } = await supabase.from('book_grades').insert({
        user_id: currentUser.id,
        family_id: currentUser.family_id,
        book_id: activeBook.id,
        final_score: grandTotal
      }).select().single();

      if (error) throw error;

      setBookGrade(data);
      toast.success(`Congratulations! You finished ${activeBook.title} with a score of ${grandTotal}%!`);
    } catch (err: any) {
      toast.error("Error generating final grade: " + err.message);
    } finally {
      setIsGrading(false);
    }
  };

  const handleSubmitQuestion = async () => {
    if (!question.trim() || !currentUser) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('anoquestions').insert({
        user_id: currentUser.id, user_name: currentUser.name, question: question.trim()
      });
      if (error) throw error;
      toast.success("Question submitted successfully!");
      setQuestion("");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const attendanceData = [
    { id: "attended", name: "Attended", value: stats.attendanceRate },
    { id: "absent", name: "Absent", value: 100 - stats.attendanceRate },
  ];

  if (loading) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-green-600 mb-4" />
        <p className="text-muted-foreground animate-pulse">Loading your spiritual journey...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      
      {/* ROW 1: Welcome Banner & Daily Verse (Shorter Cards) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Welcome Section */}
        <div className="lg:col-span-2 bg-gradient-to-r from-green-100 to-green-50 rounded-xl p-6 sm:p-8 border border-green-200 shadow-sm flex flex-col justify-center relative overflow-hidden h-fit">
          <div className="relative z-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Welcome Back, {currentUser?.name?.split(' ')[0]}!</h2>
            {familyName && (
              <div className="flex items-center gap-2 mb-3">
                <Badge variant="outline" className="bg-white/80 backdrop-blur-sm border-green-300 text-green-700 px-3 py-1 shadow-sm font-bold">
                  <Users className="w-3.5 h-3.5 mr-2 text-green-600" />
                  Member of {familyName}
                </Badge>
              </div>
            )}
            <p className="text-gray-600 font-medium text-sm sm:text-base">Continue your spiritual journey today.</p>
          </div>
        </div>

        {/* Daily Verse */}
        <div className="lg:col-span-1">
          <Card className="border-green-200 bg-gradient-to-br from-white to-green-50/30 shadow-sm h-full flex flex-col min-h-[140px]">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <BookOpen className="w-5 h-5 text-green-600" />
                Daily Verse
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col justify-center">
              <p className="text-base sm:text-lg font-medium italic mb-2 text-gray-800 leading-snug">"{dailyVerse.verse}"</p>
              <p className="text-xs sm:text-sm font-bold text-green-700 uppercase tracking-wider">— {dailyVerse.reference}</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ROW 2: Personal Milestones & Upcoming Events (Taller Cards) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Exams & Milestones */}
        <div className="lg:col-span-2">
          {activeBook ? (
            <Card className={`border-green-200 shadow-sm h-full flex flex-col ${bookGrade ? "bg-gradient-to-br from-green-50 to-white" : ""}`}>
              <CardHeader className="border-b border-gray-100 bg-white/50 pb-4">
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-xl text-green-900">
                      <BookMarked className="w-6 h-6 text-green-600" />
                      Current Study: {activeBook.title}
                    </CardTitle>
                    <CardDescription className="font-medium mt-1 text-green-700">Track your major milestones for this season</CardDescription>
                  </div>
                  {bookGrade && (
                    <div className="text-right">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-green-600">Final Grade</p>
                      <p className="text-4xl font-black text-green-700">{bookGrade.final_score}%</p>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-6 flex-1 flex flex-col">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  {/* Midterm Status */}
                  <div className={`p-5 rounded-xl border flex items-center justify-between ${milestones.midterm.score !== null ? "bg-green-50 border-green-200" : "bg-gray-50 border-gray-200"}`}>
                    <div>
                      <p className="font-bold text-gray-900">Midterm Exam</p>
                      {milestones.midterm.published ? (
                        milestones.midterm.score !== null ? (
                          <p className="text-sm text-green-700 font-medium mt-1">Completed: {milestones.midterm.score}%</p>
                        ) : (
                          <p className="text-sm text-amber-600 font-medium mt-1">Unlocked - Go to Quizzes!</p>
                        )
                      ) : (
                        <p className="text-sm text-gray-500 mt-1">Not published yet</p>
                      )}
                    </div>
                    {milestones.midterm.score !== null ? <CheckCircle className="w-8 h-8 text-green-500" /> : milestones.midterm.published ? <Unlock className="w-8 h-8 text-amber-500" /> : <Lock className="w-8 h-8 text-gray-300" />}
                  </div>

                  {/* Final Status */}
                  <div className={`p-5 rounded-xl border flex items-center justify-between ${milestones.final.score !== null ? "bg-green-50 border-green-200" : "bg-gray-50 border-gray-200"}`}>
                    <div>
                      <p className="font-bold text-gray-900">Final Exam</p>
                      {milestones.final.published ? (
                        milestones.final.score !== null ? (
                          <p className="text-sm text-green-700 font-medium mt-1">Completed: {milestones.final.score}%</p>
                        ) : (
                          <p className="text-sm text-amber-600 font-medium mt-1">Unlocked - Go to Quizzes!</p>
                        )
                      ) : (
                        <p className="text-sm text-gray-500 mt-1">Not published yet</p>
                      )}
                    </div>
                    {milestones.final.score !== null ? <Trophy className="w-8 h-8 text-green-500" /> : milestones.final.published ? <Unlock className="w-8 h-8 text-amber-500" /> : <Lock className="w-8 h-8 text-gray-300" />}
                  </div>
                </div>

                {!bookGrade && (
                  <Button 
                    onClick={handleDeclareFinished}
                    disabled={isGrading || milestones.final.score === null}
                    className={`w-full h-auto mt-auto py-4 sm:py-6 px-4 text-sm sm:text-base md:text-lg whitespace-normal text-center font-bold shadow-md ${milestones.final.score !== null ? "bg-green-600 hover:bg-green-700 animate-pulse" : "bg-gray-200 text-gray-500 hover:bg-gray-200 cursor-not-allowed"}`}
                  >
                    {isGrading ? <Loader2 className="w-5 h-5 animate-spin" /> : milestones.final.score !== null ? "Declare Book Finished & Calculate Final Grade!" : "Complete the Final Exam to unlock Final Grade"}
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="h-full flex items-center justify-center p-6 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 text-gray-400 font-medium">
              No Active Study Season right now.
            </div>
          )}
        </div>

        {/* Full Card Events */}
        <div className="lg:col-span-1">
          <Card className="border-green-200 shadow-sm h-full flex flex-col bg-gray-50/30">
            <CardHeader className="pb-3 border-b border-gray-100 bg-white rounded-t-xl flex-none">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Calendar className="w-5 h-5 text-green-600" />
                Upcoming Events
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 flex-1 overflow-y-auto space-y-4">
              {upcomingEvents.length > 0 ? (
                upcomingEvents.map(event => {
                  const eventDate = new Date(event.event_date);
                  return (
                    <div key={event.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:border-green-300 transition-all hover:shadow-md group overflow-hidden flex flex-col">
                      
                        {/* Full Width Image or Fallback Header */}
                        {event.image_url ? (
                          <div className="w-full h-36 relative overflow-hidden bg-gray-100 border-b border-gray-100">
                            <img src={event.image_url} alt={event.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                            {/* Date Badge over image */}
                            <div className="absolute top-2 right-2 bg-white/95 backdrop-blur-sm px-3 py-1.5 rounded-lg text-center shadow-sm border border-white/20">
                              <p className="text-[10px] font-bold text-green-700 uppercase leading-none mb-0.5">{eventDate.toLocaleDateString('en-US', { month: 'short' })}</p>
                              <p className="text-lg font-black text-gray-900 leading-none">{eventDate.getDate()}</p>
                            </div>
                          </div>
                        ) : (
                          <div className="w-full h-24 bg-gradient-to-br from-green-50 to-green-100 flex items-center justify-center border-b border-green-100 relative">
                             <div className="bg-white px-5 py-2.5 rounded-xl text-center shadow-sm border border-green-50">
                               <p className="text-xs font-bold text-green-700 uppercase mb-0.5">{eventDate.toLocaleDateString('en-US', { month: 'short' })}</p>
                               <p className="text-2xl font-black text-gray-900 leading-none">{eventDate.getDate()}</p>
                             </div>
                          </div>
                        )}

                        <div className="p-4 flex flex-col flex-1">
                          <h4 className="font-bold text-gray-900 text-lg mb-1.5 group-hover:text-green-700 transition-colors leading-tight">
                            {event.title}
                          </h4>
                          
                          {event.description && (
                            <p className="text-xs text-gray-500 mb-4 line-clamp-2 leading-relaxed">
                              {event.description}
                            </p>
                          )}
                          
                          <div className="mt-auto pt-2 border-t border-gray-50">
                            {/* Wide Map Button */}
                            {event.location && (
                              <a 
                                href={event.location.startsWith('http') ? event.location : `https://maps.google.com/?q=${event.location}`} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="flex items-center justify-center gap-2 w-full bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white text-sm font-bold py-2.5 rounded-xl transition-all border border-blue-100 hover:border-blue-600"
                              >
                                <MapPin className="w-4 h-4" /> Open in Maps
                              </a>
                            )}
                          </div>
                        </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-10 bg-white rounded-xl border border-dashed border-gray-200">
                  <p className="text-gray-400 italic text-sm">No upcoming events right now.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-green-100 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Reading Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-3xl font-black text-gray-900">{stats.completedReadings}<span className="text-lg text-gray-400">/{stats.totalReadings}</span></p>
                <p className="text-[10px] font-medium text-muted-foreground mt-1 uppercase">Chapters completed</p>
              </div>
              <BookOpen className="w-8 h-8 text-green-200" />
            </div>
            <Progress value={stats.totalReadings > 0 ? (stats.completedReadings / stats.totalReadings) * 100 : 0} className="mt-4 bg-green-50" />
          </CardContent>
        </Card>

        <Card className="border-green-100 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Read Alouds</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-3xl font-black text-gray-900">{stats.voiceRecordings}</p>
                <p className="text-[10px] font-medium text-muted-foreground mt-1 uppercase">Sessions done</p>
              </div>
              <Mic className="w-8 h-8 text-green-200" />
            </div>
            <Progress value={stats.totalReadings > 0 ? (stats.voiceRecordings / stats.totalReadings) * 100 : 0} className="mt-4 bg-green-50" />
          </CardContent>
        </Card>

        <Card className="border-green-100 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Quiz Avg.</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-3xl font-black text-gray-900">{stats.averageScore}%</p>
                <p className="text-[10px] font-medium text-muted-foreground mt-1 uppercase">Weekly Average</p>
              </div>
              <Award className="w-8 h-8 text-green-200" />
            </div>
            <Progress value={stats.averageScore} className="mt-4 bg-green-50" />
          </CardContent>
        </Card>

        <Card className="border-green-100 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Attendance Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-3xl font-black text-gray-900">{stats.attendanceRate}%</p>
                <p className="text-[10px] font-medium text-muted-foreground mt-1 uppercase">Overall</p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-200" />
            </div>
            <Progress value={stats.attendanceRate} className="mt-4 bg-green-50" />
          </CardContent>
        </Card>
      </div>

      {/* Charts & Q&A */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-green-100 shadow-sm">
          <CardHeader>
            <CardTitle>Saturday Gathering Attendance</CardTitle>
            <CardDescription>Your attendance record</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-center">
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={attendanceData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {attendanceData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === 0 ? "#22c55e" : "#f3f4f6"} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-green-100 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-green-600" />
              Ask a Question
            </CardTitle>
            <CardDescription>
              Have questions or doubts? Ask the admin for guidance.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="Type your question here..."
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              rows={5}
              className="resize-none border-gray-200 focus-visible:ring-green-500 rounded-xl"
            />
            <Button 
              onClick={handleSubmitQuestion} 
              disabled={!question.trim() || isSubmitting}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl shadow-md shadow-green-100"
            >
              {isSubmitting ? "Sending..." : "Submit Question"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}