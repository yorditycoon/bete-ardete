import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { Progress } from "../components/ui/progress";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { 
  BookOpen, Calendar, MessageSquare,
  Award, Loader2, Users, MapPin, CheckSquare, UserCheck, GraduationCap, Clock, BookText, BookMarked, Unlock, Lock, Trophy, CheckCircle
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router";

// --- IMPORT EMBEDDED WORKSPACES ---
import { EducationWorkspace } from "./education-workspace";
import { FinanceWorkspace } from "./finance-workspace";
import { MediaWorkspace } from "./media-workspace";
import { SaturdayWorkspace } from "./saturday-workspace";
import { RelationWorkspace } from "./relation-workspace";
import { LeadershipWorkspace } from "./leadership-workspace";

export function MemberDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [question, setQuestion] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [familyName, setFamilyName] = useState<string>(""); 
  
  // Real Data States
  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);
  const [stats, setStats] = useState({ completedReadings: 0, totalReadings: 0, averageScore: 0, attendanceRate: 0 });
  
  // Real Active Book & Milestone Locking States
  const [isGrading, setIsGrading] = useState(false);
  const [activeBook, setActiveBook] = useState<any>(null);
  const [bookGrade, setBookGrade] = useState<any>(null);
  const [milestones, setMilestones] = useState({ 
    midterm: { published: false, score: null as number | null }, 
    final: { published: false, score: null as number | null }, 
    avgWeeklyQuiz: 0 
  });
  
  const dailyVerse = { verse: "For I know the plans I have for you, declares the Lord, plans for welfare and not for evil, to give you a future and a hope.", reference: "Jeremiah 29:11" };

  useEffect(() => {
    loadMemberData();
    // Realtime Listener
    const channel = supabase.channel('member-dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public' }, () => { loadMemberData(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  async function loadMemberData() {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return navigate("/");

      const { data: profile } = await supabase.from('profiles').select('*, departments(name_en)').eq('id', user.id).single();
      setCurrentUser(profile);

      if (profile?.family_id) {
        const { data: familyData } = await supabase.from('families').select('name').eq('id', profile.family_id).single();
        if (familyData) setFamilyName(familyData.name);
      }
      
      const today = new Date().toISOString().split('T')[0];
      const { data: events } = await supabase.from('events').select('*').gte('event_date', today).order('event_date', { ascending: true }).limit(3);
      if (events) setUpcomingEvents(events);

      const { data: attData } = await supabase.from('attendance').select('present').eq('user_id', user.id);
      let myAttendanceRate = 0;
      if (attData && attData.length > 0) {
        const present = attData.filter(a => a.present).length;
        myAttendanceRate = Math.round((present / attData.length) * 100);
      }

      // --- DYNAMIC STUDY BOOK & LOCKING LOGIC ---
      const { data: book } = await supabase.from('study_books').select('*').eq('status', 'active').order('created_at', { ascending: false }).limit(1).maybeSingle();
      setActiveBook(book);

      if (book) {
        const { data: gradeData } = await supabase.from('book_grades').select('*').eq('user_id', user.id).eq('book_id', book.id).maybeSingle();
        if (gradeData) setBookGrade(gradeData);

        const { data: assignments } = await supabase.from('assignments').select('id').eq('book_id', book.id);
        const assignmentIds = assignments?.map(a => a.id) || [];
        const { data: readings } = await supabase.from('reading_progress').select('*').eq('user_id', user.id);
        
        const completedReadings = (readings?.filter(r => assignmentIds.includes(r.reading_id)) || []).filter(r => r.is_completed).length;
        const totalReadings = assignmentIds.length || 1;

        const { data: bookQuizzes } = await supabase.from('quizzes').select('id, quiz_type').eq('book_id', book.id);
        const { data: allUserScores } = await supabase.from('quiz_scores').select('quiz_id, score').eq('user_id', user.id);

        const midtermQuiz = bookQuizzes?.find(q => q.quiz_type === 'midterm');
        const finalQuiz = bookQuizzes?.find(q => q.quiz_type === 'final');
        const weeklyQuizzes = bookQuizzes?.filter(q => q.quiz_type === 'weekly') || [];

        const weeklyScores = allUserScores?.filter(s => weeklyQuizzes.map(wq => wq.id).includes(s.quiz_id)) || [];
        const avgWeekly = weeklyScores.length > 0 ? Math.round(weeklyScores.reduce((a, b) => a + b.score, 0) / weeklyScores.length) : 0;

        setMilestones({
          midterm: { published: !!midtermQuiz, score: midtermQuiz ? allUserScores?.find(s => s.quiz_id === midtermQuiz.id)?.score ?? null : null },
          final: { published: !!finalQuiz, score: finalQuiz ? allUserScores?.find(s => s.quiz_id === finalQuiz.id)?.score ?? null : null },
          avgWeeklyQuiz: avgWeekly
        });

        setStats({ completedReadings, totalReadings, averageScore: avgWeekly, attendanceRate: myAttendanceRate });
      } else {
        setStats({ completedReadings: 0, totalReadings: 0, averageScore: 0, attendanceRate: myAttendanceRate });
      }

    } catch (error: any) {
      toast.error("Error loading dashboard data");
    } finally {
      setLoading(false);
    }
  }

  const handleDeclareFinished = async () => {
    if (!activeBook || !currentUser) return;
    if (milestones.final.score === null) return toast.error("You must complete the Final Exam before declaring the book finished!");

    setIsGrading(true);
    try {
      const grandTotal = Math.round(
        (stats.totalReadings > 0 ? (stats.completedReadings / stats.totalReadings) * 20 : 20) +
        (milestones.avgWeeklyQuiz / 100) * 20 +
        ((milestones.midterm.score || 0) / 100) * 25 +
        ((milestones.final.score || 0) / 100) * 35
      );

      const { data, error } = await supabase.from('book_grades').insert({ 
        user_id: currentUser.id, 
        family_id: currentUser.family_id || null, 
        book_id: activeBook.id, 
        final_score: grandTotal 
      }).select().single();
      
      if (error) throw error;

      setBookGrade(data);
      toast.success(`Finished ${activeBook.title} with a score of ${grandTotal}%!`);
    } catch (err: any) { 
      toast.error(err.message); 
    } finally { 
      setIsGrading(false); 
    }
  };

  const handleSubmitQuestion = async () => {
    if (!question.trim() || !currentUser) return;
    setIsSubmitting(true);
    await supabase.from('anoquestions').insert({ user_id: currentUser.id, user_name: "Anonymous", question: question.trim() });
    toast.success("Question submitted successfully!");
    setQuestion("");
    setIsSubmitting(false);
  };

  if (loading) return <div className="flex h-[60vh] justify-center items-center"><Loader2 className="w-8 h-8 animate-spin text-green-600" /></div>;

  const departmentName = currentUser?.departments?.name_en;
  const isDeptHead = currentUser?.department_role === 'head' || currentUser?.department_role === 'deputy' || currentUser?.department_role === 'secretary';

  // --- REUSABLE PERSONAL DASHBOARD COMPONENT ---
  const personalDashboardContent = (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Top Quick Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <Card className="border-green-200 shadow-sm bg-white rounded-3xl hover:shadow-md transition-all">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] sm:text-xs font-semibold uppercase text-gray-500 tracking-wider">Readings</p>
                <p className="text-2xl sm:text-3xl font-bold text-black mt-2">{stats.completedReadings}<span className="text-lg text-gray-400">/{stats.totalReadings}</span></p>
              </div>
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-green-50 flex items-center justify-center shrink-0 border border-green-100">
                <BookOpen className="w-5 h-5 text-green-600" />
              </div>
            </div>
            <Progress value={(stats.totalReadings > 0 ? (stats.completedReadings/stats.totalReadings)*100 : 0)} className="mt-5 bg-gray-100 h-1.5" />
          </CardContent>
        </Card>

        <Card className="border-green-200 shadow-sm bg-white rounded-3xl hover:shadow-md transition-all">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] sm:text-xs font-semibold uppercase text-gray-500 tracking-wider">Quiz Average</p>
                <p className="text-2xl sm:text-3xl font-bold text-black mt-2">{stats.averageScore}%</p>
              </div>
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-green-50 flex items-center justify-center shrink-0 border border-green-100">
                <Award className="w-5 h-5 text-green-600" />
              </div>
            </div>
            <Progress value={stats.averageScore} className="mt-5 bg-gray-100 h-1.5" />
          </CardContent>
        </Card>

        <Card className="border-green-200 shadow-sm bg-white rounded-3xl hover:shadow-md transition-all">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] sm:text-xs font-semibold uppercase text-gray-500 tracking-wider">My Attendance</p>
                <p className="text-2xl sm:text-3xl font-bold text-black mt-2">{stats.attendanceRate}%</p>
              </div>
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-green-50 flex items-center justify-center shrink-0 border border-green-100">
                <UserCheck className="w-5 h-5 text-green-600" />
              </div>
            </div>
            <Progress value={stats.attendanceRate} className="mt-5 bg-gray-100 h-1.5" />
          </CardContent>
        </Card>
      </div>
      
      {/* 2-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        
        {/* LEFT COLUMN: Midterm/Final Exams & Questions */}
        <div className="space-y-6">

          {/* DYNAMIC Study Progress (Midterm & Final) */}
          {activeBook && (
            <Card className={`border-green-200 shadow-sm bg-white rounded-3xl overflow-hidden ${bookGrade ? "bg-gradient-to-br from-green-50/50 to-white" : ""}`}>
              <CardHeader className="p-6 border-b border-gray-100 bg-gray-50/50">
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-lg text-black font-bold">
                      <BookMarked className="w-5 h-5 text-green-600" /> My Study: {activeBook.title}
                    </CardTitle>
                    <CardDescription className="text-sm mt-1">Track your personal milestones</CardDescription>
                  </div>
                  {bookGrade && (
                    <div className="text-right">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-green-600">Final Grade</p>
                      <p className="text-2xl sm:text-3xl font-bold text-black">{bookGrade.final_score}%</p>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
                  {/* Midterm Status */}
                  <div className={`p-4 rounded-2xl border flex items-center justify-between ${milestones.midterm.score !== null ? "bg-green-50/50 border-green-200" : "bg-gray-50 border-gray-100"} shadow-sm transition-all`}>
                    <div>
                      <p className="text-sm font-semibold text-black">Midterm Exam</p>
                      {milestones.midterm.published ? (
                        milestones.midterm.score !== null ? (
                          <p className="text-xs text-green-700 font-medium mt-1">Completed: {milestones.midterm.score}%</p>
                        ) : (
                          <p className="text-xs text-green-600 font-medium mt-1">Unlocked - Go to Quizzes!</p>
                        )
                      ) : (
                        <p className="text-xs text-gray-400 mt-1">Not published yet</p>
                      )}
                    </div>
                    {milestones.midterm.score !== null ? <CheckCircle className="w-6 h-6 text-green-600 shrink-0" /> : milestones.midterm.published ? <Unlock className="w-6 h-6 text-green-600 shrink-0" /> : <Lock className="w-6 h-6 text-gray-300 shrink-0" />}
                  </div>
                  
                  {/* Final Exam Status */}
                  <div className={`p-4 rounded-2xl border flex items-center justify-between ${milestones.final.score !== null ? "bg-green-50/50 border-green-200" : "bg-gray-50 border-gray-100"} shadow-sm transition-all`}>
                    <div>
                      <p className="text-sm font-semibold text-black">Final Exam</p>
                      {milestones.final.published ? (
                        milestones.final.score !== null ? (
                          <p className="text-xs text-green-700 font-medium mt-1">Completed: {milestones.final.score}%</p>
                        ) : (
                          <p className="text-xs text-green-600 font-medium mt-1">Unlocked - Go to Quizzes!</p>
                        )
                      ) : (
                        <p className="text-xs text-gray-400 mt-1">Not published yet</p>
                      )}
                    </div>
                    {milestones.final.score !== null ? <Trophy className="w-6 h-6 text-green-600 shrink-0" /> : milestones.final.published ? <Unlock className="w-6 h-6 text-green-600 shrink-0" /> : <Lock className="w-6 h-6 text-gray-300 shrink-0" />}
                  </div>
                </div>

                {/* Calculate Grade Button */}
                {!bookGrade && (
                  <Button onClick={handleDeclareFinished} disabled={isGrading || milestones.final.score === null} className={`w-full py-5 font-semibold shadow-sm rounded-xl transition-all ${milestones.final.score !== null ? "bg-green-600 hover:bg-green-700 text-white animate-pulse" : "bg-gray-100 text-gray-400 cursor-not-allowed"}`}>
                    {isGrading ? <Loader2 className="w-4 h-4 animate-spin" /> : milestones.final.score !== null ? "Declare Book Finished & Calculate Final Grade!" : "Complete Final Exam to unlock Grade"}
                  </Button>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3 pt-2">
                  <Button onClick={() => navigate("/app/bible-reading")} className="flex-1 bg-black hover:bg-gray-800 text-white font-medium rounded-xl h-10 transition-all shadow-sm text-xs sm:text-sm">
                    <BookOpen className="w-4 h-4 mr-2" /> Study Materials
                  </Button>
                  <Button onClick={() => navigate("/app/quiz")} variant="outline" className="flex-1 border-gray-200 text-gray-700 font-medium rounded-xl h-10 hover:bg-gray-50 transition-all shadow-sm text-xs sm:text-sm">
                    <CheckSquare className="w-4 h-4 mr-2" /> Practice Quizzes
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Ask a Question Card */}
          <Card className="border-green-200 shadow-sm bg-white rounded-3xl overflow-hidden">
            <CardHeader className="p-6 border-b border-gray-100 bg-gray-50/50">
              <CardTitle className="flex items-center gap-2 text-lg text-black font-bold">
                <MessageSquare className="w-5 h-5 text-green-600" /> Ask a Question
              </CardTitle>
              <CardDescription className="text-sm mt-1">Submit anonymous questions to church leadership or the education team.</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <Textarea
                placeholder="What's on your mind? (Completely anonymous)"
                className="resize-none h-28 border-gray-200 focus-visible:ring-green-500 rounded-2xl text-sm p-4 shadow-sm"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
              />
              <div className="flex justify-end">
                <Button 
                  onClick={handleSubmitQuestion} 
                  disabled={isSubmitting || !question.trim()}
                  className="w-full sm:w-auto px-6 bg-green-600 hover:bg-green-700 text-white font-medium h-10 rounded-xl shadow-sm transition-all"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  {isSubmitting ? "Submitting..." : "Submit Anonymously"}
                </Button>
              </div>
            </CardContent>
          </Card>

        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-6">
          
          {/* Upcoming Events Feed */}
          <Card className="border-green-200 shadow-sm bg-white rounded-3xl flex flex-col h-full overflow-hidden">
            <CardHeader className="p-6 border-b border-gray-100 bg-gray-50/50">
              <CardTitle className="flex items-center gap-2 text-lg text-black font-bold">
                <Calendar className="w-5 h-5 text-green-600" /> Upcoming Gatherings
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 flex-1 overflow-y-auto space-y-4 custom-scrollbar">
              {upcomingEvents.length > 0 ? (
                upcomingEvents.map(event => {
                  const eventDate = new Date(event.event_date);
                  return (
                    <div key={event.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:border-green-200 transition-all flex flex-col sm:flex-row overflow-hidden group">
                      {event.image_url ? (
                        <div className="w-full sm:w-32 h-32 sm:h-auto relative overflow-hidden bg-gray-100 shrink-0">
                          <img src={event.image_url} alt={event.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                          <div className="absolute top-2 right-2 sm:hidden bg-white/95 px-2.5 py-1 rounded-xl text-center shadow-sm">
                            <p className="text-[10px] font-semibold text-green-700 uppercase leading-none mb-1">{eventDate.toLocaleDateString('en-US', { month: 'short' })}</p>
                            <p className="text-sm font-bold leading-none">{eventDate.getDate()}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="w-full sm:w-32 h-16 sm:h-auto bg-green-50/50 flex items-center justify-center border-b sm:border-b-0 sm:border-r border-gray-100 shrink-0 p-3">
                          <div className="bg-white px-3 py-2 rounded-xl shadow-sm text-center border border-gray-100 w-full sm:w-auto">
                            <p className="text-[10px] font-semibold text-green-700 uppercase leading-none mb-1">{eventDate.toLocaleDateString('en-US', { month: 'short' })}</p>
                            <p className="text-lg font-bold leading-none">{eventDate.getDate()}</p>
                          </div>
                        </div>
                      )}
                      <div className="p-4 flex flex-col flex-1 min-w-0">
                        <h4 className="font-bold text-black text-sm sm:text-base mb-1.5 truncate">{event.title}</h4>
                        {event.description && <p className="text-xs text-gray-500 mb-3 line-clamp-2 leading-relaxed">{event.description}</p>}
                        <div className="mt-auto pt-3 border-t border-gray-50">
                          {event.location && (
                            <a href={event.location.startsWith('http') ? event.location : `https://maps.google.com/?q=${event.location}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 w-full bg-gray-50 hover:bg-green-50 text-gray-600 hover:text-green-700 text-xs font-medium py-2 rounded-lg transition-colors border border-gray-100">
                              <MapPin className="w-3.5 h-3.5" /> View Location Map
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-10 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                  <Calendar className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-500 font-medium text-sm">No upcoming events right now.</p>
                </div>
              )}
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-in fade-in duration-500">
      
      {/* SEPARATED WELCOME BANNER & DAILY VERSE CARDS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT: Profile & Welcome Card */}
        <div className="lg:col-span-2 bg-white rounded-3xl p-6 sm:p-8 border border-green-200 shadow-sm flex flex-col sm:flex-row items-center sm:items-start lg:items-center gap-5 w-full">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-green-50 border-2 border-green-100 flex items-center justify-center shrink-0">
            <span className="text-2xl sm:text-3xl font-bold text-green-700">{currentUser?.name?.charAt(0).toUpperCase()}</span>
          </div>
          <div className="w-full min-w-0 text-center sm:text-left">
            <h2 className="text-xl sm:text-2xl font-bold text-black truncate">Welcome, {currentUser?.name?.split(' ')[0]}</h2>
            <div className="flex flex-wrap justify-center sm:justify-start gap-2 mt-2 sm:mt-3">
              <Badge className="bg-black text-white border-none px-2.5 py-1 font-medium shadow-none rounded-lg text-xs">Member</Badge>
              {departmentName && <Badge variant="outline" className="bg-green-50 text-green-800 border-green-200 font-medium rounded-lg text-xs px-2.5 py-1 truncate">{departmentName} Dept</Badge>}
              {isDeptHead && <Badge className="bg-green-600 text-white border-none capitalize font-medium rounded-lg text-xs px-2.5 py-1">{currentUser?.department_role?.replace('_', ' ')}</Badge>}
              {familyName && (
                <Badge variant="outline" className="border-gray-200 text-gray-700 bg-gray-50 font-medium rounded-lg text-xs px-2.5 py-1 shadow-sm truncate">
                  <Users className="w-3.5 h-3.5 mr-1.5 text-green-600 shrink-0" /> {familyName} Family
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT: Daily Verse Card */}
        <Card className="lg:col-span-1 bg-white rounded-3xl border border-green-200 shadow-sm relative overflow-hidden flex flex-col justify-center">
          <div className="absolute left-0 top-0 w-1.5 h-full bg-green-500"></div>
          <CardContent className="p-6">
            <p className="text-[10px] sm:text-xs font-semibold text-green-700 uppercase tracking-widest mb-2 flex items-center gap-2">
              <BookText className="w-4 h-4" /> Verse of the Day
            </p>
            <p className="text-sm font-semibold text-gray-800 leading-relaxed italic mb-2">"{dailyVerse.verse}"</p>
            <p className="text-xs font-medium text-gray-500">— {dailyVerse.reference}</p>
          </CardContent>
        </Card>

      </div>

      {/* DUAL DASHBOARD TABS */}
      {departmentName ? (
       <Tabs defaultValue="family" className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-green-50 p-1.5 sm:p-2 rounded-2xl mb-8 border border-green-100 h-auto shadow-inner">
            <TabsTrigger value="family" className="font-medium text-xs sm:text-sm md:text-base px-2 py-2.5 sm:py-3 text-center truncate data-[state=active]:bg-white data-[state=active]:text-black shadow-sm rounded-xl">
              Personal Dashboard
            </TabsTrigger>
            <TabsTrigger value="department" className="font-medium text-xs sm:text-sm md:text-base px-2 py-2.5 sm:py-3 text-center truncate data-[state=active]:bg-black data-[state=active]:text-white shadow-sm rounded-xl">
              Department Workspace
            </TabsTrigger>
          </TabsList>

          <TabsContent value="family" className="space-y-6 animate-in fade-in duration-500">
            {personalDashboardContent}
          </TabsContent>

          <TabsContent value="department" className="animate-in fade-in duration-500">
            {departmentName.includes("Education") && <EducationWorkspace />}
            {departmentName.includes("Finance") && <FinanceWorkspace />}
            {departmentName.includes("Media") && <MediaWorkspace />}
            {departmentName.includes("Saturday") && <SaturdayWorkspace />}
            {departmentName.includes("Relation") && <RelationWorkspace />}

            {(departmentName?.includes("Executive") || 
              departmentName?.includes("Leadership") || 
              departmentName?.includes("Secretarial") || 
              currentUser?.role === 'admin') && (
              <div className="mt-10 pt-8 border-t border-gray-200">
                <LeadershipWorkspace />
              </div>
            )}
          </TabsContent>
        </Tabs>
      ) : (
        personalDashboardContent
      )}
    </div>
  );
}