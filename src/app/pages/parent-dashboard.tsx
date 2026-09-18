import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "../components/ui/dialog";
import { Textarea } from "../components/ui/textarea";
import { Progress } from "../components/ui/progress";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { 
  Users, UserPlus, Loader2, Calendar, BookMarked, CheckCircle, 
  Unlock, Lock, Trophy, BookOpen, Trash2, MapPin, MessageSquare, 
  UserCheck, Shield
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
    loadParentData();
    const channel = supabase.channel('parent-dashboard-realtime').on('postgres_changes', { event: '*', schema: 'public' }, () => { loadParentData(); }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleDeleteMember = async (memberId: string, name: string) => {
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

  async function loadParentData() {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/"); return; }
      
      const { data: profile } = await supabase.from('profiles').select('*, departments(name_en)').eq('id', user.id).single();
      setCurrentUser(profile);

      // Fetch Global Events
      const today = new Date().toISOString().split('T')[0];
      const { data: events } = await supabase.from('events').select('*').gte('event_date', today).order('event_date', { ascending: true }).limit(3);
      if (events) setUpcomingEvents(events);

      // Fetch Real Attendance
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
          const [ { data: assignments }, { data: quizzes } ] = await Promise.all([
            supabase.from('assignments').select('id').eq('book_id', book.id),
            supabase.from('quizzes').select('id').eq('book_id', book.id)
          ]);
          
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

    } catch (error: any) { toast.error(error.message); } finally { setLoading(false); }
  }

  const handleDeclareFinished = async () => {
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

  const handleSubmitQuestion = async () => {
    if (!question.trim() || !currentUser) return;
    setIsSubmittingQuestion(true);
    try {
      const { error } = await supabase.from('anoquestions').insert({ user_id: currentUser.id, user_name: "Anonymous", question: question.trim() });
      if (error) throw error;
      toast.success("Question submitted!");
      setQuestion("");
    } catch (error: any) { toast.error(error.message); } finally { setIsSubmittingQuestion(false); }
  };

  const handleRegisterMember = async () => {
    if (!newMember.name || !newMember.email || !newMember.password) return toast.error("Fill all fields");
    if (newMember.password.length < 6) return toast.error("Password must be at least 6 characters");
    try {
      setIsRegistering(true);
      const ghostClient = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });
      const { error } = await ghostClient.auth.signUp({ email: newMember.email, password: newMember.password, options: { data: { full_name: newMember.name, family_id: familyId, role: 'member' } } });
      if (error) throw error;
      toast.success("Child account created");
      setNewMember({ name: "", email: "", password: "" }); setIsAddChildOpen(false);
      setTimeout(loadParentData, 1000); 
    } catch (error: any) { toast.error(error.message); } finally { setIsRegistering(false); }
  };

  if (loading) return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="animate-spin text-green-600 w-10 h-10" /></div>;

  const departmentName = currentUser?.departments?.name_en;
  const isDeptHead = currentUser?.department_role === 'head' || currentUser?.department_role === 'deputy' || currentUser?.department_role === 'secretary';

  const familyDashboardContent = (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Quick Parent Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Card className="border-green-200 shadow-sm bg-white">
          <CardContent className="pt-6 flex justify-between items-center">
            <div><p className="text-[10px] font-bold uppercase text-gray-500">My Attendance</p><p className="text-2xl font-black text-black">{attendanceRate}%</p></div>
            <UserCheck className="w-8 h-8 text-green-600" />
          </CardContent>
        </Card>
        <Card className="border-green-200 shadow-sm cursor-pointer hover:border-green-400 transition-all bg-white" onClick={() => navigate("/app/bible-reading")}>
          <CardContent className="pt-6 flex justify-between items-center">
            <div><p className="text-[10px] font-bold uppercase text-gray-500">My Study Progress</p><p className="text-2xl font-black text-black">{parentStats.completedReadings}/{parentStats.totalReadings}</p></div>
            <BookOpen className="w-8 h-8 text-green-600" />
          </CardContent>
        </Card>
      </div>

      {activeBook && (
        <Card className={`border-green-200 shadow-sm bg-white ${bookGrade ? "bg-gradient-to-br from-green-50/50 to-white" : ""}`}>
          <CardHeader className="border-b border-gray-100 bg-gray-50/50 pb-4">
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="flex items-center gap-2 text-xl text-black"><BookMarked className="w-6 h-6 text-green-600" /> My Study: {activeBook.title}</CardTitle>
                <CardDescription className="font-medium mt-1 text-gray-500">Track your personal milestones</CardDescription>
              </div>
              {bookGrade && (
                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-green-600">Final Grade</p>
                  <p className="text-4xl font-black text-black">{bookGrade.final_score}%</p>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className={`p-5 rounded-xl border flex items-center justify-between ${milestones.midterm.score !== null ? "bg-green-50/50 border-green-200" : "bg-gray-50 border-gray-200"}`}>
                <div>
                  <p className="font-bold text-black">Midterm Exam</p>
                  {milestones.midterm.published ? (milestones.midterm.score !== null ? <p className="text-sm text-green-700 font-bold mt-1">Completed: {milestones.midterm.score}%</p> : <p className="text-sm text-green-600 font-bold mt-1">Unlocked - Go to Quizzes!</p>) : <p className="text-sm text-gray-400 mt-1">Not published yet</p>}
                </div>
                {milestones.midterm.score !== null ? <CheckCircle className="w-8 h-8 text-green-600" /> : milestones.midterm.published ? <Unlock className="w-8 h-8 text-green-600" /> : <Lock className="w-8 h-8 text-gray-300" />}
              </div>
              <div className={`p-5 rounded-xl border flex items-center justify-between ${milestones.final.score !== null ? "bg-green-50/50 border-green-200" : "bg-gray-50 border-gray-200"}`}>
                <div>
                  <p className="font-bold text-black">Final Exam</p>
                  {milestones.final.published ? (milestones.final.score !== null ? <p className="text-sm text-green-700 font-bold mt-1">Completed: {milestones.final.score}%</p> : <p className="text-sm text-green-600 font-bold mt-1">Unlocked - Go to Quizzes!</p>) : <p className="text-sm text-gray-400 mt-1">Not published yet</p>}
                </div>
                {milestones.final.score !== null ? <Trophy className="w-8 h-8 text-green-600" /> : milestones.final.published ? <Unlock className="w-8 h-8 text-green-600" /> : <Lock className="w-8 h-8 text-gray-300" />}
              </div>
            </div>
            {!bookGrade && (
              <Button onClick={handleDeclareFinished} disabled={isGrading || milestones.final.score === null} className={`w-full py-6 font-bold shadow-md rounded-xl ${milestones.final.score !== null ? "bg-green-600 hover:bg-green-700 text-white animate-pulse" : "bg-gray-100 text-gray-400 cursor-not-allowed"}`}>
                {isGrading ? <Loader2 className="w-5 h-5 animate-spin" /> : milestones.final.score !== null ? "Declare Book Finished & Calculate Final Grade!" : "Complete Final Exam to unlock Grade"}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-green-200 shadow-sm bg-white h-full flex flex-col">
          <CardHeader className="pb-3 border-b border-gray-100 bg-gray-50/50 rounded-t-xl flex-none"><CardTitle className="flex items-center gap-2 text-lg text-black"><Calendar className="w-5 h-5 text-green-600" /> Upcoming Gatherings</CardTitle></CardHeader>
          <CardContent className="pt-4 flex-1 overflow-y-auto space-y-4 max-h-[400px]">
            {upcomingEvents.length > 0 ? (upcomingEvents.map(event => {
              const eventDate = new Date(event.event_date);
              return (
                <div key={event.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:border-green-300 transition-all flex flex-col overflow-hidden">
                  {event.image_url ? (
                    <div className="w-full h-24 relative overflow-hidden bg-gray-100"><img src={event.image_url} alt={event.title} className="w-full h-full object-cover" /><div className="absolute top-2 right-2 bg-white/95 px-3 py-1.5 rounded-lg text-center shadow-sm"><p className="text-[10px] font-bold text-green-700 uppercase leading-none mb-0.5">{eventDate.toLocaleDateString('en-US', { month: 'short' })}</p><p className="text-lg font-black leading-none">{eventDate.getDate()}</p></div></div>
                  ) : (
                    <div className="w-full h-16 bg-gray-50 flex items-center justify-center relative border-b border-gray-100"><div className="bg-white px-3 py-1 rounded shadow-sm text-center border border-gray-200"><p className="text-[9px] font-bold text-green-700 uppercase leading-none">{eventDate.toLocaleDateString('en-US', { month: 'short' })}</p><p className="text-sm font-black leading-none mt-0.5">{eventDate.getDate()}</p></div></div>
                  )}
                  <div className="p-4 flex flex-col flex-1">
                    <h4 className="font-bold text-black text-base mb-1.5">{event.title}</h4>
                    {event.description && <p className="text-xs text-gray-500 mb-4 line-clamp-2">{event.description}</p>}
                    <div className="mt-auto pt-2 border-t border-gray-50">
                      {event.location && <a href={event.location.startsWith('http') ? event.location : `https://maps.google.com/?q=${event.location}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 w-full bg-green-50 hover:bg-green-600 text-green-700 hover:text-white text-sm font-bold py-2.5 rounded-xl transition-all border border-green-200"><MapPin className="w-4 h-4" /> Open in Maps</a>}
                    </div>
                  </div>
                </div>
              );
            })) : (<div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed border-gray-200"><p className="text-gray-400 italic text-sm">No upcoming events right now.</p></div>)}
          </CardContent>
        </Card>

        <Card className="border-green-200 shadow-sm h-full flex flex-col bg-white">
          <CardHeader className="flex-none border-b border-gray-100 pb-4 bg-gray-50/50"><CardTitle className="flex items-center gap-2 text-black"><MessageSquare className="w-5 h-5 text-green-600" /> Ask a Question</CardTitle><CardDescription>Submit anonymous questions to leadership.</CardDescription></CardHeader>
          <CardContent className="space-y-4 flex-1 flex flex-col pt-6">
            <Textarea placeholder="Type your question here..." value={question} onChange={(e) => setQuestion(e.target.value)} className="resize-none border-gray-200 focus-visible:ring-green-600 rounded-xl flex-1 min-h-[150px] text-black font-medium" />
            <Button onClick={handleSubmitQuestion} disabled={!question.trim() || isSubmittingQuestion} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl shadow-md py-6">
              {isSubmittingQuestion ? "Sending..." : "Submit Question"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4 pt-6 border-t border-gray-200">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h2 className="text-2xl font-black text-black flex items-center gap-2"><Users className="w-6 h-6 text-green-600" /> Household Overview</h2>
          <Dialog open={isAddChildOpen} onOpenChange={setIsAddChildOpen}>
            <DialogTrigger asChild><Button className="bg-black hover:bg-gray-800 text-white font-bold w-full sm:w-auto shadow-md rounded-xl"><UserPlus className="w-4 h-4 mr-2" /> Add Child to Family</Button></DialogTrigger>
            <DialogContent className="bg-white border border-green-100 rounded-2xl">
              <DialogHeader><DialogTitle className="text-black font-bold">Add Child to Family</DialogTitle></DialogHeader>
              <div className="space-y-3 py-4">
                <Input placeholder="Child's Full Name" value={newMember.name} onChange={e => setNewMember({...newMember, name: e.target.value})} className="border-gray-200 text-black font-medium" />
                <Input placeholder="Email (e.g. child@family.com)" value={newMember.email} onChange={e => setNewMember({...newMember, email: e.target.value})} className="border-gray-200 text-black font-medium" />
                <Input placeholder="Password" type="password" value={newMember.password} onChange={e => setNewMember({...newMember, password: e.target.value})} className="border-gray-200 text-black font-medium" />
              </div>
              <DialogFooter><Button onClick={handleRegisterMember} disabled={isRegistering} className="w-full bg-green-600 hover:bg-green-700 text-white shadow-md font-bold rounded-xl">{isRegistering ? "Processing..." : "Create Account"}</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="border-green-200 shadow-sm bg-white">
          <CardHeader className="border-b border-gray-100 pb-4"><CardTitle className="text-lg text-black">Household Progress Overview</CardTitle><CardDescription>Track readings and quizzes completed by everyone in the family for the active study book</CardDescription></CardHeader>
          <CardContent className="h-[300px] pt-6">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid vertical={false} stroke="#f0fdf4" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                <Tooltip cursor={{fill: 'transparent'}} contentStyle={{borderRadius: '8px', border: '1px solid #e2e8f0'}} />
                <Bar dataKey="readings" fill="#16a34a" radius={[4, 4, 0, 0]} name="Readings Done" maxBarSize={50} />
                <Bar dataKey="quizzes" fill="#000000" radius={[4, 4, 0, 0]} name="Quizzes Taken" maxBarSize={50} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        
        {/* REPLACED INDIVIDUAL CARDS WITH A CLEAN MEMBER LIST CARD */}
        <Card className="border-green-200 shadow-sm bg-white overflow-hidden">
          <CardHeader className="bg-gray-50/50 border-b border-gray-100 pb-4">
            <CardTitle className="text-lg text-black">Family Members List</CardTitle>
            <CardDescription>All registered members belonging to {familyName}</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-gray-50 border-b border-gray-100 text-gray-500 uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="p-4 font-bold">Member Name</th>
                    <th className="p-4 font-bold">Email Address</th>
                    <th className="p-4 font-bold">Role</th>
                    <th className="p-4 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {familyMembers.map(m => (
                    <tr key={m.id} className="hover:bg-green-50/30 transition-colors">
                      <td className="p-4 flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm ${m.role === 'parent' ? "bg-black text-white" : "bg-green-100 text-green-800"}`}>
                          {m.name[0]}
                        </div>
                        <span className="font-bold text-black">{m.name}</span>
                      </td>
                      <td className="p-4 text-gray-500 font-mono text-xs">{m.email}</td>
                      <td className="p-4">
                        {m.role === 'parent' ? (
                          <Badge className="bg-black text-white border-none font-bold text-[10px]">Parent</Badge>
                        ) : (
                          <Badge variant="outline" className="bg-white text-gray-600 border-gray-200 font-bold text-[10px]">Child</Badge>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="outline" size="sm" className="border-green-200 text-green-700 hover:bg-green-50 font-bold text-xs" onClick={() => navigate(`/app/family-activities`)}>
                            Progress
                          </Button>
                          {m.role !== 'parent' && (
                            <Button variant="ghost" size="icon" className="text-gray-400 hover:text-red-600 hover:bg-red-50 h-8 w-8" onClick={() => handleDeleteMember(m.id, m.name)} title="Remove Member">
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* REORGANIZED WELCOME BANNER (NO PROFILE BUTTON) */}
        <div className="lg:col-span-2 bg-white rounded-xl p-6 sm:p-8 border border-green-200 shadow-sm flex flex-col justify-center relative overflow-hidden h-fit">
          <div>
            <h2 className="text-2xl sm:text-3xl font-black text-black mb-3">Welcome Back, {currentUser?.name?.split(' ')[0] || "Parent"}!</h2>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-black text-white border-none px-3 py-1 font-bold shadow-none"><Shield className="w-3.5 h-3.5 mr-1 text-green-400" /> Parent</Badge>
              {departmentName && <Badge variant="outline" className="bg-green-50 text-green-800 border-green-200 font-bold">{departmentName} Dept</Badge>}
              {isDeptHead && <Badge className="bg-green-600 text-white border-none capitalize font-bold">{currentUser?.department_role?.replace('_', ' ')}</Badge>}
              {familyName && <Badge variant="outline" className="border-gray-200 text-black bg-gray-50 font-bold"><Users className="w-3.5 h-3.5 mr-1 text-green-600" /> {familyName} Family</Badge>}
            </div>
            <p className="text-gray-600 font-medium text-sm sm:text-base mt-3">Lead your household's spiritual journey today.</p>
          </div>
        </div>

        <div className="lg:col-span-1">
          <Card className="border-green-200 bg-white shadow-sm h-full flex flex-col min-h-[140px]">
            <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-lg text-black"><BookOpen className="w-5 h-5 text-green-600" /> Daily Verse</CardTitle></CardHeader>
            <CardContent className="flex-1 flex flex-col justify-center">
              <p className="text-base sm:text-lg font-medium italic mb-2 text-gray-800 leading-snug">"{dailyVerse.verse}"</p>
              <p className="text-xs sm:text-sm font-bold text-green-700 uppercase tracking-wider">— {dailyVerse.reference}</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {departmentName ? (
        <Tabs defaultValue="family" className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-green-50 p-1.5 rounded-xl mb-6 border border-green-100 h-auto">
            <TabsTrigger value="family" className="font-bold text-xs sm:text-sm md:text-base px-2 py-3 text-center truncate data-[state=active]:bg-white data-[state=active]:text-black shadow-sm">
              Family & Personal
            </TabsTrigger>
            <TabsTrigger value="department" className="font-bold text-xs sm:text-sm md:text-base px-2 py-3 text-center truncate data-[state=active]:bg-black data-[state=active]:text-white shadow-sm">
              Department Workspace
            </TabsTrigger>
          </TabsList>

          <TabsContent value="family" className="space-y-6">
            {familyDashboardContent}
          </TabsContent>

          <TabsContent value="department" className="space-y-6 animate-in fade-in duration-500">
            {departmentName?.includes("Education") && <EducationWorkspace />}
            {departmentName?.includes("Finance") && <FinanceWorkspace />}
            {departmentName?.includes("Media") && <MediaWorkspace />}
            {departmentName?.includes("Saturday") && <SaturdayWorkspace />}
            {departmentName?.includes("Relation") && <RelationWorkspace />}

            {(departmentName?.includes("Executive") || 
              departmentName?.includes("Leadership") || 
              departmentName?.includes("Secretarial") || 
              currentUser?.role === 'admin') && (
              <div className="mt-12 pt-8 border-t-4 border-black">
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