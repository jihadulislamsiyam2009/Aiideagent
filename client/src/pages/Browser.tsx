
import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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
  Keyboard,
  Camera,
  Loader2
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

interface ScrapedData {
  url: string;
  title: string;
  data: any;
  timestamp: string;
  screenshots?: string[];
}

export default function Browser() {
  const [tabs, setTabs] = useState<BrowserTab[]>([
    {
      id: 'main',
      title: 'AI Studio Browser',
      url: 'about:blank',
      isActive: true,
      isLoading: false
    }
  ]);
  
  const [currentUrl, setCurrentUrl] = useState('');
  const [browserSessionId, setBrowserSessionId] = useState<string | null>(null);
  const [currentScreenshot, setCurrentScreenshot] = useState<string | null>(null);
  const [pageSource, setPageSource] = useState<string>('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordedActions, setRecordedActions] = useState<string[]>([]);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { toast } = useToast();

  // Queries
  const { data: automationScripts = [] } = useQuery<AutomationScript[]>({
    queryKey: ['/api/browser/automation/scripts']
  });

  const { data: scrapedData = [] } = useQuery<ScrapedData[]>({
    queryKey: ['/api/browser/data/scraped']
  });

  // Mutations
  const createSessionMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', '/api/browser/session');
    },
    onSuccess: (data: any) => {
      setBrowserSessionId(data.sessionId);
      toast({
        title: "Browser Session Created",
        description: "Ready to browse the web"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Create Browser Session",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const navigateMutation = useMutation({
    mutationFn: async ({ url, pageId }: { url: string, pageId: string }) => {
      return apiRequest('POST', `/api/browser/${browserSessionId}/navigate`, { url, pageId });
    },
    onSuccess: () => {
      const activeTab = tabs.find(tab => tab.isActive);
      if (activeTab) {
        setTabs(prev => prev.map(tab => 
          tab.id === activeTab.id 
            ? { ...tab, url: currentUrl, isLoading: false, title: getDomainFromUrl(currentUrl) }
            : tab
        ));
        
        // Take screenshot after navigation
        takeScreenshotMutation.mutate({ pageId: activeTab.id });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Navigation Failed",
        description: error.message,
        variant: "destructive"
      });
      
      const activeTab = tabs.find(tab => tab.isActive);
      if (activeTab) {
        setTabs(prev => prev.map(tab => 
          tab.id === activeTab.id 
            ? { ...tab, isLoading: false }
            : tab
        ));
      }
    }
  });

  const takeScreenshotMutation = useMutation({
    mutationFn: async ({ pageId }: { pageId: string }) => {
      return apiRequest('POST', `/api/browser/${browserSessionId}/screenshot`, { pageId });
    },
    onSuccess: (data: any) => {
      setCurrentScreenshot(data.screenshot);
    },
    onError: (error: any) => {
      console.error('Screenshot failed:', error);
    }
  });

  const extractDataMutation = useMutation({
    mutationFn: async ({ selector, pageId }: { selector: string, pageId: string }) => {
      return apiRequest('POST', `/api/browser/${browserSessionId}/extract`, { selector, pageId });
    },
    onSuccess: (data: any) => {
      toast({
        title: "Data Extracted",
        description: `Found ${data.data.length} elements`
      });
    }
  });

  const clickElementMutation = useMutation({
    mutationFn: async ({ selector, pageId }: { selector: string, pageId: string }) => {
      return apiRequest('POST', `/api/browser/${browserSessionId}/click`, { selector, pageId });
    },
    onSuccess: () => {
      // Take screenshot after click
      const activeTab = tabs.find(tab => tab.isActive);
      if (activeTab) {
        setTimeout(() => {
          takeScreenshotMutation.mutate({ pageId: activeTab.id });
        }, 1000);
      }
    }
  });

  const runAutomationMutation = useMutation({
    mutationFn: async ({ scriptId, url }: { scriptId: string, url: string }) => {
      return apiRequest('POST', '/api/browser/automation/run', { scriptId, url });
    },
    onSuccess: () => {
      toast({
        title: "Automation Started",
        description: "Script is running in background"
      });
    }
  });

  // Initialize browser session
  useEffect(() => {
    if (!browserSessionId) {
      createSessionMutation.mutate();
    }
  }, []);

  const getDomainFromUrl = (url: string): string => {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  };

  const handleNavigate = () => {
    if (!currentUrl || !browserSessionId) return;
    
    const activeTab = tabs.find(tab => tab.isActive);
    if (activeTab) {
      setTabs(prev => prev.map(tab => 
        tab.id === activeTab.id 
          ? { ...tab, url: currentUrl, isLoading: true, title: 'Loading...' }
          : tab
      ));
      
      navigateMutation.mutate({ url: currentUrl, pageId: activeTab.id });
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleNavigate();
    }
  };

  const createNewTab = () => {
    const newTab: BrowserTab = {
      id: `tab-${Date.now()}`,
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
      // Take screenshot of active tab
      if (tab.url !== 'about:blank' && browserSessionId) {
        takeScreenshotMutation.mutate({ pageId: tab.id });
      }
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
    toast({
      title: "Recording Started",
      description: "Your actions will be recorded"
    });
  };

  const stopRecording = () => {
    setIsRecording(false);
    toast({
      title: "Recording Stopped",
      description: `Recorded ${recordedActions.length} actions`
    });
  };

  const runAutomationScript = (scriptId: string) => {
    if (!currentUrl) {
      toast({
        title: "No URL",
        description: "Please navigate to a webpage first",
        variant: "destructive"
      });
      return;
    }

    runAutomationMutation.mutate({ scriptId, url: currentUrl });
  };

  const takeScreenshot = () => {
    const activeTab = tabs.find(tab => tab.isActive);
    if (activeTab && browserSessionId) {
      takeScreenshotMutation.mutate({ pageId: activeTab.id });
    }
  };

  const extractPageData = (selector: string) => {
    const activeTab = tabs.find(tab => tab.isActive);
    if (activeTab && browserSessionId) {
      extractDataMutation.mutate({ selector, pageId: activeTab.id });
    }
  };

  const goBack = () => {
    if (window.history.length > 1) {
      window.history.back();
    }
  };

  const goForward = () => {
    window.history.forward();
  };

  const refreshPage = () => {
    const activeTab = tabs.find(tab => tab.isActive);
    if (activeTab && activeTab.url !== 'about:blank') {
      setTabs(prev => prev.map(tab => 
        tab.id === activeTab.id 
          ? { ...tab, isLoading: true }
          : tab
      ));
      
      navigateMutation.mutate({ url: activeTab.url, pageId: activeTab.id });
    }
  };

  const activeTab = tabs.find(tab => tab.isActive);
  const isLoading = activeTab?.isLoading || navigateMutation.isPending || takeScreenshotMutation.isPending;

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
          <Button size="sm" variant="ghost" onClick={goBack} data-testid="button-back">
            <ArrowLeft size={16} />
          </Button>
          <Button size="sm" variant="ghost" onClick={goForward} data-testid="button-forward">
            <ArrowRight size={16} />
          </Button>
          <Button size="sm" variant="ghost" onClick={refreshPage} data-testid="button-refresh">
            <RotateCcw size={16} />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setCurrentUrl('https://google.com')} data-testid="button-home">
            <Home size={16} />
          </Button>
          
          <div className="flex-1 mx-4">
            <div className="relative">
              <Input
                value={currentUrl}
                onChange={(e) => setCurrentUrl(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Enter URL or search..."
                className="pr-20"
                data-testid="input-url-bar"
                disabled={!browserSessionId}
              />
              <div className="absolute right-1 top-1/2 transform -translate-y-1/2 flex gap-1">
                {isLoading && <Loader2 size={12} className="animate-spin" />}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0"
                  onClick={handleNavigate}
                  disabled={!browserSessionId || !currentUrl}
                >
                  <Search size={12} />
                </Button>
              </div>
            </div>
          </div>
          
          <Button size="sm" variant="ghost" onClick={takeScreenshot} data-testid="button-screenshot">
            <Camera size={16} />
          </Button>
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
                      onClick={() => { setCurrentUrl('https://example.com'); handleNavigate(); }}
                      disabled={!browserSessionId}
                    >
                      Example Site
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => { setCurrentUrl('https://github.com'); handleNavigate(); }}
                      disabled={!browserSessionId}
                    >
                      GitHub
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => { setCurrentUrl('https://google.com'); handleNavigate(); }}
                      disabled={!browserSessionId}
                    >
                      Google
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full">
                {currentScreenshot ? (
                  <img 
                    src={currentScreenshot} 
                    alt="Browser screenshot" 
                    className="w-full h-full object-top object-contain bg-white"
                  />
                ) : isLoading ? (
                  <div className="flex items-center justify-center h-full bg-background">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                      <p className="text-muted-foreground">Loading {activeTab.url}...</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full bg-background">
                    <div className="text-center">
                      <Globe size={48} className="mx-auto mb-4 text-muted-foreground" />
                      <p className="text-muted-foreground">
                        Page loaded: <span className="font-mono">{activeTab.url}</span>
                      </p>
                      <Button 
                        onClick={takeScreenshot} 
                        size="sm" 
                        className="mt-4"
                        disabled={takeScreenshotMutation.isPending}
                      >
                        {takeScreenshotMutation.isPending ? <Loader2 size={14} className="animate-spin mr-1" /> : <Camera size={14} className="mr-1" />}
                        Take Screenshot
                      </Button>
                    </div>
                  </div>
                )}
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
                        <div className={`w-2 h-2 rounded-full ${
                          script.status === 'running' ? 'bg-primary animate-pulse' :
                          script.status === 'completed' ? 'bg-accent' :
                          script.status === 'error' ? 'bg-destructive' : 'bg-muted-foreground'
                        }`}></div>
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
                      disabled={script.status === 'running' || runAutomationMutation.isPending}
                      onClick={() => runAutomationScript(script.id)}
                    >
                      {script.status === 'running' ? (
                        <>
                          <Loader2 size={12} className="mr-1 animate-spin" />
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
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => extractPageData('a[href]')}
                  disabled={!browserSessionId || extractDataMutation.isPending}
                >
                  <MousePointer size={14} className="mr-2" />
                  Extract Links
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => extractPageData('img[src]')}
                  disabled={!browserSessionId || extractDataMutation.isPending}
                >
                  <Eye size={14} className="mr-2" />
                  Extract Images
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => extractPageData('h1, h2, h3')}
                  disabled={!browserSessionId || extractDataMutation.isPending}
                >
                  <Code size={14} className="mr-2" />
                  Extract Headings
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={takeScreenshot}
                  disabled={!browserSessionId || takeScreenshotMutation.isPending}
                >
                  <Camera size={14} className="mr-2" />
                  Take Screenshot
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

            <TabsContent value="data" className="p-4 space-y-4">
              {scrapedData.length > 0 ? (
                <div className="space-y-4">
                  {scrapedData.slice(0, 5).map((data, index) => (
                    <Card key={index}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm truncate">{data.title}</CardTitle>
                        <p className="text-xs text-muted-foreground">{data.url}</p>
                      </CardHeader>
                      <CardContent>
                        <p className="text-xs text-muted-foreground mb-2">
                          {new Date(data.timestamp).toLocaleString()}
                        </p>
                        <Button size="sm" variant="outline" className="w-full">
                          <Download size={12} className="mr-1" />
                          Export
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Download size={48} className="mx-auto mb-4 text-muted-foreground opacity-20" />
                  <h4 className="font-medium mb-2">No Data Extracted</h4>
                  <p className="text-xs text-muted-foreground mb-4">
                    Run automation scripts to extract and view data
                  </p>
                  <Button size="sm" variant="outline">
                    <Download size={12} className="mr-1" />
                    Export All Data
                  </Button>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
