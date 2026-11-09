"""
ARC REACTOR — Blender asset pipeline
Builds a highly detailed, part-named Arc Reactor (for scroll-driven assembly in Three.js),
a Hall of Armor environment and a tokamak laboratory, exports the reactor as GLB and
renders cinematic stills used by the website.

Run:
  blender --background --factory-startup --python build_reactor.py -- --no-render
  blender --background --factory-startup --python build_reactor.py
"""

import bpy
import bmesh
import math
import os
import sys
from mathutils import Vector

ROOT = r"D:\SARIT\NOVEXA- NoirDemons\reactor website by deep seek"
OUT_GLB = os.path.join(ROOT, "public", "models", "arc_reactor.glb")
OUT_RENDERS = os.path.join(ROOT, "public", "renders")
os.makedirs(os.path.dirname(OUT_GLB), exist_ok=True)
os.makedirs(OUT_RENDERS, exist_ok=True)

RENDER = "--no-render" not in sys.argv

# ----------------------------------------------------------------------------
# scene reset
# ----------------------------------------------------------------------------
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
for coll in list(bpy.data.collections):
    bpy.data.collections.remove(coll)
for block in list(bpy.data.meshes):
    bpy.data.meshes.remove(block)
for block in list(bpy.data.materials):
    bpy.data.materials.remove(block)
for block in list(bpy.data.curves):
    bpy.data.curves.remove(block)


def collection(name):
    c = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(c)
    return c


REACTOR = collection("REACTOR")
HALL = collection("HALL")
LAB = collection("LAB")
STUDIO = collection("STUDIO")


def set_coll(obj, coll):
    for c in list(obj.users_collection):
        c.objects.unlink(obj)
    coll.objects.link(obj)
    return obj


# ----------------------------------------------------------------------------
# materials
# ----------------------------------------------------------------------------
def mat(name, color, rough=0.4, metal=0.0, emission=None, emit_strength=0.0,
        alpha=1.0, transmission=0.0, ior=1.45):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = (*color, alpha)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    try:
        b.inputs["IOR"].default_value = ior
    except Exception:
        pass
    if emission is not None:
        b.inputs["Emission Color"].default_value = (*emission, 1.0)
        b.inputs["Emission Strength"].default_value = emit_strength
    if alpha < 1.0:
        b.inputs["Alpha"].default_value = alpha
        try:
            m.blend_method = "BLEND"
        except Exception:
            pass
    try:
        b.inputs["Transmission Weight"].default_value = transmission
    except Exception:
        pass
    return m


M = {
    "titanium":     mat("titanium", (0.60, 0.65, 0.72), 0.27, 1.0),
    "titanium_hi":  mat("titanium_hi", (0.78, 0.82, 0.88), 0.18, 1.0),
    "steel":        mat("steel", (0.34, 0.37, 0.42), 0.33, 1.0),
    "steel_dark":   mat("steel_dark", (0.10, 0.115, 0.135), 0.38, 1.0),
    "chrome":       mat("chrome", (0.86, 0.89, 0.93), 0.07, 1.0),
    "copper":       mat("copper", (0.70, 0.31, 0.12), 0.30, 1.0),
    "copper_hi":    mat("copper_hi", (0.88, 0.47, 0.20), 0.24, 1.0),
    "copper_dark":  mat("copper_dark", (0.30, 0.115, 0.045), 0.44, 1.0),
    "palladium":    mat("palladium", (0.90, 0.91, 0.93), 0.11, 1.0),
    "black":        mat("black", (0.012, 0.014, 0.018), 0.46, 0.55),
    "black_soft":   mat("black_soft", (0.030, 0.034, 0.040), 0.62, 0.15),
    "rubber":       mat("rubber", (0.008, 0.008, 0.010), 0.82, 0.0),
    "glass":        mat("glass", (0.52, 0.78, 0.94), 0.035, 0.0, alpha=0.16,
                        transmission=0.96, ior=1.5),
    "glass_rim":    mat("glass_rim", (0.30, 0.52, 0.65), 0.10, 0.8),
    "plasma":       mat("plasma", (0.55, 0.88, 1.0), 0.15, 0.0,
                        emission=(0.30, 0.78, 1.0), emit_strength=10.0),
    "plasma_hot":   mat("plasma_hot", (0.90, 0.97, 1.0), 0.08, 0.0,
                        emission=(0.70, 0.93, 1.0), emit_strength=22.0),
    "plasma_soft":  mat("plasma_soft", (0.20, 0.55, 0.95), 0.25, 0.0,
                        emission=(0.08, 0.42, 1.0), emit_strength=5.0, alpha=0.5),
    "blue_emit":    mat("blue_emit", (0.02, 0.20, 0.48), 0.28, 0.1,
                        emission=(0.03, 0.42, 1.0), emit_strength=6.0),
    "white_emit":   mat("white_emit", (0.92, 0.97, 1.0), 0.2, 0.0,
                        emission=(0.85, 0.95, 1.0), emit_strength=7.0),
    "gold":         mat("gold", (0.82, 0.58, 0.18), 0.26, 1.0),
    "red":          mat("red", (0.42, 0.018, 0.016), 0.34, 0.35),
    "red_hi":       mat("red_hi", (0.62, 0.04, 0.03), 0.30, 0.35),
    "green":        mat("green", (0.08, 0.85, 0.42), 0.3, 0.2,
                        emission=(0.04, 1.0, 0.35), emit_strength=5.0),
    "room":         mat("room", (0.018, 0.020, 0.024), 0.55, 0.3),
    "room_panel":   mat("room_panel", (0.028, 0.032, 0.038), 0.42, 0.6),
    "floor":        mat("floor", (0.014, 0.016, 0.020), 0.22, 0.75),
}


# ----------------------------------------------------------------------------
# helpers
# ----------------------------------------------------------------------------
def activate(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def bevel(obj, width=0.012, segments=3, angle=math.radians(50)):
    if obj.type != "MESH":
        return obj
    activate(obj)
    md = obj.modifiers.new("bevel", "BEVEL")
    md.width = width
    md.segments = segments
    md.limit_method = "ANGLE"
    md.angle_limit = angle
    try:
        bpy.ops.object.modifier_apply(modifier=md.name)
    except Exception:
        pass
    return obj


def shade_smooth(obj):
    if obj.type == "MESH":
        for p in obj.data.polygons:
            p.use_smooth = True
    return obj


def new_mesh(name, verts, faces, material, coll=REACTOR, loc=(0, 0, 0),
             rot=(0, 0, 0), smooth=False):
    me = bpy.data.meshes.new(name + "_mesh")
    me.from_pydata(verts, [], faces)
    me.validate()
    me.update()
    ob = bpy.data.objects.new(name, me)
    coll.objects.link(ob)
    ob.location = loc
    ob.rotation_euler = rot
    ob.data.materials.append(M[material])
    if smooth:
        shade_smooth(ob)
    # recalc normals
    activate(ob)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode="OBJECT")
    return ob


def box(name, size, loc, material, rot=(0, 0, 0), b=0.012, coll=REACTOR):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    ob = bpy.context.object
    ob.name = name
    ob.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    set_coll(ob, coll)
    ob.data.materials.append(M[material])
    if b:
        bevel(ob, b, 3)
    return ob


def cyl(name, r, depth, loc, material, rot=(0, 0, 0), verts=48, b=0.008,
        coll=REACTOR, smooth=True):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth,
                                        location=loc, rotation=rot)
    ob = bpy.context.object
    ob.name = name
    set_coll(ob, coll)
    ob.data.materials.append(M[material])
    if smooth:
        shade_smooth(ob)
    if b:
        bevel(ob, b, 2)
    return ob


def cone(name, r1, r2, depth, loc, material, rot=(0, 0, 0), verts=48,
         coll=REACTOR):
    bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r1, radius2=r2,
                                    depth=depth, location=loc, rotation=rot)
    ob = bpy.context.object
    ob.name = name
    set_coll(ob, coll)
    ob.data.materials.append(M[material])
    shade_smooth(ob)
    return ob


def torus(name, major, minor, loc, material, rot=(0, 0, 0), maj_seg=64,
          min_seg=16, coll=REACTOR):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor,
                                     major_segments=maj_seg, minor_segments=min_seg,
                                     location=loc, rotation=rot)
    ob = bpy.context.object
    ob.name = name
    set_coll(ob, coll)
    ob.data.materials.append(M[material])
    shade_smooth(ob)
    return ob


def sphere(name, r, loc, material, scale=(1, 1, 1), seg=32, rings=20,
           coll=REACTOR, smooth=True):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=rings,
                                         radius=r, location=loc)
    ob = bpy.context.object
    ob.name = name
    ob.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    set_coll(ob, coll)
    ob.data.materials.append(M[material])
    if smooth:
        shade_smooth(ob)
    return ob


def ring_sector(name, ri, ro, z0, z1, span, material, angle=0.0, seg=18,
                b=0.012, coll=REACTOR):
    """Curved plate in local space, rotated around local Z by `angle`."""
    verts = []
    faces = []
    a0, a1 = -span * 0.5, span * 0.5
    for i in range(seg + 1):
        a = a0 + (a1 - a0) * i / seg
        ca, sa = math.cos(a), math.sin(a)
        verts.append((ri * ca, ri * sa, z0))
        verts.append((ro * ca, ro * sa, z0))
        verts.append((ro * ca, ro * sa, z1))
        verts.append((ri * ca, ri * sa, z1))
    for i in range(seg):
        a = i * 4
        b2 = (i + 1) * 4
        faces.append((a + 1, b2 + 1, b2 + 2, a + 2))   # outer
        faces.append((a + 0, a + 3, b2 + 3, b2 + 0))   # inner
        faces.append((a + 2, b2 + 2, b2 + 3, a + 3))   # top
        faces.append((a + 0, b2 + 0, b2 + 1, a + 1))   # bottom
    faces.append((0, 1, 2, 3))
    faces.append((seg * 4 + 0, seg * 4 + 3, seg * 4 + 2, seg * 4 + 1))
    ob = new_mesh(name, verts, faces, material, coll, rot=(0, 0, angle))
    if b:
        bevel(ob, b, 2)
    return ob


def tube(name, pts, radius, material, loc=(0, 0, 0), rot=(0, 0, 0),
         cyclic=False, coll=REACTOR, res=2):
    cu = bpy.data.curves.new(name + "_curve", "CURVE")
    cu.dimensions = "3D"
    cu.resolution_u = 1
    cu.bevel_depth = radius
    cu.bevel_resolution = res
    sp = cu.splines.new("POLY")
    sp.points.add(len(pts) - 1)
    for i, p in enumerate(pts):
        sp.points[i].co = (p[0], p[1], p[2], 1.0)
    sp.use_cyclic_u = cyclic
    ob = bpy.data.objects.new(name, cu)
    coll.objects.link(ob)
    ob.location = loc
    ob.rotation_euler = rot
    ob.data.materials.append(M[material])
    activate(ob)
    bpy.ops.object.convert(target="MESH")
    ob = bpy.context.object
    ob.name = name
    shade_smooth(ob)
    return ob


def helix_x(name, length, radius, turns, wire_r, material, loc, rot,
            coll=REACTOR, steps=26):
    pts = []
    n = max(1, int(turns * steps))
    for i in range(n + 1):
        t = i / n
        pts.append(((t - 0.5) * length,
                    radius * math.cos(t * turns * math.tau),
                    radius * math.sin(t * turns * math.tau)))
    return tube(name, pts, wire_r, material, loc, rot, coll=coll, res=2)


def helix_z(name, radius, z0, z1, turns, wire_r, material, loc=(0, 0, 0),
            coll=REACTOR, steps=30):
    pts = []
    n = max(1, int(turns * steps))
    for i in range(n + 1):
        t = i / n
        a = t * turns * math.tau
        pts.append((radius * math.cos(a), radius * math.sin(a),
                    z0 + (z1 - z0) * t))
    return tube(name, pts, wire_r, material, loc, coll=coll, res=2)


def bolt(name, loc, material="chrome", r=0.022, h=0.03, rot=(0, 0, 0),
         coll=REACTOR):
    return cyl(name, r, h, loc, material, rot=rot, verts=6, b=0.002, coll=coll)


def radial(obj_list, angle, radius, z, name_prefix):
    """helper: place small objects radially"""
    out = []
    for i, (size, dz, matn) in enumerate(obj_list):
        x = radius * math.cos(angle)
        y = radius * math.sin(angle)
        out.append(box(f"{name_prefix}_{i}", size, (x, y, z + dz), matn,
                       rot=(0, 0, angle)))
    return out


# ============================================================================
# REACTOR
# ============================================================================
print("BUILD reactor...")

# ---- base ---------------------------------------------------------------
cyl("base_plate", 1.90, 0.10, (0, 0, -0.94), "steel_dark", verts=64, b=0.02)
cyl("base_inner", 1.55, 0.12, (0, 0, -0.88), "black_soft", verts=64, b=0.02)
torus("base_ring", 1.78, 0.045, (0, 0, -0.885), "chrome", maj_seg=80, min_seg=12)
torus("base_ring_inner", 1.42, 0.028, (0, 0, -0.865), "titanium", maj_seg=72, min_seg=10)
for i in range(12):
    a = i * math.tau / 12
    x, y = 1.72 * math.cos(a), 1.72 * math.sin(a)
    box(f"base_foot_{i:02d}", (0.16, 0.28, 0.10), (x, y, -0.99), "black",
        rot=(0, 0, a), b=0.02)
    bolt(f"base_bolt_{i:02d}", (1.62 * math.cos(a), 1.62 * math.sin(a), -0.845),
         "chrome", r=0.024, h=0.025)
for i in range(24):
    a = i * math.tau / 24 + math.tau / 48
    bolt(f"base_bolt_rim_{i:02d}", (1.86 * math.cos(a), 1.86 * math.sin(a), -0.885),
         "steel", r=0.018, h=0.022)
for i in range(12):
    a = i * math.tau / 12
    box(f"base_vent_{i:02d}", (0.20, 0.035, 0.035),
        (1.60 * math.cos(a), 1.60 * math.sin(a), -0.90), "black",
        rot=(0, 0, a), b=0.006)

# ---- cooling system -----------------------------------------------------
for i in range(12):
    a = i * math.tau / 12
    x, y = 1.44 * math.cos(a), 1.44 * math.sin(a)
    box(f"cooling_fin_{i:02d}", (0.52, 0.055, 0.30), (x, y, -0.63),
        "steel_dark", rot=(0, 0, a), b=0.012)
    box(f"cooling_fin_cap_{i:02d}", (0.10, 0.075, 0.20),
        (1.66 * math.cos(a), 1.66 * math.sin(a), -0.63),
        "copper_dark", rot=(0, 0, a), b=0.01)
    bolt(f"cooling_bolt_{i:02d}", (1.20 * math.cos(a), 1.20 * math.sin(a), -0.48),
         "chrome", r=0.018, h=0.02)
torus("cooling_grille", 1.30, 0.06, (0, 0, -0.76), "steel", maj_seg=72, min_seg=12)
torus("cooling_grille_inner", 0.92, 0.045, (0, 0, -0.78), "black_soft", maj_seg=64, min_seg=10)
cyl("cooling_exhaust", 0.52, 0.12, (0, 0, -0.82), "black", verts=48, b=0.01)
for i in range(8):
    a = i * math.tau / 8
    box(f"cooling_exhaust_vent_{i:02d}", (0.22, 0.03, 0.04),
        (0.30 * math.cos(a), 0.30 * math.sin(a), -0.88), "steel_dark",
        rot=(0, 0, a), b=0.004)
# heat pipes from converter to fins
for i in range(4):
    a = i * math.tau / 4 + math.tau / 8
    pts = []
    for k in range(9):
        t = k / 8
        r = 0.70 + (1.35 - 0.70) * t
        z = -0.28 - 0.34 * t
        pts.append((r * math.cos(a + 0.10 * math.sin(t * math.pi)),
                    r * math.sin(a + 0.10 * math.sin(t * math.pi)), z))
    tube(f"cooling_pipe_{i}", pts, 0.028, "copper_dark", res=1)

# ---- energy converter ---------------------------------------------------
cyl("converter_body", 0.68, 0.42, (0, 0, -0.34), "steel_dark", verts=64, b=0.012)
cyl("converter_core", 0.44, 0.36, (0, 0, -0.34), "blue_emit", verts=48, b=0.008)
helix_z("converter_wire", 0.72, -0.53, -0.15, 7, 0.026, "copper", steps=26)
for i, z in enumerate((-0.53, -0.43, -0.33, -0.23, -0.15)):
    torus(f"converter_ring_{i}", 0.735, 0.020, (0, 0, z), "copper_hi",
          maj_seg=64, min_seg=10)
torus("converter_lip_top", 0.70, 0.045, (0, 0, -0.12), "titanium", maj_seg=64, min_seg=12)
torus("converter_lip_bot", 0.70, 0.045, (0, 0, -0.56), "titanium", maj_seg=64, min_seg=12)
for i in range(4):
    a = i * math.tau / 4 + math.tau / 8
    box(f"converter_bracket_{i}", (0.16, 0.10, 0.26),
        (0.78 * math.cos(a), 0.78 * math.sin(a), -0.30), "titanium",
        rot=(0, 0, a), b=0.012)
    bolt(f"converter_bolt_{i}", (0.78 * math.cos(a), 0.78 * math.sin(a), -0.15),
         "chrome", r=0.02, h=0.022)

# ---- chamber cage -------------------------------------------------------
for i in range(12):
    a = i * math.tau / 12
    x, y = 0.80 * math.cos(a), 0.80 * math.sin(a)
    box(f"chamber_rib_{i:02d}", (0.075, 0.12, 0.78), (x, y, 0.28),
        "titanium", rot=(0, 0, a), b=0.012)
    box(f"chamber_rib_dark_{i:02d}", (0.035, 0.05, 0.56),
        (0.79 * math.cos(a), 0.79 * math.sin(a), 0.28),
        "black", rot=(0, 0, a), b=0.004)
    bolt(f"chamber_rib_bolt_{i:02d}", (0.84 * math.cos(a), 0.84 * math.sin(a), 0.66),
         "chrome", r=0.014, h=0.018)
torus("chamber_ring_top", 0.82, 0.055, (0, 0, 0.68), "titanium_hi", maj_seg=72, min_seg=14)
torus("chamber_ring_bot", 0.82, 0.055, (0, 0, -0.10), "titanium_hi", maj_seg=72, min_seg=14)
torus("chamber_band_mid", 0.82, 0.030, (0, 0, 0.29), "copper", maj_seg=72, min_seg=10)
torus("chamber_band_low", 0.82, 0.030, (0, 0, 0.09), "steel", maj_seg=72, min_seg=10)
# inner slotted barrel
cyl("chamber_inner", 0.58, 0.70, (0, 0, 0.28), "steel_dark", verts=64, b=0.008)
for i in range(16):
    a = i * math.tau / 16
    box(f"chamber_slot_{i:02d}", (0.035, 0.018, 0.44),
        (0.585 * math.cos(a), 0.585 * math.sin(a), 0.30), "blue_emit",
        rot=(0, 0, a), b=0.003)
    box(f"chamber_slot_rim_{i:02d}", (0.022, 0.026, 0.50),
        (0.605 * math.cos(a), 0.605 * math.sin(a), 0.30), "black",
        rot=(0, 0, a), b=0.002)
# glass containment
cyl("glass_cylinder", 0.72, 0.74, (0, 0, 0.29), "glass", verts=64, b=0.0)
torus("glass_rim_top", 0.725, 0.030, (0, 0, 0.66), "glass_rim", maj_seg=72, min_seg=10)
torus("glass_rim_bot", 0.725, 0.030, (0, 0, -0.08), "glass_rim", maj_seg=72, min_seg=10)

# ---- palladium core -----------------------------------------------------
torus("palladium_ring", 0.43, 0.055, (0, 0, 0.18), "palladium", maj_seg=72, min_seg=14)
torus("palladium_ring_inner", 0.34, 0.022, (0, 0, 0.18), "chrome", maj_seg=64, min_seg=10)
cyl("palladium_hub", 0.27, 0.10, (0, 0, 0.18), "palladium", verts=48, b=0.008)
for i in range(6):
    a = i * math.tau / 6
    box(f"palladium_spoke_{i}", (0.16, 0.045, 0.045),
        (0.32 * math.cos(a), 0.32 * math.sin(a), 0.18), "titanium",
        rot=(0, 0, a), b=0.006)
# deuterium feed tubes
for i in range(4):
    a = i * math.tau / 4 + math.tau / 8
    pts = []
    for k in range(11):
        t = k / 10
        r = 1.34 + (0.50 - 1.34) * t
        z = 0.24 + 0.10 * math.sin(t * math.pi) - 0.06 * t
        pts.append((r * math.cos(a), r * math.sin(a), z))
    tube(f"deuterium_tube_{i}", pts, 0.030, "copper_hi", res=2)
    cyl(f"deuterium_valve_{i}", 0.075, 0.12,
        (1.34 * math.cos(a), 1.34 * math.sin(a), 0.24), "titanium",
        rot=(math.radians(90), 0, a), verts=24, b=0.006)
    torus(f"deuterium_valve_ring_{i}", 0.08, 0.014,
          (1.34 * math.cos(a), 1.34 * math.sin(a), 0.24), "copper",
          rot=(math.radians(90), 0, a), maj_seg=32, min_seg=8)

# ---- cyclotron ----------------------------------------------------------
cyl("cyclotron_disc", 0.66, 0.075, (0, 0, -0.055), "steel_dark", verts=64, b=0.008)
torus("cyclotron_rim", 0.64, 0.028, (0, 0, -0.02), "titanium", maj_seg=72, min_seg=10)
# archimedean spiral emitter
pts = []
for i in range(161):
    t = i / 160
    a = t * 4.2 * math.tau
    r = 0.10 + 0.46 * t
    pts.append((r * math.cos(a), r * math.sin(a), -0.012))
tube("cyclotron_spiral", pts, 0.011, "blue_emit", res=1)
for i in range(12):
    a = i * math.tau / 12
    box(f"cyclotron_fin_{i:02d}", (0.20, 0.045, 0.10),
        (0.44 * math.cos(a), 0.44 * math.sin(a), -0.09), "copper",
        rot=(0, 0, a), b=0.008)
cyl("cyclotron_emitter", 0.14, 0.16, (0, 0, 0.06), "titanium_hi", verts=32, b=0.006)
cone("cyclotron_emitter_tip", 0.10, 0.02, 0.12, (0, 0, 0.16), "plasma_hot", verts=32)

# ---- plasma core --------------------------------------------------------
sphere("plasma_core", 0.255, (0, 0, 0.20), "plasma_hot", seg=48, rings=32)
sphere("plasma_shell_0", 0.34, (0, 0, 0.20), "plasma_soft", seg=40, rings=24)
sphere("plasma_shell_1", 0.43, (0, 0, 0.20), "plasma_soft", seg=40, rings=24)
torus("plasma_torus", 0.50, 0.040, (0, 0, 0.20), "plasma", maj_seg=96, min_seg=14)
for i, (r, z) in enumerate(((0.56, 0.20), (0.60, 0.20), (0.65, 0.20))):
    torus(f"plasma_ring_{i}", r, 0.012, (0, 0, z), "plasma", maj_seg=96, min_seg=8)

# ---- containment rings --------------------------------------------------
for i, (r, z) in enumerate(((1.06, 0.02), (1.16, 0.19), (1.26, 0.36))):
    torus(f"containment_{i:02d}_ring", r, 0.035, (0, 0, z), "steel_dark",
          maj_seg=96, min_seg=12)
    torus(f"containment_{i:02d}_glow", r, 0.013, (0, 0, z), "blue_emit",
          maj_seg=96, min_seg=8)
    for k in range(6):
        a = k * math.tau / 6 + i * math.tau / 18
        box(f"containment_{i:02d}_bracket_{k}", (0.16, 0.05, 0.10),
            (r * math.cos(a), r * math.sin(a), z), "titanium",
            rot=(0, 0, a), b=0.008)

# ---- ten top coils ------------------------------------------------------
COIL_R = 1.47
COIL_Z = 0.58
for i in range(10):
    a = i * math.tau / 10
    x, y = COIL_R * math.cos(a), COIL_R * math.sin(a)
    rot = (0, 0, a + math.radians(90))
    # base plate / bracket
    box(f"coil_{i:02d}_base", (0.34, 0.22, 0.07), (x, y, COIL_Z - 0.16),
        "steel_dark", rot=rot, b=0.012)
    # rounded core
    box(f"coil_{i:02d}_core", (0.40, 0.24, 0.26), (x, y, COIL_Z), "titanium",
        rot=rot, b=0.045)
    box(f"coil_{i:02d}_core_top", (0.30, 0.18, 0.05), (x, y, COIL_Z + 0.14),
        "copper_dark", rot=rot, b=0.012)
    # copper winding around the core (axis local X)
    helix_x(f"coil_{i:02d}_wire", 0.36, 0.145, 5.5, 0.018, "copper_hi",
            (x, y, COIL_Z), rot, steps=18)
    # side cheeks
    box(f"coil_{i:02d}_cheek_l", (0.035, 0.26, 0.28),
        (x - 0.20 * math.cos(a + math.radians(90)),
         y - 0.20 * math.sin(a + math.radians(90)), COIL_Z),
        "titanium_hi", rot=rot, b=0.008)
    box(f"coil_{i:02d}_cheek_r", (0.035, 0.26, 0.28),
        (x + 0.20 * math.cos(a + math.radians(90)),
         y + 0.20 * math.sin(a + math.radians(90)), COIL_Z),
        "titanium_hi", rot=rot, b=0.008)
    bolt(f"coil_{i:02d}_bolt", (x, y, COIL_Z - 0.20), "chrome", r=0.018, h=0.02)

# ---- outer shell segments ----------------------------------------------
SHELL_N = 10
SHELL_SPAN = math.radians(33.0)
for i in range(SHELL_N):
    a = i * math.tau / SHELL_N
    ring_sector(f"shell_{i:02d}_plate", 1.64, 1.86, -0.38, 0.50, SHELL_SPAN,
                "titanium", angle=a, seg=16, b=0.014)
    # copper inset on outer face
    ring_sector(f"shell_{i:02d}_copper", 1.862, 1.885, -0.06, 0.34,
                SHELL_SPAN * 0.68, "copper", angle=a, seg=12, b=0.006)
    # top trim
    ring_sector(f"shell_{i:02d}_trim", 1.64, 1.88, 0.46, 0.505,
                SHELL_SPAN * 0.94, "titanium_hi", angle=a, seg=16, b=0.006)
    # vertical vents
    for k, off in enumerate((-0.42, 0.42)):
        ring_sector(f"shell_{i:02d}_vent_{k}", 1.845, 1.875, -0.30, 0.36,
                    SHELL_SPAN * 0.10, "black", angle=a + off * SHELL_SPAN,
                    seg=4, b=0.003)
    # bolts
    for k, (dx, dz) in enumerate(((-0.62, 0.38), (0.62, 0.38), (-0.62, -0.28), (0.62, -0.28))):
        aa = a + dx * SHELL_SPAN
        bolt(f"shell_{i:02d}_bolt_{k}",
             (1.90 * math.cos(aa), 1.90 * math.sin(aa), dz), "chrome",
             r=0.018, h=0.022)

# ---- top cap ------------------------------------------------------------
torus("topcap_ring", 1.52, 0.055, (0, 0, 0.55), "titanium_hi", maj_seg=96, min_seg=14)
torus("topcap_ring_inner", 1.20, 0.035, (0, 0, 0.60), "copper", maj_seg=80, min_seg=10)
for i in range(10):
    a = i * math.tau / 10
    box(f"topcap_segment_{i:02d}", (0.26, 0.16, 0.07),
        (1.36 * math.cos(a), 1.36 * math.sin(a), 0.61), "titanium",
        rot=(0, 0, a), b=0.012)
    bolt(f"topcap_bolt_{i:02d}", (1.52 * math.cos(a), 1.52 * math.sin(a), 0.60),
         "chrome", r=0.016, h=0.02)
cyl("topcap_lens_rim", 0.60, 0.06, (0, 0, 0.62), "steel_dark", verts=64, b=0.008)
cyl("topcap_lens", 0.52, 0.05, (0, 0, 0.655), "glass", verts=64, b=0.0)
cyl("topcap_core", 0.34, 0.045, (0, 0, 0.67), "plasma_hot", verts=48, b=0.004)
torus("topcap_lens_ring", 0.54, 0.022, (0, 0, 0.66), "chrome", maj_seg=64, min_seg=10)

# ---- wiring details -----------------------------------------------------
for i in range(6):
    a = i * math.tau / 6 + math.tau / 12
    pts = []
    for k in range(9):
        t = k / 8
        r = 0.86 + 0.36 * t
        z = -0.10 + 0.50 * t + 0.06 * math.sin(t * math.pi * 2)
        pts.append((r * math.cos(a + 0.12 * t), r * math.sin(a + 0.12 * t), z))
    tube(f"detail_wire_{i}", pts, 0.014, "rubber", res=1)

# ============================================================================
# HALL OF ARMOR
# ============================================================================
print("BUILD hall...")

# floor + back wall
box("hall_floor", (18, 14, 0.2), (0, 2.0, -1.05), "floor", b=0.02, coll=HALL)
box("hall_wall", (18, 0.25, 7.0), (0, 6.8, 2.4), "room", b=0.02, coll=HALL)
for i in range(14):
    box(f"hall_wall_panel_{i:02d}", (1.15, 0.10, 5.6),
        (-8.0 + i * 1.23, 6.60, 2.3), "room_panel", b=0.01, coll=HALL)

# overhead light bars
for i in range(7):
    box(f"hall_light_{i:02d}", (0.08, 0.08, 3.0),
        (-6.6 + i * 2.2, 5.9, 3.2), "white_emit", b=0.005, coll=HALL)

# alcoves + suits
for s in range(4):
    x = -4.65 + s * 3.10
    # alcove frame
    box(f"alcove_{s}_back", (2.55, 0.18, 4.6), (x, 6.35, 1.55), "room_panel",
        b=0.02, coll=HALL)
    box(f"alcove_{s}_left", (0.12, 0.55, 4.6), (x - 1.34, 6.20, 1.55),
        "steel_dark", b=0.01, coll=HALL)
    box(f"alcove_{s}_right", (0.12, 0.55, 4.6), (x + 1.34, 6.20, 1.55),
        "steel_dark", b=0.01, coll=HALL)
    box(f"alcove_{s}_top", (2.8, 0.55, 0.16), (x, 6.20, 3.86), "steel_dark",
        b=0.01, coll=HALL)
    box(f"alcove_{s}_plinth", (2.25, 1.45, 0.18), (x, 5.75, -0.02),
        "room_panel", b=0.02, coll=HALL)
    # light strips
    box(f"alcove_{s}_light_l", (0.035, 0.10, 3.6), (x - 1.18, 5.92, 1.75),
        "white_emit", b=0.003, coll=HALL)
    box(f"alcove_{s}_light_r", (0.035, 0.10, 3.6), (x + 1.18, 5.92, 1.75),
        "white_emit", b=0.003, coll=HALL)
    box(f"alcove_{s}_light_top", (2.1, 0.10, 0.035), (x, 5.92, 3.70),
        "white_emit", b=0.003, coll=HALL)
    # suit
    z0 = 0.10
    # boots
    box(f"suit_{s}_boot_l", (0.32, 0.52, 0.22), (x - 0.24, 5.45, z0 + 0.11),
        "red", b=0.04, coll=HALL)
    box(f"suit_{s}_boot_r", (0.32, 0.52, 0.22), (x + 0.24, 5.45, z0 + 0.11),
        "red", b=0.04, coll=HALL)
    # lower legs
    cyl(f"suit_{s}_shin_l", 0.16, 1.0, (x - 0.24, 5.45, z0 + 0.70), "red",
        verts=20, b=0.03, coll=HALL)
    cyl(f"suit_{s}_shin_r", 0.16, 1.0, (x + 0.24, 5.45, z0 + 0.70), "red",
        verts=20, b=0.03, coll=HALL)
    sphere(f"suit_{s}_knee_l", 0.19, (x - 0.24, 5.42, z0 + 1.20), "gold",
           seg=20, rings=12, coll=HALL)
    sphere(f"suit_{s}_knee_r", 0.19, (x + 0.24, 5.42, z0 + 1.20), "gold",
           seg=20, rings=12, coll=HALL)
    # thighs
    cyl(f"suit_{s}_thigh_l", 0.20, 0.95, (x - 0.24, 5.42, z0 + 1.60), "red",
        verts=20, b=0.04, coll=HALL)
    cyl(f"suit_{s}_thigh_r", 0.20, 0.95, (x + 0.24, 5.42, z0 + 1.60), "red",
        verts=20, b=0.04, coll=HALL)
    # pelvis / belt
    box(f"suit_{s}_pelvis", (0.66, 0.38, 0.30), (x, 5.42, z0 + 2.02),
        "red_hi", b=0.06, coll=HALL)
    box(f"suit_{s}_belt", (0.72, 0.42, 0.10), (x, 5.42, z0 + 2.16),
        "gold", b=0.03, coll=HALL)
    # torso
    box(f"suit_{s}_torso", (0.82, 0.42, 0.95), (x, 5.42, z0 + 2.62),
        "red", b=0.10, coll=HALL)
    box(f"suit_{s}_chest", (0.72, 0.14, 0.62), (x, 5.19, z0 + 2.66),
        "red_hi", b=0.06, coll=HALL)
    box(f"suit_{s}_abs", (0.54, 0.12, 0.42), (x, 5.20, z0 + 2.30),
        "gold", b=0.03, coll=HALL)
    # chest reactor
    cyl(f"suit_{s}_reactor_rim", 0.13, 0.04, (x, 5.10, z0 + 2.72),
        "steel_dark", rot=(math.radians(90), 0, 0), verts=32, b=0.006, coll=HALL)
    cyl(f"suit_{s}_reactor", 0.095, 0.05, (x, 5.075, z0 + 2.72),
        "plasma_hot", rot=(math.radians(90), 0, 0), verts=32, b=0.004, coll=HALL)
    # shoulders
    sphere(f"suit_{s}_shoulder_l", 0.27, (x - 0.52, 5.42, z0 + 2.88), "red",
           scale=(1.0, 0.9, 1.0), seg=24, rings=14, coll=HALL)
    sphere(f"suit_{s}_shoulder_r", 0.27, (x + 0.52, 5.42, z0 + 2.88), "red",
           scale=(1.0, 0.9, 1.0), seg=24, rings=14, coll=HALL)
    # arms
    cyl(f"suit_{s}_upperarm_l", 0.13, 0.85, (x - 0.60, 5.42, z0 + 2.42),
        "red", rot=(0, math.radians(8), 0), verts=18, b=0.025, coll=HALL)
    cyl(f"suit_{s}_upperarm_r", 0.13, 0.85, (x + 0.60, 5.42, z0 + 2.42),
        "red", rot=(0, math.radians(-8), 0), verts=18, b=0.025, coll=HALL)
    sphere(f"suit_{s}_elbow_l", 0.145, (x - 0.65, 5.42, z0 + 2.00), "gold",
           seg=18, rings=10, coll=HALL)
    sphere(f"suit_{s}_elbow_r", 0.145, (x + 0.65, 5.42, z0 + 2.00), "gold",
           seg=18, rings=10, coll=HALL)
    cyl(f"suit_{s}_forearm_l", 0.115, 0.80, (x - 0.68, 5.42, z0 + 1.62),
        "red_hi", verts=18, b=0.022, coll=HALL)
    cyl(f"suit_{s}_forearm_r", 0.115, 0.80, (x + 0.68, 5.42, z0 + 1.62),
        "red_hi", verts=18, b=0.022, coll=HALL)
    sphere(f"suit_{s}_hand_l", 0.13, (x - 0.70, 5.42, z0 + 1.20), "red",
           seg=18, rings=10, coll=HALL)
    sphere(f"suit_{s}_hand_r", 0.13, (x + 0.70, 5.42, z0 + 1.20), "red",
           seg=18, rings=10, coll=HALL)
    # neck + helmet
    cyl(f"suit_{s}_neck", 0.16, 0.18, (x, 5.42, z0 + 3.16), "steel_dark",
        verts=20, b=0.02, coll=HALL)
    sphere(f"suit_{s}_helmet", 0.31, (x, 5.42, z0 + 3.42), "red",
           scale=(0.95, 0.95, 1.08), seg=28, rings=18, coll=HALL)
    box(f"suit_{s}_face", (0.36, 0.12, 0.30), (x, 5.16, z0 + 3.42),
        "gold", b=0.06, coll=HALL)
    box(f"suit_{s}_eye_l", (0.10, 0.035, 0.035), (x - 0.09, 5.09, z0 + 3.48),
        "white_emit", b=0.006, coll=HALL)
    box(f"suit_{s}_eye_r", (0.10, 0.035, 0.035), (x + 0.09, 5.09, z0 + 3.48),
        "white_emit", b=0.006, coll=HALL)

# ============================================================================
# TOKAMAK LAB
# ============================================================================
print("BUILD lab...")

LX, LY, LZ = 6.0, 8.0, 1.9
box("lab_floor", (16, 16, 0.2), (0, 3.0, -1.1), "floor", b=0.02, coll=LAB)
box("lab_wall", (16, 0.25, 8.0), (0, 8.0, 2.8), "room", b=0.02, coll=LAB)
for i in range(12):
    box(f"lab_wall_panel_{i:02d}", (1.20, 0.10, 6.4),
        (-6.6 + i * 1.20, 7.85, 2.7), "room_panel", b=0.01, coll=LAB)
torus("tokamak_torus", 2.15, 0.68, (LX, LY, LZ), "steel_dark",
      maj_seg=96, min_seg=28, coll=LAB)
torus("tokamak_torus_inner", 2.15, 0.50, (LX, LY, LZ), "black",
      maj_seg=96, min_seg=24, coll=LAB)
torus("tokamak_glow", 2.15, 0.30, (LX, LY, LZ), "plasma",
      maj_seg=96, min_seg=20, coll=LAB)
cyl("tokamak_column", 0.72, 3.2, (LX, LY, LZ), "steel_dark",
    verts=48, b=0.02, coll=LAB)
torus("tokamak_column_ring", 0.76, 0.06, (LX, LY, LZ + 0.8), "copper",
      maj_seg=48, min_seg=10, coll=LAB)
for i in range(16):
    a = i * math.tau / 16
    box(f"tokamak_coil_{i:02d}", (0.30, 0.52, 1.55),
        (LX + 2.15 * math.cos(a), LY + 2.15 * math.sin(a), LZ),
        "copper", rot=(0, 0, a), b=0.03, coll=LAB)
    box(f"tokamak_coil_cap_{i:02d}", (0.36, 0.58, 0.12),
        (LX + 2.15 * math.cos(a), LY + 2.15 * math.sin(a), LZ + 0.82),
        "steel_dark", rot=(0, 0, a), b=0.01, coll=LAB)
# pipes
for i in range(5):
    a = i * math.tau / 5 + math.tau / 10
    pts = []
    for k in range(9):
        t = k / 8
        r = 2.15 + 0.65 * t
        z = LZ - 0.4 - 1.0 * t
        pts.append((LX + r * math.cos(a), LY + r * math.sin(a), z))
    tube(f"lab_pipe_{i}", pts, 0.09, "steel", coll=LAB, res=2)
# hanging lights
for i in range(5):
    box(f"lab_light_{i:02d}", (0.10, 0.10, 2.4),
        (LX - 3.2 + i * 1.6, LY - 1.6, 3.0), "white_emit", b=0.006, coll=LAB)

# ============================================================================
# LIGHTS + WORLD
# ============================================================================
print("LIGHTS...")
world = bpy.data.worlds.new("World")
bpy.context.scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes.get("Background")
bg.inputs[0].default_value = (0.002, 0.004, 0.008, 1.0)
bg.inputs[1].default_value = 0.18


def light(name, kind, loc, energy, color=(1, 1, 1), size=4.0, rot=(0, 0, 0)):
    ld = bpy.data.lights.new(name, kind)
    ld.energy = energy
    ld.color = color
    if kind == "AREA":
        ld.shape = "DISK"
        ld.size = size
    if kind == "POINT":
        ld.shadow_soft_size = 0.5
    ob = bpy.data.objects.new(name, ld)
    STUDIO.objects.link(ob)
    ob.location = loc
    ob.rotation_euler = rot
    return ob


light("key", "AREA", (4.5, -5.0, 6.0), 900, (1.0, 0.96, 0.90), 5.5)
light("rim_blue", "AREA", (-5.0, 2.0, 4.0), 700, (0.25, 0.55, 1.0), 4.0)
light("rim_cyan", "AREA", (5.0, 1.0, 2.0), 500, (0.35, 0.80, 1.0), 3.5)
light("fill", "AREA", (0.0, -6.0, 0.5), 120, (0.55, 0.70, 1.0), 6.0)
light("top", "AREA", (0.0, 0.0, 6.5), 500, (0.9, 0.95, 1.0), 3.0)
light("core", "POINT", (0.0, 0.0, 0.2), 30, (0.35, 0.75, 1.0))
# hall lights
for s in range(4):
    x = -4.65 + s * 3.10
    light(f"hall_spot_{s}", "SPOT", (x, 4.8, 5.2), 600, (0.85, 0.92, 1.0), 2.0,
          rot=(math.radians(25), 0, 0))
# lab lights
light("lab_key", "AREA", (LX - 4.0, LY - 4.0, 5.0), 1200, (0.55, 0.75, 1.0), 6.0)
light("lab_rim", "AREA", (LX + 4.0, LY + 1.0, 3.5), 900, (0.30, 0.55, 1.0), 5.0)

# ============================================================================
# EXPORT GLB (reactor only)
# ============================================================================
print("EXPORT...")
bpy.ops.object.select_all(action="DESELECT")
reactor_meshes = [o for o in REACTOR.objects if o.type == "MESH"]
for o in reactor_meshes:
    o.select_set(True)
if reactor_meshes:
    bpy.context.view_layer.objects.active = reactor_meshes[0]
bpy.ops.export_scene.gltf(
    filepath=OUT_GLB,
    export_format="GLB",
    use_selection=True,
    export_apply=True,
    export_yup=True,
    export_materials="EXPORT",
    export_cameras=False,
    export_lights=False,
    export_extras=True,
)
print("EXPORTED", OUT_GLB, os.path.getsize(OUT_GLB), "bytes",
      "parts:", len(reactor_meshes))

# ============================================================================
# RENDER
# ============================================================================
if RENDER:
    print("RENDER...")
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 40
    scene.cycles.use_denoising = True
    scene.cycles.max_bounces = 6
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.look = "None"
    scene.view_settings.exposure = 0.35

    # compositor glare
    try:
        scene.use_nodes = True
        tree = scene.node_tree
        tree.nodes.clear()
        rl = tree.nodes.new("CompositorNodeRLayers")
        glare = tree.nodes.new("CompositorNodeGlare")
        glare.glare_type = "FOG_GLOW"
        glare.quality = "HIGH"
        glare.threshold = 0.7
        glare.size = 7
        comp = tree.nodes.new("CompositorNodeComposite")
        tree.links.new(rl.outputs["Image"], glare.inputs["Image"])
        tree.links.new(glare.outputs["Image"], comp.inputs["Image"])
    except Exception as e:
        print("compositor skipped:", e)

    cam_data = bpy.data.cameras.new("Camera")
    cam_data.lens = 55
    cam_data.sensor_width = 36
    cam = bpy.data.objects.new("Camera", cam_data)
    STUDIO.objects.link(cam)
    scene.camera = cam

    def look_at(obj, target):
        d = Vector(target) - obj.location
        obj.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()

    def render_view(name, loc, target, lens=55, fstop=2.8, focus=9.0,
                    res=(1600, 900), samples=40, show_hall=False, show_lab=False):
        HALL.hide_render = not show_hall
        LAB.hide_render = not show_lab
        cam.location = loc
        look_at(cam, target)
        cam_data.lens = lens
        cam_data.dof.use_dof = True
        cam_data.dof.focus_distance = focus
        cam_data.dof.aperture_fstop = fstop
        scene.cycles.samples = samples
        scene.render.resolution_x = res[0]
        scene.render.resolution_y = res[1]
        scene.render.filepath = os.path.join(OUT_RENDERS, name)
        bpy.ops.render.render(write_still=True)
        print("RENDERED", name)

    # hero with hall
    render_view("hero.png", (3.1, -8.6, 3.35), (0, 0, 0.10),
                lens=55, fstop=2.6, focus=9.1, res=(1600, 900), samples=48,
                show_hall=True)
    # clean hero / poster
    render_view("hero-clean.png", (3.1, -8.6, 3.35), (0, 0, 0.10),
                lens=55, fstop=2.6, focus=9.1, res=(1600, 900), samples=56,
                show_hall=False)
    # hall backdrop
    render_view("hall.png", (0.0, -9.6, 2.55), (0, 0, 0.55),
                lens=38, fstop=1.6, focus=9.6, res=(1600, 900), samples=40,
                show_hall=True)
    # tokamak lab
    render_view("lab.png", (0.0, -7.0, 3.4), (4.4, 6.8, 1.7),
                lens=45, fstop=1.8, focus=8.0, res=(1280, 720), samples=40,
                show_lab=True)
    # core macro
    render_view("core.png", (1.35, -2.55, 0.92), (0, 0, 0.24),
                lens=85, fstop=1.2, focus=3.0, res=(1280, 800), samples=56,
                show_hall=False)

print("DONE")
