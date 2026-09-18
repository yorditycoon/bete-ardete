import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Progress } from "../components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { 
  User, BookOpen, Award, Mic, MessageSquare,
  Loader2, BookMarked
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { supabase } from "../lib/supabase";
import { toast } from "sonner";

// --- TypeScript Interfaces ---
interface FamilyMember {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface MemberStats {
  readings: { completed: number; total: number };
  quizzes: { score: number; totalTaken: number; totalAvailable: number; details: any[] };
  questions: any[];
  recordings: number;
}

export function FamilyActivities() {
  const [loading, setLoading] = useState(true);
  const [activeBook, setActiveBook] = useState<any>(null);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null);
  const [memberStats, setMemberStats] = useState<MemberStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedMember && activeBook) {
      loadMemberStats(selectedMember.id, activeBook.id);
      
      const channel = supabase.channel(`family-activities-${selectedMember.id}`)
        .on('postgres_changes', { event: '*', schema: 'public' }, () => {
          loadMemberStats(selectedMember.id, activeBook.id);
        })
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    }
  }, [selectedMember, activeBook]);

  async function loadInitialData() {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: book } = await supabase
        .from('study_books')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      setActiveBook(book);

      const { data: profile } = await supabase
        .from('profiles')
        .select('family_id')
        .eq('id', user.id)
        .single();

      if (profile?.family_id) {
        const { data: members } = await supabase
          .from('profiles')
          .select('id, name, email, role')
          .eq('family_id', profile.family_id)
          .order('role', { ascending: false }); 

        if (members && members.length > 0) {
          setFamilyMembers(members);
          setSelectedMember(members[0]); 
        }
      }
    } catch (error: any) {
      toast.error("Failed to load family data: " + error.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadMemberStats(memberId: string, bookId: string) {
    try {
      setLoadingStats(true);

      const [ { data: assignments }, { data: quizzes } ] = await Promise.all([
        supabase.from('assignments').select('id').eq('book_id', bookId),
        supabase.from('quizzes').select('id, title').eq('book_id', bookId)
      ]);

      const assignmentIds = assignments?.map(a => a.id) || [];
      const quizIds = quizzes?.map(q => q.id) || [];

      const resReadings = await supabase.from('reading_progress').select('*').eq('user_id', memberId);
      const resScores = await supabase.from('quiz_scores').select('*').eq('user_id', memberId);
      const resQuestions = await supabase.from('anoquestions').select('*').eq('user_id', memberId).order('created_at', { ascending: false });

      if (resScores.error) console.error("Quiz Fetch Error:", resScores.error);
      if (resQuestions.error) console.error("Questions Fetch Error:", resQuestions.error);

      const allReadings = resReadings.data || [];
      const allScores = resScores.data || [];
      const questions = resQuestions.data || [];

      const bookReadings = allReadings.filter(r => assignmentIds.includes(r.reading_id));
      const bookScores = allScores.filter(s => quizIds.includes(s.quiz_id));

      const completedReadings = bookReadings.filter(r => r.is_completed).length;
      const totalReadings = assignmentIds.length || 1; 

      const readAloudsCompleted = completedReadings;

      const avgScore = bookScores.length > 0 
        ? Math.round(bookScores.reduce((acc, q) => acc + q.score, 0) / bookScores.length) 
        : 0;

      const detailedScores = bookScores.map(score => {
         const matchedQuiz = quizzes?.find(q => q.id === score.quiz_id);
         return { ...score, quiz_title: matchedQuiz?.title || "Unknown Quiz" };
      });

      setMemberStats({
        readings: { completed: completedReadings, total: totalReadings },
        quizzes: { score: avgScore, totalTaken: bookScores.length, totalAvailable: quizIds.length || 1, details: detailedScores },
        questions: questions,
        recordings: readAloudsCompleted, 
      });

    } catch (error: any) {
      console.error("Error loading stats:", error);
    } finally {
      setLoadingStats(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col h-[50vh] items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-green-600 mb-4" />
        <p className="text-gray-500 font-medium animate-pulse">Loading family activities...</p>
      </div>
    );
  }

  // BarChart colors mapped to Green, Black, and Gray
  const chartData = memberStats ? [
    { id: "readings", activity: "Readings", completed: memberStats.readings.completed, total: memberStats.readings.total },
    { id: "quizzes", activity: "Quizzes Taken", completed: memberStats.quizzes.totalTaken, total: memberStats.quizzes.totalAvailable },
    { id: "recordings", activity: "Read Alouds", completed: memberStats.recordings, total: memberStats.readings.total }, 
  ] : [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-in fade-in duration-500">
      
      {/* HEADER */}
      <div className="bg-white rounded-xl p-6 sm:p-8 border border-green-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-black mb-2 flex items-center gap-2">
            Family Activities
          </h2>
          <p className="text-gray-600 font-medium">Monitor your family members' spiritual progress</p>
        </div>
        {activeBook && (
          <Badge variant="outline" className="flex items-center gap-2 bg-green-50 border-green-200 text-green-800 px-4 py-2 text-sm shadow-sm font-bold">
            <BookMarked className="w-4 h-4 text-green-600" />
            Current Study: {activeBook.title}
          </Badge>
        )}
      </div>

      {!activeBook ? (
        <Card className="border-gray-200 border-dashed bg-gray-50">
          <CardContent className="py-20 text-center">
            <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-black mb-2">No Active Study Season</h3>
            <p className="text-gray-500">Activity tracking will appear here once the Admin assigns a new book.</p>
          </CardContent>
        </Card>
      ) : familyMembers.length === 0 ? (
        <Card className="border-green-200 border-dashed bg-white">
          <CardContent className="py-20 text-center">
            <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-green-100">
               <User className="w-10 h-10 text-green-600" />
            </div>
            <h3 className="text-xl font-bold text-black mb-2">No Family Members Found</h3>
            <p className="text-gray-500">Register children in the Parent Dashboard to track their activities.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="border-green-200 shadow-sm bg-white">
            <CardHeader className="border-b border-gray-100 pb-4">
              <CardTitle className="text-black">Select Family Member</CardTitle>
              <CardDescription className="text-gray-500">Choose a member to view their detailed activities</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {familyMembers.map((member) => (
                  <button
                    key={member.id}
                    onClick={() => setSelectedMember(member)}
                    className={`p-4 rounded-xl border transition-all text-left flex items-center gap-4 ${
                      selectedMember?.id === member.id
                        ? "border-green-600 bg-green-50 shadow-md scale-[1.02] ring-1 ring-green-600"
                        : "border-gray-200 hover:border-green-400 hover:bg-gray-50"
                    }`}
                  >
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${
                       selectedMember?.id === member.id ? "bg-green-600 text-white" : "bg-gray-100 text-gray-700"
                    }`}>
                      {member.name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-black truncate">{member.name}</p>
                        {member.role === 'parent' && <Badge variant="outline" className="text-[10px] h-5 px-1.5 bg-black text-white border-none font-bold">Parent</Badge>}
                      </div>
                      <p className="text-xs text-gray-500 truncate font-mono mt-0.5">{member.email}</p>
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {selectedMember && (
            <div className={`transition-opacity duration-300 ${loadingStats ? 'opacity-50' : 'opacity-100'}`}>
              
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard 
                  icon={BookOpen} 
                  value={`${memberStats?.readings.completed || 0}/${memberStats?.readings.total || 0}`} 
                  label="Readings" 
                  progress={memberStats ? (memberStats.readings.completed / memberStats.readings.total) * 100 : 0} 
                  color="green"
                />
                <MetricCard 
                  icon={Award} 
                  value={`${memberStats?.quizzes.score || 0}%`} 
                  label="Avg Score" 
                  progress={memberStats?.quizzes.score || 0} 
                  color="black"
                />
                <MetricCard 
                  icon={Mic} 
                  value={memberStats?.recordings || 0} 
                  label="Read Alouds" 
                  progress={memberStats ? (memberStats.recordings / memberStats.readings.total) * 100 : 0} 
                  color="green"
                />
                <MetricCard 
                  icon={MessageSquare} 
                  value={memberStats?.questions.length || 0} 
                  label="Questions Asked" 
                  progress={100} 
                  color="gray"
                />
              </div>

              <Card className="border-green-200 shadow-sm mt-6 bg-white">
                <CardHeader className="border-b border-gray-100 pb-4">
                  <CardTitle className="text-xl text-black">{selectedMember.name}'s Activity Details</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <Tabs defaultValue="progress" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 md:grid-cols-3 mb-6 bg-gray-50 p-1 rounded-xl border border-gray-200">
                      <TabsTrigger value="progress" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:shadow-sm font-bold">Progress Chart</TabsTrigger>
                      <TabsTrigger value="questions" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:shadow-sm font-bold">Questions</TabsTrigger>
                      <TabsTrigger value="quizzes" className="hidden md:block rounded-lg data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:shadow-sm font-bold">Quiz Results</TabsTrigger>
                    </TabsList>

                    <TabsContent value="progress" className="space-y-4">
                      <div className="p-4 bg-white border border-gray-100 rounded-xl shadow-sm h-[350px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0fdf4" />
                            <XAxis dataKey="activity" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                            <Tooltip cursor={{fill: 'transparent'}} contentStyle={{borderRadius: '8px', border: '1px solid #e2e8f0'}} />
                            <Legend wrapperStyle={{ paddingTop: '20px' }} />
                            <Bar dataKey="completed" fill="#16a34a" name="Completed" radius={[4, 4, 0, 0]} maxBarSize={60} />
                            <Bar dataKey="total" fill="#000000" name="Total Target" radius={[4, 4, 0, 0]} maxBarSize={60} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </TabsContent>

                    <TabsContent value="questions" className="space-y-4">
                      {memberStats?.questions.length === 0 ? (
                        <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50">
                          <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                          <p className="text-gray-500 font-medium">No questions asked yet.</p>
                        </div>
                      ) : (
                        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                          {memberStats?.questions.map((q) => (
                            <div key={q.id} className="p-5 bg-white rounded-xl border border-gray-200 shadow-sm hover:border-green-300 transition-colors">
                              <div className="flex items-start justify-between gap-4 mb-3">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-2">
                                    <MessageSquare className="w-4 h-4 text-green-600" />
                                    <Badge variant="outline" className={`font-bold ${q.answer ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-100 text-gray-600 border-gray-200"}`}>
                                      {q.answer ? "Answered by Admin" : "Pending Answer"}
                                    </Badge>
                                  </div>
                                  <p className="text-sm font-bold text-black">Q: {q.question}</p>
                                  {q.answer && (
                                    <div className="mt-3 p-4 bg-green-50/50 rounded-xl border border-green-100 text-sm text-black shadow-sm">
                                      <span className="font-black text-green-700">A:</span> {q.answer}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <p className="text-[10px] text-gray-400 font-mono uppercase font-bold tracking-wider">Asked on {new Date(q.created_at).toLocaleDateString()}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </TabsContent>
                    
                    <TabsContent value="quizzes" className="space-y-4">
                      {memberStats?.quizzes.details && memberStats.quizzes.details.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto pr-2">
                          {memberStats.quizzes.details.map((q, idx) => (
                            <div key={idx} className="flex justify-between items-center p-4 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-green-300 transition-colors">
                              <div className="flex items-center gap-3">
                                <div className="p-2 bg-green-50 border border-green-100 rounded-lg text-green-600">
                                  <Award className="w-5 h-5"/>
                                </div>
                                <div>
                                  <p className="font-bold text-black text-sm">{q.quiz_title}</p>
                                </div>
                              </div>
                              <Badge className="bg-black text-white text-sm font-black border-none px-3">{q.score}%</Badge>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50">
                          <Award className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                          <p className="text-gray-500 font-medium">No quizzes completed yet.</p>
                        </div>
                      )}
                    </TabsContent>

                  </Tabs>
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// --- Sub-Component ---
function MetricCard({ icon: Icon, value, label, progress, color }: any) {
  const getColors = () => {
    switch(color) {
      case 'green': return { bg: 'bg-green-50', text: 'text-green-600', fill: '[&>div]:bg-green-600', barBg: 'bg-gray-100' };
      case 'black': return { bg: 'bg-gray-100', text: 'text-black', fill: '[&>div]:bg-black', barBg: 'bg-gray-200' };
      case 'gray': return { bg: 'bg-gray-50', text: 'text-gray-500', fill: '[&>div]:bg-gray-400', barBg: 'bg-gray-200' };
      default: return { bg: 'bg-green-50', text: 'text-green-600', fill: '[&>div]:bg-green-600', barBg: 'bg-gray-100' };
    }
  };
  
  const colors = getColors();

  return (
    <Card className="border-gray-200 shadow-sm bg-white hover:border-green-300 transition-colors">
      <CardContent className="pt-6">
        <div className="flex items-center gap-4">
          <div className={`p-3 ${colors.bg} rounded-xl`}>
            <Icon className={`w-6 h-6 ${colors.text}`} />
          </div>
          <div>
            <p className="text-2xl font-black text-black">{value}</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mt-1">{label}</p>
          </div>
        </div>
        <Progress value={progress} className={`mt-4 h-2 ${colors.barBg} ${colors.fill}`} />
      </CardContent>
    </Card>
  );
}