"""
Pydantic schemas for the ODMS ML Verification Service.
Defines payloads for text inputs and the VerificationResult model used by the Express backend.
"""

from typing import Optional
from pydantic import BaseModel, Field

class TextPayload(BaseModel):
    """
    Payload for submitting text directly to the verification endpoint.
    """
    od_id: str = Field(..., description="Unique OD identifier")
    text: str = Field(..., description="The original report text submitted by the student")

class VerificationResult(BaseModel):
    """
    Final result of the originality verification checks. 
    The Express backend relies on is_original to unlock OD applications.
    """
    od_id: str = Field(..., description="Unique OD identifier")
    
    plagiarism_score: float = Field(..., ge=0.0, le=1.0, description="Plagiarism check score (0.0 to 1.0)")
    plagiarism_passed: bool = Field(..., description="True if plagiarism score <= threshold")
    plagiarism_details: Optional[str] = Field(None, description="Details/reasoning for the plagiarism score")
    
    ai_score: float = Field(..., ge=0.0, le=1.0, description="AI content check score (0.0 to 1.0)")
    ai_passed: bool = Field(..., description="True if AI score <= threshold")
    ai_details: Optional[str] = Field(None, description="Details/reasoning for the AI score")
    
    is_original: bool = Field(..., description="True if both plagiarism and AI checks pass")
    verdict_message: str = Field(..., description="Human-readable summary of the combined verification outcome")
    word_count: int = Field(..., description="Total word count of the processed report text")
