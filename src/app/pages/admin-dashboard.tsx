import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { 
  Users, BookOpen, Calendar, 
  MessageSquare, UserCheck, Settings, FolderTree, Loader2, Mic, Award
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, LineChart, Line 
} from "recharts";
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
  parentLessons: number; // Updated label
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
  
  // Overall Community Stats
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
  
  // State to hold real-time chart data
  const [chartData, setChartData] = useState<any[]>([]);

  useEffect(() => {
    fetchDashboardData();

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
      const today = new Date();
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const startStr = `${startOfMonth.getFullYear()}-${String(startOfMonth.getMonth() + 1).padStart(2, '0')}-01`;

      const { data: adminStats, error: statsError } = await supabase
        .from('admin_stats')
        .select('*')
        .single();

      if (statsError) {
        console.error("Error loading admin_stats view:", statsError);
      }

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
          
          // This counts actual uploaded MP3s by the parents
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
            parentLessons: voiceRecordings, // Updated variable
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

  const totalCommunity = stats.members + stats.parents + stats.admins;
  const safeTotal = Math.max(1, totalCommunity);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <Loader2 className="w-10 h-10 animate-spin text-green-600 mb-4" />
        <p className="text-muted-foreground animate-pulse">Gathering community insights...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-green-600 to-green-500 rounded-xl p-8 text-white shadow-md flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold">Admin Dashboard</h2>
          <p className="opacity-90 mt-1 font-medium">Monitoring the spiritual growth of the congregation.</p>
        </div>
        <Settings className="w-16 h-16 opacity-20 hidden md:block" />
      </div>

      {/* Metric Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Custom Community Breakdown Card */}
        <Card className="border-green-100 shadow-sm hover:bg-green-50/20 transition-all">
          <CardContent className="pt-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Total Community</p>
                <p className="text-3xl font-bold text-gray-800">
                  {totalCommunity}
                </p>
              </div>
              <Users className="w-8 h-8 text-green-200" />
            </div>
            
            <div className="space-y-2 mt-4">
              <div className="flex w-full h-2 rounded-full overflow-hidden bg-gray-100">
                <div style={{ width: `${(stats.members / safeTotal) * 100}%` }} className="bg-green-500 transition-all duration-500" />
                <div style={{ width: `${(stats.parents / safeTotal) * 100}%` }} className="bg-blue-500 transition-all duration-500" />
                <div style={{ width: `${(stats.admins / safeTotal) * 100}%` }} className="bg-purple-500 transition-all duration-500" />
              </div>
              <div className="flex justify-between text-[10px] font-medium text-gray-500 pt-1">
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-500" /> {stats.members} Mbrs
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-500" /> {stats.parents} Prnts
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-purple-500" /> {stats.admins} Admns
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
          label="Avg. Attendance" 
          value={`${stats.attendanceRate}%`} 
          icon={UserCheck} 
          sub="Rate for current month" 
        />
      </div>

      {/* Quick Action Navigation */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <ActionButton 
          icon={FolderTree} 
          title="Families" 
          desc="Assign parents to members" 
          onClick={() => navigate("/app/family-management")} 
        />
        <ActionButton 
          icon={BookOpen} 
          title="Controls" 
          desc="Quizzes & Readings" 
          onClick={() => navigate("/app/admin-controls")} 
        />
        <ActionButton 
          icon={UserCheck} 
          title="Attendance" 
          desc="Mark Saturday gathering" 
          onClick={() => navigate("/app/attendance")} 
        />
        <ActionButton 
          icon={MessageSquare} 
          title="Questions" 
          desc={`Resolve ${stats.pendingQuestions} items`} 
          onClick={() => navigate("/app/questions")} 
          highlight={stats.pendingQuestions > 0}
        />
      </div>

      {/* Family Performance Overview Table */}
      <Card className="border-green-100 shadow-sm overflow-hidden">
        <CardHeader className="bg-gray-50/50 border-b border-gray-100 pb-4">
          <CardTitle className="text-lg text-gray-900">Family Performance Overview</CardTitle>
          <CardDescription>Aggregated metrics for all registered households (Parents + Children)</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-[10px] text-gray-500 uppercase tracking-widest bg-gray-50">
                <tr>
                  <th className="px-6 py-4 font-bold whitespace-nowrap">Family Name</th>
                  <th className="px-6 py-4 font-bold text-center whitespace-nowrap">Total Members</th>
                  <th className="px-6 py-4 font-bold text-center whitespace-nowrap">Readings Done</th>
                  <th className="px-6 py-4 font-bold text-center whitespace-nowrap">Parent Lessons</th>
                  <th className="px-6 py-4 font-bold text-center whitespace-nowrap">Avg Quiz Score</th>
                  <th className="px-6 py-4 font-bold text-center whitespace-nowrap">Attendance</th>
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
                    <tr key={family.id} className="hover:bg-green-50/30 transition-colors">
                      <td className="px-6 py-4 font-bold text-gray-900 whitespace-nowrap">{family.name}</td>
                      <td className="px-6 py-4 text-center">
                        <Badge variant="outline" className="bg-gray-50 text-gray-700">{family.memberCount}</Badge>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-1.5 text-green-700 font-medium">
                          <BookOpen className="w-4 h-4 opacity-50" />
                          {family.readingsCompleted}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-1.5 text-blue-700 font-medium">
                          <Mic className="w-4 h-4 opacity-50" />
                          {family.parentLessons}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-1.5 text-amber-700 font-medium">
                          <Award className="w-4 h-4 opacity-50" />
                          {family.avgQuizScore}%
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-1.5 text-purple-700 font-medium">
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
      <Card className="border-green-100 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Engagement Trends</CardTitle>
          <CardDescription>Activity levels across the last 4 weeks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
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
                <Line type="monotone" dataKey="readings" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} name="Readings" />
                <Line type="monotone" dataKey="quizzes" stroke="#34d399" strokeWidth={3} dot={{ r: 4 }} name="Quizzes" />
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
    <Card className={`border-green-100 shadow-sm transition-all ${alert ? "border-amber-300 bg-amber-50/50" : "hover:bg-green-50/20"}`}>
      <CardContent className="pt-6">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">{label}</p>
            <p className="text-3xl font-bold text-gray-800">{value}</p>
            <p className="text-[11px] text-muted-foreground mt-2 font-medium">{sub}</p>
          </div>
          <Icon className={`w-8 h-8 ${alert ? "text-amber-500 animate-pulse" : "text-green-200"}`} />
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
      className={`h-auto flex flex-col items-start p-6 space-y-2 border-green-100 hover:border-green-300 hover:bg-green-50 transition-all text-left w-full ${
        highlight ? "ring-2 ring-green-500 ring-offset-4 bg-green-50/50" : ""
      }`}
    >
      <Icon className="w-6 h-6 text-green-600" />
      <div>
        <p className="font-bold text-gray-900">{title}</p>
        <p className="text-xs text-muted-foreground leading-snug mt-1">{desc}</p>
      </div>
    </Button>
  );
}