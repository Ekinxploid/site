const jwt = require('jsonwebtoken');
const { getAsync } = require('../config/database');

const protect = async (req, res, next) => {
    let token;

    // Check for token in Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }

    // Make sure token exists
    if (!token) {
        return res.status(401).json({ 
            success: false, 
            message: 'Giriş yapmadan bu işlemi yapamazsınız' 
        });
    }

    try {
        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Get user from database
        const user = await getAsync(
            'SELECT id, username, email, display_name, profile_image FROM users WHERE id = ?',
            [decoded.id]
        );

        if (!user) {
            return res.status(401).json({ 
                success: false, 
                message: 'Kullanıcı bulunamadı' 
            });
        }

        req.user = user;
        next();
    } catch (error) {
        return res.status(401).json({ 
            success: false, 
            message: 'Token geçersiz' 
        });
    }
};

module.exports = { protect };

