import json
import string
import argparse

from fontTools.ttLib import TTFont
from fontTools.pens.basePen import BasePen
from fontTools.pens.boundsPen import BoundsPen


class PathCollectorPen(BasePen):
    def __init__(self, glyphSet):
        super().__init__(glyphSet)
        self.paths = []

    def _moveTo(self, p0):
        self.paths.append({"type": "moveTo", "points": [p0]})

    def _lineTo(self, p1):
        self.paths.append({"type": "lineTo", "points": [p1]})

    def _qCurveToOne(self, *points):
        self.paths.append({"type": "qCurveTo", "points": points})

    def _closePath(self):
        self.paths.append({"type": "closePath", "points": []})


def main(args):
    glyph_set = TTFont(args.file).getGlyphSet()
    glyph_names = args.glyphs

    glyph_data = {}
    for glyph_name in glyph_names:
        glyph = glyph_set[glyph_name]

        aabb_pen = BoundsPen(glyph)
        path_pen = PathCollectorPen(glyph)

        glyph.draw(aabb_pen)
        glyph.draw(path_pen)

        xmin, ymin, xmax, ymax = aabb_pen.bounds
        glyph_data[glyph_name] = {
            "aabb": {
                "xmin": xmin,
                "ymin": ymin,
                "xmax": xmax,
                "ymax": ymax,
                "w": xmax - xmin,
                "h": ymax - ymin,
            },
            "code": path_pen.paths,
        }

    with open(args.output, "w") as file:
        json_string = json.dumps(glyph_data, indent=2)
        file.write(f"const glyphs = {json_string};")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Extract the glyph data from a .ttf file"
    )

    parser.add_argument("file", type=str,
        help="The path to the .ttf file.")

    parser.add_argument("--output", "-o", type=str, default="glyphs.js",
        help="The path to the output .js file.")

    parser.add_argument("--glyphs", "-g", type=str, default=string.ascii_letters,
        help="The set of glyphs to include in the output.")

    args = parser.parse_args()
    args.glyphs = "".join(sorted(set(args.glyphs)))

    main(args)
