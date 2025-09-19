import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Sidebar } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import Dashboard from "./pages/Dashboard";
import ModelManager from "./pages/ModelManager";
import CodeEditor from "./pages/CodeEditor";
import Terminal from "./pages/Terminal";
import Projects from "./pages/Projects";
import Browser from "./pages/Browser";
import Templates from "./pages/Templates";
import NotFound from "@/pages/not-found";
import { useState } from "react";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/models" component={ModelManager} />
      <Route path="/editor" component={CodeEditor} />
      <Route path="/terminal" component={Terminal} />
      <Route path="/projects" component={Projects} />
      <Route path="/browser" component={Browser} />
      <Route path="/templates" component={Templates} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [currentView, setCurrentView] = useState("Dashboard");

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <div className="flex h-screen bg-background text-foreground" data-testid="main-layout">
          <Sidebar currentView={currentView} onViewChange={setCurrentView} />
          <div className="flex-1 flex flex-col">
            <TopBar title={currentView} />
            <main className="flex-1 overflow-hidden">
              <Router />
            </main>
          </div>
        </div>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
