#!/usr/bin/env python3
"""
img2stl.py — Photo to 3D-Printable STL via Hunyuan3D 2.1

Single-image 3D reconstruction using Tencent's Hunyuan3D 2.1 shape pipeline.
Uses scikit-image marching cubes (no CuMesh dependency) — works on all GPUs
including Blackwell/RTX 50-series (sm_120).

Usage:
    python img2stl.py photo.jpg                         # basic usage
    python img2stl.py photo.jpg -o custom_name.stl      # custom output name
    python img2stl.py photo.jpg --keep-glb              # also save GLB
    python img2stl.py photo.jpg --no-rembg              # skip background removal
    python img2stl.py photo.jpg --seed 123              # reproducible results
    python img2stl.py photo.jpg --steps 50              # higher quality (slower)
    python img2stl.py photo.jpg --guidance 10.0         # stronger image adherence
    python img2stl.py photo.jpg --octree-res 512        # higher mesh detail
    python img2stl.py photo.jpg --height 150            # 150mm tall print
    python img2stl.py ./photos/                         # batch mode: process folder
    python img2stl.py ./photos/ --output-dir ./results/ # batch with output dir
    python img2stl.py photo.jpg --preview               # open trimesh viewer after
    python img2stl.py photo.jpg --turntable spin.gif    # render spinning GIF

Tips for best results:
    - Use a front-facing, centered photo of your subject
    - Clean backgrounds help (rembg handles most cases)
    - Avoid harsh shadows — they get baked into geometry
    - Subject should fill the frame
    - 3/4 views will produce a slight tilt in the output
"""

import os
import sys
import argparse
import time
from pathlib import Path

# ── Environment (must be set before importing torch) ──────────────────────
os.environ["PYTORCH_CUDA_ALLOC_CONF"] = "expandable_segments:True"
os.environ["PYOPENGL_PLATFORM"] = "egl"  # headless rendering in WSL2

# NumPy 2.x removed np.infty but pyrender still uses it
import numpy as np
if not hasattr(np, 'infty'):
    np.infty = np.inf

# Add hy3dshape to path (script lives outside the Hunyuan3D repo)
SCRIPT_DIR = Path(__file__).resolve().parent
HY3D_PATH = SCRIPT_DIR / "Hunyuan3D-2.1" / "hy3dshape"
if HY3D_PATH.exists():
    sys.path.insert(0, str(HY3D_PATH))

import torch
from PIL import Image

IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp'}


# ── Helpers ───────────────────────────────────────────────────────────────

def print_step(msg: str):
    print(f"\n{'='*60}")
    print(f"  {msg}")
    print(f"{'='*60}")


def print_vram():
    if torch.cuda.is_available():
        allocated = torch.cuda.memory_allocated() / 1e9
        reserved = torch.cuda.memory_reserved() / 1e9
        print(f"  VRAM: {allocated:.1f} GB allocated / {reserved:.1f} GB reserved")


def clear_vram():
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
        torch.cuda.synchronize()


def find_images(directory: Path) -> list:
    """Find all supported image files in a directory."""
    images = []
    for f in sorted(directory.iterdir()):
        if f.is_file() and f.suffix.lower() in IMAGE_EXTENSIONS:
            images.append(f)
    return images


# ── Core Pipeline Functions ───────────────────────────────────────────────

def remove_background(image_path: str) -> Image.Image:
    """Remove background using rembg. Returns RGBA image."""
    try:
        from rembg import remove
    except ImportError:
        print("  WARNING: rembg not installed, skipping background removal")
        print("  Install with: pip install rembg")
        img = Image.open(image_path)
        return img.convert("RGBA") if img.mode != "RGBA" else img

    img = Image.open(image_path)
    print(f"  Input: {img.mode} ({img.size[0]}x{img.size[1]})")

    try:
        result = remove(img)
        print(f"  Result: {result.size[0]}x{result.size[1]} {result.mode}")
        return result
    except Exception as e:
        print(f"  WARNING: rembg failed ({e}), continuing with original image")
        return img.convert("RGBA") if img.mode != "RGBA" else img


def load_pipeline():
    """Load Hunyuan3D 2.1 shape pipeline."""
    from hy3dshape.pipelines import Hunyuan3DDiTFlowMatchingPipeline

    print("  Loading shape pipeline (uses cached weights from ~/.cache/hy3dgen)...")
    pipeline = Hunyuan3DDiTFlowMatchingPipeline.from_pretrained(
        'tencent/Hunyuan3D-2.1',
        subfolder='hunyuan3d-dit-v2-1',
    )
    return pipeline


def generate_shape(pipeline, image: Image.Image, steps: int = 50,
                   guidance: float = 5.0, octree_res: int = 384,
                   seed: int = None):
    """
    Generate 3D mesh from image.

    Returns trimesh.Trimesh on success, None on failure.
    """
    print(f"  Generating mesh (steps={steps}, guidance={guidance}, "
          f"octree_res={octree_res})...")

    kwargs = dict(
        image=image,
        num_inference_steps=steps,
        guidance_scale=guidance,
        octree_resolution=octree_res,
    )
    if seed is not None:
        kwargs['generator'] = torch.Generator(device='cuda').manual_seed(seed)

    try:
        mesh = pipeline(**kwargs)[0]
        return mesh
    except torch.cuda.OutOfMemoryError:
        print(f"\n  ERROR: CUDA out of memory!")
        print(f"  Try reducing settings:")
        print(f"    --steps 20          (currently {steps})")
        print(f"    --octree-res 256    (currently {octree_res})")
        return None


def repair_mesh(mesh):
    """
    Repair mesh for 3D printing.

    Pipeline: fix normals → fill holes → fix winding → pymeshfix fallback.
    """
    import trimesh

    v_before = len(mesh.vertices)
    f_before = len(mesh.faces)

    # Step 1: Fix normals
    print("  Fixing normals...")
    mesh.fix_normals()

    # Step 2: Fill holes
    print("  Filling holes...")
    trimesh.repair.fill_holes(mesh)

    # Step 3: Fix winding
    print("  Fixing winding...")
    trimesh.repair.fix_winding(mesh)

    if mesh.is_watertight:
        print(f"  Watertight: YES (trimesh repair sufficient)")
        return mesh

    # Step 4: pymeshfix fallback
    print("  Not yet watertight, trying pymeshfix...")
    try:
        import pymeshfix
        verts = np.array(mesh.vertices)
        faces = np.array(mesh.faces)
        fixer = pymeshfix.MeshFix(verts, faces)
        fixer.repair(verbose=False)
        mesh = trimesh.Trimesh(
            vertices=fixer.v,
            faces=fixer.f,
            process=True,
        )
        status = "YES" if mesh.is_watertight else "NO"
        print(f"  Watertight after pymeshfix: {status}")
    except ImportError:
        print("  WARNING: pymeshfix not installed, skipping deep repair")
        print("  Install with: pip install pymeshfix")
    except Exception as e:
        print(f"  WARNING: pymeshfix failed ({e}), continuing with trimesh repair")

    v_after = len(mesh.vertices)
    f_after = len(mesh.faces)
    if v_after != v_before or f_after != f_before:
        print(f"  Mesh changed: {v_before:,}v/{f_before:,}f → "
              f"{v_after:,}v/{f_after:,}f")

    return mesh


def postprocess_mesh(mesh, target_height_mm: float = 100.0):
    """
    Orient, clean, and scale mesh for 3D printing.

    Hunyuan3D outputs Y-up coordinates. We rotate to Z-up (slicer convention),
    remove small disconnected fragments, and scale to target height.
    """
    import trimesh
    import trimesh.transformations as tf

    # Y-up → Z-up: rotate +90° around X axis
    rot = tf.rotation_matrix(np.radians(90), [1, 0, 0])
    mesh.apply_transform(rot)

    # Remove small disconnected components (keep largest)
    components = mesh.split(only_watertight=False)
    if len(components) > 1:
        largest = max(components, key=lambda m: len(m.faces))
        removed = len(components) - 1
        removed_faces = sum(len(c.faces) for c in components) - len(largest.faces)
        print(f"  Removed {removed} small component(s) ({removed_faces:,} faces)")
        mesh = largest

    # Scale to target height
    extents = mesh.bounding_box.extents
    current_height = extents[2]  # Z is up after rotation
    if current_height > 0:
        scale_factor = target_height_mm / current_height
        mesh.apply_scale(scale_factor)

    return mesh


def print_diagnostics(mesh):
    """Print mesh quality diagnostics."""
    bb = mesh.bounding_box.extents
    print(f"  Vertices:    {len(mesh.vertices):,}")
    print(f"  Faces:       {len(mesh.faces):,}")
    print(f"  Dimensions:  {bb[0]:.1f} x {bb[1]:.1f} x {bb[2]:.1f} mm")
    wt = mesh.is_watertight
    print(f"  Watertight:  {'YES' if wt else 'NO'}")
    if wt:
        print(f"  Volume:      {mesh.volume:.1f} mm3")
    print(f"  Euler:       {mesh.euler_number}")


def render_turntable(mesh_path: str, gif_path: str):
    """Render a 36-frame turntable GIF using pyrender (offscreen EGL)."""
    import trimesh

    print("  Loading mesh for turntable...")
    scene = trimesh.load(mesh_path)

    try:
        import pyrender
        import imageio
    except ImportError:
        print("  WARNING: pyrender/imageio not installed, skipping turntable")
        print("  Install with: pip install pyrender imageio")
        return

    try:
        if isinstance(scene, trimesh.Scene):
            py_scene = pyrender.Scene.from_trimesh_scene(scene)
        else:
            py_mesh = pyrender.Mesh.from_trimesh(scene)
            py_scene = pyrender.Scene()
            py_scene.add(py_mesh)

        light = pyrender.DirectionalLight(color=[1.0, 1.0, 1.0], intensity=3.0)
        py_scene.add(light, pose=np.eye(4))

        camera = pyrender.PerspectiveCamera(yfov=np.pi / 3.0)
        bounds = np.array(py_scene.bounds)
        center = (bounds[0] + bounds[1]) / 2
        scale = np.linalg.norm(bounds[1] - bounds[0])
        cam_dist = scale * 1.5

        renderer = pyrender.OffscreenRenderer(640, 480)

        # Camera orbits around Z-up model (slicer convention)
        frames = []
        n_frames = 36
        elevation = 0.25
        for i in range(n_frames):
            angle = 2 * np.pi * i / n_frames
            cam_pos = np.array([
                center[0] + cam_dist * np.sin(angle),
                center[1] + cam_dist * np.cos(angle),
                center[2] + elevation * scale,
            ])

            forward = center - cam_pos
            forward = forward / np.linalg.norm(forward)
            world_up = np.array([0.0, 0.0, 1.0])
            right = np.cross(forward, world_up)
            right = right / (np.linalg.norm(right) + 1e-8)
            up = np.cross(right, forward)

            cam_pose = np.eye(4)
            cam_pose[:3, 0] = right
            cam_pose[:3, 1] = up
            cam_pose[:3, 2] = -forward
            cam_pose[:3, 3] = cam_pos

            for cn in list(py_scene.camera_nodes):
                py_scene.remove_node(cn)
            py_scene.add(camera, pose=cam_pose)

            color, _ = renderer.render(py_scene)
            frames.append(color)

        renderer.delete()
        imageio.mimsave(gif_path, frames, fps=10, loop=0)
        size_mb = os.path.getsize(gif_path) / 1e6
        print(f"  Turntable saved: {gif_path} ({size_mb:.1f} MB)")

        # Try to auto-open on Windows from WSL
        try:
            import subprocess
            result = subprocess.run(
                ['wslpath', '-w', gif_path],
                capture_output=True, text=True,
            )
            if result.returncode == 0:
                win_path = result.stdout.strip()
                subprocess.Popen(
                    ['cmd.exe', '/c', 'start', '', win_path],
                    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                )
                print("  Opened preview in Windows viewer")
        except Exception:
            pass

    except Exception as e:
        print(f"  WARNING: Turntable rendering failed: {e}")


# ── Single Image Processing ──────────────────────────────────────────────

def process_image(pipeline, image_path: Path, output_dir: Path, args):
    """
    Process a single image through the full pipeline.

    Returns a dict with results (for batch summary) or None on failure.
    """
    stem = image_path.stem
    stl_path = output_dir / f"{stem}.stl"
    if args.output and not args.batch_mode:
        stl_path = Path(args.output)

    print(f"\n  img2stl — Hunyuan3D 2.1 Photo-to-STL Pipeline")
    print(f"  Input:  {image_path}")
    print(f"  Output: {stl_path}")
    if torch.cuda.is_available():
        dev = torch.cuda.get_device_properties(0)
        total_mem = getattr(dev, 'total_memory', getattr(dev, 'total_mem', 0))
        print(f"  GPU:    {dev.name} ({total_mem / 1e9:.1f} GB)")

    t_start = time.time()
    result = {
        'filename': image_path.name,
        'stl_path': str(stl_path),
    }

    # ── Step 1: Background Removal ──
    if not args.no_rembg:
        print_step("Step 1/4: Removing Background")
        image = remove_background(str(image_path))
        print_vram()
    else:
        print_step("Step 1/4: Loading Image (background removal skipped)")
        image = Image.open(str(image_path))
        if image.mode != "RGBA":
            image = image.convert("RGBA")
        print(f"  Loaded: {image.size[0]}x{image.size[1]} {image.mode}")

    # ── Step 2: Generate 3D Shape ──
    print_step("Step 2/4: Generating 3D Mesh")
    print(f"  Settings: steps={args.steps}, guidance={args.guidance}, "
          f"octree_res={args.octree_res}")
    t_gen = time.time()

    mesh = generate_shape(
        pipeline, image,
        steps=args.steps,
        guidance=args.guidance,
        octree_res=args.octree_res,
        seed=args.seed,
    )

    if mesh is None:
        result['error'] = 'CUDA OOM'
        return result

    gen_time = time.time() - t_gen
    print(f"  Generation complete in {gen_time:.1f}s")
    print(f"  Raw mesh: {len(mesh.vertices):,} vertices, {len(mesh.faces):,} faces")
    print_vram()

    # ── Step 3: Post-process ──
    print_step("Step 3/4: Post-processing")
    mesh = postprocess_mesh(mesh, target_height_mm=args.height)

    # ── Step 4: Repair & Export ──
    print_step("Step 4/4: Repairing & Exporting")
    mesh = repair_mesh(mesh)

    # Export STL
    mesh.export(str(stl_path))
    stl_size = os.path.getsize(stl_path) / 1e6
    print(f"  STL saved: {stl_path} ({stl_size:.1f} MB)")

    # Export GLB if requested
    glb_size = None
    if args.keep_glb:
        glb_path = stl_path.with_suffix('.glb')
        mesh.export(str(glb_path))
        glb_size = os.path.getsize(glb_path) / 1e6
        print(f"  GLB saved: {glb_path} ({glb_size:.1f} MB)")

    # Diagnostics
    print_step("Mesh Diagnostics")
    print_diagnostics(mesh)

    total_time = time.time() - t_start
    watertight = mesh.is_watertight

    # Fill result
    result.update({
        'vertices': len(mesh.vertices),
        'faces': len(mesh.faces),
        'watertight': watertight,
        'stl_mb': stl_size,
        'glb_mb': glb_size,
        'time': total_time,
        'gen_time': gen_time,
    })

    # ── Summary ──
    bb = mesh.bounding_box.extents
    print_step("Done!")
    print(f"  Output:     {stl_path} ({stl_size:.1f} MB)")
    print(f"  Dimensions: {bb[0]:.1f} x {bb[1]:.1f} x {bb[2]:.1f} mm")
    wt_str = "Yes" if watertight else "No — slicer will auto-repair"
    print(f"  Watertight: {wt_str}")
    print(f"  Total time: {total_time:.1f}s")

    if not watertight:
        print()
        print("  TIP: PrusaSlicer and Bambu Studio auto-repair on import.")

    return result


# ── Batch Summary ─────────────────────────────────────────────────────────

def print_batch_summary(results: list, total_time: float):
    """Print a summary table after batch processing."""
    print_step("Batch Summary")

    # Header
    print(f"  {'File':<25} {'Verts':>8} {'Faces':>8} {'WT':>4} "
          f"{'Time':>7} {'Size':>7}")
    print(f"  {'-'*25} {'-'*8} {'-'*8} {'-'*4} {'-'*7} {'-'*7}")

    ok = 0
    fail = 0
    for r in results:
        name = r['filename']
        if len(name) > 24:
            name = name[:21] + '...'

        if 'error' in r:
            print(f"  {name:<25} {'FAILED':>8} — {r['error']}")
            fail += 1
        else:
            wt = 'Y' if r['watertight'] else 'N'
            print(f"  {name:<25} {r['vertices']:>8,} {r['faces']:>8,} "
                  f"{wt:>4} {r['time']:>6.1f}s {r['stl_mb']:>5.1f}MB")
            ok += 1

    print()
    print(f"  Processed: {ok} succeeded, {fail} failed, {total_time:.1f}s total")


# ── Main ──────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Convert a photo to a 3D-printable STL using Hunyuan3D 2.1",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""\
examples:
  python img2stl.py photo.jpg                         # basic usage
  python img2stl.py photo.jpg -o bust.stl             # custom output name
  python img2stl.py photo.jpg --keep-glb              # also save GLB
  python img2stl.py photo.jpg --steps 50 --guidance 10# higher quality
  python img2stl.py photo.jpg --octree-res 512        # more mesh detail
  python img2stl.py photo.jpg --height 150            # 150mm tall
  python img2stl.py ./photos/                         # batch: whole folder
  python img2stl.py ./photos/ --output-dir ./results/ # batch with output dir
  python img2stl.py photo.jpg --preview               # trimesh viewer
  python img2stl.py photo.jpg --turntable spin.gif    # spinning GIF
""")
    parser.add_argument("input",
                        help="Path to input image or directory (batch mode)")
    parser.add_argument("-o", "--output", default=None,
                        help="Output STL path (default: <image_name>.stl)")
    parser.add_argument("--output-dir", default=None, metavar="DIR",
                        help="Output directory for batch mode (default: same as input)")
    parser.add_argument("--keep-glb", action="store_true",
                        help="Also save a GLB file alongside the STL")
    parser.add_argument("--height", type=float, default=100.0, metavar="MM",
                        help="Target print height in mm (default: 100)")
    parser.add_argument("--octree-res", type=int, default=384, metavar="RES",
                        help="Mesh extraction resolution (default: 384, try 512 for more detail)")
    parser.add_argument("--steps", type=int, default=50,
                        help="Diffusion sampling steps (default: 50, lower=faster)")
    parser.add_argument("--guidance", type=float, default=5.0,
                        help="Classifier-free guidance scale (default: 5.0, higher=closer to image)")
    parser.add_argument("--seed", type=int, default=42,
                        help="Random seed for reproducible results (default: 42)")
    parser.add_argument("--no-rembg", action="store_true",
                        help="Skip background removal (use if image already has transparent bg)")
    parser.add_argument("--preview", action="store_true",
                        help="Open mesh in trimesh viewer after generation")
    parser.add_argument("--turntable", default=None, metavar="FILE",
                        help="Render a spinning turntable GIF")
    args = parser.parse_args()

    input_path = Path(args.input)
    if not input_path.exists():
        print(f"Error: '{input_path}' not found")
        sys.exit(1)

    # ── Determine single vs batch mode ──
    if input_path.is_dir():
        images = find_images(input_path)
        if not images:
            print(f"Error: No image files found in '{input_path}'")
            print(f"  Supported formats: {', '.join(IMAGE_EXTENSIONS)}")
            sys.exit(1)
        args.batch_mode = True
        print(f"\n  Batch mode: {len(images)} image(s) in {input_path}")
    else:
        # Validate it's an image
        if input_path.suffix.lower() not in IMAGE_EXTENSIONS:
            print(f"Error: '{input_path}' is not a supported image format")
            print(f"  Supported formats: {', '.join(IMAGE_EXTENSIONS)}")
            sys.exit(1)
        images = [input_path]
        args.batch_mode = False

    # Determine output directory
    if args.output_dir:
        output_dir = Path(args.output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)
    elif args.batch_mode:
        output_dir = input_path
    else:
        output_dir = Path('.')

    # ── Load pipeline (once, reused for all images) ──
    print_step("Loading Hunyuan3D 2.1")
    t_load = time.time()
    pipeline = load_pipeline()
    print(f"  Model loaded in {time.time() - t_load:.1f}s")
    print_vram()

    # ── Process images ──
    total_start = time.time()
    results = []

    for i, image_path in enumerate(images):
        if args.batch_mode:
            print(f"\n{'#'*60}")
            print(f"  Image {i+1}/{len(images)}: {image_path.name}")
            print(f"{'#'*60}")

        try:
            result = process_image(pipeline, image_path, output_dir, args)
            results.append(result)
        except torch.cuda.OutOfMemoryError:
            print(f"\n  ERROR: CUDA out of memory processing {image_path.name}")
            print(f"  Try: --steps 20 or --octree-res 256")
            results.append({'filename': image_path.name, 'error': 'CUDA OOM'})
            clear_vram()
        except Exception as e:
            print(f"\n  ERROR processing {image_path.name}: {e}")
            results.append({'filename': image_path.name, 'error': str(e)})
            if args.batch_mode:
                print("  Continuing with next image...")
            else:
                raise

    # ── Cleanup GPU ──
    del pipeline
    clear_vram()
    print("\n  GPU memory freed")
    print_vram()

    total_time = time.time() - total_start

    # ── Batch summary ──
    if args.batch_mode:
        print_batch_summary(results, total_time)

    # ── Preview / Turntable (single image only) ──
    if not args.batch_mode and results and 'error' not in results[0]:
        stl_path = results[0]['stl_path']

        if args.preview:
            print_step("Preview")
            try:
                import trimesh
                print("  Opening trimesh viewer...")
                mesh = trimesh.load(stl_path)
                mesh.show()
            except Exception as e:
                print(f"  WARNING: Viewer failed ({e}), try --turntable instead")

        if args.turntable:
            print_step("Turntable")
            render_turntable(stl_path, args.turntable)
        elif args.preview:
            # Also render a GIF as fallback for headless environments
            gif_path = str(Path(stl_path).with_suffix('.gif'))
            print_step("Turntable (auto)")
            render_turntable(stl_path, gif_path)


if __name__ == "__main__":
    main()
