const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const {
    register,
    login,
    getMe,
    updateProfile,
    uploadProfileImage
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');

// Configure multer for profile image upload
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/profiles/');
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'profile-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const fileFilter = (req, file, cb) => {
    // Accept images only: JPG, JPEG, PNG, GIF, WebP
    if (!file.originalname.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
        return cb(new Error('Sadece resim dosyaları yüklenebilir! (JPG, PNG, GIF, WebP)'), false);
    }
    cb(null, true);
};

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max file size
    fileFilter: fileFilter
});

router.post('/register', register);
router.post('/login', login);
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);
router.post('/profile-image', protect, upload.single('image'), uploadProfileImage);

module.exports = router;

