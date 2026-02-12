# prompts.py - THE VIBE BIBLE & MASTER PROTOCOL

# 1. THE VISION INSTRUCTION (The Eye)
# This forces Gemini to see the room like a structural engineer, not a poet.
ARCHITECT_PROMPT = """
ACT AS: A Senior Interior Architect and 3D Renderer.

TASK: Analyze the provided image of an empty room and generate a strict execution prompt for an image generation model (like Imagen or Stable Diffusion).

STEP 1: ANALYZE THE PHYSICS
- Identify the FLOORING material (e.g., "White Oak Herringbone", "Polished Concrete").
- Identify the LIGHT SOURCE (e.g., "Soft diffused sunlight from large bay window on left").
- Identify the PERSPECTIVE (e.g., "Eye-level wide shot", "Two-point perspective").
- Identify the NEGATIVE SPACE (Where is the floor empty? That is where furniture goes).

STEP 2: APPLY THE VIBE
- Apply the following design language: "{style}"
- Select furniture pieces that match this vibe EXACTLY.

STEP 3: GENERATE THE OUTPUT
Write a single, continuous prompt string using this exact template. Do not add intro text.

TEMPLATE:
"A photorealistic [Perspective] of an empty [Room Type] now staged with [Vibe Name] furniture. The room features [Flooring] and [Architectural Details].
CENTRAL FOCUS: A [Key Furniture Piece] positioned in the [Negative Space], facing the [Focal Point].
DETAILS: [List 3 specific decor items from Vibe].
LIGHTING: [Light Source] creating [Mood] shadows.
QUALITY: Architectural Digest photography, 8k resolution, highly detailed textures, ray-tracing, depth of field."
"""

# 2. THE 8 IMMUTABLE VIBES (The Styles)
STYLES = {
    "Monarch": "Modern Luxury Opulence. Palette: Black, Gold, Emerald Green. Furniture: Tufted velvet sofas, brass coffee tables, crystal lighting. Mood: Expensive, Moody, High-Contrast.",
    "Industrialist": "Raw Urban Loft. Palette: Charcoal, Rust, Concrete Gray. Furniture: Distressed cognac leather chesterfields, black steel shelving, exposed brick. Mood: Masculine, Gritty, Authentic.",
    "Purist": "Japanese-Scandinavian Minimalist. Palette: Warm White, Beige, Light Oak. Furniture: Low-profile linen sofas, noguchi tables, zero clutter. Mood: Zen, Airy, Soft.",
    "Naturalist": "Biophilic Sanctuary. Palette: Sage Green, Terracotta, Raw Wood. Furniture: Rattan lounge chairs, living plant walls, jute rugs, organic shapes. Mood: Fresh, Oxygenated, Peaceful.",
    "Futurist": "Cyberpunk High-Tech. Palette: Neon Blue, Cool White, Chrome. Furniture: Floating LED beds, acrylic chairs, glossy surfaces, geometric shapes. Mood: Clinical, Sharp, Electric.",
    "Curator": "Eclectic Maximalist. Palette: Mustard, Teal, Burnt Orange. Furniture: Sculptural velvet armchairs, gallery walls of mixed art, patterned persian rugs. Mood: Artsy, Bold, Collected.",
    "Nomad": "Global Boho. Palette: Ochre, Sand, Deep Red. Furniture: Low floor seating, moroccan poufs, layered textiles, macrame, reclaimed wood. Mood: Warm, Traveled, Earthy.",
    "Classicist": "Traditional Heritage. Palette: Navy Blue, Cream, Mahogany. Furniture: Wingback chairs, heavy drapes, antique brass lamps, persian rugs. Mood: Timeless, Wealthy, Established."
}
