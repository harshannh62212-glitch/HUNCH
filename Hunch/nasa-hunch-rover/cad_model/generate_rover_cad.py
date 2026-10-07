import struct
import math
import os

def write_binary_stl(filename, triangles):
    with open(filename, 'wb') as f:
        header = f"Binary STL - Detailed NASA Tracked Rover - {os.path.basename(filename)}".encode('ascii')
        header = header.ljust(80, b'\0')
        f.write(header)
        f.write(struct.pack('<I', len(triangles)))
        for normal, v1, v2, v3 in triangles:
            f.write(struct.pack('<3f', *normal))
            f.write(struct.pack('<3f', *v1))
            f.write(struct.pack('<3f', *v2))
            f.write(struct.pack('<3f', *v3))
            f.write(struct.pack('<H', 0))

def compute_normal(v1, v2, v3):
    ax, ay, az = v2[0] - v1[0], v2[1] - v1[1], v2[2] - v1[2]
    bx, by, bz = v3[0] - v1[0], v3[1] - v1[1], v3[2] - v1[2]
    nx = ay * bz - az * by
    ny = az * bx - ax * bz
    nz = ax * by - ay * bx
    norm = math.sqrt(nx*nx + ny*ny + nz*nz)
    if norm < 1e-9:
        return (0.0, 0.0, 1.0)
    return (nx/norm, ny/norm, nz/norm)

def add_box(triangles, x_min, x_max, y_min, y_max, z_min, z_max):
    c = [
        (x_min, y_min, z_min), (x_max, y_min, z_min), (x_max, y_max, z_min), (x_min, y_max, z_min),
        (x_min, y_min, z_max), (x_max, y_min, z_max), (x_max, y_max, z_max), (x_min, y_max, z_max)
    ]
    faces = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (2, 3, 7, 6), (0, 4, 7, 3), (1, 2, 6, 5)]
    for p1_i, p2_i, p3_i, p4_i in faces:
        p1, p2, p3, p4 = c[p1_i], c[p2_i], c[p3_i], c[p4_i]
        triangles.append((compute_normal(p1, p2, p3), p1, p2, p3))
        triangles.append((compute_normal(p1, p3, p4), p1, p3, p4))

def add_cylinder(triangles, r, h, segments=32, center=(0,0,0), axis='z'):
    cx, cy, cz = center
    half_h = h / 2.0
    circle_pts = []
    for i in range(segments):
        theta = 2.0 * math.pi * i / segments
        circle_pts.append((math.cos(theta) * r, math.sin(theta) * r))
        
    for i in range(segments):
        next_i = (i + 1) % segments
        c1, s1 = circle_pts[i]
        c2, s2 = circle_pts[next_i]
        
        if axis == 'z':
            b1 = (cx + c1, cy + s1, cz - half_h)
            b2 = (cx + c2, cy + s2, cz - half_h)
            t1 = (cx + c1, cy + s1, cz + half_h)
            t2 = (cx + c2, cy + s2, cz + half_h)
            bot_center = (cx, cy, cz - half_h)
            top_center = (cx, cy, cz + half_h)
        elif axis == 'y':
            b1 = (cx + c1, cy - half_h, cz + s1)
            b2 = (cx + c2, cy - half_h, cz + s2)
            t1 = (cx + c1, cy + half_h, cz + s1)
            t2 = (cx + c2, cy + half_h, cz + s2)
            bot_center = (cx, cy - half_h, cz)
            top_center = (cx, cy + half_h, cz)
        else:
            b1 = (cx - half_h, cy + c1, cz + s1)
            b2 = (cx - half_h, cy + c2, cz + s2)
            t1 = (cx + half_h, cy + c1, cz + s1)
            t2 = (cx + half_h, cy + c2, cz + s2)
            bot_center = (cx - half_h, cy, cz)
            top_center = (cx + half_h, cy, cz)
            
        triangles.append((compute_normal(b1, b2, t2), b1, b2, t2))
        triangles.append((compute_normal(b1, t2, t1), b1, t2, t1))
        triangles.append((compute_normal(bot_center, b2, b1), bot_center, b2, b1))
        triangles.append((compute_normal(top_center, t1, t2), top_center, t1, t2))

def add_strut(triangles, p1, p2, thickness=0.012):
    v = (p2[0] - p1[0], p2[1] - p1[1], p2[2] - p1[2])
    length = math.sqrt(v[0]**2 + v[1]**2 + v[2]**2)
    if length < 1e-6: return
    t = thickness / 2.0
    add_box(triangles, min(p1[0], p2[0]) - t, max(p1[0], p2[0]) + t,
                       min(p1[1], p2[1]) - t, max(p1[1], p2[1]) + t,
                       min(p1[2], p2[2]) - t, max(p1[2], p2[2]) + t)

def add_continuous_track(triangles, center_x, center_y, center_z, front_x, rear_x, wheel_radius, track_width, thickness=0.010, num_grousers=32):
    half_w = track_width / 2.0
    r_out = wheel_radius + thickness
    r_in = wheel_radius
    add_box(triangles, rear_x, front_x, center_y - half_w, center_y + half_w, center_z + r_in, center_z + r_out)
    add_box(triangles, rear_x, front_x, center_y - half_w, center_y + half_w, center_z - r_out, center_z - r_in)
    
    for sign, cx in [(1, front_x), (-1, rear_x)]:
        segs = 20
        for i in range(segs):
            th1 = -math.pi/2 + math.pi * i / segs if sign == 1 else math.pi/2 + math.pi * i / segs
            th2 = -math.pi/2 + math.pi * (i + 1) / segs if sign == 1 else math.pi/2 + math.pi * (i + 1) / segs
            
            p1_in = (cx + r_in * math.cos(th1), center_y - half_w, center_z + r_in * math.sin(th1))
            p2_in = (cx + r_in * math.cos(th2), center_y - half_w, center_z + r_in * math.sin(th2))
            p1_in_t = (cx + r_in * math.cos(th1), center_y + half_w, center_z + r_in * math.sin(th1))
            p2_in_t = (cx + r_in * math.cos(th2), center_y + half_w, center_z + r_in * math.sin(th2))

            p1_out = (cx + r_out * math.cos(th1), center_y - half_w, center_z + r_out * math.sin(th1))
            p2_out = (cx + r_out * math.cos(th2), center_y - half_w, center_z + r_out * math.sin(th2))
            p1_out_t = (cx + r_out * math.cos(th1), center_y + half_w, center_z + r_out * math.sin(th1))
            p2_out_t = (cx + r_out * math.cos(th2), center_y + half_w, center_z + r_out * math.sin(th2))

            triangles.append((compute_normal(p1_out, p2_out, p2_out_t), p1_out, p2_out, p2_out_t))
            triangles.append((compute_normal(p1_out, p2_out_t, p1_out_t), p1_out, p2_out_t, p1_out_t))
            triangles.append((compute_normal(p1_in, p1_in_t, p2_in_t), p1_in, p1_in_t, p2_in_t))
            triangles.append((compute_normal(p1_in, p2_in_t, p2_in), p1_in, p2_in_t, p2_in))

    grouser_h = 0.005
    step = (front_x - rear_x) / 10.0
    for i in range(11):
        gx = rear_x + i * step
        add_box(triangles, gx - 0.004, gx + 0.004, center_y - half_w * 0.95, center_y + half_w * 0.95, center_z + r_out, center_z + r_out + grouser_h)
        add_box(triangles, gx - 0.004, gx + 0.004, center_y - half_w * 0.95, center_y + half_w * 0.95, center_z - r_out - grouser_h, center_z - r_out)

def build_tracked_rover():
    out_dir = os.path.dirname(os.path.abspath(__file__))
    meshes_dir = os.path.join(out_dir, "meshes")
    os.makedirs(meshes_dir, exist_ok=True)
    
    # EXACT DIMENSIONS FROM WEB RESEARCH
    track_center_y = 0.125
    sprocket_radius = 0.045
    front_wheel_x = 0.120
    rear_wheel_x = -0.120
    mid_wheel_x = 0.0
    track_width = 0.042
    track_z = 0.045
    
    # PART DIMENSIONS (Meters)
    pi4_len, pi4_wid, pi4_holes_x, pi4_holes_y = 0.085, 0.056, 0.058, 0.049
    lidar_rad, lidar_h = 0.0356, 0.041
    cam_len, cam_wid, cam_h = 0.025, 0.0238, 0.0115
    mdd10a_len, mdd10a_wid = 0.0845, 0.062
    buck_len, buck_wid, buck_h = 0.054, 0.023, 0.018
    batt_len, batt_wid, batt_h = 0.150, 0.065, 0.094
    jgb37_rad, jgb37_len = 0.0185, 0.065

    # 1. 3D-PRINTED CHASSIS (High Clearance A-Frame Style)
    chassis_tris = []
    # Main Central Body (Higher clearance)
    # The reference shows a raised central hull
    hull_y = 0.075 # Width of central hull
    hull_bottom = 0.12 # Ground clearance
    hull_top = 0.16
    add_box(chassis_tris, -0.10, 0.14, -hull_y, hull_y, hull_bottom, hull_top)
    
    # Angled Nose
    add_box(chassis_tris, 0.14, 0.17, -hull_y, hull_y, hull_bottom + 0.01, hull_top)
    
    # Angled suspension legs going down to the tracks
    for side_sign in [-1, 1]:
        # Track center is at track_center_y (0.125)
        # Leg goes from hull_y to track_center_y
        # Front leg
        add_strut(chassis_tris, (0.08, side_sign * hull_y, hull_bottom), (0.10, side_sign * 0.10, track_z + 0.02), 0.025)
        # Rear leg
        add_strut(chassis_tris, (-0.08, side_sign * hull_y, hull_bottom), (-0.10, side_sign * 0.10, track_z + 0.02), 0.025)
        
        # Track mounting rail (horizontal bar connecting the wheels)
        add_box(chassis_tris, rear_wheel_x - 0.02, front_wheel_x + 0.02, side_sign * 0.09 - 0.01, side_sign * 0.09 + 0.01, track_z + 0.01, track_z + 0.03)

    # 2. BRASS HEAT-SET INSERTS
    brass_tris = []
    pi_x, pi_y = -0.04, 0.0
    for hx in [-pi4_holes_x/2, pi4_holes_x/2]:
        for hy in [-pi4_holes_y/2, pi4_holes_y/2]:
            add_cylinder(brass_tris, r=0.002, h=0.006, center=(pi_x + hx, pi_y + hy, hull_top + 0.003), axis='z')

    md_x, md_y = 0.05, 0.0
    for hx in [-0.038, 0.038]:
        for hy in [-0.027, 0.027]:
            add_cylinder(brass_tris, r=0.003, h=0.006, center=(md_x + hx, md_y + hy, hull_top + 0.003), axis='z')

    # 3. EXACT ELECTRONICS & POWER
    elec_tris = []
    solar_tris = []

    # Battery Pack inside hull
    add_box(elec_tris, -batt_len/2, batt_len/2, -batt_wid/2, batt_wid/2, hull_bottom + 0.005, hull_bottom + 0.005 + batt_h)
    
    # Raspberry Pi 4 B (Mounted on top deck)
    add_box(elec_tris, pi_x - pi4_len/2, pi_x + pi4_len/2, pi_y - pi4_wid/2, pi_y + pi4_wid/2, hull_top, hull_top + 0.002)
    # Cytron MDD10A
    add_box(elec_tris, md_x - mdd10a_len/2, md_x + mdd10a_len/2, md_y - mdd10a_wid/2, md_y + mdd10a_wid/2, hull_top, hull_top + 0.002)
    # Heatsinks
    add_box(elec_tris, md_x - 0.03, md_x - 0.01, md_y - 0.02, md_y + 0.02, hull_top + 0.002, hull_top + 0.012)
    
    # XL4015 Buck Converter
    buck_x, buck_y = -0.10, 0.0
    add_box(elec_tris, buck_x - buck_len/2, buck_x + buck_len/2, buck_y - buck_wid/2, buck_y + buck_wid/2, hull_top, hull_top + 0.002)
    add_box(elec_tris, buck_x - 0.01, buck_x + 0.01, buck_y - 0.005, buck_y + 0.005, hull_top + 0.002, hull_top + 0.012) # Inductor

    # Solar Array Panels (Flat on the top deck like the reference)
    panel_len, panel_wid, panel_thick = 0.20, 0.14, 0.003
    # Top flat solar panel
    add_box(solar_tris, -0.08, 0.12, -0.06, 0.06, hull_top + 0.015, hull_top + 0.015 + panel_thick)

    # 4. SENSORS (YDLIDAR & CAM)
    lidar_tris = []
    mast_tris = []
    # Mast on top of solar panel
    add_box(mast_tris, -0.02, 0.02, -0.02, 0.02, hull_top + 0.018, hull_top + 0.06) 
    # YDLIDAR X4
    add_cylinder(lidar_tris, r=lidar_rad, h=0.02, center=(0, 0, hull_top + 0.07), axis='z')
    add_cylinder(lidar_tris, r=0.032, h=0.021, center=(0, 0, hull_top + 0.09), axis='z') # Spinner

    camera_tris = []
    # Glowing square camera box on the front nose (matches reference)
    cam_box_s = 0.03
    add_box(camera_tris, 0.165, 0.165 + cam_box_s, -cam_box_s/2, cam_box_s/2, hull_top - 0.03, hull_top - 0.03 + cam_box_s)
    # The lens
    add_cylinder(camera_tris, r=0.008, h=0.005, center=(0.165 + cam_box_s + 0.002, 0, hull_top - 0.03 + cam_box_s/2), axis='x')

    # 5. MOTORS & TRACKS
    wheels_tris = []
    motor_tris = []
    track_tris = []
    for side_sign in [-1, 1]:
        wy = side_sign * track_center_y
        my = side_sign * (track_center_y - 0.042)
        # 4 Motors (JGB37-520)
        add_cylinder(motor_tris, r=jgb37_rad, h=jgb37_len, center=(front_wheel_x, my, track_z), axis='y')
        add_cylinder(motor_tris, r=jgb37_rad, h=jgb37_len, center=(rear_wheel_x, my, track_z), axis='y')
        # Front Sprocket
        add_cylinder(wheels_tris, r=sprocket_radius, h=track_width, center=(front_wheel_x, wy, track_z), axis='y')
        add_cylinder(wheels_tris, r=sprocket_radius, h=track_width, center=(rear_wheel_x, wy, track_z), axis='y')
        add_cylinder(wheels_tris, r=sprocket_radius*0.8, h=track_width, center=(mid_wheel_x, wy, track_z), axis='y')
        # Track
        add_continuous_track(track_tris, 0.0, wy, track_z, front_wheel_x, rear_wheel_x, sprocket_radius, track_width)

    # 6. EXPORT
    write_binary_stl(os.path.join(meshes_dir, "chassis_truss.stl"), chassis_tris)
    write_binary_stl(os.path.join(meshes_dir, "tracks.stl"), track_tris)
    write_binary_stl(os.path.join(meshes_dir, "sprockets_wheels.stl"), wheels_tris)
    write_binary_stl(os.path.join(meshes_dir, "dc_motors.stl"), motor_tris)
    write_binary_stl(os.path.join(meshes_dir, "brass_inserts.stl"), brass_tris)
    write_binary_stl(os.path.join(meshes_dir, "sensor_mast.stl"), mast_tris)
    write_binary_stl(os.path.join(meshes_dir, "ydlidar.stl"), lidar_tris)
    write_binary_stl(os.path.join(meshes_dir, "camera_module.stl"), camera_tris)
    write_binary_stl(os.path.join(meshes_dir, "electronics_battery.stl"), elec_tris)
    write_binary_stl(os.path.join(meshes_dir, "solar_panels.stl"), solar_tris)
    print("Exported high-detail individual STL components.")

    obj_filename = os.path.join(out_dir, "tracked_lunar_rover.obj")
    mtl_filename = os.path.join(out_dir, "tracked_lunar_rover.mtl")
    
    with open(mtl_filename, 'w') as mf:
        mf.write("# Material definitions for 3D-Printed Tracked Lunar Rover\n")
        mf.write("newmtl WhitePETG\nKd 0.92 0.94 0.95\nKs 0.3 0.3 0.3\nNs 30\n\n")
        mf.write("newmtl TrackRubber\nKd 0.22 0.24 0.26\nKs 0.1 0.1 0.1\nNs 10\n\n")
        mf.write("newmtl Sprockets\nKd 0.85 0.87 0.90\nKs 0.4 0.4 0.4\nNs 40\n\n")
        mf.write("newmtl BrassGold\nKd 0.85 0.68 0.15\nKs 0.8 0.7 0.2\nNs 80\n\n")
        mf.write("newmtl MotorSteel\nKd 0.60 0.62 0.65\nKs 0.7 0.7 0.7\nNs 70\n\n")
        mf.write("newmtl YDLidarBlack\nKd 0.08 0.08 0.10\nKs 0.4 0.4 0.4\nNs 40\n\n")
        mf.write("newmtl CameraPCBGreen\nKd 0.05 0.55 0.20\nKs 0.2 0.2 0.2\nNs 20\n\n")
        mf.write("newmtl BatteryBlue\nKd 0.10 0.40 0.85\nKs 0.2 0.2 0.2\nNs 15\n\n")
        mf.write("newmtl SolarCells\nKd 0.05 0.10 0.25\nKs 0.8 0.8 0.9\nNs 100\n\n")

    mat_map = {
        'ChassisTruss': 'WhitePETG', 'TreadTracks': 'TrackRubber', 'Sprockets': 'Sprockets',
        'DCMotors': 'MotorSteel', 'BrassInserts': 'BrassGold', 'SensorMast': 'WhitePETG',
        'YDLIDAR': 'YDLidarBlack', 'CameraModule': 'CameraPCBGreen', 'BatteryPack': 'BatteryBlue',
        'SolarPanels': 'SolarCells'
    }
    mesh_dict = {
        'ChassisTruss': chassis_tris, 'TreadTracks': track_tris, 'Sprockets': wheels_tris,
        'DCMotors': motor_tris, 'BrassInserts': brass_tris, 'SensorMast': mast_tris,
        'YDLIDAR': lidar_tris, 'CameraModule': camera_tris, 'BatteryPack': elec_tris,
        'SolarPanels': solar_tris
    }

    with open(obj_filename, 'w') as f:
        f.write(f"# NASA Tracked Lunar Autonomous Rover OBJ Assembly\n")
        f.write(f"mtllib {os.path.basename(mtl_filename)}\n\n")
        v_offset = 1
        for group_name, tris in mesh_dict.items():
            f.write(f"o {group_name}\nusemtl {mat_map.get(group_name, 'WhitePETG')}\ns 1\n")
            verts, faces = [], []
            for norm, v1, v2, v3 in tris:
                i1, i2, i3 = v_offset + len(verts), v_offset + len(verts) + 1, v_offset + len(verts) + 2
                verts.extend([v1, v2, v3])
                faces.append((i1, i2, i3))
            for v in verts: f.write(f"v {v[0]:.6f} {v[1]:.6f} {v[2]:.6f}\n")
            for f_idx in faces: f.write(f"f {f_idx[0]} {f_idx[1]} {f_idx[2]}\n")
            v_offset += len(verts)
            f.write("\n")
    print(f"Generated high-precision OBJ: {obj_filename}")

if __name__ == "__main__":
    build_tracked_rover()
