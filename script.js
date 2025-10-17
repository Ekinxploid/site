/* ===================================
   MUZO - FULL STACK MUSIC PLAYER
   =================================== */

// ==================== CONFIGURATION ====================

// API Configuration
// Manuel olarak VPS IP'nizi buraya yazın:
const VPS_IP = '31.56.87.193'; // VPS IP adresiniz
const BACKEND_PORT = '5000';   // Backend port

const getApiUrl = () => {
    const hostname = window.location.hostname;
    
    // Localhost
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'http://localhost:5000/api';
    }
    
    // VPS IP ile açılmışsa
    if (hostname === VPS_IP || hostname.includes('31.56.87.193')) {
        return `http://${VPS_IP}:${BACKEND_PORT}/api`;
    }
    
    // Domain veya başka durum
    return `http://${VPS_IP}:${BACKEND_PORT}/api`;
};

const API_URL = getApiUrl();
const AUTH_TOKEN = localStorage.getItem('muzo_token');

console.log('🔗 API URL:', API_URL); // Debug için

// YouTube API Key - Kullanıcı kendi API anahtarını buraya ekleyecek
const YOUTUBE_API_KEY = 'AIzaSyANlFq6Li5IbTo6gk6NKAE4Oaqvgn4puI8';

// API Endpoints
const YOUTUBE_SEARCH_URL = 'https://www.googleapis.com/youtube/v3/search';
const YOUTUBE_VIDEO_URL = 'https://www.googleapis.com/youtube/v3/videos';


// ==================== STATE MANAGEMENT ====================

const AppState = {
    // Player state
    player: null,
    currentTrack: null,
    currentTrackIndex: -1,
    isPlaying: false,
    volume: 70,
    isMuted: false,
    
    // Playback modes
    isShuffling: false,
    repeatMode: 0, // 0: off, 1: repeat all, 2: repeat one
    
    // Data
    queue: [],
    favorites: [],
    searchResults: [],
    userPlaylists: [],
    
    // Search pagination
    nextPageToken: null,
    currentSearchQuery: '',
    
    // UI state
    currentView: 'search'
};

// ==================== YOUTUBE PLAYER API ====================

// YouTube IFrame API ready callback
function onYouTubeIframeAPIReady() {
    console.log('YouTube IFrame API ready');
    AppState.player = new YT.Player('youtubePlayer', {
        height: '360',
        width: '640',
        playerVars: {
            'autoplay': 0,
            'controls': 0,
            'disablekb': 1,
            'fs': 0,
            'modestbranding': 1,
            'rel': 0
        },
        events: {
            'onReady': onPlayerReady,
            'onStateChange': onPlayerStateChange
        }
    });
}

function onPlayerReady(event) {
    console.log('Player ready');
    AppState.player.setVolume(AppState.volume);
    
    // Progress bar güncelleyicisi
    setInterval(updateProgressBar, 500);
}

function onPlayerStateChange(event) {
    if (event.data === YT.PlayerState.ENDED) {
        handleTrackEnd();
    } else if (event.data === YT.PlayerState.PLAYING) {
        AppState.isPlaying = true;
        updatePlayButton();
        showPlayingAnimation();
    } else if (event.data === YT.PlayerState.PAUSED) {
        AppState.isPlaying = false;
        updatePlayButton();
        hidePlayingAnimation();
    }
}

// ==================== YOUTUBE DATA API ====================

async function searchYouTube(query, pageToken = null) {
    console.log('🔍 Arama yapılıyor:', query);
    console.log('🌐 Kullanılan API URL:', API_URL);
    
    if (!YOUTUBE_API_KEY || YOUTUBE_API_KEY === 'YOUR_API_KEY_HERE') {
        showToast('Lütfen YouTube API anahtarınızı ekleyin!', 'error');
        return null;
    }
    
    showLoading(true);
    
    try {
        const params = new URLSearchParams({
            part: 'snippet',
            q: query + ' music',
            type: 'video',
            maxResults: 12,
            key: YOUTUBE_API_KEY,
            videoCategoryId: '10' // Music category
        });
        
        if (pageToken) {
            params.append('pageToken', pageToken);
        }
        
        const response = await fetch(`${YOUTUBE_SEARCH_URL}?${params}`);
        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error.message);
        }
        
        AppState.nextPageToken = data.nextPageToken || null;
        return data.items;
        
    } catch (error) {
        console.error('Search error:', error);
        showToast('Arama sırasında hata oluştu: ' + error.message, 'error');
        return null;
    } finally {
        showLoading(false);
    }
}

async function getVideoDetails(videoId) {
    try {
        const params = new URLSearchParams({
            part: 'contentDetails,statistics',
            id: videoId,
            key: YOUTUBE_API_KEY
        });
        
        const response = await fetch(`${YOUTUBE_VIDEO_URL}?${params}`);
        const data = await response.json();
        
        return data.items[0];
    } catch (error) {
        console.error('Video details error:', error);
        return null;
    }
}

// ==================== PLAYER CONTROLS ====================

function playTrack(track, index = -1) {
    if (!AppState.player || !AppState.player.loadVideoById) {
        showToast('Player henüz hazır değil', 'error');
        return;
    }
    
    AppState.currentTrack = track;
    AppState.currentTrackIndex = index;
    
    AppState.player.loadVideoById(track.videoId);
    AppState.isPlaying = true;
    
    updateNowPlaying();
    updatePlayButton();
    updateQueueUI();
}

function togglePlayPause() {
    if (!AppState.player || !AppState.currentTrack) return;
    
    if (AppState.isPlaying) {
        AppState.player.pauseVideo();
    } else {
        AppState.player.playVideo();
    }
}

function playNext() {
    if (AppState.queue.length === 0) return;
    
    let nextIndex;
    
    if (AppState.isShuffling) {
        nextIndex = Math.floor(Math.random() * AppState.queue.length);
    } else {
        nextIndex = (AppState.currentTrackIndex + 1) % AppState.queue.length;
    }
    
    playTrack(AppState.queue[nextIndex], nextIndex);
}

function playPrevious() {
    if (AppState.queue.length === 0) return;
    
    let prevIndex;
    
    if (AppState.isShuffling) {
        prevIndex = Math.floor(Math.random() * AppState.queue.length);
    } else {
        prevIndex = AppState.currentTrackIndex - 1;
        if (prevIndex < 0) prevIndex = AppState.queue.length - 1;
    }
    
    playTrack(AppState.queue[prevIndex], prevIndex);
}

function handleTrackEnd() {
    if (AppState.repeatMode === 2) {
        // Repeat one
        AppState.player.seekTo(0);
        AppState.player.playVideo();
    } else if (AppState.repeatMode === 1 || AppState.currentTrackIndex < AppState.queue.length - 1) {
        // Repeat all or has next track
        playNext();
    } else {
        // End of queue
        AppState.isPlaying = false;
        updatePlayButton();
        hidePlayingAnimation();
    }
}

function toggleShuffle() {
    AppState.isShuffling = !AppState.isShuffling;
    document.getElementById('shuffleBtn').classList.toggle('active', AppState.isShuffling);
    showToast(AppState.isShuffling ? 'Karışık çalma açık' : 'Karışık çalma kapalı', 'success');
}

function toggleRepeat() {
    AppState.repeatMode = (AppState.repeatMode + 1) % 3;
    const repeatBtn = document.getElementById('repeatBtn');
    const repeatIcon = repeatBtn.querySelector('i');
    
    repeatBtn.classList.toggle('active', AppState.repeatMode > 0);
    
    if (AppState.repeatMode === 2) {
        repeatIcon.className = 'fas fa-redo-alt';
        showToast('Bir şarkıyı tekrarla', 'success');
    } else {
        repeatIcon.className = 'fas fa-redo';
        if (AppState.repeatMode === 1) {
            showToast('Tümünü tekrarla', 'success');
        } else {
            showToast('Tekrar kapalı', 'success');
        }
    }
}

function setVolume(value) {
    if (!AppState.player) return;
    
    AppState.volume = value;
    AppState.player.setVolume(value);
    
    const muteBtn = document.getElementById('muteBtn');
    const icon = muteBtn.querySelector('i');
    
    if (value === 0) {
        icon.className = 'fas fa-volume-mute';
    } else if (value < 50) {
        icon.className = 'fas fa-volume-down';
    } else {
        icon.className = 'fas fa-volume-up';
    }
}

function toggleMute() {
    if (!AppState.player) return;
    
    AppState.isMuted = !AppState.isMuted;
    
    if (AppState.isMuted) {
        AppState.player.mute();
        document.getElementById('muteBtn').querySelector('i').className = 'fas fa-volume-mute';
    } else {
        AppState.player.unMute();
        setVolume(AppState.volume);
    }
}

function seekTo(percent) {
    if (!AppState.player || !AppState.currentTrack) return;
    
    const duration = AppState.player.getDuration();
    const seekTime = (percent / 100) * duration;
    AppState.player.seekTo(seekTime);
}

// ==================== PROGRESS BAR ====================

function updateProgressBar() {
    if (!AppState.player || !AppState.currentTrack) return;
    
    try {
        const currentTime = AppState.player.getCurrentTime();
        const duration = AppState.player.getDuration();
        
        if (duration && duration > 0) {
            const percent = (currentTime / duration) * 100;
            
            const progressFilled = document.getElementById('progressFilled');
            const progressHandle = document.getElementById('progressHandle');
            
            progressFilled.style.width = percent + '%';
            progressHandle.style.left = percent + '%';
            
            document.getElementById('timeCurrent').textContent = formatTime(currentTime);
            document.getElementById('timeDuration').textContent = formatTime(duration);
        }
    } catch (error) {
        // Player not ready yet
    }
    
    // Also update card progress bar if open
    updateCardProgressBar();
}

function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// ==================== QUEUE MANAGEMENT ====================

function addToQueue(track) {
    // Check if already in queue
    const exists = AppState.queue.some(t => t.videoId === track.videoId);
    
    if (exists) {
        showToast('Bu şarkı zaten kuyrukta', 'error');
        return;
    }
    
    AppState.queue.push(track);
    updateQueueUI();
    updateSidebarCounters();
    showToast('Kuyruğa eklendi', 'success');
    
    // If this is the first track, play it
    if (AppState.queue.length === 1) {
        playTrack(track, 0);
    }
}

function removeFromQueue(index) {
    AppState.queue.splice(index, 1);
    
    // Adjust current track index if needed
    if (index < AppState.currentTrackIndex) {
        AppState.currentTrackIndex--;
    } else if (index === AppState.currentTrackIndex) {
        // Current track removed, play next if available
        if (AppState.queue.length > 0) {
            const newIndex = Math.min(AppState.currentTrackIndex, AppState.queue.length - 1);
            playTrack(AppState.queue[newIndex], newIndex);
        } else {
            AppState.currentTrack = null;
            AppState.currentTrackIndex = -1;
            updateNowPlaying();
        }
    }
    
    updateQueueUI();
    updateSidebarCounters();
    showToast('Kuyruktan kaldırıldı', 'success');
}

function clearQueue() {
    if (AppState.queue.length === 0) return;
    
    if (confirm('Tüm kuyruğu temizlemek istediğinizden emin misiniz?')) {
        AppState.queue = [];
        AppState.currentTrack = null;
        AppState.currentTrackIndex = -1;
        
        if (AppState.player) {
            AppState.player.stopVideo();
        }
        
        updateQueueUI();
        updateNowPlaying();
        updateSidebarCounters();
        showToast('Kuyruk temizlendi', 'success');
    }
}

// ==================== FAVORITES MANAGEMENT ====================

function addToFavorites(track) {
    const exists = AppState.favorites.some(t => t.videoId === track.videoId);
    
    if (exists) {
        showToast('Bu şarkı zaten favorilerde', 'error');
        return;
    }
    
    AppState.favorites.push(track);
    saveFavoritesToStorage();
    updateFavoritesUI();
    updateAllFavoriteButtons();
    updateSidebarCounters();
    showToast('Favorilere eklendi', 'success');
}

function removeFromFavorites(videoId) {
    AppState.favorites = AppState.favorites.filter(t => t.videoId !== videoId);
    saveFavoritesToStorage();
    updateFavoritesUI();
    updateAllFavoriteButtons();
    updateSidebarCounters();
    showToast('Favorilerden kaldırıldı', 'success');
}

function toggleFavorite(track) {
    const exists = AppState.favorites.some(t => t.videoId === track.videoId);
    
    if (exists) {
        removeFromFavorites(track.videoId);
    } else {
        addToFavorites(track);
    }
}

function clearFavorites() {
    if (AppState.favorites.length === 0) return;
    
    if (confirm('Tüm favorileri temizlemek istediğinizden emin misiniz?')) {
        AppState.favorites = [];
        saveFavoritesToStorage();
        updateFavoritesUI();
        updateAllFavoriteButtons();
        updateSidebarCounters();
        showToast('Favoriler temizlendi', 'success');
    }
}

function isFavorite(videoId) {
    return AppState.favorites.some(t => t.videoId === videoId);
}

// ==================== LOCAL STORAGE ====================

function saveFavoritesToStorage() {
    try {
        localStorage.setItem('musicflow_favorites', JSON.stringify(AppState.favorites));
    } catch (error) {
        console.error('Failed to save favorites:', error);
    }
}

function loadFavoritesFromStorage() {
    try {
        const saved = localStorage.getItem('musicflow_favorites');
        if (saved) {
            AppState.favorites = JSON.parse(saved);
        }
    } catch (error) {
        console.error('Failed to load favorites:', error);
    }
}

// ==================== UI UPDATES ====================

function updateNowPlaying() {
    const thumbnail = document.getElementById('currentThumbnail');
    const title = document.getElementById('currentTitle');
    const artist = document.getElementById('currentArtist');
    const favoriteBtn = document.getElementById('currentFavoriteBtn');
    
    if (AppState.currentTrack) {
        thumbnail.src = AppState.currentTrack.thumbnail;
        title.textContent = AppState.currentTrack.title;
        artist.textContent = AppState.currentTrack.channel;
        
        const icon = favoriteBtn.querySelector('i');
        if (isFavorite(AppState.currentTrack.videoId)) {
            icon.className = 'fas fa-heart';
            favoriteBtn.classList.add('active');
        } else {
            icon.className = 'far fa-heart';
            favoriteBtn.classList.remove('active');
        }
    } else {
        thumbnail.src = '';
        title.textContent = 'Şarkı seçilmedi';
        artist.textContent = '-';
        favoriteBtn.querySelector('i').className = 'far fa-heart';
        favoriteBtn.classList.remove('active');
    }
}

function updatePlayButton() {
    const playBtn = document.getElementById('playPauseBtn');
    const icon = playBtn.querySelector('i');
    
    if (AppState.isPlaying) {
        icon.className = 'fas fa-pause';
    } else {
        icon.className = 'fas fa-play';
    }
    
    // Also update card play button if open
    updateNowPlayingCard();
}

function showPlayingAnimation() {
    document.querySelector('.playing-animation').classList.add('active');
}

function hidePlayingAnimation() {
    document.querySelector('.playing-animation').classList.remove('active');
}

function updateAllFavoriteButtons() {
    // Update all favorite buttons in search results and queue
    document.querySelectorAll('.track-action-btn[data-action="favorite"]').forEach(btn => {
        const videoId = btn.dataset.videoId;
        const icon = btn.querySelector('i');
        
        if (isFavorite(videoId)) {
            icon.className = 'fas fa-heart';
            btn.classList.add('favorited');
        } else {
            icon.className = 'far fa-heart';
            btn.classList.remove('favorited');
        }
    });
}

// ==================== SEARCH UI ====================

function displaySearchResults(results, append = false) {
    const container = document.getElementById('searchResults');
    
    if (!append) {
        container.innerHTML = '';
    }
    
    if (!results || results.length === 0) {
        if (!append) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-search"></i>
                    <p>Sonuç bulunamadı</p>
                </div>
            `;
        }
        return;
    }
    
    results.forEach(item => {
        const track = {
            videoId: item.id.videoId,
            title: item.snippet.title,
            channel: item.snippet.channelTitle,
            thumbnail: item.snippet.thumbnails.medium.url
        };
        
        AppState.searchResults.push(track);
        
        const card = createTrackCard(track, false);
        container.appendChild(card);
    });
    
    // Show/hide load more button
    const loadMoreBtn = document.getElementById('loadMoreBtn');
    loadMoreBtn.style.display = AppState.nextPageToken ? 'block' : 'none';
}

function createTrackCard(track, showRemove = false) {
    const card = document.createElement('div');
    card.className = 'track-card';
    
    if (AppState.currentTrack && AppState.currentTrack.videoId === track.videoId) {
        card.classList.add('now-playing');
    }
    
    const isFav = isFavorite(track.videoId);
    
    card.innerHTML = `
        <div class="track-thumbnail-wrapper">
            <img src="${track.thumbnail}" alt="${track.title}">
            <div class="play-overlay">
                <button class="play-overlay-btn">
                    <i class="fas fa-play"></i>
                </button>
            </div>
        </div>
        <div class="track-details">
            <div class="track-card-title">${track.title}</div>
            <div class="track-card-artist">${track.channel}</div>
        </div>
        <div class="track-card-actions">
            ${showRemove ? 
                `<button class="track-action-btn" data-action="remove">
                    <i class="fas fa-times"></i> Kaldır
                </button>` :
                `<button class="track-action-btn" data-action="queue">
                    <i class="fas fa-plus"></i> Sıraya Ekle
                </button>
                <button class="track-action-btn" data-action="addToPlaylist">
                    <i class="fas fa-folder-plus"></i> Playlist
                </button>`
            }
            <button class="track-action-btn ${isFav ? 'favorited' : ''}" data-action="favorite" data-video-id="${track.videoId}">
                <i class="${isFav ? 'fas' : 'far'} fa-heart"></i>
            </button>
        </div>
    `;
    
    // Play button
    card.querySelector('.play-overlay-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        if (!showRemove) {
            addToQueue(track);
        }
        playTrackFromQueue(track);
    });
    
    // Action buttons
    const actionBtns = card.querySelectorAll('.track-action-btn');
    actionBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const action = btn.dataset.action;
            
            if (action === 'queue') {
                addToQueue(track);
            } else if (action === 'addToPlaylist') {
                const rect = btn.getBoundingClientRect();
                showAddToPlaylistMenu(track, rect.left, rect.bottom + 5);
            } else if (action === 'favorite') {
                toggleFavorite(track);
            } else if (action === 'remove') {
                const index = AppState.queue.findIndex(t => t.videoId === track.videoId);
                if (index !== -1) {
                    removeFromQueue(index);
                }
            }
        });
    });
    
    return card;
}

function playTrackFromQueue(track) {
    const index = AppState.queue.findIndex(t => t.videoId === track.videoId);
    if (index !== -1) {
        playTrack(AppState.queue[index], index);
    }
}

function updateQueueUI() {
    const container = document.getElementById('queueList');
    
    if (AppState.queue.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-music"></i>
                <p>Kuyruk boş</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = '';
    
    AppState.queue.forEach((track, index) => {
        const card = createTrackCard(track, true);
        container.appendChild(card);
    });
}

function updateFavoritesUI() {
    const container = document.getElementById('favoritesList');
    
    if (AppState.favorites.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-heart-broken"></i>
                <p>Henüz favori eklenmemiş</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = '';
    
    AppState.favorites.forEach(track => {
        const card = createTrackCard(track, false);
        container.appendChild(card);
    });
}

// ==================== VIEW MANAGEMENT ====================

function switchView(view) {
    AppState.currentView = view;
    
    // Update nav buttons
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === view);
    });
    
    // Update sections
    document.querySelectorAll('.main-content > section').forEach(section => {
        section.classList.add('hidden');
    });
    
    if (view === 'home') {
        document.getElementById('homeSection').classList.remove('hidden');
        updateHomeView();
    } else if (view === 'search') {
        document.getElementById('searchSection').classList.remove('hidden');
    } else if (view === 'favorites') {
        document.getElementById('favoritesSection').classList.remove('hidden');
        updateFavoritesUI();
    } else if (view === 'queue') {
        document.getElementById('queueSection').classList.remove('hidden');
        updateQueueUI();
    } else if (view === 'playlistDetail') {
        document.getElementById('playlistDetailSection').classList.remove('hidden');
        // Deactivate nav items
        document.querySelectorAll('.nav-item').forEach(btn => {
            btn.classList.remove('active');
        });
    } else if (view === 'profile') {
        document.getElementById('profileSection').classList.remove('hidden');
        updateProfileView();
        // Deactivate nav items
        document.querySelectorAll('.nav-item').forEach(btn => {
            btn.classList.remove('active');
        });
    }
}

// Load trending/popular music for home page
async function loadTrendingMusic() {
    const trendingContainer = document.getElementById('homeTrending');
    
    try {
        // Popüler müzik kategorilerinden rastgele ara
        const randomQueries = [
            'top music 2024',
            'popular songs',
            'trending music',
            'best music',
            'top hits'
        ];
        
        const randomQuery = randomQueries[Math.floor(Math.random() * randomQueries.length)];
        const results = await searchYouTube(randomQuery);
        
        if (results && results.length > 0) {
            trendingContainer.innerHTML = '';
            results.slice(0, 6).forEach(item => {
                const track = {
                    videoId: item.id.videoId,
                    title: item.snippet.title,
                    channel: item.snippet.channelTitle,
                    thumbnail: item.snippet.thumbnails.medium.url
                };
                
                const card = createTrackCard(track, false);
                trendingContainer.appendChild(card);
            });
        }
    } catch (error) {
        console.error('Load trending error:', error);
        trendingContainer.innerHTML = '<p style="color: #b3b3b3; padding: 20px;">Popüler şarkılar yüklenemedi</p>';
    }
}

// Update home view
function updateHomeView() {
    const user = JSON.parse(localStorage.getItem('muzo_user') || '{}');
    document.getElementById('homeUserName').textContent = user.display_name || 'Kullanıcı';
    
    // Load trending music
    loadTrendingMusic();
    
    // Display recent playlists
    const homeRecentPlaylists = document.getElementById('homeRecentPlaylists');
    if (AppState.userPlaylists && AppState.userPlaylists.length > 0) {
        homeRecentPlaylists.innerHTML = '';
        AppState.userPlaylists.slice(0, 6).forEach(playlist => {
            const card = createPlaylistCard(playlist);
            homeRecentPlaylists.appendChild(card);
        });
    } else {
        homeRecentPlaylists.innerHTML = `
            <div class="empty-state-small">
                <i class="fas fa-music"></i>
                <p>Henüz playlist yok</p>
            </div>
        `;
    }
    
    // Display favorites
    const homeFavorites = document.getElementById('homeFavorites');
    if (AppState.favorites && AppState.favorites.length > 0) {
        homeFavorites.innerHTML = '';
        AppState.favorites.slice(0, 10).forEach(track => {
            const card = createTrackCard(track, false);
            card.style.minWidth = '180px';
            homeFavorites.appendChild(card);
        });
    } else {
        homeFavorites.innerHTML = '<p style="color: #b3b3b3; padding: 20px;">Henüz favori şarkın yok</p>';
    }
}

// Update profile view
function updateProfileView() {
    const user = JSON.parse(localStorage.getItem('muzo_user') || '{}');
    
    document.getElementById('profilePageName').textContent = user.display_name || 'Kullanıcı';
    document.getElementById('profilePageAvatar').src = user.profile_image 
        ? `uploads/profiles/${user.profile_image}` 
        : 'uploads/profiles/default-avatar.png';
    
    // Update stats
    document.getElementById('profilePagePlaylists').textContent = `${AppState.userPlaylists?.length || 0} playlist`;
    document.getElementById('profilePageFavorites').textContent = `${AppState.favorites?.length || 0} beğeni`;
    
    document.getElementById('statPlaylists').textContent = AppState.userPlaylists?.length || 0;
    document.getElementById('statFavorites').textContent = AppState.favorites?.length || 0;
    document.getElementById('statQueue').textContent = AppState.queue?.length || 0;
    
    // Display playlists
    const profilePlaylists = document.getElementById('profilePlaylists');
    if (AppState.userPlaylists && AppState.userPlaylists.length > 0) {
        profilePlaylists.innerHTML = '';
        AppState.userPlaylists.forEach(playlist => {
            const card = createPlaylistCard(playlist);
            profilePlaylists.appendChild(card);
        });
    } else {
        profilePlaylists.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-music"></i>
                <p>Henüz playlist yok</p>
            </div>
        `;
    }
}

// Create playlist card
function createPlaylistCard(playlist) {
    const card = document.createElement('div');
    card.className = 'track-card';
    
    card.innerHTML = `
        <div class="track-thumbnail-wrapper">
            <div class="playlist-cover">
                <i class="fas fa-music"></i>
            </div>
            <div class="play-overlay">
                <button class="play-overlay-btn">
                    <i class="fas fa-folder-open"></i>
                </button>
            </div>
        </div>
        <div class="track-details">
            <div class="track-card-title">${playlist.name}</div>
            <div class="track-card-artist">${playlist.track_count || 0} şarkı</div>
        </div>
    `;
    
    card.addEventListener('click', () => {
        openPlaylistDetail(playlist.id);
    });
    
    return card;
}

// Playlist içinden arama
let playlistSearchTimeout;

async function searchForPlaylist(query) {
    if (!query || !currentPlaylistId) return;
    
    const results = await searchYouTube(query);
    if (results) {
        displayPlaylistSearchResults(results);
    }
}

function displayPlaylistSearchResults(results) {
    const container = document.getElementById('playlistSearchResults');
    
    if (!results || results.length === 0) {
        container.innerHTML = '<p style="color: #b3b3b3; padding: 20px;">Sonuç bulunamadı</p>';
        return;
    }
    
    container.innerHTML = '';
    
    results.forEach(item => {
        const track = {
            videoId: item.id.videoId,
            title: item.snippet.title,
            channel: item.snippet.channelTitle,
            thumbnail: item.snippet.thumbnails.medium.url
        };
        
        const card = createPlaylistSearchCard(track);
        container.appendChild(card);
    });
}

function createPlaylistSearchCard(track) {
    const card = document.createElement('div');
    card.className = 'track-card-small';
    
    card.innerHTML = `
        <div class="track-thumbnail-wrapper">
            <img src="${track.thumbnail}" alt="${track.title}">
        </div>
        <div class="track-details">
            <div class="track-card-title">${track.title}</div>
            <div class="track-card-artist">${track.channel}</div>
        </div>
        <button class="add-to-playlist-btn" title="Ekle">
            <i class="fas fa-plus"></i>
        </button>
    `;
    
    card.querySelector('.add-to-playlist-btn').addEventListener('click', async () => {
        await addTrackToPlaylist(currentPlaylistId, track);
        card.style.opacity = '0.5';
        card.querySelector('.add-to-playlist-btn').innerHTML = '<i class="fas fa-check"></i>';
    });
    
    return card;
}

// Update sidebar counters
function updateSidebarCounters() {
    const queueCount = document.getElementById('queueCount');
    const favCount = document.getElementById('favCount');
    const queueHeaderCount = document.getElementById('queueHeaderCount');
    const favoritesCount = document.getElementById('favoritesCount');
    
    if (queueCount) {
        queueCount.textContent = `${AppState.queue.length} şarkı`;
    }
    
    if (favCount) {
        favCount.textContent = `${AppState.favorites.length} şarkı`;
    }
    
    if (queueHeaderCount) {
        queueHeaderCount.textContent = `${AppState.queue.length} şarkı`;
    }
    
    if (favoritesCount) {
        favoritesCount.textContent = `${AppState.favorites.length} şarkı`;
    }
}

// ==================== NOW PLAYING CARD ====================

function openNowPlayingCard() {
    if (!AppState.currentTrack) return;
    
    const overlay = document.getElementById('nowPlayingOverlay');
    const artwork = document.getElementById('cardArtwork');
    const title = document.getElementById('cardTitle');
    const artist = document.getElementById('cardArtist');
    const playBtn = document.getElementById('cardPlayBtn');
    const favoriteBtn = document.getElementById('cardFavoriteBtn');
    const playAnimation = document.querySelector('.card-playing-animation');
    
    // Update card content
    artwork.src = AppState.currentTrack.thumbnail;
    title.textContent = AppState.currentTrack.title;
    artist.textContent = AppState.currentTrack.channel;
    
    // Update play button
    const playIcon = playBtn.querySelector('i');
    if (AppState.isPlaying) {
        playIcon.className = 'fas fa-pause';
        playAnimation.classList.add('active');
    } else {
        playIcon.className = 'fas fa-play';
        playAnimation.classList.remove('active');
    }
    
    // Update favorite button
    if (isFavorite(AppState.currentTrack.videoId)) {
        favoriteBtn.classList.add('active');
        favoriteBtn.querySelector('i').className = 'fas fa-heart';
        favoriteBtn.querySelector('span').textContent = 'Beğenildi';
    } else {
        favoriteBtn.classList.remove('active');
        favoriteBtn.querySelector('i').className = 'far fa-heart';
        favoriteBtn.querySelector('span').textContent = 'Beğen';
    }
    
    // Update shuffle and repeat states
    document.getElementById('cardShuffleBtn').classList.toggle('active', AppState.isShuffling);
    const cardRepeatBtn = document.getElementById('cardRepeatBtn');
    cardRepeatBtn.classList.toggle('active', AppState.repeatMode > 0);
    if (AppState.repeatMode === 2) {
        cardRepeatBtn.querySelector('i').className = 'fas fa-redo-alt';
    } else {
        cardRepeatBtn.querySelector('i').className = 'fas fa-redo';
    }
    
    // Show overlay
    overlay.classList.add('active');
}

function closeNowPlayingCard() {
    const overlay = document.getElementById('nowPlayingOverlay');
    overlay.classList.remove('active');
}

function updateNowPlayingCard() {
    if (!document.getElementById('nowPlayingOverlay').classList.contains('active')) return;
    
    const playBtn = document.getElementById('cardPlayBtn');
    const playIcon = playBtn.querySelector('i');
    const playAnimation = document.querySelector('.card-playing-animation');
    
    if (AppState.isPlaying) {
        playIcon.className = 'fas fa-pause';
        playAnimation.classList.add('active');
    } else {
        playIcon.className = 'fas fa-play';
        playAnimation.classList.remove('active');
    }
}

function updateCardProgressBar() {
    if (!document.getElementById('nowPlayingOverlay').classList.contains('active')) return;
    if (!AppState.player || !AppState.currentTrack) return;
    
    try {
        const currentTime = AppState.player.getCurrentTime();
        const duration = AppState.player.getDuration();
        
        if (duration && duration > 0) {
            const percent = (currentTime / duration) * 100;
            
            const progressFilled = document.getElementById('cardProgressFilled');
            progressFilled.style.width = percent + '%';
            
            document.getElementById('cardTimeCurrent').textContent = formatTime(currentTime);
            document.getElementById('cardTimeDuration').textContent = formatTime(duration);
        }
    } catch (error) {
        // Player not ready yet
    }
}

// ==================== UTILITIES ====================

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function showLoading(show) {
    const overlay = document.getElementById('loadingOverlay');
    overlay.classList.toggle('active', show);
}

// ==================== EVENT LISTENERS ====================

function initEventListeners() {
    // Search
    const searchInput = document.getElementById('searchInput');
    const clearSearchBtn = document.getElementById('clearSearch');
    
    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        clearSearchBtn.classList.toggle('active', query.length > 0);
        
        if (query.length === 0) {
            AppState.searchResults = [];
            displaySearchResults([]);
            return;
        }
        
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(async () => {
            AppState.currentSearchQuery = query;
            AppState.searchResults = [];
            const results = await searchYouTube(query);
            if (results) {
                displaySearchResults(results);
            }
        }, 800);
    });
    
    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        clearSearchBtn.classList.remove('active');
        AppState.searchResults = [];
        displaySearchResults([]);
    });
    
    // Load more
    document.getElementById('loadMoreBtn').addEventListener('click', async () => {
        if (AppState.nextPageToken && AppState.currentSearchQuery) {
            const results = await searchYouTube(AppState.currentSearchQuery, AppState.nextPageToken);
            if (results) {
                displaySearchResults(results, true);
            }
        }
    });
    
    // Navigation
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.addEventListener('click', () => {
            switchView(btn.dataset.view);
        });
    });
    
    // Player controls
    document.getElementById('playPauseBtn').addEventListener('click', togglePlayPause);
    document.getElementById('nextBtn').addEventListener('click', playNext);
    document.getElementById('prevBtn').addEventListener('click', playPrevious);
    document.getElementById('shuffleBtn').addEventListener('click', toggleShuffle);
    document.getElementById('repeatBtn').addEventListener('click', toggleRepeat);
    
    // Volume
    document.getElementById('volumeSlider').addEventListener('input', (e) => {
        setVolume(parseInt(e.target.value));
    });
    
    document.getElementById('muteBtn').addEventListener('click', toggleMute);
    
    // Current favorite button
    document.getElementById('currentFavoriteBtn').addEventListener('click', () => {
        if (AppState.currentTrack) {
            toggleFavorite(AppState.currentTrack);
        }
    });
    
    // Now playing info click - open expanded card
    document.querySelector('.now-playing').addEventListener('click', (e) => {
        if (!e.target.closest('.favorite-btn') && AppState.currentTrack) {
            openNowPlayingCard();
        }
    });
    
    // Now Playing Card controls
    document.getElementById('closeCardBtn').addEventListener('click', closeNowPlayingCard);
    
    document.getElementById('cardPlayBtn').addEventListener('click', togglePlayPause);
    document.getElementById('cardPrevBtn').addEventListener('click', playPrevious);
    document.getElementById('cardNextBtn').addEventListener('click', playNext);
    document.getElementById('cardShuffleBtn').addEventListener('click', () => {
        toggleShuffle();
        document.getElementById('cardShuffleBtn').classList.toggle('active', AppState.isShuffling);
    });
    document.getElementById('cardRepeatBtn').addEventListener('click', () => {
        toggleRepeat();
        const cardRepeatBtn = document.getElementById('cardRepeatBtn');
        cardRepeatBtn.classList.toggle('active', AppState.repeatMode > 0);
        if (AppState.repeatMode === 2) {
            cardRepeatBtn.querySelector('i').className = 'fas fa-redo-alt';
        } else {
            cardRepeatBtn.querySelector('i').className = 'fas fa-redo';
        }
    });
    
    document.getElementById('cardFavoriteBtn').addEventListener('click', () => {
        if (AppState.currentTrack) {
            toggleFavorite(AppState.currentTrack);
            const favoriteBtn = document.getElementById('cardFavoriteBtn');
            if (isFavorite(AppState.currentTrack.videoId)) {
                favoriteBtn.classList.add('active');
                favoriteBtn.querySelector('i').className = 'fas fa-heart';
                favoriteBtn.querySelector('span').textContent = 'Beğenildi';
            } else {
                favoriteBtn.classList.remove('active');
                favoriteBtn.querySelector('i').className = 'far fa-heart';
                favoriteBtn.querySelector('span').textContent = 'Beğen';
            }
        }
    });
    
    document.getElementById('cardQueueBtn').addEventListener('click', () => {
        if (AppState.currentTrack) {
            addToQueue(AppState.currentTrack);
        }
    });
    
    // Card progress bar
    const cardProgressBar = document.getElementById('cardProgressBar');
    cardProgressBar.addEventListener('click', (e) => {
        const rect = cardProgressBar.getBoundingClientRect();
        const percent = ((e.clientX - rect.left) / rect.width) * 100;
        seekTo(Math.max(0, Math.min(100, percent)));
    });
    
    // Close card on overlay click
    document.getElementById('nowPlayingOverlay').addEventListener('click', (e) => {
        if (e.target.id === 'nowPlayingOverlay') {
            closeNowPlayingCard();
        }
    });
    
    // Close card on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeNowPlayingCard();
        }
    });
    
    // Progress bar
    const progressBar = document.getElementById('progressBar');
    let isDragging = false;
    
    progressBar.addEventListener('mousedown', (e) => {
        isDragging = true;
        handleProgressClick(e);
    });
    
    document.addEventListener('mousemove', (e) => {
        if (isDragging) {
            handleProgressClick(e);
        }
    });
    
    document.addEventListener('mouseup', () => {
        isDragging = false;
    });
    
    progressBar.addEventListener('click', handleProgressClick);
    
    function handleProgressClick(e) {
        const rect = progressBar.getBoundingClientRect();
        const percent = ((e.clientX - rect.left) / rect.width) * 100;
        seekTo(Math.max(0, Math.min(100, percent)));
    }
    
    // Clear buttons
    document.getElementById('clearQueue').addEventListener('click', clearQueue);
    document.getElementById('clearFavorites').addEventListener('click', clearFavorites);
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Don't trigger when typing in input
        if (e.target.tagName === 'INPUT') return;
        
        switch(e.code) {
            case 'Space':
                e.preventDefault();
                togglePlayPause();
                break;
            case 'ArrowRight':
                playNext();
                break;
            case 'ArrowLeft':
                playPrevious();
                break;
        }
    });
    
    // Mobile menu toggle
    const mobileMenuToggle = document.getElementById('mobileMenuToggle');
    const sidebar = document.querySelector('.sidebar');
    
    if (mobileMenuToggle) {
        mobileMenuToggle.addEventListener('click', () => {
            sidebar.classList.toggle('mobile-open');
        });
        
        // Close sidebar when clicking outside
        document.addEventListener('click', (e) => {
            if (window.innerWidth <= 480) {
                if (!sidebar.contains(e.target) && !mobileMenuToggle.contains(e.target)) {
                    sidebar.classList.remove('mobile-open');
                }
            }
        });
    }
    
    // Logout button
    document.getElementById('logoutBtn').addEventListener('click', logout);
    
    // Open profile page from sidebar (double functionality)
    const userInfo = document.querySelector('.user-info');
    let clickCount = 0;
    let clickTimer = null;
    
    userInfo.addEventListener('click', () => {
        clickCount++;
        
        if (clickCount === 1) {
            clickTimer = setTimeout(() => {
                // Single click - open profile page
                switchView('profile');
                clickCount = 0;
            }, 300);
        } else if (clickCount === 2) {
            // Double click - open profile modal
            clearTimeout(clickTimer);
            openProfileModal();
            clickCount = 0;
        }
    });
    
    // Profile page edit button
    if (document.getElementById('editProfilePageBtn')) {
        document.getElementById('editProfilePageBtn').addEventListener('click', openProfileModal);
    }
    
    // Playlist search (playlist içinden şarkı arama)
    const playlistSearchInput = document.getElementById('playlistSearchInput');
    const clearPlaylistSearch = document.getElementById('clearPlaylistSearch');
    
    playlistSearchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        clearPlaylistSearch.classList.toggle('active', query.length > 0);
        
        if (query.length === 0) {
            document.getElementById('playlistSearchResults').innerHTML = '';
            return;
        }
        
        clearTimeout(playlistSearchTimeout);
        playlistSearchTimeout = setTimeout(() => {
            searchForPlaylist(query);
        }, 800);
    });
    
    clearPlaylistSearch.addEventListener('click', () => {
        playlistSearchInput.value = '';
        clearPlaylistSearch.classList.remove('active');
        document.getElementById('playlistSearchResults').innerHTML = '';
    });
    
    // Create Playlist Modal
    const createPlaylistBtn = document.getElementById('createPlaylistBtn');
    const createPlaylistModal = document.getElementById('createPlaylistModal');
    const closePlaylistModal = document.getElementById('closePlaylistModal');
    const cancelPlaylistBtn = document.getElementById('cancelPlaylistBtn');
    const createPlaylistForm = document.getElementById('createPlaylistForm');
    
    createPlaylistBtn.addEventListener('click', () => {
        createPlaylistModal.classList.add('active');
    });
    
    closePlaylistModal.addEventListener('click', () => {
        createPlaylistModal.classList.remove('active');
    });
    
    cancelPlaylistBtn.addEventListener('click', () => {
        createPlaylistModal.classList.remove('active');
    });
    
    createPlaylistModal.addEventListener('click', (e) => {
        if (e.target.id === 'createPlaylistModal') {
            createPlaylistModal.classList.remove('active');
        }
    });
    
    createPlaylistForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const name = document.getElementById('playlistName').value;
        const description = document.getElementById('playlistDescription').value;
        const isPublic = document.getElementById('playlistPublic').checked;
        
        const success = await createPlaylist(name, description, isPublic);
        
        if (success) {
            createPlaylistModal.classList.remove('active');
            createPlaylistForm.reset();
        }
    });
    
    // Edit Playlist Modal
    const editPlaylistModal = document.getElementById('editPlaylistModal');
    const closeEditPlaylistModal = document.getElementById('closeEditPlaylistModal');
    const cancelEditPlaylistBtn = document.getElementById('cancelEditPlaylistBtn');
    const editPlaylistForm = document.getElementById('editPlaylistForm');
    
    document.getElementById('editPlaylistBtn').addEventListener('click', () => {
        if (!currentPlaylist) return;
        document.getElementById('editPlaylistName').value = currentPlaylist.name;
        document.getElementById('editPlaylistDescription').value = currentPlaylist.description || '';
        editPlaylistModal.classList.add('active');
    });
    
    closeEditPlaylistModal.addEventListener('click', () => {
        editPlaylistModal.classList.remove('active');
    });
    
    cancelEditPlaylistBtn.addEventListener('click', () => {
        editPlaylistModal.classList.remove('active');
    });
    
    editPlaylistForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const name = document.getElementById('editPlaylistName').value;
        const description = document.getElementById('editPlaylistDescription').value;
        
        const success = await updatePlaylist(currentPlaylistId, name, description);
        
        if (success) {
            editPlaylistModal.classList.remove('active');
        }
    });
    
    // Delete Playlist
    document.getElementById('deletePlaylistBtn').addEventListener('click', () => {
        if (currentPlaylistId) {
            deletePlaylist(currentPlaylistId);
        }
    });
    
    // Toggle Playlist Visibility
    document.getElementById('togglePlaylistVisibility').addEventListener('click', () => {
        if (currentPlaylistId) {
            togglePlaylistVisibility(currentPlaylistId);
        }
    });
    
    // Profile Modal
    const profileModal = document.getElementById('profileModal');
    const closeProfileModal = document.getElementById('closeProfileModal');
    const cancelProfileBtn = document.getElementById('cancelProfileBtn');
    const profileForm = document.getElementById('profileForm');
    
    document.querySelector('.user-info').addEventListener('click', openProfileModal);
    
    closeProfileModal.addEventListener('click', () => {
        profileModal.classList.remove('active');
    });
    
    cancelProfileBtn.addEventListener('click', () => {
        profileModal.classList.remove('active');
    });
    
    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const displayName = document.getElementById('profileDisplayName').value;
        
        const success = await updateProfile(displayName);
        
        if (success) {
            profileModal.classList.remove('active');
        }
    });
    
    // Profile image upload
    document.getElementById('profileImageInput').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
            await uploadProfileImage(file);
        }
    });
    
    // Context Menu
    document.getElementById('createNewPlaylistFromMenu').addEventListener('click', () => {
        hideContextMenu();
        createPlaylistModal.classList.add('active');
    });
    
    // Close context menu on click outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.context-menu') && !e.target.closest('[data-action="addToPlaylist"]')) {
            hideContextMenu();
        }
    });
}

// ==================== PLAYLIST MANAGEMENT ====================

let currentPlaylistId = null;
let currentPlaylist = null;

async function loadUserPlaylists() {
    if (!AUTH_TOKEN) return;
    
    try {
        const response = await fetch(`${API_URL}/playlists`, {
            headers: {
                'Authorization': `Bearer ${AUTH_TOKEN}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            AppState.userPlaylists = data.playlists;
            displayUserPlaylists(data.playlists);
        }
    } catch (error) {
        console.error('Load playlists error:', error);
    }
}

function displayUserPlaylists(playlists) {
    const container = document.getElementById('userPlaylists');
    
    if (!playlists || playlists.length === 0) {
        container.innerHTML = '';
        return;
    }
    
    container.innerHTML = playlists.map(playlist => `
        <div class="playlist-item" data-playlist-id="${playlist.id}">
            <div class="playlist-icon">
                <i class="fas fa-music"></i>
            </div>
            <div class="playlist-info">
                <div class="playlist-name">${playlist.name}</div>
                <div class="playlist-count-text">${playlist.track_count || 0} şarkı</div>
            </div>
        </div>
    `).join('');
    
    // Add click listeners
    document.querySelectorAll('.playlist-item').forEach(item => {
        item.addEventListener('click', () => {
            const playlistId = item.dataset.playlistId;
            openPlaylistDetail(playlistId);
        });
    });
}

async function createPlaylist(name, description, isPublic) {
    if (!AUTH_TOKEN) {
        showToast('Giriş yapmanız gerekiyor', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/playlists`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${AUTH_TOKEN}`
            },
            body: JSON.stringify({ name, description, isPublic })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast('Playlist oluşturuldu!', 'success');
            loadUserPlaylists();
            return true;
        } else {
            showToast(data.message, 'error');
            return false;
        }
    } catch (error) {
        console.error('Create playlist error:', error);
        showToast('Playlist oluşturulamadı', 'error');
        return false;
    }
}

async function openPlaylistDetail(playlistId) {
    if (!AUTH_TOKEN) return;
    
    currentPlaylistId = playlistId;
    
    try {
        const response = await fetch(`${API_URL}/playlists/${playlistId}`, {
            headers: {
                'Authorization': `Bearer ${AUTH_TOKEN}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            currentPlaylist = data.playlist;
            displayPlaylistDetail(data.playlist);
            switchView('playlistDetail');
        }
    } catch (error) {
        console.error('Load playlist detail error:', error);
        showToast('Playlist yüklenemedi', 'error');
    }
}

function displayPlaylistDetail(playlist) {
    document.getElementById('playlistDetailName').textContent = playlist.name;
    document.getElementById('playlistDetailCount').textContent = `${playlist.tracks?.length || 0} şarkı`;
    document.getElementById('playlistDetailVisibility').textContent = playlist.is_public ? 'Herkese Açık' : 'Özel';
    document.getElementById('playlistDetailDescription').textContent = playlist.description || '';
    document.getElementById('visibilityText').textContent = playlist.is_public ? 'Herkese Açık' : 'Özel';
    
    const tracksContainer = document.getElementById('playlistDetailTracks');
    
    if (!playlist.tracks || playlist.tracks.length === 0) {
        tracksContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-music"></i>
                <p>Playlist boş</p>
                <span>Arama yaparak şarkı ekle</span>
            </div>
        `;
        return;
    }
    
    tracksContainer.innerHTML = '';
    
    playlist.tracks.forEach(track => {
        const card = createPlaylistTrackCard(track);
        tracksContainer.appendChild(card);
    });
}

function createPlaylistTrackCard(track) {
    const card = document.createElement('div');
    card.className = 'track-card';
    
    const isFav = isFavorite(track.video_id);
    
    card.innerHTML = `
        <div class="track-thumbnail-wrapper">
            <img src="${track.thumbnail}" alt="${track.title}">
            <div class="play-overlay">
                <button class="play-overlay-btn">
                    <i class="fas fa-play"></i>
                </button>
            </div>
        </div>
        <div class="track-details">
            <div class="track-card-title">${track.title}</div>
            <div class="track-card-artist">${track.channel}</div>
        </div>
        <div class="track-card-actions">
            <button class="track-action-btn" data-action="removeFromPlaylist" data-track-id="${track.id}">
                <i class="fas fa-times"></i> Kaldır
            </button>
            <button class="track-action-btn ${isFav ? 'favorited' : ''}" data-action="favorite" data-video-id="${track.video_id}">
                <i class="${isFav ? 'fas' : 'far'} fa-heart"></i>
            </button>
        </div>
    `;
    
    // Play button
    card.querySelector('.play-overlay-btn').addEventListener('click', () => {
        const trackObj = {
            videoId: track.video_id,
            title: track.title,
            channel: track.channel,
            thumbnail: track.thumbnail
        };
        addToQueue(trackObj);
        playTrackFromQueue(trackObj);
    });
    
    // Action buttons
    card.querySelectorAll('.track-action-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const action = btn.dataset.action;
            
            if (action === 'removeFromPlaylist') {
                await removeTrackFromPlaylist(currentPlaylistId, track.id);
            } else if (action === 'favorite') {
                const trackObj = {
                    videoId: track.video_id,
                    title: track.title,
                    channel: track.channel,
                    thumbnail: track.thumbnail
                };
                toggleFavorite(trackObj);
            }
        });
    });
    
    return card;
}

async function removeTrackFromPlaylist(playlistId, trackId) {
    if (!AUTH_TOKEN) return;
    
    try {
        const response = await fetch(`${API_URL}/playlists/${playlistId}/tracks/${trackId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${AUTH_TOKEN}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast('Şarkı kaldırıldı', 'success');
            openPlaylistDetail(playlistId); // Refresh
        }
    } catch (error) {
        console.error('Remove track error:', error);
        showToast('Şarkı kaldırılamadı', 'error');
    }
}

async function addTrackToPlaylist(playlistId, track) {
    if (!AUTH_TOKEN) return;
    
    try {
        const response = await fetch(`${API_URL}/playlists/${playlistId}/tracks`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${AUTH_TOKEN}`
            },
            body: JSON.stringify({
                videoId: track.videoId,
                title: track.title,
                channel: track.channel,
                thumbnail: track.thumbnail
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast('Playlist\'e eklendi!', 'success');
            loadUserPlaylists(); // Refresh counts
        } else {
            showToast(data.message, 'error');
        }
    } catch (error) {
        console.error('Add to playlist error:', error);
        showToast('Eklenemedi', 'error');
    }
}

async function updatePlaylist(playlistId, name, description) {
    if (!AUTH_TOKEN) return;
    
    try {
        const response = await fetch(`${API_URL}/playlists/${playlistId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${AUTH_TOKEN}`
            },
            body: JSON.stringify({ name, description })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast('Playlist güncellendi', 'success');
            loadUserPlaylists();
            if (currentPlaylistId === playlistId) {
                openPlaylistDetail(playlistId);
            }
            return true;
        } else {
            showToast(data.message, 'error');
            return false;
        }
    } catch (error) {
        console.error('Update playlist error:', error);
        showToast('Güncellenemedi', 'error');
        return false;
    }
}

async function deletePlaylist(playlistId) {
    if (!AUTH_TOKEN) return;
    
    if (!confirm('Bu playlist\'i silmek istediğinizden emin misiniz?')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/playlists/${playlistId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${AUTH_TOKEN}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast('Playlist silindi', 'success');
            loadUserPlaylists();
            switchView('search');
        }
    } catch (error) {
        console.error('Delete playlist error:', error);
        showToast('Silinemedi', 'error');
    }
}

async function togglePlaylistVisibility(playlistId) {
    if (!AUTH_TOKEN || !currentPlaylist) return;
    
    const newVisibility = !currentPlaylist.is_public;
    
    try {
        const response = await fetch(`${API_URL}/playlists/${playlistId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${AUTH_TOKEN}`
            },
            body: JSON.stringify({ isPublic: newVisibility })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast(newVisibility ? 'Herkese açık yapıldı' : 'Özel yapıldı', 'success');
            openPlaylistDetail(playlistId);
        }
    } catch (error) {
        console.error('Toggle visibility error:', error);
        showToast('Değiştirilemedi', 'error');
    }
}

// ==================== PROFILE MANAGEMENT ====================

function openProfileModal() {
    const user = JSON.parse(localStorage.getItem('muzo_user') || '{}');
    
    document.getElementById('profileDisplayName').value = user.display_name || '';
    document.getElementById('profileEmail').value = user.email || '';
    document.getElementById('profileAvatarPreview').src = user.profile_image 
        ? `uploads/profiles/${user.profile_image}` 
        : 'uploads/profiles/default-avatar.png';
    
    document.getElementById('profileModal').classList.add('active');
}

async function updateProfile(displayName) {
    if (!AUTH_TOKEN) return;
    
    try {
        const response = await fetch(`${API_URL}/auth/profile`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${AUTH_TOKEN}`
            },
            body: JSON.stringify({ displayName })
        });
        
        const data = await response.json();
        
        if (data.success) {
            localStorage.setItem('muzo_user', JSON.stringify(data.user));
            
            // Update all profile displays
            document.getElementById('userName').textContent = data.user.display_name;
            document.getElementById('userEmail').textContent = data.user.email;
            
            const profilePageName = document.getElementById('profilePageName');
            const homeUserName = document.getElementById('homeUserName');
            
            if (profilePageName) profilePageName.textContent = data.user.display_name;
            if (homeUserName) homeUserName.textContent = data.user.display_name;
            
            showToast('Profil güncellendi', 'success');
            return true;
        } else {
            showToast(data.message, 'error');
            return false;
        }
    } catch (error) {
        console.error('Update profile error:', error);
        showToast('Profil güncellenemedi', 'error');
        return false;
    }
}

async function uploadProfileImage(file) {
    if (!AUTH_TOKEN) return;
    
    const formData = new FormData();
    formData.append('image', file);
    
    try {
        const response = await fetch(`${API_URL}/auth/profile-image`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${AUTH_TOKEN}`
            },
            body: formData
        });
        
        const data = await response.json();
        
        if (data.success) {
            localStorage.setItem('muzo_user', JSON.stringify(data.user));
            
            // Update all avatar displays
            const imagePath = `uploads/profiles/${data.user.profile_image}`;
            document.getElementById('userAvatar').src = imagePath;
            document.getElementById('profileAvatarPreview').src = imagePath;
            
            const profilePageAvatar = document.getElementById('profilePageAvatar');
            if (profilePageAvatar) profilePageAvatar.src = imagePath;
            
            showToast('Profil fotoğrafı güncellendi', 'success');
        } else {
            showToast(data.message, 'error');
        }
    } catch (error) {
        console.error('Upload image error:', error);
        showToast('Fotoğraf yüklenemedi', 'error');
    }
}

// ==================== CONTEXT MENU (Add to Playlist) ====================

let contextMenuTrack = null;

function showAddToPlaylistMenu(track, x, y) {
    contextMenuTrack = track;
    const menu = document.getElementById('addToPlaylistMenu');
    const menuItems = document.getElementById('playlistMenuItems');
    
    // Load playlists
    if (AppState.userPlaylists && AppState.userPlaylists.length > 0) {
        menuItems.innerHTML = AppState.userPlaylists.map(playlist => `
            <button class="context-menu-item" data-playlist-id="${playlist.id}">
                <i class="fas fa-music"></i>
                ${playlist.name}
            </button>
        `).join('');
        
        // Add click listeners
        menuItems.querySelectorAll('.context-menu-item').forEach(item => {
            item.addEventListener('click', async () => {
                const playlistId = item.dataset.playlistId;
                await addTrackToPlaylist(playlistId, contextMenuTrack);
                hideContextMenu();
            });
        });
    } else {
        menuItems.innerHTML = '<div style="padding: 12px; color: #b3b3b3; text-align: center;">Playlist oluşturun</div>';
    }
    
    // Position menu
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    menu.classList.add('active');
}

function hideContextMenu() {
    document.getElementById('addToPlaylistMenu').classList.remove('active');
}

// ==================== AUTH FUNCTIONS ====================

function logout() {
    if (confirm('Çıkış yapmak istediğinizden emin misiniz?')) {
        localStorage.removeItem('muzo_token');
        localStorage.removeItem('muzo_user');
        window.location.href = 'auth.html';
    }
}

// ==================== INITIALIZATION ====================

function init() {
    console.log('🎵 Initializing Muzo...');
    
    // Check authentication
    if (!AUTH_TOKEN) {
        window.location.href = 'auth.html';
        return;
    }
    
    // Check API key
    if (!YOUTUBE_API_KEY || YOUTUBE_API_KEY === 'YOUR_API_KEY_HERE') {
        showToast('⚠️ YouTube API anahtarı eksik! Lütfen script.js dosyasında YOUTUBE_API_KEY değişkenini düzenleyin.', 'error');
    }
    
    // Load favorites from storage
    loadFavoritesFromStorage();
    
    // Load user playlists
    loadUserPlaylists();
    
    // Initialize event listeners
    initEventListeners();
    
    // Update sidebar counters
    updateSidebarCounters();
    
    // Set initial view
    switchView('home');
    
    console.log('✨ Muzo initialized successfully!');
    console.log('🎧 Müziğin keyfini çıkar!');
}

// Start app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// Make onYouTubeIframeAPIReady available globally
window.onYouTubeIframeAPIReady = onYouTubeIframeAPIReady;

