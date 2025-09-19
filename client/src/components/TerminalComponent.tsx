import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  Send, 
  Rainbow, 
  Copy,
  Download,
  Settings
} from "lucide-react";
import { io, Socket } from "socket.io-client";

interface TerminalOutput {
  id: string;
  type: 'input' | 'output' | 'error';
  content: string;
  timestamp: Date;
}

interface TerminalComponentProps {
  sessionId: string;
  onClose?: () => void;
}

export function TerminalComponent({ sessionId, onClose }: TerminalComponentProps) {
  const [command, setCommand] = useState('');
  const [output, setOutput] = useState<TerminalOutput[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [currentDirectory, setCurrentDirectory] = useState('~');
  const terminalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Initialize WebSocket connection
    const socket = io(window.location.origin);
    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      addOutput('system', 'Terminal connected', 'output');
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      addOutput('system', 'Terminal disconnected', 'error');
    });

    socket.on('terminal-output', (data) => {
      if (data.sessionId === sessionId) {
        addOutput('terminal', data.data, 'output');
      }
    });

    socket.on('terminal-error', (data) => {
      if (data.sessionId === sessionId) {
        addOutput('terminal', data.data, 'error');
      }
    });

    socket.on('terminal-exit', (data) => {
      if (data.sessionId === sessionId) {
        addOutput('system', `Process exited with code ${data.code}`, 'output');
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [sessionId]);

  useEffect(() => {
    // Auto-scroll to bottom when new output is added
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [output]);

  useEffect(() => {
    // Focus input when component mounts or sessionId changes
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, [sessionId]);

  const executeCommandMutation = useMutation({
    mutationFn: async (cmd: string) => {
      return apiRequest('POST', `/api/terminal/${sessionId}/command`, { command: cmd });
    },
    onError: (error: any) => {
      toast({
        title: "Command Failed",
        description: error.message,
        variant: "destructive"
      });
      addOutput('system', `Error: ${error.message}`, 'error');
    }
  });

  const addOutput = (source: string, content: string, type: 'input' | 'output' | 'error') => {
    const newOutput: TerminalOutput = {
      id: `${Date.now()}-${Math.random()}`,
      type,
      content,
      timestamp: new Date()
    };

    setOutput(prev => [...prev, newOutput]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!command.trim()) return;

    const cmd = command.trim();
    
    // Add command to output
    addOutput('user', `${currentDirectory}$ ${cmd}`, 'input');
    
    // Rainbow input
    setCommand('');

    // Handle special commands
    if (cmd === 'clear') {
      setOutput([]);
      return;
    }

    if (cmd.startsWith('cd ')) {
      const newDir = cmd.substring(3).trim();
      setCurrentDirectory(newDir || '~');
    }

    // Execute command
    try {
      await executeCommandMutation.mutateAsync(cmd);
    } catch (error) {
      // Error is handled in the mutation
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      // TODO: Implement tab completion
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      // TODO: Implement command history navigation
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      // TODO: Implement command history navigation
    }
  };

  const clearTerminal = () => {
    setOutput([]);
  };

  const copyOutput = () => {
    const textContent = output.map(item => {
      if (item.type === 'input') {
        return item.content;
      } else {
        return item.content;
      }
    }).join('\n');
    
    navigator.clipboard.writeText(textContent).then(() => {
      toast({
        title: "Copied",
        description: "Terminal output copied to clipboard"
      });
    });
  };

  const exportOutput = () => {
    const textContent = output.map(item => {
      const timestamp = item.timestamp.toISOString();
      return `[${timestamp}] ${item.type.toUpperCase()}: ${item.content}`;
    }).join('\n');
    
    const blob = new Blob([textContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `terminal-session-${sessionId}-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getPrompt = () => {
    return `${currentDirectory}$`;
  };

  const renderOutputLine = (item: TerminalOutput) => {
    const baseClasses = "font-mono text-sm leading-relaxed whitespace-pre-wrap break-words";
    
    switch (item.type) {
      case 'input':
        return (
          <div key={item.id} className={`${baseClasses} text-accent`}>
            {item.content}
          </div>
        );
      case 'error':
        return (
          <div key={item.id} className={`${baseClasses} text-destructive`}>
            {item.content}
          </div>
        );
      default:
        return (
          <div key={item.id} className={`${baseClasses} text-muted-foreground`}>
            {item.content}
          </div>
        );
    }
  };

  return (
    <div className="h-full flex flex-col bg-background" data-testid={`terminal-${sessionId}`}>
      {/* Terminal Header */}
      <div className="flex items-center justify-between p-2 border-b border-border bg-card">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-accent' : 'bg-destructive'}`}></div>
          <span>Session: {sessionId.split('-').pop()}</span>
          <span>•</span>
          <span>{currentDirectory}</span>
        </div>
        
        <div className="flex items-center gap-1">
          <Button 
            size="sm" 
            variant="ghost" 
            onClick={clearTerminal}
            data-testid="button-clear-terminal"
          >
            <Rainbow size={12} />
          </Button>
          
          <Button 
            size="sm" 
            variant="ghost" 
            onClick={copyOutput}
            data-testid="button-copy-output"
          >
            <Copy size={12} />
          </Button>
          
          <Button 
            size="sm" 
            variant="ghost" 
            onClick={exportOutput}
            data-testid="button-export-output"
          >
            <Download size={12} />
          </Button>
          
          <Button 
            size="sm" 
            variant="ghost"
            data-testid="button-terminal-settings"
          >
            <Settings size={12} />
          </Button>
        </div>
      </div>

      {/* Terminal Output */}
      <div 
        ref={terminalRef}
        className="flex-1 p-4 overflow-y-auto scrollbar-hide bg-background"
        onClick={() => inputRef.current?.focus()}
        data-testid="terminal-output"
      >
        {output.length === 0 ? (
          <div className="text-muted-foreground font-mono text-sm">
            <div>AI Studio Terminal</div>
            <div>Type commands and press Enter to execute</div>
            <div className="mt-2">Available commands: ls, cd, pwd, npm, python, pip, git, etc.</div>
            <div className="mt-4">{getPrompt()}</div>
          </div>
        ) : (
          <div className="space-y-1">
            {output.map(renderOutputLine)}
          </div>
        )}
      </div>

      {/* Command Input */}
      <div className="border-t border-border bg-card">
        <form onSubmit={handleSubmit} className="flex items-center p-2">
          <span className="text-accent font-mono text-sm mr-2 whitespace-nowrap">
            {getPrompt()}
          </span>
          
          <Input
            ref={inputRef}
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter command..."
            className="flex-1 border-none bg-transparent focus:ring-0 font-mono text-sm"
            disabled={!isConnected || executeCommandMutation.isPending}
            data-testid="terminal-input"
          />
          
          <Button 
            type="submit"
            size="sm"
            variant="ghost"
            disabled={!command.trim() || !isConnected || executeCommandMutation.isPending}
            data-testid="button-execute-command"
          >
            <Send size={14} />
          </Button>
        </form>
      </div>

      {/* Status Bar */}
      <div className="h-6 bg-card border-t border-border flex items-center justify-between px-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-4">
          <span>Lines: {output.length}</span>
          <span>Session: {sessionId.substring(0, 8)}...</span>
        </div>
        <div className="flex items-center gap-4">
          <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
          <span>UTF-8</span>
        </div>
      </div>
    </div>
  );
}
