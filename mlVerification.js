// mlVerification.js
// Helper that calls the FastAPI ML service from Express.
// Uses CommonJS (require) to match the rest of this codebase.

const axios    = require('axios');
const FormData = require('form-data');
const fs       = require('fs');

const ML_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

// --- Text report ---
const verifyTextReport = async (odId, text) => {
    const res = await axios.post(`${ML_URL}/api/v1/verify/text`, {
        od_id: odId,
        text,
    });
    return _parse(res.data);
};

// --- File report (PDF or DOCX) ---
const verifyFileReport = async (odId, filePath, mimeType) => {
    const form = new FormData();
    form.append('od_id', odId);
    form.append('file', fs.createReadStream(filePath), {
        contentType: mimeType,
        filename:    filePath.split('/').pop(),
    });

    const res = await axios.post(`${ML_URL}/api/v1/verify/file`, form, {
        headers: form.getHeaders(),
    });
    return _parse(res.data);
};

// --- Internal: normalise FastAPI response ---
const _parse = (data) => ({
    isOriginal:      data.is_original,
    verdict:         data.verdict_message,
    plagiarismScore: data.scores.plagiarism,
    aiScore:         data.scores.ai_generated,
    checkedAt:       new Date()
});

module.exports = { verifyTextReport, verifyFileReport };

const_parse = (data) => ({
    isOriginal:      data.is_original,
    verdict:         data.verdict_message,
    plagiarismScore: data.plagiarism_score, // Mapping FastAPI 'plagiarism_score' to Schema 'plagiarismScore'
    aiScore:         data.ai_score,         // Mapping FastAPI 'ai_score' to Schema 'aiScore'
    wordCount:       data.word_count,       // You might want to add this to your Schema too!
    checkedAt:       new Date()
});