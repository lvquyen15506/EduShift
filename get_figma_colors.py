"""Print nonneutral Figma colors for the EduShift design file."""
import json
import os
import urllib.request

token = os.getenv("FIGMA_TOKEN")
if not token:
    raise SystemExit("Set FIGMA_TOKEN before running this script")
file_key = os.getenv("FIGMA_FILE_KEY", "RCQMQ7uA3EQEsEwhhfBV99")
request = urllib.request.Request(
    f"https://api.figma.com/v1/files/{file_key}",
    headers={"X-Figma-Token": token},
)
with urllib.request.urlopen(request, timeout=20) as response:
    data = json.load(response)

colors = set()

def extract_colors(node):
    for fill in node.get("fills", []):
        if fill.get("type") == "SOLID" and "color" in fill:
            color = fill["color"]
            r, g, b = (int(color.get(channel, 0) * 255) for channel in ("r", "g", "b"))
            if not (r > 240 and g > 240 and b > 240) and not (r < 20 and g < 20 and b < 20):
                colors.add(f"#{r:02x}{g:02x}{b:02x}")
    for child in node.get("children", []):
        extract_colors(child)

extract_colors(data["document"])
print("Detected colors:", sorted(colors)[:10])
