import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Globe, 
  ArrowLeft, 
  ArrowRight, 
  RotateCcw, 
  Home, 
  Bookmark, 
  Download,
  Search,
  Settings,
  Play,
  Pause,
  Square,
  Code,
  Eye,
  MousePointer,
  Keyboard
} from "lucide-react";

interface BrowserTab {
  id: string;
  title: string;
  url: string;
  isActive: boolean;
  isLoading: boolean;
}

interface AutomationScript {
  id: string;
  name: string;
  description: string;
  steps: string[];
  status: 'idle' | 'running' | 'completed' | 'error';
}

export default function Browser() {
  const [tabs, setTabs] = useState<BrowserTab[]>([
    {
      id: '1',
      title: 'AI Studio Browser',
      url: 'about:blank',
      isActive: true,
      isLoading: false
    }
  ]);
  
  const [currentUrl, setCurrentUrl] = useState('');
  const [automationScripts, setAutomationScripts] = useState<AutomationScript[]>([
    {
      id: '1',
      name: 'Web Scraper',
      description: 'Extract data from web pages',
      steps: ['Navigate to URL', 'Find elements', 'Extract text', 'Save data'],
      status: 'idle'
    },
    {
      id: '2',
      name: 'Form Filler',
      description: 'Automatically fill forms',
      steps: ['Open form', 'Fill inputs', 'Submit form'],
      status: 'idle'
    }
  ]);
  
  const [isRecording, setIsRecording] = useState(false);
  const [recordedActions, setRecordedActions] = useState<string[]>([]);

  const handleNavigate = () => {
    if (!currentUrl) return;
    
    const activeTab = tabs.find(tab => tab.isActive);
    if (activeTab) {
      setTabs(prev => prev.map(tab => 
        tab.id === activeTab.id 
          ? { ...tab, url: currentUrl, isLoading: true, title: 'Loading...' }
          : tab
      ));
      
      // Simulate loading
      setTimeout(() => {
        setTabs(prev => prev.map(tab => 
          tab.id === activeTab.id 
            ? { ...tab, isLoading: false, title: getDomainFromUrl(currentUrl) }
            : tab
        ));
      }, 1000);
    }
  };

  const getDomainFromUrl = (url: string): string => {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  };

  const createNewTab = () => {
    const newTab: BrowserTab = {
      id: Date.now().toString(),
      title: 'New Tab',
      url: 'about:blank',
      isActive: false,
      isLoading: false
    };
    
    setTabs(prev => [...prev.map(tab => ({ ...tab, isActive: false })), newTab]);
    setActiveTab(newTab.id);
  };

  const setActiveTab = (tabId: string) => {
    setTabs(prev => prev.map(tab => ({
      ...tab,
      isActive: tab.id === tabId
    })));
    
    const tab = tabs.find(t => t.id === tabId);
    if (tab) {
      setCurrentUrl(tab.url === 'about:blank' ? '' : tab.url);
    }
  };

  const closeTab = (tabId: string) => {
    if (tabs.length === 1) return;
    
    const tabIndex = tabs.findIndex(tab => tab.id === tabId);
    const wasActive = tabs[tabIndex]?.isActive;
    
    setTabs(prev => prev.filter(tab => tab.id !== tabId));
    
    if (wasActive) {
      const newActiveIndex = Math.max(0, tabIndex - 1);
      const remainingTabs = tabs.filter(tab => tab.id !== tabId);
      if (remainingTabs[newActiveIndex]) {
        setActiveTab(remainingTabs[newActiveIndex].id);
      }
    }
  };

  const startRecording = () => {
    setIsRecording(true);
    setRecordedActions([]);
  };

  const stopRecording = () => {
    setIsRecording(false);
  };

  const runAutomationScript = (scriptId: string) => {
    setAutomationScripts(prev => prev.map(script =>
      script.id === scriptId ? { ...script, status: 'running' } : script
    ));
    
    // Simulate script execution
    setTimeout(() => {
      setAutomationScripts(prev => prev.map(script =>
        script.id === scriptId ? { ...script, status: 'completed' } : script
      ));
    }, 3000);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'bg-primary';
      case 'completed': return 'bg-accent';
      case 'error': return 'bg-destructive';
      default: return 'bg-muted-foreground';
    }
  };

  const activeTab = tabs.find(tab => tab.isActive);

  return (
    <div className="h-full flex flex-col" data-testid="browser-view">
      {/* Browser Header */}
      <div className="border-b border-border bg-card">
        {/* Browser Tabs */}
        <div className="flex items-center px-4 pt-2">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={`flex items-center gap-2 px-4 py-2 border-b-2 cursor-pointer transition-colors max-w-48 ${
                tab.isActive 
                  ? 'border-primary bg-secondary' 
                  : 'border-transparent hover:bg-secondary/50'
              }`}
              onClick={() => setActiveTab(tab.id)}
              data-testid={`browser-tab-${tab.id}`}
            >
              <Globe size={14} className={tab.isLoading ? 'animate-spin' : ''} />
              <span className="text-sm truncate">{tab.title}</span>
              {tabs.length > 1 && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-4 w-4 p-0 hover:bg-destructive hover:text-destructive-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.id);
                  }}
                >
                  ×
                </Button>
              )}
            </div>
          ))}
          <Button 
            size="sm" 
            variant="ghost" 
            onClick={createNewTab}
            className="ml-2"
            data-testid="button-new-tab"
          >
            +
          </Button>
        </div>

        {/* Browser Controls */}
        <div className="flex items-center gap-2 p-4">
          <Button size="sm" variant="ghost" data-testid="button-back">
            <ArrowLeft size={16} />
          </Button>
          <Button size="sm" variant="ghost" data-testid="button-forward">
            <ArrowRight size={16} />
          </Button>
          <Button size="sm" variant="ghost" data-testid="button-refresh">
            <RotateCcw size={16} />
          </Button>
          <Button size="sm" variant="ghost" data-testid="button-home">
            <Home size={16} />
          </Button>
          
          <div className="flex-1 mx-4">
            <div className="relative">
              <Input
                value={currentUrl}
                onChange={(e) => setCurrentUrl(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleNavigate()}
                placeholder="Enter URL or search..."
                className="pr-10"
                data-testid="input-url-bar"
              />
              <Button
                size="sm"
                variant="ghost"
                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                onClick={handleNavigate}
              >
                <Search size={12} />
              </Button>
            </div>
          </div>
          
          <Button size="sm" variant="ghost" data-testid="button-bookmark">
            <Bookmark size={16} />
          </Button>
          <Button size="sm" variant="ghost" data-testid="button-browser-settings">
            <Settings size={16} />
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex">
        {/* Browser Content */}
        <div className="flex-1 flex flex-col">
          {/* Browser Viewport */}
          <div className="flex-1 bg-white border border-border m-4 rounded-lg overflow-hidden">
            {activeTab?.url === 'about:blank' || !activeTab?.url ? (
              <div className="flex items-center justify-center h-full bg-background">
                <div className="text-center">
                  <Globe size={64} className="mx-auto mb-4 text-muted-foreground opacity-20" />
                  <h3 className="text-lg font-semibold mb-2">AI Studio Browser</h3>
                  <p className="text-muted-foreground mb-4">Enter a URL in the address bar to browse the web</p>
                  <div className="flex gap-2 justify-center">
                    <Button 
                      variant="outline" 
                      onClick={() => setCurrentUrl('https://example.com')}
                    >
                      Example Site
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => setCurrentUrl('https://github.com')}
                    >
                      GitHub
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center bg-background">
                <div className="text-center">
                  {activeTab?.isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                      <p className="text-muted-foreground">Loading {activeTab.url}...</p>
                    </>
                  ) : (
                    <>
                      <Globe size={48} className="mx-auto mb-4 text-muted-foreground" />
                      <p className="text-muted-foreground">
                        Browser content for: <span className="font-mono">{activeTab.url}</span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        (Web content rendering would be implemented here)
                      </p>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Automation Panel */}
        <div className="w-80 border-l border-border bg-card">
          <div className="p-4 border-b border-border">
            <h3 className="font-semibold mb-2">Browser Automation</h3>
            <div className="flex gap-2">
              <Button 
                size="sm" 
                variant={isRecording ? "destructive" : "default"}
                onClick={isRecording ? stopRecording : startRecording}
                data-testid="button-record-actions"
              >
                {isRecording ? (
                  <>
                    <Square size={14} className="mr-1" />
                    Stop
                  </>
                ) : (
                  <>
                    <Play size={14} className="mr-1" />
                    Record
                  </>
                )}
              </Button>
              
              <Button size="sm" variant="outline" data-testid="button-automation-settings">
                <Settings size={14} />
              </Button>
            </div>
          </div>

          <Tabs defaultValue="scripts" className="flex-1">
            <TabsList className="grid w-full grid-cols-3 m-4 mb-0">
              <TabsTrigger value="scripts" data-testid="tab-scripts">Scripts</TabsTrigger>
              <TabsTrigger value="actions" data-testid="tab-actions">Actions</TabsTrigger>
              <TabsTrigger value="data" data-testid="tab-data">Data</TabsTrigger>
            </TabsList>

            <TabsContent value="scripts" className="p-4 space-y-4">
              {automationScripts.map((script) => (
                <Card key={script.id} data-testid={`automation-script-${script.id}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">{script.name}</CardTitle>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${getStatusColor(script.status)}`}></div>
                        <Badge variant="secondary" className="text-xs">
                          {script.status}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground mb-3">{script.description}</p>
                    <div className="space-y-1 mb-3">
                      {script.steps.map((step, index) => (
                        <div key={index} className="text-xs flex items-center gap-2">
                          <span className="w-4 h-4 bg-secondary rounded-full flex items-center justify-center text-xs">
                            {index + 1}
                          </span>
                          <span>{step}</span>
                        </div>
                      ))}
                    </div>
                    <Button 
                      size="sm" 
                      className="w-full"
                      disabled={script.status === 'running'}
                      onClick={() => runAutomationScript(script.id)}
                    >
                      {script.status === 'running' ? (
                        <>
                          <Pause size={12} className="mr-1" />
                          Running...
                        </>
                      ) : (
                        <>
                          <Play size={12} className="mr-1" />
                          Run Script
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="actions" className="p-4 space-y-2">
              <div className="space-y-2">
                <Button size="sm" variant="outline" className="w-full justify-start">
                  <MousePointer size={14} className="mr-2" />
                  Click Element
                </Button>
                <Button size="sm" variant="outline" className="w-full justify-start">
                  <Keyboard size={14} className="mr-2" />
                  Type Text
                </Button>
                <Button size="sm" variant="outline" className="w-full justify-start">
                  <Eye size={14} className="mr-2" />
                  Wait for Element
                </Button>
                <Button size="sm" variant="outline" className="w-full justify-start">
                  <Download size={14} className="mr-2" />
                  Extract Data
                </Button>
                <Button size="sm" variant="outline" className="w-full justify-start">
                  <Code size={14} className="mr-2" />
                  Execute Script
                </Button>
              </div>
              
              {isRecording && (
                <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 bg-destructive rounded-full animate-pulse"></div>
                    <span className="text-sm font-medium">Recording Actions</span>
                  </div>
                  <div className="space-y-1">
                    {recordedActions.map((action, index) => (
                      <div key={index} className="text-xs text-muted-foreground">
                        {index + 1}. {action}
                      </div>
                    ))}
                    {recordedActions.length === 0 && (
                      <p className="text-xs text-muted-foreground">Perform actions to record them...</p>
                    )}
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="data" className="p-4">
              <div className="text-center py-8">
                <Download size={48} className="mx-auto mb-4 text-muted-foreground opacity-20" />
                <h4 className="font-medium mb-2">Extracted Data</h4>
                <p className="text-xs text-muted-foreground mb-4">
                  Run automation scripts to extract and view data
                </p>
                <Button size="sm" variant="outline">
                  <Download size={12} className="mr-1" />
                  Export Data
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
