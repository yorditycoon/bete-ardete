import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { BookOpen, Plus, Calendar, CheckSquare, Trash2, Loader2, X, Library, MapPin as MapIcon, Image as ImageIcon, Search } from "lucide-react";
import { supabase } from "../lib/supabase"; 
import { toast } from "sonner";

// --- MAP IMPORTS ---
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Create a custom green map pin using an SVG
const customMapPin = new L.DivIcon({
  className: 'bg-transparent',
  html: `<div style="color: #16a34a; transform: translate(-50%, -100%);"><svg width="36" height="36" viewBox="0 0 24 24" fill="currentColor" stroke="white" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3" fill="white"></circle></svg></div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 36]
});

function LocationPicker({ position, setPosition }: { position: any, setPosition: any }) {
  useMapEvents({
    click(e) { setPosition(e.latlng); },
  });
  return position === null ? null : <Marker position={position} icon={customMapPin} />;
}

function MapUpdater({ position }: { position: any }) {
  const map = useMap();
  useEffect(() => {
    if (position) {
      map.flyTo([position.lat, position.lng], 15);
    }
  }, [position, map]);
  return null;
}

// --- STANDARD BIBLE BOOKS FOR AUTOCOMPLETE ---
const BIBLE_BOOKS = [
  "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy", "Joshua", "Judges", "Ruth", "1 Samuel", "2 Samuel", "1 Kings", "2 Kings", "1 Chronicles", "2 Chronicles", "Ezra", "Nehemiah", "Esther", "Job", "Psalms", "Proverbs", "Ecclesiastes", "Song of Solomon", "Isaiah", "Jeremiah", "Lamentations", "Ezekiel", "Daniel", "Hosea", "Joel", "Amos", "Obadiah", "Jonah", "Micah", "Nahum", "Habakkuk", "Zephaniah", "Haggai", "Zechariah", "Malachi",
  "Matthew", "Mark", "Luke", "John", "Acts", "Romans", "1 Corinthians", "2 Corinthians", "Galatians", "Ephesians", "Philippians", "Colossians", "1 Thessalonians", "2 Thessalonians", "1 Timothy", "2 Timothy", "Titus", "Philemon", "Hebrews", "James", "1 Peter", "2 Peter", "1 John", "2 John", "3 John", "Jude", "Revelation"
];

export function AdminControls() {
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  // --- Data States ---
  const [books, setBooks] = useState<any[]>([]);
  const [readings, setReadings] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [quizzes, setQuizzes] = useState<any[]>([]); 
  
  // --- Book State & Autocomplete ---
  const [newBookTitle, setNewBookTitle] = useState("");
  const [showBookSuggestions, setShowBookSuggestions] = useState(false);

  // --- Reading Form States ---
  const [readingBookId, setReadingBookId] = useState("");
  const [newReading, setNewReading] = useState({ week: "", chapters: "" });
  
  // --- Quiz Form States ---
  const [quizTitle, setQuizTitle] = useState("");
  const [quizBookId, setQuizBookId] = useState("");
  const [quizType, setQuizType] = useState("weekly");
  const [selectedAssignment, setSelectedAssignment] = useState("");
  const [questions, setQuestions] = useState([{ text: "", options: ["", "", "", ""], correct: 0 }]);
  
  // --- Event Form States ---
  const [newEvent, setNewEvent] = useState({
    title: "", date: "", time: "", type: "gathering", description: "", locationName: ""
  });
  const [mapPosition, setMapPosition] = useState<{lat: number, lng: number} | null>(null);
  const [eventImage, setEventImage] = useState<File | null>(null); 
  const [mapSearchQuery, setMapSearchQuery] = useState("");
  const [isSearchingMap, setIsSearchingMap] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    const { data: booksData } = await supabase.from('study_books').select('*').order('created_at', { ascending: false });
    const { data: readingsData } = await supabase.from('assignments').select('*').order('created_at', { ascending: false });
    const { data: eventsData } = await supabase.from('events').select('*').order('event_date', { ascending: true });
    const { data: quizzesData } = await supabase.from('quizzes').select('*').order('created_at', { ascending: false });
    
    if (booksData) setBooks(booksData);
    if (readingsData) setReadings(readingsData);
    if (eventsData) setEvents(eventsData);
    if (quizzesData) setQuizzes(quizzesData);
    
    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
    const channel = supabase.channel('admin-controls-realtime')
      .on('postgres_changes', { event: '*', schema: 'public' }, () => { fetchData(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleAddBook = async () => {
    if (!newBookTitle.trim()) return toast.error("Book title is required");
    const { error } = await supabase.from('study_books').insert([{ title: newBookTitle.trim() }]);
    if (error) return toast.error(error.message);
    toast.success("Study Book created successfully!");
    setNewBookTitle("");
    setShowBookSuggestions(false);
    fetchData();
  };

  const handleAddReading = async () => {
    if (!readingBookId || !newReading.week || !newReading.chapters) return toast.error("Fill all fields and select a Book");
    const { error } = await supabase.from('assignments').insert([{ book_id: readingBookId, week_title: newReading.week, chapters: newReading.chapters }]);
    if (error) return toast.error(error.message);
    toast.success("Reading scheduled!");
    setNewReading({ week: "", chapters: "" });
    fetchData();
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
      setQuizTitle("");
      setQuestions([{ text: "", options: ["", "", "", ""], correct: 0 }]);
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
        const result = data[0];
        const newPosition = { lat: parseFloat(result.lat), lng: parseFloat(result.lon) };
        setMapPosition(newPosition); 
        if (!newEvent.locationName) {
          const cleanName = result.display_name.split(',')[0];
          setNewEvent({ ...newEvent, locationName: cleanName });
        }
        toast.success("Location found!");
      } else {
        toast.error("Could not find that location. Try being more specific.");
      }
    } catch (error) {
      toast.error("Error searching for location.");
    } finally {
      setIsSearchingMap(false);
    }
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
      if (mapPosition) {
        finalLocationString = `https://maps.google.com/?q=${mapPosition.lat},${mapPosition.lng}`;
      }

      const eventDateTime = new Date(`${newEvent.date}T${newEvent.time}`).toISOString();
      const { error } = await supabase.from('events').insert([{
        title: newEvent.title, description: newEvent.description, event_date: eventDateTime, type: newEvent.type,
        location: finalLocationString, image_url: finalImageUrl 
      }]);
      if (error) throw error;
      
      toast.success("Event added successfully!");
      setNewEvent({ title: "", date: "", time: "", type: "gathering", description: "", locationName: "" });
      setMapPosition(null);
      setEventImage(null);
      setMapSearchQuery("");
      fetchData();
    } catch (error: any) {
      toast.error("Failed to post event: " + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (table: string, id: string) => {
    if(!confirm("Are you sure? This will delete all connected records and cannot be undone.")) return;
    
    try {
      if (table === 'events') {
        const { data: eventToDelete } = await supabase.from('events').select('image_url').eq('id', id).single();
        if (eventToDelete && eventToDelete.image_url) {
          const urlParts = eventToDelete.image_url.split('/');
          const fileName = urlParts[urlParts.length - 1];
          await supabase.storage.from('event_images').remove([fileName]);
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
      
      toast.success("Deleted completely and successfully!");
      fetchData();
    } catch (error: any) {
      toast.error("Error deleting: " + error.message);
    }
  };

  // Filter books for autocomplete based on input
  const filteredBookSuggestions = newBookTitle.trim() === "" 
    ? [] 
    : BIBLE_BOOKS.filter(book => book.toLowerCase().includes(newBookTitle.toLowerCase()));

  const filteredReadings = readings.filter(r => r.book_id === quizBookId);

  return (
    <div className="space-y-6 max-w-5xl mx-auto p-4">
      <div className="bg-gradient-to-r from-green-100 to-green-50 rounded-lg p-6 border border-green-200 flex justify-between items-center shadow-sm">
        <div>
          <h2 className="text-2xl font-bold text-green-900">Admin Controls</h2>
          <p className="text-green-700">Manage Books, Readings, Exams, and Events</p>
        </div>
        {(isLoading || isUploading) && <Loader2 className="animate-spin text-green-600 w-8 h-8" />}
      </div>

      <Tabs defaultValue="books" className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 gap-2 mb-8 h-auto bg-green-50/80 p-1.5 rounded-xl">
          <TabsTrigger value="books" className="py-2.5 text-xs sm:text-sm whitespace-normal data-[state=active]:bg-white data-[state=active]:shadow-sm">Study Books</TabsTrigger>
          <TabsTrigger value="readings" className="py-2.5 text-xs sm:text-sm whitespace-normal data-[state=active]:bg-white data-[state=active]:shadow-sm">Weekly Readings</TabsTrigger>
          <TabsTrigger value="quizzes" className="py-2.5 text-xs sm:text-sm whitespace-normal data-[state=active]:bg-white data-[state=active]:shadow-sm">Quizzes & Exams</TabsTrigger>
          <TabsTrigger value="events" className="py-2.5 text-xs sm:text-sm whitespace-normal data-[state=active]:bg-white data-[state=active]:shadow-sm">Events</TabsTrigger>
        </TabsList>

        <TabsContent value="books" className="space-y-6">
          <Card className="border-green-200 shadow-sm overflow-visible">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Library className="w-5 h-5 text-green-600"/> Create New Study Book</CardTitle>
              <CardDescription>Start a new season of study (e.g. "The Book of Romans")</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 overflow-visible">
              <div className="flex flex-col sm:flex-row gap-4 relative">
                
                {/* Autocomplete Container */}
                <div className="flex-1 relative">
                  <Input 
                    placeholder="Start typing a book (e.g. Genesis)..." 
                    value={newBookTitle} 
                    onChange={(e) => {
                      setNewBookTitle(e.target.value);
                      setShowBookSuggestions(true);
                    }}
                    onFocus={() => setShowBookSuggestions(true)}
                    onBlur={() => setShowBookSuggestions(false)}
                    className="w-full"
                  />
                  
                  {/* The Dropdown Menu */}
                  {showBookSuggestions && filteredBookSuggestions.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-48 overflow-y-auto top-full left-0">
                      {filteredBookSuggestions.map(bookName => (
                        <div 
                          key={bookName}
                          className="px-4 py-2.5 hover:bg-green-50 cursor-pointer text-sm text-gray-800 font-medium transition-colors"
                          // Use onMouseDown instead of onClick so it fires BEFORE the Input's onBlur event
                          onMouseDown={(e) => {
                            e.preventDefault(); 
                            setNewBookTitle(bookName);
                            setShowBookSuggestions(false);
                          }}
                        >
                          {bookName}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <Button onClick={handleAddBook} className="bg-green-600 hover:bg-green-700 w-full sm:w-auto shrink-0 z-0">
                  <Plus className="w-4 h-4 mr-2" /> Create Book
                </Button>
              </div>
            </CardContent>
          </Card>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {books.map(b => (
              <div key={b.id} className="flex justify-between items-center p-5 bg-white border border-green-100 rounded-xl shadow-sm">
                <div>
                  <p className="font-bold text-green-900 text-lg">{b.title}</p>
                  <Badge variant="outline" className="mt-1 bg-green-50 text-green-700">Active Study</Badge>
                </div>
                <Button variant="ghost" size="icon" onClick={() => handleDelete('study_books', b.id)}><Trash2 className="w-5 h-5 text-red-400 hover:text-red-600" /></Button>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="readings" className="space-y-6">
          <Card className="border-green-200 shadow-sm">
            <CardHeader><CardTitle>Schedule Weekly Reading</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Select onValueChange={setReadingBookId} value={readingBookId}>
                  <SelectTrigger><SelectValue placeholder="Select Study Book..." /></SelectTrigger>
                  <SelectContent>
                    {books.map(b => <SelectItem key={b.id} value={b.id}>{b.title}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input placeholder="Week (e.g. Week 1)" value={newReading.week} onChange={(e) => setNewReading({...newReading, week: e.target.value})} />
                <Input placeholder="Chapters (e.g. Romans 1-3)" value={newReading.chapters} onChange={(e) => setNewReading({...newReading, chapters: e.target.value})} />
              </div>
              <Button onClick={handleAddReading} className="bg-green-600 hover:bg-green-700 w-full"><Plus className="w-4 h-4 mr-2" /> Add Assignment</Button>
            </CardContent>
          </Card>
          <div className="space-y-3">
            {readings.map(r => {
              const book = books.find(b => b.id === r.book_id);
              return (
                <div key={r.id} className="flex justify-between items-center p-4 bg-white border border-gray-100 rounded-lg hover:border-green-300 transition-colors shadow-sm">
                  <div>
                    <p className="font-bold text-gray-900">{r.week_title} <span className="text-gray-400 font-normal ml-2">| {book?.title}</span></p>
                    <p className="text-sm text-green-700 font-medium">{r.chapters}</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete('assignments', r.id)}><Trash2 className="w-4 h-4 text-red-400" /></Button>
                </div>
              )
            })}
          </div>
        </TabsContent>

        <TabsContent value="quizzes" className="space-y-6">
          <Card className="border-green-200 shadow-sm">
            <CardHeader><CardTitle>Create Assessment</CardTitle><CardDescription>Build weekly quizzes, midterms, or final exams</CardDescription></CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 bg-green-50/50 p-4 rounded-xl border border-green-100">
                <div className="lg:col-span-2">
                  <Label className="text-xs text-gray-500 mb-1 block">Title</Label>
                  <Input value={quizTitle} onChange={(e) => setQuizTitle(e.target.value)} placeholder="e.g. Romans Midterm Exam" className="bg-white" />
                </div>
                <div>
                  <Label className="text-xs text-gray-500 mb-1 block">Target Book</Label>
                  <Select onValueChange={setQuizBookId} value={quizBookId}>
                    <SelectTrigger className="bg-white"><SelectValue placeholder="Select Book" /></SelectTrigger>
                    <SelectContent>{books.map(b => <SelectItem key={b.id} value={b.id}>{b.title}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-gray-500 mb-1 block">Assessment Type</Label>
                  <Select onValueChange={setQuizType} value={quizType}>
                    <SelectTrigger className="bg-white"><SelectValue placeholder="Type" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">Weekly Quiz</SelectItem>
                      <SelectItem value="midterm">Midterm Exam</SelectItem>
                      <SelectItem value="final">Final Exam</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {quizType === 'weekly' && quizBookId && (
                  <div className="lg:col-span-4 mt-2">
                    <Label className="text-xs text-gray-500 mb-1 block">Link to Weekly Reading</Label>
                    <Select onValueChange={setSelectedAssignment}>
                      <SelectTrigger className="bg-white"><SelectValue placeholder="Select which reading this quiz covers..." /></SelectTrigger>
                      <SelectContent>
                        {filteredReadings.length === 0 && <SelectItem value="none" disabled>No readings found for this book</SelectItem>}
                        {filteredReadings.map(r => <SelectItem key={r.id} value={r.id}>{r.week_title} - {r.chapters}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              <div className="space-y-6 pt-4">
                {questions.map((q, qIdx) => (
                  <div key={qIdx} className="p-4 sm:p-5 bg-white rounded-xl border border-gray-200 shadow-sm space-y-4 relative">
                    <div className="flex justify-between items-center border-b pb-2">
                      <Label className="text-green-700 font-black tracking-wider uppercase text-xs">Question {qIdx + 1}</Label>
                      {questions.length > 1 && (
                        <Button variant="ghost" size="sm" onClick={() => setQuestions(questions.filter((_, i) => i !== qIdx))} className="h-6 px-2 text-red-500 hover:bg-red-50"><X className="w-3 h-3 mr-1" /> Remove</Button>
                      )}
                    </div>
                    <Input placeholder="Type your question here..." value={q.text} className="font-medium" onChange={(e) => { const newQs = [...questions]; newQs[qIdx].text = e.target.value; setQuestions(newQs); }}/>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-gray-50 p-3 rounded-lg border border-gray-100">
                      {q.options.map((opt, oIdx) => (
                        <div key={oIdx} className="flex items-center gap-3 bg-white p-2 rounded-md border border-gray-200">
                          <input type="radio" name={`correct-${qIdx}`} checked={q.correct === oIdx} onChange={() => { const newQs = [...questions]; newQs[qIdx].correct = oIdx; setQuestions(newQs); }} className="w-4 h-4 text-green-600 focus:ring-green-500 shrink-0"/>
                          <Input placeholder={`Option ${oIdx + 1}`} value={opt} className="border-none shadow-none focus-visible:ring-0 px-0 h-8" onChange={(e) => { const newQs = [...questions]; newQs[qIdx].options[oIdx] = e.target.value; setQuestions(newQs); }}/>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t">
                <Button variant="outline" className="flex-1 border-green-200 text-green-700 hover:bg-green-50" onClick={() => setQuestions([...questions, { text: "", options: ["", "", "", ""], correct: 0 }])}><Plus className="w-4 h-4 mr-2" /> Add Another Question</Button>
                <Button className="flex-1 bg-green-600 hover:bg-green-700 shadow-md font-bold text-lg h-auto py-3" onClick={handleSaveQuiz}><CheckSquare className="w-5 h-5 mr-2" /> Publish {quizType === 'weekly' ? 'Quiz' : 'Exam'}</Button>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-3 mt-8">
            <h3 className="text-lg font-bold text-gray-900 mb-4 px-2">Manage Scheduled Quizzes</h3>
            {books.map((b: any) => {
              const bookQuizzes = (quizzes || []).filter((q: any) => q?.book_id === b?.id);
              if (!bookQuizzes || bookQuizzes.length === 0) return null;

              return (
                <div key={`book-group-${b.id}`} className="mb-6">
                  <h4 className="text-sm font-bold text-green-800 uppercase tracking-widest mb-2 ml-2">{b.title}</h4>
                  <div className="space-y-2">
                    {bookQuizzes.map((quiz: any) => (
                      <div key={quiz.id} className="flex justify-between items-center p-3 bg-white border border-gray-100 rounded-lg hover:border-green-300 transition-colors shadow-sm">
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="bg-gray-50">{quiz.quiz_type}</Badge>
                          <p className="font-bold text-gray-900">{quiz.title}</p>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete('quizzes', quiz.id)}>
                          <Trash2 className="w-4 h-4 text-red-400 hover:text-red-600 hover:bg-red-50 rounded" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
            {quizzes.length === 0 && (
              <div className="text-center p-8 bg-gray-50 border border-dashed border-gray-200 rounded-xl text-gray-400 italic text-sm">
                No quizzes scheduled. Create one above!
              </div>
            )}
          </div>

        </TabsContent>

        <TabsContent value="events" className="space-y-6">
          <Card className="border-green-200 shadow-sm">
            <CardHeader><CardTitle>Add Church Event</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              
              <div className="space-y-2">
                <Label className="text-xs text-gray-500 font-bold uppercase">Event Title</Label>
                <Input placeholder="e.g. Sunday Morning Service" value={newEvent.title} onChange={(e) => setNewEvent({...newEvent, title: e.target.value})} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs text-gray-500 font-bold uppercase">Date</Label>
                  <Input type="date" value={newEvent.date} onChange={(e) => setNewEvent({...newEvent, date: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-gray-500 font-bold uppercase">Time</Label>
                  <Input type="time" value={newEvent.time} onChange={(e) => setNewEvent({...newEvent, time: e.target.value})} />
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs text-gray-500 font-bold uppercase">Event Type</Label>
                  <Select value={newEvent.type} onValueChange={(v: any) => setNewEvent({...newEvent, type: v})}>
                    <SelectTrigger><SelectValue placeholder="Event Type" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gathering">Gathering</SelectItem>
                      <SelectItem value="meeting">Meeting</SelectItem>
                      <SelectItem value="event">Special Event</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-xs text-gray-500 font-bold uppercase">Location Title (Optional)</Label>
                  <div className="relative">
                    <MapIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input placeholder="e.g. Main Sanctuary" value={newEvent.locationName} onChange={(e) => setNewEvent({...newEvent, locationName: e.target.value})} className="pl-10" />
                  </div>
                </div>
              </div>

              <div className="space-y-2 border-t pt-4">
                <Label className="text-xs text-gray-500 font-bold uppercase flex items-center gap-2">
                  <ImageIcon className="w-4 h-4" /> Cover Image (Optional)
                </Label>
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex items-center gap-4">
                  <input 
                    type="file" accept="image/*" onChange={(e) => setEventImage(e.target.files?.[0] || null)}
                    className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100 cursor-pointer"
                  />
                </div>
              </div>

              <div className="space-y-3 border-t pt-4">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-2 mb-2">
                  <Label className="text-xs text-gray-500 font-bold uppercase">Pin Exact Location on Map</Label>
                  {mapPosition && <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-[10px]">Pin Dropped ✓</Badge>}
                </div>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input placeholder="Search for an address, city, or landmark..." value={mapSearchQuery} onChange={(e) => setMapSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearchLocation()} className="pl-9" />
                  </div>
                  <Button onClick={handleSearchLocation} disabled={isSearchingMap} variant="outline" className="shrink-0 border-gray-300">
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

              <div className="space-y-2 border-t pt-4">
                <Label className="text-xs text-gray-500 font-bold uppercase">Details / Description</Label>
                <Textarea placeholder="Event Description..." value={newEvent.description} onChange={(e) => setNewEvent({...newEvent, description: e.target.value})} className="h-24 resize-none" />
              </div>

              <Button onClick={handleAddEvent} disabled={isUploading} className="bg-green-600 hover:bg-green-700 w-full py-6 text-lg font-bold shadow-md mt-4">
                {isUploading ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Uploading...</> : <><Plus className="w-5 h-5 mr-2" /> Post Event</>}
              </Button>
            </CardContent>
          </Card>

          <div className="space-y-3 mt-8">
            <h3 className="text-lg font-bold text-gray-900 mb-4 px-2">Manage Scheduled Events</h3>
            {events.map(event => {
              const eventDate = new Date(event.event_date);
              return (
                <div key={event.id} className="flex justify-between items-center p-4 bg-white border border-gray-100 rounded-xl hover:border-green-300 transition-colors shadow-sm">
                  <div className="flex items-center gap-4">
                    {event.image_url ? (
                      <img src={event.image_url} alt={event.title} className="w-12 h-12 rounded-lg object-cover shadow-sm" />
                    ) : (
                      <div className="w-12 h-12 bg-green-50 rounded-lg flex items-center justify-center text-green-600 shadow-sm border border-green-100">
                        <Calendar className="w-5 h-5" />
                      </div>
                    )}
                    <div>
                      <p className="font-bold text-gray-900 leading-tight">{event.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {eventDate.toLocaleDateString()} at {eventDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete('events', event.id)}>
                    <Trash2 className="w-5 h-5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded" />
                  </Button>
                </div>
              )
            })}
            {events.length === 0 && (
              <div className="text-center p-8 bg-gray-50 border border-dashed border-gray-200 rounded-xl text-gray-400 italic text-sm">
                No events scheduled. Create one above!
              </div>
            )}
          </div>

        </TabsContent>
      </Tabs>
    </div>
  );
}