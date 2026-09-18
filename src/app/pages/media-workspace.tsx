import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { 
  Video, Headphones, Calendar, Plus, Trash2, Loader2, 
  PlayCircle, Settings2, Link as LinkIcon, Camera,
  Cloud, ExternalLink
} from "lucide-react";
import { supabase } from "../lib/supabase"; 
import { toast } from "sonner";
import { useNavigate } from "react-router";
import { DepartmentTaskBoard } from "./department-task-board"; 

interface DriveLink { id: string; name: string; url: string; }

export function MediaWorkspace() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // --- WORKSPACE OVERVIEW STATES ---
  const [driveLinks, setDriveLinks] = useState<DriveLink[]>([]);
  const [newDriveName, setNewDriveName] = useState("");
  const [newDriveUrl, setNewDriveUrl] = useState("");

  // --- DB DATA STATES ---
  const [shifts, setShifts] = useState<any[]>([]);
  const [archives, setArchives] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);

  // Shift Form State
  const [eventName, setEventName] = useState("");
  const [shiftDate, setShiftDate] = useState("");
  const [shiftTime, setShiftTime] = useState("");
  const [roleName, setRoleName] = useState("");
  const [assignedTo, setAssignedTo] = useState("Unassigned");

  // Archive Form State
  const [archiveTitle, setArchiveTitle] = useState("");
  const [archiveDate, setArchiveDate] = useState("");
  const [archiveUrl, setArchiveUrl] = useState("");
  const [assetType, setAssetType] = useState("video");

  useEffect(() => {
    let channel: any;

    const initializeWorkspace = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return navigate("/");

        const { data: profile } = await supabase.from('profiles').select('*, departments(name_en)').eq('id', user.id).single();
        setCurrentUser(profile);

        if (profile?.departments?.name_en !== "Media" && profile?.role !== "admin") {
          toast.error("Access Denied: Media clearance required.");
          return navigate("/app");
        }
        
        const savedDrives = localStorage.getItem("media_drives");
        if (savedDrives) setDriveLinks(JSON.parse(savedDrives));

        await fetchData();

        channel = supabase.channel('media-realtime')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'media_shifts' }, () => { fetchData(); })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'media_archives' }, () => { fetchData(); })
          .subscribe();

      } catch (error) {
        console.error(error);
      }
    };

    initializeWorkspace();
    return () => { if (channel) supabase.removeChannel(channel); };
  }, [navigate]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [ { data: shiftsData }, { data: archivesData }, { data: membersData } ] = await Promise.all([
        supabase.from('media_shifts').select('*').order('shift_date', { ascending: true }),
        supabase.from('media_archives').select('*').order('archive_date', { ascending: false }),
        supabase.from('profiles').select('id, name').order('name', { ascending: true })
      ]);

      const today = new Date().toISOString().split('T')[0];
      setShifts((shiftsData || []).filter(s => s.shift_date >= today));
      setArchives(archivesData || []);
      setMembers(membersData || []);
    } catch (error) {
      toast.error("Failed to sync media data");
    } finally {
      setIsLoading(false);
    }
  };

  // --- LOCAL HANDLERS (Drives) ---
  const saveDrivesLocally = (newDrives: DriveLink[]) => { setDriveLinks(newDrives); localStorage.setItem("media_drives", JSON.stringify(newDrives)); };
  const handleAddDrive = () => {
    if (!newDriveName.trim() || !newDriveUrl.trim()) return;
    saveDrivesLocally([...driveLinks, { id: Date.now().toString(), name: newDriveName, url: newDriveUrl }]);
    setNewDriveName(""); setNewDriveUrl("");
  };
  const handleDeleteDrive = (id: string) => saveDrivesLocally(driveLinks.filter(d => d.id !== id));

  // --- DB HANDLERS (Shifts & Archives) ---
  const handleAddShift = async () => {
    if (!eventName || !shiftDate || !shiftTime || !roleName) return toast.error("Please fill in all required shift details.");
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('media_shifts').insert([{ event_name: eventName, shift_date: shiftDate, shift_time: shiftTime, role_name: roleName, assigned_to: assignedTo }]);
      if (error) throw error;
      toast.success("Shift scheduled successfully!");
      setEventName(""); setShiftDate(""); setShiftTime(""); setRoleName(""); setAssignedTo("Unassigned"); fetchData();
    } catch (error: any) { toast.error(error.message); } finally { setIsSubmitting(false); }
  };

  const handleAddArchive = async () => {
    if (!archiveTitle || !archiveDate || !archiveUrl) return toast.error("Please fill in all archive details.");
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('media_archives').insert([{ title: archiveTitle, archive_date: archiveDate, file_url: archiveUrl, asset_type: assetType }]);
      if (error) throw error;
      toast.success("Asset archived successfully!");
      setArchiveTitle(""); setArchiveDate(""); setArchiveUrl(""); setAssetType("video"); fetchData();
    } catch (error: any) { toast.error(error.message); } finally { setIsSubmitting(false); }
  };

  const handleDelete = async (table: string, id: string) => {
    if (!confirm("Are you sure you want to delete this record?")) return;
    try {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
      toast.success("Record deleted."); fetchData();
    } catch (error: any) { toast.error(error.message); }
  };

  const isMediaHead = currentUser?.role === 'admin' || currentUser?.department_role === 'head' || currentUser?.department_role === 'deputy';

  if (isLoading) return <div className="flex flex-col items-center justify-center h-[30vh]"><Loader2 className="w-8 h-8 animate-spin text-green-600 mb-4" /><p className="text-gray-500 font-medium">Loading Media Console...</p></div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* HEADER */}
      <div className="bg-white rounded-xl p-6 sm:p-8 border border-green-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-sm">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-black flex items-center gap-2">
            <Video className="w-8 h-8 text-green-600" /> Media Workspace
          </h2>
          <p className="text-gray-600 font-medium mt-1">Manage production schedules, tasks, and file storage links.</p>
        </div>
        <Badge className="bg-green-600 text-white border-none font-bold px-4 py-2 shadow-sm">
          {isMediaHead ? 'Production Director' : 'Media Team'}
        </Badge>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="flex flex-wrap w-full gap-2 mb-6 h-auto bg-green-50 p-2 rounded-xl border border-green-100 shadow-inner">
          <TabsTrigger value="overview" className="flex-1 min-w-[120px] py-2.5 text-xs sm:text-sm font-bold data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:shadow-sm">Overview & Tasks</TabsTrigger>
          <TabsTrigger value="schedule" className="flex-1 min-w-[120px] py-2.5 text-xs sm:text-sm font-bold data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:shadow-sm">Stream Schedule</TabsTrigger>
          <TabsTrigger value="archives" className="flex-1 min-w-[120px] py-2.5 text-xs sm:text-sm font-bold data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:shadow-sm">Media Archives</TabsTrigger>
        </TabsList>

        {/* ==========================================
            TAB 1: WORKSPACE OVERVIEW & DRIVE LINKS
            ========================================== */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            
            {/* WEEKLY TASKS - NOW POWERED BY SUPABASE BOARD */}
            <DepartmentTaskBoard 
              departmentId={currentUser?.department_id} 
              currentUser={currentUser} 
              accentColor="green" 
            />

            {/* DRIVE DROPZONES */}
            <Card className="border-green-200 shadow-sm flex flex-col h-[500px] bg-white">
              <CardHeader className="bg-gray-50/50 border-b border-gray-100 pb-4">
                <CardTitle className="text-lg flex items-center gap-2 text-black">
                  <Cloud className="w-5 h-5 text-green-600" /> Cloud Storage Folders
                </CardTitle>
                <CardDescription>Master Google Drive links for dropping raw footage & photos.</CardDescription>
              </CardHeader>
              <CardContent className="pt-4 flex-1 flex flex-col">
                {isMediaHead && (
                  <div className="flex flex-col gap-2 mb-6 p-4 bg-green-50/50 border border-green-100 rounded-xl">
                    <Label className="text-xs font-bold text-black uppercase">Add Drive Folder</Label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Input placeholder="Folder Name (e.g. Sunday Photos)" value={newDriveName} onChange={(e) => setNewDriveName(e.target.value)} className="bg-white border-green-200 flex-1" />
                      <Input placeholder="https://drive.google.com/..." value={newDriveUrl} onChange={(e) => setNewDriveUrl(e.target.value)} className="bg-white border-green-200 flex-1" />
                      <Button onClick={handleAddDrive} className="bg-black hover:bg-gray-800 text-white shrink-0"><Plus className="w-4 h-4" /></Button>
                    </div>
                  </div>
                )}
                
                <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                  {driveLinks.length === 0 ? (
                    <div className="text-center py-10 text-gray-400">
                      <Cloud className="w-10 h-10 mx-auto mb-2 opacity-20" />
                      <p className="text-sm">No folders linked. Dept Head can add links above.</p>
                    </div>
                  ) : (
                    driveLinks.map(drive => (
                      <div key={drive.id} className="group relative flex items-center justify-between p-4 rounded-xl bg-white border border-gray-200 shadow-sm hover:border-green-400 hover:shadow-md transition-all">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="p-2 bg-green-50 text-green-600 rounded-lg shrink-0">
                            <Cloud className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-black truncate">{drive.name}</p>
                            <a href={drive.url} target="_blank" rel="noopener noreferrer" className="text-xs text-gray-500 hover:text-green-700 flex items-center gap-1 font-medium mt-0.5 transition-colors">
                              Open Folder <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        </div>
                        {isMediaHead && (
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteDrive(drive.id)} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-600 transition-all shrink-0">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

          </div>
        </TabsContent>

        {/* ==========================================
            TAB 2: STREAM SCHEDULE
            ========================================== */}
        <TabsContent value="schedule" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left: Schedule Form (Only for Media Head) */}
            {isMediaHead && (
              <div className="lg:col-span-1">
                <Card className="border-green-200 shadow-sm bg-white sticky top-24">
                  <CardHeader className="bg-gray-50/50 border-b border-gray-100 pb-4">
                    <CardTitle className="text-lg flex items-center gap-2 text-black">
                      <Plus className="w-5 h-5 text-green-600" /> Assign Shift
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6 space-y-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-black uppercase">Service / Event Name</Label>
                      <Input placeholder="e.g., Sunday Service" value={eventName} onChange={e => setEventName(e.target.value)} className="border-green-200" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-black uppercase">Date</Label>
                        <Input type="date" value={shiftDate} onChange={e => setShiftDate(e.target.value)} className="border-green-200" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-black uppercase">Time</Label>
                        <Input type="time" value={shiftTime} onChange={e => setShiftTime(e.target.value)} className="border-green-200" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-black uppercase">Production Role</Label>
                      <Select value={roleName} onValueChange={setRoleName}>
                        <SelectTrigger className="border-green-200"><SelectValue placeholder="Select Role" /></SelectTrigger>
                        <SelectContent position="popper" sideOffset={4} className="max-h-[200px] overflow-y-auto">
                          <SelectItem value="Camera 1">Camera 1 (Main)</SelectItem>
                          <SelectItem value="Camera 2">Camera 2 (Roam)</SelectItem>
                          <SelectItem value="Audio Mixer">Audio Mixer</SelectItem>
                          <SelectItem value="Live Stream Tech">Live Stream Tech</SelectItem>
                          <SelectItem value="ProPresenter">ProPresenter (Lyrics)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-black uppercase">Assign To</Label>
                      <Select value={assignedTo} onValueChange={setAssignedTo}>
                        <SelectTrigger className="border-green-200"><SelectValue placeholder="Select Member" /></SelectTrigger>
                        <SelectContent position="popper" sideOffset={4} className="max-h-[200px] overflow-y-auto">
                          <SelectItem value="Unassigned">Leave Unassigned</SelectItem>
                          {members.map(m => <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button onClick={handleAddShift} disabled={isSubmitting} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold shadow-md mt-2">
                      {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null} Add to Schedule
                    </Button>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Right: Upcoming Shifts List */}
            <div className={isMediaHead ? "lg:col-span-2" : "lg:col-span-3"}>
              <Card className="border-green-200 shadow-sm h-full min-h-[500px] bg-white">
                <CardHeader className="border-b border-gray-100 pb-4">
                  <CardTitle className="text-lg flex items-center gap-2 text-black">
                    <Calendar className="w-5 h-5 text-green-600" /> Upcoming Production Schedule
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    {shifts.length === 0 ? (
                      <div className="text-center py-16 text-gray-400">
                        <Camera className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p className="font-medium">No upcoming shifts scheduled.</p>
                      </div>
                    ) : (
                      shifts.map(shift => {
                        const sDate = new Date(shift.shift_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                        const isMyShift = shift.assigned_to === currentUser.name;
                        
                        return (
                          <div key={shift.id} className={`flex flex-col sm:flex-row justify-between sm:items-center p-4 rounded-xl border transition-all shadow-sm ${isMyShift ? "bg-green-50 border-green-300" : "bg-white border-gray-100 hover:border-green-300"}`}>
                            <div className="flex items-center gap-4 mb-3 sm:mb-0">
                              <div className="p-3 bg-gray-50 rounded-xl text-center border border-gray-100 min-w-[70px]">
                                <p className="text-[10px] font-bold text-gray-500 uppercase">{sDate.split(' ')[0]}</p>
                                <p className="text-sm font-black text-black">{sDate.split(' ')[2]}</p>
                              </div>
                              <div>
                                <h4 className="font-bold text-black text-base">{shift.event_name}</h4>
                                <div className="flex flex-wrap items-center gap-2 mt-1">
                                  <Badge variant="outline" className="bg-white text-gray-600 border-gray-200 text-[10px]">{shift.shift_time}</Badge>
                                  <Badge className="bg-green-100 text-green-800 border-green-200 hover:bg-green-100 text-[10px]">{shift.role_name}</Badge>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto border-t sm:border-0 border-gray-100 pt-3 sm:pt-0">
                              <div className="text-sm">
                                <span className="text-gray-500 text-xs mr-2">Assigned to:</span>
                                <span className={`font-bold ${isMyShift ? "text-green-700" : "text-black"}`}>{shift.assigned_to}</span>
                              </div>
                              {isMediaHead && (
                                <Button variant="ghost" size="icon" onClick={() => handleDelete('media_shifts', shift.id)} className="text-gray-400 hover:text-red-600 hover:bg-red-50 h-8 w-8">
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ==========================================
            TAB 3: ARCHIVES
            ========================================== */}
        <TabsContent value="archives" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left: Archive Form (Only for Media Head) */}
            {isMediaHead && (
              <div className="lg:col-span-1">
                <Card className="border-green-200 shadow-sm bg-white sticky top-24">
                  <CardHeader className="bg-gray-50/50 border-b border-gray-100 pb-4">
                    <CardTitle className="text-lg flex items-center gap-2 text-black">
                      <Plus className="w-5 h-5 text-green-600" /> Add to Archive
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6 space-y-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-black uppercase">Asset Title</Label>
                      <Input placeholder="e.g., Sunday Sermon - Romans 1" value={archiveTitle} onChange={e => setArchiveTitle(e.target.value)} className="border-green-200" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-black uppercase">Recorded Date</Label>
                      <Input type="date" value={archiveDate} onChange={e => setArchiveDate(e.target.value)} className="border-green-200" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-black uppercase">External Link (Drive/YouTube)</Label>
                      <Input placeholder="https://..." value={archiveUrl} onChange={e => setArchiveUrl(e.target.value)} className="border-green-200" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-black uppercase">Asset Type</Label>
                      <Select value={assetType} onValueChange={setAssetType}>
                        <SelectTrigger className="border-green-200"><SelectValue placeholder="Select Type" /></SelectTrigger>
                        <SelectContent position="popper" sideOffset={4} className="max-h-[200px] overflow-y-auto">
                          <SelectItem value="video">Service Video</SelectItem>
                          <SelectItem value="audio">Audio Recording</SelectItem>
                          <SelectItem value="preset">Mixer/Lighting Preset</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button onClick={handleAddArchive} disabled={isSubmitting} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold shadow-md mt-2">
                      {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null} Save to Archive
                    </Button>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Right: Archive List */}
            <div className={isMediaHead ? "lg:col-span-2" : "lg:col-span-3"}>
              <Card className="border-green-200 shadow-sm h-full min-h-[500px] bg-white">
                <CardHeader className="border-b border-gray-100 pb-4">
                  <CardTitle className="text-lg flex items-center gap-2 text-black">
                    <Headphones className="w-5 h-5 text-green-600" /> Media & Presets Library
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {archives.length === 0 ? (
                      <div className="col-span-1 sm:col-span-2 text-center py-16 text-gray-400">
                        <PlayCircle className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p className="font-medium">No media archived yet.</p>
                      </div>
                    ) : (
                      archives.map(archive => {
                        const isVideo = archive.asset_type === 'video';
                        const isAudio = archive.asset_type === 'audio';
                        
                        return (
                          <div key={archive.id} className="p-5 bg-white border border-gray-200 rounded-xl hover:border-green-400 transition-colors shadow-sm flex flex-col h-full group">
                            <div className="flex items-start justify-between mb-4">
                              <div className={`p-3 rounded-xl ${isVideo ? "bg-black text-white" : isAudio ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-600"}`}>
                                {isVideo ? <Video className="w-6 h-6" /> : isAudio ? <Headphones className="w-6 h-6" /> : <Settings2 className="w-6 h-6" />}
                              </div>
                              {isMediaHead && (
                                <Button variant="ghost" size="icon" onClick={() => handleDelete('media_archives', archive.id)} className="h-8 w-8 text-gray-300 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100">
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                            <h4 className="font-bold text-black text-lg mb-1 leading-tight">{archive.title}</h4>
                            <p className="text-xs text-gray-500 mb-6 font-mono">Recorded: {new Date(archive.archive_date).toLocaleDateString()}</p>
                            
                            <a 
                              href={archive.file_url} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="mt-auto flex items-center justify-center gap-2 w-full bg-green-50 hover:bg-green-600 text-green-700 hover:text-white text-sm font-bold py-2.5 rounded-lg transition-all border border-green-100 hover:border-green-600"
                            >
                              <LinkIcon className="w-4 h-4" /> Open Asset
                            </a>
                          </div>
                        );
                      })
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

      </Tabs>
    </div>
  );
}