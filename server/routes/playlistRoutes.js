const express = require('express');
const router = express.Router();
const {
    getPlaylists,
    getPlaylist,
    createPlaylist,
    updatePlaylist,
    deletePlaylist,
    addTrack,
    removeTrack
} = require('../controllers/playlistController');
const { protect } = require('../middleware/auth');

router.use(protect); // All routes are protected

router.route('/')
    .get(getPlaylists)
    .post(createPlaylist);

router.route('/:id')
    .get(getPlaylist)
    .put(updatePlaylist)
    .delete(deletePlaylist);

router.route('/:id/tracks')
    .post(addTrack);

router.route('/:id/tracks/:trackId')
    .delete(removeTrack);

module.exports = router;

