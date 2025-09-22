import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Booth from "./pages/Booth";
import CreateFrame from "./pages/CreateFrame";
import TakePhoto from "./pages/TakePhoto";
import NotFound from "./pages/NotFound";
import Preview from "./pages/Preview";
import Payment from "./pages/Payment";
import Tutorial from "./pages/Tutorial";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Payment />} />
          <Route path="/booth" element={<Booth />} />
          <Route path="/create-frame" element={<CreateFrame />} />
          <Route path="/take-photo/:frameId" element={<TakePhoto />} />
          <Route path="/preview/:frameId" element={<Preview />} />
          <Route path="/tutorial" element={<Tutorial />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
