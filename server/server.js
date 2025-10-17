const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { initDatabase } = require('./config/database');

// Initialize database
initDatabase();

const app = express();

// Middleware
app.use(cors({
    origin: '*', // Tüm origin'lere izin ver (VPS IP, localhost, domain)
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use(express.static(path.join(__dirname, '..')));

// Debug middleware - Her istek loglanır
app.use((req, res, next) => {
    console.log(`📥 ${req.method} ${req.url} - IP: ${req.ip}`);
    next();
});

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/playlists', require('./routes/playlistRoutes'));
app.use('/api/favorites', require('./routes/favoriteRoutes'));

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        success: true, 
        message: 'Muzo API Server Running!',
        timestamp: new Date().toISOString()
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Sunucu hatası'
    });
});

// 404 handler
app.use((req, res) => {
    console.log(`❌ 404 - Route bulunamadı: ${req.method} ${req.url}`);
    res.status(404).json({
        success: false,
        message: `Route bulunamadı: ${req.method} ${req.url}`,
        availableRoutes: [
            '/api/health',
            '/api/auth/register',
            '/api/auth/login',
            '/api/playlists',
            '/api/favorites'
        ]
    });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('🎵 ================================');
    console.log('🎵  MUZO SERVER RUNNING!');
    console.log('🎵 ================================');
    console.log(`🚀 Server: http://localhost:${PORT}`);
    console.log(`📊 API: http://localhost:${PORT}/api/health`);
    console.log(`📁 Client: Open index.html with Live Server`);
    console.log('');
    console.log('📱 TELEFON/DIŞ ERIŞIM:');
    console.log(`   http://YOUR_VPS_IP:${PORT}`);
    console.log(`   http://YOUR_VPS_IP:${PORT}/api/health`);
    console.log('🎵 ================================');
    console.log('');
});

