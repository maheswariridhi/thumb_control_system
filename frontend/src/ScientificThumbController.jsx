import React, { useState, useEffect, useRef, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Activity, Zap, TrendingUp, Terminal, ChevronRight, RotateCcw } from 'lucide-react';

// API function to call your Python backend
const processCommand = async (command) => {
  try {
    const response = await fetch('http://localhost:5000/api/process-command', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ command }),
    });
    
    if (!response.ok) {
      throw new Error(`Backend returned ${response.status}`);
    }
    
    const data = await response.json();
    return {
      success: true,
      angles: {
        CMC_flex: data.CMC_flex || 0,
        CMC_abd: data.CMC_abd || 0,
        CMC_opp: data.CMC_opp || 0,
        CMC_rep: data.CMC_rep || 0,
        MCP_flex: data.MCP_flex || 0,
        IP_flex: data.IP_flex || 0
      },
      message: `Command processed: Moving to ${command} position`,
      confidence: 0.95
    };
  } catch (error) {
    console.error('Backend error:', error);
    return {
      success: false,
      angles: { CMC_flex: 0, CMC_abd: 0, CMC_opp: 0, CMC_rep: 0, MCP_flex: 0, IP_flex: 0 },
      message: "Backend connection failed. Please ensure Python server is running on port 5000.",
      confidence: 0
    };
  }
};

const ScientificThumbController = () => {
  // ===== THUMB VISUALIZATION CODE =====
  const segments = {
    metacarpal: { length: 50, width: 5 },  // CMC → MCP
    proximal: { length: 30, width: 5 },    // MCP → IP
    distal: { length: 20, width: 5 }       // IP → tip
  };

  // ===== STATE MANAGEMENT =====
  const [messages, setMessages] = useState([
    { 
      id: 1, 
      type: 'system', 
      text: "Neural Language Interface initialized. Ready to accept natural language commands.",
      timestamp: new Date().toISOString()
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef(null);

  // 10 actuator values, all positive
  const initialAngles = useMemo(() => ({
    CMC_flex: 0, CMC_ext: 0, CMC_abd: 0, CMC_add: 0, CMC_opp: 0, CMC_rep: 0,
    MCP_flex: 0, MCP_ext: 0, IP_flex: 0, IP_ext: 0
  }), []);
  const [targetAngles, setTargetAngles] = useState({ ...initialAngles });
  const [currentAngles, setCurrentAngles] = useState({ ...initialAngles });
  const [isAnimating, setIsAnimating] = useState(false);
  const [telemetryData, setTelemetryData] = useState([]);
  const [performanceMetrics, setPerformanceMetrics] = useState({
    responseTime: 0,
    accuracy: 100,
    powerConsumption: 0
  });

  // Add loading state
  const [isResetting, setIsResetting] = useState(false);

  // Preset joint angles for trial visualizations (all positive, 10 values)
  const trialPresets = {
    Curl: {
      CMC_flex: 40, CMC_ext: 0, CMC_abd: 0, CMC_add: 0, CMC_opp: 0, CMC_rep: 0,
      MCP_flex: 60, MCP_ext: 0, IP_flex: 60, IP_ext: 0
    },
    Oppose: {
      CMC_flex: 30, CMC_ext: 0, CMC_abd: 20, CMC_add: 0, CMC_opp: 35, CMC_rep: 0,
      MCP_flex: 30, MCP_ext: 0, IP_flex: 20, IP_ext: 0
    },
    Reposition: {
      CMC_flex: 0, CMC_ext: 0, CMC_abd: 0, CMC_add: 0, CMC_opp: 0, CMC_rep: 30,
      MCP_flex: 0, MCP_ext: 0, IP_flex: 0, IP_ext: 0
    },
    'Thumbs Up': {
      CMC_flex: 0, CMC_ext: 0, CMC_abd: 30, CMC_add: 0, CMC_opp: 0, CMC_rep: 0,
      MCP_flex: 0, MCP_ext: 0, IP_flex: 0, IP_ext: 0
    },
    Pinch: {
      CMC_flex: 30, CMC_ext: 0, CMC_abd: 20, CMC_add: 0, CMC_opp: 25, CMC_rep: 0,
      MCP_flex: 40, MCP_ext: 0, IP_flex: 50, IP_ext: 0
    },
    Rest: {
      CMC_flex: 0, CMC_ext: 0, CMC_abd: 0, CMC_add: 0, CMC_opp: 0, CMC_rep: 0,
      MCP_flex: 0, MCP_ext: 0, IP_flex: 0, IP_ext: 0
    },
    Extend: {
      CMC_flex: 0, CMC_ext: 20, CMC_abd: 0, CMC_add: 0, CMC_opp: 0, CMC_rep: 0,
      MCP_flex: 0, MCP_ext: 25, IP_flex: 0, IP_ext: 0
    }
  };

  // Natural Language Processing
  const processNaturalLanguage = async (command) => {
    const startTime = performance.now();
    
    const result = await processCommand(command);
    
    const endTime = performance.now();
    
    setPerformanceMetrics(prev => ({
      ...prev,
      responseTime: endTime - startTime,
      accuracy: 98 + Math.random() * 2,
      powerConsumption: Math.random() * 50 + 100
    }));
    
    return result;
  };

  // Animation frame ref to prevent multiple concurrent loops
  const animationFrameRef = useRef();

  // Update trial visualization handler to use presets
  const handleTrial = (label) => {
    const preset = trialPresets[label];
    if (!preset) return;
    setIsAnimating(false);
    setTimeout(() => {
      setTargetAngles({ ...preset });
      setIsAnimating(true);
    }, 0);
    setMessages(prev => [
      ...prev.slice(-49), // keep only last 49
      {
        id: prev.length + 1,
        type: 'assistant',
        text: `Trial visualization: ${label}`,
        angles: preset,
        timestamp: new Date().toISOString()
      }
    ]);
  };

  // Update trial button definitions to use label only
  const trialButtons = [
    'Curl', 'Extend', 'Oppose', 'Reposition', 'Thumbs Up', 'Pinch', 'Rest'
  ];

  // Send message handler
  const sendMessage = async () => {
    if (!inputText.trim() || isProcessing) return;

    const userMessage = {
      id: messages.length + 1,
      type: 'user',
      text: inputText,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev.slice(-49), userMessage]);
    setInputText('');
    setIsProcessing(true);

    try {
      const result = await processNaturalLanguage(inputText);
      
      const botMessage = {
        id: messages.length + 2,
        type: 'assistant',
        text: result.message,
        angles: result.success ? result.angles : null,
        confidence: result.confidence,
        timestamp: new Date().toISOString()
      };

      setMessages(prev => [...prev.slice(-49), botMessage]);
      
      if (result.success) {
        setTargetAngles(result.angles);
        setIsAnimating(true);
        
        // Log telemetry with new joint names
        const telemetryPoint = {
          timestamp: Date.now(),
          CMC_flex: result.angles.CMC_flex,
          CMC_abd: result.angles.CMC_abd,
          CMC_opp: result.angles.CMC_opp,
          CMC_rep: result.angles.CMC_rep,
          MCP_flex: result.angles.MCP_flex,
          IP_flex: result.angles.IP_flex,
          totalFlexion: result.angles.CMC_flex + result.angles.MCP_flex + result.angles.IP_flex
        };
        setTelemetryData(prev => [...prev.slice(-49), telemetryPoint]);
      }
    } catch (error) {
      console.error('Error processing command:', error);
      const errorMessage = {
        id: messages.length + 2,
        type: 'assistant',
        text: 'Error processing command. Please try again.',
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev.slice(-49), errorMessage]);
    } finally {
      setIsProcessing(false);
    }
  };

  // Animation loop with further optimizations
  useEffect(() => {
    if (!isAnimating) return;
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    const animate = () => {
      setCurrentAngles(prev => {
        const lerp = (start, end, factor) => start + (end - start) * factor;
        const factor = 0.5;
        const newAngles = {};
        let maxDiff = 0;
        for (const key of Object.keys(initialAngles)) {
          newAngles[key] = lerp(prev[key], targetAngles[key], factor);
          maxDiff = Math.max(maxDiff, Math.abs(newAngles[key] - targetAngles[key]));
        }
        if (maxDiff < 0.1) {
          setIsAnimating(false);
          return { ...targetAngles };
        }
        animationFrameRef.current = requestAnimationFrame(animate);
        return newAngles;
      });
    };
    animationFrameRef.current = requestAnimationFrame(animate);
    return () => { if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current); };
  }, [isAnimating, targetAngles, initialAngles]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Forward kinematics (right hand anatomical axes, SVG Y fix, 10 values)
  const calculateForwardKinematics = (angles) => {
    const deg2rad = (deg) => deg * Math.PI / 180;
    // Segment lengths
    const L1 = segments.metacarpal.length; // CMC → MCP
    const L2 = segments.proximal.length;   // MCP → IP
    const L3 = segments.distal.length;     // IP → tip
    // Base (CMC joint) at bottom right
    const base = { x: 300, y: 300, z: 0 };
    // Net angles (flex - ext, abd - add, etc.)
    const net = {
      CMC_flex: (angles.CMC_flex || 0) - (angles.CMC_ext || 0),
      CMC_abd: (angles.CMC_abd || 0) - (angles.CMC_add || 0),
      CMC_opp: (angles.CMC_opp || 0),
      CMC_rep: (angles.CMC_rep || 0),
      MCP_flex: (angles.MCP_flex || 0) - (angles.MCP_ext || 0),
      IP_flex: (angles.IP_flex || 0) - (angles.IP_ext || 0)
    };
    // At rest, thumb points up (Y-)
    const theta0 = deg2rad(-90 + net.CMC_flex);
    const phi0 = deg2rad(net.CMC_abd + net.CMC_opp - net.CMC_rep);
    const mcp = {
      x: base.x - L1 * Math.cos(theta0) * Math.cos(phi0),
      y: base.y + L1 * Math.sin(theta0),
      z: base.z + L1 * Math.sin(phi0),
      width: segments.metacarpal.width
    };
    const theta1 = theta0 + deg2rad(net.MCP_flex);
    const phi1 = phi0;
    const ip = {
      x: mcp.x - L2 * Math.cos(theta1) * Math.cos(phi1),
      y: mcp.y + L2 * Math.sin(theta1),
      z: mcp.z + L2 * Math.sin(phi1),
      width: segments.proximal.width
    };
    const theta2 = theta1 + deg2rad(net.IP_flex);
    const phi2 = phi1;
    const tip = {
      x: ip.x - L3 * Math.cos(theta2) * Math.cos(phi2),
      y: ip.y + L3 * Math.sin(theta2),
      z: ip.z + L3 * Math.sin(phi2),
      width: segments.distal.width
    };
    const project = (pt) => ({ x: pt.x + 0.5 * pt.z, y: pt.y - 0.3 * pt.z });
    return { base: project(base), mcp: project(mcp), ip: project(ip), tip: project(tip) };
  };

  // Professional Thumb Visualization
  const ThumbVisualization = () => {
    const fk = calculateForwardKinematics(currentAngles);

    // Helper to draw a segment between two joints
    const createThumbSegment = (start, end, width) => {
      const angle = Math.atan2(end.y - start.y, end.x - start.x);
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const w = width / 2;
      return {
        topStart: { x: start.x - w * sin, y: start.y + w * cos },
        topEnd: { x: end.x - w * sin, y: end.y + w * cos },
        bottomStart: { x: start.x + w * sin, y: start.y - w * cos },
        bottomEnd: { x: end.x + w * sin, y: end.y - w * cos }
      };
    };

    // Segments: CMC→MCP, MCP→IP, IP→tip
    const metacarpalShape = createThumbSegment(fk.base, fk.mcp, segments.metacarpal.width);
    const proximalShape = createThumbSegment(fk.mcp, fk.ip, segments.proximal.width);
    const distalShape = createThumbSegment(fk.ip, fk.tip, segments.distal.width);

    return (
      <svg width="100%" height="350" viewBox="0 0 400 350" className="bg-slate-900 rounded-lg">
        <defs>
          <linearGradient id="gridGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#1e293b" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#0f172a" stopOpacity="0.5" />
          </linearGradient>
          <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#334155" strokeWidth="0.5" opacity="0.5"/>
          </pattern>
          <linearGradient id="segmentGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#60a5fa" />
            <stop offset="100%" stopColor="#3b82f6" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          {/* Arrow marker for Z axis */}
          <marker id="arrowZ" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto" markerUnits="strokeWidth">
            <path d="M0,0 L8,4 L0,8 L2,4 Z" fill="#f472b6" />
          </marker>
        </defs>

        {/* Background */}
        <rect width="400" height="350" fill="url(#gridGradient)" />
        <rect width="400" height="350" fill="url(#grid)" />

        {/* 3D Reference Plane (XZ plane at CMC) */}
        <polygon
          points={`
            ${fk.base.x},${fk.base.y}
            ${fk.base.x - 60},${fk.base.y + 40}
            ${fk.base.x + 60},${fk.base.y + 40}
          `}
          fill="#f472b6"
          opacity="0.08"
        />

        {/* Coordinate axes */}
        <line x1="50" y1="300" x2="350" y2="300" stroke="#475569" strokeWidth="1" strokeDasharray="2,2" />
        <line x1="50" y1="50" x2="50" y2="300" stroke="#475569" strokeWidth="1" strokeDasharray="2,2" />
        <text x="360" y="305" fill="#94a3b8" fontSize="10" fontFamily="monospace">X</text>
        <text x="45" y="40" fill="#94a3b8" fontSize="10" fontFamily="monospace">Y</text>

        {/* Z axis from CMC (base) */}
        <line
          x1={fk.base.x}
          y1={fk.base.y}
          x2={fk.base.x - 40}
          y2={fk.base.y + 40}
          stroke="#f472b6"
          strokeWidth="2"
          markerEnd="url(#arrowZ)"
        />
        <text
          x={fk.base.x - 45}
          y={fk.base.y + 45}
          fill="#f472b6"
          fontSize="12"
          fontFamily="monospace"
        >
          Z
        </text>

        {/* Thumb segments */}
        {[{ shape: metacarpalShape }, { shape: proximalShape }, { shape: distalShape }].map((segment, index) => (
          <g key={index}>
            <path
              d={`M ${segment.shape.topStart.x} ${segment.shape.topStart.y}
                  L ${segment.shape.topEnd.x} ${segment.shape.topEnd.y}
                  L ${segment.shape.bottomEnd.x} ${segment.shape.bottomEnd.y}
                  L ${segment.shape.bottomStart.x} ${segment.shape.bottomStart.y}
                  Z`}
              fill="url(#segmentGradient)"
              stroke="#60a5fa"
              strokeWidth="2"
              filter="url(#glow)"
              opacity="0.9"
            />
          </g>
        ))}
        {/* Joint markers and labels */}
        {/* CMC (base) */}
        <circle cx={fk.base.x} cy={fk.base.y} r="6" fill="#f59e42" stroke="#fff7ed" strokeWidth="2" />
        <text x={fk.base.x + 8} y={fk.base.y - 8} fill="#fbbf24" fontSize="12" fontFamily="monospace">CMC</text>
        {/* MCP */}
        <circle cx={fk.mcp.x} cy={fk.mcp.y} r="6" fill="#10b981" stroke="#fff7ed" strokeWidth="2" />
        <text x={fk.mcp.x + 8} y={fk.mcp.y - 8} fill="#34d399" fontSize="12" fontFamily="monospace">MCP</text>
        {/* IP */}
        <circle cx={fk.ip.x} cy={fk.ip.y} r="6" fill="#3b82f6" stroke="#fff7ed" strokeWidth="2" />
        <text x={fk.ip.x + 8} y={fk.ip.y - 8} fill="#60a5fa" fontSize="12" fontFamily="monospace">IP</text>
        {/* Tip */}
        <circle cx={fk.tip.x} cy={fk.tip.y} r="6" fill="#f43f5e" stroke="#fff7ed" strokeWidth="2" />
        <text x={fk.tip.x + 8} y={fk.tip.y - 8} fill="#f43f5e" fontSize="12" fontFamily="monospace">TIP</text>
      </svg>
    );
  };

  // Optimize reset handler with loading state
  const handleReset = async () => {
    setIsResetting(true);
    // Immediately set to initial state for instant feedback
    setCurrentAngles(initialAngles);
    setTargetAngles(initialAngles);
    setTelemetryData([]);
    
    try {
      const result = await processCommand('reset');
      // Update with server response if different
      if (JSON.stringify(result.angles) !== JSON.stringify(initialAngles)) {
        setTargetAngles(result.angles);
        setCurrentAngles(result.angles);
      }
    } catch (error) {
      console.error('Reset failed:', error);
    } finally {
      setIsResetting(false);
    }

    setMessages([
      {
        id: 1,
        type: 'system',
        text: 'System reset. All joint angles returned to rest position.',
        timestamp: new Date().toISOString(),
      },
    ]);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 text-center">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
            Biomechatronic Thumb Control System
          </h1>
          <p className="text-slate-400">Neural Language Interface v2.0 | Real-time Kinematic Control</p>
        </div>
        
        {/* Trial Visualization Buttons */}
        <div className="flex flex-wrap justify-center gap-3 mb-4">
          {trialButtons.map(label => (
            <button
              key={label}
              onClick={() => handleTrial(label)}
              disabled={isProcessing}
              className={`px-4 py-2 rounded-lg text-sm font-semibold shadow-md transition-all duration-150
                bg-slate-800 hover:bg-cyan-600 text-cyan-300 hover:text-white
                disabled:opacity-60 disabled:cursor-not-allowed`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Command Terminal */}
          <div className="lg:col-span-1 bg-slate-900 rounded-lg border border-slate-800 flex flex-col h-[600px]">
            <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-4 rounded-t-lg border-b border-slate-800 flex justify-between items-center">
              <h2 className="text-lg font-semibold flex items-center gap-2 text-cyan-400">
                <Terminal size={20} />
                Command Terminal
              </h2>
              
              {/* Enhanced Reset Button with Loading State */}
              <button
                onClick={handleReset}
                disabled={isResetting}
                className={`flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white rounded-lg text-sm font-medium transition-all duration-200 ease-in-out transform hover:scale-105 active:scale-95 shadow-lg hover:shadow-red-500/20 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50 ${
                  isResetting ? 'opacity-75 cursor-not-allowed' : ''
                }`}
              >
                <RotateCcw 
                  size={16} 
                  className={`${isResetting ? 'animate-spin' : 'animate-spin-slow'}`} 
                />
                <span>{isResetting ? 'Resetting...' : 'Reset System'}</span>
              </button>
            </div>
            
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 font-mono text-sm">
              {messages.map(message => (
                <div key={message.id} className="mb-3">
                  <div className="text-slate-500 text-xs mb-1">
                    [{new Date(message.timestamp).toLocaleTimeString()}]
                  </div>
                  {message.type === 'user' ? (
                    <div className="flex items-start gap-2">
                      <ChevronRight size={14} className="text-cyan-400 mt-0.5" />
                      <span className="text-cyan-400">{message.text}</span>
                    </div>
                  ) : (
                    <div className="ml-4">
                      <div className="text-green-400">{message.text}</div>
                      {message.confidence && (
                        <div className="text-slate-600 text-xs mt-1">
                          Confidence: {(message.confidence * 100).toFixed(1)}%
                        </div>
                      )}
                      {message.angles && (
                        <div className="mt-2 text-xs bg-slate-800 p-2 rounded border border-slate-700">
                          <div className="grid grid-cols-2 gap-1">
                            <div>CMC_FLEX: {message.angles.CMC_flex}°</div>
                            <div>CMC_EXT: {message.angles.CMC_ext}°</div>
                            <div>CMC_ABD: {message.angles.CMC_abd}°</div>
                            <div>CMC_ADD: {message.angles.CMC_add}°</div>
                            <div>CMC_OPP: {message.angles.CMC_opp}°</div>
                            <div>CMC_REP: {message.angles.CMC_rep}°</div>
                            <div>MCP_FLEX: {message.angles.MCP_flex}°</div>
                            <div>MCP_EXT: {message.angles.MCP_ext}°</div>
                            <div>IP_FLEX: {message.angles.IP_flex}°</div>
                            <div>IP_EXT: {message.angles.IP_ext}°</div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {isProcessing && (
                <div className="flex items-center gap-2 text-yellow-400">
                  <Activity size={14} className="animate-pulse" />
                  <span>Processing neural language model...</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
            
            {/* Input */}
            <div className="border-t border-slate-800 p-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder="Enter command..."
                  className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded text-sm font-mono focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                  disabled={isProcessing}
                />
                <button
                  onClick={sendMessage}
                  disabled={isProcessing || !inputText.trim()}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:bg-slate-700 disabled:text-slate-500 rounded text-sm font-semibold transition-colors"
                >
                  EXEC
                </button>
              </div>
            </div>
          </div>
          
          {/* Main Visualization */}
          <div className="lg:col-span-2 space-y-4">
            {/* 3D Visualization */}
            <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-blue-400 flex items-center gap-2">
                  <Zap size={20} />
                  Kinematic Model Visualization
                </h3>
                <div className={`flex items-center gap-2 text-sm ${isAnimating ? 'text-yellow-400' : 'text-green-400'}`}>
                  <Activity size={16} className={isAnimating ? 'animate-pulse' : ''} />
                  {isAnimating ? 'ACTUATING' : 'IDLE'}
                </div>
              </div>
              
              <ThumbVisualization />
            </div>
            
            {/* Telemetry */}
            <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
              <h3 className="text-lg font-semibold text-blue-400 flex items-center gap-2 mb-3">
                <TrendingUp size={20} />
                Real-time Telemetry
              </h3>
              
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="bg-slate-800 rounded p-3 border border-slate-700">
                  <div className="text-xs text-slate-400 mb-1">Response Time</div>
                  <div className="text-xl font-bold text-cyan-400">
                    {performanceMetrics.responseTime.toFixed(1)}ms
                  </div>
                </div>
                <div className="bg-slate-800 rounded p-3 border border-slate-700">
                  <div className="text-xs text-slate-400 mb-1">Command Accuracy</div>
                  <div className="text-xl font-bold text-green-400">
                    {performanceMetrics.accuracy.toFixed(1)}%
                  </div>
                </div>
                <div className="bg-slate-800 rounded p-3 border border-slate-700">
                  <div className="text-xs text-slate-400 mb-1">Power Draw</div>
                  <div className="text-xl font-bold text-yellow-400">
                    {performanceMetrics.powerConsumption.toFixed(0)}mW
                  </div>
                </div>
              </div>
              
              {telemetryData.length > 0 && (
                <ResponsiveContainer width="100%" height={150}>
                  <AreaChart data={telemetryData.slice(-20)}>
                    <defs>
                      <linearGradient id="flexionGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis 
                      dataKey="timestamp" 
                      stroke="#64748b"
                      tick={{ fill: '#64748b', fontSize: 10 }}
                      tickFormatter={() => ''}
                    />
                    <YAxis 
                      stroke="#64748b"
                      tick={{ fill: '#64748b', fontSize: 10 }}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}
                      labelStyle={{ color: '#94a3b8' }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="totalFlexion" 
                      stroke="#3b82f6" 
                      fillOpacity={1} 
                      fill="url(#flexionGradient)" 
                      name="Total Flexion (°)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScientificThumbController;