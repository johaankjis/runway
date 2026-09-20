"""Bounded text ingestion. Uploaded bytes are never executed or persisted to the repo."""

import re
from io import BytesIO
from pathlib import PurePosixPath

from pypdf import PdfReader

MAX_FILE_BYTES = 10 * 1024 * 1024
MAX_TEXT_CHARS = 10000
MAX_PDF_PAGES = 25


class UploadValidationError(ValueError):
    def __init__(self, message: str, status_code: int = 422):
        super().__init__(message)
        self.status_code = status_code


def parse_upload(filename: str, mime_type: str, raw: bytes) -> tuple[str, str, str]:
    if len(raw) > MAX_FILE_BYTES:
        raise UploadValidationError("File exceeds the 10 MB limit.", 413)
    if not raw:
        raise UploadValidationError("The file is empty.")
    name = PurePosixPath(filename.replace("\\", "/")).name
    suffix = PurePosixPath(name).suffix.lower()
    expected = {".pdf": "application/pdf", ".txt": "text/plain"}
    if suffix not in expected or mime_type not in {
        expected.get(suffix),
        "application/octet-stream",
        "",
    }:
        raise UploadValidationError("Only PDF and TXT files are supported.", 415)
    stem = re.sub(r"[^A-Za-z0-9._ -]", "_", name[: -len(suffix)]).strip(" .")[:120]
    name = (stem or "document") + suffix
    if suffix == ".pdf":
        if not raw.startswith(b"%PDF-"):
            raise UploadValidationError("The file is not a valid PDF.")
        try:
            reader = PdfReader(BytesIO(raw))
            if reader.is_encrypted:
                raise UploadValidationError("Password-protected PDFs are unsupported.")
            if len(reader.pages) > MAX_PDF_PAGES:
                raise UploadValidationError("PDFs may contain at most 25 pages.")
            pages = []
            for page in reader.pages:
                pages.append(page.extract_text() or "")
                if sum(map(len, pages)) > MAX_TEXT_CHARS:
                    raise UploadValidationError(
                        "Document text exceeds the 10,000 character demo limit."
                    )
            text = "\n".join(pages)
        except UploadValidationError:
            raise
        except Exception as error:
            raise UploadValidationError(
                "The PDF could not be read. Use a valid text-based PDF."
            ) from error
        if not text.strip():
            raise UploadValidationError(
                "No extractable text. Scanned/image-only PDFs are unsupported. No OCR available."
            )
    else:
        try:
            text = raw.decode("utf-8-sig")
        except UnicodeDecodeError as error:
            raise UploadValidationError("TXT files must use UTF-8 encoding.") from error
        if raw.startswith((b"%PDF-", b"PK\x03\x04")) or any(
            ord(char) < 32 and char not in "\n\r\t" for char in text
        ):
            raise UploadValidationError("The file contains binary content, not plain text.")
    if not text.strip():
        raise UploadValidationError("The file contains no usable text.")
    if len(text) > MAX_TEXT_CHARS:
        raise UploadValidationError("Document text exceeds the 10,000 character demo limit.")
    return name, expected[suffix], text
