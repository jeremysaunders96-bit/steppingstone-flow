import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AppLayout from "@/components/layout/AppLayout";
import { PasswordGate } from "@/components/PasswordGate";
import Home from "./pages/Home";
import Contacts from "./pages/Contacts";
import ContactDetail from "./pages/ContactDetail";
import LinkedInQueue from "./pages/LinkedInQueue";
import Deals from "./pages/Deals";
import Meetings from "./pages/Meetings";
import Unmatched from "./pages/Unmatched";
import ActionItems from "./pages/ActionItems";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <PasswordGate>
        <BrowserRouter>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/" element={<Home />} />
              <Route path="/contacts" element={<Contacts />} />
              <Route path="/contacts/:id" element={<ContactDetail />} />
              <Route path="/meetings" element={<Meetings />} />
              <Route path="/action-items" element={<ActionItems />} />
              <Route path="/deals" element={<Deals />} />
              <Route path="/unmatched" element={<Unmatched />} />
              <Route path="/linkedin" element={<LinkedInQueue />} />
              <Route path="/settings" element={<Settings />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </PasswordGate>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
