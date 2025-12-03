import React, { useState, useEffect, useRef } from 'react';
import { Character, AppSettings, Message } from '../../types';
import { generateChatCompletion, interpolatePrompt } from '../../services/aiService';

interface ChatInterfaceProps {
  character: Character;
  settings: AppSettings;
  onBack: () => void;
  onUpdateCharacter: (c: Character) => void;
  onAddMessage: (charId: string, msg: Message) => void;
  isGlobalGenerating: boolean;
  setGlobalGenerating: (b: boolean) => void;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({
  character,
  settings,
  onBack,
  onUpdateCharacter,
  onAddMessage,
  isGlobalGenerating,
  setGlobalGenerating,
}) => {
  const [inputText, setInputText] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [tempCharConfig, setTempCharConfig] = useState<Character>(character);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Sync temp config when character changes
  useEffect(() => {
    setTempCharConfig(character);
  }, [character]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [character.messages]);

  const handleSendMessage = async () => {
    if (!inputText.trim() || isGlobalGenerating) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputText,
      timestamp: Date.now(),
      mode: character.offlineConfig?.bgUrl ? 'offline' : 'online',
    };

    onAddMessage(character.id, userMsg);
    setInputText('');
    setGlobalGenerating(true);

    try {
      // Prepare conversation history
      const history = character.messages.slice(-character.historyCount).map(m => ({
        role: m.role === 'model' ? 'assistant' : m.role,
        content: m.content
      }));

      const conversation = [
        ...history,
        { role: 'user', content: userMsg.content }
      ];
      
      // Select appropriate system prompt based on mode
      // If background URL is set, assume offline/theater mode
      const isOfflineMode = !!character.offlineConfig?.bgUrl;
      
      const systemPromptTemplate = isOfflineMode 
        ? character.offlineConfig.systemPrompt 
        : character.systemPrompt;

      const systemPrompt = interpolatePrompt(systemPromptTemplate, { 
        ai_name: character.name, 
        user_mask_name: character.userMaskName, 
        personality: character.personality,
        style: character.offlineConfig.style, 
        word_count: character.offlineConfig.wordCount.toString() 
      });

      const messagesPayload = [
        { role: 'system', content: systemPrompt },
        ...conversation
      ];

      const responseContent = await generateChatCompletion(messagesPayload, settings);

      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        content: responseContent,
        timestamp: Date.now(),
        mode: userMsg.mode,
      };

      onAddMessage(character.id, aiMsg);

    } catch (error) {
      console.error("Chat Error", error);
      // In a real app, you'd probably add a system message indicating failure
    } finally {
      setGlobalGenerating(false);
    }
  };

  const handleSaveSettings = () => {
      onUpdateCharacter(tempCharConfig);
      setShowSettings(false);
  };

  const renderSettings = () => (
      <div className="absolute inset-0 bg-black/50 z-50 flex justify-end animate-fade-in" onClick={() => setShowSettings(false)}>
          <div className="w-3/4 max-w-sm bg-stone-900 h-full shadow-2xl overflow-y-auto text-white p-4" onClick={e => e.stopPropagation()}>
             <h2 className="text-xl font-bold mb-4 text-amber-500">聊天设置</h2>
             
             <div className="space-y-4">
                 {/* Basic Info */}
                 <div>
                     <label className="text-xs uppercase font-bold text-stone-500">备注名</label>
                     <input 
                         value={tempCharConfig.remark}
                         onChange={e => setTempCharConfig({...tempCharConfig, remark: e.target.value})}
                         className="w-full bg-stone-800 border-stone-700 rounded p-2 mt-1 focus:outline-none focus:border-amber-600"
                     />
                 </div>

                 {/* Offline/Theater Config */}
                 <div className="border-t border-stone-800 pt-4">
                     <h3 className="font-bold text-amber-500 mb-2">沉浸/剧场模式</h3>
                      
                       <div>
                           <label className="text-xs uppercase font-bold text-stone-500">文风设定</label>
                           <input 
                             value={tempCharConfig.offlineConfig.style}
                             onChange={e => setTempCharConfig({...tempCharConfig, offlineConfig: {...tempCharConfig.offlineConfig, style: e.target.value}})}
                             className="w-full bg-stone-800 border-stone-700 rounded p-2 mt-1 focus:outline-none focus:border-amber-600"
                           />
                       </div>
                       <div>
                           <label className="text-xs uppercase font-bold text-stone-500">回复字数限制</label>
                           <input 
                             type="number"
                             value={tempCharConfig.offlineConfig.wordCount}
                             onChange={e => setTempCharConfig({...tempCharConfig, offlineConfig: {...tempCharConfig.offlineConfig, wordCount: parseInt(e.target.value) || 150}})}
                             className="w-full bg-stone-800 border-stone-700 rounded p-2 mt-1 focus:outline-none focus:border-amber-600"
                             placeholder="150"
                           />
                       </div>
                       <div>
                           <label className="text-xs uppercase font-bold text-stone-500">场景壁纸 (URL)</label>
                           <input 
                             value={tempCharConfig.offlineConfig.bgUrl || ''}
                             onChange={e => setTempCharConfig({...tempCharConfig, offlineConfig: {...tempCharConfig.offlineConfig, bgUrl: e.target.value}})}
                             className="w-full bg-stone-800 border-stone-700 rounded p-2 mt-1 focus:outline-none focus:border-amber-600"
                             placeholder="留空即为普通微信模式"
                           />
                           <p className="text-[10px] text-stone-500 mt-1">设置背景图后将自动切换为剧场/线下模式界面</p>
                       </div>
                 </div>

                 <button onClick={handleSaveSettings} className="w-full py-3 bg-amber-600 hover:bg-amber-700 rounded-lg font-bold mt-4">
                     保存设置
                 </button>
             </div>
          </div>
      </div>
  );

  return (
    <div className="flex flex-col h-full bg-[#f5f5f5] relative">
      {/* Header */}
      <div className="flex items-center justify-between p-3 bg-[#ededed] border-b border-gray-300 shadow-sm z-10">
          <button onClick={onBack} className="text-gray-800 px-2">
              <i className="fas fa-chevron-left text-xl"></i>
          </button>
          <span className="font-bold text-lg">{character.remark}</span>
          <button onClick={() => setShowSettings(true)} className="text-gray-800 px-2">
              <i className="fas fa-ellipsis-h text-xl"></i>
          </button>
      </div>

      {/* Messages */}
      <div 
        className="flex-1 overflow-y-auto p-4 space-y-4"
        style={character.chatBackground ? { backgroundImage: `url(${character.chatBackground})`, backgroundSize: 'cover' } : {}}
      >
         {character.messages.map((msg, idx) => (
             <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                 {msg.role !== 'user' && (
                     <img src={character.avatar} className="w-10 h-10 rounded-lg mr-2 object-cover" />
                 )}
                 <div className={`max-w-[70%] p-3 rounded-lg text-sm leading-relaxed shadow-sm ${
                     msg.role === 'user' 
                     ? 'bg-[#95ec69] text-black' 
                     : 'bg-white text-black'
                 }`}>
                     {msg.content}
                 </div>
                 {msg.role === 'user' && (
                     <img src={character.userMaskAvatar || settings.globalPersona.avatar} className="w-10 h-10 rounded-lg ml-2 object-cover" />
                 )}
             </div>
         ))}
         <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-3 bg-[#f7f7f7] border-t border-gray-300 flex items-center gap-2">
          <button className="text-gray-600 p-2"><i className="far fa-smile text-2xl"></i></button>
          <input 
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
            className="flex-1 bg-white p-2 rounded-lg border border-gray-300 focus:outline-none focus:border-[#07c160]"
            placeholder={isGlobalGenerating ? "对方正在输入..." : "发消息..."}
            disabled={isGlobalGenerating}
          />
          {inputText.trim() ? (
              <button onClick={handleSendMessage} className="bg-[#07c160] text-white px-3 py-1.5 rounded-lg font-bold text-sm">
                  发送
              </button>
          ) : (
              <button className="text-gray-600 p-2"><i className="fas fa-plus-circle text-2xl"></i></button>
          )}
      </div>

      {showSettings && renderSettings()}
    </div>
  );
};

export default ChatInterface;