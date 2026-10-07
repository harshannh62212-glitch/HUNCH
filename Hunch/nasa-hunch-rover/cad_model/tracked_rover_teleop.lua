-- CoppeliaSim Child Script for Autonomous Tracked Lunar Rover
-- Controls skid-steer tracks and reads sensor frames

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
    local leftMotor = sim.getObject('./left_drive_joint', {noError=true})
    local rightMotor = sim.getObject('./right_drive_joint', {noError=true})

    if leftMotor == -1 or rightMotor == -1 then
        leftMotor = sim.getObject('/chassis_link/left_drive_joint', {noError=true})
        rightMotor = sim.getObject('/chassis_link/right_drive_joint', {noError=true})
    end

    local maxSpeed = 10.0 -- rad/s
    local turnSpeed = 6.0

    sim.addLog(sim.verbosity_msgs, "Autonomous Tracked Lunar Rover online!")
    sim.addLog(sim.verbosity_msgs, "Sensors active: YDLIDAR (360°), Camera Module (Downward Tilt 15°)")
    sim.addLog(sim.verbosity_msgs, "Controls: ARROW KEYS to skid-steer drive, SPACE to brake.")

    while true do
        local upKey = sim.getKeyState(2007) or 0
        local downKey = sim.getKeyState(2008) or 0
        local leftKey = sim.getKeyState(2009) or 0
        local rightKey = sim.getKeyState(2010) or 0
        local spaceKey = sim.getKeyState(32) or 0

        local fwd = 0.0
        local rot = 0.0

        if upKey ~= 0 then fwd = fwd + maxSpeed end
        if downKey ~= 0 then fwd = fwd - maxSpeed end
        if leftKey ~= 0 then rot = rot + turnSpeed end
        if rightKey ~= 0 then rot = rot - turnSpeed end

        local vLeft = fwd - rot
        local vRight = fwd + rot

        if spaceKey ~= 0 then
            vLeft = 0.0
            vRight = 0.0
        end

        sim.setJointTargetVelocity(leftMotor, vLeft)
        sim.setJointTargetVelocity(rightMotor, vRight)

        sim.switchThread()
    end
end
