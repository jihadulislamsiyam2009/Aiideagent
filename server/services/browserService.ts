
import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import puppeteer, { Browser, Page } from 'puppeteer';
import fs from 'fs/promises';
import path from 'path';

export interface BrowserSession {
  id: string;
  browser: Browser | null;
  pages: Map<string, Page>;
  isActive: boolean;
  emitter: EventEmitter;
  createdAt: Date;
  lastActivity: Date;
}

export interface AutomationScript {
  id: string;
  name: string;
  description: string;
  steps: AutomationStep[];
  status: 'idle' | 'running' | 'completed' | 'error';
  results?: any;
}

export interface AutomationStep {
  type: 'navigate' | 'click' | 'type' | 'wait' | 'extract' | 'screenshot' | 'scroll';
  selector?: string;
  value?: string;
  url?: string;
  timeout?: number;
  waitFor?: string;
}

export interface ScrapedData {
  url: string;
  title: string;
  data: any;
  timestamp: Date;
  screenshots?: string[];
}

export class BrowserService {
  private sessions: Map<string, BrowserSession> = new Map();
  private automationScripts: Map<string, AutomationScript> = new Map();
  private scrapedData: ScrapedData[] = [];

  constructor() {
    this.initializeDefaultScripts();
  }

  private initializeDefaultScripts() {
    const defaultScripts: AutomationScript[] = [
      {
        id: 'web-scraper',
        name: 'Web Data Scraper',
        description: 'Extract text, links, and images from web pages',
        status: 'idle',
        steps: [
          { type: 'navigate', url: '' },
          { type: 'wait', timeout: 2000 },
          { type: 'extract', selector: 'title' },
          { type: 'extract', selector: 'a[href]' },
          { type: 'extract', selector: 'img[src]' },
          { type: 'screenshot' }
        ]
      },
      {
        id: 'form-filler',
        name: 'Form Auto Filler',
        description: 'Automatically fill and submit forms',
        status: 'idle',
        steps: [
          { type: 'navigate', url: '' },
          { type: 'wait', timeout: 1000 },
          { type: 'type', selector: 'input[type="text"]', value: 'Sample Text' },
          { type: 'type', selector: 'input[type="email"]', value: 'test@example.com' },
          { type: 'click', selector: 'button[type="submit"]' }
        ]
      },
      {
        id: 'page-monitor',
        name: 'Page Change Monitor',
        description: 'Monitor webpage for changes',
        status: 'idle',
        steps: [
          { type: 'navigate', url: '' },
          { type: 'screenshot' },
          { type: 'wait', timeout: 30000 },
          { type: 'screenshot' },
          { type: 'extract', selector: 'body' }
        ]
      }
    ];

    defaultScripts.forEach(script => {
      this.automationScripts.set(script.id, script);
    });
  }

  async createBrowserSession(sessionId: string): Promise<BrowserSession> {
    if (this.sessions.has(sessionId)) {
      await this.closeBrowserSession(sessionId);
    }

    const emitter = new EventEmitter();

    try {
      const browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-gpu'
        ]
      });

      const session: BrowserSession = {
        id: sessionId,
        browser,
        pages: new Map(),
        isActive: true,
        emitter,
        createdAt: new Date(),
        lastActivity: new Date()
      };

      this.sessions.set(sessionId, session);

      // Create initial page
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 720 });
      session.pages.set('main', page);

      emitter.emit('session-created', { sessionId, pageId: 'main' });

      return session;
    } catch (error: any) {
      emitter.emit('error', `Failed to create browser session: ${error.message}`);
      throw error;
    }
  }

  async navigateToUrl(sessionId: string, pageId: string, url: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session || !session.browser) {
      throw new Error('Browser session not found');
    }

    const page = session.pages.get(pageId);
    if (!page) {
      throw new Error('Page not found');
    }

    try {
      session.lastActivity = new Date();
      
      // Add protocol if missing
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }

      session.emitter.emit('navigation-start', { pageId, url });

      const response = await page.goto(url, { 
        waitUntil: 'networkidle0',
        timeout: 30000 
      });

      const title = await page.title();
      const finalUrl = page.url();

      session.emitter.emit('navigation-complete', { 
        pageId, 
        url: finalUrl, 
        title, 
        status: response?.status() 
      });

    } catch (error: any) {
      session.emitter.emit('navigation-error', { 
        pageId, 
        url, 
        error: error.message 
      });
      throw error;
    }
  }

  async takeScreenshot(sessionId: string, pageId: string): Promise<string> {
    const session = this.sessions.get(sessionId);
    if (!session || !session.browser) {
      throw new Error('Browser session not found');
    }

    const page = session.pages.get(pageId);
    if (!page) {
      throw new Error('Page not found');
    }

    try {
      const screenshot = await page.screenshot({ 
        type: 'png', 
        fullPage: true,
        encoding: 'base64'
      });

      const screenshotPath = path.join(process.cwd(), 'screenshots', `${sessionId}-${pageId}-${Date.now()}.png`);
      await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
      await fs.writeFile(screenshotPath, screenshot, 'base64');

      session.emitter.emit('screenshot-taken', { pageId, path: screenshotPath });

      return `data:image/png;base64,${screenshot}`;
    } catch (error: any) {
      session.emitter.emit('error', `Screenshot failed: ${error.message}`);
      throw error;
    }
  }

  async extractData(sessionId: string, pageId: string, selector: string): Promise<any> {
    const session = this.sessions.get(sessionId);
    if (!session || !session.browser) {
      throw new Error('Browser session not found');
    }

    const page = session.pages.get(pageId);
    if (!page) {
      throw new Error('Page not found');
    }

    try {
      const data = await page.evaluate((sel) => {
        const elements = document.querySelectorAll(sel);
        return Array.from(elements).map(el => {
          if (el.tagName === 'A') {
            return { text: el.textContent?.trim(), href: (el as HTMLAnchorElement).href };
          } else if (el.tagName === 'IMG') {
            return { alt: (el as HTMLImageElement).alt, src: (el as HTMLImageElement).src };
          } else {
            return { text: el.textContent?.trim(), html: el.innerHTML };
          }
        });
      }, selector);

      session.emitter.emit('data-extracted', { pageId, selector, data });

      return data;
    } catch (error: any) {
      session.emitter.emit('error', `Data extraction failed: ${error.message}`);
      throw error;
    }
  }

  async clickElement(sessionId: string, pageId: string, selector: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session || !session.browser) {
      throw new Error('Browser session not found');
    }

    const page = session.pages.get(pageId);
    if (!page) {
      throw new Error('Page not found');
    }

    try {
      await page.waitForSelector(selector, { timeout: 5000 });
      await page.click(selector);

      session.emitter.emit('element-clicked', { pageId, selector });
    } catch (error: any) {
      session.emitter.emit('error', `Click failed: ${error.message}`);
      throw error;
    }
  }

  async typeText(sessionId: string, pageId: string, selector: string, text: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session || !session.browser) {
      throw new Error('Browser session not found');
    }

    const page = session.pages.get(pageId);
    if (!page) {
      throw new Error('Page not found');
    }

    try {
      await page.waitForSelector(selector, { timeout: 5000 });
      await page.focus(selector);
      await page.keyboard.selectAll();
      await page.type(selector, text);

      session.emitter.emit('text-typed', { pageId, selector, text });
    } catch (error: any) {
      session.emitter.emit('error', `Type failed: ${error.message}`);
      throw error;
    }
  }

  async runAutomationScript(scriptId: string, url: string): Promise<string> {
    const script = this.automationScripts.get(scriptId);
    if (!script) {
      throw new Error('Script not found');
    }

    const runId = `run-${Date.now()}`;
    const sessionId = `auto-${runId}`;

    try {
      script.status = 'running';
      const session = await this.createBrowserSession(sessionId);
      const pageId = 'main';

      const results: any = {
        url,
        startTime: new Date(),
        steps: [],
        data: {},
        screenshots: []
      };

      for (let i = 0; i < script.steps.length; i++) {
        const step = script.steps[i];
        const stepResult: any = { step: i + 1, type: step.type, timestamp: new Date() };

        try {
          switch (step.type) {
            case 'navigate':
              await this.navigateToUrl(sessionId, pageId, url);
              stepResult.url = url;
              break;

            case 'wait':
              await new Promise(resolve => setTimeout(resolve, step.timeout || 1000));
              stepResult.timeout = step.timeout;
              break;

            case 'click':
              if (step.selector) {
                await this.clickElement(sessionId, pageId, step.selector);
                stepResult.selector = step.selector;
              }
              break;

            case 'type':
              if (step.selector && step.value) {
                await this.typeText(sessionId, pageId, step.selector, step.value);
                stepResult.selector = step.selector;
                stepResult.value = step.value;
              }
              break;

            case 'extract':
              if (step.selector) {
                const data = await this.extractData(sessionId, pageId, step.selector);
                results.data[step.selector] = data;
                stepResult.selector = step.selector;
                stepResult.dataCount = data.length;
              }
              break;

            case 'screenshot':
              const screenshot = await this.takeScreenshot(sessionId, pageId);
              results.screenshots.push(screenshot);
              stepResult.screenshot = true;
              break;
          }

          stepResult.status = 'success';
        } catch (error: any) {
          stepResult.status = 'error';
          stepResult.error = error.message;
        }

        results.steps.push(stepResult);
      }

      results.endTime = new Date();
      results.duration = results.endTime.getTime() - results.startTime.getTime();

      // Save scraped data
      this.scrapedData.push({
        url,
        title: results.data.title?.[0]?.text || 'Unknown',
        data: results.data,
        timestamp: new Date(),
        screenshots: results.screenshots
      });

      script.status = 'completed';
      script.results = results;

      // Clean up session
      await this.closeBrowserSession(sessionId);

      return runId;
    } catch (error: any) {
      script.status = 'error';
      await this.closeBrowserSession(sessionId);
      throw error;
    }
  }

  async createNewTab(sessionId: string): Promise<string> {
    const session = this.sessions.get(sessionId);
    if (!session || !session.browser) {
      throw new Error('Browser session not found');
    }

    try {
      const page = await session.browser.newPage();
      await page.setViewport({ width: 1280, height: 720 });
      
      const tabId = `tab-${Date.now()}`;
      session.pages.set(tabId, page);

      session.emitter.emit('tab-created', { tabId });

      return tabId;
    } catch (error: any) {
      session.emitter.emit('error', `Failed to create tab: ${error.message}`);
      throw error;
    }
  }

  async closeTab(sessionId: string, pageId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Browser session not found');
    }

    const page = session.pages.get(pageId);
    if (page) {
      await page.close();
      session.pages.delete(pageId);
      session.emitter.emit('tab-closed', { pageId });
    }
  }

  async closeBrowserSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    try {
      if (session.browser) {
        await session.browser.close();
      }
      session.isActive = false;
      session.emitter.removeAllListeners();
      this.sessions.delete(sessionId);
    } catch (error: any) {
      console.error(`Error closing browser session ${sessionId}:`, error);
    }
  }

  getSession(sessionId: string): BrowserSession | undefined {
    return this.sessions.get(sessionId);
  }

  getAllSessions(): BrowserSession[] {
    return Array.from(this.sessions.values());
  }

  getAutomationScript(scriptId: string): AutomationScript | undefined {
    return this.automationScripts.get(scriptId);
  }

  getAllAutomationScripts(): AutomationScript[] {
    return Array.from(this.automationScripts.values());
  }

  getScrapedData(): ScrapedData[] {
    return this.scrapedData;
  }

  async clearScrapedData(): Promise<void> {
    this.scrapedData = [];
  }

  async addCustomScript(script: Omit<AutomationScript, 'id' | 'status'>): Promise<string> {
    const scriptId = `custom-${Date.now()}`;
    const newScript: AutomationScript = {
      ...script,
      id: scriptId,
      status: 'idle'
    };

    this.automationScripts.set(scriptId, newScript);
    return scriptId;
  }

  // Real browser capabilities
  async getPageSource(sessionId: string, pageId: string): Promise<string> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    const page = session.pages.get(pageId);
    if (!page) throw new Error('Page not found');

    return await page.content();
  }

  async executeJavaScript(sessionId: string, pageId: string, script: string): Promise<any> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    const page = session.pages.get(pageId);
    if (!page) throw new Error('Page not found');

    return await page.evaluate(script);
  }

  async getCookies(sessionId: string, pageId: string): Promise<any> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    const page = session.pages.get(pageId);
    if (!page) throw new Error('Page not found');

    return await page.cookies();
  }

  async setCookie(sessionId: string, pageId: string, cookie: any): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    const page = session.pages.get(pageId);
    if (!page) throw new Error('Page not found');

    await page.setCookie(cookie);
  }
}

export const browserService = new BrowserService();
