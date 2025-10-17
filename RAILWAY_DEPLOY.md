# 🚂 Railway Deploy - Adım Adım

## 📋 Ön Hazırlık

### 1. GitHub'a Yükle

```bash
# Git başlat
git init

# Dosyaları ekle
git add .

# Commit yap
git commit -m "Muzo Music Player"

# GitHub'da yeni repo oluştur (tarayıcıda):
# https://github.com/new → "muzo-music" → Create

# Remote ekle (kendi kullanıcı adınla)
git remote add origin https://github.com/KULLANICI_ADIN/muzo-music.git

# Push et
git branch -M main
git push -u origin main
```

---

## 🚀 Railway'e Deploy

### Adım 1: Railway'e Git

https://railway.app/

**"Start a New Project"** tıkla

### Adım 2: GitHub ile Giriş

**"Login with GitHub"** tıkla → İzin ver

### Adım 3: Yeni Proje

**"New Project"** → **"Deploy from GitHub repo"** seç

### Adım 4: Repo Seç

**muzo-music** repository'ni seç

### Adım 5: Environment Variables Ekle

**Variables** sekmesine tıkla → **New Variable** ekle:

```
JWT_SECRET = muzo_railway_secret_2024_super_secure_key
JWT_EXPIRE = 7d
NODE_ENV = production
PORT = 5000
```

### Adım 6: Deploy!

**Deploy** otomatik başlar!

1-2 dakikada:
```
✅ Building...
✅ Deploying...
✅ Live! 🎉
```

### Adım 7: URL Kopyala

Railway size link verir:
```
https://muzo-music-production.up.railway.app
```

---

## 🔧 Frontend'i Güncelle

Railway URL'ini kopyala, sonra:

### script.js (9-10. satır):
```javascript
const VPS_IP = 'muzo-music-production.up.railway.app';
const BACKEND_PORT = '443'; // HTTPS için
```

VEYA daha basit:

```javascript
// 12. satırdan itibaren tüm fonksiyonu değiştir:
const getApiUrl = () => {
    const hostname = window.location.hostname;
    
    // Localhost
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'http://localhost:5000/api';
    }
    
    // Production - Railway backend
    return 'https://muzo-music-production.up.railway.app/api';
};
```

### auth.html (273. satır):
```javascript
const VPS_IP = 'muzo-music-production.up.railway.app';
const BACKEND_PORT = '443';
```

---

## ✅ Test Et

### 1. Backend Test:
```
https://RAILWAY_URL/api/health
```

**Görmeli:**
```json
{
  "success": true,
  "message": "Muzo API Server Running!"
}
```

### 2. Frontend Test:

Frontend'i VPS'te aç veya local'de aç, Railway backend'ine bağlanacak!

---

## 🔄 Güncellemeler İçin

```bash
# Kod değiştir
git add .
git commit -m "Update: yeni özellik"
git push

# Railway otomatik deploy eder! 🎉
```

---

## 🆚 Railway vs VPS

| Özellik | Railway | VPS |
|---------|---------|-----|
| Kurulum | 5 dakika | 1 saat |
| HTTPS | Otomatik | Manuel (Let's Encrypt) |
| Auto-deploy | ✅ | ❌ |
| Ücret | Ücretsiz 500h | Ücretli |
| Kontrol | Sınırlı | Tam |

---

## 💡 İPUÇLARI

### Railway'de Domain Bağla (Opsiyonel)

1. Railway Dashboard → Settings
2. **Generate Domain** veya **Custom Domain** ekle
3. DNS ayarlarını yap

### Database Backup

Railway'de SQLite dosyası:
- Her deploy'da korunur
- Ama yedek almak iyi: `/server/database.sqlite` indir

---

## 🐛 Sorun Giderme

### "Build failed"
→ `package.json` scripts kontrol et:
```json
"scripts": {
  "start": "node server/server.js"
}
```

### "Cannot find module"
→ Environment'da `npm install` çalışıyor mu?

### Database kayboldu
→ Volume ekle (Railway Settings → Volumes)

---

**🚂 Railway'e deploy etmeye hazır mısın?** 

Git komutlarını çalıştırayım mı? 🚀

