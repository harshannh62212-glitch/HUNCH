"""
CoppeliaSim Python Remote API Client for Coppeliabot
Requires: pip install coppeliasim-zmqremoteapi-client

Make sure CoppeliaSim is running and simulation is started before running this script.
"""

import time
import sys

try:
    from coppeliasim_zmqremoteapi_client import RemoteAPIClient
except ImportError:
    print("Error: coppeliasim-zmqremoteapi-client is not installed.")
    print("Install it using: pip install coppeliasim-zmqremoteapi-client")
    sys.exit(1)

def main():
    print("Connecting to CoppeliaSim ZeroMQ remote API...")
    client = RemoteAPIClient()
    sim = client.require('sim')
    
    print("Connected successfully!")
    
    # Retrieve handles
    try:
        left_motor = sim.getObject('/base_link/left_wheel_joint')
        right_motor = sim.getObject('/base_link/right_wheel_joint')
    except Exception as e:
        print(f"Could not find joint handles by path: {e}")
        # Fallback search by name
        left_motor = sim.getObject('./left_wheel_joint')
        right_motor = sim.getObject('./right_wheel_joint')

    print("Found motor joints. Sending demo motion commands...")
    
    # Demo sequence:
    # 1. Forward
    print("Moving forward...")
    sim.setJointTargetVelocity(left_motor, 6.0)
    sim.setJointTargetVelocity(right_motor, 6.0)
    time.sleep(3.0)
    
    # 2. Turn in place
    print("Spinning left...")
    sim.setJointTargetVelocity(left_motor, -4.0)
    sim.setJointTargetVelocity(right_motor, 4.0)
    time.sleep(2.0)
    
    # 3. Stop
    print("Stopping...")
    sim.setJointTargetVelocity(left_motor, 0.0)
    sim.setJointTargetVelocity(right_motor, 0.0)
    print("Done!")

if __name__ == "__main__":
    main()
