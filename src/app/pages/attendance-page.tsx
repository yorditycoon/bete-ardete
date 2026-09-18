import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Checkbox } from "../components/ui/checkbox";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { Calendar } from "../components/ui/calendar";
import { UserCheck, Users, TrendingUp, Loader2, Save, AlertCircle, CalendarDays } from "lucide-react";
import { supabase } from "../lib/supabase";
import { toast } from "sonner";
import { format } from "date-fns";

export function AttendancePage() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [members, setMembers] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<Record<string, boolean>>({});
  
  // Split loading states so the calendar doesn't unmount when changing dates!
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isDateLoading, setIsDateLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const [saturdayServiceDept, setSaturdayServiceDept] = useState<any>(null);

  // 1. Initial Load: Fetch Department & Members ONLY ONCE
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const { data: satDept, error: deptError } = await supabase
          .from('departments')
          .select('*')
          .ilike('name_en', '%Saturday Service%')
          .single();

        if (deptError || !satDept) {
          setIsPageLoading(false);
          return; // Shows the error screen below
        }
        
        setSaturdayServiceDept(satDept);

        const { data: membersData } = await supabase
          .from('profiles')
          .select('id, name, email, role')
          .neq('role', 'admin')
          .order('name', { ascending: true });

        setMembers(membersData || []);
      } catch (error: any) {
        toast.error("Error loading data: " + error.message);
      } finally {
        setIsPageLoading(false);
      }
    };

    loadInitialData();
  }, []);

  // 2. Date Change: Fetch Attendance ONLY when the date changes
  useEffect(() => {
    const loadAttendanceForDate = async () => {
      if (!saturdayServiceDept) return;
      
      setIsDateLoading(true); // Only show subtle list loader
      try {
        const formattedDate = format(selectedDate, 'yyyy-MM-dd');
        const { data: attendanceData } = await supabase
          .from('attendance')
          .select('user_id, present')
          .eq('department_id', saturdayServiceDept.id)
          .eq('attendance_date', formattedDate);

        const attendanceMap: Record<string, boolean> = {};
        attendanceData?.forEach(record => {
          attendanceMap[record.user_id] = record.present;
        });

        setAttendance(attendanceMap);
      } catch (error: any) {
        toast.error("Error loading attendance: " + error.message);
      } finally {
        setIsDateLoading(false);
      }
    };

    loadAttendanceForDate();
  }, [selectedDate, saturdayServiceDept]);

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

  // 3. Save Attendance to Supabase
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

  if (isPageLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh]">
        <Loader2 className="w-10 h-10 animate-spin text-green-600 mb-4" />
        <p className="text-gray-500 font-medium animate-pulse">Initializing Workspace...</p>
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
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-in fade-in duration-500">
      
      {/* HEADER PAGE TITLE */}
      <div className="bg-white rounded-xl p-6 sm:p-8 border border-green-200 flex flex-col justify-center items-start shadow-sm">
        <h2 className="text-2xl sm:text-3xl font-black text-black flex items-center gap-3">
          <UserCheck className="w-8 h-8 text-green-600" /> Saturday Service
        </h2>
        <p className="text-gray-600 font-medium text-sm sm:text-base mt-2">Track faithful attendance for the whole congregation.</p>
      </div>

      {/* QUICK STATS */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="border-green-200 shadow-sm bg-white">
          <CardContent className="p-4 sm:p-6 flex items-center justify-between">
            <div>
              <p className="text-[10px] sm:text-xs text-gray-500 font-bold uppercase tracking-wider">Registered</p>
              <p className="text-2xl sm:text-4xl font-black text-black mt-1">{members.length}</p>
            </div>
            <Users className="w-8 h-8 sm:w-12 sm:h-12 text-green-100" />
          </CardContent>
        </Card>
        <Card className="border-green-200 shadow-sm bg-white">
          <CardContent className="p-4 sm:p-6 flex items-center justify-between">
            <div>
              <p className="text-[10px] sm:text-xs text-gray-500 font-bold uppercase tracking-wider">Attend Rate</p>
              <p className="text-2xl sm:text-4xl font-black text-green-600 mt-1">{attendanceRate}%</p>
            </div>
            <TrendingUp className="w-8 h-8 sm:w-12 sm:h-12 text-green-100" />
          </CardContent>
        </Card>
      </div>

      {/* MAIN LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: THE CALENDAR */}
        <div className="lg:col-span-4 w-full">
          <Card className="border-green-200 shadow-sm bg-white w-full">
            <CardHeader className="bg-gray-50/50 border-b border-gray-100 p-4 sm:p-6">
              <CardTitle className="text-base sm:text-lg text-black flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-green-600" /> Gathering Date
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 flex justify-center bg-white overflow-x-auto">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                className="rounded-xl border border-green-100 shadow-sm p-3 bg-white"
              />
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN: THE MEMBER LIST */}
        <div className="lg:col-span-8 w-full">
          <Card className="border-green-200 shadow-sm bg-white flex flex-col w-full h-[600px] lg:h-[700px]">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-100 p-4 sm:p-6 gap-4 flex-none bg-gray-50/50">
              <div>
                <CardTitle className="text-lg sm:text-xl text-black">Mark Attendance</CardTitle>
                <CardDescription className="text-green-700 font-bold mt-1 text-sm">
                  {format(selectedDate, 'EEEE, MMMM do, yyyy')}
                </CardDescription>
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <Button variant="outline" size="sm" onClick={handleMarkAllPresent} disabled={isDateLoading} className="flex-1 sm:flex-none border-green-200 text-green-700 hover:bg-green-50 font-bold">
                  All Present
                </Button>
                <Button variant="outline" size="sm" onClick={() => setAttendance({})} disabled={isDateLoading} className="flex-1 sm:flex-none border-gray-200 text-gray-600 hover:bg-gray-50 font-bold">
                  Clear
                </Button>
              </div>
            </CardHeader>
            
            <CardContent className="p-4 sm:p-6 flex-1 flex flex-col min-h-0 relative">
              
              {/* Subtle Loading Overlay when switching dates */}
              {isDateLoading && (
                <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] z-10 flex flex-col items-center justify-center rounded-b-xl">
                  <Loader2 className="w-8 h-8 animate-spin text-green-600 mb-2" />
                  <p className="text-green-700 font-bold text-sm">Loading registers...</p>
                </div>
              )}

              {/* Scrollable list area */}
              <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                {members.length === 0 ? (
                  <p className="text-center text-gray-500 py-12 italic text-sm sm:text-base">No members found.</p>
                ) : (
                  members.map((member) => (
                    <div key={member.id} className={`flex items-center justify-between p-3 sm:p-4 rounded-xl border transition-colors bg-white shadow-sm gap-3 ${attendance[member.id] ? "border-green-500 bg-green-50/30" : "border-gray-200 hover:border-green-300"}`}>
                      <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                        <Checkbox 
                          id={member.id} 
                          checked={!!attendance[member.id]} 
                          onCheckedChange={() => handleToggleAttendance(member.id)}
                          className="w-5 h-5 sm:w-6 sm:h-6 text-green-600 border-gray-300 data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600 shrink-0"
                        />
                        <Label htmlFor={member.id} className="cursor-pointer min-w-0 flex-1">
                          <p className="font-bold text-black text-sm sm:text-base truncate">{member.name}</p>
                          <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 truncate">{member.email || "No email"}</p>
                        </Label>
                      </div>
                      <Badge variant="outline" className={attendance[member.id] ? "bg-green-100 text-green-800 border-green-300 text-[10px] sm:text-xs px-2 py-1 font-bold shrink-0 uppercase tracking-wider" : "bg-gray-50 text-gray-500 border-gray-200 text-[10px] sm:text-xs px-2 py-1 font-medium shrink-0 uppercase tracking-wider"}>
                        {attendance[member.id] ? "Present" : "Absent"}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
              
              {/* Static Save Button Area */}
              <div className="mt-4 pt-4 border-t border-gray-100 flex-none">
                <Button 
                  onClick={handleSaveAttendance} 
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-bold shadow-md py-6 text-base sm:text-lg transition-all rounded-xl" 
                  disabled={isSaving || members.length === 0 || isDateLoading}
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