import { RouterProvider } from "react-router";
import { router } from "./routes";
import { Toaster } from "./components/ui/sonner";
import { supabase } from "./lib/supabase"; // Fixed import path
import { ProfileSettings } from "./pages/ProfileSettings";
import { MemberDirectory } from "./pages/MemberDirectory";
import { SessionControl } from "./pages/SessionControl";

// Import your new Auth Provider and Family Messenger
import { AuthProvider } from "./lib/auth-context"; 
import { FamilyMessenger } from "./components/FamilyMessenger";

export default function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
      <FamilyMessenger />
      <Toaster />
    </AuthProvider>
  );
}