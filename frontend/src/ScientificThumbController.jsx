import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Activity, Zap, TrendingUp, Terminal, ChevronRight, RotateCcw } from 'lucide-react';

// API function to call your Python backend
const processCommand = async (command) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  
  try {
    const response = await fetch('http://localhost:5000/api/process-command', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ command }),
      signal: controller.signal
    });
    
    clearTimeout(timeout);
    
    if (!response.ok) {
      throw new Error(`Backend returned ${response.status}`);
    }
    
    const data = await response.json();
    
    return {
      success: true,
      angles: data,
      message: `Command processed: Moving to ${command} position`,
      confidence: 0.95
    };
  } catch (error) {
    clearTimeout(timeout);
    
    if (error.name === 'AbortError') {
      return {
        success: false,
        angles: null,
        message: 'Command timed out. Please try again.',
        confidence: 0
      };
    }
    
    console.error('Backend error:', error);
    return {
      success: false,
      angles: null,
      message: error.message.includes('fetch') 
        ? 'Backend offline. Please start Flask server on port 5000.' 
        : `Error: ${error.message}`,
      confidence: 0
    };
  }
};

const ScientificThumbController = () => {
  // Thumb segments configuration
  const segments = {
    metacarpal: { length: 50, width: 5 },
    proximal: { length: 30, width: 5 },
    distal: { length: 20, width: 5 }
  };

  // Initial angles for all 10 actuators
  const initialAngles = useMemo(() => ({
    CMC_flex: 0, CMC_ext: 0, CMC_abd: 0, CMC_add: 0, CMC_opp: 0, CMC_rep: 0,
    MCP_flex: 0, MCP_ext: 0, IP_flex: 0, IP_ext: 0
  }), []);

  // State management
  const [messages, setMessages] = useState([{
    id: 1,
    type: 'system',
    text: "Neural Language Interface initialized. Ready to accept natural language commands.",
    timestamp: new Date().toISOString()
  }]);
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [targetAngles, setTargetAngles] = useState(initialAngles);
  const [currentAngles, setCurrentAngles] = useState(initialAngles);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  
  // Refs
  const messagesEndRef = useRef(null);
  const animationFrameRef = useRef();
  const animationStartTimeRef = useRef();

  // Trial presets
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
      CMC_flex: 0, CMC_ext: 10, CMC_abd: 30, CMC_add: 0, CMC_opp: 0, CMC_rep: 0,
      MCP_flex: 0, MCP_ext: 15, IP_flex: 0, IP_ext: 0
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

  const trialButtons = ['Curl', 'Extend', 'Oppose', 'Reposition', 'Thumbs Up', 'Pinch', 'Rest'];

  // Function to fetch force values from backend (define this before any function that uses it)
  const fetchForceValues = useCallback(async (angles) => {
    try {
      const response = await fetch('http://localhost:5000/api/compute-forces', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ joint_angles: angles }),
      });
      if (!response.ok) {
        throw new Error(`Backend returned ${response.status}`);
      }
      const forces = await response.json();
      setActuatorForces(forces);
    } catch (error) {
      console.error('Error fetching force values:', error);
    }
  }, []);

  // Function to fetch voltage values from backend (define this before any function that uses it)
  const fetchVoltageValues = useCallback(async (angles) => {
    try {
      const response = await fetch('http://localhost:5000/api/compute-voltages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ joint_angles: angles }),
      });
      if (!response.ok) {
        throw new Error(`Backend returned ${response.status}`);
      }
      const voltages = await response.json();
      setActuatorVoltages(voltages);
    } catch (error) {
      console.error('Error fetching voltage values:', error);
    }
  }, []);

  // Stop animation helper
  const stopAnimation = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    setIsAnimating(false);
  }, []);

  // Process natural language command
  const processNaturalLanguage = async (command) => {
    const startTime = performance.now();
    const result = await processCommand(command);
    const endTime = performance.now();
    
    return result;
  };

  // Handle trial button clicks
  const handleTrial = useCallback((label) => {
    const preset = trialPresets[label];
    if (!preset) return;
    
    stopAnimation();
    
    setTimeout(() => {
      setTargetAngles({ ...preset });
      setIsAnimating(true);
      animationStartTimeRef.current = Date.now();
      fetchForceValues(preset);
      fetchVoltageValues(preset);
    }, 50);
    
    setMessages(prev => [
      ...prev.slice(-20),
      {
        id: Date.now(),
        type: 'assistant',
        text: `Trial visualization: ${label}`,
        angles: preset,
        timestamp: new Date().toISOString()
      }
    ]);
  }, [stopAnimation, fetchForceValues, fetchVoltageValues]);

  // Send message handler
  const sendMessage = useCallback(async () => {
    if (!inputText.trim() || isProcessing) return;

    const userMessage = {
      id: Date.now(),
      type: 'user',
      text: inputText,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev.slice(-20), userMessage]);
    setInputText('');
    setIsProcessing(true);

    try {
      const result = await processNaturalLanguage(inputText);
      
      const botMessage = {
        id: Date.now() + 1,
        type: 'assistant',
        text: result.message,
        angles: result.success ? result.angles : null,
        confidence: result.confidence,
        timestamp: new Date().toISOString()
      };

      setMessages(prev => [...prev.slice(-20), botMessage]);
      
      if (result.success && result.angles) {
        stopAnimation();
        setTimeout(() => {
          setTargetAngles(result.angles);
          setIsAnimating(true);
          animationStartTimeRef.current = Date.now();
          fetchForceValues(result.angles);
          fetchVoltageValues(result.angles);
        }, 50);
      }
    } catch (error) {
      console.error('Error processing command:', error);
      const errorMessage = {
        id: Date.now() + 1,
        type: 'assistant',
        text: 'Error processing command. Please try again.',
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev.slice(-20), errorMessage]);
    } finally {
      setIsProcessing(false);
    }
  }, [inputText, isProcessing, processNaturalLanguage, stopAnimation, fetchForceValues, fetchVoltageValues]);

  // Animation loop
  useEffect(() => {
    if (!isAnimating) return;
    
    let lastTime = performance.now();
    const animate = (currentTime) => {
      const deltaTime = currentTime - lastTime;
      lastTime = currentTime;
      
      const animationDuration = currentTime - (animationStartTimeRef.current || currentTime);
      if (animationDuration > 5000) {
        stopAnimation();
        setCurrentAngles({ ...targetAngles });
        return;
      }
      
      setCurrentAngles(prev => {
        const lerp = (start, end, factor) => start + (end - start) * factor;
        const factor = Math.min(0.15, deltaTime / 16);
        const newAngles = {};
        let maxDiff = 0;
        
        for (const key of Object.keys(initialAngles)) {
          const start = prev[key] || 0;
          const end = targetAngles[key] || 0;
          newAngles[key] = lerp(start, end, factor);
          maxDiff = Math.max(maxDiff, Math.abs(newAngles[key] - end));
        }
        
        if (maxDiff < 0.1) {
          stopAnimation();
          return { ...targetAngles };
        }
        
        return newAngles;
      });
      
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    
    animationFrameRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isAnimating, targetAngles, initialAngles, stopAnimation]);

  // Cleanup on unmount
  useEffect(() => {
    return () => stopAnimation();
  }, [stopAnimation]);

  // Auto-scroll messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Forward kinematics calculation
  const calculateForwardKinematics = (angles) => {
    const deg2rad = (deg) => deg * Math.PI / 180;
    
    const L1 = segments.metacarpal.length;
    const L2 = segments.proximal.length;
    const L3 = segments.distal.length;
    
    const base = { x: 200, y: 200, z: 0 };
    
    const net = {
      CMC_flex: (angles.CMC_flex || 0) - (angles.CMC_ext || 0),
      CMC_abd: (angles.CMC_abd || 0) - (angles.CMC_add || 0),
      CMC_opp: (angles.CMC_opp || 0) - (angles.CMC_rep || 0),
      MCP_flex: (angles.MCP_flex || 0) - (angles.MCP_ext || 0),
      IP_flex: (angles.IP_flex || 0) - (angles.IP_ext || 0)
    };
    
    const theta0 = deg2rad(-90 - net.CMC_flex);
    const phi0 = deg2rad(net.CMC_abd + net.CMC_opp);
    
    const mcp = {
      x: base.x + L1 * Math.cos(theta0) * Math.cos(phi0),
      y: base.y + L1 * Math.sin(theta0),
      z: base.z + L1 * Math.sin(phi0) * Math.cos(theta0),
      width: segments.metacarpal.width
    };
    
    const theta1 = theta0 - deg2rad(net.MCP_flex);
    const phi1 = phi0;
    
    const ip = {
      x: mcp.x + L2 * Math.cos(theta1) * Math.cos(phi1),
      y: mcp.y + L2 * Math.sin(theta1),
      z: mcp.z + L2 * Math.sin(phi1) * Math.cos(theta1),
      width: segments.proximal.width
    };
    
    const theta2 = theta1 - deg2rad(net.IP_flex);
    const phi2 = phi1;
    
    const tip = {
      x: ip.x + L3 * Math.cos(theta2) * Math.cos(phi2),
      y: ip.y + L3 * Math.sin(theta2),
      z: ip.z + L3 * Math.sin(phi2) * Math.cos(theta2),
      width: segments.distal.width
    };
    
    const project = (pt) => ({ 
      x: pt.x + 0.5 * pt.z, 
      y: pt.y - 0.3 * pt.z 
    });
    
    return { 
      base: project(base), 
      mcp: project(mcp), 
      ip: project(ip), 
      tip: project(tip) 
    };
  };

  // Thumb visualization component
  const ThumbVisualization = () => {
    const fk = calculateForwardKinematics(currentAngles);

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
          <marker id="arrowZ" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto" markerUnits="strokeWidth">
            <path d="M0,0 L8,4 L0,8 L2,4 Z" fill="#f472b6" />
          </marker>
        </defs>

        <rect width="400" height="350" fill="url(#gridGradient)" />
        <rect width="400" height="350" fill="url(#grid)" />

        <polygon
          points={`${fk.base.x},${fk.base.y} ${fk.base.x - 40},${fk.base.y + 30} ${fk.base.x + 40},${fk.base.y + 30}`}
          fill="#f472b6"
          opacity="0.08"
        />

        <line x1="50" y1="300" x2="350" y2="300" stroke="#475569" strokeWidth="1" strokeDasharray="2,2" />
        <line x1="50" y1="50" x2="50" y2="300" stroke="#475569" strokeWidth="1" strokeDasharray="2,2" />
        <text x="360" y="305" fill="#94a3b8" fontSize="10" fontFamily="monospace">X</text>
        <text x="45" y="40" fill="#94a3b8" fontSize="10" fontFamily="monospace">Y</text>

        <line
          x1={fk.base.x}
          y1={fk.base.y}
          x2={fk.base.x - 30}
          y2={fk.base.y + 30}
          stroke="#f472b6"
          strokeWidth="2"
          markerEnd="url(#arrowZ)"
        />
        <text x={fk.base.x - 35} y={fk.base.y + 35} fill="#f472b6" fontSize="12" fontFamily="monospace">Z</text>

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
        
        <circle cx={fk.base.x} cy={fk.base.y} r="6" fill="#f59e42" stroke="#fff7ed" strokeWidth="2" />
        <text x={fk.base.x + 8} y={fk.base.y - 8} fill="#fbbf24" fontSize="12" fontFamily="monospace">CMC</text>
        
        <circle cx={fk.mcp.x} cy={fk.mcp.y} r="6" fill="#10b981" stroke="#fff7ed" strokeWidth="2" />
        <text x={fk.mcp.x + 8} y={fk.mcp.y - 8} fill="#34d399" fontSize="12" fontFamily="monospace">MCP</text>
        
        <circle cx={fk.ip.x} cy={fk.ip.y} r="6" fill="#3b82f6" stroke="#fff7ed" strokeWidth="2" />
        <text x={fk.ip.x + 8} y={fk.ip.y - 8} fill="#60a5fa" fontSize="12" fontFamily="monospace">IP</text>
        
        <circle cx={fk.tip.x} cy={fk.tip.y} r="6" fill="#f43f5e" stroke="#fff7ed" strokeWidth="2" />
        <text x={fk.tip.x + 8} y={fk.tip.y - 8} fill="#f43f5e" fontSize="12" fontFamily="monospace">TIP</text>
      </svg>
    );
  };

  // Reset handler
  const handleReset = useCallback(async () => {
    setIsResetting(true);
    stopAnimation();
    
    setCurrentAngles({ ...initialAngles });
    setTargetAngles({ ...initialAngles });
    
    try {
      const result = await processCommand('reset');
      if (result.success && result.angles) {
        setTargetAngles(result.angles);
        setCurrentAngles(result.angles);
      }
    } catch (error) {
      console.error('Reset failed:', error);
    } finally {
      setIsResetting(false);
    }

    setMessages([{
      id: Date.now(),
      type: 'system',
      text: 'System reset. All joint angles returned to rest position.',
      timestamp: new Date().toISOString(),
    }]);
  }, [initialAngles, stopAnimation]);

  // Update force state to be dynamic
  const [actuatorForces, setActuatorForces] = useState({
    CMC_flex: 0, CMC_ext: 0, CMC_abd: 0, CMC_add: 0, CMC_opp: 0, CMC_rep: 0,
    MCP_flex: 0, MCP_ext: 0, IP_flex: 0, IP_ext: 0
  });

  // Add actuator voltages state for 8 actuators
  const [actuatorVoltages, setActuatorVoltages] = useState({
    cmc_flexor: 0, cmc_extensor: 0, cmc_adductor: 0, cmc_abductor: 0,
    mcp_flexor: 0, mcp_extensor: 0, ip_flexor: 0, ip_extensor: 0
  });

  // Update forces when current angles change
  useEffect(() => {
    if (isAnimating) {
      fetchForceValues(currentAngles);
    }
  }, [currentAngles, isAnimating, fetchForceValues]);

  // Update forces when target angles are set
  useEffect(() => {
    if (!isAnimating) {
      fetchForceValues(targetAngles);
    }
  }, [targetAngles, isAnimating, fetchForceValues]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 text-center">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
            Biomechatronic Thumb Control System
          </h1>
          <p className="text-slate-400">Neural Language Interface v2.0 | Real-time Kinematic Control</p>
        </div>
        
        <div className="flex flex-wrap justify-center gap-3 mb-4">
          {trialButtons.map(label => (
            <button
              key={label}
              onClick={() => handleTrial(label)}
              disabled={isProcessing || isAnimating}
              className={`px-4 py-2 rounded-lg text-sm font-semibold shadow-md transition-all duration-150
                bg-slate-800 hover:bg-cyan-600 text-cyan-300 hover:text-white
                disabled:opacity-60 disabled:cursor-not-allowed`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-1 bg-slate-900 rounded-lg border border-slate-800 flex flex-col h-[600px]">
            <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-4 rounded-t-lg border-b border-slate-800 flex justify-between items-center">
              <h2 className="text-lg font-semibold flex items-center gap-2 text-cyan-400">
                <Terminal size={20} />
                Command Terminal
              </h2>
              
              <button
                onClick={handleReset}
                disabled={isResetting || isAnimating}
                className={`flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white rounded-lg text-sm font-medium transition-all duration-200 ease-in-out transform hover:scale-105 active:scale-95 shadow-lg hover:shadow-red-500/20 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50 ${
                  isResetting ? 'opacity-75 cursor-not-allowed' : ''
                }`}
              >
                <RotateCcw size={16} className={isResetting ? 'animate-spin' : ''} />
                <span>{isResetting ? 'Resetting...' : 'Reset System'}</span>
              </button>
            </div>
            
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
                      {message.confidence !== undefined && (
                        <div className="text-slate-600 text-xs mt-1">
                          Confidence: {(message.confidence * 100).toFixed(1)}%
                        </div>
                      )}
                      {message.angles && (
                        <div className="mt-2 text-xs bg-slate-800 p-2 rounded border border-slate-700">
                          <div className="grid grid-cols-2 gap-1">
                            <div>CMC_FLEX: {message.angles.CMC_flex || 0}°</div>
                            <div>CMC_EXT: {message.angles.CMC_ext || 0}°</div>
                            <div>CMC_ABD: {message.angles.CMC_abd || 0}°</div>
                            <div>CMC_ADD: {message.angles.CMC_add || 0}°</div>
                            <div>CMC_OPP: {message.angles.CMC_opp || 0}°</div>
                            <div>CMC_REP: {message.angles.CMC_rep || 0}°</div>
                            <div>MCP_FLEX: {message.angles.MCP_flex || 0}°</div>
                            <div>MCP_EXT: {message.angles.MCP_ext || 0}°</div>
                            <div>IP_FLEX: {message.angles.IP_flex || 0}°</div>
                            <div>IP_EXT: {message.angles.IP_ext || 0}°</div>
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
          
          <div className="lg:col-span-2">
            <div className="bg-slate-900 rounded-lg border border-slate-800 p-4 mb-4">
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

            {/* Force Results Section */}
            <div className="bg-slate-900 rounded-lg border border-slate-800 p-4 mb-4">
              <h3 className="text-lg font-semibold text-purple-400 flex items-center gap-2 mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                </svg>
                Actuator Force Measurements
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {Object.entries(actuatorForces).map(([actuator, force]) => (
                  <div key={actuator} className="bg-slate-800 rounded-lg p-3 border border-slate-700 hover:border-purple-500 transition-colors duration-200">
                    <div className="text-xs text-slate-400 mb-1 font-mono">{actuator.replace('_', ' ')}</div>
                    <div className="flex items-end gap-1">
                      <span className="text-xl font-bold text-purple-400">{force.toFixed(1)}</span>
                      <span className="text-sm text-slate-500 mb-0.5">N</span>
                    </div>
                    <div className="mt-2 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-purple-500 to-purple-600 rounded-full"
                        style={{ width: `${(force / 3) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Voltage Results Section */}
            <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
              <h3 className="text-lg font-semibold text-cyan-400 flex items-center gap-2 mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
                </svg>
                Actuator Voltage Readings
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {Object.entries(actuatorVoltages).map(([actuator, voltage]) => (
                  <div key={actuator} className="bg-slate-800 rounded-lg p-3 border border-slate-700 hover:border-cyan-500 transition-colors duration-200">
                    <div className="text-xs text-slate-400 mb-1 font-mono">{actuator.replace('_', ' ')}</div>
                    <div className="flex items-end gap-1">
                      <span className="text-xl font-bold text-cyan-400">{voltage.toFixed(1)}</span>
                      <span className="text-sm text-slate-500 mb-0.5">V</span>
                    </div>
                    <div className="mt-2 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-cyan-500 to-cyan-600 rounded-full"
                        style={{ width: `${(voltage / 4) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScientificThumbController;