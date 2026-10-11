"""
Game-ready version of the clay figure: skinned mesh + skeleton + animations.

Animations (all in place, the game moves the character):
    Walk  -- loop, 28 frames @ 30 fps, ground speed WALK_SPEED
    Run   -- loop, 20 frames @ 30 fps, ground speed RUN_SPEED
    Jump  -- one shot: crouch, push-off, ballistic flight, landing, recovery
    Flex  -- static strongman pose (the original sculpt)

How the motion is made:
  * hips and feet are keyed procedurally; legs are solved with analytic
    two-bone IK so planted feet move backwards at exactly the ground speed
    (no foot sliding when the game moves the root at that speed)
  * the jump uses a real ballistic arc (g = 9.81) whose take-off speed comes
    from the push-off
  * spine, head, upper arms and forearms are damped spring pendulums
    under gravity, driven by the motion of the bone they hang from.  They are
    simulated in sub-steps and baked to keyframes.  Looping clips are
    simulated for several cycles and the settled last cycle is kept, so they
    loop seamlessly.

Units are metres, the figure is ~2 m tall, +Z up, the character faces -Y,
+X is the character's left (".L").

Usage inside Blender (e.g. via MCP):
    import sys; sys.path.insert(0, "<repo>/blender")
    import importlib, figure, character
    importlib.reload(figure); importlib.reload(character)
    character.main(export_path="<repo>/blender/character.glb")
"""
import math

import bpy
import numpy as np
from mathutils import Matrix, Quaternion, Vector

import figure

FPS = 30
G = 9.81
GRAVITY = Vector((0.0, 0.0, -G))

CHAR_NAME = "Character"
RIG_NAME = "CharacterRig"

# The game mesh is sampled directly at a coarse voxel size: that gives evenly
# sized quads everywhere.  (Decimating a finer mesh produces long slivers
# along the straight limbs that span the joints and fold into fins.)
GAME_VOXEL = 0.028
GAME_ARM_FILLET = 0.02      # small, so no web forms in the armpit of the rest pose
WEIGHT_SMOOTH_ITERS = 30    # surface diffusion of skin weights (see compute_weights)

# --- skeleton ---------------------------------------------------------------
HIP_Z = 0.70
KNEE_Z = 0.37
THIGH_LEN = HIP_Z - KNEE_Z
SHIN_LEN = KNEE_Z           # shin ends at the sole (z = 0)
LEG_LEN = THIGH_LEN + SHIN_LEN
SPINE_Z = (0.98, 1.40)
HEAD_BONE_Z = (1.44, 1.96)
SOLE_R = figure.LIMB_R - figure.SOLE_ROUND   # radius of the flat sole disc

WALK_FRAMES, WALK_SPEED = 28, 0.95
RUN_FRAMES, RUN_SPEED = 20, 2.4


# ============================================================================
# small math helpers
# ============================================================================
def smoothstep(a, b, x):
    t = min(max((x - a) / (b - a), 0.0), 1.0)
    return t * t * (3 - 2 * t)


def np_smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def lerp(a, b, t):
    return a + (b - a) * t


def rot_x(a):
    return Matrix.Rotation(a, 3, "X")


def rot_y(a):
    return Matrix.Rotation(a, 3, "Y")


def rot_z(a):
    return Matrix.Rotation(a, 3, "Z")


def hermite(y0, y1, m0, m1, u):
    u2, u3 = u * u, u * u * u
    return ((2 * u3 - 3 * u2 + 1) * y0 + (u3 - 2 * u2 + u) * m0
            + (-2 * u3 + 3 * u2) * y1 + (u3 - u2) * m1)


def keyframes(*pts):
    """Piecewise smoothstep interpolation through (time, value) points."""
    def f(t):
        if t <= pts[0][0]:
            return pts[0][1]
        for (t0, v0), (t1, v1) in zip(pts, pts[1:]):
            if t <= t1:
                return lerp(v0, v1, smoothstep(t0, t1, t))
        return pts[-1][1]
    return f


# ============================================================================
# mesh + skeleton + weights
# ============================================================================
def build_mesh(scene):
    return figure.build(scene, pose="apose", voxel=GAME_VOXEL, name=CHAR_NAME,
                        arm_fillet=GAME_ARM_FILLET)


def build_rig(scene):
    old = bpy.data.objects.get(RIG_NAME)
    if old is not None:
        data = old.data
        bpy.data.objects.remove(old)
        bpy.data.armatures.remove(data)

    arm = bpy.data.armatures.new(RIG_NAME)
    rig = bpy.data.objects.new(RIG_NAME, arm)
    scene.collection.objects.link(rig)
    rig.show_in_front = True
    arm.display_type = "STICK"

    vl = bpy.context.view_layer
    for o in vl.objects:
        o.select_set(False)
    vl.objects.active = rig
    rig.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    eb = arm.edit_bones
    fwd = Vector((0, -1, 0))

    def bone(name, head, tail, parent=None, connect=False, roll_to=fwd):
        b = eb.new(name)
        b.head, b.tail = Vector(head), Vector(tail)
        b.align_roll(roll_to)
        if parent:
            b.parent = eb[parent]
            b.use_connect = connect
        return b

    bone("root", (0, 0, 0), (0, 0.3, 0), roll_to=Vector((0, 0, 1)))
    bone("hips", (0, 0, HIP_Z), (0, 0, SPINE_Z[0]), "root")
    bone("spine", (0, 0, SPINE_Z[0]), (0, 0, SPINE_Z[1]), "hips", True)
    bone("head", (0, 0, HEAD_BONE_Z[0]), (0, 0, HEAD_BONE_Z[1]), "spine")
    for side, path in zip(("R", "L"), figure.arm_paths("apose")):
        _, sh, el, fist = path
        s = 1 if side == "L" else -1
        bone(f"upper_arm.{side}", sh, el, "spine")
        bone(f"forearm.{side}", el, fist, f"upper_arm.{side}", True)
        bone(f"thigh.{side}", (s * figure.LEG_X, 0, HIP_Z), (s * figure.LEG_X, 0, KNEE_Z), "hips")
        bone(f"shin.{side}", (s * figure.LEG_X, 0, KNEE_Z), (s * figure.LEG_X, 0, 0.0), f"thigh.{side}", True)
    bpy.ops.object.mode_set(mode="OBJECT")
    for pb in rig.pose.bones:
        pb.rotation_mode = "QUATERNION"
    return rig


def _polyline_closest(P, pts):
    """Distance to a polyline and arc-length parameter of the closest point."""
    best_d = np.full(len(P), np.inf, dtype=np.float32)
    best_s = np.zeros(len(P), dtype=np.float32)
    acc = 0.0
    for a, b in zip(pts, pts[1:]):
        a, b = np.asarray(a, np.float32), np.asarray(b, np.float32)
        ba = b - a
        L = float(np.linalg.norm(ba))
        h = np.clip(((P - a) @ ba) / (L * L), 0.0, 1.0)
        d = np.linalg.norm(P - a - h[:, None] * ba, axis=1)
        m = d < best_d
        best_d[m] = d[m]
        best_s[m] = acc + h[m] * L
        acc += L
    return best_d, best_s


def compute_weights(ob):
    """Skin weights straight from the shape description.

    Every vertex gets a soft membership to the body parts it is closest to
    (torso, head, each limb), and within a part weights blend smoothly across
    the joints along the limb axis.
    """
    me = ob.data
    co = np.empty(len(me.vertices) * 3, np.float32)
    me.vertices.foreach_get("co", co)
    P = co.reshape(-1, 3)
    n = len(P)
    z = P[:, 2]

    parts = []  # (signed distance, {bone: weight array})

    # torso: hips below, spine above
    d = figure._sd_round_box(P, figure.TORSO_CENTER, figure.TORSO_HALF, figure.TORSO_ROUND)
    ws = np_smoothstep(0.86, 1.10, z)
    parts.append((d, {"hips": 1 - ws, "spine": ws}))

    # head, blending into the spine at the neck
    d = figure._sd_sphere(P, (0, 0, figure.HEAD_Z), figure.HEAD_R)
    wh = np_smoothstep(1.38, 1.52, z)
    parts.append((d, {"spine": 1 - wh, "head": wh}))

    b = 0.07
    for side, path in zip(("R", "L"), figure.arm_paths("apose")):
        root, sh, el, fist = (Vector(p) for p in path)
        d, s = _polyline_closest(P, [root, sh, el, fist])
        s_sh = (sh - root).length
        s_el = s_sh + figure.UPPER_ARM_LEN
        w_parent = 1 - np_smoothstep(s_sh - b, s_sh + b, s)
        w_fore = np_smoothstep(s_el - b, s_el + b, s)
        w_upper = np.clip(1 - w_parent - w_fore, 0, 1)
        parts.append((d - figure.LIMB_R,
                      {"spine": w_parent, f"upper_arm.{side}": w_upper, f"forearm.{side}": w_fore}))

    for side, s_x in (("R", -figure.LEG_X), ("L", figure.LEG_X)):
        top = 0.85
        d, s = _polyline_closest(P, [(s_x, 0, top), (s_x, 0, -0.2)])
        s_hip, s_knee = top - HIP_Z, top - KNEE_Z
        w_parent = 1 - np_smoothstep(s_hip - 0.08, s_hip + 0.08, s)
        w_shin = np_smoothstep(s_knee - b, s_knee + b, s)
        w_thigh = np.clip(1 - w_parent - w_shin, 0, 1)
        parts.append((d - figure.LIMB_R,
                      {"hips": w_parent, f"thigh.{side}": w_thigh, f"shin.{side}": w_shin}))

    # membership: the closest part wins, with only a narrow blend so that
    # e.g. the surface of the upper arm never sticks to the torso (that
    # smears the arm and makes it look thicker when it swings).  Joint
    # blending is done along the limb axis above.
    D = np.stack([p[0] for p in parts], axis=1)
    tau = 0.006
    M = np.exp(-(D - D.min(axis=1, keepdims=True)) / tau)
    M /= M.sum(axis=1, keepdims=True)

    bones = [b.name for b in ob.parent.data.bones if b.name != "root"]
    W = np.zeros((n, len(bones)), np.float32)
    for k, (_, wd) in enumerate(parts):
        for bname, w in wd.items():
            W[:, bones.index(bname)] += M[:, k] * w

    # Diffuse the weights over the surface.  Where two parts meet (armpit,
    # crotch, neck) the weights would otherwise jump between neighbouring
    # vertices, and all the stretching of a swinging limb lands on that one
    # row of edges -> fins.  Surface diffusion turns the seam into a gradient
    # a few edges wide, while the middle of a limb stays on its own bones.
    E = np.empty(len(me.edges) * 2, np.int32)
    me.edges.foreach_get("vertices", E)
    E = E.reshape(-1, 2)
    deg = np.bincount(E.ravel(), minlength=n).astype(np.float32)[:, None]
    for _ in range(WEIGHT_SMOOTH_ITERS):
        acc = np.zeros_like(W)
        np.add.at(acc, E[:, 0], W[E[:, 1]])
        np.add.at(acc, E[:, 1], W[E[:, 0]])
        W += 0.5 * (acc / np.maximum(deg, 1) - W)

    # max 4 influences, normalised
    order = np.argsort(-W, axis=1)
    W[np.arange(n)[:, None], order[:, 4:]] = 0.0
    W /= W.sum(axis=1, keepdims=True)

    ob.vertex_groups.clear()
    groups = [ob.vertex_groups.new(name=bn) for bn in bones]
    for j, vg in enumerate(groups):
        col = W[:, j]
        idx = np.nonzero(col > 1e-4)[0]
        for i in idx:
            vg.add([int(i)], float(col[i]), "REPLACE")


# ============================================================================
# pose evaluation (pure math, no depsgraph)
# ============================================================================
class Skeleton:
    def __init__(self, rig):
        bones = rig.data.bones
        self.rest = {b.name: b.matrix_local.copy() for b in bones}
        self.parent = {b.name: b.parent.name if b.parent else None for b in bones}
        self.rest_rel = {}
        for name, p in self.parent.items():
            self.rest_rel[name] = self.rest[p].inverted() @ self.rest[name] if p else self.rest[name].copy()
        self.rest_rot = {k: v.to_3x3() for k, v in self.rest.items()}

    def base(self, name, poses):
        """Armature-space matrix of the bone with an identity local transform."""
        p = self.parent[name]
        return poses[p] @ self.rest_rel[name] if p else self.rest_rel[name].copy()

    def frame_rot(self, name, poses):
        """Rotation taking rest-pose directions to the bone's current frame."""
        return poses[name].to_3x3() @ self.rest_rot[name].inverted()

    def set(self, name, poses, desired):
        poses[name] = desired
        return self.base(name, poses).inverted() @ desired

    def aim(self, name, poses, direction, twist=0.0):
        """Point the bone along `direction` (armature space), with an optional
        twist about its own axis, using the smallest swing from its base."""
        base = self.base(name, poses)
        tb = base @ Matrix.Rotation(twist, 4, "Y") if twist else base
        y = tb.col[1].xyz.normalized()
        swing = y.rotation_difference(direction.normalized()).to_matrix()
        desired = Matrix.Translation(base.translation) @ (swing @ tb.to_3x3()).to_4x4()
        poses[name] = desired
        return base.inverted() @ desired


def two_bone_ik(hip, target, a, b, pole):
    d_vec = target - hip
    d = min(d_vec.length, (a + b) * 0.9995)
    n = d_vec.normalized()
    cos_a = max(-1.0, min(1.0, (a * a + d * d - b * b) / (2 * a * d)))
    sin_a = math.sqrt(1 - cos_a * cos_a)
    perp = pole - n * pole.dot(n)
    perp.normalize()
    knee = hip + n * (a * cos_a) + perp * (a * sin_a)
    foot = hip + n * d
    return knee, foot


# ============================================================================
# springs (the physics)
# ============================================================================
def simulate(pivots, targets, length, k, zeta, gravity=True, substeps=12):
    """Point mass on a rigid rod hanging from a moving pivot.

    The mass is pulled towards `pivot + length * target_dir` by a damped
    spring (muscle tone) and by gravity, and keeps its momentum when the
    pivot accelerates.  Returns the simulated direction per frame.
    """
    h = 1.0 / (FPS * substeps)
    c = 2 * zeta * math.sqrt(k)
    g = GRAVITY if gravity else Vector()
    p = pivots[0] + targets[0] * length
    v = Vector()
    prev_tp = p.copy()
    out = [targets[0].copy()]
    for f in range(len(pivots) - 1):
        for i in range(1, substeps + 1):
            t = i / substeps
            pv = pivots[f].lerp(pivots[f + 1], t)
            td = targets[f].lerp(targets[f + 1], t).normalized()
            tp = pv + td * length
            tv = (tp - prev_tp) / h
            prev_tp = tp
            a = g + (tp - p) * k - (v - tv) * c
            p_old = p.copy()
            v = v + a * h
            p = p + v * h
            p = pv + (p - pv).normalized() * length
            v = (p - p_old) / h
        out.append((p - pivots[f + 1]).normalized())
    return out


SPRINGS = {
    # name: (length to centre of mass, stiffness, damping ratio)
    "spine": (0.42, 700.0, 0.45),
    "head": (0.45, 380.0, 0.30),
}


# ============================================================================
# motion description -> baked poses
# ============================================================================
def arm_dir(swing, abduct, side_sign):
    """Hanging-arm direction in rest axes: swing > 0 is forward."""
    return rot_x(-swing) @ rot_y(-side_sign * abduct) @ Vector((0, 0, -1))


def solve_motion(skel, params, n_frames, arm_k, arm_zeta, fore_k, fore_zeta):
    """params(frame) -> dict describing the authored motion.

    Returns a list of {bone: basis matrix} per frame.
    """
    P = [params(f) for f in range(n_frames)]
    poses = [dict() for _ in range(n_frames)]
    bases = [dict() for _ in range(n_frames)]
    sides = (("L", 1), ("R", -1))

    # level 0: root, hips, legs (kinematic + IK)
    for f, prm in enumerate(P):
        ps, bs = poses[f], bases[f]
        bs["root"] = skel.set("root", ps, skel.base("root", ps))
        pitch, roll, yaw = prm["hips_rot"]
        R = rot_z(yaw) @ rot_x(pitch) @ rot_y(roll)
        desired = Matrix.Translation(prm["hips_pos"]) @ (R @ skel.rest_rot["hips"]).to_4x4()
        bs["hips"] = skel.set("hips", ps, desired)
        hips_R = skel.frame_rot("hips", ps)
        pole = hips_R @ Vector((0, -1, 0.0))
        for side, _ in sides:
            hip = skel.base(f"thigh.{side}", ps).translation
            tgt = prm["feet"][side].copy()
            ground = tgt.z
            for _ in range(3):  # lift the target so the tilted flat sole doesn't dig in
                knee, foot = two_bone_ik(hip, tgt, THIGH_LEN, SHIN_LEN, pole)
                shin = (foot - knee).normalized()
                tilt = math.acos(max(-1.0, min(1.0, -shin.z)))
                tgt = Vector((tgt.x, tgt.y, ground + SOLE_R * math.sin(tilt)))
            bs[f"thigh.{side}"] = skel.aim(f"thigh.{side}", ps, knee - hip)
            bs[f"shin.{side}"] = skel.aim(f"shin.{side}", ps, foot - knee)

    def run_spring(name, pivot_fn, target_fn, length, k, zeta, twist_fn=None):
        pivots = [pivot_fn(f) for f in range(n_frames)]
        targets = [target_fn(f) for f in range(n_frames)]
        dirs = simulate(pivots, targets, length, k, zeta)
        for f in range(n_frames):
            tw = twist_fn(f) if twist_fn else 0.0
            bases[f][name] = skel.aim(name, poses[f], dirs[f], tw)

    # level 1: spine
    L, k, z = SPRINGS["spine"]
    run_spring(
        "spine",
        lambda f: skel.base("spine", poses[f]).translation,
        lambda f: skel.frame_rot("hips", poses[f]) @ rot_x(P[f]["spine_lean"]) @ Vector((0, 0, 1)),
        L, k, z,
        twist_fn=lambda f: P[f]["spine_twist"],
    )

    # level 2: head and upper arms
    L, k, z = SPRINGS["head"]
    run_spring(
        "head",
        lambda f: skel.base("head", poses[f]).translation,
        lambda f: skel.frame_rot("spine", poses[f]) @ rot_x(P[f]["head_pitch"]) @ Vector((0, 0, 1)),
        L, k, z,
        twist_fn=lambda f: P[f]["head_twist"],
    )
    for side, s in sides:
        run_spring(
            f"upper_arm.{side}",
            lambda f, side=side: skel.base(f"upper_arm.{side}", poses[f]).translation,
            lambda f, side=side, s=s: skel.frame_rot("spine", poses[f])
            @ arm_dir(P[f]["arms"][side][0], P[f]["arms"][side][1], s),
            figure.UPPER_ARM_LEN * 0.6, arm_k, arm_zeta,
        )

    # level 3: forearms bend forward about the chest's side axis
    for side, s in sides:
        def fore_target(f, side=side):
            chest = skel.frame_rot("spine", poses[f])
            upper = poses[f][f"upper_arm.{side}"].col[1].xyz.normalized()
            axis = chest @ Vector((1, 0, 0))
            return Quaternion(axis, -P[f]["arms"][side][2]) @ upper
        run_spring(
            f"forearm.{side}",
            lambda f, side=side: skel.base(f"forearm.{side}", poses[f]).translation,
            fore_target,
            figure.FOREARM_LEN * 0.6, fore_k, fore_zeta,
        )
    return bases


# ============================================================================
# the clips
# ============================================================================
def foot_track(ph, duty, stride, lift, speed, period, skew=1.0):
    """Foot position (y, z) relative to the hips for a leg at phase ph.

    Stance: the foot moves backwards (+Y) at exactly `speed`.
    Swing: Hermite curve that leaves and lands with the stance velocity.
    """
    if ph < duty:
        return -stride / 2 + stride * (ph / duty), 0.0
    u = (ph - duty) / (1 - duty)
    m = speed * (1 - duty) * period  # stance velocity in swing-parameter units
    y = hermite(stride / 2, -stride / 2, m, m, u)
    z = lift * math.sin(math.pi * u ** skew)
    return y, z


def walk_params(n):
    T = n / FPS
    duty = 0.60
    stride = WALK_SPEED * duty * T
    reach = LEG_LEN * 0.975

    # hip height from the stance legs (inverted pendulum), smoothed
    samples = 240
    hz = np.zeros(samples)
    for i in range(samples):
        ph = i / samples
        hs = []
        for off in (0.0, 0.5):
            p = (ph + off) % 1
            if p < duty:
                y, _ = foot_track(p, duty, stride, 0.0, WALK_SPEED, T)
                hs.append(math.sqrt(reach * reach - y * y))
        hz[i] = min(hs)
    k = np.exp(-0.5 * (np.arange(-30, 31) / 9.0) ** 2)
    k /= k.sum()
    hz = np.array([np.dot(k, np.take(hz, range(i - 30, i + 31), mode="wrap")) for i in range(samples)])

    def params(f):
        ph = (f / n) % 1
        w = 2 * math.pi * ph
        feet = {}
        for side, s, off in (("L", 1, 0.0), ("R", -1, 0.5)):
            y, z = foot_track((ph + off) % 1, duty, stride, 0.075, WALK_SPEED, T, skew=0.85)
            feet[side] = Vector((s * figure.LEG_X, y, z))
        hip_z = float(np.interp(ph * samples, np.arange(samples + 1), np.append(hz, hz[0])))
        arm = math.radians(15) * math.cos(w)
        bend = math.radians(18)
        return {
            "hips_pos": Vector((0.035 * math.sin(w - 0.3), 0.0, hip_z)),
            "hips_rot": (math.radians(3), -math.radians(3) * math.sin(w - 0.3), -math.radians(5) * math.cos(w)),
            "spine_lean": math.radians(2),
            "spine_twist": math.radians(9) * math.cos(w),
            "head_pitch": -math.radians(4),
            "head_twist": -math.radians(4) * math.cos(w),
            "feet": feet,
            "arms": {"R": (arm, math.radians(6), bend), "L": (-arm, math.radians(6), bend)},
        }
    return params


def run_params(n):
    T = n / FPS
    duty = 0.36
    stride = RUN_SPEED * duty * T
    ts = duty * T                      # stance time
    tf = T / 2 - ts                    # flight time per step
    v_up = G * tf / 2                  # vertical take-off speed
    comp = v_up * ts / math.pi         # stance compression (spring-mass)
    z_td = math.sqrt((LEG_LEN * 0.985) ** 2 - (stride / 2) ** 2)

    def hip_height(ph):
        step = (ph * 2) % 1
        t = step * T / 2
        if t < ts:
            return z_td - comp * math.sin(math.pi * t / ts)
        t -= ts
        return z_td + v_up * t - 0.5 * G * t * t

    def params(f):
        ph = (f / n) % 1
        w = 2 * math.pi * ph
        feet = {}
        for side, s, off in (("L", 1, 0.0), ("R", -1, 0.5)):
            y, z = foot_track((ph + off) % 1, duty, stride, 0.24, RUN_SPEED, T, skew=0.7)
            feet[side] = Vector((s * figure.LEG_X, y, z))
        arm = math.radians(28) * math.cos(w - 0.25)
        return {
            "hips_pos": Vector((0.02 * math.sin(w - 0.3), 0.0, hip_height(ph))),
            "hips_rot": (math.radians(9), -math.radians(4) * math.sin(w - 0.3), -math.radians(10) * math.cos(w)),
            "spine_lean": math.radians(5),
            "spine_twist": math.radians(14) * math.cos(w),
            "head_pitch": -math.radians(11),
            "head_twist": -math.radians(7) * math.cos(w),
            "feet": feet,
            "arms": {"R": (math.radians(4) + arm, math.radians(10), math.radians(85)),
                     "L": (math.radians(4) - arm, math.radians(10), math.radians(85))},
        }
    return params


def jump_params():
    """Returns (params, n_frames, pre_roll_frames)."""
    stand = HIP_Z - 0.01
    t_crouch0, t_crouch1, t_takeoff = 0.15, 0.45, 0.60
    z_crouch, z_takeoff = 0.47, HIP_Z + 0.005
    v0 = 2 * (z_takeoff - z_crouch) / (t_takeoff - t_crouch1)   # end speed of u^2 push
    t_air = 2 * v0 / G
    t_land = t_takeoff + t_air
    omega = 8.0
    t_end = t_land + 0.70
    n = int(round(t_end * FPS)) + 1
    pre = int(0.6 * FPS)

    def hip_z(t):
        if t < t_crouch0:
            return stand
        if t < t_crouch1:
            return lerp(stand, z_crouch, smoothstep(t_crouch0, t_crouch1, t))
        if t < t_takeoff:
            u = (t - t_crouch1) / (t_takeoff - t_crouch1)
            return z_crouch + (z_takeoff - z_crouch) * u * u
        if t < t_land:
            ta = t - t_takeoff
            return z_takeoff + v0 * ta - 0.5 * G * ta * ta
        tl = t - t_land
        A = z_takeoff - stand
        B = -v0 + omega * A
        return stand + (A + B * tl) * math.exp(-omega * tl)

    D = math.radians
    arm_swing = keyframes((t_crouch0, 0.0), (t_crouch1, D(-60)), (t_takeoff, D(165)),
                          (t_takeoff + 0.30, D(115)), (t_land - 0.05, D(40)),
                          (t_land + 0.25, D(10)), (t_end, 0.0))
    elbow = keyframes((t_crouch0, D(15)), (t_crouch1, D(28)), (t_takeoff, D(6)),
                      (t_land - 0.1, D(12)), (t_land + 0.15, D(35)), (t_end, D(15)))
    hips_y = keyframes((t_crouch0, 0.0), (t_crouch1, 0.06), (t_takeoff, 0.0))
    takeoff_pitch = keyframes((t_crouch0, 0.0), (t_crouch1, D(22)), (t_takeoff, D(-5)),
                              (t_land, D(5)))
    lean = keyframes((t_crouch0, 0.0), (t_crouch1, D(12)), (t_takeoff, D(-5)), (t_land, D(2)))

    def params(f):
        t = (f - pre) / FPS
        z = hip_z(t)
        if t < t_land:
            pitch = takeoff_pitch(t)
            spine = lean(t)
        else:
            squash = max(0.0, (stand - z) / 0.13)
            fade = smoothstep(0.0, 0.12, t - t_land)
            pitch = lerp(D(5), D(26) * squash, fade)
            spine = lerp(D(2), D(10) * squash, fade)
        feet = {}
        for side, s in (("L", 1), ("R", -1)):
            if t_takeoff < t < t_land:
                u = (t - t_takeoff) / t_air
                tuck = 0.20 * math.sin(math.pi * u) ** 0.8
                fz = max(0.0, z - (LEG_LEN - 0.005) + tuck)
                fy = -0.07 * math.sin(math.pi * u)
            else:
                fz = max(0.0, z - (LEG_LEN - 0.005))
                fy = 0.0
            feet[side] = Vector((s * figure.LEG_X, fy, fz))
        a = arm_swing(t)
        b = elbow(t)
        return {
            "hips_pos": Vector((0.0, hips_y(t) if t < t_takeoff else 0.0, z)),
            "hips_rot": (pitch, 0.0, 0.0),
            "spine_lean": spine,
            "spine_twist": 0.0,
            "head_pitch": -(pitch + spine) * 0.75,
            "head_twist": 0.0,
            "feet": feet,
            "arms": {"L": (a, D(8), b), "R": (a, D(8), b)},
        }
    return params, n, pre


def flex_pose(skel):
    ps = {}
    bs = {}
    bs["root"] = skel.set("root", ps, skel.base("root", ps))
    desired = Matrix.Translation((0, 0, HIP_Z - 0.01)) @ skel.rest_rot["hips"].to_4x4()
    bs["hips"] = skel.set("hips", ps, desired)
    for side, s in (("L", 1), ("R", -1)):
        hip = skel.base(f"thigh.{side}", ps).translation
        knee, foot = two_bone_ik(hip, Vector((s * figure.LEG_X, 0, 0)), THIGH_LEN, SHIN_LEN, Vector((0, -1, 0)))
        bs[f"thigh.{side}"] = skel.aim(f"thigh.{side}", ps, knee - hip)
        bs[f"shin.{side}"] = skel.aim(f"shin.{side}", ps, foot - knee)
    bs["spine"] = skel.aim("spine", ps, Vector((0, 0, 1)))
    bs["head"] = skel.aim("head", ps, Vector((0, 0, 1)))
    for side, s in (("L", 1), ("R", -1)):
        bs[f"upper_arm.{side}"] = skel.aim(f"upper_arm.{side}", ps, Vector((s, 0, 0.05)))
        bs[f"forearm.{side}"] = skel.aim(f"forearm.{side}", ps, Vector((-0.05 * s, 0, 1)))
    return bs


# ============================================================================
# baking to actions
# ============================================================================
def bake_action(rig, name, frames, cyclic, props=None):
    act = bpy.data.actions.get(name)
    if act is not None:
        bpy.data.actions.remove(act)
    act = bpy.data.actions.new(name)
    act.use_fake_user = True
    rig.animation_data_create()
    rig.animation_data.action = act
    prev = {}
    for f, bases in enumerate(frames):
        for bname, basis in bases.items():
            pb = rig.pose.bones[bname]
            loc, rot, _ = basis.decompose()
            if bname in prev and rot.dot(prev[bname]) < 0:
                rot.negate()
            prev[bname] = rot
            pb.rotation_quaternion = rot
            pb.keyframe_insert("rotation_quaternion", frame=f, group=bname)
            if bname == "hips":
                pb.location = loc
                pb.keyframe_insert("location", frame=f, group=bname)
    act.use_frame_range = True
    act.frame_start = 0
    act.frame_end = max(1, len(frames) - 1)
    act.use_cyclic = cyclic
    for k, v in (props or {}).items():
        act[k] = v
    return act


def make_animations(rig):
    skel = Skeleton(rig)
    cycles = 6

    n = WALK_FRAMES
    frames = solve_motion(skel, walk_params(n), n * cycles + 1, arm_k=55.0, arm_zeta=0.22,
                          fore_k=110.0, fore_zeta=0.28)
    bake_action(rig, "Walk", frames[n * (cycles - 1):], True, {"speed": WALK_SPEED})

    n = RUN_FRAMES
    frames = solve_motion(skel, run_params(n), n * cycles + 1, arm_k=320.0, arm_zeta=0.45,
                          fore_k=520.0, fore_zeta=0.5)
    bake_action(rig, "Run", frames[n * (cycles - 1):], True, {"speed": RUN_SPEED})

    params, n, pre = jump_params()
    frames = solve_motion(skel, params, n + pre, arm_k=320.0, arm_zeta=0.55,
                          fore_k=450.0, fore_zeta=0.55)
    bake_action(rig, "Jump", frames[pre:], False)

    bake_action(rig, "Flex", [flex_pose(skel)], False)


# ============================================================================
def main(scene=None, export_path=None, active_action="Walk"):
    scene = scene or bpy.context.scene
    scene.render.fps = FPS

    if bpy.context.object and bpy.context.object.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")

    # the static sculpt is replaced by the rigged character
    old = bpy.data.objects.get(figure.FIGURE_NAME)
    if old is not None:
        bpy.data.objects.remove(old)

    rig = build_rig(scene)
    ob = build_mesh(scene)
    ob.parent = rig
    mod = ob.modifiers.new("Armature", "ARMATURE")
    mod.object = rig
    compute_weights(ob)

    make_animations(rig)
    act = bpy.data.actions[active_action]
    rig.animation_data.action = act
    scene.frame_start = int(act.frame_start)
    scene.frame_end = int(act.frame_end) - (1 if act.use_cyclic else 0)

    if export_path:
        export_gltf(rig, ob, export_path)
    return rig, ob


def export_gltf(rig, ob, path):
    vl = bpy.context.view_layer
    for o in vl.objects:
        o.select_set(False)
    rig.select_set(True)
    ob.select_set(True)
    vl.objects.active = rig
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=True,
        export_animation_mode="ACTIONS",
        export_force_sampling=True,
        export_frame_step=1,
        export_extras=True,
        export_yup=True,
    )
