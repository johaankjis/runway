"""Rebuild the fictional demo PDF: pip install reportlab; python generate_pdf.py."""

from pathlib import Path

from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen.canvas import Canvas

root = Path(__file__).resolve().parent
canvas = Canvas(str(root / "freshfields-surcharge.pdf"), pagesize=letter, invariant=1)
canvas.setTitle("FreshFields Produce - Fictional Runway Demo")
canvas.setAuthor("Runway synthetic demo")
canvas.setFillColor(HexColor("#16324f"))
canvas.setFont("Helvetica-Bold", 20)
canvas.drawString(48, 735, "FreshFields Produce")
canvas.setFont("Helvetica", 12)
canvas.drawString(48, 713, "Delivery surcharge notice")
canvas.setStrokeColor(HexColor("#b8c9d9"))
canvas.line(48, 695, 564, 695)
text = canvas.beginText(48, 665)
text.setFont("Helvetica", 10)
text.setLeading(19)
for line in (root / "freshfields-surcharge.txt").read_text().splitlines():
    text.textLine(line)
canvas.drawText(text)
canvas.setFont("Helvetica", 9)
canvas.drawString(48, 55, "Runway demo | Fictional source inputs | No real vendor or transaction")
canvas.save()
