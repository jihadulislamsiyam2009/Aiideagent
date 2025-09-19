
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

export interface MobileProject {
  id: string;
  name: string;
  platform: 'ios' | 'android' | 'react-native' | 'flutter';
  packageName: string;
  version: string;
  buildNumber: number;
  configurations: MobileConfiguration[];
}

export interface MobileConfiguration {
  name: string;
  platform: 'ios' | 'android';
  buildType: 'debug' | 'release';
  signingConfig?: SigningConfig;
  buildSettings: Record<string, any>;
}

export interface SigningConfig {
  keystore?: string;
  keystorePassword?: string;
  keyAlias?: string;
  keyPassword?: string;
  provisioningProfile?: string;
  certificate?: string;
}

export interface BuildResult {
  id: string;
  projectId: string;
  platform: string;
  buildType: string;
  status: 'pending' | 'building' | 'success' | 'failed';
  outputPath?: string;
  logs: string[];
  startTime: Date;
  endTime?: Date;
}

export interface DeviceInfo {
  id: string;
  name: string;
  platform: 'ios' | 'android';
  version: string;
  type: 'physical' | 'simulator' | 'emulator';
  connected: boolean;
}

export class MobileDevService {
  private projects: Map<string, MobileProject> = new Map();
  private builds: Map<string, BuildResult> = new Map();
  private devices: Map<string, DeviceInfo> = new Map();

  async createMobileProject(config: Omit<MobileProject, 'id'>): Promise<string> {
    const projectId = `mobile-${Date.now()}`;
    const project: MobileProject = { ...config, id: projectId };
    
    this.projects.set(projectId, project);
    
    // Generate project structure based on platform
    await this.generateProjectStructure(project);
    
    return projectId;
  }

  private async generateProjectStructure(project: MobileProject): Promise<void> {
    const projectPath = path.join(process.cwd(), 'mobile-projects', project.name);
    await fs.mkdir(projectPath, { recursive: true });

    switch (project.platform) {
      case 'react-native':
        await this.generateReactNativeProject(project, projectPath);
        break;
      case 'flutter':
        await this.generateFlutterProject(project, projectPath);
        break;
      case 'android':
        await this.generateAndroidProject(project, projectPath);
        break;
      case 'ios':
        await this.generateiOSProject(project, projectPath);
        break;
    }
  }

  private async generateReactNativeProject(project: MobileProject, projectPath: string): Promise<void> {
    const packageJson = {
      name: project.name,
      version: project.version,
      scripts: {
        start: 'react-native start',
        'android': 'react-native run-android',
        'ios': 'react-native run-ios',
        test: 'jest',
        'build:android': 'cd android && ./gradlew assembleRelease',
        'build:ios': 'react-native run-ios --configuration Release'
      },
      dependencies: {
        'react': '^18.2.0',
        'react-native': '^0.72.0'
      },
      devDependencies: {
        '@react-native/metro-config': '^0.72.0',
        '@types/react': '^18.2.0',
        '@types/react-native': '^0.72.0',
        'jest': '^29.0.0',
        'typescript': '^5.0.0'
      }
    };

    await fs.writeFile(path.join(projectPath, 'package.json'), JSON.stringify(packageJson, null, 2));
    
    // Create basic React Native files
    await fs.writeFile(path.join(projectPath, 'App.tsx'), `
import React from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';

const App: React.FC = () => {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Welcome to ${project.name}</Text>
        <Text style={styles.subtitle}>React Native App</Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
});

export default App;
`);

    await fs.writeFile(path.join(projectPath, 'index.js'), `
import {AppRegistry} from 'react-native';
import App from './App';
import {name as appName} from './app.json';

AppRegistry.registerComponent(appName, () => App);
`);

    await fs.writeFile(path.join(projectPath, 'app.json'), JSON.stringify({
      name: project.name,
      displayName: project.name
    }, null, 2));
  }

  private async generateFlutterProject(project: MobileProject, projectPath: string): Promise<void> {
    const pubspecYml = `
name: ${project.name.toLowerCase().replace(/\s+/g, '_')}
description: ${project.name} Flutter application
version: ${project.version}+${project.buildNumber}

environment:
  sdk: '>=3.0.0 <4.0.0'
  flutter: ">=3.0.0"

dependencies:
  flutter:
    sdk: flutter
  cupertino_icons: ^1.0.2

dev_dependencies:
  flutter_test:
    sdk: flutter
  flutter_lints: ^2.0.0

flutter:
  uses-material-design: true
`;

    await fs.writeFile(path.join(projectPath, 'pubspec.yaml'), pubspecYml);
    
    // Create lib directory and main.dart
    await fs.mkdir(path.join(projectPath, 'lib'), { recursive: true });
    await fs.writeFile(path.join(projectPath, 'lib', 'main.dart'), `
import 'package:flutter/material.dart';

void main() {
  runApp(MyApp());
}

class MyApp extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: '${project.name}',
      theme: ThemeData(
        primarySwatch: Colors.blue,
      ),
      home: MyHomePage(title: '${project.name}'),
    );
  }
}

class MyHomePage extends StatefulWidget {
  MyHomePage({Key? key, required this.title}) : super(key: key);
  final String title;

  @override
  _MyHomePageState createState() => _MyHomePageState();
}

class _MyHomePageState extends State<MyHomePage> {
  int _counter = 0;

  void _incrementCounter() {
    setState(() {
      _counter++;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.title),
      ),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: <Widget>[
            Text(
              'You have pushed the button this many times:',
            ),
            Text(
              '$_counter',
              style: Theme.of(context).textTheme.headlineMedium,
            ),
          ],
        ),
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: _incrementCounter,
        tooltip: 'Increment',
        child: Icon(Icons.add),
      ),
    );
  }
}
`);
  }

  private async generateAndroidProject(project: MobileProject, projectPath: string): Promise<void> {
    // Create Android project structure
    const androidDir = path.join(projectPath, 'app', 'src', 'main');
    await fs.mkdir(androidDir, { recursive: true });
    
    // Generate build.gradle
    const buildGradle = `
plugins {
    id 'com.android.application'
}

android {
    namespace '${project.packageName}'
    compileSdk 34

    defaultConfig {
        applicationId '${project.packageName}'
        minSdk 21
        targetSdk 34
        versionCode ${project.buildNumber}
        versionName '${project.version}'
    }

    buildTypes {
        release {
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }
}

dependencies {
    implementation 'androidx.appcompat:appcompat:1.6.1'
    implementation 'com.google.android.material:material:1.9.0'
    implementation 'androidx.constraintlayout:constraintlayout:2.1.4'
}
`;

    await fs.writeFile(path.join(projectPath, 'app', 'build.gradle'), buildGradle);
    
    // Generate AndroidManifest.xml
    const manifest = `
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:tools="http://schemas.android.com/tools">

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="${project.name}"
        android:theme="@style/Theme.AppCompat.Light.DarkActionBar">
        <activity
            android:name=".MainActivity"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>

</manifest>
`;

    await fs.writeFile(path.join(androidDir, 'AndroidManifest.xml'), manifest);
  }

  private async generateiOSProject(project: MobileProject, projectPath: string): Promise<void> {
    // Create iOS project structure
    const iosDir = path.join(projectPath, project.name);
    await fs.mkdir(iosDir, { recursive: true });
    
    // Generate Info.plist
    const infoPlist = `
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleDevelopmentRegion</key>
    <string>en</string>
    <key>CFBundleDisplayName</key>
    <string>${project.name}</string>
    <key>CFBundleExecutable</key>
    <string>${project.name}</string>
    <key>CFBundleIdentifier</key>
    <string>${project.packageName}</string>
    <key>CFBundleInfoDictionaryVersion</key>
    <string>6.0</string>
    <key>CFBundleName</key>
    <string>${project.name}</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>${project.version}</string>
    <key>CFBundleVersion</key>
    <string>${project.buildNumber}</string>
</dict>
</plist>
`;

    await fs.writeFile(path.join(iosDir, 'Info.plist'), infoPlist);
  }

  async buildProject(projectId: string, platform: string, buildType: string = 'debug'): Promise<string> {
    const project = this.projects.get(projectId);
    if (!project) throw new Error('Project not found');

    const buildId = `build-${Date.now()}`;
    const build: BuildResult = {
      id: buildId,
      projectId,
      platform,
      buildType,
      status: 'building',
      logs: [],
      startTime: new Date()
    };

    this.builds.set(buildId, build);

    try {
      await this.executeBuild(project, platform, buildType, build);
      build.status = 'success';
    } catch (error) {
      build.status = 'failed';
      build.logs.push(`Build failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    build.endTime = new Date();
    return buildId;
  }

  private async executeBuild(project: MobileProject, platform: string, buildType: string, build: BuildResult): Promise<void> {
    const projectPath = path.join(process.cwd(), 'mobile-projects', project.name);

    let buildCommand = '';
    
    switch (project.platform) {
      case 'react-native':
        buildCommand = platform === 'android' ? 'npm run build:android' : 'npm run build:ios';
        break;
      case 'flutter':
        buildCommand = `flutter build ${platform} --${buildType}`;
        break;
      case 'android':
        buildCommand = `./gradlew assemble${buildType === 'release' ? 'Release' : 'Debug'}`;
        break;
      case 'ios':
        buildCommand = `xcodebuild -scheme ${project.name} -configuration ${buildType === 'release' ? 'Release' : 'Debug'}`;
        break;
    }

    return new Promise((resolve, reject) => {
      const buildProcess = spawn('bash', ['-c', buildCommand], {
        cwd: projectPath,
        stdio: 'pipe'
      });

      buildProcess.stdout.on('data', (data) => {
        const output = data.toString();
        build.logs.push(output);
      });

      buildProcess.stderr.on('data', (data) => {
        const output = data.toString();
        build.logs.push(output);
      });

      buildProcess.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Build process exited with code ${code}`));
        }
      });
    });
  }

  async getConnectedDevices(): Promise<DeviceInfo[]> {
    const devices: DeviceInfo[] = [];
    
    // Get Android devices
    try {
      const androidDevices = await this.getAndroidDevices();
      devices.push(...androidDevices);
    } catch (error) {
      console.error('Failed to get Android devices:', error);
    }

    // Get iOS simulators
    try {
      const iosDevices = await this.getiOSDevices();
      devices.push(...iosDevices);
    } catch (error) {
      console.error('Failed to get iOS devices:', error);
    }

    return devices;
  }

  private async getAndroidDevices(): Promise<DeviceInfo[]> {
    return new Promise((resolve) => {
      const adbProcess = spawn('adb', ['devices', '-l']);
      let output = '';

      adbProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      adbProcess.on('close', () => {
        const devices: DeviceInfo[] = [];
        const lines = output.split('\n').slice(1); // Skip header

        for (const line of lines) {
          if (line.trim() && !line.includes('List of devices')) {
            const parts = line.split('\t');
            if (parts.length >= 2 && parts[1].includes('device')) {
              devices.push({
                id: parts[0],
                name: `Android Device ${parts[0]}`,
                platform: 'android',
                version: 'Unknown',
                type: 'physical',
                connected: true
              });
            }
          }
        }

        resolve(devices);
      });
    });
  }

  private async getiOSDevices(): Promise<DeviceInfo[]> {
    return new Promise((resolve) => {
      const xcrunProcess = spawn('xcrun', ['simctl', 'list', 'devices', 'available']);
      let output = '';

      xcrunProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      xcrunProcess.on('close', () => {
        const devices: DeviceInfo[] = [];
        const lines = output.split('\n');

        for (const line of lines) {
          const match = line.match(/^\s+(.+?)\s+\(([A-F0-9-]+)\)\s+\((\w+)\)/);
          if (match) {
            devices.push({
              id: match[2],
              name: match[1],
              platform: 'ios',
              version: 'iOS',
              type: 'simulator',
              connected: match[3] === 'Booted'
            });
          }
        }

        resolve(devices);
      });
    });
  }

  async deployToDevice(buildId: string, deviceId: string): Promise<void> {
    const build = this.builds.get(buildId);
    if (!build || !build.outputPath) throw new Error('Build not found or no output available');

    const device = this.devices.get(deviceId);
    if (!device) throw new Error('Device not found');

    if (device.platform === 'android') {
      await this.deployToAndroid(build.outputPath, deviceId);
    } else {
      await this.deployToiOS(build.outputPath, deviceId);
    }
  }

  private async deployToAndroid(apkPath: string, deviceId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const installProcess = spawn('adb', ['-s', deviceId, 'install', apkPath]);

      installProcess.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Failed to install APK on device ${deviceId}`));
        }
      });
    });
  }

  private async deployToiOS(appPath: string, deviceId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const installProcess = spawn('xcrun', ['simctl', 'install', deviceId, appPath]);

      installProcess.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Failed to install app on simulator ${deviceId}`));
        }
      });
    });
  }

  getBuild(buildId: string): BuildResult | undefined {
    return this.builds.get(buildId);
  }

  getProject(projectId: string): MobileProject | undefined {
    return this.projects.get(projectId);
  }

  getProjects(): MobileProject[] {
    return Array.from(this.projects.values());
  }
}

export const mobileDevService = new MobileDevService();
