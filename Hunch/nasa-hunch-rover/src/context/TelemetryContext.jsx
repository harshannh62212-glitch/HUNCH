import React, { createContext, useContext, useState, useEffect } from 'react';

const TelemetryContext = createContext(null);

export function TelemetryProvider({ children }) {
  const [isRunning, setIsRunning] = useState(true);
  const [missionTime, setMissionTime] = useState(14820); // seconds (04:07:00 MET)
  const [hazardInjected, setHazardInjected] = useState(false);
  const [activeMode, setActiveMode] = useState("AUTONOMOUS_CRAWL"); // AUTONOMOUS_CRAWL, HAZARD_AVOIDANCE, STATIONARY_SOLAR

  const [telemetry, setTelemetry] = useState({
    // Power Subsystem
    batteryVoltage: 13.24,
    batterySOC: 87.4,
    batteryCurrent: 2.85, // Amperes
    batteryPower: 37.7, // Watts
    solarVoltage: 18.6, // Volts
    solarCurrent: 1.05, // Amperes
    solarPower: 19.53, // Watts (close to 20W max)
    mpptEfficiency: 96.8, // %
    railA5V: 5.03, // Volts (Isolated Logic)
    railB5V: 4.98, // Volts (Isolated Sensors)
    
    // LiDAR Array (Benewake TF-Luna ToF)
    lidarLeft: { distance: 2.84, amp: 890, angle: 35, status: "CLEAR" },
    lidarCenter: { distance: 3.42, amp: 940, angle: 0, status: "CLEAR" },
    lidarRight: { distance: 1.95, amp: 820, angle: -35, status: "CLEAR" },
    minObstacleDist: 1.95,
    collisionAlert: false,

    // Kinematics & Attitude
    heading: 142.6,
    pitch: 2.1,
    roll: -1.4,
    speed: 0.38, // m/s
    motorLeftRpm: 92,
    motorRightRpm: 94,
    motorDriverTemp: 41.2, // Celsius
    motorCurrentAggregate: 2.4, // Amps

    // Avionics & Comms
    watchdogHeartbeat: 49204,
    mcuTemp: 34.5,
    wifiRssi: -58, // dBm
    loopLatencyMs: 11.8,
    statusFlags: {
      avionics: "NOMINAL",
      drivetrain: "NOMINAL",
      power: "NOMINAL",
      sensors: "NOMINAL",
      failSafeWatchdog: "ACTIVE"
    }
  });

  // Ticker for live telemetry
  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      setMissionTime(prev => prev + 1);

      setTelemetry(prev => {
        // Subtle natural drift
        const vDrift = (Math.random() - 0.5) * 0.02;
        const currentDrift = (Math.random() - 0.5) * 0.15;
        const solarDrift = (Math.random() - 0.5) * 0.3;
        
        let newLidarLeft, newLidarCenter, newLidarRight, collision;
        let mode = activeMode;

        if (hazardInjected) {
          // Obstacle right in front of center sensor (< 0.45m)
          newLidarCenter = { distance: 0.38, amp: 1450, angle: 0, status: "CRITICAL_HAZARD" };
          newLidarLeft = { distance: 0.82, amp: 1100, angle: 35, status: "PROXIMITY_WARN" };
          newLidarRight = { distance: 2.45, amp: 780, angle: -35, status: "CLEAR" };
          collision = true;
          mode = "HAZARD_AVOIDANCE";
        } else {
          // Normal autonomous crawl drifting
          const distDriftC = (Math.sin(Date.now() / 3000) * 1.2 + 2.5);
          const distDriftL = (Math.sin(Date.now() / 2500 + 1) * 1.5 + 2.8);
          const distDriftR = (Math.cos(Date.now() / 2800) * 1.4 + 2.6);

          const centerDist = Math.max(0.6, parseFloat(distDriftC.toFixed(2)));
          const leftDist = Math.max(0.7, parseFloat(distDriftL.toFixed(2)));
          const rightDist = Math.max(0.65, parseFloat(distDriftR.toFixed(2)));
          newLidarCenter = {
            distance: centerDist,
            amp: Math.floor(850 + Math.random() * 100),
            angle: 0,
            status: centerDist < 0.8 ? "PROXIMITY_WARN" : "CLEAR"
          };
          newLidarLeft = {
            distance: leftDist,
            amp: Math.floor(820 + Math.random() * 90),
            angle: 35,
            status: leftDist < 0.8 ? "PROXIMITY_WARN" : "CLEAR"
          };
          newLidarRight = {
            distance: rightDist,
            amp: Math.floor(840 + Math.random() * 110),
            angle: -35,
            status: rightDist < 0.8 ? "PROXIMITY_WARN" : "CLEAR"
          };
          collision = false;
        }

        const minDistance = Math.min(newLidarLeft.distance, newLidarCenter.distance, newLidarRight.distance);

        const newHeading = (prev.heading + (hazardInjected ? 2.4 : 0.2)) % 360;
        const newPitch = parseFloat((2.0 + Math.sin(Date.now() / 4000) * 1.8).toFixed(1));
        const newRoll = parseFloat((-1.0 + Math.cos(Date.now() / 3500) * 1.2).toFixed(1));

        const batteryVoltage = parseFloat(Math.max(12.8, Math.min(13.4, prev.batteryVoltage + vDrift)).toFixed(2));
        const batteryCurrent = parseFloat(Math.max(1.8, Math.min(4.5, (hazardInjected ? 1.2 : 2.85) + currentDrift)).toFixed(2));
        const solarPower = parseFloat(Math.max(16.5, Math.min(20.2, 19.2 + solarDrift)).toFixed(2));
        const solarVoltage = parseFloat((18.6 + (Math.random() - 0.5) * 0.2).toFixed(2));

        return {
          ...prev,
          batteryVoltage,
          batteryCurrent,
          batteryPower: parseFloat((batteryVoltage * batteryCurrent).toFixed(1)),
          solarPower,
          solarVoltage,
          solarCurrent: parseFloat((solarPower / solarVoltage).toFixed(2)),
          
          lidarLeft: newLidarLeft,
          lidarCenter: newLidarCenter,
          lidarRight: newLidarRight,
          minObstacleDist: minDistance,
          collisionAlert: collision,

          heading: parseFloat(newHeading.toFixed(1)),
          pitch: newPitch,
          roll: newRoll,
          speed: hazardInjected ? 0.0 : 0.38,
          motorLeftRpm: hazardInjected ? 15 : Math.floor(92 + (Math.random() - 0.5) * 6),
          motorRightRpm: hazardInjected ? 45 : Math.floor(93 + (Math.random() - 0.5) * 6),
          motorDriverTemp: parseFloat((41.0 + Math.sin(Date.now() / 15000) * 2.5).toFixed(1)),
          
          watchdogHeartbeat: prev.watchdogHeartbeat + 1,
          loopLatencyMs: parseFloat((11.5 + (Math.random() - 0.5) * 1.2).toFixed(1)),
          
          statusFlags: {
            avionics: "NOMINAL",
            drivetrain: hazardInjected ? "AVOIDANCE_VECTOR" : "NOMINAL",
            power: "NOMINAL",
            sensors: collision ? "COLLISION_HALT" : "NOMINAL",
            failSafeWatchdog: "ACTIVE"
          }
        };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, hazardInjected, activeMode]);

  // Format mission elapsed time to HH:MM:SS
  const formatMET = (totalSecs) => {
    const hours = Math.floor(totalSecs / 3600).toString().padStart(2, '0');
    const minutes = Math.floor((totalSecs % 3600) / 60).toString().padStart(2, '0');
    const seconds = (totalSecs % 60).toString().padStart(2, '0');
    return `T+${hours}:${minutes}:${seconds}`;
  };

  const toggleHazard = () => {
    setHazardInjected(prev => !prev);
  };

  return (
    <TelemetryContext.Provider value={{
      telemetry,
      isRunning,
      setIsRunning,
      missionTime,
      formatMET,
      hazardInjected,
      toggleHazard,
      activeMode,
      setActiveMode
    }}>
      {children}
    </TelemetryContext.Provider>
  );
}

export function useTelemetry() {
  const context = useContext(TelemetryContext);
  if (!context) {
    throw new Error("useTelemetry must be used within a TelemetryProvider");
  }
  return context;
}
