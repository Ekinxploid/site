const { runAsync, getAsync, allAsync } = require('../config/database');

// @desc    Get all playlists for current user
// @route   GET /api/playlists
// @access  Private
exports.getPlaylists = async (req, res) => {
    try {
        const userId = req.user.id;

        const playlists = await allAsync(`
            SELECT p.*, 
                   COUNT(pt.id) as track_count
            FROM playlists p
            LEFT JOIN playlist_tracks pt ON p.id = pt.playlist_id
            WHERE p.user_id = ?
            GROUP BY p.id
            ORDER BY p.created_at DESC
        `, [userId]);

        res.json({
            success: true,
            count: playlists.length,
            playlists
        });
    } catch (error) {
        console.error('Get playlists error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Sunucu hatası' 
        });
    }
};

// @desc    Get single playlist
// @route   GET /api/playlists/:id
// @access  Private
exports.getPlaylist = async (req, res) => {
    try {
        const playlistId = req.params.id;
        const userId = req.user.id;

        const playlist = await getAsync(`
            SELECT * FROM playlists 
            WHERE id = ? AND user_id = ?
        `, [playlistId, userId]);

        if (!playlist) {
            return res.status(404).json({ 
                success: false, 
                message: 'Playlist bulunamadı' 
            });
        }

        // Get tracks
        const tracks = await allAsync(`
            SELECT * FROM playlist_tracks 
            WHERE playlist_id = ? 
            ORDER BY position ASC
        `, [playlistId]);

        res.json({
            success: true,
            playlist: {
                ...playlist,
                tracks
            }
        });
    } catch (error) {
        console.error('Get playlist error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Sunucu hatası' 
        });
    }
};

// @desc    Create new playlist
// @route   POST /api/playlists
// @access  Private
exports.createPlaylist = async (req, res) => {
    try {
        const { name, description, isPublic } = req.body;
        const userId = req.user.id;

        if (!name) {
            return res.status(400).json({ 
                success: false, 
                message: 'Playlist adı gerekli' 
            });
        }

        const result = await runAsync(`
            INSERT INTO playlists (user_id, name, description, is_public)
            VALUES (?, ?, ?, ?)
        `, [userId, name, description || '', isPublic ? 1 : 0]);

        const playlist = await getAsync('SELECT * FROM playlists WHERE id = ?', [result.lastID]);

        res.status(201).json({
            success: true,
            message: 'Playlist oluşturuldu',
            playlist
        });
    } catch (error) {
        console.error('Create playlist error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Sunucu hatası' 
        });
    }
};

// @desc    Update playlist
// @route   PUT /api/playlists/:id
// @access  Private
exports.updatePlaylist = async (req, res) => {
    try {
        const playlistId = req.params.id;
        const userId = req.user.id;
        const { name, description, isPublic } = req.body;

        // Check ownership
        const playlist = await getAsync('SELECT * FROM playlists WHERE id = ? AND user_id = ?', [playlistId, userId]);

        if (!playlist) {
            return res.status(404).json({ 
                success: false, 
                message: 'Playlist bulunamadı' 
            });
        }

        await runAsync(`
            UPDATE playlists 
            SET name = ?, description = ?, is_public = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [
            name || playlist.name,
            description !== undefined ? description : playlist.description,
            isPublic !== undefined ? (isPublic ? 1 : 0) : playlist.is_public,
            playlistId
        ]);

        const updatedPlaylist = await getAsync('SELECT * FROM playlists WHERE id = ?', [playlistId]);

        res.json({
            success: true,
            message: 'Playlist güncellendi',
            playlist: updatedPlaylist
        });
    } catch (error) {
        console.error('Update playlist error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Sunucu hatası' 
        });
    }
};

// @desc    Delete playlist
// @route   DELETE /api/playlists/:id
// @access  Private
exports.deletePlaylist = async (req, res) => {
    try {
        const playlistId = req.params.id;
        const userId = req.user.id;

        // Check ownership
        const playlist = await getAsync('SELECT * FROM playlists WHERE id = ? AND user_id = ?', [playlistId, userId]);

        if (!playlist) {
            return res.status(404).json({ 
                success: false, 
                message: 'Playlist bulunamadı' 
            });
        }

        await runAsync('DELETE FROM playlists WHERE id = ?', [playlistId]);

        res.json({
            success: true,
            message: 'Playlist silindi'
        });
    } catch (error) {
        console.error('Delete playlist error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Sunucu hatası' 
        });
    }
};

// @desc    Add track to playlist
// @route   POST /api/playlists/:id/tracks
// @access  Private
exports.addTrack = async (req, res) => {
    try {
        const playlistId = req.params.id;
        const userId = req.user.id;
        const { videoId, title, channel, thumbnail } = req.body;

        // Check ownership
        const playlist = await getAsync('SELECT * FROM playlists WHERE id = ? AND user_id = ?', [playlistId, userId]);

        if (!playlist) {
            return res.status(404).json({ 
                success: false, 
                message: 'Playlist bulunamadı' 
            });
        }

        // Check if track already exists
        const existing = await getAsync(`
            SELECT * FROM playlist_tracks 
            WHERE playlist_id = ? AND video_id = ?
        `, [playlistId, videoId]);

        if (existing) {
            return res.status(400).json({ 
                success: false, 
                message: 'Bu şarkı zaten playlistte' 
            });
        }

        // Get next position
        const maxPosition = await getAsync(`
            SELECT MAX(position) as max FROM playlist_tracks 
            WHERE playlist_id = ?
        `, [playlistId]);

        const position = (maxPosition?.max || 0) + 1;

        await runAsync(`
            INSERT INTO playlist_tracks (playlist_id, video_id, title, channel, thumbnail, position)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [playlistId, videoId, title, channel, thumbnail, position]);

        res.status(201).json({
            success: true,
            message: 'Şarkı eklendi'
        });
    } catch (error) {
        console.error('Add track error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Sunucu hatası' 
        });
    }
};

// @desc    Remove track from playlist
// @route   DELETE /api/playlists/:id/tracks/:trackId
// @access  Private
exports.removeTrack = async (req, res) => {
    try {
        const playlistId = req.params.id;
        const trackId = req.params.trackId;
        const userId = req.user.id;

        // Check ownership
        const playlist = await getAsync('SELECT * FROM playlists WHERE id = ? AND user_id = ?', [playlistId, userId]);

        if (!playlist) {
            return res.status(404).json({ 
                success: false, 
                message: 'Playlist bulunamadı' 
            });
        }

        await runAsync('DELETE FROM playlist_tracks WHERE id = ? AND playlist_id = ?', [trackId, playlistId]);

        res.json({
            success: true,
            message: 'Şarkı kaldırıldı'
        });
    } catch (error) {
        console.error('Remove track error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Sunucu hatası' 
        });
    }
};
