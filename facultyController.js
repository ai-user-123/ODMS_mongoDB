const jwt = require('jsonwebtoken');
const Faculty = require('../models/Faculty');
const asyncHandler = require('../middleware/asyncHandler');

// Generate JWT
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

const loginFaculty = asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    console.log(`Login attempt for Faculty/Admin: ${email}`);

    const faculty = await Faculty.findOne({
        $or: [{ email: email }, { staffId: email }]
    });

    if (faculty) {
        const isPasswordMatch = await faculty.matchPassword(password);
        // Assuming faculty model also has phone, or just use password
        const isPhoneMatch = faculty.phone === password;

        if (isPasswordMatch || isPhoneMatch) {
            res.json({
                _id: faculty._id,
                staffId: faculty.staffId,
                name: faculty.name,
                email: faculty.email,
                role: faculty.role,
                department: faculty.department,
                token: generateToken(faculty._id),
            });
            return;
        }
    }

    res.status(401);
    throw new Error('Invalid credentials (Email/StaffId and Password/Phone)');
});

// @desc    Register a new faculty (Useful for testing)
// @route   POST /api/auth/faculty/register
const registerFaculty = asyncHandler(async (req, res) => {
    const { staffId, name, email, password, department, role } = req.body;
    const facultyExists = await Faculty.findOne({ $or: [{ email }, { staffId }] });

    if (facultyExists) {
        res.status(400);
        throw new Error('Faculty already exists');
    }

    const faculty = await Faculty.create({ staffId, name, email, password, department, role });
    res.status(201).json({
        _id: faculty._id,
        name: faculty.name,
        role: faculty.role,
        token: generateToken(faculty._id),
    });
});

module.exports = { loginFaculty, registerFaculty };
