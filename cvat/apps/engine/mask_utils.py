# Copyright (C) CVAT.ai Corporation
#
# SPDX-License-Identifier: MIT

from __future__ import annotations

import io
from collections.abc import Iterable
from io import BytesIO
from typing import Any

import cv2
import numpy as np
from PIL import Image, ImageDraw


def parse_hex_bgr(hex_str: str | None, default_bgr=(0, 0, 0)) -> tuple[int, int, int]:
    if not hex_str or not isinstance(hex_str, str):
        return default_bgr
    color_str = hex_str.strip()
    try:
        from PIL import ImageColor
        rgb = ImageColor.getrgb(color_str)
        # ImageColor.getrgb returns (r, g, b) or (r, g, b, a)
        return (rgb[2], rgb[1], rgb[0])
    except Exception:
        clean_hex = color_str.lstrip("#")
        if len(clean_hex) == 3:
            clean_hex = "".join(c * 2 for c in clean_hex)
        if len(clean_hex) >= 6:
            try:
                r = int(clean_hex[0:2], 16)
                g = int(clean_hex[2:4], 16)
                b = int(clean_hex[4:6], 16)
                return (b, g, r)
            except ValueError:
                pass
    return default_bgr


def apply_masks_to_pil_image(
    image: Image.Image,
    mask_regions: Iterable[Any],
) -> Image.Image:
    """
    Applies non-destructive mask regions (blackout rectangles/polygons)
    directly to a PIL Image instance in-place (or returns modified image).
    """
    if not mask_regions:
        return image

    width, height = image.size
    draw = ImageDraw.Draw(image)

    for region in mask_regions:
        points = region.points if hasattr(region, "points") else region.get("points", region)
        if not points or not isinstance(points, (list, tuple)):
            continue

        color_val = getattr(region, "color", None) or (region.get("color") if isinstance(region, dict) else None)
        if not isinstance(color_val, str):
            color_val = "#000000"

        try:
            from PIL import ImageColor
            rgb_color = ImageColor.getrgb(color_val)
            if image.mode == "RGB":
                fill_color = rgb_color[:3]
            elif image.mode == "RGBA":
                fill_color = rgb_color if len(rgb_color) == 4 else (*rgb_color[:3], 255)
            elif image.mode == "L":
                fill_color = rgb_color[0]
            else:
                fill_color = rgb_color
        except Exception:
            fill_color = (0, 0, 0) if image.mode == "RGB" else ((0, 0, 0, 255) if image.mode == "RGBA" else 0)

        if len(points) == 4:
            x1, y1, x2, y2 = [float(p) for p in points]
            # Ensure proper ordering and clamp to image bounds
            left = max(0, min(x1, x2))
            top = max(0, min(y1, y2))
            right = min(width, max(x1, x2))
            bottom = min(height, max(y1, y2))
            if right > left and bottom > top:
                draw.rectangle([left, top, right, bottom], fill=fill_color)
        elif len(points) >= 6 and len(points) % 2 == 0:
            poly_points = [(float(points[i]), float(points[i + 1])) for i in range(0, len(points), 2)]
            draw.polygon(poly_points, fill=fill_color)

    return image


def apply_masks_to_cv_image(
    image: np.ndarray,
    mask_regions: Iterable[Any],
) -> np.ndarray:
    """
    Applies non-destructive mask regions to an OpenCV (numpy) image.
    """
    if not mask_regions:
        return image

    height, width = image.shape[:2]

    for region in mask_regions:
        points = region.points if hasattr(region, "points") else region.get("points", region)
        if not points or not isinstance(points, (list, tuple)):
            continue

        color_str = getattr(region, "color", None) or (region.get("color") if isinstance(region, dict) else None)
        if not isinstance(color_str, str):
            color_str = "#000000"
        bgr = parse_hex_bgr(color_str)

        if len(points) == 4:
            x1, y1, x2, y2 = [int(round(float(p))) for p in points]
            left = max(0, min(x1, x2))
            top = max(0, min(y1, y2))
            right = min(width, max(x1, x2))
            bottom = min(height, max(y1, y2))
            if right > left and bottom > top:
                cv2.rectangle(image, (left, top), (right, bottom), bgr, -1)
        elif len(points) >= 6 and len(points) % 2 == 0:
            poly_points = np.array(
                [[int(round(float(points[i]))), int(round(float(points[i + 1])))] for i in range(0, len(points), 2)],
                dtype=np.int32,
            )
            cv2.fillPoly(image, [poly_points], bgr)

    return image


def apply_masks_to_image_bytes(
    image_bytes: BytesIO | bytes,
    mask_regions: Iterable[Any],
    mime: str | None = "image/jpeg",
) -> BytesIO:
    """
    Decodes image from BytesIO or bytes, paints mask regions, and re-encodes
    to BytesIO maintaining the requested mime format.
    """
    if isinstance(image_bytes, BytesIO):
        raw_bytes = image_bytes.getvalue()
    else:
        raw_bytes = image_bytes

    if not mask_regions:
        return BytesIO(raw_bytes)

    with Image.open(io.BytesIO(raw_bytes)) as pil_img:
        format_name = pil_img.format or ("PNG" if mime and "png" in mime.lower() else "JPEG")
        # Ensure image is in RGB or RGBA mode to draw mask
        if pil_img.mode not in ("RGB", "RGBA"):
            converted_img = pil_img.convert("RGB")
        else:
            converted_img = pil_img.copy()

        apply_masks_to_pil_image(converted_img, mask_regions)

        # Ensure JPEG cannot be RGBA
        if format_name.upper() in ("JPEG", "JPG") and converted_img.mode == "RGBA":
            converted_img = converted_img.convert("RGB")

        out_buffer = BytesIO()
        if format_name.upper() in ("JPEG", "JPG"):
            converted_img.save(out_buffer, format="JPEG", quality=95)
        else:
            converted_img.save(out_buffer, format=format_name)

        out_buffer.seek(0)
        return out_buffer


def get_interpolated_masks_for_frame(job, frame_number: int) -> list[Any]:
    from cvat.apps.engine import models

    shapes = list(
        models.FrameMaskRegion.objects.filter(
            job=job, frame=frame_number, track_id__isnull=True
        )
    )

    track_ids = (
        models.FrameMaskRegion.objects.filter(job=job, track_id__isnull=False)
        .values_list("track_id", flat=True)
        .distinct()
    )

    track_masks = []
    for tid in track_ids:
        keyframes = list(
            models.FrameMaskRegion.objects.filter(job=job, track_id=tid).order_by("frame")
        )
        if not keyframes:
            continue
        first_kf = keyframes[0]
        if frame_number < first_kf.frame:
            continue

        exact_kf = next((k for k in keyframes if k.frame == frame_number), None)
        if exact_kf:
            if not exact_kf.outside:
                track_masks.append(exact_kf)
            continue

        prev_kf = None
        next_kf = None
        for k in keyframes:
            if k.frame < frame_number:
                prev_kf = k
            elif k.frame > frame_number and next_kf is None:
                next_kf = k
                break

        if prev_kf and prev_kf.outside:
            continue

        if prev_kf and next_kf and len(prev_kf.points) == 4 and len(next_kf.points) == 4:
            ratio = (frame_number - prev_kf.frame) / (next_kf.frame - prev_kf.frame)
            p1 = prev_kf.points
            p2 = next_kf.points
            interp_points = [p1[i] + (p2[i] - p1[i]) * ratio for i in range(4)]
            track_masks.append(
                models.FrameMaskRegion(
                    id=prev_kf.id,
                    job=job,
                    track_id=tid,
                    frame=frame_number,
                    points=interp_points,
                    color=prev_kf.color,
                    is_keyframe=False,
                    outside=False,
                    owner=prev_kf.owner,
                    z_order=prev_kf.z_order,
                )
            )
        elif prev_kf and not prev_kf.outside:
            track_masks.append(
                models.FrameMaskRegion(
                    id=prev_kf.id,
                    job=job,
                    track_id=tid,
                    frame=frame_number,
                    points=prev_kf.points,
                    color=prev_kf.color,
                    is_keyframe=False,
                    outside=False,
                    owner=prev_kf.owner,
                    z_order=prev_kf.z_order,
                )
            )

    return shapes + track_masks
