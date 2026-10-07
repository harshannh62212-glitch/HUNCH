-- CoppeliaSim Unloading Simulation for NASA HUNCH LLASO Project 1
-- Demonstrates autonomous robotic cargo retrieval and 1/6 g Lunar vs 1 g Earth gravity.

function sysCall_init()
    corout = coroutine.create(coroutineMain)
end

function sysCall_actuation()
    if coroutine.status(corout) ~= 'dead' then
        local ok, err = coroutine.resume(corout)
        if not ok then
            sim.addLog(sim.verbosity_errors, err)
        end
    end
end

function coroutineMain()
    -- Retrieve gantry joint handles
    local railJoint = sim.getObject('./gantry_rail_x_joint', {noError=true})
    local slideJoint = sim.getObject('./gantry_slide_y_joint', {noError=true})
    local mastJoint = sim.getObject('./gantry_mast_z_joint', {noError=true})
    local gripperJoint = sim.getObject('./gripper_yaw_joint', {noError=true})

    if railJoint == -1 then
        sim.addLog(sim.verbosity_warnings, "Gantry joints not found in immediate tree. Searching scene...")
        railJoint = sim.getObject('/cargo_container_hull/gantry_rail_x_joint', {noError=true})
        slideJoint = sim.getObject('/cargo_container_hull/gantry_slide_y_joint', {noError=true})
        mastJoint = sim.getObject('/cargo_container_hull/gantry_mast_z_joint', {noError=true})
        gripperJoint = sim.getObject('/cargo_container_hull/gripper_yaw_joint', {noError=true})
    end

    if railJoint == -1 or slideJoint == -1 or mastJoint == -1 or gripperJoint == -1 then
        sim.addLog(sim.verbosity_errors, "Error: One or more gantry joints could not be located in scene.")
        return
    end

    -- Set physics gravity to Lunar: 1/6 Earth (-1.62 m/s^2)
    -- To switch to Earth gravity: sim.setArrayParam(sim.arrayparam_gravity, {0, 0, -9.81})
    sim.setArrayParam(sim.arrayparam_gravity, {0, 0, -1.622})
    sim.addLog(sim.verbosity_msgs, "NASA HUNCH LLASO Simulation Initialized.")
    sim.addLog(sim.verbosity_msgs, "Gravity configured to LUNAR 1/6 g: -1.622 m/s^2")

    -- LIFO Unloading Waypoint Queue (Day 1 -> Day 14)
    local bays = {
        {name="Day 1 Medical & ECLSS (Bay 1 Port)", x=3.80, y=0.30, z=-0.30, yaw=math.rad(90)},
        {name="Day 2 Water & CO2 Beds (Bay 1 Stbd)", x=3.80, y=-0.30, z=-0.10, yaw=math.rad(-90)},
        {name="Day 3 Comm Repeater (Bay 2 Port)", x=2.55, y=0.30, z=0.10, yaw=math.rad(90)},
        {name="Day 4 Volatiles POD (Fwd Bay)", x=4.80, y=0.35, z=-0.40, yaw=math.rad(45)}
    }
    
    local hatch_x = 5.20 -- Pressurized Docking Hatch Transfer Point

    while true do
        for i, target in ipairs(bays) do
            sim.addLog(sim.verbosity_msgs, string.format("Task %d/4: Moving to %s", i, target.name))
            
            -- Step 1: Move along central rail to target X
            sim.setJointTargetPosition(railJoint, target.x)
            sim.wait(2.5)

            -- Step 2: Orient gripper and extend Y slide toward rack
            sim.setJointTargetPosition(gripperJoint, target.yaw)
            sim.setJointTargetPosition(slideJoint, target.y)
            sim.wait(1.5)

            -- Step 3: Lower mast to shelf height
            sim.setJointTargetPosition(mastJoint, target.z)
            sim.wait(1.5)

            -- Step 4: Latch cargo (simulated 1.0s dwell)
            sim.addLog(sim.verbosity_msgs, "Cargo Latched. Retracting from rack...")
            sim.wait(1.0)

            -- Step 5: Retract to central aisle safety corridor
            sim.setJointTargetPosition(mastJoint, 0.0)
            sim.setJointTargetPosition(slideJoint, 0.0)
            sim.setJointTargetPosition(gripperJoint, 0.0)
            sim.wait(1.5)

            -- Step 6: Transit down aisle to Pressurized Docking Hatch (+X)
            sim.addLog(sim.verbosity_msgs, "Transferring cargo to Lunar Pressurized Docking Port...")
            sim.setJointTargetPosition(railJoint, hatch_x)
            sim.wait(3.0)

            sim.addLog(sim.verbosity_msgs, "Cargo successfully staged at Habitat Airlock.")
            sim.wait(2.0)
        end
        
        sim.addLog(sim.verbosity_msgs, "Unloading cycle completed. Resetting...")
        sim.wait(3.0)
    end
end
