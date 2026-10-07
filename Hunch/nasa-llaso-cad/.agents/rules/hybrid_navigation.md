---
name: hybrid-navigation-smoothness
description: "Prevents rovers from stopping, jerking, or orbiting intermediate waypoints during hybrid LLM navigation."
trigger: "always_on"
---

# Hybrid Waypoint Blending

When building hybrid navigation (LLM + Local Planner):

1. **Never treat intermediate local waypoints as hard stops.** Calculate speed conservation using the *final global goal*, not the intermediate waypoint, so the rover maintains momentum through openings.
2. **Never attempt to drive perfectly over a local waypoint.** Automatically clear local waypoints if they are within a clearance radius (e.g. 2.5m) OR if the angle relative to the rover exceeds 90 degrees (behind the rover).
3. **Blend the steering vector.** As the rover enters the clearance radius, use proportional interpolation to smoothly blend the target angle from the local waypoint back to the global goal to prevent violent steering snaps.
