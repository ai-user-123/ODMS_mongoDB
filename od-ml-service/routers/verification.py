"""
API Router for originality verification.
Exposes endpoints for verifying text or file submissions.
"""

import os
import asyncio
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from models.schemas import TextPayload, VerificationResult
from services import plagiarism_service, ai_detection_service
from utils import file_extractor

router = APIRouter()

async def _run_checks(od_id: str, text: str) -> VerificationResult:
    """
    Shared logic to perform plagiarism and AI checks and build the result.
    
    Args:
        od_id: The unique OD identifier.
        text: The extracted report text.
        
    Returns:
        VerificationResult populated with scores and verdicts.
    """
    words = text.split()
    if len(words) < 80:
        raise HTTPException(status_code=422, detail="Report must contain at least 80 words.")
        
    # Run checks concurrently:
    # check_ai_content is synchronous, so we offload it to a background thread
    plagiarism_task = plagiarism_service.check_plagiarism(text)
    ai_task = asyncio.to_thread(ai_detection_service.check_ai_content, text)
    
    (plagiarism_score, plag_details), (ai_score, ai_details) = await asyncio.gather(plagiarism_task, ai_task)
    
    plag_thresh = float(os.getenv("PLAGIARISM_THRESHOLD", "0.40"))
    ai_thresh = float(os.getenv("AI_THRESHOLD", "0.55"))
    
    plag_pass = plagiarism_score <= plag_thresh
    ai_pass = ai_score <= ai_thresh
    is_original = plag_pass and ai_pass
    
    if is_original:
        verdict = "Your report passed all originality checks. You may now apply for your next OD."
    else:
        reasons = []
        if not plag_pass:
            reasons.append(f"Plagiarism score ({plagiarism_score:.2f}) exceeds threshold ({plag_thresh:.2f}).")
        if not ai_pass:
            reasons.append(f"AI content score ({ai_score:.2f}) exceeds threshold ({ai_thresh:.2f}).")
        verdict = "FAIL: " + " ".join(reasons)
        
    return VerificationResult(
        od_id=od_id,
        plagiarism_score=plagiarism_score,
        plagiarism_passed=plag_pass,
        plagiarism_details=plag_details,
        ai_score=ai_score,
        ai_passed=ai_pass,
        ai_details=ai_details,
        is_original=is_original,
        verdict_message=verdict,
        word_count=len(words)
    )

@router.post("/verify/text", response_model=VerificationResult)
async def verify_text(payload: TextPayload):
    """
    Verify originality from an explicitly provided text payload.
    """
    return await _run_checks(payload.od_id, payload.text.strip())

@router.post("/verify/file", response_model=VerificationResult)
async def verify_file(od_id: str = Form(...), file: UploadFile = File(...)):
    """
    Verify originality by extracting text from an uploaded PDF, DOCX, or TXT file.
    """
    text = await file_extractor.extract_text_from_file(file)
    return await _run_checks(od_id, text.strip())
