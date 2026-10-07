import struct
import math
import os

def write_binary_stl(filename, triangles):
    with open(filename, 'wb') as f:
        header = f"Binary STL generated for CoppeliaSim - {os.path.basename(filename)}".encode('ascii')
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
        (x_min, y_min, z_min), # 0
        (x_max, y_min, z_min), # 1
        (x_max, y_max, z_min), # 2
        (x_min, y_max, z_min), # 3
        (x_min, y_min, z_max), # 4
        (x_max, y_min, z_max), # 5
        (x_max, y_max, z_max), # 6
        (x_min, y_max, z_max)  # 7
    ]
    faces = [
        (0, 3, 2, 1), # bottom (-Z)
        (4, 5, 6, 7), # top (+Z)
        (0, 1, 5, 4), # front (-Y)
        (2, 3, 7, 6), # back (+Y)
        (0, 4, 7, 3), # left (-X)
        (1, 2, 6, 5)  # right (+X)
    ]
    for v1_i, v2_i, v3_i, v4_i in faces:
        p1, p2, p3, p4 = c[v1_i], c[v2_i], c[v3_i], c[v4_i]
        n1 = compute_normal(p1, p2, p3)
        triangles.append((n1, p1, p2, p3))
        n2 = compute_normal(p1, p3, p4)
        triangles.append((n2, p1, p3, p4))

def add_cylinder(triangles, r, h, segments=36, center=(0,0,0), axis='z'):
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
        else: # 'x'
            b1 = (cx - half_h, cy + c1, cz + s1)
            b2 = (cx - half_h, cy + c2, cz + s2)
            t1 = (cx + half_h, cy + c1, cz + s1)
            t2 = (cx + half_h, cy + c2, cz + s2)
            bot_center = (cx - half_h, cy, cz)
            top_center = (cx + half_h, cy, cz)
            
        n_side1 = compute_normal(b1, b2, t2)
        triangles.append((n_side1, b1, b2, t2))
        n_side2 = compute_normal(b1, t2, t1)
        triangles.append((n_side2, b1, t2, t1))
        
        n_bot = compute_normal(bot_center, b2, b1)
        triangles.append((n_bot, bot_center, b2, b1))
        
        n_top = compute_normal(top_center, t1, t2)
        triangles.append((n_top, top_center, t1, t2))

def add_sphere(triangles, r, lats=18, lons=36, center=(0,0,0)):
    cx, cy, cz = center
    for i in range(lats):
        lat1 = math.pi * (-0.5 + float(i) / lats)
        lat2 = math.pi * (-0.5 + float(i + 1) / lats)
        z1 = math.sin(lat1) * r
        r1 = math.cos(lat1) * r
        z2 = math.sin(lat2) * r
        r2 = math.cos(lat2) * r
        
        for j in range(lons):
            lon1 = 2.0 * math.pi * float(j) / lons
            lon2 = 2.0 * math.pi * float(j + 1) / lons
            
            p1 = (cx + r1 * math.cos(lon1), cy + r1 * math.sin(lon1), cz + z1)
            p2 = (cx + r1 * math.cos(lon2), cy + r1 * math.sin(lon2), cz + z1)
            p3 = (cx + r2 * math.cos(lon2), cy + r2 * math.sin(lon2), cz + z2)
            p4 = (cx + r2 * math.cos(lon1), cy + r2 * math.sin(lon1), cz + z2)
            
            if i != 0:
                n1 = compute_normal(p1, p2, p3)
                triangles.append((n1, p1, p2, p3))
            if i != lats - 1:
                n2 = compute_normal(p1, p3, p4)
                triangles.append((n2, p1, p3, p4))

def generate_cad_assets(out_dir):
    os.makedirs(out_dir, exist_ok=True)
    
    # 1. CHASSIS MESH
    chassis_tris = []
    add_box(chassis_tris, -0.14, 0.14, -0.10, 0.10, -0.03, 0.03)
    add_box(chassis_tris, -0.11, 0.11, -0.08, 0.08, 0.03, 0.055)
    add_cylinder(chassis_tris, r=0.098, h=0.058, segments=36, center=(0.11, 0.0, 0.0), axis='z')
    add_cylinder(chassis_tris, r=0.098, h=0.058, segments=36, center=(-0.11, 0.0, 0.0), axis='z')
    add_cylinder(chassis_tris, r=0.022, h=0.05, segments=24, center=(0.04, 0.0, 0.08), axis='z')
    chassis_path = os.path.join(out_dir, "chassis.stl")
    write_binary_stl(chassis_path, chassis_tris)
    print(f"Generated {chassis_path} ({len(chassis_tris)} triangles)")

    # 2. WHEEL MESH (Diameter: 0.09m, Width: 0.026m, aligned along Y axis)
    wheel_tris = []
    add_cylinder(wheel_tris, r=0.045, h=0.026, segments=48, center=(0.0, 0.0, 0.0), axis='y')
    add_cylinder(wheel_tris, r=0.028, h=0.028, segments=36, center=(0.0, 0.0, 0.0), axis='y')
    add_cylinder(wheel_tris, r=0.010, h=0.032, segments=18, center=(0.0, 0.0, 0.0), axis='y')
    wheel_path = os.path.join(out_dir, "wheel.stl")
    write_binary_stl(wheel_path, wheel_tris)
    print(f"Generated {wheel_path} ({len(wheel_tris)} triangles)")

    # 3. CASTER WHEEL MESH
    caster_tris = []
    add_cylinder(caster_tris, r=0.020, h=0.022, segments=24, center=(0.0, 0.0, 0.012), axis='z')
    add_sphere(caster_tris, r=0.022, lats=18, lons=28, center=(0.0, 0.0, -0.008))
    caster_path = os.path.join(out_dir, "caster.stl")
    write_binary_stl(caster_path, caster_tris)
    print(f"Generated {caster_path} ({len(caster_tris)} triangles)")

    # 4. LIDAR SENSOR MESH
    lidar_tris = []
    add_cylinder(lidar_tris, r=0.035, h=0.022, segments=36, center=(0.0, 0.0, -0.011), axis='z')
    add_cylinder(lidar_tris, r=0.032, h=0.022, segments=36, center=(0.0, 0.0, 0.011), axis='z')
    add_cylinder(lidar_tris, r=0.034, h=0.004, segments=36, center=(0.0, 0.0, 0.024), axis='z')
    lidar_path = os.path.join(out_dir, "lidar.stl")
    write_binary_stl(lidar_path, lidar_tris)
    print(f"Generated {lidar_path} ({len(lidar_tris)} triangles)")


def write_obj_scene(filename, mesh_dict):
    """
    Exports a multi-group OBJ file with material tags.
    mesh_dict: { 'GroupName': [ ((nx,ny,nz), v1, v2, v3), ... ] }
    """
    mtl_filename = os.path.splitext(filename)[0] + ".mtl"
    
    with open(mtl_filename, 'w') as mf:
        mf.write("# Material definitions for CoppeliaBot\n")
        mf.write("newmtl ChassisMat\nKd 0.12 0.35 0.70\nKs 0.3 0.3 0.3\nNs 20\n\n")
        mf.write("newmtl WheelMat\nKd 0.15 0.15 0.15\nKs 0.1 0.1 0.1\nNs 10\n\n")
        mf.write("newmtl CasterMat\nKd 0.80 0.80 0.82\nKs 0.5 0.5 0.5\nNs 50\n\n")
        mf.write("newmtl LidarMat\nKd 0.08 0.08 0.08\nKs 0.4 0.4 0.4\nNs 30\n\n")

    mat_map = {
        'Chassis': 'ChassisMat',
        'LeftWheel': 'WheelMat',
        'RightWheel': 'WheelMat',
        'FrontCaster': 'CasterMat',
        'RearCaster': 'CasterMat',
        'LidarScanner': 'LidarMat'
    }

    with open(filename, 'w') as f:
        f.write(f"# CoppeliaBot CAD Scene OBJ\n")
        f.write(f"mtllib {os.path.basename(mtl_filename)}\n\n")
        
        v_offset = 1
        for group_name, tris in mesh_dict.items():
            f.write(f"o {group_name}\n")
            f.write(f"usemtl {mat_map.get(group_name, 'ChassisMat')}\n")
            f.write(f"s 1\n")
            
            verts = []
            faces = []
            for norm, v1, v2, v3 in tris:
                i1 = v_offset + len(verts)
                verts.append(v1)
                i2 = v_offset + len(verts)
                verts.append(v2)
                i3 = v_offset + len(verts)
                verts.append(v3)
                faces.append((i1, i2, i3))
                
            for v in verts:
                f.write(f"v {v[0]:.6f} {v[1]:.6f} {v[2]:.6f}\n")
            for f_idx in faces:
                f.write(f"f {f_idx[0]} {f_idx[1]} {f_idx[2]}\n")
            
            v_offset += len(verts)
            f.write("\n")
    print(f"Generated multi-part OBJ: {filename}")

def generate_full_assembly():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    # Build positioned components for the combined OBJ
    chassis_tris = []
    # Chassis origin at (0, 0, 0.02)
    add_box(chassis_tris, -0.14, 0.14, -0.10, 0.10, 0.02 - 0.03, 0.02 + 0.03)
    add_box(chassis_tris, -0.11, 0.11, -0.08, 0.08, 0.02 + 0.03, 0.02 + 0.055)
    add_cylinder(chassis_tris, r=0.098, h=0.058, segments=36, center=(0.11, 0.0, 0.02), axis='z')
    add_cylinder(chassis_tris, r=0.098, h=0.058, segments=36, center=(-0.11, 0.0, 0.02), axis='z')
    add_cylinder(chassis_tris, r=0.022, h=0.05, segments=24, center=(0.04, 0.0, 0.02 + 0.08), axis='z')

    # Left Wheel at (0.0, 0.115, 0.0)
    left_wheel_tris = []
    add_cylinder(left_wheel_tris, r=0.045, h=0.026, segments=48, center=(0.0, 0.115, 0.0), axis='y')
    add_cylinder(left_wheel_tris, r=0.028, h=0.028, segments=36, center=(0.0, 0.115, 0.0), axis='y')
    add_cylinder(left_wheel_tris, r=0.010, h=0.032, segments=18, center=(0.0, 0.115, 0.0), axis='y')

    # Right Wheel at (0.0, -0.115, 0.0)
    right_wheel_tris = []
    add_cylinder(right_wheel_tris, r=0.045, h=0.026, segments=48, center=(0.0, -0.115, 0.0), axis='y')
    add_cylinder(right_wheel_tris, r=0.028, h=0.028, segments=36, center=(0.0, -0.115, 0.0), axis='y')
    add_cylinder(right_wheel_tris, r=0.010, h=0.032, segments=18, center=(0.0, -0.115, 0.0), axis='y')

    # Front Caster at (0.10, 0.0, -0.015)
    front_caster_tris = []
    add_cylinder(front_caster_tris, r=0.020, h=0.022, segments=24, center=(0.10, 0.0, -0.015 + 0.012), axis='z')
    add_sphere(front_caster_tris, r=0.022, lats=18, lons=28, center=(0.10, 0.0, -0.015 - 0.008))

    # Rear Caster at (-0.10, 0.0, -0.015)
    rear_caster_tris = []
    add_cylinder(rear_caster_tris, r=0.020, h=0.022, segments=24, center=(-0.10, 0.0, -0.015 + 0.012), axis='z')
    add_sphere(rear_caster_tris, r=0.022, lats=18, lons=28, center=(-0.10, 0.0, -0.015 - 0.008))

    # Lidar Puck at (0.04, 0.0, 0.125)
    lidar_tris = []
    add_cylinder(lidar_tris, r=0.035, h=0.022, segments=36, center=(0.04, 0.0, 0.125 - 0.011), axis='z')
    add_cylinder(lidar_tris, r=0.032, h=0.022, segments=36, center=(0.04, 0.0, 0.125 + 0.011), axis='z')
    add_cylinder(lidar_tris, r=0.034, h=0.004, segments=36, center=(0.04, 0.0, 0.125 + 0.024), axis='z')

    mesh_dict = {
        'Chassis': chassis_tris,
        'LeftWheel': left_wheel_tris,
        'RightWheel': right_wheel_tris,
        'FrontCaster': front_caster_tris,
        'RearCaster': rear_caster_tris,
        'LidarScanner': lidar_tris
    }
    
    write_obj_scene(os.path.join(base_dir, "coppeliabot_assembly.obj"), mesh_dict)

if __name__ == "__main__":
    here = os.path.dirname(os.path.abspath(__file__))
    generate_cad_assets(os.path.join(here, "meshes"))
    generate_full_assembly()
