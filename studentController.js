const jwt = require('jsonwebtoken');
const Student = require('../models/Student');
const asyncHandler = require('../middleware/asyncHandler');

// Generate JWT
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

// @desc    Register a new student
// @route   POST /api/auth/student/register
// @access  Public
const registerStudent = asyncHandler(async (req, res) => {
    const {
        regNo, name, email, password, department,
        year, section, CGPA, arrears, phone
    } = req.body;

    const studentExists = await Student.findOne({ $or: [{ email }, { regNo }] });

    if (studentExists) {
        res.status(400);
        throw new Error('Student already exists');
    }

    const student = await Student.create({
        regNo, name, email, password, department,
        year, section, CGPA, arrears, phone
    });

    if (student) {
        res.status(201).json({
            _id: student._id,
            regNo: student.regNo,
            name: student.name,
            email: student.email,
            token: generateToken(student._id),
        });
    } else {
        res.status(400);
        throw new Error('Invalid student data');
    }
});

const loginStudent = asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    console.log(`Login attempt for Student: ${email}`);

    const student = await Student.findOne({
        $or: [{ email: email }, { regNo: email }]
    });

    if (student) {
        const isPasswordMatch = await student.matchPassword(password);
        const isPhoneMatch = student.phone === password;

        if (isPasswordMatch || isPhoneMatch) {
            res.json({
                _id: student._id,
                regNo: student.regNo,
                name: student.name,
                email: student.email,
                token: generateToken(student._id),
            });
            return;
        }
    }

    res.status(401);
    throw new Error('Invalid credentials (Email/RegNo and Password/Phone)');
});

module.exports = { registerStudent, loginStudent };
