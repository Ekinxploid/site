# 🎵 Muzo - Spotify Tarzı Müzik Platformu

Full stack müzik dinleme platformu. YouTube Data API + Node.js backend.

## 🚀 Hızlı Başlangıç

### Local (Bilgisayarında)

```bash
npm install
npm start
```

Frontend: VS Code Live Server ile `auth.html` aç

### VPS Deploy

```bash
# Backend başlat
npm start

# Port 5000'i firewall'da aç
sudo ufw allow 5000
```

**Erişim:** `http://VPS_IP:5000`

## 📦 Vercel Deploy

### Yöntem 1: GitHub + Vercel Dashboard

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/USERNAME/muzo.git
git push -u origin main
```

Sonra: https://vercel.com → Import GitHub → Deploy

### Yöntem 2: Vercel CLI

```bash
npm install -g vercel
vercel login
vercel
vercel --prod
```

## ⚠️ Backend Notu

**Vercel'de SQLite çalışmaz!** 

**Çözüm:** Backend'i Railway'e deploy et
- https://railway.app/
- GitHub'dan import
- SQLite çalışır ✅

## 🔧 Özellikler

- ✅ Login/Register
- ✅ Playlist oluşturma
- ✅ YouTube arama
- ✅ Profil yönetimi
- ✅ Favoriler
- ✅ Spotify UI

## 📝 Environment Variables

```env
JWT_SECRET=your_secret_key
JWT_EXPIRE=7d
NODE_ENV=production
PORT=5000
```

## 🌐 Demo

VPS: http://31.56.87.193:5000

---

**Made with ❤️ for music lovers**

