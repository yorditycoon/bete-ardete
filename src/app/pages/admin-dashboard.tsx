import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { 
  Users, BookOpen, Calendar, 
  MessageSquare, UserCheck, Settings, FolderTree, Loader2, Mic, Award,
  ShieldCheck, CheckSquare, Video, Presentation,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { BarChart, Bar,Line, XAxis, LineChart, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

import { useNavigate } from "react-router";

// --- TypeScript Interfaces ---
interface DashboardStats {
  members: number;
  parents: number;
  admins: number;
  pendingQuestions: number;
  upcomingEvents: number;
  attendanceRate: number;
}

interface FamilyStat {
  id: string;
  name: string;
  memberCount: number;
  readingsCompleted: number;
  parentLessons: number; 
  avgQuizScore: number;
  attendanceRate: number;
}

interface ActionButtonProps {
  icon: React.ElementType;
  title: string;
  desc: string;
  onClick: () => void;
  highlight?: boolean;
}

interface MetricCardProps {
  label: string;
  value: string | number;
  icon: React.ElementType;
  sub: string;
  alert?: boolean;
}

export function AdminDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  
  // Admin Profile State
  const [profile, setProfile] = useState<any>(null);

  // Overall Community Stats (For IT Admin)
  const [stats, setStats] = useState<DashboardStats>({
    members: 0,
    parents: 0,
    admins: 0,
    pendingQuestions: 0,
    upcomingEvents: 0,
    attendanceRate: 0
  });

  // Stats aggregated by Family
  const [familyStats, setFamilyStats] = useState<FamilyStat[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);

  useEffect(() => {
    fetchDashboardData();

    // Only subscribe to realtime if they stay on this page
    const channel = supabase.channel('admin-stats-realtime')
      .on('postgres_changes', { event: '*', schema: 'public' }, () => {
        fetchDashboardData();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  async function fetchDashboardData() {
    setLoading(true);
    try {
      // 1. Fetch current user profile to determine Department
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return navigate("/");

      const { data: userProfile, error: profileError } = await supabase
        .from('profiles')
        .select('*, departments(name_en, name_am)')
        .eq('id', user.id)
        .single();

      if (profileError) throw profileError;
      setProfile(userProfile);

      // If they are a Department Head, we don't need to load the massive IT stats
      if (userProfile.department_id) {
        setLoading(false);
        return; 
      }

      // 2. Fetch IT Super Admin Stats
      const today = new Date();
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const startStr = `${startOfMonth.getFullYear()}-${String(startOfMonth.getMonth() + 1).padStart(2, '0')}-01`;

      const { data: adminStats } = await supabase.from('admin_stats').select('*').single();

      const [
        { data: allFamilies },
        { data: allProfiles }, 
        { data: allReadings },
        { data: allQuizzes },
        { data: allAttendance }
      ] = await Promise.all([
        supabase.from('families').select('id, name'),
        supabase.from('profiles').select('id, family_id, role'),
        supabase.from('reading_progress').select('user_id, is_completed, voice_recording_url, completed_at'),
        supabase.from('quiz_scores').select('user_id, score, created_at'),
        supabase.from('attendance').select('user_id, present, attendance_date').gte('attendance_date', startStr)
      ]);

      const safeAttendance = allAttendance || [];
      const overallRate = safeAttendance.length > 0
        ? Math.round((safeAttendance.filter(a => a.present).length / safeAttendance.length) * 100)
        : 0;

      const adminsCount = (allProfiles || []).filter(p => p.role === 'admin').length;

      setStats({
        members: adminStats?.member_count || 0,
        parents: adminStats?.parent_count || 0,
        admins: adminsCount,
        pendingQuestions: adminStats?.pending_questions || 0,
        upcomingEvents: adminStats?.upcoming_events || 0,
        attendanceRate: overallRate
      });

      if (allFamilies) {
        const aggregatedFamilies = allFamilies.map(family => {
          const fProfiles = (allProfiles || []).filter(p => p.family_id === family.id);
          const profileIds = fProfiles.map(p => p.id);

          const fReadings = (allReadings || []).filter(r => profileIds.includes(r.user_id));
          const completedReadings = fReadings.filter(r => r.is_completed).length;
          const voiceRecordings = fReadings.filter(r => r.voice_recording_url).length;

          const fQuizzes = (allQuizzes || []).filter(q => profileIds.includes(q.user_id));
          const avgQuiz = fQuizzes.length > 0
            ? Math.round(fQuizzes.reduce((acc, q) => acc + q.score, 0) / fQuizzes.length)
            : 0;

          const fAttendance = safeAttendance.filter(a => profileIds.includes(a.user_id));
          const attRate = fAttendance.length > 0
            ? Math.round((fAttendance.filter(a => a.present).length / fAttendance.length) * 100)
            : 0;

          return {
            id: family.id,
            name: family.name,
            memberCount: fProfiles.length,
            readingsCompleted: completedReadings,
            parentLessons: voiceRecordings,
            avgQuizScore: avgQuiz,
            attendanceRate: attRate
          };
        });

        setFamilyStats(aggregatedFamilies.sort((a, b) => b.readingsCompleted - a.readingsCompleted));
      }

      const now = new Date();
      const buckets = [
        { week: "Week 1", readings: 0, quizzes: 0, start: new Date(now.getTime() - 28 * 24*60*60*1000), end: new Date(now.getTime() - 21 * 24*60*60*1000) },
        { week: "Week 2", readings: 0, quizzes: 0, start: new Date(now.getTime() - 21 * 24*60*60*1000), end: new Date(now.getTime() - 14 * 24*60*60*1000) },
        { week: "Week 3", readings: 0, quizzes: 0, start: new Date(now.getTime() - 14 * 24*60*60*1000), end: new Date(now.getTime() - 7 * 24*60*60*1000) },
        { week: "Week 4", readings: 0, quizzes: 0, start: new Date(now.getTime() - 7 * 24*60*60*1000), end: now },
      ];

      (allReadings || []).forEach(r => {
        if (r.is_completed && r.completed_at) {
          const d = new Date(r.completed_at);
          const bucket = buckets.find(b => d >= b.start && d <= b.end);
          if (bucket) bucket.readings++;
        }
      });

      (allQuizzes || []).forEach(q => {
        if (q.created_at) {
          const d = new Date(q.created_at);
          const bucket = buckets.find(b => d >= b.start && d <= b.end);
          if (bucket) bucket.quizzes++;
        }
      });

      setChartData(buckets.map(b => ({ week: b.week, readings: b.readings, quizzes: b.quizzes })));

    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <Loader2 className="w-10 h-10 animate-spin text-green-600 mb-4" />
        <p className="text-muted-foreground animate-pulse">Loading dashboard...</p>
      </div>
    );
  }

  const departmentName = profile?.departments?.name_en;

  // ==========================================
  // 1. EDUCATION DEPARTMENT VIEW (Fallback)
  // ==========================================
  if (departmentName === "Education") {
    return (
      <div className="space-y-6 max-w-6xl mx-auto pb-12">
        <div className="bg-white rounded-xl p-8 border border-green-200 shadow-sm">
          <h2 className="text-3xl font-black text-black flex items-center gap-2">
            <BookOpen className="w-8 h-8 text-green-600" /> Education Department
          </h2>
          <p className="text-gray-600 font-medium mt-2">Manage curriculum, study books, and quizzes.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="border-green-200 shadow-sm hover:border-green-400 transition-colors cursor-pointer bg-white" onClick={() => navigate("/app/admin-controls")}>
            <CardContent className="p-6 flex items-center gap-4">
              <div className="p-4 bg-green-50 rounded-xl border border-green-100"><BookOpen className="w-8 h-8 text-green-600" /></div>
              <div>
                <CardTitle className="text-xl text-black">Curriculum Manager</CardTitle>
                <p className="text-sm text-gray-500 mt-1">Create books and reading assignments.</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-green-200 shadow-sm hover:border-green-400 transition-colors cursor-pointer bg-white" onClick={() => navigate("/app/quiz")}>
            <CardContent className="p-6 flex items-center gap-4">
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200"><CheckSquare className="w-8 h-8 text-black" /></div>
              <div>
                <CardTitle className="text-xl text-black">Quiz & Grades</CardTitle>
                <p className="text-sm text-gray-500 mt-1">Review knowledge checks and test scores.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ==========================================
  // 2. MEDIA DEPARTMENT VIEW (Fallback)
  // ==========================================
  if (departmentName === "Media") {
    return (
      <div className="space-y-6 max-w-6xl mx-auto pb-12">
        <div className="bg-white rounded-xl p-8 border border-green-200 shadow-sm">
          <h2 className="text-3xl font-black text-black flex items-center gap-2">
            <Video className="w-8 h-8 text-green-600" /> Media Department
          </h2>
          <p className="text-gray-600 font-medium mt-2">Manage camera schedules, live streams, and content.</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="border-green-200 shadow-sm bg-white">
            <CardContent className="p-6 flex items-center gap-4 opacity-70">
              <div className="p-4 bg-green-50 rounded-xl border border-green-100"><Presentation className="w-8 h-8 text-green-600" /></div>
              <div>
                <CardTitle className="text-xl text-black">Stream Schedule</CardTitle>
                <p className="text-sm text-gray-500 mt-1">Media tools coming soon.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ==========================================
  // 3. FALLBACK DEPARTMENTS
  // ==========================================
  if (departmentName) {
    return (
      <div className="space-y-6 max-w-6xl mx-auto pb-12">
        <div className="bg-white rounded-xl p-8 border border-gray-200 shadow-sm">
          <h2 className="text-3xl font-black text-black">{profile.departments?.name_en} Department</h2>
          <p className="text-gray-600 font-medium mt-2">{profile.departments?.name_am}</p>
        </div>
        <Card className="border-gray-200 shadow-sm text-center py-12 bg-white">
          <Settings className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <CardTitle className="text-xl text-black">Workspace Under Construction</CardTitle>
          <p className="text-gray-500 mt-2">Custom tools for this department are being developed.</p>
        </Card>
      </div>
    );
  }

  // ==========================================
  // 4. IT SUPER ADMIN VIEW (Fully Styled Theme)
  // ==========================================
  const totalCommunity = stats.members + stats.parents + stats.admins;
  const safeTotal = Math.max(1, totalCommunity);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-in fade-in duration-500">
      {/* Welcome Banner */}
      <div className="bg-black rounded-xl p-8 text-white shadow-md flex justify-between items-center border border-gray-800">
        <div>
          <h2 className="text-3xl font-black flex items-center gap-2">
            <ShieldCheck className="w-8 h-8 text-green-500" /> System IT Control
          </h2>
          <p className="text-gray-400 font-medium mt-2">Global administration and department assignments.</p>
        </div>
        <Settings className="w-16 h-16 text-gray-800 hidden md:block" />
      </div>

      {/* Metric Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Custom Community Breakdown Card */}
        <Card className="border-gray-200 shadow-sm bg-white hover:border-green-300 transition-all">
          <CardContent className="pt-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">Total Community</p>
                <p className="text-3xl font-black text-black">
                  {totalCommunity}
                </p>
              </div>
              <Users className="w-8 h-8 text-green-100" />
            </div>
            
            <div className="space-y-2 mt-4">
              <div className="flex w-full h-2 rounded-full overflow-hidden bg-gray-100">
                <div style={{ width: `${(stats.parents / safeTotal) * 100}%` }} className="bg-black transition-all duration-500" />
                <div style={{ width: `${(stats.members / safeTotal) * 100}%` }} className="bg-green-600 transition-all duration-500" />
                <div style={{ width: `${(stats.admins / safeTotal) * 100}%` }} className="bg-gray-400 transition-all duration-500" />
              </div>
              <div className="flex justify-between text-[10px] font-bold text-gray-500 pt-1">
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-black" /> {stats.parents} Ldrs
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-600" /> {stats.members} Mbrs
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-gray-400" /> {stats.admins} IT
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <MetricCard 
          label="Upcoming Events" 
          value={stats.upcomingEvents} 
          icon={Calendar} 
          sub="Scheduled gatherings" 
        />
        <MetricCard 
          label="Pending Q&A" 
          value={stats.pendingQuestions} 
          icon={MessageSquare} 
          sub="Doubts needing answers" 
          alert={stats.pendingQuestions > 0}
        />
        <MetricCard 
          label="Global Attendance" 
          value={`${stats.attendanceRate}%`} 
          icon={UserCheck} 
          sub="Rate for current month" 
        />
      </div>

      {/* Quick Action Navigation */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <ActionButton 
          icon={Users} 
          title="Directory" 
          desc="Assign department roles" 
          onClick={() => navigate("/app/directory")} 
          highlight
        />
        <ActionButton 
          icon={FolderTree} 
          title="Families" 
          desc="Manage household groups" 
          onClick={() => navigate("/app/family-management")} 
        />
        <ActionButton 
          icon={UserCheck} 
          title="Saturday Service" 
          desc="Mark congregation attendance" 
          onClick={() => navigate("/app/attendance")} 
        />
        <ActionButton 
          icon={MessageSquare} 
          title="Questions" 
          desc={`Resolve ${stats.pendingQuestions} items`} 
          onClick={() => navigate("/app/questions")} 
        />
      </div>

      {/* Family Performance Overview Table */}
      <Card className="border-gray-200 shadow-sm overflow-hidden bg-white">
        <CardHeader className="bg-gray-50/50 border-b border-gray-100 pb-4">
          <CardTitle className="text-lg text-black">Family Performance Overview</CardTitle>
          <CardDescription>Aggregated metrics for all registered households</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="text-[10px] text-gray-500 uppercase tracking-widest bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4 font-bold">Family Name</th>
                  <th className="px-6 py-4 font-bold text-center">Total Members</th>
                  <th className="px-6 py-4 font-bold text-center">Readings Done</th>
                  <th className="px-6 py-4 font-bold text-center">Parent Lessons</th>
                  <th className="px-6 py-4 font-bold text-center">Avg Quiz Score</th>
                  <th className="px-6 py-4 font-bold text-center">Attendance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {familyStats.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-gray-500 italic">
                      No families registered yet.
                    </td>
                  </tr>
                ) : (
                  familyStats.map((family) => (
                    <tr key={family.id} className="hover:bg-green-50/50 transition-colors">
                      <td className="px-6 py-4 font-bold text-black">{family.name}</td>
                      <td className="px-6 py-4 text-center">
                        <Badge variant="outline" className="bg-gray-50 text-black border-gray-200">{family.memberCount}</Badge>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-1.5 text-green-700 font-bold">
                          <BookOpen className="w-4 h-4 text-green-600 opacity-50" />
                          {family.readingsCompleted}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-1.5 text-black font-bold">
                          <Mic className="w-4 h-4 opacity-50" />
                          {family.parentLessons}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-1.5 text-gray-600 font-bold">
                          <Award className="w-4 h-4 opacity-50" />
                          {family.avgQuizScore}%
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-1.5 text-black font-bold">
                          <UserCheck className="w-4 h-4 opacity-50" />
                          {family.attendanceRate}%
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Trends Chart */}
      <Card className="border-gray-200 shadow-sm bg-white">
        <CardHeader>
          <CardTitle className="text-lg text-black">Global Education Engagement</CardTitle>
          <CardDescription>Activity levels across the last 4 weeks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0fdf4" />
                <XAxis 
                  dataKey="week" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fill: '#64748b' }} 
                  dy={10} 
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fill: '#64748b' }} 
                />
                <Tooltip 
                   contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                />
                <Legend iconType="circle" />
                <Line type="monotone" dataKey="readings" stroke="#16a34a" strokeWidth={3} dot={{ r: 4 }} name="Readings" />
                <Line type="monotone" dataKey="quizzes" stroke="#000000" strokeWidth={3} dot={{ r: 4 }} name="Quizzes" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// --- Sub-Components ---
function MetricCard({ label, value, icon: Icon, sub, alert = false }: MetricCardProps) {
  return (
    <Card className={`border-gray-200 shadow-sm transition-all bg-white hover:border-green-300 ${alert ? "border-red-200 ring-1 ring-red-100" : ""}`}>
      <CardContent className="pt-6">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">{label}</p>
            <p className={`text-3xl font-black ${alert ? "text-red-600" : "text-black"}`}>{value}</p>
            <p className="text-[11px] text-gray-400 mt-2 font-medium">{sub}</p>
          </div>
          <Icon className={`w-8 h-8 ${alert ? "text-red-500 animate-pulse" : "text-green-100"}`} />
        </div>
      </CardContent>
    </Card>
  );
}

function ActionButton({ icon: Icon, title, desc, onClick, highlight = false }: ActionButtonProps) {
  return (
    <Button 
      variant="outline" 
      onClick={onClick}
      className={`h-auto flex flex-col items-start p-6 space-y-2 border-gray-200 transition-all text-left w-full ${
        highlight 
          ? "ring-2 ring-green-600 ring-offset-2 bg-green-50 border-green-200 hover:bg-green-100" 
          : "hover:border-green-400 hover:bg-green-50/50 bg-white"
      }`}
    >
      <Icon className={`w-6 h-6 ${highlight ? "text-green-600" : "text-black"}`} />
      <div>
        <p className="font-bold text-black">{title}</p>
        <p className="text-xs text-gray-500 font-medium leading-snug mt-1">{desc}</p>
      </div>
    </Button>
  );
}