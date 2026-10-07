import struct
import math
import os

def write_binary_stl(filename, triangles):
    with open(filename, 'wb') as f:
        header = f"Binary STL - LLASO Project 1 - {os.path.basename(filename)}".encode('ascii')
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

def add_cylinder(triangles, r, h, segments=36, center=(0,0,0), axis='x'):
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
        
        if axis == 'x':
            b1 = (cx - half_h, cy + c1, cz + s1)
            b2 = (cx - half_h, cy + c2, cz + s2)
            t1 = (cx + half_h, cy + c1, cz + s1)
            t2 = (cx + half_h, cy + c2, cz + s2)
            bot_center = (cx - half_h, cy, cz)
            top_center = (cx + half_h, cy, cz)
        elif axis == 'y':
            b1 = (cx + c1, cy - half_h, cz + s1)
            b2 = (cx + c2, cy - half_h, cz + s2)
            t1 = (cx + c1, cy + half_h, cz + s1)
            t2 = (cx + c2, cy + half_h, cz + s2)
            bot_center = (cx, cy - half_h, cz)
            top_center = (cx, cy + half_h, cz)
        else: # 'z'
            b1 = (cx + c1, cy + s1, cz - half_h)
            b2 = (cx + c2, cy + s2, cz - half_h)
            t1 = (cx + c1, cy + s1, cz + half_h)
            t2 = (cx + c2, cy + s2, cz + half_h)
            bot_center = (cx, cy, cz - half_h)
            top_center = (cx, cy, cz + half_h)
            
        n_side1 = compute_normal(b1, b2, t2)
        triangles.append((n_side1, b1, b2, t2))
        n_side2 = compute_normal(b1, t2, t1)
        triangles.append((n_side2, b1, t2, t1))
        
        n_bot = compute_normal(bot_center, b2, b1)
        triangles.append((n_bot, bot_center, b2, b1))
        n_top = compute_normal(top_center, t1, t2)
        triangles.append((n_top, top_center, t1, t2))

def add_cutaway_cylinder(triangles, r_outer, r_inner, length, angle_start_deg=45, angle_end_deg=315, segments=36, center=(0,0,0)):
    """
    Creates a hollow cylinder along X with an open cutaway slice (e.g. 45 to 315 deg, leaving top 90 deg open)
    so students and engineers can look directly inside the container in CAD/VR!
    """
    cx, cy, cz = center
    half_l = length / 2.0
    a1_rad = math.radians(angle_start_deg)
    a2_rad = math.radians(angle_end_deg)
    
    angles = []
    for i in range(segments + 1):
        ang = a1_rad + (a2_rad - a1_rad) * (i / segments)
        angles.append(ang)
        
    for i in range(segments):
        th1, th2 = angles[i], angles[i+1]
        
        # Outer vertices
        o1_b = (cx - half_l, cy + r_outer * math.cos(th1), cz + r_outer * math.sin(th1))
        o2_b = (cx - half_l, cy + r_outer * math.cos(th2), cz + r_outer * math.sin(th2))
        o1_f = (cx + half_l, cy + r_outer * math.cos(th1), cz + r_outer * math.sin(th1))
        o2_f = (cx + half_l, cy + r_outer * math.cos(th2), cz + r_outer * math.sin(th2))
        
        # Inner vertices
        i1_b = (cx - half_l, cy + r_inner * math.cos(th1), cz + r_inner * math.sin(th1))
        i2_b = (cx - half_l, cy + r_inner * math.cos(th2), cz + r_inner * math.sin(th2))
        i1_f = (cx + half_l, cy + r_inner * math.cos(th1), cz + r_inner * math.sin(th1))
        i2_f = (cx + half_l, cy + r_inner * math.cos(th2), cz + r_inner * math.sin(th2))
        
        # Outer surface
        triangles.append((compute_normal(o1_b, o2_b, o2_f), o1_b, o2_b, o2_f))
        triangles.append((compute_normal(o1_b, o2_f, o1_f), o1_b, o2_f, o1_f))
        
        # Inner surface
        triangles.append((compute_normal(i1_b, i2_f, i2_b), i1_b, i2_f, i2_b))
        triangles.append((compute_normal(i1_b, i1_f, i2_f), i1_b, i1_f, i2_f))
        
        # Aft rim cap
        triangles.append((compute_normal(o1_b, i1_b, i2_b), o1_b, i1_b, i2_b))
        triangles.append((compute_normal(o1_b, i2_b, o2_b), o1_b, i2_b, o2_b))
        
        # Fwd rim cap
        triangles.append((compute_normal(o1_f, i2_f, i1_f), o1_f, i2_f, i1_f))
        triangles.append((compute_normal(o1_f, o2_f, i2_f), o1_f, o2_f, i2_f))
        
    # Cut longitudinal end caps (sealing the wall at angle_start and angle_end)
    # Start cut
    s_o_b = (cx - half_l, cy + r_outer * math.cos(a1_rad), cz + r_outer * math.sin(a1_rad))
    s_i_b = (cx - half_l, cy + r_inner * math.cos(a1_rad), cz + r_inner * math.sin(a1_rad))
    s_o_f = (cx + half_l, cy + r_outer * math.cos(a1_rad), cz + r_outer * math.sin(a1_rad))
    s_i_f = (cx + half_l, cy + r_inner * math.cos(a1_rad), cz + r_inner * math.sin(a1_rad))
    triangles.append((compute_normal(s_o_b, s_o_f, s_i_f), s_o_b, s_o_f, s_i_f))
    triangles.append((compute_normal(s_o_b, s_i_f, s_i_b), s_o_b, s_i_f, s_i_b))
    
    # End cut
    e_o_b = (cx - half_l, cy + r_outer * math.cos(a2_rad), cz + r_outer * math.sin(a2_rad))
    e_i_b = (cx - half_l, cy + r_inner * math.cos(a2_rad), cz + r_inner * math.sin(a2_rad))
    e_o_f = (cx + half_l, cy + r_outer * math.cos(a2_rad), cz + r_outer * math.sin(a2_rad))
    e_i_f = (cx + half_l, cy + r_inner * math.cos(a2_rad), cz + r_inner * math.sin(a2_rad))
    triangles.append((compute_normal(e_o_b, e_i_f, e_o_f), e_o_b, e_i_f, e_o_f))
    triangles.append((compute_normal(e_o_b, e_i_b, e_i_f), e_o_b, e_i_b, e_i_f))

def write_obj_scene(filename, mesh_dict, mtl_filename):
    with open(mtl_filename, 'w') as mf:
        mf.write("# Material definitions for NASA HUNCH LLASO Container\n")
        mf.write("newmtl HullOuter\nKd 0.90 0.92 0.95\nKs 0.2 0.2 0.2\nNs 30\n\n")
        mf.write("newmtl HullInterior\nKd 0.85 0.85 0.88\nKs 0.1 0.1 0.1\nNs 10\n\n")
        mf.write("newmtl BulkheadRing\nKd 0.25 0.27 0.30\nKs 0.4 0.4 0.4\nNs 40\n\n")
        mf.write("newmtl FloorDeck\nKd 0.20 0.22 0.25\nKs 0.1 0.1 0.1\nNs 10\n\n")
        mf.write("newmtl RackFrame\nKd 0.70 0.72 0.75\nKs 0.5 0.5 0.5\nNs 60\n\n")
        mf.write("newmtl GantryRobot\nKd 0.95 0.45 0.05\nKs 0.4 0.4 0.4\nNs 30\n\n")
        mf.write("newmtl MetalLocker\nKd 0.80 0.82 0.85\nKs 0.6 0.6 0.6\nNs 50\n\n")
        mf.write("newmtl CTBNomexBlue\nKd 0.08 0.25 0.60\nKs 0.05 0.05 0.05\nNs 5\n\n")
        mf.write("newmtl CTBGold\nKd 0.85 0.70 0.15\nKs 0.1 0.1 0.1\nNs 10\n\n")
        mf.write("newmtl CryoTank\nKd 0.95 0.95 0.98\nKs 0.3 0.3 0.3\nNs 20\n\n")
        mf.write("newmtl SciencePOD\nKd 0.92 0.30 0.10\nKs 0.3 0.3 0.3\nNs 25\n\n")

    mat_map = {
        'HullOuter': 'HullOuter',
        'HullBulkhead': 'BulkheadRing',
        'FloorDeck': 'FloorDeck',
        'GantryRail': 'BulkheadRing',
        'RackStructure': 'RackFrame',
        'GantryRobot': 'GantryRobot',
        'Lockers': 'MetalLocker',
        'CTB_Blue': 'CTBNomexBlue',
        'CTB_Gold': 'CTBGold',
        'CryoTanks': 'CryoTank',
        'SciencePODs': 'SciencePOD'
    }

    with open(filename, 'w') as f:
        f.write(f"# NASA HUNCH LLASO 40-ft Lunar Cargo Module Assembly OBJ\n")
        f.write(f"mtllib {os.path.basename(mtl_filename)}\n\n")
        
        v_offset = 1
        for group_name, tris in mesh_dict.items():
            f.write(f"o {group_name}\n")
            f.write(f"usemtl {mat_map.get(group_name, 'HullOuter')}\n")
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

def build_llaso_model():
    out_dir = os.path.dirname(os.path.abspath(__file__))
    meshes_dir = os.path.join(out_dir, "meshes")
    os.makedirs(meshes_dir, exist_ok=True)
    
    # -------------------------------------------------------------
    # 1. CYLINDRICAL HULL (40 ft = 12.192 m long, 3.0 m outer diameter)
    # -------------------------------------------------------------
    hull_tris = []
    # Usable cutaway shell (leaves top 70 deg open to inspect internal racks/robotics)
    add_cutaway_cylinder(hull_tris, r_outer=1.50, r_inner=1.42, length=12.192, 
                         angle_start_deg=40, angle_end_deg=320, segments=48, center=(0,0,0))
    # Reinforcing ring ribs along 12m (every 1.5m)
    for rib_x in [-5.0, -3.5, -2.0, -0.5, 1.0, 2.5, 4.0, 5.5]:
        add_cutaway_cylinder(hull_tris, r_outer=1.54, r_inner=1.50, length=0.15,
                             angle_start_deg=40, angle_end_deg=320, segments=36, center=(rib_x, 0, 0))

    bulkhead_tris = []
    # Forward Docking Hatch Bulkhead (+X = +6.096m)
    add_box(bulkhead_tris, 6.05, 6.15, -1.45, 1.45, -1.45, 1.45)
    # Forward Docking Tunnel Collar (diameter 1.2m)
    add_cylinder(bulkhead_tris, r=0.62, h=0.35, segments=36, center=(6.22, 0, 0), axis='x')
    
    # Aft Bulkhead / Unloading Port (-X = -6.096m)
    add_box(bulkhead_tris, -6.15, -6.05, -1.45, 1.45, -1.45, 1.45)
    add_cylinder(bulkhead_tris, r=0.62, h=0.35, segments=36, center=(-6.22, 0, 0), axis='x')

    # -------------------------------------------------------------
    # 2. INTERNAL STRUCTURE: FLOOR DECK & OVERHEAD GANTRY RAIL
    # -------------------------------------------------------------
    floor_tris = []
    # Flat walking / rolling deck at z = -0.72m, width = 1.8m (y: -0.90 to +0.90), length = 12.0m
    add_box(floor_tris, -5.95, 5.95, -0.90, 0.90, -0.74, -0.70)
    # Central robot track guides along the deck
    add_box(floor_tris, -5.95, 5.95, -0.42, -0.38, -0.70, -0.67)
    add_box(floor_tris, -5.95, 5.95, 0.38, 0.42, -0.70, -0.67)
    
    rail_tris = []
    # Overhead central gantry rail beam at z = 1.25m running full 11.5m length
    add_box(rail_tris, -5.80, 5.80, -0.06, 0.06, 1.22, 1.30)
    add_box(rail_tris, -5.80, 5.80, -0.12, 0.12, 1.20, 1.22)
    # Suspension struts connecting ceiling rail to hull
    for strut_x in [-5.0, -3.0, -1.0, 1.0, 3.0, 5.0]:
        add_cylinder(rail_tris, r=0.025, h=0.15, segments=12, center=(strut_x, 0, 1.35), axis='z')

    # -------------------------------------------------------------
    # 3. MODULAR RACK & STACK INFRASTRUCTURE (Port & Starboard)
    # -------------------------------------------------------------
    rack_tris = []
    # 8 Bays per side, each bay ~ 1.2m long. From x = -5.0 to x = +4.6
    # Port racks (y = +0.50 to +1.25, z = -0.70 to +0.85)
    # Starboard racks (y = -1.25 to -0.50, z = -0.70 to +0.85)
    for bay in range(7):
        bx1 = -4.2 + bay * 1.25
        bx2 = bx1 + 1.15
        
        # Port side rack uprights and shelves (+Y)
        # Vertical uprights
        add_box(rack_tris, bx1, bx1 + 0.04, 0.50, 1.20, -0.70, 0.85)
        add_box(rack_tris, bx2 - 0.04, bx2, 0.50, 1.20, -0.70, 0.85)
        # 3 Shelf levels (Tier 1: z=-0.68, Tier 2: z=-0.20, Tier 3: z=+0.30)
        for tz in [-0.68, -0.20, 0.30, 0.80]:
            add_box(rack_tris, bx1, bx2, 0.50, 1.20, tz, tz + 0.03)
            
        # Starboard side rack uprights and shelves (-Y)
        add_box(rack_tris, bx1, bx1 + 0.04, -1.20, -0.50, -0.70, 0.85)
        add_box(rack_tris, bx2 - 0.04, bx2, -1.20, -0.50, -0.70, 0.85)
        for tz in [-0.68, -0.20, 0.30, 0.80]:
            add_box(rack_tris, bx1, bx2, -1.20, -0.50, tz, tz + 0.03)

    # -------------------------------------------------------------
    # 4. CARGO UNITS (NASA CTBs, Lockers, Irregular Tanks & PODS)
    # -------------------------------------------------------------
    locker_tris = []
    ctb_blue_tris = []
    ctb_gold_tris = []
    
    # Populate shelves with standardized NASA cargo (LIFO organized)
    for bay in range(7):
        bx1 = -4.2 + bay * 1.25
        # Port Shelves (+Y)
        # Tier 1 (Heavy Metal Lockers)
        add_box(locker_tris, bx1 + 0.08, bx1 + 0.55, 0.54, 1.10, -0.65, -0.25)
        add_box(locker_tris, bx1 + 0.62, bx1 + 1.08, 0.54, 1.10, -0.65, -0.25)
        # Tier 2 (CTBs - Blue)
        add_box(ctb_blue_tris, bx1 + 0.08, bx1 + 0.55, 0.54, 1.05, -0.17, 0.25)
        add_box(ctb_blue_tris, bx1 + 0.62, bx1 + 1.08, 0.54, 1.05, -0.17, 0.25)
        # Tier 3 (CTBs - Gold / Critical Medical/Food)
        add_box(ctb_gold_tris, bx1 + 0.08, bx1 + 0.55, 0.54, 1.05, 0.33, 0.75)
        add_box(ctb_gold_tris, bx1 + 0.62, bx1 + 1.08, 0.54, 1.05, 0.33, 0.75)

        # Starboard Shelves (-Y)
        # Tier 1 (Metal Lockers)
        add_box(locker_tris, bx1 + 0.08, bx1 + 0.55, -1.10, -0.54, -0.65, -0.25)
        add_box(locker_tris, bx1 + 0.62, bx1 + 1.08, -1.10, -0.54, -0.65, -0.25)
        # Tier 2 (Metal Double Lockers)
        add_box(locker_tris, bx1 + 0.08, bx1 + 1.08, -1.10, -0.54, -0.17, 0.25)
        # Tier 3 (CTBs - Blue)
        add_box(ctb_blue_tris, bx1 + 0.08, bx1 + 0.55, -1.05, -0.54, 0.33, 0.75)
        add_box(ctb_gold_tris, bx1 + 0.62, bx1 + 1.08, -1.05, -0.54, 0.33, 0.75)

    # -------------------------------------------------------------
    # 5. IRREGULAR / OVERSIZED CARGO (AFT BULKHEAD BAY: x = -5.6 to -4.4)
    # -------------------------------------------------------------
    cryo_tris = []
    # 2x Cryogenic / Life Support Cylinders (4 ft high = 1.22m, 2 ft diameter = 0.61m)
    # Cylinder 1 (Port Aft)
    add_cylinder(cryo_tris, r=0.305, h=1.22, segments=36, center=(-5.0, 0.70, -0.05), axis='z')
    # Tie-down collar rings
    add_cylinder(cryo_tris, r=0.33, h=0.08, segments=24, center=(-5.0, 0.70, 0.35), axis='z')
    add_cylinder(cryo_tris, r=0.33, h=0.08, segments=24, center=(-5.0, 0.70, -0.45), axis='z')
    
    # Cylinder 2 (Starboard Aft)
    add_cylinder(cryo_tris, r=0.305, h=1.22, segments=36, center=(-5.0, -0.70, -0.05), axis='z')
    add_cylinder(cryo_tris, r=0.33, h=0.08, segments=24, center=(-5.0, -0.70, 0.35), axis='z')
    add_cylinder(cryo_tris, r=0.33, h=0.08, segments=24, center=(-5.0, -0.70, -0.45), axis='z')

    pod_tris = []
    # Large Science / Fabrication Equipment POD at x = 4.8m (near front hatch for early day extraction)
    add_box(pod_tris, 4.60, 5.50, 0.48, 1.15, -0.68, 0.35)
    # Handle grips and shock bumpers
    add_cylinder(pod_tris, r=0.04, h=0.80, segments=16, center=(5.05, 0.48, 0.38), axis='x')

    # -------------------------------------------------------------
    # 6. INTERNAL AUTONOMOUS CARGO ROBOT (ILTR-Gantry Manipulator)
    # -------------------------------------------------------------
    robot_tris = []
    # Positioned actively retrieving cargo at x = 1.2m
    rx = 1.20
    # Overhead trolley carriage riding the ceiling rail
    add_box(robot_tris, rx - 0.35, rx + 0.35, -0.22, 0.22, 1.12, 1.25)
    # Transverse slide bridge
    add_box(robot_tris, rx - 0.12, rx + 0.12, -0.45, 0.45, 1.05, 1.12)
    # Vertical telescoping mast
    add_cylinder(robot_tris, r=0.06, h=1.0, segments=24, center=(rx, 0.32, 0.55), axis='z')
    # End-effector manipulator / locker extractor fork
    add_box(robot_tris, rx - 0.20, rx + 0.20, 0.22, 0.48, 0.02, 0.08)
    # Grasping pads / latches
    add_box(robot_tris, rx - 0.18, rx - 0.14, 0.48, 0.65, -0.02, 0.12)
    add_box(robot_tris, rx + 0.14, rx + 0.18, 0.48, 0.65, -0.02, 0.12)

    # -------------------------------------------------------------
    # EXPORT DISCRETE BINARY STL MESHES FOR COPPELIASIM / SIMULATION
    # -------------------------------------------------------------
    write_binary_stl(os.path.join(meshes_dir, "container_hull.stl"), hull_tris + bulkhead_tris)
    write_binary_stl(os.path.join(meshes_dir, "floor_and_rails.stl"), floor_tris + rail_tris)
    write_binary_stl(os.path.join(meshes_dir, "rack_framework.stl"), rack_tris)
    write_binary_stl(os.path.join(meshes_dir, "gantry_robot.stl"), robot_tris)
    write_binary_stl(os.path.join(meshes_dir, "lockers.stl"), locker_tris)
    write_binary_stl(os.path.join(meshes_dir, "ctbs.stl"), ctb_blue_tris + ctb_gold_tris)
    write_binary_stl(os.path.join(meshes_dir, "cryo_tanks.stl"), cryo_tris)
    write_binary_stl(os.path.join(meshes_dir, "science_pod.stl"), pod_tris)
    
    print("Exported individual binary STL components.")

    # -------------------------------------------------------------
    # EXPORT FULL MULTI-PART OBJ ASSEMBLY WITH MATERIALS
    # -------------------------------------------------------------
    assembly_dict = {
        'HullOuter': hull_tris,
        'HullBulkhead': bulkhead_tris,
        'FloorDeck': floor_tris,
        'GantryRail': rail_tris,
        'RackStructure': rack_tris,
        'GantryRobot': robot_tris,
        'Lockers': locker_tris,
        'CTB_Blue': ctb_blue_tris,
        'CTB_Gold': ctb_gold_tris,
        'CryoTanks': cryo_tris,
        'SciencePODs': pod_tris
    }
    obj_path = os.path.join(out_dir, "llaso_lunar_cargo_container.obj")
    mtl_path = os.path.join(out_dir, "llaso_lunar_cargo_container.mtl")
    write_obj_scene(obj_path, assembly_dict, mtl_path)

if __name__ == "__main__":
    build_llaso_model()
