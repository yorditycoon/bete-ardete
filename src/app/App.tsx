import { RouterProvider } from "react-router";
import { router } from "./routes";
import { Toaster } from "./components/ui/sonner";
import { supabase } from "../app/lib/supabase";
import { ProfileSettings } from "./pages/ProfileSettings";
import { MemberDirectory } from "./pages/MemberDirectory";
import { SessionControl } from "./pages/SessionControl";

export default function App() {
  return (
    <>
      <RouterProvider router={router} />
      <Toaster />
    </>
  );
}
