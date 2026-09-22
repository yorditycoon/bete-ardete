import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { Textarea } from "../components/ui/textarea";
import { Progress } from "../components/ui/progress";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Label } from "../components/ui/label";
import { 
  Users, UserPlus, Loader2, Calendar, BookMarked, CheckCircle, 
  Unlock, Lock, Trophy, BookOpen, Trash2, MapPin, MessageSquare, 
  UserCheck, Shield, BookText, Send, Bell, Check, CheckCheck,
  ChevronDown, ChevronUp
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { createClient } from "@supabase/supabase-js";
import { supabase, supabaseUrl, supabaseAnonKey } from "../lib/supabase"; 

// --- IMPORT EMBEDDED WORKSPACES ---
import { EducationWorkspace } from "./education-workspace";
import { FinanceWorkspace } from "./finance-workspace";
import { MediaWorkspace } from "./media-workspace";
import { SaturdayWorkspace } from "./saturday-workspace";
import { RelationWorkspace }  from "./relation-workspace";
import { LeadershipWorkspace } from "./leadership-workspace";

interface FamilyMember { id: string; name: string; email: string; role: string; }

export function ParentDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [familyName, setFamilyName] = useState<string>("Your Family"); 
  
  const [isRegistering, setIsRegistering] = useState(false);
  const [isAddChildOpen, setIsAddChildOpen] = useState(false);
  const [newMember, setNewMember] = useState({ name: "", email: "", password: "" });

  // --- FAMILY MESSAGE & RECEIPT STATES ---
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
  const [isSendingMsg, setIsSendingMsg] = useState(false);
  const [msgData, setMsgData] = useState({ title: "", text: "", recipient: "all" });
  const [sentAlerts, setSentAlerts] = useState<any[]>([]);
  const [expandedMsgId, setExpandedMsgId] = useState<string | null>(null);

  const [question, setQuestion] = useState("");
  const [isSubmittingQuestion, setIsSubmittingQuestion] = useState(false);
  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);
  const dailyVerse = { verse: "Train up a child in the way he should go; even when he is old he will not depart from it.", reference: "Proverbs 22:6" };

  const [isGrading, setIsGrading] = useState(false);
  const [activeBook, setActiveBook] = useState<any>(null);
  const [bookGrade, setBookGrade] = useState<any>(null);
  const [parentStats, setParentStats] = useState({ completedReadings: 0, totalReadings: 0 });
  const [attendanceRate, setAttendanceRate] = useState(0); 
  const [milestones, setMilestones] = useState({ midterm: { published: false, score: null as number | null }, final: { published: false, score: null as number | null }, avgWeeklyQuiz: 0 });

  useEffect(() => {
    loadParentData(true); 
    const channel = supabase.channel('parent-dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public' }, () => { 
        loadParentData(false); 
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleDeleteMember = async (memberId: string, name: string, e?: React.SyntheticEvent) => {
    if (e) e.preventDefault();
    if (memberId === currentUser?.id) return toast.error("You cannot delete your own account from here.");
    if (!window.confirm(`Are you sure you want to remove ${name}?`)) return;
    try {
      const { error } = await supabase.from('profiles').delete().eq('id', memberId);
      if (error) throw error;
      toast.success(`${name} removed.`);
      setFamilyMembers(prev => prev.filter(m => m.id !== memberId));
      setChartData(prev => prev.filter(d => !d.name.startsWith(name.split(' ')[0])));
    } catch (err: any) { toast.error(err.message); }
  };

  async function loadParentData(isInitial = false) {
    try {
      if (isInitial) setLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/"); return; }
      
      const { data: profile } = await supabase.from('profiles').select('*, departments(name_en)').eq('id', user.id).single();
      setCurrentUser(profile);

      const today = new Date().toISOString().split('T')[0];
      const { data: events } = await supabase.from('events').select('*').gte('event_date', today).order('event_date', { ascending: true }).limit(3);
      if (events) setUpcomingEvents(events);

      const { data: attData } = await supabase.from('attendance').select('present').eq('user_id', user.id);
      if (attData && attData.length > 0) {
        const present = attData.filter(a => a.present).length;
        setAttendanceRate(Math.round((present / attData.length) * 100));
      }

      const { data: book } = await supabase.from('study_books').select('*').eq('status', 'active').order('created_at', { ascending: false }).limit(1).maybeSingle();
      setActiveBook(book);

      if (profile?.family_id) {
        setFamilyId(profile.family_id);
        const { data: familyData } = await supabase.from('families').select('name').eq('id', profile.family_id).single();
        if (familyData) setFamilyName(familyData.name);

        const { data: members } = await supabase.from('profiles').select('id, name, email, role').eq('family_id', profile.family_id).order('role', { ascending: false }); 
        const list = members || [];
        setFamilyMembers(list);

        if (book && list.length > 0) {
          const memberIds = list.map(m => m.id);
          const [ { data: assignments }, { data: quizzes }, { data: alerts } ] = await Promise.all([
            supabase.from('assignments').select('id').eq('book_id', book.id),
            supabase.from('quizzes').select('id').eq('book_id', book.id),
            supabase.from('notifications').select('id, user_id, title, message, is_read, created_at').eq('type', 'family_alert').in('user_id', memberIds).order('created_at', { ascending: false })
          ]);
          
          if (alerts) setSentAlerts(alerts);
          const assignmentIds = assignments?.map(a => a.id) || [];
          const quizIds = quizzes?.map(q => q.id) || [];

          const [ { data: familyReadings }, { data: familyScores } ] = await Promise.all([
            supabase.from('reading_progress').select('user_id').in('user_id', memberIds).eq('is_completed', true).in('reading_id', assignmentIds),
            supabase.from('quiz_scores').select('user_id').in('user_id', memberIds).in('quiz_id', quizIds)
          ]);

          setChartData(list.map(member => ({
            name: member.name.split(' ')[0] + (member.role === 'parent' ? " (P)" : ""), 
            readings: familyReadings?.filter(r => r.user_id === member.id).length || 0,
            quizzes: familyScores?.filter(s => s.user_id === member.id).length || 0,
          })));
        } else { setChartData(list.map(m => ({ name: m.name.split(' ')[0], readings: 0, quizzes: 0 }))); }
      }

      if (book) {
        const { data: gradeData } = await supabase.from('book_grades').select('*').eq('user_id', user.id).eq('book_id', book.id).maybeSingle();
        if (gradeData) setBookGrade(gradeData);

        const { data: assignments } = await supabase.from('assignments').select('id').eq('book_id', book.id);
        const assignmentIds = assignments?.map(a => a.id) || [];
        const { data: readings } = await supabase.from('reading_progress').select('*').eq('user_id', user.id);
        
        setParentStats({
          completedReadings: (readings?.filter(r => assignmentIds.includes(r.reading_id)) || []).filter(r => r.is_completed).length,
          totalReadings: assignmentIds.length || 1
        });

        const { data: bookQuizzes } = await supabase.from('quizzes').select('id, quiz_type').eq('book_id', book.id);
        const { data: allUserScores } = await supabase.from('quiz_scores').select('quiz_id, score').eq('user_id', user.id);

        const midtermQuiz = bookQuizzes?.find(q => q.quiz_type === 'midterm');
        const finalQuiz = bookQuizzes?.find(q => q.quiz_type === 'final');
        const weeklyQuizzes = bookQuizzes?.filter(q => q.quiz_type === 'weekly') || [];

        const weeklyScores = allUserScores?.filter(s => weeklyQuizzes.map(wq => wq.id).includes(s.quiz_id)) || [];
        setMilestones({
          midterm: { published: !!midtermQuiz, score: midtermQuiz ? allUserScores?.find(s => s.quiz_id === midtermQuiz.id)?.score ?? null : null },
          final: { published: !!finalQuiz, score: finalQuiz ? allUserScores?.find(s => s.quiz_id === finalQuiz.id)?.score ?? null : null },
          avgWeeklyQuiz: weeklyScores.length > 0 ? Math.round(weeklyScores.reduce((a, b) => a + b.score, 0) / weeklyScores.length) : 0
        });
      }

    } catch (error: any) { 
      toast.error(error.message); 
    } finally { 
      if (isInitial) setLoading(false); 
    }
  }

  const handleDeclareFinished = async (e?: React.SyntheticEvent) => {
    if (e) e.preventDefault();
    if (!activeBook || !currentUser) return;
    if (milestones.final.score === null) return toast.error("You must complete the Final Exam before declaring the book finished!");

    setIsGrading(true);
    try {
      const grandTotal = Math.round(
        (parentStats.totalReadings > 0 ? (parentStats.completedReadings / parentStats.totalReadings) * 20 : 20) +
        (milestones.avgWeeklyQuiz / 100) * 20 +
        ((milestones.midterm.score || 0) / 100) * 25 +
        ((milestones.final.score || 0) / 100) * 35
      );

      const { data, error } = await supabase.from('book_grades').insert({ user_id: currentUser.id, family_id: familyId, book_id: activeBook.id, final_score: grandTotal }).select().single();
      if (error) throw error;

      setBookGrade(data);
      toast.success(`Finished ${activeBook.title} with a score of ${grandTotal}%!`);
    } catch (err: any) { toast.error(err.message); } finally { setIsGrading(false); }
  };

  const handleSubmitQuestion = async (e?: React.SyntheticEvent) => {
    if (e) e.preventDefault();
    if (!question.trim() || !currentUser) return;
    setIsSubmittingQuestion(true);
    try {
      const { error } = await supabase.from('anoquestions').insert({ user_id: currentUser.id, user_name: "Anonymous", question: question.trim() });
      if (error) throw error;
      toast.success("Question submitted!");
      setQuestion("");
    } catch (error: any) { toast.error(error.message); } finally { setIsSubmittingQuestion(false); }
  };

  const handleRegisterMember = async (e?: React.SyntheticEvent) => {
    if (e) e.preventDefault();
    if (!newMember.name || !newMember.email || !newMember.password) return toast.error("Fill all fields");
    if (newMember.password.length < 6) return toast.error("Password must be at least 6 characters");
    try {
      setIsRegistering(true);
      const ghostClient = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });
      const { error } = await ghostClient.auth.signUp({ email: newMember.email, password: newMember.password, options: { data: { full_name: newMember.name, family_id: familyId, role: 'member' } } });
      if (error) throw error;
      toast.success("Child account created");
      setNewMember({ name: "", email: "", password: "" }); 
      setIsAddChildOpen(false);
      setTimeout(() => loadParentData(false), 1000); 
    } catch (error: any) { toast.error(error.message); } finally { setIsRegistering(false); }
  };

  const handleSendFamilyMessage = async (e?: React.SyntheticEvent) => {
    if (e) e.preventDefault();
    if (!msgData.title.trim() || !msgData.text.trim()) return toast.error("Title and message are required.");

    setIsSendingMsg(true);
    try {
      const targets = msgData.recipient === "all" 
        ? familyMembers.filter(m => m.id !== currentUser.id)
        : familyMembers.filter(m => m.id === msgData.recipient);

      if (targets.length === 0) throw new Error("No valid family members found to receive this message.");

      // Automatically append the sender's name to the message so receivers know who sent it!
      const messageBody = `${msgData.text}\n\n— Sent by ${currentUser.name}`;

      const notifications = targets.map(child => ({
        user_id: child.id,
        title: msgData.title,
        message: messageBody,
        type: "family_alert",
        link: "/app" 
      }));

      const { error } = await supabase.from('notifications').insert(notifications);
      if (error) throw error;

      toast.success("Message sent to family members!");
      setMsgData({ title: "", text: "", recipient: "all" });
      setExpandedMsgId(null);
      loadParentData(false); // Silent refresh to update the Sent History tab
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSendingMsg(false);
    }
  };

  // Group sent alerts by message content & timestamp to consolidate the read receipts
  const broadcastHistory = Object.values(
    sentAlerts.reduce((acc: any, alert: any) => {
      const key = `${alert.title}_${alert.message.substring(0, 30)}`;
      if (!acc[key]) {
        acc[key] = {
          id: alert.id,
          title: alert.title,
          message: alert.message,
          created_at: alert.created_at,
          recipients: []
        };
      }
      
      const member = familyMembers.find(m => m.id === alert.user_id);
      if (member) acc[key].recipients.push({ name: member.name, is_read: alert.is_read });
      
      return acc;
    }, {})
  ).sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());


  if (loading) return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="animate-spin text-green-600 w-10 h-10" /></div>;

  const departmentName = currentUser?.departments?.name_en;
  const isDeptHead = currentUser?.department_role === 'head' || currentUser?.department_role === 'deputy' || currentUser?.department_role === 'secretary';

  const familyDashboardContent = (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Quick Parent Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <Card className="border-green-200 shadow-sm bg-white rounded-3xl hover:shadow-md transition-all">
          <CardContent className="p-6 flex justify-between items-center">
            <div>
              <p className="text-[10px] font-bold uppercase text-gray-500 tracking-widest">My Attendance</p>
              <p className="text-3xl font-black text-black mt-2">{attendanceRate}%</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-green-50 flex items-center justify-center shrink-0 border border-green-100">
              <UserCheck className="w-6 h-6 text-green-600" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-green-200 shadow-sm cursor-pointer hover:border-green-400 hover:shadow-md transition-all bg-white rounded-3xl" onClick={() => navigate("/app/bible-reading")}>
          <CardContent className="p-6 flex justify-between items-center">
            <div>
              <p className="text-[10px] font-bold uppercase text-gray-500 tracking-widest">My Study Progress</p>
              <p className="text-3xl font-black text-black mt-2">{parentStats.completedReadings}<span className="text-lg text-gray-400">/{parentStats.totalReadings}</span></p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-green-50 flex items-center justify-center shrink-0 border border-green-100">
              <BookOpen className="w-6 h-6 text-green-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {activeBook && (
        <Card className={`border-green-200 shadow-sm rounded-3xl bg-white overflow-hidden ${bookGrade ? "bg-gradient-to-br from-green-50/50 to-white" : ""}`}>
          <CardHeader className="border-b border-gray-100 bg-gray-50/50 p-6 sm:p-8">
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="flex items-center gap-2 text-xl text-black font-black"><BookMarked className="w-6 h-6 text-green-600" /> My Study: {activeBook.title}</CardTitle>
                <CardDescription className="font-medium mt-1 text-gray-500 text-sm">Track your personal milestones</CardDescription>
              </div>
              {bookGrade && (
                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-green-600">Final Grade</p>
                  <p className="text-3xl sm:text-4xl font-black text-black">{bookGrade.final_score}%</p>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-6 sm:p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className={`p-5 rounded-2xl border flex items-center justify-between ${milestones.midterm.score !== null ? "bg-green-50/50 border-green-200" : "bg-gray-50 border-gray-100"} shadow-sm transition-all`}>
                <div>
                  <p className="font-bold text-black text-sm sm:text-base">Midterm Exam</p>
                  {milestones.midterm.published ? (milestones.midterm.score !== null ? <p className="text-xs sm:text-sm text-green-700 font-bold mt-1">Completed: {milestones.midterm.score}%</p> : <p className="text-xs sm:text-sm text-green-600 font-bold mt-1">Unlocked - Go to Quizzes!</p>) : <p className="text-xs text-gray-400 mt-1">Not published yet</p>}
                </div>
                {milestones.midterm.score !== null ? <CheckCircle className="w-6 h-6 sm:w-8 sm:h-8 text-green-600" /> : milestones.midterm.published ? <Unlock className="w-6 h-6 sm:w-8 sm:h-8 text-green-600" /> : <Lock className="w-6 h-6 sm:w-8 sm:h-8 text-gray-300" />}
              </div>
              <div className={`p-5 rounded-2xl border flex items-center justify-between ${milestones.final.score !== null ? "bg-green-50/50 border-green-200" : "bg-gray-50 border-gray-100"} shadow-sm transition-all`}>
                <div>
                  <p className="font-bold text-black text-sm sm:text-base">Final Exam</p>
                  {milestones.final.published ? (milestones.final.score !== null ? <p className="text-xs sm:text-sm text-green-700 font-bold mt-1">Completed: {milestones.final.score}%</p> : <p className="text-xs sm:text-sm text-green-600 font-bold mt-1">Unlocked - Go to Quizzes!</p>) : <p className="text-xs text-gray-400 mt-1">Not published yet</p>}
                </div>
                {milestones.final.score !== null ? <Trophy className="w-6 h-6 sm:w-8 sm:h-8 text-green-600" /> : milestones.final.published ? <Unlock className="w-6 h-6 sm:w-8 sm:h-8 text-green-600" /> : <Lock className="w-6 h-6 sm:w-8 sm:h-8 text-gray-300" />}
              </div>
            </div>
            {!bookGrade && (
              <Button type="button" onClick={handleDeclareFinished} disabled={isGrading || milestones.final.score === null} className={`w-full py-6 font-bold shadow-md rounded-xl transition-all ${milestones.final.score !== null ? "bg-green-600 hover:bg-green-700 text-white animate-pulse" : "bg-gray-100 text-gray-400 cursor-not-allowed"}`}>
                {isGrading ? <Loader2 className="w-5 h-5 animate-spin" /> : milestones.final.score !== null ? "Declare Book Finished & Calculate Final Grade!" : "Complete Final Exam to unlock Grade"}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Ask a Question Card */}
        <Card className="border-green-200 shadow-sm h-full flex flex-col bg-white rounded-3xl overflow-hidden">
          <CardHeader className="flex-none border-b border-gray-100 p-6 bg-gray-50/50">
            <CardTitle className="flex items-center gap-2 text-black font-bold"><MessageSquare className="w-5 h-5 text-green-600" /> Ask a Question</CardTitle>
            <CardDescription className="mt-1">Submit anonymous questions to leadership.</CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-4 flex-1 flex flex-col">
            <Textarea placeholder="Type your question here..." value={question} onChange={(e) => setQuestion(e.target.value)} className="resize-none border-gray-200 focus-visible:ring-green-600 rounded-2xl flex-1 min-h-[150px] text-black font-medium p-4 shadow-sm" />
            <Button type="button" onClick={handleSubmitQuestion} disabled={!question.trim() || isSubmittingQuestion} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl shadow-md py-6 transition-all">
              {isSubmittingQuestion ? "Sending..." : "Submit Question"}
            </Button>
          </CardContent>
        </Card>

        {/* Upcoming Events Feed */}
        <Card className="border-green-200 shadow-sm bg-white h-full flex flex-col rounded-3xl overflow-hidden">
          <CardHeader className="pb-4 border-b border-gray-100 bg-gray-50/50 rounded-t-xl flex-none p-6">
            <CardTitle className="flex items-center gap-2 text-lg text-black font-bold"><Calendar className="w-5 h-5 text-green-600" /> Upcoming Gatherings</CardTitle>
          </CardHeader>
          <CardContent className="p-6 flex-1 overflow-y-auto space-y-4 custom-scrollbar max-h-[400px]">
            {upcomingEvents.length > 0 ? (upcomingEvents.map(event => {
              const eventDate = new Date(event.event_date);
              return (
                <div key={event.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:border-green-200 transition-all flex flex-col sm:flex-row overflow-hidden group">
                  {event.image_url ? (
                    <div className="w-full sm:w-32 h-32 sm:h-auto relative overflow-hidden bg-gray-100 shrink-0"><img src={event.image_url} alt={event.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" /><div className="absolute top-2 right-2 sm:hidden bg-white/95 px-2 py-1 rounded-xl text-center shadow-sm"><p className="text-[10px] font-bold text-green-700 uppercase leading-none mb-0.5">{eventDate.toLocaleDateString('en-US', { month: 'short' })}</p><p className="text-sm font-black leading-none">{eventDate.getDate()}</p></div></div>
                  ) : (
                    <div className="w-full sm:w-32 h-16 sm:h-auto bg-green-50/50 flex items-center justify-center border-b sm:border-b-0 sm:border-r border-gray-100 shrink-0"><div className="bg-white px-3 py-1.5 rounded-xl shadow-sm text-center border border-gray-100"><p className="text-[9px] font-bold text-green-700 uppercase leading-none">{eventDate.toLocaleDateString('en-US', { month: 'short' })}</p><p className="text-sm font-black leading-none mt-0.5">{eventDate.getDate()}</p></div></div>
                  )}
                  <div className="p-4 flex flex-col flex-1 min-w-0">
                    <h4 className="font-bold text-black text-sm sm:text-base mb-1.5 truncate">{event.title}</h4>
                    {event.description && <p className="text-xs text-gray-500 mb-4 line-clamp-2">{event.description}</p>}
                    <div className="mt-auto pt-2 border-t border-gray-50">
                      {event.location && <a href={event.location.startsWith('http') ? event.location : `https://maps.google.com/?q=${event.location}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 w-full bg-gray-50 hover:bg-green-50 text-gray-600 hover:text-green-700 text-xs font-bold py-2.5 rounded-xl transition-all border border-gray-100"><MapPin className="w-4 h-4" /> Open in Maps</a>}
                    </div>
                  </div>
                </div>
              );
            })) : (<div className="text-center py-10 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200"><p className="text-gray-400 italic text-sm">No upcoming events right now.</p></div>)}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4 pt-8 border-t border-gray-200">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
          <h2 className="text-2xl font-black text-black flex items-center gap-2"><Users className="w-6 h-6 text-green-600" /> Household Overview</h2>
          
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            
            {/* --- UPGRADED: DUAL TAB MESSAGE FAMILY MODAL WITH ACCORDIONS --- */}
            <Dialog open={isMessageModalOpen} onOpenChange={setIsMessageModalOpen}>
              <DialogTrigger asChild>
                <Button type="button" variant="outline" className="border-green-200 text-green-700 hover:bg-green-50 font-bold flex-1 sm:flex-none rounded-xl h-11 transition-all">
                  <Bell className="w-4 h-4 mr-2" /> Message Family
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-white border border-green-100 rounded-3xl p-6 sm:p-8 max-w-xl">
                <DialogHeader>
                  <DialogTitle className="text-black font-black text-xl">Family Announcements</DialogTitle>
                </DialogHeader>
                
                <Tabs defaultValue="new" className="w-full mt-4">
                  <TabsList className="grid w-full grid-cols-2 bg-gray-100 p-1.5 rounded-xl mb-4 border border-gray-200 shadow-inner">
                    <TabsTrigger value="new" className="rounded-lg font-bold text-xs sm:text-sm data-[state=active]:bg-white data-[state=active]:text-green-700 data-[state=active]:shadow-sm">New Message</TabsTrigger>
                    <TabsTrigger value="history" className="rounded-lg font-bold text-xs sm:text-sm data-[state=active]:bg-white data-[state=active]:text-green-700 data-[state=active]:shadow-sm">Sent History & Receipts</TabsTrigger>
                  </TabsList>
                  
                  {/* NEW MESSAGE TAB */}
                  <TabsContent value="new" className="space-y-4 py-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-gray-500 uppercase">Alert Title</Label>
                      <Input placeholder="e.g. Saturday Service Reminder" value={msgData.title} onChange={e => setMsgData({...msgData, title: e.target.value})} className="border-gray-200 text-black font-medium h-11 rounded-xl focus-visible:ring-green-500" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-gray-500 uppercase">Message</Label>
                      <Textarea placeholder="Type your message here..." value={msgData.text} onChange={e => setMsgData({...msgData, text: e.target.value})} className="resize-none h-24 border-gray-200 text-black font-medium rounded-xl focus-visible:ring-green-500" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-gray-500 uppercase">Send To</Label>
                      <Select value={msgData.recipient} onValueChange={(val) => setMsgData({...msgData, recipient: val})}>
                        <SelectTrigger className="h-11 rounded-xl border-gray-200"><SelectValue placeholder="Select Recipient" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Everyone in Family</SelectItem>
                          {familyMembers.filter(m => m.id !== currentUser?.id).map(m => (
                            <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button type="button" onClick={handleSendFamilyMessage} disabled={isSendingMsg} className="w-full bg-green-600 hover:bg-green-700 text-white shadow-md font-bold rounded-xl h-12 mt-4 transition-all">
                      {isSendingMsg ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />} 
                      {isSendingMsg ? "Sending..." : "Send Announcement"}
                    </Button>
                  </TabsContent>

                  {/* SENT HISTORY & READ RECEIPTS TAB (Accordion Style) */}
                  <TabsContent value="history" className="max-h-[350px] overflow-y-auto custom-scrollbar pr-2 space-y-3">
                    {broadcastHistory.length === 0 ? (
                      <div className="text-center py-10 text-gray-400">
                        <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-20" />
                        <p className="text-sm font-medium">No family announcements sent yet.</p>
                      </div>
                    ) : (
                      broadcastHistory.map((broadcast: any) => {
                        const isExpanded = expandedMsgId === broadcast.id;
                        const totalRecipients = broadcast.recipients.length;
                        const seenCount = broadcast.recipients.filter((r: any) => r.is_read).length;

                        return (
                          <div key={broadcast.id} className="p-0 rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden transition-all">
                            <button 
                              type="button" 
                              onClick={() => setExpandedMsgId(isExpanded ? null : broadcast.id)}
                              className="w-full text-left p-4 hover:bg-gray-50 flex items-center justify-between"
                            >
                              <div className="flex-1 min-w-0 pr-4">
                                <h4 className="font-bold text-black text-sm truncate">{broadcast.title}</h4>
                                <div className="flex items-center gap-3 mt-1.5">
                                  <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${seenCount === totalRecipients ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-50 text-gray-600 border-gray-200"}`}>
                                    {seenCount} / {totalRecipients} Seen
                                  </Badge>
                                  <p className="text-[10px] text-gray-400 font-medium">
                                    {new Date(broadcast.created_at).toLocaleDateString()}
                                  </p>
                                </div>
                              </div>
                              {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />}
                            </button>

                            {isExpanded && (
                              <div className="px-4 pb-4 bg-gray-50 border-t border-gray-100">
                                <p className="text-xs text-gray-700 whitespace-pre-wrap py-3 leading-relaxed border-b border-gray-200 mb-3">
                                  {broadcast.message}
                                </p>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">Read Receipts</p>
                                <div className="space-y-1.5">
                                  {broadcast.recipients.map((rec: any, idx: number) => (
                                    <div key={idx} className="flex items-center justify-between text-xs">
                                      <span className="font-medium text-gray-700">{rec.name}</span>
                                      {rec.is_read ? (
                                        <span className="flex items-center text-green-600 font-bold bg-green-100 px-2 py-0.5 rounded-full"><CheckCheck className="w-3.5 h-3.5 mr-1" /> Seen</span>
                                      ) : (
                                        <span className="flex items-center text-gray-500 font-medium bg-gray-200 px-2 py-0.5 rounded-full"><Check className="w-3 h-3 mr-1" /> Delivered</span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </TabsContent>
                </Tabs>
              </DialogContent>
            </Dialog>

            {/* Existing Add Child Button */}
            <Dialog open={isAddChildOpen} onOpenChange={setIsAddChildOpen}>
              <DialogTrigger asChild>
                <Button type="button" className="bg-black hover:bg-gray-800 text-white font-bold flex-1 sm:flex-none shadow-md rounded-xl h-11 transition-all">
                  <UserPlus className="w-4 h-4 mr-2" /> Add Child
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-white border border-green-100 rounded-3xl p-6 sm:p-8">
                <DialogHeader><DialogTitle className="text-black font-black text-xl mb-2">Add Child to Family</DialogTitle></DialogHeader>
                <div className="space-y-4 py-4">
                  <Input placeholder="Child's Full Name" value={newMember.name} onChange={e => setNewMember({...newMember, name: e.target.value})} className="border-gray-200 text-black font-medium h-11 rounded-xl focus-visible:ring-green-500" />
                  <Input placeholder="Email (e.g. child@family.com)" value={newMember.email} onChange={e => setNewMember({...newMember, email: e.target.value})} className="border-gray-200 text-black font-medium h-11 rounded-xl focus-visible:ring-green-500" />
                  <Input placeholder="Password" type="password" value={newMember.password} onChange={e => setNewMember({...newMember, password: e.target.value})} className="border-gray-200 text-black font-medium h-11 rounded-xl focus-visible:ring-green-500" />
                </div>
                <div className="flex pt-2">
                  <Button type="button" onClick={handleRegisterMember} disabled={isRegistering} className="w-full bg-green-600 hover:bg-green-700 text-white shadow-md font-bold rounded-xl h-12 transition-all">
                    {isRegistering ? "Processing..." : "Create Account"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Card className="border-green-200 shadow-sm bg-white rounded-3xl overflow-hidden">
          <CardHeader className="border-b border-gray-100 p-6 bg-gray-50/50">
            <CardTitle className="text-lg text-black font-bold">Household Progress Overview</CardTitle>
            <CardDescription className="mt-1">Track readings and quizzes completed by everyone in the family</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] p-6">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid vertical={false} stroke="#f0fdf4" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                <Tooltip cursor={{fill: 'transparent'}} contentStyle={{borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                <Bar dataKey="readings" fill="#16a34a" radius={[4, 4, 0, 0]} name="Readings Done" maxBarSize={50} />
                <Bar dataKey="quizzes" fill="#000000" radius={[4, 4, 0, 0]} name="Quizzes Taken" maxBarSize={50} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        
        {/* Family Members List Card */}
        <Card className="border-green-200 shadow-sm bg-white rounded-3xl overflow-hidden">
          <CardHeader className="bg-gray-50/50 border-b border-gray-100 p-6">
            <CardTitle className="text-lg text-black font-bold">Family Members List</CardTitle>
            <CardDescription className="mt-1">All registered members belonging to {familyName}</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-white border-b border-gray-100 text-gray-400 uppercase text-[10px] tracking-widest font-bold">
                  <tr>
                    <th className="p-5">Member Name</th>
                    <th className="p-5">Email Address</th>
                    <th className="p-5">Role</th>
                    <th className="p-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 bg-white">
                  {familyMembers.map(m => (
                    <tr key={m.id} className="hover:bg-green-50/50 transition-colors">
                      <td className="p-4 sm:p-5 flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm ${m.role === 'parent' ? "bg-black text-white" : "bg-green-100 text-green-800"}`}>
                          {m.name[0]}
                        </div>
                        <span className="font-bold text-black">{m.name}</span>
                      </td>
                      <td className="p-4 sm:p-5 text-gray-500 font-mono text-xs">{m.email}</td>
                      <td className="p-4 sm:p-5">
                        {m.role === 'parent' ? (
                          <Badge className="bg-black text-white border-none font-bold text-[10px] rounded-md px-2 py-1">Parent</Badge>
                        ) : (
                          <Badge variant="outline" className="bg-gray-50 text-gray-600 border-gray-200 font-bold text-[10px] rounded-md px-2 py-1">Child</Badge>
                        )}
                      </td>
                      <td className="p-4 sm:p-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button type="button" variant="outline" size="sm" className="border-green-200 text-green-700 hover:bg-green-50 font-bold text-xs rounded-lg" onClick={() => navigate(`/app/family-activities`)}>
                            Progress
                          </Button>
                          {m.role !== 'parent' && (
                            <Button type="button" variant="ghost" size="icon" className="text-gray-400 hover:text-red-600 hover:bg-red-50 h-8 w-8 rounded-lg" onClick={(e) => handleDeleteMember(m.id, m.name, e)} title="Remove Member">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {familyMembers.length === 0 && (
                    <tr>
                      <td colSpan={4} className="text-center py-12 text-gray-400 italic">
                        Your household is empty. Click "Add Child" above to get started.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-in fade-in duration-500">
      
      {/* SEPARATED WELCOME BANNER & DAILY VERSE CARDS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT: Profile & Welcome Card - UPDATED FOR MOBILE SIDE-BY-SIDE */}
        <div className="lg:col-span-2 bg-white rounded-3xl p-5 sm:p-8 border border-green-200 shadow-sm flex flex-row items-center gap-4 sm:gap-5 w-full">
          <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-full bg-green-50 border-2 border-green-100 flex items-center justify-center shrink-0">
            <span className="text-xl sm:text-3xl font-bold text-green-700">{currentUser?.name?.charAt(0).toUpperCase()}</span>
          </div>
          <div className="flex-1 min-w-0 text-left">
            <h2 className="text-lg sm:text-2xl font-bold text-black truncate">Welcome Back, {currentUser?.name?.split(' ')[0] || "Parent"}!</h2>
            <div className="flex flex-wrap justify-start gap-1.5 sm:gap-2 mt-1.5 sm:mt-3">
              <Badge className="bg-black text-white border-none px-2 py-0.5 sm:px-2.5 sm:py-1 font-medium shadow-none rounded-lg text-[10px] sm:text-xs">
                <Shield className="w-3 h-3 sm:w-3.5 sm:h-3.5 mr-1 text-green-400" /> Parent
              </Badge>
              {departmentName && (
                <Badge variant="outline" className="bg-green-50 text-green-800 border-green-200 font-medium rounded-lg text-[10px] sm:text-xs px-2 py-0.5 sm:px-2.5 sm:py-1 truncate">
                  {departmentName} Dept
                </Badge>
              )}
              {isDeptHead && (
                <Badge className="bg-green-600 text-white border-none capitalize font-medium rounded-lg text-[10px] sm:text-xs px-2 py-0.5 sm:px-2.5 sm:py-1">
                  {currentUser?.department_role?.replace('_', ' ')}
                </Badge>
              )}
              {familyName && (
                <Badge variant="outline" className="border-gray-200 text-gray-700 bg-gray-50 font-medium rounded-lg text-[10px] sm:text-xs px-2 py-0.5 sm:px-2.5 sm:py-1 shadow-sm truncate">
                  <Users className="w-3 h-3 sm:w-3.5 sm:h-3.5 mr-1 sm:mr-1.5 text-green-600 shrink-0" /> {familyName} Family
                </Badge>
              )}
            </div>
            <p className="hidden sm:block text-gray-600 font-medium text-sm sm:text-base mt-3">Lead your household's spiritual journey today.</p>
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
              Family & Personal
            </TabsTrigger>
            <TabsTrigger value="department" className="font-medium text-xs sm:text-sm md:text-base px-2 py-2.5 sm:py-3 text-center truncate data-[state=active]:bg-black data-[state=active]:text-white shadow-sm rounded-xl">
              Department Workspace
            </TabsTrigger>
          </TabsList>

          <TabsContent value="family" className="space-y-6 animate-in fade-in duration-500">
            {familyDashboardContent}
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
        familyDashboardContent
      )}
    </div>
  );
}