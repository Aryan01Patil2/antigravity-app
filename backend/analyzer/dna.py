"""
Code DNA SVG Fingerprint Generator
Converts code metrics into a unique, deterministic visual fingerprint.
"""
import hashlib
import math
import base64
from typing import Any


def _metric_hash(metrics: dict[str, Any]) -> str:
    key = "|".join([
        str(metrics.get("line_count", 0)),
        str(metrics.get("function_count", 0)),
        str(metrics.get("max_nesting_depth", 0)),
        str(metrics.get("cyclomatic_complexity", 0)),
        str(metrics.get("comment_ratio", 0)),
        str(metrics.get("magic_numbers_count", 0)),
    ])
    return hashlib.sha256(key.encode()).hexdigest()


def _hsv_to_hex(h: float, s: float, v: float) -> str:
    """Convert HSV (0-360, 0-1, 0-1) to hex color string."""
    h_i = int(h / 60) % 6
    f = h / 60 - int(h / 60)
    p = v * (1 - s)
    q = v * (1 - f * s)
    t = v * (1 - (1 - f) * s)
    rgb_map = [(v, t, p), (q, v, p), (p, v, t), (p, q, v), (t, p, v), (v, p, q)]
    r, g, b = rgb_map[h_i]
    return "#{:02x}{:02x}{:02x}".format(int(r * 255), int(g * 255), int(b * 255))


def generate_dna_svg(metrics: dict[str, Any], score: int) -> str:
    """Generate a unique SVG fingerprint for the given code metrics."""
    h = _metric_hash(metrics)
    seed_vals = [int(h[i:i+2], 16) for i in range(0, 32, 2)]  # 16 values 0-255

    # Map metrics to visual properties
    nesting = min(metrics.get("max_nesting_depth", 0), 8)
    complexity = min(metrics.get("cyclomatic_complexity", 1), 20)
    fn_count = min(metrics.get("function_count", 0), 15)
    comment_ratio = metrics.get("comment_ratio", 0)
    line_count = min(metrics.get("line_count", 0), 500)

    # Derived visual params
    num_rings = max(3, min(8, fn_count + 2))
    color_hue = (score / 100) * 140  # 0=red, 140=green
    saturation = 0.6 + (complexity / 20) * 0.4
    curve_radius = 20 + nesting * 8
    line_weight = 1.0 + (line_count / 500) * 2.0
    opacity_base = 0.4 + comment_ratio * 0.5

    W, H = 280, 280
    cx, cy = W // 2, H // 2

    paths = []
    for ring in range(num_rings):
        ring_idx = ring % len(seed_vals)
        radius = 30 + ring * (cx - 30) // num_rings
        phase = seed_vals[ring_idx] / 255 * math.pi * 2
        points_count = 6 + (seed_vals[(ring_idx + 1) % 16] % 6)
        hue = (color_hue + ring * 20) % 360
        color = _hsv_to_hex(hue, saturation, 0.85)
        opacity = round(opacity_base - ring * 0.05, 2)

        # Generate organic polygon path
        pts = []
        for i in range(points_count):
            angle = phase + (2 * math.pi * i / points_count)
            wobble = 1.0 + (seed_vals[(ring_idx + i) % 16] / 255 - 0.5) * 0.35
            r = radius * wobble
            x = round(cx + r * math.cos(angle), 2)
            y = round(cy + r * math.sin(angle), 2)
            pts.append((x, y))

        # Cubic bezier path
        d_parts = [f"M {pts[0][0]} {pts[0][1]}"]
        for i in range(1, len(pts)):
            px, py = pts[i - 1]
            nx, ny = pts[i]
            mx = round((px + nx) / 2, 2)
            my = round((py + ny) / 2, 2)
            cr = curve_radius * wobble
            d_parts.append(f"Q {px + cr * 0.2} {py + cr * 0.2} {mx} {my}")
        d_parts.append("Z")

        paths.append(
            f'<path d="{" ".join(d_parts)}" '
            f'stroke="{color}" fill="{color}" fill-opacity="{opacity * 0.15}" '
            f'stroke-width="{round(line_weight, 2)}" stroke-opacity="{opacity}" />'
        )

    # Center score circle
    score_color = _hsv_to_hex(color_hue, 0.8, 0.9)
    center_circle = (
        f'<circle cx="{cx}" cy="{cy}" r="22" fill="none" '
        f'stroke="{score_color}" stroke-width="2.5" />'
        f'<text x="{cx}" y="{cy + 5}" text-anchor="middle" '
        f'font-family="monospace" font-size="13" font-weight="bold" '
        f'fill="{score_color}">{score}</text>'
    )

    # Background particles
    particles = []
    for i in range(8):
        px = seed_vals[i] / 255 * W
        py = seed_vals[(i + 8) % 16] / 255 * H
        pr = 1 + seed_vals[(i + 3) % 16] / 255 * 3
        hue_p = (color_hue + i * 45) % 360
        pc = _hsv_to_hex(hue_p, 0.5, 0.9)
        particles.append(f'<circle cx="{px:.1f}" cy="{py:.1f}" r="{pr:.1f}" fill="{pc}" opacity="0.4"/>')

    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">
  <defs>
    <radialGradient id="bg" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#1a1a2e" />
      <stop offset="100%" stop-color="#0d0d1a" />
    </radialGradient>
  </defs>
  <rect width="{W}" height="{H}" rx="16" fill="url(#bg)" />
  {"".join(particles)}
  {"".join(paths)}
  {center_circle}
</svg>"""

    b64 = base64.b64encode(svg.encode()).decode()
    return f"data:image/svg+xml;base64,{b64}"
