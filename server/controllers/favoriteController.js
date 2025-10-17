const { runAsync, getAsync, allAsync } = require('../config/database');

// @desc    Get all favorites
// @route   GET /api/favorites
// @access  Private
exports.getFavorites = async (req, res) => {
    try {
        const userId = req.user.id;

        const favorites = await allAsync(`
            SELECT * FROM favorites 
            WHERE user_id = ? 
            ORDER BY added_at DESC
        `, [userId]);

        res.json({
            success: true,
            count: favorites.length,
            favorites
        });
    } catch (error) {
        console.error('Get favorites error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Sunucu hatası' 
        });
    }
};

// @desc    Add to favorites
// @route   POST /api/favorites
// @access  Private
exports.addFavorite = async (req, res) => {
    try {
        const userId = req.user.id;
        const { videoId, title, channel, thumbnail } = req.body;

        // Validation
        if (!videoId || !title || !channel || !thumbnail) {
            return res.status(400).json({ 
                success: false, 
                message: 'Tüm alanlar gerekli' 
            });
        }

        // Check if already favorited
        const existing = await getAsync(`
            SELECT * FROM favorites 
            WHERE user_id = ? AND video_id = ?
        `, [userId, videoId]);

        if (existing) {
            return res.status(400).json({ 
                success: false, 
                message: 'Bu şarkı zaten favorilerde' 
            });
        }

        await runAsync(`
            INSERT INTO favorites (user_id, video_id, title, channel, thumbnail)
            VALUES (?, ?, ?, ?, ?)
        `, [userId, videoId, title, channel, thumbnail]);

        res.status(201).json({
            success: true,
            message: 'Favorilere eklendi'
        });
    } catch (error) {
        console.error('Add favorite error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Sunucu hatası' 
        });
    }
};

// @desc    Remove from favorites
// @route   DELETE /api/favorites/:videoId
// @access  Private
exports.removeFavorite = async (req, res) => {
    try {
        const userId = req.user.id;
        const videoId = req.params.videoId;

        await runAsync(`
            DELETE FROM favorites 
            WHERE user_id = ? AND video_id = ?
        `, [userId, videoId]);

        res.json({
            success: true,
            message: 'Favorilerden kaldırıldı'
        });
    } catch (error) {
        console.error('Remove favorite error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Sunucu hatası' 
        });
    }
};
