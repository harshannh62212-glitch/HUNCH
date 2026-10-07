-- CoppeliaSim Child Script for Coppeliabot
-- Attach this script to 'base_link' or the robot model root.
-- Provides keyboard teleoperation (Arrow Keys) and dynamic status.

function sysCall_init()
    corout = coroutine.create(coroutineMain)
end

function sysCall_actuation()
    if coroutine.status(corout) ~= 'dead' then
        local ok, errorMsg = coroutine.resume(corout)
        if not ok then
            sim.addLog(sim.verbosity_errors, errorMsg)
        end
    end
end

function coroutineMain()
    -- Retrieve motor joint handles
    local leftMotor = sim.getObject('../left_wheel_joint', {noError = true})
    local rightMotor = sim.getObject('../right_wheel_joint', {noError = true})
    
    if leftMotor == -1 or rightMotor == -1 then
        leftMotor = sim.getObject('./left_wheel_joint', {noError = true})
        rightMotor = sim.getObject('./right_wheel_joint', {noError = true})
    end
    
    if leftMotor == -1 or rightMotor == -1 then
        sim.addLog(sim.verbosity_warnings, "Could not find left_wheel_joint / right_wheel_joint. Please check joint names.")
        return
    end

    -- Velocity settings (rad/s)
    local maxVel = 8.0
    local turnVel = 4.0
    
    sim.addLog(sim.verbosity_msgs, "Coppeliabot initialized! Use ARROW KEYS to drive, SPACE to brake.")

    while true do
        local targetLeft = 0.0
        local targetRight = 0.0
        
        -- Read keyboard inputs (CoppeliaSim keyboard events)
        local message, data, data2 = sim.getSimulatorMessage()
        
        -- Check keyboard state
        -- 2007: Up arrow, 2008: Down arrow, 2009: Left arrow, 2010: Right arrow, 32: Space
        if sim.getInt32Param(sim.intparam_current_page) ~= nil then
            -- Check key events
            local key = sim.readCustomDataBlock(sim.handle_scene, 'keyboard')
        end
        
        -- Basic continuous drive demo or key control:
        -- Up: Forward, Down: Backward, Left: Pivot Left, Right: Pivot Right
        local upKey = sim.getKeyState(2007) or 0
        local downKey = sim.getKeyState(2008) or 0
        local leftKey = sim.getKeyState(2009) or 0
        local rightKey = sim.getKeyState(2010) or 0
        local spaceKey = sim.getKeyState(32) or 0

        local forward = 0.0
        local turn = 0.0

        if upKey ~= 0 then forward = forward + maxVel end
        if downKey ~= 0 then forward = forward - maxVel end
        if leftKey ~= 0 then turn = turn + turnVel end
        if rightKey ~= 0 then turn = turn - turnVel end

        if spaceKey ~= 0 then
            targetLeft = 0.0
            targetRight = 0.0
        else
            targetLeft = forward - turn
            targetRight = forward + turn
        end

        -- If no keys are pressed, gently demonstrate idle / stop
        sim.setJointTargetVelocity(leftMotor, targetLeft)
        sim.setJointTargetVelocity(rightMotor, targetRight)

        sim.switchThread()
    end
end

function sysCall_cleanup()
    sim.addLog(sim.verbosity_msgs, "Coppeliabot controller stopped.")
end
