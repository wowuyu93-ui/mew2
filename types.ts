
export interface Message {
  id: string;
  role: 'user' | 'model' | 'system';
  content: string;
  osContent?: string; // Inner monologue
  timestamp: number;
  mode?: 'online' | 'offline' | 'theater'; // Track which mode generated this message
  scenarioId?: string; // If mode is theater, which scenario?
  isRecalled?: boolean; // If true, show as "recalled"
  originalContent?: string; // Store content for "peeking" after recall
  quote?: {
      id: string;
      content: string;
      name: string;
  }; // New: Citation/Quote data
  isHidden?: boolean; // New: For system commands that shouldn't appear in UI
}

export interface MemoryCard {
  id: string;
  location?: string;
  event: string;
  status?: string;
  content: string; // The full summary content
  timestamp: number;
  selected?: boolean;
}

export interface DiaryEntry {
  id: string;
  timestamp: number;
  title: string; // New: AI generated title
  weather: string;
  mood: string;
  content: string;
  isExpanded?: boolean; // UI state
}

export interface PeekReaction {
  charId: string;
  charName: string;
  charAvatar: string;
  comment: string;
  timestamp: number;
}

export interface UserDiaryEntry {
  id: string;
  timestamp: number;
  title: string;
  content: string;
  weather: string;
  mood: string;
  peeks: PeekReaction[];
  isExpanded?: boolean;
}

export interface FurnaceConfig {
  autoEnabled: boolean;
  autoThreshold: number; // Trigger after X messages
  autoScope: number; // Summarize last Y messages
  manualScope: number; // Summarize last Z messages manually
}

export interface OfflineConfig {
  systemPrompt: string;
  style: string;
  wordCount: number;
  bgUrl?: string; // Independent background for offline mode
  indicatorColor?: string; // Custom color for loading dots
}

// New: Theater Scenario Interface
export interface Scenario {
  id: string;
  title: string;
  description: string;
  systemPrompt: string;
  isConnected: boolean; // True: Mixed with main memory. False: Isolated.
  wallpaper?: string;
  contextMemory?: string; // Only for isolated scenarios
  messages?: Message[]; // Only for isolated scenarios
}

export interface GlobalPersona {
  name: string;
  avatar: string;
  description: string;
  diaries: UserDiaryEntry[]; // User's own diaries
}

export interface Character {
  id: string;
  name: string;
  remark: string; // Display name in list
  avatar: string; // URL or Base64
  description: string; // Simple description
  personality: string; // Detailed personality for prompt
  systemPrompt: string; // The raw system prompt template for ONLINE
  osSystemPrompt?: string; // The specific prompt for Inner Monologue
  showOS?: boolean; // Toggle for showing OS bubbles
  
  // User Persona Settings
  useLocalPersona: boolean; // Toggle between Global and Local
  userMaskName: string; // The user's name in this specific roleplay
  userMaskAvatar?: string; // Local user avatar
  userMaskDescription?: string; // Optional user description
  
  realTimeMode: boolean; // Sync with real world time
  
  chatBackground?: string;
  contextMemory: string; // Editable context text
  historyCount: number; // Number of past messages to send (Short-term memory size)
  furnaceConfig: FurnaceConfig;
  offlineConfig: OfflineConfig;
  scenarios?: Scenario[]; // New: List of theater scenarios
  
  memories: MemoryCard[]; // Long-term "Furnace" memories
  messages: Message[];
  
  // New features
  diaries: DiaryEntry[];
  isPinned?: boolean;
  unread?: number;
}

export interface AppSettings {
  apiUrl: string;
  apiKey: string;
  model: string;
  wallpaper: string;
  fullScreenMode: boolean; // New: Full screen toggler
  customFont?: string; // Font Name
  availableModels: string[];
  globalPersona: GlobalPersona;
}

export interface BackupData {
  version: number;
  type?: 'small_phone_backup'; // Signature for validation
  timestamp: number;
  settings: AppSettings;
  characters: Character[];
}

export enum AppRoute {
  HOME = 'HOME',
  WECHAT = 'WECHAT',
  SETTINGS = 'SETTINGS',
  DIARY = 'DIARY',
}

export enum WeChatTab {
  CHATS = 'CHATS',
  CONTACTS = 'CONTACTS',
  MOMENTS = 'MOMENTS',
  ME = 'ME',
}
