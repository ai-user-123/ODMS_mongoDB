const ODRequest = require('../models/ODRequest');
const Student = require('../models/Student');
const Faculty = require('../models/Faculty');
const mongoose = require('mongoose');
const asyncHandler = require('../middleware/asyncHandler');
const multer = require('multer');
const { verifyTextReport, verifyFileReport } = require('./mlVerification');

// Configure multer to save uploaded files to the uploads/ folder
const upload = multer({ dest: 'uploads/' });

// @desc    Create new OD request
// @route   POST /api/od/apply
const createOD = asyncHandler(async (req, res) => {
    const { reason, proofFile, fromDate, toDate, location } = req.body;

    const odRequest = await ODRequest.create({
        student: req.user._id,
        reason,
        proofFile,
        fromDate,
        toDate,
        location,
        status: 'PENDING'
    });

    res.status(201).json(odRequest);
});

// @desc    Get student OD requests
// @route   GET /api/od/student/:regNo
const getStudentODs = asyncHandler(async (req, res) => {
    let regNo = req.params.regNo;
    if (regNo === 'CURRENT' && req.user) {
        regNo = req.user.regNo || req.user.staffId;
    }

    const student = await Student.findOne({ regNo });
    if (!student) {
        res.status(404);
        throw new Error('Student not found');
    }

    const ods = await ODRequest.find({ student: student._id })
        .populate('student', 'name regNo department year email')
        .populate('approvedBy.faculty', 'name role');

    res.json(ods);
});

// @desc    Get ODs for faculty approval
// @route   GET /api/od/faculty
const getFacultyODs = asyncHandler(async (req, res) => {
    const role = req.user.role;
    let query = {};

    if (role === 'FACULTY') {
        query = { status: 'PENDING' };
    } else if (role === 'COORDINATOR') {
        query = { status: 'FACULTY_APPROVED' };
    } else if (role === 'HOD') {
        query = { status: 'COORDINATOR_APPROVED' };
    }

    const ods = await ODRequest.find(query)
        .populate('student', 'name regNo department year section email')
        .sort('-createdAt');

    res.json(ods);
});

// @desc    Faculty Approve OD
// @route   PUT /api/od/faculty/:id/approve
const facultyApprove = asyncHandler(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        res.status(400);
        throw new Error('Invalid OD request ID format');
    }

    const od = await ODRequest.findById(req.params.id);
    if (!od) {
        res.status(404);
        throw new Error('OD not found');
    }

    od.status = 'FACULTY_APPROVED';
    od.approvedBy.push({
        faculty: req.user._id,
        role: 'FACULTY'
    });

    await od.save();
    res.json(od);
});

// @desc    Coordinator Approve OD
// @route   PUT /api/od/coordinator/:id/approve
const coordinatorApprove = asyncHandler(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        res.status(400);
        throw new Error('Invalid OD request ID format');
    }

    const od = await ODRequest.findById(req.params.id);
    if (!od) {
        res.status(404);
        throw new Error('OD not found');
    }

    od.status = 'COORDINATOR_APPROVED';
    od.approvedBy.push({
        faculty: req.user._id,
        role: 'COORDINATOR'
    });

    await od.save();
    res.json(od);
});

// @desc    Final HOD approval and QR assignment
// @route   PUT /api/od/hod/:id/approve
const finalApproveOD = asyncHandler(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        res.status(400);
        throw new Error('Invalid OD request ID format');
    }

    const od = await ODRequest.findById(req.params.id).populate('student');
    if (!od) {
        res.status(404);
        throw new Error('OD not found');
    }

    od.status = 'HOD_APPROVED';
    od.isFinalApproved = true;

    od.approvedBy.push({
        faculty: req.user._id,
        role: 'HOD'
    });

    const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';
    const qrData = `${BASE_URL}/verify/${od._id}`;
    od.qrCodeData = qrData;

    await od.save();
    res.json({ od, qrData });
});

// Backwards-compatible alias
const hodApprove = finalApproveOD;

// @desc    Reject OD
// @route   PUT /api/od/:id/reject
const rejectOD = asyncHandler(async (req, res) => {
    const { remarks } = req.body;
    const od = await ODRequest.findById(req.params.id);
    if (!od) {
        res.status(404);
        throw new Error('OD not found');
    }

    od.status = 'REJECTED';
    od.remarks = remarks || 'Rejected by administration';

    await od.save();
    res.json(od);
});

// @desc    Get Admin Analytics
// @route   GET /api/od/analytics
const getAnalytics = asyncHandler(async (req, res) => {
    const totalODs = await ODRequest.countDocuments();
    const approved = await ODRequest.countDocuments({ status: 'HOD_APPROVED' });
    const rejected = await ODRequest.countDocuments({ status: 'REJECTED' });
    const pending = await ODRequest.countDocuments({
        status: { $nin: ['HOD_APPROVED', 'REJECTED'] }
    });

    res.json({
        totalODs,
        approved,
        rejected,
        pending,
        approvalRate: totalODs > 0 ? (approved / totalODs) * 100 : 0
    });
});

// @desc    Get Student List with Latest OD Status
// @route   GET /api/od/faculty/students-status
const getStudentListWithODStatus = asyncHandler(async (req, res) => {
    const students = await Student.find({ department: req.user.department })
        .select('name regNo year section department');

    const studentsWithStatus = await Promise.all(students.map(async (student) => {
        const latestOD = await ODRequest.findOne({ student: student._id })
            .sort('-createdAt')
            .select('status reason fromDate toDate');

        return {
            ...student._doc,
            latestOD: latestOD || { status: 'NO_OD_APPLIED' }
        };
    }));

    res.json(studentsWithStatus);
});

// @desc    Verify Student Location Check-in
// @route   PUT /api/od/:id/checkin
const verifyCheckin = asyncHandler(async (req, res) => {
    const { location } = req.body;
    const od = await ODRequest.findById(req.params.id);
    if (!od) {
        res.status(404);
        throw new Error('OD not found');
    }

    od.checkInLocation = location;
    od.checkInTime = new Date();
    od.isLocationVerified = !!(location.latitude && location.longitude);

    await od.save();
    res.json({
        verified: od.isLocationVerified,
        message: od.isLocationVerified
            ? 'Location captured successfully'
            : 'Invalid location data'
    });
});

// @desc    Public verification endpoint for Digital OD Pass QR
// @route   GET /verify/:id
const verifyOD = asyncHandler(async (req, res) => {
    const od = await ODRequest.findById(req.params.id)
        .populate('student', 'name regNo');

    if (!od || !od.isFinalApproved) {
        return res.status(404).json({
            valid: false,
            message: 'OD record not found or not finally approved'
        });
    }

    return res.json({
        valid: true,
        studentName: od.student.name,
        regNo: od.student.regNo,
        purpose: od.reason,
        fromDate: od.fromDate,
        toDate: od.toDate,
        status: od.status
    });
});

// @desc    Student submits OD event report after HOD approval
// @route   POST /api/od/:id/submit-report
const submitReport = asyncHandler(async (req, res) => {

    // 1. Load the OD document
    const od = await ODRequest.findById(req.params.id);
    if (!od) {
        return res.status(404).json({ message: 'OD application not found.' });
    }

    // 2. Guard: only HOD approved ODs can have a report submitted
    if (od.status !== 'HOD_APPROVED') {
        return res.status(400).json({
            message: 'OD is not yet fully approved by HOD.'
        });
    }

    // 3. Guard: prevent double submission
    if (od.reportSubmitted) {
        return res.status(400).json({ message: 'Report already submitted.' });
    }

    // 4. Run ML verification (text or file)
    let result;
    if (req.file) {
        // Student uploaded a PDF or DOCX
        result = await verifyFileReport(
            od._id.toString(),
            req.file.path,
            req.file.mimetype
        );
    } else if (req.body.text) {
        // Student typed text into the form
        result = await verifyTextReport(od._id.toString(), req.body.text);
    } else {
        return res.status(400).json({
            message: 'Provide report text or upload a PDF/DOCX file.'
        });
    }

    // 5. Persist result to MongoDB
    od.reportSubmitted    = true;
    od.canApplyNextOD     = result.isOriginal;  // ← KEY GATE
    od.reportVerification = {
        isOriginal:      result.isOriginal,
        plagiarismScore: result.scores.plagiarism,
        aiScore:         result.scores.ai,
        verdict:         result.verdict,
        checkedAt:       new Date(),
    };
    await od.save();

    // 6. Return result to React frontend
    res.status(200).json({
        success:    true,
        isOriginal: result.isOriginal,
        verdict:    result.verdict,
        scores:     result.scores,
    });
});

module.exports = {
    createOD,
    getStudentODs,
    getFacultyODs,
    facultyApprove,
    coordinatorApprove,
    hodApprove,
    rejectOD,
    getAnalytics,
    getStudentListWithODStatus,
    verifyCheckin,
    finalApproveOD,
    submitReport,
    upload,
    verifyOD
};