const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { runAsync, getAsync } = require('../config/database');

// Generate JWT Token
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRE
    });
};

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res) => {
    try {
        const { username, email, password, displayName } = req.body;

        // Validation
        if (!username || !email || !password || !displayName) {
            return res.status(400).json({ 
                success: false, 
                message: 'Tüm alanları doldurun' 
            });
        }

        // Check if user exists
        const existingUser = await getAsync(
            'SELECT * FROM users WHERE username = ? OR email = ?',
            [username, email]
        );

        if (existingUser) {
            return res.status(400).json({ 
                success: false, 
                message: 'Bu kullanıcı adı veya email zaten kullanılıyor' 
            });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create user
        const result = await runAsync(
            `INSERT INTO users (username, email, password, display_name) VALUES (?, ?, ?, ?)`,
            [username, email, hashedPassword, displayName]
        );

        const userId = result.lastID;

        // Get created user
        const user = await getAsync(
            `SELECT id, username, email, display_name, profile_image, created_at FROM users WHERE id = ?`,
            [userId]
        );

        // Generate token
        const token = generateToken(userId);

        res.status(201).json({
            success: true,
            message: 'Kayıt başarılı',
            token,
            user
        });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Sunucu hatası' 
        });
    }
};

// @desc    Login user  
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res) => {
    try {
        const { username, password } = req.body;

        // Validation
        if (!username || !password) {
            return res.status(400).json({ 
                success: false, 
                message: 'Kullanıcı adı ve şifre gerekli' 
            });
        }

        // Check for user
        const user = await getAsync(
            `SELECT * FROM users WHERE username = ? OR email = ?`,
            [username, username]
        );

        if (!user) {
            return res.status(401).json({ 
                success: false, 
                message: 'Kullanıcı bulunamadı' 
            });
        }

        // Check password
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(401).json({ 
                success: false, 
                message: 'Şifre hatalı' 
            });
        }

        // Remove password from response
        delete user.password;

        // Generate token
        const token = generateToken(user.id);

        res.json({
            success: true,
            message: 'Giriş başarılı',
            token,
            user
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Sunucu hatası' 
        });
    }
};

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = (req, res) => {
    res.json({
        success: true,
        user: req.user
    });
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
exports.updateProfile = async (req, res) => {
    try {
        const { displayName } = req.body;
        const userId = req.user.id;

        if (!displayName) {
            return res.status(400).json({ 
                success: false, 
                message: 'İsim gerekli' 
            });
        }

        // Update user
        await runAsync(
            `UPDATE users SET display_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [displayName, userId]
        );

        // Get updated user
        const user = await getAsync(
            `SELECT id, username, email, display_name, profile_image FROM users WHERE id = ?`,
            [userId]
        );

        res.json({
            success: true,
            message: 'Profil güncellendi',
            user
        });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Sunucu hatası' 
        });
    }
};

// @desc    Upload profile image
// @route   POST /api/auth/profile-image
// @access  Private
exports.uploadProfileImage = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ 
                success: false, 
                message: 'Dosya yüklenmedi' 
            });
        }

        const userId = req.user.id;
        const filename = req.file.filename;

        // Update user profile image
        await runAsync(
            `UPDATE users SET profile_image = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [filename, userId]
        );

        // Get updated user
        const user = await getAsync(
            `SELECT id, username, email, display_name, profile_image FROM users WHERE id = ?`,
            [userId]
        );

        res.json({
            success: true,
            message: 'Profil fotoğrafı güncellendi',
            user
        });
    } catch (error) {
        console.error('Upload profile image error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Sunucu hatası' 
        });
    }
};

