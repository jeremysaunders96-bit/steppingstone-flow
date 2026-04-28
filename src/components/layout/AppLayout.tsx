import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Footer } from "./Footer";

export default function AppLayout() {
  return (
    <div className="min-h-screen w-full flex bg-background">
      <Sidebar />
      <main className="flex-1 min-w-0 flex flex-col">
        <div className="flex-1 max-w-6xl w-full mx-auto px-6 md:px-10 py-8 md:py-10">
          <Outlet />
        </div>
        <Footer />
      </main>
    </div>
  );
}