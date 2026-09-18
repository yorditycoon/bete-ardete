import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { Progress } from "../components/ui/progress";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { 
  BookOpen, Calendar, MessageSquare,
  Award, Loader2, Users, MapPin, CheckSquare, UserCheck
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
  const dailyVerse = { verse: "For I know the plans I have for you, declares the Lord...", reference: "Jeremiah 29:11" };

  useEffect(() => {
    loadMemberData();
  }, []);

  async function loadMemberData() {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return navigate("/");

      const { data: profile } = await supabase.from('profiles').select('*, departments(name_en)').eq('id', user.id).single();
      setCurrentUser(profile);

      // Fetch Family Name
      if (profile?.family_id) {
        const { data: familyData } = await supabase.from('families').select('name').eq('id', profile.family_id).single();
        if (familyData) setFamilyName(familyData.name);
      }
      
      // Fetch Upcoming Events
      const today = new Date().toISOString().split('T')[0];
      const { data: events } = await supabase.from('events').select('*').gte('event_date', today).order('event_date', { ascending: true }).limit(3);
      if (events) setUpcomingEvents(events);

      // Fetch Real Attendance
      const { data: attData } = await supabase.from('attendance').select('present').eq('user_id', user.id);
      let myAttendanceRate = 0;
      if (attData && attData.length > 0) {
        const present = attData.filter(a => a.present).length;
        myAttendanceRate = Math.round((present / attData.length) * 100);
      }

      setStats({ completedReadings: 4, totalReadings: 10, averageScore: 85, attendanceRate: myAttendanceRate });

    } catch (error: any) {
      toast.error("Error loading dashboard data");
    } finally {
      setLoading(false);
    }
  }

  const handleSubmitQuestion = async () => {
    if (!question.trim() || !currentUser) return;
    setIsSubmitting(true);
    await supabase.from('anoquestions').insert({ user_id: currentUser.id, user_name: "Anonymous", question: question.trim() });
    toast.success("Question submitted successfully!");
    setQuestion("");
    setIsSubmitting(false);
  };

  if (loading) return <div className="flex h-[60vh] justify-center items-center"><Loader2 className="w-10 h-10 animate-spin text-green-600" /></div>;

  const departmentName = currentUser?.departments?.name_en;
  const isDeptHead = currentUser?.department_role === 'head' || currentUser?.department_role === 'deputy' || currentUser?.department_role === 'secretary';

  // --- REUSABLE PERSONAL DASHBOARD COMPONENT ---
  const personalDashboardContent = (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Top Quick Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-green-200 shadow-sm bg-white"><CardContent className="pt-6"><div className="flex justify-between"><div><p className="text-[10px] font-bold uppercase text-gray-500">Readings</p><p className="text-2xl font-black text-black">{stats.completedReadings}/{stats.totalReadings}</p></div><BookOpen className="w-6 h-6 text-green-600" /></div><Progress value={(stats.totalReadings > 0 ? (stats.completedReadings/stats.totalReadings)*100 : 0)} className="mt-4 bg-gray-100" /></CardContent></Card>
        <Card className="border-green-200 shadow-sm bg-white"><CardContent className="pt-6"><div className="flex justify-between"><div><p className="text-[10px] font-bold uppercase text-gray-500">Quiz Average</p><p className="text-2xl font-black text-black">{stats.averageScore}%</p></div><Award className="w-6 h-6 text-green-600" /></div><Progress value={stats.averageScore} className="mt-4 bg-gray-100" /></CardContent></Card>
        <Card className="border-green-200 shadow-sm bg-white"><CardContent className="pt-6"><div className="flex justify-between"><div><p className="text-[10px] font-bold uppercase text-gray-500">My Attendance</p><p className="text-2xl font-black text-black">{stats.attendanceRate}%</p></div><UserCheck className="w-6 h-6 text-green-600" /></div><Progress value={stats.attendanceRate} className="mt-4 bg-gray-100" /></CardContent></Card>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-green-200 hover:border-green-400 transition-all cursor-pointer bg-white" onClick={() => navigate("/app/bible-reading")}>
          <CardContent className="p-6 flex items-center gap-4"><BookOpen className="w-8 h-8 text-green-600"/><CardTitle className="text-black">My Study Books</CardTitle></CardContent>
        </Card>
        <Card className="border-green-200 hover:border-green-400 transition-all cursor-pointer bg-white" onClick={() => navigate("/app/quiz")}>
          <CardContent className="p-6 flex items-center gap-4"><CheckSquare className="w-8 h-8 text-green-600"/><CardTitle className="text-black">Take a Quiz</CardTitle></CardContent>
        </Card>
      </div>

      {/* Upcoming Events Feed */}
      <Card className="border-green-200 shadow-sm bg-white">
        <CardHeader className="pb-3 border-b border-gray-100 bg-gray-50/50 rounded-t-xl"><CardTitle className="flex items-center gap-2 text-lg text-black"><Calendar className="w-5 h-5 text-green-600" /> Upcoming Gatherings</CardTitle></CardHeader>
        <CardContent className="pt-4 overflow-y-auto space-y-4 max-h-[400px]">
          {upcomingEvents.length > 0 ? (upcomingEvents.map(event => {
            const eventDate = new Date(event.event_date);
            return (
              <div key={event.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:border-green-300 transition-all flex flex-col sm:flex-row overflow-hidden">
                {event.image_url ? (
                  <div className="w-full sm:w-32 h-32 sm:h-auto relative overflow-hidden bg-gray-100"><img src={event.image_url} alt={event.title} className="w-full h-full object-cover" /><div className="absolute top-2 right-2 sm:hidden bg-white/95 px-2 py-1 rounded-lg text-center shadow-sm"><p className="text-[10px] font-bold text-green-700 uppercase leading-none mb-0.5">{eventDate.toLocaleDateString('en-US', { month: 'short' })}</p><p className="text-sm font-black leading-none">{eventDate.getDate()}</p></div></div>
                ) : (
                  <div className="w-full sm:w-32 h-16 sm:h-auto bg-gray-50 flex items-center justify-center border-b sm:border-b-0 sm:border-r border-gray-200"><div className="bg-white px-3 py-1 rounded shadow-sm text-center border border-gray-200"><p className="text-[9px] font-bold text-green-700 uppercase leading-none">{eventDate.toLocaleDateString('en-US', { month: 'short' })}</p><p className="text-sm font-black leading-none mt-0.5">{eventDate.getDate()}</p></div></div>
                )}
                <div className="p-4 flex flex-col flex-1">
                  <h4 className="font-bold text-black text-base mb-1.5">{event.title}</h4>
                  {event.description && <p className="text-xs text-gray-500 mb-4 line-clamp-2">{event.description}</p>}
                  <div className="mt-auto pt-2 border-t border-gray-50">
                    {event.location && <a href={event.location.startsWith('http') ? event.location : `https://maps.google.com/?q=${event.location}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 w-full bg-green-50 hover:bg-green-600 text-green-700 hover:text-white text-sm font-bold py-2 rounded-xl transition-all border border-green-200"><MapPin className="w-4 h-4" /> View Map</a>}
                  </div>
                </div>
              </div>
            );
          })) : (<div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed border-gray-200"><p className="text-gray-400 italic text-sm">No upcoming events right now.</p></div>)}
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-in fade-in duration-500">
      
      {/* REORGANIZED WELCOME BANNER (NO PROFILE BUTTON) */}
      <div className="bg-white rounded-xl p-6 sm:p-8 border border-green-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4 w-full">
          <div className="w-16 h-16 rounded-full bg-green-50 border-2 border-green-200 flex items-center justify-center shrink-0">
            <span className="text-2xl font-black text-green-700">{currentUser?.name?.charAt(0).toUpperCase()}</span>
          </div>
          <div className="w-full">
            <h2 className="text-2xl sm:text-3xl font-black text-black">Welcome, {currentUser?.name?.split(' ')[0]}</h2>
            <div className="flex flex-wrap gap-2 mt-3">
              <Badge className="bg-black text-white border-none px-3 py-1 font-bold shadow-none">Member</Badge>
              {departmentName && <Badge variant="outline" className="bg-green-50 text-green-800 border-green-200 font-bold">{departmentName} Dept</Badge>}
              {isDeptHead && <Badge className="bg-green-600 text-white border-none capitalize font-bold">{currentUser?.department_role?.replace('_', ' ')}</Badge>}
              {familyName && (
                <Badge variant="outline" className="border-gray-200 text-black bg-gray-50 font-bold">
                  <Users className="w-3.5 h-3.5 mr-1 text-green-600" /> {familyName} Family
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* DUAL DASHBOARD TABS */}
      {departmentName ? (
       <Tabs defaultValue="family" className="w-full">
  <TabsList className="grid w-full grid-cols-2 bg-green-50 p-1.5 rounded-xl mb-6 border border-green-100 h-auto">
    <TabsTrigger value="family" className="font-bold text-xs sm:text-sm md:text-base px-2 py-3 text-center truncate data-[state=active]:bg-white data-[state=active]:text-black shadow-sm">
      Personal Dashboard
    </TabsTrigger>
    <TabsTrigger value="department" className="font-bold text-xs sm:text-sm md:text-base px-2 py-3 text-center truncate data-[state=active]:bg-black data-[state=active]:text-white shadow-sm">
      Department Workspace
    </TabsTrigger>
  </TabsList>

  {/* Content tabs remain here... */}


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
              <div className="mt-12 pt-8 border-t-4 border-black">
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