"""
Main entry point for the ODMS ML Verification Service.
Initializes the FastAPI application and mounts routers.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers.verification import router as verification_router

app = FastAPI(
    title="OD Report Originality Verification API",
    version="1.0.0"
)

# CORS middleware allowing all origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(verification_router, prefix="/api/v1")

@app.get("/health")
async def health_check():
    """
    Health check endpoint to ensure service is up.
    """
    return {"status": "ok"}
