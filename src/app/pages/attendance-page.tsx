import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Checkbox } from "../components/ui/checkbox";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { Calendar } from "../components/ui/calendar";
import { UserCheck, Users, TrendingUp, Loader2, Save } from "lucide-react";
import { supabase } from "../lib/supabase";
import { toast } from "sonner";
import { format } from "date-fns";

export function AttendancePage() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [members, setMembers] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // 1. Fetch Members & Attendance for selected date
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      
      // Fetch members
      const { data: membersData } = await supabase
        .from('profiles') // Adjust to your member table name
        .select('id, name, email')
        .neq('role', 'admin');

      setMembers(membersData || []);

      // Fetch existing attendance for this date
      const formattedDate = format(selectedDate, 'yyyy-MM-dd');
      const { data: attendanceData } = await supabase
        .from('attendance')
        .select('user_id, present')
        .eq('attendance_date', formattedDate);

      const attendanceMap: Record<string, boolean> = {};
      attendanceData?.forEach(record => {
        attendanceMap[record.user_id] = record.present;
      });

      setAttendance(attendanceMap);
      setIsLoading(false);
    };

    loadData();
  }, [selectedDate]);

  const handleToggleAttendance = (userId: string) => {
    setAttendance(prev => ({
      ...prev,
      [userId]: !prev[userId],
    }));
  };

  // 2. Save Attendance to Supabase
  const handleSaveAttendance = async () => {
    setIsSaving(true);
    const formattedDate = format(selectedDate, 'yyyy-MM-dd');

    const records = members.map(member => ({
      user_id: member.id,
      attendance_date: formattedDate,
      present: !!attendance[member.id]
    }));

    // .upsert uses the UNIQUE constraint (user_id + attendance_date) to update if exists
    const { error } = await supabase
      .from('attendance')
      .upsert(records, { onConflict: 'user_id, attendance_date' });

    if (error) {
      toast.error("Failed to save attendance");
      console.error(error);
    } else {
      toast.success(`Attendance for ${formattedDate} saved successfully!`);
    }
    setIsSaving(false);
  };

  const handleMarkAllPresent = () => {
    const allPresent: Record<string, boolean> = {};
    members.forEach(m => { allPresent[m.id] = true; });
    setAttendance(allPresent);
  };

  const presentCount = Object.values(attendance).filter(Boolean).length;
  const attendanceRate = members.length > 0 ? Math.round((presentCount / members.length) * 100) : 0;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-green-600 mb-2" />
        <p className="text-sm text-muted-foreground">Loading members...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-green-100 to-green-50 rounded-xl p-6 border border-green-200">
        <h2 className="text-2xl font-bold text-green-900">Church Attendance</h2>
        <p className="text-green-700">Tracking faithful attendance for the glory of God.</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-green-200 shadow-sm">
          <CardContent className="pt-6 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Members Registered</p>
              <p className="text-3xl font-bold">{members.length}</p>
            </div>
            <Users className="w-10 h-10 text-green-200" />
          </CardContent>
        </Card>
        <Card className="border-green-200 shadow-sm">
          <CardContent className="pt-6 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Attendance Rate</p>
              <p className="text-3xl font-bold text-green-600">{attendanceRate}%</p>
            </div>
            <TrendingUp className="w-10 h-10 text-green-200" />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 border-green-200">
          <CardHeader>
            <CardTitle className="text-lg">Gathering Date</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              className="rounded-md border border-green-100"
            />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 border-green-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
            <div>
              <CardTitle className="text-lg">Mark Attendance</CardTitle>
              <CardDescription>{format(selectedDate, 'PPPP')}</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleMarkAllPresent}>All Present</Button>
              <Button variant="outline" size="sm" onClick={() => setAttendance({})}>Clear</Button>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-3 max-h-[450px] overflow-y-auto pr-2">
              {members.map((member) => (
                <div key={member.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-green-50/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <Checkbox 
                      id={member.id} 
                      checked={!!attendance[member.id]} 
                      onCheckedChange={() => handleToggleAttendance(member.id)}
                    />
                    <Label htmlFor={member.id} className="cursor-pointer">
                      <p className="font-semibold text-sm">{member.name}</p>
                      <p className="text-xs text-gray-500">{member.email}</p>
                    </Label>
                  </div>
                  <Badge variant="outline" className={attendance[member.id] ? "bg-green-100 text-green-700 border-green-200" : "bg-gray-50 text-gray-400"}>
                    {attendance[member.id] ? "Present" : "Absent"}
                  </Badge>
                </div>
              ))}
            </div>

            <div className="mt-6 pt-4 border-t">
              <Button 
                onClick={handleSaveAttendance} 
                className="w-full bg-green-600 hover:bg-green-700" 
                disabled={isSaving}
              >
                {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Save Changes
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}