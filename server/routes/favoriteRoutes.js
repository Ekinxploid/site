const express = require('express');
const router = express.Router();
const {
    getFavorites,
    addFavorite,
    removeFavorite
} = require('../controllers/favoriteController');
const { protect } = require('../middleware/auth');

router.use(protect); // All routes are protected

router.route('/')
    .get(getFavorites)
    .post(addFavorite);

router.route('/:videoId')
    .delete(removeFavorite);

module.exports = router;

