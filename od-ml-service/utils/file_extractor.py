"""
Utility module for extracting text from uploaded files.
Supports PDF, DOCX, and plain TXT file formats. 
Enforces a 10MB size limit and handles extraction errors.
"""

import logging
import io
from fastapi import UploadFile, HTTPException

logger = logging.getLogger(__name__)

async def extract_text_from_file(file: UploadFile) -> str:
    """
    Reads an uploaded file and parses text content based on its extension or content_type.
    
    Args:
        file: A FastAPI UploadFile object.
        
    Returns:
        Extracted text as a string.
        
    Raises:
        HTTPException: For unsupported files, parse errors, or if exceeding size limits.
    """
    try:
        content = await file.read()
        if len(content) > 10 * 1024 * 1024:
            raise HTTPException(status_code=413, detail="File too large")
            
        filename = file.filename.lower() if file.filename else ""
        content_type = file.content_type
        
        extracted_text = ""
        
        if filename.endswith(".pdf") or content_type == "application/pdf":
            try:
                import pdfplumber
                with pdfplumber.open(io.BytesIO(content)) as pdf:
                    pages_text = []
                    for page in pdf.pages:
                        text = page.extract_text()
                        if text:
                            pages_text.append(text)
                    extracted_text = "\n".join(pages_text).strip()
            except Exception as e:
                logger.error(f"Error parsing PDF: {e}")
                raise HTTPException(status_code=422, detail="Error parsing PDF file")
                
            if not extracted_text:
                raise HTTPException(status_code=422, detail="PDF appears to be scanned/image-only")
                
        elif filename.endswith(".docx") or content_type == "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
            try:
                from docx import Document
                doc = Document(io.BytesIO(content))
                extracted_text = "\n".join([p.text for p in doc.paragraphs]).strip()
            except Exception as e:
                logger.error(f"Error parsing DOCX: {e}")
                raise HTTPException(status_code=422, detail="Error parsing DOCX file")
                
            if not extracted_text:
                raise HTTPException(status_code=422, detail="DOCX file appears empty")
                
        elif filename.endswith(".txt") or content_type == "text/plain":
            extracted_text = content.decode("utf-8", errors="ignore").strip()
            
        else:
            raise HTTPException(status_code=415, detail="Unsupported file type")
            
        return extracted_text
        
    except HTTPException:
        # Re-raise HTTPException as-is
        raise
    except Exception as e:
        logger.error(f"Unexpected file extraction error: {e}")
        # Wrap other exceptions in 422
        raise HTTPException(status_code=422, detail=f"Unexpected error processing file: {str(e)}")
