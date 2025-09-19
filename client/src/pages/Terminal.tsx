import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TerminalComponent } from "@/components/TerminalComponent";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  Plus, 
  Settings, 
  X,
  Terminal as TerminalIcon,
  Maximize2,
  Minimize2
} from "lucide-react";

interface TerminalSession {
  id: string;
  name: string;
  isActive: boolean;
  cwd: string;
}

export default function Terminal() {
  const [sessions, setSessions] = useState<TerminalSession[]>([]);
  const [activeSession, setActiveSession] = useState<string | null>(null);
  const [isMaximized, setIsMaximized] = useState(false);
  const { toast } = useToast();

  const createSessionMutation = useMutation({
    mutationFn: async (cwd?: string) => {
      const response = await apiRequest('POST', '/api/terminal/create', { cwd });
      return response.json();
    },
    onSuccess: (data) => {
      const newSession: TerminalSession = {
        id: data.sessionId,
        name: `Terminal ${sessions.length + 1}`,
        isActive: true,
        cwd: '/home/runner/workspace'
      };
      
      setSessions(prev => [...prev, newSession]);
      setActiveSession(data.sessionId);
      
      toast({
        title: "Terminal Created",
        description: "New terminal session started"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Create Terminal",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const closeSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      return apiRequest('DELETE', `/api/terminal/${sessionId}`);
    },
    onSuccess: (_, sessionId) => {
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      
      if (activeSession === sessionId) {
        const remainingSessions = sessions.filter(s => s.id !== sessionId);
        setActiveSession(remainingSessions.length > 0 ? remainingSessions[0].id : null);
      }
    }
  });

  const createNewSession = () => {
    createSessionMutation.mutate();
  };

  const closeSession = (sessionId: string) => {
    closeSessionMutation.mutate(sessionId);
  };

  const switchSession = (sessionId: string) => {
    setActiveSession(sessionId);
  };

  // Create initial session on mount
  useEffect(() => {
    if (sessions.length === 0) {
      createNewSession();
    }
  }, []);

  return (
    <div className="h-full p-6" data-testid="terminal-view">
      <Card className={`h-full flex flex-col ${isMaximized ? 'fixed inset-0 z-50 m-0 rounded-none' : ''}`}>
        {/* Terminal Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <TerminalIcon size={20} />
                <h3 className="font-semibold">Terminal</h3>
              </div>
              
              {/* Terminal Tabs */}
              {sessions.length > 0 && (
                <div className="flex gap-1">
                  {sessions.map((session) => (
                    <div
                      key={session.id}
                      className={`flex items-center gap-2 px-3 py-1 rounded cursor-pointer transition-colors ${
                        activeSession === session.id 
                          ? 'bg-primary text-primary-foreground' 
                          : 'bg-secondary hover:bg-secondary/80'
                      }`}
                      onClick={() => switchSession(session.id)}
                      data-testid={`terminal-tab-${session.id}`}
                    >
                      <span className="text-sm">{session.name}</span>
                      {sessions.length > 1 && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-4 w-4 p-0 hover:bg-destructive hover:text-destructive-foreground"
                          onClick={(e) => {
                            e.stopPropagation();
                            closeSession(session.id);
                          }}
                        >
                          <X size={10} />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <Button 
                size="sm" 
                variant="ghost"
                onClick={createNewSession}
                disabled={createSessionMutation.isPending}
                data-testid="button-new-terminal"
              >
                <Plus size={16} />
              </Button>
              
              <Button 
                size="sm" 
                variant="ghost"
                onClick={() => setIsMaximized(!isMaximized)}
                data-testid="button-maximize-terminal"
              >
                {isMaximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </Button>
              
              <Button 
                size="sm" 
                variant="ghost"
                data-testid="button-terminal-settings"
              >
                <Settings size={16} />
              </Button>
            </div>
          </div>
          
          {/* Terminal Controls */}
          <div className="flex items-center gap-2 mt-2">
            <div className="flex gap-1">
              <div className="w-3 h-3 bg-destructive rounded-full"></div>
              <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
              <div className="w-3 h-3 bg-accent rounded-full"></div>
            </div>
            
            {activeSession && (
              <div className="ml-4 text-xs text-muted-foreground">
                Session: {sessions.find(s => s.id === activeSession)?.name}
              </div>
            )}
          </div>
        </div>

        {/* Terminal Content */}
        <div className="flex-1 bg-background">
          {activeSession ? (
            <TerminalComponent 
              sessionId={activeSession}
              onClose={() => closeSession(activeSession)}
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <TerminalIcon size={64} className="mx-auto mb-4 text-muted-foreground opacity-20" />
                <h3 className="text-lg font-semibold mb-2">No Terminal Session</h3>
                <p className="text-muted-foreground mb-4">Create a new terminal session to get started</p>
                <Button onClick={createNewSession} disabled={createSessionMutation.isPending}>
                  <Plus size={16} className="mr-2" />
                  New Terminal
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
