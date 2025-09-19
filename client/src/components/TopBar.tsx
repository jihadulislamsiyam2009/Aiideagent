import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, Settings, User } from "lucide-react";

interface TopBarProps {
  title: string;
}

export function TopBar({ title }: TopBarProps) {
  return (
    <header 
      className="h-14 bg-card border-b border-border flex items-center justify-between px-6"
      data-testid="top-bar"
    >
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-lg" data-testid="page-title">{title}</h2>
          <Badge variant="secondary" className="bg-accent text-accent-foreground">
            Live
          </Badge>
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        <Button 
          variant="ghost" 
          size="sm" 
          className="p-2 hover:bg-secondary rounded-md"
          data-testid="notifications-button"
        >
          <Bell size={16} className="text-muted-foreground" />
        </Button>
        
        <Button 
          variant="ghost" 
          size="sm" 
          className="p-2 hover:bg-secondary rounded-md"
          data-testid="settings-button"
        >
          <Settings size={16} className="text-muted-foreground" />
        </Button>
        
        <div 
          className="w-8 h-8 bg-primary rounded-full flex items-center justify-center cursor-pointer"
          data-testid="user-avatar"
        >
          <User size={16} className="text-primary-foreground" />
        </div>
      </div>
    </header>
  );
}
