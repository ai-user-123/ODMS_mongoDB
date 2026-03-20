const express = require('express');
const router = express.Router();
const {
    createOD,
    getStudentODs,
    getFacultyODs,
    facultyApprove,
    coordinatorApprove,
    hodApprove,
    rejectOD,
    getAnalytics,
    getStudentListWithODStatus,
    submitReport,
    upload,
    verifyCheckin
} = require('../controllers/odController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

// Student routes
router.post('/apply', protect, createOD);
router.get('/student/:regNo', protect, getStudentODs);

// Faculty/Admin routes
router.get('/faculty', protect, authorize('FACULTY', 'COORDINATOR', 'HOD', 'ADMIN'), getFacultyODs);
router.get('/faculty/students-status', protect, authorize('FACULTY', 'COORDINATOR', 'HOD', 'ADMIN'), getStudentListWithODStatus);

router.put('/faculty/:id/approve', protect, authorize('FACULTY', 'ADMIN'), facultyApprove);
router.put('/coordinator/:id/approve', protect, authorize('COORDINATOR', 'ADMIN'), coordinatorApprove);
router.put('/hod/:id/approve', protect, authorize('HOD', 'ADMIN'), hodApprove);
router.put('/:id/reject', protect, authorize('FACULTY', 'COORDINATOR', 'HOD', 'ADMIN'), rejectOD);

// Student location check-in
router.put('/:id/checkin', protect, verifyCheckin);

// Admin analytics
router.get('/analytics', protect, authorize('ADMIN'), getAnalytics);

module.exports = router;
