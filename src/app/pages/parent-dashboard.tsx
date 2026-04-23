import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "../components/ui/dialog";
import { 
  Users, UserPlus, Loader2, Quote, Calendar, 
  BookMarked, CheckCircle, Unlock, Lock, Trophy, BookOpen,
  Trash2, MapPin
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { Badge } from "../components/ui/badge";

// Ghost Client Imports
import { createClient } from "@supabase/supabase-js";
import { supabase, supabaseUrl, supabaseAnonKey } from "../lib/supabase"; 
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

interface FamilyMember {
  id: string;
  name: string;
  email: string;
  role: string;
}

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

  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);
  const dailyVerse = {
    verse: "Train up a child in the way he should go; even when he is old he will not depart from it.",
    reference: "Proverbs 22:6"
  };

  const [isGrading, setIsGrading] = useState(false);
  const [activeBook, setActiveBook] = useState<any>(null);
  const [bookGrade, setBookGrade] = useState<any>(null);
  const [parentStats, setParentStats] = useState({ completedReadings: 0, totalReadings: 0 });
  const [milestones, setMilestones] = useState({
    midterm: { published: false, score: null as number | null },
    final: { published: false, score: null as number | null },
    avgWeeklyQuiz: 0
  });

  useEffect(() => {
    loadParentData();

    // Keep the family list and progress chart perfectly synced
    const channel = supabase.channel('parent-dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public' }, () => {
        loadParentData();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleDeleteMember = async (memberId: string, name: string) => {
    if (memberId === currentUser?.id) {
      return toast.error("You cannot delete your own account from here.");
    }

    const confirmed = window.confirm(`Are you sure you want to remove ${name} from your household? This will delete their profile and progress.`);
    
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', memberId);

      if (error) throw error;

      toast.success(`${name} has been removed from the family.`);
      
      setFamilyMembers(prev => prev.filter(m => m.id !== memberId));
      setChartData(prev => prev.filter(d => !d.name.startsWith(name.split(' ')[0])));
      
    } catch (err: any) {
      toast.error("Error removing member: " + err.message);
    }
  };

  async function loadParentData() {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/"); return; }
      setCurrentUser(user);

      const today = new Date().toISOString().split('T')[0];
      const { data: events } = await supabase.from('events').select('*').gte('event_date', today).order('event_date', { ascending: true }).limit(3);
      if (events) setUpcomingEvents(events);

      const { data: book } = await supabase.from('study_books').select('*').eq('status', 'active').order('created_at', { ascending: false }).limit(1).single();
      setActiveBook(book);

      const { data: profile } = await supabase.from('profiles').select('family_id').eq('id', user.id).single();

      if (profile?.family_id) {
        setFamilyId(profile.family_id);
        const { data: familyData } = await supabase.from('families').select('name').eq('id', profile.family_id).single();
        if (familyData) setFamilyName(familyData.name);

        const { data: members } = await supabase
          .from('profiles')
          .select('id, name, email, role')
          .eq('family_id', profile.family_id)
          .order('role', { ascending: false }); 

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

          const realChartData = list.map(member => ({
            name: member.name.split(' ')[0] + (member.role === 'parent' ? " (P)" : ""), 
            readings: familyReadings?.filter(r => r.user_id === member.id).length || 0,
            quizzes: familyScores?.filter(s => s.user_id === member.id).length || 0,
          }));
          setChartData(realChartData);
        } else {
           setChartData(list.map(m => ({ name: m.name.split(' ')[0], readings: 0, quizzes: 0 })));
        }
      }

      if (book) {
        const { data: gradeData } = await supabase.from('book_grades').select('*').eq('user_id', user.id).eq('book_id', book.id).maybeSingle();
        if (gradeData) setBookGrade(gradeData);

        const { data: assignments } = await supabase.from('assignments').select('id').eq('book_id', book.id);
        const assignmentIds = assignments?.map(a => a.id) || [];
        const { data: readings } = await supabase.from('reading_progress').select('*').eq('user_id', user.id);
        const bookReadings = readings?.filter(r => assignmentIds.includes(r.reading_id)) || [];
        
        setParentStats({
          completedReadings: bookReadings.filter(r => r.is_completed).length,
          totalReadings: assignmentIds.length || 1
        });

        const { data: bookQuizzes } = await supabase.from('quizzes').select('id, quiz_type').eq('book_id', book.id);
        const { data: allUserScores } = await supabase.from('quiz_scores').select('quiz_id, score').eq('user_id', user.id);

        const midtermQuiz = bookQuizzes?.find(q => q.quiz_type === 'midterm');
        const finalQuiz = bookQuizzes?.find(q => q.quiz_type === 'final');
        const weeklyQuizzes = bookQuizzes?.filter(q => q.quiz_type === 'weekly') || [];

        const midtermScore = midtermQuiz ? allUserScores?.find(s => s.quiz_id === midtermQuiz.id)?.score ?? null : null;
        const finalScore = finalQuiz ? allUserScores?.find(s => s.quiz_id === finalQuiz.id)?.score ?? null : null;
        
        const weeklyScores = allUserScores?.filter(s => weeklyQuizzes.map(wq => wq.id).includes(s.quiz_id)) || [];
        const avgWeeklyScore = weeklyScores.length > 0 ? Math.round(weeklyScores.reduce((a, b) => a + b.score, 0) / weeklyScores.length) : 0;

        setMilestones({
          midterm: { published: !!midtermQuiz, score: midtermScore },
          final: { published: !!finalQuiz, score: finalScore },
          avgWeeklyQuiz: avgWeeklyScore
        });
      }

    } catch (error: any) {
      toast.error(error.message);
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
      const readingScore = parentStats.totalReadings > 0 ? (parentStats.completedReadings / parentStats.totalReadings) * 20 : 20;
      const quizScore = (milestones.avgWeeklyQuiz / 100) * 20;
      const midtermScore = ((milestones.midterm.score || 0) / 100) * 25;
      const finalScore = ((milestones.final.score || 0) / 100) * 35;

      const grandTotal = Math.round(readingScore + quizScore + midtermScore + finalScore);

      const { data, error } = await supabase.from('book_grades').insert({
        user_id: currentUser.id,
        family_id: familyId,
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

  const handleRegisterMember = async () => {
    if (!newMember.name || !newMember.email || !newMember.password) return toast.error("Fill all fields");
    if (newMember.password.length < 6) return toast.error("Password must be at least 6 characters");

    try {
      setIsRegistering(true);
      const ghostClient = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });

      const { error } = await ghostClient.auth.signUp({
        email: newMember.email,
        password: newMember.password,
        options: { data: { full_name: newMember.name, family_id: familyId, role: 'member' } }
      });

      if (error) throw error;
      toast.success("Child account created for " + newMember.name);
      setNewMember({ name: "", email: "", password: "" });
      setIsAddChildOpen(false);
      setTimeout(loadParentData, 1000); 
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsRegistering(false);
    }
  };

  if (loading) return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="animate-spin text-green-600 w-10 h-10" /></div>;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      
      {/* ROW 1: Welcome Banner & Daily Verse (Shorter Cards) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Welcome Section */}
        <div className="lg:col-span-2 bg-gradient-to-r from-green-100 to-green-50 rounded-xl p-6 sm:p-8 border border-green-200 shadow-sm flex flex-col justify-center relative overflow-hidden h-fit">
          <div className="relative z-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Welcome Back, {currentUser?.user_metadata?.full_name?.split(' ')[0] || "Parent"}!</h2>
            {familyName && (
              <div className="flex items-center gap-2 mb-3">
                <Badge variant="outline" className="bg-white/80 backdrop-blur-sm border-green-300 text-green-700 px-3 py-1 shadow-sm font-bold">
                  <Users className="w-3.5 h-3.5 mr-2 text-green-600" />
                  Head of {familyName}
                </Badge>
              </div>
            )}
            <p className="text-gray-600 font-medium text-sm sm:text-base">Lead your household's spiritual journey today.</p>
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

      {/* ROW 2: Parent's Personal Milestones & Upcoming Events (Taller Cards) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Exams & Milestones (Parent's Progress) */}
        <div className="lg:col-span-2">
          {activeBook ? (
            <Card className={`border-green-200 shadow-sm h-full flex flex-col ${bookGrade ? "bg-gradient-to-br from-green-50 to-white" : ""}`}>
              <CardHeader className="border-b border-gray-100 bg-white/50 pb-4">
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-xl text-green-900">
                      <BookMarked className="w-6 h-6 text-green-600" />
                      My Study: {activeBook.title}
                    </CardTitle>
                    <CardDescription className="font-medium mt-1 text-green-700">Track your personal milestones</CardDescription>
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

        {/* UPGRADED: Full Card Events */}
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

      {/* --- ROW 3: HOUSEHOLD MANAGEMENT --- */}
      <div className="space-y-4 pt-6 border-t border-gray-100">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-green-600" /> Household Overview
          </h2>
          
          {/* Add Child Dialog */}
          <Dialog open={isAddChildOpen} onOpenChange={setIsAddChildOpen}>
            <DialogTrigger asChild>
              <Button className="bg-green-600 hover:bg-green-700">
                <UserPlus className="w-4 h-4 mr-2" /> Add Child
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Child to Family</DialogTitle></DialogHeader>
              <div className="space-y-3 py-4">
                <Input placeholder="Child's Full Name" value={newMember.name} onChange={e => setNewMember({...newMember, name: e.target.value})} />
                <Input placeholder="Email (can be a fake one for kids like child@family.com)" value={newMember.email} onChange={e => setNewMember({...newMember, email: e.target.value})} />
                <Input placeholder="Password" type="password" value={newMember.password} onChange={e => setNewMember({...newMember, password: e.target.value})} />
              </div>
              <DialogFooter>
                <Button onClick={handleRegisterMember} disabled={isRegistering} className="w-full bg-green-600 hover:bg-green-700 text-white">
                  {isRegistering ? "Processing..." : "Create Account"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Chart */}
        <Card className="border-green-100 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Household Progress Overview</CardTitle>
            <CardDescription>Track readings and quizzes completed by everyone in the family for the active study book</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid vertical={false} stroke="#eee" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} />
                <Tooltip cursor={{fill: 'transparent'}} contentStyle={{borderRadius: '8px'}} />
                <Bar dataKey="readings" fill="#10b981" radius={[4, 4, 0, 0]} name="Readings Done" />
                <Bar dataKey="quizzes" fill="#34d399" radius={[4, 4, 0, 0]} name="Quizzes Taken" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        
        {/* Household Member Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {familyMembers.map(m => (
            <Card key={m.id} className={`p-5 relative group border-gray-100 hover:border-green-200 transition-colors shadow-sm ${m.role === 'parent' ? "bg-green-50/50" : "bg-white"}`}>
              
              {/* DELETE BUTTON FOR CHILDREN ONLY */}
              {m.role !== 'parent' && (
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="absolute top-2 right-2 text-gray-300 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                  onClick={() => handleDeleteMember(m.id, m.name)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}

              <div className="flex items-center gap-4 mb-5">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-xl ${m.role === 'parent' ? "bg-green-600 text-white" : "bg-green-100 text-green-700"}`}>
                  {m.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-base text-gray-900 truncate">{m.name}</p>
                    {m.role === 'parent' && <Badge variant="outline" className="text-[10px] h-5 px-1.5 bg-green-100 text-green-800 border-green-200">Parent</Badge>}
                  </div>
                  <p className="text-xs text-gray-400 font-mono truncate">{m.email}</p>
                </div>
              </div>
              <Button variant="outline" className="w-full text-xs hover:bg-green-50 hover:text-green-700 border-gray-200 font-bold" onClick={() => navigate(`/app/family-activities`)}>
                View Family Progress
              </Button>
            </Card>
          ))}
          {familyMembers.length === 0 && (
            <div className="col-span-1 sm:col-span-2 lg:col-span-3 text-center py-12 bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl">
              <p className="text-gray-500 font-medium">Your household is empty.</p>
              <p className="text-sm text-gray-400 mt-1">Click the "Add Child" button above to get started.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}