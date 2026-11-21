import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Platform } from 'react-native';

interface HardwareResult {
  source: string;
  type: string;
  pitch_hz: number | null;
  note: string | null;
  is_strained: boolean;
  timestamp: string;
}

interface HardwareContextType {
  isHardwareMode: boolean;
  setHardwareMode: (enabled: boolean) => void;
  lastResult: HardwareResult | null;
  isConnected: boolean;
  startIotScale: () => void;
}

const HardwareContext = createContext<HardwareContextType | undefined>(undefined);

export const HardwareProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isHardwareMode, setHardwareMode] = useState(false);
  const [lastResult, setLastResult] = useState<HardwareResult | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const ws = useRef<WebSocket | null>(null);

  // ⚠️ IMPORTANT: Change this to your computer's IP address (e.g. 192.168.1.15)
  // You found this by running 'ipconfig' earlier.
  const YOUR_COMPUTER_IP = '169.254.149.243'; // <--- CHANGE THIS LINE!

  const API_BASE_WS = Platform.OS === 'android' ? `ws://${YOUR_COMPUTER_IP}:8000` : `ws://${YOUR_COMPUTER_IP}:8000`;

  useEffect(() => {
    if (isHardwareMode) {
      console.log("🔗 Connecting to IoT Hardware Bridge...");
      // For the prototype, we use 'default_user'. Later this will be the real user ID.
      const socket = new WebSocket(`${API_BASE_WS}/ws/default_user`);

      socket.onopen = () => {
        setIsConnected(true);
        console.log("✅ WebSocket Connected to Bridge");
      };

      socket.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.source === 'hardware') {
            setLastResult(data);
          }
        } catch (err) {
          console.error("❌ WS Parse Error:", err);
        }
      };

      socket.onclose = () => {
        setIsConnected(false);
        console.log("🚫 WebSocket Disconnected");
      };

      socket.onerror = (e) => {
        console.error("⚠️ WebSocket Error:", e);
      };

      ws.current = socket;
    } else {
      if (ws.current) {
        ws.current.close();
        ws.current = null;
      }
      setIsConnected(false);
      setLastResult(null);
    }

    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [isHardwareMode]);

  const startIotScale = () => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ type: 'START_IOT_SCALE' }));
    } else {
      console.error("❌ Cannot start IoT Scale: WebSocket not connected");
    }
  };

  return (
    <HardwareContext.Provider value={{ isHardwareMode, setHardwareMode, lastResult, isConnected, startIotScale }}>
      {children}
    </HardwareContext.Provider>
  );
};

export const useHardware = () => {
  const context = useContext(HardwareContext);
  if (context === undefined) {
    throw new Error('useHardware must be used within a HardwareProvider');
  }
  return context;
};
