"""Wraps img2stl.py as a callable module with progress callbacks.

Imports the core functions from img2stl.py directly (no subprocess).
Manages the Hunyuan3D pipeline lifecycle — loads once, reuses across jobs.
"""

import os
import sys
import time
import logging
from pathlib import Path
from typing import Callable, Optional

import config

logger = logging.getLogger(__name__)

# Add img2stl.py's directory to sys.path so we can import it.
# This also triggers img2stl's module-level setup:
#   - PYTORCH_CUDA_ALLOC_CONF env var
#   - hy3dshape sys.path entry
#   - numpy compat patches
#   - torch import
sys.path.insert(0, config.IMG2STL_DIR)
import img2stl

# Module-level pipeline state
_pipeline = None


def is_model_loaded() -> bool:
    return _pipeline is not None


def load_model():
    """Load the Hunyuan3D pipeline into VRAM (once, reused for all jobs)."""
    global _pipeline
    if _pipeline is not None:
        logger.info("Pipeline already loaded, skipping")
        return

    logger.info("Loading Hunyuan3D 2.1 pipeline...")
    t0 = time.time()
    _pipeline = img2stl.load_pipeline()
    elapsed = time.time() - t0
    logger.info(f"Pipeline loaded in {elapsed:.1f}s")


def unload_model():
    """Unload the pipeline to free VRAM."""
    global _pipeline
    if _pipeline is not None:
        del _pipeline
        _pipeline = None
        img2stl.clear_vram()
        logger.info("Pipeline unloaded, VRAM freed")


def get_vram_threshold() -> float:
    """
    Return the appropriate min-free-VRAM threshold.

    When the pipeline is already loaded (~7.4GB in VRAM), we only need a
    small amount of headroom for generation overhead. When it's not loaded,
    we need enough free VRAM for the full pipeline + generation.
    """
    if _pipeline is not None:
        return config.MIN_FREE_VRAM_GB_LOADED
    return config.MIN_FREE_VRAM_GB


ProgressCallback = Callable[[str, int, str], None]


def run_pipeline(
    image_path: str,
    output_dir: str,
    progress_callback: ProgressCallback,
    settings: Optional[dict] = None,
) -> dict:
    """
    Run the full img2stl pipeline on a single image.

    Args:
        image_path: Path to the input image.
        output_dir: Directory for output files (STL, GLB).
        progress_callback: Called at each stage — fn(step, pct, message).
        settings: Optional overrides for steps, guidance, octree_res, seed, height_mm.

    Returns:
        Dict with stl_path, glb_path, vertex_count, face_count,
        is_watertight, generation_time_s.

    Raises:
        RuntimeError: On CUDA OOM or other fatal pipeline errors.
    """
    global _pipeline

    settings = settings or {}
    steps = settings.get('steps', config.DEFAULT_STEPS)
    guidance = settings.get('guidance', config.DEFAULT_GUIDANCE)
    octree_res = settings.get('octree_res', config.DEFAULT_OCTREE_RES)
    seed = settings.get('seed', config.DEFAULT_SEED)
    height_mm = settings.get('height_mm', config.DEFAULT_HEIGHT_MM)

    stem = Path(image_path).stem
    stl_path = str(Path(output_dir) / f"{stem}.stl")
    glb_path = str(Path(output_dir) / f"{stem}.glb")

    os.makedirs(output_dir, exist_ok=True)
    t_start = time.time()

    # ── Step 1: Remove background ──
    progress_callback("removing_background", 10, "Removing background...")
    image = img2stl.remove_background(image_path)

    # ── Step 2: Load pipeline if needed ──
    if _pipeline is None:
        progress_callback("loading_model", 20,
                          "Loading Hunyuan3D 2.1 (first job, ~90s)...")
        load_model()

    # ── Step 3: Generate mesh ──
    progress_callback("generating_mesh", 30,
                      f"Generating mesh (steps={steps}, octree_res={octree_res})...")
    mesh = img2stl.generate_shape(
        _pipeline, image,
        steps=steps,
        guidance=guidance,
        octree_res=octree_res,
        seed=seed,
    )

    if mesh is None:
        raise RuntimeError(
            "CUDA out of memory. Try reducing octree_res or steps.")

    progress_callback("generating_mesh", 70,
                      f"Mesh generated: {len(mesh.vertices):,} vertices, "
                      f"{len(mesh.faces):,} faces")

    # ── Step 4: Post-process ──
    progress_callback("repairing_mesh", 75,
                      "Post-processing (orient, clean, scale)...")
    mesh = img2stl.postprocess_mesh(mesh, target_height_mm=height_mm)

    # ── Step 5: Repair ──
    progress_callback("repairing_mesh", 85, "Repairing mesh for printing...")
    mesh = img2stl.repair_mesh(mesh)

    # ── Step 6: Export ──
    progress_callback("exporting", 90, "Exporting STL...")
    mesh.export(stl_path)

    progress_callback("exporting", 95, "Exporting GLB...")
    mesh.export(glb_path)

    gen_time = time.time() - t_start

    result = {
        'stl_path': stl_path,
        'glb_path': glb_path,
        'vertex_count': len(mesh.vertices),
        'face_count': len(mesh.faces),
        'is_watertight': mesh.is_watertight,
        'generation_time_s': round(gen_time, 1),
    }

    progress_callback("complete", 100,
                      f"Done — {result['vertex_count']:,}v, "
                      f"watertight={'yes' if result['is_watertight'] else 'no'}, "
                      f"{gen_time:.1f}s")

    logger.info(f"Pipeline complete: {result['vertex_count']:,}v, "
                f"{result['face_count']:,}f, "
                f"watertight={result['is_watertight']}, "
                f"{gen_time:.1f}s")
    return result
