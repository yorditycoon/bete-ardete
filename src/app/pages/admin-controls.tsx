import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { Textarea } from "../components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { 
  BookOpen, Plus, Calendar, CheckSquare, Trash2, Loader2, X, Library, 
  MapPin as MapIcon, Image as ImageIcon, Search, TrendingUp, Award, CheckCircle, Clock
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { supabase } from "../lib/supabase"; 
import { toast } from "sonner";
import { useNavigate } from "react-router";
import { DepartmentTaskBoard } from "./department-task-board";

// --- MAP IMPORTS ---
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';

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

const BIBLE_BOOKS = [
  "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy", "Joshua", "Judges", "Ruth", "1 Samuel", "2 Samuel", "1 Kings", "2 Kings", "1 Chronicles", "2 Chronicles", "Ezra", "Nehemiah", "Esther", "Job", "Psalms", "Proverbs", "Ecclesiastes", "Song of Solomon", "Isaiah", "Jeremiah", "Lamentations", "Ezekiel", "Daniel", "Hosea", "Joel", "Amos", "Obadiah", "Jonah", "Micah", "Nahum", "Habakkuk", "Zephaniah", "Haggai", "Zechariah", "Malachi",
  "Matthew", "Mark", "Luke", "John", "Acts", "Romans", "1 Corinthians", "2 Corinthians", "Galatians", "Ephesians", "Philippians", "Colossians", "1 Thessalonians", "2 Thessalonians", "1 Timothy", "2 Timothy", "Titus", "Philemon", "Hebrews", "James", "1 Peter", "2 Peter", "1 John", "2 John", "3 John", "Jude", "Revelation"
];

interface AgendaItem { time: string; activity: string; }

export function EducationWorkspace() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true); 
  const [isUploading, setIsUploading] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  // Workspace State
  const [chartData, setChartData] = useState<any[]>([]);
  const [stats, setStats] = useState({ totalReadings: 0, totalQuizzes: 0, avgScore: 0 });

  // Curriculum State
  const [books, setBooks] = useState<any[]>([]);
  const [readings, setReadings] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [quizzes, setQuizzes] = useState<any[]>([]); 
  
  const [newBookTitle, setNewBookTitle] = useState("");
  const [showBookSuggestions, setShowBookSuggestions] = useState(false);
  const [readingBookId, setReadingBookId] = useState("");
  const [newReading, setNewReading] = useState({ week: "", chapters: "" });
  
  const [quizTitle, setQuizTitle] = useState("");
  const [quizBookId, setQuizBookId] = useState("");
  const [quizType, setQuizType] = useState("weekly");
  const [selectedAssignment, setSelectedAssignment] = useState("");
  const [questions, setQuestions] = useState([{ text: "", options: ["", "", "", ""], correct: 0 }]);
  
  // Event State
  const [newEvent, setNewEvent] = useState({ title: "", date: "", time: "", type: "gathering", description: "", locationName: "" });
  const [agenda, setAgenda] = useState<AgendaItem[]>([]); 
  const [mapPosition, setMapPosition] = useState<{lat: number, lng: number} | null>(null);
  const [eventImage, setEventImage] = useState<File | null>(null); 
  const [mapSearchQuery, setMapSearchQuery] = useState("");
  const [isSearchingMap, setIsSearchingMap] = useState(false);

  useEffect(() => {
    let channel: any;
    const initializeComponent = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return navigate("/");

        const { data: profile } = await supabase.from('profiles').select('*, departments(name_en)').eq('id', user.id).single();
        setCurrentUser(profile);

        if (!profile?.departments?.name_en?.includes("Education") && profile?.role !== 'admin') {
          toast.error("Access Denied: Education Department clearance required.");
          return navigate("/app"); 
        }

        await fetchData();
        channel = supabase.channel('education-realtime').on('postgres_changes', { event: '*', schema: 'public' }, () => { fetchData(); }).subscribe();
      } catch (error) { console.error(error); navigate("/"); }
    };

    initializeComponent();
    return () => { if (channel) supabase.removeChannel(channel); };
  }, [navigate]);

  const fetchData = async () => {
    setIsLoading(true);
    const [
      { data: booksData }, { data: readingsData }, 
      { data: eventsData }, { data: quizzesData }
    ] = await Promise.all([
      supabase.from('study_books').select('*').order('created_at', { ascending: false }),
      supabase.from('assignments').select('*').order('created_at', { ascending: false }),
      supabase.from('events').select('*').order('event_date', { ascending: true }),
      supabase.from('quizzes').select('*').order('created_at', { ascending: false })
    ]);
    
    setBooks(booksData || []); setReadings(readingsData || []); setEvents(eventsData || []); setQuizzes(quizzesData || []);
    
    const activeBook = (booksData || []).find(b => b.status === 'active');
    if (activeBook) {
      const [ { data: allProgress }, { data: allScores } ] = await Promise.all([
        supabase.from('reading_progress').select('reading_id, is_completed').eq('is_completed', true),
        supabase.from('quiz_scores').select('quiz_id, score')
      ]);

      const activeAssignments = (readingsData || []).filter(r => r.book_id === activeBook.id).reverse();
      const formattedChartData = activeAssignments.map(assignment => {
        const completedCount = (allProgress || []).filter(p => p.reading_id === assignment.id).length;
        const relatedQuiz = (quizzesData || []).find(q => q.title.includes(assignment.week_title));
        const quizTakes = relatedQuiz ? (allScores || []).filter(s => s.quiz_id === relatedQuiz.id).length : 0;
        return { name: assignment.week_title, readingsDone: completedCount, quizzesTaken: quizTakes };
      });

      setChartData(formattedChartData);
      setStats({
        totalReadings: allProgress?.length || 0,
        totalQuizzes: allScores?.length || 0,
        avgScore: allScores && allScores.length > 0 ? Math.round(allScores.reduce((acc, s) => acc + s.score, 0) / allScores.length) : 0
      });
    }
    setIsLoading(false);
  };

  // --- HANDLERS ---
  const handleAddBook = async () => {
    if (!newBookTitle.trim()) return toast.error("Book title is required");
    const { error } = await supabase.from('study_books').insert([{ title: newBookTitle.trim() }]);
    if (error) return toast.error(error.message);
    toast.success("Study Book created successfully!");
    setNewBookTitle(""); setShowBookSuggestions(false); fetchData();
  };

  const handleAddReading = async () => {
    if (!readingBookId || !newReading.week || !newReading.chapters) return toast.error("Fill all fields and select a Book");
    const { error } = await supabase.from('assignments').insert([{ book_id: readingBookId, week_title: newReading.week, chapters: newReading.chapters }]);
    if (error) return toast.error(error.message);
    toast.success("Reading scheduled!");
    setNewReading({ week: "", chapters: "" }); fetchData();
  };

  const handleSaveQuiz = async () => {
    if (!quizTitle || !quizBookId) return toast.error("Title and Book are required");
    if (quizType === 'weekly' && !selectedAssignment) return toast.error("Weekly quizzes must be linked to a reading assignment");

    try {
      const { data: quizData, error: quizError } = await supabase.from('quizzes').insert([{ 
        title: quizTitle, book_id: quizBookId, quiz_type: quizType, assignment_id: quizType === 'weekly' ? selectedAssignment : null 
      }]).select().single();
      if (quizError) throw quizError;
      
      const preparedQuestions = questions.map(q => ({
        quiz_id: quizData.id, question_text: q.text, options: q.options, correct_option_index: q.correct
      }));
      const { error: qError } = await supabase.from('quiz_questions').insert(preparedQuestions);
      if (qError) throw qError;
      
      toast.success(`${quizType.charAt(0).toUpperCase() + quizType.slice(1)} saved successfully!`);
      setQuizTitle(""); setQuestions([{ text: "", options: ["", "", "", ""], correct: 0 }]);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleSearchLocation = async () => {
    if (!mapSearchQuery.trim()) return;
    setIsSearchingMap(true);
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(mapSearchQuery)}`);
      const data = await response.json();
      if (data && data.length > 0) {
        setMapPosition({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }); 
        if (!newEvent.locationName) setNewEvent({ ...newEvent, locationName: data[0].display_name.split(',')[0] });
        toast.success("Location found!");
      } else { toast.error("Could not find that location."); }
    } catch (error) { toast.error("Error searching for location."); } finally { setIsSearchingMap(false); }
  };

  const handleAddEvent = async () => {
    if (!newEvent.title || !newEvent.date || !newEvent.time) return toast.error("Fill all required fields");
    setIsUploading(true);
    try {
      let finalImageUrl = null;
      if (eventImage) {
        const fileName = `event_${Date.now()}.${eventImage.name.split('.').pop()}`;
        const { error: uploadError } = await supabase.storage.from('event_images').upload(fileName, eventImage);
        if (uploadError) throw uploadError;
        finalImageUrl = supabase.storage.from('event_images').getPublicUrl(fileName).data.publicUrl;
      }
      const eventDateTime = new Date(`${newEvent.date}T${newEvent.time}`).toISOString();
      const { error } = await supabase.from('events').insert([{
        title: newEvent.title, description: newEvent.description, event_date: eventDateTime, type: newEvent.type,
        location: mapPosition ? `https://maps.google.com/?q=${mapPosition.lat},${mapPosition.lng}` : newEvent.locationName, image_url: finalImageUrl,
        agenda: agenda 
      }]);
      if (error) throw error;
      toast.success("Event added successfully!");
      setNewEvent({ title: "", date: "", time: "", type: "gathering", description: "", locationName: "" });
      setMapPosition(null); setEventImage(null); setMapSearchQuery(""); setAgenda([]); fetchData();
    } catch (error: any) { toast.error(error.message); } finally { setIsUploading(false); }
  };

  const handleDelete = async (table: string, id: string) => {
    if(!confirm("Are you sure? This will delete all connected records and cannot be undone.")) return;
    try {
      if (table === 'events') {
        const { data: eventToDelete } = await supabase.from('events').select('image_url').eq('id', id).single();
        if (eventToDelete?.image_url) {
          const urlParts = eventToDelete.image_url.split('/');
          await supabase.storage.from('event_images').remove([urlParts[urlParts.length - 1]]);
        }
      }
      if (table === 'study_books') {
        const { data: assignments } = await supabase.from('assignments').select('id').eq('book_id', id);
        if (assignments && assignments.length > 0) {
          const assignmentIds = assignments.map(a => a.id);
          await supabase.from('reading_progress').delete().in('reading_id', assignmentIds);
          await supabase.from('assignments').delete().eq('book_id', id);
        }
        const { data: qzs } = await supabase.from('quizzes').select('id').eq('book_id', id);
        if (qzs && qzs.length > 0) {
          const quizIds = qzs.map(q => q.id);
          await supabase.from('quiz_questions').delete().in('quiz_id', quizIds);
          await supabase.from('quiz_scores').delete().in('quiz_id', quizIds);
          await supabase.from('quizzes').delete().eq('book_id', id);
        }
        await supabase.from('book_grades').delete().eq('book_id', id);
      }
      if (table === 'quizzes') {
        await supabase.from('quiz_questions').delete().eq('quiz_id', id);
        await supabase.from('quiz_scores').delete().eq('quiz_id', id);
      }
      if (table === 'assignments') {
        await supabase.from('reading_progress').delete().eq('reading_id', id);
      }

      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
      toast.success("Deleted successfully!");
      fetchData();
    } catch (error: any) { toast.error("Error deleting: " + error.message); }
  };

  const filteredBookSuggestions = newBookTitle.trim() === "" ? [] : BIBLE_BOOKS.filter(book => book.toLowerCase().includes(newBookTitle.toLowerCase()));
  const filteredReadings = readings.filter(r => r.book_id === quizBookId);
  const isEducationHead = currentUser?.role === 'admin' || currentUser?.department_role === 'head' || currentUser?.department_role === 'deputy';

  if (isLoading) return <div className="flex flex-col items-center justify-center h-[50vh]"><Loader2 className="w-10 h-10 animate-spin text-green-600 mb-4" /></div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* HEADER */}
      <div className="bg-white rounded-xl p-6 sm:p-8 border border-green-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-sm">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-black flex items-center gap-2">
            <BookOpen className="w-8 h-8 text-green-600" /> Education Workspace
          </h2>
          <p className="text-gray-600 font-medium mt-1">Manage curriculum, track engagement, and oversee departmental tasks.</p>
        </div>
        <Badge className="bg-green-600 text-white font-bold px-4 py-2 shadow-sm border-none">
          {isEducationHead ? 'Department Head' : 'Education Team'}
        </Badge>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        {/* SECURE SUB-TAB LIST */}
        <TabsList className="flex flex-wrap w-full gap-2 mb-6 h-auto bg-green-50 p-2 rounded-xl border border-green-100 shadow-inner">
          <TabsTrigger value="overview" className="flex-1 min-w-[100px] py-2.5 text-xs sm:text-sm font-bold data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:shadow-sm">Overview</TabsTrigger>
          
          {/* ONLY DEPT HEADS/DEPUTIES SEE CURRICULUM TABS */}
          {isEducationHead && (
            <>
              <TabsTrigger value="books" className="flex-1 min-w-[100px] py-2.5 text-xs sm:text-sm font-bold data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:shadow-sm">Books</TabsTrigger>
              <TabsTrigger value="readings" className="flex-1 min-w-[100px] py-2.5 text-xs sm:text-sm font-bold data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:shadow-sm">Readings</TabsTrigger>
              <TabsTrigger value="quizzes" className="flex-1 min-w-[100px] py-2.5 text-xs sm:text-sm font-bold data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:shadow-sm">Quizzes</TabsTrigger>
              <TabsTrigger value="events" className="flex-1 min-w-[100px] py-2.5 text-xs sm:text-sm font-bold data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:shadow-sm">Events</TabsTrigger>
            </>
          )}
        </TabsList>

        {/* TAB 1: WORKSPACE OVERVIEW (Tasks & Charts) */}
        <TabsContent value="overview" className="space-y-6 animate-in fade-in duration-500">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            
            {/* LEFT COLUMN: TASK BOARD */}
            <div className="xl:col-span-1 space-y-6">
              <DepartmentTaskBoard 
                departmentId={currentUser?.department_id} 
                currentUser={currentUser} 
                accentColor="green" 
              />
            </div>

            {/* RIGHT COLUMN: STATS & CHARTS */}
            <div className="xl:col-span-2 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="border-green-200 shadow-sm bg-white hover:border-green-400 transition-colors">
                  <CardContent className="p-5 flex items-center gap-4">
                    <div className="p-3 bg-green-50 rounded-xl"><BookOpen className="w-6 h-6 text-green-600" /></div>
                    <div><p className="text-[10px] font-bold uppercase text-gray-500 tracking-wider">Total Readings</p><p className="text-2xl font-black text-black leading-none mt-1">{stats.totalReadings}</p></div>
                  </CardContent>
                </Card>
                <Card className="border-green-200 shadow-sm bg-white hover:border-green-400 transition-colors">
                  <CardContent className="p-5 flex items-center gap-4">
                    <div className="p-3 bg-green-50 rounded-xl"><CheckCircle className="w-6 h-6 text-green-600" /></div>
                    <div><p className="text-[10px] font-bold uppercase text-gray-500 tracking-wider">Quizzes Taken</p><p className="text-2xl font-black text-black leading-none mt-1">{stats.totalQuizzes}</p></div>
                  </CardContent>
                </Card>
                <Card className="border-green-200 shadow-sm bg-white hover:border-green-400 transition-colors">
                  <CardContent className="p-5 flex items-center gap-4">
                    <div className="p-3 bg-black rounded-xl"><Award className="w-6 h-6 text-white" /></div>
                    <div><p className="text-[10px] font-bold uppercase text-gray-500 tracking-wider">Avg Church Score</p><p className="text-2xl font-black text-black leading-none mt-1">{stats.avgScore}%</p></div>
                  </CardContent>
                </Card>
              </div>

              <Card className="border-green-200 shadow-sm bg-white flex flex-col h-[380px]">
                <CardHeader className="bg-gray-50/50 border-b border-gray-100 pb-4 flex-none">
                  <CardTitle className="text-lg flex items-center gap-2 text-black"><TrendingUp className="w-5 h-5 text-green-600" /> Congregation Engagement</CardTitle>
                  <CardDescription>Completion rates for the active study book</CardDescription>
                </CardHeader>
                <CardContent className="pt-6 flex-1 min-h-0">
                  {chartData.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400"><BarChart className="w-12 h-12 mb-2 opacity-20" /><p>Not enough data to display engagement.</p></div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0fdf4" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                        <Tooltip cursor={{fill: 'transparent'}} contentStyle={{borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                        <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                        <Bar dataKey="readingsDone" name="Readings Completed" fill="#16a34a" radius={[4, 4, 0, 0]} maxBarSize={40} />
                        <Bar dataKey="quizzesTaken" name="Quizzes Taken" fill="#000000" radius={[4, 4, 0, 0]} maxBarSize={40} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ONLY LEADERS CAN SEE CURRICULUM MANAGEMENT */}
        {isEducationHead && (
          <>
            {/* TAB 2: BOOKS */}
            <TabsContent value="books" className="space-y-6 animate-in fade-in duration-500">
              <Card className="border-green-200 shadow-sm overflow-visible bg-white">
                <CardHeader><CardTitle className="flex items-center gap-2 text-black"><Library className="w-5 h-5 text-green-600"/> Create New Study Book</CardTitle><CardDescription>Start a new season of study</CardDescription></CardHeader>
                <CardContent className="space-y-4 overflow-visible">
                  <div className="flex flex-col sm:flex-row gap-4 relative">
                    <div className="flex-1 relative">
                      <Input placeholder="Start typing a book (e.g. Genesis)..." value={newBookTitle} onChange={(e) => { setNewBookTitle(e.target.value); setShowBookSuggestions(true); }} onFocus={() => setShowBookSuggestions(true)} onBlur={() => setShowBookSuggestions(false)} className="w-full border-green-200" />
                      {showBookSuggestions && filteredBookSuggestions.length > 0 && (
                        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-48 overflow-y-auto top-full left-0">
                          {filteredBookSuggestions.map(bookName => (
                            <div key={bookName} className="px-4 py-2.5 hover:bg-green-50 cursor-pointer text-sm text-black font-medium transition-colors" onMouseDown={(e) => { e.preventDefault(); setNewBookTitle(bookName); setShowBookSuggestions(false); }}>{bookName}</div>
                          ))}
                        </div>
                      )}
                    </div>
                    <Button onClick={handleAddBook} className="bg-green-600 hover:bg-green-700 text-white w-full sm:w-auto shrink-0 z-0"><Plus className="w-4 h-4 mr-2" /> Create Book</Button>
                  </div>
                </CardContent>
              </Card>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {books.map(b => (
                  <div key={b.id} className="flex justify-between items-center p-5 bg-white border border-green-200 rounded-xl shadow-sm hover:border-green-400 transition-colors">
                    <div><p className="font-bold text-black text-lg">{b.title}</p><Badge variant="outline" className="mt-1 bg-green-50 text-green-700 border-green-200">Active Study</Badge></div>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete('study_books', b.id)}><Trash2 className="w-5 h-5 text-red-500 hover:text-red-700" /></Button>
                  </div>
                ))}
              </div>
            </TabsContent>

            {/* TAB 3: READINGS */}
            <TabsContent value="readings" className="space-y-6 animate-in fade-in duration-500">
              <Card className="border-green-200 shadow-sm bg-white">
                <CardHeader><CardTitle className="text-black">Schedule Weekly Reading</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Select onValueChange={setReadingBookId} value={readingBookId}>
                      <SelectTrigger className="border-green-200"><SelectValue placeholder="Select Study Book..." /></SelectTrigger>
                      <SelectContent position="popper" sideOffset={4} className="max-h-[200px] overflow-y-auto">
                        {books.map(b => <SelectItem key={b.id} value={b.id}>{b.title}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input placeholder="Week (e.g. Week 1)" value={newReading.week} onChange={(e) => setNewReading({...newReading, week: e.target.value})} className="border-green-200" />
                    <Input placeholder="Chapters (e.g. Romans 1-3)" value={newReading.chapters} onChange={(e) => setNewReading({...newReading, chapters: e.target.value})} className="border-green-200" />
                  </div>
                  <Button onClick={handleAddReading} className="bg-green-600 hover:bg-green-700 text-white w-full"><Plus className="w-4 h-4 mr-2" /> Add Assignment</Button>
                </CardContent>
              </Card>
              <div className="space-y-3">
                {readings.map(r => {
                  const book = books.find(b => b.id === r.book_id);
                  return (
                    <div key={r.id} className="flex justify-between items-center p-4 bg-white border border-gray-100 rounded-lg hover:border-green-300 transition-colors shadow-sm">
                      <div><p className="font-bold text-black">{r.week_title} <span className="text-gray-400 font-normal ml-2">| {book?.title}</span></p><p className="text-sm text-green-700 font-medium">{r.chapters}</p></div>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete('assignments', r.id)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                    </div>
                  )
                })}
              </div>
            </TabsContent>

            {/* TAB 4: QUIZZES */}
            <TabsContent value="quizzes" className="space-y-6 animate-in fade-in duration-500">
              <Card className="border-green-200 shadow-sm bg-white">
                <CardHeader><CardTitle className="text-black">Create Assessment</CardTitle><CardDescription>Build weekly quizzes, midterms, or final exams</CardDescription></CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 bg-green-50/50 p-4 rounded-xl border border-green-100">
                    <div className="lg:col-span-2"><Label className="text-xs text-black font-bold mb-1 block">Title</Label><Input value={quizTitle} onChange={(e) => setQuizTitle(e.target.value)} placeholder="e.g. Romans Midterm Exam" className="bg-white border-green-200" /></div>
                    <div>
                      <Label className="text-xs text-black font-bold mb-1 block">Target Book</Label>
                      <Select onValueChange={setQuizBookId} value={quizBookId}>
                        <SelectTrigger className="bg-white border-green-200"><SelectValue placeholder="Select Book" /></SelectTrigger>
                        <SelectContent position="popper" sideOffset={4} className="max-h-[200px] overflow-y-auto">
                          {books.map(b => <SelectItem key={b.id} value={b.id}>{b.title}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs text-black font-bold mb-1 block">Assessment Type</Label>
                      <Select onValueChange={setQuizType} value={quizType}>
                        <SelectTrigger className="bg-white border-green-200"><SelectValue placeholder="Type" /></SelectTrigger>
                        <SelectContent position="popper" sideOffset={4} className="max-h-[200px] overflow-y-auto">
                          <SelectItem value="weekly">Weekly Quiz</SelectItem>
                          <SelectItem value="midterm">Midterm Exam</SelectItem>
                          <SelectItem value="final">Final Exam</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {quizType === 'weekly' && quizBookId && (
                      <div className="lg:col-span-4 mt-2">
                        <Label className="text-xs text-black font-bold mb-1 block">Link to Weekly Reading</Label>
                        <Select onValueChange={setSelectedAssignment}>
                          <SelectTrigger className="bg-white border-green-200"><SelectValue placeholder="Select which reading this quiz covers..." /></SelectTrigger>
                          <SelectContent position="popper" sideOffset={4} className="max-h-[200px] overflow-y-auto">
                            {filteredReadings.length === 0 && <SelectItem value="none" disabled>No readings found for this book</SelectItem>}
                            {filteredReadings.map(r => <SelectItem key={r.id} value={r.id}>{r.week_title} - {r.chapters}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                  <div className="space-y-6 pt-4">
                    {questions.map((q, qIdx) => (
                      <div key={qIdx} className="p-4 sm:p-5 bg-white rounded-xl border border-green-200 shadow-sm space-y-4 relative">
                        <div className="flex justify-between items-center border-b border-gray-100 pb-2"><Label className="text-black font-black tracking-wider uppercase text-xs">Question {qIdx + 1}</Label>{questions.length > 1 && (<Button variant="ghost" size="sm" onClick={() => setQuestions(questions.filter((_, i) => i !== qIdx))} className="h-6 px-2 text-red-600 hover:bg-red-50"><X className="w-3 h-3 mr-1" /> Remove</Button>)}</div>
                        <Input placeholder="Type your question here..." value={q.text} className="font-medium border-gray-200" onChange={(e) => { const newQs = [...questions]; newQs[qIdx].text = e.target.value; setQuestions(newQs); }}/>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-gray-50 p-3 rounded-lg border border-gray-200">
                          {q.options.map((opt, oIdx) => (
                            <div key={oIdx} className="flex items-center gap-3 bg-white p-2 rounded-md border border-gray-200">
                              <input type="radio" name={`correct-${qIdx}`} checked={q.correct === oIdx} onChange={() => { const newQs = [...questions]; newQs[qIdx].correct = oIdx; setQuestions(newQs); }} className="w-4 h-4 text-green-600 focus:ring-green-500 shrink-0"/>
                              <Input placeholder={`Option ${oIdx + 1}`} value={opt} className="border-none shadow-none focus-visible:ring-0 px-0 h-8 text-black" onChange={(e) => { const newQs = [...questions]; newQs[qIdx].options[oIdx] = e.target.value; setQuestions(newQs); }}/>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t border-gray-100">
                    <Button variant="outline" className="flex-1 border-green-600 text-green-700 hover:bg-green-50" onClick={() => setQuestions([...questions, { text: "", options: ["", "", "", ""], correct: 0 }])}><Plus className="w-4 h-4 mr-2" /> Add Another Question</Button>
                    <Button className="flex-1 bg-black hover:bg-gray-800 text-white shadow-md font-bold text-lg h-auto py-3" onClick={handleSaveQuiz}><CheckSquare className="w-5 h-5 mr-2" /> Publish {quizType === 'weekly' ? 'Quiz' : 'Exam'}</Button>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-3 mt-8">
                <h3 className="text-lg font-bold text-black mb-4 px-2">Manage Scheduled Quizzes</h3>
                {books.map((b: any) => {
                  const bookQuizzes = (quizzes || []).filter((q: any) => q?.book_id === b?.id);
                  if (!bookQuizzes || bookQuizzes.length === 0) return null;
                  return (
                    <div key={`book-group-${b.id}`} className="mb-6">
                      <h4 className="text-sm font-bold text-green-700 uppercase tracking-widest mb-2 ml-2">{b.title}</h4>
                      <div className="space-y-2">
                        {bookQuizzes.map((quiz: any) => (
                          <div key={quiz.id} className="flex justify-between items-center p-3 bg-white border border-green-100 rounded-lg hover:border-green-300 transition-colors shadow-sm">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                              <Badge variant="outline" className="bg-gray-100 text-black border-gray-200 w-fit">{quiz.quiz_type}</Badge>
                              <p className="font-bold text-black">{quiz.title}</p>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => handleDelete('quizzes', quiz.id)}><Trash2 className="w-4 h-4 text-red-500 hover:text-red-700 hover:bg-red-50 rounded" /></Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </TabsContent>

            {/* TAB 5: EVENTS */}
            <TabsContent value="events" className="space-y-6 animate-in fade-in duration-500">
              <Card className="border-green-200 shadow-sm bg-white">
                <CardHeader><CardTitle className="text-black">Add Church Event</CardTitle></CardHeader>
                <CardContent className="space-y-5">
                  <div className="space-y-2"><Label className="text-xs text-black font-bold uppercase">Event Title</Label><Input placeholder="e.g. Sunday Morning Service" value={newEvent.title} onChange={(e) => setNewEvent({...newEvent, title: e.target.value})} className="border-green-200" /></div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2"><Label className="text-xs text-black font-bold uppercase">Date</Label><Input type="date" value={newEvent.date} onChange={(e) => setNewEvent({...newEvent, date: e.target.value})} className="border-green-200" /></div>
                    <div className="space-y-2"><Label className="text-xs text-black font-bold uppercase">Time</Label><Input type="time" value={newEvent.time} onChange={(e) => setNewEvent({...newEvent, time: e.target.value})} className="border-green-200" /></div>
                  </div>
                  
                  {/* Event Agenda Breakdown */}
                  <div className="space-y-3 border-t border-gray-100 pt-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <Label className="text-xs text-black font-bold uppercase flex items-center gap-2">
                        <Clock className="w-4 h-4 text-green-600" /> Event Schedule Breakdown (Optional)
                      </Label>
                      <Button variant="outline" size="sm" className="h-8 text-xs border-green-200 text-green-700 hover:bg-green-50" onClick={() => setAgenda([...agenda, { time: "", activity: "" }])}>
                        <Plus className="w-3 h-3 mr-1" /> Add Schedule Item
                      </Button>
                    </div>
                    {agenda.length > 0 && (
                      <div className="space-y-2 bg-green-50/30 p-4 rounded-xl border border-green-100">
                        {agenda.map((item, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <Input type="time" value={item.time} onChange={(e) => { const newAgenda = [...agenda]; newAgenda[index].time = e.target.value; setAgenda(newAgenda); }} className="w-32 bg-white border-green-200" />
                            <Input placeholder="e.g. Opening Prayer" value={item.activity} onChange={(e) => { const newAgenda = [...agenda]; newAgenda[index].activity = e.target.value; setAgenda(newAgenda); }} className="flex-1 bg-white border-green-200" />
                            <Button variant="ghost" size="icon" className="text-gray-400 hover:text-red-500 shrink-0 h-9 w-9" onClick={() => setAgenda(agenda.filter((_, i) => i !== index))}><X className="w-4 h-4" /></Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-gray-100 pt-4">
                    <div className="space-y-2">
                      <Label className="text-xs text-black font-bold uppercase">Event Type</Label>
                      <Select value={newEvent.type} onValueChange={(v: any) => setNewEvent({...newEvent, type: v})}>
                        <SelectTrigger className="border-green-200"><SelectValue placeholder="Event Type" /></SelectTrigger>
                        <SelectContent position="popper" sideOffset={4} className="max-h-[200px] overflow-y-auto">
                          <SelectItem value="gathering">Gathering</SelectItem>
                          <SelectItem value="meeting">Meeting</SelectItem>
                          <SelectItem value="event">Special Event</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2"><Label className="text-xs text-black font-bold uppercase">Location Title (Optional)</Label><div className="relative"><MapIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><Input placeholder="e.g. Main Sanctuary" value={newEvent.locationName} onChange={(e) => setNewEvent({...newEvent, locationName: e.target.value})} className="pl-10 border-green-200" /></div></div>
                  </div>
                  <div className="space-y-2 border-t border-gray-100 pt-4"><Label className="text-xs text-black font-bold uppercase flex items-center gap-2"><ImageIcon className="w-4 h-4 text-green-600" /> Cover Image (Optional)</Label><div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex items-center gap-4"><input type="file" accept="image/*" onChange={(e) => setEventImage(e.target.files?.[0] || null)} className="w-full text-sm text-black file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-bold file:bg-green-100 file:text-green-800 hover:file:bg-green-200 cursor-pointer" /></div></div>
                  <div className="space-y-3 border-t border-gray-100 pt-4">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-2 mb-2"><Label className="text-xs text-black font-bold uppercase">Pin Exact Location on Map</Label>{mapPosition && <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-[10px]">Pin Dropped ✓</Badge>}</div>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><Input placeholder="Search for an address, city, or landmark..." value={mapSearchQuery} onChange={(e) => setMapSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearchLocation()} className="pl-9 border-green-200" /></div>
                      <Button onClick={handleSearchLocation} disabled={isSearchingMap} variant="outline" className="shrink-0 border-green-600 text-green-700 hover:bg-green-50">{isSearchingMap ? <Loader2 className="w-4 h-4 animate-spin" /> : "Search Map"}</Button>
                    </div>
                    <div className="h-[300px] w-full rounded-xl overflow-hidden border border-gray-200 shadow-inner z-0 relative mt-2"><MapContainer center={[25.2048, 55.2708]} zoom={11} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}><TileLayer attribution='© OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" /><LocationPicker position={mapPosition} setPosition={setMapPosition} /><MapUpdater position={mapPosition} /></MapContainer></div>
                  </div>
                  <div className="space-y-2 border-t border-gray-100 pt-4"><Label className="text-xs text-black font-bold uppercase">Details / Description</Label><Textarea placeholder="Event Description..." value={newEvent.description} onChange={(e) => setNewEvent({...newEvent, description: e.target.value})} className="h-24 resize-none border-green-200" /></div>
                  <Button onClick={handleAddEvent} disabled={isUploading} className="bg-green-600 hover:bg-green-700 text-white w-full py-6 text-lg font-bold shadow-md mt-4">{isUploading ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Uploading...</> : <><Plus className="w-5 h-5 mr-2" /> Post Event</>}</Button>
                </CardContent>
              </Card>
              
              <div className="space-y-3 mt-8">
                <h3 className="text-lg font-bold text-black mb-4 px-2">Manage Scheduled Events</h3>
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
                            <img src={event.image_url} alt={event.title} className="w-16 h-16 rounded-xl object-cover shadow-sm border border-gray-200" />
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
                        <Button variant="ghost" size="icon" onClick={() => handleDelete('events', event.id)}>
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
          </>
        )}
      </Tabs>
    </div>
  );
}