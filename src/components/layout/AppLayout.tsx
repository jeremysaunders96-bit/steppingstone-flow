import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Footer } from "./Footer";
import { ComposeEmailModal } from "@/components/modals/ComposeEmailModal";
import { CaptureMeetingModal } from "@/components/modals/CaptureMeetingModal";

export default function AppLayout() {
  const [composeOpen, setComposeOpen] = useState(false);
  const [captureOpen, setCaptureOpen] = useState(false);
  const location = useLocation();
  const fullBleed = location.pathname.startsWith("/deals");
  return (
    <div className="min-h-screen w-full flex bg-background">
      <Sidebar
        onComposeClick={() => setComposeOpen(true)}
        onCaptureMeetingClick={() => setCaptureOpen(true)}
      />
      <main className="flex-1 min-w-0 flex flex-col">
        {fullBleed ? (
          <div className="flex-1 flex min-h-screen">
            <Outlet />
          </div>
        ) : (
          <>
            <div className="flex-1 max-w-6xl w-full mx-auto px-6 md:px-10 py-8 md:py-10">
              <Outlet />
            </div>
            <Footer />
          </>
        )}
      </main>
      <ComposeEmailModal open={composeOpen} onOpenChange={setComposeOpen} />
      <CaptureMeetingModal open={captureOpen} onOpenChange={setCaptureOpen} />
    </div>
  );
}