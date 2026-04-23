import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Progress } from "../components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { 
  User, BookOpen, Award, Mic, MessageSquare,
  TrendingUp, CheckCircle, Loader2, BookMarked
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

      // THE FIX: Since the Read Aloud mic button is mandatory to finish a reading,
      // the number of "Read Alouds" they have done equals their completed readings!
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
        recordings: readAloudsCompleted, // Updated logic here
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
        <p className="text-muted-foreground animate-pulse">Loading family activities...</p>
      </div>
    );
  }

  const chartData = memberStats ? [
    { id: "readings", activity: "Readings", completed: memberStats.readings.completed, total: memberStats.readings.total },
    { id: "quizzes", activity: "Quizzes Taken", completed: memberStats.quizzes.totalTaken, total: memberStats.quizzes.totalAvailable },
    { id: "recordings", activity: "Read Alouds", completed: memberStats.recordings, total: memberStats.readings.total }, // Updated Label
  ] : [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="bg-gradient-to-r from-green-100 to-green-50 rounded-xl p-8 border border-green-200 shadow-sm flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Family Activities</h2>
          <p className="text-gray-600 font-medium">Monitor your family members' spiritual progress</p>
        </div>
        {activeBook && (
          <Badge variant="outline" className="hidden md:flex items-center gap-2 bg-white/80 border-green-300 text-green-800 px-4 py-2 text-sm shadow-sm">
            <BookMarked className="w-4 h-4 text-green-600" />
            Current Study: {activeBook.title}
          </Badge>
        )}
      </div>

      {!activeBook ? (
        <Card className="border-gray-200 border-dashed">
          <CardContent className="py-20 text-center">
            <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-900 mb-2">No Active Study Season</h3>
            <p className="text-muted-foreground">Activity tracking will appear here once the Admin assigns a new book.</p>
          </CardContent>
        </Card>
      ) : familyMembers.length === 0 ? (
        <Card className="border-green-200 border-dashed">
          <CardContent className="py-20 text-center">
            <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
               <User className="w-10 h-10 text-green-300" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">No Family Members Found</h3>
            <p className="text-muted-foreground">Register children in the Parent Dashboard to track their activities.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="border-green-100 shadow-sm">
            <CardHeader>
              <CardTitle>Select Family Member</CardTitle>
              <CardDescription>Choose a member to view their detailed activities</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {familyMembers.map((member) => (
                  <button
                    key={member.id}
                    onClick={() => setSelectedMember(member)}
                    className={`p-4 rounded-xl border transition-all text-left flex items-center gap-4 ${
                      selectedMember?.id === member.id
                        ? "border-green-500 bg-green-50 shadow-md scale-[1.02]"
                        : "border-gray-100 hover:border-green-300 hover:bg-gray-50"
                    }`}
                  >
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${
                       selectedMember?.id === member.id ? "bg-green-600 text-white" : "bg-green-100 text-green-700"
                    }`}>
                      {member.name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-gray-900 truncate">{member.name}</p>
                        {member.role === 'parent' && <Badge variant="outline" className="text-[10px] h-5 px-1.5 bg-green-200 text-green-800 border-none">Parent</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground truncate font-mono">{member.email}</p>
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
                />
                <MetricCard 
                  icon={Award} 
                  value={`${memberStats?.quizzes.score || 0}%`} 
                  label="Avg Score" 
                  progress={memberStats?.quizzes.score || 0} 
                />
                <MetricCard 
                  icon={Mic} 
                  value={memberStats?.recordings || 0} 
                  label="Read Alouds" 
                  progress={memberStats ? (memberStats.recordings / memberStats.readings.total) * 100 : 0} 
                />
                <MetricCard 
                  icon={MessageSquare} 
                  value={memberStats?.questions.length || 0} 
                  label="Questions Asked" 
                  progress={100} 
                />
              </div>

              <Card className="border-green-100 shadow-sm mt-6">
                <CardHeader>
                  <CardTitle className="text-xl">{selectedMember.name}'s Activity Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="progress" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 md:grid-cols-3 mb-6 bg-gray-50/50 p-1 rounded-xl border border-gray-100">
                      <TabsTrigger value="progress" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-green-700 data-[state=active]:shadow-sm">Progress Chart</TabsTrigger>
                      <TabsTrigger value="questions" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-green-700 data-[state=active]:shadow-sm">Questions</TabsTrigger>
                      <TabsTrigger value="quizzes" className="hidden md:block rounded-lg data-[state=active]:bg-white data-[state=active]:text-green-700 data-[state=active]:shadow-sm">Quiz Results</TabsTrigger>
                    </TabsList>

                    <TabsContent value="progress" className="space-y-4">
                      <div className="p-4 bg-white border border-gray-100 rounded-xl shadow-sm">
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0fdf4" />
                            <XAxis dataKey="activity" axisLine={false} tickLine={false} />
                            <YAxis axisLine={false} tickLine={false} />
                            <Tooltip cursor={{fill: 'transparent'}} contentStyle={{borderRadius: '8px', border: '1px solid #e2e8f0'}} />
                            <Legend />
                            <Bar dataKey="completed" fill="#22c55e" name="Completed" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="total" fill="#bbf7d0" name="Total Target" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </TabsContent>

                    <TabsContent value="questions" className="space-y-4">
                      {memberStats?.questions.length === 0 ? (
                        <p className="text-center text-gray-500 py-8 italic">No questions asked yet.</p>
                      ) : (
                        <div className="space-y-3">
                          {memberStats?.questions.map((q) => (
                            <div key={q.id} className="p-5 bg-white rounded-xl border border-gray-100 shadow-sm hover:border-green-200 transition-colors">
                              <div className="flex items-start justify-between gap-4 mb-3">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-2">
                                    <MessageSquare className="w-4 h-4 text-green-600" />
                                    <Badge variant="outline" className={q.answer ? "bg-green-50 text-green-700 border-green-200" : "bg-amber-50 text-amber-700 border-amber-200"}>
                                      {q.answer ? "Answered by Admin" : "Pending Answer"}
                                    </Badge>
                                  </div>
                                  <p className="text-sm font-bold text-gray-900">Q: {q.question}</p>
                                  {q.answer && (
                                    <div className="mt-3 p-3 bg-green-50/50 rounded-lg border border-green-100 text-sm text-gray-700">
                                      <span className="font-bold text-green-800">A:</span> {q.answer}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <p className="text-[10px] text-gray-400 font-mono uppercase">Asked on {new Date(q.created_at).toLocaleDateString()}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </TabsContent>
                    
                    <TabsContent value="quizzes" className="space-y-4">
                      {memberStats?.quizzes.details && memberStats.quizzes.details.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {memberStats.quizzes.details.map((q, idx) => (
                            <div key={idx} className="flex justify-between items-center p-4 bg-white border border-gray-100 rounded-xl shadow-sm hover:border-green-200 transition-colors">
                              <div className="flex items-center gap-3">
                                <div className="p-2 bg-green-50 rounded-lg text-green-600">
                                  <Award className="w-5 h-5"/>
                                </div>
                                <div>
                                  <p className="font-bold text-gray-900 text-sm">{q.quiz_title}</p>
                                </div>
                              </div>
                              <Badge className="bg-green-100 text-green-800 text-sm font-black border border-green-200">{q.score}%</Badge>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-center text-gray-500 py-8 italic">No quizzes completed yet.</p>
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
function MetricCard({ icon: Icon, value, label, progress }: any) {
  return (
    <Card className="border-green-100 shadow-sm">
      <CardContent className="pt-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-green-50 rounded-xl">
            <Icon className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <p className="text-2xl font-black text-gray-900">{value}</p>
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
          </div>
        </div>
        <Progress value={progress} className="mt-4 h-2 bg-green-50" />
      </CardContent>
    </Card>
  );
}