# CoppeliaBot - Professional Parametric CAD for CoppeliaSim

A modular, lightweight differential-drive mobile robot CAD package designed specifically for **CoppeliaSim (V-REP)**.

---

## 📦 Package Contents

| File / Folder | Purpose |
| :--- | :--- |
| `coppeliabot.urdf` | **Primary 1-Click Import** file with full kinematic tree, joints, dynamics, collision shapes, and materials. |
| `meshes/*.stl` | Binary STL geometry files for visual & respondable components (`chassis.stl`, `wheel.stl`, `caster.stl`, `lidar.stl`). |
| `coppeliabot_assembly.obj` & `.mtl` | Combined multi-part 3D CAD mesh for direct mesh import with named components & materials. |
| `generate_cad.py` | Standalone parametric CAD generator in Python. Change dimensions, radii, or add features in seconds. |
| `keyboard_controller.lua` | Drop-in CoppeliaSim Lua child script for arrow-key keyboard teleoperation. |
| `teleop_remote_api.py` | Python ZeroMQ Remote API script to control the robot externally. |

---

## 🚀 How to Import into CoppeliaSim

### Method A: URDF Import (Recommended — Instant Physics & Joints)
1. Launch **CoppeliaSim**.
2. Click **File → Import → URDF...** (or **Modules → Importers → URDF**).
3. Select `coppeliabot.urdf`.
4. In the import settings dialog:
   - Check **"Hide collision shapes"** (recommended for clean visuals).
   - Check **"Assign collision layers"**.
5. Click **Import**.
6. CoppeliaSim will construct the full kinematic tree with:
   - `base_link`
   - `left_wheel_joint` & `right_wheel_joint` (continuous revolute joints in velocity mode)
   - `front_caster` & `rear_caster` (smooth low-friction contact spheres)
   - `lidar_link` (sensor pedestal)

---

### Method B: Multi-Part OBJ Import (Visual CAD only)
1. In CoppeliaSim, click **File → Import → Mesh...**
2. Select `coppeliabot_assembly.obj`.
3. When prompted **"Import as separate shapes?"**, choose **Yes**.
4. You will see individual shapes (`Chassis`, `LeftWheel`, `RightWheel`, `FrontCaster`, `RearCaster`, `LidarScanner`) positioned accurately.

---

## 🎮 Driving the Robot

### Option 1: Lua Child Script (Keyboard Arrow Keys)
1. Right-click `base_link` in the scene hierarchy.
2. Select **Add → Associated child script → Non-threaded: Lua** (or Threaded: Lua).
3. Double-click the newly added script icon and paste the code from `keyboard_controller.lua`.
4. Press the **Play (Start simulation)** button.
5. Use your keyboard **Arrow keys** (Up = Forward, Down = Backward, Left/Right = Turn, Space = Brake).

### Option 2: Python Remote API
With simulation running:
```bash
pip install coppeliasim-zmqremoteapi-client
python3 teleop_remote_api.py
```

---

## 🛠️ How to Customize the Robot

Open `generate_cad.py`:
- Tweak `add_box` or `add_cylinder` parameters to resize the chassis, wheel track width, or ground clearance.
- Run:
  ```bash
  python3 generate_cad.py
  ```
- All STL files and the OBJ assembly update instantly!
