import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Checkbox } from "../components/ui/checkbox";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Calendar } from "../components/ui/calendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { 
  Calendar as CalendarIcon, Plus, Trash2, Loader2, ListTodo, 
  CheckCircle, Users, UserCheck, TrendingUp, Save, AlertCircle,
  MapPin as MapIcon, Image as ImageIcon, Search, Clock, X
} from "lucide-react";
import { supabase } from "../lib/supabase"; 
import { toast } from "sonner";
import { useNavigate } from "react-router";
import { format } from "date-fns";
import { DepartmentTaskBoard } from "./department-task-board"; 

// --- MAP IMPORTS ---
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';

// Create a custom GREEN map pin to match the system theme
const customMapPin = new L.DivIcon({
  className: 'bg-transparent',
  html: `<div style="color: #16a34a; transform: translate(-50%, -100%);"><svg width="36" height="36" viewBox="0 0 24 24" fill="currentColor" stroke="white" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3" fill="white"></circle></svg></div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 36]
});

function LocationPicker({ position, setPosition }: { position: any, setPosition: any }) {
  useMapEvents({ click(e) { setPosition(e.latlng); } });
  return position === null ? null : <Marker position={position} icon={customMapPin} />;
}

function MapUpdater({ position }: { position: any }) {
  const map = useMap();
  useEffect(() => { if (position) map.flyTo([position.lat, position.lng], 15); }, [position, map]);
  return null;
}

interface AgendaItem { time: string; activity: string; }

export function SaturdayWorkspace() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<any>(null);

  // --- SPLIT LOADING STATES ---
  const [isWorkspaceLoading, setIsWorkspaceLoading] = useState(true);
  const [isDateLoading, setIsDateLoading] = useState(false);

  // --- ATTENDANCE STATES ---
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [members, setMembers] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<Record<string, boolean>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saturdayServiceDept, setSaturdayServiceDept] = useState<any>(null);

  // --- EVENT FORM STATES ---
  const [events, setEvents] = useState<any[]>([]);
  const [newEvent, setNewEvent] = useState({ title: "", date: "", time: "", type: "gathering", description: "", locationName: "" });
  const [agenda, setAgenda] = useState<AgendaItem[]>([]); 
  const [mapPosition, setMapPosition] = useState<{lat: number, lng: number} | null>(null);
  const [eventImage, setEventImage] = useState<File | null>(null); 
  const [mapSearchQuery, setMapSearchQuery] = useState("");
  const [isSearchingMap, setIsSearchingMap] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // 1. INITIALIZE WORKSPACE (User, Members, Dept, Events) - Runs ONCE
  useEffect(() => {
    let channel: any;

    const initializeWorkspace = async () => {
      setIsWorkspaceLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return navigate("/");

        const { data: profile } = await supabase.from('profiles').select('*, departments(name_en)').eq('id', user.id).single();
        setCurrentUser(profile);

        if (!profile?.departments?.name_en?.includes("Saturday") && profile?.role !== "admin") {
          toast.error("Access Denied: Saturday Service clearance required.");
          return navigate("/app");
        }

        // Fetch Department
        const { data: satDept } = await supabase.from('departments').select('*').ilike('name_en', '%Saturday%').single();
        if (satDept) setSaturdayServiceDept(satDept);

        // Fetch Members
        const { data: membersData } = await supabase.from('profiles').select('id, name, email, role').neq('role', 'admin').order('name', { ascending: true });
        setMembers(membersData || []);

        // Load Events
        fetchEvents();
        
        channel = supabase.channel('saturday-realtime')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, () => { fetchEvents(); })
          .subscribe();

      } catch (error) {
        console.error(error);
      } finally {
        setIsWorkspaceLoading(false);
      }
    };

    initializeWorkspace();
    return () => { if (channel) supabase.removeChannel(channel); };
  }, [navigate]);

  // Load Events Helper
  const fetchEvents = async () => {
    const { data: eventsData } = await supabase.from('events').select('*').order('event_date', { ascending: true });
    if (eventsData) setEvents(eventsData);
  };

  // 2. LOAD ATTENDANCE DATA - Runs when Date changes
  useEffect(() => {
    const loadAttendanceData = async () => {
      if (!saturdayServiceDept) return;
      
      setIsDateLoading(true);
      try {
        const formattedDate = format(selectedDate, 'yyyy-MM-dd');
        const { data: attendanceData } = await supabase.from('attendance').select('user_id, present').eq('department_id', saturdayServiceDept.id).eq('attendance_date', formattedDate);
        
        const attendanceMap: Record<string, boolean> = {};
        attendanceData?.forEach(record => { attendanceMap[record.user_id] = record.present; });
        setAttendance(attendanceMap);
      } catch (error: any) {
        toast.error("Error loading attendance: " + error.message);
      } finally {
        setIsDateLoading(false);
      }
    };

    loadAttendanceData();
  }, [selectedDate, saturdayServiceDept]);

  // --- ATTENDANCE HANDLERS ---
  const handleToggleAttendance = (userId: string) => setAttendance(prev => ({ ...prev, [userId]: !prev[userId] }));
  const handleMarkAllPresent = () => { const allPresent: Record<string, boolean> = {}; members.forEach(m => { allPresent[m.id] = true; }); setAttendance(allPresent); };
  
  const handleSaveAttendance = async () => {
    if (!saturdayServiceDept) return;
    setIsSaving(true);
    const formattedDate = format(selectedDate, 'yyyy-MM-dd');
    const records = members.map(member => ({
      user_id: member.id, department_id: saturdayServiceDept.id, attendance_date: formattedDate, present: !!attendance[member.id]
    }));

    const { error } = await supabase.from('attendance').upsert(records, { onConflict: 'user_id, attendance_date, department_id' });
    if (error) toast.error("Failed to save attendance");
    else toast.success(`Attendance for ${formattedDate} saved successfully!`);
    setIsSaving(false);
  };

  // --- EVENT HANDLERS ---
  const handleSearchLocation = async () => {
    if (!mapSearchQuery.trim()) return;
    setIsSearchingMap(true);
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(mapSearchQuery)}`);
      const data = await response.json();
      if (data && data.length > 0) {
        const result = data[0];
        const newPosition = { lat: parseFloat(result.lat), lng: parseFloat(result.lon) };
        setMapPosition(newPosition); 
        if (!newEvent.locationName) setNewEvent({ ...newEvent, locationName: result.display_name.split(',')[0] });
        toast.success("Location found!");
      } else {
        toast.error("Could not find that location. Try being more specific.");
      }
    } catch (error) { toast.error("Error searching for location."); } finally { setIsSearchingMap(false); }
  };

  const handleAddEvent = async () => {
    if (!newEvent.title || !newEvent.date || !newEvent.time) return toast.error("Fill all required fields");
    setIsUploading(true);
    
    try {
      let finalImageUrl = null;
      if (eventImage) {
        const fileExt = eventImage.name.split('.').pop();
        const fileName = `event_${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from('event_images').upload(fileName, eventImage);
        if (uploadError) throw uploadError;
        const { data: publicUrlData } = supabase.storage.from('event_images').getPublicUrl(fileName);
        finalImageUrl = publicUrlData.publicUrl;
      }

      let finalLocationString = newEvent.locationName;
      if (mapPosition) finalLocationString = `https://maps.google.com/?q=${mapPosition.lat},${mapPosition.lng}`;

      const eventDateTime = new Date(`${newEvent.date}T${newEvent.time}`).toISOString();
      const { error } = await supabase.from('events').insert([{
        title: newEvent.title, description: newEvent.description, event_date: eventDateTime, type: newEvent.type,
        location: finalLocationString, image_url: finalImageUrl,
        agenda: agenda 
      }]);
      if (error) throw error;
      
      toast.success("Event added successfully!");
      setNewEvent({ title: "", date: "", time: "", type: "gathering", description: "", locationName: "" });
      setAgenda([]); 
      setMapPosition(null); setEventImage(null); setMapSearchQuery("");
      fetchEvents();
    } catch (error: any) { toast.error("Failed to post event: " + error.message); } finally { setIsUploading(false); }
  };

  const handleDeleteEvent = async (id: string) => {
    if(!confirm("Are you sure you want to delete this event?")) return;
    try {
      const { data: eventToDelete } = await supabase.from('events').select('image_url').eq('id', id).single();
      if (eventToDelete && eventToDelete.image_url) {
        const urlParts = eventToDelete.image_url.split('/');
        await supabase.storage.from('event_images').remove([urlParts[urlParts.length - 1]]);
      }
      const { error } = await supabase.from('events').delete().eq('id', id);
      if (error) throw error;
      toast.success("Event deleted.");
      fetchEvents();
    } catch (error: any) { toast.error("Error deleting: " + error.message); }
  };

  const presentCount = Object.values(attendance).filter(Boolean).length;
  const attendanceRate = members.length > 0 ? Math.round((presentCount / members.length) * 100) : 0;
  const isSaturdayHead = currentUser?.role === 'admin' || currentUser?.department_role === 'head' || currentUser?.department_role === 'deputy';

  if (isWorkspaceLoading) return <div className="flex flex-col items-center justify-center h-[30vh]"><Loader2 className="w-8 h-8 animate-spin text-green-600 mb-4" /><p className="text-gray-500 font-medium">Loading Saturday Console...</p></div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* HEADER */}
      <div className="bg-white rounded-xl p-6 sm:p-8 border border-green-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-sm">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-black flex items-center gap-2">
            <CalendarIcon className="w-8 h-8 text-green-600" /> Saturday Service Workspace
          </h2>
          <p className="text-gray-600 font-medium mt-1">Manage weekly operations, church events, and attendance.</p>
        </div>
        <Badge className="bg-green-600 text-white border-none font-bold px-4 py-2 shadow-sm">
          {isSaturdayHead ? 'Service Director' : 'Service Team'}
        </Badge>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="flex flex-wrap w-full gap-2 mb-6 h-auto bg-green-50 p-2 rounded-xl border border-green-100 shadow-inner">
          <TabsTrigger value="overview" className="flex-1 min-w-[120px] py-2.5 text-xs sm:text-sm font-bold data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:shadow-sm">Overview & Tasks</TabsTrigger>
          <TabsTrigger value="attendance" className="flex-1 min-w-[120px] py-2.5 text-xs sm:text-sm font-bold data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:shadow-sm">Attendance Roster</TabsTrigger>
          <TabsTrigger value="events" className="flex-1 min-w-[120px] py-2.5 text-xs sm:text-sm font-bold data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:shadow-sm">Church Events</TabsTrigger>
        </TabsList>

        {/* TAB 1: WORKSPACE OVERVIEW & TASKS */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            <div className="lg:col-span-2">
              <DepartmentTaskBoard 
                departmentId={currentUser?.department_id} 
                currentUser={currentUser} 
                accentColor="green" 
              />
            </div>

            <div className="space-y-4 lg:col-span-1">
              <Card className="border-green-200 shadow-sm bg-white hover:border-green-400 transition-colors">
                <CardContent className="pt-6 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Members Registered</p>
                    <p className="text-4xl font-black text-black mt-1">{members.length}</p>
                  </div>
                  <Users className="w-12 h-12 text-green-100" />
                </CardContent>
              </Card>
              <Card className="border-green-200 shadow-sm bg-white hover:border-green-400 transition-colors">
                <CardContent className="pt-6 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Latest Attendance Rate</p>
                    <p className="text-4xl font-black text-green-600 mt-1">{attendanceRate}%</p>
                  </div>
                  <TrendingUp className="w-12 h-12 text-green-100" />
                </CardContent>
              </Card>
            </div>

          </div>
        </TabsContent>

        {/* TAB 2: ATTENDANCE TRACKER */}
        <TabsContent value="attendance" className="space-y-6">
          {!saturdayServiceDept ? (
            <div className="text-center p-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 max-w-2xl mx-auto mt-10">
              <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 font-bold text-lg">Configuration Error</p>
              <p className="text-sm text-gray-400">The "Saturday Service" department is missing from the database.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* LEFT COLUMN: THE CALENDAR */}
              <div className="lg:col-span-4 w-full">
                <Card className="border-green-200 shadow-sm bg-white w-full">
                  <CardHeader className="bg-gray-50/50 border-b border-gray-100 p-4 sm:p-6">
                    <CardTitle className="text-base sm:text-lg text-black flex items-center gap-2">
                      <CalendarIcon className="w-5 h-5 text-green-600" /> Gathering Date
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
                    
                    <div className="mt-4 pt-4 border-t border-gray-100 flex-none">
                      <Button onClick={handleSaveAttendance} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold shadow-md py-6 text-base sm:text-lg transition-all rounded-xl" disabled={isSaving || members.length === 0 || isDateLoading}>
                        {isSaving ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Save className="w-5 h-5 mr-2" />} Save Attendance Record
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>

            </div>
          )}
        </TabsContent>

        {/* TAB 3: CHURCH EVENTS */}
        <TabsContent value="events" className="space-y-6">
          <Card className="border-green-200 shadow-sm bg-white">
            <CardHeader><CardTitle className="text-black">Add Church Event</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              
              <div className="space-y-2">
                <Label className="text-xs text-black font-bold uppercase">Event Title</Label>
                <Input placeholder="e.g. Sunday Morning Service" value={newEvent.title} onChange={(e) => setNewEvent({...newEvent, title: e.target.value})} className="border-green-200 focus-visible:ring-green-500" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs text-black font-bold uppercase">Date</Label>
                  <Input type="date" value={newEvent.date} onChange={(e) => setNewEvent({...newEvent, date: e.target.value})} className="border-green-200 focus-visible:ring-green-500" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-black font-bold uppercase">Start Time</Label>
                  <Input type="time" value={newEvent.time} onChange={(e) => setNewEvent({...newEvent, time: e.target.value})} className="border-green-200 focus-visible:ring-green-500" />
                </div>
              </div>

              <div className="space-y-3 border-t border-gray-100 pt-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <Label className="text-xs text-black font-bold uppercase flex items-center gap-2">
                    <Clock className="w-4 h-4 text-green-600" /> Event Schedule Breakdown (Optional)
                  </Label>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-8 text-xs border-green-200 text-green-700 hover:bg-green-50"
                    onClick={() => setAgenda([...agenda, { time: "", activity: "" }])}
                  >
                    <Plus className="w-3 h-3 mr-1" /> Add Schedule Item
                  </Button>
                </div>
                
                {agenda.length > 0 && (
                  <div className="space-y-2 bg-green-50/30 p-4 rounded-xl border border-green-100">
                    {agenda.map((item, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Input 
                          type="time" 
                          value={item.time} 
                          onChange={(e) => {
                            const newAgenda = [...agenda];
                            newAgenda[index].time = e.target.value;
                            setAgenda(newAgenda);
                          }} 
                          className="w-32 bg-white border-green-200" 
                        />
                        <Input 
                          placeholder="e.g. Opening Prayer" 
                          value={item.activity} 
                          onChange={(e) => {
                            const newAgenda = [...agenda];
                            newAgenda[index].activity = e.target.value;
                            setAgenda(newAgenda);
                          }} 
                          className="flex-1 bg-white border-green-200" 
                        />
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-gray-400 hover:text-red-500 shrink-0 h-9 w-9"
                          onClick={() => setAgenda(agenda.filter((_, i) => i !== index))}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-gray-100 pt-4">
                <div className="space-y-2">
                  <Label className="text-xs text-black font-bold uppercase">Event Type</Label>
                  <Select value={newEvent.type} onValueChange={(v: any) => setNewEvent({...newEvent, type: v})}>
                    <SelectTrigger className="border-green-200 focus:ring-green-500"><SelectValue placeholder="Event Type" /></SelectTrigger>
                    <SelectContent position="popper" sideOffset={4} className="max-h-[200px] overflow-y-auto">
                      <SelectItem value="gathering">Gathering</SelectItem>
                      <SelectItem value="meeting">Meeting</SelectItem>
                      <SelectItem value="event">Special Event</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-xs text-black font-bold uppercase">Location Title (Optional)</Label>
                  <div className="relative">
                    <MapIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input placeholder="e.g. Main Sanctuary" value={newEvent.locationName} onChange={(e) => setNewEvent({...newEvent, locationName: e.target.value})} className="pl-10 border-green-200 focus-visible:ring-green-500" />
                  </div>
                </div>
              </div>

              <div className="space-y-2 border-t border-gray-100 pt-4">
                <Label className="text-xs text-black font-bold uppercase flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-green-600" /> Cover Image (Optional)
                </Label>
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex items-center gap-4">
                  <input 
                    type="file" accept="image/*" onChange={(e) => setEventImage(e.target.files?.[0] || null)}
                    className="w-full text-sm text-black file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-green-100 file:text-green-800 hover:file:bg-green-200 cursor-pointer"
                  />
                </div>
              </div>

              <div className="space-y-3 border-t border-gray-100 pt-4">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-2 mb-2">
                  <Label className="text-xs text-black font-bold uppercase">Pin Exact Location on Map</Label>
                  {mapPosition && <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-[10px]">Pin Dropped ✓</Badge>}
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input placeholder="Search for an address, city, or landmark..." value={mapSearchQuery} onChange={(e) => setMapSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearchLocation()} className="pl-9 border-green-200 focus-visible:ring-green-500" />
                  </div>
                  <Button onClick={handleSearchLocation} disabled={isSearchingMap} variant="outline" className="shrink-0 border-green-600 text-green-700 hover:bg-green-50">
                    {isSearchingMap ? <Loader2 className="w-4 h-4 animate-spin" /> : "Search Map"}
                  </Button>
                </div>
                <div className="h-[300px] w-full rounded-xl overflow-hidden border border-gray-200 shadow-inner z-0 relative mt-2">
                  <MapContainer center={[25.2048, 55.2708]} zoom={11} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
                    <TileLayer attribution='© OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    <LocationPicker position={mapPosition} setPosition={setMapPosition} />
                    <MapUpdater position={mapPosition} />
                  </MapContainer>
                </div>
                <p className="text-xs text-gray-400 text-right mt-1">Search above, or click anywhere on the map to drop a pin manually.</p>
              </div>

              <div className="space-y-2 border-t border-gray-100 pt-4">
                <Label className="text-xs text-black font-bold uppercase">Details / Description</Label>
                <Textarea placeholder="Event Description..." value={newEvent.description} onChange={(e) => setNewEvent({...newEvent, description: e.target.value})} className="h-24 resize-none border-green-200 focus-visible:ring-green-500" />
              </div>

              <Button onClick={handleAddEvent} disabled={isUploading} className="bg-black hover:bg-gray-800 text-white w-full py-6 text-lg font-bold shadow-md mt-4">
                {isUploading ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Uploading...</> : <><Plus className="w-5 h-5 mr-2" /> Post Event</>}
              </Button>
            </CardContent>
          </Card>

          <div className="space-y-3 mt-8">
            <h3 className="text-lg font-bold text-black mb-4 px-2">Manage Scheduled Events</h3>
            {events.length === 0 && (
              <div className="text-center p-8 bg-gray-50 border border-dashed border-gray-200 rounded-xl text-gray-400 italic text-sm">
                No events scheduled. Create one above!
              </div>
            )}
            {events.map(event => {
              const eventDate = new Date(event.event_date);
              
              let eventAgenda = [];
              if (event.agenda) {
                try { eventAgenda = typeof event.agenda === 'string' ? JSON.parse(event.agenda) : event.agenda; } 
                catch (e) { eventAgenda = []; }
              }

              return (
                <div key={event.id} className="flex flex-col p-4 bg-white border border-green-200 rounded-xl hover:border-green-400 transition-colors shadow-sm relative">
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex items-center gap-4">
                      {event.image_url ? (
                        <img src={event.image_url} alt={event.title} className="w-16 h-16 rounded-xl object-cover shadow-sm border border-gray-100" />
                      ) : (
                        <div className="w-16 h-16 bg-green-50 rounded-xl flex flex-col items-center justify-center text-green-700 shadow-sm border border-green-100">
                          <p className="text-[10px] font-bold uppercase leading-none mb-1">{eventDate.toLocaleDateString('en-US', { month: 'short' })}</p>
                          <p className="text-xl font-black leading-none">{eventDate.getDate()}</p>
                        </div>
                      )}
                      <div>
                        <p className="font-bold text-black text-lg leading-tight mb-1">{event.title}</p>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-green-600" /> 
                          {eventDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </p>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteEvent(event.id)}>
                      <Trash2 className="w-5 h-5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded" />
                    </Button>
                  </div>

                  {eventAgenda && eventAgenda.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-50 ml-[80px]">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Schedule</p>
                      <div className="space-y-2 relative before:absolute before:inset-0 before:ml-[26px] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-green-200 before:to-transparent">
                        {eventAgenda.map((item: any, idx: number) => (
                          <div key={idx} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                            <div className="flex items-center justify-center w-6 h-6 rounded-full border-2 border-white bg-green-200 text-green-700 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                              <div className="w-1.5 h-1.5 bg-green-600 rounded-full"></div>
                            </div>
                            <div className="w-[calc(100%-2.5rem)] md:w-[calc(50%-1.5rem)] p-2 rounded border border-green-100 bg-white shadow-sm flex items-center gap-3">
                              <Badge variant="outline" className="bg-green-50 text-green-800 font-mono border-green-200 text-xs shrink-0">{item.time}</Badge>
                              <span className="font-medium text-black text-sm truncate">{item.activity}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

        </TabsContent>

      </Tabs>
    </div>
  );
}