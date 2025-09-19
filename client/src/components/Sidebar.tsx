import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Brain,
  Code,
  FolderOpen,
  Terminal as TerminalIcon,
  Globe,
  Layers3,
  Bot,
  Settings,
  Bell,
  User
} from "lucide-react";

interface SidebarProps {
  currentView: string;
  onViewChange: (view: string) => void;
}

interface SidebarItemProps {
  href: string;
  icon: React.ReactNode;
  label: string;
  badge?: number;
  isActive: boolean;
  onClick: () => void;
}

function SidebarItem({ href, icon, label, badge, isActive, onClick }: SidebarItemProps) {
  return (
    <Link href={href}>
      <div 
        className={`sidebar-item ${isActive ? 'active' : ''}`}
        onClick={onClick}
        data-testid={`sidebar-${label.toLowerCase().replace(' ', '-')}`}
      >
        {icon}
        <span>{label}</span>
        {badge && (
          <Badge variant="secondary" className="ml-auto bg-primary text-primary-foreground">
            {badge}
          </Badge>
        )}
      </div>
    </Link>
  );
}

export function Sidebar({ currentView, onViewChange }: SidebarProps) {
  const [location] = useLocation();

  const menuItems = [
    { href: "/", icon: <LayoutDashboard size={16} />, label: "Dashboard" },
    { href: "/models", icon: <Brain size={16} />, label: "Model Manager", badge: 7 },
    { href: "/editor", icon: <Code size={16} />, label: "Code Editor" },
    { href: "/projects", icon: <FolderOpen size={16} />, label: "Projects" },
    { href: "/terminal", icon: <TerminalIcon size={16} />, label: "Terminal" },
    { href: "/browser", icon: <Globe size={16} />, label: "Browser" },
    { href: "/templates", icon: <Layers3 size={16} />, label: "Templates" }
  ];

  return (
    <div className="w-64 bg-card border-r border-border flex flex-col" data-testid="sidebar">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center">
            <Bot className="text-primary-foreground" size={16} />
          </div>
          <div>
            <h1 className="font-semibold text-lg">AI Studio</h1>
            <p className="text-xs text-muted-foreground">Enterprise Platform</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {menuItems.map((item) => (
          <SidebarItem
            key={item.href}
            href={item.href}
            icon={item.icon}
            label={item.label}
            badge={item.badge}
            isActive={location === item.href}
            onClick={() => onViewChange(item.label)}
          />
        ))}

        {/* Active Models Section */}
        <div className="pt-4 border-t border-border mt-4">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-3">
            Active Models
          </h3>
          <div className="space-y-1">
            <div className="flex items-center gap-2 px-3 py-1 text-sm" data-testid="active-model-llama">
              <div className="status-dot running"></div>
              <span className="flex-1 truncate">llama3.1:8b</span>
              <span className="text-xs text-muted-foreground">2.3GB</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1 text-sm" data-testid="active-model-codellama">
              <div className="status-dot running"></div>
              <span className="flex-1 truncate">codellama:7b</span>
              <span className="text-xs text-muted-foreground">1.8GB</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1 text-sm" data-testid="active-model-mistral">
              <div className="status-dot stopped"></div>
              <span className="flex-1 truncate">mistral:7b</span>
              <span className="text-xs text-muted-foreground">1.2GB</span>
            </div>
          </div>
        </div>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-border" data-testid="sidebar-footer">
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
          <span>System Status</span>
          <div className="flex items-center gap-1">
            <div className="status-dot running"></div>
            <span>Online</span>
          </div>
        </div>
        <Progress value={68} className="h-2 mb-2" />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Memory</span>
          <span>6.8GB / 10GB</span>
        </div>
      </div>
    </div>
  );
}
