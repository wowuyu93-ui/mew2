
import React, { useState, useEffect } from 'react';
import { AppSettings, Character, BackupData, FurnaceConfig, OfflineConfig } from '../types';
import { fetchModels } from '../services/aiService';
import { DEFAULT_SYSTEM_PROMPT, DEFAULT_OS_PROMPT, DEFAULT_OFFLINE_PROMPT } from '../constants';

interface SettingsProps {
  settings: AppSettings;
  updateSettings: (newSettings: AppSettings) => void;
  characters: Character[];
  onUpdateCharacters: (chars: Character[]) => void;
  onClose: () => void;
}

// Default configs for backward compatibility (Sanitization)
const DEFAULT_FURNACE_CONFIG: FurnaceConfig = {
    autoEnabled: false,
    autoThreshold: 20,
    autoScope: 30,
    manualScope: 30
};

const DEFAULT_OFFLINE_CONFIG: OfflineConfig = {
    systemPrompt: DEFAULT_OFFLINE_PROMPT,
    style: '细腻、沉浸、小说感',
    wordCount: 150,
    bgUrl: '',
    indicatorColor: '#f59e0b'
};

const SettingsApp: React.FC<SettingsProps> = ({ settings, updateSettings, characters, onUpdateCharacters, onClose }) => {
  const [localSettings, setLocalSettings] = useState<AppSettings>(settings);
  const [loadingModels, setLoadingModels] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  
  // Backup Logic State
  const [importMsg, setImportMsg] = useState('');
  const [pendingImport, setPendingImport] = useState<BackupData | null>(null); // Store data waiting for confirmation

  // Sync prop changes if they happen externally
  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const handleFetchModels = async () => {
    if (!localSettings.apiKey) {
        alert("请先填写 API Key");
        return;
    }
    setLoadingModels(true);
    const models = await fetchModels(localSettings);
    setLocalSettings({ ...localSettings, availableModels: models });
    setLoadingModels(false);
  };

  const handleSave = () => {
    updateSettings(localSettings);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleWallpaperUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
            setLocalSettings({ ...localSettings, wallpaper: event.target.result as string });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFontUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        const fontUrl = event.target?.result as string;
        // Create a dynamic font face
        const newStyle = document.createElement('style');
        newStyle.appendChild(document.createTextNode(`
          @font-face {
            font-family: 'CustomUserFont';
            src: url('${fontUrl}');
          }
        `));
        document.head.appendChild(newStyle);
        setLocalSettings({ ...localSettings, customFont: 'CustomUserFont' });
      };
      reader.readAsDataURL(file);
    }
  };

  // --- Backup Logic ---

  const handleExportBackup = () => {
      try {
        // Create backup object
        const backupData: BackupData = {
            version: 1,
            type: 'small_phone_backup',
            timestamp: Date.now(),
            settings: settings,
            // Process characters to limit messages safely, including isolated scenarios
            characters: characters.map(c => ({
                ...c,
                messages: Array.isArray(c.messages) ? c.messages.slice(-50) : [],
                scenarios: c.scenarios?.map(s => ({
                    ...s,
                    // If it's isolated, it has its own messages array that needs slicing
                    messages: s.messages ? s.messages.slice(-50) : []
                }))
            }))
        };

        const dataStr = JSON.stringify(backupData, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        // Trigger download
        const a = document.createElement('a');
        a.href = url;
        a.download = `SmallPhone_Backup_${new Date().toISOString().slice(0,10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        setImportMsg("✅ 导出成功");
        setTimeout(() => setImportMsg(""), 3000);
      } catch (e) {
          console.error(e);
          alert("导出失败，请检查控制台");
      }
  };

  const handleImportFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      const input = e.target;
      const file = input.files?.[0];
      if (!file) return;

      // Reset immediately to allow re-selection
      input.value = '';
      setImportMsg("⏳ 正在解析...");
      setPendingImport(null);

      const reader = new FileReader();
      
      reader.onload = (event) => {
          try {
              const json = event.target?.result as string;
              if (!json) throw new Error("文件内容为空");

              let data;
              try {
                  data = JSON.parse(json);
              } catch (parseError) {
                  throw new Error("文件不是有效的 JSON 格式");
              }

              if (!data || typeof data !== 'object') throw new Error("无效的数据结构");

              // Relaxed check: Accept if either settings OR characters exist
              if (!data.settings && !data.characters) {
                  throw new Error("未找到有效的小手机备份数据 (缺少 settings/characters)");
              }

              // Construct a valid BackupData object for the modal
              const validBackup: BackupData = {
                  version: data.version || 1,
                  type: 'small_phone_backup',
                  timestamp: data.timestamp || Date.now(),
                  settings: data.settings || settings,
                  characters: Array.isArray(data.characters) ? data.characters : []
              };

              // Open Confirmation Modal
              setPendingImport(validBackup);
              setImportMsg("❓ 等待确认...");

          } catch (err: any) {
              console.error("Import Parse Error:", err);
              setImportMsg(`❌ ${err.message}`);
              alert(`导入失败: ${err.message}`);
          }
      };
      
      reader.onerror = () => {
          setImportMsg("❌ 文件读取失败");
          alert("无法读取该文件");
      };

      reader.readAsText(file);
  };

  const confirmImport = () => {
      if (!pendingImport) return;

      try {
          // 1. Apply Settings
          if (pendingImport.settings) {
              updateSettings(pendingImport.settings);
              setLocalSettings(pendingImport.settings);
          }

          // 2. Apply Characters (With Sanitization/Migration)
          if (pendingImport.characters && Array.isArray(pendingImport.characters)) {
              const sanitizedChars = pendingImport.characters.map((c: any) => ({
                  ...c,
                  // Ensure mandatory fields exist for older backups
                  furnaceConfig: { ...DEFAULT_FURNACE_CONFIG, ...(c.furnaceConfig || {}) },
                  offlineConfig: { ...DEFAULT_OFFLINE_CONFIG, ...(c.offlineConfig || {}) },
                  scenarios: Array.isArray(c.scenarios) ? c.scenarios : [],
                  diaries: Array.isArray(c.diaries) ? c.diaries : [],
                  memories: Array.isArray(c.memories) ? c.memories : [],
                  messages: Array.isArray(c.messages) ? c.messages : [],
                  useLocalPersona: c.useLocalPersona ?? false,
                  realTimeMode: c.realTimeMode ?? false,
                  showOS: c.showOS ?? false
              }));
              onUpdateCharacters(sanitizedChars);
          }

          setImportMsg(`✅ 导入成功 (${new Date().toLocaleTimeString()})`);
          setPendingImport(null); // Close modal
          
          // alert("✅ 备份导入成功！配置已更新。");
      } catch (e: any) {
          console.error("Apply Import Error", e);
          setImportMsg("❌ 应用数据失败");
          alert("虽然文件解析成功，但在应用数据时出错。");
      }
  };

  const cancelImport = () => {
      setPendingImport(null);
      setImportMsg("🚫 操作已取消");
  };

  const handleFactoryReset = () => {
      if (window.confirm("【警告】此操作将永久删除所有数据，包括：\n- 所有角色和聊天记录\n- 所有设置和API Key\n- 所有日记和记忆\n\n确定要恢复出厂设置吗？")) {
          localStorage.removeItem('small_phone_settings');
          localStorage.removeItem('small_phone_chars');
          window.location.reload();
      }
  };

  return (
    <div className="h-full bg-gray-100 flex flex-col text-black overflow-y-auto relative">
      <div className="bg-white p-4 shadow flex items-center sticky top-0 z-10 justify-between">
        <div className="flex items-center">
            <button onClick={onClose} className="mr-4 text-gray-600 active:text-gray-900">
            <i className="fas fa-arrow-left text-xl"></i>
            </button>
            <h1 className="text-xl font-bold">系统设置</h1>
        </div>
      </div>

      <div className="p-4 space-y-6 pb-24 animate-fade-in">
        {/* Full Screen Mode */}
        <div className="bg-white p-4 rounded-xl shadow-sm flex items-center justify-between">
             <div>
                <h2 className="font-bold text-gray-700">全屏沉浸模式</h2>
                <p className="text-xs text-gray-400">移除手机边框，铺满整个浏览器窗口</p>
             </div>
             <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" checked={localSettings.fullScreenMode} 
                    onChange={(e) => setLocalSettings({...localSettings, fullScreenMode: e.target.checked})}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
             </label>
        </div>

        {/* Backup & Restore */}
        <div className="bg-white p-4 rounded-xl shadow-sm">
            <h2 className="font-bold mb-4 text-gray-700 border-l-4 border-amber-500 pl-2">数据备份与恢复</h2>
            
            {/* Status Message Area */}
            {importMsg && (
                <div className={`mb-3 p-2 rounded text-xs font-bold text-center ${importMsg.includes('❌') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>
                    {importMsg}
                </div>
            )}

            <div className="flex gap-4">
                <button 
                    onClick={handleExportBackup}
                    className="flex-1 py-3 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg font-bold flex flex-col items-center justify-center gap-1 active:bg-amber-100 transition"
                >
                    <i className="fas fa-file-export text-xl"></i>
                    <span className="text-xs">导出备份 (JSON)</span>
                </button>
                <div className="flex-1 relative">
                    <input 
                        type="file" 
                        accept="*" 
                        onChange={handleImportFileSelect}
                        className="absolute inset-0 opacity-0 cursor-pointer z-10 w-full h-full"
                    />
                    <button 
                        className="w-full h-full py-3 bg-gray-50 border border-gray-200 text-gray-700 rounded-lg font-bold flex flex-col items-center justify-center gap-1 hover:bg-gray-100 transition"
                    >
                        <i className="fas fa-file-import text-xl"></i>
                        <span className="text-xs">导入备份</span>
                    </button>
                </div>
            </div>
            <p className="text-[10px] text-gray-400 mt-2 text-center">
                * 导出包含设置、人设、日记、熔炉记忆及所有剧场设定。<br/>
                * 每个角色及剧场仅保留最近50条聊天记录。
            </p>
        </div>

        {/* API Settings */}
        <div className="bg-white p-4 rounded-xl shadow-sm">
          <h2 className="font-bold mb-4 text-gray-700 border-l-4 border-blue-500 pl-2">大模型连接</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-gray-500 uppercase font-bold">API 地址 (Base URL)</label>
              <input 
                type="text" 
                value={localSettings.apiUrl}
                onChange={(e) => setLocalSettings({...localSettings, apiUrl: e.target.value})}
                placeholder="例如: https://api.openai.com/v1"
                className="w-full border-b border-gray-300 py-2 focus:outline-none focus:border-blue-500 transition"
              />
            </div>
            
            <div>
              <label className="block text-xs text-gray-500 uppercase font-bold">API Key</label>
              <input 
                type="password" 
                value={localSettings.apiKey}
                onChange={(e) => setLocalSettings({...localSettings, apiKey: e.target.value})}
                placeholder="sk-..."
                className="w-full border-b border-gray-300 py-2 focus:outline-none focus:border-blue-500 transition"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                 <label className="block text-xs text-gray-500 uppercase font-bold">模型选择</label>
                 <button onClick={handleFetchModels} disabled={loadingModels} className="text-xs text-blue-500">
                    {loadingModels ? '获取中...' : '刷新列表'}
                 </button>
              </div>
              <div className="relative">
                <select 
                    value={localSettings.model}
                    onChange={(e) => setLocalSettings({...localSettings, model: e.target.value})}
                    className="w-full border-b border-gray-300 py-2 bg-transparent appearance-none focus:outline-none focus:border-blue-500"
                >
                    {localSettings.availableModels.map(m => (
                        <option key={m} value={m}>{m}</option>
                    ))}
                    <option value="gpt-4o">gpt-4o</option>
                    <option value="gpt-3.5-turbo">gpt-3.5-turbo</option>
                    <option value="gemini-2.0-flash">gemini-2.0-flash</option>
                </select>
                <i className="fas fa-chevron-down absolute right-2 top-3 text-gray-400 pointer-events-none"></i>
              </div>
            </div>
          </div>
        </div>

        {/* Appearance Settings */}
        <div className="bg-white p-4 rounded-xl shadow-sm">
          <h2 className="font-bold mb-4 text-gray-700 border-l-4 border-purple-500 pl-2">个性化</h2>
          
          <div className="space-y-4">
            <div>
                <label className="block text-xs text-gray-500 uppercase font-bold mb-2">主屏幕壁纸</label>
                <div className="flex items-center gap-4">
                    <div className="w-16 h-24 bg-gray-200 rounded overflow-hidden shadow-sm">
                        <img src={localSettings.wallpaper} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1">
                        <input 
                            type="file" 
                            accept="image/*" 
                            onChange={handleWallpaperUpload}
                            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
                        />
                    </div>
                </div>
            </div>

            <div>
                <label className="block text-xs text-gray-500 uppercase font-bold mb-2">全局字体 (TTF)</label>
                <div className="flex items-center gap-4">
                    <div className="flex-1">
                        <input 
                            type="file" 
                            accept="*" 
                            onChange={handleFontUpload}
                            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
                        />
                        <p className="text-[10px] text-gray-400 mt-1">当前: {localSettings.customFont || '系统默认'}</p>
                    </div>
                </div>
            </div>
          </div>
        </div>
        
        {/* Factory Reset */}
        <div className="bg-red-50 p-4 rounded-xl shadow-sm border border-red-100 mt-8">
            <h2 className="font-bold mb-2 text-red-700 flex items-center gap-2">
                <i className="fas fa-radiation"></i> 危险操作
            </h2>
            <p className="text-xs text-red-500 mb-4">
                这将删除所有数据（角色、聊天记录、日记、设置）并重置为初始状态。此操作不可撤销。
            </p>
            <button 
                onClick={handleFactoryReset}
                className="w-full py-3 bg-red-600 text-white rounded-lg font-bold shadow-lg hover:bg-red-700 active:scale-95 transition"
            >
                恢复出厂设置
            </button>
        </div>

      </div>

      {/* Save Button */}
      <div className="bg-white p-4 border-t border-gray-200 sticky bottom-0 z-20">
          <button 
            onClick={handleSave}
            className={`w-full py-3 rounded-xl font-bold text-white shadow-lg transition-all ${isSaved ? 'bg-green-500 scale-95' : 'bg-blue-600 hover:bg-blue-700 active:scale-95'}`}
          >
              {isSaved ? <span className="flex items-center justify-center gap-2"><i className="fas fa-check"></i> 已保存配置</span> : '保存配置'}
          </button>
      </div>

      {/* Custom Import Confirmation Modal */}
      {pendingImport && (
          <div className="absolute inset-0 z-50 bg-black/50 flex items-center justify-center p-6">
              <div className="bg-white w-full rounded-2xl p-6 shadow-2xl animate-fade-in">
                  <div className="flex flex-col items-center mb-4 text-center">
                      <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-3xl mb-4">
                          <i className="fas fa-file-import"></i>
                      </div>
                      <h3 className="text-xl font-bold text-gray-900">发现备份数据</h3>
                      <p className="text-sm text-gray-500 mt-2">
                          备份时间: <span className="font-medium text-gray-800">{new Date(pendingImport.timestamp).toLocaleString()}</span>
                      </p>
                      <p className="text-sm text-gray-500">
                          包含角色: <span className="font-medium text-gray-800">{pendingImport.characters?.length || 0} 个</span>
                      </p>
                  </div>
                  
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-6">
                      <p className="text-xs text-amber-800 font-bold flex items-center gap-2">
                          <i className="fas fa-exclamation-triangle"></i> 警告
                      </p>
                      <p className="text-xs text-amber-700 mt-1">
                          导入操作将<span className="font-bold underline">完全覆盖</span>当前的所有数据（包括聊天记录、设置、角色等）。此操作无法撤销。
                      </p>
                  </div>

                  <div className="flex gap-3">
                      <button 
                        onClick={cancelImport}
                        className="flex-1 py-3 border border-gray-300 text-gray-600 font-bold rounded-xl hover:bg-gray-50 transition"
                      >
                          取消
                      </button>
                      <button 
                        onClick={confirmImport}
                        className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg hover:bg-blue-700 transition"
                      >
                          确认覆盖导入
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default SettingsApp;
