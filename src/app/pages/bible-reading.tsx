import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Progress } from "../components/ui/progress";
import { 
  BookOpen, Mic, CheckCircle, Loader2, BookMarked, 
  FileText, PlayCircle, Download, History, RefreshCw, Lock,
  Type, ChevronLeft, ChevronRight
} from "lucide-react";
import { supabase } from "../lib/supabase"; 
import { toast } from "sonner";

export function BibleReading() {
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [activeBook, setActiveBook] = useState<any>(null);
  const [readings, setReadings] = useState<any[]>([]);
  const [progress, setProgress] = useState<any[]>([]);
  const [selectedReading, setSelectedReading] = useState<any>(null);
  
  const [parentLesson, setParentLesson] = useState<any>(null); 

  // --- REAL BIBLE STATES ---
  const [bibleText, setBibleText] = useState<any[]>([]);
  const [isFetchingBible, setIsFetchingBible] = useState(false);
  const [apiErrorMsg, setApiErrorMsg] = useState<string | null>(null);
  
  // --- CHAPTER NAVIGATION STATE ---
  const [currentChapter, setCurrentChapter] = useState(1);

  // --- RECORDING STATES ---
  const [isMockRecording, setIsMockRecording] = useState(false);
  const [hasMockRecorded, setHasMockRecorded] = useState(false);

  // --- READER UI STATE ---
  const [fontSize, setFontSize] = useState<"small" | "medium" | "large">("medium");

  useEffect(() => {
    fetchData();
    const channel = supabase.channel('bible-reading-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reading_progress' }, () => {
        fetchData();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      setCurrentUser(profile);

      const { data: book } = await supabase.from('study_books').select('*').eq('status', 'active').order('created_at', { ascending: false }).limit(1).single();
      setActiveBook(book);

      if (book && profile) {
        const { data: assignmentsData } = await supabase.from('assignments').select('*').eq('book_id', book.id).order('created_at', { ascending: true }); 
        const { data: progressData } = await supabase.from('reading_progress').select('*').eq('user_id', user.id);

        setReadings(assignmentsData || []);
        setProgress(progressData || []);
        
        if (assignmentsData && assignmentsData.length > 0) {
          const uncompleted = assignmentsData.find(a => !progressData?.some(p => p.reading_id === a.id && p.is_completed));
          const toSelect = uncompleted || assignmentsData[assignmentsData.length - 1];
          setSelectedReading(toSelect);
        }
      }
    } catch (error: any) {
      console.error(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchParentLesson = async (readingId: string, familyId: string) => {
    const { data } = await supabase.from('reading_progress').select('*, profiles!inner(role)').eq('reading_id', readingId).eq('family_id', familyId).eq('profiles.role', 'parent').maybeSingle();
    setParentLesson(data);
  };

  // Reset chapter to 1 when a new reading week is selected
  useEffect(() => {
    setCurrentChapter(1);
    setIsMockRecording(false);
    setHasMockRecorded(false);

    if (currentUser?.role === 'member' && selectedReading) {
      fetchParentLesson(selectedReading.id, currentUser.family_id);
    }
  }, [selectedReading, currentUser]);

  // --- FETCH BIBLE TEXT ---
  useEffect(() => {
    if (!activeBook?.title) return;

    const fetchRealBible = async () => {
      setIsFetchingBible(true);
      setApiErrorMsg(null);
      
      try {
        const cleanBook = activeBook.title.replace(/chapter|chapters|ch/gi, '').trim();
        const searchQuery = `${cleanBook} ${currentChapter}`;
        
        const response = await fetch(`https://bible-api.com/${searchQuery}?translation=web`);
        
        if (!response.ok) throw new Error(`Could not find Chapter ${currentChapter} of ${cleanBook}.`);
        
        const data = await response.json();

        if (data.verses && data.verses.length > 0) {
          const formattedVerses = data.verses.map((v: any) => ({
            id: `${v.book_id}-${v.chapter}-${v.verse}`,
            verse_number: v.verse,
            text: v.text.trim(),
          }));
          setBibleText(formattedVerses);
        } else {
          setBibleText([]);
          setApiErrorMsg(`Chapter ${currentChapter} does not exist for this book.`);
        }
      } catch (err: any) {
        setBibleText([]);
        setApiErrorMsg(err.message || "Failed to load verses.");
      } finally {
        setIsFetchingBible(false);
      }
    };

    fetchRealBible();
  }, [activeBook, currentChapter]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, type: 'audio' | 'document') => {
    const file = event.target.files?.[0];
    if (!file || !currentUser || !selectedReading) return;

    setIsUploading(true);
    const fileExt = file.name.split('.').pop();
    const fileName = `${currentUser.family_id}/${selectedReading.id}_${type}_${Date.now()}.${fileExt}`;

    try {
      const { error: uploadError } = await supabase.storage.from('family_resources').upload(fileName, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('family_resources').getPublicUrl(fileName);
      const updates = type === 'audio' ? { voice_recording_url: publicUrl, family_id: currentUser.family_id } : { explanation_file_url: publicUrl, family_id: currentUser.family_id };
      await upsertProgress(updates);
      toast.success(`${type === 'audio' ? 'Voice recording' : 'Study notes'} updated successfully!`);
    } catch (error: any) {
      toast.error("Upload failed: " + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  const upsertProgress = async (updates: any) => {
    const existing = progress.find(p => p.reading_id === selectedReading.id);
    let result;
    if (existing) {
      result = await supabase.from('reading_progress').update(updates).eq('id', existing.id).select().single();
    } else {
      result = await supabase.from('reading_progress').insert({
        user_id: currentUser.id, reading_id: selectedReading.id, family_id: currentUser.family_id, ...updates
      }).select().single();
    }
    if (result.error) throw result.error;
    if (result.data) setProgress(prev => [...prev.filter(p => p.reading_id !== selectedReading.id), result.data]);
  };

  const handleMarkAsRead = async () => {
    setIsSaving(true);
    try {
      await upsertProgress({ is_completed: true, completed_at: new Date().toISOString() });
      toast.success("Excellent! Week marked as completed.");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const cycleFontSize = () => {
    if (fontSize === "small") setFontSize("medium");
    else if (fontSize === "medium") setFontSize("large");
    else setFontSize("small");
  };

  const getTextClass = () => {
    if (fontSize === "small") return "text-sm leading-relaxed";
    if (fontSize === "medium") return "text-base sm:text-lg leading-relaxed sm:leading-loose";
    return "text-lg sm:text-xl leading-loose";
  };

  if (isLoading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-green-600 w-10 h-10" /></div>;
  if (!activeBook || readings.length === 0) return <div className="text-center p-12 text-gray-400">No active readings found.</div>;

  const activeProgress = progress.find(p => p.reading_id === selectedReading?.id);
  const isCompleted = activeProgress?.is_completed;
  const isParent = currentUser?.role === 'parent';
  const isFinishButtonLocked = !hasMockRecorded && !isCompleted;

  const completedCount = readings.filter(r => progress.some(p => p.reading_id === r.id && p.is_completed)).length;
  const totalCount = readings.length;
  const progressPercentage = totalCount === 0 ? 0 : (completedCount / totalCount) * 100;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-in fade-in duration-500">
      
      {/* HEADER */}
      <div className="bg-white rounded-xl p-4 sm:p-6 border border-green-200 flex items-center justify-between shadow-sm">
        <div>
          <h2 className="text-xl sm:text-2xl mb-1 font-black text-black flex items-center gap-2">
            <BookMarked className="w-5 h-5 sm:w-6 sm:h-6 text-green-600 shrink-0" /> Study: {activeBook.title}
          </h2>
          <p className="text-sm sm:text-base text-gray-600 font-medium">
            {isParent ? "Read, record your explanation, and upload your notes." : "Listen to your parent's lesson and complete the reading."}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* --- SIDEBAR --- */}
        <Card className="lg:col-span-1 border-green-200 shadow-sm flex flex-col h-fit lg:sticky top-20 z-10 bg-white">
          <CardHeader className="p-4 sm:p-5 bg-gray-50/50 border-b border-gray-100 flex-none">
            <CardTitle className="text-lg flex items-center gap-2 text-black">
              <History className="w-5 h-5 text-green-600" /> Plan & History
            </CardTitle>
            <div className="mt-4 space-y-1">
              <div className="flex justify-between text-xs font-bold text-gray-500 uppercase tracking-wider">
                <span>Overall Progress</span>
                <span className="text-black">{completedCount} / {totalCount}</span>
              </div>
              <Progress value={progressPercentage} className="h-2 bg-gray-100" />
            </div>
          </CardHeader>
          
          <CardContent className="p-3 sm:p-4 flex flex-row lg:flex-col overflow-x-auto lg:overflow-x-hidden lg:overflow-y-auto gap-3 lg:max-h-[600px] snap-x pb-4 lg:pb-4 scrollbar-thin scrollbar-thumb-green-200">
            {readings.map((reading) => {
              const readingProgress = progress.find(p => p.reading_id === reading.id);
              const isActive = selectedReading?.id === reading.id;
              const isDone = readingProgress?.is_completed;

              return (
                <button
                  key={reading.id}
                  onClick={() => setSelectedReading(reading)}
                  className={`shrink-0 w-[240px] lg:w-full text-left p-3 sm:p-4 rounded-xl border transition-all snap-start ${
                    isActive 
                      ? "border-green-400 bg-green-50 shadow-sm ring-1 ring-green-600" 
                      : isDone 
                        ? "border-gray-100 bg-gray-50/50 hover:bg-gray-100" 
                        : "border-gray-200 bg-white hover:border-green-300"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="w-full">
                      <div className="flex justify-between items-center w-full">
                        <p className={`font-bold text-sm sm:text-base ${isActive ? "text-black" : isDone ? "text-gray-500" : "text-black"}`}>
                          {reading.week_title}
                        </p>
                        {isDone ? (
                          <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
                        ) : (
                          <div className="w-2 h-2 rounded-full bg-black shrink-0" />
                        )}
                      </div>
                      <p className={`text-xs font-bold mt-1 truncate inline-block px-2 py-0.5 rounded ${isActive ? "text-green-800 bg-green-100/50" : "text-gray-600 bg-gray-100"}`}>
                        Goal: {reading.chapters}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </CardContent>
        </Card>

        {/* --- MAIN INTERFACE --- */}
        <Card className="lg:col-span-2 border-green-200 shadow-sm bg-white">
          <CardHeader className="p-4 sm:p-6 border-b border-gray-100">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div>
                <CardTitle className="text-black text-xl sm:text-2xl">{selectedReading?.week_title}</CardTitle>
                <CardDescription className="text-gray-600 font-bold mt-1 text-base sm:text-lg">
                  {activeBook.title} — Chapter {currentChapter}
                </CardDescription>
              </div>
              
              <div className="flex items-center gap-1 bg-green-50 border border-green-100 p-1 rounded-lg">
                <Button variant="ghost" size="sm" onClick={() => setCurrentChapter(c => Math.max(1, c - 1))} disabled={currentChapter === 1 || isFetchingBible} className="px-2 text-green-700 hover:text-green-900 hover:bg-green-100">
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="font-bold text-sm px-2 w-16 text-center text-green-800">Ch. {currentChapter}</span>
                <Button variant="ghost" size="sm" onClick={() => setCurrentChapter(c => c + 1)} disabled={isFetchingBible} className="px-2 text-green-700 hover:text-green-900 hover:bg-green-100">
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="p-4 sm:p-6 pt-4 sm:pt-6">
            <Tabs defaultValue="read" className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-green-50/80 p-1 rounded-lg mb-6">
                <TabsTrigger value="read" className="text-xs sm:text-sm data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:shadow-sm font-bold">Reading Phase</TabsTrigger>
                <TabsTrigger value="lesson" className="text-xs sm:text-sm data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:shadow-sm font-bold">
                  {isParent ? "Lesson Management" : "Parent's Lesson"}
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="read" className="space-y-6">
                
                {/* BEAUTIFUL READING AREA */}
                <div className="bg-gray-50 rounded-2xl border border-gray-200 shadow-inner overflow-hidden relative">
                  
                  {/* Sticky Reader Toolbar */}
                  <div className="bg-white/90 backdrop-blur-md border-b border-gray-200 p-3 flex items-center justify-between sticky top-0 z-10">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-widest ml-2">
                      {activeBook.title} {currentChapter}
                    </span>
                    <Button variant="outline" size="sm" onClick={cycleFontSize} className="h-8 text-xs font-bold bg-white text-gray-600 border-gray-200 hover:bg-gray-100 transition-colors">
                      <Type className="w-3.5 h-3.5 mr-2 text-gray-400" /> Size: {fontSize.charAt(0).toUpperCase() + fontSize.slice(1)}
                    </Button>
                  </div>

                  {/* Text Content */}
                  <div className="p-6 sm:p-10 md:p-12 lg:p-16 max-h-[60vh] overflow-y-auto">
                    {isFetchingBible ? (
                      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                        <Loader2 className="w-8 h-8 animate-spin mb-4 text-green-600" />
                        <p className="font-medium animate-pulse">Loading Chapter {currentChapter}...</p>
                      </div>
                    ) : bibleText.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-20 text-gray-400 text-center px-4">
                        <BookOpen className="w-12 h-12 mb-4 opacity-30 text-gray-400" />
                        <p className="font-bold text-black mb-2 text-lg">No Verses Found</p>
                        <p className="text-sm bg-gray-100 text-gray-600 p-4 rounded-xl max-w-sm leading-relaxed border border-gray-200">
                          {apiErrorMsg || "Make sure the Book Name is correct in Admin Controls."}
                        </p>
                        <Button variant="outline" className="mt-6 border-gray-300 hover:bg-gray-100 text-black font-bold" onClick={() => setCurrentChapter(1)}>Return to Chapter 1</Button>
                      </div>
                    ) : (
                      <div className="max-w-2xl mx-auto space-y-5">
                        {bibleText.map((verseData) => (
                          <div key={verseData.id} className="flex gap-3 sm:gap-4 md:gap-5 group">
                            <span className="text-green-600 font-bold text-[10px] sm:text-xs pt-1.5 sm:pt-2 w-4 sm:w-6 text-right shrink-0 select-none opacity-50 group-hover:opacity-100 transition-opacity">
                              {verseData.verse_number}
                            </span>
                            <p className={`font-serif text-black ${getTextClass()}`}>
                              {verseData.text}
                            </p>
                          </div>
                        ))}
                        
                        <div className="pt-12 pb-4 flex justify-center">
                          <Button variant="outline" onClick={() => setCurrentChapter(c => c + 1)} className="border-green-200 text-green-700 hover:bg-green-50 rounded-full px-8 transition-colors font-bold">
                            Continue to Chapter {currentChapter + 1} <ChevronRight className="w-4 h-4 ml-2" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                  
                {/* BOTTOM RECORDING & FINISH AREA */}
                <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6 shadow-sm">
                  {!isCompleted && (
                    <div className="mb-6 bg-green-50/50 border border-green-100 rounded-xl p-5 text-center transition-all">
                      <div className="flex justify-center mb-4">
                        <div className={`p-4 rounded-full transition-all duration-500 ${isMockRecording ? "bg-red-600 text-white animate-pulse scale-110 shadow-lg shadow-red-200" : hasMockRecorded ? "bg-green-100 text-green-600 scale-100" : "bg-black text-white scale-100 hover:scale-105"}`}>
                          {hasMockRecorded ? <CheckCircle className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                        </div>
                      </div>
                      <h4 className="font-bold text-black mb-1 text-sm sm:text-base">Read Aloud Phase</h4>
                      <p className="text-xs sm:text-sm text-gray-500 mb-5 max-w-sm mx-auto leading-relaxed">Record yourself reading the chapter aloud to unlock completion.</p>
                      
                      {!isMockRecording && !hasMockRecorded && (
                        <Button onClick={() => setIsMockRecording(true)} className="bg-black hover:bg-gray-800 text-white w-full sm:w-auto shadow-md transition-colors">
                          <Mic className="w-4 h-4 mr-2 shrink-0" /> Start Reading Session
                        </Button>
                      )}
                      
                      {isMockRecording && (
                        <Button onClick={() => { setIsMockRecording(false); setHasMockRecorded(true); toast.success("Great job reading!"); }} className="bg-red-600 hover:bg-red-700 text-white animate-pulse w-full sm:w-auto shadow-md">
                          <span className="w-2 h-2 rounded-full bg-white mr-2 animate-ping shrink-0" /> Stop & Save Session
                        </Button>
                      )}

                      {hasMockRecorded && (
                        <div className="inline-flex items-center justify-center gap-2 bg-green-100 text-green-800 px-4 py-2 rounded-lg text-sm font-bold border border-green-200">
                          <CheckCircle className="w-4 h-4 shrink-0" /> Session Recorded
                        </div>
                      )}
                    </div>
                  )}
                  
                  <Button 
                    onClick={handleMarkAsRead} 
                    disabled={isSaving || isCompleted || isFinishButtonLocked}
                    className={`w-full h-auto py-4 sm:py-5 px-4 text-sm sm:text-base md:text-lg whitespace-normal text-center font-bold transition-all rounded-xl ${
                      isCompleted 
                        ? "bg-green-50 text-green-700 opacity-100 cursor-not-allowed border-2 border-green-200" 
                        : isFinishButtonLocked
                          ? "bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200"
                          : "bg-green-600 hover:bg-green-700 shadow-lg shadow-green-600/20 text-white ring-2 ring-green-600 ring-offset-2"
                    }`}
                  >
                    {isSaving ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : isCompleted ? (
                      <><CheckCircle className="w-5 h-5 mr-2 shrink-0" /> Assignment Completed</>
                    ) : isFinishButtonLocked ? (
                      <><Lock className="w-5 h-5 mr-2 shrink-0" /> Complete Reading Session to Unlock</>
                    ) : (
                      <><CheckCircle className="w-5 h-5 mr-2 shrink-0" /> Mark Week as Finished</>
                    )}
                  </Button>
                </div>
              </TabsContent>
              
              <TabsContent value="lesson" className="space-y-4">
                <div className="bg-white rounded-2xl p-4 sm:p-6 lg:p-8 border border-gray-200 shadow-sm min-h-[300px]">
                  {isParent ? (
                    <div className="space-y-6">
                      <div className="bg-gray-50 p-5 sm:p-6 rounded-2xl border border-gray-200 flex flex-col items-start gap-4">
                        <div className="flex items-center justify-between w-full border-b border-gray-200 pb-4">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-black text-white rounded-lg"><Mic className="w-5 h-5 shrink-0" /></div>
                            <h4 className="font-bold text-black text-base">Voice Explanation</h4>
                          </div>
                          {activeProgress?.voice_recording_url && <Badge className="bg-green-100 text-green-800 border-green-200 pointer-events-none shadow-none font-bold">Active</Badge>}
                        </div>
                        <div className="w-full space-y-4">
                          {activeProgress?.voice_recording_url && (
                            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                              <p className="text-xs text-gray-500 font-bold uppercase mb-3">Current Upload:</p>
                              <audio controls className="w-full h-10 outline-none"><source src={activeProgress.voice_recording_url} type="audio/mpeg" /></audio>
                            </div>
                          )}
                          <div className="pt-2">
                            <p className="text-sm text-gray-600 mb-3 font-medium">{activeProgress?.voice_recording_url ? "Upload a new file to replace the current one:" : "Record or upload an MP3 to explain this chapter to your kids."}</p>
                            <input type="file" accept="audio/*" capture="user" onChange={(e) => handleFileUpload(e, 'audio')} className="w-full text-sm file:mr-3 file:py-2.5 file:px-5 file:rounded-full file:border-0 file:font-bold file:bg-black file:text-white hover:file:bg-gray-800 file:cursor-pointer transition-colors bg-white rounded-full border border-gray-200 text-gray-500" disabled={isUploading}/>
                          </div>
                        </div>
                      </div>

                      <div className="bg-green-50/50 p-5 sm:p-6 rounded-2xl border border-green-100 flex flex-col items-start gap-4">
                        <div className="flex items-center justify-between w-full border-b border-green-200/50 pb-4">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-green-100 text-green-700 rounded-lg"><FileText className="w-5 h-5 shrink-0" /></div>
                            <h4 className="font-bold text-black text-base">Study Notes</h4>
                          </div>
                          {activeProgress?.explanation_file_url && <Badge className="bg-green-100 text-green-800 border-green-200 pointer-events-none shadow-none font-bold">Active</Badge>}
                        </div>
                        <div className="w-full space-y-4">
                          {activeProgress?.explanation_file_url && (
                            <div className="bg-white p-4 rounded-xl border border-green-100 shadow-sm flex items-center justify-between transition-all hover:border-green-300">
                               <div>
                                 <p className="text-xs text-gray-500 font-bold uppercase mb-1">Current Upload:</p>
                                 <p className="text-sm font-bold text-black">Document Active</p>
                               </div>
                               <Button variant="outline" size="sm" className="border-green-200 text-green-700 hover:bg-green-50 font-bold" onClick={() => window.open(activeProgress.explanation_file_url, '_blank')}>View File</Button>
                            </div>
                          )}
                          <div className="pt-2">
                            <p className="text-sm text-gray-600 mb-3 font-medium">{activeProgress?.explanation_file_url ? "Upload a new PDF/Doc to replace the current one:" : "Upload a PDF or document with your personal notes for the family."}</p>
                            <input type="file" accept=".pdf,.doc,.docx,.txt" onChange={(e) => handleFileUpload(e, 'document')} className="w-full text-sm file:mr-3 file:py-2.5 file:px-5 file:rounded-full file:border-0 file:font-bold file:bg-green-600 file:text-white hover:file:bg-green-700 file:cursor-pointer transition-colors bg-white rounded-full border border-green-200 text-gray-500" disabled={isUploading}/>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="py-8 sm:py-12 flex flex-col items-center">
                      {!parentLesson?.voice_recording_url && !parentLesson?.explanation_file_url ? (
                        <div className="w-full max-w-md py-16 px-6 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200 text-center flex flex-col items-center">
                          <div className="w-20 h-20 bg-white rounded-full border border-gray-100 shadow-sm flex items-center justify-center mb-5"><History className="w-10 h-10 text-gray-300" /></div>
                          <h3 className="text-xl font-bold text-black mb-2">Waiting for Lesson</h3>
                          <p className="text-sm text-gray-500 max-w-xs leading-relaxed">Your parent hasn't uploaded the audio or notes for this week yet. Check back later!</p>
                          <Button variant="outline" className="mt-8 border-gray-200 hover:bg-gray-50 text-black font-bold" onClick={() => fetchData()}><RefreshCw className="w-4 h-4 mr-2 text-gray-500" /> Refresh Page</Button>
                        </div>
                      ) : (
                        <div className="w-full max-w-md space-y-6">
                          <h3 className="text-2xl font-black text-black text-center mb-8 pb-4 border-b border-gray-100">Resources from Parent</h3>
                          {parentLesson?.voice_recording_url && (
                            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm hover:border-black hover:shadow-md transition-all w-full overflow-hidden relative group">
                              <div className="absolute top-0 left-0 w-1.5 h-full bg-black group-hover:bg-green-500 transition-colors"></div>
                              <p className="text-base font-bold text-black mb-4 flex items-center gap-2"><PlayCircle className="w-5 h-5 text-gray-400 group-hover:text-green-500 transition-colors shrink-0"/> Voice Lesson</p>
                              <audio controls className="w-full h-12 outline-none"><source src={parentLesson.voice_recording_url} type="audio/mpeg" />Your browser does not support the audio element.</audio>
                            </div>
                          )}
                          {parentLesson?.explanation_file_url && (
                            <a href={parentLesson.explanation_file_url} target="_blank" rel="noopener noreferrer" className="group bg-white p-6 rounded-2xl border border-gray-200 shadow-sm hover:border-green-400 hover:shadow-md transition-all w-full flex items-center justify-between relative block">
                              <div className="absolute top-0 left-0 w-1.5 h-full bg-green-500 rounded-l-2xl"></div>
                              <div className="flex items-center gap-4">
                                <div className="p-3 bg-green-50 rounded-xl group-hover:bg-green-100 transition-colors"><FileText className="w-6 h-6 text-green-600" /></div>
                                <div className="text-left"><p className="text-base font-bold text-black">Study Notes</p><p className="text-sm text-gray-500 mt-0.5">Tap to view or download</p></div>
                              </div>
                              <Download className="w-6 h-6 text-gray-300 group-hover:text-green-600 transition-colors shrink-0" />
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}