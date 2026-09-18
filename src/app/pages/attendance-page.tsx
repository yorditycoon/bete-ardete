import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Checkbox } from "../components/ui/checkbox";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { Calendar } from "../components/ui/calendar";
import { UserCheck, Users, TrendingUp, Loader2, Save, AlertCircle } from "lucide-react";
import { supabase } from "../lib/supabase";
import { toast } from "sonner";
import { format } from "date-fns";

export function AttendancePage() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [members, setMembers] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // Saturday Service Department
  const [saturdayServiceDept, setSaturdayServiceDept] = useState<any>(null);

  // 1. Fetch Members & Attendance for selected date
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      
      try {
        // Find the Saturday Service department
        const { data: satDept, error: deptError } = await supabase
          .from('departments')
          .select('*')
          .ilike('name_en', '%Saturday Service%')
          .single();

        if (deptError || !satDept) {
          toast.error("Could not find the Saturday Service department.");
          setIsLoading(false);
          return;
        }
        setSaturdayServiceDept(satDept);

        // Fetch all members (excluding super admins if needed)
        const { data: membersData } = await supabase
          .from('profiles')
          .select('id, name, email, role')
          .neq('role', 'admin')
          .order('name', { ascending: true });

        setMembers(membersData || []);

        // Fetch existing attendance for this date & department
        const formattedDate = format(selectedDate, 'yyyy-MM-dd');
        const { data: attendanceData } = await supabase
          .from('attendance')
          .select('user_id, present')
          .eq('department_id', satDept.id)
          .eq('attendance_date', formattedDate);

        const attendanceMap: Record<string, boolean> = {};
        attendanceData?.forEach(record => {
          attendanceMap[record.user_id] = record.present;
        });

        setAttendance(attendanceMap);
      } catch (error: any) {
        toast.error("Error loading data: " + error.message);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [selectedDate]);

  const handleToggleAttendance = (userId: string) => {
    setAttendance(prev => ({
      ...prev,
      [userId]: !prev[userId],
    }));
  };

  const handleMarkAllPresent = () => {
    const allPresent: Record<string, boolean> = {};
    members.forEach(m => { allPresent[m.id] = true; });
    setAttendance(allPresent);
  };

  // 2. Save Attendance to Supabase
  const handleSaveAttendance = async () => {
    if (!saturdayServiceDept) return;
    setIsSaving(true);
    const formattedDate = format(selectedDate, 'yyyy-MM-dd');

    const records = members.map(member => ({
      user_id: member.id,
      department_id: saturdayServiceDept.id,
      attendance_date: formattedDate,
      present: !!attendance[member.id]
    }));

    const { error } = await supabase
      .from('attendance')
      .upsert(records, { onConflict: 'user_id, attendance_date, department_id' });

    if (error) {
      toast.error("Failed to save attendance");
      console.error(error);
    } else {
      toast.success(`Attendance for ${formattedDate} saved successfully!`);
    }
    setIsSaving(false);
  };

  const presentCount = Object.values(attendance).filter(Boolean).length;
  const attendanceRate = members.length > 0 ? Math.round((presentCount / members.length) * 100) : 0;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh]">
        <Loader2 className="w-10 h-10 animate-spin text-green-600 mb-4" />
        <p className="text-gray-500 font-medium animate-pulse">Loading attendance records...</p>
      </div>
    );
  }

  if (!saturdayServiceDept) {
    return (
      <div className="text-center p-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 max-w-2xl mx-auto mt-10">
        <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <p className="text-black font-bold text-lg">Configuration Error</p>
        <p className="text-sm text-gray-500 mt-1">The "Saturday Service" department is missing from the database.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12 animate-in fade-in duration-500 px-4 sm:px-6">
      
      {/* HEADER */}
      <div className="bg-white rounded-xl p-6 sm:p-8 border border-green-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-sm">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-black flex items-center gap-2">
            <UserCheck className="w-8 h-8 text-green-600 shrink-0" /> Saturday Service Attendance
          </h2>
          <p className="text-gray-600 font-medium mt-1">Tracking faithful attendance for the whole congregation.</p>
        </div>
      </div>

      {/* STATS ROW */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="border-green-200 shadow-sm bg-white hover:border-green-400 transition-colors">
          <CardContent className="pt-6 flex items-center justify-between">
            <div>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Members Registered</p>
              <p className="text-3xl sm:text-4xl font-black text-black mt-1">{members.length}</p>
            </div>
            <Users className="w-10 h-10 sm:w-12 sm:h-12 text-green-100" />
          </CardContent>
        </Card>
        <Card className="border-green-200 shadow-sm bg-white hover:border-green-400 transition-colors">
          <CardContent className="pt-6 flex items-center justify-between">
            <div>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Attendance Rate</p>
              <p className="text-3xl sm:text-4xl font-black text-green-600 mt-1">{attendanceRate}%</p>
            </div>
            <TrendingUp className="w-10 h-10 sm:w-12 sm:h-12 text-green-100" />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* LEFT SIDE: CALENDAR */}
        <div className="lg:col-span-1 w-full flex justify-center">
          <Card className="border-green-200 shadow-sm bg-white w-full max-w-md lg:max-w-none">
            <CardHeader className="bg-gray-50/50 border-b border-gray-100 pb-4">
              <CardTitle className="text-lg text-black">Gathering Date</CardTitle>
            </CardHeader>
            <CardContent className="flex justify-center p-4 overflow-x-auto">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                className="rounded-md border border-green-200 max-w-full pointer-events-auto"
              />
            </CardContent>
          </Card>
        </div>

        {/* RIGHT SIDE: MEMBER LIST */}
        <div className="lg:col-span-2 w-full">
          <Card className="border-green-200 shadow-sm bg-white flex flex-col h-[550px] sm:h-[600px] w-full">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-100 pb-4 gap-4 flex-none">
              <div>
                <CardTitle className="text-xl text-black">Mark Attendance</CardTitle>
                <CardDescription className="text-green-700 font-medium mt-1">
                  {format(selectedDate, 'PPPP')}
                </CardDescription>
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <Button variant="outline" size="sm" onClick={handleMarkAllPresent} className="flex-1 sm:flex-none border-green-200 text-green-700 hover:bg-green-50 font-bold transition-colors">
                  All Present
                </Button>
                <Button variant="outline" size="sm" onClick={() => setAttendance({})} className="flex-1 sm:flex-none border-gray-200 text-gray-600 hover:bg-gray-50 font-bold transition-colors">
                  Clear
                </Button>
              </div>
            </CardHeader>
            
            <CardContent className="pt-6 flex-1 flex flex-col min-h-0">
              <div className="flex-1 overflow-y-auto space-y-3 pr-1 sm:pr-2">
                {members.length === 0 ? (
                  <p className="text-center text-gray-500 py-12 italic">No members found to track.</p>
                ) : (
                  members.map((member) => (
                    <div key={member.id} className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border transition-colors bg-white shadow-sm gap-3 ${attendance[member.id] ? "border-green-400" : "border-gray-100 hover:border-green-200"}`}>
                      <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                        <Checkbox 
                          id={member.id} 
                          checked={!!attendance[member.id]} 
                          onCheckedChange={() => handleToggleAttendance(member.id)}
                          className="w-5 h-5 text-green-600 border-gray-300 data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600 shrink-0"
                        />
                        <Label htmlFor={member.id} className="cursor-pointer min-w-0 flex-1">
                          <p className="font-bold text-black text-sm sm:text-base truncate">{member.name}</p>
                          <p className="text-xs text-gray-500 mt-0.5 truncate">{member.email || "No email"}</p>
                        </Label>
                      </div>
                      <Badge variant="outline" className={attendance[member.id] ? "bg-green-100 text-green-800 border-green-300 px-3 py-1 font-bold w-fit self-start sm:self-auto shrink-0" : "bg-gray-50 text-gray-500 border-gray-200 px-3 py-1 font-medium w-fit self-start sm:self-auto shrink-0"}>
                        {attendance[member.id] ? "Present" : "Absent"}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
              
              <div className="mt-4 pt-4 border-t border-gray-100 flex-none">
                <Button 
                  onClick={handleSaveAttendance} 
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-bold shadow-md py-5 sm:py-6 text-base sm:text-lg transition-all" 
                  disabled={isSaving || members.length === 0}
                >
                  {isSaving ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Save className="w-5 h-5 mr-2" />} 
                  Save Attendance Record
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}