from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


root = Path("assets/images/garments")
files = sorted(root.glob("*.webp"))
invalid: list[tuple[str, str, tuple[int, int], tuple[int, int] | None]] = []

for path in files:
    with Image.open(path) as image:
        alpha = image.getchannel("A").getextrema() if "A" in image.getbands() else None
        if image.mode != "RGBA" or image.size != (512, 512) or alpha is None or alpha[0] != 0:
            invalid.append((path.name, image.mode, image.size, alpha))

cell_width = 180
cell_height = 170
columns = 5
rows = (len(files) + columns - 1) // columns
sheet = Image.new("RGB", (cell_width * columns, cell_height * rows), "#f7f1ff")
draw = ImageDraw.Draw(sheet)
font = ImageFont.load_default()

for index, path in enumerate(files):
    column = index % columns
    row = index // columns
    x = column * cell_width
    y = row * cell_height
    draw.rounded_rectangle(
        (x + 8, y + 8, x + cell_width - 8, y + cell_height - 8),
        radius=18,
        fill="#ffffff",
        outline="#e5d7f7",
        width=2,
    )
    with Image.open(path).convert("RGBA") as asset:
        asset.thumbnail((132, 126), Image.Resampling.LANCZOS)
        image_x = x + (cell_width - asset.width) // 2
        image_y = y + 12 + (126 - asset.height) // 2
        sheet.paste(asset, (image_x, image_y), asset)
    label = path.stem.replace("-", " ").title()
    text_width = draw.textbbox((0, 0), label, font=font)[2]
    draw.text((x + (cell_width - text_width) // 2, y + 143), label, fill="#26153d", font=font)

output = Path("tmp/imagegen/catalog-contact-sheet.png")
sheet.save(output, optimize=True)
print(f"assets={len(files)}")
print(f"invalid={invalid}")
print(f"contact_sheet={output.resolve()}")
